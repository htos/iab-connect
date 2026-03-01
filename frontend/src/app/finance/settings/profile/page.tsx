"use client";

/**
 * Finance Profile Page
 * REQ-060: Finance Profile / Jurisdiction Setup
 * Extracted from the settings page into its own sub-route.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

// --- Types ---

interface FinanceProfile {
  id: string;
  jurisdiction: string;
  countryCode: string | null;
  currency: string;
  fiscalYearStartMonth: number;
  organizationName: string;
  organizationAddress: string;
  organizationCity: string;
  organizationPostalCode: string;
  organizationCountry: string;
  organizationEmail: string | null;
  organizationPhone: string | null;
  organizationWebsite: string | null;
  organizationUid: string | null;
  bankName: string | null;
  bankIban: string | null;
  bankBic: string | null;
  accountingMode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface FinanceProfileForm {
  jurisdiction: string;
  countryCode: string;
  currency: string;
  fiscalYearStartMonth: number;
  organizationName: string;
  organizationAddress: string;
  organizationCity: string;
  organizationPostalCode: string;
  organizationCountry: string;
  organizationEmail: string;
  organizationPhone: string;
  organizationWebsite: string;
  organizationUid: string;
  bankName: string;
  bankIban: string;
  bankBic: string;
  accountingMode: string;
}

// --- Icons ---

const SettingsIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const BuildingIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
    />
  </svg>
);

const BankIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
    />
  </svg>
);

// EU country codes for the dropdown
const EU_COUNTRIES = [
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czech Republic" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "LV", name: "Latvia" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
];

const MONTHS = [
  { value: 1, label: "January" },
  { value: 2, label: "February" },
  { value: 3, label: "March" },
  { value: 4, label: "April" },
  { value: 5, label: "May" },
  { value: 6, label: "June" },
  { value: 7, label: "July" },
  { value: 8, label: "August" },
  { value: 9, label: "September" },
  { value: 10, label: "October" },
  { value: 11, label: "November" },
  { value: 12, label: "December" },
];

const DEFAULT_FORM: FinanceProfileForm = {
  jurisdiction: "CH",
  countryCode: "",
  currency: "CHF",
  fiscalYearStartMonth: 1,
  organizationName: "",
  organizationAddress: "",
  organizationCity: "",
  organizationPostalCode: "",
  organizationCountry: "CH",
  organizationEmail: "",
  organizationPhone: "",
  organizationWebsite: "",
  organizationUid: "",
  bankName: "",
  bankIban: "",
  bankBic: "",
  accountingMode: "SimpleCash",
};

export default function FinanceProfilePage() {
  const t = useTranslations("finance");
  const ts = useTranslations("finance.settings");
  const tc = useTranslations("common");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();
  const apiClient = useApiClient();

  const apiRef = useRef(apiClient);
  apiRef.current = apiClient;
  const tRef = useRef(t);
  tRef.current = t;

  const [profile, setProfile] = useState<FinanceProfile | null>(null);
  const [form, setForm] = useState<FinanceProfileForm>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiRef.current.get<FinanceProfile>(
        "/api/v1/finance/profile"
      );
      if (response.status === 404) {
        setProfile(null);
        setForm(DEFAULT_FORM);
        return;
      }
      if (response.error || !response.data) {
        setError(tRef.current("loadError"));
        return;
      }
      const data = response.data;
      setProfile(data);
      setForm({
        jurisdiction: data.jurisdiction,
        countryCode: data.countryCode ?? "",
        currency: data.currency,
        fiscalYearStartMonth: data.fiscalYearStartMonth,
        organizationName: data.organizationName,
        organizationAddress: data.organizationAddress,
        organizationCity: data.organizationCity,
        organizationPostalCode: data.organizationPostalCode,
        organizationCountry: data.organizationCountry,
        organizationEmail: data.organizationEmail ?? "",
        organizationPhone: data.organizationPhone ?? "",
        organizationWebsite: data.organizationWebsite ?? "",
        organizationUid: data.organizationUid ?? "",
        bankName: data.bankName ?? "",
        bankIban: data.bankIban ?? "",
        bankBic: data.bankBic ?? "",
        accountingMode: data.accountingMode ?? "SimpleCash",
      });
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && canReadFinance) {
      loadProfile();
    }
  }, [authLoading, canReadFinance, loadProfile]);

  const handleJurisdictionChange = (newJurisdiction: string) => {
    setForm((prev) => ({
      ...prev,
      jurisdiction: newJurisdiction,
      currency: newJurisdiction === "CH" ? "CHF" : "EUR",
      countryCode: newJurisdiction === "CH" ? "" : prev.countryCode,
      organizationCountry:
        newJurisdiction === "CH" ? "CH" : prev.organizationCountry,
    }));
  };

  const handleChange = (
    field: keyof FinanceProfileForm,
    value: string | number
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!canWriteFinance) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    const payload = {
      jurisdiction: form.jurisdiction,
      countryCode: form.countryCode || null,
      currency: form.currency,
      fiscalYearStartMonth: form.fiscalYearStartMonth,
      organizationName: form.organizationName,
      organizationAddress: form.organizationAddress,
      organizationCity: form.organizationCity,
      organizationPostalCode: form.organizationPostalCode,
      organizationCountry: form.organizationCountry,
      organizationEmail: form.organizationEmail || null,
      organizationPhone: form.organizationPhone || null,
      organizationWebsite: form.organizationWebsite || null,
      organizationUid: form.organizationUid || null,
      bankName: form.bankName || null,
      bankIban: form.bankIban || null,
      bankBic: form.bankBic || null,
      accountingMode: form.accountingMode,
    };

    try {
      if (profile) {
        const response = await apiRef.current.put<FinanceProfile>(
          `/api/v1/finance/profile/${profile.id}`,
          payload
        );
        if (response.error || !response.data)
          throw new Error(response.error ?? "Save failed");
        setProfile(response.data);
        setSuccess(tRef.current("saveSuccess"));
      } else {
        const response = await apiRef.current.post<FinanceProfile>(
          "/api/v1/finance/profile",
          payload
        );
        if (response.error || !response.data)
          throw new Error(response.error ?? "Save failed");
        setProfile(response.data);
        setSuccess(tRef.current("saveSuccess"));
      }
    } catch {
      setError(tRef.current("saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
        <div className="mx-auto max-w-4xl">
          <p className="text-gray-500">{tc("loading")}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Back to Settings */}
        <Link href="/finance/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("backToSettings")}
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {t("settingsHub.profile")}
          </h1>
          <p className="mt-1 text-gray-600">{t("settingsHub.profileDesc")}</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {/* Jurisdiction & Currency Section */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <SettingsIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                {ts("jurisdictionSection")}
              </h2>
              <p className="text-sm text-gray-500">
                {ts("jurisdictionDescription")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Jurisdiction */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("jurisdiction")}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={form.jurisdiction}
                onChange={(e) => handleJurisdictionChange(e.target.value)}
                disabled={!canWriteFinance}
              >
                <option value="CH">{ts("jurisdictionCH")}</option>
                <option value="EU">{ts("jurisdictionEU")}</option>
              </select>
            </div>

            {/* EU Country Code */}
            {form.jurisdiction === "EU" && (
              <div className="space-y-1">
                <label className="block text-sm font-medium text-gray-700">
                  {ts("countryCode")}
                </label>
                <select
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  value={form.countryCode}
                  onChange={(e) => handleChange("countryCode", e.target.value)}
                  disabled={!canWriteFinance}
                >
                  <option value="">{ts("selectCountry")}</option>
                  {EU_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} - {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Currency */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("currency")}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={form.currency}
                onChange={(e) => handleChange("currency", e.target.value)}
                disabled={!canWriteFinance}
              >
                <option value="CHF">CHF - Swiss Franc</option>
                <option value="EUR">EUR - Euro</option>
              </select>
            </div>

            {/* Fiscal Year Start */}
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("fiscalYearStart")}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={form.fiscalYearStartMonth}
                onChange={(e) =>
                  handleChange("fiscalYearStartMonth", parseInt(e.target.value))
                }
                disabled={!canWriteFinance}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Organization Details Section */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <BuildingIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                {ts("organizationSection")}
              </h2>
              <p className="text-sm text-gray-500">
                {ts("organizationDescription")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                {ts("organizationName")}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={form.organizationName}
                onChange={(e) =>
                  handleChange("organizationName", e.target.value)
                }
                disabled={!canWriteFinance}
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                {ts("organizationAddress")}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={form.organizationAddress}
                onChange={(e) =>
                  handleChange("organizationAddress", e.target.value)
                }
                disabled={!canWriteFinance}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("organizationCity")}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={form.organizationCity}
                onChange={(e) =>
                  handleChange("organizationCity", e.target.value)
                }
                disabled={!canWriteFinance}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("organizationPostalCode")}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={form.organizationPostalCode}
                onChange={(e) =>
                  handleChange("organizationPostalCode", e.target.value)
                }
                disabled={!canWriteFinance}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("organizationCountry")}
                <span className="ml-1 text-red-500">*</span>
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder="CH"
                maxLength={2}
                value={form.organizationCountry}
                onChange={(e) =>
                  handleChange(
                    "organizationCountry",
                    e.target.value.toUpperCase()
                  )
                }
                disabled={!canWriteFinance}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("organizationUid")}
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder="CHE-123.456.789"
                value={form.organizationUid}
                onChange={(e) =>
                  handleChange("organizationUid", e.target.value)
                }
                disabled={!canWriteFinance}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("organizationEmail")}
              </label>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={form.organizationEmail}
                onChange={(e) =>
                  handleChange("organizationEmail", e.target.value)
                }
                disabled={!canWriteFinance}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("organizationPhone")}
              </label>
              <input
                type="tel"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={form.organizationPhone}
                onChange={(e) =>
                  handleChange("organizationPhone", e.target.value)
                }
                disabled={!canWriteFinance}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("organizationWebsite")}
              </label>
              <input
                type="url"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={form.organizationWebsite}
                onChange={(e) =>
                  handleChange("organizationWebsite", e.target.value)
                }
                disabled={!canWriteFinance}
              />
            </div>
          </div>
        </div>

        {/* Bank Details Section */}
        <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-2">
              <BankIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-gray-900">
                {ts("bankSection")}
              </h2>
              <p className="text-sm text-gray-500">{ts("bankDescription")}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-1 md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                {ts("bankName")}
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={form.bankName}
                onChange={(e) => handleChange("bankName", e.target.value)}
                disabled={!canWriteFinance}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("bankIban")}
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder="CH93 0076 2011 6238 5295 7"
                value={form.bankIban}
                onChange={(e) => handleChange("bankIban", e.target.value)}
                disabled={!canWriteFinance}
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("bankBic")}
              </label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                placeholder="UBSWCHZH80A"
                value={form.bankBic}
                onChange={(e) => handleChange("bankBic", e.target.value)}
                disabled={!canWriteFinance}
              />
            </div>
          </div>
        </div>

        {/* Accounting Mode Section */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="rounded-lg bg-indigo-50 p-2.5">
              <SettingsIcon className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("accounting.accountingMode")}
              </h2>
              <p className="text-sm text-gray-500">
                {t("accounting.accountingModeDescription")}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-orange-200 transition-colors">
              <input
                type="radio"
                name="accountingMode"
                value="SimpleCash"
                checked={form.accountingMode === "SimpleCash"}
                onChange={() => handleChange("accountingMode", "SimpleCash")}
                disabled={!canWriteFinance}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {t("accounting.accountingModeSimpleCash")}
                </div>
                <div className="text-xs text-gray-500">
                  {t("accounting.doubleEntryDisabled")}
                </div>
              </div>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-4 cursor-pointer hover:border-orange-200 transition-colors">
              <input
                type="radio"
                name="accountingMode"
                value="DoubleEntry"
                checked={form.accountingMode === "DoubleEntry"}
                onChange={() => handleChange("accountingMode", "DoubleEntry")}
                disabled={!canWriteFinance}
                className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-gray-300"
              />
              <div>
                <div className="text-sm font-medium text-gray-900">
                  {t("accounting.accountingModeDoubleEntry")}
                </div>
                <div className="text-xs text-gray-500">
                  {t("accounting.doubleEntryEnabled")}
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        {canWriteFinance && (
          <div className="flex justify-end gap-3">
            <Link
              href="/finance/settings"
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {tc("cancel")}
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? tc("saving") : tc("save")}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
