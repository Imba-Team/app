import { test, expect, type Page } from '@playwright/test';

const fakeUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'jane@mimir.test',
  username: 'jane',
  name: 'jane',
  bio: null,
  emailVerified: true,
  role: 'user',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  profilePicture: null,
};

function ok<T>(data: T) {
  return { ok: true, data };
}

/**
 * Route stubs replace every /api/auth/* and /api/users/me call so the
 * test runs without a backend and without depending on MSW browser
 * setup timing.
 */
async function stubBackend(page: Page) {
  // Match both proxy path (/api/...) and direct backend (:9090/...) so the
  // stubs work regardless of VITE_API_BASE_URL.
  const jsonRes = <T,>(status: number, data: T) => ({
    status,
    contentType: 'application/json',
    body: JSON.stringify(ok(data)),
  });

  await page.route(/\/auth\/register$/, async (route) =>
    route.fulfill(jsonRes(202, { email: 'jane@mimir.test' })),
  );
  await page.route(/\/auth\/login$/, async (route) => route.fulfill(jsonRes(200, null)));
  await page.route(/\/auth\/logout$/, async (route) => route.fulfill(jsonRes(200, null)));
  await page.route(/\/auth\/refresh$/, async (route) => route.fulfill(jsonRes(200, null)));
  await page.route(/\/auth\/verify-email$/, async (route) => route.fulfill(jsonRes(200, null)));
  await page.route(/\/users\/me$/, async (route) => route.fulfill(jsonRes(200, fakeUser)));
  await page.route(/\/users\/me\/change-password$/, async (route) =>
    route.fulfill(jsonRes(200, null)),
  );
}

/**
 * Sprint 1 Definition of Done — the golden auth happy path:
 *   1. Register  → check-inbox banner on /login
 *   2. Verify email link  → success alert
 *   3. Login  → dashboard
 *   4. Settings → Change password  → success alert
 *   5. Sign out  → back on /login
 */
test('register → verify → login → change password → logout', async ({ page }) => {
  await stubBackend(page);

  // 1. Register
  await page.goto('/register');
  await expect(page.getByText('Create your account')).toBeVisible();

  await page.getByLabel('Username').fill('jane');
  await page.getByLabel('Email').fill('jane@mimir.test');
  await page.getByLabel('Password', { exact: true }).fill('StrongP@ss1');
  await page.getByLabel('Confirm password').fill('StrongP@ss1');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/login\?justRegistered=1/);
  await expect(page.getByText('Check your inbox')).toBeVisible();

  // 2. Verify email (simulate clicking the token in the email)
  await page.goto('/auth/verify-email?token=fake-verification-token');
  await expect(page.getByText('Email verified')).toBeVisible({ timeout: 10_000 });

  // 3. Login
  await page.goto('/login');
  await page.getByLabel('Email').fill('jane@mimir.test');
  await page.getByLabel('Password').fill('StrongP@ss1');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  // Dashboard
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();

  // 4. Change password via Settings
  await page.getByRole('link', { name: /settings/i }).click();
  await expect(page).toHaveURL('/settings/account');

  await page.getByLabel('Current password').fill('StrongP@ss1');
  await page.getByLabel('New password', { exact: true }).fill('EvenStr0nger!');
  await page.getByLabel('Confirm new password').fill('EvenStr0nger!');
  await page.getByRole('button', { name: 'Update password' }).click();

  await expect(page.getByText('Password updated')).toBeVisible();

  // 5. Sign out
  await page.getByRole('button', { name: /sign out/i }).click();
  await expect(page).toHaveURL('/login');
});
