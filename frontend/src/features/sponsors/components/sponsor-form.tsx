"use client";

import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  sponsorFormSchema,
  type SponsorFormValues,
} from "../schemas/sponsor.schema";

interface SponsorFormProps {
  defaultValues: SponsorFormValues;
  onSubmit: (values: SponsorFormValues) => void;
  // i18n key for the submit button label (e.g. `sponsors.createSponsor`).
  submitLabel: string;
  pending: boolean;
  // API error from the create/update mutation, shown in the banner.
  errorMessage: string | null;
}

/**
 * The shared new/edit sponsor form — the form sub-recipe (E22-S3, DEC-1=A):
 * React Hook Form + Zod (`sponsorFormSchema`) feeding a typed `onSubmit`. This is
 * the template every later domain epic (E23+) inherits.
 *
 * Behaviour-preserving (A79): the 9 fields, the required fields (companyName +
 * tier), the redirect (owned by the caller's `onSubmit`), and the API-error
 * banner all match the previous manual `useState` forms. The native-validity
 * `required` attributes became Zod `required` — the only deliberate change; the
 * markup/classes are preserved.
 */
const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 transition-colors outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500";

export function SponsorForm({
  defaultValues,
  onSubmit,
  submitLabel,
  pending,
  errorMessage,
}: SponsorFormProps) {
  const t = useTranslations();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SponsorFormValues>({
    resolver: zodResolver(sponsorFormSchema),
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
              {t("sponsors.companyInfo")}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <label
                  htmlFor="companyName"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("sponsors.companyName")} *
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
                  {t("sponsors.contactPerson")}
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
                  htmlFor="tier"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("sponsors.tier")} *
                </label>
                <select id="tier" className={inputClass} {...register("tier")}>
                  <option value="Bronze">Bronze</option>
                  <option value="Silver">Silver</option>
                  <option value="Gold">Gold</option>
                  <option value="Platinum">Platinum</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              {t("sponsors.contactInfo")}
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
                  {t("sponsors.website")}
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

          {/* Agreement */}
          <div>
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              {t("sponsors.agreementInfo")}
            </h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label
                  htmlFor="agreementStart"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("sponsors.agreementStart")}
                </label>
                <input
                  type="date"
                  id="agreementStart"
                  className={inputClass}
                  {...register("agreementStart")}
                />
              </div>
              <div>
                <label
                  htmlFor="agreementEnd"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("sponsors.agreementEnd")}
                </label>
                <input
                  type="date"
                  id="agreementEnd"
                  className={inputClass}
                  {...register("agreementEnd")}
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
              {t("sponsors.notes")}
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
            href="/sponsors"
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
