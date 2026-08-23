import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { join } from 'path';
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

  const port = process.env.PORT || 9090;
  // Serve uploaded static assets
  app.use('/uploads', express.static(join(process.cwd(), 'uploads')));
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
  console.log(
    `Swagger documentation is available at: http://localhost:${port}/api`,
  );
}
void bootstrap();
