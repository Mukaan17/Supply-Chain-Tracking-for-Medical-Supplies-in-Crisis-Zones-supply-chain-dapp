/**
 * Analytics Service
 * 
 * Provides analytics tracking for user behavior, events, and performance metrics.
 * Supports multiple analytics providers (Google Analytics, Mixpanel, Amplitude).
 */

import config from '../config';
import logger from './logging';

class AnalyticsService {
  constructor() {
    this.enabled = config.features.analytics && config.services.analytics.enabled;
    this.providers = [];
    this.userId = null;
    this.userProperties = {};
  }

  /**
   * Initialize analytics
   */
  init() {
    if (!this.enabled) {
      logger.debug('Analytics disabled');
      return;
    }

    try {
      // Initialize Google Analytics if configured
      if (config.services.analytics.id && typeof window !== 'undefined') {
        this.initGoogleAnalytics();
      }

      logger.info('Analytics initialized', { enabled: this.enabled });
    } catch (error) {
      logger.error('Failed to initialize analytics', error);
      this.enabled = false;
    }
  }

  /**
   * Initialize Google Analytics
   */
  initGoogleAnalytics() {
    if (typeof window === 'undefined' || !window.gtag) {
      // Load Google Analytics script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${config.services.analytics.id}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      window.gtag = function() {
        window.dataLayer.push(arguments);
      };
      window.gtag('js', new Date());
      window.gtag('config', config.services.analytics.id, {
        page_path: window.location.pathname,
      });
    }
  }

  /**
   * Track event
   */
  trackEvent(eventName, properties = {}) {
    if (!this.enabled) return;

    try {
      const eventData = {
        ...properties,
        timestamp: new Date().toISOString(),
        userId: this.userId,
      };

      // Google Analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', eventName, eventData);
      }

      logger.debug('Analytics event tracked', { eventName, properties: eventData });
    } catch (error) {
      logger.error('Failed to track event', error);
    }
  }

  /**
   * Track page view
   */
  trackPageView(pageName, properties = {}) {
    if (!this.enabled) return;

    try {
      const pageData = {
        page_title: pageName,
        page_location: typeof window !== 'undefined' ? window.location.href : '',
        ...properties,
      };

      // Google Analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('config', config.services.analytics.id, {
          page_path: pageName,
          ...pageData,
        });
      }

      logger.debug('Page view tracked', { pageName, properties: pageData });
    } catch (error) {
      logger.error('Failed to track page view', error);
    }
  }

  /**
   * Set user ID
   */
  setUserId(userId) {
    this.userId = userId;

    if (!this.enabled) return;

    try {
      // Google Analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('set', { user_id: userId });
      }

      logger.debug('User ID set', { userId });
    } catch (error) {
      logger.error('Failed to set user ID', error);
    }
  }

  /**
   * Set user properties
   */
  setUserProperties(properties) {
    this.userProperties = { ...this.userProperties, ...properties };

    if (!this.enabled) return;

    try {
      // Google Analytics
      if (typeof window !== 'undefined' && window.gtag) {
        Object.entries(properties).forEach(([key, value]) => {
          window.gtag('set', { [key]: value });
        });
      }

      logger.debug('User properties set', { properties });
    } catch (error) {
      logger.error('Failed to set user properties', error);
    }
  }

  /**
   * Track transaction
   */
  trackTransaction(transactionHash, value = null, currency = 'ETH') {
    if (!this.enabled) return;

    try {
      const transactionData = {
        transaction_id: transactionHash,
        value: value,
        currency: currency,
      };

      // Google Analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'purchase', transactionData);
      }

      this.trackEvent('transaction_completed', transactionData);
    } catch (error) {
      logger.error('Failed to track transaction', error);
    }
  }

  /**
   * Track error
   */
  trackError(error, context = {}) {
    if (!this.enabled) return;

    try {
      this.trackEvent('error_occurred', {
        error_message: error.message,
        error_name: error.name,
        error_stack: error.stack,
        ...context,
      });
    } catch (err) {
      logger.error('Failed to track error', err);
    }
  }

  /**
   * Track performance metric
   */
  trackPerformance(metricName, value, unit = 'ms') {
    if (!this.enabled) return;

    try {
      this.trackEvent('performance_metric', {
        metric_name: metricName,
        value: value,
        unit: unit,
      });
    } catch (error) {
      logger.error('Failed to track performance metric', error);
    }
  }

  /**
   * Clear user data
   */
  clearUser() {
    this.userId = null;
    this.userProperties = {};

    if (!this.enabled) return;

    try {
      // Google Analytics
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('set', { user_id: null });
      }
    } catch (error) {
      logger.error('Failed to clear user data', error);
    }
  }
}

// Create singleton instance
const analytics = new AnalyticsService();

// Initialize on import if enabled
if (analytics.enabled) {
  analytics.init();
}

export default analytics;

