import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'happy-dom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
      coverage: {
        reporter: ['text', 'html'],
        exclude: ['**/*.d.ts', '**/*.config.*', 'src/main.tsx', 'src/vite-env.d.ts'],
      },
    },
  }),
);
