/**
 * useTransaction Hook
 * 
 * Custom hook for transaction submission, status tracking, and gas estimation.
 */

import { useState, useEffect, useCallback } from 'react';
import transactionManager from '../services/transactionManager';
import logger from '../services/logging';
import errorTracking from '../services/errorTracking';
import { handleError } from '../utils/errorHandler';

export interface TransactionMetadata {
  [key: string]: any;
}

export interface UseTransactionReturn {
  pendingTransactions: any[];
  transactionHistory: any[];
  loading: boolean;
  submitTransaction: (transactionPromise: Promise<any>, metadata?: TransactionMetadata) => Promise<any>;
  getTransaction: (id: string) => any;
  getTransactionByHash: (hash: string) => any;
  cancelTransaction: (id: string) => void;
  estimateGas: (contract: any, methodName: string, ...args: any[]) => Promise<any>;
  getGasPrice: (provider: any) => Promise<any>;
}

export function useTransaction(): UseTransactionReturn {
  const [pendingTransactions, setPendingTransactions] = useState<any[]>([]);
  const [transactionHistory, setTransactionHistory] = useState<any[]>([]);
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
      const history = transactionManager.getHistory(50 as any); // Last 50 transactions
      setTransactionHistory(history);
    };

    updateHistory();
    const interval = setInterval(updateHistory, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, []);

  /**
   * Submit transaction
   */
  const submitTransaction = useCallback(async (transactionPromise: Promise<any>, metadata: TransactionMetadata = {}): Promise<any> => {
    try {
      setLoading(true);
      const entry = await transactionManager.addTransaction(transactionPromise, metadata);
      return entry;
    } catch (error: any) {
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
  const getTransaction = useCallback((id: string): any => {
    return transactionManager.getTransaction(id);
  }, []);

  /**
   * Get transaction by hash
   */
  const getTransactionByHash = useCallback((hash: string): any => {
    return transactionManager.getTransactionByHash(hash);
  }, []);

  /**
   * Cancel transaction
   */
  const cancelTransaction = useCallback((id: string): void => {
    transactionManager.cancelTransaction(id);
  }, []);

  /**
   * Estimate gas for a transaction
   */
  const estimateGas = useCallback(async (contract: any, methodName: string, ...args: any[]): Promise<any> => {
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
    } catch (error: any) {
      logger.error('Gas estimation failed', error, {
        method: methodName,
      });
      throw error;
    }
  }, []);

  /**
   * Get gas price
   */
  const getGasPrice = useCallback(async (provider: any): Promise<any> => {
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
    } catch (error: any) {
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

