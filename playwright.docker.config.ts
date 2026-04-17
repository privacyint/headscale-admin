/**
 * Playwright config for running E2E tests against the production Docker build.
 * The container must be running on port 8080 before this config is used.
 * The mock API must be running on port 8081.
 *
 * Routes use SvelteKit base path /admin, so baseURL must include the trailing
 * slash so that relative paths (e.g. `./nodes/`) resolve correctly.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/docker.spec.ts',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    // Production build uses /admin base path — trailing slash is required so
    // that `page.goto('./nodes/')` resolves to /admin/nodes/ not /nodes/
    baseURL: 'http://localhost:8080/admin/',
    headless: true,
  },
  // No webServer — the container and mock API are started separately by CI
});
