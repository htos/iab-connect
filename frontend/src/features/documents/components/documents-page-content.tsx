"use client";

/**
 * Documents Page content — REQ-034: Dokumentenverwaltung (Member View).
 *
 * Feature-slice composition root (E29-S2). The route file
 * `app/documents/page.tsx` is a thin server entry that renders this component;
 * this is the single `"use client"` boundary. Data lives in TanStack query
 * hooks (`use-documents`, `use-document-folders`, `use-document-tags`); the
 * authenticated download is a side-effect hook behind `document-download-button`
 * (DEC-2); URLs are wrapped over `@/lib/services/documents` in
 * `api/documents-api` (DEC-1).
 *
 * Behaviour preserved verbatim (pinned by the E29-S1 characterization suite):
 * the role-less auth guard (`!isAuthenticated` → /login), the auth-loading
 * spinner, server-side search (resets page→1) / folderId / single-`tags` STRING
 * filters, folder navigation (into / up / root / breadcrumb), `pageSize=20`
 * pagination, loading / error (`documents.loadError`) / empty
 * (`documents.noDocuments`) states, the table render, the blob download, and the
 * A76 download-error banner. The dual `currentPath` / `selectedFolder` nav state
 * is kept local here (characterization-only; NOT "fixed" to a URL param).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/lib/auth";
import { PageShell, PageHeader } from "@/components/layout";
import { useDocuments } from "../hooks/use-documents";
import { useDocumentFolders } from "../hooks/use-document-folders";
import { useDocumentTags } from "../hooks/use-document-tags";
import { DocumentsFilterBar } from "./documents-filter-bar";
import { DocumentsBreadcrumb } from "./documents-breadcrumb";
import { DocumentsFolderGrid } from "./documents-folder-grid";
import { DocumentsTable } from "./documents-table";
import type { DocumentFolderDto } from "../types/document.types";

const PAGE_SIZE = 20;

export function DocumentsPageContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string>("");
  const [currentPath, setCurrentPath] = useState<DocumentFolderDto[]>([]);
  // A76 download error: a sticky page-level banner separate from the load error,
  // mirroring the god-page's single `error` state where a failed download's
  // `setError` overwrote the banner. Cleared on the next filter/nav interaction.
  const [downloadError, setDownloadError] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  const documentsQuery = useDocuments(
    {
      page,
      pageSize: PAGE_SIZE,
      search: searchTerm || undefined,
      folderId: selectedFolder || undefined,
      tags: selectedTag || undefined,
    },
    isAuthenticated
  );
  const foldersQuery = useDocumentFolders(
    selectedFolder || undefined,
    isAuthenticated
  );
  const tagsQuery = useDocumentTags(isAuthenticated);

  const documents = documentsQuery.data?.items ?? [];
  const totalPages = documentsQuery.data?.totalPages ?? 1;
  const totalCount = documentsQuery.data?.totalCount ?? 0;
  const folders = foldersQuery.data ?? [];
  const allTags = tagsQuery.data ?? [];
  const loading = documentsQuery.isLoading;

  // The error banner reflects ONLY the documents-list failure (god-page parity:
  // tags/folders failures silently no-op'd) OR an A76 download failure. The
  // download error takes precedence + is sticky, matching the shared `error`
  // state of the god-page.
  const errorMessage = downloadError
    ? t("documents.downloadError")
    : documentsQuery.isError
      ? t("documents.loadError")
      : null;

  const clearTransientErrors = () => setDownloadError(false);

  const navigateToFolder = (folder: DocumentFolderDto) => {
    clearTransientErrors();
    setSelectedFolder(folder.id);
    setCurrentPath([...currentPath, folder]);
    setPage(1);
  };

  const navigateUp = () => {
    clearTransientErrors();
    const newPath = [...currentPath];
    newPath.pop();
    setCurrentPath(newPath);
    setSelectedFolder(
      newPath.length > 0 ? newPath[newPath.length - 1].id : null
    );
    setPage(1);
  };

  const navigateToRoot = () => {
    clearTransientErrors();
    setCurrentPath([]);
    setSelectedFolder(null);
    setPage(1);
  };

  const navigateToSegment = (index: number) => {
    clearTransientErrors();
    const newPath = currentPath.slice(0, index + 1);
    setCurrentPath(newPath);
    setSelectedFolder(newPath[index].id);
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
        title={t("documents.title")}
        description={t("documents.subtitle")}
      />

      <DocumentsBreadcrumb
        currentPath={currentPath}
        onNavigateToRoot={navigateToRoot}
        onNavigateToSegment={navigateToSegment}
      />

      <DocumentsFilterBar
        searchTerm={searchTerm}
        onSearchChange={(value) => {
          clearTransientErrors();
          setSearchTerm(value);
          setPage(1);
        }}
        selectedTag={selectedTag}
        onTagChange={(value) => {
          clearTransientErrors();
          setSelectedTag(value);
          setPage(1);
        }}
        allTags={allTags}
      />

      {errorMessage && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          {errorMessage}
        </div>
      )}

      <DocumentsFolderGrid
        folders={folders}
        showUpButton={currentPath.length > 0}
        onNavigateUp={navigateUp}
        onNavigateToFolder={navigateToFolder}
      />

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
        <DocumentsTable
          documents={documents}
          onDownloadError={() => setDownloadError(true)}
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
    </PageShell>
  );
}
