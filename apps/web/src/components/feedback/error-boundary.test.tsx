import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ErrorBoundary } from './error-boundary';

function Boom({ message }: { message: string }): JSX.Element {
  throw new Error(message);
}

function withRouter(node: React.ReactNode): JSX.Element {
  return <MemoryRouter>{node}</MemoryRouter>;
}

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // React logs caught errors to console.error — silence to keep test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when nothing throws', () => {
    render(
      withRouter(
        <ErrorBoundary>
          <p>hello</p>
        </ErrorBoundary>,
      ),
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('renders the default fallback with the error message when a child throws', () => {
    render(
      withRouter(
        <ErrorBoundary>
          <Boom message="disk went sideways" />
        </ErrorBoundary>,
      ),
    );
    expect(screen.getByText('This screen ran into an error')).toBeInTheDocument();
    expect(screen.getByText('disk went sideways')).toBeInTheDocument();
  });

  it('recovers when the retry button clears the caught error', async () => {
    const user = userEvent.setup();
    function Recoverable({ shouldThrow }: { shouldThrow: boolean }) {
      if (shouldThrow) throw new Error('transient');
      return <p>recovered</p>;
    }

    let shouldThrow = true;
    const { rerender } = render(
      withRouter(
        <ErrorBoundary>
          <Recoverable shouldThrow={shouldThrow} />
        </ErrorBoundary>,
      ),
    );
    expect(screen.getByText('transient')).toBeInTheDocument();

    // Flip the flag before clicking retry, so the re-render doesn't throw again.
    shouldThrow = false;
    rerender(
      withRouter(
        <ErrorBoundary>
          <Recoverable shouldThrow={shouldThrow} />
        </ErrorBoundary>,
      ),
    );
    await user.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText('recovered')).toBeInTheDocument();
  });

  it('uses a custom fallback when provided', () => {
    render(
      withRouter(
        <ErrorBoundary fallback={(err) => <p>custom: {err.message}</p>}>
          <Boom message="boom" />
        </ErrorBoundary>,
      ),
    );
    expect(screen.getByText('custom: boom')).toBeInTheDocument();
  });
});
