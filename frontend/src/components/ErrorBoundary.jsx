/**
 * ErrorBoundary.jsx — React error boundary for graceful failure handling.
 *
 * Wraps child components and catches render errors, displaying a
 * user-friendly fallback UI instead of a blank white screen.
 * Includes "Try again", "Reload page", and "Go to homepage" recovery options.
 *
 * @module components/ErrorBoundary
 */
import React from "react";
import { reportError } from "../services/errorReporter";

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        reportError(error, { component: "ErrorBoundary", errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
                    {/* Illustration */}
                    <div className="mb-6 relative">
                        <div className="h-20 w-20 rounded-3xl bg-red-50 border border-red-200 flex items-center justify-center">
                            <svg className="h-10 w-10 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                            </svg>
                        </div>
                        <div className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-red-100 border border-red-200 flex items-center justify-center">
                            <span className="text-red-500 text-xs font-bold">!</span>
                        </div>
                    </div>

                    <h2 className="text-xl font-semibold text-stone-900 mb-2">Something went wrong</h2>
                    <p className="text-sm text-stone-500 mb-8 max-w-sm leading-relaxed">
                        An unexpected error occurred while rendering this section.
                        Don't worry — your data is safe.
                    </p>

                    {/* Recovery actions */}
                    <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                            onClick={() => this.setState({ hasError: false, error: null })}
                            className="rounded-xl bg-[#1e3a5f] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#16304f] transition shadow-sm"
                        >
                            Try again
                        </button>
                        <button
                            onClick={() => window.location.reload()}
                            className="rounded-xl border border-[#E8E4DE] bg-white px-5 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50 transition"
                        >
                            Reload page
                        </button>
                        <a
                            href="/"
                            className="rounded-xl px-5 py-2.5 text-sm font-semibold text-stone-500 hover:text-stone-900 transition"
                        >
                            Go to homepage →
                        </a>
                    </div>

                    {/* Error internals leak implementation details — dev builds only */}
                    {import.meta.env.DEV && this.state.error && (
                        <details className="mt-8 text-left w-full max-w-md">
                            <summary className="text-xs text-stone-400 cursor-pointer hover:text-stone-600 transition">
                                Technical details
                            </summary>
                            <pre className="mt-2 rounded-xl bg-stone-50 border border-stone-200 p-3 text-xs text-stone-600 overflow-auto max-h-40">
                                {this.state.error.stack || this.state.error.toString()}
                            </pre>
                        </details>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}
