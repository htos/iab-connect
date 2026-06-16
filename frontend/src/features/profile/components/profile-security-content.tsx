"use client";

/**
 * Profile Security page content (E29-S4) — REQ-010. The single `"use client"`
 * composition root for `/profile/security`. Shows the authenticated user's
 * active Keycloak sessions and lets them revoke a session (the ONLY mutating
 * action — no device-change action exists, AC-4).
 *
 * Behaviour preserved from the god-page (A79):
 *  - the `!isAuthenticated` → `/login` guard (NO member check);
 *  - the `getMySessions` load (via `useSessions`) — the list reads `data ?? []`
 *    so it stays EMPTY on a rejection, AND the load failure surfaces in the
 *    `role="alert"` banner (the S1 net pins HEAD shows the alert — NOT silent);
 *  - the session-list render + the `noSessions` empty state;
 *  - revoke: `window.confirm(revokeConfirm)` → `revokeMySession` → OPTIMISTIC
 *    removal (in the mutation `onMutate` via `setQueryData`) + success message
 *    auto-dismissing after 4000 ms; error message (NO row removal — rollback)
 *    that ALSO schedules the 4000 ms dismiss (the god-page `finally` block);
 *    the button disabled while `revokingSessionId`.
 *
 * A85: `handleRevoke` is `useCallback`-stabilised so the SessionList's button
 * handler identity is stable across re-renders.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
import { useSessions } from "../hooks/use-sessions";
import { useRevokeSession } from "../hooks/use-revoke-session";
import { SessionList } from "./session-list";

export function ProfileSecurityContent() {
  const t = useTranslations();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const enabled = !authLoading && isAuthenticated;
  const sessionsQuery = useSessions(enabled);
  const revokeMutation = useRevokeSession();

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // A35/cleanup: clear any pending toast timer on unmount.
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const handleRevoke = useCallback(
    (sessionId: string) => {
      if (!window.confirm(t("profileSecurity.revokeConfirm"))) return;
      setMessage(null);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      revokeMutation.mutate(sessionId, {
        onSuccess: () => {
          setMessage({
            type: "success",
            text: t("profileSecurity.revokeSuccess"),
          });
          // The god-page schedules the 4 s auto-dismiss in `finally` (success).
          dismissTimer.current = setTimeout(() => setMessage(null), 4000);
        },
        onError: () => {
          setMessage({
            type: "error",
            text: t("profileSecurity.revokeError"),
          });
          // …and on error too (same `finally` block) — error toast also dismisses.
          dismissTimer.current = setTimeout(() => setMessage(null), 4000);
        },
      });
    },
    [revokeMutation, t]
  );

  const sessions = sessionsQuery.data ?? [];
  const revokingSessionId = revokeMutation.isPending
    ? (revokeMutation.variables ?? null)
    : null;
  // A79: surface the load failure in the alert banner (the S1 net pins this —
  // NOT silent). On a rejection the list also stays empty (`data ?? []`).
  const loadError = sessionsQuery.error
    ? ((sessionsQuery.error as Error).message ?? t("error.errorOccurred"))
    : null;

  if (authLoading || (enabled && sessionsQuery.isLoading)) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <PageShell maxWidth="4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          {t("profileSecurity.title")}
        </h1>
        <p className="mt-1 text-gray-600">{t("profileSecurity.description")}</p>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4"
        >
          <p className="text-red-700">{loadError}</p>
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
        aria-labelledby="sessions-heading"
        className="rounded-xl bg-white p-6 shadow-sm"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="sessions-heading"
            className="text-lg font-semibold text-gray-900"
          >
            {t("profileSecurity.activeSessionsTitle")}
          </h2>
          <button
            type="button"
            onClick={() => sessionsQuery.refetch()}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm transition-colors hover:bg-gray-50"
          >
            {t("common.refresh")}
          </button>
        </div>

        <SessionList
          sessions={sessions}
          revokingSessionId={revokingSessionId}
          onRevoke={handleRevoke}
        />

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
