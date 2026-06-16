"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  profileFormSchema,
  type ProfileFormValues,
} from "../schemas/profile.schema";

interface ProfileFormProps {
  defaultValues: ProfileFormValues;
  onSubmit: (values: ProfileFormValues) => void;
  onCancel: () => void;
  pending: boolean;
}

/**
 * The profile edit form — the E22 form sub-recipe (E29-S4, DEC-2=A): React Hook
 * Form + Zod (`profileFormSchema`) feeding a typed `onSubmit`.
 *
 * Behaviour-preserving (A79): the same field set + markup/classes as the
 * god-page edit form. The required fields (firstName/lastName/street/postalCode/
 * city) keep the native `required` attribute AND gain Zod `min(1)` validation;
 * phone/country stay optional. The form is `noValidate` so Zod governs blocking
 * (the sub-recipe), while the `required` DOM property remains observable. The
 * Save→exit-edit + error-banner behaviour is owned by the caller via `pending`
 * and the mutation; Cancel resets via the caller's `onCancel`.
 */
const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500";

export function ProfileForm({
  defaultValues,
  onSubmit,
  onCancel,
  pending,
}: ProfileFormProps) {
  const t = useTranslations();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues,
  });

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className="rounded-xl bg-white p-6 shadow-sm"
    >
      <div className="space-y-6">
        {/* Personal Info */}
        <div>
          <h3 className="mb-4 text-lg font-medium text-gray-900">
            {t("profile.personalInfo")}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="firstName"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t("form.firstName")} *
              </label>
              <input
                type="text"
                id="firstName"
                required
                className={inputClass}
                {...register("firstName")}
              />
              {errors.firstName && (
                <p className="mt-1 text-sm text-red-600">
                  {t(errors.firstName.message ?? "form.required")}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="lastName"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t("form.lastName")} *
              </label>
              <input
                type="text"
                id="lastName"
                required
                className={inputClass}
                {...register("lastName")}
              />
              {errors.lastName && (
                <p className="mt-1 text-sm text-red-600">
                  {t(errors.lastName.message ?? "form.required")}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div>
          <h3 className="mb-4 text-lg font-medium text-gray-900">
            {t("profile.contact")}
          </h3>
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
          <p className="mt-2 text-sm text-gray-500">
            {t("profile.emailCannotBeChanged")}
          </p>
        </div>

        {/* Address */}
        <div>
          <h3 className="mb-4 text-lg font-medium text-gray-900">
            {t("profile.address")}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label
                htmlFor="street"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t("form.street")} *
              </label>
              <input
                type="text"
                id="street"
                required
                className={inputClass}
                {...register("street")}
              />
              {errors.street && (
                <p className="mt-1 text-sm text-red-600">
                  {t(errors.street.message ?? "form.required")}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="postalCode"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t("form.postalCode")} *
              </label>
              <input
                type="text"
                id="postalCode"
                required
                className={inputClass}
                {...register("postalCode")}
              />
              {errors.postalCode && (
                <p className="mt-1 text-sm text-red-600">
                  {t(errors.postalCode.message ?? "form.required")}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="city"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t("form.city")} *
              </label>
              <input
                type="text"
                id="city"
                required
                className={inputClass}
                {...register("city")}
              />
              {errors.city && (
                <p className="mt-1 text-sm text-red-600">
                  {t(errors.city.message ?? "form.required")}
                </p>
              )}
            </div>
            <div className="md:col-span-2">
              <label
                htmlFor="country"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t("form.country")}
              </label>
              <input
                type="text"
                id="country"
                className={inputClass}
                {...register("country")}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-end gap-4 border-t border-gray-200 pt-6">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-6 py-2 transition-colors hover:bg-gray-50"
        >
          {t("common.cancel")}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-orange-600 px-6 py-2 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? t("common.saving") : t("common.save")}
        </button>
      </div>
    </form>
  );
}
