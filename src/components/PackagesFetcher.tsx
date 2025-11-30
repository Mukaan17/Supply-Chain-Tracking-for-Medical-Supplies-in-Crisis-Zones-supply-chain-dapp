/**
 * Component to fetch all packages from blockchain
 */

import React, { useEffect, useState } from 'react';
import { useReadContract } from 'wagmi';
import { useContractAddress } from '../hooks/useContract';
import { getContractABI } from '../config/contracts';
import { formatPackage, ParsedPackage } from '../utils/packageParser';
import { Address } from 'viem';
import { PackageDetailsFetcher } from './PackageDetailsFetcher';

interface PackagesFetcherProps {
  account?: string;
  onPackagesLoaded: (packages: ParsedPackage[]) => void;
}

export function PackagesFetcher({ account, onPackagesLoaded }: PackagesFetcherProps) {
  const contractAddress = useContractAddress();
  const abi = getContractABI();
  const [packageIds, setPackageIds] = useState<bigint[]>([]);
  const [packages, setPackages] = useState<Map<string, ParsedPackage>>(new Map());

  // Get total packages
  const { data: totalPackages } = useReadContract({
    address: contractAddress as Address | undefined,
    abi,
    functionName: 'getTotalPackages',
    query: {
      enabled: !!contractAddress,
    },
  });

  // Get user packages if account is provided
  const { data: userPackages } = useReadContract({
    address: contractAddress as Address | undefined,
    abi,
    functionName: 'getUserPackages',
    args: account ? [account as Address] : undefined,
    query: {
      enabled: !!contractAddress && !!account,
    },
  });

  // Set package IDs to fetch
  useEffect(() => {
    if (account && userPackages && Array.isArray(userPackages)) {
      setPackageIds(userPackages as bigint[]);
    } else if (!account && totalPackages) {
      const total = typeof totalPackages === 'bigint' ? Number(totalPackages) : Number(totalPackages);
      // Fetch all packages (limit to first 50 for performance)
      const ids: bigint[] = [];
      for (let i = 1; i <= Math.min(total, 50); i++) {
        ids.push(BigInt(i));
      }
      setPackageIds(ids);
    }
  }, [account, userPackages, totalPackages]);

  // Handle individual package data
  const handlePackageData = (packageId: bigint, data: ParsedPackage | null) => {
    if (data) {
      // Use the formatted ID from the parsed package
      setPackages(prev => {
        const next = new Map(prev);
        next.set(data.id, data);
        return next;
      });
    }
  };

  // Notify parent when packages change
  useEffect(() => {
    const packagesArray = Array.from(packages.values());
    onPackagesLoaded(packagesArray);
  }, [packages, onPackagesLoaded]);

  return (
    <>
      {packageIds.map((id) => (
        <PackageDetailsFetcher
          key={id.toString()}
          packageId={id}
          onData={(data) => handlePackageData(id, data)}
        />
      ))}
    </>
  );
}

