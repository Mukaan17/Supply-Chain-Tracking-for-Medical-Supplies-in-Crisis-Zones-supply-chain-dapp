import React from 'react';

export default function ConnectWalletButton({ account, onConnect, isLoading }) {
  const short = (addr) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : '');
  
  return (
    <div style={{ marginBottom: 16, textAlign: 'center' }}>
      {account ? (
        <div style={{
          backgroundColor: '#d4edda',
          border: '1px solid #c3e6cb',
          borderRadius: 8,
          padding: 12,
          display: 'inline-block'
        }}>
          <span style={{ color: '#155724' }}>✅ Connected: {short(account)}</span>
        </div>
      ) : (
        <button 
          onClick={onConnect} 
          disabled={isLoading}
          style={{ 
            padding: '12px 24px',
            backgroundColor: isLoading ? '#6c757d' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '16px',
            fontWeight: 'bold',
            minWidth: 150
          }}
        >
          {isLoading ? 'Connecting...' : '🔗 Connect Wallet'}
        </button>
      )}
    </div>
  );
}


