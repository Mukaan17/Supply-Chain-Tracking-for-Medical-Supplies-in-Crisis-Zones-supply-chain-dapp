/**
 * IndexedDB Wrapper
 * 
 * Provides a simple interface for IndexedDB operations.
 */

import logger from '../services/logging';

const DB_NAME = 'SupplyChainDB';
const DB_VERSION = 1;
const STORES = {
  TRANSACTIONS: 'transactions',
  CACHE: 'cache',
  PACKAGES: 'packages',
};

class IndexedDBService {
  constructor() {
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize database
   */
  async init() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      logger.warn('IndexedDB not available');
      return false;
    }

    if (this.initialized && this.db) {
      return true;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        logger.error('IndexedDB open failed', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.initialized = true;
        logger.info('IndexedDB initialized');
        resolve(true);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores
        if (!db.objectStoreNames.contains(STORES.TRANSACTIONS)) {
          const txStore = db.createObjectStore(STORES.TRANSACTIONS, {
            keyPath: 'id',
          });
          txStore.createIndex('hash', 'hash', { unique: true });
          txStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.CACHE)) {
          const cacheStore = db.createObjectStore(STORES.CACHE, {
            keyPath: 'key',
          });
          cacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(STORES.PACKAGES)) {
          const packageStore = db.createObjectStore(STORES.PACKAGES, {
            keyPath: 'id',
          });
          packageStore.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Get value from store
   */
  async get(storeName, key) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Set value in store
   */
  async set(storeName, value) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete value from store
   */
  async delete(storeName, key) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all values from store
   */
  async getAll(storeName, indexName = null) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = indexName
        ? store.index(indexName).getAll()
        : store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear store
   */
  async clear(storeName) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Ensure database is initialized
   */
  async ensureInit() {
    if (!this.initialized) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('IndexedDB not available');
    }
  }

  /**
   * Save transaction
   */
  async saveTransaction(transaction) {
    return this.set(STORES.TRANSACTIONS, {
      ...transaction,
      timestamp: Date.now(),
    });
  }

  /**
   * Get transaction by hash
   */
  async getTransactionByHash(hash) {
    await this.ensureInit();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORES.TRANSACTIONS], 'readonly');
      const store = transaction.objectStore(STORES.TRANSACTIONS);
      const index = store.index('hash');
      const request = index.get(hash);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get recent transactions
   */
  async getRecentTransactions(limit = 50) {
    const all = await this.getAll(STORES.TRANSACTIONS, 'timestamp');
    return all
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  /**
   * Save package data
   */
  async savePackage(packageData) {
    return this.set(STORES.PACKAGES, {
      ...packageData,
      timestamp: Date.now(),
    });
  }

  /**
   * Get package
   */
  async getPackage(id) {
    return this.get(STORES.PACKAGES, id);
  }
}

// Create singleton instance
const indexedDB = new IndexedDBService();

// Auto-initialize
if (typeof window !== 'undefined') {
  indexedDB.init().catch(err => {
    logger.error('Failed to initialize IndexedDB', err);
  });
}

export default indexedDB;
export { STORES };

