// Thin route entry (E27-S6 feature-slice migration). The admin documents
// folder/permission manager (REQ-035) lives in the feature slice under
// `@/features/admin-documents`; this file stays a server entry and is NOT a
// client component.
import { AdminFoldersPageContent } from "@/features/admin-documents/components/admin-folders-page-content";

export default function AdminDocumentsPage() {
  return <AdminFoldersPageContent />;
}
