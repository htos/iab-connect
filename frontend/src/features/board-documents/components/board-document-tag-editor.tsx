"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  boardDocumentTagsSchema,
  type BoardDocumentTagsValues,
} from "../schemas/board-document.schema";

interface BoardDocumentTagEditorProps {
  tags: string[];
  // Save the parsed tag array (comma-split, trimmed, empties dropped). May
  // return a promise (the parent's `mutateAsync`) that REJECTS on failure so the
  // editor collapses to view mode only after a confirmed success (god-page
  // parity: `setEditingTags(false)` ran only inside `if (result.success)`).
  onSave: (tags: string[]) => void | Promise<unknown>;
}

/**
 * Tag editor for the document detail (E29-S3, DEC-2 = A — RHF+Zod). Markup
 * preserved from the god-page (`[id]/page.tsx:300-345`): an Edit/Cancel toggle;
 * in view mode a tag-pill list (or `documents.noTags`); in edit mode a single
 * free-text comma-separated input + Save.
 *
 * Behaviour-preserving (A79): the comma-list stays free text with NO validation
 * (the schema's `tagInput` is an unconstrained string) — `handleSaveTags`
 * split/trim/filter parity is reproduced here, so `onSave` receives the same
 * `tags` array the god-page sent to `updateDocumentTags`. The form rides the
 * shared RHF+Zod recipe purely for consistency with the epic goal.
 */
export function BoardDocumentTagEditor({
  tags,
  onSave,
}: BoardDocumentTagEditorProps) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);

  const { register, handleSubmit, reset } = useForm<BoardDocumentTagsValues>({
    resolver: zodResolver(boardDocumentTagsSchema),
    defaultValues: { tagInput: tags.join(", ") },
  });

  // Keep the input seeded from the latest tags whenever they change (the
  // god-page set `tagInput` from `result.data.tags.join(", ")` after each
  // refetch). Reset only while not actively editing to avoid clobbering input.
  useEffect(() => {
    if (!editing) reset({ tagInput: tags.join(", ") });
  }, [tags, editing, reset]);

  const submit = async (values: BoardDocumentTagsValues) => {
    const parsed = values.tagInput
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    try {
      // Collapse to view mode ONLY after the save resolves. On failure the
      // editor stays open with the user's text intact (the parent surfaces the
      // error) — god-page parity (`setEditingTags(false)` was success-gated).
      await onSave(parsed);
      setEditing(false);
    } catch {
      // Stay in edit mode; the parent's mutation onError surfaces the message.
    }
  };

  return (
    <div className="mb-6 rounded-lg bg-white p-6 shadow">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">
          {t("documents.tags")}
        </h2>
        <button
          onClick={() => setEditing(!editing)}
          className="text-sm text-orange-600 hover:underline"
        >
          {editing ? t("common.cancel") : t("common.edit")}
        </button>
      </div>
      {editing ? (
        <form onSubmit={handleSubmit(submit)} noValidate className="flex gap-2">
          <input
            type="text"
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
            placeholder={t("documents.tagsPlaceholder")}
            {...register("tagInput")}
          />
          <button
            type="submit"
            className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
          >
            {t("common.save")}
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.length > 0 ? (
            tags.map((tag) => (
              <span
                key={tag}
                className="inline-block rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
              >
                {tag}
              </span>
            ))
          ) : (
            <p className="text-sm text-gray-400">{t("documents.noTags")}</p>
          )}
        </div>
      )}
    </div>
  );
}
