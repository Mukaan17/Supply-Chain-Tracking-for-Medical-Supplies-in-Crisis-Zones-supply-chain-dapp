/**
 * @Author: Mukhil Sundararaj
 * @Date:   2025-09-11 14:36:07
 * @Last Modified by:   Mukhil Sundararaj
 * @Last Modified time: 2025-09-11 19:08:36
 */
import React, { useState, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
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
import { useContractAddress } from '../hooks/useContract';
import { getContractABI } from '../config/contracts';

const STATUS_LABELS = {
  0: 'Created',
  1: 'InTransit',
  2: 'Delivered',
};

export default function PackageTracker({ contract, account, network }) {
  const [queryId, setQueryId] = useState('');
  const [data, setData] = useState(null);
  const [txMsg, setTxMsg] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [packageIdToFetch, setPackageIdToFetch] = useState(null);
  const detailsRef = useRef(null);
  const contractAddress = useContractAddress();
  const abi = getContractABI();
  
  const { writeContract, isPending: isWriting, data: writeData } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: writeData,
  });
  
  // Use wagmi's useReadContract for fetching package details
  const { data: packageData, isLoading: isReading, error: readError, refetch } = useReadContract({
    address: packageIdToFetch ? contractAddress : undefined,
    abi,
    functionName: 'getPackageDetails',
    args: packageIdToFetch ? [BigInt(packageIdToFetch)] : undefined,
    query: {
      enabled: !!packageIdToFetch && !!contractAddress,
    },
  });

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Update data when packageData changes
  useEffect(() => {
    if (packageData && packageData.length >= 7) {
      const [id, description, creator, currentOwner, status, createdAt, lastUpdatedAt] = packageData;
      setData({
        id: id.toString(),
        description,
        creator,
        currentOwner,
        status: typeof status === 'bigint' ? Number(status) : Number(status),
        createdAt: createdAt ? (typeof createdAt === 'bigint' ? Number(createdAt) : Number(createdAt)) : null,
        lastUpdatedAt: lastUpdatedAt ? (typeof lastUpdatedAt === 'bigint' ? Number(lastUpdatedAt) : Number(lastUpdatedAt)) : null,
      });
      setLoading(false);
      logger.info('Package details fetched', { packageId: id.toString() });
    }
    if (readError) {
      const errorInfo = handleError(readError, {
        component: 'PackageTracker',
        action: 'fetchDetails',
      });
      logger.error('Failed to fetch package details', readError);
      setData(null);
      setValidationErrors({ packageId: errorInfo.message || 'Package not found or invalid ID' });
      setLoading(false);
    }
  }, [packageData, readError]);

  // Refetch package data after successful transaction
  useEffect(() => {
    if (isConfirmed && writeData && data?.id) {
      setPackageIdToFetch(data.id);
      setTimeout(() => refetch(), 1000);
    }
  }, [isConfirmed, writeData, data?.id, refetch]);

  const fetchDetails = async (e) => {
    e.preventDefault();
    if (!contractAddress) {
      setValidationErrors({ packageId: 'Contract not ready' });
      return;
    }
    
    // Validate package ID
    const idError = validatePackageId(queryId);
    if (idError) {
      setValidationErrors({ packageId: idError });
      return;
    }
    setValidationErrors({});
    
    const sanitizedId = sanitizePackageId(queryId);
    if (!sanitizedId) {
      setValidationErrors({ packageId: 'Invalid package ID' });
      return;
    }

    setLoading(true);
    setPackageIdToFetch(sanitizedId);
    // Trigger refetch
    setTimeout(() => refetch(), 100);
  };

  // Fetch details by a given packageId without altering the input value
  const fetchDetailsById = async (packageId) => {
    if (!contractAddress) return;
    try {
      setLoading(true);
      logger.debug('Fetching package details', { packageId, contractAddress });
      
      const sanitizedId = sanitizePackageId(packageId);
      if (!sanitizedId) {
        if (isMountedRef.current) {
          setValidationErrors({ packageId: 'Invalid package ID' });
        }
        setLoading(false);
        return;
      }

      setPackageIdToFetch(sanitizedId);
      // Trigger refetch - data will be updated via useEffect when packageData changes
      setTimeout(() => refetch(), 100);
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'PackageTracker',
        action: 'fetchDetailsById',
      });
      logger.error('Error fetching package details', err, { packageId });
      errorTracking.captureException(err, {
        tags: { component: 'PackageTracker' },
      });
      setLoading(false);
      if (err.message && err.message.includes('Package does not exist')) {
        setValidationErrors({ packageId: `Package #${packageId} does not exist on this contract` });
      } else {
        setValidationErrors({ packageId: errorInfo.message || 'Failed to fetch package details' });
      }
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
      
      writeContract({
        address: contractAddress,
        abi,
        functionName: 'transferOwnership',
        args: [BigInt(idNum), sanitizedAddress],
      });
      
      setTxMsg('✅ Package transferred successfully');
      // Refetch will happen via useEffect when writeData changes
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
    if (!contractAddress) return;
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
      
      writeContract({
        address: contractAddress,
        abi,
        functionName: 'markAsDelivered',
        args: [BigInt(idNum)],
      });
      
      setTxMsg('✅ Package marked as delivered');
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
    if (!contractAddress) return;
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
      
      writeContract({
        address: contractAddress,
        abi,
        functionName: 'markAsInTransit',
        args: [BigInt(idNum)],
      });
      
      setTxMsg('✅ Package marked as in transit');
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
      
      <PackageSearch contract={contract} onPackageSelect={handlePackageSelect} account={account} />
      
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
              {data.createdAt && (
                <p><strong>Created:</strong> {new Date(data.createdAt * 1000).toLocaleString()}</p>
              )}
              {data.lastUpdatedAt && (
                <p><strong>Last Updated:</strong> {new Date(data.lastUpdatedAt * 1000).toLocaleString()}</p>
              )}
            </div>
          </div>

          {account && data.currentOwner && (
            <div style={{
              backgroundColor: account.toLowerCase() === data.currentOwner.toLowerCase() ? '#e7f3ff' : '#fff3cd',
              border: account.toLowerCase() === data.currentOwner.toLowerCase() ? '1px solid #b3d9ff' : '1px solid #ffc107',
              borderRadius: 8,
              padding: 16,
              marginBottom: 16
            }}>
              <h3 style={{ marginTop: 0, color: '#004085' }}>
                {account.toLowerCase() === data.currentOwner.toLowerCase() ? '⚡ Owner Actions' : 'ℹ️ Package Information'}
              </h3>
              {account.toLowerCase() !== data.currentOwner.toLowerCase() && (
                <div style={{ 
                  backgroundColor: '#fff3cd', 
                  border: '1px solid #ffc107', 
                  borderRadius: 4, 
                  padding: 12, 
                  marginBottom: 16,
                  color: '#856404'
                }}>
                  <strong>Note:</strong> You are not the current owner of this package. Only the owner can transfer or mark as delivered.
                  <br />
                  <strong>Current Owner:</strong> {data.currentOwner}
                  <br />
                  <strong>Your Address:</strong> {account}
                </div>
              )}
              {account.toLowerCase() === data.currentOwner.toLowerCase() && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold', color: '#004085' }}>
                    Transfer Ownership:
                  </label>
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
                      disabled={!transferTo || transferTo.trim() === ''}
                      style={{
                        backgroundColor: (!transferTo || transferTo.trim() === '') ? '#6c757d' : '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: 4,
                        cursor: (!transferTo || transferTo.trim() === '') ? 'not-allowed' : 'pointer',
                        fontSize: '16px',
                        fontWeight: 'bold',
                        opacity: (!transferTo || transferTo.trim() === '') ? 0.6 : 1
                      }}
                    >
                      🚚 Transfer Package
                    </button>
                    {transferTo && transferTo.trim() !== '' && contract && data && (
                      <GasEstimate
                        contract={contract}
                        methodName="transferOwnership"
                        args={[Number(data.id), transferTo.trim()]}
                      />
                    )}
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
                          args={[Number(data.id)]}
                          network={network}
                        />
                      </>
                    )}
                    {data.status === 2 && (
                      <>
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
                        {contract && data && (
                          <GasEstimate
                            contract={contract}
                            methodName="markAsInTransit"
                            args={[Number(data.id)]}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          <PackageHistory contract={contract} packageId={data.id} />
          
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

PackageTracker.propTypes = {
  contract: PropTypes.object,
  account: PropTypes.string,
  network: PropTypes.oneOfType([PropTypes.string, PropTypes.object]),
};
