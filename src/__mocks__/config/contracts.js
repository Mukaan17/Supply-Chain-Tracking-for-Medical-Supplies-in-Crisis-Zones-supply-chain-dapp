/**
 * Contracts Config Mock
 */

export function getContractConfig(networkName) {
  return {
    address: '0x0000000000000000000000000000000000000000',
    abi: [],
  };
}

export function getContractAddress(networkName) {
  return '0x0000000000000000000000000000000000000000';
}

export default {
  getContractConfig,
  getContractAddress,
};


