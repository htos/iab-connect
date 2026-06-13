"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { automationsKeys, fetchAutomation } from "../api/automations-api";

/**
 * Sentinel error kept for parity with the detail-slice recipe (A79;
 * `SponsorNotFoundError` / `BoardDocumentNotFoundError`). NOTE: the wrapped
 * `automations.getAutomation` throws a GENERIC `Error` with NO status
 * (it is a transport WRAP, and modifying the lib fn is out of scope), so this
 * hook cannot actually distinguish a 404 from any other failure. It exists for
 * future divergence only; the component treats `isError` uniformly.
 */
export class AutomationNotFoundError extends Error {
  constructor() {
    super("loadError");
    this.name = "AutomationNotFoundError";
  }
}

/**
 * Automation detail server state (E25-S2, DEC-A93). `retry: false` because the
 * god-page rendered its error panel on the FIRST failed fetch (no retry); since
 * the wrapped lib fn carries no status, a 404 sentinel can't be distinguished, so
 * `retry: false` is the behaviour-preserving choice (it also avoids the A93
 * double-fetch delay). `enabled` mirrors the page's auth/token gate.
 */
export function useAutomation(id: string, enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: automationsKeys.detail(id),
    queryFn: () => fetchAutomation(accessToken ?? "", id),
    enabled: enabled && !!accessToken && !!id,
    retry: false,
  });
}
