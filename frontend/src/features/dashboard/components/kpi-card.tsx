// Dashboard KPI card (E30-S4) — relocated verbatim from the god-page `app/page.tsx`
// module-scope `KpiCard`. Presentational; the caller passes already-formatted values
// (finance values are pre-formatted via formatCHF).

export function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color?: "green" | "red" | "yellow" | "blue" | "gray";
}) {
  const colorClasses: Record<string, string> = {
    green: "text-green-700",
    red: "text-red-600",
    yellow: "text-yellow-700",
    blue: "text-blue-700",
    gray: "text-gray-500",
  };

  return (
    <div className="rounded-xl bg-white p-4 shadow-sm">
      <p className="mb-1 text-xs text-gray-500">{label}</p>
      <p
        className={`text-lg font-semibold tabular-nums ${color ? colorClasses[color] : "text-gray-900"}`}
      >
        {value}
      </p>
    </div>
  );
}
