import '@testing-library/jest-dom/vitest';

import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from '@/mocks/node';

// Fail loudly if a test hits an endpoint we haven't stubbed — that usually
// signals either a missing handler or an unexpected network call.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
