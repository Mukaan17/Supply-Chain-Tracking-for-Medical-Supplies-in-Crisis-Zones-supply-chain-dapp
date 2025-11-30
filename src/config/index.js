/**
 * Centralized Configuration Module
 * 
 * Provides type-safe configuration with environment variable support,
 * network abstraction, and feature flags.
 */

// Environment variable validation
const requiredEnvVars = [
  'REACT_APP_CONTRACT_ADDRESS',
];

// optionalEnvVars available for documentation purposes
// eslint-disable-next-line no-unused-vars
const optionalEnvVars = [
  'REACT_APP_NETWORK',
  'REACT_APP_ENABLE_ANALYTICS',
  'REACT_APP_ENABLE_ERROR_TRACKING',
  'REACT_APP_SENTRY_DSN',
  'REACT_APP_ANALYTICS_ID',
  'REACT_APP_ENABLE_WEBSOCKET',
  'REACT_APP_WS_URL',
  'REACT_APP_API_URL',
  'REACT_APP_ENABLE_OFFLINE_MODE',
  'REACT_APP_CACHE_TTL',
  'REACT_APP_MAX_RETRY_ATTEMPTS',
  'REACT_APP_RETRY_DELAY',
  'REACT_APP_TRANSACTION_TIMEOUT',
];

// Validate required environment variables
function validateEnvVars() {
  const missing = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    console.error('Missing required environment variables:', missing);
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Warn in development
  if (missing.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn('Missing required environment variables (using defaults):', missing);
  }
}

// Get environment variable with fallback
function getEnvVar(name, defaultValue = null) {
  return process.env[name] || defaultValue;
}

// Get boolean environment variable
function getBoolEnvVar(name, defaultValue = false) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  return value === 'true' || value === '1' || value === 'yes';
}

// Get number environment variable
function getNumberEnvVar(name, defaultValue = null) {
  const value = process.env[name];
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

// Configuration object
const config = {
  // App info
  app: {
    name: 'Supply Chain Tracking dApp',
    version: '3.0.0',
    environment: process.env.NODE_ENV || 'development',
  },

  // Network configuration
  network: {
    default: getEnvVar('REACT_APP_NETWORK', 'sepolia'),
    supported: ['sepolia', 'mainnet', 'localhost', 'polygon', 'arbitrum', 'optimism'],
  },

  // Contract configuration
  contract: {
    address: getEnvVar('REACT_APP_CONTRACT_ADDRESS', ''),
    abiPath: '/contract-abi.json',
  },

  // Feature flags
  features: {
    analytics: getBoolEnvVar('REACT_APP_ENABLE_ANALYTICS', false),
    errorTracking: getBoolEnvVar('REACT_APP_ENABLE_ERROR_TRACKING', false),
    websocket: getBoolEnvVar('REACT_APP_ENABLE_WEBSOCKET', false),
    offlineMode: getBoolEnvVar('REACT_APP_ENABLE_OFFLINE_MODE', true),
    transactionQueue: true,
    gasEstimation: true,
    retryLogic: true,
  },

  // Services configuration
  services: {
    sentry: {
      dsn: getEnvVar('REACT_APP_SENTRY_DSN', ''),
      enabled: getBoolEnvVar('REACT_APP_ENABLE_ERROR_TRACKING', false),
      environment: process.env.NODE_ENV || 'development',
    },
    analytics: {
      id: getEnvVar('REACT_APP_ANALYTICS_ID', ''),
      enabled: getBoolEnvVar('REACT_APP_ENABLE_ANALYTICS', false),
    },
    websocket: {
      url: getEnvVar('REACT_APP_WS_URL', ''),
      enabled: getBoolEnvVar('REACT_APP_ENABLE_WEBSOCKET', false),
      reconnectDelay: 3000,
      heartbeatInterval: 30000,
    },
    api: {
      url: getEnvVar('REACT_APP_API_URL', ''),
      timeout: 30000,
    },
  },

  // Performance configuration
  performance: {
    cacheTTL: getNumberEnvVar('REACT_APP_CACHE_TTL', 300000), // 5 minutes
    debounceDelay: 300,
    throttleDelay: 1000,
    maxCacheSize: 1000,
    virtualScrollThreshold: 100,
  },

  // Transaction configuration
  transaction: {
    maxRetryAttempts: getNumberEnvVar('REACT_APP_MAX_RETRY_ATTEMPTS', 3),
    retryDelay: getNumberEnvVar('REACT_APP_RETRY_DELAY', 1000),
    timeout: getNumberEnvVar('REACT_APP_TRANSACTION_TIMEOUT', 300000), // 5 minutes
    gasEstimationBuffer: 1.2, // 20% buffer
    maxQueueSize: 50,
  },

  // UI configuration
  ui: {
    theme: 'light',
    language: 'en',
    itemsPerPage: 20,
    showGasEstimate: true,
    showTransactionQueue: true,
  },

  // Security configuration
  security: {
    rateLimit: {
      enabled: true,
      maxRequests: 100,
      windowMs: 60000, // 1 minute
    },
    csp: {
      enabled: true,
    },
  },
};

// Validate configuration on load
validateEnvVars();

// Export configuration
export default config;

// Export individual config sections for convenience
export const {
  app,
  network,
  contract,
  features,
  services,
  performance,
  transaction,
  ui,
  security,
} = config;

// Export utility functions
export { getEnvVar, getBoolEnvVar, getNumberEnvVar };

