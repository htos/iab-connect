// Thin route entry (E27-S6 feature-slice migration). The PUBLIC self-signup form
// lives in the feature slice under `@/features/admin-documents`; this file stays
// a server entry and is NOT a client component. NO auth guard — the documented
// public exception (A56 / DEC-2=A).
import { RegisterPageContent } from "@/features/admin-documents/components/register-page-content";

export default function RegisterPage() {
  return <RegisterPageContent />;
}
