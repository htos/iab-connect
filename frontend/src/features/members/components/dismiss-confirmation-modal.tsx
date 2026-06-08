"use client";

/**
 * REQ-018 (E2.S4): "Mark this group as NOT duplicates" confirmation modal.
 *
 * REQ-018 review patch (D6): cascade-dismiss — for an N-member group, this modal collects ONE
 * free-text reason and the page-level handler dismisses every C(N,2) canonical pair in one click.
 * Previously the admin had to pick a specific pair and the other C(N,2)-1 pairs reappeared on
 * the next refresh, which was UX bait. The reason is reused for every emitted pair-row.
 *
 * Submits to `POST /api/v1/members/duplicate-dismissals` per pair (parallel). Idempotent — a
 * re-dismissal of an already-dismissed pair returns the existing row (created=false).
 */

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DuplicateGroupDto } from "@/lib/api/members";

interface DismissConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DuplicateGroupDto | null;
  /**
   * Called with the free-text reason. The handler iterates the group members and dismisses
   * every C(N,2) canonical pair.
   */
  onConfirm: (reason: string) => Promise<void>;
}

export function DismissConfirmationModal({
  open,
  onOpenChange,
  group,
  onConfirm,
}: DismissConfirmationModalProps) {
  const t = useTranslations();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = group?.members ?? [];
  const pairCount = useMemo(() => {
    const n = members.length;
    return n < 2 ? 0 : (n * (n - 1)) / 2;
  }, [members.length]);

  function resetAndClose() {
    setReason("");
    setError(null);
    setSubmitting(false);
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (members.length < 2) {
      setError(t("members.duplicates.dismiss.errorSelectPair"));
      return;
    }
    if (reason.trim().length === 0) {
      setError(t("members.duplicates.dismiss.errorReasonRequired"));
      return;
    }
    if (reason.length > 500) {
      setError(t("members.duplicates.dismiss.errorReasonTooLong"));
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-white"
        data-testid="dismiss-confirmation-modal"
      >
        <DialogHeader>
          <DialogTitle>
            {t("members.duplicates.dismiss.modal.title")}
          </DialogTitle>
          <DialogDescription>
            {t("members.duplicates.dismiss.modal.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3">
          {members.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-800">
                {t("members.duplicates.dismiss.modal.scopeHeader", {
                  count: members.length,
                  pairs: pairCount,
                })}
              </p>
              <ul className="mt-2 space-y-1 text-gray-700">
                {members.map((m) => (
                  <li key={m.id}>
                    {m.firstName} {m.lastName} —{" "}
                    <span className="text-gray-500">{m.email}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <label className="block text-sm font-medium text-gray-700">
            {t("members.duplicates.dismiss.modal.reasonLabel")}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
            placeholder={t(
              "members.duplicates.dismiss.modal.reasonPlaceholder"
            )}
            data-testid="dismiss-reason-input"
          />
          <p className="text-xs text-gray-500">{reason.length} / 500</p>

          {error && (
            <p
              className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700"
              role="alert"
            >
              {error}
            </p>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={resetAndClose}
              disabled={submitting}
              className="inline-flex items-center rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {t("members.duplicates.dismiss.modal.cancel")}
            </button>
            <button
              type="submit"
              disabled={
                submitting || members.length < 2 || reason.trim().length === 0
              }
              className="inline-flex items-center rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="dismiss-submit"
            >
              {submitting
                ? t("members.duplicates.dismiss.modal.submitting")
                : t("members.duplicates.dismiss.modal.submit")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
