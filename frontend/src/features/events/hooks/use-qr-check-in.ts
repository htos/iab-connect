"use client";

import { useCallback } from "react";
import { useApiClient } from "@/lib/auth";
import { checkInByQrCode } from "../api/event-check-in-api";
import type { CheckInResultDto } from "../types/events.types";

/** Outcome of a QR check-in attempt, mapped from the transport `{data,error,status}`. */
export type QrCheckInOutcome =
  | { kind: "result"; result: CheckInResultDto }
  | { kind: "invalid" }
  | { kind: "networkError" };

/**
 * QR-token check-in mutation (E24-S3). Behaviour-preserving extraction of the
 * god-page's `handleQrDecode` transport branch. Only the call moved
 * (`checkInByQrCode` service fn → slice fn over `useApiClient`); the
 * outcome→banner mapping is reproduced VERBATIM and returned as a typed
 * discriminant so the component renders the identical banner:
 *   - data present AND outcome !== 'NotFound'  → 'result'        (result banner + refreshKey bump)
 *   - error / status === 0 / status >= 500     → 'networkError'  (scanner.networkError)
 *   - else (incl. NotFound)                    → 'invalid'       (scanner.invalidQr, token prefix)
 *   - a thrown call                            → 'networkError'
 *
 * `data`/`status` use the `useApiClient` contract (`data: null`, `error: string`
 * on failure); the truthiness/`>= 500`/`=== 0` checks behave identically to the
 * service's `ApiResult`.
 */
export function useQrCheckIn(eventId: string) {
  const api = useApiClient();
  return useCallback(
    async (token: string): Promise<QrCheckInOutcome> => {
      try {
        const res = await checkInByQrCode(api, eventId, token);
        if (res.data && res.data.outcome !== "NotFound") {
          return { kind: "result", result: res.data };
        }
        if (res.error || res.status === 0 || (res.status ?? 0) >= 500) {
          return { kind: "networkError" };
        }
        return { kind: "invalid" };
      } catch {
        return { kind: "networkError" };
      }
    },
    [api, eventId]
  );
}
