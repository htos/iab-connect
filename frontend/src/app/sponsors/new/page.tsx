"use client";

/**
 * New Sponsor Page - REQ-031: Sponsorenverwaltung
 */

import { useAuth, useApiClient } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import type { CreateSponsorRequest, SponsorTier } from "@/types/sponsors";

export default function NewSponsorPage() {
  const { isAuthenticated, isLoading: authLoading, isVorstand, isAdmin } = useAuth();
  const api = useApiClient();
  const router = useRouter();
  const t = useTranslations();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateSponsorRequest>({
    companyName: "",
    contactPerson: "",
    email: "",
    phone: "",
    website: "",
    tier: "Bronze",
    notes: "",
    agreementStart: "",
    agreementEnd: "",
  });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push("/login");
    if (!authLoading && isAuthenticated && !isVorstand && !isAdmin) router.push("/");
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const result = await api.post("/api/v1/sponsors", formData);
    if (result.error) {
      setError(result.error);
      setSaving(false);
    } else {
      router.push("/sponsors");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto" />
      </div>
    );
  }

  if (!isAuthenticated || (!isVorstand && !isAdmin)) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/sponsors"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {t("common.backToList")}
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{t("sponsors.newSponsor")}</h1>
          <p className="text-gray-600 mt-1">{t("sponsors.addSponsorDesc")}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm p-6">
          <div className="space-y-6">
            {/* Company Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">{t("sponsors.companyInfo")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("sponsors.companyName")} *
                  </label>
                  <input
                    type="text"
                    id="companyName"
                    name="companyName"
                    required
                    value={formData.companyName}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("sponsors.contactPerson")}
                  </label>
                  <input
                    type="text"
                    id="contactPerson"
                    name="contactPerson"
                    value={formData.contactPerson ?? ""}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="tier" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("sponsors.tier")} *
                  </label>
                  <select
                    id="tier"
                    name="tier"
                    required
                    value={formData.tier}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                  >
                    <option value="Bronze">Bronze</option>
                    <option value="Silver">Silver</option>
                    <option value="Gold">Gold</option>
                    <option value="Platinum">Platinum</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">{t("sponsors.contactInfo")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("form.email")}
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email ?? ""}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("form.phone")}
                  </label>
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formData.phone ?? ""}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="website" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("sponsors.website")}
                  </label>
                  <input
                    type="url"
                    id="website"
                    name="website"
                    value={formData.website ?? ""}
                    onChange={handleChange}
                    placeholder="https://"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Agreement */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">{t("sponsors.agreementInfo")}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="agreementStart" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("sponsors.agreementStart")}
                  </label>
                  <input
                    type="date"
                    id="agreementStart"
                    name="agreementStart"
                    value={formData.agreementStart ?? ""}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                  />
                </div>
                <div>
                  <label htmlFor="agreementEnd" className="block text-sm font-medium text-gray-700 mb-1">
                    {t("sponsors.agreementEnd")}
                  </label>
                  <input
                    type="date"
                    id="agreementEnd"
                    name="agreementEnd"
                    value={formData.agreementEnd ?? ""}
                    onChange={handleChange}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                {t("sponsors.notes")}
              </label>
              <textarea
                id="notes"
                name="notes"
                rows={4}
                value={formData.notes ?? ""}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 mt-8 pt-6 border-t border-gray-200">
            <Link
              href="/sponsors"
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {t("common.cancel")}
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t("common.saving") : t("sponsors.createSponsor")}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
