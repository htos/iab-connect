"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  memberFormSchema,
  type MemberFormValues,
} from "../schemas/member.schema";
import { MembershipType } from "../types/member.types";

interface MemberFormProps {
  defaultValues: MemberFormValues;
  // create renders the membershipType select; edit does not (A79 — the god-page
  // edit had no type select and never sent membershipType).
  showMembershipType: boolean;
  onSubmit: (values: MemberFormValues) => void;
  // Fires on mount (with the prefilled defaults) and on every field change —
  // used by the content for the new "clear stale candidates on change" and the
  // edit 350ms-debounced duplicate re-check (both keyed off the live values).
  onWatch?: (values: MemberFormValues) => void;
  submitIdleLabel: string;
  submitPendingLabel: string;
  // Computed by the content: pending || hasExactMatch || (hasLikelyOnly &&
  // !confirmedProceed) — the god-page submit-button disabled rule, preserved.
  submitDisabled: boolean;
  pending: boolean;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500";

/**
 * Shared new/edit member form — the E22 RHF+Zod sub-recipe applied to Members
 * (E23-S2). Field set + labels + required markers are preserved verbatim from
 * the god-pages (A79); the only deliberate change is HTML5 `required` → Zod
 * (`form.required` key). The duplicate-detection wiring lives in the content
 * (which renders `<DuplicateWarning>` above this form and computes
 * `submitDisabled`); this form reports value changes via `onWatch` so the
 * content can drive the pre-flight (new) / debounced re-check (edit).
 */
export function MemberForm({
  defaultValues,
  showMembershipType,
  onSubmit,
  onWatch,
  submitIdleLabel,
  submitPendingLabel,
  submitDisabled,
  pending,
}: MemberFormProps) {
  const t = useTranslations();
  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<MemberFormValues>({
    resolver: zodResolver(memberFormSchema),
    defaultValues,
  });

  useEffect(() => {
    if (!onWatch) return;
    onWatch(getValues());
    // RHF's watch() subscription is the intended API for reporting field changes
    // to the content (new: clear stale candidates; edit: debounced re-check). It
    // is unsubscribed on cleanup; React Compiler skipping memoization of this
    // form is harmless (it re-renders with its parent anyway).
    // eslint-disable-next-line react-hooks/incompatible-library
    const subscription = watch((values) => onWatch(values as MemberFormValues));
    return () => subscription.unsubscribe();
  }, [onWatch, watch, getValues]);

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
            {t("members.contactDetails")}
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t("form.email")} *
              </label>
              <input
                type="email"
                id="email"
                className={inputClass}
                {...register("email")}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {t(errors.email.message ?? "form.required")}
                </p>
              )}
            </div>
            <div className="md:col-span-2">
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
          </div>
        </div>

        {/* Address */}
        <div>
          <h3 className="mb-4 text-lg font-medium text-gray-900">
            {t("members.address")}
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

        {/* Membership (create only) */}
        {showMembershipType && (
          <div>
            <h3 className="mb-4 text-lg font-medium text-gray-900">
              {t("members.membership")}
            </h3>
            <div>
              <label
                htmlFor="membershipType"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                {t("form.membershipType")} *
              </label>
              <select
                id="membershipType"
                className={inputClass}
                {...register("membershipType")}
              >
                <option value={MembershipType.Regular}>
                  {t("membershipType.regular")}
                </option>
                <option value={MembershipType.Student}>
                  {t("membershipType.student")}
                </option>
                <option value={MembershipType.Family}>
                  {t("membershipType.family")}
                </option>
                <option value={MembershipType.Honorary}>
                  {t("membershipType.honorary")}
                </option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-8 flex justify-end gap-4 border-t border-gray-200 pt-6">
        <Link
          href="/members"
          className="rounded-lg border border-gray-300 px-6 py-2 transition-colors hover:bg-gray-50"
        >
          {t("common.cancel")}
        </Link>
        <button
          type="submit"
          disabled={submitDisabled}
          className="rounded-lg bg-orange-600 px-6 py-2 text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? t(submitPendingLabel) : t(submitIdleLabel)}
        </button>
      </div>
    </form>
  );
}
