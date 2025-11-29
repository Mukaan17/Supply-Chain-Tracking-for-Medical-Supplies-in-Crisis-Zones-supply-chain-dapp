/**
 * Error Tracking Service
 * 
 * Integrates with error tracking services (Sentry) for production error monitoring.
 */

import * as Sentry from '@sentry/react';
import config from '../config';
import logger from './logging';

class ErrorTrackingService {
  constructor() {
    this.initialized = false;
    this.enabled = config.services.sentry.enabled && config.services.sentry.dsn;
  }

  /**
   * Initialize error tracking
   */
  init() {
    if (!this.enabled || this.initialized) {
      return;
    }

    try {
      Sentry.init({
        dsn: config.services.sentry.dsn,
        environment: config.services.sentry.environment,
        release: `supply-chain-dapp@${config.app.version}`,
        integrations: [
          new Sentry.BrowserTracing(),
          new Sentry.Replay({
            maskAllText: true,
            blockAllMedia: true,
          }),
        ],
        tracesSampleRate: config.app.environment === 'production' ? 0.1 : 1.0,
        replaysSessionSampleRate: 0.1,
        replaysOnErrorSampleRate: 1.0,
        beforeSend(event, hint) {
          // Filter out known non-critical errors
          if (event.exception) {
            const error = hint.originalException;
            if (error && error.message) {
              // Filter out user rejection errors
              if (error.message.includes('User rejected') ||
                  error.message.includes('user denied') ||
                  error.message.includes('User cancelled')) {
                return null; // Don't send to Sentry
              }
            }
          }
          return event;
        },
      });

      this.initialized = true;
      logger.info('Error tracking initialized', { service: 'Sentry' });
    } catch (error) {
      logger.error('Failed to initialize error tracking', error);
      this.enabled = false;
    }
  }

  /**
   * Capture exception
   */
  captureException(error, context = {}) {
    if (!this.enabled) {
      logger.error('Error (not tracked):', error, context);
      return;
    }

    try {
      Sentry.withScope(scope => {
        // Add context
        if (context.user) {
          scope.setUser(context.user);
        }
        if (context.tags) {
          Object.entries(context.tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });
        }
        if (context.extra) {
          Object.entries(context.extra).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }

        Sentry.captureException(error);
      });
    } catch (err) {
      logger.error('Failed to capture exception', err);
    }
  }

  /**
   * Capture message
   */
  captureMessage(message, level = 'info', context = {}) {
    if (!this.enabled) {
      logger.warn(`Message (not tracked): ${message}`, context);
      return;
    }

    try {
      Sentry.withScope(scope => {
        if (context.user) {
          scope.setUser(context.user);
        }
        if (context.tags) {
          Object.entries(context.tags).forEach(([key, value]) => {
            scope.setTag(key, value);
          });
        }
        if (context.extra) {
          Object.entries(context.extra).forEach(([key, value]) => {
            scope.setExtra(key, value);
          });
        }

        Sentry.captureMessage(message, level);
      });
    } catch (err) {
      logger.error('Failed to capture message', err);
    }
  }

  /**
   * Set user context
   */
  setUser(user) {
    if (!this.enabled) return;

    try {
      Sentry.setUser({
        id: user.address || user.id,
        address: user.address,
        username: user.username,
      });
    } catch (err) {
      logger.error('Failed to set user context', err);
    }
  }

  /**
   * Clear user context
   */
  clearUser() {
    if (!this.enabled) return;

    try {
      Sentry.setUser(null);
    } catch (err) {
      logger.error('Failed to clear user context', err);
    }
  }

  /**
   * Add breadcrumb
   */
  addBreadcrumb(breadcrumb) {
    if (!this.enabled) return;

    try {
      Sentry.addBreadcrumb(breadcrumb);
    } catch (err) {
      logger.error('Failed to add breadcrumb', err);
    }
  }

  /**
   * Set tag
   */
  setTag(key, value) {
    if (!this.enabled) return;

    try {
      Sentry.setTag(key, value);
    } catch (err) {
      logger.error('Failed to set tag', err);
    }
  }

  /**
   * Set context
   */
  setContext(name, context) {
    if (!this.enabled) return;

    try {
      Sentry.setContext(name, context);
    } catch (err) {
      logger.error('Failed to set context', err);
    }
  }
}

// Create singleton instance
const errorTracking = new ErrorTrackingService();

// Initialize on import if enabled
if (errorTracking.enabled) {
  errorTracking.init();
}

export default errorTracking;

