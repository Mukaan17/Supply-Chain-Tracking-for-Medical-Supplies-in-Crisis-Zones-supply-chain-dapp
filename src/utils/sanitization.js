/**
 * Input Sanitization Utilities
 * 
 * Provides XSS prevention and input sanitization.
 */

/**
 * Escape HTML entities
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') {
    return text;
  }

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };

  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Sanitize string input
 */
export function sanitizeString(input) {
  if (typeof input !== 'string') {
    return input;
  }

  // Remove null bytes
  let sanitized = input.replace(/\0/g, '');

  // Remove control characters except newlines and tabs
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  return sanitized;
}

/**
 * Sanitize address input
 */
export function sanitizeAddress(address) {
  if (!address || typeof address !== 'string') {
    return '';
  }

  // Remove whitespace and convert to lowercase
  const sanitized = address.trim().toLowerCase();

  // Validate format
  if (!/^0x[a-f0-9]{40}$/.test(sanitized)) {
    return '';
  }

  return sanitized;
}

/**
 * Sanitize package description
 */
export function sanitizeDescription(description) {
  if (!description || typeof description !== 'string') {
    return '';
  }

  // Basic sanitization
  let sanitized = sanitizeString(description);

  // Remove HTML tags
  sanitized = sanitized.replace(/<[^>]*>/g, '');

  // Limit length (should match contract validation)
  const maxLength = 500;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

/**
 * Sanitize package ID
 */
export function sanitizePackageId(id) {
  if (typeof id === 'number') {
    return Math.max(1, Math.floor(id));
  }

  if (typeof id === 'string') {
    const parsed = parseInt(id, 10);
    if (isNaN(parsed) || parsed < 1) {
      return null;
    }
    return parsed;
  }

  return null;
}

/**
 * Sanitize URL
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') {
    return '';
  }

  try {
    const parsed = new URL(url);
    // Only allow http and https
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj, depth = 0) {
  if (depth > 10) {
    // Prevent deep recursion
    return obj;
  }

  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const sanitizedKey = sanitizeString(key);
        sanitized[sanitizedKey] = sanitizeObject(obj[key], depth + 1);
      }
    }
    return sanitized;
  }

  return obj;
}

export default {
  escapeHtml,
  sanitizeString,
  sanitizeAddress,
  sanitizeDescription,
  sanitizePackageId,
  sanitizeUrl,
  sanitizeObject,
};

