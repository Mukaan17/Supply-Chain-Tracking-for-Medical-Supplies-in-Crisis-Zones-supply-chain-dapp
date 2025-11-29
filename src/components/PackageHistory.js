import React, { useState, useEffect, useRef } from 'react';
import logger from '../services/logging';
import errorTracking from '../services/errorTracking';
import { handleError } from '../utils/errorHandler';
import websocketService from '../services/websocket';
import cacheService from '../utils/cache';

// Add CSS animation for live indicator
const pulseStyle = `
  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
`;

// Inject the CSS
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = pulseStyle;
  document.head.appendChild(style);
}

export default function PackageHistory({ contract, packageId, provider }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [processedEvents, setProcessedEvents] = useState(new Set());
  const eventListenersRef = useRef([]);
  const pollingIntervalRef = useRef(null);

  const fetchEvents = async () => {
    if (!contract || !packageId || !provider) return;
    
    // Check cache first
    const cacheKey = `package_events_${packageId}`;
    const cached = await cacheService.get(cacheKey, 'packageHistory');
    if (cached) {
      setEvents(cached);
      logger.debug('Events loaded from cache', { packageId });
      return;
    }
    
    setLoading(true);
    try {
      logger.debug('Fetching events for package', { packageId, provider: provider.constructor.name });
      
      // Get all events for this package with a more limited range to avoid RPC errors
      const currentBlock = await provider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Only look at last 10k blocks
      
      const createdFilter = contract.filters.PackageCreated(packageId);
      const transferredFilter = contract.filters.PackageTransferred(packageId);
      const deliveredFilter = contract.filters.PackageDelivered(packageId);

      logger.debug('Fetching events from blocks', { fromBlock, toBlock: currentBlock });

      const [createdEvents, transferredEvents, deliveredEvents] = await Promise.all([
        contract.queryFilter(createdFilter, fromBlock, currentBlock).catch(e => {
          logger.error('Error fetching created events', e, { packageId });
          errorTracking.captureException(e, { tags: { component: 'PackageHistory', event: 'created' } });
          return [];
        }),
        contract.queryFilter(transferredFilter, fromBlock, currentBlock).catch(e => {
          logger.error('Error fetching transferred events', e, { packageId });
          errorTracking.captureException(e, { tags: { component: 'PackageHistory', event: 'transferred' } });
          return [];
        }),
        contract.queryFilter(deliveredFilter, fromBlock, currentBlock).catch(e => {
          logger.error('Error fetching delivered events', e, { packageId });
          errorTracking.captureException(e, { tags: { component: 'PackageHistory', event: 'delivered' } });
          return [];
        })
      ]);

      logger.debug('Events fetched', {
        created: createdEvents.length,
        transferred: transferredEvents.length,
        delivered: deliveredEvents.length,
      });

      // Fetch block timestamps for all events
      const allEvents = [
        ...createdEvents.map(e => ({ ...e, type: 'created' })),
        ...transferredEvents.map(e => ({ ...e, type: 'transferred' })),
        ...deliveredEvents.map(e => ({ ...e, type: 'delivered' }))
      ];

      // Get timestamps for all unique blocks
      const uniqueBlocks = [...new Set(allEvents.map(e => e.blockNumber))];
      const blockTimestamps = {};
      
      for (const blockNum of uniqueBlocks) {
        try {
          const block = await provider.getBlock(blockNum);
          blockTimestamps[blockNum] = block ? block.timestamp * 1000 : Date.now();
        } catch (e) {
          logger.warn('Error fetching block timestamp', e, { blockNum });
          blockTimestamps[blockNum] = Date.now();
        }
      }

      // Add timestamps to events and sort
      const eventsWithTimestamps = allEvents.map(event => ({
        ...event,
        timestampMs: blockTimestamps[event.blockNumber] || Date.now()
      })).sort((a, b) => b.blockNumber - a.blockNumber);

      setEvents(eventsWithTimestamps);
      
      // Cache events
      await cacheService.set(cacheKey, eventsWithTimestamps, {
        namespace: 'packageHistory',
        ttl: 60000, // 1 minute
      });
      
      logger.info('Events fetched and cached', { packageId, count: eventsWithTimestamps.length });
    } catch (error) {
      const errorInfo = handleError(error, {
        component: 'PackageHistory',
        action: 'fetchEvents',
      });
      logger.error('Failed to fetch events', error, { packageId });
      errorTracking.captureException(error, {
        tags: { component: 'PackageHistory' },
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    setProcessedEvents(new Set()); // Clear processed events when package changes
  }, [contract, packageId, provider]); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to live events for this package and update in real time
  useEffect(() => {
    if (!contract || !packageId || !provider) return;

    let isCancelled = false;
    let lastBlockNumber = 0;
    logger.debug('Setting up event listeners', { packageId });
    
    // Polling mechanism as fallback
    const pollForNewEvents = async () => {
      if (isCancelled) return;
      
      try {
        const currentBlock = await provider.getBlockNumber();
        
        if (currentBlock > lastBlockNumber) {
          logger.debug('New block detected', { currentBlock, lastBlock: lastBlockNumber });
          lastBlockNumber = currentBlock;
          
          // Check for new events in the latest block
          const latestBlock = await provider.getBlock(currentBlock, true);
          if (latestBlock && latestBlock.transactions) {
            logger.debug('Checking block for events', {
              block: currentBlock,
              txCount: latestBlock.transactions.length,
            });
            // Trigger a refresh of events
            await fetchEvents();
          }
        }
      } catch (e) {
        logger.error('Error in polling', e, { packageId });
      }
    };
    
    // Set up polling every 3 seconds
    const pollInterval = setInterval(pollForNewEvents, 3000);
    pollingIntervalRef.current = pollInterval;
    logger.debug('Polling interval set up', { interval: 3000 });
    
    // Initial poll to set the baseline
    pollForNewEvents();

    const addEventWithTimestamp = async (evt, type) => {
      try {
        logger.debug('New event received', { type, packageId, txHash: evt.transactionHash });
        
        // Create a unique key for this event
        const idx = (evt.index ?? evt.logIndex ?? 0);
        const eventKey = `${evt.transactionHash}:${idx}:${type}`;
        
        if (!isCancelled) {
          setProcessedEvents(prevProcessed => {
            if (prevProcessed.has(eventKey)) {
              logger.debug('Event already processed', { eventKey });
              return prevProcessed;
            }
            return new Set([...prevProcessed, eventKey]);
          });
          
          // Get the actual block timestamp
          try {
            if (provider) {
              const block = await provider.getBlock(evt.blockNumber);
              const timestampMs = block ? block.timestamp * 1000 : Date.now();
              
              // Add the event to the list with correct timestamp
              setEvents(prev => {
                const enriched = { ...evt, type, timestampMs };
                const next = [enriched, ...prev];
                return next.sort((a, b) => (b.blockNumber - a.blockNumber) || ((b.index ?? b.logIndex ?? 0) - (a.index ?? a.logIndex ?? 0)));
              });
              
              // Invalidate cache
              cacheService.delete(`package_events_${packageId}`, 'packageHistory');
            } else {
              // Fallback to current time if no provider
              setEvents(prev => {
                const enriched = { ...evt, type, timestampMs: Date.now() };
                const next = [enriched, ...prev];
                return next.sort((a, b) => (b.blockNumber - a.blockNumber) || ((b.index ?? b.logIndex ?? 0) - (a.index ?? a.logIndex ?? 0)));
              });
            }
          } catch (blockError) {
            logger.warn('Error getting block timestamp', blockError, { blockNumber: evt.blockNumber });
            // Fallback to current time
            setEvents(prev => {
              const enriched = { ...evt, type, timestampMs: Date.now() };
              const next = [enriched, ...prev];
              return next.sort((a, b) => (b.blockNumber - a.blockNumber) || ((b.index ?? b.logIndex ?? 0) - (a.index ?? a.logIndex ?? 0)));
            });
          }
        }
      } catch (e) {
        logger.error('Error adding event with timestamp', e, { type, packageId });
        errorTracking.captureException(e, { tags: { component: 'PackageHistory' } });
      }
    };

    // Listen to all events and filter by package ID
    const onCreated = (id, description, creator, evt) => {
      logger.debug('PackageCreated event received', { id, packageId });
      if (id?.toString() === String(packageId)) {
        logger.info('Processing PackageCreated', { packageId });
        addEventWithTimestamp(evt, 'created');
      }
    };
    
    const onTransferred = (id, from, to, status, evt) => {
      logger.debug('PackageTransferred event received', { id, packageId });
      if (id?.toString() === String(packageId)) {
        logger.info('Processing PackageTransferred', { packageId });
        addEventWithTimestamp(evt, 'transferred');
      }
    };
    
    const onDelivered = (id, owner, evt) => {
      logger.debug('PackageDelivered event received', { id, packageId });
      if (id?.toString() === String(packageId)) {
        logger.info('Processing PackageDelivered', { packageId });
        addEventWithTimestamp(evt, 'delivered');
      }
    };

    // Store listeners for cleanup
    eventListenersRef.current = [onCreated, onTransferred, onDelivered];
    
    // Listen to all events (not filtered)
    logger.debug('Setting up event listeners', {
      packageId,
      contractAddress: contract.target,
    });
    
    contract.on('PackageCreated', onCreated);
    contract.on('PackageTransferred', onTransferred);
    contract.on('PackageDelivered', onDelivered);
    
    // WebSocket integration for real-time updates
    if (websocketService.enabled) {
      const unsubscribe = websocketService.on('package_update', (data) => {
        if (data.data?.id?.toString() === String(packageId)) {
          logger.debug('WebSocket package update received', { packageId, type: data.type });
          fetchEvents(); // Refresh events
        }
      });
      eventListenersRef.current.push(unsubscribe);
    }
    
    logger.info('Event listeners registered', { packageId });
    
    // Set live status
    setIsLive(true);

    return () => {
      logger.debug('Cleaning up event listeners', { packageId });
      isCancelled = true;
      setIsLive(false);
      
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      
      // Remove event listeners
      try {
        contract.off('PackageCreated', onCreated);
        contract.off('PackageTransferred', onTransferred);
        contract.off('PackageDelivered', onDelivered);
      } catch (e) {
        logger.error('Error removing event listeners', e);
      }
      
      // Clean up WebSocket listeners
      eventListenersRef.current.forEach(listener => {
        if (typeof listener === 'function') {
          try {
            listener();
          } catch (e) {
            logger.error('Error removing WebSocket listener', e);
          }
        }
      });
      
      eventListenersRef.current = [];
    };
  }, [contract, packageId, provider]);

  const formatEvent = (event) => {
    const ts = event.timestampMs ?? Date.now();
    const timestamp = new Date(ts).toLocaleString();
    
    switch (event.type) {
      case 'created':
        return {
          icon: '📦',
          title: 'Package Created',
          description: `Created by ${event.args?.creator?.slice(0, 6)}...${event.args?.creator?.slice(-4)}`,
          timestamp
        };
      case 'transferred':
        return {
          icon: '🚚',
          title: 'Package Transferred',
          description: `From ${event.args?.from?.slice(0, 6)}...${event.args?.from?.slice(-4)} to ${event.args?.to?.slice(0, 6)}...${event.args?.to?.slice(-4)}`,
          timestamp
        };
      case 'delivered':
        return {
          icon: '✅',
          title: 'Package Delivered',
          description: `Delivered by ${event.args?.owner?.slice(0, 6)}...${event.args?.owner?.slice(-4)}`,
          timestamp
        };
      default:
        return {
          icon: '📋',
          title: 'Event',
          description: 'Unknown event',
          timestamp
        };
    }
  };

  if (!packageId) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        📋 Package History
        {isLive && (
          <span style={{
            backgroundColor: '#28a745',
            color: 'white',
            padding: '2px 8px',
            borderRadius: 12,
            fontSize: '12px',
            fontWeight: 'bold',
            animation: 'pulse 2s infinite'
          }}>
            🔴 LIVE
          </span>
        )}
        <button 
          onClick={fetchEvents}
          style={{
            marginLeft: 'auto',
            padding: '4px 8px',
            fontSize: '12px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 Refresh
        </button>
      </h3>
      {loading ? (
        <p>Loading history...</p>
      ) : events.length === 0 ? (
        <p style={{ color: '#666', fontStyle: 'italic' }}>No events found for this package.</p>
      ) : (
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {events.map((event, index) => {
            const formatted = formatEvent(event);
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: index < events.length - 1 ? '1px solid #eee' : 'none'
                }}
              >
                <span style={{ fontSize: '20px' }}>{formatted.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>{formatted.title}</div>
                  <div style={{ fontSize: '14px', color: '#666' }}>{formatted.description}</div>
                  <div style={{ fontSize: '12px', color: '#999' }}>{formatted.timestamp}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
