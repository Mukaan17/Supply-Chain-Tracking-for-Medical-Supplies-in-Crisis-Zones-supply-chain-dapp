import {
    X,
    Package,
    MapPin,
    User,
    Clock,
    Thermometer,
    FileText,
    ArrowRight,
    CheckCircle2,
    AlertTriangle,
    Loader2,
  } from "lucide-react";
  import React, { useState, useEffect, useRef } from "react";
  import { useWriteContract, useWaitForTransactionReceipt, usePublicClient, useAccount } from "wagmi";
  import { useContractAddress } from "../hooks/useContract";
  import { getContractABI } from "../config/contracts";
  import { Address, decodeErrorResult } from "viem";
  import { useToastWithNotifications } from "../hooks/useToastWithNotifications";
  import logger from "../services/logging";
  
  interface ShipmentDetailModalProps {
    shipment: any;
    currentUserAddress: string;
    onClose: () => void;
    onUpdateStatus?: (id: string, newStatus: string) => void;
    onTransferOwnership?: (id: string, newOwner: string) => void;
    onRefresh?: () => void;
  }
  
  export function ShipmentDetailModal({
    shipment,
    currentUserAddress,
    onClose,
    onUpdateStatus,
    onTransferOwnership,
    onRefresh,
  }: ShipmentDetailModalProps) {
    const toast = useToastWithNotifications();
    const [newOwner, setNewOwner] = useState("");
    const [showTransferForm, setShowTransferForm] = useState(false);
    const [statusUpdatePending, setStatusUpdatePending] = useState(false);
    const [transferPending, setTransferPending] = useState(false);
    const modalRef = useRef<HTMLDivElement>(null);
    const backdropRef = useRef<HTMLDivElement>(null);
    
    // Track which transactions we've already notified about to prevent duplicate notifications
    const notifiedStatusTxRef = useRef<string | null>(null);
    const notifiedStatusErrorRef = useRef<string | null>(null);
    const notifiedTransferTxRef = useRef<string | null>(null);
    const notifiedTransferErrorRef = useRef<string | null>(null);

    const contractAddress = useContractAddress();
    const abi = getContractABI();
    const publicClient = usePublicClient();
    const { address: accountAddress } = useAccount();
    const { 
      writeContract: writeStatus, 
      data: statusTxHash,
      isError: isStatusError,
      error: statusError,
      isPending: isStatusPending,
    } = useWriteContract();
    const { 
      writeContract: writeTransfer, 
      data: transferTxHash,
      isError: isTransferError,
      error: transferError,
      isPending: isTransferPending,
    } = useWriteContract();
    
    // Network gas limit cap (Sepolia and most networks use 16,777,216)
    const MAX_GAS_LIMIT = 16777216n;
    
    const { isLoading: isStatusConfirming, isSuccess: isStatusConfirmed } = useWaitForTransactionReceipt({
      hash: statusTxHash,
    });

    const { isLoading: isTransferConfirming, isSuccess: isTransferConfirmed } = useWaitForTransactionReceipt({
      hash: transferTxHash,
    });
  
    const isOwner =
      shipment.owner?.toLowerCase() ===
      currentUserAddress?.toLowerCase();
  
  const supplyChainStages = [
    "Manufacturing",     // 0
    "Quality Control",   // 1
    "Warehouse",         // 2
    "In Transit",        // 3
    "Distribution",      // 4
    "Delivered",         // 5
  ];
  
    const currentStageIndex = supplyChainStages.indexOf(
      shipment.status,
    );
  
    const getStageStatus = (index: number) => {
      if (index < currentStageIndex) return "completed";
      if (index === currentStageIndex) return "current";
      return "pending";
    };

    // Map UI status to contract function name
  const getStatusFunctionName = (status: string): string | null => {
    // Map by stage index to avoid mismatches
    const stageIndex = supplyChainStages.indexOf(status);
    if (stageIndex === -1) {
      logger.warn('Unknown status in getStatusFunctionName', { status, availableStages: supplyChainStages });
      return null;
    }
    const fnByIndex: Record<number, string> = {
      1: "updateToQualityControl",   // Quality Control (index 1)
      2: "updateToWarehouse",         // Warehouse (index 2)
      3: "updateToInTransit",        // In Transit (index 3)
      4: "updateToDistribution",     // Distribution (index 4)
      5: "updateToDelivered",         // Delivered (index 5)
    };
    const functionName = fnByIndex[stageIndex];
    if (!functionName) {
      logger.warn('No function mapped for status index', { status, stageIndex, availableFunctions: Object.keys(fnByIndex) });
    }
    return functionName || null;
  };

    // Extract package ID from shipment ID
    // Supports both old format (MED-2025-001) and new format (CATEGORY-YEAR-001)
    // Examples: MED-2025-001, PHAR-2025-042, EQUIP-2024-123
    const extractPackageId = (shipmentId: string): bigint | null => {
      // Match pattern: {PREFIX}-{YEAR}-{NUMBER}
      // The number at the end is the package ID
      const match = shipmentId.match(/-(\d+)$/);
      if (match && match[1]) {
        return BigInt(match[1]);
      }
      // Fallback: try old format MED-2025-001
      const oldMatch = shipmentId.match(/MED-2025-(\d+)/);
      if (oldMatch && oldMatch[1]) {
        return BigInt(oldMatch[1]);
      }
      return null;
    };
  
    const handleTransfer = async () => {
      if (!newOwner.trim() || !contractAddress || !publicClient || !accountAddress) {
        toast.error("Please enter a valid address");
        return;
      }

      // Extract packageId as BigInt - CRITICAL: contract expects uint256, not string
      // extractPackageId already returns BigInt, ensuring proper ABI encoding
      const packageId = extractPackageId(shipment.id);
      if (!packageId) {
        toast.error("Invalid shipment ID");
        return;
      }

      // Validate address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(newOwner.trim())) {
        toast.error("Invalid Ethereum address format");
        return;
      }

      try {
        setTransferPending(true);
        // Reset notification refs for new transaction to allow notifications for this transaction
        notifiedTransferTxRef.current = null;
        notifiedTransferErrorRef.current = null;
        
        // Estimate gas first and cap it to network maximum
        let gasLimit: bigint | undefined;
        try {
          const estimatedGas = await publicClient.estimateContractGas({
            address: contractAddress as Address,
            abi,
            functionName: "transferOwnership",
            args: [packageId, newOwner.trim() as Address],
            account: accountAddress as Address,
          });
          
          // Apply 20% buffer but cap at network maximum
          const bufferedGas = (estimatedGas * 120n) / 100n;
          gasLimit = bufferedGas > MAX_GAS_LIMIT ? MAX_GAS_LIMIT : bufferedGas;
        } catch (gasError: any) {
          // Gas estimation failure usually means the transaction would revert
          const errorMessage = gasError?.message || String(gasError);
          let userMessage = "Transaction would fail. ";
          
          // Try to extract revert reason from error message
          if (errorMessage.includes('revert')) {
            if (errorMessage.includes('Only current owner')) {
              userMessage += "You are not the current owner of this package.";
            } else if (errorMessage.includes('must be in Manufacturing')) {
              userMessage += "Package must be in Manufacturing status to update to Quality Control.";
            } else if (errorMessage.includes('must be in Quality Control')) {
              userMessage += "Package must be in Quality Control status to update to Warehouse.";
            } else if (errorMessage.includes('must be in Warehouse')) {
              userMessage += "Package must be in Warehouse status to update to In Transit.";
            } else if (errorMessage.includes('must be in In Transit')) {
              userMessage += "Package must be in In Transit status to update to Distribution.";
            } else if (errorMessage.includes('must be in Distribution')) {
              userMessage += "Package must be in Distribution status to update to Delivered.";
            } else {
              userMessage += "Please check the package status and ownership, then try again.";
            }
          } else {
            userMessage += "Please check the package status and ownership, then try again.";
          }
          
          toast.error("Cannot Update Status", {
            description: userMessage,
          });
          setStatusUpdatePending(false);
          return;
        }
        
        writeTransfer({
          address: contractAddress as Address,
          abi,
          functionName: "transferOwnership",
          args: [packageId, newOwner.trim() as Address],
          gas: gasLimit,
        });
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        const isUserRejection = 
          errorMessage.includes('User rejected') ||
          errorMessage.includes('User denied') ||
          errorMessage.includes('user rejected') ||
          errorMessage.includes('user denied') ||
          errorMessage.includes('rejected the request') ||
          errorMessage.includes('ACTION_REJECTED') ||
          error?.code === 4001;
        
        if (isUserRejection) {
          toast.error("Transaction Cancelled", {
            description: "Ownership transfer was cancelled. You can try again.",
          });
        } else {
          toast.error("Failed to transfer ownership", {
            description: errorMessage,
          });
        }
        
        setTransferPending(false);
      }
    };

    // Handle successful transfer
    useEffect(() => {
      if (isTransferConfirmed && transferTxHash) {
        // Prevent duplicate notifications for the same transaction
        if (notifiedTransferTxRef.current === transferTxHash) {
          return;
        }
        notifiedTransferTxRef.current = transferTxHash;
        
        const transferredTo = newOwner; // Capture before clearing
        toast.success("Ownership Transferred", {
          description: `Shipment ${shipment.id} transferred successfully`,
        });
        setNewOwner("");
        setShowTransferForm(false);
        setTransferPending(false);
        if (onTransferOwnership && transferredTo) {
          onTransferOwnership(shipment.id, transferredTo);
        }
        if (onRefresh) {
          setTimeout(() => onRefresh(), 1000);
        }
      }
    }, [isTransferConfirmed, transferTxHash, shipment.id, onTransferOwnership, onRefresh, newOwner]);
  
    const handleStatusUpdate = async (newStatus: string) => {
      const newStatusIndex = supplyChainStages.indexOf(newStatus);
      if (newStatusIndex === -1) {
        toast.error("Invalid status selected");
        logger.error('Invalid status in handleStatusUpdate', null, { newStatus, availableStages: supplyChainStages });
        return;
      }
      
      if (currentStageIndex >= newStatusIndex) {
        toast.error("Can only advance status forward");
        return;
      }

      // Validate that we're only advancing by one step
      if (newStatusIndex !== currentStageIndex + 1) {
        toast.error("Can only advance status one step at a time");
        logger.warn('Attempted to skip status stages', { 
          currentIndex: currentStageIndex, 
          currentStatus: shipment.status,
          newIndex: newStatusIndex, 
          newStatus 
        });
        return;
      }

      const functionName = getStatusFunctionName(newStatus);
      if (!functionName || !contractAddress || !publicClient || !accountAddress) {
        toast.error("Invalid status update");
        logger.error('Failed to get function name or missing dependencies', null, { 
          newStatus, 
          functionName, 
          hasContractAddress: !!contractAddress,
          hasPublicClient: !!publicClient,
          hasAccountAddress: !!accountAddress 
        });
        return;
      }
      
      // Log the intended update for debugging
      logger.info('Status update initiated', {
        packageId: shipment.id,
        currentStatus: shipment.status,
        currentIndex: currentStageIndex,
        newStatus,
        newIndex: newStatusIndex,
        functionName,
      });

      // Extract packageId as BigInt - CRITICAL: contract expects uint256, not string
      // extractPackageId already returns BigInt, ensuring proper ABI encoding
      const packageId = extractPackageId(shipment.id);
      if (!packageId) {
        toast.error("Invalid shipment ID");
        return;
      }

      try {
        setStatusUpdatePending(true);
        // Reset notification refs for new transaction to allow notifications for this transaction
        notifiedStatusTxRef.current = null;
        notifiedStatusErrorRef.current = null;
        
        // Log UI state for debugging
        logger.info('Attempting status update', {
          packageId: packageId.toString(),
          uiStatus: shipment.status,
          uiOwner: shipment.owner,
          accountAddress,
          functionName,
          expectedStatus: supplyChainStages.indexOf("Manufacturing"),
        });
        
        // Note: We skip pre-transaction readContract check due to tuple decoding issues with viem
        // Gas estimation will catch any contract revert issues and provide the revert reason
        
        // Estimate gas first and cap it to network maximum
        let gasLimit: bigint | undefined;
        try {
          const estimatedGas = await publicClient.estimateContractGas({
            address: contractAddress as Address,
            abi,
            functionName,
            args: [packageId],
            account: accountAddress as Address,
          });
          
          // Apply 20% buffer but cap at network maximum
          const bufferedGas = (estimatedGas * 120n) / 100n;
          gasLimit = bufferedGas > MAX_GAS_LIMIT ? MAX_GAS_LIMIT : bufferedGas;
        } catch (gasError: any) {
          // Gas estimation failure usually means the transaction would revert
          // Try to extract the actual revert reason from the error
          let revertReason = '';
          let userMessage = '';
          
          // Viem errors can have the revert reason in different places
          // Try to extract from data.reason, data.errorName, or decode from data
          // Check nested error structures thoroughly using recursive extraction
          let actualRevertMessage = '';
          
          // Recursive function to extract revert reason from nested error structures
          const extractRevertReason = (error: any, depth = 0): string => {
            if (depth > 5 || !error) return ''; // Prevent infinite recursion
            
            // Check direct properties first (most common locations)
            if (error.reason && typeof error.reason === 'string' && error.reason !== 'execution reverted') {
              return error.reason;
            }
            if (error.errorName && typeof error.errorName === 'string') {
              return error.errorName;
            }
            if (error.signature && typeof error.signature === 'string') {
              // Error signature might contain the revert reason
              return error.signature;
            }
            
            // Check message property and extract revert reason from it
            if (error.message && typeof error.message === 'string') {
              // Try to extract revert message from error message string
              // Look for patterns like "revert: Only current owner" or "execution reverted: Package must be"
              const revertMatch = error.message.match(/revert:\s*(.+?)(?:\n|$)/i) || 
                                 error.message.match(/revert\s+(.+?)(?:\n|$)/i) ||
                                 error.message.match(/execution reverted:\s*(.+?)(?:\n|$)/i) ||
                                 error.message.match(/reverted:\s*(.+?)(?:\n|$)/i);
              if (revertMatch && revertMatch[1] && revertMatch[1].trim() !== 'execution reverted') {
                return revertMatch[1].trim();
              }
            }
            
            // Check data property
            if (error.data) {
              if (error.data.reason && typeof error.data.reason === 'string' && error.data.reason !== 'execution reverted') {
                return error.data.reason;
              }
              if (error.data.errorName && typeof error.data.errorName === 'string') {
                return error.data.errorName;
              }
              if (error.data.message && typeof error.data.message === 'string' && error.data.message !== 'execution reverted') {
                return error.data.message;
              }
              if (error.data.args && Array.isArray(error.data.args) && error.data.args.length > 0) {
                const firstArg = error.data.args[0];
                if (typeof firstArg === 'string' && firstArg.length > 0 && firstArg !== 'execution reverted') {
                  return String(firstArg);
                }
              }
            }
            
            // Recursively check cause (important - viem often nests errors here)
            if (error.cause) {
              const causeReason = extractRevertReason(error.cause, depth + 1);
              if (causeReason && causeReason !== 'execution reverted') return causeReason;
            }
            
            return '';
          };
          
          actualRevertMessage = extractRevertReason(gasError);
          
          // Special handling: Check gasError.cause.reason directly (common viem pattern)
          // The console logs show causeKeys includes "reason", so check it directly
          if ((!actualRevertMessage || actualRevertMessage === 'execution reverted') && gasError?.cause) {
            // Check cause.reason directly (most likely location)
            if (gasError.cause.reason && typeof gasError.cause.reason === 'string') {
              // Only use if it's not the generic "execution reverted"
              if (gasError.cause.reason !== 'execution reverted' && gasError.cause.reason.length > 0) {
                actualRevertMessage = gasError.cause.reason;
              }
            }
            // Check cause.data.reason
            if ((!actualRevertMessage || actualRevertMessage === 'execution reverted') && gasError.cause.data?.reason && typeof gasError.cause.data.reason === 'string') {
              if (gasError.cause.data.reason !== 'execution reverted' && gasError.cause.data.reason.length > 0) {
                actualRevertMessage = gasError.cause.data.reason;
              }
            }
            // Try to decode raw revert data using viem's decodeErrorResult
            if ((!actualRevertMessage || actualRevertMessage === 'execution reverted') && gasError.cause.raw) {
              try {
                const decoded = decodeErrorResult({
                  abi,
                  data: gasError.cause.raw as `0x${string}`,
                });
                if (decoded.errorName) {
                  actualRevertMessage = decoded.errorName;
                }
                // Check decoded args for revert reason
                if (decoded.args && Array.isArray(decoded.args) && decoded.args.length > 0) {
                  const firstArg = decoded.args[0];
                  if (typeof firstArg === 'string' && firstArg.length > 0 && firstArg !== 'execution reverted') {
                    actualRevertMessage = firstArg;
                  }
                }
              } catch (decodeError: any) {
                // Decoding failed, log but continue
                logger.debug('Failed to decode error result', {
                  error: decodeError?.message || String(decodeError),
                });
              }
            }
            // Check cause.signature (might contain error signature)
            if ((!actualRevertMessage || actualRevertMessage === 'execution reverted') && gasError.cause.signature && typeof gasError.cause.signature === 'string') {
              actualRevertMessage = gasError.cause.signature;
            }
            // Check cause.details (might contain formatted error details)
            if ((!actualRevertMessage || actualRevertMessage === 'execution reverted') && gasError.cause.details && typeof gasError.cause.details === 'string') {
              const detailsMatch = gasError.cause.details.match(/revert\s+(.+?)(?:\n|$)/i) || 
                                  gasError.cause.details.match(/execution reverted:\s*(.+?)(?:\n|$)/i);
              if (detailsMatch && detailsMatch[1] && detailsMatch[1].trim() !== 'execution reverted') {
                actualRevertMessage = detailsMatch[1].trim();
              }
            }
          }
          
          // Fallback: try to extract from shortMessage
          if (!actualRevertMessage && gasError?.shortMessage) {
            const shortMatch = gasError.shortMessage.match(/revert\s+(.+?)(?:\n|$)/i) || 
                             gasError.shortMessage.match(/reverted:\s*(.+?)(?:\n|$)/i);
            if (shortMatch && shortMatch[1]) {
              actualRevertMessage = shortMatch[1].trim();
            }
          }
          
          // Additional fallback: check the main error message
          if (!actualRevertMessage && gasError?.message) {
            const msgMatch = gasError.message.match(/revert\s+(.+?)(?:\n|$)/i) || 
                           gasError.message.match(/execution reverted:\s*(.+?)(?:\n|$)/i) ||
                           gasError.message.match(/reverted:\s*(.+?)(?:\n|$)/i);
            if (msgMatch && msgMatch[1]) {
              actualRevertMessage = msgMatch[1].trim();
            }
          }
          
          // Get the main error message
          if (gasError?.data?.message) {
            revertReason = gasError.data.message;
          } else if (gasError?.shortMessage) {
            revertReason = gasError.shortMessage;
          } else if (gasError?.message) {
            revertReason = gasError.message;
          } else {
            revertReason = String(gasError);
          }
          
          // Use actual revert message if found, otherwise use the main error message
          const fullRevertReason = actualRevertMessage || revertReason;
          
          // Parse common revert reasons - prioritize actualRevertMessage
          const messageToCheck = actualRevertMessage || fullRevertReason;
          const revertLower = messageToCheck.toLowerCase();
          
          // Log the extracted revert message for debugging
          const rawDataForLog = gasError.cause?.raw || gasError.cause?.data || gasError.data;
          logger.info('Gas estimation error analysis', {
            packageId: packageId.toString(),
            functionName,
            actualRevertMessage: actualRevertMessage || 'Not found',
            fullRevertReason,
            revertLower,
            errorKeys: gasError ? Object.keys(gasError) : [],
            dataKeys: gasError?.data ? Object.keys(gasError.data) : [],
            causeKeys: gasError?.cause ? Object.keys(gasError.cause) : [],
            causeReason: gasError?.cause?.reason || 'Not found',
            causeDataReason: gasError?.cause?.data?.reason || 'Not found',
            causeSignature: gasError?.cause?.signature || 'Not found',
            causeDetails: gasError?.cause?.details || 'Not found',
            causeRaw: rawDataForLog ? (typeof rawDataForLog === 'string' ? rawDataForLog.slice(0, 50) + '...' : 'Present (non-string)') : 'Not found',
            rawDataType: rawDataForLog ? typeof rawDataForLog : 'N/A',
          });
          
          // Check for specific contract revert messages
          if (revertLower.includes('only current owner') || revertLower.includes('only the current owner') || revertLower.includes('only owner can update')) {
            userMessage = "You are not the current owner of this package. Ownership may have changed on the blockchain. Please refresh the page to sync with blockchain.";
          } else if (revertLower.includes('must be in manufacturing') || (revertLower.includes('manufacturing') && functionName === 'updateToQualityControl')) {
            userMessage = `Package must be in "Manufacturing" status to update to "Quality Control". The package status may have changed on-chain. Please refresh the page to sync with blockchain.`;
          } else if (revertLower.includes('must be in quality control') || (revertLower.includes('quality control') && functionName === 'updateToWarehouse')) {
            userMessage = `Package must be in "Quality Control" status to update to "Warehouse". The package status may have changed on-chain. Please refresh the page to sync with blockchain.`;
          } else if (revertLower.includes('must be in warehouse') || (revertLower.includes('warehouse') && functionName === 'updateToInTransit')) {
            userMessage = `Package must be in "Warehouse" status to update to "In Transit". The package status may have changed on-chain. Please refresh the page to sync with blockchain.`;
          } else if (revertLower.includes('must be in in transit') || (revertLower.includes('in transit') && functionName === 'updateToDistribution')) {
            userMessage = `Package must be in "In Transit" status to update to "Distribution". The package status may have changed on-chain. Please refresh the page to sync with blockchain.`;
          } else if (revertLower.includes('must be in distribution') || (revertLower.includes('distribution') && functionName === 'updateToDelivered')) {
            userMessage = `Package must be in "Distribution" status to update to "Delivered". The package status may have changed on-chain. Please refresh the page to sync with blockchain.`;
          } else if (revertLower.includes('must be in') || revertLower.includes('status')) {
            userMessage = `Package status does not allow this transition. The package may have been updated on-chain. Please refresh the page to sync with blockchain.`;
          } else if (actualRevertMessage && actualRevertMessage.length > 0) {
            // If we found a specific revert message, use it directly
            userMessage = `Transaction would fail: ${actualRevertMessage}. Please refresh the page to sync with blockchain.`;
          } else if (revertLower.includes('revert')) {
            // Generic revert - try to extract from error message
            const revertMatch = revertReason.match(/revert\s+(.+?)(?:\n|$)/i) || revertReason.match(/execution reverted:\s*(.+?)(?:\n|$)/i);
            if (revertMatch && revertMatch[1]) {
              userMessage = `Transaction would revert: ${revertMatch[1].trim()}. Please refresh the page to sync with blockchain.`;
            } else {
              userMessage = "Transaction would fail. The package status or ownership may have changed on-chain. Try refreshing the page.";
            }
          } else {
            // Provide more specific guidance based on the function being called
            if (functionName === 'updateToQualityControl') {
              userMessage = "Cannot update to Quality Control. The package must be in 'Manufacturing' status on-chain. The package may have been updated by another transaction, or there may be a sync issue. Please refresh the page to sync with the blockchain.";
            } else {
              userMessage = "Transaction would fail. The package status or ownership may have changed on-chain. Please refresh the page to sync with the blockchain.";
            }
          }
          
          // Log the actual revert reason for debugging
          if (actualRevertMessage) {
            logger.info('Extracted actual revert reason', {
              functionName,
              packageId: packageId.toString(),
              revertReason: actualRevertMessage,
            });
          }
          
          // Log the full error for debugging (convert BigInt to string to avoid serialization issues)
          logger.warn('Gas estimation failed for status update', {
            functionName,
            packageId: packageId.toString(),
            error: revertReason,
            // Convert error to a serializable format
            fullError: {
              message: gasError?.message || String(gasError),
              shortMessage: gasError?.shortMessage,
              name: gasError?.name,
              code: gasError?.code,
              // Don't include data/cause as they may contain BigInt values
            },
          });
          
          toast.error("Cannot Update Status", {
            description: userMessage,
          });
          setStatusUpdatePending(false);
          return;
        }
        
        writeStatus({
          address: contractAddress as Address,
          abi,
          functionName,
          args: [packageId],
          gas: gasLimit,
        });
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        const isUserRejection = 
          errorMessage.includes('User rejected') ||
          errorMessage.includes('User denied') ||
          errorMessage.includes('user rejected') ||
          errorMessage.includes('user denied') ||
          errorMessage.includes('rejected the request') ||
          errorMessage.includes('ACTION_REJECTED') ||
          error?.code === 4001;
        
        if (isUserRejection) {
          toast.error("Transaction Cancelled", {
            description: "Status update was cancelled. You can try again.",
          });
        } else {
          // Ensure error message is a string (not BigInt or object)
          const safeErrorMessage = typeof errorMessage === 'string' 
            ? errorMessage 
            : errorMessage?.message || String(errorMessage);
          
          toast.error("Failed to update status", {
            description: safeErrorMessage,
          });
        }
        
        setStatusUpdatePending(false);
      }
    };

    // Handle successful status update
    useEffect(() => {
      if (isStatusConfirmed && statusTxHash) {
        // Prevent duplicate notifications for the same transaction
        if (notifiedStatusTxRef.current === statusTxHash) {
          return;
        }
        notifiedStatusTxRef.current = statusTxHash;
        
        toast.success("Status Updated", {
          description: `Shipment ${shipment.id} status updated successfully`,
        });
        setStatusUpdatePending(false);
        // Don't update UI status immediately - let the refresh pull the correct status from blockchain
        // This prevents UI from showing incorrect status if the transaction updated to a different status than expected
        if (onRefresh) {
          // Wait a bit for the transaction to be indexed, then refresh to get accurate on-chain status
          setTimeout(() => onRefresh(), 2000);
        }
      }
    }, [isStatusConfirmed, statusTxHash, shipment.id, onRefresh]);

    // Handle status update errors (including cancellation/rejection)
    useEffect(() => {
      if (isStatusError && statusError) {
        // Create a unique key for this error to prevent duplicate notifications
        const errorKey = `${statusError.message || String(statusError)}-${statusTxHash || 'no-hash'}`;
        if (notifiedStatusErrorRef.current === errorKey) {
          return;
        }
        notifiedStatusErrorRef.current = errorKey;
        
        const errorMessage = statusError.message || String(statusError);
        const isUserRejection = 
          errorMessage.includes('User rejected') ||
          errorMessage.includes('User denied') ||
          errorMessage.includes('user rejected') ||
          errorMessage.includes('user denied') ||
          errorMessage.includes('rejected the request') ||
          errorMessage.includes('ACTION_REJECTED') ||
          (statusError as any)?.code === 4001;
        
        if (isUserRejection) {
          toast.error("Transaction Cancelled", {
            description: "Status update was cancelled. You can try again.",
          });
        } else {
          toast.error("Status Update Failed", {
            description: errorMessage,
          });
        }
        
        setStatusUpdatePending(false);
      }
    }, [isStatusError, statusError, statusTxHash]);

    // Handle case where writeContract becomes non-pending without a hash (cancellation)
    useEffect(() => {
      if (statusUpdatePending && !isStatusPending && !statusTxHash && !isStatusError) {
        // If we were pending but now not pending, no hash, and no error yet, 
        // it might be a cancellation - wait a bit then reset
        const cancellationKey = `cancellation-${Date.now()}`;
        const timeout = setTimeout(() => {
          if (!statusTxHash && !isStatusError && notifiedStatusErrorRef.current !== cancellationKey) {
            notifiedStatusErrorRef.current = cancellationKey;
            setStatusUpdatePending(false);
            toast.error("Transaction Cancelled", {
              description: "Status update was cancelled. You can try again.",
            });
          }
        }, 1000);
        
        return () => clearTimeout(timeout);
      }
    }, [statusUpdatePending, isStatusPending, statusTxHash, isStatusError]);

    // Handle transfer errors (including cancellation/rejection)
    useEffect(() => {
      if (isTransferError && transferError) {
        // Create a unique key for this error to prevent duplicate notifications
        const errorKey = `${transferError.message || String(transferError)}-${transferTxHash || 'no-hash'}`;
        if (notifiedTransferErrorRef.current === errorKey) {
          return;
        }
        notifiedTransferErrorRef.current = errorKey;
        
        const errorMessage = transferError.message || String(transferError);
        const isUserRejection = 
          errorMessage.includes('User rejected') ||
          errorMessage.includes('User denied') ||
          errorMessage.includes('user rejected') ||
          errorMessage.includes('user denied') ||
          errorMessage.includes('rejected the request') ||
          errorMessage.includes('ACTION_REJECTED') ||
          (transferError as any)?.code === 4001;
        
        if (isUserRejection) {
          toast.error("Transaction Cancelled", {
            description: "Ownership transfer was cancelled. You can try again.",
          });
        } else {
          toast.error("Transfer Failed", {
            description: errorMessage,
          });
        }
        
        setTransferPending(false);
      }
    }, [isTransferError, transferError, transferTxHash]);

    // Handle case where writeContract becomes non-pending without a hash (cancellation)
    useEffect(() => {
      if (transferPending && !isTransferPending && !transferTxHash && !isTransferError) {
        // If we were pending but now not pending, no hash, and no error yet, 
        // it might be a cancellation - wait a bit then reset
        const cancellationKey = `transfer-cancellation-${Date.now()}`;
        const timeout = setTimeout(() => {
          if (!transferTxHash && !isTransferError && notifiedTransferErrorRef.current !== cancellationKey) {
            notifiedTransferErrorRef.current = cancellationKey;
            setTransferPending(false);
            toast.error("Transaction Cancelled", {
              description: "Ownership transfer was cancelled. You can try again.",
            });
          }
        }, 1000);
        
        return () => clearTimeout(timeout);
      }
    }, [transferPending, isTransferPending, transferTxHash, isTransferError]);

    // Handle Escape key to close modal
    useEffect(() => {
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape' && !statusUpdatePending && !transferPending) {
          onClose();
        }
      };
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose, statusUpdatePending, transferPending]);

    // Handle click outside to close modal
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === backdropRef.current && !statusUpdatePending && !transferPending) {
        onClose();
      }
    };

    // Focus trap - focus first element when modal opens
    useEffect(() => {
      if (modalRef.current) {
        const firstFocusable = modalRef.current.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
      }
    }, []);
  
    return (
      <div
        ref={backdropRef}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleBackdropClick}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div
          ref={modalRef}
          className="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-6 flex items-start justify-between z-10">
            <div>
              <h2 id="modal-title" className="text-white mb-1">
                Shipment Details
              </h2>
              <p className="font-mono text-blue-400 text-sm">
                {shipment.id}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-md transition-colors text-slate-400 hover:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
              aria-label="Close modal"
              disabled={statusUpdatePending || transferPending}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
  
          <div className="p-6 space-y-6">
            {/* Supply Chain Progress */}
            <div className="card p-6">
              <h3 className="text-white mb-6">
                Supply Chain Progress
              </h3>
              <div className="relative">
                {/* Progress Line */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-slate-700">
                  <div
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{
                      width: `${(currentStageIndex / (supplyChainStages.length - 1)) * 100}%`,
                    }}
                  ></div>
                </div>
  
                {/* Stages */}
                <div className="relative grid grid-cols-6 gap-2">
                  {supplyChainStages.map((stage, index) => {
                    const status = getStageStatus(index);
                    return (
                      <div
                        key={stage}
                        className="flex flex-col items-center"
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center border-2 mb-2 transition-all ${
                            status === "completed"
                              ? "bg-blue-500 border-blue-500"
                              : status === "current"
                                ? "bg-blue-500 border-blue-500 ring-4 ring-blue-500/20"
                                : "bg-slate-800 border-slate-700"
                          }`}
                        >
                          {status === "completed" ? (
                            <CheckCircle2 className="w-5 h-5 text-white" />
                          ) : (
                            <span
                              className={`text-xs ${status === "current" ? "text-white" : "text-slate-500"}`}
                            >
                              {index + 1}
                            </span>
                          )}
                        </div>
                        <p
                          className={`text-xs text-center leading-tight ${
                            status === "pending"
                              ? "text-slate-500"
                              : "text-slate-300"
                          }`}
                        >
                          {stage}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
  
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="card p-5">
                <div className="flex items-center gap-2 text-slate-400 mb-3">
                  <Package className="w-4 h-4" />
                  <h4>Product Details</h4>
                </div>
                <p className="text-white mb-2">
                  {shipment.description}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Category:
                    </span>
                    <span className="text-slate-300 capitalize">
                      {shipment.category}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Quantity:
                    </span>
                    <span className="text-slate-300">
                      {shipment.quantity}
                    </span>
                  </div>
                  {shipment.temperature && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Temperature:
                      </span>
                      <span className="text-cyan-400 flex items-center gap-1">
                        <Thermometer className="w-3 h-3" />
                        {shipment.temperature}
                      </span>
                    </div>
                  )}
                </div>
              </div>
  
              <div className="card p-5">
                <div className="flex items-center gap-2 text-slate-400 mb-3">
                  <MapPin className="w-4 h-4" />
                  <h4>Shipping Route</h4>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">
                      Origin
                    </p>
                    <p className="text-slate-300 text-sm">
                      {shipment.origin}
                    </p>
                  </div>
                  <div className="flex items-center justify-center">
                    <ArrowRight className="w-4 h-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 mb-1">
                      Destination
                    </p>
                    <p className="text-slate-300 text-sm">
                      {shipment.destination}
                    </p>
                  </div>
                </div>
              </div>
  
              <div className="card p-5">
                <div className="flex items-center gap-2 text-slate-400 mb-3">
                  <User className="w-4 h-4" />
                  <h4>Ownership & Handler</h4>
                </div>
                <div className="space-y-3 text-sm">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">
                      Current Owner
                    </p>
                    <p className="text-slate-300 font-mono text-xs break-all">
                      {shipment.owner}
                    </p>
                    {isOwner && (
                      <div className="mt-2 flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>You own this shipment</span>
                      </div>
                    )}
                  </div>
                  {shipment.handler && (
                    <div>
                      <p className="text-xs text-slate-500 mb-1">
                        Handler/Carrier
                      </p>
                      <p className="text-slate-300">
                        {shipment.handler}
                      </p>
                    </div>
                  )}
                </div>
              </div>
  
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Clock className="w-4 h-4" />
                    <h4>Timeline</h4>
                  </div>
                  {onRefresh && (
                    <button
                      onClick={async () => {
                        logger.info('Manual refresh triggered', { packageId: shipment.id });
                        // Clear cache to force full refetch
                        try {
                          if ((window as any).clearPackageCache) {
                            (window as any).clearPackageCache();
                            logger.info('Package cache cleared');
                          }
                        } catch (e) {
                          logger.debug('Could not clear cache', { error: e });
                        }
                        // Trigger refresh
                        onRefresh();
                        // Show feedback
                        toast.success("Refreshing...", {
                          description: "Fetching latest package state from blockchain",
                        });
                      }}
                      className="text-xs px-3 py-1.5 bg-amber-800 hover:bg-amber-700 text-amber-100 rounded-lg border border-amber-700 transition-colors font-medium shadow-sm"
                      title="Refresh package state from blockchain"
                    >
                      Refresh State
                    </button>
                  )}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Created:
                    </span>
                    <span className="text-slate-300">
                      {shipment.createdAt}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">
                      Last Update:
                    </span>
                    <span className="text-slate-300">
                      {shipment.lastUpdate}
                    </span>
                  </div>
                  {shipment.expectedDate && (
                    <div className="flex justify-between">
                      <span className="text-slate-400">
                        Expected:
                      </span>
                      <span className="text-slate-300">
                        {shipment.expectedDate}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
  
            {/* Additional Notes */}
            {shipment.notes && (
              <div className="card p-5">
                <div className="flex items-center gap-2 text-slate-400 mb-3">
                  <FileText className="w-4 h-4" />
                  <h4>Additional Notes</h4>
                </div>
                <p className="text-slate-300 text-sm">
                  {shipment.notes}
                </p>
              </div>
            )}
  
            {/* Owner Actions */}
            {isOwner && shipment.status !== "Delivered" && (
              <div className="card p-5 border-blue-500/20">
                <div className="flex items-center gap-2 text-blue-400 mb-4">
                  <AlertTriangle className="w-4 h-4" />
                  <h4>Owner Actions</h4>
                </div>
  
                <div className="space-y-4">
                  {/* Update Status */}
                  <div>
                    <label className="block text-sm text-slate-300 mb-2">
                      Update Shipment Status
                    </label>
                    <div className="flex gap-2">
                      <select
                        onChange={(e) =>
                          handleStatusUpdate(e.target.value)
                        }
                        value={shipment.status}
                        disabled={statusUpdatePending || isStatusConfirming}
                        className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        aria-label="Update shipment status"
                        aria-describedby={statusUpdatePending || isStatusConfirming ? "status-update-description" : undefined}
                      >
                        {supplyChainStages.map((stage) => (
                          <option
                            key={stage}
                            value={stage}
                            disabled={
                              supplyChainStages.indexOf(stage) <=
                              currentStageIndex
                            }
                          >
                            {stage}
                          </option>
                        ))}
                      </select>
                      {(statusUpdatePending || isStatusConfirming) && (
                        <div className="flex items-center gap-2 px-4 py-2 text-slate-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">
                            {isStatusConfirming ? "Confirming..." : "Processing..."}
                          </span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      You can only advance the status forward in
                      the supply chain
                    </p>
                  </div>
  
                  {/* Transfer Ownership */}
                  <div className="pt-4 border-t border-slate-700">
                    {!showTransferForm ? (
                      <div className="group relative inline-block">
                        <button
                          onClick={() => setShowTransferForm(true)}
                          disabled={transferPending || isTransferConfirming}
                          className="text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 rounded px-2 py-1"
                          aria-label="Transfer ownership to another address"
                        >
                          Transfer Ownership →
                        </button>
                        {(transferPending || isTransferConfirming) && (
                          <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-800 border border-slate-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                            <p className="text-sm text-slate-300">
                              {isTransferConfirming ? "Waiting for blockchain confirmation..." : "Processing transfer transaction..."}
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <label className="block text-sm text-slate-300">
                          New Owner Address
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={newOwner}
                            onChange={(e) =>
                              setNewOwner(e.target.value)
                            }
                            placeholder="0x..."
                            disabled={transferPending || isTransferConfirming}
                            className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-md focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200 placeholder:text-slate-600 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          />
                          <div className="group relative">
                            <button
                              onClick={handleTransfer}
                              disabled={!newOwner.trim() || transferPending || isTransferConfirming}
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white rounded-md transition-colors text-sm flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                              aria-label={!newOwner.trim() ? "Enter a valid address to transfer ownership" : "Transfer ownership"}
                            >
                            {(transferPending || isTransferConfirming) ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                {isTransferConfirming ? "Confirming..." : "Processing..."}
                              </>
                            ) : (
                              "Transfer"
                            )}
                            </button>
                            {!newOwner.trim() && (
                              <div className="absolute left-0 top-full mt-2 w-64 p-3 bg-slate-800 border border-slate-700 rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                                <p className="text-sm text-slate-300">
                                  Please enter a valid Ethereum address to transfer ownership
                                </p>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              setShowTransferForm(false);
                              setNewOwner("");
                            }}
                            disabled={transferPending || isTransferConfirming}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-md transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                            aria-label="Cancel transfer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
  
            {/* Delivered Status */}
            {shipment.status === "Delivered" && (
              <div className="card p-5 border-green-500/20 bg-green-500/5">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div>
                    <p className="text-green-400">
                      Shipment Delivered
                    </p>
                    <p className="text-sm text-slate-400 mt-1">
                      This shipment has been successfully
                      delivered to its destination
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

