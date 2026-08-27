import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

async function bootstrap(): Promise<void> {
  const logger = new Logger('OpenAPI');
  const app = await NestFactory.create(AppModule, {
    logger: ['warn', 'error'],
    abortOnError: false,
  });

  const config = new DocumentBuilder()
    .setTitle('Mimir API')
    .setDescription(
      'Auto-generated OpenAPI specification for the Mimir backend. ' +
        'This file is the source of truth for the frontend type pipeline.',
    )
    .setVersion(process.env.npm_package_version ?? '0.0.0')
    .addBearerAuth()
    .addCookieAuth('jwt')
    .addServer('http://localhost:9090', 'Local development')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  const outPath = resolve(
    process.cwd(),
    process.env.OPENAPI_OUT ?? 'generated/openapi.json',
  );
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

  logger.log(`OpenAPI spec written to ${outPath}`);
  await app.close();
}

bootstrap().catch((err) => {
  console.error('Failed to generate OpenAPI spec:', err);
  process.exit(1);
});
