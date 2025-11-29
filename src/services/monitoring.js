/**
 * Monitoring Service
 * 
 * Provides Application Performance Monitoring (APM) and Real User Monitoring (RUM).
 */

import logger from '../services/logging';
import analytics from './analytics';
import performanceMonitor from '../utils/performance';

class MonitoringService {
  constructor() {
    this.enabled = true;
    this.metrics = {};
    this.errors = [];
    this.maxErrors = 100;
  }

  /**
   * Track page view
   */
  trackPageView(pageName, properties = {}) {
    if (!this.enabled) return;

    const startTime = performance.now();
    
    // Track in analytics
    analytics.trackPageView(pageName, properties);

    // Measure page load time
    window.addEventListener('load', () => {
      const loadTime = performance.now() - startTime;
      this.recordMetric('page_load_time', loadTime, {
        page: pageName,
        ...properties,
      });
    });

    logger.debug('Page view tracked', { page: pageName });
  }

  /**
   * Record custom metric
   */
  recordMetric(name, value, tags = {}) {
    if (!this.enabled) return;

    this.metrics[name] = {
      value,
      tags,
      timestamp: Date.now(),
    };

    // Track in analytics
    analytics.trackPerformance(name, value);

    logger.debug('Metric recorded', { name, value, tags });
  }

  /**
   * Track error
   */
  trackError(error, context = {}) {
    if (!this.enabled) return;

    const errorEntry = {
      message: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
    };

    this.errors.push(errorEntry);

    // Keep only last N errors
    if (this.errors.length > this.maxErrors) {
      this.errors.shift();
    }

    logger.error('Error tracked', error, context);
  }

  /**
   * Track API call
   */
  trackAPICall(url, method, duration, status, error = null) {
    if (!this.enabled) return;

    this.recordMetric('api_call', duration, {
      url,
      method,
      status,
      error: error ? error.message : null,
    });

    if (error) {
      this.trackError(error, { url, method, status });
    }
  }

  /**
   * Track transaction
   */
  trackTransaction(hash, duration, status, gasUsed = null) {
    if (!this.enabled) return;

    this.recordMetric('transaction', duration, {
      hash,
      status,
      gasUsed,
    });
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary() {
    return {
      metrics: { ...this.metrics },
      errorCount: this.errors.length,
      recentErrors: this.errors.slice(-10),
    };
  }

  /**
   * Clear metrics
   */
  clearMetrics() {
    this.metrics = {};
    this.errors = [];
  }
}

// Create singleton instance
const monitoringService = new MonitoringService();

export default monitoringService;

