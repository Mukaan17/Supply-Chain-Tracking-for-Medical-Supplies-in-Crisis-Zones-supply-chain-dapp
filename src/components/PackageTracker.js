/**
 * @Author: Mukhil Sundararaj
 * @Date:   2025-09-11 14:36:07
 * @Last Modified by:   Mukhil Sundararaj
 * @Last Modified time: 2025-09-11 19:08:36
 */
import React, { useState, useEffect, useRef } from 'react';
import PackageHistory from './PackageHistory';
import PackageSearch from './PackageSearch';
import QRCodeGenerator from './QRCodeGenerator';
import TransactionQueue from './TransactionQueue';
import GasEstimate from './GasEstimate';
import { validatePackageId, validateAddress } from '../utils/validation';
import { sanitizePackageId, sanitizeAddress } from '../utils/sanitization';
import logger from '../services/logging';
import errorTracking from '../services/errorTracking';
import { handleError } from '../utils/errorHandler';
import { useTransaction } from '../hooks/useTransaction';
import { retry } from '../utils/retry';

const STATUS_LABELS = {
  0: 'Created',
  1: 'InTransit',
  2: 'Delivered',
};

export default function PackageTracker({ contract, account, provider, network }) {
  const [queryId, setQueryId] = useState('');
  const [data, setData] = useState(null);
  const [txMsg, setTxMsg] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const detailsRef = useRef(null);
  const { submitTransaction, estimateGas } = useTransaction();

  const fetchDetails = async (e) => {
    e.preventDefault();
    if (!contract) return;
    
    // Validate package ID
    const idError = validatePackageId(queryId);
    if (idError) {
      setValidationErrors({ packageId: idError });
      return;
    }
    setValidationErrors({});
    
    try {
      setLoading(true);
      const sanitizedId = sanitizePackageId(queryId);
      if (!sanitizedId) {
        setValidationErrors({ packageId: 'Invalid package ID' });
        return;
      }

      const res = await retry(
        () => contract.getPackageDetails(sanitizedId),
        { maxAttempts: 3 }
      );
      
      setData({
        id: res[0].toString(),
        description: res[1],
        creator: res[2],
        currentOwner: res[3],
        status: Number(res[4]),
        createdAt: res[5] ? Number(res[5]) : null,
        lastUpdatedAt: res[6] ? Number(res[6]) : null,
      });
      
      logger.info('Package details fetched', { packageId: sanitizedId });
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'PackageTracker',
        action: 'fetchDetails',
      });
      logger.error('Failed to fetch package details', err, { packageId: queryId });
      errorTracking.captureException(err, {
        tags: { component: 'PackageTracker' },
      });
      setData(null);
      setValidationErrors({ packageId: errorInfo.message || 'Package not found or invalid ID' });
    } finally {
      setLoading(false);
    }
  };

  // Fetch details by a given packageId without altering the input value
  const fetchDetailsById = async (packageId) => {
    if (!contract) return;
    try {
      setLoading(true);
      logger.debug('Fetching package details', { packageId, contractAddress: contract.target });
      
      const sanitizedId = sanitizePackageId(packageId);
      if (!sanitizedId) {
        setValidationErrors({ packageId: 'Invalid package ID' });
        return;
      }

      const res = await retry(
        () => contract.getPackageDetails(sanitizedId),
        { maxAttempts: 3 }
      );
      
      setData({
        id: res[0].toString(),
        description: res[1],
        creator: res[2],
        currentOwner: res[3],
        status: Number(res[4]),
        createdAt: res[5] ? Number(res[5]) : null,
        lastUpdatedAt: res[6] ? Number(res[6]) : null,
      });
      setValidationErrors({});
      logger.info('Package details fetched successfully', { packageId: sanitizedId });
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'PackageTracker',
        action: 'fetchDetailsById',
      });
      logger.error('Error fetching package details', err, { packageId });
      errorTracking.captureException(err, {
        tags: { component: 'PackageTracker' },
      });
      setData(null);
      if (err.message && err.message.includes('Package does not exist')) {
        setValidationErrors({ packageId: `Package #${packageId} does not exist on this contract` });
      } else {
        setValidationErrors({ packageId: errorInfo.message || 'Failed to fetch package details' });
      }
    } finally {
      setLoading(false);
    }
  };

  const doTransfer = async () => {
    if (!contract) return;
    
    // Pick the active package id (prefer loaded data.id)
    const activeId = data?.id ?? queryId;
    const idNum = Number(activeId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      setValidationErrors({ packageId: 'Please select or enter a valid Package ID' });
      return;
    }
    
    // Check if package data exists
    if (!data) {
      setValidationErrors({ packageId: 'Package not loaded. Please fetch package details first.' });
      return;
    }
    
    // Validate and sanitize transfer address
    const sanitizedAddress = sanitizeAddress(transferTo);
    const addressError = validateAddress(sanitizedAddress);
    if (addressError) {
      setValidationErrors({ transferAddress: addressError });
      return;
    }
    setValidationErrors({});
    
    try {
      setTxMsg('Awaiting confirmation...');
      logger.info('Initiating package transfer', { packageId: idNum, to: sanitizedAddress });
      
      const txPromise = contract.transferOwnership(idNum, sanitizedAddress);
      await submitTransaction(txPromise, {
        method: 'transferOwnership',
        params: { packageId: idNum, newOwner: sanitizedAddress },
        description: `Transfer package #${idNum} to ${sanitizedAddress.slice(0, 6)}...${sanitizedAddress.slice(-4)}`,
      });
      
      setTxMsg('✅ Package transferred successfully');
      await fetchDetailsById(idNum);
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'PackageTracker',
        action: 'doTransfer',
      });
      logger.error('Transfer failed', err, { packageId: idNum, to: sanitizedAddress });
      errorTracking.captureException(err, {
        tags: { component: 'PackageTracker', action: 'transfer' },
      });
      setTxMsg('❌ Transfer failed: ' + errorInfo.message);
    }
  };

  const doDeliver = async () => {
    if (!contract) return;
    // Pick the active package id (prefer loaded data.id)
    const activeId = data?.id ?? queryId;
    const idNum = Number(activeId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      setValidationErrors({ packageId: 'Please select or enter a valid Package ID' });
      return;
    }
    
    // Check if package data exists
    if (!data) {
      setValidationErrors({ packageId: 'Package not loaded. Please fetch package details first.' });
      return;
    }
    try {
      setTxMsg('Awaiting confirmation...');
      logger.info('Marking package as delivered', { packageId: idNum });
      
      const txPromise = contract.markAsDelivered(idNum);
      await submitTransaction(txPromise, {
        method: 'markAsDelivered',
        params: { packageId: idNum },
        description: `Mark package #${idNum} as delivered`,
      });
      
      setTxMsg('✅ Package marked as delivered');
      await fetchDetailsById(idNum);
      logger.info('Package marked as delivered', { packageId: idNum });
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'PackageTracker',
        action: 'doDeliver',
      });
      logger.error('Delivery failed', err, { packageId: idNum });
      errorTracking.captureException(err, {
        tags: { component: 'PackageTracker', action: 'deliver' },
      });
      setTxMsg('❌ Delivery failed: ' + errorInfo.message);
    }
  };

  const doMarkInTransit = async () => {
    if (!contract) return;
    // Pick the active package id (prefer loaded data.id)
    const activeId = data?.id ?? queryId;
    const idNum = Number(activeId);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      setValidationErrors({ packageId: 'Please select or enter a valid Package ID' });
      return;
    }
    
    // Check if package data exists
    if (!data) {
      setValidationErrors({ packageId: 'Package not loaded. Please fetch package details first.' });
      return;
    }
    try {
      setTxMsg('Awaiting confirmation...');
      logger.info('Marking package as in transit', { packageId: idNum });
      
      const txPromise = contract.markAsInTransit(idNum);
      await submitTransaction(txPromise, {
        method: 'markAsInTransit',
        params: { packageId: idNum },
        description: `Mark package #${idNum} as in transit`,
      });
      
      setTxMsg('✅ Package marked as in transit');
      await fetchDetailsById(idNum);
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'PackageTracker',
        action: 'doMarkInTransit',
      });
      logger.error('Mark as in transit failed', err, { packageId: idNum });
      errorTracking.captureException(err, {
        tags: { component: 'PackageTracker', action: 'markInTransit' },
      });
      setTxMsg('❌ Mark as in transit failed: ' + errorInfo.message);
    }
  };

  const handlePackageSelect = (packageId) => {
    // Do not update the input field; only show details
    setValidationErrors({});
    fetchDetailsById(packageId);
  };

  // When details are loaded, scroll them into view so the user sees them immediately
  useEffect(() => {
    if (data && detailsRef.current) {
      try {
        detailsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (_) {
        // no-op if scroll fails
      }
    }
  }, [data]);

  return (
    <div>
      <h2>Track Package</h2>
      
      <PackageSearch contract={contract} onPackageSelect={handlePackageSelect} />
      
      <form onSubmit={fetchDetails} style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
        <div>
          <input
            type="number"
            value={queryId}
            onChange={(e) => {
              setQueryId(e.target.value);
              setValidationErrors({}); // Clear validation error on change
            }}
            placeholder="Enter Package ID (1 or greater)"
            required
            style={{ 
              width: '100%', 
              padding: 12, 
              border: validationErrors.packageId ? '2px solid #dc3545' : '1px solid #ccc',
              borderRadius: 4,
              fontSize: '16px'
            }}
          />
          {validationErrors.packageId && (
            <div style={{ color: '#dc3545', fontSize: '14px', marginTop: 4 }}>
              {validationErrors.packageId}
            </div>
          )}
        </div>
        <button 
          type="submit"
          style={{
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          🔍 Track Package
        </button>
      </form>

      {data && (
        <div ref={detailsRef} style={{ marginTop: 16, textAlign: 'left' }}>
          <div style={{
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: 8,
            padding: 16,
            marginBottom: 16
          }}>
            <h3 style={{ marginTop: 0, color: '#2c3e50' }}>📦 Package Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <p><strong>ID:</strong> {data.id}</p>
              <p><strong>Status:</strong> 
                <span style={{
                  backgroundColor: data.status === 0 ? '#fff3cd' : data.status === 1 ? '#d1ecf1' : '#d4edda',
                  color: data.status === 0 ? '#856404' : data.status === 1 ? '#0c5460' : '#155724',
                  padding: '2px 8px',
                  borderRadius: 4,
                  marginLeft: 8,
                  fontSize: '12px'
                }}>
                  {STATUS_LABELS[data.status] ?? data.status}
                </span>
              </p>
              <p><strong>Description:</strong> {data.description}</p>
              <p><strong>Creator:</strong> {data.creator}</p>
              <p><strong>Current Owner:</strong> {data.currentOwner}</p>
            </div>
          </div>

          {account && data.currentOwner && account.toLowerCase() === data.currentOwner.toLowerCase() && (
            <div style={{
              backgroundColor: '#e7f3ff',
              border: '1px solid #b3d9ff',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16
            }}>
              <h3 style={{ marginTop: 0, color: '#004085' }}>⚡ Owner Actions</h3>
              <div style={{ marginBottom: 16 }}>
                <input
                  type="text"
                  placeholder="New owner address (0x...)"
                  value={transferTo}
                  onChange={(e) => {
                    setTransferTo(e.target.value);
                    setValidationErrors({}); // Clear validation error on change
                  }}
                  style={{ 
                    width: '100%', 
                    padding: 12, 
                    border: validationErrors.transferAddress ? '2px solid #dc3545' : '1px solid #ccc',
                    borderRadius: 4,
                    fontSize: '16px',
                    marginBottom: 8
                  }}
                />
                {validationErrors.transferAddress && (
                  <div style={{ color: '#dc3545', fontSize: '14px', marginBottom: 12 }}>
                    {validationErrors.transferAddress}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button 
                    onClick={doTransfer}
                    style={{
                      backgroundColor: '#28a745',
                      color: 'white',
                      border: 'none',
                      padding: '12px 24px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: '16px',
                      fontWeight: 'bold'
                    }}
                  >
                    🚚 Transfer Package
                  </button>
                  {data.status !== 2 && (
                    <>
                      <button 
                        onClick={doDeliver}
                        style={{
                          backgroundColor: '#17a2b8',
                          color: 'white',
                          border: 'none',
                          padding: '12px 24px',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: '16px',
                          fontWeight: 'bold'
                        }}
                      >
                        ✅ Mark as Delivered
                      </button>
                      <GasEstimate
                        contract={contract}
                        methodName="markAsDelivered"
                        args={[idNum]}
                        network={network}
                      />
                    </>
                  )}
                  {data.status === 2 && (
                    <button 
                      onClick={doMarkInTransit}
                      style={{
                        backgroundColor: '#ffc107',
                        color: '#212529',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold'
                      }}
                    >
                      🚛 Mark as In Transit
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          <PackageHistory contract={contract} packageId={data.id} provider={provider} />
          
          <QRCodeGenerator packageId={data.id} packageData={data} />
          
          {network && <TransactionQueue network={network} />}
        </div>
      )}

      {txMsg && (
        <div style={{
          backgroundColor: txMsg.includes('❌') ? '#f8d7da' : '#d4edda',
          border: txMsg.includes('❌') ? '1px solid #f5c6cb' : '1px solid #c3e6cb',
          borderRadius: 4,
          padding: 12,
          marginTop: 12,
          color: txMsg.includes('❌') ? '#721c24' : '#155724'
        }}>
          {txMsg}
        </div>
      )}
    </div>
  );
}


