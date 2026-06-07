// Thin route entry (E22-S3 feature-slice extraction). All edit-sponsor form logic
// lives in the feature slice under `@/features/sponsors`; this file stays a
// server entry and is NOT a client component.
import { SponsorEditContent } from "@/features/sponsors/components/sponsor-edit-content";

export default function EditSponsorPage() {
  return <SponsorEditContent />;
}
