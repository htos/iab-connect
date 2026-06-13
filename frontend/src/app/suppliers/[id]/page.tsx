// Thin route entry (E22-S4 feature-slice extraction — completes the E21 pilot).
// All Supplier detail logic lives in the feature slice under `@/features/suppliers`;
// this file stays a server entry and is NOT a client component.
import { SupplierDetail } from "@/features/suppliers/components/supplier-detail";

export default function SupplierDetailPage() {
  return <SupplierDetail />;
}
