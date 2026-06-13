import { ExpenseClaimsPageContent } from "@/features/finance/components/expense-claims/expense-claims-page-content";

/**
 * Expense-claims route (E26-S3). Thin server entry — the content composition root is the
 * only `"use client"` boundary (and self-embeds its `QueryClientProvider`).
 */
export default function ExpenseClaimsPage() {
  return <ExpenseClaimsPageContent />;
}
