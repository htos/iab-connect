"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  MEMBER_PERMISSION_OPTIONS,
  VORSTAND_PERMISSION_OPTIONS,
} from "../schemas/folder-permissions.schema";
import type {
  DocumentFolderDto,
  PermissionEntry,
} from "../types/admin-documents.types";

interface FolderPermissionsDialogProps {
  folder: DocumentFolderDto;
  onSave: (permissions: PermissionEntry[]) => void;
  onCancel: () => void;
}

const selectClass = "w-full rounded-lg border border-gray-300 px-3 py-2";

// Per-option label key for the in-set permission types. Falls back to the raw
// stored value for an out-of-set value (A95) so the extra <option> still shows
// something meaningful.
const PERMISSION_LABEL_KEY: Record<string, string> = {
  Read: "documents.readOnly",
  Write: "documents.readWrite",
  Manage: "documents.manage",
};

/**
 * Set-permissions modal (E27-S6). Two role `<select>`s (Member: ""/Read/Write;
 * Vorstand: ""/Read/Write/Manage), pre-selected from the folder's existing
 * permissions, saving only the NON-empty entries (god-page parity, E27-S1 net).
 *
 * A95 (out-of-set round-trip): the stored `permissionType` is whatever the
 * backend returned. If it is NOT one of the role's rendered options we render an
 * EXTRA `<option>` for it (using its raw value as both value + label fallback) so
 * the `<select>` can display + preserve it instead of silently coercing to the
 * first option. The kept value submits verbatim.
 */
export function FolderPermissionsDialog({
  folder,
  onSave,
  onCancel,
}: FolderPermissionsDialogProps) {
  const t = useTranslations();

  const initialMember =
    folder.permissions.find((p) => p.role === "Member")?.permissionType ?? "";
  const initialVorstand =
    folder.permissions.find((p) => p.role === "Vorstand")?.permissionType ?? "";

  const [permMember, setPermMember] = useState(initialMember);
  const [permVorstand, setPermVorstand] = useState(initialVorstand);

  // Build each role's option list, appending an out-of-set stored value (A95).
  const memberOptions = withStoredValue(
    MEMBER_PERMISSION_OPTIONS,
    initialMember
  );
  const vorstandOptions = withStoredValue(
    VORSTAND_PERMISSION_OPTIONS,
    initialVorstand
  );

  const handleSave = () => {
    const permissions: PermissionEntry[] = [];
    if (permMember)
      permissions.push({ role: "Member", permissionType: permMember });
    if (permVorstand)
      permissions.push({ role: "Vorstand", permissionType: permVorstand });
    onSave(permissions);
  };

  const optionLabel = (value: string) =>
    PERMISSION_LABEL_KEY[value] ? t(PERMISSION_LABEL_KEY[value]) : value;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold">
          {t("documents.permissions")}: {folder.name}
        </h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("documents.memberAccess")}
            </label>
            <select
              value={permMember}
              onChange={(e) => setPermMember(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("documents.noAccess")}</option>
              {memberOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {optionLabel(opt)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("documents.vorstandAccess")}
            </label>
            <select
              value={permVorstand}
              onChange={(e) => setPermVorstand(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("documents.noAccess")}</option>
              {vorstandOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {optionLabel(opt)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-gray-400">
            {t("documents.adminAlwaysHasAccess")}
          </p>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

// Append `stored` to `base` when it is a non-empty value not already present
// (A95). Returns string[] so an out-of-set value (not in the enum) is allowed.
function withStoredValue(base: readonly string[], stored: string): string[] {
  if (stored && !base.includes(stored)) {
    return [...base, stored];
  }
  return [...base];
}
