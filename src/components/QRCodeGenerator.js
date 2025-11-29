import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';

export default function QRCodeGenerator({ packageId, packageData }) {
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (packageId && packageData) {
      generateQRCode();
    }
  }, [packageId, packageData]); // eslint-disable-line react-hooks/exhaustive-deps

  const generateQRCode = async () => {
    setIsGenerating(true);
    setError('');
    
    try {
      // Create a comprehensive package info object
      const packageInfo = {
        id: packageId,
        description: packageData.description,
        status: packageData.status,
        creator: packageData.creator,
        currentOwner: packageData.currentOwner,
        contractAddress: '0x8B3c8408Cf72618D556c665BD06A4CACB6518a69',
        network: 'Sepolia',
        timestamp: new Date().toISOString(),
        dAppUrl: window.location.origin
      };

      const qrData = JSON.stringify(packageInfo, null, 2);
      const dataURL = await QRCode.toDataURL(qrData, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrCodeDataURL(dataURL);
    } catch (err) {
      console.error('Failed to generate QR code:', err);
      setError('Failed to generate QR code');
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeDataURL) return;
    
    const link = document.createElement('a');
    link.download = `package-${packageId}-qr.png`;
    link.href = qrCodeDataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyPackageInfo = async () => {
    if (!packageData) return;
    
    const packageInfo = {
      id: packageId,
      description: packageData.description,
      status: packageData.status === 0 ? 'Created' : packageData.status === 1 ? 'In Transit' : 'Delivered',
      creator: packageData.creator,
      currentOwner: packageData.currentOwner,
      contractAddress: '0x8B3c8408Cf72618D556c665BD06A4CACB6518a69',
      network: 'Sepolia',
      dAppUrl: window.location.origin
    };

    const text = `Package #${packageId}
Description: ${packageInfo.description}
Status: ${packageInfo.status}
Creator: ${packageInfo.creator}
Current Owner: ${packageInfo.currentOwner}
Contract: ${packageInfo.contractAddress}
Network: ${packageInfo.network}
Track at: ${packageInfo.dAppUrl}`;

    try {
      await navigator.clipboard.writeText(text);
      alert('Package information copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
      alert('Failed to copy to clipboard');
    }
  };

  if (!packageId || !packageData) return null;

  return (
    <div style={{
      backgroundColor: '#f8f9fa',
      border: '1px solid #dee2e6',
      borderRadius: 8,
      padding: 16,
      marginTop: 16
    }}>
      <h4 style={{ marginTop: 0, color: '#2c3e50' }}>📱 Share Package</h4>
      
      {isGenerating && (
        <div style={{ textAlign: 'center', padding: 20, color: '#666' }}>
          🔄 Generating QR code...
        </div>
      )}

      {error && (
        <div style={{
          backgroundColor: '#f8d7da',
          border: '1px solid #f5c6cb',
          borderRadius: 4,
          padding: 12,
          color: '#721c24',
          marginBottom: 16
        }}>
          {error}
        </div>
      )}

      {qrCodeDataURL && !isGenerating && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            backgroundColor: 'white',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            padding: 16,
            display: 'inline-block',
            marginBottom: 16
          }}>
            <img 
              src={qrCodeDataURL} 
              alt={`QR Code for Package ${packageId}`}
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={downloadQRCode}
              style={{
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📥 Download QR Code
            </button>
            
            <button
              onClick={copyPackageInfo}
              style={{
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              📋 Copy Package Info
            </button>
          </div>
          
          <div style={{ 
            fontSize: '12px', 
            color: '#6c757d', 
            marginTop: 12,
            maxWidth: 300,
            margin: '12px auto 0'
          }}>
            Scan this QR code to view package details on any device
          </div>
        </div>
      )}
    </div>
  );
}
