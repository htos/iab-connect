"use client";

/**
 * Registration (public self-signup) — feature-slice composition root (E27-S6,
 * DEC-2=A). The route file `app/admin/register/page.tsx` is a thin server entry
 * rendering this component; this is the single `"use client"` boundary.
 *
 * REALITY (A56): this is the PUBLIC, UNAUTHENTICATED self-signup form (POSTs to
 * /api/v1/registration). There is NO admin/approval list and NO auth guard — the
 * documented public exception. Behaviour preserved (E27-S1 register net):
 *  - the white-label branding (REQ-086): logo/org name/footer from
 *    `useAppSettings` (no hard-coded "IAB Connect");
 *  - the 5-field form, client validation (now sourced from a Zod schema via a
 *    synchronous safeParse — the net pins a synchronous single-banner error,
 *    A96), success screen;
 *  - the error mapping: a thrown Error whose message includes "already exists" →
 *    `registration.emailExists`, otherwise the verbatim message; a non-Error
 *    throw → `registration.genericError` (A89).
 */

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";
import { registerUser } from "../api/registration-api";
import { RegisterForm } from "./register-form";
import { RegisterSuccess } from "./register-success";
import type { RegisterRequest } from "../types/admin-documents.types";

export function RegisterPageContent() {
  const t = useTranslations();
  const { settings } = useAppSettings();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // The register form is PUBLIC and the E27-S1 register oracle renders the page
  // WITHOUT a QueryClientProvider — so this path uses a plain `registerUser`
  // call (via the slice api wrapper) + local `isSubmitting`, NOT a TanStack
  // mutation (A79). The api wrapper still throws on failure for the mapping.
  const handleSubmit = async (data: RegisterRequest) => {
    setError(null);
    setIsSubmitting(true);
    try {
      await registerUser(data);
      setSuccess(true);
    } catch (err) {
      if (err instanceof Error) {
        if (err.message.includes("already exists")) {
          setError(t("registration.emailExists"));
        } else {
          setError(err.message);
        }
      } else {
        setError(t("registration.genericError"));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (success) {
    return <RegisterSuccess />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-orange-50 to-amber-100 px-4 py-8">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition-colors hover:text-orange-600"
        >
          ← {t("common.back")}
        </Link>

        {/* Logo and Title */}
        <div className="mb-8 text-center">
          <div
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: settings.logoBackgroundColor }}
          >
            <span
              className="text-3xl font-bold"
              style={{ color: settings.logoTextColor }}
            >
              {settings.logoText}
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            {settings.applicationName}
          </h1>
        </div>

        {/* Registration Card */}
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="mb-6 text-center text-xl font-semibold text-gray-800">
            {t("registration.title")}
          </h2>

          <RegisterForm
            submitError={error}
            pending={isSubmitting}
            onSubmit={handleSubmit}
            onFieldChange={() => setError(null)}
          />

          {/* Login Link */}
          <p className="mt-6 text-center text-sm text-gray-600">
            {t("registration.alreadyHaveAccount")}{" "}
            <Link
              href="/login"
              className="font-medium text-orange-600 hover:text-orange-700"
            >
              {t("registration.loginHere")}
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} {settings.applicationName}
        </p>
      </div>
    </div>
  );
}
