/**
 * Custom-role linked-role + active-state badges (E27-S3, DEC-3 / A77).
 *
 * Like `member-status-badge`, the colour here IS the meaning (the linked privilege
 * tier / the active flag) — a documented semantic-colour exception to the shared
 * `ui/badge` variants, so literal Tailwind utility classes are used and pinned by the
 * E27-S1 net (Admin=red, Member=green) + this slice test.
 *
 * DEC-3 fix: the god-page mapped `Vorstand` to `bg-blue-100 text-blue-800`, violating
 * the "no blue in authenticated UI" rule (project-context A77). It is remapped to the
 * app's amber accent (`bg-amber-100 text-amber-800`) — the S1 net only pins Admin +
 * Member, so this is a free, deliberate fix. An out-of-set stored `linkedRole` (A95)
 * degrades to the neutral gray fallback rather than throwing.
 */
const LINKED_ROLE_CLASS: Record<string, string> = {
  Admin: "bg-red-100 text-red-800",
  Vorstand: "bg-amber-100 text-amber-800",
  Member: "bg-green-100 text-green-800",
};

export function linkedRoleBadgeClass(role: string): string {
  return LINKED_ROLE_CLASS[role] ?? "bg-gray-100 text-gray-600";
}

export function LinkedRoleBadge({ role }: { role: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${linkedRoleBadgeClass(role)}`}
    >
      {role}
    </span>
  );
}

export function ActiveBadge({
  isActive,
  activeLabel,
  inactiveLabel,
}: {
  isActive: boolean;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
        isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
      }`}
    >
      {isActive ? activeLabel : inactiveLabel}
    </span>
  );
}
