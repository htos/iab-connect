"use client";

/**
 * Admin User Sessions composition root (E27-S2) — REQ-010. The only
 * `"use client"` boundary for `/admin/users/[id]/sessions`; the route file is a
 * thin server entry that unwraps `params` and passes the id down.
 *
 * Behaviour preserved VERBATIM (pinned by the E27-S1 sessions net):
 *  - Admin guard → router.push("/") (NOT /login); explicit `return null` after
 *    the loading gate (A90/A97).
 *  - The initial sessions load is ONE-SHOT (guarded by an `initialFetchDone`
 *    ref); the refresh button re-fetches. Both go through the wrapped
 *    `fetchUserSessions` (A94) — kept as imperative fetch (NOT a TanStack query)
 *    so the S1-pinned one-shot/manual semantics hold.
 *  - Revoke (DEC-4 = A: `window.confirm` preserved): on confirm→success the row
 *    is removed locally + a `role="status"` success banner shows, auto-clearing
 *    after 4000ms; on failure the row is PRESERVED + an error banner. The
 *    transport runs through `useRevokeSession`. The `data-testid`s
 *    (`admin-sessions-empty` / `admin-sessions-list` / `admin-revoke-session-{id}`)
 *    + the bordered-red revoke button colour are preserved.
 *  - i18n: NO namespace (dotted keys) — uses ROOT + `profileSecurity.*` /
 *    `common.*` / `error.*` (shared with the self-service profile page; NOT
 *    relocated).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { fetchUserSessions } from "../api/admin-users-api";
import { useRevokeSession } from "../hooks/use-user-sessions";
import type { UserSession } from "../types/admin-user.types";

function formatDateTime(value: string | null, fallback: string): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function UserSessions({ userId }: { userId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(
    null
  );
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const revokeMutation = useRevokeSession();

  const fetchSessions = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchUserSessions(token, userId);
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.errorOccurred"));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  const handleRevoke = useCallback(
    (sessionId: string) => {
      const token = accessTokenRef.current;
      if (!token) return;
      if (!window.confirm(t("profileSecurity.revokeConfirmAdmin"))) return;

      setRevokingSessionId(sessionId);
      setMessage(null);
      revokeMutation.mutate(
        { userId, sessionId },
        {
          onSuccess: () => {
            setMessage({
              type: "success",
              text: t("profileSecurity.revokeSuccess"),
            });
            setSessions((prev) => prev.filter((s) => s.id !== sessionId));
          },
          onError: () =>
            setMessage({
              type: "error",
              text: t("profileSecurity.revokeError"),
            }),
          onSettled: () => {
            setRevokingSessionId(null);
            setTimeout(() => setMessage(null), 4000);
          },
        }
      );
    },
    [userId, t, revokeMutation]
  );

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (
      isAuthenticated &&
      isAdmin &&
      accessToken &&
      !initialFetchDone.current
    ) {
      initialFetchDone.current = true;
      fetchSessions();
    }
  }, [isAuthenticated, isAdmin, accessToken, fetchSessions]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <PageShell maxWidth="4xl">
      <div className="mb-6">
        <Link
          href={`/admin/users/${userId}`}
          className="text-sm text-orange-700 hover:underline"
        >
          {t("common.back")}
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          {t("profileSecurity.adminTitle")}
        </h1>
        <p className="mt-1 break-all text-gray-600">{userId}</p>
      </div>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <p className="text-red-700">{error}</p>
        </div>
      )}

      {message && (
        <div
          role="status"
          className={`mb-6 rounded-xl p-4 text-sm ${
            message.type === "success"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {message.text}
        </div>
      )}

      <section
        aria-labelledby="admin-sessions-heading"
        className="rounded-xl bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="admin-sessions-heading"
            className="text-lg font-semibold text-gray-900"
          >
            {t("profileSecurity.activeSessionsTitle")}
          </h2>
          <button
            type="button"
            onClick={fetchSessions}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
          >
            {t("common.refresh")}
          </button>
        </div>

        {sessions.length === 0 ? (
          <p className="text-gray-500" data-testid="admin-sessions-empty">
            {t("profileSecurity.adminEmpty")}
          </p>
        ) : (
          <ul
            className="divide-y divide-gray-200"
            data-testid="admin-sessions-list"
          >
            {sessions.map((session) => (
              <li key={session.id} className="py-4">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-4">
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase">
                      {t("profileSecurity.ipAddress")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {session.ipAddress ?? (
                        <span className="text-gray-400">
                          {t("profileSecurity.notAvailable")}
                        </span>
                      )}
                    </dd>
                    <p className="mt-1 text-xs text-gray-500 italic">
                      {t("profileSecurity.ipPrivacyNoteAdmin")}
                    </p>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase">
                      {t("profileSecurity.start")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDateTime(
                        session.start,
                        t("profileSecurity.notAvailable")
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-500 uppercase">
                      {t("profileSecurity.lastAccess")}
                    </dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {formatDateTime(
                        session.lastAccess,
                        t("profileSecurity.notAvailable")
                      )}
                    </dd>
                  </div>
                </div>
                {session.clients.length > 0 && (
                  <div className="mt-2">
                    <dt className="text-xs font-medium text-gray-500 uppercase">
                      {t("profileSecurity.clients")}
                    </dt>
                    <dd className="mt-1 flex flex-wrap gap-2">
                      {session.clients.map((client) => (
                        <span
                          key={`${session.id}-${client}`}
                          className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-xs text-orange-700"
                        >
                          {client}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRevoke(session.id)}
                    disabled={revokingSessionId === session.id}
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid={`admin-revoke-session-${session.id}`}
                  >
                    {revokingSessionId === session.id
                      ? t("profileSecurity.revoking")
                      : t("profileSecurity.revoke")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="mt-6 text-xs text-gray-400">
          {t("profileSecurity.dataLimitsNote")}
        </p>
        <p className="mt-2 text-xs text-gray-400">
          {t("profileSecurity.timeoutsNote")}
        </p>
      </section>
    </PageShell>
  );
}
