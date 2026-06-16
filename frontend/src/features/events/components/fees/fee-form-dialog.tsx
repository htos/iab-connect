"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  FEE_CURRENCIES,
  type FeeApplicability,
  type SaveFeeCategoryRequest,
} from "../../types/events.types";
import {
  buildFeeSchema,
  DESCRIPTION_MAX,
  NAME_MAX,
  type FeeFormValues,
} from "../../schemas/fee-category.schema";
import { zurichLocalInputToUtcIso } from "./datetime-zurich";

const APPLICABILITIES: FeeApplicability[] = [
  "Everyone",
  "MembersOnly",
  "PublicOnly",
];

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500";

export type FeeFormTarget = {
  mode: "create" | "edit";
  categoryId?: string;
  initial: FeeFormValues;
};

/**
 * The fee-category create/edit form, rendered inside a Radix dialog (E24-S3).
 * Behaviour-preserving (A79) copy of the god-page `FeeFormDialog`: the RHF+Zod
 * form, per-render localized schema, the same field set/ids, and the SAME submit
 * payload. The only delta is transport — the parent supplies an `onSave` that
 * routes to the slice create/update mutation (god-page called the service fns
 * inline and branched on `res.data`/`res.error`). The Zurich-local → ISO-UTC
 * conversion still happens HERE at submit, verbatim.
 */
export function FeeFormDialog({
  target,
  onClose,
  onSave,
  onError,
}: {
  target: FeeFormTarget;
  onClose: () => void;
  // Persist the built payload. Resolves with the saved DTO on success, or null
  // on failure (so this component preserves the god-page's "stay open on error"
  // behaviour while the parent surfaces the banner).
  onSave: (
    target: FeeFormTarget,
    payload: SaveFeeCategoryRequest
  ) => Promise<unknown | null>;
  onError: (message: string) => void;
}) {
  const t = useTranslations("events.fees");
  const schema = useMemo(() => buildFeeSchema(t), [t]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FeeFormValues>({
    resolver: zodResolver(schema),
    defaultValues: target.initial,
  });

  const onSubmit = async (values: FeeFormValues) => {
    const payload: SaveFeeCategoryRequest = {
      name: values.name.trim(),
      description: values.description.trim() || null,
      amount: values.amount,
      currency: values.currency,
      applicability: values.applicability,
      availableFrom: values.availableFrom
        ? zurichLocalInputToUtcIso(values.availableFrom)
        : null,
      availableUntil: values.availableUntil
        ? zurichLocalInputToUtcIso(values.availableUntil)
        : null,
      maxQuantity: values.maxQuantity ? Number(values.maxQuantity) : null,
    };
    try {
      const saved = await onSave(target, payload);
      if (saved) onClose();
      else onError(t("saveFailed"));
    } catch (err) {
      onError(err instanceof Error ? err.message : t("saveFailed"));
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {target.mode === "edit" ? t("editCategory") : t("newCategory")}
          </DialogTitle>
          <DialogDescription>{t("dialogDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("name")}
              </span>
              <input
                type="text"
                {...register("name")}
                className={inputClass}
                maxLength={NAME_MAX}
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.name.message}
                </p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("amount")}
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                {...register("amount", { valueAsNumber: true })}
                className={inputClass}
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.amount.message}
                </p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("currency")}
              </span>
              <select {...register("currency")} className={inputClass}>
                {FEE_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {errors.currency && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.currency.message}
                </p>
              )}
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("applicability")}
              </span>
              <select {...register("applicability")} className={inputClass}>
                {APPLICABILITIES.map((a) => (
                  <option key={a} value={a}>
                    {t(`applicabilityOptions.${a}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("availableFrom")}
              </span>
              <input
                type="datetime-local"
                {...register("availableFrom")}
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("availableUntil")}
              </span>
              <input
                type="datetime-local"
                {...register("availableUntil")}
                className={inputClass}
              />
              {errors.availableUntil && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.availableUntil.message}
                </p>
              )}
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("maxQuantity")}
              </span>
              <input
                type="number"
                min={1}
                {...register("maxQuantity")}
                className={inputClass}
              />
              {errors.maxQuantity && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.maxQuantity.message}
                </p>
              )}
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1 block text-sm font-medium text-gray-700">
                {t("description")}
              </span>
              <textarea
                {...register("description")}
                className={inputClass}
                rows={2}
                maxLength={DESCRIPTION_MAX}
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.description.message}
                </p>
              )}
            </label>
          </div>
          <DialogFooter className="mt-4 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:opacity-50"
            >
              {t("save")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
