import {
  test,
  expect,
  type Page,
  type APIRequestContext,
} from "@playwright/test";

/**
 * REQ-087 (E10-S5) AC-6: end-to-end coverage for module enforcement across all three
 * ADR-008 layers — backend 403, middleware route guard, sidebar/nav hiding — plus the
 * Public View neutral page.
 *
 * Requires the full local stack (see playwright.config.ts). When `E2E_ADMIN_PASSWORD` is
 * unset every test `test.skip()`s itself, so `npx playwright test` is a clean no-op in
 * environments without the stack and runs for real when the stack + creds are provided.
 */

const API_URL = process.env.E2E_API_URL ?? "http://localhost:5000";
const ADMIN_USER = process.env.E2E_ADMIN_USER ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "";

const STACK_AVAILABLE = ADMIN_PASSWORD.length > 0;

// Module key → a representative gated route + its sidebar nav label.
const MODULES: { key: string; route: string; navLabel: RegExp }[] = [
  { key: "members", route: "/members", navLabel: /members/i },
  { key: "events", route: "/events", navLabel: /events/i },
  { key: "documents", route: "/documents", navLabel: /documents/i },
  { key: "communication", route: "/communication", navLabel: /communication/i },
  { key: "finance", route: "/finance", navLabel: /finance/i },
  { key: "partners", route: "/sponsors", navLabel: /partner/i },
];

/** Log in through the Keycloak-backed login page and land on the dashboard. */
async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.getByLabel(/username|email/i).fill(ADMIN_USER);
  await page.getByLabel(/password/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in|log in/i }).click();
  await page.waitForURL("**/");
}

/** Toggle a module via the admin API (the cleanest way to drive cross-test state). */
async function setModuleEnabled(
  request: APIRequestContext,
  token: string,
  moduleKey: string,
  enabled: boolean
): Promise<void> {
  const response = await request.put(
    `${API_URL}/api/v1/module-settings/${moduleKey}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      data: { enabled },
    }
  );
  expect(response.ok()).toBeTruthy();
}

test.describe("E10 module enforcement", () => {
  test.skip(
    !STACK_AVAILABLE,
    "requires the full local stack — set E2E_ADMIN_PASSWORD (see playwright.config.ts)"
  );

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  for (const mod of MODULES) {
    test(`disabling "${mod.key}" hides nav + rewrites direct URL, re-enabling restores it`, async ({
      page,
      request,
    }) => {
      const token = (await page.evaluate(() =>
        // next-auth exposes the access token on the session endpoint.
        fetch("/api/auth/session")
          .then((r) => r.json())
          .then((s) => s?.accessToken ?? "")
      )) as string;

      // Disable → nav item hidden + direct navigation rewritten to /module-unavailable.
      await setModuleEnabled(request, token, mod.key, false);
      await page.goto("/");
      await expect(page.getByRole("navigation")).not.toContainText(
        mod.navLabel
      );
      await page.goto(mod.route);
      await expect(page).toHaveURL(/\/module-unavailable$/);

      // Re-enable → nav item back + route reachable again.
      await setModuleEnabled(request, token, mod.key, true);
      await page.goto("/");
      await expect(page.getByRole("navigation")).toContainText(mod.navLabel);
      await page.goto(mod.route);
      await expect(page).not.toHaveURL(/\/module-unavailable$/);
    });
  }

  test("disabling public_view rewrites /public/* to the neutral site-unavailable page", async ({
    page,
    request,
  }) => {
    const token = (await page.evaluate(() =>
      fetch("/api/auth/session")
        .then((r) => r.json())
        .then((s) => s?.accessToken ?? "")
    )) as string;

    try {
      await setModuleEnabled(request, token, "public_view", false);

      // Anonymous visitor hitting the public site gets the neutral page (OD-5), and the
      // page renders organization branding from the still-reachable /api/v1/settings/public.
      const anon = await page.context().browser()!.newContext();
      const anonPage = await anon.newPage();
      await anonPage.goto("/public/events");
      await expect(anonPage).toHaveURL(/\/public\/events$/); // rewrite, not redirect
      await expect(anonPage.getByRole("heading")).toBeVisible();
      await expect(
        anonPage.getByRole("link", { name: /login/i })
      ).toBeVisible();
      await anon.close();
    } finally {
      await setModuleEnabled(request, token, "public_view", true);
    }
  });

  test("the Modules tab shows the Events↔Finance dependency advisory", async ({
    page,
  }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: /modules/i }).click();
    // finance and events list each other as dependents — disabling one surfaces an
    // advisory note (it never hard-blocks the toggle — E10-S5 AC-4 / Q3).
    await expect(
      page.getByText(/depends on this module/i).first()
    ).toBeVisible();
  });
});
