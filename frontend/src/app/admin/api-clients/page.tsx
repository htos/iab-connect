"use client";

/**
 * REQ-058 (E8-S1): External API credential management (admin).
 * Create scoped credentials (secret shown exactly once), list, and revoke.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import {
  API_CLIENTS_BASE,
  ApiClientDto,
  ApiClientCreatedDto,
} from "@/lib/api/apiClients";

export default function ApiClientsPage() {
  const t = useTranslations("admin.apiClients");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();
  const api = useApiClient();

  const [clients, setClients] = useState<ApiClientDto[]>([]);
  const [availableScopes, setAvailableScopes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Create dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Show-once secret panel
  const [createdSecret, setCreatedSecret] =
    useState<ApiClientCreatedDto | null>(null);
  const [copied, setCopied] = useState(false);

  // Re-fetch the list after a create/revoke (called from event handlers, never an effect).
  const refreshClients = useCallback(async () => {
    if (!accessToken) return;
    const res = await api.get<ApiClientDto[]>(`${API_CLIENTS_BASE}/`);
    if (res.error) setError(res.error);
    else setClients(res.data ?? []);
  }, [accessToken, api]);

  // Redirect non-admins.
  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  // Initial load. All setState calls run inside the async IIFE AFTER the await, so the effect
  // body never sets state synchronously (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!(isAuthenticated && isAdmin && accessToken)) return;
    let active = true;
    (async () => {
      const [clientsRes, scopesRes] = await Promise.all([
        api.get<ApiClientDto[]>(`${API_CLIENTS_BASE}/`),
        api.get<string[]>(`${API_CLIENTS_BASE}/scopes`),
      ]);
      if (!active) return;
      if (clientsRes.error) setError(clientsRes.error);
      else setClients(clientsRes.data ?? []);
      if (scopesRes.data) setAvailableScopes(scopesRes.data);
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isAdmin, accessToken, api]);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  const openCreateDialog = () => {
    setName("");
    setSelectedScopes([]);
    setError(null);
    setDialogOpen(true);
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    const res = await api.post<ApiClientCreatedDto>(`${API_CLIENTS_BASE}/`, {
      name,
      scopes: selectedScopes,
    });
    setSaving(false);
    if (res.error || !res.data) {
      setError(res.error ?? t("createFailed"));
      return;
    }
    setDialogOpen(false);
    setCreatedSecret(res.data);
    setCopied(false);
    void refreshClients();
  };

  const handleRevoke = async (id: string) => {
    if (!window.confirm(t("confirmRevoke"))) return;
    const res = await api.post(`${API_CLIENTS_BASE}/${id}/revoke`, {});
    if (res.error) setError(res.error);
    else void refreshClients();
  };

  const copySecret = async () => {
    if (!createdSecret) return;
    await navigator.clipboard.writeText(createdSecret.secret);
    setCopied(true);
  };

  if (authLoading) {
    return <div className="p-8 text-gray-500">{tCommon("loading")}</div>;
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

      {/* Show-once secret panel (AC-2) */}
      {createdSecret && (
        <div className="mb-6 rounded-md border border-amber-300 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 font-medium text-amber-800">
            <AlertTriangle className="h-5 w-5" /> {t("secretOnceWarning")}
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded border border-amber-200 bg-white px-3 py-2 text-sm break-all">
              {createdSecret.secret}
            </code>
            <button
              onClick={copySecret}
              className="inline-flex items-center gap-1 rounded border border-amber-300 px-3 py-2 text-sm hover:bg-amber-100"
            >
              <Copy className="h-4 w-4" /> {copied ? t("copied") : t("copy")}
            </button>
          </div>
          <button
            onClick={() => setCreatedSecret(null)}
            className="mt-3 text-sm text-amber-700 underline"
          >
            {t("dismissSecret")}
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="text-gray-500">{tCommon("loading")}</div>
      ) : clients.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-gray-500">
          {t("noClients")}
        </div>
      ) : (
        <table className="w-full overflow-hidden rounded-md border text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">{t("name")}</th>
              <th className="px-4 py-2 font-medium">{t("scopes")}</th>
              <th className="px-4 py-2 font-medium">{t("status")}</th>
              <th className="px-4 py-2 font-medium">{t("lastUsed")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-4 py-2">{c.name}</td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {c.scopes.map((s) => (
                      <span
                        key={s}
                        className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {c.isRevoked ? (
                    <span className="text-red-600">{t("revoked")}</span>
                  ) : (
                    <span className="text-green-600">{t("active")}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-gray-500">
                  {c.lastUsedAt
                    ? new Date(c.lastUsedAt).toLocaleString()
                    : t("never")}
                </td>
                <td className="px-4 py-2 text-right">
                  {!c.isRevoked && (
                    <button
                      onClick={() => handleRevoke(c.id)}
                      className="inline-flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
                    >
                      <Trash2 className="h-4 w-4" /> {t("revoke")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Create dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {t("createDialogTitle")}
            </h2>

            <label className="mb-1 block text-sm font-medium">
              {t("name")}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mb-4 w-full rounded-md border px-3 py-2 text-sm"
              placeholder={t("namePlaceholder")}
            />

            <label className="mb-2 block text-sm font-medium">
              {t("scopes")}
            </label>
            <div className="mb-4 space-y-2">
              {availableScopes.map((scope) => (
                <label key={scope} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedScopes.includes(scope)}
                    onChange={() => toggleScope(scope)}
                  />
                  <code>{scope}</code>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDialogOpen(false)}
                className="rounded-md border px-4 py-2 text-sm"
              >
                {tCommon("cancel")}
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !name.trim() || selectedScopes.length === 0}
                className="rounded-md bg-orange-500 px-4 py-2 text-sm text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {saving ? tCommon("saving") : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
