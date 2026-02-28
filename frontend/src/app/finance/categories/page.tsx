"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAuth, useApiClient } from "@/lib/auth";

interface Category {
  id: string;
  name: string;
  type: "Income" | "Expense";
  color: string;
  isActive: boolean;
}

interface CategoryForm {
  name: string;
  type: "Income" | "Expense";
  color: string;
  isActive: boolean;
}

const emptyForm: CategoryForm = {
  name: "",
  type: "Income",
  color: "#f97316",
  isActive: true,
};

export default function CategoriesPage() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();
  const api = useApiClient();

  const apiRef = useRef(api);
  apiRef.current = api;
  const tRef = useRef(t);
  tRef.current = t;

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await apiRef.current.get("/api/v1/finance/categories");
      if (res.error) throw new Error(res.error);
      const body = res.data as { items: Category[] };
      setCategories(body.items ?? []);
    } catch {
      setError(tRef.current("loadError"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
      return;
    }
    fetchCategories();
  }, [canReadFinance, router, fetchCategories]);

  const openCreate = () => {
    setEditingCategory(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (category: Category) => {
    setEditingCategory(category);
    setForm({
      name: category.name,
      type: category.type,
      color: category.color,
      isActive: category.isActive,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingCategory(null);
    setForm(emptyForm);
  };

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      if (editingCategory) {
        await apiRef.current.put(
          `/api/v1/finance/categories/${editingCategory.id}`,
          form
        );
      } else {
        await apiRef.current.post("/api/v1/finance/categories", form);
      }
      closeModal();
      await fetchCategories();
    } catch {
      setError(tRef.current("saveError"));
    } finally {
      setSaving(false);
    }
  }, [editingCategory, form, fetchCategories]);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    try {
      setDeleting(true);
      setError(null);
      await apiRef.current.delete(
        `/api/v1/finance/categories/${deleteConfirmId}`
      );
      setDeleteConfirmId(null);
      await fetchCategories();
    } catch {
      setError(tRef.current("deleteError"));
    } finally {
      setDeleting(false);
    }
  }, [deleteConfirmId, fetchCategories]);

  const typeBadge = (type: Category["type"]) => {
    const colors: Record<Category["type"], string> = {
      Income: "bg-green-100 text-green-800",
      Expense: "bg-red-100 text-red-800",
    };
    const labels: Record<Category["type"], string> = {
      Income: t("income"),
      Expense: t("expense"),
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[type]}`}
      >
        {labels[type]}
      </span>
    );
  };

  if (!canReadFinance) return null;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back to Settings */}
        <Link href="/finance/settings" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {t("backToSettings")}
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("categories")}
          </h1>
          {canWriteFinance && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700"
            >
              {t("newCategory")}
            </button>
          )}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Empty State */}
        {!loading && categories.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
            {t("noCategories")}
          </div>
        )}

        {/* Table */}
        {!loading && categories.length > 0 && (
          <div className="overflow-x-auto rounded-xl bg-white p-6 shadow-sm">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-200 text-sm text-gray-500">
                  <th className="pb-3 font-medium">{t("categoryName")}</th>
                  <th className="pb-3 font-medium">{t("categoryType")}</th>
                  <th className="pb-3 font-medium">{t("color")}</th>
                  <th className="pb-3 font-medium">{t("active")}</th>
                  {canWriteFinance && (
                    <th className="pb-3 text-right font-medium">
                      {t("actions")}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map((category) => (
                  <tr key={category.id} className="text-sm">
                    <td className="py-3 font-medium text-gray-900">
                      {category.name}
                    </td>
                    <td className="py-3">{typeBadge(category.type)}</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-5 w-5 rounded-full border border-gray-200"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-mono text-xs text-gray-600">
                          {category.color}
                        </span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          category.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {category.isActive ? t("active") : t("inactive")}
                      </span>
                    </td>
                    {canWriteFinance && (
                      <td className="space-x-2 py-3 text-right">
                        <button
                          onClick={() => openEdit(category)}
                          className="text-sm font-medium text-orange-600 hover:text-orange-700"
                        >
                          {t("editCategory")}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(category.id)}
                          className="text-sm font-medium text-red-600 hover:text-red-700"
                        >
                          {t("delete")}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create/Edit Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900">
                {editingCategory ? t("editCategory") : t("newCategory")}
              </h2>

              <div className="space-y-3">
                {/* Name */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("categoryName")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("categoryType")} *
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        type: e.target.value as Category["type"],
                      })
                    }
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="Income">{t("income")}</option>
                    <option value="Expense">{t("expense")}</option>
                  </select>
                </div>

                {/* Color */}
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("color")}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={form.color}
                      onChange={(e) =>
                        setForm({ ...form, color: e.target.value })
                      }
                      className="h-10 w-10 cursor-pointer rounded border border-gray-300"
                    />
                    <input
                      type="text"
                      value={form.color}
                      onChange={(e) =>
                        setForm({ ...form, color: e.target.value })
                      }
                      className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* IsActive */}
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={form.isActive}
                    onChange={(e) =>
                      setForm({ ...form, isActive: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                  <label
                    htmlFor="isActive"
                    className="text-sm font-medium text-gray-700"
                  >
                    {t("active")}
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={closeModal}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.name}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {saving ? "..." : t("save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation */}
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-lg">
              <h2 className="text-lg font-bold text-gray-900">{t("delete")}</h2>
              <p className="text-sm text-gray-600">{t("confirmDelete")}</p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200"
                >
                  {t("cancel")}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  {deleting ? "..." : t("delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
