import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
