"use client";

import Link from "next/link";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { eventFormSchema, type EventFormValues } from "../schemas/event.schema";
import { EventCategory, EventVisibility } from "../types/events.types";
import type { CreateEventRequest } from "../types/events.types";

/**
 * The shared new/edit event form — applies the E22 RHF+Zod form sub-recipe to
 * the Events feature (E24-S2). ONE form for both create and edit; the parent
 * supplies `defaultValues`, the `onSubmit` (which calls the create/update
 * mutation), the submit/cancel chrome targets, and the API-error banner text.
 *
 * Behaviour-preserving (A79): every field from the god-pages is reproduced with
 * the same `id`/`name` attributes (so the S1 characterization selectors keep
 * working), the same conditional sections (`isAllDay` flips the date input
 * `type`; `registrationRequired` reveals max-participants/deadline/waitlist),
 * and the SAME submit-payload shape. The one deliberate delta is the manual
 * `useState` form → RHF + Zod, and HTML5 `required` → the Zod required messages.
 *
 * Submit-payload conversion (byte-identical to the god-pages) is applied HERE
 * before calling the parent's `onSubmit`:
 * - `tags`: the raw comma string is registered as `tagsInput` (local field) and
 *   split → trim → filter(non-empty) into the `string[]` `tags` at submit.
 * - `startDate`/`endDate`: `new Date(value).toISOString()` (empty → `""`).
 * - `registrationDeadline`: ISO-UTC when present, OMITTED (set `undefined`) when
 *   blank — so it drops out of the JSON body.
 */
