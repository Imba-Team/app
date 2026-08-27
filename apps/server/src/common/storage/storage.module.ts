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
        const provider = (
          cfg.get<string>('STORAGE_PROVIDER') ?? 'minio'
        ).toLowerCase();
        const isMinio = provider === 'minio';

        const endpoint = cfg.get<string>('MINIO_ENDPOINT_HOST') ?? 'localhost';
        // For R2 / hosted S3 the port is implicit in the scheme (443).
        const port =
          Number(cfg.get<string>('MINIO_ENDPOINT_PORT')) || (isMinio ? 9000 : 443);
        // Default useSSL to true for anything that isn't local MinIO.
        const useSSL =
          (cfg.get<string>('MINIO_USE_SSL') ?? (isMinio ? 'false' : 'true'))
            .toLowerCase() === 'true';
        // R2 requires region "auto"; MinIO ignores it.
        const region =
          cfg.get<string>('STORAGE_REGION') ??
          (provider === 'r2' ? 'auto' : 'us-east-1');

        const accessKey =
          cfg.get<string>('MINIO_ROOT_USER') ??
          cfg.get<string>('MINIO_ACCESS_KEY');
        const secretKey =
          cfg.get<string>('MINIO_ROOT_PASSWORD') ??
          cfg.get<string>('MINIO_SECRET_KEY');
        if (process.env.NODE_ENV === 'production' && (!accessKey || !secretKey)) {
          throw new Error(
            'Object storage credentials are not configured. Set ' +
              'MINIO_ROOT_USER + MINIO_ROOT_PASSWORD (or *_ACCESS_KEY / ' +
              '*_SECRET_KEY) to the provider access/secret keys.',
          );
        }

        logger.log(
          `Storage client (${provider}) → ${useSSL ? 'https' : 'http'}://${endpoint}:${port} region=${region}`,
        );
        return new MinioClient({
          endPoint: endpoint,
          port,
          useSSL,
          region,
          accessKey: accessKey ?? 'minioadmin',
          secretKey: secretKey ?? 'minioadmin',
        });
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
