"use client";

/**
 * Document Detail Page - REQ-034/035/036: Document detail with versions
 * Board members can view details, manage workflow, upload new versions
 */

import { useAuth } from "@/lib/auth";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  DocumentDetailDto,
  getDocumentById,
  reviewDocument,
  publishDocument,
  archiveDocument,
  restoreVersion,
  updateDocumentTags,
  formatFileSize,
  getStatusColor,
  getDownloadUrl,
} from "@/lib/services/documents";

export default function DocumentDetailPage() {
  const {
    isAuthenticated,
    isLoading: authLoading,
    isVorstand,
    isAdmin,
  } = useAuth();
  const router = useRouter();
  const params = useParams();
  const t = useTranslations();
  const documentId = params.id as string;

  const [document, setDocument] = useState<DocumentDetailDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showUploadVersion, setShowUploadVersion] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [versionComment, setVersionComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [editingTags, setEditingTags] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [restoreVersionNumber, setRestoreVersionNumber] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (!authLoading && (!isAuthenticated || (!isVorstand && !isAdmin))) {
      router.push("/");
    }
  }, [authLoading, isAuthenticated, isVorstand, isAdmin, router]);

  const fetchDocument = useCallback(async () => {
    setLoading(true);
    const result = await getDocumentById(documentId);
    if (result.success) {
      setDocument(result.data);
      setTagInput(result.data.tags.join(", "));
    } else {
      setError(result.error || "Document not found");
    }
    setLoading(false);
  }, [documentId]);

  useEffect(() => {
    if (isAuthenticated && (isVorstand || isAdmin)) fetchDocument();
  }, [isAuthenticated, isVorstand, isAdmin, fetchDocument]);

  const handleStatusChange = async (
    action: "review" | "publish" | "archive"
  ) => {
    setError(null);
    let result;
    if (action === "review") result = await reviewDocument(documentId);
    else if (action === "publish") result = await publishDocument(documentId);
    else result = await archiveDocument(documentId);
    if (result.success) {
      setSuccess(t("documents.statusChanged"));
      fetchDocument();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || t("documents.statusChangeError"));
    }
  };

  const handleUploadVersion = async () => {
    if (!versionFile) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", versionFile);
      if (versionComment) formData.append("comment", versionComment);

      const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";
      const { getSession } = await import("next-auth/react");
      const session = (await getSession()) as { accessToken?: string } | null;
      const response = await fetch(
        `${base}/api/v1/documents/${documentId}/upload-version`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.accessToken || ""}` },
          body: formData,
        }
      );
      if (!response.ok) throw new Error("Upload failed");
      setShowUploadVersion(false);
      setVersionFile(null);
      setVersionComment("");
      setSuccess(t("documents.versionUploaded"));
      fetchDocument();
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError(t("documents.uploadError"));
    } finally {
      setUploading(false);
    }
  };

  const handleRestoreVersion = async (versionNumber: number) => {
    setRestoreVersionNumber(null);
    const result = await restoreVersion(documentId, versionNumber);
    if (result.success) {
      setSuccess(t("documents.versionRestored"));
      fetchDocument();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || t("documents.restoreError"));
    }
  };

  const handleSaveTags = async () => {
    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const result = await updateDocumentTags(documentId, tags);
    if (result.success) {
      setEditingTags(false);
      setSuccess(t("documents.tagsSaved"));
      fetchDocument();
      setTimeout(() => setSuccess(null), 3000);
    } else {
      setError(result.error || "Error");
    }
  };

  const handleDownload = async (versionNumber?: number) => {
    const url = getDownloadUrl(documentId, versionNumber);
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
      link.setAttribute("download", document?.name || "download");
      window.document.body.appendChild(link);
      link.click();
      window.document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      setError(t("documents.downloadError"));
    }
  };

  if (authLoading || loading) {
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
            <button
              onClick={() => handleDownload()}
              className="rounded-lg bg-orange-600 px-4 py-2 text-sm text-white transition-colors hover:bg-orange-700"
            >
              {t("documents.download")}
            </button>
            <button
              onClick={() => setShowUploadVersion(true)}
              className="rounded-lg border px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              {t("documents.uploadNewVersion")}
            </button>
            {document.status === "Draft" && (
              <button
                onClick={() => handleStatusChange("review")}
                className="rounded-lg border border-blue-300 px-4 py-2 text-sm text-blue-700 hover:bg-blue-50"
              >
                {t("documents.markReviewed")}
              </button>
            )}
            {(document.status === "Draft" ||
              document.status === "Reviewed") && (
              <button
                onClick={() => handleStatusChange("publish")}
                className="rounded-lg border border-green-300 px-4 py-2 text-sm text-green-700 hover:bg-green-50"
              >
                {t("documents.publish")}
              </button>
            )}
            {(document.status === "Published" ||
              document.status === "Reviewed") && (
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
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              {t("documents.tags")}
            </h2>
            <button
              onClick={() => setEditingTags(!editingTags)}
              className="text-sm text-orange-600 hover:underline"
            >
              {editingTags ? t("common.cancel") : t("common.edit")}
            </button>
          </div>
          {editingTags ? (
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2"
                placeholder={t("documents.tagsPlaceholder")}
              />
              <button
                onClick={handleSaveTags}
                className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700"
              >
                {t("common.save")}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {document.tags.length > 0 ? (
                document.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
                  >
                    {tag}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-400">{t("documents.noTags")}</p>
              )}
            </div>
          )}
        </div>

        {/* Upload New Version Modal */}
        {showUploadVersion && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
              <h2 className="mb-4 text-xl font-bold">
                {t("documents.uploadNewVersion")}
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
                      {versionFile ? (
                        <>
                          <p className="text-sm font-medium text-gray-900">
                            {versionFile.name}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatFileSize(versionFile.size)}
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
                      onChange={(e) =>
                        setVersionFile(e.target.files?.[0] || null)
                      }
                    />
                  </label>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t("documents.versionComment")}
                  </label>
                  <textarea
                    value={versionComment}
                    onChange={(e) => setVersionComment(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowUploadVersion(false)}
                  className="rounded-lg border px-4 py-2 text-gray-700 hover:bg-gray-50"
                >
                  {t("common.cancel")}
                </button>
                <button
                  onClick={handleUploadVersion}
                  disabled={!versionFile || uploading}
                  className="rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
                >
                  {uploading ? t("documents.uploading") : t("documents.upload")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Version History */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            {t("documents.versionHistory")}
          </h2>
          {document.versions.length === 0 ? (
            <p className="text-sm text-gray-400">{t("documents.noVersions")}</p>
          ) : (
            <div className="space-y-3">
              {document.versions.map((version, index) => (
                <div
                  key={version.id}
                  className={`flex items-center justify-between rounded-lg p-3 ${index === 0 ? "border border-orange-200 bg-orange-50" : "bg-gray-50"}`}
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      v{version.versionNumber}{" "}
                      {index === 0 && (
                        <span className="ml-1 text-xs text-orange-600">
                          ({t("documents.latest")})
                        </span>
                      )}
                    </p>
                    <p className="text-sm text-gray-600">
                      {version.comment || t("documents.noComment")}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(version.uploadedAt).toLocaleDateString(
                        "de-CH",
                        { day: "2-digit", month: "2-digit", year: "numeric" }
                      )}{" "}
                      · {formatFileSize(version.fileSize)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload(version.versionNumber)}
                      className="text-sm text-orange-600 hover:text-orange-800"
                    >
                      {t("documents.download")}
                    </button>
                    {index !== 0 && (
                      <button
                        onClick={() =>
                          setRestoreVersionNumber(version.versionNumber)
                        }
                        className="text-sm text-blue-600 hover:text-blue-800"
                      >
                        {t("documents.restore")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Restore Version Confirmation Modal */}
      {restoreVersionNumber !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                <svg
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                {t("documents.restore")}
              </h3>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              {t("documents.confirmRestore")}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRestoreVersionNumber(null)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => handleRestoreVersion(restoreVersionNumber)}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {t("documents.restore")}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
