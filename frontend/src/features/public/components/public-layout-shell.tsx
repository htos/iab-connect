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
 * E30-S1 RESOLUTION (was TODO(E30)): `PublicHeader`/`PublicFooter` intentionally
 * STAY in `@/components/navigation/` — they are public chrome (like `Header`/
 * `Sidebar`), and moving header logic out of `components/navigation` is a hard
 * constraint. The E30 `PageShell` primitive is the AUTHENTICATED inner content
 * frame (the `<main>` inside `MainLayout`); it does NOT apply to the public
 * surface, whose shell is this distinct `public-layout-shell.tsx`. No competing
 * shell is built here — this debt is closed, not deferred.
 *
 * Keeps the `"use client"` directive (DEC-2=A) — harmless here; the public shell
 * stays a client layout (no Server-Component conversion is pursued — out of the
 * E30 authenticated scope). A client layout legally renders the async `license`
 * Server Component via the `children` slot.
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
