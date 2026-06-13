// Retention feature API (E27-S4). DEC-1 = A: WRAPS the existing `retention`
// transport (token-param fns owning their `/api/v1/admin/retention*` URLs).
// Byte-identical delegation keeps the E27-S1 retention spec's
// `vi.mock("retention")` intercepting with ZERO transport-mock edits (A94).
import {
  getRetentionPolicies,
  updateRetentionPolicy,
  enforceRetention,
} from "./retention";
import type {
  RetentionPolicyDto,
  UpdateRetentionPolicyRequest,
} from "../types/retention.types";

/**
 * Query-key + invalidation convention. The policy list has no server-side
 * filters, so `list()` is flat. A successful update invalidates `retentionKeys.all`
 * (the god-page re-ran `fetchPolicies()` after a save). Enforce is a side-effect
 * mutation that does NOT change the policy list, so it does NOT invalidate.
 */
export const retentionKeys = {
  all: ["retention"] as const,
  list: () => ["retention", "list"] as const,
};

/** List all retention policies. */
export function fetchRetentionPolicies(
  token: string
): Promise<RetentionPolicyDto[]> {
  return getRetentionPolicies(token);
}

/** Update a single retention policy. */
export function putRetentionPolicy(
  token: string,
  id: string,
  data: UpdateRetentionPolicyRequest
): Promise<RetentionPolicyDto> {
  return updateRetentionPolicy(token, id, data);
}

/** Manually trigger retention enforcement (returns processed-record count). */
export function postEnforceRetention(
  token: string
): Promise<{ processedRecords: number }> {
  return enforceRetention(token);
}
