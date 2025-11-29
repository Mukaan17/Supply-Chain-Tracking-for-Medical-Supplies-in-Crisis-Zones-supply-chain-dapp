/**
 * Debounce and Throttle Utilities
 * 
 * Performance optimization helpers for limiting function execution frequency.
 */

/**
 * Debounce function - delays execution until after wait time
 */
export function debounce(func, wait = 300) {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function - limits execution to once per wait time
 */
export function throttle(func, wait = 300) {
  let inThrottle;
  let lastResult;

  return function executedFunction(...args) {
    if (!inThrottle) {
      lastResult = func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, wait);
    }
    return lastResult;
  };
}

/**
 * Debounce with immediate option
 */
export function debounceImmediate(func, wait = 300, immediate = false) {
  let timeout;

  return function executedFunction(...args) {
    const callNow = immediate && !timeout;

    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);

    if (callNow) func(...args);
  };
}

/**
 * Throttle with leading and trailing options
 */
export function throttleAdvanced(func, wait = 300, options = {}) {
  let timeout;
  let previous = 0;
  const { leading = true, trailing = true } = options;

  return function executedFunction(...args) {
    const now = Date.now();
    if (!previous && !leading) previous = now;
    const remaining = wait - (now - previous);

    if (remaining <= 0 || remaining > wait) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      previous = now;
      func(...args);
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        previous = !leading ? 0 : Date.now();
        timeout = null;
        func(...args);
      }, remaining);
    }
  };
}

export default {
  debounce,
  throttle,
  debounceImmediate,
  throttleAdvanced,
};

