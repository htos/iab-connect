// Thin route entry (E23-S4 feature-slice migration). All Segment-detail logic
// lives in the feature slice under `@/features/members`; this file stays a server
// entry and is NOT a client component.
import { SegmentDetailContent } from "@/features/members/components/segment-detail-content";

export default function SegmentDetailPage() {
  return <SegmentDetailContent />;
}
