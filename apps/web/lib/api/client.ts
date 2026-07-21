/**
 * Typed axios wrapper over the OpenAPI spec.
 *
 * This is the single source of API truth on the client. Every request
 * declares its `path`, HTTP method, and (if present) URL params via the
 * generated `paths` type — meaning:
 *
 *  - A wrong URL string is a compile error, not a runtime 404.
 *  - Path parameters are required and type-checked (`/study-sets/{id}`
 *    forces you to pass `params.path.id`).
 *  - Request body and response shapes are inferred from the server DTOs,
 *    so drift between web and server surfaces as a TS error.
 *
 * When the backend changes, run `pnpm --filter @mimir/web generate:api-types`
 * and the TS compiler will point at every stale call site.
 */

import { apiClient } from '@/lib/axios';
import type { AxiosRequestConfig } from 'axios';
import type { paths } from './generated';

// -----------------------------------------------------------------------------
// Type utilities
// -----------------------------------------------------------------------------

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

/** Endpoints that support a given HTTP method. */
export type PathsWith<M extends HttpMethod> = {
  [P in keyof paths]: paths[P] extends Record<M, unknown> ? P : never;
}[keyof paths];

type Operation<P extends keyof paths, M extends HttpMethod> = paths[P] extends {
  [K in M]: infer Op;
}
  ? Op
  : never;

type OperationHas<
  P extends keyof paths,
  M extends HttpMethod,
  K extends string,
> = Operation<P, M> extends Record<K, unknown> ? true : false;

// -----------------------------------------------------------------------------
// Path parameters
// -----------------------------------------------------------------------------

type ExtractPathParams<Op> = Op extends {
  parameters: { path: infer PathParams };
}
  ? PathParams
  : never;

type ExtractQueryParams<Op> = Op extends {
  parameters: { query?: infer Q };
}
  ? Q
  : Op extends { parameters: { query: infer Q } }
    ? Q
    : never;

// -----------------------------------------------------------------------------
// Request body
// -----------------------------------------------------------------------------

type ExtractRequestBody<Op> = Op extends {
  requestBody: { content: { 'application/json': infer B } };
}
  ? B
  : Op extends {
        requestBody?: { content: { 'application/json': infer B } };
      }
    ? B | undefined
    : undefined;

// -----------------------------------------------------------------------------
// Response
// -----------------------------------------------------------------------------

type SuccessStatus = 200 | 201 | 204;

type ExtractResponse<Op> = Op extends { responses: infer R }
  ? {
      [S in SuccessStatus & keyof R]: R[S] extends {
        content: { 'application/json': infer C };
      }
        ? C
        : never;
    }[SuccessStatus & keyof R]
  : never;

// -----------------------------------------------------------------------------
// Request options shape (path / query / body appear only when the op needs them)
// -----------------------------------------------------------------------------

type PathParamOption<P extends keyof paths, M extends HttpMethod> =
  ExtractPathParams<Operation<P, M>> extends never
    ? { path?: undefined }
    : { path: ExtractPathParams<Operation<P, M>> };

type QueryOption<P extends keyof paths, M extends HttpMethod> =
  ExtractQueryParams<Operation<P, M>> extends never
    ? { query?: undefined }
    : OperationHas<P, M, 'parameters'> extends true
      ? { query?: ExtractQueryParams<Operation<P, M>> }
      : { query?: undefined };

type BodyOption<P extends keyof paths, M extends HttpMethod> =
  ExtractRequestBody<Operation<P, M>> extends undefined
    ? { body?: undefined }
    : undefined extends ExtractRequestBody<Operation<P, M>>
      ? { body?: Exclude<ExtractRequestBody<Operation<P, M>>, undefined> }
      : { body: ExtractRequestBody<Operation<P, M>> };

export type RequestOptions<
  P extends keyof paths,
  M extends HttpMethod,
> = PathParamOption<P, M> &
  QueryOption<P, M> &
  BodyOption<P, M> & {
    /** Escape hatch for headers, timeout, signals. Not path/params/body. */
    axios?: Omit<AxiosRequestConfig, 'url' | 'method' | 'data' | 'params'>;
  };

// -----------------------------------------------------------------------------
// URL builder
// -----------------------------------------------------------------------------

function interpolate(pathTemplate: string, params?: Record<string, unknown>): string {
  if (!params) return pathTemplate;
  return pathTemplate.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    if (value === undefined || value === null) {
      throw new Error(`Missing path parameter "${key}" for ${pathTemplate}`);
    }
    return encodeURIComponent(String(value));
  });
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

export async function apiFetch<
  P extends PathsWith<M>,
  M extends HttpMethod,
>(method: M, path: P, options?: RequestOptions<P, M>): Promise<ExtractResponse<Operation<P, M>>> {
  const opts = (options ?? {}) as {
    path?: Record<string, unknown>;
    query?: Record<string, unknown>;
    body?: unknown;
    axios?: AxiosRequestConfig;
  };
  const url = interpolate(path as string, opts.path);
  const response = await apiClient.request({
    method,
    url,
    params: opts.query,
    data: opts.body,
    ...opts.axios,
  });
  return response.data as ExtractResponse<Operation<P, M>>;
}

// -----------------------------------------------------------------------------
// Component schema shortcut — lets callers reference server DTO types by name
// without touching the generated `paths` structure.
// -----------------------------------------------------------------------------

export type Schemas = import('./generated').components['schemas'];
