/**
 * Empty State Components
 * 
 * Provides empty state UI for various scenarios.
 */

import React from 'react';

/**
 * Empty state for no packages
 */
export function NoPackagesEmptyState({ onCreateClick }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: 60,
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
      border: '1px solid #dee2e6',
    }}>
      <div style={{ fontSize: '48px', marginBottom: 16 }}>📦</div>
      <h3 style={{ color: '#2c3e50', marginBottom: 8 }}>No Packages Yet</h3>
      <p style={{ color: '#6c757d', marginBottom: 24 }}>
        Get started by creating your first package
      </p>
      {onCreateClick && (
        <button
          onClick={onCreateClick}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
          }}
        >
          Create Package
        </button>
      )}
    </div>
  );
}

/**
 * Empty state for search results
 */
export function NoSearchResultsEmptyState({ searchTerm }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: 40,
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
      border: '1px solid #dee2e6',
    }}>
      <div style={{ fontSize: '36px', marginBottom: 12 }}>🔍</div>
      <h4 style={{ color: '#2c3e50', marginBottom: 8 }}>No Results Found</h4>
      <p style={{ color: '#6c757d' }}>
        No packages found matching "{searchTerm}"
      </p>
    </div>
  );
}

/**
 * Empty state for transaction history
 */
export function NoTransactionsEmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: 40,
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
      border: '1px solid #dee2e6',
    }}>
      <div style={{ fontSize: '36px', marginBottom: 12 }}>📋</div>
      <h4 style={{ color: '#2c3e50', marginBottom: 8 }}>No Transactions</h4>
      <p style={{ color: '#6c757d' }}>
        Your transaction history will appear here
      </p>
    </div>
  );
}

/**
 * Empty state for package history
 */
export function NoHistoryEmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: 30,
      color: '#6c757d',
    }}>
      <div style={{ fontSize: '24px', marginBottom: 8 }}>📜</div>
      <p style={{ margin: 0, fontStyle: 'italic' }}>
        No history available for this package
      </p>
    </div>
  );
}

/**
 * Empty state for error
 */
export function ErrorEmptyState({ error, onRetry }) {
  return (
    <div style={{
      textAlign: 'center',
      padding: 40,
      backgroundColor: '#f8d7da',
      borderRadius: 8,
      border: '1px solid #f5c6cb',
    }}>
      <div style={{ fontSize: '36px', marginBottom: 12 }}>⚠️</div>
      <h4 style={{ color: '#721c24', marginBottom: 8 }}>Something Went Wrong</h4>
      <p style={{ color: '#721c24', marginBottom: 16 }}>
        {error || 'An error occurred while loading data'}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: 4,
            cursor: 'pointer',
          }}
        >
          Try Again
        </button>
      )}
    </div>
  );
}

/**
 * Empty state for offline
 */
export function OfflineEmptyState() {
  return (
    <div style={{
      textAlign: 'center',
      padding: 40,
      backgroundColor: '#fff3cd',
      borderRadius: 8,
      border: '1px solid #ffc107',
    }}>
      <div style={{ fontSize: '36px', marginBottom: 12 }}>📡</div>
      <h4 style={{ color: '#856404', marginBottom: 8 }}>You're Offline</h4>
      <p style={{ color: '#856404' }}>
        Please check your internet connection
      </p>
    </div>
  );
}

/**
 * Generic empty state
 */
export function GenericEmptyState({ 
  icon = '📭',
  title = 'No Data',
  message = 'There is nothing to display',
  action = null,
}) {
  return (
    <div style={{
      textAlign: 'center',
      padding: 40,
      backgroundColor: '#f8f9fa',
      borderRadius: 8,
      border: '1px solid #dee2e6',
    }}>
      <div style={{ fontSize: '36px', marginBottom: 12 }}>{icon}</div>
      <h4 style={{ color: '#2c3e50', marginBottom: 8 }}>{title}</h4>
      <p style={{ color: '#6c757d', marginBottom: action ? 16 : 0 }}>
        {message}
      </p>
      {action}
    </div>
  );
}

export default {
  NoPackagesEmptyState,
  NoSearchResultsEmptyState,
  NoTransactionsEmptyState,
  NoHistoryEmptyState,
  ErrorEmptyState,
  OfflineEmptyState,
  GenericEmptyState,
};

