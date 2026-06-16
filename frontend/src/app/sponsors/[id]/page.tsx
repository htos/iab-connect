// Thin route entry (E22-S3 feature-slice extraction). All Sponsor detail logic
// lives in the feature slice under `@/features/sponsors`; this file stays a
// server entry and is NOT a client component.
import { SponsorDetail } from "@/features/sponsors/components/sponsor-detail";

export default function SponsorDetailPage() {
  return <SponsorDetail />;
}
