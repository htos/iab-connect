// Thin route entry (E29-S4 feature-slice extraction). All self-service profile
// logic lives in the profile slice under `@/features/profile`; this file stays a
// server entry and is NOT a client component.
import { ProfilePageContent } from "@/features/profile/components/profile-page-content";

export default function ProfilePage() {
  return <ProfilePageContent />;
}
