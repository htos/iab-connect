// Thin route entry (E22-S4 feature-slice extraction — completes the E21 pilot).
// All new-supplier form logic lives in the feature slice under
// `@/features/suppliers`; this file stays a server entry and is NOT a client
// component.
import { SupplierNewContent } from "@/features/suppliers/components/supplier-new-content";

export default function NewSupplierPage() {
  return <SupplierNewContent />;
}
