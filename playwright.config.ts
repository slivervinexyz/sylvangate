import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

function resolveChromiumExecutable(): string | undefined {
  const fromEnv = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  const cacheRoot = join(homedir(), ".cache/ms-playwright");
  if (!existsSync(cacheRoot)) return undefined;
  const chromiumDir = readdirSync(cacheRoot).find((name) => name.startsWith("chromium-") && !name.includes("headless"));
  if (!chromiumDir) return undefined;
  const bundled = join(cacheRoot, chromiumDir, "chrome-linux64/chrome");
  return existsSync(bundled) ? bundled : undefined;
}

const chromiumExecutable = resolveChromiumExecutable();

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 15_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "on-first-retry",
    launchOptions: chromiumExecutable ? { executablePath: chromiumExecutable } : undefined,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node scripts/demo-ui/serve.mjs",
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
