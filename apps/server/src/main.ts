import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as express from 'express';
import { join } from 'path';
import { PrismaService } from './common/prisma/prisma.service';

import 'reflect-metadata';
import helmet from 'helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  app.use(cookieParser());
  // Use Helmet for security headers
  app.use(helmet());

  app.enableCors({
    origin: [
      'http://localhost:9000', // dev — direct (bypasses the Vite proxy)
      'https://mimir.app', // prod web
      'https://staging.mimir.app', // staging web
    ],
    credentials: true, // required for the HttpOnly refresh cookie
  });

  // Enable global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('Imba Learn API')
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
