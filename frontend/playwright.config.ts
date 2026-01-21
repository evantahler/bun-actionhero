import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const isCI = !!process.env.CI;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadNumberFromEnvIfSet(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const num = Number(raw);
  return Number.isFinite(num) ? num : defaultValue;
}

// Prefer a dedicated test port; allow overrides via env (similar spirit to backend config).
const frontendPort = loadNumberFromEnvIfSet("PLAYWRIGHT_PORT", 3100);
const baseURL =
  process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${frontendPort}`;

export default defineConfig({
  testDir: "./playwright",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: isCI ? 1 : 0,
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: [
    {
      command: "bun run start",
      cwd: path.resolve(__dirname, "../backend"),
      url: "http://127.0.0.1:8080/api/status",
      env: {
        // Make CORS compatible with credentials: "include" in the frontend.
        // Using "*" with Access-Control-Allow-Credentials breaks browser requests.
        WEB_SERVER_ALLOWED_ORIGINS: baseURL,
      },
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: `bun run build && PORT=${frontendPort} bun run start`,
      cwd: __dirname,
      url: baseURL,
      env: {
        // Ensure the app can reach the backend during build/runtime.
        // Must NOT include "/api" because the websocket appends it.
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080",
      },
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});

