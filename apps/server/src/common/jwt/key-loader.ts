import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'crypto';
import { readFileSync } from 'fs';

export interface JwtKeyPair {
  privateKey: string;
  publicKey: string;
  /** True when the keys were generated at boot and are not persisted. */
  ephemeral: boolean;
}

const PRIVATE_PEM_HEADER = '-----BEGIN ';

/**
 * Load an RSA key pair for JWT signing/verification.
 *
 * Precedence (highest to lowest):
 *   1. JWT_PRIVATE_KEY / JWT_PUBLIC_KEY                      (raw PEM in env)
 *   2. JWT_PRIVATE_KEY_BASE64 / JWT_PUBLIC_KEY_BASE64        (base64 PEM)
 *   3. JWT_PRIVATE_KEY_PATH / JWT_PUBLIC_KEY_PATH            (file paths)
 *   4. Generate an ephemeral pair in process memory (dev only — warns)
 *
 * The split lets ops pick whichever delivery mechanism their platform
 * supports without code changes (env-injected secrets, mounted files,
 * dev `pnpm dev` with zero setup).
 */
export function loadJwtKeyPair(cfg: ConfigService): JwtKeyPair {
  const logger = new Logger('JwtKeyLoader');

  // 1. raw PEM in env
  const rawPriv = cfg.get<string>('JWT_PRIVATE_KEY');
  const rawPub = cfg.get<string>('JWT_PUBLIC_KEY');
  if (isLikelyPem(rawPriv) && isLikelyPem(rawPub)) {
    logger.log('JWT keys loaded from JWT_PRIVATE_KEY / JWT_PUBLIC_KEY env');
    return { privateKey: rawPriv, publicKey: rawPub, ephemeral: false };
  }

  // 2. base64-encoded PEM in env (handy for env-injection systems that can't
  //    handle newlines)
  const b64Priv = cfg.get<string>('JWT_PRIVATE_KEY_BASE64');
  const b64Pub = cfg.get<string>('JWT_PUBLIC_KEY_BASE64');
  if (b64Priv && b64Pub) {
    const priv = Buffer.from(b64Priv, 'base64').toString('utf8');
    const pub = Buffer.from(b64Pub, 'base64').toString('utf8');
    if (isLikelyPem(priv) && isLikelyPem(pub)) {
      logger.log('JWT keys loaded from *_BASE64 env vars');
      return { privateKey: priv, publicKey: pub, ephemeral: false };
    }
    logger.error(
      'JWT_PRIVATE_KEY_BASE64 / JWT_PUBLIC_KEY_BASE64 are set but did not ' +
        'decode to PEM. Falling through to the next loader.',
    );
  }

  // 3. file paths
  const privPath = cfg.get<string>('JWT_PRIVATE_KEY_PATH');
  const pubPath = cfg.get<string>('JWT_PUBLIC_KEY_PATH');
  if (privPath && pubPath) {
    const priv = readFileSync(privPath, 'utf8');
    const pub = readFileSync(pubPath, 'utf8');
    logger.log(`JWT keys loaded from files (${privPath}, ${pubPath})`);
    return { privateKey: priv, publicKey: pub, ephemeral: false };
  }

  // 4. ephemeral — dev-only fallback
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'JWT key pair is not configured. Set JWT_PRIVATE_KEY[_BASE64|_PATH] + ' +
        'JWT_PUBLIC_KEY[_BASE64|_PATH]. Refusing to boot with an ephemeral ' +
        'key pair in production — every restart would invalidate all sessions.',
    );
  }
  logger.warn(
    'NO RSA KEY PAIR CONFIGURED. Generating an ephemeral key pair for ' +
      'this process. All sessions will be invalidated when the app ' +
      'restarts. Set JWT_PRIVATE_KEY[_BASE64|_PATH] + JWT_PUBLIC_KEY[...] ' +
      'for production deployments.',
  );
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { privateKey, publicKey, ephemeral: true };
}

function isLikelyPem(value: string | undefined): value is string {
  return typeof value === 'string' && value.includes(PRIVATE_PEM_HEADER);
}
