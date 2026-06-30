import { Global, Logger, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { StorageService } from './storage.service';
import { STORAGE_CLIENT } from './storage.constants';

/**
 * Provides a singleton MinIO client + StorageService at the application
 * level.
 *
 * MinIO is API-compatible with S3, so the same StorageService swaps
 * over to a managed S3 / GCS / R2 backend in production by changing
 * env vars only — no code change required.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: STORAGE_CLIENT,
      inject: [ConfigService],
      useFactory: (cfg: ConfigService): MinioClient => {
        const logger = new Logger('StorageClient');
        const endpoint = cfg.get<string>('MINIO_ENDPOINT_HOST') ?? 'localhost';
        const port = Number(cfg.get<string>('MINIO_ENDPOINT_PORT')) || 9000;
        const useSSL =
          (cfg.get<string>('MINIO_USE_SSL') ?? 'false').toLowerCase() ===
          'true';
        logger.log(
          `MinIO client → ${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
        );
        return new MinioClient({
          endPoint: endpoint,
          port,
          useSSL,
          accessKey:
            cfg.get<string>('MINIO_ROOT_USER') ??
            cfg.get<string>('MINIO_ACCESS_KEY') ??
            'minioadmin',
          secretKey:
            cfg.get<string>('MINIO_ROOT_PASSWORD') ??
            cfg.get<string>('MINIO_SECRET_KEY') ??
            'minioadmin',
        });
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
