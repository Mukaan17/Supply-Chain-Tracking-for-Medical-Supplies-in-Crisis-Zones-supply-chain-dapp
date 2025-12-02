/**
 * Component to fetch individual package details using wagmi hooks
 */

import { useEffect, useState } from 'react';
import { usePublicClient } from 'wagmi';
import { useContractAddress } from '../hooks/useContract';
import { getContractABI } from '../config/contracts';
import { formatPackage, ParsedPackage } from '../utils/packageParser';
import { Address } from 'viem';
import logger from '../services/logging';

interface PackageDetailsFetcherProps {
  packageId: bigint | string | number;
  onData: (data: ParsedPackage | null) => void;
}

export function PackageDetailsFetcher({ packageId, onData }: PackageDetailsFetcherProps) {
  const contractAddress = useContractAddress();
  const abi = getContractABI();
  const publicClient = usePublicClient();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const pkgIdBigInt = typeof packageId === 'bigint' 
    ? packageId 
    : typeof packageId === 'string' 
      ? BigInt(packageId) 
      : BigInt(packageId);

  // Use direct readContract call instead of useReadContract hook
  // This avoids viem's tuple decoding issues with complex return types
  useEffect(() => {
    if (!publicClient || !contractAddress || !packageId) {
      setIsLoading(false);
      return;
    }

    let isCancelled = false;

    const fetchPackage = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        logger.debug('PackageDetailsFetcher: Fetching package', {
          packageId: pkgIdBigInt.toString(),
          contractAddress,
        });

        const result = await publicClient.readContract({
          address: contractAddress as Address,
    abi,
    functionName: 'getPackageDetails',
    args: [pkgIdBigInt],
        });
        
        if (isCancelled) return;

        if (result && Array.isArray(result) && result.length >= 17) {
          // getPackageDetails returns all 17 values:
          // id, description, creator, currentOwner, status, createdAt, lastUpdatedAt, 
          // temperature, location, humidity, shockDetected, expiryDate, batchNumber, 
          // certification, alertLevel, verified, verifier
      const [
        id, 
        description, 
        creator, 
        currentOwner, 
        status, 
        createdAt, 
        lastUpdatedAt,
        temperature,
            location,
            humidity,
            shockDetected,
            expiryDate,
            batchNumber,
            certification,
            alertLevel,
            verified,
            verifier
          ] = result;
          
          logger.debug('PackageDetailsFetcher: Package data received', {
            packageId: pkgIdBigInt.toString(),
            id: id?.toString(),
            description,
            hasData: true,
          });
          
      const formatted = formatPackage(
        id,
        description,
        creator,
        currentOwner,
        status,
        createdAt,
        lastUpdatedAt,
            temperature,
      );
      onData(formatted);
        } else {
          logger.debug('PackageDetailsFetcher: Invalid package data format', {
            packageId: pkgIdBigInt.toString(),
            resultLength: result?.length || 0,
          });
      onData(null);
    }
      } catch (err: any) {
        if (isCancelled) return;
        
        const errorMessage = err?.message || String(err);
        logger.warn('PackageDetailsFetcher: Error fetching package', {
          packageId: pkgIdBigInt.toString(),
          error: errorMessage,
          contractAddress,
        });
        setError(err);
        onData(null);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchPackage();

    return () => {
      isCancelled = true;
    };
  }, [publicClient, contractAddress, pkgIdBigInt, abi, onData]);

  return null;
}

