import { getRoleDisplayName } from "../api/users-admin";

/**
 * Admin-users role badge (E27-S2, A77 literal-class exception).
 *
 * Role colour IS meaning here (admin=red, vorstand=amber, member=green) — like
 * the member/sponsor status badges, NOT a generic `ui/badge` semantic variant.
 * Classes are de-scattered into one place. DEC-3 / A77: the god-page mapped
 * `vorstand` to `bg-blue-100 text-blue-800`, violating the "no blue in
 * authenticated UI" rule; it is remapped to the app's amber accent
 * (`bg-amber-100 text-amber-800`) to match the sibling `custom-role-badge`
 * (E27-S3) — the E27-S1 list net asserts the role via its translated LABEL, not a
 * colour class, so this is a free, deliberate, epic-consistent fix. admin (red),
 * member (green), and the gray fallback are unchanged.
 *
 * Coverage of all 5 roles is INTENTIONAL: admin/vorstand/member are coloured;
 * `kassier` and `auditor` are not (the god-page `getRoleColor` only mapped
 * admin/vorstand/member), so they fall through to the gray default. The label
 * uses the real `getRoleDisplayName` (admin → Administrator, vorstand →
 * Vorstand, member → Mitglied; others → the raw role) — kept as the pure lib fn
 * the S1 net leaves un-mocked.
 */
const ROLE_CLASS: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  vorstand: "bg-amber-100 text-amber-800",
  member: "bg-green-100 text-green-800",
  // kassier / auditor: intentionally unmapped → gray fallback below.
};

export function userRoleClass(role: string): string {
  return ROLE_CLASS[role.toLowerCase()] ?? "bg-gray-100 text-gray-800";
}

export function UserRoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${userRoleClass(
        role
      )}`}
    >
      {getRoleDisplayName(role)}
    </span>
  );
}
