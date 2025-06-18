import { defineConfig } from "@playwright/test";

export default defineConfig({
  webServer: {
    command: "cd .. && bun dev",
    port: 3000,
    timeout: 120 * 1000, // 2 minutes
    reuseExistingServer: !process.env.CI,
  },
  testDir: "__tests__",
  use: {
    baseURL: "http://localhost:3000",
  },
});
