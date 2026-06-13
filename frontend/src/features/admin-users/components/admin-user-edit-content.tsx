"use client";

/**
 * Edit User composition root (E27-S2) — the only `"use client"` boundary for
 * `/admin/users/[id]`; the route file is a thin server entry that unwraps the
 * `params` Promise and passes the id down.
 *
 * Behaviour preserved VERBATIM (pinned by the E27-S1 edit net):
 *  - Admin guard → router.push("/") (NOT /login); load gated on
 *    `isAuthenticated && isAdmin && accessToken`; explicit non-admin `return null`
 *    after the loading gate (A90/A97).
 *  - On mount: load the user (`useUser`, retry:false / DEC-3) + the available
 *    roles. The `!user` NOT-FOUND terminal block renders when the load rejects
 *    (the user stays null) — the god-page's distinct not-found view.
 *  - On submit: the TWO-STEP save (A79) — `updateUser`, then conditionally
 *    `updateUserRoles` (Set-diff), then a `getUser` refresh — all inside
 *    `useUpdateUser`. Success shows the banner and re-seeds the form; NO redirect
 *    (A98 banner surface). A failure surfaces in the dismissible banner.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useUser } from "../hooks/use-user";
import { useAvailableRoles } from "../hooks/use-available-roles";
import { useUpdateUser } from "../hooks/use-update-user";
import { AdminUserForm } from "./admin-user-form";
import type { EditUserFormValues } from "../schemas/admin-user.schema";
import type { User } from "../types/admin-user.types";

function toFormValues(user: User): EditUserFormValues {
  return {
    email: user.email || "",
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    enabled: user.enabled,
    emailVerified: user.emailVerified,
    roles: user.roles,
  };
}

export function AdminUserEditContent({ userId }: { userId: string }) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const enabled = Boolean(isAuthenticated && isAdmin && accessToken);
  const {
    data: user,
    isLoading: userLoading,
    error: userError,
  } = useUser(userId, enabled);
  const { data: availableRoles, isLoading: rolesLoading } =
    useAvailableRoles(enabled);
  const updateMutation = useUpdateUser(userId);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // The mutation returns the refreshed user; track it so the form re-seeds after
  // a successful save (god-page re-seeded formData from the refreshed getUser).
  const currentUser = updateMutation.data ?? user ?? null;

  const handleSubmit = (values: EditUserFormValues) => {
    if (!currentUser) return;
    setError(null);
    setSuccessMessage(null);
    updateMutation.mutate(
      {
        details: {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          enabled: values.enabled,
          emailVerified: values.emailVerified,
        },
        currentRoles: currentUser.roles,
        nextRoles: values.roles,
      },
      {
        onSuccess: () => setSuccessMessage(t("userUpdated")),
        onError: (err) =>
          setError(
            err instanceof Error ? err.message : "Failed to update user"
          ),
      }
    );
  };

  if (authLoading || (enabled && (userLoading || rolesLoading))) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  // NOT-FOUND terminal: the load settled and the user stayed null (getUser
  // rejected). Distinct from the inline submit-error banner (god-page parity).
  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {t("userNotFound")}
          </h2>
          <Link
            href="/admin/users"
            className="mt-4 block text-orange-600 hover:underline"
          >
            {t("backToUsers")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <PageShell maxWidth="3xl">
      <Link
        href="/admin/users"
        className="mb-6 flex items-center gap-1 text-orange-600 hover:underline"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        {t("backToUsers")}
      </Link>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {t("editUser")}
          </h1>
          <p className="mt-1 text-gray-600">{currentUser.email}</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 font-bold text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-green-200 bg-green-50 p-4 text-green-700">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage(null)}
            className="ml-4 font-bold text-green-500 hover:text-green-700"
          >
            ×
          </button>
        </div>
      )}

      <AdminUserForm
        // Re-seed the form when the (refreshed) user changes — RHF defaults
        // apply on mount only, so re-key to remount with the new server state.
        key={updateMutation.data ? "saved" : "initial"}
        mode="edit"
        defaultValues={toFormValues(currentUser)}
        availableRoles={availableRoles ?? []}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/admin/users")}
        submitLabel={tCommon("save")}
        pending={updateMutation.isPending}
        userId={currentUser.id}
        createdAt={currentUser.createdAt}
      />
    </PageShell>
  );
}
