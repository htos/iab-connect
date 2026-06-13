// Backup badge tokens (E27-S4, DEC-2 = A / A77). Consolidates the god-page's
// `getStatusColor` + `getTypeColor` (lib/api/backup) into feature-local helpers.
// Colour IS the meaning (status/type signal), so the literal Tailwind classes are
// kept VERBATIM (semantic-colour exception, like `member-status-badge.tsx`) — the
// E27-S1 backups net pins exact classes (`bg-green-100`, `bg-yellow-100`,
// `bg-red-100`, `bg-blue-100`) that the 4 generic `ui/badge` variants would not
// reproduce. `label` is the translated `statuses.*` / `types.*` text.

const BADGE_BASE = "inline-flex px-2 py-1 text-xs font-semibold rounded-full";

/** Status → colour, verbatim from `getStatusColor`. */
export function statusClass(status: string): string {
  switch (status) {
    case "Completed":
      return "bg-green-100 text-green-800";
    case "InProgress":
      return "bg-yellow-100 text-yellow-800";
    case "Failed":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

/** Type → colour, verbatim from `getTypeColor`. */
export function typeClass(type: string): string {
  switch (type) {
    case "Manual":
      return "bg-blue-100 text-blue-800";
    case "Scheduled":
      return "bg-purple-100 text-purple-800";
    case "Upload":
      return "bg-orange-100 text-orange-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function BackupStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  return (
    <span className={`${BADGE_BASE} ${statusClass(status)}`}>{label}</span>
  );
}

export function BackupTypeBadge({
  type,
  label,
}: {
  type: string;
  label: string;
}) {
  return <span className={`${BADGE_BASE} ${typeClass(type)}`}>{label}</span>;
}
