"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  archiveBoardDocument,
  boardDocumentsKeys,
  deleteBoardDocument,
  publishBoardDocument,
  restoreBoardDocumentVersion,
  reviewBoardDocument,
  updateBoardDocumentTags,
  uploadBoardDocument,
  uploadBoardDocumentVersion,
  type UploadBoardDocumentInput,
} from "../api/board-documents-api";

export type StatusAction = "review" | "publish" | "archive";

/**
 * Mutations for the board-documents surface (E29-S3, DEC-1 = A, A79).
 *
 * Each mutation wraps an `ApiResult<T>` service call (or the raw-fetch upload)
 * and throws on failure so the caller can branch the toast (`statusChanged` vs
 * `statusChangeError`, `deleteSuccess` vs `deleteError`, etc.) — preserving the
 * god-page's `result.success ? success-toast : error-toast` behaviour exactly.
 *
 * Invalidation (A79 delta from the manual `fetchData()` refetch): every mutation
 * invalidates `boardDocumentsKeys.all`, which refetches the active list query
 * (replacing the god-page's manual `fetchData()`); the status/tag/restore/
 * version-upload mutations ALSO invalidate `detail(id)` so an open detail view
 * refetches (replacing the god-page's `fetchDocument()`). The list and detail
 * pages each call this hook; the acted-on doc id is passed per call via the
 * mutation variables, which scopes the `detail(id)` invalidation.
 *
 * Retry/spinner/error semantics: mutations use the QueryClient default
 * (retry-on-error is disabled in tests; production keeps the default). The
 * caller surfaces `isPending` on the in-flight affordance and the sticky error
 * toast on failure; there is no optimistic update (god-page parity — the view
 * only changes after the refetch lands).
 */
export function useBoardDocumentMutations() {
  const queryClient = useQueryClient();

  const invalidateAll = () =>
    queryClient.invalidateQueries({ queryKey: boardDocumentsKeys.all });

  // Invalidate both the list root and a specific detail (when scoped).
  const invalidateListAndDetail = (id: string) => {
    queryClient.invalidateQueries({ queryKey: boardDocumentsKeys.all });
    queryClient.invalidateQueries({
      queryKey: boardDocumentsKeys.detail(id),
    });
  };

  const changeStatus = useMutation({
    mutationFn: async (vars: { id: string; action: StatusAction }) => {
      const fn =
        vars.action === "review"
          ? reviewBoardDocument
          : vars.action === "publish"
            ? publishBoardDocument
            : archiveBoardDocument;
      const result = await fn(vars.id);
      if (!result.success)
        throw new Error(result.error ?? "documents.statusChangeError");
    },
    onSuccess: (_data, vars) => invalidateListAndDetail(vars.id),
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteBoardDocument(id);
      if (!result.success)
        throw new Error(result.error ?? "documents.deleteError");
    },
    onSuccess: () => invalidateAll(),
  });

  const updateTags = useMutation({
    mutationFn: async (vars: { id: string; tags: string[] }) => {
      const result = await updateBoardDocumentTags(vars.id, vars.tags);
      if (!result.success) throw new Error(result.error ?? "Error");
    },
    onSuccess: (_data, vars) => invalidateListAndDetail(vars.id),
  });

  const restore = useMutation({
    mutationFn: async (vars: { id: string; versionNumber: number }) => {
      const result = await restoreBoardDocumentVersion(
        vars.id,
        vars.versionNumber
      );
      if (!result.success)
        throw new Error(result.error ?? "documents.restoreError");
    },
    onSuccess: (_data, vars) => invalidateListAndDetail(vars.id),
  });

  const upload = useMutation({
    mutationFn: (input: UploadBoardDocumentInput) => uploadBoardDocument(input),
    onSuccess: () => invalidateAll(),
  });

  const uploadVersion = useMutation({
    mutationFn: (vars: { documentId: string; file: File; comment?: string }) =>
      uploadBoardDocumentVersion(vars),
    onSuccess: (_data, vars) => invalidateListAndDetail(vars.documentId),
  });

  return {
    changeStatus,
    deleteDoc,
    updateTags,
    restore,
    upload,
    uploadVersion,
  };
}
