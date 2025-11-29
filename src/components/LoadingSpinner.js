import React from 'react';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20,
      gap: 12
    }}>
      <div style={{
        width: 20,
        height: 20,
        border: '2px solid #f3f3f3',
        borderTop: '2px solid #007bff',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
      }}></div>
      <span>{message}</span>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
