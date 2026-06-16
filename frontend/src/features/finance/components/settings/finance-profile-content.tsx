"use client";

/**
 * Finance Profile content (E26-S6 migration of `app/finance/settings/profile/page.tsx`).
 * Composition root (only `"use client"`) — self-embeds its own `QueryClientProvider`. The
 * second-biggest RHF+Zod form in the epic (~17 fields) and the canonical read-only-render page.
 *
 * Behaviour preserved AS-IS (A56, the E26-S1 profile net is the oracle):
 *   - Guard: `if (authLoading || loading) return <loading>`; NO `!canReadFinance` early-return —
 *     `loading` starts true and only clears via the guarded fetch, so a non-read user is stuck on
 *     tc("loading") and fires no GET (preserve AS-IS).
 *   - 404-on-GET → "create mode" (POST /profile) vs existing-profile (PUT /profile/{id}) branch,
 *     chosen from the loaded-profile presence.
 *   - jurisdiction → currency/countryCode/organizationCountry reset side-effect (CH↔EU).
 *   - `finance-profile-changed` CustomEvent dispatched on a SUCCESSFUL save (via the hook).
 *   - read-only render: canReadFinance && !canWriteFinance → every field `disabled` + NO save
 *     footer (the canonical read-only page).
 *   - A95: countryCode is a FULL string union (raw default + extra <option> for an out-of-set
 *     stored value) so a no-touch edit-save round-trips it. A96: optionals `"" → null` (in the
 *     hook payload mapping), nothing trimmed.
 */

import { useState } from "react";
import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import {
  useFinanceProfile,
  useSaveFinanceProfile,
} from "../../hooks/use-finance-profile";
import {
  financeProfileFormSchema,
  type FinanceProfileFormValues,
} from "../../schemas/finance-profile.schema";
import type {
  FinanceProfilePayload,
  SettingsFinanceProfile,
} from "../../types/settings.types";

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

// EU country codes for the dropdown (the rendered subset; A95 — the field accepts the FULL union).
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

