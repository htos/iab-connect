// Thin route entry (E21-S3 feature-slice pilot). All Suppliers list logic lives
// in the feature slice under `@/features/suppliers`; this file stays a server
// entry and is NOT a client component.
import { SuppliersPageContent } from "@/features/suppliers/components/suppliers-page-content";

export default function SuppliersPage() {
  return <SuppliersPageContent />;
}
