/**
 * Component to fetch all packages from blockchain using events
 * This avoids the tuple decoding issue with getPackageDetails
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useReadContract, useWatchContractEvent, usePublicClient } from 'wagmi';
import { useContractAddress } from '../hooks/useContract';
import { getContractABI } from '../config/contracts';
import { ParsedPackage, formatPackageFromEvents } from '../utils/packageParser';
import { Address, parseEventLogs, parseAbiItem } from 'viem';
import logger from '../services/logging';
import cacheService from '../utils/cache';

interface PackagesFetcherProps {
  account?: string;
  onPackagesLoaded: (packages: ParsedPackage[]) => void;
}

export function PackagesFetcher({ onPackagesLoaded }: PackagesFetcherProps) {
  const contractAddress = useContractAddress();
  const abi = getContractABI();
  const publicClient = usePublicClient();
  const [packages, setPackages] = useState<Map<string, ParsedPackage>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const lastPackagesRef = useRef<string>('');
  const lastFetchTimeRef = useRef<number>(0);
  const fetchDebounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Get total packages for monitoring (optional, used for logging)
  // Removed refetchInterval to reduce rate limiting - rely on event watcher instead
  const { data: totalPackages, error: totalPackagesError } = useReadContract({
    address: contractAddress as Address | undefined,
    abi,
    functionName: 'getTotalPackages',
    query: {
      enabled: !!contractAddress,
      // No automatic refetch - rely on event watcher and manual refresh
    },
  });

  // Watch for PackageCreated events to trigger refetch (with debouncing)
  useWatchContractEvent({
    address: contractAddress as Address | undefined,
    abi,
    eventName: 'PackageCreated',
    onLogs(logs) {
      if (logs && logs.length > 0) {
        logger.info('PackageCreated event detected, scheduling refetch', { 
          eventCount: logs.length,
        });
        
        // Debounce: clear any existing timer
        if (fetchDebounceTimerRef.current) {
          clearTimeout(fetchDebounceTimerRef.current);
        }
        
        // Schedule refetch after 3 seconds (debounce multiple events, reduced from 5s)
        fetchDebounceTimerRef.current = setTimeout(() => {
          const now = Date.now();
          // Only fetch if at least 5 seconds have passed since last fetch (reduced from 10s)
          if (now - lastFetchTimeRef.current > 5000) {
            logger.info('Debounced refetch triggered');
            fetchPackagesFromEvents();
          } else {
            logger.debug('Skipping refetch - too soon since last fetch', {
              timeSinceLastFetch: now - lastFetchTimeRef.current,
            });
          }
        }, 3000);
      }
    },
  });

  // Cache keys
  const CACHE_KEYS = {
    LAST_BLOCK: `lastFetchedBlock_${contractAddress}`,
    CREATED_EVENTS: `createdEvents_${contractAddress}`,
    STATUS_EVENTS: `statusEvents_${contractAddress}`,
    PACKAGES: `packages_${contractAddress}`,
  };

  // Helper to clear cache (useful for debugging)
  const clearPackageCache = async () => {
    await cacheService.delete(CACHE_KEYS.LAST_BLOCK, 'packages');
    await cacheService.delete(CACHE_KEYS.CREATED_EVENTS, 'packages');
    await cacheService.delete(CACHE_KEYS.STATUS_EVENTS, 'packages');
    await cacheService.delete(CACHE_KEYS.PACKAGES, 'packages');
    logger.info('Package cache cleared');
  };

  // Expose clear cache function to window for debugging (dev only)
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    (window as any).clearPackageCache = clearPackageCache;
  }

  // Get deployment block from env or use known deployment block as fallback
  const getDeploymentBlock = (): bigint => {
    const deploymentBlock = process.env.REACT_APP_DEPLOYMENT_BLOCK;
    if (deploymentBlock) {
      return BigInt(deploymentBlock);
    }
    // Known deployment block for Sepolia contract 0x971EC5685f0FE4f5fC8F868586BCADC5Ec30819e
    // First transaction was at block 9734643
    return 9734643n;
  };

  // Fetch logs in chunks to avoid RPC block range limits
  // thirdweb RPC has a 1000 block limit, so we use 999 for safety margin
  const fetchLogsChunked = async (
    eventDef: any,
    fromBlock: bigint,
    toBlock: bigint,
    chunkSize: bigint = 999n, // thirdweb limit is 1000 blocks, using 999 for safety
    requestDelay: number = 200, // Reduced to 200ms - was 500ms, now that it's working we can be faster
    onChunkFetched?: (logs: any[]) => void // Callback for progressive loading
  ): Promise<any[]> => {
    const allLogs: any[] = [];
    let currentFrom = fromBlock;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    
    while (currentFrom <= toBlock) {
      const currentTo = currentFrom + chunkSize > toBlock 
        ? toBlock 
        : currentFrom + chunkSize;
      
      try {
        logger.debug('Fetching events chunk', {
          fromBlock: currentFrom.toString(),
          toBlock: currentTo.toString(),
          chunkSize: (currentTo - currentFrom + 1n).toString(),
        });
        
        // Fetch logs with the event definition
        const chunkLogs = await publicClient!.getLogs({
          address: contractAddress as Address,
          event: eventDef as any,
          fromBlock: currentFrom,
          toBlock: currentTo,
        });
        
        allLogs.push(...chunkLogs);
        consecutiveErrors = 0; // Reset error counter on success
        
        // Call callback for progressive loading if provided
        if (onChunkFetched && chunkLogs.length > 0) {
          onChunkFetched(chunkLogs);
        }
        
        // More detailed logging to debug why no events are found
        if (chunkLogs.length > 0) {
          logger.info('Chunk fetched with events!', { 
            chunkLogsCount: chunkLogs.length,
            totalLogsCount: allLogs.length,
            fromBlock: currentFrom.toString(),
            toBlock: currentTo.toString(),
            sampleLog: chunkLogs[0] ? {
              blockNumber: chunkLogs[0].blockNumber?.toString(),
              transactionHash: chunkLogs[0].transactionHash,
            } : null,
          });
        } else {
          logger.debug('Chunk fetched (no events)', { 
            chunkLogsCount: 0,
            totalLogsCount: allLogs.length,
            fromBlock: currentFrom.toString(),
            toBlock: currentTo.toString(),
            contractAddress,
          });
        }
        
        // Move to next chunk
        currentFrom = currentTo + 1n;
        
        // Delay between requests to avoid rate limiting
        if (currentFrom <= toBlock) {
          await new Promise(resolve => setTimeout(resolve, requestDelay));
        }
      } catch (err: any) {
        consecutiveErrors++;
        const errorMessage = err?.message || String(err);
        const isRateLimit = errorMessage.includes('429') || 
                           errorMessage.includes('Too Many Requests') ||
                           errorMessage.includes('rate limit') ||
                           errorMessage.includes('CORS');
        
        logger.warn('Error fetching event chunk', {
          fromBlock: currentFrom.toString(),
          toBlock: currentTo.toString(),
          error: errorMessage,
          isRateLimit,
          consecutiveErrors,
        });
        
        // If rate limited, wait longer before retrying
        if (isRateLimit) {
          const backoffDelay = Math.min(5000 * consecutiveErrors, 30000); // Exponential backoff, max 30s
          logger.info('Rate limited, backing off', { backoffDelay });
          await new Promise(resolve => setTimeout(resolve, backoffDelay));
        }
        
        // If too many consecutive errors, stop fetching
        if (consecutiveErrors >= maxConsecutiveErrors) {
          logger.error('Too many consecutive errors, stopping fetch', err, {
            consecutiveErrors,
            lastError: errorMessage,
          });
          break;
        }
        
        // Continue with next chunk even if one fails
        currentFrom = currentTo + 1n;
        // Add delay even on error to avoid hammering RPC
        if (currentFrom <= toBlock) {
          await new Promise(resolve => setTimeout(resolve, requestDelay * 2)); // Longer delay on error
        }
      }
    }
    
    return allLogs;
  };

  // Fetch packages from events with caching
  const fetchPackagesFromEvents = useCallback(async () => {
    if (!publicClient || !contractAddress) {
      logger.debug('Cannot fetch packages: missing publicClient or contractAddress', {
        hasPublicClient: !!publicClient,
        contractAddress,
      });
      setIsLoading(false);
      return;
    }

    // Check if we're fetching too frequently (reduced for better responsiveness)
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    const minFetchInterval = 5000; // Reduced to 5 seconds (was 15) for better responsiveness
    
    if (timeSinceLastFetch < minFetchInterval && lastFetchTimeRef.current > 0) {
      logger.debug('Skipping fetch - rate limit protection', {
        timeSinceLastFetch,
        minInterval: minFetchInterval,
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    lastFetchTimeRef.current = now;
    
    try {
      logger.info('Fetching packages from events', { contractAddress });

      // Get current block number
      const currentBlock = await publicClient.getBlockNumber();
      logger.debug('Current block number', { currentBlock: currentBlock.toString() });

      // Get last fetched block from cache, or start from deployment block
      const lastFetchedBlock = await cacheService.get(CACHE_KEYS.LAST_BLOCK, 'packages') as number | null;
      const deploymentBlock = getDeploymentBlock();
      
      // If we have a cached last block, use it. Otherwise, try to find the actual deployment block
      // by testing a known block range where we know transactions exist (around 9754000)
      let startBlock = lastFetchedBlock !== null 
        ? BigInt(lastFetchedBlock) + 1n 
        : deploymentBlock;
      
      // Log deployment block info for debugging
      if (startBlock === deploymentBlock && lastFetchedBlock === null) {
        logger.info('Starting from deployment block', {
          deploymentBlock: deploymentBlock.toString(),
          contractAddress,
          note: 'This is the first transaction block for this contract',
        });
      }
      
      logger.info('Event fetch range', {
        startBlock: startBlock.toString(),
        currentBlock: currentBlock.toString(),
        deploymentBlock: deploymentBlock.toString(),
        lastFetchedBlock,
        isIncremental: lastFetchedBlock !== null,
        contractAddress,
      });


      // Find event definitions in ABI and parse them properly for viem
      const packageCreatedEventAbi = abi.find(
        (item: any) => item.type === 'event' && item.name === 'PackageCreated'
      );
      const packageStatusUpdatedEventAbi = abi.find(
        (item: any) => item.type === 'event' && item.name === 'PackageStatusUpdated'
      );

      if (!packageCreatedEventAbi || !packageStatusUpdatedEventAbi) {
        logger.error('Event definitions not found in ABI', null, {
          hasPackageCreated: !!packageCreatedEventAbi,
          hasPackageStatusUpdated: !!packageStatusUpdatedEventAbi,
        });
        setPackages(new Map());
        return;
      }

      // Use the ABI items directly - viem should handle them
      const packageCreatedEvent = packageCreatedEventAbi;
      const packageStatusUpdatedEvent = packageStatusUpdatedEventAbi;
      
      logger.info('Event definitions found', {
        packageCreated: {
          name: packageCreatedEventAbi.name,
          inputs: packageCreatedEventAbi.inputs?.length,
          inputsDetail: packageCreatedEventAbi.inputs?.map((i: any) => ({
            name: i.name,
            type: i.type,
            indexed: i.indexed,
          })),
        },
        packageStatusUpdated: {
          name: packageStatusUpdatedEventAbi.name,
          inputs: packageStatusUpdatedEventAbi.inputs?.length,
        },
        contractAddress,
      });

      // Load cached raw logs if this is a full refresh (startBlock === deploymentBlock)
      let cachedCreatedLogs: any[] = [];
      let cachedStatusLogs: any[] = [];
      
      if (startBlock === deploymentBlock) {
        const cachedCreated = await cacheService.get(CACHE_KEYS.CREATED_EVENTS, 'packages') as any[] | null;
        const cachedStatus = await cacheService.get(CACHE_KEYS.STATUS_EVENTS, 'packages') as any[] | null;
        
        if (cachedCreated && cachedStatus && cachedCreated.length > 0) {
          logger.info('Loading cached events', {
            createdCount: cachedCreated.length,
            statusCount: cachedStatus.length,
          });
          cachedCreatedLogs = cachedCreated;
          cachedStatusLogs = cachedStatus;
          
          // Immediately parse and display cached packages for instant UI update
          try {
            const cachedCreatedEvents = parseEventLogs({
              abi: abi as any,
              eventName: 'PackageCreated',
              logs: cachedCreatedLogs,
              strict: false,
            }) as any[];
            
            const cachedStatusEvents = parseEventLogs({
              abi: abi as any,
              eventName: 'PackageStatusUpdated',
              logs: cachedStatusLogs,
              strict: false,
            }) as any[];
            
            // Build status map
            const statusMap = new Map<bigint, { newStatus: bigint; timestamp: bigint }>();
            for (const event of cachedStatusEvents) {
              if (event.args && 'id' in event.args && 'newStatus' in event.args && 'timestamp' in event.args) {
                const id = event.args.id as bigint;
                const newStatus = event.args.newStatus as bigint;
                const timestamp = event.args.timestamp as bigint;
                const existing = statusMap.get(id);
                if (!existing || timestamp > existing.timestamp) {
                  statusMap.set(id, { newStatus, timestamp });
                }
              }
            }
            
            // Build packages from cached events
            const cachedPackagesMap = new Map<string, ParsedPackage>();
            for (const event of cachedCreatedEvents) {
              if (event.args && 'id' in event.args && 'description' in event.args && 'creator' in event.args && 'timestamp' in event.args) {
                const id = event.args.id as bigint;
                const description = event.args.description as string;
                const creator = event.args.creator as string;
                const timestamp = event.args.timestamp as bigint;
                const statusUpdate = statusMap.get(id);
                
                const parsedPackage = formatPackageFromEvents(
                  { id, description, creator, timestamp },
                  statusUpdate ? { newStatus: statusUpdate.newStatus, timestamp: statusUpdate.timestamp } : undefined
                );
                
                cachedPackagesMap.set(parsedPackage.id, parsedPackage);
              }
            }
            
            if (cachedPackagesMap.size > 0) {
              logger.info('Displaying cached packages immediately', { count: cachedPackagesMap.size });
              setPackages(cachedPackagesMap);
              // Don't set isLoading to false yet - we'll fetch new events in background
            }
          } catch (err: any) {
            logger.warn('Error parsing cached events', {
              error: err?.message || String(err),
            });
          }
        }
      }

      // Fetch new events only if there are new blocks
      let newCreatedLogs: any[] = [];
      let newStatusLogs: any[] = [];
      
      if (startBlock <= currentBlock) {
        // Fetch PackageCreated events in chunks (only new blocks)
        logger.info('Fetching new PackageCreated events in chunks', {
          fromBlock: startBlock.toString(),
          toBlock: currentBlock.toString(),
          chunkSize: '9999',
        });
        newCreatedLogs = await fetchLogsChunked(
          packageCreatedEvent,
          startBlock,
          currentBlock,
          999n, // 999 blocks per chunk (thirdweb's 1000 block limit, using 999 for safety)
          200   // Reduced to 200ms delay (was 500ms) - faster now that it's working
        );

        // Fetch PackageStatusUpdated events in chunks (only new blocks)
        logger.info('Fetching new PackageStatusUpdated events in chunks', {
          fromBlock: startBlock.toString(),
          toBlock: currentBlock.toString(),
          chunkSize: '999',
        });
        newStatusLogs = await fetchLogsChunked(
          packageStatusUpdatedEvent,
          startBlock,
          currentBlock,
          999n, // 999 blocks per chunk (thirdweb's 1000 block limit, using 999 for safety)
          200   // Reduced to 200ms delay (was 500ms) - faster now that it's working
        );
      }

      // Combine cached and new raw logs
      const allCreatedLogs = startBlock === deploymentBlock && cachedCreatedLogs.length > 0
        ? [...cachedCreatedLogs, ...newCreatedLogs]
        : newCreatedLogs.length > 0
        ? newCreatedLogs
        : cachedCreatedLogs;
      
      const allStatusLogs = startBlock === deploymentBlock && cachedStatusLogs.length > 0
        ? [...cachedStatusLogs, ...newStatusLogs]
        : newStatusLogs.length > 0
        ? newStatusLogs
        : cachedStatusLogs;

      logger.debug('Total events', {
        createdCount: allCreatedLogs.length,
        statusCount: allStatusLogs.length,
        newCreatedCount: newCreatedLogs.length,
        newStatusCount: newStatusLogs.length,
        cachedCreatedCount: cachedCreatedLogs.length,
        cachedStatusCount: cachedStatusLogs.length,
      });

      logger.info('Raw logs summary', {
        createdLogsCount: allCreatedLogs.length,
        statusLogsCount: allStatusLogs.length,
        cachedCreatedCount: cachedCreatedLogs.length,
        cachedStatusCount: cachedStatusLogs.length,
        newCreatedCount: newCreatedLogs.length,
        newStatusCount: newStatusLogs.length,
      });

      // Parse the logs to get decoded event data
      // Use the full ABI array, not just the event definition
      let createdEvents: any[] = [];
      let statusEvents: any[] = [];
      
      if (allCreatedLogs.length > 0) {
        try {
          // Use full ABI for parsing, with eventName filter for better matching
          createdEvents = parseEventLogs({
            abi: abi as any,
            eventName: 'PackageCreated',
            logs: allCreatedLogs,
            strict: false, // Allow partial decoding if needed
          }) as any[];
          logger.info('Parsed PackageCreated events', { 
            count: createdEvents.length,
            rawLogsCount: allCreatedLogs.length,
          });
          
        } catch (err: any) {
          logger.error('Error parsing PackageCreated events', err, {
            logsCount: allCreatedLogs.length,
            error: err?.message || String(err),
          });
        }
      }

      if (allStatusLogs.length > 0) {
        try {
          // Use full ABI for parsing, with eventName filter for better matching
          statusEvents = parseEventLogs({
            abi: abi as any,
            eventName: 'PackageStatusUpdated',
            logs: allStatusLogs,
            strict: false, // Allow partial decoding if needed
          }) as any[];
          logger.info('Parsed PackageStatusUpdated events', { 
            count: statusEvents.length,
            rawLogsCount: allStatusLogs.length,
          });
        } catch (err: any) {
          logger.error('Error parsing PackageStatusUpdated events', err, {
            logsCount: allStatusLogs.length,
            error: err?.message || String(err),
          });
        }
      }

      // Cache the raw logs (not parsed events) for future use
      if (startBlock === deploymentBlock) {
        // Full refresh - cache all raw logs
        await cacheService.set(CACHE_KEYS.CREATED_EVENTS, allCreatedLogs, {
          namespace: 'packages',
          ttl: 24 * 60 * 60 * 1000, // 24 hours
          persist: true,
        });
        await cacheService.set(CACHE_KEYS.STATUS_EVENTS, allStatusLogs, {
          namespace: 'packages',
          ttl: 24 * 60 * 60 * 1000, // 24 hours
          persist: true,
        });
      } else if (newCreatedLogs.length > 0 || newStatusLogs.length > 0) {
        // Incremental update - merge with cached raw logs
        const cachedCreated = await cacheService.get(CACHE_KEYS.CREATED_EVENTS, 'packages') as any[] | null;
        const cachedStatus = await cacheService.get(CACHE_KEYS.STATUS_EVENTS, 'packages') as any[] | null;
        
        const mergedCreated = [...(cachedCreated || []), ...newCreatedLogs];
        const mergedStatus = [...(cachedStatus || []), ...newStatusLogs];
        
        await cacheService.set(CACHE_KEYS.CREATED_EVENTS, mergedCreated, {
          namespace: 'packages',
          ttl: 24 * 60 * 60 * 1000,
          persist: true,
        });
        await cacheService.set(CACHE_KEYS.STATUS_EVENTS, mergedStatus, {
          namespace: 'packages',
          ttl: 24 * 60 * 60 * 1000,
          persist: true,
        });
      }

      // Update last fetched block in cache
      await cacheService.set(CACHE_KEYS.LAST_BLOCK, Number(currentBlock), {
        namespace: 'packages',
        ttl: 24 * 60 * 60 * 1000,
        persist: true,
      });

      // Build a map of packageId -> latest status update
      const statusMap = new Map<bigint, { newStatus: bigint; timestamp: bigint }>();
      for (const event of statusEvents) {
        if (event.args && 'id' in event.args && 'newStatus' in event.args && 'timestamp' in event.args) {
          const id = event.args.id as bigint;
          const newStatus = event.args.newStatus as bigint;
          const timestamp = event.args.timestamp as bigint;
          
          // Keep only the latest status update for each package
          const existing = statusMap.get(id);
          if (!existing || timestamp > existing.timestamp) {
            statusMap.set(id, { newStatus, timestamp });
          }
        }
      }

      // Build packages from created events
      const packagesMap = new Map<string, ParsedPackage>();
      for (const event of createdEvents) {
        if (event.args && 'id' in event.args && 'description' in event.args && 'creator' in event.args && 'timestamp' in event.args) {
          const id = event.args.id as bigint;
          const description = event.args.description as string;
          const creator = event.args.creator as string;
          const timestamp = event.args.timestamp as bigint;

          // Get latest status update for this package
          const statusUpdate = statusMap.get(id);
          
          const parsedPackage = formatPackageFromEvents(
            { id, description, creator, timestamp },
            statusUpdate ? { newStatus: statusUpdate.newStatus, timestamp: statusUpdate.timestamp } : undefined
          );

          packagesMap.set(parsedPackage.id, parsedPackage);
        }
      }

      logger.info('Packages built from events', { 
        count: packagesMap.size,
        createdEventsCount: createdEvents.length,
        statusEventsCount: statusEvents.length,
      });
      
      // If no packages found and we searched a large range, log a warning
      if (packagesMap.size === 0 && (currentBlock - startBlock) > 10000n) {
        logger.warn('No packages found after searching large block range', {
          startBlock: startBlock.toString(),
          currentBlock: currentBlock.toString(),
          blocksSearched: (currentBlock - startBlock).toString(),
          contractAddress,
          suggestion: 'Check if contract address is correct or if deployment block is set properly',
        });
      }
      
      // Update packages state - this will trigger the useEffect to notify parent
      setPackages(packagesMap);
    } catch (err: any) {
      const errorMessage = err?.message || String(err);
      logger.error('Error fetching packages from events', err, {
        contractAddress,
        error: errorMessage,
      });
      // Set empty packages on error
      setPackages(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [publicClient, contractAddress, abi]);

  // Fetch packages when contract address or public client changes
  useEffect(() => {
    fetchPackagesFromEvents();
    
    // Cleanup debounce timer on unmount
    return () => {
      if (fetchDebounceTimerRef.current) {
        clearTimeout(fetchDebounceTimerRef.current);
      }
    };
  }, [fetchPackagesFromEvents]);

  // Debug logging
  useEffect(() => {
    logger.debug('PackagesFetcher state', {
      contractAddress,
      totalPackages: totalPackages ? (typeof totalPackages === 'bigint' ? Number(totalPackages) : Number(totalPackages)) : null,
      totalPackagesError: totalPackagesError?.message,
      packagesCount: packages.size,
      isLoading,
    });
  }, [contractAddress, totalPackages, totalPackagesError, packages.size, isLoading]);

  // Notify parent when packages change
  useEffect(() => {
    const packagesArray = Array.from(packages.values());
    
    logger.debug('Packages changed', { 
      packagesCount: packagesArray.length, 
      packageIds: packagesArray.map(p => p.id),
      lastKey: lastPackagesRef.current,
      isLoading,
    });
    
    // Progressive loading: notify parent even while loading so packages appear as they're found
    // Only skip if we have no packages and are still loading (initial state)
    if (isLoading && packagesArray.length === 0) {
      logger.debug('Still loading packages, no packages yet, skipping notification');
      return;
    }
    
    // Create a stable string representation to compare
    const packagesKey = packagesArray.map(p => `${p.id}:${p.status}`).sort().join('|');
    
    // Only call onPackagesLoaded if packages actually changed
    // Always call on initial load (when ref is empty) or when packages change
    if (lastPackagesRef.current === '' || packagesKey !== lastPackagesRef.current) {
      logger.info('Notifying parent of packages', { 
        count: packagesArray.length, 
        packagesKey,
        isLoading,
        note: isLoading ? 'Progressive update while loading' : 'Final update',
      });
      lastPackagesRef.current = packagesKey;
      onPackagesLoaded(packagesArray);
    } else {
      logger.debug('Packages unchanged, skipping notification', { packagesKey });
    }
  }, [packages, onPackagesLoaded, isLoading]);

  // Component doesn't render anything, it just fetches and notifies parent
  return null;
}

