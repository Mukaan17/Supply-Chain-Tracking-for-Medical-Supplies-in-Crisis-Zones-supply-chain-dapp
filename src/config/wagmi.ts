/**
 * Wagmi Configuration
 * 
 * Configures wagmi with supported chains, connectors, and transports
 */

import { createConfig, http, Config } from 'wagmi';
import { sepolia, mainnet, polygon, arbitrum, optimism, Chain } from 'wagmi/chains';
import { injected, walletConnect, coinbaseWallet } from 'wagmi/connectors';
import type { Connector } from 'wagmi';
import { getContractAddress } from './contracts';

// Get WalletConnect project ID from environment (optional)
const walletConnectProjectId = process.env.REACT_APP_WALLETCONNECT_PROJECT_ID || '';

// Supported chains
const chains: readonly [Chain, ...Chain[]] = [sepolia, mainnet, polygon, arbitrum, optimism];

// Connectors
// Using injected() which handles MetaMask and other injected wallets
// This avoids the MetaMask SDK analytics dependency issue
const connectors: any[] = [
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
const transports: Record<number, ReturnType<typeof http>> = {};
chains.forEach((chain) => {
  transports[chain.id] = http();
});

// Create wagmi config
export const wagmiConfig: Config = createConfig({
  chains,
  connectors,
  transports,
});

// Helper to get contract address for current chain
export function getContractAddressForChain(chainId: number): string | null {
  const chainMap: { [key: number]: string } = {
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

