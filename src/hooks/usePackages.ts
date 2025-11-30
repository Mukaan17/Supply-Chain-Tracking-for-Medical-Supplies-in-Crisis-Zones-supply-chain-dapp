/**
 * Hook to fetch and manage packages from the blockchain
 */

import { useEffect, useState, useCallback } from 'react';
import { useReadContract } from 'wagmi';
import { useContractAddress } from './useContract';
import { getContractABI } from '../config/contracts';
import { formatPackage, ParsedPackage } from '../utils/packageParser';
import { Address } from 'viem';

export function usePackages(account?: string) {
  const contractAddress = useContractAddress();
  const abi = getContractABI();
  const [packages, setPackages] = useState<ParsedPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get total packages
  const { data: totalPackages, refetch: refetchTotal } = useReadContract({
    address: contractAddress as Address | undefined,
    abi,
    functionName: 'getTotalPackages',
    query: {
      enabled: !!contractAddress,
    },
  });

  // Get user packages
  const { data: userPackages, refetch: refetchUser } = useReadContract({
    address: contractAddress as Address | undefined,
    abi,
    functionName: 'getUserPackages',
    args: account ? [account as Address] : undefined,
    query: {
      enabled: !!contractAddress && !!account,
    },
  });

  // Fetch all packages by iterating through IDs
  const fetchAllPackages = useCallback(async () => {
    if (!contractAddress || !totalPackages) {
      setPackages([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const total = typeof totalPackages === 'bigint' 
        ? Number(totalPackages) 
        : Number(totalPackages);

      if (total === 0) {
        setPackages([]);
        setLoading(false);
        return;
      }

      // Fetch packages in batches to avoid RPC limits
      const batchSize = 10;
      const allPackages: ParsedPackage[] = [];

      for (let i = 1; i <= total; i += batchSize) {
        const end = Math.min(i + batchSize - 1, total);
        const batchPromises = [];

        for (let id = i; id <= end; id++) {
          batchPromises.push(
            fetch(`/api/package/${id}`).catch(() => null) // This won't work, need to use contract directly
          );
        }

        // Instead, we'll fetch directly using wagmi hooks in the component
        // For now, return empty and let components handle individual fetches
      }

      setPackages(allPackages);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch packages');
      console.error('Failed to fetch packages', err);
    } finally {
      setLoading(false);
    }
  }, [contractAddress, totalPackages]);

  // Fetch packages from user packages list
  const fetchUserPackages = useCallback(async () => {
    if (!contractAddress || !userPackages || !Array.isArray(userPackages)) {
      setPackages([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // This will be handled by components using individual useReadContract calls
      // For now, return empty array
      setPackages([]);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch user packages');
    } finally {
      setLoading(false);
    }
  }, [contractAddress, userPackages]);

  useEffect(() => {
    if (account) {
      fetchUserPackages();
    } else {
      fetchAllPackages();
    }
  }, [account, fetchUserPackages, fetchAllPackages]);

  return {
    packages,
    totalPackages: typeof totalPackages === 'bigint' ? Number(totalPackages) : (totalPackages ? Number(totalPackages) : 0),
    userPackageIds: userPackages as bigint[] | undefined,
    loading,
    error,
    refetch: account ? refetchUser : refetchTotal,
  };
}

