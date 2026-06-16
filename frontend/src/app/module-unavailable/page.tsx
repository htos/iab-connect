// Thin route entry (E30-S2 features/system slice). REQ-087 (E10-S4).
// The body (now on the shared PageShell, maxWidth="4xl") lives in
// `@/features/system/components/module-unavailable-content`; server entry.
import { ModuleUnavailableContent } from "@/features/system/components/module-unavailable-content";

export default function ModuleUnavailablePage() {
  return <ModuleUnavailableContent />;
}
