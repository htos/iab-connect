// Thin route entry (E30-S2 features/system slice). REQ-001: auth error handling.
// The error-code → {titleKey, descKey} mapping + body live in
// `@/features/system/components/auth-error-content`; this stays a server entry.
import { AuthErrorContent } from "@/features/system/components/auth-error-content";

export default function AuthErrorPage() {
  return <AuthErrorContent />;
}
