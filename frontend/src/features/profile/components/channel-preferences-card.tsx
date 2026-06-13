"use client";

/**
 * REQ-030 (E5-S5): Channel Preferences card for /profile — sibling to the Consent
 * Preferences card, reusing its save-then-refresh + success/error-message
 * pattern. Lets a user pick their preferred communication channel; channels whose
 * provider is disabled are shown as unavailable ("coming soon") so the user isn't
 * offered an impossible choice (the eligibility gate is server-side).
 *
 * E29-S4 relocation: moved from `app/profile/ChannelPreferencesCard.tsx` into the
 * profile slice WITHOUT behaviour change (AC-3). The channel fns are now reached
 * via the slice `api/profile-api` wrappers (which forward to `privacy`
 * byte-identically) so the route file carries no raw URL and the slice owns its
 * transport surface; the internal load/save state machine is unchanged.
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import {
  fetchChannelPreference,
  updateChannelPreference,
} from "../api/profile-api";
import type { ChannelPreferenceDto } from "../types/profile.types";

export function ChannelPreferencesCard() {
  const t = useTranslations("profile");
  const { accessToken } = useAuth();

  const [data, setData] = useState<ChannelPreferenceDto | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!accessToken) return;
    try {
      setData(await fetchChannelPreference(accessToken));
    } catch {
      setMessage({ type: "error", text: t("channelPreferences.loadError") });
    }
  }, [accessToken, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleChange(channel: string) {
    if (!accessToken) return;
    setSaving(true);
    setMessage(null);
    try {
      await updateChannelPreference(accessToken, channel);
      await load();
      setMessage({ type: "success", text: t("channelPreferences.saved") });
    } catch {
      setMessage({ type: "error", text: t("channelPreferences.error") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl bg-white p-6 shadow-sm"
      data-testid="channel-preferences"
    >
      <h3 className="mb-1 text-lg font-semibold text-gray-900">
        {t("channelPreferences.title")}
      </h3>
      <p className="mb-4 text-sm text-gray-500">
        {t("channelPreferences.description")}
      </p>

      {message && (
        <div
          className={`mb-4 rounded-lg p-3 text-sm ${
            message.type === "success"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
          role="alert"
        >
          {message.text}
        </div>
      )}

      <div className="space-y-3">
        {(data?.availableChannels ?? []).map((c) => {
          const isSelected = data?.preferredChannel === c.channel;
          return (
            <label
              key={c.channel}
              className={`flex cursor-pointer items-start gap-3 ${c.isEnabled ? "" : "opacity-60"}`}
            >
              <input
                type="radio"
                name="channelPreference"
                disabled={saving || !c.isEnabled}
                checked={isSelected}
                onChange={() => handleChange(c.channel)}
                className="mt-0.5 h-5 w-5 border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
              />
              <div>
                <span className="text-sm font-medium text-gray-900">
                  {t(`channelPreferences.channel.${c.channel}`)}
                </span>
                {!c.isEnabled && (
                  <span className="ml-2 text-xs text-gray-400">
                    {t("channelPreferences.comingSoon")}
                  </span>
                )}
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}
