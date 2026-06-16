"use client";

/**
 * REQ-018 (E2.S4): merge confirmation modal — Admin-only consumer of E2.S3's safe-merge endpoint.
 *
 * Per E2.S3 the merge is one-way and destructive (source soft-retired, references rewritten,
 * Keycloak link potentially cleared, draft invoices reassigned). UX: explicit target picker
 * (radio between the two members), free-text reason, two acknowledgement checkboxes
 * (finance impact, Keycloak impact).
 */

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DuplicateGroupDto } from "../api/member-duplicates";

interface MergeConfirmationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: DuplicateGroupDto | null;
  onConfirm: (
    sourceId: string,
    targetId: string,
    reason: string,
    confirmFinanceImpact: boolean,
    confirmKeycloakImpact: boolean
  ) => Promise<void>;
}

export function MergeConfirmationModal({
  open,
  onOpenChange,
  group,
  onConfirm,
}: MergeConfirmationModalProps) {
  const t = useTranslations();

  // REQ-018 review patch: admin MUST explicitly click a target radio. The previous default
  // (`effectiveTargetId = targetId || members[0]?.id`) silently retired members[0] when the
  // admin hit Confirm without picking a radio — a glance-and-confirm could destroy the wrong
  // record. Now both selections are required; Confirm is disabled until both are explicit.
  const members = useMemo(() => group?.members ?? [], [group]);
  const [targetId, setTargetId] = useState<string>("");
  const [sourceId, setSourceId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [confirmFinanceImpact, setConfirmFinanceImpact] = useState(false);
  const [confirmKeycloakImpact, setConfirmKeycloakImpact] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceCandidates = members.filter((m) => m.id !== targetId);
  // Two-member group: once the target is picked, the source is unambiguous. For N>2 the admin
  // must explicitly pick the source via the select; we never auto-fall-back to the first option.
  const effectiveSourceId =
    members.length === 2 && targetId
      ? (sourceCandidates[0]?.id ?? "")
      : sourceId;
  const submitDisabled =
    submitting ||
    !targetId ||
    !effectiveSourceId ||
    effectiveSourceId === targetId ||
    reason.trim().length === 0;

  function resetAndClose() {
    setTargetId("");
    setSourceId("");
    setReason("");
    setConfirmFinanceImpact(false);
    setConfirmKeycloakImpact(false);
    setError(null);
    setSubmitting(false);
    onOpenChange(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!targetId || !effectiveSourceId) {
      setError(t("members.duplicates.merge.modal.errorPickPair"));
      return;
    }
    if (effectiveSourceId === targetId) {
      setError(t("members.duplicates.merge.modal.errorSamePair"));
      return;
    }
    if (reason.trim().length === 0) {
      setError(t("members.duplicates.merge.modal.errorReasonRequired"));
      return;
    }
    if (reason.length > 500) {
      setError(t("members.duplicates.merge.modal.errorReasonTooLong"));
      return;
    }
    setSubmitting(true);
    try {
      await onConfirm(
        effectiveSourceId,
        targetId,
        reason.trim(),
        confirmFinanceImpact,
        confirmKeycloakImpact
      );
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
        className="max-w-xl bg-white"
        data-testid="merge-confirmation-modal"
      >
        <DialogHeader>
          <DialogTitle>{t("members.duplicates.merge.modal.title")}</DialogTitle>
          <DialogDescription>
            {t("members.duplicates.merge.modal.description")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <p className="mb-1 text-sm font-medium text-gray-700">
              {t("members.duplicates.merge.modal.targetPicker")}
            </p>
            <p className="mb-2 text-xs text-gray-500">
              {t("members.duplicates.merge.modal.targetPickerHint")}
            </p>
            <div className="space-y-2">
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm hover:bg-gray-50"
                >
                  <input
                    type="radio"
                    name="target"
                    value={m.id}
                    checked={targetId === m.id}
                    onChange={(e) => {
                      setTargetId(e.target.value);
                      setSourceId("");
                    }}
                    className="text-orange-600"
                    data-testid={`merge-target-${m.id}`}
                  />
                  <span className="font-medium">
                    {m.firstName} {m.lastName}
                  </span>
                  <span className="text-gray-500">— {m.email}</span>
                </label>
              ))}
            </div>
          </div>

          {targetId && sourceCandidates.length > 1 && (
            <div>
              <p className="mb-1 text-sm font-medium text-gray-700">
                {t("members.duplicates.merge.modal.sourcePicker")}
              </p>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                data-testid="merge-source"
              >
                <option value="" disabled>
                  {t("members.duplicates.merge.modal.sourcePickerPlaceholder")}
                </option>
                {sourceCandidates.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.firstName} {m.lastName} — {m.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t("members.duplicates.merge.modal.reasonLabel")}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
              data-testid="merge-reason-input"
            />
            <p className="text-xs text-gray-500">{reason.length} / 500</p>
          </div>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmFinanceImpact}
                onChange={(e) => setConfirmFinanceImpact(e.target.checked)}
                className="mt-0.5 text-orange-600"
                data-testid="merge-confirm-finance"
              />
              <span>{t("members.duplicates.merge.modal.confirmFinance")}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={confirmKeycloakImpact}
                onChange={(e) => setConfirmKeycloakImpact(e.target.checked)}
                className="mt-0.5 text-orange-600"
                data-testid="merge-confirm-keycloak"
              />
              <span>{t("members.duplicates.merge.modal.confirmKeycloak")}</span>
            </label>
          </div>

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
              {t("members.duplicates.merge.modal.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="inline-flex items-center rounded-lg bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="merge-submit"
            >
              {submitting
                ? t("members.duplicates.merge.modal.submitting")
                : t("members.duplicates.merge.modal.submit")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
