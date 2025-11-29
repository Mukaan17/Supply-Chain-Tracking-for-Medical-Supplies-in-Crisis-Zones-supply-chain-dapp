import React, { useState } from 'react';

export default function NetworkStatus({ network, isCorrectNetwork, onSwitchNetwork }) {
  const [isSwitching, setIsSwitching] = useState(false);

  if (!network) return null;

  const isSepolia = network.toLowerCase().includes('sepolia') || isCorrectNetwork;

  const handleSwitchNetwork = async () => {
    if (!onSwitchNetwork) return;
    
    setIsSwitching(true);
    try {
      await onSwitchNetwork();
    } catch (error) {
      console.error('Network switch failed:', error);
    } finally {
      setIsSwitching(false);
    }
  };

  return (
    <div style={{
      backgroundColor: isSepolia ? '#d4edda' : '#f8d7da',
      border: `1px solid ${isSepolia ? '#c3e6cb' : '#f5c6cb'}`,
      borderRadius: 8,
      padding: 12,
      margin: '8px 0',
      color: isSepolia ? '#155724' : '#721c24'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '16px' }}>{isSepolia ? '✅' : '⚠️'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
            Network Status
          </div>
          <div style={{ fontSize: '14px' }}>
            <strong>Current:</strong> {network}
            {!isSepolia && (
              <div style={{ marginTop: 4, fontSize: '13px' }}>
                This dApp requires Sepolia testnet for proper functionality.
              </div>
            )}
          </div>
        </div>
        {!isSepolia && onSwitchNetwork && (
          <button
            onClick={handleSwitchNetwork}
            disabled={isSwitching}
            style={{
              backgroundColor: isSwitching ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: 4,
              cursor: isSwitching ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              minWidth: 120
            }}
          >
            {isSwitching ? 'Switching...' : '🔄 Switch to Sepolia'}
          </button>
        )}
      </div>
      
      {isSepolia && (
        <div style={{ 
          marginTop: 8, 
          fontSize: '12px', 
          color: '#155724',
          backgroundColor: 'rgba(255,255,255,0.3)',
          padding: 8,
          borderRadius: 4
        }}>
          ✅ Connected to Sepolia testnet. You can now create and track packages.
        </div>
      )}
    </div>
  );
}
