/**
 * Component to fetch individual package details using wagmi hooks
 */

import React, { useEffect } from 'react';
import { useReadContract } from 'wagmi';
import { useContractAddress } from '../hooks/useContract';
import { getContractABI } from '../config/contracts';
import { formatPackage, ParsedPackage } from '../utils/packageParser';
import { Address } from 'viem';

interface PackageDetailsFetcherProps {
  packageId: bigint | string | number;
  onData: (data: ParsedPackage | null) => void;
}

export function PackageDetailsFetcher({ packageId, onData }: PackageDetailsFetcherProps) {
  const contractAddress = useContractAddress();
  const abi = getContractABI();
  
  const pkgIdBigInt = typeof packageId === 'bigint' 
    ? packageId 
    : typeof packageId === 'string' 
      ? BigInt(packageId) 
      : BigInt(packageId);

  const { data: packageData, isLoading, error } = useReadContract({
    address: contractAddress as Address | undefined,
    abi,
    functionName: 'getPackageDetails',
    args: [pkgIdBigInt],
    query: {
      enabled: !!contractAddress && !!packageId,
    },
  });

  useEffect(() => {
    if (packageData && Array.isArray(packageData) && packageData.length >= 7) {
      // getPackageDetails returns: id, description, creator, currentOwner, status, createdAt, lastUpdatedAt, temperature, location, humidity, shockDetected, expiryDate, batchNumber, certification, alertLevel, verified, verifier
      const [
        id, 
        description, 
        creator, 
        currentOwner, 
        status, 
        createdAt, 
        lastUpdatedAt,
        temperature,
        // ... other fields (location, humidity, etc.) - not needed for now
      ] = packageData;
      const formatted = formatPackage(
        id,
        description,
        creator,
        currentOwner,
        status,
        createdAt,
        lastUpdatedAt,
        temperature, // Pass temperature from blockchain
      );
      onData(formatted);
    } else if (error || (!isLoading && !packageData)) {
      onData(null);
    }
  }, [packageData, isLoading, error, onData]);

  return null;
}

