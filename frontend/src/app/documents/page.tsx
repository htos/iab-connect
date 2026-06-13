// Thin route entry (E29-S2 feature-slice extraction). All member Documents
// browser logic lives in the feature slice under `@/features/documents`; this
// file stays a server entry and is NOT a client component.
import { DocumentsPageContent } from "@/features/documents/components/documents-page-content";

export default function DocumentsPage() {
  return <DocumentsPageContent />;
}
