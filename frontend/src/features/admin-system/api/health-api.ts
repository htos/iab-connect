// Health feature API (E27-S4). DEC-1 = A: WRAPS the existing `health`
// transport — note this hits SERVER-ROOT `/health*` (NOT `/api/v1`).
// `getHealthDetail` is the token-bearing detail endpoint the admin page polls.
// Byte-identical delegation keeps the E27-S1 health spec's
// `vi.mock("health")` intercepting with ZERO transport-mock edits (A94).
//
// AC-8 (res.ok fix) is applied INSIDE the wrapped lib fn (`health`),
// not duplicated here: it now checks `res.ok` before `res.json()` so an error
// response surfaces a real failure instead of a swallowed SyntaxError. That change
// is behaviour-safe (the success path is byte-identical) so the S1 net — which
// mocks the lib fn — is unaffected. We delegate to the lib fn so the S1 call-count
// + arguments assertions (`getHealthDetail("test-token")`) stay green.
import { getHealthDetail } from "./health";
import type { HealthDetailResponse } from "../types/health.types";

export const healthKeys = {
  all: ["health"] as const,
  detail: () => ["health", "detail"] as const,
};

/** Fetch the detailed health report (token-bearing `/health/detail`). */
export function fetchHealthDetail(
  token: string
): Promise<HealthDetailResponse> {
  return getHealthDetail(token);
}
