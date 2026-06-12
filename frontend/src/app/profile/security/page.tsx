// Thin route entry (E29-S4 feature-slice extraction). All profile-security
// (sessions + revoke) logic lives in the profile slice under `@/features/profile`;
// this file stays a server entry and is NOT a client component.
import { ProfileSecurityContent } from "@/features/profile/components/profile-security-content";

export default function ProfileSecurityPage() {
  return <ProfileSecurityContent />;
}
