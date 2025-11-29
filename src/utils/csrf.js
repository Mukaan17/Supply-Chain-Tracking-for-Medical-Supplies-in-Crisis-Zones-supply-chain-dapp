/**
 * CSRF Protection Utilities
 * 
 * Provides CSRF token generation and validation.
 */

import logger from '../services/logging';

class CSRFService {
  constructor() {
    this.token = null;
    this.tokenExpiry = null;
    this.tokenTTL = 3600000; // 1 hour
  }

  /**
   * Generate CSRF token
   */
  generateToken() {
    const array = new Uint8Array(32);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
    } else {
      // Fallback for environments without crypto
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
    }

    const token = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    this.token = token;
    this.tokenExpiry = Date.now() + this.tokenTTL;

    // Store in sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.setItem('csrf_token', token);
        sessionStorage.setItem('csrf_token_expiry', this.tokenExpiry.toString());
      } catch (error) {
        logger.error('Failed to store CSRF token', error);
      }
    }

    logger.debug('CSRF token generated');
    return token;
  }

  /**
   * Get current token (generate if needed)
   */
  getToken() {
    // Check if token exists and is valid
    if (this.token && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.token;
    }

    // Try to load from sessionStorage
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const storedToken = sessionStorage.getItem('csrf_token');
        const storedExpiry = sessionStorage.getItem('csrf_token_expiry');

        if (storedToken && storedExpiry && Date.now() < parseInt(storedExpiry, 10)) {
          this.token = storedToken;
          this.tokenExpiry = parseInt(storedExpiry, 10);
          return this.token;
        }
      } catch (error) {
        logger.error('Failed to load CSRF token', error);
      }
    }

    // Generate new token
    return this.generateToken();
  }

  /**
   * Validate token
   */
  validateToken(token) {
    if (!token) {
      return false;
    }

    const currentToken = this.getToken();
    return token === currentToken;
  }

  /**
   * Clear token
   */
  clearToken() {
    this.token = null;
    this.tokenExpiry = null;

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.removeItem('csrf_token');
        sessionStorage.removeItem('csrf_token_expiry');
      } catch (error) {
        logger.error('Failed to clear CSRF token', error);
      }
    }
  }
}

// Create singleton instance
const csrfService = new CSRFService();

// Auto-generate token on init
if (typeof window !== 'undefined') {
  csrfService.getToken();
}

export default csrfService;

