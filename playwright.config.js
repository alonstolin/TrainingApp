import { defineConfig, devices } from '@playwright/test';

/**
 * WebKit + iPhone emulation, served from the SAME /TrainingApp/ subpath that
 * GitHub Pages uses. Testing at the server root hides every relative-path bug
 * until deploy — which is precisely when they become painful to debug.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:4173/TrainingApp/',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'iphone-webkit',
      use: { ...devices['iPhone 14'], browserName: 'webkit' },
    },
  ],
  webServer: {
    command: 'node tools/serve.mjs',
    url: 'http://localhost:4173/TrainingApp/',
    reuseExistingServer: true,
    timeout: 20_000,
  },
});
