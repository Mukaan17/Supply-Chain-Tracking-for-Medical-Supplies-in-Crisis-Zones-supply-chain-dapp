/**
 * Transaction Manager Service
 * 
 * Manages transaction queue, nonce tracking, retry logic, and transaction history.
 */

// ethers available if needed for type checking or future use
// import { ethers } from 'ethers';
import config from '../config';
import logger from './logging';
import errorTracking from './errorTracking';

// Transaction status
export const TransactionStatus = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  TIMEOUT: 'timeout',
  CANCELLED: 'cancelled',
};

// Transaction entry
class TransactionEntry {
  constructor(id, transaction, metadata = {}) {
    this.id = id;
    this.transaction = transaction;
    this.hash = transaction.hash;
    this.status = TransactionStatus.PENDING;
    this.metadata = {
      method: metadata.method || 'unknown',
      params: metadata.params || {},
      description: metadata.description || '',
      timestamp: Date.now(),
      ...metadata,
    };
    this.submittedAt = null;
    this.confirmedAt = null;
    this.blockNumber = null;
    this.gasUsed = null;
    this.error = null;
    this.retryCount = 0;
    this.nonce = null;
  }

  toJSON() {
    return {
      id: this.id,
      hash: this.hash,
      status: this.status,
      metadata: this.metadata,
      submittedAt: this.submittedAt,
      confirmedAt: this.confirmedAt,
      blockNumber: this.blockNumber,
      gasUsed: this.gasUsed,
      error: this.error ? {
        message: this.error.message,
        code: this.error.code,
      } : null,
      retryCount: this.retryCount,
      nonce: this.nonce,
    };
  }
}

/**
 * Transaction Manager Class
 */
class TransactionManager {
  constructor() {
    this.queue = [];
    this.history = [];
    this.maxHistorySize = 1000;
    this.processing = false;
    this.nonceTracker = new Map(); // address -> nextNonce
    this.provider = null;
    this.signer = null;
  }

  /**
   * Initialize with provider and signer
   */
  init(provider, signer) {
    this.provider = provider;
    this.signer = signer;
    logger.info('Transaction manager initialized', { 
      address: signer?.address,
    });
  }

  /**
   * Update provider and signer
   */
  async updateProvider(provider, signer) {
    const oldAddress = this.signer?.address;
    const newAddress = signer?.address;
    
    this.provider = provider;
    this.signer = signer;
    
    // Reset nonce tracker on account change
    if (newAddress && newAddress !== oldAddress) {
      this.nonceTracker.clear();
      // Sync nonce for new account
      if (newAddress) {
        await this.syncNonce(newAddress);
      }
    } else if (newAddress && newAddress === oldAddress) {
      // Same account, just sync nonce to ensure accuracy
      await this.syncNonce(newAddress);
    }
    
    logger.info('Transaction manager provider updated', {
      address: signer?.address,
    });
  }

