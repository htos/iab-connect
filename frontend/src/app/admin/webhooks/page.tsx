"use client";

/**
 * REQ-058 (E8-S3): Webhook subscription management (admin).
 * Create/edit/disable/enable/delete subscriptions; the signing secret is shown exactly once.
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";
import {
  Webhook,
  Plus,
  Trash2,
  Copy,
  ArrowLeft,
  AlertTriangle,
  Power,
  Pencil,
  ListChecks,
} from "lucide-react";
import {
  WEBHOOKS_BASE,
  WebhookSubscriptionDto,
  WebhookSubscriptionCreatedDto,
} from "@/lib/api/webhooks";

export default function WebhooksPage() {
  const t = useTranslations("admin.webhooks");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const {
    isAuthenticated,
    isLoading: authLoading,
    isAdmin,
    accessToken,
  } = useAuth();
  const api = useApiClient();

  const [subscriptions, setSubscriptions] = useState<WebhookSubscriptionDto[]>(
    []
  );
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state (shared for create + edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Show-once secret panel
  const [createdSecret, setCreatedSecret] =
    useState<WebhookSubscriptionCreatedDto | null>(null);
  const [copied, setCopied] = useState(false);

  const refreshList = useCallback(async () => {
    if (!accessToken) return;
    const res = await api.get<WebhookSubscriptionDto[]>(`${WEBHOOKS_BASE}/`);
    if (res.error) setError(res.error);
    else setSubscriptions(res.data ?? []);
  }, [accessToken, api]);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  useEffect(() => {
    if (!(isAuthenticated && isAdmin && accessToken)) return;
    let active = true;
    (async () => {
      const [listRes, typesRes] = await Promise.all([
        api.get<WebhookSubscriptionDto[]>(`${WEBHOOKS_BASE}/`),
        api.get<string[]>(`${WEBHOOKS_BASE}/event-types`),
      ]);
      if (!active) return;
      if (listRes.error) setError(listRes.error);
      else setSubscriptions(listRes.data ?? []);
      if (typesRes.data) setAvailableEventTypes(typesRes.data);
      setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [isAuthenticated, isAdmin, accessToken, api]);

  const toggleType = (type: string) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((s) => s !== type) : [...prev, type]
    );
  };

  const openCreate = () => {
    setEditingId(null);
    setName("");
    setTargetUrl("");
    setSelectedTypes([]);
    setError(null);
    setDialogOpen(true);
  };

  const openEdit = (sub: WebhookSubscriptionDto) => {
    setEditingId(sub.id);
    setName(sub.name);
    setTargetUrl(sub.targetUrl);
    setSelectedTypes(sub.eventTypes);
    setError(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const body = { name, targetUrl, eventTypes: selectedTypes };
    if (editingId) {
      const res = await api.put(`${WEBHOOKS_BASE}/${editingId}`, body);
      setSaving(false);
      if (res.error) {
        setError(res.error);
        return;
      }
      setDialogOpen(false);
    } else {
      const res = await api.post<WebhookSubscriptionCreatedDto>(
        `${WEBHOOKS_BASE}/`,
        body
      );
      setSaving(false);
      if (res.error || !res.data) {
        setError(res.error ?? t("saveFailed"));
        return;
      }
      setDialogOpen(false);
      setCreatedSecret(res.data);
      setCopied(false);
    }
    void refreshList();
  };

  const handleToggleStatus = async (sub: WebhookSubscriptionDto) => {
    const action = sub.status === "Active" ? "disable" : "enable";
    const res = await api.post(`${WEBHOOKS_BASE}/${sub.id}/${action}`, {});
    if (res.error) setError(res.error);
    else void refreshList();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("confirmDelete"))) return;
    const res = await api.delete(`${WEBHOOKS_BASE}/${id}`);
    if (res.error) setError(res.error);
    else void refreshList();
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
      ) : subscriptions.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-gray-500">
          {t("noWebhooks")}
        </div>
      ) : (
        <table className="w-full overflow-hidden rounded-md border text-sm">
          <thead className="bg-gray-50 text-left">
            <tr>
              <th className="px-4 py-2 font-medium">{t("name")}</th>
              <th className="px-4 py-2 font-medium">{t("targetUrl")}</th>
              <th className="px-4 py-2 font-medium">{t("events")}</th>
              <th className="px-4 py-2 font-medium">{t("status")}</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {subscriptions.map((s) => (
              <tr key={s.id} className="border-t">
                <td className="px-4 py-2">{s.name}</td>
                <td className="px-4 py-2 break-all text-gray-600">
                  {s.targetUrl}
                </td>
                <td className="px-4 py-2">
                  <div className="flex flex-wrap gap-1">
                    {s.eventTypes.map((e) => (
                      <span
                        key={e}
                        className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-2">
                  {s.status === "Active" ? (
                    <span className="text-green-600">{t("active")}</span>
                  ) : (
                    <span className="text-gray-500">{t("disabled")}</span>
                  )}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => openEdit(s)}
                      className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                      aria-label={t("edit")}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleToggleStatus(s)}
                      className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
                      aria-label={
                        s.status === "Active" ? t("disable") : t("enable")
                      }
                    >
                      <Power className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(s.id)}
                      className="inline-flex items-center gap-1 text-red-600 hover:text-red-800"
                      aria-label={t("delete")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
            <h2 className="mb-4 text-lg font-semibold">
              {editingId ? t("editDialogTitle") : t("createDialogTitle")}
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

            <label className="mb-1 block text-sm font-medium">
              {t("targetUrl")}
            </label>
            <input
              type="url"
              value={targetUrl}
              onChange={(e) => setTargetUrl(e.target.value)}
              className="mb-4 w-full rounded-md border px-3 py-2 text-sm"
              placeholder="https://"
            />

            <label className="mb-2 block text-sm font-medium">
              {t("events")}
            </label>
            <div className="mb-4 space-y-2">
              {availableEventTypes.map((type) => (
                <label key={type} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedTypes.includes(type)}
                    onChange={() => toggleType(type)}
                  />
                  <code>{type}</code>
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
                onClick={handleSave}
                disabled={
                  saving ||
                  !name.trim() ||
                  !targetUrl.trim() ||
                  selectedTypes.length === 0
                }
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
