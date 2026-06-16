/**
 * Board Document detail route entry (E29-S3).
 *
 * Thin entry: the god-page was extracted into the board-documents feature slice
 * (`src/features/board-documents/components/board-document-detail.tsx`), the
 * single `"use client"` composition root. This entry keeps the
 * `params: Promise<{ id: string }>` route contract, resolves the id, and
 * forwards it to the slice.
 */
import { use } from "react";
import { BoardDocumentDetail } from "@/features/board-documents/components/board-document-detail";

interface BoardDocumentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default function BoardDocumentDetailPage({
  params,
}: BoardDocumentDetailPageProps) {
  const { id } = use(params);
  return <BoardDocumentDetail id={id} />;
}
