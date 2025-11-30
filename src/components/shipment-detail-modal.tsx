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
  import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
  import { useContractAddress } from "../hooks/useContract";
  import { getContractABI } from "../config/contracts";
  import { Address } from "viem";
  import { useToastWithNotifications } from "../hooks/useToastWithNotifications";
  
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

    const contractAddress = useContractAddress();
    const abi = getContractABI();
    const { writeContract: writeStatus, data: statusTxHash } = useWriteContract();
    const { writeContract: writeTransfer, data: transferTxHash } = useWriteContract();
    
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
      "Manufacturing",
      "Quality Control",
      "Warehouse",
      "In Transit",
      "Distribution",
      "Delivered",
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
      switch (status) {
        case "Quality Control":
          return "updateToQualityControl";
        case "Warehouse":
          return "updateToWarehouse";
        case "In Transit":
          return "updateToInTransit";
        case "Distribution":
          return "updateToDistribution";
        case "Delivered":
          return "updateToDelivered";
        default:
          return null;
      }
    };

    // Extract package ID from shipment ID (MED-2025-001 -> 1)
    const extractPackageId = (shipmentId: string): bigint | null => {
      const match = shipmentId.match(/MED-2025-(\d+)/);
      if (match) {
        return BigInt(match[1]);
      }
      return null;
    };
  
    const handleTransfer = async () => {
      if (!newOwner.trim() || !contractAddress) {
        toast.error("Please enter a valid address");
        return;
      }

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
        writeTransfer({
          address: contractAddress as Address,
          abi,
          functionName: "transferOwnership",
          args: [packageId, newOwner.trim() as Address],
        });
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        toast.error("Failed to transfer ownership", {
          description: errorMessage,
        });
        setTransferPending(false);
      }
    };

    // Handle successful transfer
    useEffect(() => {
      if (isTransferConfirmed && transferTxHash) {
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
    }, [isTransferConfirmed, transferTxHash, shipment.id, onTransferOwnership, onRefresh]);
  
    const handleStatusUpdate = async (newStatus: string) => {
      if (currentStageIndex >= supplyChainStages.indexOf(newStatus)) {
        toast.error("Can only advance status forward");
        return;
      }

      const functionName = getStatusFunctionName(newStatus);
      if (!functionName || !contractAddress) {
        toast.error("Invalid status update");
        return;
      }

      const packageId = extractPackageId(shipment.id);
      if (!packageId) {
        toast.error("Invalid shipment ID");
        return;
      }

      try {
        setStatusUpdatePending(true);
        writeStatus({
          address: contractAddress as Address,
          abi,
          functionName,
          args: [packageId],
        });
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        toast.error("Failed to update status", {
          description: errorMessage,
        });
        setStatusUpdatePending(false);
      }
    };

    // Handle successful status update
    useEffect(() => {
      if (isStatusConfirmed && statusTxHash) {
        toast.success("Status Updated", {
          description: `Shipment ${shipment.id} status updated successfully`,
        });
        setStatusUpdatePending(false);
        if (onUpdateStatus) {
          // Get the new status from the transaction
          const newStatusIndex = currentStageIndex + 1;
          if (newStatusIndex < supplyChainStages.length) {
            onUpdateStatus(shipment.id, supplyChainStages[newStatusIndex]);
          }
        }
        if (onRefresh) {
          setTimeout(() => onRefresh(), 1000);
        }
      }
    }, [isStatusConfirmed, statusTxHash, shipment.id, currentStageIndex, supplyChainStages, onUpdateStatus, onRefresh]);

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
                <div className="flex items-center gap-2 text-slate-400 mb-3">
                  <Clock className="w-4 h-4" />
                  <h4>Timeline</h4>
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

