// Thin route entry (E27-S2 feature-slice migration). All New-User logic lives in
// the feature slice under `@/features/admin-users`; this file stays a server
// entry and is NOT a client component.
import { AdminUserNewContent } from "@/features/admin-users/components/admin-user-new-content";

export default function CreateUserPage() {
  return <AdminUserNewContent />;
}
