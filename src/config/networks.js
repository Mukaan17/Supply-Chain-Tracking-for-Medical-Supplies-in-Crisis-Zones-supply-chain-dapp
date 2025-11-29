/**
 * Network Configuration
 * 
 * Defines supported networks with metadata including chain IDs, RPC URLs,
 * block explorers, and native currency information.
 */

const networks = {
  sepolia: {
    name: 'Sepolia',
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    rpcUrls: [
      'https://sepolia.infura.io/v3/',
      'https://rpc.sepolia.org',
      'https://sepolia.gateway.tenderly.co',
    ],
    blockExplorers: [
      {
        name: 'Etherscan',
        url: 'https://sepolia.etherscan.io',
      },
    ],
    nativeCurrency: {
      name: 'SepoliaETH',
      symbol: 'SepoliaETH',
      decimals: 18,
    },
    testnet: true,
  },

  mainnet: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    chainIdHex: '0x1',
    rpcUrls: [
      'https://mainnet.infura.io/v3/',
      'https://eth.llamarpc.com',
      'https://rpc.ankr.com/eth',
    ],
    blockExplorers: [
      {
        name: 'Etherscan',
        url: 'https://etherscan.io',
      },
    ],
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    testnet: false,
  },

  polygon: {
    name: 'Polygon',
    chainId: 137,
    chainIdHex: '0x89',
    rpcUrls: [
      'https://polygon-rpc.com',
      'https://rpc-mainnet.maticvigil.com',
    ],
    blockExplorers: [
      {
        name: 'Polygonscan',
        url: 'https://polygonscan.com',
      },
    ],
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    testnet: false,
  },

  arbitrum: {
    name: 'Arbitrum One',
    chainId: 42161,
    chainIdHex: '0xa4b1',
    rpcUrls: [
      'https://arb1.arbitrum.io/rpc',
    ],
    blockExplorers: [
      {
        name: 'Arbiscan',
        url: 'https://arbiscan.io',
      },
    ],
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    testnet: false,
  },

  optimism: {
    name: 'Optimism',
    chainId: 10,
    chainIdHex: '0xa',
    rpcUrls: [
      'https://mainnet.optimism.io',
    ],
    blockExplorers: [
      {
        name: 'Optimistic Etherscan',
        url: 'https://optimistic.etherscan.io',
      },
    ],
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    testnet: false,
  },

  localhost: {
    name: 'Localhost',
    chainId: 31337,
    chainIdHex: '0x7a69',
    rpcUrls: [
      'http://localhost:8545',
    ],
    blockExplorers: [],
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    testnet: true,
  },
};

/**
 * Get network configuration by name
 * @param {string} networkName - Network name (e.g., 'sepolia', 'mainnet')
 * @returns {Object|null} Network configuration or null if not found
 */
export function getNetwork(networkName) {
  return networks[networkName.toLowerCase()] || null;
}

/**
 * Get network configuration by chain ID
 * @param {number|string} chainId - Chain ID (decimal or hex)
 * @returns {Object|null} Network configuration or null if not found
 */
export function getNetworkByChainId(chainId) {
  const chainIdNum = typeof chainId === 'string' 
    ? (chainId.startsWith('0x') ? parseInt(chainId, 16) : parseInt(chainId, 10))
    : chainId;

  return Object.values(networks).find(
    network => network.chainId === chainIdNum
  ) || null;
}

/**
 * Get all supported networks
 * @returns {Object} All network configurations
 */
export function getAllNetworks() {
  return networks;
}

/**
 * Get network names
 * @returns {string[]} Array of network names
 */
export function getNetworkNames() {
  return Object.keys(networks);
}

/**
 * Check if network is supported
 * @param {string} networkName - Network name to check
 * @returns {boolean} True if network is supported
 */
export function isNetworkSupported(networkName) {
  return networkName && networks[networkName.toLowerCase()] !== undefined;
}

/**
 * Get RPC URL for network (with fallback)
 * @param {string} networkName - Network name
 * @param {number} index - RPC URL index (default: 0)
 * @returns {string|null} RPC URL or null if not found
 */
export function getRpcUrl(networkName, index = 0) {
  const network = getNetwork(networkName);
  if (!network || !network.rpcUrls || network.rpcUrls.length === 0) {
    return null;
  }
  return network.rpcUrls[index] || network.rpcUrls[0];
}

/**
 * Get block explorer URL for network
 * @param {string} networkName - Network name
 * @param {string} type - Type of URL (tx, address, block)
 * @param {string} value - Transaction hash, address, or block number
 * @returns {string|null} Block explorer URL or null
 */
export function getBlockExplorerUrl(networkName, type, value) {
  const network = getNetwork(networkName);
  if (!network || !network.blockExplorers || network.blockExplorers.length === 0) {
    return null;
  }

  const explorer = network.blockExplorers[0];
  const baseUrl = explorer.url;

  switch (type) {
    case 'tx':
      return `${baseUrl}/tx/${value}`;
    case 'address':
      return `${baseUrl}/address/${value}`;
    case 'block':
      return `${baseUrl}/block/${value}`;
    default:
      return baseUrl;
  }
}

/**
 * Validate network configuration
 * @param {string} networkName - Network name to validate
 * @returns {Object} Validation result with isValid and errors
 */
export function validateNetwork(networkName) {
  const network = getNetwork(networkName);
  const errors = [];

  if (!network) {
    errors.push(`Network "${networkName}" is not supported`);
    return { isValid: false, errors };
  }

  if (!network.chainId) {
    errors.push('Chain ID is missing');
  }

  if (!network.rpcUrls || network.rpcUrls.length === 0) {
    errors.push('RPC URLs are missing');
  }

  if (!network.nativeCurrency) {
    errors.push('Native currency configuration is missing');
  }

  return {
    isValid: errors.length === 0,
    errors,
    network,
  };
}

/**
 * Get network metadata for MetaMask
 * @param {string} networkName - Network name
 * @returns {Object|null} MetaMask network configuration
 */
export function getMetaMaskNetworkConfig(networkName) {
  const network = getNetwork(networkName);
  if (!network) return null;

  return {
    chainId: network.chainIdHex,
    chainName: network.name,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: network.rpcUrls,
    blockExplorerUrls: network.blockExplorers.map(explorer => explorer.url),
  };
}

export default networks;

