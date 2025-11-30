/**
 * Transaction Queue Component
 * 
 * Displays transaction queue with status, retry, and cancel functionality.
 */

import React, { useState } from 'react';
import { useTransaction } from '../hooks/useTransaction';
import { getBlockExplorerUrl } from '../config/networks';
import logger from '../services/logging';

export default function TransactionQueue({ network }) {
  const {
    pendingTransactions,
    transactionHistory,
    cancelTransaction,
  } = useTransaction();

  const [expanded, setExpanded] = useState(false);
  const [selectedTab, setSelectedTab] = useState('pending'); // 'pending' or 'history'

  const allTransactions = selectedTab === 'pending'
    ? pendingTransactions
    : transactionHistory.slice(0, 20); // Show last 20

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
      case 'submitted':
        return '⏳';
      case 'confirmed':
        return '✅';
      case 'failed':
      case 'timeout':
        return '❌';
      case 'cancelled':
        return '🚫';
      default:
        return '⏳';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
      case 'submitted':
        return '#ffc107';
      case 'confirmed':
        return '#28a745';
      case 'failed':
      case 'timeout':
        return '#dc3545';
      case 'cancelled':
        return '#6c757d';
      default:
        return '#6c757d';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const handleCancel = (id) => {
    if (window.confirm('Are you sure you want to cancel this transaction?')) {
      cancelTransaction(id);
      logger.info('Transaction cancelled', { id });
    }
  };

  if (pendingTransactions.length === 0 && transactionHistory.length === 0) {
    return null;
  }

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: 8,
      padding: 16,
      marginTop: 16,
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
      }}>
        <h3 style={{ margin: 0, color: '#2c3e50' }}>
          📋 Transaction Queue
          {pendingTransactions.length > 0 && (
            <span style={{
              backgroundColor: '#ffc107',
              color: '#000',
              padding: '2px 8px',
              borderRadius: 12,
              fontSize: '12px',
              marginLeft: 8,
            }}>
              {pendingTransactions.length}
            </span>
          )}
        </h3>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            backgroundColor: 'transparent',
            border: '1px solid #ccc',
            padding: '4px 12px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {expanded && (
        <>
          <div style={{
            display: 'flex',
            gap: 8,
            marginBottom: 16,
            borderBottom: '1px solid #dee2e6',
          }}>
            <button
              onClick={() => setSelectedTab('pending')}
              style={{
                backgroundColor: selectedTab === 'pending' ? '#007bff' : 'transparent',
                color: selectedTab === 'pending' ? 'white' : '#007bff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                fontWeight: selectedTab === 'pending' ? 'bold' : 'normal',
              }}
            >
              Pending ({pendingTransactions.length})
            </button>
            <button
              onClick={() => setSelectedTab('history')}
              style={{
                backgroundColor: selectedTab === 'history' ? '#007bff' : 'transparent',
                color: selectedTab === 'history' ? 'white' : '#007bff',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px 4px 0 0',
                cursor: 'pointer',
                fontWeight: selectedTab === 'history' ? 'bold' : 'normal',
              }}
            >
              History ({transactionHistory.length})
            </button>
          </div>

          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {allTransactions.length === 0 ? (
              <p style={{ color: '#6c757d', textAlign: 'center', padding: 20 }}>
                No {selectedTab === 'pending' ? 'pending' : 'historical'} transactions
              </p>
            ) : (
              allTransactions.map((tx) => (
                <div
                  key={tx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 0',
                    borderBottom: '1px solid #eee',
                  }}
                >
                  <span style={{ fontSize: '20px' }}>
                    {getStatusIcon(tx.status)}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontWeight: 'bold',
                      color: getStatusColor(tx.status),
                    }}>
                      {tx.metadata?.method || 'Unknown'} - {tx.status}
                    </div>
                    <div style={{ fontSize: '12px', color: '#6c757d' }}>
                      {tx.metadata?.description || 'Transaction'}
                    </div>
                    {tx.hash && (
                      <div style={{ fontSize: '11px', color: '#999', fontFamily: 'monospace' }}>
                        {tx.hash.slice(0, 10)}...{tx.hash.slice(-8)}
                        {network && (
                          <a
                            href={getBlockExplorerUrl(network, 'tx', tx.hash)}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ marginLeft: 8, color: '#007bff' }}
                          >
                            View
                          </a>
                        )}
                      </div>
                    )}
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {formatTime(tx.submittedAt || tx.metadata?.timestamp)}
                    </div>
                  </div>
                  {tx.status === 'pending' || tx.status === 'submitted' ? (
                    <button
                      onClick={() => handleCancel(tx.id)}
                      style={{
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        padding: '4px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: '12px',
                      }}
                    >
                      Cancel
                    </button>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

