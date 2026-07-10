import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

import { StatusScreen } from './status-screen';

interface Props {
  children: ReactNode;
  /** Override the default fallback UI. Receives the caught error. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time errors anywhere below it and shows a recoverable
 * fallback. Mount once at the app root; feature-level boundaries can
 * wrap a subtree with a custom `fallback` for isolated recovery.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Real telemetry lands in Sprint 11 (Sentry). Console for now.
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <StatusScreen
        label="Something broke"
        title="This screen ran into an error"
        description={error.message || 'Try again — if it keeps happening, please report it.'}
        icon={AlertTriangle}
        action={<Button onClick={this.reset}>Try again</Button>}
      />
    );
  }
}
