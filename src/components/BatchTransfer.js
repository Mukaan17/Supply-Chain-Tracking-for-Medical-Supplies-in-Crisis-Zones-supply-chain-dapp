/**
 * Batch Transfer Component
 * 
 * Allows users to transfer multiple packages at once for gas optimization.
 */

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { validateAddress } from '../utils/validation';
import { sanitizeAddress } from '../utils/sanitization';
import TransactionTracker from './TransactionTracker';
import GasEstimate from './GasEstimate';
import logger from '../services/logging';
import errorTracking from '../services/errorTracking';
import { handleError } from '../utils/errorHandler';
import { useContractAddress } from '../hooks/useContract';
import { getContractABI } from '../config/contracts';
import config from '../config';

const MAX_BATCH_SIZE = 50; // From contract constant

export default function BatchTransfer({ contract, account }) {
  const [packageIds, setPackageIds] = useState(['']);
  const [recipients, setRecipients] = useState(['']);
  const [txStatus, setTxStatus] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [txHash, setTxHash] = useState(null);
  const contractAddress = useContractAddress();
  const abi = getContractABI();

  const { writeContract, isPending, isError, error, data: writeData } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash || writeData,
  });

  const addTransferPair = () => {
    if (packageIds.length < MAX_BATCH_SIZE) {
      setPackageIds([...packageIds, '']);
      setRecipients([...recipients, '']);
    }
  };

  const removeTransferPair = (index) => {
    if (packageIds.length > 1) {
      setPackageIds(packageIds.filter((_, i) => i !== index));
      setRecipients(recipients.filter((_, i) => i !== index));
      // Clear validation errors
      const newErrors = { ...validationErrors };
      delete newErrors[`packageId_${index}`];
      delete newErrors[`recipient_${index}`];
      setValidationErrors(newErrors);
    }
  };

  const updatePackageId = (index, value) => {
    const newPackageIds = [...packageIds];
    newPackageIds[index] = value;
    setPackageIds(newPackageIds);
    
    // Clear validation error
    const newErrors = { ...validationErrors };
    delete newErrors[`packageId_${index}`];
    setValidationErrors(newErrors);
  };

  const updateRecipient = (index, value) => {
    const newRecipients = [...recipients];
    newRecipients[index] = value;
    setRecipients(newRecipients);
    
    // Validate address
    const sanitized = sanitizeAddress(value);
    const error = validateAddress(sanitized);
    const newErrors = { ...validationErrors };
    if (error) {
      newErrors[`recipient_${index}`] = error;
    } else {
      delete newErrors[`recipient_${index}`];
    }
    setValidationErrors(newErrors);
  };

  useEffect(() => {
    if (writeData) {
      setTxHash(writeData);
      setTxStatus('Transaction sent. Waiting for confirmation...');
    }
  }, [writeData]);

  useEffect(() => {
    if (isConfirmed) {
      setTxStatus('✅ Batch transfer completed successfully!');
      setPackageIds(['']);
      setRecipients(['']);
    }
    if (isError && error) {
      const errorInfo = handleError(error, {
        component: 'BatchTransfer',
        action: 'transferBatch',
      });
      logger.error('Batch transfer failed', error);
      errorTracking.captureException(error, {
        tags: { component: 'BatchTransfer' },
      });
      setTxStatus('❌ Transaction failed: ' + errorInfo.message);
    }
  }, [isConfirmed, isError, error]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!contractAddress) {
      const error = new Error('Contract not ready');
      const errorInfo = handleError(error, { component: 'BatchTransfer' });
      setTxStatus(errorInfo.message);
      return;
    }
    
    // Validate all pairs
    const validPairs = [];
    const errors = {};
    
    for (let i = 0; i < packageIds.length; i++) {
      const packageId = packageIds[i].trim();
      const recipient = recipients[i].trim();
      
      if (!packageId || !recipient) {
        if (!packageId) errors[`packageId_${i}`] = 'Package ID is required';
        if (!recipient) errors[`recipient_${i}`] = 'Recipient address is required';
        continue;
      }
      
      const packageIdNum = parseInt(packageId, 10);
      if (isNaN(packageIdNum) || packageIdNum < 1) {
        errors[`packageId_${i}`] = 'Package ID must be a number >= 1';
        continue;
      }
      
      const sanitizedAddress = sanitizeAddress(recipient);
      const addressError = validateAddress(sanitizedAddress);
      if (addressError) {
        errors[`recipient_${i}`] = addressError;
        continue;
      }
      
      if (sanitizedAddress.toLowerCase() === account?.toLowerCase()) {
        errors[`recipient_${i}`] = 'Cannot transfer to yourself';
        continue;
      }
      
      validPairs.push({ packageId: packageIdNum, recipient: sanitizedAddress });
    }
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setTxStatus('Please fix validation errors');
      return;
    }
    
    if (validPairs.length === 0) {
      setTxStatus('Please enter at least one valid package ID and recipient');
      return;
    }
    
    if (validPairs.length > MAX_BATCH_SIZE) {
      setTxStatus(`Maximum batch size is ${MAX_BATCH_SIZE} packages`);
      return;
    }
    
    setValidationErrors({});
    
    try {
      setTxStatus('Awaiting confirmation...');
      
      const packageIdsArray = validPairs.map(p => BigInt(p.packageId));
      const recipientsArray = validPairs.map(p => p.recipient);
      
      logger.info('Initiating batch transfer', { count: validPairs.length });
      
      writeContract({
        address: contractAddress,
        abi,
        functionName: 'transferBatch',
        args: [packageIdsArray, recipientsArray],
      });
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'BatchTransfer',
        action: 'transferBatch',
      });
      logger.error('Batch transfer failed', err);
      errorTracking.captureException(err, {
        tags: { component: 'BatchTransfer' },
      });
      setTxStatus('Transaction failed: ' + errorInfo.message);
    }
  };

  // Check if batch operations are enabled
  const isBatchEnabled = config.features.enableBatchOperations?.enabled ?? true;

  if (!isBatchEnabled) {
    return null;
  }

  const validPairs = packageIds.map((pkgId, i) => {
    const pkgIdNum = parseInt(pkgId.trim(), 10);
    const recipient = recipients[i]?.trim();
    const sanitizedRecipient = recipient ? sanitizeAddress(recipient) : '';
    const recipientError = recipient ? validateAddress(sanitizedRecipient) : null;
    
    return {
      valid: !isNaN(pkgIdNum) && pkgIdNum >= 1 && !recipientError && sanitizedRecipient && sanitizedRecipient.toLowerCase() !== account?.toLowerCase(),
      packageId: pkgIdNum,
      recipient: sanitizedRecipient
    };
  }).filter(p => p.valid);

  return (
    <div style={{ marginTop: 24, padding: 16, backgroundColor: '#f8f9fa', borderRadius: 8, border: '1px solid #dee2e6' }}>
      <h3>🚚 Batch Transfer Packages</h3>
      <p style={{ fontSize: '14px', color: '#666', marginBottom: 16 }}>
        Transfer multiple packages at once (up to {MAX_BATCH_SIZE} packages). This is more gas-efficient than transferring them individually.
      </p>
      
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        {packageIds.map((pkgId, index) => (
          <div key={index} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                value={pkgId}
                onChange={(e) => updatePackageId(index, e.target.value)}
                placeholder={`Package ID ${index + 1}`}
                style={{ 
                  width: '100%', 
                  padding: 12, 
                  border: validationErrors[`packageId_${index}`] ? '2px solid #dc3545' : '1px solid #ccc',
                  borderRadius: 4,
                  fontSize: '16px'
                }}
              />
              {validationErrors[`packageId_${index}`] && (
                <div style={{ color: '#dc3545', fontSize: '14px', marginTop: 4 }}>
                  {validationErrors[`packageId_${index}`]}
                </div>
              )}
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <input
                type="text"
                value={recipients[index] || ''}
                onChange={(e) => updateRecipient(index, e.target.value)}
                placeholder={`Recipient address ${index + 1} (0x...)`}
                style={{ 
                  width: '100%', 
                  padding: 12, 
                  border: validationErrors[`recipient_${index}`] ? '2px solid #dc3545' : '1px solid #ccc',
                  borderRadius: 4,
                  fontSize: '16px'
                }}
              />
              {validationErrors[`recipient_${index}`] && (
                <div style={{ color: '#dc3545', fontSize: '14px', marginTop: 4 }}>
                  {validationErrors[`recipient_${index}`]}
                </div>
              )}
            </div>
            {packageIds.length > 1 && (
              <button
                type="button"
                onClick={() => removeTransferPair(index)}
                style={{
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  padding: '12px 16px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontSize: '16px',
                  alignSelf: 'flex-start'
                }}
              >
                ✕
              </button>
            )}
          </div>
        ))}
        
        {packageIds.length < MAX_BATCH_SIZE && (
          <button
            type="button"
            onClick={addTransferPair}
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
            + Add Another Transfer
          </button>
        )}
        
        {contract && validPairs.length > 0 && (
          <GasEstimate
            contract={contract}
            methodName="transferBatch"
            args={[validPairs.map(p => p.packageId), validPairs.map(p => p.recipient)]}
          />
        )}
        
        <button 
          type="submit"
          disabled={validPairs.length === 0}
          style={{
            backgroundColor: validPairs.length === 0 ? '#6c757d' : '#28a745',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 4,
            cursor: validPairs.length === 0 ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            opacity: validPairs.length === 0 ? 0.6 : 1
          }}
        >
          🚚 Transfer {validPairs.length} Package{validPairs.length !== 1 ? 's' : ''}
        </button>
      </form>
      
      {txHash && (
        <TransactionTracker
          transaction={{ hash: txHash }}
          onComplete={async (receipt) => {
            // Log transaction details for audit purposes
            logger.info('Batch transfer successful', {
              count: validPairs.length,
              transactionHash: receipt.hash || receipt.transactionHash,
              blockNumber: receipt.blockNumber,
              gasUsed: receipt.gasUsed,
              packageIds: validPairs.map(p => p.packageId),
            });
            setTxStatus(`✅ Successfully transferred ${validPairs.length} package(s)`);
            setPackageIds(['']);
            setRecipients(['']);
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
    </div>
  );
}

BatchTransfer.propTypes = {
  contract: PropTypes.object,
  account: PropTypes.string,
};

