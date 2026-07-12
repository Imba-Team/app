import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for the Mimir web app. Runs against MSW-mocked APIs
 * (no real backend), so it can execute anywhere the frontend builds.
 *
 * Env:
 *   VITE_ENABLE_MOCKS=true — enables MSW in main.tsx
 *   VITE_API_BASE_URL=/api — MSW handlers match wildcard prefixes, so this works
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:9000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // API is stubbed per-test via page.route (see e2e/*.spec.ts), so the
  // dev server doesn't need MSW enabled. Reuses an existing dev server
  // on :9000 for local iteration; starts one in CI.
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:9000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
