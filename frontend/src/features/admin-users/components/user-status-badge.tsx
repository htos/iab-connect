import { useTranslations } from "next-intl";

/**
 * Admin-users status badge (E27-S2, A77 literal-class exception).
 *
 * Status colour IS meaning (enabled=green, disabled=red), so — like the
 * member/sponsor status badges — it uses literal Tailwind utility classes copied
 * VERBATIM from the god-page status cell rather than a generic `ui/badge`
 * variant. The E27-S1 list net pins these exact classes + the translated
 * `active`/`inactive` label (the `users` namespace keys) + the `emailVerified ✓`
 * marker (green check, `title="emailVerified"`), so the structure is reproduced
 * exactly. Renders the optional verified check inline after the pill, matching
 * the original cell layout.
 */
export function userStatusClass(enabled: boolean): string {
  return enabled ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
}

export function UserStatusBadge({
  enabled,
  emailVerified,
}: {
  enabled: boolean;
  emailVerified: boolean;
}) {
  const t = useTranslations("users");
  return (
    <>
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${userStatusClass(
          enabled
        )}`}
      >
        {enabled ? t("active") : t("inactive")}
      </span>
      {emailVerified && (
        <span className="ml-2 text-green-500" title={t("emailVerified")}>
          ✓
        </span>
      )}
    </>
  );
}
