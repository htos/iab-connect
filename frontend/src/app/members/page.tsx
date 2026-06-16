// Thin route entry (E23-S2 feature-slice migration). All Members list logic lives
// in the feature slice under `@/features/members`; this file stays a server entry
// and is NOT a client component.
import { MembersPageContent } from "@/features/members/components/members-page-content";

export default function MembersPage() {
  return <MembersPageContent />;
}
