"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Wraps the app shell. On a render crash, logs safely (no sensitive data,
 * no crash reporting service by default) and shows a calm recovery screen
 * instead of a blank white page. "Try again" only resets this boundary's
 * local state, it never clears IndexedDB or any user data.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(
      "Racks encountered a rendering error:",
      error?.message || error,
      info?.componentStack || ""
    );
  }

  handleReset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-cream px-6 pb-safe pt-safe">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-clay-100 flex items-center justify-center">
              <span className="text-2xl">🌿</span>
            </div>
            <h1 className="text-lg font-medium text-stone-800">
              Something didn&apos;t load right
            </h1>
            <p className="text-sm text-stone-500">
              Your closet and looks are safe. This screen just needs a
              fresh start.
            </p>
            <button
              onClick={this.handleReset}
              className="w-full rounded-xl bg-emerald-600 text-cream py-3 text-sm font-medium active:scale-[0.98] transition-transform"
            >
              Try again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
