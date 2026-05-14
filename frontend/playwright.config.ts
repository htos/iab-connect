import { defineConfig, devices } from "@playwright/test";

/**
 * REQ-087 (E10): Playwright E2E config for the module-enforcement suite.
 *
 * The suite requires the full local stack running:
 *   - `docker compose -f infra/docker-compose.yml up` (PostgreSQL + Keycloak + RustFS)
 *   - the backend: `dotnet run` from `backend/src/IabConnect.Api`
 *   - the frontend: `npm run dev` from `frontend`
 *
 * Point the suite at the stack via env vars (the specs `test.skip()` themselves when
 * `E2E_ADMIN_PASSWORD` is unset, so `npx playwright test` is a clean no-op without a stack):
 *   E2E_BASE_URL        (default http://localhost:3000)
 *   E2E_API_URL         (default http://localhost:5000)
 *   E2E_ADMIN_USER / E2E_ADMIN_PASSWORD  (a seeded Keycloak admin)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
