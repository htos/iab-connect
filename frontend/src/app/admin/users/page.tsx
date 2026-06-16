// Thin route entry (E27-S2 feature-slice migration). All admin users LIST logic
// lives in the feature slice under `@/features/admin-users`; this file stays a
// server entry and is NOT a client component (the composition root carries the
// single `"use client"` boundary).
import { AdminUsersPageContent } from "@/features/admin-users/components/admin-users-page-content";

export default function UsersPage() {
  return <AdminUsersPageContent />;
}
