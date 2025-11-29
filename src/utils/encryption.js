/**
 * Client-Side Encryption Utilities
 * 
 * Provides encryption for sensitive data (note: limited security in browser context).
 */

import logger from '../services/logging';

/**
 * Simple base64 encoding (not secure, just obfuscation)
 */
export function encodeBase64(data) {
  if (typeof data === 'object') {
    data = JSON.stringify(data);
  }
  
  if (typeof window !== 'undefined' && window.btoa) {
    return window.btoa(unescape(encodeURIComponent(data)));
  }
  
  // Node.js fallback
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(data).toString('base64');
  }
  
  throw new Error('Base64 encoding not available');
}

/**
 * Base64 decoding
 */
export function decodeBase64(encoded) {
  if (typeof window !== 'undefined' && window.atob) {
    return decodeURIComponent(escape(window.atob(encoded)));
  }
  
  // Node.js fallback
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(encoded, 'base64').toString('utf-8');
  }
  
  throw new Error('Base64 decoding not available');
}

/**
 * Simple XOR encryption (not secure, just obfuscation)
 */
export function xorEncrypt(data, key) {
  if (typeof data === 'object') {
    data = JSON.stringify(data);
  }
  
  const keyBytes = key.split('').map(c => c.charCodeAt(0));
  const dataBytes = data.split('').map(c => c.charCodeAt(0));
  
  const encrypted = dataBytes.map((byte, index) => {
    return byte ^ keyBytes[index % keyBytes.length];
  });
  
  return encrypted.map(b => String.fromCharCode(b)).join('');
}

/**
 * XOR decryption
 */
export function xorDecrypt(encrypted, key) {
  return xorEncrypt(encrypted, key); // XOR is symmetric
}

/**
 * Hash string (simple, not cryptographic)
 */
export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}

/**
 * Generate random key
 */
export function generateKey(length = 32) {
  const array = new Uint8Array(length);
  if (typeof window !== 'undefined' && window.crypto) {
    window.crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Note: For real encryption, use Web Crypto API or a library like crypto-js
 * This is just basic obfuscation for non-sensitive data
 */
export function encryptSensitive(data, password) {
  try {
    // For production, use proper encryption (Web Crypto API)
    const encoded = encodeBase64(data);
    return xorEncrypt(encoded, password);
  } catch (error) {
    logger.error('Encryption failed', error);
    throw error;
  }
}

export function decryptSensitive(encrypted, password) {
  try {
    const decrypted = xorDecrypt(encrypted, password);
    return JSON.parse(decodeBase64(decrypted));
  } catch (error) {
    logger.error('Decryption failed', error);
    throw error;
  }
}

export default {
  encodeBase64,
  decodeBase64,
  xorEncrypt,
  xorDecrypt,
  simpleHash,
  generateKey,
  encryptSensitive,
  decryptSensitive,
};

