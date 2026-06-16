"use client";

import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { adminUsersKeys, fetchUser } from "../api/admin-users-api";

/**
 * Parity sentinel (DEC-3 = A). The wrapped lib fn `getUser` throws a GENERIC
 * `Error("User not found")` on a 404 with NO status attached, so a true
 * status-derived sentinel isn't feasible without widening scope into the lib
 * module (DEC-3 = B, recorded as residual debt). This class exists only so the
 * detail-content's not-found branch can be expressed by intent rather than by
 * string-matching, mirroring `MemberNotFoundError`. Because the thrown error
 * carries no status, the hook below uses `retry: false` (A99) so a 404 fails
 * fast instead of being retried as a transient.
 */
export class UserNotFoundError extends Error {
  constructor() {
    super("users.userNotFound");
    this.name = "UserNotFoundError";
  }
}

export function useUser(id: string, enabled: boolean) {
  const { accessToken } = useAuth();
  return useQuery({
    queryKey: adminUsersKeys.detail(id),
    queryFn: () => fetchUser(accessToken ?? "", id),
    // A99: the wrapped lib fn throws a generic Error (no status) on 404, so
    // there is no transient/permanent distinction to lean on — fail fast.
    retry: false,
    enabled: enabled && !!id,
  });
}
