import { InvoicesPageContent } from "@/features/finance/components/invoices/invoices-page-content";

/**
 * Finance Invoices List route (E26-S3). Thin server entry — the only `"use client"`
 * boundary is the content composition root (which self-embeds its `QueryClientProvider`).
 * REQ-040: Rechnungserstellung.
 */
export default function InvoicesPage() {
  return <InvoicesPageContent />;
}
