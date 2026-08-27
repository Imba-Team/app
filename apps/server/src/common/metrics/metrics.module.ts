import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import {
  PrometheusModule,
  makeCounterProvider,
  makeGaugeProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';
import {
  HTTP_REQUESTS_IN_FLIGHT,
  HTTP_REQUEST_DURATION_SECONDS,
} from './metrics.constants';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
      defaultLabels: {
        app: 'mimir-api',
        service: process.env.SERVICE_NAME ?? 'monolith',
      },
    }),
  ],
  providers: [
    makeHistogramProvider({
      name: HTTP_REQUEST_DURATION_SECONDS,
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    }),
    makeGaugeProvider({
      name: HTTP_REQUESTS_IN_FLIGHT,
      help: 'Number of HTTP requests currently being handled',
      labelNames: ['method'],
    }),
    makeCounterProvider({
      name: 'mimir_app_start_total',
      help: 'Number of times the application process started (incremented at boot)',
      labelNames: ['service'],
    }),
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
  exports: [PrometheusModule],
})
export class MetricsModule {}
