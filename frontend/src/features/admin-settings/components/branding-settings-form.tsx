"use client";

/**
 * Branding tab form (E27-S3, DEC-2 = RHF+Zod). Behaviour preserved verbatim from the
 * god-page Branding tab (pinned by the E27-S1 net): the 10 editable fields + the live
 * preview, the `primaryColor` hex + `contactEmail` email validation (blank → saved as
 * null), the logo upload as a SECOND request with the `LogoUploadState` machine + the
 * client type/size allowlist, and the persistent success/error banner.
 *
 * A96 — the schema applies NO `.trim()`/transform; the blank→null mapping happens here
 * in `toRequest` (a trimmed COPY decides null-ness; the god-page sent `.trim() || null`
 * for the optional profile fields, raw values for the required logo fields). `<form
 * noValidate>` surfaces the per-field hex/email errors. The logo `LogoUploadState`
 * machine + `ALLOWED_LOGO_TYPES`/`MAX_LOGO_SIZE_BYTES` allowlist are ported verbatim.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  brandingSettingsSchema,
  type BrandingSettingsValues,
} from "../schemas/admin-settings.schema";
import type { UpdateSettingsRequest } from "../types/admin-settings.types";

// REQ-086 (E9-S1): logo content-type allowlist + size cap, mirrored from the API.
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/svg+xml",
  "image/webp",
];
const MAX_LOGO_SIZE_BYTES = 1 * 1024 * 1024;

// REQ-086 (E9-S1): logo upload sub-state surfaced inline in the Branding tab.
type LogoUploadState = "idle" | "uploading" | "failed" | "invalid";

interface BrandingSettingsFormProps {
  defaultValues: BrandingSettingsValues;
  // The stored logo asset URL (for the live preview when no new file is staged).
  currentLogoUrl: string | null;
  // Owns the PUT (+ optional logo POST) + redirect/refresh. Receives the mapped
  // request body (blank optional fields → null) + the staged file (or null).
  onSubmit: (body: UpdateSettingsRequest, logoFile: File | null) => void;
  pending: boolean;
  // The persistent success/error banner (no auto-dismiss). Driven by the content.
  message: { type: "success" | "error"; text: string } | null;
  // True when the LAST submit failed specifically at the logo upload step — drives
  // the inline `failed` sub-state (the banner is separate, via `message`).
  logoFailed: boolean;
}

/** Map RHF values → transport body (blanks → null; A96 — no schema-level trim). */
function toRequest(values: BrandingSettingsValues): UpdateSettingsRequest {
  return {
    applicationName: values.applicationName,
    logoText: values.logoText,
    logoBackgroundColor: values.logoBackgroundColor,
    logoTextColor: values.logoTextColor,
    description: values.description.trim() || null,
    contactEmail: values.contactEmail.trim() || null,
    contactPhone: values.contactPhone.trim() || null,
    contactAddress: values.contactAddress.trim() || null,
    primaryColor: values.primaryColor.trim() || null,
    publicSiteEnabled: values.publicSiteEnabled,
  };
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500";

export function BrandingSettingsForm({
  defaultValues,
  currentLogoUrl,
  onSubmit,
  pending,
  message,
  logoFailed,
}: BrandingSettingsFormProps) {
  const t = useTranslations("settings");
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BrandingSettingsValues>({
    resolver: zodResolver(brandingSettingsSchema),
    defaultValues,
  });

  // RHF watch() drives the live preview. React Compiler skipping memoization here is
  // harmless (the form re-renders with its parent anyway). Mirrors the members form.
  // eslint-disable-next-line react-hooks/incompatible-library
  const applicationName = watch("applicationName");
  const logoText = watch("logoText");
  const logoBackgroundColor = watch("logoBackgroundColor");
  const logoTextColor = watch("logoTextColor");
  const primaryColor = watch("primaryColor");
  const publicSiteEnabled = watch("publicSiteEnabled");

  // REQ-086 (E9-S1): staged logo file + upload sub-state + preview object URL +
  // stored-asset load-error fallback. Kept as local component state (the file never
  // enters RHF — it is the SECOND request).
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoState, setLogoState] = useState<LogoUploadState>("idle");
  const [logoImgError, setLogoImgError] = useState(false);

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      return;
    }
    if (
      !ALLOWED_LOGO_TYPES.includes(file.type) ||
      file.size > MAX_LOGO_SIZE_BYTES
    ) {
      setLogoState("invalid");
      setLogoFile(null);
      setLogoPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    setLogoState("idle");
    setLogoImgError(false);
    setLogoFile(file);
    setLogoPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  // The inline "failed" sub-state is driven by the parent's last-submit result so the
  // machine reflects a genuine upload failure (not just the staged-file lifecycle).
  const effectiveLogoState: LogoUploadState =
    logoFailed && logoFile ? "failed" : logoState;

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      {message && (
        <div
          className={`mb-6 rounded-lg p-4 text-sm ${
            message.type === "success"
              ? "border border-green-200 bg-green-50 text-green-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <form
        onSubmit={handleSubmit((values) =>
          onSubmit(toRequest(values), logoFile)
        )}
        noValidate
        className="space-y-6"
      >
        {/* Application Name */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("applicationName")}
          </label>
          <input
            type="text"
            className={inputClass}
            {...register("applicationName")}
          />
        </div>

        {/* Logo Text */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("logoText")}
          </label>
          <input
            type="text"
            maxLength={5}
            className={inputClass}
            {...register("logoText")}
          />
          <p className="mt-1 text-xs text-gray-500">{t("logoTextHint")}</p>
        </div>

        {/* Color pickers row */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Logo Background Color */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("logoBackgroundColor")}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={logoBackgroundColor}
                onChange={(e) =>
                  setValue("logoBackgroundColor", e.target.value)
                }
                className="h-10 w-14 cursor-pointer rounded border border-gray-300"
              />
              <input
                type="text"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                {...register("logoBackgroundColor")}
              />
            </div>
          </div>

          {/* Logo Text Color */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("logoTextColor")}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={logoTextColor}
                onChange={(e) => setValue("logoTextColor", e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-gray-300"
              />
              <input
                type="text"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                {...register("logoTextColor")}
              />
            </div>
          </div>
        </div>

        {/* REQ-086: Primary brand color */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("primaryColor")}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              // Display fallback only — the form state stays "" when unset so the
              // field is saved as null ("not configured").
              value={primaryColor || "#ea580c"}
              onChange={(e) => setValue("primaryColor", e.target.value)}
              className="h-10 w-14 cursor-pointer rounded border border-gray-300"
            />
            <input
              type="text"
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 font-mono text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
              {...register("primaryColor")}
            />
          </div>
          {errors.primaryColor && (
            <p className="mt-1 text-xs text-red-600">
              {t(errors.primaryColor.message ?? "primaryColorInvalid")}
            </p>
          )}
        </div>

        {/* REQ-086: Organization description */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("description")}
          </label>
          <textarea
            rows={3}
            className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            {...register("description")}
          />
          <p className="mt-1 text-xs text-gray-500">{t("descriptionHint")}</p>
        </div>

        {/* REQ-086: Public website toggle */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {t("publicSiteEnabled")}
          </label>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="publicSiteEnabled"
              className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
              {...register("publicSiteEnabled")}
            />
            <label
              htmlFor="publicSiteEnabled"
              className="text-sm font-medium text-gray-700"
            >
              {publicSiteEnabled
                ? t("publicSiteEnabledOn")
                : t("publicSiteEnabledOff")}
            </label>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t("publicSiteEnabledHint")}
          </p>
        </div>

        {/* REQ-086: Logo upload */}
        <div>
          <label
            htmlFor="logoUpload"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t("logo")}
          </label>
          <input
            id="logoUpload"
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={handleLogoFileChange}
            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-orange-600 file:px-4 file:py-2 file:font-medium file:text-white hover:file:bg-orange-700"
          />
          <p className="mt-1 text-xs text-gray-500">{t("logoHint")}</p>
          {logoFile && (
            <p className="mt-1 text-xs text-gray-700">{logoFile.name}</p>
          )}
          {pending && logoFile && (
            <p className="mt-1 text-xs text-gray-500">{t("logoUploading")}</p>
          )}
          {effectiveLogoState === "invalid" && (
            <p className="mt-1 text-xs text-red-600">{t("logoInvalid")}</p>
          )}
          {effectiveLogoState === "failed" && (
            <p className="mt-1 text-xs text-red-600">{t("logoUploadFailed")}</p>
          )}
        </div>

        {/* ---- Contact information (REQ-086) ---- */}
        <div className="border-t border-gray-200 pt-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">
            {t("sectionContactTitle")}
          </h2>
          <div className="space-y-6">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("contactEmail")}
              </label>
              <input
                type="email"
                className={inputClass}
                {...register("contactEmail")}
              />
              {errors.contactEmail && (
                <p className="mt-1 text-xs text-red-600">
                  {t(errors.contactEmail.message ?? "contactEmailInvalid")}
                </p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("contactPhone")}
              </label>
              <input
                type="tel"
                className={inputClass}
                {...register("contactPhone")}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("contactAddress")}
              </label>
              <textarea
                rows={2}
                className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                {...register("contactAddress")}
              />
            </div>
          </div>
        </div>

        {/* Logo Preview */}
        <div>
          <label className="mb-3 block text-sm font-medium text-gray-700">
            {t("logoPreview")}
          </label>
          <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
            {(logoPreviewUrl || currentLogoUrl) && !logoImgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoPreviewUrl ?? currentLogoUrl ?? ""}
                alt={applicationName}
                onError={() => setLogoImgError(true)}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                style={{
                  backgroundColor: logoBackgroundColor,
                  color: logoTextColor,
                }}
              >
                {logoText}
              </div>
            )}
            <span className="font-medium" style={{ color: primaryColor }}>
              {applicationName}
            </span>
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end border-t border-gray-200 pt-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-orange-600 px-6 py-2 font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {pending ? t("saving") : t("saveSettings")}
          </button>
        </div>
      </form>
    </div>
  );
}
