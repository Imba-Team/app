import { setupWorker } from 'msw/browser';

import { handlers } from './handlers';

/**
 * Browser-side MSW worker. Only started when VITE_ENABLE_MOCKS === 'true'
 * (see src/main.tsx). Never started in production builds.
 */
export const worker = setupWorker(...handlers);
