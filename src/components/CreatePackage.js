import React, { useState } from 'react';
import { validateDescription } from '../utils/validation';
import { sanitizeDescription } from '../utils/sanitization';
import TransactionTracker from './TransactionTracker';
import GasEstimate from './GasEstimate';
import logger from '../services/logging';
import errorTracking from '../services/errorTracking';
import { handleError } from '../utils/errorHandler';
import { useTransaction } from '../hooks/useTransaction';
import { getNetworkByChainId } from '../config/networks';

export default function CreatePackage({ contract, provider, network }) {
  const [description, setDescription] = useState('');
  const [txStatus, setTxStatus] = useState('');
  const [createdId, setCreatedId] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [currentTransaction, setCurrentTransaction] = useState(null);
  const [loading, setLoading] = useState(false);
  const { submitTransaction } = useTransaction();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!contract) {
      const error = new Error('Contract not ready');
      const errorInfo = handleError(error, { component: 'CreatePackage' });
      setValidationError(errorInfo.message);
      return;
    }
    
    // Sanitize and validate input
    const sanitized = sanitizeDescription(description);
    const descError = validateDescription(sanitized);
    if (descError) {
      setValidationError(descError);
      return;
    }
    setValidationError('');
    
    // Check network if provider available
    if (provider) {
      try {
        const networkInfo = await provider.getNetwork();
        const networkConfig = getNetworkByChainId(Number(networkInfo.chainId));
        
        if (!networkConfig) {
          setTxStatus('Unsupported network. Please switch to a supported network.');
          logger.warn('Unsupported network', { chainId: networkInfo.chainId });
          return;
        }
      } catch (err) {
        const errorInfo = handleError(err, { component: 'CreatePackage', action: 'networkCheck' });
        logger.error('Failed to check network', err);
        setTxStatus('Failed to verify network: ' + errorInfo.message);
        return;
      }
    }
    
    try {
      setLoading(true);
      setTxStatus('Awaiting confirmation...');
      logger.info('Creating package', { description: sanitized.substring(0, 50) + '...' });
      
      const txPromise = contract.createPackage(sanitized);
      const entry = await submitTransaction(txPromise, {
        method: 'createPackage',
        params: { description: sanitized },
        description: `Create package: ${sanitized.substring(0, 30)}...`,
      });
      
      setCurrentTransaction(entry.transaction);
      setTxStatus('Transaction sent. Waiting for confirmation...');
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'CreatePackage',
        action: 'createPackage',
      });
      logger.error('Package creation failed', err);
      errorTracking.captureException(err, {
        tags: { component: 'CreatePackage' },
      });
      setTxStatus('Transaction failed: ' + errorInfo.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Create Package</h2>
      <form onSubmit={onSubmit} style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        <div>
          <input
            type="text"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setValidationError(''); // Clear validation error on change
            }}
            placeholder="Enter package description (3-200 characters)"
            required
            style={{ 
              width: '100%', 
              padding: 12, 
              border: validationError ? '2px solid #dc3545' : '1px solid #ccc',
              borderRadius: 4,
              fontSize: '16px'
            }}
          />
          {validationError && (
            <div style={{ color: '#dc3545', fontSize: '14px', marginTop: 4 }}>
              {validationError}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
            {description.length}/200 characters
          </div>
        </div>
        <button 
          type="submit"
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          📦 Create Package
        </button>
      </form>
      {currentTransaction && (
        <TransactionTracker
          transaction={currentTransaction}
          onComplete={(receipt) => {
            // Extract package ID from the PackageCreated event
            const event = receipt.logs.find(log => {
              try {
                const parsed = contract.interface.parseLog(log);
                return parsed && parsed.name === 'PackageCreated';
              } catch (e) {
                return false;
              }
            });
            
            if (event) {
              const parsed = contract.interface.parseLog(event);
              const packageId = parsed.args.id.toString();
              setCreatedId(packageId);
              setDescription('');
              setTxStatus(`✅ Package created with ID: ${packageId}`);
            } else {
              setCreatedId('Created');
              setDescription('');
              setTxStatus('✅ Package created (ID not captured)');
            }
            setCurrentTransaction(null);
          }}
          onError={(error) => {
            setTxStatus('❌ Transaction failed: ' + error);
            setCurrentTransaction(null);
          }}
        />
      )}

      {txStatus && !currentTransaction && (
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
      {createdId && (
        <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f0f8ff', border: '1px solid #007bff', borderRadius: 4 }}>
          <p><strong>✅ Package Created Successfully!</strong></p>
          <p><strong>Package ID:</strong> {createdId}</p>
          <p><em>Use this ID to track your package below.</em></p>
        </div>
      )}
    </div>
  );
}


