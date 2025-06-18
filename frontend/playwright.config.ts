import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command: "cd .. && bun dev",
    port: 3000,
    timeout: 120 * 1000, // 2 minutes
    reuseExistingServer: !process.env.CI,
    env: {
      CI: process.env.CI,
    },
  },
  testDir: "__tests__",
  use: {
    baseURL: "http://localhost:3000",
  },
  workers: process.env.CI ? 1 : undefined, // Single worker in CI, default in development
});
