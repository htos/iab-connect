"use client";

/**
 * Board Document detail — REQ-034/035/036: detail with versions (Vorstand/Admin).
 *
 * Feature-slice composition root (E29-S3). The route file
 * `app/board/documents/[id]/page.tsx` is a thin entry that resolves `params` and
 * renders this component; this is the single `"use client"` boundary. The detail
 * lives in `use-board-document` (a TanStack query, +`BoardDocumentNotFoundError`);
 * status/tag/restore/version-upload are mutations
 * (`use-board-document-mutations`) invalidating `boardDocumentsKeys.detail(id)`
 * + `all`; the authenticated blob download is the `use-board-document-download`
 * side-effect hook (DEC-2). URLs wrap `@/lib/services/documents` (DEC-1 = A).
 *
 * CRITICAL — AC-3: the Vorstand-OR-Admin gate
 * (`!isAuthenticated || (!isVorstand && !isAdmin)` → `router.push("/")`) is
 * preserved VERBATIM; the query's `enabled` mirrors it so no GET fires for a
 * Member-only user. AC-8: the hardcoded `"Document not found"` fallback is GONE
 * — the not-found view (`documents.notFound`) renders whenever the query errored
 * and there is no data (the god-page's "document is null" behaviour).
 *
 * A79: status/tag/restore/version-upload are mutations invalidating the detail
 * (+ list) keys (replacing the manual `fetchDocument()`); success/error toasts
 * keep the god-page's 3000 ms auto-dismiss; the A76 download error is a sticky
 * banner surfaced from the download hook.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { formatFileSize, getStatusColor } from "@/lib/services/documents";
import { DocumentStatus } from "../types/board-document.types";
import { useBoardDocument } from "../hooks/use-board-document";
import { useBoardDocumentMutations } from "../hooks/use-board-document-mutations";
import { useBoardDocumentDownload } from "../hooks/use-board-document-download";
import { BoardDocumentDownloadButton } from "./board-document-download-button";
import { BoardDocumentTagEditor } from "./board-document-tag-editor";
import { BoardDocumentVersionHistory } from "./board-document-version-history";
import { BoardDocumentVersionDialog } from "./board-document-version-dialog";
import { BoardDocumentRestoreDialog } from "./board-document-restore-dialog";

interface BoardDocumentDetailProps {
  id: string;
}

export function BoardDocumentDetail({ id }: BoardDocumentDetailProps) {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  const t = useTranslations();

  const authorized = isAuthenticated && (isVorstand || isAdmin);

  const [showUploadVersion, setShowUploadVersion] = useState(false);
  const [restoreVersionNumber, setRestoreVersionNumber] = useState<
    number | null
  >(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const documentQuery = useBoardDocument(id, authorized);
  const document = documentQuery.data ?? null;

  const mutations = useBoardDocumentMutations();
  const { download } = useBoardDocumentDownload(id, document?.name ?? "");

  const handleStatusChange = (action: "review" | "publish" | "archive") => {
    setError(null);
    mutations.changeStatus.mutate(
      { id, action },
      {
        onSuccess: () => showSuccess(t("documents.statusChanged")),
        onError: () => setError(t("documents.statusChangeError")),
      }
    );
  };

  const handleSaveTags = async (tags: string[]) => {
    // `mutateAsync` so the editor can await the result: it collapses to view
    // mode only after success and stays open (text intact) on failure — the
    // god-page set `setEditingTags(false)` only inside `if (result.success)`.
    try {
      await mutations.updateTags.mutateAsync({ id, tags });
      showSuccess(t("documents.tagsSaved"));
    } catch (e) {
      // god-page parity: the tag-save failure path set a bare "Error" fallback
      // (`setError(result.error || "Error")`, [id]/page.tsx:148). Preserved as
      // the pre-existing string (S1 pins no tag-failure assertion); AC-8 only
      // licensed the `notFound` fix, so no NEW user-facing string is added.
      setError(e instanceof Error ? e.message : "Error");
      throw e; // re-throw so the editor keeps the edit mode open
    }
  };

  const handleUploadVersion = (values: { file: File; comment: string }) => {
    mutations.uploadVersion.mutate(
      { documentId: id, file: values.file, comment: values.comment },
      {
        onSuccess: () => {
          setShowUploadVersion(false);
          showSuccess(t("documents.versionUploaded"));
        },
        onError: () => setError(t("documents.uploadError")),
      }
    );
  };

  const handleRestore = (versionNumber: number) => {
    setRestoreVersionNumber(null);
    mutations.restore.mutate(
      { id, versionNumber },
      {
        onSuccess: () => showSuccess(t("documents.versionRestored")),
        onError: () => setError(t("documents.restoreError")),
      }
    );
  };

  const handleDownload = async (versionNumber?: number) => {
    const result = await download(versionNumber);
    if (result) setError(t("documents.downloadError"));
  };

  if (authLoading || documentQuery.isLoading) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="p-8 text-center text-gray-500">
        {t("documents.notFound")}
      </div>
    );
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/board/documents"
          className="mb-4 inline-block text-sm text-orange-600 hover:underline"
        >
          &larr; {t("documents.backToList")}
        </Link>

        {success && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-700">
            {success}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
            {error}
          </div>
        )}

        {/* Header */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {document.name}
              </h1>
              <p className="mt-1 text-gray-600">{document.description}</p>
            </div>
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${getStatusColor(document.status)}`}
            >
              {document.status}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <p className="text-xs text-gray-500">{t("documents.category")}</p>
              <p className="text-sm font-medium">{document.category}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("documents.size")}</p>
              <p className="text-sm font-medium">
                {formatFileSize(document.fileSize)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("documents.date")}</p>
              <p className="text-sm font-medium">
                {new Date(document.createdAt).toLocaleDateString("de-CH", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">{t("documents.type")}</p>
              <p className="text-sm font-medium">{document.contentType}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-wrap gap-2 border-t pt-4">
            <BoardDocumentDownloadButton onDownload={() => handleDownload()} />
            <button
              onClick={() => setShowUploadVersion(true)}
              className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t("documents.uploadNewVersion")}
            </button>
            {document.status === DocumentStatus.Draft && (
              <button
                onClick={() => handleStatusChange("review")}
                className="rounded-lg border border-blue-300 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50"
              >
                {t("documents.markReviewed")}
              </button>
            )}
            {(document.status === DocumentStatus.Draft ||
              document.status === DocumentStatus.Reviewed) && (
              <button
                onClick={() => handleStatusChange("publish")}
                className="rounded-lg border border-green-300 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
              >
                {t("documents.publish")}
              </button>
            )}
            {(document.status === DocumentStatus.Published ||
              document.status === DocumentStatus.Reviewed) && (
              <button
                onClick={() => handleStatusChange("archive")}
                className="rounded-lg border border-yellow-300 px-4 py-2 text-sm text-yellow-700 hover:bg-yellow-50"
              >
                {t("documents.archive")}
              </button>
            )}
          </div>
        </div>

        {/* Tags */}
        <BoardDocumentTagEditor tags={document.tags} onSave={handleSaveTags} />

        {/* Upload New Version Modal */}
        <BoardDocumentVersionDialog
          open={showUploadVersion}
          pending={mutations.uploadVersion.isPending}
          onCancel={() => setShowUploadVersion(false)}
          onSubmit={handleUploadVersion}
        />

        {/* Version History */}
        <BoardDocumentVersionHistory
          versions={document.versions}
          onDownload={(versionNumber) => handleDownload(versionNumber)}
          onRestore={(versionNumber) => setRestoreVersionNumber(versionNumber)}
        />
      </div>

      {/* Restore Version Confirmation Modal */}
      <BoardDocumentRestoreDialog
        versionNumber={restoreVersionNumber}
        onConfirm={() =>
          restoreVersionNumber !== null && handleRestore(restoreVersionNumber)
        }
        onCancel={() => setRestoreVersionNumber(null)}
      />
    </main>
  );
}
