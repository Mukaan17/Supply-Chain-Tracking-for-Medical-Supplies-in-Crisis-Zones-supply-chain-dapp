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
  const lastContractAddressRef = useRef<string | null>(null);
  
  // Memoize onPackagesLoaded to prevent infinite loops
  // This ensures the callback reference is stable even if the parent component re-renders
  const stableOnPackagesLoaded = useCallback((packagesArray: ParsedPackage[]) => {
    onPackagesLoaded(packagesArray);
  }, [onPackagesLoaded]);
  
  // Debounce timer for notifying parent to prevent rapid-fire updates
  const notifyParentTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isNotifyingRef = useRef(false); // Guard to prevent concurrent notifications

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

  // Watch for PackageCreated events to immediately add new packages
  useWatchContractEvent({
    address: contractAddress as Address | undefined,
    abi,
    eventName: 'PackageCreated',
    onLogs(logs) {
      if (logs && logs.length > 0) {
        logger.info('PackageCreated event detected, processing immediately', { 
          eventCount: logs.length,
        });
        
        // Parse and add new packages immediately (no debounce for new packages)
        try {
          const createdEvents = parseEventLogs({
            abi: abi as any,
            eventName: 'PackageCreated',
            logs: logs as any[],
            strict: false,
          }) as any[];
          
          if (createdEvents.length > 0) {
            // Add new packages immediately to the map
            setPackages(prev => {
              const updated = new Map(prev);
              const newPackages: ParsedPackage[] = [];
              let addedCount = 0;
              
              for (const event of createdEvents) {
                if (event.args && 'id' in event.args && 'description' in event.args && 'creator' in event.args && 'timestamp' in event.args) {
                  const id = event.args.id as bigint;
                  const description = event.args.description as string;
                  const creator = event.args.creator as string;
                  const timestamp = event.args.timestamp as bigint;
                  
                  const parsedPackage = formatPackageFromEvents(
                    { id, description, creator, timestamp },
                    undefined, // No status update yet
                    undefined  // No temperature update yet
                  );
                  
                  // Only add if not already present
                  if (!updated.has(parsedPackage.id)) {
                    updated.set(parsedPackage.id, parsedPackage);
                    newPackages.push(parsedPackage);
                    addedCount++;
                    logger.info('Added new package from event', { 
                      packageId: parsedPackage.id,
                      description: parsedPackage.description,
                    });
                  }
                }
              }
              
              if (addedCount > 0) {
                logger.info('Immediately added new packages from PackageCreated events', { 
                  addedCount,
                  totalPackages: updated.size,
                });
                
                // Immediately notify parent of new packages (bypass debounce for real-time updates)
                // Merge with existing packages and notify immediately
                const allPackages = Array.from(updated.values());
                
                // Clear any pending debounced notification
                if (notifyParentTimerRef.current) {
                  clearTimeout(notifyParentTimerRef.current);
                  notifyParentTimerRef.current = null;
                }
                
                // Update the last packages ref to prevent duplicate notification
                const packagesKey = allPackages.map(p => `${p.id}:${p.status}`).sort().join('|');
                lastPackagesRef.current = packagesKey;
                
                // Set notification guard to prevent useEffect from also notifying
                isNotifyingRef.current = true;
                
                // Notify immediately (no debounce for new packages)
                setTimeout(() => {
                  try {
                    logger.info('Immediately notifying parent of new packages', { 
                      newCount: addedCount,
                      totalCount: allPackages.length,
                    });
                    stableOnPackagesLoaded(allPackages);
                  } catch (error: any) {
                    logger.error('Error immediately notifying parent of new packages', error, {
                      errorMessage: error?.message || String(error),
                    });
                  } finally {
                    // Clear notification guard after a short delay to allow useEffect to see the updated state
                    setTimeout(() => {
                      isNotifyingRef.current = false;
                    }, 100);
                  }
                }, 0); // Use setTimeout(0) to ensure state update completes first
              }
              
              return updated;
            });
          }
        } catch (err: any) {
          logger.warn('Error parsing PackageCreated events for immediate display', {
            error: err?.message || String(err),
          });
        }
        
        // Also schedule a full refetch to get status updates and ensure everything is in sync
        // Debounce: clear any existing timer
        if (fetchDebounceTimerRef.current) {
          clearTimeout(fetchDebounceTimerRef.current);
        }
        
        // Schedule refetch after 2 seconds to get status updates and temperature data
        fetchDebounceTimerRef.current = setTimeout(() => {
          const now = Date.now();
          // Only fetch if at least 3 seconds have passed since last fetch
          if (now - lastFetchTimeRef.current > 3000) {
            logger.info('Debounced refetch triggered after new package creation');
            fetchPackagesFromEvents();
          } else {
            logger.debug('Skipping refetch - too soon since last fetch', {
              timeSinceLastFetch: now - lastFetchTimeRef.current,
            });
          }
        }, 2000);
      }
    },
  });

  // Cache keys
  const CACHE_KEYS = {
    LAST_BLOCK: `lastFetchedBlock_${contractAddress}`,
    CREATED_EVENTS: `createdEvents_${contractAddress}`,
    STATUS_EVENTS: `statusEvents_${contractAddress}`,
    TEMPERATURE_EVENTS: `temperatureEvents_${contractAddress}`,
    TRANSFER_EVENTS: `transferEvents_${contractAddress}`,
    PACKAGES: `packages_${contractAddress}`,
  };

  // Helper to clear cache (useful for debugging)
  const clearPackageCache = async () => {
    await cacheService.delete(CACHE_KEYS.LAST_BLOCK, 'packages');
    await cacheService.delete(CACHE_KEYS.CREATED_EVENTS, 'packages');
    await cacheService.delete(CACHE_KEYS.STATUS_EVENTS, 'packages');
    await cacheService.delete(CACHE_KEYS.TEMPERATURE_EVENTS, 'packages');
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
    // Known deployment block for Sepolia contract 0x2e3C73D03d55424F509995AC8D47E187Cd3195fe
    // Start searching from block 9772925 (exact deployment block)
    return 9772925n;
  };

  // Fetch logs in chunks to avoid RPC block range limits
  // thirdweb RPC has a 1000 block limit, so we use 999 for safety margin
  const fetchLogsChunked = async (
    eventDef: any,
    fromBlock: bigint,
    toBlock: bigint,
    chunkSize: bigint = 999n, // thirdweb limit is 1000 blocks, using 999 for safety
    requestDelay: number = 250, // 250ms delay to avoid rate limiting
    onChunkFetched?: (logs: any[]) => void // Callback for progressive loading
  ): Promise<any[]> => {
    const allLogs: any[] = [];
    let currentFrom = fromBlock;
    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 3;
    
    // Optimized: Fetch chunks in parallel batches for better throughput
    // while maintaining safe delays between batches to avoid rate limiting
    const BATCH_SIZE = 3; // Fetch 3 chunks in parallel per batch
    
    while (currentFrom <= toBlock) {
      // Prepare a batch of chunks to fetch in parallel
      const batchPromises: Array<Promise<{ logs: any[]; from: bigint; to: bigint }>> = [];
      const batchRanges: Array<{ from: bigint; to: bigint }> = [];
      
      for (let i = 0; i < BATCH_SIZE && currentFrom <= toBlock; i++) {
        const chunkFrom = currentFrom;
        const chunkTo = currentFrom + chunkSize > toBlock 
          ? toBlock 
          : currentFrom + chunkSize;
        
        batchRanges.push({ from: chunkFrom, to: chunkTo });
        
        // Create promise for this chunk
        batchPromises.push(
          (async () => {
            try {
              const chunkLogs = await publicClient!.getLogs({
                address: contractAddress as Address,
                event: eventDef as any,
                fromBlock: chunkFrom,
                toBlock: chunkTo,
              });
              
              return { logs: chunkLogs, from: chunkFrom, to: chunkTo };
            } catch (err: any) {
              logger.warn('Error fetching chunk in batch', {
                fromBlock: chunkFrom.toString(),
                toBlock: chunkTo.toString(),
                error: err?.message || String(err),
              });
              return { logs: [], from: chunkFrom, to: chunkTo };
            }
          })()
        );
        
        currentFrom = chunkTo + 1n;
      }
      
      // Fetch batch in parallel
      try {
        const batchResults = await Promise.all(batchPromises);
        
        // Process batch results
        for (const result of batchResults) {
          allLogs.push(...result.logs);
          consecutiveErrors = 0; // Reset error counter on success
          
          // Call callback for progressive loading if provided
          if (onChunkFetched && result.logs.length > 0) {
            onChunkFetched(result.logs);
          }
          
          // Log results
          if (result.logs.length > 0) {
            logger.info('Chunk fetched with events!', { 
              chunkLogsCount: result.logs.length,
              totalLogsCount: allLogs.length,
              fromBlock: result.from.toString(),
              toBlock: result.to.toString(),
            });
          } else {
            logger.debug('Chunk fetched (no events)', { 
              chunkLogsCount: 0,
              totalLogsCount: allLogs.length,
              fromBlock: result.from.toString(),
              toBlock: result.to.toString(),
            });
          }
        }
        
        // Delay between batches to avoid rate limiting
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
        
        logger.warn('Error fetching batch of chunks', {
          error: errorMessage,
          isRateLimit,
          consecutiveErrors,
          currentFrom: currentFrom.toString(),
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
      const packageTransferredEventAbi = abi.find(
        (item: any) => item.type === 'event' && item.name === 'PackageTransferred'
      );
      const temperatureUpdatedEventAbi = abi.find(
        (item: any) => item.type === 'event' && item.name === 'TemperatureUpdated'
      );

      if (!packageCreatedEventAbi || !packageStatusUpdatedEventAbi) {
        logger.error('Event definitions not found in ABI', null, {
          hasPackageCreated: !!packageCreatedEventAbi,
          hasPackageStatusUpdated: !!packageStatusUpdatedEventAbi,
          hasTemperatureUpdated: !!temperatureUpdatedEventAbi,
        });
        setPackages(new Map());
        return;
      }

      // Use the ABI items directly - viem should handle them
      const packageCreatedEvent = packageCreatedEventAbi;
      const packageStatusUpdatedEvent = packageStatusUpdatedEventAbi;
      const packageTransferredEvent = packageTransferredEventAbi;
      const temperatureUpdatedEvent = temperatureUpdatedEventAbi;
      
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
      let cachedTemperatureLogs: any[] = [];
      let cachedTransferLogs: any[] = [];
      
      if (startBlock === deploymentBlock) {
        const cachedCreated = await cacheService.get(CACHE_KEYS.CREATED_EVENTS, 'packages') as any[] | null;
        const cachedStatus = await cacheService.get(CACHE_KEYS.STATUS_EVENTS, 'packages') as any[] | null;
        const cachedTemperature = await cacheService.get(CACHE_KEYS.TEMPERATURE_EVENTS, 'packages') as any[] | null;
        const cachedTransfer = await cacheService.get(CACHE_KEYS.TRANSFER_EVENTS, 'packages') as any[] | null;
        
        if (cachedCreated && cachedStatus && cachedCreated.length > 0) {
          if (cachedTemperature) {
            cachedTemperatureLogs = cachedTemperature;
          }
          if (cachedTransfer) {
            cachedTransferLogs = cachedTransfer;
          }
          logger.info('Loading cached events', {
            createdCount: cachedCreated.length,
            statusCount: cachedStatus.length,
            temperatureCount: cachedTemperature?.length || 0,
            transferCount: cachedTransfer?.length || 0,
          });
          cachedCreatedLogs = cachedCreated;
          cachedStatusLogs = cachedStatus;
          if (cachedTemperature) {
            cachedTemperatureLogs = cachedTemperature;
          }
          if (cachedTransfer) {
            cachedTransferLogs = cachedTransfer;
          }
          
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
            
            const cachedTemperatureEvents = cachedTemperatureLogs.length > 0
              ? (parseEventLogs({
                  abi: abi as any,
                  eventName: 'TemperatureUpdated',
                  logs: cachedTemperatureLogs,
                  strict: false,
                }) as any[])
              : [];
            
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
            
            // Build temperature map
            const temperatureMap = new Map<bigint, { temperature: number; timestamp: bigint }>();
            for (const event of cachedTemperatureEvents) {
              if (event.args && 'id' in event.args && 'newTemperature' in event.args && 'timestamp' in event.args) {
                const id = event.args.id as bigint;
                const newTemperature = event.args.newTemperature as bigint | number;
                const timestamp = event.args.timestamp as bigint;
                const tempValue = typeof newTemperature === 'bigint' ? Number(newTemperature) : newTemperature;
                const existing = temperatureMap.get(id);
                if (!existing || timestamp > existing.timestamp) {
                  temperatureMap.set(id, { temperature: tempValue, timestamp });
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
                const temperatureUpdate = temperatureMap.get(id);
                
                const parsedPackage = formatPackageFromEvents(
                  { id, description, creator, timestamp },
                  statusUpdate ? { newStatus: statusUpdate.newStatus, timestamp: statusUpdate.timestamp } : undefined,
                  temperatureUpdate ? temperatureUpdate.temperature : undefined
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
      let newTemperatureLogs: any[] = [];
      let newTransferLogs: any[] = [];
      
      if (startBlock <= currentBlock) {
        const blockRange = currentBlock - startBlock;
        const RECENT_BLOCKS = 10000n; // Fetch last 10k blocks first for faster initial load
        
        // Strategy: If range is large, fetch recent blocks first, then backfill
        // This gets packages to the UI faster
        if (blockRange > RECENT_BLOCKS && startBlock === deploymentBlock) {
          // First pass: Fetch recent blocks (last 10k) for fast initial display
          const recentStartBlock = currentBlock > RECENT_BLOCKS 
            ? currentBlock - RECENT_BLOCKS 
            : startBlock;
          
          logger.info('Fast initial fetch: Fetching recent blocks first', {
            fromBlock: recentStartBlock.toString(),
            toBlock: currentBlock.toString(),
            strategy: 'recent-first',
          });
          
          // Fetch all event types in parallel for recent blocks (much faster)
          // 250ms delay to avoid rate limiting
          const [recentCreated, recentStatus, recentTemp, recentTransfer] = await Promise.all([
            fetchLogsChunked(
              packageCreatedEvent,
              recentStartBlock,
              currentBlock,
              999n,
              250  // 250ms delay to avoid rate limiting
            ),
            fetchLogsChunked(
              packageStatusUpdatedEvent,
              recentStartBlock,
              currentBlock,
              999n,
              250
            ),
            temperatureUpdatedEvent 
              ? fetchLogsChunked(
                  temperatureUpdatedEvent,
                  recentStartBlock,
                  currentBlock,
                  999n,
                  250
                )
              : Promise.resolve([]),
            packageTransferredEvent
              ? fetchLogsChunked(
                  packageTransferredEvent,
                  recentStartBlock,
                  currentBlock,
                  999n,
                  250
                )
              : Promise.resolve([]),
          ]);
          
          newCreatedLogs.push(...recentCreated);
          newStatusLogs.push(...recentStatus);
          newTemperatureLogs.push(...recentTemp);
          newTransferLogs.push(...recentTransfer);
          
          // If we found events in recent blocks, parse and display immediately
          if (recentCreated.length > 0 || recentStatus.length > 0) {
            logger.info('Found events in recent blocks, parsing and displaying immediately', {
              createdCount: recentCreated.length,
              statusCount: recentStatus.length,
            });
            
            // Parse recent events immediately for fast display
            try {
              const recentCreatedEvents = parseEventLogs({
                abi: abi as any,
                eventName: 'PackageCreated',
                logs: recentCreated,
                strict: false,
              }) as any[];
              
              const recentStatusEvents = parseEventLogs({
                abi: abi as any,
                eventName: 'PackageStatusUpdated',
                logs: recentStatus,
                strict: false,
              }) as any[];
              
              const recentTempEvents = recentTemp.length > 0
                ? (parseEventLogs({
                    abi: abi as any,
                    eventName: 'TemperatureUpdated',
                    logs: recentTemp,
                    strict: false,
                  }) as any[])
                : [];
              
              // Build status and temperature maps from recent events
              const recentStatusMap = new Map<bigint, { newStatus: bigint; timestamp: bigint }>();
              for (const event of recentStatusEvents) {
                if (event.args && 'id' in event.args && 'newStatus' in event.args && 'timestamp' in event.args) {
                  const id = event.args.id as bigint;
                  const newStatus = event.args.newStatus as bigint;
                  const timestamp = event.args.timestamp as bigint;
                  const existing = recentStatusMap.get(id);
                  if (!existing || timestamp > existing.timestamp) {
                    recentStatusMap.set(id, { newStatus, timestamp });
                  }
                }
              }
              
              const recentTempMap = new Map<bigint, { temperature: number; timestamp: bigint }>();
              for (const event of recentTempEvents) {
                if (event.args && 'id' in event.args && 'newTemperature' in event.args && 'timestamp' in event.args) {
                  const id = event.args.id as bigint;
                  const newTemperature = event.args.newTemperature as bigint | number;
                  const timestamp = event.args.timestamp as bigint;
                  const tempValue = typeof newTemperature === 'bigint' ? Number(newTemperature) : newTemperature;
                  const existing = recentTempMap.get(id);
                  if (!existing || timestamp > existing.timestamp) {
                    recentTempMap.set(id, { temperature: tempValue, timestamp });
                  }
                }
              }
              
              // Build owner map from recent transfer events
              const recentTransferEvents = recentTransfer.length > 0
                ? (parseEventLogs({
                    abi: abi as any,
                    eventName: 'PackageTransferred',
                    logs: recentTransfer,
                    strict: false,
                  }) as any[])
                : [];
              
              const recentTransferMap = new Map<bigint, { owner: string; timestamp: bigint }>();
              for (const event of recentTransferEvents) {
                if (event.args && 'id' in event.args && 'to' in event.args && 'timestamp' in event.args) {
                  const id = event.args.id as bigint;
                  const to = event.args.to as string;
                  const timestamp = event.args.timestamp as bigint;
                  const existing = recentTransferMap.get(id);
                  if (!existing || timestamp > existing.timestamp) {
                    recentTransferMap.set(id, { owner: to, timestamp });
                  }
                }
              }
              
              // Build packages from recent events and display immediately
              const recentPackagesMap = new Map<string, ParsedPackage>();
              for (const event of recentCreatedEvents) {
                if (event.args && 'id' in event.args && 'description' in event.args && 'creator' in event.args && 'timestamp' in event.args) {
                  const id = event.args.id as bigint;
                  const description = event.args.description as string;
                  const creator = event.args.creator as string;
                  const timestamp = event.args.timestamp as bigint;
                  const statusUpdate = recentStatusMap.get(id);
                  const temperatureUpdate = recentTempMap.get(id);
                  
                  const parsedPackage = formatPackageFromEvents(
                    { id, description, creator, timestamp },
                    statusUpdate ? { newStatus: statusUpdate.newStatus, timestamp: statusUpdate.timestamp } : undefined,
                    temperatureUpdate ? temperatureUpdate.temperature : undefined
                  );
                  
                  recentPackagesMap.set(parsedPackage.id, parsedPackage);
                }
              }
              
              if (recentPackagesMap.size > 0) {
                logger.info('Displaying packages from recent blocks immediately', { count: recentPackagesMap.size });
                // Merge with existing packages and update UI immediately
      setPackages(prev => {
                  const merged = new Map(prev);
                  recentPackagesMap.forEach((pkg, id) => merged.set(id, pkg));
                  return merged;
                });
              }
            } catch (err: any) {
              logger.warn('Error parsing recent events for immediate display', {
                error: err?.message || String(err),
              });
            }
          }
          
          // Second pass: Backfill older blocks (if needed)
          if (recentStartBlock > startBlock) {
            logger.info('Backfilling older blocks in background', {
              fromBlock: startBlock.toString(),
              toBlock: (recentStartBlock - 1n).toString(),
            });
            
            // Fetch older blocks in parallel (still efficient, less urgent)
            // 250ms delay to avoid rate limiting
            const [olderCreated, olderStatus, olderTemp, olderTransfer] = await Promise.all([
              fetchLogsChunked(
                packageCreatedEvent,
                startBlock,
                recentStartBlock - 1n,
                999n,
                250  // 250ms delay to avoid rate limiting
              ),
              fetchLogsChunked(
                packageStatusUpdatedEvent,
                startBlock,
                recentStartBlock - 1n,
                999n,
                250
              ),
              temperatureUpdatedEvent
                ? fetchLogsChunked(
                    temperatureUpdatedEvent,
                    startBlock,
                    recentStartBlock - 1n,
                    999n,
                    250
                  )
                : Promise.resolve([]),
              packageTransferredEvent
                ? fetchLogsChunked(
                    packageTransferredEvent,
                    startBlock,
                    recentStartBlock - 1n,
                    999n,
                    250
                  )
                : Promise.resolve([]),
            ]);
            
            newCreatedLogs.push(...olderCreated);
            newStatusLogs.push(...olderStatus);
            newTemperatureLogs.push(...olderTemp);
            newTransferLogs.push(...olderTransfer);
          }
        } else {
          // Small range or incremental update: fetch normally but in parallel
          logger.info('Fetching events in parallel for faster loading', {
            fromBlock: startBlock.toString(),
            toBlock: currentBlock.toString(),
            chunkSize: '999',
          });
          
          // Fetch all event types in parallel (much faster than sequential)
          // 250ms delay to avoid rate limiting
          const [created, status, temp, transfer] = await Promise.all([
            fetchLogsChunked(
              packageCreatedEvent,
              startBlock,
              currentBlock,
              999n,
              250  // 250ms delay to avoid rate limiting
            ),
            fetchLogsChunked(
              packageStatusUpdatedEvent,
              startBlock,
              currentBlock,
              999n,
              250
            ),
            temperatureUpdatedEvent
              ? fetchLogsChunked(
                  temperatureUpdatedEvent,
                  startBlock,
                  currentBlock,
                  999n,
                  250
                )
              : Promise.resolve([]),
            packageTransferredEvent
              ? fetchLogsChunked(
                  packageTransferredEvent,
                  startBlock,
                  currentBlock,
                  999n,
                  250
                )
              : Promise.resolve([]),
          ]);
          
          newCreatedLogs = created;
          newStatusLogs = status;
          newTemperatureLogs = temp;
          newTransferLogs = transfer;
        }
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

      const allTemperatureLogs = startBlock === deploymentBlock && cachedTemperatureLogs.length > 0
        ? [...cachedTemperatureLogs, ...newTemperatureLogs]
        : newTemperatureLogs.length > 0
        ? newTemperatureLogs
        : cachedTemperatureLogs;

      const allTransferLogs = startBlock === deploymentBlock && cachedTransferLogs.length > 0
        ? [...cachedTransferLogs, ...newTransferLogs]
        : newTransferLogs.length > 0
        ? newTransferLogs
        : cachedTransferLogs;

      logger.debug('Total events', {
        createdCount: allCreatedLogs.length,
        statusCount: allStatusLogs.length,
        temperatureCount: allTemperatureLogs.length,
        newCreatedCount: newCreatedLogs.length,
        newStatusCount: newStatusLogs.length,
        newTemperatureCount: newTemperatureLogs.length,
        cachedCreatedCount: cachedCreatedLogs.length,
        cachedStatusCount: cachedStatusLogs.length,
        cachedTemperatureCount: cachedTemperatureLogs.length,
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
      let temperatureEvents: any[] = [];
      let transferEvents: any[] = [];
      
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

      if (allTemperatureLogs.length > 0) {
        try {
          temperatureEvents = parseEventLogs({
            abi: abi as any,
            eventName: 'TemperatureUpdated',
            logs: allTemperatureLogs,
            strict: false,
          }) as any[];
          logger.info('Parsed TemperatureUpdated events', { 
            count: temperatureEvents.length,
            rawLogsCount: allTemperatureLogs.length,
          });
        } catch (err: any) {
          logger.error('Error parsing TemperatureUpdated events', err, {
            logsCount: allTemperatureLogs.length,
            error: err?.message || String(err),
          });
        }
      }

      if (allTransferLogs.length > 0) {
        try {
          // Parse PackageTransferred events to track ownership changes
          const parsedTransferEvents = parseEventLogs({
            abi: abi as any,
            eventName: 'PackageTransferred',
            logs: allTransferLogs,
            strict: false,
          }) as any[];
          transferEvents = parsedTransferEvents;
          logger.info('Parsed PackageTransferred events', { 
            count: transferEvents.length,
            rawLogsCount: allTransferLogs.length,
          });
        } catch (err: any) {
          logger.error('Error parsing PackageTransferred events', err, {
            logsCount: allTransferLogs.length,
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
        await cacheService.set(CACHE_KEYS.TEMPERATURE_EVENTS, allTemperatureLogs, {
          namespace: 'packages',
          ttl: 24 * 60 * 60 * 1000, // 24 hours
          persist: true,
        });
      } else if (newCreatedLogs.length > 0 || newStatusLogs.length > 0 || newTemperatureLogs.length > 0) {
        // Incremental update - merge with cached raw logs
        const cachedCreated = await cacheService.get(CACHE_KEYS.CREATED_EVENTS, 'packages') as any[] | null;
        const cachedStatus = await cacheService.get(CACHE_KEYS.STATUS_EVENTS, 'packages') as any[] | null;
        const cachedTemperature = await cacheService.get(CACHE_KEYS.TEMPERATURE_EVENTS, 'packages') as any[] | null;
        
        const mergedCreated = [...(cachedCreated || []), ...newCreatedLogs];
        const mergedStatus = [...(cachedStatus || []), ...newStatusLogs];
        const mergedTemperature = [...(cachedTemperature || []), ...newTemperatureLogs];
        
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
        await cacheService.set(CACHE_KEYS.TEMPERATURE_EVENTS, mergedTemperature, {
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

      // Build a map of packageId -> latest owner (from PackageTransferred events)
      // This is critical - the contract requires msg.sender == pkg.currentOwner
      const ownerMap = new Map<bigint, { owner: string; timestamp: bigint }>();
      for (const event of transferEvents) {
        if (event.args && 'id' in event.args && 'to' in event.args && 'timestamp' in event.args) {
          const id = event.args.id as bigint;
          const to = event.args.to as string;
          const timestamp = event.args.timestamp as bigint;
          
          // Keep only the latest transfer (most recent owner)
          const existing = ownerMap.get(id);
          if (!existing || timestamp > existing.timestamp) {
            ownerMap.set(id, { owner: to, timestamp });
          }
        }
      }

      // Build a map of packageId -> latest temperature update
      const temperatureMap = new Map<bigint, { temperature: number; timestamp: bigint }>();
      for (const event of temperatureEvents) {
        if (event.args && 'id' in event.args && 'newTemperature' in event.args && 'timestamp' in event.args) {
          const id = event.args.id as bigint;
          const newTemperature = event.args.newTemperature as bigint | number;
          const timestamp = event.args.timestamp as bigint;
          
          // Convert temperature to number (int8 from blockchain)
          const tempValue = typeof newTemperature === 'bigint' ? Number(newTemperature) : newTemperature;
          
          // Keep only the latest temperature update for each package
          const existing = temperatureMap.get(id);
          if (!existing || timestamp > existing.timestamp) {
            temperatureMap.set(id, { temperature: tempValue, timestamp });
          }
        }
      }

      // Build packages from created events
      // Start with existing packages to preserve them during incremental updates
      const packagesMap = new Map<string, ParsedPackage>(packages);
      for (const event of createdEvents) {
        if (event.args && 'id' in event.args && 'description' in event.args && 'creator' in event.args && 'timestamp' in event.args) {
          const id = event.args.id as bigint;
          const description = event.args.description as string;
          const creator = event.args.creator as string;
          const timestamp = event.args.timestamp as bigint;

          // Get latest status update for this package
          const statusUpdate = statusMap.get(id);
          
          // Get latest owner from transfer events (if transferred), otherwise use creator
          const ownerUpdate = ownerMap.get(id);
          const currentOwner = ownerUpdate ? ownerUpdate.owner : creator;
          
          // Get latest temperature update for this package
          const temperatureUpdate = temperatureMap.get(id);
          
          const parsedPackage = formatPackageFromEvents(
            { id, description, creator, timestamp },
            statusUpdate ? { newStatus: statusUpdate.newStatus, timestamp: statusUpdate.timestamp } : undefined,
            temperatureUpdate ? temperatureUpdate.temperature : undefined,
            currentOwner // Pass the current owner (from transfers or creator)
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
      
      // Update packages state - merge with existing to preserve packages not in current fetch
      // This is important for incremental updates where we only fetch recent blocks
      setPackages(prev => {
        const merged = new Map(prev);
        // Add/update packages from current fetch (newer data takes precedence)
        packagesMap.forEach((pkg, id) => {
          merged.set(id, pkg);
      });
        return merged;
      });
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

  // Reset state when contract address changes (e.g., network switch)
  useEffect(() => {
    if (contractAddress && lastContractAddressRef.current !== contractAddress) {
      logger.info('Contract address changed, resetting packages state', {
        oldAddress: lastContractAddressRef.current,
        newAddress: contractAddress,
      });
      // Clear packages when contract address changes (different network)
      setPackages(new Map());
      lastPackagesRef.current = '';
      lastFetchTimeRef.current = 0;
      setIsLoading(true);
      lastContractAddressRef.current = contractAddress;
    } else if (!lastContractAddressRef.current && contractAddress) {
      // First time contract address is set
      lastContractAddressRef.current = contractAddress;
    }
  }, [contractAddress]);

  // Fetch packages when contract address or public client changes
  useEffect(() => {
    // Only fetch if we have both publicClient and contractAddress
    if (publicClient && contractAddress) {
      logger.info('Triggering package fetch due to contract address or public client change', {
        contractAddress,
        hasPublicClient: !!publicClient,
      });
      fetchPackagesFromEvents();
    } else {
      logger.debug('Skipping package fetch - missing dependencies', {
        hasPublicClient: !!publicClient,
        contractAddress,
      });
      setIsLoading(false);
    }
    
    // Cleanup debounce timer on unmount
    return () => {
      if (fetchDebounceTimerRef.current) {
        clearTimeout(fetchDebounceTimerRef.current);
      }
    };
  }, [fetchPackagesFromEvents, publicClient, contractAddress]);

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

  // Notify parent when packages change (with debouncing to prevent infinite loops)
  useEffect(() => {
    // Prevent concurrent execution
    if (isNotifyingRef.current) {
      logger.debug('Notification already in progress, skipping');
      return;
    }
    
    // Clear any pending notification
    if (notifyParentTimerRef.current) {
      clearTimeout(notifyParentTimerRef.current);
      notifyParentTimerRef.current = null;
    }
    
    const packagesArray = Array.from(packages.values());
    
    // Progressive loading: notify parent even while loading so packages appear as they're found
    // Only skip if we have no packages and are still loading (initial state)
    if (isLoading && packagesArray.length === 0) {
      logger.debug('Still loading packages, no packages yet, skipping notification');
      return;
    }
    
    // Create a stable string representation to compare
    const packagesKey = packagesArray.map(p => `${p.id}:${p.status}`).sort().join('|');
    
    // Only notify if packages actually changed
    if (lastPackagesRef.current === '' || packagesKey !== lastPackagesRef.current) {
      // Debounce the notification to prevent rapid-fire updates during progressive loading
      const debounceDelay = isLoading ? 1000 : 200; // Increased delay to prevent loops
      
      isNotifyingRef.current = true;
      notifyParentTimerRef.current = setTimeout(() => {
        try {
          logger.info('Notifying parent of packages', { 
            count: packagesArray.length, 
            packagesKey,
            isLoading,
            note: isLoading ? 'Progressive update while loading' : 'Final update',
          });
          lastPackagesRef.current = packagesKey;
          stableOnPackagesLoaded(packagesArray);
        } catch (error: any) {
          logger.error('Error notifying parent of packages', error, {
            packagesKey,
            errorMessage: error?.message || String(error),
          });
        } finally {
          isNotifyingRef.current = false;
          notifyParentTimerRef.current = null;
        }
      }, debounceDelay);
    } else {
      logger.debug('Packages unchanged, skipping notification', { packagesKey });
    }
    
    // Cleanup timer on unmount or dependency change
    return () => {
      if (notifyParentTimerRef.current) {
        clearTimeout(notifyParentTimerRef.current);
        notifyParentTimerRef.current = null;
      }
      isNotifyingRef.current = false;
    };
  }, [packages, stableOnPackagesLoaded, isLoading]);

  // Component doesn't render anything, it just fetches and notifies parent
  return null;
}

