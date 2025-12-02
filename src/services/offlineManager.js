/**
 * Offline Manager Service
 * 
 * Handles offline detection, transaction queuing, and sync when back online.
 */

import config from '../config';
import logger from '../services/logging';
import transactionManager from './transactionManager';
import indexedDB from '../utils/indexedDB';

class OfflineManager {
  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.offlineQueue = [];
    this.syncListeners = [];
    this.enabled = config.features.offlineMode;
  }

  /**
   * Initialize offline manager
   */
  init() {
    if (!this.enabled) {
      logger.debug('Offline mode disabled');
      return;
    }

    // Listen to online/offline events
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
    }

    // Check initial state
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    // Load offline queue from IndexedDB
    this.loadOfflineQueue();

    logger.info('Offline manager initialized', { isOnline: this.isOnline });
  }

  /**
   * Handle online event
   */
  async handleOnline() {
    logger.info('Network connection restored');
    this.isOnline = true;

    // Sync offline queue
    await this.syncOfflineQueue();

    // Notify listeners
    this.syncListeners.forEach(listener => {
      try {
        listener(true);
      } catch (error) {
        logger.error('Sync listener error', error);
      }
    });
  }

  /**
   * Handle offline event
   */
  handleOffline() {
    logger.warn('Network connection lost');
    this.isOnline = false;

    // Notify listeners
    this.syncListeners.forEach(listener => {
      try {
        listener(false);
      } catch (error) {
        logger.error('Sync listener error', error);
      }
    });
  }

  /**
   * Check if online
   */
  isCurrentlyOnline() {
    return this.isOnline;
  }

  /**
   * Add to offline queue
   */
  async addToQueue(item) {
    if (!this.enabled) {
      return false;
    }

    this.offlineQueue.push({
      ...item,
      queuedAt: Date.now(),
    });

    // Persist to IndexedDB
    try {
      await indexedDB.init();
      await indexedDB.set('offlineQueue', {
        key: 'queue',
        value: this.offlineQueue,
        timestamp: Date.now(),
      });
    } catch (error) {
      // Silently fail if IndexedDB is not available - offline mode will still work in memory
      logger.debug('Failed to persist offline queue (IndexedDB may not be available)', error);
    }

    logger.info('Item added to offline queue', { queueSize: this.offlineQueue.length });
    return true;
  }

  /**
   * Load offline queue from IndexedDB
   */
  async loadOfflineQueue() {
    if (!this.enabled) return;

    try {
      // Ensure IndexedDB is initialized before using it
      await indexedDB.init();
      const stored = await indexedDB.get('offlineQueue', 'queue');
      if (stored && stored.value) {
        this.offlineQueue = stored.value;
        logger.info('Offline queue loaded', { queueSize: this.offlineQueue.length });
      }
    } catch (error) {
      // Silently fail if IndexedDB is not available - offline mode will still work in memory
      logger.debug('Failed to load offline queue (IndexedDB may not be available)', error);
    }
  }

  /**
   * Sync offline queue when back online
   */
  async syncOfflineQueue() {
    if (!this.enabled || this.offlineQueue.length === 0) {
      return;
    }

    logger.info('Syncing offline queue', { queueSize: this.offlineQueue.length });

    const itemsToSync = [...this.offlineQueue];
    this.offlineQueue = [];

    for (const item of itemsToSync) {
      try {
        // Process item based on type
        if (item.type === 'transaction') {
          // Re-submit transaction
          await transactionManager.addTransaction(
            item.transactionPromise,
            item.metadata
          );
        }

        logger.info('Offline item synced', { itemId: item.id });
      } catch (error) {
        logger.error('Failed to sync offline item', error, { itemId: item.id });
        // Re-queue failed items
        this.offlineQueue.push(item);
      }
    }

    // Clear persisted queue
    try {
      await indexedDB.init();
      await indexedDB.delete('offlineQueue', 'queue');
    } catch (error) {
      // Silently fail if IndexedDB is not available
      logger.debug('Failed to clear offline queue (IndexedDB may not be available)', error);
    }

    logger.info('Offline queue sync completed', {
      synced: itemsToSync.length - this.offlineQueue.length,
      failed: this.offlineQueue.length,
    });
  }

  /**
   * Get offline queue size
   */
  getQueueSize() {
    return this.offlineQueue.length;
  }

  /**
   * Clear offline queue
   */
  async clearQueue() {
    this.offlineQueue = [];
    try {
      await indexedDB.init();
      await indexedDB.delete('offlineQueue', 'queue');
    } catch (error) {
      // Silently fail if IndexedDB is not available
      logger.debug('Failed to clear offline queue (IndexedDB may not be available)', error);
    }
    logger.info('Offline queue cleared');
  }

  /**
   * Add sync listener
   */
  onSyncStatusChange(listener) {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter(l => l !== listener);
    };
  }
}

// Create singleton instance
const offlineManager = new OfflineManager();

// Auto-initialize
if (typeof window !== 'undefined') {
  offlineManager.init();
}

export default offlineManager;

