"use client";

/**
 * Self-Service Profile Page - REQ-016: Mitglieder-Selbstverwaltung
 * Regular members can view and update their own profile
 */

import { useAuth } from "@/lib/auth";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  MemberDto,
  UpdateOwnProfileRequest,
  getMembershipStatusColor,
  getMembershipTypeColor,
  getStatusTranslationKey,
  getTypeTranslationKey,
} from "@/lib/api/members";
import {
  ConsentDto,
  getConsents,
  grantConsent,
  revokeConsent,
} from "@/lib/api/privacy";
import { useTranslations } from "next-intl";
import ChannelPreferencesCard from "./ChannelPreferencesCard";

export default function ProfilePage() {
  const t = useTranslations();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isMember,
    isAdmin,
    isVorstand,
    accessToken,
  } = useAuth();
  const router = useRouter();

  const [member, setMember] = useState<MemberDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noMemberRecord, setNoMemberRecord] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<UpdateOwnProfileRequest>({
    firstName: "",
    lastName: "",
    street: "",
    city: "",
    postalCode: "",
    country: "",
    phone: "",
  });

  // REQ-029: Consent preferences
  const [consents, setConsents] = useState<ConsentDto[]>([]);
  const [consentSaving, setConsentSaving] = useState(false);
  const [consentMessage, setConsentMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  // Use ref to avoid re-creating callback
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const fetchProfile = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) return;

    setLoading(true);
    setError(null);
    setNoMemberRecord(false);

    try {
      const response = await fetch(`${baseUrl}/api/v1/members/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 404) {
        setNoMemberRecord(true);
        return;
      }

      if (!response.ok) {
        throw new Error(t("error.loadingError"));
      }

      const data: MemberDto = await response.json();
      setMember(data);
      setFormData({
        firstName: data.firstName,
        lastName: data.lastName,
        street: data.street,
        city: data.city,
        postalCode: data.postalCode,
        country: data.country || "",
        phone: data.phone || "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.errorOccurred"));
    } finally {
      setLoading(false);
    }
  }, [baseUrl, t]);

  const fetchConsents = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) return;
    try {
      const data = await getConsents(token);
      setConsents(data);
    } catch {
      // Consent loading failure is non-critical
    }
  }, []);

  const handleConsentToggle = async (
    consentType: string,
    currentlyGranted: boolean
  ) => {
    const token = accessTokenRef.current;
    if (!token) return;
    setConsentSaving(true);
    setConsentMessage(null);
    try {
      if (currentlyGranted) {
        await revokeConsent(token, consentType);
      } else {
        await grantConsent(token, consentType);
      }
      await fetchConsents();
      setConsentMessage({ type: "success", text: t("profile.consentSaved") });
      setTimeout(() => setConsentMessage(null), 3000);
    } catch {
      setConsentMessage({ type: "error", text: t("profile.consentError") });
    } finally {
      setConsentSaving(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (!authLoading && isAuthenticated && !isMember) {
      router.push("/");
      return;
    }
  }, [authLoading, isAuthenticated, isMember, router]);

  // Initial data fetch - only once when authenticated
  const initialFetchDone = useRef(false);

  useEffect(() => {
    if (
      isAuthenticated &&
      isMember &&
      accessToken &&
      !initialFetchDone.current
    ) {
      initialFetchDone.current = true;
      fetchProfile();
      fetchConsents();
    }
  }, [isAuthenticated, isMember, accessToken, fetchProfile, fetchConsents]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/api/v1/members/me`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || t("error.savingError"));
      }

      const updatedMember: MemberDto = await response.json();
      setMember(updatedMember);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("error.errorOccurred"));
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCancel = () => {
    if (member) {
      setFormData({
        firstName: member.firstName,
        lastName: member.lastName,
        street: member.street,
        city: member.city,
        postalCode: member.postalCode,
        country: member.country || "",
        phone: member.phone || "",
      });
    }
    setEditing(false);
    setError(null);
  };

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

  if (!isAuthenticated || !isMember) {
    return null;
  }

  if (noMemberRecord && !member) {
    const showAdminLink = isAdmin || isVorstand;
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-2 text-xl font-semibold text-gray-900">
              {t("profile.noProfileTitle")}
            </h2>
            <p className="mb-6 text-gray-600">
              {showAdminLink
                ? t("profile.noProfileMessageAdmin")
                : t("profile.noProfileMessageMember")}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/profile/security"
                className="inline-flex items-center rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
              >
                {t("profile.goToSecurity")}
              </Link>
              {showAdminLink && (
                <Link
                  href="/admin"
                  className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 transition-colors hover:bg-gray-50"
                >
                  {t("profile.goToAdmin")}
                </Link>
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (error && !member) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-6">
            <h2 className="mb-2 text-xl font-semibold text-yellow-700">
              {t("error.notice")}
            </h2>
            <p className="text-yellow-600">{error}</p>
          </div>
        </div>
      </main>
    );
  }

  if (!member) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {t("profile.title")}
            </h1>
            <p className="mt-1 text-gray-600">
              {t("profile.managePersonalData")}
            </p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              {t("common.edit")}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <div className="rounded-xl bg-white p-6 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-orange-100">
                  <span className="text-3xl font-bold text-orange-600">
                    {member.firstName[0]}
                    {member.lastName[0]}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {member.firstName} {member.lastName}
                </h2>
                <p className="mb-4 text-gray-500">{member.email}</p>

                <div className="flex flex-wrap justify-center gap-2">
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${getMembershipStatusColor(member.status)}`}
                  >
                    {t(`status.${getStatusTranslationKey(member.status)}`)}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${getMembershipTypeColor(member.membershipType)}`}
                  >
                    {t(
                      `membershipType.${getTypeTranslationKey(member.membershipType)}`
                    )}
                  </span>
                </div>

                <p className="mt-4 text-sm text-gray-500">
                  {t("profile.memberSince", {
                    date: new Date(member.memberSince).toLocaleDateString(
                      "de-CH",
                      {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }
                    ),
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Details / Edit Form */}
          <div className="md:col-span-2">
            {editing ? (
              <form
                onSubmit={handleSubmit}
                className="rounded-xl bg-white p-6 shadow-sm"
              >
                <div className="space-y-6">
                  {/* Personal Info */}
                  <div>
                    <h3 className="mb-4 text-lg font-medium text-gray-900">
                      {t("profile.personalInfo")}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <label
                          htmlFor="firstName"
                          className="mb-1 block text-sm font-medium text-gray-700"
                        >
                          {t("form.firstName")} *
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          required
                          value={formData.firstName}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="lastName"
                          className="mb-1 block text-sm font-medium text-gray-700"
                        >
                          {t("form.lastName")} *
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          required
                          value={formData.lastName}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div>
                    <h3 className="mb-4 text-lg font-medium text-gray-900">
                      {t("profile.contact")}
                    </h3>
                    <div>
                      <label
                        htmlFor="phone"
                        className="mb-1 block text-sm font-medium text-gray-700"
                      >
                        {t("form.phone")}
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone || ""}
                        onChange={handleChange}
                        className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                      />
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      {t("profile.emailCannotBeChanged")}
                    </p>
                  </div>

                  {/* Address */}
                  <div>
                    <h3 className="mb-4 text-lg font-medium text-gray-900">
                      {t("profile.address")}
                    </h3>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="md:col-span-2">
                        <label
                          htmlFor="street"
                          className="mb-1 block text-sm font-medium text-gray-700"
                        >
                          {t("form.street")} *
                        </label>
                        <input
                          type="text"
                          id="street"
                          name="street"
                          required
                          value={formData.street}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="postalCode"
                          className="mb-1 block text-sm font-medium text-gray-700"
                        >
                          {t("form.postalCode")} *
                        </label>
                        <input
                          type="text"
                          id="postalCode"
                          name="postalCode"
                          required
                          value={formData.postalCode}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="city"
                          className="mb-1 block text-sm font-medium text-gray-700"
                        >
                          {t("form.city")} *
                        </label>
                        <input
                          type="text"
                          id="city"
                          name="city"
                          required
                          value={formData.city}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label
                          htmlFor="country"
                          className="mb-1 block text-sm font-medium text-gray-700"
                        >
                          {t("form.country")}
                        </label>
                        <input
                          type="text"
                          id="country"
                          name="country"
                          value={formData.country || ""}
                          onChange={handleChange}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-8 flex justify-end gap-4 border-t border-gray-200 pt-6">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="rounded-lg border border-gray-300 px-6 py-2 transition-colors hover:bg-gray-50"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-orange-600 px-6 py-2 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </form>
            ) : (
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
                <div className="rounded-xl bg-white p-6 shadow-sm">
                  <h3 className="mb-1 text-lg font-semibold text-gray-900">
                    {t("profile.consentPreferences")}
                  </h3>
                  <p className="mb-4 text-sm text-gray-500">
                    {t("profile.consentDescription")}
                  </p>

                  {consentMessage && (
                    <div
                      className={`mb-4 rounded-lg p-3 text-sm ${consentMessage.type === "success" ? "border border-green-200 bg-green-50 text-green-700" : "border border-red-200 bg-red-50 text-red-700"}`}
                    >
                      {consentMessage.text}
                    </div>
                  )}

                  <div className="space-y-4">
                    {[
                      {
                        type: "Newsletter",
                        label: t("profile.consentNewsletter"),
                        desc: t("profile.consentNewsletterDesc"),
                      },
                      {
                        type: "EventNotifications",
                        label: t("profile.consentEventNotifications"),
                        desc: t("profile.consentEventNotificationsDesc"),
                      },
                    ].map(({ type, label, desc }) => {
                      const consent = consents.find((c) => c.type === type);
                      const isGranted = consent?.isGranted ?? false;
                      return (
                        <label
                          key={type}
                          className="flex cursor-pointer items-start gap-3"
                        >
                          <input
                            type="checkbox"
                            disabled={consentSaving}
                            checked={isGranted}
                            onChange={() =>
                              handleConsentToggle(type, isGranted)
                            }
                            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">
                              {label}
                            </span>
                            <p className="text-sm text-gray-500">{desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* REQ-030 (E5-S5): Channel Preferences */}
                <ChannelPreferencesCard />
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
