/**
 * Wagmi Configuration
 * 
 * Configures wagmi with supported chains, connectors, and transports
 */

import { createConfig, http } from 'wagmi';
import { sepolia, mainnet, polygon, arbitrum, optimism } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import { getContractAddress } from './contracts';

// Get WalletConnect project ID from environment (optional)
const walletConnectProjectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || '';

// Supported chains
const chains = [sepolia, mainnet, polygon, arbitrum, optimism];

// Connectors
// Using injected() which handles MetaMask and other injected wallets
// This avoids the MetaMask SDK analytics dependency issue
const connectors = [
  injected(),
];

// Add WalletConnect if project ID is provided
if (walletConnectProjectId) {
  connectors.push(
    walletConnect({ projectId: walletConnectProjectId })
  );
}

// Add Coinbase Wallet
connectors.push(coinbaseWallet({ appName: 'Supply Chain Tracking' }));

// Create transports for each chain
const transports = {};
chains.forEach((chain) => {
  transports[chain.id] = http();
});

// Create wagmi config
export const wagmiConfig = createConfig({
  chains,
  connectors,
  transports,
});

// Helper to get contract address for current chain
export function getContractAddressForChain(chainId) {
  const chainMap = {
    [sepolia.id]: 'sepolia',
    [mainnet.id]: 'mainnet',
    [polygon.id]: 'polygon',
    [arbitrum.id]: 'arbitrum',
    [optimism.id]: 'optimism',
  };
  
  const networkName = chainMap[chainId];
  if (!networkName) {
    return null;
  }
  
  return getContractAddress(networkName);
}

export default wagmiConfig;

