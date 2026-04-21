import { test, expect, type Page } from '@playwright/test';

const MOCK_URL = 'http://localhost:8081';
const API_KEY = 'test-api-key';
const SSH_RULE_NAME = 'Ops Access';
const SECOND_SSH_RULE_NAME = 'Break Glass';
const SRC_HOST = 'group:admin';
const DST_HOST = 'tag:server';
const SSH_USERNAME = 'root';

async function resetMockApi() {
  const response = await fetch(`${MOCK_URL}/test/reset`, { method: 'POST' });
  expect(response.ok).toBe(true);
}

async function seedAuth(page: Page) {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('input[placeholder="Enter your API key"]', { timeout: 10000 });
  await page.getByLabel('API URL').fill(MOCK_URL);
  await page.getByPlaceholder('Enter your API key').fill(API_KEY);
  await page.getByRole('button', { name: 'Connect' }).click();
  await page.waitForSelector('text=Enter your Headscale API credentials to continue.', { state: 'hidden' });
  await page.locator('[data-testid="app-shell"]').waitFor({ timeout: 10000 });
}

async function openSshTab(page: Page) {
  await page.goto('/acls');
  await page.locator('[data-testid="app-shell"]').waitFor({ timeout: 10000 });
  await page.getByRole('tab', { name: 'SSH' }).click();
  await expect(page.getByRole('button', { name: 'Create SSH Rule' })).toBeVisible();
}

async function saveSshRules(page: Page) {
  await page.getByRole('button', { name: 'Save SSH Rules' }).click();
  await expect(page.getByText('Saved ACL Configuration')).toBeVisible({ timeout: 10000 });
}

async function createRule(page: Page, name: string) {
  await page.getByRole('button', { name: 'Create SSH Rule' }).click();
  const index = await page.locator('input[name^="ssh-rule-name-"]').count() - 1;
  const nameInput = page.locator(`input[name="ssh-rule-name-${index}"]`);
  await expect(nameInput).toBeVisible();
  await nameInput.fill(name);
  return index;
}

test.beforeEach(async () => {
  await resetMockApi();
});

