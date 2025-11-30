/**
 * Batch Create Package Component
 * 
 * Allows users to create multiple packages at once for gas optimization.
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { PackagePlus, Loader2, CheckCircle2 } from 'lucide-react';
import { useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi';
import { validateDescription } from '../utils/validation';
import { sanitizeDescription } from '../utils/sanitization';
import TransactionTracker from './TransactionTracker';
import GasEstimate from './GasEstimate';
import logger from '../services/logging';
import errorTracking from '../services/errorTracking';
import { handleError } from '../utils/errorHandler';
import { useContractAddress } from '../hooks/useContract';
import { getContractABI } from '../config/contracts';
import config from '../config';

const MAX_BATCH_SIZE = 50; // From contract constant

export default function BatchCreatePackage({ contract, network: _network, account: _account }) {
  const [descriptions, setDescriptions] = useState(['']);
  const [txStatus, setTxStatus] = useState('');
  const [createdIds, setCreatedIds] = useState([]);
  const [validationErrors, setValidationErrors] = useState({});
  const [txHash, setTxHash] = useState(null);
  const contractAddress = useContractAddress();
  const abi = getContractABI();

  const { writeContract, isPending, isError, error, data: writeData } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash || writeData,
  });

  const addDescriptionField = () => {
    if (descriptions.length < MAX_BATCH_SIZE) {
      setDescriptions([...descriptions, '']);
    }
  };

  const removeDescriptionField = (index) => {
    if (descriptions.length > 1) {
      const newDescriptions = descriptions.filter((_, i) => i !== index);
      setDescriptions(newDescriptions);
      // Clear validation error for removed field
      const newErrors = { ...validationErrors };
      delete newErrors[`desc_${index}`];
      setValidationErrors(newErrors);
    }
  };

  const updateDescription = (index, value) => {
    const newDescriptions = [...descriptions];
    newDescriptions[index] = value;
    setDescriptions(newDescriptions);
    
    // Validate this description
    const sanitized = sanitizeDescription(value);
    const error = validateDescription(sanitized);
    const newErrors = { ...validationErrors };
    if (error) {
      newErrors[`desc_${index}`] = error;
    } else {
      delete newErrors[`desc_${index}`];
    }
    setValidationErrors(newErrors);
  };

  // Watch for PackageCreated events
  useWatchContractEvent({
    address: contractAddress,
    abi,
    eventName: 'PackageCreated',
    onLogs(logs) {
      if (logs && logs.length > 0 && txHash) {
        const newIds = logs
          .filter(log => log.transactionHash === txHash)
          .map(log => {
            const id = log.args?.id;
            return typeof id === 'bigint' ? id.toString() : String(id);
          });
        if (newIds.length > 0) {
          setCreatedIds(prev => [...prev, ...newIds]);
        }
      }
    },
  });

  useEffect(() => {
    if (writeData) {
      setTxHash(writeData);
      setTxStatus('Transaction sent. Waiting for confirmation...');
    }
  }, [writeData]);

  useEffect(() => {
    if (isConfirmed) {
      setTxStatus('✅ Batch packages created successfully!');
      setDescriptions(['']);
    }
    if (isError && error) {
      const errorInfo = handleError(error, {
        component: 'BatchCreatePackage',
        action: 'createBatch',
      });
      logger.error('Batch package creation failed', error);
      errorTracking.captureException(error, {
        tags: { component: 'BatchCreatePackage' },
      });
      setTxStatus('❌ Transaction failed: ' + errorInfo.message);
    }
  }, [isConfirmed, isError, error]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!contractAddress) {
      const error = new Error('Contract not ready');
      const errorInfo = handleError(error, { component: 'BatchCreatePackage' });
      setTxStatus(errorInfo.message);
      return;
    }
    
    // Validate all descriptions
    const sanitizedDescriptions = descriptions
      .map(desc => sanitizeDescription(desc))
      .filter(desc => desc.trim().length > 0);
    
    if (sanitizedDescriptions.length === 0) {
      setTxStatus('Please enter at least one package description');
      return;
    }

    // Validate each description
    for (let i = 0; i < sanitizedDescriptions.length; i++) {
      const error = validateDescription(sanitizedDescriptions[i]);
      if (error) {
        setTxStatus(`Description ${i + 1} is invalid: ${error}`);
        return;
      }
    }

    if (sanitizedDescriptions.length > MAX_BATCH_SIZE) {
      setTxStatus(`Maximum batch size is ${MAX_BATCH_SIZE} packages`);
      return;
    }

    setValidationErrors({});
    
    try {
      setTxStatus('Awaiting confirmation...');
      logger.info('Creating batch packages', { count: sanitizedDescriptions.length });
      
      writeContract({
        address: contractAddress,
        abi,
        functionName: 'createBatch',
        args: [sanitizedDescriptions],
      });
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'BatchCreatePackage',
        action: 'createBatch',
      });
      logger.error('Batch package creation failed', err);
      errorTracking.captureException(err, {
        tags: { component: 'BatchCreatePackage' },
      });
      setTxStatus('Transaction failed: ' + errorInfo.message);
    }
  };

  // Check if batch operations are enabled
  const isBatchEnabled = config.features.enableBatchOperations?.enabled ?? true;

  if (!isBatchEnabled) {
    return null;
  }

  const validDescriptions = descriptions.filter(desc => {
    const sanitized = sanitizeDescription(desc);
    return sanitized.trim().length >= 3 && sanitized.trim().length <= 500;
  });

  return (
    <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8, border: '1px solid #dee2e6' }}>
      <h3>📦 Batch Create Packages</h3>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: 16 }}>
        Create multiple packages at once (up to {MAX_BATCH_SIZE} packages). This is more gas-efficient than creating them individually.
      </p>
      
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        {descriptions.map((desc, index) => (
          <div key={index}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input
                  type="text"
                  value={desc}
                  onChange={(e) => updateDescription(index, e.target.value)}
                  placeholder={`Package ${index + 1} description (3-500 characters)`}
                  style={{ 
                    width: '100%', 
                    padding: 12, 
                    border: validationErrors[`desc_${index}`] ? '2px solid #dc3545' : '1px solid #ccc',
                    borderRadius: 4,
                    fontSize: '16px'
                  }}
                />
                {validationErrors[`desc_${index}`] && (
                  <div style={{ color: '#dc3545', fontSize: '14px', marginTop: 4 }}>
                    {validationErrors[`desc_${index}`]}
                  </div>
                )}
                <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                  {desc.length}/500 characters
                </div>
              </div>
              {descriptions.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDescriptionField(index)}
                  style={{
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    padding: '12px 16px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: '16px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ))}
        
        {descriptions.length < MAX_BATCH_SIZE && (
          <button
            type="button"
            onClick={addDescriptionField}
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: '14px',
              alignSelf: 'flex-start'
            }}
          >
            + Add Another Package
          </button>
        )}
        
        {contract && validDescriptions.length > 0 && (
          <GasEstimate
            contract={contract}
            methodName="createBatch"
            args={[validDescriptions]}
          />
        )}
        
        <button 
          type="submit"
          disabled={validDescriptions.length === 0}
          style={{
            backgroundColor: validDescriptions.length === 0 ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 4,
            cursor: validDescriptions.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            opacity: validDescriptions.length === 0 ? 0.6 : 1
          }}
        >
          📦 Create {validDescriptions.length} Package{validDescriptions.length !== 1 ? 's' : ''}
        </button>
      </form>
      
      {txHash && (
        <TransactionTracker
          transaction={{ hash: txHash }}
          onComplete={async (receipt) => {
            // Extract package IDs from the createBatch return value
            const packageIds = [];
            
            try {
              // Method 1: Parse events from receipt logs
              if (receipt.logs && receipt.logs.length > 0) {
                const eventFragment = contract.interface.getEvent('PackageCreated');
                if (eventFragment) {
                  const eventSignature = eventFragment.format('sighash');
                  
                  for (const log of receipt.logs) {
                    try {
                      if (log.topics && log.topics.length >= 2 && log.topics[0] === eventSignature) {
                        const idFromTopic = log.topics[1];
                        if (idFromTopic) {
                          const packageId = BigInt(idFromTopic).toString();
                          if (!packageIds.includes(packageId)) {
                            packageIds.push(packageId);
                          }
                        }
                      }
                    } catch (e) {
                      continue;
                    }
                  }
                }
              }
              
              // Method 2: Query events from the block
              if (receipt.blockNumber !== undefined) {
                try {
                  const eventFilter = contract.filters.PackageCreated();
                  const blockNumber = typeof receipt.blockNumber === 'bigint' 
                    ? Number(receipt.blockNumber) 
                    : receipt.blockNumber;
                  const events = await contract.queryFilter(eventFilter, blockNumber, blockNumber);
                  const txHash = receipt.hash || receipt.transactionHash;
                  const ourEvents = events.filter(e => {
                    const eventTxHash = e.transactionHash || (e.log && e.log.transactionHash);
                    return eventTxHash === txHash;
                  });
                  
                  ourEvents.forEach(event => {
                    if (event.args && event.args.id !== undefined) {
                      const idValue = event.args.id;
                      const packageId = typeof idValue === 'bigint' ? idValue.toString() : String(idValue);
                      if (!packageIds.includes(packageId)) {
                        packageIds.push(packageId);
                      }
                    }
                  });
                } catch (e) {
                  logger.warn('Could not query events from block', e);
                }
              }
              
              if (packageIds.length > 0) {
                setCreatedIds(packageIds);
                setDescriptions(['']);
                setTxStatus(`✅ Successfully created ${packageIds.length} package(s) with IDs: ${packageIds.join(', ')}`);
                logger.info('Batch package creation successful', { packageIds, count: packageIds.length });
              } else {
                setCreatedIds([]);
                setDescriptions(['']);
                setTxStatus('✅ Batch packages created (IDs not captured - check transaction on block explorer)');
                logger.warn('Could not extract package IDs from batch creation', { receipt });
              }
            } catch (err) {
              logger.error('Error extracting package IDs', err, { receipt });
              setCreatedIds([]);
              setDescriptions(['']);
              setTxStatus('✅ Batch packages created (IDs not captured - check transaction on block explorer)');
            }
            setTxHash(null);
          }}
          onError={(error) => {
            setTxStatus('❌ Transaction failed: ' + error);
            setTxHash(null);
          }}
        />
      )}

      {txStatus && !txHash && (
        <div style={{
          backgroundColor: txStatus.includes('❌') || txStatus.includes('failed') || txStatus.includes('error') ? '#f8d7da' : '#d4edda',
          border: txStatus.includes('❌') || txStatus.includes('failed') || txStatus.includes('error') ? '1px solid #f5c6cb' : '1px solid #c3e6cb',
          borderRadius: 4,
          padding: 12,
          marginTop: 12,
          color: txStatus.includes('❌') || txStatus.includes('failed') || txStatus.includes('error') ? '#721c24' : '#155724'
        }}>
          {txStatus}
        </div>
      )}
      
      {createdIds.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f0f8ff', border: '1px solid #007bff', borderRadius: 4 }}>
          <p><strong>✅ Batch Packages Created Successfully!</strong></p>
          <p><strong>Package IDs:</strong> {createdIds.join(', ')}</p>
          <p><em>Use these IDs to track your packages below.</em></p>
        </div>
      )}
    </div>
  );
}

BatchCreatePackage.propTypes = {
  contract: PropTypes.object,
  network: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
  account: PropTypes.string,
};

