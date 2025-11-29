import React, { Component } from 'react';
import errorTracking from '../services/errorTracking';
import logger from '../services/logging';
import { ErrorEmptyState } from './EmptyStates';

/**
 * React Error Boundary Component
 */
class ErrorBoundaryClass extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    logger.error('Error boundary caught error', error, {
      componentStack: errorInfo.componentStack,
    });

    errorTracking.captureException(error, {
      tags: { component: 'ErrorBoundary' },
      extra: { componentStack: errorInfo.componentStack },
    });

    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <ErrorEmptyState
          error={this.state.error?.message || 'An unexpected error occurred'}
          onRetry={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

/**
 * Simple Error Display Component (for non-boundary errors)
 */
export function ErrorDisplay({ error, onClear }) {
  if (!error) return null;

  return (
    <div style={{
      backgroundColor: '#fee',
      border: '1px solid #fcc',
      borderRadius: 8,
      padding: 16,
      margin: '16px 0',
      color: '#c33'
    }}>
      <h4 style={{ margin: '0 0 8px 0', color: '#c33' }}>⚠️ Error</h4>
      <p style={{ margin: '0 0 8px 0' }}>{error}</p>
      {onClear && (
        <button 
          onClick={onClear}
          style={{
            backgroundColor: '#c33',
            color: 'white',
            border: 'none',
            padding: '4px 8px',
            borderRadius: 4,
            cursor: 'pointer'
          }}
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

export default ErrorBoundaryClass;
