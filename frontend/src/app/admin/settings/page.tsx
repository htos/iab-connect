// Thin route entry (E27-S3 feature-slice migration). All admin-settings logic lives in
// the feature slice under `@/features/admin-settings`; this file stays a server entry
// and is NOT a client component. The composition root (which embeds the feature-local
// QueryClientProvider + the 3-tab shell) is `AdminSettingsPageContent`.
import { AdminSettingsPageContent } from "@/features/admin-settings/components/admin-settings-page-content";

export default function SettingsPage() {
  return <AdminSettingsPageContent />;
}
