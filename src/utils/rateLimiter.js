/**
 * Rate Limiter
 * 
 * Client-side rate limiting to prevent abuse.
 */

import config from '../config';
import logger from '../services/logging';

class RateLimiter {
  constructor() {
    this.requests = new Map(); // key -> { count, resetAt }
    this.enabled = config.security.rateLimit.enabled;
    this.maxRequests = config.security.rateLimit.maxRequests;
    this.windowMs = config.security.rateLimit.windowMs;
  }

  /**
   * Check if request is allowed
   */
  isAllowed(key) {
    if (!this.enabled) {
      return true;
    }

    const now = Date.now();
    const record = this.requests.get(key);

    if (!record) {
      // First request
      this.requests.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    // Check if window has expired
    if (now >= record.resetAt) {
      // Reset window
      this.requests.set(key, {
        count: 1,
        resetAt: now + this.windowMs,
      });
      return true;
    }

    // Check if limit exceeded
    if (record.count >= this.maxRequests) {
      logger.warn('Rate limit exceeded', { key, count: record.count });
      return false;
    }

    // Increment count
    record.count++;
    this.requests.set(key, record);
    return true;
  }

  /**
   * Reset rate limit for key
   */
  reset(key) {
    this.requests.delete(key);
  }

  /**
   * Clear all rate limits
   */
  clear() {
    this.requests.clear();
  }

  /**
   * Get remaining requests for key
   */
  getRemaining(key) {
    const record = this.requests.get(key);
    if (!record) {
      return this.maxRequests;
    }

    const now = Date.now();
    if (now >= record.resetAt) {
      return this.maxRequests;
    }

    return Math.max(0, this.maxRequests - record.count);
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter();

export default rateLimiter;

