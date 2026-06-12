"use client";

import PublicHeader from "@/components/navigation/PublicHeader";
import PublicFooter from "@/components/navigation/PublicFooter";

/**
 * E28-S4: slice-owned composition of the public chrome shell, consolidating the
 * structure previously inline in `app/public/layout.tsx`. The header/footer are
 * REFERENCED (not duplicated) from `@/components/navigation/*` — `features → lib`
 * /`components` imports are boundary-legal (E21-S5). The `pt-16` on `<main>`
 * offsets the `fixed h-16` PublicHeader; preserve it.
 *
 * TODO(E30): extract `PublicHeader`/`PublicFooter` into a slice-owned `PageShell`
 * and reference the E30 `PageShell` once it exists — do NOT build a competing
 * shell here (no `PageShell` primitive exists today). DEC-3=A residual debt.
 *
 * Keeps the `"use client"` directive (DEC-2=A) — harmless here, and converting the
 * shell to a Server Component is E30's call once `PageShell` lands. A client layout
 * legally renders the async `license` Server Component via the `children` slot.
 */
export function PublicLayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex-1 pt-16">{children}</main>
      <PublicFooter />
    </div>
  );
}
