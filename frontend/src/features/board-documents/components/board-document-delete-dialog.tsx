"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

interface BoardDocumentDeleteDialogProps {
  // The doc id pending deletion; null closes the dialog (controlled).
  targetId: string | null;
  pending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

/**
 * Destructive delete confirm for a board document (E29-S3, A86).
 *
 * Replaces the god-page's hand-rolled `fixed inset-0` overlay (a bare in-component
 * confirm with no focus trap / Escape / role) with the accessible Radix
 * `ui/alert-dialog`. The confirm action uses the DESTRUCTIVE button variant —
 * the A86 contextual rule: a bare confirm is being replaced, so we introduce the
 * red `destructive` variant here (the per-version Restore + the status actions
 * keep their existing non-destructive styling, untouched). Mirrors
 * `delete-sponsor-dialog.tsx`. i18n keys preserved verbatim
 * (`documents.confirmDeleteTitle` / `documents.confirmDelete` / `common.delete`).
 */
export function BoardDocumentDeleteDialog({
  targetId,
  pending,
  onConfirm,
  onOpenChange,
}: BoardDocumentDeleteDialogProps) {
  const t = useTranslations();
  return (
    <AlertDialog
      open={!!targetId}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("documents.confirmDeleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("documents.confirmDelete")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>
            {t("common.cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: "destructive" })}
            disabled={pending}
            onClick={(e) => {
              // keep the dialog open during the in-flight delete; the parent
              // closes it once the mutation settles.
              e.preventDefault();
              onConfirm();
            }}
          >
            {t("common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
