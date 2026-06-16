"use client";

/**
 * Shared create/edit email-template form (E25-S4, DEC-2 = RHF+Zod form sub-recipe).
 * RELOCATED from `@/components/email-templates/EmailTemplateForm` and migrated from
 * manual `useState` to React Hook Form + Zod. Used by `email-template-new-content`
 * (create) and `email-template-edit-content` (edit).
 *
 * Behaviour-preserving (A79), pinned by the E25-S1 new/edit characterization nets:
 *   - the SAME props contract: `template?` / `onSave` / `isSaving`;
 *   - the SAME `onSave` payload shape (name / subject / category / description /
 *     htmlContent / textContent / variables) so the new/[id] pages' transport call
 *     args are byte-identical;
 *   - the SAME field markup/classes + the SAME default `htmlContent`
 *     (`<p>Hallo {{name}},</p>`) / `textContent` (`Hallo {{name}},`);
 *   - the variables-array sub-editor (add/remove + the name/description/
 *     defaultValue/isRequired inputs) kept as local `useState` (it was the god-page's
 *     separate `newVariable` + `formData.variables` state, NOT an RHF field);
 *   - the local submit-error banner.
 *
 * Deliberate changes (A79 deltas): the HTML5 `required` on name + subject becomes
 * Zod `.min(1, "form.required")` validation; the hard-coded German RichTextEditor
 * placeholder `"E-Mail-Inhalt eingeben..."` is i18n-ed to `t("editorPlaceholder")`.
 */

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import {
  emailTemplateFormSchema,
  type EmailTemplateFormValues,
} from "../schemas/email-template.schema";
import type {
  EmailTemplate,
  EmailTemplateVariable,
} from "../types/email-template.types";
import { EMAIL_TEMPLATE_CATEGORIES } from "../types/email-template.types";

/** The payload shape `onSave` receives — byte-identical to the god-page formData. */
interface EmailTemplateFormData {
  name: string;
  subject: string;
  category: string;
  description: string;
  htmlContent: string;
  textContent: string;
  variables: EmailTemplateVariable[];
}

interface EmailTemplateFormProps {
  template?: EmailTemplate;
  onSave: (data: EmailTemplateFormData) => Promise<void>;
  isSaving?: boolean;
}

export function EmailTemplateForm({
  template,
  onSave,
  isSaving = false,
}: EmailTemplateFormProps) {
  const t = useTranslations("emailTemplates.form");
  const tCommon = useTranslations("common");
  // Root translator for the Zod field-error keys (e.g. "form.required"), which are
  // namespaced from the root, NOT from `emailTemplates.form`.
  const tRoot = useTranslations();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<EmailTemplateFormValues>({
    resolver: zodResolver(emailTemplateFormSchema),
    defaultValues: {
      name: template?.name || "",
      subject: template?.subject || "",
      category: template?.category || "Custom",
      description: template?.description || "",
      htmlContent: template?.htmlContent || "<p>Hallo {{name}},</p>",
      textContent: template?.textContent || "Hallo {{name}},",
    },
  });

  // The RichTextEditor is not a native input, so it is driven via watch/setValue.
  const htmlContent = watch("htmlContent");

  // Variables sub-editor (god-page parity: separate state, folded into the payload).
  const [variables, setVariables] = useState<EmailTemplateVariable[]>(
    template?.variables || []
  );
  const [newVariable, setNewVariable] = useState({
    name: "",
    description: "",
    defaultValue: "",
    isRequired: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const addVariable = () => {
    if (!newVariable.name.trim()) {
      setError(t("variableNameRequired"));
      return;
    }
    setVariables((prev) => [...prev, newVariable]);
    setNewVariable({
      name: "",
      description: "",
      defaultValue: "",
      isRequired: false,
    });
  };

  const removeVariable = (index: number) => {
    setVariables((prev) => prev.filter((_, i) => i !== index));
  };

  const onSubmit = async (values: EmailTemplateFormValues) => {
    try {
      setSaving(true);
      setError(null);
      await onSave({ ...values, variables });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveError"));
    } finally {
      setSaving(false);
    }
  };

  const isFormSaving = saving || isSaving;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {t("name")} *
          </label>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            placeholder={t("namePlaceholder")}
            {...register("name")}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">
              {tRoot(errors.name.message ?? "form.required")}
            </p>
          )}
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">
            {t("category")} *
          </label>
          <select
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            {...register("category")}
          >
            {EMAIL_TEMPLATE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t("description")}
        </label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          rows={2}
          placeholder={t("descriptionPlaceholder")}
          {...register("description")}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t("subject")} *
        </label>
        <input
          type="text"
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          placeholder={t("subjectPlaceholder")}
          {...register("subject")}
        />
        {errors.subject && (
          <p className="mt-1 text-sm text-red-600">
            {tRoot(errors.subject.message ?? "form.required")}
          </p>
        )}
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t("htmlContent")} *
        </label>
        <RichTextEditor
          content={htmlContent}
          onChange={(content) => setValue("htmlContent", content)}
          placeholder={t("editorPlaceholder")}
          minHeight="250px"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          {t("textContent")}
        </label>
        <textarea
          className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          rows={6}
          {...register("textContent")}
        />
      </div>

      <div className="rounded-xl border border-gray-200 p-4">
        <h3 className="mb-4 font-semibold text-gray-900">{t("variables")}</h3>
        <div className="mb-4 space-y-2">
          {variables.map((variable, index) => (
            <div
              key={index}
              className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
            >
              <div>
                <p className="font-mono text-gray-900">{`{{${variable.name}}}`}</p>
                <p className="text-sm text-gray-600">{variable.description}</p>
              </div>
              <button
                type="button"
                onClick={() => removeVariable(index)}
                className="text-sm font-medium text-red-600 hover:text-red-800"
              >
                {t("remove")}
              </button>
            </div>
          ))}
        </div>

        <div className="space-y-3 rounded-lg bg-gray-50 p-4">
          <input
            type="text"
            value={newVariable.name}
            onChange={(e) =>
              setNewVariable({ ...newVariable, name: e.target.value })
            }
            placeholder={t("variableNamePlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          />
          <input
            type="text"
            value={newVariable.description}
            onChange={(e) =>
              setNewVariable({ ...newVariable, description: e.target.value })
            }
            placeholder={t("variableDescriptionPlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          />
          <input
            type="text"
            value={newVariable.defaultValue}
            onChange={(e) =>
              setNewVariable({ ...newVariable, defaultValue: e.target.value })
            }
            placeholder={t("variableDefaultPlaceholder")}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={newVariable.isRequired}
              onChange={(e) =>
                setNewVariable({ ...newVariable, isRequired: e.target.checked })
              }
              className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">{t("required")}</span>
          </label>
          <button
            type="button"
            onClick={addVariable}
            className="w-full rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-700"
          >
            {t("addVariable")}
          </button>
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <button
          type="submit"
          disabled={isFormSaving}
          className="rounded-lg bg-orange-600 px-6 py-2.5 font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isFormSaving ? tCommon("saving") : tCommon("save")}
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="rounded-lg bg-gray-100 px-6 py-2.5 font-medium text-gray-700 transition-colors hover:bg-gray-200"
        >
          {tCommon("cancel")}
        </button>
      </div>
    </form>
  );
}
