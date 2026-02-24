/**
 * ErrorBoundary.jsx — React error boundary for graceful failure handling.
 *
 * Wraps child components and catches render errors, displaying a
 * user-friendly fallback UI instead of a blank white screen.
 * Includes a "Try again" button that resets the error state.
 *
 * @module components/ErrorBoundary
 */
import React from "react";

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-center mb-4">
                        <svg className="h-7 w-7 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h2 className="text-lg font-semibold text-stone-900 mb-1">Something went wrong</h2>
                    <p className="text-sm text-stone-500 mb-6 max-w-sm">
                        An unexpected error occurred while rendering this section.
                    </p>
                    <button
                        onClick={() => this.setState({ hasError: false, error: null })}
                        className="rounded-xl bg-[#1e3a5f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16304f] transition"
                    >
                        Try again
                    </button>
                    {this.state.error && (
                        <details className="mt-6 text-left w-full max-w-md">
                            <summary className="text-xs text-stone-400 cursor-pointer hover:text-stone-600">Technical details</summary>
                            <pre className="mt-2 rounded-xl bg-stone-50 border border-stone-200 p-3 text-xs text-stone-600 overflow-auto max-h-40">
                                {this.state.error.toString()}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
