// Thin route entry (E23-S4 feature-slice migration). All Edit-Segment logic lives
// in the feature slice under `@/features/members`; this file stays a server entry
// and is NOT a client component.
import { SegmentEditContent } from "@/features/members/components/segment-edit-content";

export default function EditSegmentPage() {
  return <SegmentEditContent />;
}
