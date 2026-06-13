import type { ReactNode } from "react";

/**
 * `PageShell` — the shared authenticated page-content frame primitive (E30-S1).
 *
 * It reproduces, byte-for-byte, the inner content frame that the migrated
 * authenticated pages hand-write: a `<main className="min-h-[calc(100vh-4rem)]
 * bg-gray-50 p-4 md:p-8">` wrapping a centered `max-w-*` container. The
 * `min-h-[calc(100vh-4rem)]` offsets the `h-16` chrome header that `MainLayout`
 * (mounted once in the root `app/layout.tsx`) already provides — so PageShell is
 * the INNER content frame only and imports NOTHING from `@/components/navigation`
 * (no sidebar/header/responsive chrome). Rendering `MainLayout` inside PageShell
 * would produce double chrome / nested sidebars; see the E30-S1 story.
 *
 * Presentational + prop-driven (no hooks/state) → no `"use client"`, so even a
 * Server Component page can adopt it without a client boundary. i18n is the
 * consumer's concern: `PageHeader` receives already-resolved strings, not keys.
 */

export type PageShellMaxWidth = "2xl" | "3xl" | "4xl" | "5xl" | "6xl" | "7xl";

export interface PageShellProps {
  children: ReactNode;
  /** Optional header slot rendered above `children` inside the max-width container. */
  header?: ReactNode;
  /** Max-width of the centered container. Defaults to the dominant `7xl`. */
  maxWidth?: PageShellMaxWidth;
}

// Static, full-class-string lookup. NEVER interpolate `max-w-${maxWidth}` — the
// Tailwind JIT cannot see an interpolated class, so the width constraint would
// silently vanish and the page would render full-bleed.
const MAX_WIDTH_CLASS: Record<PageShellMaxWidth, string> = {
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
  "7xl": "max-w-7xl",
};

export function PageShell({
  children,
  header,
  maxWidth = "7xl",
}: PageShellProps) {
  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className={`mx-auto ${MAX_WIDTH_CLASS[maxWidth]}`}>
        {header}
        {children}
      </div>
    </main>
  );
}
