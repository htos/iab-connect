"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  emailTemplatesKeys,
  fetchEmailTemplate,
} from "../api/email-templates-api";

/**
 * Sentinel error so the edit component can distinguish a 404 (the dedicated
 * `templateNotFound` view) from a generic failure, mirroring
 * `BoardDocumentNotFoundError` (A93). UNLIKE the automations sibling (E25-S2, whose
 * wrapped lib fn threw a status-less Error), the wrapped `emailTemplatesApi` routes
 * through the legacy `ApiClient`, which throws an `ApiError`
 * `{ message, statusCode }` on non-ok — so a REAL 404 sentinel IS feasible here.
 */
export class EmailTemplateNotFoundError extends Error {
  constructor() {
    super("templateNotFound");
    this.name = "EmailTemplateNotFoundError";
  }
}

/**
 * Email-template detail server state (E25-S4, A93). The wrapped lib fn throws an
 * `ApiError` carrying `statusCode`; the queryFn rethrows it as the not-found
 * sentinel on `statusCode === 404` and as-is otherwise. `retry` excludes the
 * sentinel so the not-found surface renders on the first fetch (god-page parity:
 * the [id] page set `template = null` on a settled-but-empty load) while a generic
 * error still gets one retry. `enabled` mirrors the page's token + auth gate.
 */
export function useEmailTemplate(id: number, enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: emailTemplatesKeys.detail(id),
    queryFn: async () => {
      try {
        return await fetchEmailTemplate(accessToken ?? "", id);
      } catch (err) {
        if (
          err &&
          typeof err === "object" &&
          (err as { statusCode?: number }).statusCode === 404
        ) {
          throw new EmailTemplateNotFoundError();
        }
        throw err;
      }
    },
    enabled: enabled && !!accessToken && !!id,
    retry: (failureCount, error) =>
      !(error instanceof EmailTemplateNotFoundError) && failureCount < 1,
  });
}
