/**
 * Loading States Components
 * 
 * Provides skeleton screens and loading indicators.
 */

import React from 'react';

/**
 * Skeleton loader for package card
 */
export function PackageCardSkeleton() {
  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: 8,
      padding: 16,
      marginBottom: 16,
      animation: 'pulse 1.5s ease-in-out infinite',
    }}>
      <div style={{
        height: 20,
        backgroundColor: '#e9ecef',
        borderRadius: 4,
        width: '60%',
        marginBottom: 12,
      }} />
      <div style={{
        height: 16,
        backgroundColor: '#e9ecef',
        borderRadius: 4,
        width: '100%',
        marginBottom: 8,
      }} />
      <div style={{
        height: 16,
        backgroundColor: '#e9ecef',
        borderRadius: 4,
        width: '80%',
      }} />
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

/**
 * Skeleton loader for list item
 */
export function ListItemSkeleton() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid #eee',
    }}>
      <div style={{
        width: 40,
        height: 40,
        backgroundColor: '#e9ecef',
        borderRadius: '50%',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
      <div style={{ flex: 1 }}>
        <div style={{
          height: 16,
          backgroundColor: '#e9ecef',
          borderRadius: 4,
          width: '60%',
          marginBottom: 8,
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
        <div style={{
          height: 12,
          backgroundColor: '#e9ecef',
          borderRadius: 4,
          width: '40%',
          animation: 'pulse 1.5s ease-in-out infinite',
        }} />
      </div>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

/**
 * Loading spinner
 */
export function LoadingSpinner({ size = 40, color = '#007bff' }) {
  return (
    <div style={{
      display: 'inline-block',
      width: size,
      height: size,
      border: `4px solid ${color}20`,
      borderTop: `4px solid ${color}`,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite',
    }}>
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/**
 * Loading overlay
 */
export function LoadingOverlay({ message = 'Loading...' }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: 24,
        borderRadius: 8,
        textAlign: 'center',
      }}>
        <LoadingSpinner size={48} />
        <div style={{ marginTop: 16, color: '#495057' }}>{message}</div>
      </div>
    </div>
  );
}

/**
 * Inline loading indicator
 */
export function InlineLoader({ message }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: 12,
      color: '#6c757d',
    }}>
      <LoadingSpinner size={16} color="#6c757d" />
      {message && <span>{message}</span>}
    </div>
  );
}

/**
 * Table skeleton
 */
export function TableSkeleton({ rows = 5, columns = 4 }) {
  return (
    <div style={{ width: '100%' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: 12,
        padding: 12,
        borderBottom: '2px solid #dee2e6',
        marginBottom: 8,
      }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            style={{
              height: 16,
              backgroundColor: '#e9ecef',
              borderRadius: 4,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 12,
            padding: 12,
            borderBottom: '1px solid #eee',
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div
              key={colIndex}
              style={{
                height: 14,
                backgroundColor: '#f8f9fa',
                borderRadius: 4,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      ))}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

export default {
  PackageCardSkeleton,
  ListItemSkeleton,
  LoadingSpinner,
  LoadingOverlay,
  InlineLoader,
  TableSkeleton,
};

