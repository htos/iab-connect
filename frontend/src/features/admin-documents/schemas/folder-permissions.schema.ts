import { z } from "zod";

/**
 * Folder-permissions form schema (E27-S6). The two role `<select>`s
 * (Member / Vorstand) each hold a permission value or "" (no access). The
 * god-page widens silently: a folder's stored `permissionType` is whatever the
 * backend returned and is set verbatim into the select's value (A95). We keep
 * the value a free string at the schema level (no enum constraint) so an
 * out-of-set stored value round-trips unchanged; the DIALOG renders an extra
 * `<option>` for any stored value not already in the rendered option set so the
 * browser can display + preserve it. The empty string means "no access" and is
 * dropped from the submitted `permissions[]` (god-page parity).
 */
export const folderPermissionsFormSchema = z.object({
  member: z.string(),
  vorstand: z.string(),
});

export type FolderPermissionsFormValues = z.infer<
  typeof folderPermissionsFormSchema
>;

// NOTE: the rendered option sets are plain string LITERALS (not
// `DocumentPermissionType` enum member references). The `documents`
// module is mocked at the boundary by the E27-S1 net WITHOUT its enum exports, so
// referencing the enum as a runtime VALUE here would throw under the net. The
// values are byte-identical to `DocumentPermissionType.Read/Write/Manage`.

/** The Member role's rendered options (god-page: ""/Read/Write — no Manage). */
export const MEMBER_PERMISSION_OPTIONS: string[] = ["Read", "Write"];

/** The Vorstand role's rendered options (god-page: ""/Read/Write/Manage). */
export const VORSTAND_PERMISSION_OPTIONS: string[] = [
  "Read",
  "Write",
  "Manage",
];
