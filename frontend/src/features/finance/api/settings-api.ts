// Finance SETTINGS sub-slice API (E26-S6 — the FINAL E26 slice). OWNS the settings URL
// builders + keys for the five settings pages (hub, profile, invoice-templates,
// settings/activity-areas, tax-codes). Imports the S2 foundation root
// (`FINANCE_BASE`/`financeKeys`/`financeUrls`) — it NEVER edits the foundation
// (parallel-safe, A91/A101).
//
// This layer is URL BUILDERS + query keys ONLY — it does NO fetching. The hooks own the
// `useApiClient` calls, so the E26-S1 `useApiClient` transport mock keeps intercepting and
// the characterization net survives the migration with ZERO transport edits (A94 BUILD).
// All `/api/v1/finance/*` strings are byte-identical to the five god-pages — no raw URL
// leaks into a component (E21 rule 5).
//
// DEC-3 = A (A62/A101): the activity-areas FULL CRUD builders
// (`financeUrls.activityAreas()` / `financeUrls.activityArea(id)`) + `financeUrls.profile()`
// live in the S2 foundation — this slice REUSES them (re-exported below) so the settings
// activity-areas page imports the SINGLE owner. S6 owns only the tax-codes + invoice-templates
// CRUD builders + the profile /{id}/backfill/reset write builders.

import { FINANCE_BASE, financeKeys, financeUrls } from "./finance-api";

/**
 * Settings query keys (extend the shared `financeKeys` namespace so keys never collide with
 * S2/S4). The profile key + activity-areas/tax-codes read-lookup keys are REUSED from the
 * foundation (single owner); invoice-templates is owned here.
 */
export const settingsKeys = {
  profile: financeKeys.profile,
  invoiceTemplates: () => ["finance", "invoice-templates"] as const,
  taxCodes: financeKeys.taxCodes,
  activityAreas: financeKeys.activityAreas,
};

/**
 * Settings URL builders. Profile (GET list-or-404, POST create, PUT /{id} update) + the
 * backfill + reset write surfaces + invoice-templates CRUD + tax-codes CRUD. The
 * activity-areas list/detail CRUD builders are REUSED + re-exported from the foundation
 * (DEC-3 — single owner).
 */
export const settingsUrls = {
  // Profile: GET (404 → create mode), POST create, PUT /{id} update.
  profile: financeUrls.profile,
  profileById: (id: string) => `${FINANCE_BASE}/profile/${id}`,

  // Hub operational panels.
  backfillDoubleEntry: () => `${FINANCE_BASE}/backfill-double-entry`,
  reset: () => `${FINANCE_BASE}/reset`,

  // Invoice templates CRUD (S6 owns these).
  invoiceTemplates: () => `${FINANCE_BASE}/invoice-templates`,
  invoiceTemplate: (id: string) => `${FINANCE_BASE}/invoice-templates/${id}`,

  // Tax codes CRUD (S6 owns the write builders; the GET list lookup is foundation-owned).
  taxCodes: financeUrls.taxCodes,
  taxCode: (id: string) => `${FINANCE_BASE}/tax-codes/${id}`,

  // Activity-areas: list/detail CRUD REUSED from the foundation (DEC-3 — single owner).
  activityAreas: financeUrls.activityAreas,
  activityArea: financeUrls.activityArea,
};
