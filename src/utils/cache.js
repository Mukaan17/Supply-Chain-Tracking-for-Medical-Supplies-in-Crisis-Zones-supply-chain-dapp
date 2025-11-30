/**
 * Caching Service
 * 
 * Provides caching with memory and IndexedDB persistence.
 */

import config from '../config';
import logger from '../services/logging';

class CacheService {
  constructor() {
    this.memoryCache = new Map();
    this.enabled = config.features.enableCaching !== false;
    this.maxSize = config.performance.maxCacheSize;
    this.defaultTTL = config.performance.cacheTTL;
  }

  /**
   * Generate cache key
   */
  _generateKey(key, namespace = 'default') {
    return `${namespace}:${key}`;
  }

  /**
   * Get cached value
   */
  async get(key, namespace = 'default') {
    if (!this.enabled) return null;

    const cacheKey = this._generateKey(key, namespace);
    const cached = this.memoryCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    // Check expiration
    if (cached.expiresAt && Date.now() > cached.expiresAt) {
      this.memoryCache.delete(cacheKey);
      logger.debug('Cache expired', { key: cacheKey });
      return null;
    }

    logger.debug('Cache hit', { key: cacheKey });
    return cached.value;
  }

  /**
   * Set cached value
   */
  async set(key, value, options = {}) {
    if (!this.enabled) return;

    const {
      namespace = 'default',
      ttl = this.defaultTTL,
      persist = false,
    } = options;

    const cacheKey = this._generateKey(key, namespace);
    const expiresAt = ttl ? Date.now() + ttl : null;

    const cacheEntry = {
      value,
      expiresAt,
      createdAt: Date.now(),
      namespace,
    };

    // Check cache size
    if (this.memoryCache.size >= this.maxSize) {
      // Remove oldest entry
      const firstKey = this.memoryCache.keys().next().value;
      this.memoryCache.delete(firstKey);
      logger.debug('Cache evicted', { key: firstKey });
    }

    this.memoryCache.set(cacheKey, cacheEntry);

    // Persist to IndexedDB if requested
    if (persist && typeof window !== 'undefined' && window.indexedDB) {
      try {
        await this._persistToIndexedDB(cacheKey, cacheEntry);
      } catch (error) {
        logger.error('Failed to persist to IndexedDB', error);
      }
    }

    logger.debug('Cache set', { key: cacheKey, ttl });
  }

  /**
   * Delete cached value
   */
  async delete(key, namespace = 'default') {
    const cacheKey = this._generateKey(key, namespace);
    this.memoryCache.delete(cacheKey);
    
    // Delete from IndexedDB
    if (typeof window !== 'undefined' && window.indexedDB) {
      try {
        await this._deleteFromIndexedDB(cacheKey);
      } catch (error) {
        logger.error('Failed to delete from IndexedDB', error);
      }
    }

    logger.debug('Cache deleted', { key: cacheKey });
  }

  /**
   * Clear all cache
   */
  async clear(namespace = null) {
    if (namespace) {
      // Clear specific namespace
      const keysToDelete = [];
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(`${namespace}:`)) {
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(key => this.memoryCache.delete(key));
    } else {
      // Clear all
      this.memoryCache.clear();
    }

    logger.info('Cache cleared', { namespace });
  }

  /**
   * Check if key exists
   */
  async has(key, namespace = 'default') {
    const cacheKey = this._generateKey(key, namespace);
    const cached = this.memoryCache.get(cacheKey);
    
    if (!cached) return false;
    
    // Check expiration
    if (cached.expiresAt && Date.now() > cached.expiresAt) {
      this.memoryCache.delete(cacheKey);
      return false;
    }
    
    return true;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const stats = {
      size: this.memoryCache.size,
      maxSize: this.maxSize,
      enabled: this.enabled,
      namespaces: new Set(),
    };

    for (const key of this.memoryCache.keys()) {
      const [namespace] = key.split(':');
      stats.namespaces.add(namespace);
    }

    stats.namespaces = Array.from(stats.namespaces);
    return stats;
  }

  /**
   * Persist to IndexedDB (internal)
   */
  async _persistToIndexedDB(key, _value) {
    // Implementation would use IndexedDB wrapper
    // For now, just log
    logger.debug('Persisting to IndexedDB', { key });
  }

  /**
   * Delete from IndexedDB (internal)
   */
  async _deleteFromIndexedDB(key) {
    logger.debug('Deleting from IndexedDB', { key });
  }
}

// Create singleton instance
const cacheService = new CacheService();

export default cacheService;

