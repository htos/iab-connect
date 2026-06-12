// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * E28-S2: the public content slice's transport. Owns the public `/api/v1/...` read
 * URLs (blog/events/sponsors + event fee-categories) and the public event-
 * registration POST behind ONE base-URL helper (DEC-5=A — replaces the
 * `process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000"` duplication across
 * the 5 content pages).
 *
 * **`useApiClient` is the WRONG tool here (A56, load-bearing):** it 401-gates on
 * no-auth (`auth.ts:178`) and the public endpoints are anonymous. These reads use
 * plain SERVER `fetch` (RSC, request-time) — NOT TanStack/`useApiClient`. DEC-1=B
 * (build byte-identical fns; the reserved `lib/services/events.ts` helpers are left
 * for a later consolidation, to avoid the `EventDto` superset/`requireAuth`
 * widening risk), DEC-2=A (build blog/sponsors/registration — no module owns them).
 *
 * `cache: "no-store"` makes the RSC reads request-time-fresh, matching the
 * god-pages' per-load `useEffect` fetch (Next defaults `fetch` to no-store, but the
 * intent is pinned explicitly).
 */

import type {
  PublicBlogPostDto,
  PublicEventDto,
  PublicFeeCategory,
  PublicRegistrationPayload,
  PublicRegistrationResult,
  PublicSponsorDto,
} from "../types/public.types";

export const PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${PUBLIC_API_BASE_URL}${path}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function getPublicBlogPosts(): Promise<PublicBlogPostDto[]> {
  return getJson<PublicBlogPostDto[]>("/api/v1/blog/public");
}

export function getPublicBlogPost(id: string): Promise<PublicBlogPostDto> {
  return getJson<PublicBlogPostDto>(`/api/v1/blog/public/${id}`);
}

export function getPublicEvents(): Promise<PublicEventDto[]> {
  return getJson<PublicEventDto[]>("/api/v1/events/public");
}

export function getPublicEvent(id: string): Promise<PublicEventDto> {
  return getJson<PublicEventDto>(`/api/v1/events/public/${id}`);
}

/**
 * Best-effort fee categories (REQ-022): absence (a non-2xx or a network error)
 * means a free event / finance module disabled → no paid registration offered.
 * Mirrors the god-page's inner try/catch that swallowed fee-load failures.
 */
export async function getPublicEventFeeCategories(
  id: string
): Promise<PublicFeeCategory[]> {
  try {
    const res = await fetch(
      `${PUBLIC_API_BASE_URL}/api/v1/events/public/${id}/fee-categories`,
      { cache: "no-store" }
    );
    if (res.ok) return (await res.json()) as PublicFeeCategory[];
  } catch {
    /* fee categories are optional; ignore load failure */
  }
  return [];
}

export function getPublicSponsors(): Promise<PublicSponsorDto[]> {
  return getJson<PublicSponsorDto[]>("/api/v1/sponsors/public");
}

/**
 * Public event-registration POST. Throws the raw response body (or `HTTP <status>`)
 * so the caller surfaces the server message verbatim, exactly like the god-page.
 */
export async function registerForEventPublic(
  eventId: string,
  payload: PublicRegistrationPayload
): Promise<PublicRegistrationResult> {
  const res = await fetch(
    `${PUBLIC_API_BASE_URL}/api/v1/events/${eventId}/registrations/public`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || `HTTP ${res.status}`);
  }
  return res.json() as Promise<PublicRegistrationResult>;
}
