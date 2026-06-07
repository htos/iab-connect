"use client";

/**
 * REQ-028 (E5-S3): shared create/edit form for automation definitions. Controlled inputs, client
 * validation before submit, server-side 400 surfaced inline, shared form styling + orange-600
 * primary, and a "Preview recipients" action that calls S1's server-computed preview endpoint.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { emailTemplatesApi } from "@/lib/email-templates";
import {
  AutomationDetailDto,
  AutomationTriggerType,
  ConsentType,
  RecipientSegmentType,
  AutomationWriteRequest,
  createAutomation,
  updateAutomation,
  previewRecipients,
  isTimeRelative,
  RecipientPreviewDto,
} from "@/lib/api/automations";

interface TemplateOption {
  id: number;
  name: string;
}
interface SegmentOption {
  id: string;
  name: string;
}

const TRIGGER_TYPES: AutomationTriggerType[] = [
  "MemberJoined",
  "EventUpcoming",
  "MembershipRenewalDue",
  "Scheduled",
  "Manual",
];
const SEGMENT_TYPES: RecipientSegmentType[] = [
  "AllActiveMembers",
  "NewsletterSubscribers",
  "MemberSegment",
];
const CONSENT_TYPES: ConsentType[] = [
  "Newsletter",
  "EventNotifications",
  "Marketing",
];

export default function AutomationForm({
  mode,
  initial,
}: {
  mode: "create" | "edit";
  initial?: AutomationDetailDto;
}) {
  const t = useTranslations("automations");
  const router = useRouter();
  const { accessToken } = useAuth();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [templateId, setTemplateId] = useState<number | "">(
    initial?.templateId ?? ""
  );
  const [triggerType, setTriggerType] = useState<AutomationTriggerType>(
    initial?.trigger.type ?? "MemberJoined"
  );
  const [offsetDays, setOffsetDays] = useState<number | "">(
    initial?.trigger.offsetDays ?? ""
  );
  const [segmentType, setSegmentType] = useState<RecipientSegmentType>(
    initial?.segmentType ?? "AllActiveMembers"
  );
  const [segmentFilter, setSegmentFilter] = useState(
    initial?.segmentFilter ?? ""
  );
  const [consentFilter, setConsentFilter] = useState<ConsentType | "">(
    initial?.consentFilter ?? ""
  );

  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [segments, setSegments] = useState<SegmentOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [preview, setPreview] = useState<RecipientPreviewDto | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    emailTemplatesApi
      .getAllTemplates(accessToken)
      .then((list) =>
        setTemplates(list.map((x) => ({ id: x.id, name: x.name })))
      )
      .catch(() => setTemplates([]));

    const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";
    fetch(`${baseUrl}/api/v1/member-segments?pageSize=100`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) =>
        setSegments(
          (d.items ?? []).map((s: { id: string; name: string }) => ({
            id: s.id,
            name: s.name,
          }))
        )
      )
      .catch(() => setSegments([]));
  }, [accessToken]);

  function buildRequest(): AutomationWriteRequest {
    return {
      name: name.trim(),
      description: description.trim() || null,
      templateId:
        typeof templateId === "number" ? templateId : Number(templateId),
      triggerType,
      offsetDays: isTimeRelative(triggerType)
        ? offsetDays === ""
          ? null
          : Number(offsetDays)
        : null,
      segmentType,
      segmentFilter:
        segmentType === "MemberSegment" ? segmentFilter || null : null,
      consentFilter: consentFilter || null,
    };
  }

  function clientValidate(): string | null {
    if (!name.trim()) return t("validation.nameRequired");
    if (!templateId) return t("validation.templateRequired");
    if (
      isTimeRelative(triggerType) &&
      (offsetDays === "" || Number(offsetDays) < 0)
    )
      return t("validation.offsetRequired");
    if (segmentType === "MemberSegment" && !segmentFilter)
      return t("validation.segmentRequired");
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const clientError = clientValidate();
    if (clientError) {
      setFieldError(clientError);
      return;
    }
    setFieldError(null);
    if (!accessToken) return;
    setSubmitting(true);
    try {
      const body = buildRequest();
      const result =
        mode === "create"
          ? await createAutomation(accessToken, body)
          : await updateAutomation(accessToken, initial!.id, body);
      router.push(`/communication/automations/${result.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePreview() {
    if (!accessToken) return;
    setPreviewing(true);
    setError(null);
    try {
      const result = await previewRecipients(accessToken, {
        segmentType,
        segmentFilter:
          segmentType === "MemberSegment" ? segmentFilter || null : null,
        consentFilter: consentFilter || null,
      });
      setPreview(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("genericError"));
    } finally {
      setPreviewing(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors";

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-gray-900 md:text-3xl">
          {mode === "create" ? t("createTitle") : t("editTitle")}
        </h1>

        {error && (
          <div
            className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700"
            role="alert"
          >
            {error}
          </div>
        )}
        {fieldError && (
          <div
            className="mb-6 rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-800"
            role="alert"
          >
            {fieldError}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl bg-white p-6 shadow-sm"
        >
          <div>
            <label
              className="mb-1 block text-sm font-medium text-gray-700"
              htmlFor="name"
            >
              {t("form.name")}
            </label>
            <input
              id="name"
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
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
              value={description}
              onChange={(e) => setDescription(e.target.value)}
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
              value={templateId}
              onChange={(e) =>
                setTemplateId(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">{t("form.selectTemplate")}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
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
              value={triggerType}
              onChange={(e) =>
                setTriggerType(e.target.value as AutomationTriggerType)
              }
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
                value={offsetDays}
                onChange={(e) =>
                  setOffsetDays(e.target.value ? Number(e.target.value) : "")
                }
              />
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
              value={segmentType}
              onChange={(e) =>
                setSegmentType(e.target.value as RecipientSegmentType)
              }
            >
              {SEGMENT_TYPES.map((st) => (
                <option key={st} value={st}>
                  {t(`segment.${st}`)}
                </option>
              ))}
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
                value={segmentFilter}
                onChange={(e) => setSegmentFilter(e.target.value)}
              >
                <option value="">{t("form.selectSegment")}</option>
                {segments.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
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
              value={consentFilter}
              onChange={(e) =>
                setConsentFilter(e.target.value as ConsentType | "")
              }
            >
              <option value="">{t("form.noConsentFilter")}</option>
              {CONSENT_TYPES.map((c) => (
                <option key={c} value={c}>
                  {t(`consent.${c}`)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handlePreview}
              disabled={previewing}
              className="rounded-lg border border-orange-600 px-4 py-2 text-sm font-semibold text-orange-700 transition-colors hover:bg-orange-50 disabled:opacity-50"
            >
              {previewing ? t("previewing") : t("previewRecipients")}
            </button>
            {preview && (
              <span
                className="text-sm text-gray-600"
                data-testid="preview-count"
              >
                {t("previewCount", { count: preview.totalCount })}
              </span>
            )}
          </div>

          {preview && preview.preview.length > 0 && (
            <ul className="list-disc pl-5 text-sm text-gray-600">
              {preview.preview.map((p, i) => (
                <li key={i}>
                  {p.firstName} {p.lastName} ({p.email})
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center gap-3 border-t pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {submitting ? t("saving") : t("save")}
            </button>
            <button
              type="button"
              onClick={() => router.push("/communication/automations")}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
            >
              {t("cancel")}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
