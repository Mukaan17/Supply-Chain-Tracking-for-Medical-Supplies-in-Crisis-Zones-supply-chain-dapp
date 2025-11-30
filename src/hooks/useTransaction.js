/**
 * useTransaction Hook
 * 
 * Custom hook for transaction submission, status tracking, and gas estimation.
 */

import { useState, useEffect, useCallback } from 'react';
// ethers not directly used in this hook
// import { ethers } from 'ethers';
import transactionManager from '../services/transactionManager';
import logger from '../services/logging';
import errorTracking from '../services/errorTracking';
import { handleError } from '../utils/errorHandler';

export function useTransaction() {
  const [pendingTransactions, setPendingTransactions] = useState([]);
  const [transactionHistory, setTransactionHistory] = useState([]);
  const [loading, setLoading] = useState(false);

  // Get pending transactions
  useEffect(() => {
    const updatePending = () => {
      const pending = transactionManager.getPendingTransactions();
      setPendingTransactions(pending);
    };

    updatePending();
    const interval = setInterval(updatePending, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  // Get transaction history
  useEffect(() => {
    const updateHistory = () => {
      const history = transactionManager.getHistory(50); // Last 50 transactions
      setTransactionHistory(history);
    };

    updateHistory();
    const interval = setInterval(updateHistory, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  /**
   * Submit transaction
   */
  const submitTransaction = useCallback(async (transactionPromise, metadata = {}) => {
    try {
      setLoading(true);
      const entry = await transactionManager.addTransaction(transactionPromise, metadata);
      return entry;
    } catch (error) {
      const errorInfo = handleError(error, {
        component: 'useTransaction',
        action: 'submitTransaction',
      });
      errorTracking.captureException(error, {
        tags: { component: 'useTransaction' },
      });
      throw errorInfo;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Get transaction by ID
   */
  const getTransaction = useCallback((id) => {
    return transactionManager.getTransaction(id);
  }, []);

  /**
   * Get transaction by hash
   */
  const getTransactionByHash = useCallback((hash) => {
    return transactionManager.getTransactionByHash(hash);
  }, []);

  /**
   * Cancel transaction
   */
  const cancelTransaction = useCallback((id) => {
    return transactionManager.cancelTransaction(id);
  }, []);

  /**
   * Estimate gas for a transaction
   */
  const estimateGas = useCallback(async (contract, methodName, ...args) => {
    try {
      if (!contract || !contract[methodName]) {
        throw new Error(`Method ${methodName} not found`);
      }

      const method = contract[methodName];
      const gasEstimate = await method.estimateGas(...args);
      
      logger.debug('Gas estimated', {
        method: methodName,
        gasEstimate: gasEstimate.toString(),
      });

      return gasEstimate;
    } catch (error) {
      logger.error('Gas estimation failed', error, {
        method: methodName,
      });
      throw error;
    }
  }, []);

  /**
   * Get gas price
   */
  const getGasPrice = useCallback(async (provider) => {
    try {
      if (!provider) {
        throw new Error('Provider not available');
      }

      const feeData = await provider.getFeeData();
      return {
        gasPrice: feeData.gasPrice,
        maxFeePerGas: feeData.maxFeePerGas,
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
      };
    } catch (error) {
      logger.error('Failed to get gas price', error);
      throw error;
    }
  }, []);

  return {
    pendingTransactions,
    transactionHistory,
    loading,
    submitTransaction,
    getTransaction,
    getTransactionByHash,
    cancelTransaction,
    estimateGas,
    getGasPrice,
  };
}

export default useTransaction;

