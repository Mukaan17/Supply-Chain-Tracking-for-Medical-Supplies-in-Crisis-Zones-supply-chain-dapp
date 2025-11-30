/**
 * Network Configuration
 * 
 * Defines supported networks with metadata including chain IDs, RPC URLs,
 * block explorers, and native currency information.
 */

export interface Network {
  name: string;
  chainId: number;
  chainIdHex: string;
  rpcUrls: string[];
  blockExplorers: Array<{
    name: string;
    url: string;
  }>;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  testnet: boolean;
}

export interface Networks {
  [key: string]: Network;
}

const networks: Networks = {
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
 */
export function getNetwork(networkName: string): Network | null {
  return networks[networkName.toLowerCase()] || null;
}

/**
 * Get network configuration by chain ID
 */
export function getNetworkByChainId(chainId: number | string): Network | null {
  const chainIdNum = typeof chainId === 'string' 
    ? (chainId.startsWith('0x') ? parseInt(chainId, 16) : parseInt(chainId, 10))
    : chainId;

  return Object.values(networks).find(
    network => network.chainId === chainIdNum
  ) || null;
}

/**
 * Get all supported networks
 */
export function getAllNetworks(): Networks {
  return networks;
}

/**
 * Get network names
 */
export function getNetworkNames(): string[] {
  return Object.keys(networks);
}

/**
 * Check if network is supported
 */
export function isNetworkSupported(networkName: string): boolean {
  return networkName !== undefined && networks[networkName.toLowerCase()] !== undefined;
}

/**
 * Get RPC URL for network (with fallback)
 */
export function getRpcUrl(networkName: string, index: number = 0): string | null {
  const network = getNetwork(networkName);
  if (!network || !network.rpcUrls || network.rpcUrls.length === 0) {
    return null;
  }
  return network.rpcUrls[index] || network.rpcUrls[0];
}

/**
 * Get block explorer URL for network
 */
export function getBlockExplorerUrl(networkName: string, type: 'tx' | 'address' | 'block', value: string): string | null {
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
 */
export function validateNetwork(networkName: string): {
  isValid: boolean;
  errors: string[];
  network?: Network;
} {
  const network = getNetwork(networkName);
  const errors: string[] = [];

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
 */
export function getMetaMaskNetworkConfig(networkName: string): {
  chainId: string;
  chainName: string;
  nativeCurrency: Network['nativeCurrency'];
  rpcUrls: string[];
  blockExplorerUrls: string[];
} | null {
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

