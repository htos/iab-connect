// Thin route entry (E23-S2 feature-slice migration). All New-Member logic lives
// in the feature slice under `@/features/members`; this file stays a server
// entry and is NOT a client component.
import { MemberNewContent } from "@/features/members/components/member-new-content";

export default function NewMemberPage() {
  return <MemberNewContent />;
}
