/**
 * useContract Hook (Wagmi-based)
 * 
 * Custom hook for contract interactions using wagmi.
 * Provides contract read/write operations with automatic caching.
 */

import { useReadContract, useWriteContract, useWatchContractEvent, useChainId } from 'wagmi';
import { getContractAddressForChain } from '../config/wagmi';
import { getContractABI } from '../config/contracts';
import logger from '../services/logging';
import { Address } from 'viem';

/**
 * Hook to get contract address for current chain
 */
export function useContractAddress(): string | null {
  const chainId = useChainId();
  return getContractAddressForChain(chainId);
}

/**
 * Hook to read contract data
 */
export function useReadContractData(
  functionName: string,
  args: any[] = [],
  options: { enabled?: boolean } = {}
) {
  const contractAddress = useContractAddress();
  const abi = getContractABI();

  return useReadContract({
    address: contractAddress as Address | undefined,
    abi,
    functionName,
    args,
    query: {
      enabled: !!contractAddress && options.enabled !== false,
      ...options,
    },
  });
}

/**
 * Hook to write to contract
 */
export function useWriteContractData() {
  const contractAddress = useContractAddress();
  const abi = getContractABI();
  const { writeContract, isPending, isSuccess, isError, error, data } = useWriteContract();

  const write = async (functionName: string, args: any[] = [], options: any = {}): Promise<void> => {
    if (!contractAddress) {
      throw new Error('Contract address not configured for current network');
    }

    try {
      logger.info('Writing to contract', { functionName, args });
      await writeContract({
        address: contractAddress as Address,
        abi,
        functionName,
        args,
        ...options,
      });
    } catch (err: any) {
      logger.error('Contract write failed', err);
      throw err;
    }
  };

  return {
    write,
    writeContract,
    isPending,
    isSuccess,
    isError,
    error,
    data,
  };
}

/**
 * Hook to watch contract events
 */
export function useWatchContractEvents(
  eventName: string,
  args: any = {},
  onLogs: (logs: any[]) => void
) {
  const contractAddress = useContractAddress();
  const abi = getContractABI();

  return useWatchContractEvent({
    address: contractAddress as Address | undefined,
    abi,
    eventName,
    args,
    onLogs,
    enabled: !!contractAddress,
  });
}

/**
 * Main useContract hook - provides contract instance and helper methods
 */
export function useContract() {
  const contractAddress = useContractAddress();
  const abi = getContractABI();
  const writeContract = useWriteContractData();

  // Helper to write to contract
  const sendTransaction = async (functionName: string, args: any[] = [], options: any = {}): Promise<void> => {
    return writeContract.write(functionName, args, options);
  };

  return {
    address: contractAddress,
    abi,
    writeContract,
    sendTransaction,
    isReady: !!contractAddress,
    loading: false,
    error: null,
  };
}

export default useContract;

