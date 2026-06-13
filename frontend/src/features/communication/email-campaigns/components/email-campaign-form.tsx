"use client";

/**
 * Shared create/edit email-campaign form (E25-S3, DEC-2 = RHF+Zod form sub-recipe).
 * Used by `email-campaign-new-content` (create) and `email-campaign-edit-content`
 * (edit).
 *
 * Behaviour-preserving (A79), pinned by the E25-S1 new/edit characterization nets:
 *   - the four sections (basic info / sender / recipients-segment / content) with
 *     verbatim markup;
 *   - the segment `<select>` offering the 5 god-page options via the HARDCODED
 *     German `getSegmentTypeLabel` (NOT i18n) + the MemberSegment search dropdown
 *     (loaded via the folded `fetchActiveMemberSegments`) + the Custom free-text;
 *   - the content editor toggle reusing the SHARED `RichTextEditor` /
 *     `HtmlSourceEditor` (NOT duplicated) + the plaintext textarea + placeholders;
 *   - the template load-in dropdown via the boundary-legal
 *     `emailTemplatesApi.getAllTemplates` / `getTemplateById`;
 *   - the REQ-086 race-guard: in CREATE mode the sender name defaults to
 *     `settings.applicationName` once settings load (only when still empty) and the
 *     submit button is disabled while `settingsLoading && !fromName.trim()`; in EDIT
 *     mode the default is baked into `defaultValues` by the caller (the ref guard
 *     against a late AppSettings re-render lives there);
 *   - the neutral `noreply@example.org` default (baked into the caller's defaults);
 *   - the submit-error banner. The redirect on submit is owned by the caller's
 *     `onSubmit` (the create/update mutation).
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useApiClient, useAuth } from "@/lib/auth";
// eslint-disable-next-line no-restricted-imports -- E31-S1 DEC-3: emailTemplatesApi is owned by the sibling email-templates sub-slice (one owner, justified cross-import).
import { emailTemplatesApi } from "@/features/communication/email-templates/api/email-templates";
import { getSegmentTypeLabel } from "../api/email-campaign-helpers";
import {
  RichTextEditor,
  HtmlSourceEditor,
} from "@/components/ui/rich-text-editor";
import {
  emailCampaignFormSchema,
  SEGMENT_TYPE_OPTIONS,
  type EmailCampaignFormValues,
} from "../schemas/email-campaign.schema";
import {
  fetchActiveMemberSegments,
  type ActiveMemberSegment,
} from "../api/email-campaigns-api";
import type {
  CreateEmailCampaignRequest,
  EmailCampaignDto,
} from "../types/email-campaign.types";

interface EmailTemplateOption {
  id: number;
  name: string;
  category?: string;
  isActive: boolean;
}

type EditorMode = "visual" | "html";

interface EmailCampaignFormProps {
  mode: "create" | "edit";
  defaultValues: EmailCampaignFormValues;
  // Receives the validated request body; owns the create/update + redirect.
  onSubmit: (body: CreateEmailCampaignRequest) => void;
  pending: boolean;
  // API error from the create/update mutation, shown in the banner.
  errorMessage: string | null;
  // REQ-086 (CREATE only): drive the sender-name default + the submit race-guard.
  settingsLoading?: boolean;
  applicationName?: string;
  // Where the Cancel link points (the list for create, the detail for edit).
  cancelHref: string;
  // Where the header back-link points + its i18n key (god-page parity: create →
  // the list + `backToCampaigns`; edit → the detail page + `backToCampaign`).
  backHref: string;
  backLabelKey: string;
}

/** Map the RHF form values to the transport request (mirrors the god-page formData). */
function toRequest(
  values: EmailCampaignFormValues
): CreateEmailCampaignRequest {
  return {
    name: values.name,
    subject: values.subject,
    htmlContent: values.htmlContent,
    plainTextContent: values.plainTextContent,
    fromName: values.fromName,
    fromEmail: values.fromEmail,
    replyToEmail: values.replyToEmail,
    segmentType: values.segmentType,
    segmentFilter: values.segmentFilter,
  };
}

