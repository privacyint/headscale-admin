import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/docker.spec.ts',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
  },
  webServer: [
    {
      command: 'node e2e/mock-api.mjs',
      port: 8081,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite dev --port 5173',
      port: 5173,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
