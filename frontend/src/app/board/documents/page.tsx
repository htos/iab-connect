"use client";

/**
 * Board Documents Page - REQ-034/035: Document Management (Vorstand/Admin)
 * Board members can upload, edit, manage workflow status
 */

import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  DocumentDto,
  DocumentFolderDto,
  getDocuments,
  getFolders,
  getAllTags,
  deleteDocument,
  reviewDocument,
  publishDocument,
  archiveDocument,
  formatFileSize,
  getStatusColor,
  DocumentStatus,
  DocumentCategory,
} from "@/lib/services/documents";

export default function BoardDocumentsPage() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [folders, setFolders] = useState<DocumentFolderDto[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadDescription, setUploadDescription] = useState("");
  const [uploadCategory, setUploadCategory] = useState("General");
  const [uploadTags, setUploadTags] = useState("");
  const [uploading, setUploading] = useState(false);
  const [currentPath, setCurrentPath] = useState<DocumentFolderDto[]>([]);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (!isVorstand && !isAdmin))) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [docsResult, tagsResult] = await Promise.all([
        getDocuments({
          page,
          pageSize: 20,
          search: searchTerm || undefined,
          folderId: selectedFolder || undefined,
          status: statusFilter || undefined,
          category: categoryFilter || undefined,
        }),
        getAllTags(),
      ]);
      if (docsResult.success) {
        setDocuments(docsResult.data.items);
        setTotalPages(docsResult.data.totalPages);
        setTotalCount(docsResult.data.totalCount);
      }
      if (tagsResult.success) setAllTags(tagsResult.data);
    } catch {
      setError(t("documents.loadError"));
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, selectedFolder, statusFilter, categoryFilter, t]);

  const fetchFolders = useCallback(async (parentId?: string) => {
    const result = await getFolders(parentId);
    if (result.success) setFolders(result.data);
  }, []);

  useEffect(() => {
    if (isAuthenticated && (isVorstand || isAdmin)) {
      fetchData();
      fetchFolders(selectedFolder || undefined);
    }
  }, [
    isAuthenticated,
    isVorstand,
    isAdmin,
    fetchData,
    fetchFolders,
    selectedFolder,
  ]);

  const handleUpload = async () => {
    if (!uploadFile || !selectedFolder) {
      setError(t("documents.selectFolderFirst"));
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("name", uploadName || uploadFile.name);
      formData.append("folderId", selectedFolder);
      formData.append("category", uploadCategory);
      if (uploadDescription) formData.append("description", uploadDescription);
      if (uploadTags) formData.append("tags", uploadTags);

      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const { getSession } = await import("next-auth/react");
      const session = (await getSession()) as { accessToken?: string } | null;

      const response = await fetch(`${base}/api/v1/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.accessToken || ""}` },
        body: formData,
      });

      if (!response.ok) throw new Error("Upload failed");

      setShowUpload(false);
      setUploadFile(null);
      setUploadName("");
      setUploadDescription("");
      setUploadTags("");
      setSuccess(t("documents.uploadSuccess"));
      fetchData();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError(t("documents.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const handleStatusChange = async (
    docId: string,
    action: "review" | "publish" | "archive"
  ) => {
    setError(null);
    try {
      let result;
      if (action === "review") result = await reviewDocument(docId);
      else if (action === "publish") result = await publishDocument(docId);
      else result = await archiveDocument(docId);

      if (result.success) {
        setSuccess(t("documents.statusChanged"));
        fetchData();
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || t("documents.statusChangeError"));
      }
    } catch {
      setError(t("documents.statusChangeError"));
    }
  };

  const handleDelete = async (docId: string) => {
    setDeleteConfirmId(null);
    const result = await deleteDocument(docId);
    if (result.success) {
      fetchData();
      setSuccess(t("documents.deleteSuccess"));
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || t("documents.deleteError"));
    }
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
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {t("documents.boardTitle")}
            </h1>
            <p className="mt-1 text-gray-600">{t("documents.boardSubtitle")}</p>
          </div>
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
        </div>

        {/* Success/Error messages */}
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

        {/* Upload Modal */}
        {showUpload && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold">
                {t("documents.uploadDocument")}
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("documents.file")}
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-dashed border-gray-300 p-4 transition-colors hover:border-orange-400 hover:bg-orange-50">
                    <svg
                      className="h-8 w-8 text-gray-400"
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
                    <div className="flex-1">
                      {uploadFile ? (
                        <>
                          <p className="text-sm font-medium text-gray-900">
                            {uploadFile.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(uploadFile.size)}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm font-medium text-gray-700">
                            {t("documents.chooseFile")}
                          </p>
                          <p className="text-xs text-gray-500">
                            {t("documents.dragOrClick")}
                          </p>
                        </>
                      )}
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        setUploadFile(e.target.files?.[0] || null);
                        if (!uploadName && e.target.files?.[0])
                          setUploadName(
                            e.target.files[0].name.replace(/\.[^.]+$/, "")
                          );
                      }}
                    />
                  </label>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("documents.documentName")}
                  </label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("documents.description")}
                  </label>
                  <textarea
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("documents.category")}
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  >
                    {Object.values(DocumentCategory).map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("documents.tags")}
                  </label>
                  <input
                    type="text"
                    value={uploadTags}
                    onChange={(e) => setUploadTags(e.target.value)}
                    placeholder={t("documents.tagsPlaceholder")}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowUpload(false)}
                  className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
                >
                  {uploading ? t("documents.uploading") : t("documents.upload")}
                </button>
              </div>
            </div>
          </div>
        )}

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
        <div className="mb-6 rounded-lg bg-white p-4 shadow">
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <input
                type="text"
                placeholder={t("documents.searchPlaceholder")}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 focus:outline-none"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2"
            >
              <option value="">{t("documents.allStatuses")}</option>
              {Object.values(DocumentStatus).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2"
            >
              <option value="">{t("documents.allCategories")}</option>
              {Object.values(DocumentCategory).map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

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
          <div className="overflow-hidden rounded-lg bg-white shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {t("documents.documentName")}
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase md:table-cell">
                    {t("documents.status")}
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase md:table-cell">
                    {t("documents.category")}
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase lg:table-cell">
                    {t("documents.size")}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{doc.name}</p>
                        {doc.tags.length > 0 && (
                          <div className="mt-1 flex flex-wrap gap-1">
                            {doc.tags.map((tag) => (
                              <span
                                key={tag}
                                className="inline-block rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 md:table-cell">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusColor(doc.status)}`}
                      >
                        {doc.status}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 md:table-cell">
                      <span className="text-sm text-gray-600">
                        {doc.category}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 lg:table-cell">
                      <span className="text-sm text-gray-600">
                        {formatFileSize(doc.fileSize)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {doc.status === "Draft" && (
                          <>
                            <button
                              onClick={() =>
                                handleStatusChange(doc.id, "review")
                              }
                              className="text-xs font-medium text-blue-600 hover:text-blue-800"
                            >
                              {t("documents.markReviewed")}
                            </button>
                            <button
                              onClick={() =>
                                handleStatusChange(doc.id, "publish")
                              }
                              className="text-xs font-medium text-green-600 hover:text-green-800"
                            >
                              {t("documents.publish")}
                            </button>
                          </>
                        )}
                        {doc.status === "Reviewed" && (
                          <button
                            onClick={() =>
                              handleStatusChange(doc.id, "publish")
                            }
                            className="text-xs font-medium text-green-600 hover:text-green-800"
                          >
                            {t("documents.publish")}
                          </button>
                        )}
                        {(doc.status === "Published" ||
                          doc.status === "Reviewed") && (
                          <button
                            onClick={() =>
                              handleStatusChange(doc.id, "archive")
                            }
                            className="text-xs font-medium text-yellow-600 hover:text-yellow-800"
                          >
                            {t("documents.archive")}
                          </button>
                        )}
                        <button
                          onClick={() =>
                            router.push(`/board/documents/${doc.id}`)
                          }
                          className="text-xs font-medium text-orange-600 hover:text-orange-800"
                        >
                          {t("common.details")}
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(doc.id)}
                          className="text-xs font-medium text-red-600 hover:text-red-800"
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

        {/* Delete Confirmation Modal */}
        {deleteConfirmId && (
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
                  {t("documents.confirmDeleteTitle")}
                </h3>
              </div>
              <p className="mb-6 text-sm text-gray-600">
                {t("documents.confirmDelete")}
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
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
