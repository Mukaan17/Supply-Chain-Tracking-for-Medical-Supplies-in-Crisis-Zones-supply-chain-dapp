/**
 * Health Check Utilities
 * 
 * Provides health check endpoints and dependency verification.
 */

import logger from '../services/logging';

class HealthCheckService {
  constructor() {
    this.checks = new Map();
  }

  /**
   * Register health check
   */
  registerCheck(name, checkFunction) {
    this.checks.set(name, checkFunction);
    logger.debug('Health check registered', { name });
  }

  /**
   * Run all health checks
   */
  async runAllChecks() {
    const results = {};
    const checks = Array.from(this.checks.entries());

    for (const [name, checkFunction] of checks) {
      try {
        const result = await checkFunction();
        results[name] = {
          status: result.status || 'healthy',
          message: result.message || 'OK',
          data: result.data || {},
        };
      } catch (error) {
        results[name] = {
          status: 'unhealthy',
          message: error.message,
          error: error.toString(),
        };
      }
    }

    const allHealthy = Object.values(results).every(r => r.status === 'healthy');

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks: results,
    };
  }

  /**
   * Run specific health check
   */
  async runCheck(name) {
    const checkFunction = this.checks.get(name);
    if (!checkFunction) {
      throw new Error(`Health check "${name}" not found`);
    }

    try {
      return await checkFunction();
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message,
      };
    }
  }

  /**
   * Check contract connectivity
   */
  async checkContract(contract) {
    if (!contract) {
      return { status: 'unhealthy', message: 'Contract not initialized' };
    }

    try {
      // Try to call a view function
      await contract.getTotalPackages();
      return { status: 'healthy', message: 'Contract accessible' };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Contract check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check provider connectivity
   */
  async checkProvider(provider) {
    if (!provider) {
      return { status: 'unhealthy', message: 'Provider not initialized' };
    }

    try {
      const blockNumber = await provider.getBlockNumber();
      return {
        status: 'healthy',
        message: 'Provider accessible',
        data: { blockNumber },
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Provider check failed: ${error.message}`,
      };
    }
  }

  /**
   * Check IndexedDB
   */
  async checkIndexedDB() {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return { status: 'unhealthy', message: 'IndexedDB not available' };
    }

    try {
      // Try to open a test database
      return new Promise((resolve) => {
        const request = indexedDB.open('health_check_test', 1);
        request.onsuccess = () => {
          request.result.close();
          indexedDB.deleteDatabase('health_check_test');
          resolve({ status: 'healthy', message: 'IndexedDB accessible' });
        };
        request.onerror = () => {
          resolve({ status: 'unhealthy', message: 'IndexedDB error' });
        };
      });
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `IndexedDB check failed: ${error.message}`,
      };
    }
  }
}

// Create singleton instance
const healthCheckService = new HealthCheckService();

export default healthCheckService;

