import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import * as crypto from 'crypto';
import { extname } from 'path';
import { STORAGE_CLIENT } from './storage.constants';

export interface UploadOptions {
  /** Logical prefix inside the shared bucket (e.g. 'avatars'). */
  prefix: string;
  /** Raw bytes to write. */
  body: Buffer;
  /** Original file name — used only to derive the extension. */
  originalName: string;
  /** Mime type, sent to MinIO and propagated to public reads. */
  mimeType: string;
  /**
   * Optional pre-built key (without prefix). Defaults to a UUID-based
   * key so concurrent uploads can never collide.
   */
  key?: string;
}

export interface UploadResult {
  /** Fully-qualified public URL — what you store on the user record. */
  url: string;
  /** `prefix/key.ext` — what you'd pass back to delete(). */
  objectName: string;
}

@Injectable()
export class StorageService implements OnApplicationBootstrap {
  private readonly logger = new Logger(StorageService.name);
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly provider: 'minio' | 'r2' | 's3';
  private readonly publicUrlIncludesBucket: boolean;

  constructor(
    @Inject(STORAGE_CLIENT) private readonly client: MinioClient,
    cfg: ConfigService,
  ) {
    this.bucket = cfg.get<string>('MINIO_BUCKET') ?? 'mimir';
    // Public URL the FE will hit. In production this should be a CDN
    // host fronting the bucket; in local dev it points straight at MinIO.
    this.publicUrl =
      cfg.get<string>('MINIO_PUBLIC_URL') ?? 'http://localhost:9000';
    this.provider = (
      cfg.get<string>('STORAGE_PROVIDER') ?? 'minio'
    ).toLowerCase() as 'minio' | 'r2' | 's3';
    // MinIO's public URL is `<endpoint>/<bucket>/<object>`. R2 and most
    // S3 CDN setups serve at `<host>/<object>` (bucket already baked into
    // the host or worker route). Default preserves MinIO behavior.
    this.publicUrlIncludesBucket = this.provider === 'minio';
  }

  /**
   * Ensure the configured bucket exists and has a public-read policy
   * applied. Idempotent: safe to call on every boot. Skipped for R2/S3
   * because those providers manage buckets and public-access via their
   * own dashboards (R2 public dev URL / custom domain, S3 bucket policy
   * you set once out-of-band).
   */
  async onApplicationBootstrap(): Promise<void> {
    if (this.provider !== 'minio') {
      this.logger.log(
        `Storage provider = ${this.provider}; skipping bucket create + policy bootstrap`,
      );
      return;
    }
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Created MinIO bucket "${this.bucket}"`);
      }
      await this.applyPublicReadPolicy();
    } catch (err) {
      // Don't crash the app boot if MinIO is unreachable — the upload
      // endpoint will fail with a clear error at call time instead.
      this.logger.warn(
        `MinIO bucket bootstrap skipped (will retry on first upload): ${describe(err)}`,
      );
    }
  }

  async upload(opts: UploadOptions): Promise<UploadResult> {
    const ext = extname(opts.originalName).toLowerCase();
    const key = opts.key ?? `${crypto.randomUUID()}${ext}`;
    const objectName = `${opts.prefix}/${key}`;

    await this.client.putObject(
      this.bucket,
      objectName,
      opts.body,
      opts.body.length,
      {
        'Content-Type': opts.mimeType,
      },
    );

    return {
      url: this.buildPublicUrl(objectName),
      objectName,
    };
  }

  async delete(objectName: string): Promise<void> {
    try {
      await this.client.removeObject(this.bucket, objectName);
    } catch (err) {
      // Deletes are best-effort — a missing key is fine (already gone);
      // any other error is logged but does not bubble up because we
      // typically delete the OLD object after the new one is already
      // recorded on the user.
      this.logger.warn(
        `Delete failed for ${objectName} (ignored): ${describe(err)}`,
      );
    }
  }

  /**
   * Build the canonical public URL for an object. Storing the
   * `objectName` (prefix/key.ext) on the user record and rebuilding the
   * URL on read would be more flexible, but the avatar workflow already
   * stores the URL directly for backwards compatibility with existing
   * static-served avatars.
   */
  buildPublicUrl(objectName: string): string {
    const base = this.publicUrl.replace(/\/$/, '');
    return this.publicUrlIncludesBucket
      ? `${base}/${this.bucket}/${objectName}`
      : `${base}/${objectName}`;
  }

  /**
   * Best-effort: apply an anonymous read-only bucket policy so the
   * generated URLs work without signed-URL machinery on every request.
   * Acceptable for avatars (publicly visible by design). Sensitive
   * content should live in a different bucket with a stricter policy.
   */
  private async applyPublicReadPolicy(): Promise<void> {
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicRead',
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        },
      ],
    };
    await this.client.setBucketPolicy(this.bucket, JSON.stringify(policy));
  }
}

function describe(err: unknown): string {
  return err instanceof Error ? err.message : JSON.stringify(err);
}
