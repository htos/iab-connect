import { describe, expect, it } from "vitest";

/**
 * E26-S6: the finance SETTINGS sub-slice api owns the settings URL builders + keys. These pin
 * every `/api/v1/finance/*` settings URL byte-identically to the five god-pages and assert the
 * REUSE of the foundation's activity-areas CRUD builders + `profile()` (DEC-3 — single owner).
 */

import { settingsKeys, settingsUrls } from "./settings-api";
import { financeUrls } from "./finance-api";

describe("settingsUrls — profile (404 → create, POST, PUT /{id})", () => {
  it("GET list-or-404 + POST create both use /profile", () => {
    expect(settingsUrls.profile()).toBe("/api/v1/finance/profile");
  });

  it("PUT update uses /profile/{id}", () => {
    expect(settingsUrls.profileById("prof-1")).toBe(
      "/api/v1/finance/profile/prof-1"
    );
  });
});

describe("settingsUrls — hub operational panels (backfill + reset)", () => {
  it("backfill POST URL", () => {
    expect(settingsUrls.backfillDoubleEntry()).toBe(
      "/api/v1/finance/backfill-double-entry"
    );
  });

  it("reset DELETE URL", () => {
    expect(settingsUrls.reset()).toBe("/api/v1/finance/reset");
  });
});

describe("settingsUrls — invoice-templates CRUD (S6-owned)", () => {
  it("list/create URL", () => {
    expect(settingsUrls.invoiceTemplates()).toBe(
      "/api/v1/finance/invoice-templates"
    );
  });

  it("detail/update/delete URL", () => {
    expect(settingsUrls.invoiceTemplate("tmpl-1")).toBe(
      "/api/v1/finance/invoice-templates/tmpl-1"
    );
  });
});

describe("settingsUrls — tax-codes CRUD (S6-owned writes, foundation-owned GET list)", () => {
  it("list URL is REUSED from the foundation", () => {
    expect(settingsUrls.taxCodes()).toBe("/api/v1/finance/tax-codes");
    expect(settingsUrls.taxCodes()).toBe(financeUrls.taxCodes());
  });

  it("detail/update/delete URL (S6-owned)", () => {
    expect(settingsUrls.taxCode("tax-1")).toBe(
      "/api/v1/finance/tax-codes/tax-1"
    );
  });
});

describe("settingsUrls — activity-areas CRUD is REUSED from the foundation (DEC-3)", () => {
  it("list/create builder is the SAME reference as the foundation's", () => {
    expect(settingsUrls.activityAreas).toBe(financeUrls.activityAreas);
    expect(settingsUrls.activityAreas()).toBe("/api/v1/finance/activity-areas");
  });

  it("detail builder is the SAME reference as the foundation's", () => {
    expect(settingsUrls.activityArea).toBe(financeUrls.activityArea);
    expect(settingsUrls.activityArea("area-1")).toBe(
      "/api/v1/finance/activity-areas/area-1"
    );
  });
});

describe("settingsKeys — query keys (foundation-reused + S6-owned)", () => {
  it("profile/tax-codes/activity-areas keys are REUSED from the foundation", () => {
    expect(settingsKeys.profile()).toEqual(["finance", "profile"]);
    expect(settingsKeys.taxCodes()).toEqual(["finance", "tax-codes"]);
    expect(settingsKeys.activityAreas()).toEqual(["finance", "activity-areas"]);
  });

  it("invoice-templates key is S6-owned under the finance namespace", () => {
    expect(settingsKeys.invoiceTemplates()).toEqual([
      "finance",
      "invoice-templates",
    ]);
  });
});
