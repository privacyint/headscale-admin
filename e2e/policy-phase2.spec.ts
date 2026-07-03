import { test, expect, type Page } from '@playwright/test';

const MOCK_URL = 'http://localhost:8081';
const API_KEY = 'test-api-key';

async function seedAuth(page: Page) {
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
  await page.reload();
  await page.locator('[data-testid="app-shell"]').waitFor({ timeout: 10000 });
}

test.describe('policy builder phase 2', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
  });

  test('create and persist grants/nodeAttrs/randomizeClientPort', async ({ page }) => {
    await page.goto('/acls/');

    await page.getByRole('tab', { name: 'Grants' }).click();
    await page.getByRole('button', { name: 'Create Grant' }).click();
    await expect(page.getByRole('heading', { name: 'Grant #1' })).toBeVisible();
    await page.getByRole('button', { name: 'Apply Taildrive preset' }).first().click();
    await page.getByRole('button', { name: 'Apply capability form' }).first().click();

    await page.getByRole('tab', { name: 'Node Attributes' }).click();
    await page.getByRole('button', { name: 'Create Node Attribute Rule' }).click();
    await expect(page.getByRole('heading', { name: 'Node Attribute #1' })).toBeVisible();
    await page.getByRole('button', { name: 'drive:share' }).first().click();

    await page.getByRole('tab', { name: 'Policy Settings' }).click();
    await page.getByLabel('randomizeClientPort').check();

    await page.getByRole('tab', { name: 'Config' }).click();
    await page.getByRole('button', { name: 'Save Config' }).click();

    await page.reload();
    await page.getByRole('tab', { name: 'Config' }).click();

    await expect(page.getByText('"randomizeClientPort": true')).toBeVisible();
    await expect(page.getByText('"nodeAttrs"')).toBeVisible();
    await expect(page.getByText('tailscale.com/cap/drive')).toBeVisible();
  });

  test('delete grant and persist deletion', async ({ page }) => {
    await page.goto('/acls/');

    await page.getByRole('tab', { name: 'Grants' }).click();
    await page.getByRole('button', { name: 'Create Grant' }).click();
    await page.getByRole('button', { name: 'Apply Taildrive preset' }).first().click();
    await page.getByRole('button', { name: 'Apply capability form' }).first().click();

    await page.getByRole('tab', { name: 'Config' }).click();
    await page.getByRole('button', { name: 'Save Config' }).click();

    await page.getByRole('tab', { name: 'Grants' }).click();
    await page.getByTestId('delete-button').first().click();
    await page.getByTestId('confirm-delete').first().click();

    await page.getByRole('tab', { name: 'Config' }).click();
    await page.getByRole('button', { name: 'Save Config' }).click();

    await page.reload();
    await page.getByRole('tab', { name: 'Config' }).click();

    await expect(page.getByText('tailscale.com/cap/drive')).not.toBeVisible();
  });
});
