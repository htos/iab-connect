// Thin route entry (E22-S2 feature-slice extraction). All Sponsors list logic
// lives in the feature slice under `@/features/sponsors`; this file stays a
// server entry and is NOT a client component.
import { SponsorsPageContent } from "@/features/sponsors/components/sponsors-page-content";

export default function SponsorsPage() {
  return <SponsorsPageContent />;
}
