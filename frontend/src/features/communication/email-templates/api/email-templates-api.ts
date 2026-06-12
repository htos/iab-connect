// Email-templates feature API (E25-S4). DEC-1 = A WRAP: this layer WRAPS the
// existing `@/lib/email-templates` transport (`emailTemplatesApi`, token-param fns
// that own their own `/api/v1/email-templates` URLs and throw `ApiError` on
// non-ok) rather than re-implementing the URLs. The slice owns the query-key
// factory; each wrapper delegates to the lib fn byte-identically, so the S1 specs
// that `vi.mock("@/lib/email-templates")` keep intercepting with ZERO transport-
// mock edits (A94).
//
// `emailTemplatesApi` STAYS in `@/lib` — it is sibling-consumed by the E25-S2 +
// E25-S3 forms' template dropdowns; a slice importing another slice's module would
// be an E21-S5 boundary violation (A83/A84/A94). No raw `/api/v1` string lives in
// any component — they all route through these functions / the wrapped lib fn.
import { emailTemplatesApi } from "@/lib/email-templates";
import type {
  CreateEmailTemplateRequest,
  EmailTemplate,
  UpdateEmailTemplateRequest,
} from "../types/email-template.types";

/**
 * Query-key + invalidation convention (E21-S1 server-state strategy). The list has
 * NO server-side filter (the god-page fetched all templates and searched
 * client-side), so the list key is flat. `detail` is keyed by the NUMERIC id, so a
 * mutation invalidates exactly the affected surface (A79).
 */
export const emailTemplatesKeys = {
  all: ["email-templates"] as const,
  list: () => ["email-templates", "list"] as const,
  detail: (id: number) => ["email-templates", "detail", id] as const,
};

/** List all templates. Delegates to `emailTemplatesApi.getAllTemplates(token)`. */
export function fetchEmailTemplates(token: string): Promise<EmailTemplate[]> {
  return emailTemplatesApi.getAllTemplates(token);
}

/** Fetch one template by its NUMERIC id. */
export function fetchEmailTemplate(
  token: string,
  id: number
): Promise<EmailTemplate> {
  return emailTemplatesApi.getTemplateById(id, token);
}

/** Create a template definition. */
export function postEmailTemplate(
  token: string,
  body: CreateEmailTemplateRequest
): Promise<EmailTemplate> {
  return emailTemplatesApi.createTemplate(body, token);
}

/** Update a template definition. */
export function putEmailTemplate(
  token: string,
  id: number,
  body: UpdateEmailTemplateRequest
): Promise<EmailTemplate> {
  return emailTemplatesApi.updateTemplate(id, body, token);
}

/** Delete a template by its NUMERIC id. */
export function deleteEmailTemplate(token: string, id: number): Promise<void> {
  return emailTemplatesApi.deleteTemplate(id, token);
}
