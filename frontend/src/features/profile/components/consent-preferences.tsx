"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useConsents } from "../hooks/use-consents";
import { useToggleConsent } from "../hooks/use-toggle-consent";

/**
 * REQ-029 consent preferences (E29-S4). Renders the two consent checkboxes
 * (Newsletter + EventNotifications) reflecting granted state, with a toggle that
 * grants/revokes via `useToggleConsent`.
 *
 * A76 — THREE branches preserved verbatim:
 *  1. SILENT load failure: `useConsents` NEVER surfaces its query error here
 *     (we read `data ?? []` only) — a `getConsents` failure shows NOTHING, just
 *     like the god-page's empty catch.
 *  2. SUCCESS: the toggle sets a success message that auto-dismisses after
 *     3000 ms (a local `setTimeout` keyed on the mutation `onSuccess`, mirroring
 *     HEAD — the timer coexists with the mutation state; TanStack does NOT own
 *     the toast).
 *  3. EXPLICIT error: the toggle sets an error message with NO timer.
 *
 * A85: `handleToggle` is `useCallback`-stabilised and the toggle mutation is
 * driven via explicit `onSuccess`/`onError` callbacks (not a subscribing effect
 * on `mutation.isSuccess`) so re-renders can't re-fire the toast and clobber a
 * just-set message.
 */

const CONSENT_ROWS = [
  {
    type: "Newsletter",
    labelKey: "profile.consentNewsletter",
    descKey: "profile.consentNewsletterDesc",
  },
  {
    type: "EventNotifications",
    labelKey: "profile.consentEventNotifications",
    descKey: "profile.consentEventNotificationsDesc",
  },
] as const;

export function ConsentPreferences({ enabled }: { enabled: boolean }) {
  const t = useTranslations();
  const { data: consents } = useConsents(enabled);
  const toggleMutation = useToggleConsent();

  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // A35/cleanup: clear any pending auto-dismiss timer on unmount.
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
  }, []);

  const handleToggle = useCallback(
    (consentType: string, currentlyGranted: boolean) => {
      setMessage(null);
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
      toggleMutation.mutate(
        { consentType, currentlyGranted },
        {
          onSuccess: () => {
            // BRANCH 2: success → message + 3 s auto-dismiss.
            setMessage({ type: "success", text: t("profile.consentSaved") });
            dismissTimer.current = setTimeout(() => setMessage(null), 3000);
          },
          onError: () => {
            // BRANCH 3: explicit error → message, NO timer.
            setMessage({ type: "error", text: t("profile.consentError") });
          },
        }
      );
    },
    [toggleMutation, t]
  );

  const list = consents ?? [];

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h3 className="mb-1 text-lg font-semibold text-gray-900">
        {t("profile.consentPreferences")}
      </h3>
      <p className="mb-4 text-sm text-gray-500">
        {t("profile.consentDescription")}
      </p>

      {message && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${message.type === "success" ? "border border-green-200 bg-green-50 text-green-700" : "border border-red-200 bg-red-50 text-red-700"}`}
        >
          {message.text}
        </div>
      )}

      <div className="space-y-4">
        {CONSENT_ROWS.map(({ type, labelKey, descKey }) => {
          const consent = list.find((c) => c.type === type);
          const isGranted = consent?.isGranted ?? false;
          return (
            <label key={type} className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                disabled={toggleMutation.isPending}
                checked={isGranted}
                onChange={() => handleToggle(type, isGranted)}
                className="mt-0.5 h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {t(labelKey)}
                </span>
                <p className="text-sm text-gray-500">{t(descKey)}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
