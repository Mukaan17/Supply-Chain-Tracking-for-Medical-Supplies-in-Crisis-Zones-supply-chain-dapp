/**
 * Structured Logging Service
 * 
 * Provides structured logging with log levels, environment-based filtering,
 * and integration with external logging services.
 */

import config from '../config';

// Log levels
export const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  NONE: 4,
};

// Log level names
const logLevelNames = {
  [LogLevel.DEBUG]: 'DEBUG',
  [LogLevel.INFO]: 'INFO',
  [LogLevel.WARN]: 'WARN',
  [LogLevel.ERROR]: 'ERROR',
};

// Get log level from environment or config
function getLogLevel() {
  const envLevel = process.env.REACT_APP_LOG_LEVEL?.toUpperCase();
  const levelMap = {
    DEBUG: LogLevel.DEBUG,
    INFO: LogLevel.INFO,
    WARN: LogLevel.WARN,
    ERROR: LogLevel.ERROR,
    NONE: LogLevel.NONE,
  };
  return levelMap[envLevel] ?? (config.app.environment === 'production' ? LogLevel.INFO : LogLevel.DEBUG);
}

const currentLogLevel = getLogLevel();
const isDevelopment = config.app.environment === 'development';
// const isProduction = config.app.environment === 'production'; // Unused

/**
 * Log entry structure
 */
class LogEntry {
  constructor(level, message, data = {}, error = null) {
    this.timestamp = new Date().toISOString();
    this.level = level;
    this.levelName = logLevelNames[level];
    this.message = message;
    this.data = data;
    this.error = error;
    this.environment = config.app.environment;
    this.appVersion = config.app.version;
    
    // Add user context if available
    if (typeof window !== 'undefined' && window.ethereum?.selectedAddress) {
      this.userAddress = window.ethereum.selectedAddress;
    }
    
    // Add browser info
    if (typeof window !== 'undefined' && window.navigator) {
      this.userAgent = window.navigator.userAgent;
      this.url = window.location.href;
    }
  }

  toJSON() {
    return {
      timestamp: this.timestamp,
      level: this.levelName,
      message: this.message,
      data: this.data,
      error: this.error ? {
        message: this.error.message,
        stack: this.error.stack,
        name: this.error.name,
      } : null,
      environment: this.environment,
      appVersion: this.appVersion,
      userAddress: this.userAddress,
      url: this.url,
    };
  }

  toString() {
    const parts = [
      `[${this.timestamp}]`,
      `[${this.levelName}]`,
      this.message,
    ];
    
    if (Object.keys(this.data).length > 0) {
      parts.push(JSON.stringify(this.data));
    }
    
    if (this.error) {
      parts.push(`Error: ${this.error.message}`);
    }
    
    return parts.join(' ');
  }
}

/**
 * Logging service class
 */
class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 1000; // Keep last 1000 logs in memory
    this.externalServices = [];
  }

  /**
   * Check if log level should be logged
   */
  shouldLog(level) {
    return level >= currentLogLevel;
  }

  /**
   * Add external logging service
   */
  addExternalService(service) {
    this.externalServices.push(service);
  }

  /**
   * Remove external logging service
   */
  removeExternalService(service) {
    this.externalServices = this.externalServices.filter(s => s !== service);
  }

  /**
   * Internal log method
   */
  _log(level, message, data = {}, error = null) {
    if (!this.shouldLog(level)) {
      return;
    }

    const entry = new LogEntry(level, message, data, error);

    // Store in memory (limited)
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Console output (only in development or for errors)
    if (isDevelopment || level >= LogLevel.ERROR) {
      const consoleMethod = level === LogLevel.ERROR ? 'error' :
                           level === LogLevel.WARN ? 'warn' :
                           level === LogLevel.INFO ? 'info' : 'log';
      
      if (error) {
        // eslint-disable-next-line no-console
        console[consoleMethod](entry.toString(), error);
      } else {
        // eslint-disable-next-line no-console
        console[consoleMethod](entry.toString());
      }
    }

    // Send to external services
    this.externalServices.forEach(service => {
      try {
        service.log(entry);
      } catch (err) {
        // Don't let external service errors break logging
        // eslint-disable-next-line no-console
        console.error('External logging service error:', err);
      }
    });
  }

  /**
   * Debug log
   */
  debug(message, data = {}) {
    this._log(LogLevel.DEBUG, message, data);
  }

  /**
   * Info log
   */
  info(message, data = {}) {
    this._log(LogLevel.INFO, message, data);
  }

  /**
   * Warning log
   */
  warn(message, data = {}) {
    this._log(LogLevel.WARN, message, data);
  }

  /**
   * Error log
   */
  error(message, error = null, data = {}) {
    this._log(LogLevel.ERROR, message, data, error);
  }

  /**
   * Get logs
   */
  getLogs(level = null, limit = null) {
    let filtered = this.logs;
    
    if (level !== null) {
      filtered = filtered.filter(log => log.level === level);
    }
    
    if (limit !== null) {
      filtered = filtered.slice(-limit);
    }
    
    return filtered;
  }

  /**
   * Clear logs
   */
  clearLogs() {
    this.logs = [];
  }

  /**
   * Export logs as JSON
   */
  exportLogs() {
    return JSON.stringify(this.logs.map(log => log.toJSON()), null, 2);
  }
}

// Create singleton instance
const logger = new Logger();

// Export logger instance and methods
export default logger;

// Convenience exports
export const log = {
  debug: (message, data) => logger.debug(message, data),
  info: (message, data) => logger.info(message, data),
  warn: (message, data) => logger.warn(message, data),
  error: (message, error, data) => logger.error(message, error, data),
};

// Export logger instance for advanced usage
export { logger };

