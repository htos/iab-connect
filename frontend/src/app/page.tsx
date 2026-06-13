// Thin route entry (E30-S4 features/dashboard slice migration). The 785-line root
// dashboard god-page now lives in `@/features/dashboard`; this stays a server entry
// rendering the single `"use client"` composition root (DashboardContent self-wraps
// its own QueryClientProvider). REQ-001 / REQ-007 / REQ-050 / REQ-087.
import { DashboardContent } from "@/features/dashboard/components/dashboard-content";

export default function HomePage() {
  return <DashboardContent />;
}
