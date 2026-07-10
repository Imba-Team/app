import { setupServer } from 'msw/node';

import { handlers } from './handlers';

/**
 * Node-side MSW server used by Vitest (see src/test/setup.ts).
 * Individual tests can extend or override handlers via `server.use(...)`.
 */
export const server = setupServer(...handlers);
