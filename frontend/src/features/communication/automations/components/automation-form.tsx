"use client";

/**
 * Shared create/edit automation form (E25-S2, DEC-2 = RHF+Zod form sub-recipe).
 * Used by `automation-new-content` (create) and `automation-edit-content` (edit).
 *
 * Behaviour-preserving (A79): the same required set (name, templateId,
 * offsetDays-when-time-relative `>= 0`, segmentFilter-when-MemberSegment) — now
 * Zod via `automationFormSchema` with the SAME message keys; the template
 * dropdown loaded from the boundary-legal `emailTemplatesApi.getAllTemplates`;
 * the segment dropdown loaded via the folded `fetchMemberSegments`; the
 * trigger/offset/consent conditional fields; the "Preview recipients" action; and
 * the submit-error banner. The redirect on submit is owned by the caller's
 * `onSubmit` (the create/update mutation).
 */

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { PageShell } from "@/components/layout";
// eslint-disable-next-line no-restricted-imports -- E31-S1 DEC-3: emailTemplatesApi is owned by the sibling email-templates sub-slice (one owner, justified cross-import).
import { emailTemplatesApi } from "@/features/communication/email-templates/api/email-templates";
import { isTimeRelative } from "../api/automations";
import { fetchMemberSegments } from "../api/automations-api";
import { useRecipientPreview } from "../hooks/use-recipient-preview";
import {
  automationFormSchema,
  TRIGGER_TYPES,
  SEGMENT_TYPES,
  CONSENT_TYPES,
  type AutomationFormValues,
} from "../schemas/automation.schema";
import type {
  AutomationDetailDto,
  AutomationWriteRequest,
  MemberSegmentOption,
} from "../types/automation.types";

interface TemplateOption {
  id: number;
  name: string;
}

interface AutomationFormProps {
  mode: "create" | "edit";
  defaultValues: AutomationFormValues;
  // Receives the validated request body; owns the create/update + redirect.
  onSubmit: (body: AutomationWriteRequest) => void;
  pending: boolean;
  // API error from the create/update mutation, shown in the banner.
  errorMessage: string | null;
}

/** Map the RHF form values to the transport request (mirrors the god-page `buildRequest`). */
function toRequest(values: AutomationFormValues): AutomationWriteRequest {
  return {
    name: values.name.trim(),
    description: values.description.trim() || null,
    templateId:
      typeof values.templateId === "number"
        ? values.templateId
        : Number(values.templateId),
    triggerType: values.triggerType,
    offsetDays: isTimeRelative(values.triggerType)
      ? values.offsetDays === ""
        ? null
        : Number(values.offsetDays)
      : null,
    segmentType: values.segmentType,
    segmentFilter:
      values.segmentType === "MemberSegment"
        ? values.segmentFilter || null
        : null,
    consentFilter: values.consentFilter || null,
  };
}

const inputClass =
  "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors";

