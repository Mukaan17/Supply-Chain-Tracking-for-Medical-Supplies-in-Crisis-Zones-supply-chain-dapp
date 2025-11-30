import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

export default function TransactionTracker({ transaction, onComplete, onError }) {
  const [status, setStatus] = useState('pending');
  const [gasUsed, setGasUsed] = useState(null);
  const [blockNumber, setBlockNumber] = useState(null);
  const [transactionHash, setTransactionHash] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!transaction) return;

    let isCancelled = false;

    const trackTransaction = async () => {
      try {
        setStatus('pending');
        setTransactionHash(transaction.hash);
        
        // Wait for transaction to be mined
        const receipt = await transaction.wait();
        
        // Check if component was unmounted
        if (isCancelled) return;
        
        if (receipt.status === 1) {
          setStatus('success');
          // Handle BigInt values from ethers v6
          const gasUsedValue = receipt.gasUsed;
          const blockNumberValue = receipt.blockNumber;
          setGasUsed(gasUsedValue ? (typeof gasUsedValue === 'bigint' ? gasUsedValue.toString() : String(gasUsedValue)) : null);
          setBlockNumber(blockNumberValue ? (typeof blockNumberValue === 'bigint' ? blockNumberValue.toString() : String(blockNumberValue)) : null);
          
          if (onComplete) {
            onComplete(receipt);
          }
        } else {
          setStatus('failed');
          setError('Transaction failed');
          if (onError) {
            onError('Transaction failed');
          }
        }
      } catch (err) {
        // Check if component was unmounted
        if (isCancelled) return;
        
        setStatus('failed');
        setError(err.message);
        if (onError) {
          onError(err.message);
        }
      }
    };

    trackTransaction();

    // Cleanup function
    return () => {
      isCancelled = true;
    };
  }, [transaction, onComplete, onError]);

  const getStatusIcon = () => {
    switch (status) {
      case 'pending': return '⏳';
      case 'success': return '✅';
      case 'failed': return '❌';
      default: return '⏳';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'pending': return '#ffc107';
      case 'success': return '#28a745';
      case 'failed': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending': return 'Transaction pending...';
      case 'success': return 'Transaction confirmed!';
      case 'failed': return 'Transaction failed';
      default: return 'Unknown status';
    }
  };

  if (!transaction) return null;

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: 8,
      padding: 16,
      margin: '12px 0'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: '20px' }}>{getStatusIcon()}</span>
        <div>
          <div style={{ 
            fontWeight: 'bold', 
            color: getStatusColor(),
            fontSize: '16px'
          }}>
            {getStatusText()}
          </div>
          {transactionHash && (
            <div style={{ fontSize: '12px', color: '#6c757d', fontFamily: 'monospace' }}>
              Hash: {transactionHash.slice(0, 10)}...{transactionHash.slice(-8)}
            </div>
          )}
        </div>
      </div>

      {status === 'pending' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 20,
            height: 20,
            border: '2px solid #f3f3f3',
            borderTop: '2px solid #007bff',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }}></div>
          <span style={{ color: '#6c757d' }}>Waiting for confirmation...</span>
        </div>
      )}

      {status === 'success' && (
        <div style={{ fontSize: '14px', color: '#28a745' }}>
          <div>✅ Transaction confirmed in block #{blockNumber}</div>
          {gasUsed && <div>⛽ Gas used: {gasUsed}</div>}
        </div>
      )}

      {status === 'failed' && (
        <div style={{ fontSize: '14px', color: '#dc3545' }}>
          <div>❌ Transaction failed</div>
          {error && <div>Error: {error}</div>}
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

TransactionTracker.propTypes = {
  transaction: PropTypes.object,
  onComplete: PropTypes.func,
  onError: PropTypes.func,
};
