import type { ReactNode } from "react";

/**
 * `PageHeader` — the canonical page title/description/actions header block (E30-S1).
 *
 * Reproduces verbatim the header markup repeated across the migrated pages: a
 * flex row holding an `h1` title, an optional description `p`, and an optional
 * actions slot opposite the title (a Create `<Link>`, buttons, …). Designed to
 * sit as the first child of `PageShell` (or any `max-w-*` container).
 *
 * Presentational: the consumer passes already-resolved strings — `PageHeader`
 * does NOT call `useTranslations`, keeping the primitive pure + server-renderable.
 */

export interface PageHeaderProps {
  /** Already-resolved title string (the consumer owns i18n). */
  title: string;
  /** Optional already-resolved description rendered below the title. */
  description?: string;
  /** Optional actions slot rendered opposite the title (a Link, buttons, …). */
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
          {title}
        </h1>
        {description && <p className="mt-1 text-gray-600">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
