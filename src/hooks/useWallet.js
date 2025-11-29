/**
 * useWallet Hook
 * 
 * Custom hook for wallet connection, account management, and network switching.
 */

import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { getNetworkByChainId, getMetaMaskNetworkConfig } from '../config/networks';
import logger from '../services/logging';
import errorTracking from '../services/errorTracking';
import analytics from '../services/analytics';
import { handleError } from '../utils/errorHandler';

export function useWallet() {
  const [account, setAccount] = useState('');
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [network, setNetwork] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // Check if MetaMask is installed
  const isMetaMaskInstalled = typeof window !== 'undefined' && window.ethereum;

  // Connect wallet
  const connectWallet = useCallback(async () => {
    if (!isMetaMaskInstalled) {
      const error = new Error('MetaMask not detected. Please install MetaMask.');
      setError(handleError(error));
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (accounts.length === 0) {
        throw new Error('No accounts found');
      }

      const selectedAccount = accounts[0];
      setAccount(selectedAccount);

      // Create provider and signer
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const browserSigner = await browserProvider.getSigner();

      setProvider(browserProvider);
      setSigner(browserSigner);

      // Get network
      const networkInfo = await browserProvider.getNetwork();
      const networkConfig = getNetworkByChainId(Number(networkInfo.chainId));
      setNetwork(networkConfig);

      setIsConnected(true);

      // Track analytics
      analytics.setUserId(selectedAccount);
      analytics.trackEvent('wallet_connected', {
        address: selectedAccount,
        network: networkConfig?.name,
      });

      logger.info('Wallet connected', {
        address: selectedAccount,
        network: networkConfig?.name,
      });
    } catch (err) {
      const errorInfo = handleError(err, { component: 'useWallet' });
      setError(errorInfo);
      errorTracking.captureException(err, {
        tags: { component: 'useWallet' },
      });
      
      // Track user rejection separately
      if (err.code === 4001) {
        analytics.trackEvent('wallet_connection_rejected');
      }
    } finally {
      setLoading(false);
    }
  }, [isMetaMaskInstalled]);

  // Disconnect wallet
  const disconnectWallet = useCallback(() => {
    setAccount('');
    setProvider(null);
    setSigner(null);
    setNetwork(null);
    setIsConnected(false);
    setError(null);

    analytics.clearUser();
    logger.info('Wallet disconnected');
  }, []);

  // Switch network
  const switchNetwork = useCallback(async (networkName) => {
    if (!isMetaMaskInstalled) {
      throw new Error('MetaMask not detected');
    }

    try {
      setLoading(true);
      setError(null);

      const networkConfig = getMetaMaskNetworkConfig(networkName);
      if (!networkConfig) {
        throw new Error(`Network ${networkName} not supported`);
      }

      try {
        // Try to switch
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: networkConfig.chainId }],
        });
      } catch (switchError) {
        // If network doesn't exist, add it
        if (switchError.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [networkConfig],
          });
        } else {
          throw switchError;
        }
      }

      // Update network after switch
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const networkInfo = await browserProvider.getNetwork();
      const networkConfigUpdated = getNetworkByChainId(Number(networkInfo.chainId));
      setNetwork(networkConfigUpdated);

      logger.info('Network switched', { network: networkName });
      analytics.trackEvent('network_switched', { network: networkName });
    } catch (err) {
      const errorInfo = handleError(err, {
        component: 'useWallet',
        network: networkName,
      });
      setError(errorInfo);
      throw errorInfo;
    } finally {
      setLoading(false);
    }
  }, [isMetaMaskInstalled]);

  // Check connection on mount
  useEffect(() => {
    if (!isMetaMaskInstalled) {
      return;
    }

    const checkConnection = async () => {
      try {
        const accounts = await window.ethereum.request({
          method: 'eth_accounts',
        });

        if (accounts.length > 0) {
          // Auto-connect if already connected
          await connectWallet();
        }
      } catch (err) {
        logger.error('Failed to check wallet connection', err);
      }
    };

    checkConnection();

    // Listen for account changes
    const handleAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAccount(accounts[0]);
        analytics.setUserId(accounts[0]);
      }
    };

    // Listen for network changes
    const handleChainChanged = async (chainId) => {
      const networkConfig = getNetworkByChainId(Number(chainId));
      setNetwork(networkConfig);
      
      // Reconnect to update provider
      if (isConnected) {
        await connectWallet();
      }
    };

    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isMetaMaskInstalled, connectWallet, disconnectWallet, isConnected]);

  return {
    account,
    provider,
    signer,
    network,
    loading,
    error,
    isConnected,
    isMetaMaskInstalled,
    connectWallet,
    disconnectWallet,
    switchNetwork,
  };
}

export default useWallet;

