"use client";

/**
 * Documents Page - REQ-034: Dokumentenverwaltung (Member View)
 * Members can browse and download published documents
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
  formatFileSize,
  getDownloadUrl,
} from "@/lib/services/documents";

export default function DocumentsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [documents, setDocuments] = useState<DocumentDto[]>([]);
  const [folders, setFolders] = useState<DocumentFolderDto[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [currentPath, setCurrentPath] = useState<DocumentFolderDto[]>([]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

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
          tags: selectedTag || undefined,
        }),
        getAllTags(),
      ]);

      if (docsResult.success) {
        setDocuments(docsResult.data.items);
        setTotalPages(docsResult.data.totalPages);
        setTotalCount(docsResult.data.totalCount);
      }
      if (tagsResult.success) {
        setAllTags(tagsResult.data);
      }
    } catch {
      setError(t("documents.loadError"));
    } finally {
      setLoading(false);
    }
  }, [page, searchTerm, selectedFolder, selectedTag, t]);

  const fetchFolders = useCallback(async (parentId?: string) => {
    const result = await getFolders(parentId);
    if (result.success) {
      setFolders(result.data);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
      fetchFolders(selectedFolder || undefined);
    }
  }, [isAuthenticated, fetchData, fetchFolders, selectedFolder]);

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

  const handleDownload = async (doc: DocumentDto) => {
    const url = getDownloadUrl(doc.id);
    try {
      const { getSession } = await import("next-auth/react");
      const session = (await getSession()) as { accessToken?: string } | null;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${session?.accessToken || ""}` },
      });
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = window.document.createElement("a");
      link.href = objectUrl;
      link.setAttribute("download", doc.name);
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(t("documents.downloadError"));
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
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">
              {t("documents.title")}
            </h1>
            <p className="mt-1 text-gray-600">{t("documents.subtitle")}</p>
          </div>
        </div>

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
                    const newPath = currentPath.slice(0, index + 1);
                    setCurrentPath(newPath);
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

        {/* Search and Filter */}
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
              value={selectedTag}
              onChange={(e) => {
                setSelectedTag(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:outline-none"
            >
              <option value="">{t("documents.allTags")}</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

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

        {/* Documents */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <svg
              className="mx-auto mb-4 h-16 w-16 text-gray-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-500">{t("documents.noDocuments")}</p>
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
                    {t("documents.category")}
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase lg:table-cell">
                    {t("documents.size")}
                  </th>
                  <th className="hidden px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase lg:table-cell">
                    {t("documents.date")}
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
                      <div className="flex items-center gap-3">
                        <svg
                          className="h-8 w-8 flex-shrink-0 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                        <div>
                          <p className="font-medium text-gray-900">
                            {doc.name}
                          </p>
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
                      </div>
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
                    <td className="hidden px-6 py-4 lg:table-cell">
                      <span className="text-sm text-gray-600">
                        {new Date(doc.createdAt).toLocaleDateString("de-CH", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDownload(doc)}
                        className="inline-flex items-center gap-1 text-sm font-medium text-orange-600 hover:text-orange-800"
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
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                        {t("documents.download")}
                      </button>
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
      </div>
    </main>
  );
}
