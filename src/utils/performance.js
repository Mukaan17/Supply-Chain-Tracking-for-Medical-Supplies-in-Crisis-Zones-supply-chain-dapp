/**
 * Performance Monitoring Utilities
 * 
 * Tracks Web Vitals and performance metrics.
 */

// Web Vitals - optional import (install with: npm install web-vitals)
// import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
import logger from '../services/logging';
import analytics from '../services/analytics';

class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.observers = [];
  }

  /**
   * Initialize performance monitoring
   */
  init() {
    if (typeof window === 'undefined') return;

    // Web Vitals - uncomment when web-vitals package is installed
    // try {
    //   const { getCLS, getFID, getFCP, getLCP, getTTFB } = require('web-vitals');
    //   getCLS(this.handleMetric.bind(this));
    //   getFID(this.handleMetric.bind(this));
    //   getFCP(this.handleMetric.bind(this));
    //   getLCP(this.handleMetric.bind(this));
    //   getTTFB(this.handleMetric.bind(this));
    // } catch (e) {
    //   logger.warn('web-vitals not installed, skipping Web Vitals tracking');
    // }

    // Performance API
    this.observeNavigationTiming();
    this.observeResourceTiming();

    logger.info('Performance monitoring initialized');
  }

  /**
   * Handle Web Vitals metric
   */
  handleMetric(metric) {
    this.metrics[metric.name] = {
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
    };

    logger.debug('Performance metric', {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
    });

    // Track in analytics
    analytics.trackPerformance(metric.name, metric.value, 'ms');
  }

  /**
   * Observe navigation timing
   */
  observeNavigationTiming() {
    if (!window.performance || !window.performance.timing) return;

    window.addEventListener('load', () => {
      const timing = window.performance.timing;
      const navigation = {
        dns: timing.domainLookupEnd - timing.domainLookupStart,
        tcp: timing.connectEnd - timing.connectStart,
        request: timing.responseStart - timing.requestStart,
        response: timing.responseEnd - timing.responseStart,
        dom: timing.domContentLoadedEventEnd - timing.responseEnd,
        load: timing.loadEventEnd - timing.navigationStart,
      };

      this.metrics.navigation = navigation;
      logger.debug('Navigation timing', navigation);
    });
  }

  /**
   * Observe resource timing
   */
  observeResourceTiming() {
    if (!window.performance || !window.performance.getEntriesByType) return;

    try {
      const resources = window.performance.getEntriesByType('resource');
      const resourceTiming = resources.map(resource => ({
        name: resource.name,
        duration: resource.duration,
        size: resource.transferSize,
        type: resource.initiatorType,
      }));

      this.metrics.resources = resourceTiming;
      logger.debug('Resource timing', { count: resourceTiming.length });
    } catch (error) {
      logger.error('Failed to get resource timing', error);
    }
  }

  /**
   * Measure function execution time
   */
  async measureFunction(name, fn) {
    const start = performance.now();
    try {
      const result = await fn();
      const duration = performance.now() - start;
      
      this.metrics[`function_${name}`] = duration;
      logger.debug('Function performance', { name, duration });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      logger.error('Function performance error', error, { name, duration });
      throw error;
    }
  }

  /**
   * Get all metrics
   */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
   * Get specific metric
   */
  getMetric(name) {
    return this.metrics[name];
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    this.metrics = {};
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Auto-initialize
if (typeof window !== 'undefined') {
  performanceMonitor.init();
}

export default performanceMonitor;

