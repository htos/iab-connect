// Thin route entry (E22-S4 feature-slice extraction — completes the E21 pilot).
// All edit-supplier form logic lives in the feature slice under
// `@/features/suppliers`; this file stays a server entry and is NOT a client
// component.
import { SupplierEditContent } from "@/features/suppliers/components/supplier-edit-content";

export default function EditSupplierPage() {
  return <SupplierEditContent />;
}