  /**
   * Get next nonce for address
   */
  async getNextNonce(address) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    try {
      // Always check on-chain nonce to avoid desync
      const onChainNonce = await this.provider.getTransactionCount(address, 'pending');
      
      // Check if we have a tracked nonce
      if (this.nonceTracker.has(address)) {
        const trackedNonce = this.nonceTracker.get(address);
        
        // Use the higher of tracked or on-chain nonce to handle edge cases
        // If on-chain is higher, we've missed some transactions (reset)
        // If tracked is higher, we have pending transactions
        const nextNonce = Math.max(trackedNonce, onChainNonce);
        this.nonceTracker.set(address, nextNonce + 1);
        return nextNonce;
      }

      // First time - get from chain
      this.nonceTracker.set(address, onChainNonce + 1);
      return onChainNonce;
    } catch (error) {
      logger.error('Failed to get nonce', error, { address });
      // Fallback to tracked nonce if available
      if (this.nonceTracker.has(address)) {
        const trackedNonce = this.nonceTracker.get(address);
        this.nonceTracker.set(address, trackedNonce + 1);
        return trackedNonce;
      }
      throw error;
    }
  }

  /**
   * Sync nonce with chain (call periodically to prevent desync)
   */
  async syncNonce(address) {
    if (!this.provider || !address) {
      return;
    }

    try {
      const onChainNonce = await this.provider.getTransactionCount(address, 'pending');
      const trackedNonce = this.nonceTracker.get(address) || 0;
      
      // If on-chain is significantly higher, reset tracker
      if (onChainNonce > trackedNonce + 10) {
        logger.warn('Nonce desync detected, resetting tracker', {
          address,
          onChainNonce,
          trackedNonce,
        });
        this.nonceTracker.set(address, onChainNonce);
      } else if (onChainNonce > trackedNonce) {
        // Update to on-chain nonce
        this.nonceTracker.set(address, onChainNonce);
      }
    } catch (error) {
      logger.error('Failed to sync nonce', error, { address });
    }
  }

  /**
   * Add transaction to queue
   */
  async addTransaction(transactionPromise, metadata = {}) {
    if (!this.signer) {
      throw new Error('Signer not initialized');
    }

    const id = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Wait for transaction to be created
      const transaction = await transactionPromise;
      
      const entry = new TransactionEntry(id, transaction, {
        ...metadata,
        from: this.signer.address,
      });

      // Get and set nonce
      entry.nonce = transaction.nonce;
      if (entry.nonce !== null) {
        this.nonceTracker.set(this.signer.address, entry.nonce + 1);
      }

      this.queue.push(entry);
      this.history.push(entry);

      // Trim history
      if (this.history.length > this.maxHistorySize) {
        this.history.shift();
      }

      logger.info('Transaction added to queue', {
        id: entry.id,
        hash: entry.hash,
        method: entry.metadata.method,
      });

      // Start processing if not already processing
      if (!this.processing) {
        this.processQueue();
      }

      return entry;
    } catch (error) {
      logger.error('Failed to add transaction to queue', error, metadata);
      errorTracking.captureException(error, {
        tags: { component: 'transactionManager' },
        extra: { metadata },
      });
      throw error;
    }
  }

  /**
   * Process transaction queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const entry = this.queue[0];

      try {
        await this.processTransaction(entry);
        this.queue.shift(); // Remove from queue after processing
      } catch (error) {
        logger.error('Failed to process transaction', error, {
          id: entry.id,
          hash: entry.hash,
        });
        
        // Check if error is retryable (timeout, network error)
        // Don't retry on transaction revert or other non-retryable errors
        const isRetryable = this.isRetryableError(error);
        
        if (isRetryable && entry.retryCount < config.transaction.maxRetryAttempts) {
          entry.retryCount++;
          logger.info('Retrying transaction', {
            id: entry.id,
            retryCount: entry.retryCount,
            error: error.message,
          });
          
          // Exponential backoff
          const delay = config.transaction.retryDelay * Math.pow(2, entry.retryCount - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
          
          // Reset status to allow retry
          entry.status = TransactionStatus.PENDING;
          entry.error = null;
        } else {
          // Mark as failed and remove from queue
          entry.status = TransactionStatus.FAILED;
          entry.error = error;
          this.queue.shift();
          
          logger.error('Transaction failed permanently', {
            id: entry.id,
            hash: entry.hash,
            retryCount: entry.retryCount,
            error: error.message,
          });
        }
      }
    }

    this.processing = false;
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error to check
   * @returns {boolean} True if error is retryable
   */
  isRetryableError(error) {
    if (!error) return false;
    
    const message = error.message?.toLowerCase() || '';
    const code = error.code || error.error?.code;
    
    // Retryable errors: timeouts, network issues, rate limits
    const retryablePatterns = [
      'timeout',
      'network',
      'connection',
      'econnrefused',
      'etimedout',
      'rate limit',
      'too many requests',
    ];
    
    // Non-retryable errors: reverts, insufficient funds, invalid input
    const nonRetryablePatterns = [
      'revert',
      'execution reverted',
      'insufficient funds',
      'invalid',
      'user rejected',
      'user denied',
      'action rejected',
    ];
    
    // Check for non-retryable patterns first
    if (nonRetryablePatterns.some(pattern => message.includes(pattern))) {
      return false;
    }
    
    // Check for user rejection codes
    if (code === 4001 || code === 'ACTION_REJECTED') {
      return false;
    }
    
    // Check for retryable patterns
    if (retryablePatterns.some(pattern => message.includes(pattern))) {
      return true;
    }
    
    // Default: don't retry unknown errors
    return false;
  }

  /**
   * Process individual transaction
   */
  async processTransaction(entry) {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }

    entry.status = TransactionStatus.SUBMITTED;
    entry.submittedAt = Date.now();

    logger.info('Processing transaction', {
      id: entry.id,
      hash: entry.hash,
    });

    // Wait for transaction with timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Transaction timeout'));
      }, config.transaction.timeout);
    });

    try {
      const receipt = await Promise.race([
        entry.transaction.wait(),
        timeoutPromise,
      ]);

      entry.status = TransactionStatus.CONFIRMED;
      entry.confirmedAt = Date.now();
      entry.blockNumber = receipt.blockNumber;
      entry.gasUsed = receipt.gasUsed?.toString();

      logger.info('Transaction confirmed', {
        id: entry.id,
        hash: entry.hash,
        blockNumber: entry.blockNumber,
        gasUsed: entry.gasUsed,
      });
    } catch (error) {
      if (error.message === 'Transaction timeout') {
        entry.status = TransactionStatus.TIMEOUT;
      } else {
        entry.status = TransactionStatus.FAILED;
      }
      entry.error = error;
      throw error;
    }
  }

  /**
   * Get transaction by ID
   */
  getTransaction(id) {
    return this.history.find(tx => tx.id === id);
  }

  /**
   * Get transaction by hash
   */
  getTransactionByHash(hash) {
    return this.history.find(tx => tx.hash === hash);
  }

  /**
   * Get pending transactions
   */
  getPendingTransactions() {
    return this.queue.filter(tx => 
      tx.status === TransactionStatus.PENDING || 
      tx.status === TransactionStatus.SUBMITTED
    );
  }

  /**
   * Get transaction history
   */
  getHistory(limit = null) {
    if (limit === null) {
      return [...this.history];
    }
    return this.history.slice(-limit);
  }

  /**
   * Cancel transaction
   */
  cancelTransaction(id) {
    const entry = this.queue.find(tx => tx.id === id);
    if (entry) {
      entry.status = TransactionStatus.CANCELLED;
      this.queue = this.queue.filter(tx => tx.id !== id);
      logger.info('Transaction cancelled', { id: entry.id });
      return true;
    }
    return false;
  }

  /**
   * Clear queue
   */
  clearQueue() {
    this.queue.forEach(entry => {
      if (entry.status === TransactionStatus.PENDING) {
        entry.status = TransactionStatus.CANCELLED;
      }
    });
    this.queue = [];
    logger.info('Transaction queue cleared');
  }

  /**
   * Clear history
   */
  clearHistory() {
    this.history = [];
    logger.info('Transaction history cleared');
  }

  /**
   * Export history
   */
  exportHistory() {
    return JSON.stringify(
      this.history.map(tx => tx.toJSON()),
      null,
      2
    );
  }
}

// Create singleton instance
const transactionManager = new TransactionManager();

export default transactionManager;

