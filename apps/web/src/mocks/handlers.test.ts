import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { createApiClient } from '@/lib/api/client';
import { createMemoryTokenStore } from '@/lib/api/token-store';

import { server } from './node';

function makeClient() {
  return createApiClient({
    baseURL: 'http://mimir.test',
    tokens: createMemoryTokenStore(),
    refresh: async () => null,
  });
}

describe('MSW wiring', () => {
  it('intercepts requests using the default handlers', async () => {
    const client = makeClient();
    const { data } = await client.get('/users/me');
    expect(data).toMatchObject({ username: 'jane', role: 'user' });
  });

  it('lets a test override a handler for that test only', async () => {
    server.use(
      http.get('*/users/me', () =>
        HttpResponse.json({
          ok: true,
          data: { username: 'override', role: 'teacher' },
        }),
      ),
    );

    const client = makeClient();
    const { data } = await client.get('/users/me');
    expect(data).toMatchObject({ username: 'override', role: 'teacher' });
  });

  it('resets handlers between tests (baseline restored)', async () => {
    const client = makeClient();
    const { data } = await client.get('/users/me');
    expect(data).toMatchObject({ username: 'jane' });
  });
});
