import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import errorTracking from '../services/errorTracking';
import logger from '../services/logging';
import { ErrorEmptyState } from './EmptyStates';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * React Error Boundary Component
 */
class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('Error boundary caught error', error as any, {
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
        return this.props.fallback(this.state.error!, this.handleReset);
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
export function ErrorDisplay({ 
  error, 
  onClear, 
  onRetry 
}: { 
  error: string | null; 
  onClear?: () => void;
  onRetry?: () => void;
}) {
  if (!error) return null;

  return (
    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 my-4" role="alert" aria-live="assertive">
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="mb-2 font-semibold text-red-400">Error</h4>
          <p className="mb-3 text-red-300 text-sm">{error}</p>
          <div className="flex gap-2">
            {onRetry && (
              <button
                onClick={onRetry}
                className="bg-red-600 hover:bg-red-700 text-white border border-red-700 px-4 py-2 rounded transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                aria-label="Retry operation"
              >
                Retry
              </button>
            )}
            {onClear && (
              <button
                onClick={onClear}
                className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 px-4 py-2 rounded transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                aria-label="Dismiss error"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ErrorBoundaryClass;

