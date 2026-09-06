import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import { PrismaService } from './common/prisma/prisma.service';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

import 'reflect-metadata';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  app.use(cookieParser());
  // Use Helmet for security headers
  app.use(helmet());

  const configuredCorsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const defaultCorsOrigins = [
    'http://localhost:9000', // dev — direct (bypasses the Vite proxy)
    'http://127.0.0.1:9000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://mimir.app', // prod web
    'https://staging.mimir.app', // staging web
  ];

  const allowedCorsOrigins = [
    ...new Set([...defaultCorsOrigins, ...configuredCorsOrigins]),
  ];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      try {
        const requestOrigin = new URL(origin);
        const isLocalhostOrigin =
          requestOrigin.hostname === 'localhost' ||
          requestOrigin.hostname === '127.0.0.1' ||
          requestOrigin.hostname === '::1';

        if (
          isLocalhostOrigin ||
          allowedCorsOrigins.includes(origin) ||
          allowedCorsOrigins.includes(requestOrigin.origin)
        ) {
          callback(null, true);
          return;
        }
      } catch {
        // Ignore invalid origins and let the request fail closed.
      }

      callback(new Error('Not allowed by CORS'));
    },
    credentials: true, // required for the HttpOnly refresh cookie
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  // Global exception filter — surfaces validation / storage / sharp
  // errors as structured JSON envelopes and mirrors non-HttpException
  // stacks to logs/exceptions.log so 500s are debuggable post-hoc.
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Mimir API')
    .setDescription('The API description for your starter template')
    .setVersion('1.0')
    .addBearerAuth() // Enables JWT token usage in Swagger UI
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document); // Access Swagger UI at /api

  const port = process.env.SERVER_PORT || process.env.PORT || 9090;
  const webPort = process.env.WEB_PORT || 3000;
  await app.listen(port);
  printStartupBanner({
    apiPort: Number(port),
    webPort: Number(webPort),
    env: process.env.NODE_ENV ?? 'development',
  });
}

interface BannerConfig {
  apiPort: number;
  webPort: number;
  env: string;
}

function printStartupBanner({ apiPort, webPort, env }: BannerConfig): void {
  const noColor = !process.stdout.isTTY || !!process.env.NO_COLOR;
  const paint = (code: string, text: string): string =>
    noColor ? text : `\x1b[${code}m${text}\x1b[0m`;
  const bold = (t: string) => paint('1', t);
  const dim = (t: string) => paint('2', t);
  const cyan = (t: string) => paint('36', t);
  const green = (t: string) => paint('32', t);
  const yellow = (t: string) => paint('33', t);
  const magenta = (t: string) => paint('35', t);

  const envTint =
    env === 'production' ? green : env === 'test' ? yellow : cyan;
  const rows: Array<[string, string]> = [
    ['env', envTint(env)],
    ['api', cyan(`http://localhost:${apiPort}`)],
    ['docs', cyan(`http://localhost:${apiPort}/api`)],
    ['health', cyan(`http://localhost:${apiPort}/health`)],
    ['web', `${magenta(`http://localhost:${webPort}`)}  ${dim('(next.js)')}`],
  ];
  const title = 'Mimir API — ready';
  const labelWidth = Math.max(
    ...rows.map(([k]) => k.length),
  );

  const stripAnsi = (s: string) => s.replace(/\x1b\[[0-9;]*m/g, '');
  const visibleLen = (s: string) => stripAnsi(s).length;

  const contentRows = rows.map(([k, v]) => {
    const rendered = `${dim(k.padEnd(labelWidth))}  ${v}`;
    return { rendered, visible: labelWidth + 2 + visibleLen(v) };
  });

  const inner = Math.max(
    title.length + 2,
    ...contentRows.map((r) => r.visible),
  );
  const pad = (rendered: string, visible: number) =>
    rendered + ' '.repeat(Math.max(0, inner - visible));

  const hbar = '─'.repeat(inner + 2);
  const lines = [
    dim(`┌${hbar}┐`),
    `${dim('│')} ${green('●')} ${bold(title)}${' '.repeat(Math.max(0, inner - title.length - 2))} ${dim('│')}`,
    dim(`├${hbar}┤`),
    ...contentRows.map(
      (r) => `${dim('│')} ${pad(r.rendered, r.visible)} ${dim('│')}`,
    ),
    dim(`└${hbar}┘`),
  ];

  // eslint-disable-next-line no-console
  console.log('\n' + lines.join('\n') + '\n');
}

void bootstrap();
