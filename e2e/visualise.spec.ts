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

test.describe('visualise page', () => {
  test.beforeEach(async ({ page }) => {
    await seedAuth(page);
    await page.goto('/visualise/');
    // wait for SVG (policy must have loaded too)
    await page.locator('[data-testid="visualise-svg"]').waitFor({ timeout: 10000 });
  });

  test('is reachable from the sidebar navigation', async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: /visualise/i }).first();
    await expect(link).toBeVisible({ timeout: 10000 });
    await link.click();
    await expect(page).toHaveURL(/\/visualise\/?/);
    await expect(page.getByRole('img', { name: /acl node graph/i })).toBeVisible({
      timeout: 10000,
    });
  });

  test('shows an Experimental banner', async ({ page }) => {
    await expect(page.locator('[data-testid="experimental-banner"]')).toBeVisible();
    await expect(page.locator('[data-testid="experimental-banner"]')).toContainText(
      /experimental/i,
    );
  });

  test('renders a node per user, node, group, tag and the wildcard', async ({ page }) => {
    const kinds = await page
      .locator('[data-testid="graph-node"]')
      .evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.nodeKind));
    expect(kinds).toEqual(expect.arrayContaining(['user', 'node', 'group', 'tag', 'wildcard']));
  });

  test('renders ACL accept edges', async ({ page }) => {
    await expect(page.locator('[data-testid="edge-acl-accept"]').first()).toBeVisible();
    const count = await page.locator('[data-testid="edge-acl-accept"]').count();
    expect(count).toBeGreaterThan(0);
  });

  test('search input filters nodes by label', async ({ page }) => {
    const allCount = await page.locator('[data-testid="graph-node"]').count();
    await page.locator('[data-testid="visualise-search"]').fill('alice');
    // Give Svelte a tick to apply reactive updates
    await expect
      .poll(async () => await page.locator('[data-testid="graph-node"]').count())
      .toBeLessThan(allCount);
    // alice user should still be present
    await expect(page.locator('[data-testid="graph-node"][data-node-id="user:alice"]'))
      .toBeVisible();
  });

  test('kind toggle hides entities of that kind', async ({ page }) => {
    await expect(
      page.locator('[data-testid="graph-node"][data-node-kind="tag"]').first(),
    ).toBeVisible();
    await page.locator('[data-testid="kind-toggle-tag"]').uncheck();
    await expect(page.locator('[data-testid="graph-node"][data-node-kind="tag"]')).toHaveCount(0);
  });

  test('relation toggle hides edges of that kind', async ({ page }) => {
    await expect(page.locator('[data-testid="edge-acl-accept"]').first()).toBeVisible();
    await page.locator('[data-testid="edge-toggle-acl-accept"]').uncheck();
    await expect(page.locator('[data-testid="edge-acl-accept"]')).toHaveCount(0);
  });

  test('reset filters restores all entities and relations', async ({ page }) => {
    await page.locator('[data-testid="kind-toggle-tag"]').uncheck();
    await page.locator('[data-testid="edge-toggle-acl-accept"]').uncheck();
    await page.locator('[data-testid="visualise-search"]').fill('zzzzz');
    await expect(page.locator('[data-testid="visualise-empty"]')).toBeVisible();

    await page.locator('[data-testid="visualise-reset"]').click();
    await expect(page.locator('[data-testid="visualise-svg"]')).toBeVisible();
    await expect(
      page.locator('[data-testid="graph-node"][data-node-kind="tag"]').first(),
    ).toBeVisible();
    await expect(page.locator('[data-testid="edge-acl-accept"]').first()).toBeVisible();
  });

  test('clicking a node opens the details panel and highlights neighbours', async ({ page }) => {
    // Before selection, no-selection hint should be visible
    await expect(page.locator('[data-testid="visualise-no-selection"]')).toBeVisible();

    // click alice
    await page.locator('[data-testid="graph-node"][data-node-id="user:alice"]').click();
    const details = page.locator('[data-testid="visualise-details"]');
    await expect(details).toContainText('alice');
    await expect(details.getByText('Connected to:')).toBeVisible();
    // alice should be connected to at least one other entity (her laptop, her group, etc.)
    const chips = page.locator('[data-testid="neighbour-chip"]');
    await expect(chips.first()).toBeVisible();
    expect(await chips.count()).toBeGreaterThan(0);
  });

  test('drill-down: clicking a neighbour chip changes selection', async ({ page }) => {
    await page.locator('[data-testid="graph-node"][data-node-id="user:alice"]').click();
    const firstChip = page.locator('[data-testid="neighbour-chip"]').first();
    const chipText = (await firstChip.innerText()).trim();
    await firstChip.click();
    const details = page.locator('[data-testid="visualise-details"]');
    await expect(details).toContainText(chipText);
  });

  test('clear selection button deselects', async ({ page }) => {
    await page.locator('[data-testid="graph-node"][data-node-id="user:alice"]').click();
    await expect(page.locator('[data-testid="visualise-clear-selection"]')).toBeVisible();
    await page.locator('[data-testid="visualise-clear-selection"]').click();
    await expect(page.locator('[data-testid="visualise-no-selection"]')).toBeVisible();
  });

  test('shows empty state when filters match nothing', async ({ page }) => {
    await page.locator('[data-testid="visualise-search"]').fill('no-such-entity-xyz');
    await expect(page.locator('[data-testid="visualise-empty"]')).toBeVisible();
  });
});
