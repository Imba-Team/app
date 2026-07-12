import { ConfigService } from '@nestjs/config';
import { Client as MinioClient } from 'minio';
import { StorageService } from './storage.service';
import { StoragePrefix } from './storage.constants';

interface ClientMock {
  bucketExists: jest.Mock;
  makeBucket: jest.Mock;
  setBucketPolicy: jest.Mock;
  putObject: jest.Mock;
  removeObject: jest.Mock;
}

const makeClient = (): ClientMock => ({
  bucketExists: jest.fn().mockResolvedValue(true),
  makeBucket: jest.fn().mockResolvedValue(undefined),
  setBucketPolicy: jest.fn().mockResolvedValue(undefined),
  putObject: jest.fn().mockResolvedValue({ etag: 'etag-1' }),
  removeObject: jest.fn().mockResolvedValue(undefined),
});

const makeConfig = (overrides: Record<string, string> = {}): ConfigService =>
  ({
    get: jest.fn((key: string) => overrides[key]),
  }) as unknown as ConfigService;

const build = (
  cfgOverrides: Record<string, string> = {},
  clientOverride?: ClientMock,
) => {
  const client = clientOverride ?? makeClient();
  const cfg = makeConfig({
    MINIO_BUCKET: 'mimir',
    MINIO_PUBLIC_URL: 'http://cdn.test',
    ...cfgOverrides,
  });
  const svc = new StorageService(client as unknown as MinioClient, cfg);
  return { svc, client };
};

describe('StorageService.upload', () => {
  it('writes the object under <prefix>/<uuid>.<ext> when no key is provided', async () => {
    const { svc, client } = build();

    const result = await svc.upload({
      prefix: StoragePrefix.AVATARS,
      body: Buffer.from('binary'),
      originalName: 'photo.PNG',
      mimeType: 'image/png',
    });

    expect(result.objectName).toMatch(/^avatars\/[a-f0-9-]+\.png$/);
    expect(result.url).toBe(`http://cdn.test/mimir/${result.objectName}`);

    expect(client.putObject).toHaveBeenCalledWith(
      'mimir',
      result.objectName,
      expect.any(Buffer),
      6,
      { 'Content-Type': 'image/png' },
    );
  });

  it('honours a caller-supplied key (no random UUID)', async () => {
    const { svc, client } = build();

    const result = await svc.upload({
      prefix: StoragePrefix.AVATARS,
      key: 'u-1/abcd1234.png',
      body: Buffer.from('binary'),
      originalName: 'photo.png',
      mimeType: 'image/png',
    });

    expect(result.objectName).toBe('avatars/u-1/abcd1234.png');
    expect(client.putObject).toHaveBeenCalledWith(
      'mimir',
      'avatars/u-1/abcd1234.png',
      expect.any(Buffer),
      6,
      { 'Content-Type': 'image/png' },
    );
  });

  it('builds the public URL using MINIO_PUBLIC_URL and trims trailing slash', () => {
    const { svc } = build({ MINIO_PUBLIC_URL: 'http://cdn.test/' });
    expect(svc.buildPublicUrl('avatars/x.png')).toBe(
      'http://cdn.test/mimir/avatars/x.png',
    );
  });
});

describe('StorageService.delete', () => {
  it('removes the object', async () => {
    const { svc, client } = build();
    await svc.delete('avatars/u-1/abc.png');
    expect(client.removeObject).toHaveBeenCalledWith(
      'mimir',
      'avatars/u-1/abc.png',
    );
  });

  it('swallows errors so callers do not need a try/catch', async () => {
    const client = makeClient();
    client.removeObject.mockRejectedValue(new Error('not found'));
    const { svc } = build({}, client);

    await expect(svc.delete('avatars/missing.png')).resolves.toBeUndefined();
  });
});

describe('StorageService.onApplicationBootstrap', () => {
  it('creates the bucket when missing then applies the public-read policy', async () => {
    const client = makeClient();
    client.bucketExists.mockResolvedValue(false);
    const { svc } = build({}, client);

    await svc.onApplicationBootstrap();

    expect(client.makeBucket).toHaveBeenCalledWith('mimir');
    expect(client.setBucketPolicy).toHaveBeenCalledWith(
      'mimir',
      expect.stringContaining('"s3:GetObject"'),
    );
  });

  it('skips makeBucket when the bucket already exists, still sets the policy', async () => {
    const client = makeClient();
    client.bucketExists.mockResolvedValue(true);
    const { svc } = build({}, client);

    await svc.onApplicationBootstrap();

    expect(client.makeBucket).not.toHaveBeenCalled();
    expect(client.setBucketPolicy).toHaveBeenCalledTimes(1);
  });

  it('does not throw when MinIO is unreachable (degrades gracefully)', async () => {
    const client = makeClient();
    client.bucketExists.mockRejectedValue(new Error('ECONNREFUSED'));
    const { svc } = build({}, client);

    await expect(svc.onApplicationBootstrap()).resolves.toBeUndefined();
  });
});
