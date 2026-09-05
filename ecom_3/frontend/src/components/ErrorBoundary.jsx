import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[Dashboard] render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="glass-card animate-fade-in mx-auto max-w-lg p-10 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-red-400/20 bg-red-400/10 text-red-300">
            <AlertTriangle size={24} />
          </span>
          <h2 className="mt-5 text-xl font-bold text-slate-100">Something went wrong</h2>
          <p className="mt-2 break-words text-sm text-slate-400">
            The dashboard hit an unexpected error while rendering. Your data is safe —
            refresh to retry.
          </p>
          <p className="mt-2 font-mono text-xs text-slate-600">
            {this.state.error?.message || String(this.state.error)}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-6 inline-flex items-center gap-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-300 transition-colors hover:bg-cyan-400/20"
          >
            <RefreshCw size={14} /> Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}