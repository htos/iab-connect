/**
 * Board Documents list route entry (E29-S3).
 *
 * Thin entry: the god-page was extracted into the board-documents feature slice
 * (`src/features/board-documents/components/board-documents-page-content.tsx`),
 * which is the single `"use client"` composition root.
 */
import { BoardDocumentsPageContent } from "@/features/board-documents/components/board-documents-page-content";

export default function BoardDocumentsPage() {
  return <BoardDocumentsPageContent />;
}
