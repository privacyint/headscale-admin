/**
 * E2E tests that run against the production Docker build (Caddy + /admin base path).
 * Used by the `e2e-docker` CI job via playwright.docker.config.ts.
 *
 * All page.goto() calls use relative paths (e.g. './nodes/') so they resolve
 * correctly against the baseURL 'http://localhost:8080/admin/'.
 */
import { test, expect, type Page } from '@playwright/test';

const MOCK_URL = 'http://localhost:8081';
const API_KEY = 'test-api-key';

async function seedAuth(page: Page) {
  await page.goto('./');
  await page.evaluate(
    ([url, key]) => {
      localStorage.setItem('apiUrl', JSON.stringify(url));
      localStorage.setItem('apiKey', JSON.stringify(key));
      localStorage.setItem(
        'apiKeyInfo',
        JSON.stringify({
          authorized: true,
          expires: new Date(Date.now() + 86_400_000 * 90).toISOString(),
          informedUnauthorized: false,
          informedExpiringSoon: false,
        }),
      );
    },
    [MOCK_URL, API_KEY],
  );
  await page.reload();
  await page.locator('[data-testid="app-shell"]').waitFor({ timeout: 10000 });
}

test.describe('production routing (Docker / Caddy)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('root /admin/ renders dashboard', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByText(/total users/i)).toBeVisible({ timeout: 10000 });
  });

  test('/admin/nodes/ renders node list', async ({ page }) => {
    await page.goto('./nodes/');
    await expect(page.getByText('alice-laptop')).toBeVisible({ timeout: 10000 });
  });

  test('/admin/users/ renders user list', async ({ page }) => {
    await page.goto('./users/');
    await expect(page.getByText('alice')).toBeVisible({ timeout: 10000 });
  });

  test('refresh on /admin/nodes/ keeps page and content', async ({ page }) => {
    await page.goto('./nodes/');
    await expect(page.getByText('alice-laptop')).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page).toHaveURL(/\/admin\/nodes\/?/);
    await expect(page.getByText('alice-laptop')).toBeVisible({ timeout: 10000 });
  });

  test('refresh on /admin/users/ keeps page and content', async ({ page }) => {
    await page.goto('./users/');
    await expect(page.getByText('alice')).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page).toHaveURL(/\/admin\/users\/?/);
    await expect(page.getByText('alice')).toBeVisible({ timeout: 10000 });
  });

  test('direct URL access /admin/nodes/ does not give blank page', async ({ page }) => {
    // Opens a fresh tab directly at the path (simulates typing URL or bookmark)
    await page.goto('./nodes/');
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('alice-laptop')).toBeVisible({ timeout: 10000 });
  });

  test('unknown route /admin/nonexistent/ serves 200 (SPA fallback, no white screen)', async ({ page }) => {
    // Caddy should serve 200.html as the SPA fallback; the app should mount
    const response = await page.goto('./nonexistent/');
    expect(response?.status()).toBe(200);
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('authentication flow (Docker)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear credentials so we start unauthenticated
    await page.goto('./');
    await page.evaluate(() => {
      localStorage.removeItem('apiUrl');
      localStorage.removeItem('apiKey');
      localStorage.removeItem('apiKeyInfo');
    });
    await page.reload();
  });

  test('ApiKeyPrompt appears on /admin/ when unauthenticated', async ({ page }) => {
    await expect(page.getByRole('button', { name: /connect/i })).toBeVisible({ timeout: 5000 });
  });

  test('entering credentials dismisses modal and shows dashboard', async ({ page }) => {
    await page.getByRole('textbox', { name: 'API URL' }).fill(MOCK_URL);
    await page.getByRole('textbox', { name: 'API Key' }).fill(API_KEY);
    await page.getByRole('button', { name: /connect/i }).click();
    await expect(page.getByRole('button', { name: /connect/i })).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/total users/i)).toBeVisible({ timeout: 10000 });
  });

  test('refresh after auth stays on current page with content', async ({ page }) => {
    // Authenticate on the nodes page
    await page.goto('./nodes/');
    await page.getByRole('textbox', { name: 'API URL' }).fill(MOCK_URL);
    await page.getByRole('textbox', { name: 'API Key' }).fill(API_KEY);
    await page.getByRole('button', { name: /connect/i }).click();
    await expect(page.getByText('alice-laptop')).toBeVisible({ timeout: 10000 });

    // Refresh — should stay on nodes page, no white screen
    await page.reload();
    await expect(page).toHaveURL(/\/admin\/nodes\/?/);
    await expect(page.getByText('alice-laptop')).toBeVisible({ timeout: 10000 });
  });
});
