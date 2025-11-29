/**
 * useContract Hook
 * 
 * Custom hook for contract interactions with automatic reconnection,
 * error handling, and transaction queue integration.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { ethers } from 'ethers';
import { getContractConfig } from '../config/contracts';
import { getNetworkByChainId } from '../config/networks';
import transactionManager from '../services/transactionManager';
import logger from '../services/logging';
import errorTracking from '../services/errorTracking';
import { handleError } from '../utils/errorHandler';
import { retry } from '../utils/retry';

export function useContract(provider, signer, networkName) {
  const [contract, setContract] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const contractRef = useRef(null);

  // Initialize contract
  useEffect(() => {
    if (!provider || !signer || !networkName) {
      setContract(null);
      setLoading(false);
      return;
    }

    const initContract = async () => {
      try {
        setLoading(true);
        setError(null);

        const config = getContractConfig(networkName);
        const contractInstance = new ethers.Contract(
          config.address,
          config.abi,
          signer
        );

        contractRef.current = contractInstance;
        setContract(contractInstance);

        // Initialize transaction manager
        transactionManager.init(provider, signer);

        logger.info('Contract initialized', {
          address: config.address,
          network: networkName,
        });
      } catch (err) {
        const errorInfo = handleError(err, {
          component: 'useContract',
          network: networkName,
        });
        setError(errorInfo);
        errorTracking.captureException(err, {
          tags: { component: 'useContract' },
          extra: { network: networkName },
        });
      } finally {
        setLoading(false);
      }
    };

    initContract();
  }, [provider, signer, networkName]);

  // Update transaction manager on provider/signer change
  useEffect(() => {
    if (provider && signer) {
      transactionManager.updateProvider(provider, signer).catch((error) => {
        logger.error('Failed to update transaction manager provider', error);
      });
    }
  }, [provider, signer]);

  // Contract interaction wrapper with error handling
  const callContract = useCallback(async (methodName, ...args) => {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const method = contract[methodName];
      if (!method) {
        throw new Error(`Method ${methodName} not found`);
      }

      logger.debug('Calling contract method', { methodName, args });
      const result = await retry(() => method(...args), {
        maxAttempts: 3,
        delay: 1000,
      });

      return result;
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'useContract',
        method: methodName,
      });
      throw errorInfo;
    }
  }, [contract]);

  // Send transaction with queue management
  const sendTransaction = useCallback(async (methodName, ...args) => {
    if (!contract) {
      throw new Error('Contract not initialized');
    }

    try {
      const method = contract[methodName];
      if (!method) {
        throw new Error(`Method ${methodName} not found`);
      }

      logger.info('Sending transaction', { methodName });

      // Create transaction promise
      const txPromise = method(...args);

      // Add to transaction queue
      const entry = await transactionManager.addTransaction(txPromise, {
        method: methodName,
        params: args,
        description: `Call ${methodName}`,
      });

      return entry;
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'useContract',
        method: methodName,
      });
      throw errorInfo;
    }
  }, [contract]);

  return {
    contract,
    loading,
    error,
    callContract,
    sendTransaction,
    isReady: contract !== null && !loading && !error,
  };
}

export default useContract;

