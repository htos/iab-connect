import { InvoiceDetailContent } from "@/features/finance/components/invoices/invoice-detail-content";

/**
 * Invoice detail route (E26-S3). Thin server entry — the content composition root is the
 * only `"use client"` boundary (and self-embeds its `QueryClientProvider`). The content
 * reads the id via `useParams<{id}>()` (the S1 suite mocks useParams → {id}).
 */
export default function InvoiceDetailPage() {
  return <InvoiceDetailContent />;
}
