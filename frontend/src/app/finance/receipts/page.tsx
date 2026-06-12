import { ReceiptsPageContent } from "@/features/finance/components/receipts/receipts-page-content";

/**
 * Receipts route (E26-S3). Thin server entry — the content composition root is the only
 * `"use client"` boundary (and self-embeds its `QueryClientProvider`).
 */
export default function ReceiptsPage() {
  return <ReceiptsPageContent />;
}
