// Thin route entry (E23-S4 feature-slice migration). All New-Segment logic lives
// in the feature slice under `@/features/members`; this file stays a server entry
// and is NOT a client component.
import { SegmentNewContent } from "@/features/members/components/segment-new-content";

export default function NewSegmentPage() {
  return <SegmentNewContent />;
}
