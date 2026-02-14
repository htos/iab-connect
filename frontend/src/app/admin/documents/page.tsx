"use client";

/**
 * Admin Documents Page - REQ-035: Folder & Permission Management (Admin only)
 */

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  DocumentFolderDto,
  getFolders,
  createFolder,
  deleteFolder,
  setFolderPermissions,
} from "@/lib/services/documents";

export default function AdminDocumentsPage() {
  const { isAuthenticated, isLoading: authLoading, isAdmin } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [folders, setFolders] = useState<DocumentFolderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderDesc, setNewFolderDesc] = useState("");
  const [newFolderParent, setNewFolderParent] = useState("");
  const [selectedFolder, setSelectedFolder] =
    useState<DocumentFolderDto | null>(null);
  const [showPermissions, setShowPermissions] = useState(false);
  const [permMember, setPermMember] = useState("");
  const [permVorstand, setPermVorstand] = useState("");
  const [deleteFolderId, setDeleteFolderId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || !isAdmin)) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isAdmin, router]);

  const fetchFolders = useCallback(async () => {
    setLoading(true);
    const result = await getFolders();
    if (result.success) {
      setFolders(result.data);
    } else {
      setError(result.error || "Error loading folders");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (isAuthenticated && isAdmin) fetchFolders();
  }, [isAuthenticated, isAdmin, fetchFolders]);

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    const result = await createFolder({
      name: newFolderName,
      description: newFolderDesc || undefined,
      parentFolderId: newFolderParent || undefined,
    });
    if (result.success) {
      setShowCreate(false);
      setNewFolderName("");
      setNewFolderDesc("");
      setNewFolderParent("");
      setSuccess(t("documents.folderCreated"));
      fetchFolders();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Error");
    }
  };

  const handleDeleteFolder = async (id: string) => {
    setDeleteFolderId(null);
    const result = await deleteFolder(id);
    if (result.success) {
      setSuccess(t("documents.folderDeleted"));
      fetchFolders();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Error");
    }
  };

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
      fetchFolders();
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
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
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

        {success && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {/* Create Folder Modal */}
        {showCreate && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold">
                {t("documents.createFolder")}
              </h2>
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
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("documents.parentFolder")}
                  </label>
                  <select
                    value={newFolderParent}
                    onChange={(e) => setNewFolderParent(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    <option value="">{t("documents.rootLevel")}</option>
                    {folders.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreate(false)}
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

        {/* Folder Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        ) : folders.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <p className="text-gray-500">{t("documents.noFolders")}</p>
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
                {folders.map((folder) => (
                  <tr key={folder.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <svg
                          className="h-5 w-5 text-orange-500"
                          fill="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z" />
                        </svg>
                        <span className="font-medium text-gray-900">
                          {folder.name}
                        </span>
                      </div>
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
