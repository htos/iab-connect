// Finance SETTINGS sub-slice types (E26-S6). Imports the S2 foundation root + the
// canonical `@/types/finance` DTOs (A83) — it NEVER edits the foundation. Covers the
// five settings pages: hub, profile, invoice-templates, settings/activity-areas, tax-codes.
//
// DEC-3 = A (A62/A101): the shared `ActivityArea` + `TaxCode` come from the S2 foundation
// (`finance.types`, which re-exports them from `@/types/finance`); the activity-areas CRUD
// URL builders/keys come from the foundation too — this slice REUSES them, never re-declares.
// `InvoiceTemplate` is NOT re-exported by the foundation, so it is re-exported here straight
// from `@/types/finance` (A83 — single canonical source, the foundation stays untouched).
//
// NOTE: the foundation exports a MINIMAL `FinanceProfile` (accountingMode-only, for the
// DoubleEntry mode guard on ledger/journal pages). The settings/profile page needs the FULL
// ~17-field shape, so it is declared here with a DISTINCT name (`SettingsFinanceProfile`) to
// avoid colliding with the foundation's `FinanceProfile`.

export type {
  // Shared read/write lookups (foundation re-exports these from @/types/finance).
  ActivityArea,
  TaxCode,
} from "./finance.types";

// InvoiceTemplate is NOT re-exported by the foundation — import the canonical DTO directly.
export type { InvoiceTemplate } from "@/types/finance";

// --- Finance profile (FULL settings shape — distinct from the foundation's minimal one) ---

/** The full finance-profile DTO returned by GET /profile (the settings/profile page). */
export interface SettingsFinanceProfile {
  id: string;
  jurisdiction: string;
  countryCode: string | null;
  currency: string;
  fiscalYearStartMonth: number;
  organizationName: string;
  organizationAddress: string;
  organizationCity: string;
  organizationPostalCode: string;
  organizationCountry: string;
  organizationEmail: string | null;
  organizationPhone: string | null;
  organizationWebsite: string | null;
  organizationUid: string | null;
  bankName: string | null;
  bankIban: string | null;
  bankBic: string | null;
  accountingMode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * The wire payload for POST /profile + PUT /profile/{id}. Mirrors the god-page byte-for-byte:
 * required strings pass through untrimmed (A96); optionals map `"" → null` (A96) — the form
 * layer performs that mapping so the schema/hook submit byte-identically.
 */
export interface FinanceProfilePayload {
  jurisdiction: string;
  countryCode: string | null;
  currency: string;
  fiscalYearStartMonth: number;
  organizationName: string;
  organizationAddress: string;
  organizationCity: string;
  organizationPostalCode: string;
  organizationCountry: string;
  organizationEmail: string | null;
  organizationPhone: string | null;
  organizationWebsite: string | null;
  organizationUid: string | null;
  bankName: string | null;
  bankIban: string | null;
  bankBic: string | null;
  accountingMode: string;
}

// --- Backfill double-entry (the hub's operational panel) ---

export interface BackfillError {
  sourceType: string;
  sourceId: string;
  description: string;
  errorMessage: string;
}

export interface BackfillResult {
  transactionsProcessed: number;
  paymentsProcessed: number;
  journalEntriesCreated: number;
  skippedAlreadyPosted: number;
  errorCount: number;
  errors: BackfillError[];
  cutOffDate: string;
  executedAt: string;
}

// --- Tax-code wire payload (CREATE/UPDATE — rate is the ÷100 wire fraction) ---

export interface TaxCodePayload {
  code: string;
  label: string;
  rate: number;
  isDefault: boolean;
}

// --- Invoice-template wire payload (CREATE/UPDATE) ---

export interface InvoiceTemplatePayload {
  name: string;
  jurisdiction: string;
  countryCode: string | null;
  isDefault: boolean;
  showVatId: boolean;
  showTaxExemptionNote: boolean;
  taxExemptionNote: string | null;
  showReverseChargeNote: boolean;
  reverseChargeNote: string | null;
  showPaymentTerms: boolean;
  defaultPaymentTerms: string | null;
  showBankDetails: boolean;
  logoUrl: string | null;
  headerText: string | null;
  footerText: string | null;
  legalNotice: string | null;
  language: string;
}

// --- Settings activity-area wire payload ---
// The settings form OMITS `isActive` on create; edit hard-codes `isActive: true` (DEC-3).
// The CREATE payload has no isActive; the UPDATE payload adds it. `ActivityAreaPayloadBase`
// is the common shape; the hook spreads `isActive: true` only for edit.

export interface ActivityAreaPayloadBase {
  name: string;
  code: string;
  description: string | null;
  color: string | null;
  sortOrder: number;
}
