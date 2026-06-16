"use client";

import { useEffect, useState } from "react";
import { useApiClient } from "@/lib/auth";
import { getCheckInRoster } from "../api/event-check-in-api";
import type { EventCheckInRosterDto } from "../types/events.types";

/**
 * Check-in roster server state (E24-S3).
 *
 * Behaviour-preserving extraction of the god-page's `refreshKey`-keyed
 * roster-load effect (dos-and-donts item 13). We KEEP the `refreshKey`
 * mechanism verbatim: the effect re-runs whenever `eventId`, `refreshKey`, or
 * `enabled` change. A successful check-in bumps `refreshKey` in the component,
 * which re-fires this load (the S1 oracle asserts the roster RELOADS exactly
 * once after a success and does NOT reload on failure — both preserved).
 *
 * Only the TRANSPORT moved: `getEventCheckInRoster(...)` (the `@/lib/services`
 * fn) → the slice `getCheckInRoster(api, ...)` over `useApiClient`. The
 * `{ data, error }` outcome maps identically: data present → set roster + clear
 * error; otherwise → set the `loadRosterFailed` error string. The `enabled`
 * flag mirrors the page's `canAccess` guard so no GET fires for a forbidden
 * user.
 */
export function useCheckInRoster(
  eventId: string,
  refreshKey: number,
  enabled: boolean,
  loadFailedMessage: string
) {
  const api = useApiClient();
  const [roster, setRoster] = useState<EventCheckInRosterDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const res = await getCheckInRoster(api, eventId);
      if (cancelled) return;
      if (res.data) {
        setRoster(res.data);
        setError(null);
      } else {
        setError(loadFailedMessage);
      }
    }
    if (enabled) load();
    return () => {
      cancelled = true;
    };
    // `api` is referentially stable (useApiClient memoizes); excluded so the
    // load fires only on eventId/refreshKey/enabled changes — matching the
    // god-page's dependency array exactly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, refreshKey, enabled, loadFailedMessage]);

  return { roster, error };
}
