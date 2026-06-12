"use client";

import { useTranslations } from "next-intl";
import type { UserSession } from "../types/profile.types";

/**
 * Session list (E29-S4, REQ-010) — renders one row per active Keycloak session
 * (ipAddress with the `notAvailable` fallback, `start`/`lastAccess` via
 * `formatDateTime`, `clients[]` badges) plus the per-row Revoke button. Behaviour
 * + markup + testids preserved from the god-page. Revoke is the ONLY mutating
 * action (no device-change action — AC-4); the parent owns the confirm + the
 * optimistic mutation, this component just renders + delegates.
 */

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

interface SessionListProps {
  sessions: UserSession[];
  revokingSessionId: string | null;
  onRevoke: (sessionId: string) => void;
}

export function SessionList({
  sessions,
  revokingSessionId,
  onRevoke,
}: SessionListProps) {
  const t = useTranslations();

  if (sessions.length === 0) {
    return (
      <p className="text-gray-500" data-testid="sessions-empty">
        {t("profileSecurity.noSessions")}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-gray-200" data-testid="sessions-list">
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
                {t("profileSecurity.ipPrivacyNote")}
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
              onClick={() => onRevoke(session.id)}
              disabled={revokingSessionId === session.id}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid={`revoke-session-${session.id}`}
            >
              {revokingSessionId === session.id
                ? t("profileSecurity.revoking")
                : t("profileSecurity.revoke")}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
