/**
 * Memoization Utilities
 * 
 * Provides memoization for expensive computations.
 */

/**
 * Simple memoization function
 */
export function memoize(fn) {
  const cache = new Map();

  return function memoized(...args) {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
}

/**
 * Memoization with cache size limit
 */
export function memoizeWithLimit(fn, maxSize = 100) {
  const cache = new Map();

  return function memoized(...args) {
    const key = JSON.stringify(args);
    
    if (cache.has(key)) {
      // Move to end (LRU)
      const value = cache.get(key);
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    const result = fn(...args);

    // Evict oldest if at limit
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }

    cache.set(key, result);
    return result;
  };
}

/**
 * Memoization with TTL (time to live)
 */
export function memoizeWithTTL(fn, ttl = 60000) {
  const cache = new Map();

  return function memoized(...args) {
    const key = JSON.stringify(args);
    const now = Date.now();
    
    if (cache.has(key)) {
      const { value, expiresAt } = cache.get(key);
      
      if (now < expiresAt) {
        return value;
      } else {
        cache.delete(key);
      }
    }

    const result = fn(...args);
    cache.set(key, {
      value: result,
      expiresAt: now + ttl,
    });
    
    return result;
  };
}

/**
 * Clear memoization cache
 */
export function clearMemoCache(memoizedFn) {
  if (memoizedFn && memoizedFn.cache) {
    memoizedFn.cache.clear();
  }
}

export default {
  memoize,
  memoizeWithLimit,
  memoizeWithTTL,
  clearMemoCache,
};

