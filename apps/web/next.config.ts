import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import type { NextConfig } from 'next';

const repoRoot = path.join(import.meta.dirname, '..', '..');
loadDotenv({ path: path.join(repoRoot, '.env'), override: false });

const nextConfig: NextConfig = {
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
      {
        protocol: 'https',
        hostname: 'imba-server.up.railway.app',
      },
    ],
  },
};

export default nextConfig;
