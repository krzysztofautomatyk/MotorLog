import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
    onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.props.onError?.(error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="flex flex-col items-center justify-center p-8 bg-[var(--bg-card)] rounded-xl border border-rose-200 dark:border-rose-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 bg-rose-100 dark:bg-rose-900/30 rounded-full">
                            <AlertTriangle className="h-6 w-6 text-rose-600" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-lg text-[var(--text-primary)]">
                                Something went wrong
                            </h3>
                            <p className="text-sm text-[var(--text-secondary)]">
                                An error occurred while rendering this component
                            </p>
                        </div>
                    </div>

                    {this.state.error && (
                        <div className="w-full mb-4 p-3 bg-rose-50 dark:bg-rose-950/20 rounded-lg border border-rose-100 dark:border-rose-900">
                            <code className="text-xs text-rose-700 dark:text-rose-400 break-all">
                                {this.state.error.message}
                            </code>
                        </div>
                    )}

                    <button
                        onClick={this.handleRetry}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-medium text-sm transition-colors"
                    >
                        <RefreshCw className="h-4 w-4" />
                        Try Again
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

// HOC for wrapping components with error boundary
export function withErrorBoundary<P extends object>(
    WrappedComponent: React.ComponentType<P>,
    fallback?: ReactNode
) {
    return function WithErrorBoundary(props: P) {
        return (
            <ErrorBoundary fallback={fallback}>
                <WrappedComponent {...props} />
            </ErrorBoundary>
        );
    };
}

export default ErrorBoundary;
