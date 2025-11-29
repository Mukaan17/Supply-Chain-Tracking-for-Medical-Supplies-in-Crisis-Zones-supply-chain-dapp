/**
 * Centralized Error Handler
 * 
 * Provides error classification, user-friendly messages, and error recovery strategies.
 */

import logger from '../services/logging';
import errorTracking from '../services/errorTracking';

// Error types
export const ErrorType = {
  NETWORK: 'network',
  USER: 'user',
  CONTRACT: 'contract',
  SYSTEM: 'system',
  UNKNOWN: 'unknown',
};

// Error classification
function classifyError(error) {
  if (!error) return ErrorType.UNKNOWN;

  const message = error.message?.toLowerCase() || '';
  const code = error.code || error.error?.code;

  // Network errors
  if (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('fetch') ||
    code === 'NETWORK_ERROR' ||
    code === 'TIMEOUT'
  ) {
    return ErrorType.NETWORK;
  }

  // User errors (rejections, invalid input)
  if (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('user cancelled') ||
    message.includes('invalid input') ||
    message.includes('validation') ||
    code === 4001 || // User rejected
    code === 'ACTION_REJECTED'
  ) {
    return ErrorType.USER;
  }

  // Contract errors
  if (
    message.includes('revert') ||
    message.includes('execution reverted') ||
    message.includes('insufficient funds') ||
    message.includes('gas') ||
    code === 'CALL_EXCEPTION' ||
    code === 'INSUFFICIENT_FUNDS'
  ) {
    return ErrorType.CONTRACT;
  }

  // System errors
  if (
    message.includes('internal') ||
    message.includes('server error') ||
    code >= 500
  ) {
    return ErrorType.SYSTEM;
  }

  return ErrorType.UNKNOWN;
}

// User-friendly error messages
const errorMessages = {
  [ErrorType.NETWORK]: {
    title: 'Network Error',
    message: 'Unable to connect to the network. Please check your internet connection and try again.',
    action: 'Retry',
  },
  [ErrorType.USER]: {
    title: 'Action Cancelled',
    message: 'The transaction was cancelled. No changes were made.',
    action: null,
  },
  [ErrorType.CONTRACT]: {
    title: 'Transaction Failed',
    message: 'The transaction failed. This may be due to insufficient funds, gas limits, or contract conditions.',
    action: 'Review Transaction',
  },
  [ErrorType.SYSTEM]: {
    title: 'System Error',
    message: 'An unexpected error occurred. Please try again later.',
    action: 'Retry',
  },
  [ErrorType.UNKNOWN]: {
    title: 'Error',
    message: 'An error occurred. Please try again.',
    action: 'Retry',
  },
};

/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(error) {
  const type = classifyError(error);
  const baseMessage = errorMessages[type];

  // Try to extract more specific message from error
  // IMPORTANT: Don't expose internal details in production
  const isProduction = process.env.NODE_ENV === 'production';
  let specificMessage = error.message || '';

  // Handle common contract errors
  if (type === ErrorType.CONTRACT) {
    if (specificMessage.includes('insufficient funds')) {
      specificMessage = 'Insufficient funds for gas fees. Please add more ETH to your wallet.';
    } else if (specificMessage.includes('gas')) {
      specificMessage = 'Gas estimation failed. Please try again or adjust gas settings.';
    } else if (specificMessage.includes('revert')) {
      // In production, don't expose detailed revert reasons
      if (isProduction) {
        specificMessage = 'Transaction was reverted. Please check the transaction details and try again.';
      } else {
        // In development, show more details for debugging
        const revertMatch = specificMessage.match(/revert\s+(.+)/i);
        if (revertMatch) {
          specificMessage = `Transaction reverted: ${revertMatch[1]}`;
        } else {
          specificMessage = 'Transaction was reverted. Please check the transaction details.';
        }
      }
    }
  }

  // Sanitize error messages in production to avoid information leakage
  if (isProduction && type === ErrorType.SYSTEM) {
    // Don't expose internal error details
    specificMessage = baseMessage.message;
  }

  return {
    type,
    title: baseMessage.title,
    message: specificMessage || baseMessage.message,
    action: baseMessage.action,
    originalError: error,
  };
}

/**
 * Handle error with logging and tracking
 */
export function handleError(error, context = {}) {
  const errorInfo = getUserFriendlyError(error);
  const errorType = errorInfo.type;

  // Log error
  logger.error('Error handled', error, {
    type: errorType,
    ...context,
  });

  // Track error (except user errors)
  if (errorType !== ErrorType.USER) {
    errorTracking.captureException(error, {
      tags: {
        errorType,
        component: context.component || 'unknown',
      },
      extra: {
        ...context,
        userFriendlyMessage: errorInfo.message,
      },
    });
  }

  return errorInfo;
}

/**
 * Error recovery strategies
 */
export const RecoveryStrategy = {
  RETRY: 'retry',
  IGNORE: 'ignore',
  FALLBACK: 'fallback',
  ABORT: 'abort',
};

/**
 * Get recovery strategy for error
 */
export function getRecoveryStrategy(error) {
  const type = classifyError(error);

  switch (type) {
    case ErrorType.NETWORK:
      return RecoveryStrategy.RETRY;
    case ErrorType.USER:
      return RecoveryStrategy.IGNORE;
    case ErrorType.CONTRACT:
      return RecoveryStrategy.ABORT;
    case ErrorType.SYSTEM:
      return RecoveryStrategy.RETRY;
    default:
      return RecoveryStrategy.ABORT;
  }
}

/**
 * Format error for display
 */
export function formatErrorForDisplay(error) {
  const errorInfo = getUserFriendlyError(error);
  
  return {
    title: errorInfo.title,
    message: errorInfo.message,
    action: errorInfo.action,
    canRetry: getRecoveryStrategy(error) === RecoveryStrategy.RETRY,
  };
}

export default {
  ErrorType,
  RecoveryStrategy,
  classifyError,
  getUserFriendlyError,
  handleError,
  getRecoveryStrategy,
  formatErrorForDisplay,
};