test.describe('ssh rules', () => {
  test('ssh rule name and open state persist after save and reload', async ({ page }) => {
    await seedAuth(page);
    await openSshTab(page);

    await page.getByRole('button', { name: 'Create SSH Rule' }).click();

    const nameInput = page.locator('input[name="ssh-rule-name-0"]');
    const ruleSummary = page.getByText(`#1: ${SSH_RULE_NAME}`, { exact: true });

    await expect(nameInput).toBeVisible();
    await nameInput.fill(SSH_RULE_NAME);
    await expect(ruleSummary).toBeVisible();

    await ruleSummary.click();
    await expect(nameInput).not.toBeVisible();

    await page.getByRole('button', { name: 'Save SSH Rules' }).click();
    await expect(page.getByText('Saved ACL Configuration')).toBeVisible({ timeout: 10000 });

    await page.reload();
    await openSshTab(page);

    await expect(ruleSummary).toBeVisible();
    await expect(nameInput).not.toBeVisible();

    await ruleSummary.click();
    await expect(nameInput).toBeVisible();
    await expect(nameInput).toHaveValue(SSH_RULE_NAME);
  });

  test('ssh rules can be filtered by custom name after save', async ({ page }) => {
    await seedAuth(page);
    await openSshTab(page);

    const index = await createRule(page, SSH_RULE_NAME);

    const nameInput = page.locator(`input[name="ssh-rule-name-${index}"]`);
    const ruleSummary = page.getByText(`#1: ${SSH_RULE_NAME}`, { exact: true });
    const filterInput = page.getByPlaceholder('Filter SSH Rules...');

    await expect(nameInput).toBeVisible();
    await saveSshRules(page);

    await page.reload();
    await openSshTab(page);

    await filterInput.fill('Ops Access');
    await expect(ruleSummary).toBeVisible();

    await filterInput.fill('Does Not Exist');
    await expect(ruleSummary).not.toBeVisible();
  });

  test('ssh rule sources, destinations, and usernames persist after save', async ({ page }) => {
    await seedAuth(page);
    await openSshTab(page);

    const index = await createRule(page, SSH_RULE_NAME);
    const nameInput = page.locator(`input[name="ssh-rule-name-${index}"]`);
    const userInput = page.locator(`#ssh-rule-users-${index}-select-item`);

    await expect(nameInput).toBeVisible();

    await page.getByPlaceholder('Src Object...').fill(SRC_HOST);
    await page.getByRole('button', { name: 'Add' }).nth(0).click();
    await expect(page.getByText(SRC_HOST, { exact: true })).toBeVisible();

    await page.getByPlaceholder('Dst Object...').fill(DST_HOST);
    await page.getByRole('button', { name: 'Add' }).nth(1).click();
    await expect(page.getByText(DST_HOST, { exact: true })).toBeVisible();

    await userInput.fill(SSH_USERNAME);
    await userInput.press('Enter');
    await expect(page.getByRole('button', { name: SSH_USERNAME })).toBeVisible();

    await saveSshRules(page);

    await page.reload();
    await openSshTab(page);

    await expect(page.getByText(`#1: ${SSH_RULE_NAME}`, { exact: true })).toBeVisible();
    await expect(page.getByText(SRC_HOST, { exact: true })).toBeVisible();
    await expect(page.getByText(DST_HOST, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: SSH_USERNAME })).toBeVisible();
  });

  test('ssh filter distinguishes between multiple named rules', async ({ page }) => {
    await seedAuth(page);
    await openSshTab(page);

    await createRule(page, SSH_RULE_NAME);
    await createRule(page, SECOND_SSH_RULE_NAME);
    await saveSshRules(page);

    await page.reload();
    await openSshTab(page);

    const filterInput = page.getByPlaceholder('Filter SSH Rules...');
    const firstRuleSummary = page.getByText(`#1: ${SSH_RULE_NAME}`, { exact: true });
    const secondRuleSummary = page.getByText(`#2: ${SECOND_SSH_RULE_NAME}`, { exact: true });

    await filterInput.fill('Break Glass');
    await expect(secondRuleSummary).toBeVisible();
    await expect(firstRuleSummary).not.toBeVisible();

    await filterInput.fill('Ops Access');
    await expect(firstRuleSummary).toBeVisible();
    await expect(secondRuleSummary).not.toBeVisible();
  });

  test('empty ssh source is rejected', async ({ page }) => {
    await seedAuth(page);
    await openSshTab(page);

    await createRule(page, SSH_RULE_NAME);

    await page.getByPlaceholder('Src Object...').fill('');
    await page.getByRole('button', { name: 'Add' }).nth(0).click();

    await expect(page.getByText('Invalid Host Provided')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Sources:').locator('..').getByText(SRC_HOST, { exact: true })).not.toBeVisible();
  });

  test('empty ssh destination is rejected', async ({ page }) => {
    await seedAuth(page);
    await openSshTab(page);

    await createRule(page, SSH_RULE_NAME);

    await page.getByPlaceholder('Dst Object...').fill('');
    await page.getByRole('button', { name: 'Add' }).nth(1).click();

    await expect(page.getByText('Invalid Host Provided')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Destinations:').locator('..').getByText(DST_HOST, { exact: true })).not.toBeVisible();
  });

  test('ssh rule deletion persists after save and reload', async ({ page }) => {
    await seedAuth(page);
    await openSshTab(page);

    await createRule(page, SSH_RULE_NAME);
    await createRule(page, SECOND_SSH_RULE_NAME);
    await saveSshRules(page);

    const filterInput = page.getByPlaceholder('Filter SSH Rules...');
    const firstRuleSummary = page.getByText(`#1: ${SSH_RULE_NAME}`, { exact: true });
    const secondRuleSummary = page.getByText(`#2: ${SECOND_SSH_RULE_NAME}`, { exact: true });

    await filterInput.fill('Ops Access');
    await expect(firstRuleSummary).toBeVisible();
    await expect(secondRuleSummary).not.toBeVisible();

    await page.getByTestId('delete-button').click();
    await page.getByTestId('confirm-delete').click();
    await expect(firstRuleSummary).not.toBeVisible();

    await filterInput.clear();
    await saveSshRules(page);

    await page.reload();
    await openSshTab(page);

    await expect(page.getByText(`#1: ${SSH_RULE_NAME}`, { exact: true })).not.toBeVisible();
    await expect(page.getByText(`#1: ${SECOND_SSH_RULE_NAME}`, { exact: true })).toBeVisible();
  });
});
