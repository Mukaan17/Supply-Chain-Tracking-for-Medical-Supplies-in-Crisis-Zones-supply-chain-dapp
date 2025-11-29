/**
 * Metrics Collection Service
 * 
 * Collects and exports metrics for monitoring systems.
 */

import logger from '../services/logging';
import analytics from './analytics';

class MetricsService {
  constructor() {
    this.metrics = new Map();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
  }

  /**
   * Increment counter
   */
  incrementCounter(name, value = 1, tags = {}) {
    const key = this._getKey(name, tags);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);

    logger.debug('Counter incremented', { name, value, tags });
  }

  /**
   * Set gauge value
   */
  setGauge(name, value, tags = {}) {
    const key = this._getKey(name, tags);
    this.gauges.set(key, { value, tags, timestamp: Date.now() });

    logger.debug('Gauge set', { name, value, tags });
  }

  /**
   * Record histogram value
   */
  recordHistogram(name, value, tags = {}) {
    const key = this._getKey(name, tags);
    const histogram = this.histograms.get(key) || [];
    histogram.push({ value, timestamp: Date.now() });
    
    // Keep only last 1000 values
    if (histogram.length > 1000) {
      histogram.shift();
    }
    
    this.histograms.set(key, histogram);

    logger.debug('Histogram recorded', { name, value, tags });
  }

  /**
   * Get counter value
   */
  getCounter(name, tags = {}) {
    const key = this._getKey(name, tags);
    return this.counters.get(key) || 0;
  }

  /**
   * Get gauge value
   */
  getGauge(name, tags = {}) {
    const key = this._getKey(name, tags);
    const gauge = this.gauges.get(key);
    return gauge ? gauge.value : null;
  }

  /**
   * Get histogram statistics
   */
  getHistogramStats(name, tags = {}) {
    const key = this._getKey(name, tags);
    const histogram = this.histograms.get(key) || [];
    
    if (histogram.length === 0) {
      return null;
    }

    const values = histogram.map(h => h.value).sort((a, b) => a - b);
    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / values.length;
    const median = values[Math.floor(values.length / 2)];
    const min = values[0];
    const max = values[values.length - 1];

    return {
      count: values.length,
      sum,
      mean,
      median,
      min,
      max,
    };
  }

  /**
   * Export all metrics
   */
  exportMetrics() {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(
        Array.from(this.gauges.entries()).map(([k, v]) => [k, v.value])
      ),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([k, v]) => [
          k,
          this.getHistogramStats(k.split(':')[0], {}),
        ])
      ),
    };
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    logger.info('Metrics cleared');
  }

  /**
   * Generate key from name and tags
   */
  _getKey(name, tags) {
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return tagString ? `${name}:${tagString}` : name;
  }
}

// Create singleton instance
const metricsService = new MetricsService();

export default metricsService;

