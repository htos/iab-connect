"use client";

/**
 * Board Documents list — REQ-034/035: Document Management (Vorstand/Admin).
 *
 * Feature-slice composition root (E29-S3). The route file
 * `app/board/documents/page.tsx` is a thin entry that renders this component;
 * this is the single `"use client"` boundary. List/folders/tags live in TanStack
 * query hooks (`use-board-documents`); status/delete/upload are mutations
 * (`use-board-document-mutations`) invalidating `boardDocumentsKeys`; URLs wrap
 * `documents` in `api/board-documents-api` (DEC-1 = A).
 *
 * CRITICAL — AC-3: the Vorstand-OR-Admin access gate
 * (`!isAuthenticated || (!isVorstand && !isAdmin)` → `router.push("/")`) is
 * preserved VERBATIM; a Member-only authed user is redirected with NO list
 * fetch (the queries' `enabled` mirrors the gate). A86: the delete confirm is
 * the destructive Radix dialog (`board-document-delete-dialog`); status actions
 * and per-version Restore keep their existing styling.
 *
 * A79: list is a query keyed by every server-side filter (refetch-on-change);
 * status/delete/upload are mutations invalidating `boardDocumentsKeys.all`
 * (replacing the manual `fetchData()`); success/error toasts keep the god-page's
 * 3000 ms auto-dismiss timer; the upload-without-folder rule + `selectFolderFirst`
 * are preserved. The dual `currentPath` / `selectedFolder` nav state stays local
 * (characterization-only).
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { PageShell, PageHeader } from "@/components/layout";
import {
  useBoardDocuments,
  useBoardFolders,
  useBoardTags,
} from "../hooks/use-board-documents";
import {
  useBoardDocumentMutations,
  type StatusAction,
} from "../hooks/use-board-document-mutations";
import { BoardDocumentsFilterBar } from "./board-documents-filter-bar";
import { BoardDocumentsTable } from "./board-documents-table";
import { BoardDocumentUploadDialog } from "./board-document-upload-dialog";
import { BoardDocumentDeleteDialog } from "./board-document-delete-dialog";
import type { DocumentFolderDto } from "../types/board-document.types";

const PAGE_SIZE = 20;

export function BoardDocumentsPageContent() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<DocumentFolderDto[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Toasts: success + error banners with the god-page's 3000 ms auto-dismiss.
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const authorized = isAuthenticated && (isVorstand || isAdmin);

  const showSuccess = (message: string) => {
    setSuccess(message);
    if (successTimer.current) clearTimeout(successTimer.current);
    successTimer.current = setTimeout(() => setSuccess(null), 3000);
  };

  useEffect(() => {
    return () => {
      if (successTimer.current) clearTimeout(successTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (!isVorstand && !isAdmin))) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const documentsQuery = useBoardDocuments(
    {
      page,
      pageSize: PAGE_SIZE,
      search: searchTerm || undefined,
      folderId: selectedFolder || undefined,
      status: statusFilter || undefined,
      category: categoryFilter || undefined,
    },
    authorized
  );
  const foldersQuery = useBoardFolders(selectedFolder || undefined, authorized);
  const tagsQuery = useBoardTags(authorized);

  const mutations = useBoardDocumentMutations();

  const documents = documentsQuery.data?.items ?? [];
  const totalPages = documentsQuery.data?.totalPages ?? 1;
  const totalCount = documentsQuery.data?.totalCount ?? 0;
  const folders = foldersQuery.data ?? [];
  const loading = documentsQuery.isLoading;

  // The list-load failure surfaces `documents.loadError` (god-page parity —
  // tags/folders failures silently no-op'd). A failed mutation sets the sticky
  // error banner below; the load error is shown when there is no transient one.
  const errorMessage =
    error ?? (documentsQuery.isError ? t("documents.loadError") : null);
  // Reference the unused tags query result to keep parity with the god-page's
  // parallel tag load (the dropdown does not consume it directly today).
  void tagsQuery;

  const handleStatusChange = (docId: string, action: StatusAction) => {
    setError(null);
    mutations.changeStatus.mutate(
      { id: docId, action },
      {
        onSuccess: () => showSuccess(t("documents.statusChanged")),
        onError: () => setError(t("documents.statusChangeError")),
      }
    );
  };

  const handleDelete = () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    mutations.deleteDoc.mutate(id, {
      onSuccess: () => showSuccess(t("documents.deleteSuccess")),
      onError: () => setError(t("documents.deleteError")),
      onSettled: () => setDeleteConfirmId(null),
    });
  };

  const handleUpload = (values: {
    file: File;
    name: string;
    category: string;
    description: string;
    tags: string;
  }) => {
    if (!selectedFolder) {
      setError(t("documents.selectFolderFirst"));
      return;
    }
    setError(null);
    mutations.upload.mutate(
      {
        file: values.file,
        name: values.name,
        folderId: selectedFolder,
        category: values.category,
        description: values.description,
        tags: values.tags,
      },
      {
        onSuccess: () => {
          setShowUpload(false);
          showSuccess(t("documents.uploadSuccess"));
        },
        onError: () => setError(t("documents.uploadError")),
      }
    );
  };

  const navigateToFolder = (folder: DocumentFolderDto) => {
    setSelectedFolder(folder.id);
    setCurrentPath([...currentPath, folder]);
    setPage(1);
  };

  const navigateUp = () => {
    const newPath = [...currentPath];
    newPath.pop();
    setCurrentPath(newPath);
    setSelectedFolder(
      newPath.length > 0 ? newPath[newPath.length - 1].id : null
    );
    setPage(1);
  };

  const navigateToRoot = () => {
    setCurrentPath([]);
    setSelectedFolder(null);
    setPage(1);
  };

  if (authLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={t("documents.boardTitle")}
        description={t("documents.boardSubtitle")}
        actions={
          <button
            onClick={() => setShowUpload(true)}
            disabled={!selectedFolder}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            {t("documents.upload")}
          </button>
        }
      />

      {/* Success/Error messages */}
      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
          {success}
        </div>
      )}
      {errorMessage && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {errorMessage}
        </div>
      )}

      {/* Upload Modal */}
      <BoardDocumentUploadDialog
        open={showUpload}
        pending={mutations.upload.isPending}
        onCancel={() => setShowUpload(false)}
        onSubmit={handleUpload}
      />

      {/* Breadcrumb */}
      <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
        <button
          onClick={navigateToRoot}
          className="text-orange-600 hover:underline"
        >
          {t("documents.root")}
        </button>
        {currentPath.map((folder, index) => (
          <span key={folder.id} className="flex items-center gap-2">
            <span>/</span>
            {index === currentPath.length - 1 ? (
              <span className="font-medium text-gray-900">{folder.name}</span>
            ) : (
              <button
                onClick={() => {
                  setCurrentPath(currentPath.slice(0, index + 1));
                  setSelectedFolder(folder.id);
                  setPage(1);
                }}
                className="text-orange-600 hover:underline"
              >
                {folder.name}
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Filters */}
      <BoardDocumentsFilterBar
        searchTerm={searchTerm}
        onSearchChange={(value) => {
          setSearchTerm(value);
          setPage(1);
        }}
        statusFilter={statusFilter}
        onStatusChange={(value) => {
          setStatusFilter(value);
          setPage(1);
        }}
        categoryFilter={categoryFilter}
        onCategoryChange={(value) => {
          setCategoryFilter(value);
          setPage(1);
        }}
      />

      {/* Folders */}
      {folders.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            {t("documents.folders")}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
            {currentPath.length > 0 && (
              <button
                onClick={navigateUp}
                className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 p-4 transition-colors hover:bg-gray-50"
              >
                <svg
                  className="h-10 w-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                  />
                </svg>
                <span className="text-sm text-gray-600">..</span>
              </button>
            )}
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => navigateToFolder(folder)}
                className="flex flex-col items-center gap-2 rounded-lg border border-gray-200 p-4 transition-colors hover:border-orange-200 hover:bg-orange-50"
              >
                <svg
                  className="h-10 w-10 text-orange-500"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                </svg>
                <span className="w-full truncate text-center text-sm font-medium text-gray-700">
                  {folder.name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Documents Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
        </div>
      ) : documents.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <p className="text-gray-500">{t("documents.noDocuments")}</p>
          {selectedFolder && (
            <p className="mt-2 text-sm text-gray-400">
              {t("documents.uploadHint")}
            </p>
          )}
        </div>
      ) : (
        <BoardDocumentsTable
          documents={documents}
          onStatusChange={handleStatusChange}
          onDetails={(id) => router.push(`/board/documents/${id}`)}
          onDelete={(id) => setDeleteConfirmId(id)}
        />
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {t("common.page")} {page} {t("common.of")} {totalPages} (
            {totalCount} {t("common.entries")})
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(Math.max(1, page - 1))}
              disabled={page === 1}
              className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("common.previous")}
            </button>
            <button
              onClick={() => setPage(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("common.next")}
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation (A86 — destructive Radix dialog) */}
      <BoardDocumentDeleteDialog
        targetId={deleteConfirmId}
        pending={mutations.deleteDoc.isPending}
        onConfirm={handleDelete}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmId(null);
        }}
      />
    </PageShell>
  );
}
