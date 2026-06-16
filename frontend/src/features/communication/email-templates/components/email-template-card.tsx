"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { EmailTemplateCategoryBadge } from "./email-template-category-badge";
import type { EmailTemplate } from "../types/email-template.types";

/**
 * A single email-template card (E25-S4). Markup preserved verbatim from the god-page
 * card-grid item: name + description, the category Badge + the inactive Badge (only
 * when `!isActive`), the Edit link to `/communication/email-templates/{id}` (numeric
 * id), and the destructive-RED Delete `<button>` (A76 — `text-red-600` kept on the
 * button so the S1 affordance assertion stays green). Delete delegates to the page
 * content's confirm→delete→refetch flow.
 */
export function EmailTemplateCard({
  template,
  onDelete,
}: {
  template: EmailTemplate;
  onDelete: (id: number) => void;
}) {
  const t = useTranslations("emailTemplates");
  const tCommon = useTranslations("common");

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">
            {template.name}
          </h3>
          <p className="mt-1 text-sm text-gray-600">{template.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {/* Category badge = `outline` (light, god-page `bg-gray-100`); inactive
                marker = filled `secondary` so the two stay visually DISTINCT
                (god-page's darker `bg-gray-500 text-white`). A77: token variants. */}
            <EmailTemplateCategoryBadge category={template.category} />
            {!template.isActive && (
              <Badge variant="secondary">{t("inactive")}</Badge>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <Link
            href={`/communication/email-templates/${template.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-orange-600 transition-colors hover:bg-orange-50 hover:text-orange-700"
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
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            {tCommon("edit")}
          </Link>
          <button
            onClick={() => onDelete(template.id)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700"
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
            {tCommon("delete")}
          </button>
        </div>
      </div>
    </div>
  );
}
