import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as winston from 'winston';

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: winston.Logger;
  private context?: string;

  constructor(private readonly configService: ConfigService) {
    const environment =
      this.configService.get<string>('NODE_ENV') ?? 'development';
    const service =
      this.configService.get<string>('SERVICE_NAME') ?? 'mimir-api';
    const isProduction = environment === 'production';

    const jsonFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.printf(
        ({ timestamp, level, message, context, trace, stack, ...meta }) =>
          JSON.stringify({
            timestamp,
            level,
            service,
            context: context || this.context,
            message,
            stack: stack ?? trace,
            ...meta,
          }),
      ),
    );

    const prettyFormat = winston.format.combine(
      winston.format.colorize({ all: true }),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf((info) => {
        const ctx =
          typeof info.context === 'string'
            ? info.context
            : (this.context ?? service);
        return `${String(info.timestamp)} ${info.level} [${ctx}] ${String(info.message)}`;
      }),
    );

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: isProduction ? jsonFormat : prettyFormat,
      }),
    ];

    if (isProduction) {
      transports.push(
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5 * 1024 * 1024,
          maxFiles: 5,
          format: jsonFormat,
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
          level: 'info',
          maxsize: 5 * 1024 * 1024,
          maxFiles: 5,
          format: jsonFormat,
        }),
      );
    }

    this.logger = winston.createLogger({
      level: isProduction ? 'info' : 'debug',
      transports,
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: string, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: string, trace?: string, context?: string) {
    this.logger.error(message, {
      context: context || this.context,
      stack: trace,
    });
  }

  warn(message: string, context?: string) {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: string, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: string, context?: string) {
    this.logger.verbose(message, { context: context || this.context });
  }
}
