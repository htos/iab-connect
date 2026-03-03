"use client";

/**
 * Admin Documents Page - REQ-035: Folder & Permission Management (Admin only)
 * Now with hierarchical folder navigation (drill-down + breadcrumbs)
 */

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  DocumentFolderDto,
  getFolders,
  createFolder,
  updateFolder,
  deleteFolder,
  setFolderPermissions,
} from "@/lib/services/documents";

interface BreadcrumbItem {
  id: string | null; // null = root
  name: string;
}

export default function AdminDocumentsPage() {
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

  // Create folder dialog
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");

  // Edit folder dialog
  const [showEdit, setShowEdit] = useState(false);
  const [editFolder, setEditFolder] = useState<DocumentFolderDto | null>(null);
  const [editFolderName, setEditFolderName] = useState("");
  const [editFolderDesc, setEditFolderDesc] = useState("");

  // Permissions dialog
  const [selectedFolder, setSelectedFolder] =
    useState<DocumentFolderDto | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permMember, setPermMember] = useState("");
  const [permVorstand, setPermVorstand] = useState("");

  // Delete confirmation
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  // Subfolder counts cache: parentId -> count
  const [subfolderCounts, setSubfolderCounts] = useState<Record<string, number>>({});

  // Search
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const fetchFolders = useCallback(
    async (parentId?: string | null) => {
      setLoading(true);
      const result = await getFolders(parentId || undefined);
      if (result.success) {
        setFolders(result.data);

        // Fetch subfolder counts for each folder
        const counts: Record<string, number> = {};
        await Promise.all(
          result.data.map(async (f) => {
            const subResult = await getFolders(f.id);
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
    },
    []
  );

  useEffect(() => {
    if (isAuthenticated && isAdmin) {
      fetchFolders(currentFolderId);
    }
  }, [isAuthenticated, isAdmin, currentFolderId, fetchFolders]);

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
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const result = await createFolder({
      name: newFolderName,
      description: newFolderDesc || undefined,
      parentFolderId: currentFolderId || undefined,
    });
    if (result.success) {
      setShowCreate(false);
      setNewFolderName("");
      setNewFolderDesc("");
      setSuccess(t("documents.folderCreated"));
      fetchFolders(currentFolderId);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Error");
    }
  };

  // Edit/rename folder
  const openEditFolder = (folder: DocumentFolderDto) => {
    setEditFolder(folder);
    setEditFolderName(folder.name);
    setEditFolderDesc(folder.description || "");
    setShowEdit(true);
  };

  const handleEditFolder = async () => {
    if (!editFolder || !editFolderName.trim()) return;
    const result = await updateFolder(editFolder.id, {
      name: editFolderName,
      description: editFolderDesc || undefined,
      sortOrder: editFolder.sortOrder,
    });
    if (result.success) {
      setShowEdit(false);
      setEditFolder(null);
      setSuccess(t("documents.folderUpdated"));
      fetchFolders(currentFolderId);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Error");
    }
  };

  // Delete folder
  const handleDeleteFolder = async (id: string) => {
    setDeleteFolderId(null);
    const result = await deleteFolder(id);
    if (result.success) {
      setSuccess(t("documents.folderDeleted"));
      fetchFolders(currentFolderId);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Error");
    }
  };

  // Permissions
  const openPermissions = (folder: DocumentFolderDto) => {
    setSelectedFolder(folder);
    const memberPerm = folder.permissions.find((p) => p.role === "Member");
    const vorstandPerm = folder.permissions.find((p) => p.role === "Vorstand");
    setPermMember(memberPerm?.permissionType || "");
    setPermVorstand(vorstandPerm?.permissionType || "");
    setShowPermissions(true);
  };

  const handleSavePermissions = async () => {
    if (!selectedFolder) return;
    const permissions: { role: string; permissionType: string }[] = [];
    if (permMember)
      permissions.push({ role: "Member", permissionType: permMember });
    if (permVorstand)
      permissions.push({ role: "Vorstand", permissionType: permVorstand });
    const result = await setFolderPermissions(selectedFolder.id, {
      permissions,
    });
    if (result.success) {
      setShowPermissions(false);
      setSuccess(t("documents.permissionsSaved"));
      fetchFolders(currentFolderId);
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Error");
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
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
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
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
                {index < breadcrumbs.length - 1 ? (
                  <button
                    onClick={() => navigateToBreadcrumb(index)}
                    className="font-medium text-orange-600 hover:text-orange-800 hover:underline"
                  >
                    {index === 0 ? (
                      <span className="flex items-center gap-1">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        {t("documents.allFolders")}
                      </span>
                    ) : (
                      crumb.name
                    )}
                  </button>
                ) : (
                  <span className="font-semibold text-gray-900">{crumb.name}</span>
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
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
            <button onClick={() => setError(null)} className="ml-2 text-red-800 font-medium hover:underline">✕</button>
          </div>
        )}

        {/* Create Folder Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold">
                {t("documents.createFolder")}
              </h2>
              {currentFolderId && (
                <p className="mb-3 text-sm text-gray-500">
                  {t("documents.parentFolder")}: {breadcrumbs[breadcrumbs.length - 1]?.name}
                </p>
              )}
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("common.name")}
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("documents.description")}
                  </label>
                  <textarea
                    value={newFolderDesc}
                    onChange={(e) => setNewFolderDesc(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreate(false);
                    setNewFolderName("");
                    setNewFolderDesc("");
                  }}
                  className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Folder Modal */}
        {showEdit && editFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold">
                {t("documents.editFolder")}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("common.name")}
                  </label>
                  <input
                    type="text"
                    value={editFolderName}
                    onChange={(e) => setEditFolderName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("documents.description")}
                  </label>
                  <textarea
                    value={editFolderDesc}
                    onChange={(e) => setEditFolderDesc(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowEdit(false);
                    setEditFolder(null);
                  }}
                  className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleEditFolder}
                  disabled={!editFolderName.trim()}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Permissions Modal */}
        {showPermissions && selectedFolder && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold">
                {t("documents.permissions")}: {selectedFolder.name}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("documents.memberAccess")}
                  </label>
                  <select
                    value={permMember}
                    onChange={(e) => setPermMember(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">{t("documents.noAccess")}</option>
                    <option value="Read">{t("documents.readOnly")}</option>
                    <option value="Write">{t("documents.readWrite")}</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("documents.vorstandAccess")}
                  </label>
                  <select
                    value={permVorstand}
                    onChange={(e) => setPermVorstand(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">{t("documents.noAccess")}</option>
                    <option value="Read">{t("documents.readOnly")}</option>
                    <option value="Write">{t("documents.readWrite")}</option>
                    <option value="Manage">{t("documents.manage")}</option>
                  </select>
                </div>
                <p className="text-xs text-gray-400">
                  {t("documents.adminAlwaysHasAccess")}
                </p>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowPermissions(false)}
                  className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleSavePermissions}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
                >
                  {t("common.save")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder={t("documents.searchDocuments")}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 outline-none transition-colors"
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
              {currentFolderId ? t("documents.noSubfolders") : t("documents.noFolders")}
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {t("documents.folderName")}
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase md:table-cell">
                    {t("documents.description")}
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase md:table-cell">
                    {t("documents.permissions")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredFolders.map((folder) => (
                  <tr key={folder.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => navigateToFolder(folder)}
                        className="flex items-center gap-2 text-left group"
                        title={t("documents.openFolder")}
                      >
                        <svg
                          className="h-5 w-5 flex-shrink-0 text-orange-500 group-hover:text-orange-700"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                        </svg>
                        <div>
                          <span className="font-medium text-gray-900 group-hover:text-orange-700 group-hover:underline">
                            {folder.name}
                          </span>
                          {(subfolderCounts[folder.id] ?? 0) > 0 && (
                            <span className="ml-2 text-xs text-gray-400">
                              ({t("documents.subfolderCount", { count: subfolderCounts[folder.id] })})
                            </span>
                          )}
                        </div>
                      </button>
                    </td>
                    <td className="hidden px-6 py-4 md:table-cell">
                      <span className="text-sm text-gray-600">
                        {folder.description || "-"}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 md:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {folder.permissions.length === 0 ? (
                          <span className="text-xs text-gray-400">
                            {t("documents.noPermissionsSet")}
                          </span>
                        ) : (
                          folder.permissions.map((p) => (
                            <span
                              key={p.role}
                              className="inline-block rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700"
                            >
                              {p.role}: {p.permissionType}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditFolder(folder)}
                          className="text-sm font-medium text-blue-600 hover:text-blue-800"
                        >
                          {t("common.edit")}
                        </button>
                        <button
                          onClick={() => openPermissions(folder)}
                          className="text-sm font-medium text-orange-600 hover:text-orange-800"
                        >
                          {t("documents.permissions")}
                        </button>
                        <button
                          onClick={() => setDeleteFolderId(folder.id)}
                          className="text-sm font-medium text-red-600 hover:text-red-800"
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete Folder Confirmation Modal */}
        {deleteFolderId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                  <svg
                    className="h-6 w-6 text-red-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {t("documents.deleteFolderTitle")}
                </h3>
              </div>
              <p className="mb-6 text-sm text-gray-600">
                {t("documents.confirmDeleteFolder")}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteFolderId(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => handleDeleteFolder(deleteFolderId)}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  {t("common.delete")}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
