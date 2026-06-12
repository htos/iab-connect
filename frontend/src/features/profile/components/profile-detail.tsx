"use client";

import { useTranslations } from "next-intl";
import { ConsentPreferences } from "./consent-preferences";
import { ChannelPreferencesCard } from "./channel-preferences-card";
import type { MemberDto } from "../types/profile.types";

/**
 * Profile read view (E29-S4) — the contact-details + address cards, the REQ-029
 * consent preferences, and the REQ-030 channel-preferences card. Behaviour +
 * markup preserved from the god-page read branch. `consentEnabled` gates the
 * consent query (mirrors the page auth gate).
 */
export function ProfileDetail({
  member,
  consentEnabled,
}: {
  member: MemberDto;
  consentEnabled: boolean;
}) {
  const t = useTranslations();

  return (
    <div className="space-y-6">
      {/* Contact Info */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {t("profile.contactDetails")}
        </h3>
        <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t("form.email")}
            </dt>
            <dd className="mt-1">
              <a
                href={`mailto:${member.email}`}
                className="text-blue-600 hover:underline"
              >
                {member.email}
              </a>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              {t("form.phone")}
            </dt>
            <dd className="mt-1">
              {member.phone ? (
                <a
                  href={`tel:${member.phone}`}
                  className="text-blue-600 hover:underline"
                >
                  {member.phone}
                </a>
              ) : (
                <span className="text-gray-400">
                  {t("common.notSpecified")}
                </span>
              )}
            </dd>
          </div>
        </dl>
      </div>

      {/* Address */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {t("profile.address")}
        </h3>
        <address className="text-gray-700 not-italic">
          {member.street}
          <br />
          {member.postalCode} {member.city}
          <br />
          {member.country}
        </address>
      </div>

      {/* REQ-029: Consent Preferences */}
      <ConsentPreferences enabled={consentEnabled} />

      {/* REQ-030 (E5-S5): Channel Preferences */}
      <ChannelPreferencesCard />
    </div>
  );
}
