import { generateKeyPairSync } from 'crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { loadJwtKeyPair } from './key-loader';

interface ConfigLike {
  get<T>(key: string): T | undefined;
}

const makeConfig = (env: Record<string, string | undefined>): ConfigLike => ({
  get: <T>(key: string): T | undefined => env[key] as T | undefined,
});

const realPair = () =>
  generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

describe('loadJwtKeyPair', () => {
  it('loads raw PEM from JWT_PRIVATE_KEY / JWT_PUBLIC_KEY env when set', () => {
    const { privateKey, publicKey } = realPair();

    const result = loadJwtKeyPair(
      makeConfig({
        JWT_PRIVATE_KEY: privateKey,
        JWT_PUBLIC_KEY: publicKey,
      }) as never,
    );

    expect(result.privateKey).toBe(privateKey);
    expect(result.publicKey).toBe(publicKey);
    expect(result.ephemeral).toBe(false);
  });

  it('decodes base64 PEM when raw env is not set', () => {
    const { privateKey, publicKey } = realPair();
    const result = loadJwtKeyPair(
      makeConfig({
        JWT_PRIVATE_KEY_BASE64: Buffer.from(privateKey).toString('base64'),
        JWT_PUBLIC_KEY_BASE64: Buffer.from(publicKey).toString('base64'),
      }) as never,
    );

    expect(result.privateKey).toBe(privateKey);
    expect(result.publicKey).toBe(publicKey);
    expect(result.ephemeral).toBe(false);
  });

  it('falls through to ephemeral when base64 vars do not decode to PEM', () => {
    const result = loadJwtKeyPair(
      makeConfig({
        JWT_PRIVATE_KEY_BASE64: Buffer.from('not-a-pem').toString('base64'),
        JWT_PUBLIC_KEY_BASE64: Buffer.from('also-not-a-pem').toString('base64'),
      }) as never,
    );

    expect(result.ephemeral).toBe(true);
    expect(result.privateKey).toContain('BEGIN');
    expect(result.publicKey).toContain('BEGIN');
  });

  it('loads from disk when JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH set', () => {
    const dir = mkdtempSync(join(tmpdir(), 'key-loader-'));
    try {
      const { privateKey, publicKey } = realPair();
      const privPath = join(dir, 'priv.pem');
      const pubPath = join(dir, 'pub.pem');
      writeFileSync(privPath, privateKey, 'utf8');
      writeFileSync(pubPath, publicKey, 'utf8');

      const result = loadJwtKeyPair(
        makeConfig({
          JWT_PRIVATE_KEY_PATH: privPath,
          JWT_PUBLIC_KEY_PATH: pubPath,
        }) as never,
      );

      expect(result.privateKey).toBe(privateKey);
      expect(result.publicKey).toBe(publicKey);
      expect(result.ephemeral).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('generates a usable ephemeral pair when no env is set at all', () => {
    const result = loadJwtKeyPair(makeConfig({}) as never);
    expect(result.ephemeral).toBe(true);
    expect(result.privateKey).toContain('BEGIN');
    expect(result.publicKey).toContain('BEGIN PUBLIC KEY');
  });

  it('precedence: raw env beats base64 beats path', () => {
    const { privateKey: rawPriv, publicKey: rawPub } = realPair();
    const { privateKey: b64Priv, publicKey: b64Pub } = realPair();
    const result = loadJwtKeyPair(
      makeConfig({
        JWT_PRIVATE_KEY: rawPriv,
        JWT_PUBLIC_KEY: rawPub,
        JWT_PRIVATE_KEY_BASE64: Buffer.from(b64Priv).toString('base64'),
        JWT_PUBLIC_KEY_BASE64: Buffer.from(b64Pub).toString('base64'),
      }) as never,
    );

    expect(result.privateKey).toBe(rawPriv);
    expect(result.publicKey).toBe(rawPub);
  });
});
