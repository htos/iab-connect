// Thin route entry (E22-S3 feature-slice extraction). All new-sponsor form logic
// lives in the feature slice under `@/features/sponsors`; this file stays a
// server entry and is NOT a client component.
import { SponsorNewContent } from "@/features/sponsors/components/sponsor-new-content";

export default function NewSponsorPage() {
  return <SponsorNewContent />;
}
