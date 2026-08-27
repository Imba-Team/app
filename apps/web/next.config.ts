import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';

const repoRoot = path.join(import.meta.dirname, '..', '..');
loadDotenv({ path: path.join(repoRoot, '.env'), override: false });

// Prod image host — comma-separated https hostnames allowed for next/image.
// Falls back to the Railway staging host so existing envs keep working.
const prodImageHosts = (
  process.env.NEXT_PUBLIC_IMAGE_HOSTS ?? 'imba-server.up.railway.app'
)
  .split(',')
  .map((h) => h.trim())
  .filter(Boolean);

const nextConfig: NextConfig = {
  output: 'standalone',
  turbopack: {
    root: repoRoot,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '9090',
      },
      ...prodImageHosts.map((hostname) => ({
        protocol: 'https' as const,
        hostname,
      })),
    ],
  },
};

export default nextConfig;
