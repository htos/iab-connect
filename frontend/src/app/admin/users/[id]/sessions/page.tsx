// Thin route entry (E27-S2 feature-slice migration). All Admin User Sessions
// logic (REQ-010) lives in the feature slice under `@/features/admin-users`. The
// `params` Promise is unwrapped here with React `use()` (kept so the E27-S1
// sessions net — which renders this entry with a resolved `params` prop + a
// mocked `react.use` — stays green) and the id is threaded into the client
// composition root.
import { use } from "react";
import { UserSessions } from "@/features/admin-users/components/user-sessions";

export default function AdminUserSessionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <UserSessions userId={id} />;
}
