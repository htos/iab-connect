import { InvoiceNewContent } from "@/features/finance/components/invoices/invoice-new-content";

/**
 * New-invoice route (E26-S3). Thin server entry — the content composition root is the
 * only `"use client"` boundary (and self-embeds its `QueryClientProvider`).
 */
export default function NewInvoicePage() {
  return <InvoiceNewContent />;
}
