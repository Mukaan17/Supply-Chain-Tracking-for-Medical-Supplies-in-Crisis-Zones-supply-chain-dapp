/**
 * Contract Configuration
 * 
 * Manages contract addresses per network and ABI loading.
 */

import contractABI from './contract-abi.json';

// Contract addresses per network
// These should be set via environment variables in production
const contractAddresses: { [key: string]: string } = {
  sepolia: process.env.REACT_APP_CONTRACT_ADDRESS_SEPOLIA || '0x971EC5685f0FE4f5fC8F868586BCADC5Ec30819e',
  mainnet: process.env.REACT_APP_CONTRACT_ADDRESS_MAINNET || '',
  polygon: process.env.REACT_APP_CONTRACT_ADDRESS_POLYGON || '',
  arbitrum: process.env.REACT_APP_CONTRACT_ADDRESS_ARBITRUM || '',
  optimism: process.env.REACT_APP_CONTRACT_ADDRESS_OPTIMISM || '',
  localhost: process.env.REACT_APP_CONTRACT_ADDRESS_LOCALHOST || '',
};

// Fallback to default contract address if set
const defaultContractAddress = process.env.REACT_APP_CONTRACT_ADDRESS || '';

/**
 * Get contract address for a specific network
 */
export function getContractAddress(networkName?: string): string {
  const network = networkName?.toLowerCase();
  
  // Try network-specific address first
  if (network && contractAddresses[network]) {
    return contractAddresses[network];
  }
  
  // Fallback to default address
  if (defaultContractAddress) {
    return defaultContractAddress;
  }
  
  return '';
}

/**
 * Set contract address for a network (runtime configuration)
 */
export function setContractAddress(networkName: string, address: string): void {
  const network = networkName?.toLowerCase();
  if (network && address) {
    contractAddresses[network] = address;
  }
}

/**
 * Get contract ABI
 */
export function getContractABI(): any[] {
  return contractABI as any[];
}

/**
 * Validate contract address format
 */
export function isValidContractAddress(address: string): boolean {
  if (!address) return false;
  if (!address.startsWith('0x')) return false;
  if (address.length !== 42) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Get contract instance configuration
 */
export function getContractConfig(networkName: string): {
  address: string;
  abi: any[];
} {
  const address = getContractAddress(networkName);
  const abi = getContractABI();
  
  if (!address) {
    throw new Error(`Contract address not configured for network: ${networkName}`);
  }
  
  if (!isValidContractAddress(address)) {
    throw new Error(`Invalid contract address: ${address}`);
  }
  
  return {
    address,
    abi,
  };
}

/**
 * Check if contract is deployed on network
 */
export function isContractDeployed(networkName: string): boolean {
  const address = getContractAddress(networkName);
  return isValidContractAddress(address);
}

/**
 * Get all configured contract addresses
 */
export function getAllContractAddresses(): { [key: string]: string } {
  return { ...contractAddresses };
}

export default {
  getContractAddress,
  setContractAddress,
  getContractABI,
  getContractConfig,
  isValidContractAddress,
  isContractDeployed,
  getAllContractAddresses,
};

