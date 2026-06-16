import { PaymentsPageContent } from "@/features/finance/components/payments/payments-page-content";

/**
 * Payments route (E26-S3). Thin server entry — the content composition root is the only
 * `"use client"` boundary (and self-embeds its `QueryClientProvider`).
 */
export default function PaymentsPage() {
  return <PaymentsPageContent />;
}
