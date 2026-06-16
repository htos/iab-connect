// Retention badge tokens (E27-S4, DEC-2 = A / A77). Consolidates the god-page's
// `getActionColor` (lib/api/retention) into a feature-local helper. Colour IS the
// meaning (the action signal — Delete is red, Archive blue, Anonymize yellow), so
// the literal Tailwind classes are kept VERBATIM — the E27-S1 retention net pins
// the exact `bg-yellow-100` for Anonymize.

const BADGE_BASE = "inline-flex px-2 py-0.5 text-xs font-semibold rounded-full";

/** Action → colour, verbatim from `getActionColor`. */
export function actionClass(action: string): string {
  switch (action) {
    case "Anonymize":
      return "bg-yellow-100 text-yellow-800";
    case "Archive":
      return "bg-blue-100 text-blue-800";
    case "Delete":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

export function RetentionActionBadge({
  action,
  label,
}: {
  action: string;
  label: string;
}) {
  return (
    <span className={`${BADGE_BASE} ${actionClass(action)}`}>{label}</span>
  );
}
