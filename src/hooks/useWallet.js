/**
 * useWallet Hook (Wagmi-based)
 * 
 * Custom hook for wallet connection using wagmi.
 * Provides wallet connection, account management, and network switching.
 */

import React from 'react';
import { useAccount, useConnect, useDisconnect, useChainId, useSwitchChain } from 'wagmi';
import { getNetworkByChainId } from '../config/networks';
import logger from '../services/logging';
import analytics from '../services/analytics';

export function useWallet() {
  const { address, isConnected, connector } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();

  // Get network config from chain ID
  const network = getNetworkByChainId(chainId);

  // Connect wallet
  const connectWallet = async (connectorId) => {
    try {
      const selectedConnector = connectors.find(c => c.id === connectorId || c.name === connectorId);
      if (!selectedConnector) {
        throw new Error(`Connector ${connectorId} not found`);
      }

      connect({ connector: selectedConnector });
      
      logger.info('Wallet connection initiated', {
        connector: selectedConnector.name,
      });
    } catch (err) {
      logger.error('Failed to connect wallet', err);
      throw err;
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    disconnect();
    analytics.clearUser();
    logger.info('Wallet disconnected');
  };

  // Switch network
  const switchNetwork = async (targetChainId) => {
    try {
      await switchChain({ chainId: targetChainId });
      logger.info('Network switched', { chainId: targetChainId });
      analytics.trackEvent('network_switched', { chainId: targetChainId });
    } catch (err) {
      logger.error('Failed to switch network', err);
      throw err;
    }
  };

  // Switch account
  const switchAccount = async () => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        // Request account switch - this will prompt the user to select a different account
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
        // Then request accounts again to get the new account
        await window.ethereum.request({
          method: 'eth_requestAccounts',
        });
        logger.info('Account switch requested');
        analytics.trackEvent('account_switch_requested');
      } else {
        throw new Error('No wallet provider found');
      }
    } catch (err) {
      logger.error('Failed to switch account', err);
      throw err;
    }
  };

  // Track wallet connection
  React.useEffect(() => {
    if (isConnected && address) {
      analytics.setUserId(address);
      analytics.trackEvent('wallet_connected', {
        address,
        network: network?.name,
        connector: connector?.name,
      });
      logger.info('Wallet connected', {
        address,
        network: network?.name,
      });
    }
  }, [isConnected, address, network, connector]);

  return {
    account: address || '',
    isConnected,
    network,
    chainId,
    connector,
    connectors,
    loading: isConnecting || isSwitching,
    error: null, // wagmi handles errors internally
    connectWallet,
    disconnectWallet,
    switchNetwork,
    switchAccount,
    isMetaMaskInstalled: typeof window !== 'undefined' && window.ethereum,
  };
}

export default useWallet;
