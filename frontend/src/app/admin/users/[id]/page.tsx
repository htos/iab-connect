// Thin route entry (E27-S2 feature-slice migration). All Edit-User logic lives
// in the feature slice under `@/features/admin-users`. The `params` Promise is
// unwrapped here with React `use()` (kept so the E27-S1 [id]-page net — which
// renders this entry with a resolved `params` prop + a mocked `react.use` — stays
// green) and the id is threaded into the client composition root.
import { use } from "react";
import { AdminUserEditContent } from "@/features/admin-users/components/admin-user-edit-content";

export default function UserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <AdminUserEditContent userId={id} />;
}
