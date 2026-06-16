"use client";

/**
 * Create New User composition root (E27-S2) — the only `"use client"` boundary
 * for `/admin/users/new`; the route file is a thin server entry.
 *
 * Behaviour preserved VERBATIM (pinned by the E27-S1 create net):
 *  - Admin guard → router.push("/") (NOT /login); roles load gated on
 *    `isAuthenticated && isAdmin && accessToken`; explicit non-admin `return null`
 *    after the loading gate (A90/A97).
 *  - The shared RHF+Zod `AdminUserForm` in CREATE mode (A98): the `emailRequired`
 *    / `passwordOrInvitationRequired` guards now render as per-field Zod errors
 *    (A96/A79) — submit is blocked + `createUser` is not called, same observable
 *    outcome as the god-page banner.
 *  - On success: createUser → redirect to `/admin/users/{newId}` (A98 redirect
 *    surface). On a 409: the verbatim "A user with this email already exists"
 *    message in the dismissible banner; no redirect.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useAvailableRoles } from "../hooks/use-available-roles";
import { useCreateUser } from "../hooks/use-create-user";
import { AdminUserForm } from "./admin-user-form";
import type { CreateUserFormValues } from "../schemas/admin-user.schema";
import type { CreateUserRequest } from "../types/admin-user.types";

const EMPTY_VALUES: CreateUserFormValues = {
  email: "",
  firstName: "",
  lastName: "",
  enabled: true,
  sendInvitation: true,
  temporaryPassword: "",
  roles: ["member"],
};

export function AdminUserNewContent() {
  const t = useTranslations("users");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();

  const [error, setError] = useState<string | null>(null);

  const enabled = Boolean(isAuthenticated && isAdmin && accessToken);
  const {
    data: availableRoles,
    isLoading: rolesLoading,
    error: rolesError,
  } = useAvailableRoles(enabled);
  const createMutation = useCreateUser();

  // The banner shows a submit error first, else a roles-load error (god-page
  // parity). Derived during render — no setState-in-effect needed.
  const errorMessage =
    error ??
    (rolesError
      ? rolesError instanceof Error
        ? rolesError.message
        : "Failed to load roles"
      : null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const handleSubmit = (values: CreateUserFormValues) => {
    setError(null);
    const request: CreateUserRequest = {
      email: values.email,
      firstName: values.firstName || undefined,
      lastName: values.lastName || undefined,
      enabled: values.enabled,
      sendInvitation: values.sendInvitation,
      temporaryPassword: values.temporaryPassword || undefined,
      roles: values.roles.length > 0 ? values.roles : undefined,
    };
    createMutation.mutate(request, {
      onSuccess: (newUser) => router.push(`/admin/users/${newUser.id}`),
      onError: (err) =>
        setError(err instanceof Error ? err.message : "Failed to create user"),
    });
  };

  // Gated path quirk (A79, pinned by S1): until the guard passes the roles query
  // is disabled so `rolesLoading` is false but the form never mounts — render
  // the spinner while auth resolves, the form once roles arrive.
  if (authLoading || (enabled && rolesLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
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
            {t("createUser")}
          </h1>
          <p className="mt-1 text-gray-600">{t("createUserDescription")}</p>
        </div>
      </div>

      {errorMessage && (
        <div className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <span>{errorMessage}</span>
          <button
            onClick={() => setError(null)}
            className="ml-4 font-bold text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      <AdminUserForm
        mode="create"
        defaultValues={EMPTY_VALUES}
        availableRoles={availableRoles ?? []}
        onSubmit={handleSubmit}
        onCancel={() => router.push("/admin/users")}
        submitLabel={t("createUser")}
        pending={createMutation.isPending}
      />
    </PageShell>
  );
}
