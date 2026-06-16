// Thin route entry (E23-S3 feature-slice migration). All duplicate-groups review
// logic lives in the feature slice under `@/features/members`; this file stays a
// server entry and is NOT a client component.
import { DuplicatesPageContent } from "@/features/members/components/duplicates-page-content";

export default function DuplicatesPage() {
  return <DuplicatesPageContent />;
}