export function EmailCampaignForm({
  mode,
  defaultValues,
  onSubmit,
  pending,
  errorMessage,
  settingsLoading = false,
  applicationName = "",
  cancelHref,
  backHref,
  backLabelKey,
}: EmailCampaignFormProps) {
  const t = useTranslations("emailCampaigns");
  const tCommon = useTranslations("common");
  const { accessToken } = useAuth();
  const api = useApiClient();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<EmailCampaignFormValues>({
    resolver: zodResolver(emailCampaignFormSchema),
    defaultValues,
  });

  // RHF's watch() is the intended API for the segment/editor conditional fields +
  // the REQ-086 submit guard. React Compiler skipping memoization here is harmless
  // (the form re-renders with its parent anyway). Mirrors the automations slice.
  // eslint-disable-next-line react-hooks/incompatible-library
  const segmentType = watch("segmentType");
  const segmentFilter = watch("segmentFilter");
  const htmlContent = watch("htmlContent");
  const fromName = watch("fromName");

  const [editorMode, setEditorMode] = useState<EditorMode>("visual");
  const [templates, setTemplates] = useState<EmailTemplateOption[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [availableSegments, setAvailableSegments] = useState<
    ActiveMemberSegment[]
  >([]);
  const [segmentSearch, setSegmentSearch] = useState("");
  const [segmentDropdownOpen, setSegmentDropdownOpen] = useState(false);
  const [selectedSegmentName, setSelectedSegmentName] = useState("");
  const [templateError, setTemplateError] = useState<string | null>(null);
  const segmentSearchRef = useRef<HTMLDivElement>(null);

  // REQ-086 (CREATE): default the sender name from the configured organization once
  // settings have loaded — only when still empty (avoids clobbering user input).
  // Mirrors the god-page's post-settings effect (NOT a useState initializer).
  useEffect(() => {
    if (mode !== "create") return;
    if (!settingsLoading) {
      if (!getValues("fromName")) {
        setValue("fromName", applicationName);
      }
    }
  }, [mode, settingsLoading, applicationName, getValues, setValue]);

  // Load available active templates.
  useEffect(() => {
    if (accessToken) {
      emailTemplatesApi
        .getAllTemplates(accessToken)
        .then((data) => {
          setTemplates(
            (data as EmailTemplateOption[]).filter((x) => x.isActive)
          );
        })
        .catch(() => {});
    }
  }, [accessToken]);

  // Load available member segments (folded `/member-segments/active` fetch). In
  // EDIT mode, if the campaign already uses a MemberSegment, resolve its display
  // name once the list arrives (god-page parity).
  useEffect(() => {
    if (!accessToken) return;
    fetchActiveMemberSegments(api).then((data) => {
      setAvailableSegments(data);
      if (segmentType === "MemberSegment" && segmentFilter) {
        const found = data.find((s) => s.id === segmentFilter);
        if (found) setSelectedSegmentName(found.name);
      }
    });
    // Mirrors the god-page: re-resolved when the segment selection changes.
  }, [accessToken, api, segmentType, segmentFilter]);

  // Close segment dropdown on outside click.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        segmentSearchRef.current &&
        !segmentSearchRef.current.contains(e.target as Node)
      ) {
        setSegmentDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLoadTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!templateId) return;
    try {
      const template = await emailTemplatesApi.getTemplateById(
        Number(templateId),
        accessToken || undefined
      );
      setValue("subject", template.subject);
      setValue("htmlContent", template.htmlContent);
      setValue("plainTextContent", template.textContent || "");
    } catch {
      setTemplateError(t("form.templateLoadError"));
    }
  };

  const banner = errorMessage ?? templateError;

  const submitLabel =
    mode === "create" ? t("form.createCampaign") : t("form.saveChanges");
  const pendingLabel =
    mode === "create" ? t("form.creating") : t("form.saving");

  // REQ-086 (CREATE): block submit while settings are still loading and the sender
  // name has not been filled — avoids posting an empty fromName.
  const submitDisabled =
    pending ||
    (mode === "create" && settingsLoading && !(fromName ?? "").trim());

  const wrapperClass =
    mode === "create" ? "mx-auto max-w-4xl" : "mx-auto max-w-7xl";

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className={wrapperClass}>
        {/* Header */}
        <div className="mb-6">
          <Link
            href={backHref}
            className="mb-2 flex items-center gap-1 text-gray-600 hover:text-gray-900"
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
            {t(backLabelKey)}
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            {mode === "create" ? t("form.newTitle") : t("form.editTitle")}
          </h1>
          {mode === "edit" && (
            <p className="mt-1 text-gray-500">{t("form.editSubtitle")}</p>
          )}
        </div>

        {banner && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            {banner}
          </div>
        )}

        <form
          onSubmit={handleSubmit((values) => onSubmit(toRequest(values)))}
          noValidate
          className="space-y-6"
        >
          {/* Template Selector */}
          {templates.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100">
                  <svg
                    className="h-5 w-5 text-amber-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <label
                    htmlFor="templateSelect"
                    className="mb-1 block text-sm font-medium text-amber-800"
                  >
                    {t("form.loadFromTemplate")}
                  </label>
                  <select
                    id="templateSelect"
                    value={selectedTemplateId}
                    onChange={(e) => handleLoadTemplate(e.target.value)}
                    className="w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">{t("form.selectTemplate")}</option>
                    {templates.map((tmpl) => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name}
                        {tmpl.category ? ` (${tmpl.category})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Grunddaten */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                <svg
                  className="h-5 w-5 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  {t("form.basicInfo")}
                </h2>
                <p className="text-sm text-gray-500">
                  {t("form.basicInfoDescription")}
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("form.campaignName")} *
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  placeholder={t("form.campaignNamePlaceholder")}
                  {...register("name")}
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">
                    {t(errors.name.message!)}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("form.subject")} *
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  placeholder={t("form.subjectPlaceholder")}
                  {...register("subject")}
                />
                {errors.subject && (
                  <p className="mt-1 text-sm text-red-600">
                    {t(errors.subject.message!)}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Absender */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                <svg
                  className="h-5 w-5 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  {t("form.sender")}
                </h2>
                <p className="text-sm text-gray-500">
                  {t("form.senderDescription")}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("form.senderName")} *
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  {...register("fromName")}
                />
                {errors.fromName && (
                  <p className="mt-1 text-sm text-red-600">
                    {t(errors.fromName.message!)}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("form.senderEmail")} *
                </label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  {...register("fromEmail")}
                />
                {errors.fromEmail && (
                  <p className="mt-1 text-sm text-red-600">
                    {t(errors.fromEmail.message!)}
                  </p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("form.replyToEmail")}
                </label>
                <input
                  type="email"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  placeholder={t("form.replyToEmailPlaceholder")}
                  {...register("replyToEmail")}
                />
              </div>
            </div>
          </div>

          {/* Empfänger */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                <svg
                  className="h-5 w-5 text-orange-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-medium text-gray-900">
                  {t("form.recipients")}
                </h2>
                <p className="text-sm text-gray-500">
                  {t("form.recipientsDescription")}
                </p>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t("form.recipientGroup")} *
              </label>
              <select
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                {...register("segmentType", {
                  onChange: (e) => {
                    if (e.target.value !== "MemberSegment") {
                      setValue("segmentFilter", "");
                      setSelectedSegmentName("");
                    }
                  },
                })}
              >
                {SEGMENT_TYPE_OPTIONS.map((type) => (
                  <option key={type} value={type}>
                    {getSegmentTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            {segmentType === "MemberSegment" && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("form.selectSegment")}
                </label>
                <div className="relative" ref={segmentSearchRef}>
                  <input
                    type="text"
                    placeholder={t("form.searchSegmentPlaceholder")}
                    value={segmentSearch || selectedSegmentName}
                    onChange={(e) => {
                      setSegmentSearch(e.target.value);
                      setSegmentDropdownOpen(true);
                      if (!e.target.value) {
                        setSelectedSegmentName("");
                        setValue("segmentFilter", "");
                      }
                    }}
                    onFocus={() => setSegmentDropdownOpen(true)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  />
                  {segmentDropdownOpen && (
                    <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                      {availableSegments
                        .filter((s) =>
                          s.name
                            .toLowerCase()
                            .includes((segmentSearch || "").toLowerCase())
                        )
                        .map((seg) => (
                          <button
                            key={seg.id}
                            type="button"
                            onClick={() => {
                              setValue("segmentFilter", seg.id);
                              setSelectedSegmentName(seg.name);
                              setSegmentSearch("");
                              setSegmentDropdownOpen(false);
                            }}
                            className="w-full border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-orange-50"
                          >
                            <span className="text-sm font-medium text-gray-900">
                              {seg.name}
                            </span>
                            <span
                              className={`ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                seg.segmentType === "Dynamic"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {seg.segmentType === "Dynamic"
                                ? "Dynamisch"
                                : "Statisch"}
                            </span>
                          </button>
                        ))}
                      {availableSegments.filter((s) =>
                        s.name
                          .toLowerCase()
                          .includes((segmentSearch || "").toLowerCase())
                      ).length === 0 && (
                        <p className="px-4 py-3 text-center text-sm text-gray-500">
                          {t("form.noSegmentsFound")}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
            {segmentType === "Custom" && (
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t("form.customFilter")}
                </label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  placeholder={t("form.customFilterPlaceholder")}
                  {...register("segmentFilter")}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t("form.customFilterHint")}
                </p>
              </div>
            )}
          </div>

          {/* Inhalt */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                  <svg
                    className="h-5 w-5 text-orange-600"
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
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    {t("form.content")}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {t("form.contentDescription")}
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4 flex items-center justify-between">
              {/* Editor Mode Toggle */}
              <div className="flex items-center rounded-lg bg-gray-100 p-1">
                <button
                  type="button"
                  onClick={() => setEditorMode("visual")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    editorMode === "visual"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
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
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    {t("form.visualMode")}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditorMode("html")}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    editorMode === "html"
                      ? "bg-white text-orange-600 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
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
                        d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
                      />
                    </svg>
                    {t("form.htmlMode")}
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                {mode === "edit" && (
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    {t("form.htmlContent")} *
                  </label>
                )}
                {editorMode === "visual" ? (
                  <RichTextEditor
                    content={htmlContent}
                    onChange={(content) => setValue("htmlContent", content)}
                    placeholder={t("form.editorPlaceholder")}
                    minHeight="300px"
                  />
                ) : (
                  <HtmlSourceEditor
                    content={htmlContent}
                    onChange={(content) => setValue("htmlContent", content)}
                    placeholder="<html>...</html>"
                    minHeight="300px"
                  />
                )}
                <div className="mt-2 rounded-xl bg-gray-50 p-3">
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">
                      {t("form.availablePlaceholders")}:
                    </span>{" "}
                    <code className="rounded bg-gray-200 px-1 py-0.5 text-orange-600">
                      {"{{firstName}}"}
                    </code>
                    ,{" "}
                    <code className="rounded bg-gray-200 px-1 py-0.5 text-orange-600">
                      {"{{lastName}}"}
                    </code>
                    ,{" "}
                    <code className="rounded bg-gray-200 px-1 py-0.5 text-orange-600">
                      {"{{email}}"}
                    </code>
                  </p>
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-700">
                  {t("form.plainTextVersion")}
                </label>
                <textarea
                  rows={6}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-gray-900 transition-colors focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
                  placeholder={t("form.plainTextPlaceholder")}
                  {...register("plainTextContent")}
                />
                <p className="mt-1 text-xs text-gray-500">
                  {t("form.plainTextHint")}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4 pb-8">
            <Link
              href={cancelHref}
              className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 transition-colors hover:bg-gray-50"
            >
              {tCommon("cancel")}
            </Link>
            <button
              type="submit"
              disabled={submitDisabled}
              className="rounded-lg bg-orange-600 px-6 py-2 text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {pending ? pendingLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
