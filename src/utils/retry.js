/**
 * Retry Utility
 * 
 * Provides retry logic with exponential backoff for failed operations.
 */

import config from '../config';
import logger from '../services/logging';

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry (must return a Promise)
 * @param {Object} options - Retry options
 * @returns {Promise} Result of the function
 */
export async function retry(fn, options = {}) {
  const {
    maxAttempts = config.transaction.maxRetryAttempts,
    delay = config.transaction.retryDelay,
    exponentialBackoff = true,
    onRetry = null,
    shouldRetry = null,
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      if (attempt > 1) {
        logger.info('Retry succeeded', { attempt, maxAttempts });
      }
      return result;
    } catch (error) {
      lastError = error;

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error, attempt)) {
        throw error;
      }

      // Don't retry on last attempt
      if (attempt >= maxAttempts) {
        logger.error('Max retry attempts reached', error, {
          attempt,
          maxAttempts,
        });
        throw error;
      }

      // Calculate delay with exponential backoff
      const currentDelay = exponentialBackoff
        ? delay * Math.pow(2, attempt - 1)
        : delay;

      logger.warn('Retrying operation', {
        attempt,
        maxAttempts,
        delay: currentDelay,
        error: error.message,
      });

      if (onRetry) {
        onRetry(error, attempt, currentDelay);
      }

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, currentDelay));
    }
  }

  throw lastError;
}

/**
 * Retry with specific error conditions
 */
export function retryOnError(fn, errorConditions = [], options = {}) {
  return retry(fn, {
    ...options,
    shouldRetry: (error, attempt) => {
      // Check if error matches any condition
      return errorConditions.some(condition => {
        if (typeof condition === 'string') {
          return error.message?.includes(condition);
        }
        if (condition instanceof RegExp) {
          return condition.test(error.message);
        }
        if (typeof condition === 'function') {
          return condition(error);
        }
        return false;
      });
    },
  });
}

/**
 * Retry network requests
 */
export function retryNetwork(fn, options = {}) {
  const networkErrors = [
    'network error',
    'timeout',
    'ECONNRESET',
    'ENOTFOUND',
    'ETIMEDOUT',
  ];

  return retryOnError(fn, networkErrors, {
    maxAttempts: 3,
    delay: 1000,
    ...options,
  });
}

export default {
  retry,
  retryOnError,
  retryNetwork,
};

