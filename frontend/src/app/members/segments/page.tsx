// Thin route entry (E23-S4 feature-slice migration). All Member-Segments list
// logic lives in the feature slice under `@/features/members`; this file stays a
// server entry and is NOT a client component.
import { SegmentsListContent } from "@/features/members/components/segments-list-content";

export default function MemberSegmentsPage() {
  return <SegmentsListContent />;
}
