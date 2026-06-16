"use client";

/**
 * REQ-058 (E8-S1): External API credential management (admin). Feature-slice
 * composition root (E27-S5) rendered by the thin `app/admin/api-clients/page.tsx`
 * route entry; this is the single `"use client"` boundary for the surface.
 *
 * Behaviour preserved verbatim (pinned by the E27-S1 net):
 *   - admin auth guard: non-admins → `router.push("/")` (NOT /login); the body
 *     early-returns `null` for non-admins; the list fetch is gated on
 *     `isAuthenticated && isAdmin && accessToken` ONLY (NOT authLoading — A97/S1: the
 *     fetch fires even while auth is still loading);
 *   - the show-once secret panel (data-loss invariant): the create response `secret`
 *     is held in local `createdSecret` state, the ONLY source of the cleartext; the
 *     list refetch (invalidate-on-create) lands the new row but NEVER the secret;
 *   - revoke behind `window.confirm` (DEC-3 = A), red, only on a non-revoked row;
 *   - the error banner surfaces the read/mutation error.
 *
 * A79: the god-page's manual `useState` list + `refreshClients()` becomes TanStack
 * (`useApiClients`/`useScopes` reads; `useCreateApiClient`/`useRevokeApiClient`
 * mutations whose `onSuccess` invalidates the list — replacing the manual refetch).
 * A99: `useApiClient`'s status is discarded; errors branch on `error`/`!data` exactly
 * as the god-page did.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { Key, Plus, ArrowLeft } from "lucide-react";
import { useApiClients } from "../hooks/use-api-clients";
import { useScopes } from "../hooks/use-scopes";
import { useCreateApiClient } from "../hooks/use-create-api-client";
import { useRevokeApiClient } from "../hooks/use-revoke-api-client";
import { ApiClientsTable } from "./api-clients-table";
import { CreateApiClientDialog } from "./create-api-client-dialog";
import { ApiClientSecretPanel } from "./api-client-secret-panel";
import type {
  ApiClientCreatedDto,
  CreateApiClientRequest,
} from "../types/admin-integrations.types";

export function ApiClientsPageContent() {
  const t = useTranslations("admin.apiClients");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();

  const enabled = !!(isAuthenticated && isAdmin && accessToken);

  const clientsQuery = useApiClients(enabled);
  const scopesQuery = useScopes(enabled);
  const createMutation = useCreateApiClient();
  const revokeMutation = useRevokeApiClient();

  // Mutation error banner state (god-page parity). Set ONLY by a create/revoke
  // failure's `onError`, cleared when opening the dialog / before a new mutation.
  // The list READ error is DERIVED below (not synced via an effect — avoids
  // `react-hooks/set-state-in-effect`) and combined as `mutationError ?? readError`,
  // reproducing the god-page's single `error` surface.
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Create dialog open state + the show-once secret panel state (data-loss-locked).
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createdSecret, setCreatedSecret] =
    useState<ApiClientCreatedDto | null>(null);

  // Redirect non-admins (god-page parity — gated on !authLoading; the redirect
  // effect bounces, A97).
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const readError =
    clientsQuery.error instanceof Error && clientsQuery.error.message
      ? clientsQuery.error.message
      : null;
  const error = mutationError ?? readError;

  const clients = clientsQuery.data ?? [];
  const availableScopes = scopesQuery.data ?? [];

  const openCreateDialog = () => {
    setMutationError(null);
    setDialogOpen(true);
  };

  const handleCreate = (body: CreateApiClientRequest) => {
    setMutationError(null);
    createMutation.mutate(body, {
      onSuccess: (data) => {
        setDialogOpen(false);
        setCreatedSecret(data);
      },
      onError: (err) =>
        setMutationError(
          err instanceof Error && err.message ? err.message : t("createFailed")
        ),
    });
  };

  const handleRevoke = (id: string) => {
    if (!window.confirm(t("confirmRevoke"))) return;
    setMutationError(null);
    revokeMutation.mutate(id, {
      onError: (err) =>
        setMutationError(
          err instanceof Error && err.message ? err.message : null
        ),
    });
  };

  // The table-region loading state mirrors the god-page's `isLoading` (true until the
  // gated list load resolves; when gated off it stayed true). The early `authLoading`
  // screen is handled below.
  const tableLoading = enabled ? clientsQuery.isLoading : true;

  if (authLoading) {
    return <div className="p-8 text-gray-500">{tCommon("loading")}</div>;
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <Link
        href="/admin"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        <ArrowLeft className="h-4 w-4" /> {tCommon("back")}
      </Link>

      <div className="mb-2 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <Key className="h-6 w-6 text-orange-500" /> {t("title")}
        </h1>
        <button
          onClick={openCreateDialog}
          className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" /> {t("create")}
        </button>
      </div>
      <p className="mb-6 text-gray-500">{t("description")}</p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Show-once secret panel (AC-2/AC-5, behaviour-LOCKED) */}
      {createdSecret && (
        <ApiClientSecretPanel
          secret={createdSecret}
          onDismiss={() => setCreatedSecret(null)}
        />
      )}

      {tableLoading ? (
        <div className="text-gray-500">{tCommon("loading")}</div>
      ) : clients.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-gray-500">
          {t("noClients")}
        </div>
      ) : (
        <ApiClientsTable clients={clients} onRevoke={handleRevoke} />
      )}

      {dialogOpen && (
        <CreateApiClientDialog
          availableScopes={availableScopes}
          saving={createMutation.isPending}
          onCancel={() => setDialogOpen(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
