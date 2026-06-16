// Health badge tokens (E27-S4, DEC-2 = A / A77). Consolidates the god-page's
// `getStatusColor` (lib/api/health) AND the inline overall-status DOT ternary into
// feature-local helpers. Colour IS the meaning (a traffic-light health signal), so
// the literal Tailwind classes are kept VERBATIM — the E27-S1 health net pins exact
// classes (`text-green-700 bg-green-100`, `text-yellow-700 bg-yellow-100`) and the
// dot colours (`bg-green-500`/`bg-yellow-500`/`bg-red-500`).

/** Status badge colour, verbatim from `getStatusColor`. */
export function healthStatusClass(status: string): string {
  switch (status) {
    case "Healthy":
      return "text-green-700 bg-green-100";
    case "Degraded":
      return "text-yellow-700 bg-yellow-100";
    case "Unhealthy":
      return "text-red-700 bg-red-100";
    default:
      return "text-gray-700 bg-gray-100";
  }
}

/** The overall-status inline dot colour, verbatim from the god-page ternary. */
export function healthDotClass(status: string): string {
  switch (status) {
    case "Healthy":
      return "bg-green-500";
    case "Degraded":
      return "bg-yellow-500";
    default:
      return "bg-red-500";
  }
}

export function HealthStatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  return (
    <span className={`${className} ${healthStatusClass(status)}`}>
      {status}
    </span>
  );
}
