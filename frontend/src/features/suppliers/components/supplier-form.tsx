"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  supplierFormSchema,
  type SupplierFormValues,
} from "../schemas/supplier.schema";

interface SupplierFormProps {
  defaultValues: SupplierFormValues;
  onSubmit: (values: SupplierFormValues) => void;
  // i18n key for the submit button label (e.g. `suppliers.createSupplier`).
  submitLabel: string;
  pending: boolean;
  // API error from the create/update mutation, shown in the banner.
  errorMessage: string | null;
}

/**
 * The shared new/edit supplier form — applies the E22-S3 form sub-recipe
 * (RHF + Zod) to Suppliers (E22-S4). 7 fields (no tier/agreement — Sponsor-only).
 * Behaviour-preserving (A79): same fields, same redirect (caller's `onSubmit`),
 * same API-error banner; the only deliberate change is HTML5 `required` → Zod.
 */
const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500";

export function SupplierForm({
  defaultValues,
  onSubmit,
  submitLabel,
  pending,
  errorMessage,
}: SupplierFormProps) {
  const t = useTranslations();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierFormSchema),
    defaultValues,
  });

  return (
    <>
      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-red-700">{errorMessage}</p>
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="rounded-xl bg-white p-6 shadow-sm"
      >
        <div className="space-y-6">
          {/* Company Info */}
          <div>
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              {t("suppliers.companyInfo")}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label
                  htmlFor="companyName"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("suppliers.companyName")} *
                </label>
                <input
                  type="text"
                  id="companyName"
                  className={inputClass}
                  {...register("companyName")}
                />
                {errors.companyName && (
                  <p className="mt-1 text-sm text-red-600">
                    {t(errors.companyName.message ?? "form.required")}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="contactPerson"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("suppliers.contactPerson")}
                </label>
                <input
                  type="text"
                  id="contactPerson"
                  className={inputClass}
                  {...register("contactPerson")}
                />
              </div>
              <div>
                <label
                  htmlFor="category"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("suppliers.category")}
                </label>
                <input
                  type="text"
                  id="category"
                  placeholder={t("suppliers.categoryPlaceholder")}
                  className={inputClass}
                  {...register("category")}
                />
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              {t("suppliers.contactInfo")}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.email")}
                </label>
                <input
                  type="email"
                  id="email"
                  className={inputClass}
                  {...register("email")}
                />
              </div>
              <div>
                <label
                  htmlFor="phone"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.phone")}
                </label>
                <input
                  type="tel"
                  id="phone"
                  className={inputClass}
                  {...register("phone")}
                />
              </div>
              <div className="md:col-span-2">
                <label
                  htmlFor="website"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("suppliers.website")}
                </label>
                <input
                  type="url"
                  id="website"
                  placeholder="https://"
                  className={inputClass}
                  {...register("website")}
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="notes"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              {t("suppliers.notes")}
            </label>
            <textarea
              id="notes"
              rows={4}
              className={inputClass}
              {...register("notes")}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-8 flex justify-end gap-4 border-t border-gray-200 pt-6">
          <Link
            href="/suppliers"
            className="rounded-lg border border-gray-300 px-6 py-2 transition-colors hover:bg-gray-50"
          >
            {t("common.cancel")}
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-orange-600 px-6 py-2 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? t("common.saving") : t(submitLabel)}
          </button>
        </div>
      </form>
    </>
  );
}
