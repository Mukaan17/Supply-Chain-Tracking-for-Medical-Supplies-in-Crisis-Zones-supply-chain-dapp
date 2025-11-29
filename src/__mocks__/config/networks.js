/**
 * Networks Config Mock
 */

export function getNetwork(networkName) {
  return {
    name: networkName || 'Sepolia',
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    rpcUrls: ['https://sepolia.infura.io/v3/'],
    blockExplorers: [{ name: 'Etherscan', url: 'https://sepolia.etherscan.io' }],
    nativeCurrency: { name: 'SepoliaETH', symbol: 'SepoliaETH', decimals: 18 },
    testnet: true,
  };
}

export function getNetworkByChainId(chainId) {
  return getNetwork('Sepolia');
}

export function getMetaMaskNetworkConfig(networkName) {
  const network = getNetwork(networkName);
  return {
    chainId: network.chainIdHex,
    chainName: network.name,
    nativeCurrency: network.nativeCurrency,
    rpcUrls: network.rpcUrls,
    blockExplorerUrls: network.blockExplorers.map(e => e.url),
  };
}

export function getBlockExplorerUrl(network, type, value) {
  return `https://sepolia.etherscan.io/${type}/${value}`;
}

export default {
  getNetwork,
  getNetworkByChainId,
  getMetaMaskNetworkConfig,
  getBlockExplorerUrl,
};


