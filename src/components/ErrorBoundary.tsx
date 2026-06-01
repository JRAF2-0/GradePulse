import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface to the console for now; swap for Sentry/PostHog when wired up.
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  reload = () => window.location.reload();

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-app px-4 py-12">
        <div className="card w-full max-w-md text-center">
          <div className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-600 dark:text-red-300">
            <AlertTriangle className="h-7 w-7" strokeWidth={1.8} />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-content">
            Something went wrong
          </h1>
          <p className="text-content-muted">
            The page hit an unexpected error. Try reloading; if it keeps happening, please let us
            know.
          </p>
          {this.state.error.message && (
            <pre className="mt-4 overflow-auto rounded-xl bg-surface-2 px-4 py-3 text-left text-xs text-content-muted ring-1 ring-line">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-6 flex justify-center gap-2">
            <button onClick={this.reset} className="btn-secondary">
              Try again
            </button>
            <button onClick={this.reload} className="btn-primary">
              <RotateCw className="h-4 w-4" /> Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
