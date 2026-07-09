import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig } from 'vite';

// Where Vite forwards /api/* requests during dev.
// Override with VITE_DEV_API_PROXY_TARGET if the backend runs elsewhere.
const DEV_API_PROXY_TARGET = process.env.VITE_DEV_API_PROXY_TARGET ?? 'http://localhost:9090';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 9000,
    strictPort: false,
    proxy: {
      // The frontend hits /api/v1/... on the Vite dev server (same-origin, no CORS).
      // Vite forwards to the backend, stripping the /api prefix, so the backend still
      // sees /v1/... exactly as spec'd. Set VITE_API_BASE_URL=/api in .env.
      '/api': {
        target: DEV_API_PROXY_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
