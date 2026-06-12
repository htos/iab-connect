"use client";

import { PublicLayoutShell } from "@/features/public/components/public-layout-shell";

/**
 * E28-S4: thin wrapper that delegates the public chrome shell to the slice-owned
 * `PublicLayoutShell`. The header/footer/`children`-slot structure (and the
 * `pt-16` header offset) is preserved exactly; no route-group move, no provider
 * added/removed. See `public-layout-shell.tsx` for the E30 `PageShell` deferral.
 */
export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicLayoutShell>{children}</PublicLayoutShell>;
}