const DEFAULT_VALUES: FinanceProfileFormValues = {
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

const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500";

function profileToFormValues(
  data: SettingsFinanceProfile
): FinanceProfileFormValues {
  return {
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
  };
}

/** Map the form values to the wire payload. A96: optionals `"" → null`, required untrimmed. */
function formToPayload(
  values: FinanceProfileFormValues
): FinanceProfilePayload {
  return {
    jurisdiction: values.jurisdiction,
    countryCode: values.countryCode || null,
    currency: values.currency,
    fiscalYearStartMonth: values.fiscalYearStartMonth,
    organizationName: values.organizationName,
    organizationAddress: values.organizationAddress,
    organizationCity: values.organizationCity,
    organizationPostalCode: values.organizationPostalCode,
    organizationCountry: values.organizationCountry,
    organizationEmail: values.organizationEmail || null,
    organizationPhone: values.organizationPhone || null,
    organizationWebsite: values.organizationWebsite || null,
    organizationUid: values.organizationUid || null,
    bankName: values.bankName || null,
    bankIban: values.bankIban || null,
    bankBic: values.bankBic || null,
    accountingMode: values.accountingMode,
  };
}

interface ProfileFormProps {
  defaultValues: FinanceProfileFormValues;
  canWrite: boolean;
  saving: boolean;
  onSubmit: (values: FinanceProfileFormValues) => void;
}

function FinanceProfileForm({
  defaultValues,
  canWrite,
  saving,
  onSubmit,
}: ProfileFormProps) {
  const t = useTranslations("finance");
  const ts = useTranslations("finance.settings");
  const tc = useTranslations("common");
  const { register, handleSubmit, control, setValue } =
    useForm<FinanceProfileFormValues>({
      resolver: zodResolver(financeProfileFormSchema),
      defaultValues,
    });

  const jurisdiction = useWatch({ control, name: "jurisdiction" });
  const currency = useWatch({ control, name: "currency" });
  const countryCode = useWatch({ control, name: "countryCode" });
  // All-values reactive subscription (replaces the dynamic `watch(name)` reads in the
  // `textField` helper + the inline organizationCountry read; identical current values).
  const formValues = useWatch({ control });

  // jurisdiction → currency/countryCode/organizationCountry reset side-effect (CH↔EU).
  const handleJurisdictionChange = (value: string) => {
    setValue("jurisdiction", value);
    setValue("currency", value === "CH" ? "CHF" : "EUR");
    if (value === "CH") {
      setValue("countryCode", "");
      setValue("organizationCountry", "CH");
    }
  };

  // A95: render an out-of-set stored countryCode as an extra <option> so a no-touch save
  // round-trips it (e.g. a stranded "GB" under jurisdiction EU).
  const countryCodeOutOfSet =
    countryCode !== "" && !EU_COUNTRIES.some((c) => c.code === countryCode);

  // The text inputs are CONTROLLED (RHF register + an explicit `value` from `watch`). This keeps
  // the rendered `value` HTML attribute present (the S1 net queries fields via
  // `querySelector('input[value="…"]')`), while RHF still tracks the value via register's onChange.
  const textField = (name: keyof FinanceProfileFormValues) => ({
    ...register(name),
    value: String(formValues[name] ?? ""),
  });

  return (
    <form noValidate onSubmit={handleSubmit(onSubmit)}>
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
              value={jurisdiction}
              onChange={(e) => handleJurisdictionChange(e.target.value)}
              disabled={!canWrite}
            >
              <option value="CH">{ts("jurisdictionCH")}</option>
              <option value="EU">{ts("jurisdictionEU")}</option>
            </select>
          </div>

          {/* EU Country Code */}
          {jurisdiction === "EU" && (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                {ts("countryCode")}
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                value={countryCode}
                onChange={(e) => setValue("countryCode", e.target.value)}
                disabled={!canWrite}
              >
                <option value="">{ts("selectCountry")}</option>
                {countryCodeOutOfSet && (
                  <option value={countryCode}>{countryCode}</option>
                )}
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
              value={currency}
              onChange={(e) => setValue("currency", e.target.value)}
              disabled={!canWrite}
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
              disabled={!canWrite}
              {...register("fiscalYearStartMonth", { valueAsNumber: true })}
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
              className={inputClass}
              disabled={!canWrite}
              {...textField("organizationName")}
            />
          </div>

          <div className="space-y-1 md:col-span-2">
            <label className="block text-sm font-medium text-gray-700">
              {ts("organizationAddress")}
              <span className="ml-1 text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputClass}
              disabled={!canWrite}
              {...textField("organizationAddress")}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {ts("organizationCity")}
              <span className="ml-1 text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputClass}
              disabled={!canWrite}
              {...textField("organizationCity")}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {ts("organizationPostalCode")}
              <span className="ml-1 text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputClass}
              disabled={!canWrite}
              {...textField("organizationPostalCode")}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {ts("organizationCountry")}
              <span className="ml-1 text-red-500">*</span>
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="CH"
              maxLength={2}
              disabled={!canWrite}
              value={String(formValues.organizationCountry ?? "")}
              onChange={(e) =>
                // Preserve the god-page's uppercase-on-type behaviour.
                setValue("organizationCountry", e.target.value.toUpperCase())
              }
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {ts("organizationUid")}
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="CHE-123.456.789"
              disabled={!canWrite}
              {...textField("organizationUid")}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {ts("organizationEmail")}
            </label>
            <input
              type="email"
              className={inputClass}
              disabled={!canWrite}
              {...textField("organizationEmail")}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {ts("organizationPhone")}
            </label>
            <input
              type="tel"
              className={inputClass}
              disabled={!canWrite}
              {...textField("organizationPhone")}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {ts("organizationWebsite")}
            </label>
            <input
              type="url"
              className={inputClass}
              disabled={!canWrite}
              {...textField("organizationWebsite")}
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
              className={inputClass}
              disabled={!canWrite}
              {...textField("bankName")}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {ts("bankIban")}
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="CH93 0076 2011 6238 5295 7"
              disabled={!canWrite}
              {...textField("bankIban")}
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">
              {ts("bankBic")}
            </label>
            <input
              type="text"
              className={inputClass}
              placeholder="UBSWCHZH80A"
              disabled={!canWrite}
              {...textField("bankBic")}
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
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:border-orange-200">
            <input
              type="radio"
              value="SimpleCash"
              disabled={!canWrite}
              className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-500"
              {...register("accountingMode")}
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
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-4 transition-colors hover:border-orange-200">
            <input
              type="radio"
              value="DoubleEntry"
              disabled={!canWrite}
              className="h-4 w-4 border-gray-300 text-orange-600 focus:ring-orange-500"
              {...register("accountingMode")}
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

      {/* Save Button — hidden for a read-only user (the canonical read-only render) */}
      {canWrite && (
        <div className="flex justify-end gap-3">
          <Link
            href="/finance/settings"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {tc("cancel")}
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? tc("saving") : tc("save")}
          </button>
        </div>
      )}
    </form>
  );
}

function FinanceProfileBody() {
  const t = useTranslations("finance");
  const tc = useTranslations("common");
  const { canReadFinance, canWriteFinance, isLoading: authLoading } = useAuth();

  const profileQuery = useFinanceProfile(!authLoading && canReadFinance);
  // A56: `loading` starts true and only clears via the guarded fetch — a non-read user stays here.
  const loading = authLoading || !canReadFinance || profileQuery.isPending;

  const saveProfile = useSaveFinanceProfile();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const profile = profileQuery.data?.profile ?? null;
  const loadError = profileQuery.data?.loadError ?? false;
  const banner = error ?? (loadError ? t("loadError") : null);

  const defaultValues = profile ? profileToFormValues(profile) : DEFAULT_VALUES;

  const handleSubmit = (values: FinanceProfileFormValues) => {
    if (!canWriteFinance) return;
    setError(null);
    setSuccess(null);
    saveProfile.mutate(
      { profileId: profile?.id ?? null, payload: formToPayload(values) },
      {
        onSuccess: () => setSuccess(t("saveSuccess")),
        onError: () => setError(t("saveError")),
      }
    );
  };

  if (loading) {
    return (
      <PageShell maxWidth="4xl">
        <p className="text-gray-500">{tc("loading")}</p>
      </PageShell>
    );
  }

  return (
    <PageShell maxWidth="4xl">
      {/* Back to Settings */}
      <Link
        href="/finance/settings"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
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
      {banner && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{banner}</p>
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      <FinanceProfileForm
        key={profile?.id ?? "create"}
        defaultValues={defaultValues}
        canWrite={canWriteFinance}
        saving={saveProfile.isPending}
        onSubmit={handleSubmit}
      />
    </PageShell>
  );
}

export function FinanceProfileContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <FinanceProfileBody />
    </QueryClientProvider>
  );
}
