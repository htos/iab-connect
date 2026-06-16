"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * Registration success screen (E27-S6). Preserved verbatim from the god-page
 * (E27-S1 register net asserts `registration.successTitle` +
 * `registration.awaitingApproval` + the form being gone). Shown once
 * `registerUser` resolves.
 */
export function RegisterSuccess() {
  const t = useTranslations();
  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-orange-50 to-amber-100 px-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl bg-white p-8 text-center shadow-xl">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-8 w-8 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-2xl font-bold text-gray-900">
            {t("registration.successTitle")}
          </h2>
          <p className="mb-6 text-gray-600">
            {t("registration.successMessage")}
          </p>
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm text-amber-800">
              <strong>{t("registration.note")}:</strong>{" "}
              {t("registration.awaitingApproval")}
            </p>
          </div>
          <Link
            href="/login"
            className="inline-block w-full rounded-lg bg-orange-600 px-4 py-3 font-medium text-white transition-colors hover:bg-orange-700"
          >
            {t("registration.backToLogin")}
          </Link>
        </div>
      </div>
    </div>
  );
}
