// Thin route entry (E23-S2 feature-slice migration). All Edit-Member logic lives
// in the feature slice under `@/features/members`; this file stays a server
// entry and is NOT a client component.
import { MemberEditContent } from "@/features/members/components/member-edit-content";

export default function EditMemberPage() {
  return <MemberEditContent />;
}
