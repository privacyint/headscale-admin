import { test, expect, type Page } from '@playwright/test';

const MOCK_URL = 'http://localhost:8081';
const API_KEY = 'test-api-key';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Clear localStorage so we start from an unauthenticated state. */
async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('apiUrl');
    localStorage.removeItem('apiKey');
    localStorage.removeItem('apiKeyInfo');
  });
}

/** Fill in the API key prompt modal and submit. */
async function authenticate(page: Page) {
  await page.getByRole('textbox', { name: 'API URL' }).fill(MOCK_URL);
  await page.getByRole('textbox', { name: 'API Key' }).fill(API_KEY);
  await page.getByRole('button', { name: /connect/i }).click();
}

/** Pre-seed localStorage so the page loads already authenticated. */
async function seedAuth(page: Page) {
  // Visit a page first so we can inject into its storage origin
  await page.goto('/');
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
  // Reload so StateLocal reads the seeded values
  await page.reload();
  // Wait for the app shell to be ready
  await page.locator('[data-testid="app-shell"]').waitFor({ timeout: 10000 });
}

// Collect console errors for debugging
test.beforeEach(async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log(`[BROWSER ERROR] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    console.log(`[PAGE ERROR] ${err.message}`);
  });
});

// ── 1. Unauthenticated: prompt appears ───────────────────────────────────────

test.describe('unauthenticated', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAuth(page);
    await page.reload();
  });

  test('root shows API key prompt modal', async ({ page }) => {
    await expect(page.getByRole('textbox', { name: 'API Key' })).toBeVisible();
    await expect(page.getByRole('button', { name: /connect/i })).toBeVisible();
  });

  test('prompt appears on /nodes/ too', async ({ page }) => {
    await page.goto('/nodes/');
    await expect(page.getByRole('textbox', { name: 'API Key' })).toBeVisible();
  });

  test('prompt appears on /users/', async ({ page }) => {
    await page.goto('/users/');
    await expect(page.getByRole('textbox', { name: 'API Key' })).toBeVisible();
  });

  test('prompt appears on /settings/', async ({ page }) => {
    await page.goto('/settings/');
    // Settings page also has an API Key input, so scope to the modal
    await expect(page.getByRole('button', { name: /connect/i })).toBeVisible();
  });

  test('prompt appears on /tags/', async ({ page }) => {
    await page.goto('/tags/');
    await expect(page.getByRole('textbox', { name: 'API Key' })).toBeVisible();
  });

  test('prompt appears on /preauth/', async ({ page }) => {
    await page.goto('/preauth/');
    await expect(page.getByRole('textbox', { name: 'API Key' })).toBeVisible();
  });

  test('invalid API key shows error', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('textbox', { name: 'API URL' }).fill(MOCK_URL);
    await page.getByRole('textbox', { name: 'API Key' }).fill('wrong-key');
    await page.getByRole('button', { name: /connect/i }).click();
    await expect(page.getByText(/invalid api key/i)).toBeVisible({ timeout: 5000 });
  });
});

// ── 2. Authentication flow ────────────────────────────────────────────────────

test.describe('authentication flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAuth(page);
    await page.reload();
  });

  test('valid credentials dismiss the modal and show dashboard', async ({ page }) => {
    await authenticate(page);
    // Modal should disappear
    await expect(page.getByRole('textbox', { name: 'API Key' })).not.toBeVisible({ timeout: 10000 });
    // Dashboard summary tiles should appear
    await expect(page.getByText(/users online/i)).toBeVisible({ timeout: 10000 });
  });

  test('authenticating on /nodes/ stays on nodes page', async ({ page }) => {
    await page.goto('/nodes/');
    await authenticate(page);
    await expect(page.getByRole('textbox', { name: 'API Key' })).not.toBeVisible({ timeout: 10000 });
    // Should still be on /nodes/, not redirected elsewhere
    await expect(page).toHaveURL(/\/nodes\/?/);
  });

  test('authenticating on /users/ stays on users page', async ({ page }) => {
    await page.goto('/users/');
    await authenticate(page);
    await expect(page.getByRole('textbox', { name: 'API Key' })).not.toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/users\/?/);
  });
});

// ── 3. Authenticated navigation ──────────────────────────────────────────────

test.describe('authenticated navigation', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('/ loads dashboard with summary data', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/users online/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/^nodes online$/i)).toBeVisible();
  });

  test('/nodes/ renders node list', async ({ page }) => {
    await page.goto('/nodes/');
    // Node from fixture data
    await expect(page.getByText('alice-laptop')).toBeVisible({ timeout: 10000 });
  });

  test('/users/ renders user list', async ({ page }) => {
    await page.goto('/users/');
    await expect(page.getByText('alice')).toBeVisible({ timeout: 10000 });
  });

  test('/settings/ renders settings form', async ({ page }) => {
    await page.goto('/settings/');
    await expect(page.getByText(/api url/i)).toBeVisible({ timeout: 10000 });
  });

  test('/deploy/ renders deploy page', async ({ page }) => {
    await page.goto('/deploy/');
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 10000 });
  });

  test('/preauth/ renders preauth keys page', async ({ page }) => {
    await page.goto('/preauth/');
    await expect(page.locator('.font-mono').getByText('Preauth Keys')).toBeVisible({ timeout: 10000 });
  });

  test('/routes/ renders routes page', async ({ page }) => {
    await page.goto('/routes/');
    await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 10000 });
  });

  test('/tags/ renders tags page with tag data', async ({ page }) => {
    await page.goto('/tags/');
    await expect(page.locator('.font-mono').getByText('Tags')).toBeVisible({ timeout: 10000 });
    // bob-server has tag:server, infra-gateway has tag:server + tag:infra
    await expect(page.getByText('tag:server')).toBeVisible({ timeout: 10000 });
  });
});

// ── 4. Refresh behaviour ─────────────────────────────────────────────────────

test.describe('refresh', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('refreshing /nodes/ keeps you on nodes page', async ({ page }) => {
    await page.goto('/nodes/');
    await expect(page.getByText('alice-laptop')).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page).toHaveURL(/\/nodes\/?/);
    await expect(page.getByText('alice-laptop')).toBeVisible({ timeout: 10000 });
  });

  test('refreshing /users/ keeps you on users page', async ({ page }) => {
    await page.goto('/users/');
    await expect(page.getByText('alice')).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page).toHaveURL(/\/users\/?/);
    await expect(page.getByText('alice')).toBeVisible({ timeout: 10000 });
  });

  test('refreshing / keeps you on dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/users online/i)).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page.getByText(/users online/i)).toBeVisible({ timeout: 10000 });
  });

  test('refreshing /tags/ keeps you on tags page', async ({ page }) => {
    await page.goto('/tags/');
    await expect(page.getByText('tag:server')).toBeVisible({ timeout: 10000 });
    await page.reload();
    await expect(page).toHaveURL(/\/tags\/?/);
    await expect(page.getByText('tag:server')).toBeVisible({ timeout: 10000 });
  });
});

// ── 5. Back button behaviour ─────────────────────────────────────────────────

test.describe('back button', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('navigating forward and back preserves pages', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/users online/i)).toBeVisible({ timeout: 10000 });

    // Navigate to nodes via sidebar link
    await page.getByRole('link', { name: /nodes/i }).first().click();
    await expect(page).toHaveURL(/\/nodes\/?/);
    await expect(page.getByText('alice-laptop')).toBeVisible({ timeout: 10000 });

    // Navigate to users
    await page.getByRole('link', { name: /users/i }).first().click();
    await expect(page).toHaveURL(/\/users\/?/);
    await expect(page.getByText('alice (Alice)')).toBeVisible({ timeout: 10000 });

    // Go back to nodes
    await page.goBack();
    await expect(page).toHaveURL(/\/nodes\/?/);
    await expect(page.getByText('alice-laptop').first()).toBeVisible({ timeout: 10000 });

    // Go back to dashboard
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText(/users online/i)).toBeVisible({ timeout: 10000 });
  });
});

// ── 6. No white screen on direct URL access ──────────────────────────────────

test.describe('direct URL access (no white screen)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  const routes = ['/', '/nodes/', '/users/', '/tags/', '/settings/', '/deploy/', '/routes/', '/acls/', '/visualise/'];

  for (const route of routes) {
    test(`${route} renders content (not blank)`, async ({ page }) => {
      await page.goto(route);
      // The AppShell should be visible — if we get a white screen this fails
      await expect(page.locator('[data-testid="app-shell"]')).toBeVisible({ timeout: 10000 });
      // Body should have meaningful content
      const bodyText = await page.locator('body').innerText();
      expect(bodyText.trim().length).toBeGreaterThan(0);
    });
  }
});
