/**
 * Config Mock
 */

export default {
  app: {
    name: 'Supply Chain Tracking dApp',
    version: '1.0.0',
    environment: 'test',
  },
  network: {
    default: 'sepolia',
    supported: ['sepolia', 'mainnet'],
  },
  contract: {
    address: '0x0000000000000000000000000000000000000000',
  },
  features: {
    analytics: false,
    errorTracking: false,
    websocket: false,
    offlineMode: true,
  },
  services: {
    sentry: {
      enabled: false,
      dsn: '',
    },
    analytics: {
      enabled: false,
    },
    websocket: {
      enabled: false,
      url: '',
    },
  },
  performance: {
    cacheTTL: 60000,
    maxCacheSize: 1000,
  },
  transaction: {
    maxRetryAttempts: 3,
    retryDelay: 1000,
    timeout: 300000,
  },
};


