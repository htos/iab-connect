"use client";

/**
 * Admin: User Sessions Page — REQ-010
 * Admin-only view of a user's active Keycloak sessions.
 */

import { use, useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { getUserSessions, revokeUserSession, UserSession } from "@/lib/api/users";

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

export default function AdminUserSessionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: userId } = use(params);
  const t = useTranslations();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, isAdmin, accessToken } = useAuth();

  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revokingSessionId, setRevokingSessionId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const fetchSessions = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await getUserSessions(token, userId);
      setSessions(data.sessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.errorOccurred"));
    } finally {
      setLoading(false);
    }
  }, [userId, t]);

  const handleRevoke = useCallback(
    async (sessionId: string) => {
      const token = accessTokenRef.current;
      if (!token) return;
      if (!window.confirm(t("profileSecurity.revokeConfirmAdmin"))) return;

      setRevokingSessionId(sessionId);
      setMessage(null);
      try {
        await revokeUserSession(token, userId, sessionId);
        setMessage({ type: "success", text: t("profileSecurity.revokeSuccess") });
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } catch {
        setMessage({ type: "error", text: t("profileSecurity.revokeError") });
      } finally {
        setRevokingSessionId(null);
        setTimeout(() => setMessage(null), 4000);
      }
    },
    [userId, t]
  );

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const initialFetchDone = useRef(false);
  useEffect(() => {
    if (isAuthenticated && isAdmin && accessToken && !initialFetchDone.current) {
      initialFetchDone.current = true;
      fetchSessions();
    }
  }, [isAuthenticated, isAdmin, accessToken, fetchSessions]);

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href={`/admin/users/${userId}`}
            className="text-sm text-orange-700 hover:underline"
          >
            {t("common.back")}
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            {t("profileSecurity.adminTitle")}
          </h1>
          <p className="text-gray-600 mt-1 break-all">{userId}</p>
        </div>

        {error && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6"
          >
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {message && (
          <div
            role="status"
            className={`rounded-xl p-4 mb-6 text-sm ${
              message.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        <section
          aria-labelledby="admin-sessions-heading"
          className="bg-white rounded-xl shadow-sm p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              id="admin-sessions-heading"
              className="text-lg font-semibold text-gray-900"
            >
              {t("profileSecurity.activeSessionsTitle")}
            </h2>
            <button
              type="button"
              onClick={fetchSessions}
              className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
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
                            className="px-2 py-0.5 text-xs rounded-full bg-orange-50 text-orange-700 border border-orange-200"
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
                      className="text-sm px-3 py-1.5 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

          <p className="text-xs text-gray-400 mt-6">
            {t("profileSecurity.dataLimitsNote")}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            {t("profileSecurity.timeoutsNote")}
          </p>
        </section>
      </div>
    </main>
  );
}
