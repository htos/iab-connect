// Thin route entry (E30-S2 features/system slice). REQ-087 (E10-S5).
// The standalone neutral page + branding fetch live in
// `@/features/system/components/site-unavailable-content`; server entry.
import { SiteUnavailableContent } from "@/features/system/components/site-unavailable-content";

export default function SiteUnavailablePage() {
  return <SiteUnavailableContent />;
}
