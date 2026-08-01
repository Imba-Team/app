import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      message = typeof res === 'string' ? res : (res as any).message || message;
    }

    // For non-HttpException failures (unhandled rejections, MinIO /
    // Prisma / sharp errors bubbling out of a controller), the branch
    // above leaves `message` at the generic default. Log the underlying
    // exception with its stack so 500s are actually debuggable.
    if (exception instanceof HttpException) {
      this.logger.error(
        `HTTP ${status} Error: ${request.method} ${request.url} - ${message}`,
      );
    } else {
      const err = exception as Error | undefined;
      this.logger.error(
        `HTTP ${status} Error: ${request.method} ${request.url} - ${err?.message ?? String(exception)}`,
        err?.stack,
      );
      // Belt-and-suspenders: Winston in dev only logs to stdout, so 500
      // stacks vanish when the dev terminal scrolls. Append the raw
      // exception details to a durable file so post-mortem debugging is
      // possible from tooling / logs pipeline.
      try {
        const logDir = path.resolve(process.cwd(), 'logs');
        fs.mkdirSync(logDir, { recursive: true });
        fs.appendFileSync(
          path.join(logDir, 'exceptions.log'),
          `\n[${new Date().toISOString()}] ${request.method} ${request.url}\n${
            err?.stack ?? String(exception)
          }\n${JSON.stringify(errorDetails(exception))}\n`,
        );
      } catch {
        // If the FS write itself fails, don't compound the 500 — silent
        // fallback is fine because Nest Logger already emitted to stdout.
      }
    }

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
    });
  }
}

function errorDetails(exception: unknown): Record<string, unknown> {
  if (exception instanceof Error) {
    return {
      name: exception.name,
      message: exception.message,
      // Sharp / MinIO / Prisma errors often attach useful metadata to
      // `.code` / `.cause` — surface it in the log so root-cause is
      // visible without re-instrumenting the throw site.
      code: (exception as { code?: unknown }).code,
      cause: (exception as { cause?: unknown }).cause,
    };
  }
  return { value: exception };
}
