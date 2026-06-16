"use client";

/**
 * Finance Categories content (E26-S4 migration of `app/finance/categories/page.tsx`).
 * Composition root — self-embeds its own `QueryClientProvider`.
 *
 * OUTLIER guard (pinned AS-IS): reads `canReadFinance`/`canWriteFinance` ONLY (NO isLoading
 * wait). The effect `if (!canReadFinance) { router.replace("/"); return; }` AND render
 * `if (!canReadFinance) return null`. The premature-redirect-on-cold-session quirk is
 * preserved (a transiently-false canReadFinance fires replace("/") immediately). Delete is a
 * centred MODAL (NOT inline two-step). Errors use i18n KEYS (loadError/saveError/deleteError).
 * A92: modal close from the mutation OUTCOME. Every i18n key + URL byte-identical.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  useFinanceCategories,
  useSaveCategory,
  useDeleteCategory,
} from "../../hooks/use-finance-categories";
import { CategoryForm } from "./category-form";
import type { CategoryFormSchemaValues } from "../../schemas/category.schema";
import type { FinanceCategory } from "../../types/budgeting.types";

const emptyForm: CategoryFormSchemaValues = {
  name: "",
  type: "Income",
  color: "#f97316",
  isActive: true,
};

function CategoriesBody() {
  const t = useTranslations("finance");
  const router = useRouter();
  const { canReadFinance, canWriteFinance } = useAuth();

  const categoriesQuery = useFinanceCategories(canReadFinance);
  const categories = categoriesQuery.data ?? [];
  const loading = canReadFinance && categoriesQuery.isLoading;
  const saveCategory = useSaveCategory();
  const deleteCategory = useDeleteCategory();

  const [searchTerm, setSearchTerm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] =
    useState<FinanceCategory | null>(null);
  const [formDefaults, setFormDefaults] =
    useState<CategoryFormSchemaValues>(emptyForm);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const loadError = categoriesQuery.isError ? t("loadError") : null;
  const banner = error ?? loadError;

  // OUTLIER guard: premature redirect on a read-denied (or cold) session, pinned AS-IS.
  useEffect(() => {
    if (!canReadFinance) {
      router.replace("/");
    }
  }, [canReadFinance, router]);

  const openCreate = () => {
    setEditingCategory(null);
    setFormDefaults(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (category: FinanceCategory) => {
    setEditingCategory(category);
    setFormDefaults({
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
    setFormDefaults(emptyForm);
  };

  const handleSubmit = (values: CategoryFormSchemaValues) => {
    setError(null);
    saveCategory.mutate(
      { editingId: editingCategory?.id ?? null, form: values },
      {
        onSuccess: () => closeModal(),
        onError: () => setError(t("saveError")),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteConfirmId) return;
    setError(null);
    deleteCategory.mutate(deleteConfirmId, {
      onSuccess: () => setDeleteConfirmId(null),
      onError: () => setError(t("deleteError")),
    });
  };

  const filteredCategories = categories.filter((cat) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const typeLabel = cat.type === "Income" ? t("income") : t("expense");
    return (
      cat.name.toLowerCase().includes(term) ||
      typeLabel.toLowerCase().includes(term) ||
      cat.type.toLowerCase().includes(term)
    );
  });

  const typeBadge = (type: FinanceCategory["type"]) => {
    const colors: Record<FinanceCategory["type"], string> = {
      Income: "bg-green-100 text-green-800",
      Expense: "bg-red-100 text-red-800",
    };
    const labels: Record<FinanceCategory["type"], string> = {
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

  const deleting = deleteCategory.isPending;

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Back to Settings */}
        <Link
          href="/finance/settings"
          className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
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
          {t("backToSettings")}
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("categories")}
          </h1>
          {/* A79 data-mechanism timing accommodation: the New button gates on `!loading`
              so the TanStack list query has settled by the time it renders (one extra
              observer-notification hop vs the god-page's single-await effect). The
              header <h1> stays always-visible; observable output is otherwise identical. */}
          {canWriteFinance && !loading && (
            <button
              onClick={openCreate}
              className="rounded-lg bg-orange-600 px-4 py-2 font-medium text-white transition-colors hover:bg-orange-700"
            >
              {t("newCategory")}
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <div className="relative">
            <svg
              className="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder={t("searchCategories")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
            />
          </div>
        </div>

        {/* Error Banner */}
        {banner && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {banner}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-600 border-t-transparent" />
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredCategories.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-center text-gray-500 shadow-sm">
            {t("noCategories")}
          </div>
        )}

        {/* Table */}
        {!loading && filteredCategories.length > 0 && (
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
                {filteredCategories.map((category) => (
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
          <CategoryForm
            editing={!!editingCategory}
            defaultValues={formDefaults}
            pending={saveCategory.isPending}
            onSubmit={handleSubmit}
            onClose={closeModal}
          />
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

export function CategoriesContent() {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <CategoriesBody />
    </QueryClientProvider>
  );
}