interface EventFormProps {
  defaultValues: EventFormValues;
  // Initial raw comma-separated tags string for the (id-only) tags input.
  defaultTagsInput: string;
  onSubmit: (payload: CreateEventRequest) => void;
  // i18n key for the submit button label (e.g. `events.actions.create`).
  submitLabel: string;
  // i18n key for the pending button label (e.g. `events.actions.creating`).
  pendingLabel: string;
  pending: boolean;
  // API error from the create/update mutation, shown in the banner.
  errorMessage: string | null;
  // Cancel/back link target (god-page: `/events` for new, `/events/{id}` for edit).
  cancelHref: string;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none transition-colors";

// RHF requires every registered field to have a slot in the form model; the raw
// tags input is a transient UI field that is split into `tags` at submit.
type EventFormModel = EventFormValues & { tagsInput: string };

export function EventForm({
  defaultValues,
  defaultTagsInput,
  onSubmit,
  submitLabel,
  pendingLabel,
  pending,
  errorMessage,
  cancelHref,
}: EventFormProps) {
  const t = useTranslations("events");
  const tCommon = useTranslations("common");
  const tLang = useTranslations("language");

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors },
  } = useForm<EventFormModel>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: { ...defaultValues, tagsInput: defaultTagsInput },
  });

  // Conditional sections mirror the god-page: `isAllDay` flips the date input
  // type; `registrationRequired` reveals the registration sub-fields.
  const isAllDay = useWatch({ control, name: "isAllDay" });
  const registrationRequired = useWatch({
    control,
    name: "registrationRequired",
  });

  const submit = (values: EventFormValues) => {
    // `tagsInput` is a transient UI field not in `eventFormSchema`, so the
    // zodResolver strips it from the validated values — read the raw comma
    // string straight from the RHF state instead.
    const tagsInput = getValues("tagsInput") ?? "";
    const tags = tagsInput
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    // Byte-identical to the god-page submit payload.
    const payload: CreateEventRequest = {
      ...values,
      tags,
      startDate: values.startDate
        ? new Date(values.startDate).toISOString()
        : "",
      endDate: values.endDate ? new Date(values.endDate).toISOString() : "",
      registrationDeadline: values.registrationDeadline
        ? new Date(values.registrationDeadline).toISOString()
        : undefined,
    };

    onSubmit(payload);
  };

  return (
    <>
      {/* Error Message */}
      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 shrink-0 text-red-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-red-800">{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(submit)} noValidate>
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Basic Info */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-1 text-lg font-semibold text-gray-900">
              {t("form.basicInfo")}
            </h2>
            <p className="mb-6 text-sm text-gray-500">
              {t("form.basicInfoDescription")}
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="title"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.title")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="title"
                  placeholder={t("form.titlePlaceholder")}
                  className={inputClass}
                  {...register("title")}
                />
                {errors.title && (
                  <p className="mt-1 text-sm text-red-600">
                    {t(errors.title.message ?? "form.required")}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="shortDescription"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.shortDescription")}
                </label>
                <input
                  type="text"
                  id="shortDescription"
                  placeholder={t("form.shortDescriptionPlaceholder")}
                  maxLength={200}
                  className={inputClass}
                  {...register("shortDescription")}
                />
              </div>

              <div>
                <label
                  htmlFor="description"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.description")}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="description"
                  rows={6}
                  placeholder={t("form.descriptionPlaceholder")}
                  className={`${inputClass} resize-none`}
                  {...register("description")}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">
                    {t(errors.description.message ?? "form.required")}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="category"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    {t("form.category")}
                  </label>
                  <select
                    id="category"
                    className={`${inputClass} bg-white`}
                    {...register("category")}
                  >
                    <option value={EventCategory.General}>
                      {t("category.general")}
                    </option>
                    <option value={EventCategory.Cultural}>
                      {t("category.cultural")}
                    </option>
                    <option value={EventCategory.Religious}>
                      {t("category.religious")}
                    </option>
                    <option value={EventCategory.Social}>
                      {t("category.social")}
                    </option>
                    <option value={EventCategory.Sports}>
                      {t("category.sports")}
                    </option>
                    <option value={EventCategory.Educational}>
                      {t("category.educational")}
                    </option>
                    <option value={EventCategory.Charity}>
                      {t("category.charity")}
                    </option>
                    <option value={EventCategory.Meeting}>
                      {t("category.meeting")}
                    </option>
                    <option value={EventCategory.Workshop}>
                      {t("category.workshop")}
                    </option>
                    <option value={EventCategory.Festival}>
                      {t("category.festival")}
                    </option>
                    <option value={EventCategory.Other}>
                      {t("category.other")}
                    </option>
                  </select>
                </div>

                {/* REQ-055 (E7-S4): optional content language */}
                <div>
                  <label
                    htmlFor="contentLanguage"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    {t("form.contentLanguage")}
                  </label>
                  <select
                    id="contentLanguage"
                    className={`${inputClass} bg-white`}
                    {...register("contentLanguage")}
                  >
                    <option value="">{t("form.contentLanguageDefault")}</option>
                    <option value="de">{tLang("de")}</option>
                    <option value="en">{tLang("en")}</option>
                    <option value="hi">{tLang("hi")}</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="visibility"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    {t("form.visibility")}
                  </label>
                  <select
                    id="visibility"
                    className={`${inputClass} bg-white`}
                    {...register("visibility")}
                  >
                    <option value={EventVisibility.Public}>
                      {t("visibility.public")}
                    </option>
                    <option value={EventVisibility.MembersOnly}>
                      {t("visibility.membersonly")}
                    </option>
                    <option value={EventVisibility.InviteOnly}>
                      {t("visibility.inviteonly")}
                    </option>
                    <option value={EventVisibility.Hidden}>
                      {t("visibility.hidden")}
                    </option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="tags"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.tags")}
                </label>
                {/* God-page parity: the tags input has only an `id`, no `name`.
                    RHF registers it as the transient `tagsInput` model field
                    (split → trim → filter into `tags[]` at submit); `register`
                    sets `name="tagsInput"`, so the S1 selector now targets
                    `#tags` (id-only), which is preserved. */}
                <input
                  type="text"
                  id="tags"
                  placeholder={t("form.tagsPlaceholder")}
                  className={inputClass}
                  {...register("tagsInput")}
                />
              </div>
            </div>
          </div>

          {/* Date & Time */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("form.dateTime")}
              </h2>
            </div>
            <p className="mb-6 text-sm text-gray-500">
              {t("form.dateTimeDescription")}
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isAllDay"
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  {...register("isAllDay")}
                />
                <label
                  htmlFor="isAllDay"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("form.allDayEvent")}
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="startDate"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    {t("form.startDate")}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={isAllDay ? "date" : "datetime-local"}
                    id="startDate"
                    className={inputClass}
                    {...register("startDate")}
                  />
                  {errors.startDate && (
                    <p className="mt-1 text-sm text-red-600">
                      {t(errors.startDate.message ?? "form.required")}
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="endDate"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    {t("form.endDate")} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type={isAllDay ? "date" : "datetime-local"}
                    id="endDate"
                    className={inputClass}
                    {...register("endDate")}
                  />
                  {errors.endDate && (
                    <p className="mt-1 text-sm text-red-600">
                      {t(errors.endDate.message ?? "form.required")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("form.locationSection")}
              </h2>
            </div>
            <p className="mb-6 text-sm text-gray-500">
              {t("form.locationDescription")}
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="location"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.location")} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="location"
                  placeholder={t("form.locationPlaceholder")}
                  className={inputClass}
                  {...register("location")}
                />
                {errors.location && (
                  <p className="mt-1 text-sm text-red-600">
                    {t(errors.location.message ?? "form.required")}
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="locationAddress"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.address")}
                </label>
                <input
                  type="text"
                  id="locationAddress"
                  placeholder={t("form.addressPlaceholder")}
                  className={inputClass}
                  {...register("locationAddress")}
                />
              </div>

              <div>
                <label
                  htmlFor="locationUrl"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.locationUrl")}
                </label>
                <input
                  type="url"
                  id="locationUrl"
                  placeholder={t("form.locationUrlPlaceholder")}
                  className={inputClass}
                  {...register("locationUrl")}
                />
              </div>
            </div>
          </div>

          {/* Registration */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("registration.title")}
              </h2>
            </div>
            <p className="mb-6 text-sm text-gray-500">
              {t("registration.description")}
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="registrationRequired"
                  className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  {...register("registrationRequired")}
                />
                <label
                  htmlFor="registrationRequired"
                  className="text-sm font-medium text-gray-700"
                >
                  {t("registration.required")}
                </label>
              </div>

              {registrationRequired && (
                <>
                  <div>
                    <label
                      htmlFor="maxParticipants"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      {t("registration.maxParticipants")}
                    </label>
                    <input
                      type="number"
                      id="maxParticipants"
                      min="1"
                      placeholder={t("registration.maxParticipantsPlaceholder")}
                      className={inputClass}
                      {...register("maxParticipants", {
                        setValueAs: (v) =>
                          v === "" || v == null ? undefined : parseFloat(v),
                      })}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="registrationDeadline"
                      className="mb-1 block text-sm font-medium text-gray-700"
                    >
                      {t("registration.deadline")}
                    </label>
                    <input
                      type="datetime-local"
                      id="registrationDeadline"
                      className={inputClass}
                      {...register("registrationDeadline")}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="waitlistEnabled"
                      className="h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      {...register("waitlistEnabled")}
                    />
                    <label
                      htmlFor="waitlistEnabled"
                      className="text-sm font-medium text-gray-700"
                    >
                      {t("registration.waitlistEnabled")}
                    </label>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Cost */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("form.costSection")}
              </h2>
            </div>
            <p className="mb-6 text-sm text-gray-500">
              {t("form.costDescription")}
            </p>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="cost"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.cost")} (CHF)
                </label>
                <input
                  type="number"
                  id="cost"
                  min="0"
                  step="0.01"
                  placeholder={t("form.costPlaceholder")}
                  className={inputClass}
                  {...register("cost", {
                    setValueAs: (v) =>
                      v === "" || v == null ? undefined : parseFloat(v),
                  })}
                />
              </div>

              <div>
                <label
                  htmlFor="costDescription"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.costDescriptionLabel")}
                </label>
                <input
                  type="text"
                  id="costDescription"
                  placeholder={t("form.costDescriptionPlaceholder")}
                  className={inputClass}
                  {...register("costDescription")}
                />
              </div>
            </div>
          </div>

          {/* Contact & Image */}
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <div className="mb-1 flex items-center gap-2">
              <svg
                className="h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-gray-900">
                {t("form.contactSection")}
              </h2>
            </div>
            <p className="mb-6 text-sm text-gray-500">
              {t("form.contactDescription")}
            </p>

            <div className="space-y-4">
              {/* `organizerName` exists only on the NEW god-page; on edit the
                  field is absent but the model carries it (defaulted ""). It is
                  always registered so the create payload preserves it. */}
              <div>
                <label
                  htmlFor="organizerName"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.organizerName")}
                </label>
                <input
                  type="text"
                  id="organizerName"
                  placeholder={t("form.organizerNamePlaceholder")}
                  className={inputClass}
                  {...register("organizerName")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="contactEmail"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    {t("form.contactEmail")}
                  </label>
                  <input
                    type="email"
                    id="contactEmail"
                    placeholder={t("form.contactEmailPlaceholder")}
                    className={inputClass}
                    {...register("contactEmail")}
                  />
                </div>

                <div>
                  <label
                    htmlFor="contactPhone"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    {t("form.contactPhone")}
                  </label>
                  <input
                    type="tel"
                    id="contactPhone"
                    placeholder={t("form.contactPhonePlaceholder")}
                    className={inputClass}
                    {...register("contactPhone")}
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="imageUrl"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.imageUrl")}
                </label>
                <input
                  type="url"
                  id="imageUrl"
                  placeholder={t("form.imageUrlPlaceholder")}
                  className={inputClass}
                  {...register("imageUrl")}
                />
              </div>

              <div>
                <label
                  htmlFor="imageAltText"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  {t("form.imageAltText")}
                </label>
                <input
                  type="text"
                  id="imageAltText"
                  placeholder={t("form.imageAltTextPlaceholder")}
                  className={inputClass}
                  {...register("imageAltText")}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Buttons */}
        <div className="mt-8 flex items-center justify-end gap-4">
          <Link
            href={cancelHref}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {tCommon("cancel")}
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                {t(pendingLabel)}
              </>
            ) : (
              t(submitLabel)
            )}
          </button>
        </div>
      </form>
    </>
  );
}
