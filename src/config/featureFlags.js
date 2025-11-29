/**
 * Feature Flags Configuration
 * 
 * Manages feature toggles for gradual rollout and A/B testing.
 */

import config from './index';

// Feature flag definitions
const featureFlags = {
  // UI Features
  showGasEstimate: {
    enabled: config.features.gasEstimation,
    description: 'Show gas estimation in transaction UI',
  },
  showTransactionQueue: {
    enabled: config.features.transactionQueue,
    description: 'Show transaction queue component',
  },
  enableDarkMode: {
    enabled: getBoolEnvVar('REACT_APP_ENABLE_DARK_MODE', false),
    description: 'Enable dark mode theme',
  },
  
  // Functionality Features
  enableOfflineMode: {
    enabled: config.features.offlineMode,
    description: 'Enable offline transaction queuing',
  },
  enableWebSocket: {
    enabled: config.features.websocket,
    description: 'Enable WebSocket for real-time updates',
  },
  enableAnalytics: {
    enabled: config.features.analytics,
    description: 'Enable user analytics tracking',
  },
  enableErrorTracking: {
    enabled: config.features.errorTracking,
    description: 'Enable error tracking (Sentry)',
  },
  
  // Experimental Features
  enableBatchOperations: {
    enabled: getBoolEnvVar('REACT_APP_ENABLE_BATCH_OPS', true),
    description: 'Enable batch package operations',
  },
  enableAdvancedSearch: {
    enabled: getBoolEnvVar('REACT_APP_ENABLE_ADVANCED_SEARCH', false),
    description: 'Enable advanced search filters',
  },
  enableExport: {
    enabled: getBoolEnvVar('REACT_APP_ENABLE_EXPORT', true),
    description: 'Enable package data export',
  },
  
  // Performance Features
  enableVirtualScroll: {
    enabled: getBoolEnvVar('REACT_APP_ENABLE_VIRTUAL_SCROLL', true),
    description: 'Enable virtual scrolling for large lists',
  },
  enableCaching: {
    enabled: getBoolEnvVar('REACT_APP_ENABLE_CACHING', true),
    description: 'Enable response caching',
  },
};

// Helper function to get boolean env var
function getBoolEnvVar(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes';
}

/**
 * Check if a feature is enabled
 * @param {string} featureName - Name of the feature flag
 * @returns {boolean} True if feature is enabled
 */
export function isFeatureEnabled(featureName) {
  const flag = featureFlags[featureName];
  if (!flag) {
    console.warn(`Feature flag "${featureName}" not found`);
    return false;
  }
  return flag.enabled === true;
}

/**
 * Get feature flag configuration
 * @param {string} featureName - Name of the feature flag
 * @returns {Object|null} Feature flag configuration or null
 */
export function getFeatureFlag(featureName) {
  return featureFlags[featureName] || null;
}

/**
 * Get all feature flags
 * @returns {Object} All feature flag configurations
 */
export function getAllFeatureFlags() {
  return featureFlags;
}

/**
 * Get enabled feature flags
 * @returns {Object} Only enabled feature flags
 */
export function getEnabledFeatures() {
  return Object.entries(featureFlags)
    .filter(([_, flag]) => flag.enabled)
    .reduce((acc, [name, flag]) => {
      acc[name] = flag;
      return acc;
    }, {});
}

/**
 * Enable a feature flag (runtime override)
 * @param {string} featureName - Name of the feature flag
 */
export function enableFeature(featureName) {
  if (featureFlags[featureName]) {
    featureFlags[featureName].enabled = true;
  } else {
    console.warn(`Feature flag "${featureName}" not found`);
  }
}

/**
 * Disable a feature flag (runtime override)
 * @param {string} featureName - Name of the feature flag
 */
export function disableFeature(featureName) {
  if (featureFlags[featureName]) {
    featureFlags[featureName].enabled = false;
  } else {
    console.warn(`Feature flag "${featureName}" not found`);
  }
}

/**
 * Check multiple features at once
 * @param {string[]} featureNames - Array of feature flag names
 * @returns {Object} Object mapping feature names to enabled status
 */
export function checkFeatures(featureNames) {
  return featureNames.reduce((acc, name) => {
    acc[name] = isFeatureEnabled(name);
    return acc;
  }, {});
}

/**
 * A/B Testing Configuration
 */
const abTests = {
  // Example A/B test
  transactionUI: {
    enabled: getBoolEnvVar('REACT_APP_AB_TEST_TX_UI', false),
    variants: ['A', 'B'],
    defaultVariant: 'A',
  },
};

/**
 * Get A/B test variant for a user
 * @param {string} testName - Name of the A/B test
 * @param {string} userId - User identifier (address)
 * @returns {string} Variant name (A or B)
 */
export function getABTestVariant(testName, userId) {
  const test = abTests[testName];
  if (!test || !test.enabled) {
    return test?.defaultVariant || 'A';
  }
  
  // Simple hash-based variant assignment
  if (userId) {
    const hash = userId.split('').reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    const index = Math.abs(hash) % test.variants.length;
    return test.variants[index];
  }
  
  return test.defaultVariant;
}

export default {
  isFeatureEnabled,
  getFeatureFlag,
  getAllFeatureFlags,
  getEnabledFeatures,
  enableFeature,
  disableFeature,
  checkFeatures,
  getABTestVariant,
};

