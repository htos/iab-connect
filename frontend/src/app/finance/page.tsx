import { FinanceDashboardContent } from "@/features/finance/components/finance-dashboard-content";

/**
 * Finance Dashboard route (E26-S2). Thin server entry — the only logic lives in the
 * slice composition root `FinanceDashboardContent` (the single `"use client"`). REQ-038.
 */
export default function FinanceDashboardPage() {
  return <FinanceDashboardContent />;
}
