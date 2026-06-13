"use client";

/**
 * Admin Documents (Folder & Permission manager) — REQ-035, feature-slice
 * composition root (E27-S6). The route file `app/admin/documents/page.tsx` is a
 * thin server entry rendering this component; this is the single `"use client"`
 * boundary.
 *
 * REALITY (A56): this is a FOLDER & PERMISSION manager — NO file upload, NO
 * document list, NO status badges. Behaviour is preserved VERBATIM from the
 * god-page (pinned by the E27-S1 net):
 *  - admin guard: non-admin/unauth → `router.push("/")` (NOT /login). DEC-3=A:
 *    this page does NOT early-return null for a non-admin — it renders the page
 *    shell (with the loading spinner) WHILE redirecting; the fetch is gated on
 *    `isAuthenticated && isAdmin`. That CURRENT behaviour is kept (flagged for the
 *    boundary review).
 *  - the imperative list + subfolder-count orchestration (a `Promise.all` of
 *    per-folder `getFolders(f.id)` probes) is kept (A79 — NOT converted to a
 *    single TanStack query; the count probe + success/error banner state machine
 *    + close-before-await delete are pinned by the net). Service calls are wrapped
 *    via `api/admin-folders-api` (DEC-1=A); mutations go through the slice
 *    mutation hooks (`mutateAsync`, awaited exactly as the god-page awaited the
 *    service) so they invalidate `adminFoldersKeys` while the content drives the
 *    explicit post-mutation reload.
 */

import { useEffect, useState, useCallback, startTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageShell } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { fetchFolders } from "../api/admin-folders-api";
import {
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
  useSetFolderPermissions,
} from "../hooks/use-folder-mutations";
import { FoldersTable } from "./folders-table";
import { FolderFormDialog } from "./folder-form-dialog";
import { FolderPermissionsDialog } from "./folder-permissions-dialog";
import { DeleteFolderDialog } from "./delete-folder-dialog";
import type {
  DocumentFolderDto,
  PermissionEntry,
} from "../types/admin-documents.types";
import type { FolderFormValues } from "../schemas/folder.schema";

interface BreadcrumbItem {
  id: string | null; // null = root
  name: string;
}

