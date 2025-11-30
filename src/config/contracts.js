/**
 * Contract Configuration
 * 
 * Manages contract addresses per network and ABI loading.
 */

import contractABI from './contract-abi.json';

// Contract addresses per network
// These should be set via environment variables in production
const contractAddresses = {
  sepolia: process.env.REACT_APP_CONTRACT_ADDRESS_SEPOLIA || '',
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
 * @param {string} networkName - Network name
 * @returns {string} Contract address or empty string if not found
 */
export function getContractAddress(networkName) {
  const network = networkName?.toLowerCase();
  
  // Try network-specific address first
  if (contractAddresses[network]) {
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
 * @param {string} networkName - Network name
 * @param {string} address - Contract address
 */
export function setContractAddress(networkName, address) {
  const network = networkName?.toLowerCase();
  if (network && address) {
    contractAddresses[network] = address;
  }
}

/**
 * Get contract ABI
 * @returns {Array} Contract ABI
 */
export function getContractABI() {
  return contractABI;
}

/**
 * Validate contract address format
 * @param {string} address - Address to validate
 * @returns {boolean} True if address is valid
 */
export function isValidContractAddress(address) {
  if (!address) return false;
  if (!address.startsWith('0x')) return false;
  if (address.length !== 42) return false;
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Get contract instance configuration
 * @param {string} networkName - Network name
 * @returns {Object} Contract configuration with address and ABI
 */
export function getContractConfig(networkName) {
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
 * @param {string} networkName - Network name
 * @returns {boolean} True if contract address is configured
 */
export function isContractDeployed(networkName) {
  const address = getContractAddress(networkName);
  return isValidContractAddress(address);
}

/**
 * Get all configured contract addresses
 * @returns {Object} Object mapping network names to addresses
 */
export function getAllContractAddresses() {
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

