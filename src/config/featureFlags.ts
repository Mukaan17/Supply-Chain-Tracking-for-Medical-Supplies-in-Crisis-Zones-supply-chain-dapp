/**
 * Feature Flags Configuration
 * 
 * Manages feature toggles for gradual rollout and A/B testing.
 */

import config from './index';

// Helper function to get boolean env var
function getBoolEnvVar(name: string, defaultValue: boolean = false): boolean {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes';
}

export interface FeatureFlag {
  enabled: boolean;
  description: string;
}

export interface FeatureFlags {
  [key: string]: FeatureFlag;
}

// Feature flag definitions
const featureFlags: FeatureFlags = {
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
    enabled: getBoolEnvVar('REACT_APP_ENABLE_DARK_MODE', true),
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

/**
 * Check if a feature is enabled
 */
export function isFeatureEnabled(featureName: string): boolean {
  const flag = featureFlags[featureName];
  if (!flag) {
    console.warn(`Feature flag "${featureName}" not found`);
    return false;
  }
  return flag.enabled === true;
}

/**
 * Get feature flag configuration
 */
export function getFeatureFlag(featureName: string): FeatureFlag | null {
  return featureFlags[featureName] || null;
}

/**
 * Get all feature flags
 */
export function getAllFeatureFlags(): FeatureFlags {
  return featureFlags;
}

/**
 * Get enabled feature flags
 */
export function getEnabledFeatures(): FeatureFlags {
  return Object.entries(featureFlags)
    .filter(([_, flag]) => flag.enabled)
    .reduce((acc, [name, flag]) => {
      acc[name] = flag;
      return acc;
    }, {} as FeatureFlags);
}

/**
 * Enable a feature flag (runtime override)
 */
export function enableFeature(featureName: string): void {
  if (featureFlags[featureName]) {
    featureFlags[featureName].enabled = true;
  } else {
    console.warn(`Feature flag "${featureName}" not found`);
  }
}

/**
 * Disable a feature flag (runtime override)
 */
export function disableFeature(featureName: string): void {
  if (featureFlags[featureName]) {
    featureFlags[featureName].enabled = false;
  } else {
    console.warn(`Feature flag "${featureName}" not found`);
  }
}

/**
 * Check multiple features at once
 */
export function checkFeatures(featureNames: string[]): { [key: string]: boolean } {
  return featureNames.reduce((acc, name) => {
    acc[name] = isFeatureEnabled(name);
    return acc;
  }, {} as { [key: string]: boolean });
}

/**
 * A/B Testing Configuration
 */
interface ABTest {
  enabled: boolean;
  variants: string[];
  defaultVariant: string;
}

const abTests: { [key: string]: ABTest } = {
  // Example A/B test
  transactionUI: {
    enabled: getBoolEnvVar('REACT_APP_AB_TEST_TX_UI', false),
    variants: ['A', 'B'],
    defaultVariant: 'A',
  },
};

/**
 * Get A/B test variant for a user
 */
export function getABTestVariant(testName: string, userId?: string): string {
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

