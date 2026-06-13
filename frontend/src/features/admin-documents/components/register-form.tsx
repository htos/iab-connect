"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  registrationFormSchema,
  type RegistrationFormValues,
} from "../schemas/registration.schema";
import type { RegisterRequest } from "../types/admin-documents.types";

interface RegisterFormProps {
  // Top-level submit error (the thrown registerUser Error mapped by the content:
  // `already exists` → `registration.emailExists`, otherwise verbatim).
  submitError: string | null;
  pending: boolean;
  onSubmit: (data: RegisterRequest) => void;
  // Cleared by the content on any field change (god-page parity).
  onFieldChange: () => void;
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-orange-500 focus:ring-2 focus:ring-orange-500";

const EMPTY: RegistrationFormValues = {
  firstName: "",
  lastName: "",
  email: "",
  password: "",
  confirmPassword: "",
};

/**
 * Public registration form (E27-S6, DEC-2=A). Behaviour preserved VERBATIM from
 * the god-page (pinned by the E27-S1 register net): controlled inputs, HTML5
 * `required` on all 5 fields + `minLength={8}` on password, and a SINGLE top
 * banner that shows the client-validation error SYNCHRONOUSLY on submit (the net
 * asserts the message with a synchronous `getByText`, so the validation must NOT
 * be deferred to an async resolver).
 *
 * A96: validation is sourced from the `registrationFormSchema` Zod schema via a
 * SYNCHRONOUS `safeParse` (no `.trim()`/transform — the typed bytes are sent
 * verbatim). The single-banner UX preserves the god-page's mismatch-then-too-short
 * priority by mapping the schema issues in that order. The 4-field payload
 * (confirmPassword stripped) is what the god-page sent.
 */
export function RegisterForm({
  submitError,
  pending,
  onSubmit,
  onFieldChange,
}: RegisterFormProps) {
  const t = useTranslations();
  const [values, setValues] = useState<RegistrationFormValues>(EMPTY);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));
    setValidationError(null);
    onFieldChange();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const result = registrationFormSchema.safeParse(values);
    if (!result.success) {
      // Single banner, god-page priority: password mismatch first, then the
      // password-too-short rule, then any remaining required-field error.
      const issues = result.error.issues;
      const mismatch = issues.find(
        (i) => i.message === "registration.passwordMismatch"
      );
      const tooShort = issues.find(
        (i) => i.message === "registration.passwordTooShort"
      );
      const message =
        mismatch?.message ?? tooShort?.message ?? issues[0].message;
      setValidationError(t(message));
      return;
    }

    // A96: send the bytes verbatim; strip the confirmation field.
    onSubmit({
      email: result.data.email,
      password: result.data.password,
      firstName: result.data.firstName,
      lastName: result.data.lastName,
    });
  };

  const error = submitError ?? validationError;

  return (
    <>
      {/* Error Message (submit / client-validation) */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Info Box */}
      <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">{t("registration.infoMessage")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* First Name */}
        <div>
          <label
            htmlFor="firstName"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t("registration.firstName")} *
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            value={values.firstName}
            onChange={handleChange}
            required
            className={inputClass}
            placeholder={t("registration.firstNamePlaceholder")}
          />
        </div>

        {/* Last Name */}
        <div>
          <label
            htmlFor="lastName"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t("registration.lastName")} *
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            value={values.lastName}
            onChange={handleChange}
            required
            className={inputClass}
            placeholder={t("registration.lastNamePlaceholder")}
          />
        </div>

        {/* Email */}
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t("registration.email")} *
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={values.email}
            onChange={handleChange}
            required
            className={inputClass}
            placeholder={t("registration.emailPlaceholder")}
          />
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t("registration.password")} *
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={values.password}
            onChange={handleChange}
            required
            minLength={8}
            className={inputClass}
            placeholder={t("registration.passwordPlaceholder")}
          />
          <p className="mt-1 text-xs text-gray-500">
            {t("registration.passwordHint")}
          </p>
        </div>

        {/* Confirm Password */}
        <div>
          <label
            htmlFor="confirmPassword"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            {t("registration.confirmPassword")} *
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            value={values.confirmPassword}
            onChange={handleChange}
            required
            className={inputClass}
            placeholder={t("registration.confirmPasswordPlaceholder")}
          />
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={pending}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-orange-700 disabled:bg-orange-400"
        >
          {pending ? (
            <>
              <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
              <span>{t("registration.submitting")}</span>
            </>
          ) : (
            <>
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
              <span>{t("registration.submit")}</span>
            </>
          )}
        </button>
      </form>
    </>
  );
}
