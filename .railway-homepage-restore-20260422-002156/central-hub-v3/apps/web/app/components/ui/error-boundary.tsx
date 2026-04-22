/**
 * Error Boundary Component
 * Catch and display errors gracefully
 */

'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { cn } from '@/app/lib/utils';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetOnPropsChange?: boolean;
  className?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler
    this.props.onError?.(error, errorInfo);

    // Optionally send to error tracking service
    if (process.env.NODE_ENV === 'production') {
      // TODO: Send to error tracking service
      // Example: Sentry.captureException(error, { extra: errorInfo });
    }
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (
      this.state.hasError &&
      this.props.resetOnPropsChange &&
      prevProps.children !== this.props.children
    ) {
      this.reset();
    }
  }

  reset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          onReset={this.reset}
          className={this.props.className}
        />
      );
    }

    return this.props.children;
  }
}

// Error Fallback Component
interface ErrorFallbackProps {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  onReset: () => void;
  className?: string;
}

function ErrorFallback({ error, errorInfo, onReset, className }: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div
      className={cn(
        'min-h-[200px] flex items-center justify-center p-6',
        className
      )}
    >
      <div className="glass-card p-8 max-w-lg w-full text-center">
        {/* Error Icon */}
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* Error Message */}
        <h3 className="text-xl font-semibold text-white mb-2">
          Something went wrong
        </h3>
        <p className="text-slate-400 mb-6">
          We&apos;re sorry, but there was an error loading this content. Please try again.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={onReset}
            className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
          >
            Reload Page
          </button>
        </div>

        {/* Error Details (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-slate-500 hover:text-slate-400 flex items-center justify-center gap-1 mx-auto"
            >
              {showDetails ? 'Hide' : 'Show'} Error Details
              <svg
                className={cn('w-4 h-4 transition-transform', showDetails && 'rotate-180')}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {showDetails && (
              <div className="mt-4 text-left">
                <div className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-64">
                  <p className="text-red-400 font-mono text-sm mb-2">
                    {error?.toString()}
                  </p>
                  {errorInfo && (
                    <pre className="text-slate-500 font-mono text-xs overflow-auto">
                      {errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Async Error Boundary - For handling async errors
interface AsyncErrorBoundaryProps {
  children: ReactNode;
  error: Error | null;
  onReset: () => void;
  className?: string;
}

export function AsyncErrorBoundary({
  children,
  error,
  onReset,
  className,
}: AsyncErrorBoundaryProps) {
  if (error) {
    return (
      <ErrorFallback
        error={error}
        errorInfo={null}
        onReset={onReset}
        className={className}
      />
    );
  }

  return <>{children}</>;
}

// Page Error Boundary - For full page errors
interface PageErrorProps {
  statusCode?: number;
  title?: string;
  message?: string;
  onReset?: () => void;
  className?: string;
}

export function PageError({
  statusCode = 500,
  title = 'Internal Server Error',
  message = 'Something went wrong on our end. Please try again later.',
  onReset,
  className,
}: PageErrorProps) {
  return (
    <div
      className={cn(
        'min-h-screen flex items-center justify-center p-6',
        className
      )}
    >
      <div className="glass-card p-12 max-w-md w-full text-center">
        <div className="text-6xl font-bold text-slate-700 mb-4">{statusCode}</div>
        <h1 className="text-2xl font-semibold text-white mb-2">{title}</h1>
        <p className="text-slate-400 mb-8">{message}</p>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors"
          >
            Go Back
          </button>
          {onReset && (
            <button
              onClick={onReset}
              className="px-4 py-2 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 transition-colors"
            >
              Try Again
            </button>
          )}
          <a
            href="/dashboard"
            className="px-4 py-2 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 transition-colors"
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}

// Section Error - For section-specific errors
interface SectionErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export function SectionError({
  title = 'Failed to load',
  message = 'There was an error loading this section.',
  onRetry,
  className,
}: SectionErrorProps) {
  return (
    <div
      className={cn(
        'glass-card p-6 flex items-center gap-4',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
        <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-medium text-white">{title}</h4>
        <p className="text-sm text-slate-400">{message}</p>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-slate-400 hover:bg-white/10 transition-colors text-sm shrink-0"
        >
          Retry
        </button>
      )}
    </div>
  );
}

// Export error utilities
export function logError(error: Error, context?: Record<string, unknown>) {
  console.error('Error:', error, context);
  
  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Send to error tracking service
    // Example: Sentry.captureException(error, { extra: context });
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}