export function AutomationForm({
  mode,
  defaultValues,
  onSubmit,
  pending,
  errorMessage,
}: AutomationFormProps) {
  const t = useTranslations("automations");
  const { accessToken } = useAuth();

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<AutomationFormValues>({
    resolver: zodResolver(automationFormSchema),
    defaultValues,
  });

  // RHF's watch() is the intended API for driving the trigger/segment conditional
  // fields. React Compiler skipping memoization of this form is harmless (it
  // re-renders with its parent anyway). Mirrors the members slice forms.
  // eslint-disable-next-line react-hooks/incompatible-library
  const triggerType = watch("triggerType");
  const segmentType = watch("segmentType");
  const consentFilter = watch("consentFilter");

  // An existing automation's stored segment/consent can be a transport value
  // outside the 3-option select subset. A native `<select>` whose value matches
  // no `<option>` reports `.value===""` on submit (losing the value); rendering
  // an extra option for an out-of-set current value lets the select DISPLAY and
  // round-trip it unchanged (god-page parity).
  const extraSegmentType =
    segmentType && !SEGMENT_TYPES.includes(segmentType as never)
      ? segmentType
      : null;
  const extraConsentFilter =
    consentFilter && !CONSENT_TYPES.includes(consentFilter as never)
      ? consentFilter
      : null;

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [segments, setSegments] = useState<MemberSegmentOption[]>([]);

  const preview = useRecipientPreview();
  // Local preview error mirrors the god-page (preview failure surfaced in the
  // shared error banner). `preview.error` carries the thrown message.
  const previewError = preview.error?.message ?? null;

  useEffect(() => {
    if (!accessToken) return;
    emailTemplatesApi
      .getAllTemplates(accessToken)
      .then((list) =>
        setTemplates(list.map((x) => ({ id: x.id, name: x.name })))
      )
      .catch(() => setTemplates([]));

    fetchMemberSegments(accessToken).then(setSegments);
  }, [accessToken]);

  function handlePreview() {
    const values = getValues();
    preview.mutate({
      segmentType: values.segmentType,
      segmentFilter:
        values.segmentType === "MemberSegment"
          ? values.segmentFilter || null
          : null,
      consentFilter: values.consentFilter || null,
    });
  }

  const bannerError = errorMessage ?? previewError;

  return (
    <PageShell maxWidth="2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 md:text-3xl">
        {mode === "create" ? t("createTitle") : t("editTitle")}
      </h1>

      {bannerError && (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
          role="alert"
        >
          {bannerError}
        </div>
      )}

      <form
        onSubmit={handleSubmit((values) => onSubmit(toRequest(values)))}
        noValidate
        className="space-y-5 rounded-xl bg-white p-6 shadow-sm"
      >
        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700"
            htmlFor="name"
          >
            {t("form.name")}
          </label>
          <input id="name" className={inputClass} {...register("name")} />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {t(errors.name.message ?? "validation.nameRequired")}
            </p>
          )}
        </div>

        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700"
            htmlFor="description"
          >
            {t("form.description")}
          </label>
          <textarea
            id="description"
            className={inputClass}
            rows={2}
            {...register("description")}
          />
        </div>

        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700"
            htmlFor="template"
          >
            {t("form.template")}
          </label>
          <select
            id="template"
            className={inputClass}
            {...register("templateId", {
              setValueAs: (v) => (v === "" ? "" : Number(v)),
            })}
          >
            <option value="">{t("form.selectTemplate")}</option>
            {templates.map((tpl) => (
              <option key={tpl.id} value={tpl.id}>
                {tpl.name}
              </option>
            ))}
          </select>
          {errors.templateId && (
            <p className="mt-1 text-sm text-red-600" role="alert">
              {t(errors.templateId.message ?? "validation.templateRequired")}
            </p>
          )}
        </div>

        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700"
            htmlFor="triggerType"
          >
            {t("form.trigger")}
          </label>
          <select
            id="triggerType"
            className={inputClass}
            {...register("triggerType")}
          >
            {TRIGGER_TYPES.map((tt) => (
              <option key={tt} value={tt}>
                {t(`trigger.${tt}`)}
              </option>
            ))}
          </select>
        </div>

        {isTimeRelative(triggerType) && (
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700"
              htmlFor="offsetDays"
            >
              {t("form.offsetDays")}
            </label>
            <input
              id="offsetDays"
              type="number"
              min={0}
              className={inputClass}
              {...register("offsetDays", {
                setValueAs: (v) => (v === "" ? "" : Number(v)),
              })}
            />
            {errors.offsetDays && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {t(errors.offsetDays.message ?? "validation.offsetRequired")}
              </p>
            )}
          </div>
        )}

        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700"
            htmlFor="segmentType"
          >
            {t("form.recipients")}
          </label>
          <select
            id="segmentType"
            className={inputClass}
            {...register("segmentType")}
          >
            {SEGMENT_TYPES.map((st) => (
              <option key={st} value={st}>
                {t(`segment.${st}`)}
              </option>
            ))}
            {extraSegmentType && (
              <option value={extraSegmentType}>
                {t(`segment.${extraSegmentType}`)}
              </option>
            )}
          </select>
        </div>

        {segmentType === "MemberSegment" && (
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700"
              htmlFor="segment"
            >
              {t("form.segment")}
            </label>
            <select
              id="segment"
              className={inputClass}
              {...register("segmentFilter")}
            >
              <option value="">{t("form.selectSegment")}</option>
              {segments.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            {errors.segmentFilter && (
              <p className="mt-1 text-sm text-red-600" role="alert">
                {t(
                  errors.segmentFilter.message ?? "validation.segmentRequired"
                )}
              </p>
            )}
          </div>
        )}

        <div>
          <label
            className="mb-1 block text-sm font-medium text-gray-700"
            htmlFor="consent"
          >
            {t("form.consentFilter")}
          </label>
          <select
            id="consent"
            className={inputClass}
            {...register("consentFilter")}
          >
            <option value="">{t("form.noConsentFilter")}</option>
            {CONSENT_TYPES.map((c) => (
              <option key={c} value={c}>
                {t(`consent.${c}`)}
              </option>
            ))}
            {extraConsentFilter && (
              <option value={extraConsentFilter}>
                {t(`consent.${extraConsentFilter}`)}
              </option>
            )}
          </select>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={handlePreview}
            disabled={preview.isPending}
            className="rounded-lg border border-orange-600 px-4 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50 disabled:opacity-50"
          >
            {preview.isPending ? t("previewing") : t("previewRecipients")}
          </button>
          {preview.data && (
            <span className="text-sm text-gray-600" data-testid="preview-count">
              {t("previewCount", { count: preview.data.totalCount })}
            </span>
          )}
        </div>

        {preview.data && preview.data.preview.length > 0 && (
          <ul className="list-disc pl-5 text-sm text-gray-600">
            {preview.data.preview.map((p, i) => (
              <li key={i}>
                {p.firstName} {p.lastName} ({p.email})
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-3 border-t pt-4">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
          >
            {pending ? t("saving") : t("save")}
          </button>
        </div>
      </form>
    </PageShell>
  );
}

/**
 * Build the form default values from an existing automation detail (edit) or
 * empty (create). The detail's `segmentType`/`consentFilter` are the BROADER
 * transport enums (`RecipientSegmentType` has 6 values, `ConsentType` has 5; the
 * form selects only OFFER 3-option subsets). The RAW value is carried through
 * unchanged — god-page parity (the old component held `initial.segmentType` /
 * `initial.consentFilter` in state and re-submitted it byte-identical on a
 * no-touch save). The select renders an extra `<option>` when the current value
 * is out of its offered set, so a native `<select>` round-trips it on submit. The
 * `triggerType` set is identical between transport and form.
 */
export function buildDefaultValues(
  initial?: AutomationDetailDto
): AutomationFormValues {
  return {
    name: initial?.name ?? "",
    description: initial?.description ?? "",
    templateId: initial?.templateId ?? "",
    triggerType: initial?.trigger?.type ?? "MemberJoined",
    offsetDays: initial?.trigger?.offsetDays ?? "",
    segmentType: (initial?.segmentType ??
      "AllActiveMembers") as AutomationFormValues["segmentType"],
    segmentFilter: initial?.segmentFilter ?? "",
    consentFilter: (initial?.consentFilter ??
      "") as AutomationFormValues["consentFilter"],
  };
}
