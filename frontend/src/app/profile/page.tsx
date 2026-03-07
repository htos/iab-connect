"use client";

/**
 * Self-Service Profile Page - REQ-016: Mitglieder-Selbstverwaltung
 * Regular members can view and update their own profile
 */

import { useAuth } from "@/lib/auth";
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
import { ConsentDto, getConsents, grantConsent, revokeConsent } from "@/lib/api/privacy";
import { useTranslations } from "next-intl";

export default function ProfilePage() {
  const t = useTranslations();
  const { isAuthenticated, isLoading: authLoading, isMember, accessToken } = useAuth();
  const router = useRouter();

  const [member, setMember] = useState<MemberDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [consentMessage, setConsentMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

  // Use ref to avoid re-creating callback
  const accessTokenRef = useRef(accessToken);
  accessTokenRef.current = accessToken;

  const fetchProfile = useCallback(async () => {
    const token = accessTokenRef.current;
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${baseUrl}/api/v1/members/me`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.status === 404) {
        setError(t("profile.noProfileFound"));
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

  const handleConsentToggle = async (consentType: string, currentlyGranted: boolean) => {
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
    if (isAuthenticated && isMember && accessToken && !initialFetchDone.current) {
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isMember) {
    return null;
  }

  if (error && !member) {
    return (
      <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-yellow-700 mb-2">{t("error.notice")}</h2>
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
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t("profile.title")}</h1>
            <p className="text-gray-600 mt-1">
              {t("profile.managePersonalData")}
            </p>
          </div>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              {t("common.edit")}
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex flex-col items-center text-center">
                <div className="h-24 w-24 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <span className="text-3xl font-bold text-orange-600">
                    {member.firstName[0]}{member.lastName[0]}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {member.firstName} {member.lastName}
                </h2>
                <p className="text-gray-500 mb-4">{member.email}</p>

                <div className="flex flex-wrap gap-2 justify-center">
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getMembershipStatusColor(member.status)}`}>
                    {t(`status.${getStatusTranslationKey(member.status)}`)}
                  </span>
                  <span className={`px-3 py-1 text-sm font-medium rounded-full ${getMembershipTypeColor(member.membershipType)}`}>
                    {t(`membershipType.${getTypeTranslationKey(member.membershipType)}`)}
                  </span>
                </div>

                <p className="text-sm text-gray-500 mt-4">
                  {t("profile.memberSince", { date: new Date(member.memberSince).toLocaleDateString("de-CH", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  }) })}
                </p>
              </div>
            </div>
          </div>

          {/* Details / Edit Form */}
          <div className="md:col-span-2">
            {editing ? (
              <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6">
                <div className="space-y-6">
                  {/* Personal Info */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{t("profile.personalInfo")}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                          {t("form.firstName")} *
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          name="firstName"
                          required
                          value={formData.firstName}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                          {t("form.lastName")} *
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          name="lastName"
                          required
                          value={formData.lastName}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Contact Info */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{t("profile.contact")}</h3>
                    <div>
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                        {t("form.phone")}
                      </label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone || ""}
                        onChange={handleChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      {t("profile.emailCannotBeChanged")}
                    </p>
                  </div>

                  {/* Address */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-4">{t("profile.address")}</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
                          {t("form.street")} *
                        </label>
                        <input
                          type="text"
                          id="street"
                          name="street"
                          required
                          value={formData.street}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">
                          {t("form.postalCode")} *
                        </label>
                        <input
                          type="text"
                          id="postalCode"
                          name="postalCode"
                          required
                          value={formData.postalCode}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                          {t("form.city")} *
                        </label>
                        <input
                          type="text"
                          id="city"
                          name="city"
                          required
                          value={formData.city}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                          {t("form.country")}
                        </label>
                        <input
                          type="text"
                          id="country"
                          name="country"
                          value={formData.country || ""}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {t("common.cancel")}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? t("common.saving") : t("common.save")}
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-6">
                {/* Contact Info */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("profile.contactDetails")}</h3>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-500">{t("form.email")}</dt>
                      <dd className="mt-1">
                        <a href={`mailto:${member.email}`} className="text-blue-600 hover:underline">
                          {member.email}
                        </a>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-500">{t("form.phone")}</dt>
                      <dd className="mt-1">
                        {member.phone ? (
                          <a href={`tel:${member.phone}`} className="text-blue-600 hover:underline">
                            {member.phone}
                          </a>
                        ) : (
                          <span className="text-gray-400">{t("common.notSpecified")}</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Address */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("profile.address")}</h3>
                  <address className="not-italic text-gray-700">
                    {member.street}<br />
                    {member.postalCode} {member.city}<br />
                    {member.country}
                  </address>
                </div>

                {/* REQ-029: Consent Preferences */}
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{t("profile.consentPreferences")}</h3>
                  <p className="text-sm text-gray-500 mb-4">{t("profile.consentDescription")}</p>

                  {consentMessage && (
                    <div className={`rounded-lg p-3 mb-4 text-sm ${consentMessage.type === "success" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                      {consentMessage.text}
                    </div>
                  )}

                  <div className="space-y-4">
                    {[
                      { type: "Newsletter", label: t("profile.consentNewsletter"), desc: t("profile.consentNewsletterDesc") },
                      { type: "EventNotifications", label: t("profile.consentEventNotifications"), desc: t("profile.consentEventNotificationsDesc") },
                    ].map(({ type, label, desc }) => {
                      const consent = consents.find((c) => c.type === type);
                      const isGranted = consent?.isGranted ?? false;
                      return (
                        <label key={type} className="flex items-start gap-3 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={consentSaving}
                            checked={isGranted}
                            onChange={() => handleConsentToggle(type, isGranted)}
                            className="mt-0.5 h-5 w-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 disabled:opacity-50"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-900">{label}</span>
                            <p className="text-sm text-gray-500">{desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
