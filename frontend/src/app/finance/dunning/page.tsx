import { DunningPageContent } from "@/features/finance/components/dunning/dunning-page-content";

/**
 * Dunning route (E26-S3). Thin server entry — the content composition root is the only
 * `"use client"` boundary (and self-embeds its `QueryClientProvider`).
 */
export default function DunningPage() {
  return <DunningPageContent />;
}
