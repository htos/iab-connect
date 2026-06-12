// Audit badge tokens (E27-S4, DEC-2 = A / A77). Consolidates the god-page's
// `getSeverityColor` + `getCategoryColor` (lib/api/audit) + the inline success/
// failure badge into feature-local helpers. Like `member-status-badge.tsx`, the
// colour IS the meaning (severity/category/success are a status signal), so the
// literal Tailwind utility classes are kept VERBATIM (a documented semantic-colour
// exception) rather than mapped onto the 4 generic `ui/badge` variants — which
// would mislabel (the A76 class) AND resolve to different tokens than the exact
// classes the E27-S1 audit net pins (`bg-red-100`, `bg-purple-100`, etc.).

const BADGE_BASE = "inline-flex px-2 py-1 text-xs font-medium rounded-full";

/** Severity → colour, verbatim from `getSeverityColor`. */
export function severityClass(severity: string): string {
  switch (severity.toLowerCase()) {
    case "critical":
      return "bg-red-100 text-red-800";
    case "warning":
      return "bg-yellow-100 text-yellow-800";
    case "info":
    default:
      return "bg-blue-100 text-blue-800";
  }
}

/** Category → colour, verbatim from `getCategoryColor`. */
export function categoryClass(category: string): string {
  switch (category.toLowerCase()) {
    case "authentication":
      return "bg-purple-100 text-purple-800";
    case "usermanagement":
      return "bg-green-100 text-green-800";
    case "membermanagement":
      return "bg-indigo-100 text-indigo-800";
    case "dataaccess":
      return "bg-cyan-100 text-cyan-800";
    case "system":
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function AuditSeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`${BADGE_BASE} ${severityClass(severity)}`}>
      {severity}
    </span>
  );
}

export function AuditCategoryBadge({ category }: { category: string }) {
  return (
    <span className={`${BADGE_BASE} ${categoryClass(category)}`}>
      {category}
    </span>
  );
}

/**
 * Success/failure badge (verbatim from the god-page's inline green/red badge).
 * `label` is the translated `status.success`/`status.failure`; `title` carries the
 * error message on a failure (the god-page set `title={event.errorMessage}`).
 */
export function AuditStatusBadge({
  success,
  label,
  title,
}: {
  success: boolean;
  label: string;
  title?: string;
}) {
  return success ? (
    <span className={`${BADGE_BASE} bg-green-100 text-green-800`}>{label}</span>
  ) : (
    <span
      className={`${BADGE_BASE} bg-red-100 text-red-800`}
      title={title || undefined}
    >
      {label}
    </span>
  );
}
