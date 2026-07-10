import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/mocks/node';

import { createApiClient } from './client';
import { createMemoryTokenStore } from './token-store';

const BASE = 'http://mimir.test';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('createApiClient — response envelope unwrap', () => {
  it('unwraps { ok, data } on success responses', async () => {
    server.use(
      http.get(`${BASE}/thing`, () => HttpResponse.json({ ok: true, data: { hello: 'world' } })),
    );

    const client = createApiClient({
      baseURL: BASE,
      tokens: createMemoryTokenStore(),
      refresh: async () => null,
    });

    const { data } = await client.get('/thing');
    expect(data).toEqual({ hello: 'world' });
  });

  it('passes non-envelope responses through untouched', async () => {
    server.use(http.get(`${BASE}/thing`, () => HttpResponse.json({ raw: 'payload' })));

    const client = createApiClient({
      baseURL: BASE,
      tokens: createMemoryTokenStore(),
      refresh: async () => null,
    });

    const { data } = await client.get('/thing');
    expect(data).toEqual({ raw: 'payload' });
  });

  it('unwraps the envelope on error responses too', async () => {
    server.use(
      http.get(`${BASE}/bad`, () =>
        HttpResponse.json({ ok: false, data: { message: 'boom' } }, { status: 500 }),
      ),
    );

    const client = createApiClient({
      baseURL: BASE,
      tokens: createMemoryTokenStore(),
      refresh: async () => null,
    });

    await expect(client.get('/bad')).rejects.toMatchObject({
      response: { status: 500, data: { message: 'boom' } },
    });
  });
});

describe('createApiClient — refresh on 401', () => {
  it('runs refresh, updates the token, and retries the request', async () => {
    let callCount = 0;
    server.use(
      http.get(`${BASE}/protected`, ({ request }) => {
        callCount++;
        const auth = request.headers.get('Authorization');
        if (auth === 'Bearer old-token') return new HttpResponse(null, { status: 401 });
        if (auth === 'Bearer new-token') {
          return HttpResponse.json({ ok: true, data: { protected: true } });
        }
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const tokens = createMemoryTokenStore();
    tokens.setAccessToken('old-token');
    const refresh = vi.fn(async () => 'new-token');

    const client = createApiClient({ baseURL: BASE, tokens, refresh });
    const { data } = await client.get('/protected');

    expect(data).toEqual({ protected: true });
    expect(callCount).toBe(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(tokens.getAccessToken()).toBe('new-token');
  });

  it('shares a single refresh across concurrent 401s (queues siblings)', async () => {
    server.use(
      http.get(`${BASE}/protected`, ({ request }) => {
        const auth = request.headers.get('Authorization');
        if (auth === 'Bearer old-token') return new HttpResponse(null, { status: 401 });
        if (auth === 'Bearer new-token') {
          return HttpResponse.json({ ok: true, data: { ok: true } });
        }
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const tokens = createMemoryTokenStore();
    tokens.setAccessToken('old-token');

    const gate = deferred<string>();
    const refresh = vi.fn(() => gate.promise);

    const client = createApiClient({ baseURL: BASE, tokens, refresh });

    const inflight = Promise.all([
      client.get('/protected'),
      client.get('/protected'),
      client.get('/protected'),
    ]);

    // Give all three requests time to hit 401 and enqueue behind the pending refresh.
    await new Promise((r) => setTimeout(r, 30));
    expect(refresh).toHaveBeenCalledTimes(1);

    gate.resolve('new-token');

    const results = await inflight;
    expect(results.map((r) => r.data)).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(tokens.getAccessToken()).toBe('new-token');
  });

  it('handles cookie-session refresh (empty string) by dropping the Bearer on retry', async () => {
    server.use(
      http.get(`${BASE}/protected`, ({ request }) => {
        const auth = request.headers.get('Authorization');
        if (auth === 'Bearer old-token') return new HttpResponse(null, { status: 401 });
        if (auth === null) return HttpResponse.json({ ok: true, data: { cookie: true } });
        return new HttpResponse(null, { status: 500 });
      }),
    );

    const tokens = createMemoryTokenStore();
    tokens.setAccessToken('old-token');
    const refresh = vi.fn(async () => '');

    const client = createApiClient({ baseURL: BASE, tokens, refresh });
    const { data } = await client.get('/protected');

    expect(data).toEqual({ cookie: true });
    expect(tokens.getAccessToken()).toBeNull();
  });

  it('fires onAuthFailure exactly once when refresh returns null', async () => {
    server.use(http.get(`${BASE}/protected`, () => new HttpResponse(null, { status: 401 })));

    const tokens = createMemoryTokenStore();
    tokens.setAccessToken('old-token');
    const onAuthFailure = vi.fn();

    const client = createApiClient({
      baseURL: BASE,
      tokens,
      refresh: async () => null,
      onAuthFailure,
    });

    await expect(client.get('/protected')).rejects.toBeDefined();
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
    expect(tokens.getAccessToken()).toBeNull();
  });

  it('rejects concurrent queued requests when refresh fails', async () => {
    server.use(http.get(`${BASE}/protected`, () => new HttpResponse(null, { status: 401 })));

    const tokens = createMemoryTokenStore();
    tokens.setAccessToken('old-token');
    const gate = deferred<string | null>();
    const refresh = vi.fn(() => gate.promise);
    const onAuthFailure = vi.fn();

    const client = createApiClient({ baseURL: BASE, tokens, refresh, onAuthFailure });

    const p1 = client.get('/protected');
    const p2 = client.get('/protected');

    await new Promise((r) => setTimeout(r, 20));
    gate.reject(new Error('refresh exploded'));

    await expect(p1).rejects.toBeDefined();
    await expect(p2).rejects.toBeDefined();
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('does not loop when the retried request also 401s', async () => {
    let hits = 0;
    server.use(
      http.get(`${BASE}/protected`, () => {
        hits++;
        return new HttpResponse(null, { status: 401 });
      }),
    );

    const tokens = createMemoryTokenStore();
    tokens.setAccessToken('old-token');
    const refresh = vi.fn(async () => 'new-token');

    const client = createApiClient({ baseURL: BASE, tokens, refresh });

    await expect(client.get('/protected')).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(hits).toBe(2);
  });
});