export function AdminFoldersPageContent() {
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [folders, setFolders] = useState<DocumentFolderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Folder navigation state
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: null, name: "" }, // root
  ]);

  // Dialogs
  const [showCreate, setShowCreate] = useState(false);
  const [editFolder, setEditFolder] = useState<DocumentFolderDto | null>(null);
  const [selectedFolder, setSelectedFolder] =
    useState<DocumentFolderDto | null>(null);
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  // Subfolder counts cache: parentId -> count
  const [subfolderCounts, setSubfolderCounts] = useState<
    Record<string, number>
  >({});

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  const createFolderMutation = useCreateFolder();
  const updateFolderMutation = useUpdateFolder();
  const deleteFolderMutation = useDeleteFolder();
  const setPermissionsMutation = useSetFolderPermissions();

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const loadFolders = useCallback(async (parentId?: string | null) => {
    setLoading(true);
    const result = await fetchFolders(parentId || undefined);
    if (result.success) {
      setFolders(result.data);

      // Fetch subfolder counts for each folder
      const counts: Record<string, number> = {};
      await Promise.all(
        result.data.map(async (f) => {
          const subResult = await fetchFolders(f.id);
          if (subResult.success) {
            counts[f.id] = subResult.data.length;
          }
        })
      );
      setSubfolderCounts(counts);
    } else {
      setError(result.error || "Error loading folders");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      startTransition(() => {
        void loadFolders(currentFolderId);
      });
    }
  }, [isAuthenticated, isAdmin, currentFolderId, loadFolders]);

  const flashSuccess = (message: string) => {
    setSuccess(message);
    setTimeout(() => setSuccess(null), 3000);
  };

  // Client-side filtering
  const filteredFolders = folders.filter((folder) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      folder.name.toLowerCase().includes(term) ||
      (folder.description?.toLowerCase().includes(term) ?? false)
    );
  });

  // Navigate into a folder
  const navigateToFolder = (folder: DocumentFolderDto) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
  };

  // Navigate via breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    const targetCrumb = breadcrumbs[index];
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setCurrentFolderId(targetCrumb.id);
  };

  // Create folder (always as child of current folder)
  const handleCreateFolder = async (values: FolderFormValues) => {
    try {
      await createFolderMutation.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        parentFolderId: currentFolderId || undefined,
      });
      setShowCreate(false);
      flashSuccess(t("documents.folderCreated"));
      void loadFolders(currentFolderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  // Edit/rename folder
  const handleEditFolder = async (values: FolderFormValues) => {
    if (!editFolder) return;
    try {
      await updateFolderMutation.mutateAsync({
        id: editFolder.id,
        data: {
          name: values.name,
          description: values.description || undefined,
          sortOrder: editFolder.sortOrder,
        },
      });
      setEditFolder(null);
      flashSuccess(t("documents.folderUpdated"));
      void loadFolders(currentFolderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  // Delete folder — close the modal BEFORE awaiting (E27-S1 net: on failure the
  // error shows while the modal is already gone).
  const handleDeleteFolder = async (id: string) => {
    setDeleteFolderId(null);
    try {
      await deleteFolderMutation.mutateAsync(id);
      flashSuccess(t("documents.folderDeleted"));
      void loadFolders(currentFolderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
  };

  // Permissions
  const handleSavePermissions = async (permissions: PermissionEntry[]) => {
    if (!selectedFolder) return;
    try {
      await setPermissionsMutation.mutateAsync({
        id: selectedFolder.id,
        data: { permissions },
      });
      setSelectedFolder(null);
      flashSuccess(t("documents.permissionsSaved"));
      void loadFolders(currentFolderId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    }
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
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
            {t("documents.adminTitle")}
          </h1>
          <p className="mt-1 text-gray-600">{t("documents.adminSubtitle")}</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-700"
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
              d="M12 4v16m8-8H4"
            />
          </svg>
          {t("documents.createFolder")}
        </button>
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <nav className="mb-4 flex items-center gap-1 text-sm">
          {breadcrumbs.map((crumb, index) => (
            <span key={crumb.id ?? "root"} className="flex items-center gap-1">
              {index > 0 && (
                <svg
                  className="h-4 w-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              )}
              {index < breadcrumbs.length - 1 ? (
                <button
                  onClick={() => navigateToBreadcrumb(index)}
                  className="font-medium text-orange-600 hover:text-orange-800 hover:underline"
                >
                  {index === 0 ? (
                    <span className="flex items-center gap-1">
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
                          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                        />
                      </svg>
                      {t("documents.allFolders")}
                    </span>
                  ) : (
                    crumb.name
                  )}
                </button>
              ) : (
                <span className="font-semibold text-gray-900">
                  {crumb.name}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Back Button (when inside a folder) */}
      {currentFolderId && (
        <button
          onClick={() => navigateToBreadcrumb(breadcrumbs.length - 2)}
          className="mb-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
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
          {t("documents.backToParent")}
        </button>
      )}

      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-2 font-medium text-red-800 hover:underline"
          >
            ✕
          </button>
        </div>
      )}

      {/* Create Folder Modal */}
      {showCreate && (
        <FolderFormDialog
          titleKey="documents.createFolder"
          defaultValues={{ name: "", description: "" }}
          parentHint={
            currentFolderId ? breadcrumbs[breadcrumbs.length - 1]?.name : null
          }
          onSubmit={handleCreateFolder}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Edit Folder Modal */}
      {editFolder && (
        <FolderFormDialog
          key={editFolder.id}
          titleKey="documents.editFolder"
          defaultValues={{
            name: editFolder.name,
            description: editFolder.description || "",
          }}
          onSubmit={handleEditFolder}
          onCancel={() => setEditFolder(null)}
        />
      )}

      {/* Permissions Modal */}
      {selectedFolder && (
        <FolderPermissionsDialog
          folder={selectedFolder}
          onSave={handleSavePermissions}
          onCancel={() => setSelectedFolder(null)}
        />
      )}

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
            placeholder={t("documents.searchDocuments")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 py-2 pr-4 pl-10 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500"
          />
        </div>
      </div>

      {/* Folder Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
        </div>
      ) : filteredFolders.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <svg
            className="mx-auto h-12 w-12 text-gray-300"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
          </svg>
          <p className="mt-4 text-gray-500">
            {currentFolderId
              ? t("documents.noSubfolders")
              : t("documents.noFolders")}
          </p>
        </div>
      ) : (
        <FoldersTable
          folders={filteredFolders}
          subfolderCounts={subfolderCounts}
          onOpen={navigateToFolder}
          onEdit={(folder) => setEditFolder(folder)}
          onPermissions={(folder) => setSelectedFolder(folder)}
          onDelete={(id) => setDeleteFolderId(id)}
        />
      )}

      {/* Delete Folder Confirmation Modal */}
      {deleteFolderId && (
        <DeleteFolderDialog
          onConfirm={() => handleDeleteFolder(deleteFolderId)}
          onCancel={() => setDeleteFolderId(null)}
        />
      )}
    </PageShell>
  );
}
