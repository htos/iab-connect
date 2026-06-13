// Thin route entry (E30-S2 features/system slice). REQ-001: Login & Zugriff.
// The login body (NextAuth signIn flow, error handling, disabled-account modal)
// lives in `@/features/system/components/login-content`; this stays a server entry.
import { LoginContent } from "@/features/system/components/login-content";

export default function LoginPage() {
  return <LoginContent />;
}
