"use client";

/**
 * Shared create/edit webhook dialog (E27-S5, DEC-2 = RHF+Zod form sub-recipe). Used
 * by `webhooks-page-content` for BOTH create and edit.
 *
 * Behaviour-preserving (A79), pinned by the E27-S1 net:
 *   - A98 mode-divergent surfaces: the dialog TITLE differs (`createDialogTitle` vs
 *     `editDialogTitle`); the submit LABEL is the SAME (`t("save")`). Both threaded
 *     through the `mode` prop.
 *   - the name input (`placeholder={t("namePlaceholder")}`) + the targetUrl input
 *     (`type="url"`, literal `placeholder="https://"`) pre-fill from `defaultValues`
 *     on edit (god-page seeded the dialog from the row);
 *   - the event-type CHECKBOXES are rendered ONLY for `availableEventTypes` (a stored
 *     legacy type NOT in that set never appears as a checkbox), but the underlying
 *     `eventTypes` form value is SEEDED from the stored selection and round-trips
 *     verbatim on a no-touch save (A95);
 *   - Save stays disabled unless `name.trim()` AND `targetUrl.trim()` AND
 *     `eventTypes.length >= 1` (validation parity, computed live via `watch`);
 *   - on submit, the body is `{ name, targetUrl, eventTypes }` byte-identical to the
 *     god-page. A96: the Zod schema validates non-empty WITHOUT trimming, and applies
 *     NO url-format check (the god-page only checked non-empty). `noValidate` keeps
 *     the native browser validation from masking the parity.
 */

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  webhookFormSchema,
  type WebhookFormValues,
} from "../schemas/webhook.schema";

interface WebhookDialogProps {
  mode: "create" | "edit";
  defaultValues: WebhookFormValues;
  availableEventTypes: string[];
  saving: boolean;
  onCancel: () => void;
  onSave: (body: WebhookFormValues) => void;
}

export function WebhookDialog({
  mode,
  defaultValues,
  availableEventTypes,
  saving,
  onCancel,
  onSave,
}: WebhookDialogProps) {
  const t = useTranslations("admin.webhooks");
  const tCommon = useTranslations("common");

  const { register, handleSubmit, watch, setValue } =
    useForm<WebhookFormValues>({
      resolver: zodResolver(webhookFormSchema),
      defaultValues,
    });

  // watch() drives the live save-disabled gate + the checkbox checked state. React
  // Compiler skipping memoization here is harmless (the dialog re-renders anyway).
  // eslint-disable-next-line react-hooks/incompatible-library
  const name = watch("name");
  const targetUrl = watch("targetUrl");
  const selectedTypes = watch("eventTypes");

  const toggleType = (type: string) => {
    const next = selectedTypes.includes(type)
      ? selectedTypes.filter((s) => s !== type)
      : [...selectedTypes, type];
    setValue("eventTypes", next, { shouldValidate: false });
  };

  const saveDisabled =
    saving || !name.trim() || !targetUrl.trim() || selectedTypes.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">
          {mode === "edit" ? t("editDialogTitle") : t("createDialogTitle")}
        </h2>

        <form onSubmit={handleSubmit((values) => onSave(values))} noValidate>
          <label className="mb-1 block text-sm font-medium">{t("name")}</label>
          <input
            type="text"
            className="mb-4 w-full rounded-md border px-3 py-2 text-sm"
            placeholder={t("namePlaceholder")}
            {...register("name")}
          />

          <label className="mb-1 block text-sm font-medium">
            {t("targetUrl")}
          </label>
          <input
            type="url"
            className="mb-4 w-full rounded-md border px-3 py-2 text-sm"
            placeholder="https://"
            {...register("targetUrl")}
          />

          <label className="mb-2 block text-sm font-medium">
            {t("events")}
          </label>
          <div className="mb-4 space-y-2">
            {availableEventTypes.map((type) => (
              <label key={type} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onChange={() => toggleType(type)}
                />
                <code>{type}</code>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md border px-4 py-2 text-sm"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="submit"
              disabled={saveDisabled}
              className="rounded-md bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50"
            >
              {saving ? tCommon("saving") : t("save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
