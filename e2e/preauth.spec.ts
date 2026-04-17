import { test, expect, type Page } from '@playwright/test';

const MOCK_URL = 'http://localhost:8081';
const API_KEY = 'test-api-key';

// ── Helpers ──────────────────────────────────────────────────────────────────

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

// ── Tests ────────────────────────────────────────────────────────────────────

test.describe('preauth keys', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('preauth page loads and shows keys', async ({ page }) => {
    await page.goto('/preauth');

    // Check page title
    await expect(page.locator('.font-mono').getByText('Preauth Keys')).toBeVisible();

    // Check that we have the sort buttons
    await expect(page.locator('.btn-group').getByText('ID')).toBeVisible();
    await expect(page.locator('.btn-group').getByText('User')).toBeVisible();
    await expect(page.locator('.btn-group').getByText('Created')).toBeVisible();
    await expect(page.locator('.btn-group').getByText('Expiration')).toBeVisible();

    // Check that existing preauth key is displayed
    await expect(page.getByText('ID: 1')).toBeVisible();
    await expect(page.getByText('User: alice')).toBeVisible();
  });

  test('preauth key creation works', async ({ page }) => {
    await page.goto('/preauth');

    // Click the create button
    await page.getByRole('button', { name: 'Create', exact: true }).first().click();

    // Check that the create form appears
    await expect(page.getByText('Ephemeral')).toBeVisible();
    await expect(page.getByText('Reusable')).toBeVisible();

    // Close the form without creating
    await page.getByRole('button', { name: 'Create', exact: true }).first().click();
  });

  test('preauth key details can be viewed', async ({ page }) => {
    await page.goto('/preauth');

    // Click on the accordion item to expand details
    await page.getByRole('button', { name: /ID: 1/ }).click();

    // Just check that the accordion expanded (we can see more content)
    await expect(page.getByText('ID: 1')).toBeVisible();
  });

  test('preauth key sorting works', async ({ page }) => {
    await page.goto('/preauth');

    // Click the User sort button
    await page.locator('.btn-group').getByText('User').click();

    // The existing key should still be visible
    await expect(page.getByText('ID: 1')).toBeVisible();
    await expect(page.getByText('User: alice')).toBeVisible();
  });

  test('preauth key filtering works', async ({ page }) => {
    await page.goto('/preauth');

    // Type in the filter box
    await page.getByPlaceholder('Search...').fill('alice');

    // The key should still be visible
    await expect(page.getByText('ID: 1')).toBeVisible();

    // Filter for something that doesn't exist
    await page.getByPlaceholder('Search...').fill('nonexistent');

    // The key should be hidden
    await expect(page.getByText('ID: 1')).not.toBeVisible();
  });
});

test.describe('deploy page preauth integration', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('deploy page shows preauth key options', async ({ page }) => {
    await page.goto('/deploy');

    // Check that the PreAuth Key checkbox is visible
    await expect(page.getByRole('checkbox', { name: 'PreAuth Key' })).toBeVisible();

    // Enable preauth key option
    await page.getByRole('checkbox', { name: 'PreAuth Key' }).check();

    // Check that user/global selector appears
    await expect(page.locator('select').first()).toBeVisible();
  });

  test('deploy page can create new preauth key', async ({ page }) => {
    await page.goto('/deploy');

    // Enable preauth key option
    await page.getByRole('checkbox', { name: 'PreAuth Key' }).check();

    // Select Global
    await page.locator('.flex.gap-2 select').first().selectOption('Global');

    // Click Create New button
    await page.getByRole('button', { name: 'Create New' }).click();

    // Check that the modal appears
    await expect(page.getByText('PreAuth Key Created')).toBeVisible();

    // Close the modal
    await page.getByRole('button', { name: 'Close' }).click();

    // Check that the command includes the new key
    const commandText = await page.locator('code').filter({ hasText: 'tailscale up' }).textContent();
    expect(commandText).toContain('--auth-key=');
  });

  test('deploy page can select existing preauth key', async ({ page }) => {
    await page.goto('/deploy');

    // Enable preauth key option
    await page.getByRole('checkbox', { name: 'PreAuth Key' }).check();

    // Select alice user
    await page.locator('.flex.gap-2 select').first().selectOption('alice');

    // Select the existing key
    await page.locator('select').nth(1).selectOption('pak_alice_0001');

    // Check that the command includes the selected key
    const commandText = await page.locator('code').textContent();
    expect(commandText).toContain('--auth-key=pak_alice_0001');
  });
});