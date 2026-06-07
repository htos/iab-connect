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

interface DeleteSupplierDialogProps {
  // The supplier pending deletion; null closes the dialog (controlled).
  target: { id: string; name: string } | null;
  pending: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

// Accessible confirm dialog composing the existing Radix `ui/alert-dialog`
// (AC-4: replaces the hand-rolled `fixed inset-0` overlay that had no focus
// trap / Escape / role). The confirm action keeps the dialog open while the
// delete is in flight (pending state); the parent closes it on settle.
export function DeleteSupplierDialog({
  target,
  pending,
  onConfirm,
  onOpenChange,
}: DeleteSupplierDialogProps) {
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
          <AlertDialogTitle>
            {t("suppliers.confirmDeleteTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {target
              ? t("suppliers.confirmDelete", { name: target.name })
              : null}
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
