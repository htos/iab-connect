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

interface DeleteMemberDialogProps {
  // The member pending deletion; null closes the dialog (controlled).
  target: { id: string; name: string } | null;
  pending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

// Accessible confirm dialog composing the Radix `ui/alert-dialog` (A79: replaces
// the god-page's `confirm()`/`alert()`). The confirm action keeps the dialog open
// while the delete is in flight (pending); the parent closes it on settle. Uses
// the existing `members.deleteConfirm` i18n key for the body copy.
export function DeleteMemberDialog({
  target,
  pending,
  onConfirm,
  onOpenChange,
}: DeleteMemberDialogProps) {
  const t = useTranslations();
  return (
    <AlertDialog
      open={!!target}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("members.confirmDeleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>
            {target ? t("members.deleteConfirm", { name: target.name }) : null}
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
