// Thin route entry (E27-S3 feature-slice migration). All admin-dashboard logic lives
// in the feature slice under `@/features/admin-settings`; this file stays a server
// entry and is NOT a client component.
import { AdminDashboardContent } from "@/features/admin-settings/components/admin-dashboard-content";

export default function AdminPage() {
  return <AdminDashboardContent />;
}
