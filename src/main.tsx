import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { ErrorBoundary } from './components/feedback';
import './index.css';

async function enableMocking() {
  if (!import.meta.env.DEV || import.meta.env.VITE_ENABLE_MOCKS !== 'true') return;
  const { worker } = await import('./mocks/browser');
  await worker.start({ onUnhandledRequest: 'bypass' });
}

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element in index.html');

enableMocking().then(() => {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  );
});
