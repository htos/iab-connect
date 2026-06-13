"use client";

/**
 * REQ-058 (E8-S3): Webhook subscription management (admin). Feature-slice composition
 * root (E27-S5) rendered by the thin `app/admin/webhooks/page.tsx` route entry; the
 * single `"use client"` boundary for the surface.
 *
 * Behaviour preserved verbatim (pinned by the E27-S1 net):
 *   - admin auth guard: non-admins → `router.push("/")`; body early-returns `null`;
 *     the list fetch is gated on `isAuthenticated && isAdmin && accessToken` ONLY;
 *   - create/edit via the SHARED RHF+Zod dialog (A98 mode-divergent title, same submit
 *     label); the show-once signing-secret panel shown ONLY on create (PUT never sets
 *     a secret; NO regenerate action);
 *   - enable/disable toggle (POST `/{enable|disable}`, NO confirm); delete behind
 *     `window.confirm` (DEC-3 = A), red; both surface the error AND issue NO refetch
 *     on failure (the failure branch never invalidates — pinned by S1);
 *   - A95: a no-touch edit round-trips the stored `eventTypes` verbatim.
 *
 * A79: manual `useState` list + `refreshList()` → TanStack reads + invalidate-on-success
 * mutations. A99: `useApiClient` status discarded; errors branch on `error` exactly.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { Webhook, Plus, ArrowLeft, ListChecks } from "lucide-react";
import { useWebhooks } from "../hooks/use-webhooks";
import { useEventTypes } from "../hooks/use-event-types";
import { useCreateWebhook } from "../hooks/use-create-webhook";
import { useUpdateWebhook } from "../hooks/use-update-webhook";
import { useToggleWebhook } from "../hooks/use-toggle-webhook";
import { useDeleteWebhook } from "../hooks/use-delete-webhook";
import { WebhooksTable } from "./webhooks-table";
import { WebhookDialog } from "./webhook-dialog";
import { WebhookSecretPanel } from "./webhook-secret-panel";
import type { WebhookFormValues } from "../schemas/webhook.schema";
import type {
  WebhookSubscriptionDto,
  WebhookSubscriptionCreatedDto,
} from "../types/admin-integrations.types";

const EMPTY_FORM: WebhookFormValues = {
  name: "",
  targetUrl: "",
  eventTypes: [],
};

export function WebhooksPageContent() {
  const t = useTranslations("admin.webhooks");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();

  const enabled = !!(isAuthenticated && isAdmin && accessToken);

  const webhooksQuery = useWebhooks(enabled);
  const eventTypesQuery = useEventTypes(enabled);
  const createMutation = useCreateWebhook();
  const updateMutation = useUpdateWebhook();
  const toggleMutation = useToggleWebhook();
  const deleteMutation = useDeleteWebhook();

  // Mutation error banner state (god-page parity). Set ONLY by a save/toggle/delete
  // failure's `onError`; the list READ error is DERIVED below and combined as
  // `mutationError ?? readError` (avoids `react-hooks/set-state-in-effect`).
  const [mutationError, setMutationError] = useState<string | null>(null);

  // Dialog state (shared create + edit). `editingId === null` → create mode; the
  // dialog is keyed on the editing id so it re-seeds defaultValues per open.
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogDefaults, setDialogDefaults] =
    useState<WebhookFormValues>(EMPTY_FORM);

  // Show-once signing-secret panel state (create-only, data-loss-locked).
  const [createdSecret, setCreatedSecret] =
    useState<WebhookSubscriptionCreatedDto | null>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const readError =
    webhooksQuery.error instanceof Error && webhooksQuery.error.message
      ? webhooksQuery.error.message
      : null;
  const error = mutationError ?? readError;

  const subscriptions = webhooksQuery.data ?? [];
  const availableEventTypes = eventTypesQuery.data ?? [];

  const openCreate = () => {
    setEditingId(null);
    setDialogDefaults(EMPTY_FORM);
    setMutationError(null);
    setDialogOpen(true);
  };

  const openEdit = (sub: WebhookSubscriptionDto) => {
    setEditingId(sub.id);
    // A95: seed `eventTypes` from the STORED selection verbatim (even legacy types
    // not in availableEventTypes) so a no-touch save round-trips them.
    setDialogDefaults({
      name: sub.name,
      targetUrl: sub.targetUrl,
      eventTypes: sub.eventTypes,
    });
    setMutationError(null);
    setDialogOpen(true);
  };

  const handleSave = (values: WebhookFormValues) => {
    setMutationError(null);
    const body = {
      name: values.name,
      targetUrl: values.targetUrl,
      eventTypes: values.eventTypes,
    };
    if (editingId) {
      updateMutation.mutate(
        { id: editingId, body },
        {
          onSuccess: () => setDialogOpen(false),
          onError: (err) =>
            setMutationError(
              err instanceof Error && err.message ? err.message : null
            ),
        }
      );
    } else {
      createMutation.mutate(body, {
        onSuccess: (data) => {
          setDialogOpen(false);
          setCreatedSecret(data);
        },
        onError: (err) =>
          setMutationError(
            err instanceof Error && err.message ? err.message : t("saveFailed")
          ),
      });
    }
  };

  const handleToggle = (sub: WebhookSubscriptionDto) => {
    const action = sub.status === "Active" ? "disable" : "enable";
    setMutationError(null);
    toggleMutation.mutate(
      { id: sub.id, action },
      {
        onError: (err) =>
          setMutationError(
            err instanceof Error && err.message ? err.message : null
          ),
      }
    );
  };

  const handleDelete = (id: string) => {
    if (!window.confirm(t("confirmDelete"))) return;
    setMutationError(null);
    deleteMutation.mutate(id, {
      onError: (err) =>
        setMutationError(
          err instanceof Error && err.message ? err.message : null
        ),
    });
  };

  const tableLoading = enabled ? webhooksQuery.isLoading : true;
  const saving = editingId
    ? updateMutation.isPending
    : createMutation.isPending;

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
          <Webhook className="h-6 w-6 text-orange-500" /> {t("title")}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/webhooks/deliveries"
            className="inline-flex items-center gap-1 rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ListChecks className="h-4 w-4" /> {t("deliveriesLink")}
          </Link>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-md bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            <Plus className="h-4 w-4" /> {t("create")}
          </button>
        </div>
      </div>
      <p className="mb-6 text-gray-500">{t("description")}</p>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {createdSecret && (
        <WebhookSecretPanel
          secret={createdSecret}
          onDismiss={() => setCreatedSecret(null)}
        />
      )}

      {tableLoading ? (
        <div className="text-gray-500">{tCommon("loading")}</div>
      ) : subscriptions.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-gray-500">
          {t("noWebhooks")}
        </div>
      ) : (
        <WebhooksTable
          subscriptions={subscriptions}
          onEdit={openEdit}
          onToggle={handleToggle}
          onDelete={handleDelete}
        />
      )}

      {dialogOpen && (
        <WebhookDialog
          key={editingId ?? "create"}
          mode={editingId ? "edit" : "create"}
          defaultValues={dialogDefaults}
          availableEventTypes={availableEventTypes}
          saving={saving}
          onCancel={() => setDialogOpen(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
