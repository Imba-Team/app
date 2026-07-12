import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge, Histogram } from 'prom-client';
import { Observable, tap } from 'rxjs';
import type { Request, Response } from 'express';
import {
  HTTP_REQUESTS_IN_FLIGHT,
  HTTP_REQUEST_DURATION_SECONDS,
} from './metrics.constants';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric(HTTP_REQUEST_DURATION_SECONDS)
    private readonly requestDuration: Histogram<string>,
    @InjectMetric(HTTP_REQUESTS_IN_FLIGHT)
    private readonly inFlight: Gauge<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const method = req.method ?? 'UNKNOWN';

    this.inFlight.inc({ method });
    const endTimer = this.requestDuration.startTimer({ method });

    const finalize = (statusCode: number) => {
      const route = this.resolveRoute(req);
      endTimer({ route, status_code: String(statusCode) });
      this.inFlight.dec({ method });
    };

    return next.handle().pipe(
      tap({
        next: () => finalize(res.statusCode),
        error: (err: unknown) => {
          const statusCode =
            err instanceof HttpException ? err.getStatus() : 500;
          finalize(statusCode);
        },
      }),
    );
  }

  private resolveRoute(req: Request): string {
    const route = req.route?.path as string | undefined;
    if (route) {
      const base = (req.baseUrl ?? '').replace(/\/$/, '');
      return `${base}${route}` || route;
    }
    return req.originalUrl?.split('?')[0] ?? 'unknown';
  }
}
