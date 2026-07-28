import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message?: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(err: unknown): State {
    return { hasError: true, message: err instanceof Error ? err.message : String(err) };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("Render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-2xl px-4 py-20 text-center">
          <h1 className="font-serif text-2xl font-bold text-slate-900 dark:text-white">Something went wrong</h1>
          <p className="mt-4 rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
            {this.state.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-amber-400"
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
