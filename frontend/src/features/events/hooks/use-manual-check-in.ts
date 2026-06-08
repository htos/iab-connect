"use client";

import { useCallback } from "react";
import { useApiClient } from "@/lib/auth";
import { manualCheckIn } from "../api/event-check-in-api";
import type { CheckInResultDto } from "../types/events.types";

/** Outcome of a manual check-in attempt, mapped from the transport `{data,error}`. */
export type ManualCheckInOutcome =
  | { kind: "result"; result: CheckInResultDto }
  | { kind: "networkError" };

/**
 * Manual-search check-in mutation (E24-S3). Behaviour-preserving extraction of
 * the god-page's `handleManualCheckIn` transport branch. Only the call moved
 * (`manualCheckIn` service fn → slice fn over `useApiClient`); the outcome
 * mapping is reproduced VERBATIM:
 *   - data present → 'result'        (result banner + refreshKey bump)
 *   - else / throw → 'networkError'  (manual.checkInFailed)
 *
 * The optional audit `searchQuery` is forwarded through to the api fn (sent as
 * `searchQuery ?? null`), preserving the body shape and the "undefined when no
 * search typed" behaviour the S1 oracle asserts.
 */
export function useManualCheckIn(eventId: string) {
  const api = useApiClient();
  return useCallback(
    async (
      registrationId: string,
      searchQuery?: string
    ): Promise<ManualCheckInOutcome> => {
      try {
        const res = await manualCheckIn(
          api,
          eventId,
          registrationId,
          searchQuery
        );
        if (res.data) {
          return { kind: "result", result: res.data };
        }
        return { kind: "networkError" };
      } catch {
        return { kind: "networkError" };
      }
    },
    [api, eventId]
  );
}
