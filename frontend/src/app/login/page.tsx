"use client";

/**
 * Login Page
 * REQ-001: Login & Zugriff (Admin und Mitglieder)
 */
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import { useAppSettings } from "@/components/providers/AppSettingsProvider";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const t = useTranslations();
  const { settings } = useAppSettings();

  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Derive disabled account state from URL params
  const isAccountDisabled =
    !!errorParam &&
    (!!errorDescription?.toLowerCase().includes("disabled") ||
      !!errorDescription?.toLowerCase().includes("deaktiviert") ||
      errorParam === "access_denied");

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (!errorParam || isAccountDisabled) return null;
    switch (errorParam) {
      case "OAuthCallback":
        return t("auth.signInError");
      case "OAuthSignin":
        return t("auth.keycloakNotReachable");
      case "AccessDenied":
        return t("auth.accessDenied");
      default:
        return t("auth.unknownError");
    }
  });
  const [showDisabledModal, setShowDisabledModal] = useState(isAccountDisabled);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push(callbackUrl);
    }
  }, [isAuthenticated, isLoading, router, callbackUrl]);

  const handleLogin = async () => {
    setIsSigningIn(true);
    setError(null);
    try {
      await signIn("keycloak", { callbackUrl });
    } catch {
      setError(t("auth.signInFailed"));
      setIsSigningIn(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-orange-50 to-amber-100">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-linear-to-br from-orange-50 to-amber-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo and Title — REQ-086 (E9 review patch): render from SystemSettings, no
            hardcoded branding (canonical Header.tsx pattern). */}
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

        {/* Login Card */}
        <div className="rounded-2xl bg-white p-8 shadow-xl">
          <h2 className="mb-6 text-center text-xl font-semibold text-gray-800">
            {t("auth.signIn")}
          </h2>

          {/* Error Message */}
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={isSigningIn}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3 font-medium text-white transition-colors duration-200 hover:bg-orange-700 disabled:bg-orange-400"
          >
            {isSigningIn ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
                <span>{t("auth.signingIn")}</span>
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
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                <span>{t("auth.signInWithKeycloak")}</span>
              </>
            )}
          </button>

          {/* Help Text */}
          <p className="mt-6 text-center text-sm text-gray-500">
            {t("auth.useYourCredentials", {
              organizationName: settings.applicationName,
            })}
          </p>

          {/* Forgot Password Link */}
          <p className="mt-4 text-center text-sm text-gray-600">
            <a
              href={`${process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8080"}/realms/${process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "iabconnect"}/login-actions/reset-credentials?client_id=${process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "iabconnect-frontend"}`}
              className="font-medium text-orange-600 hover:text-orange-700"
            >
              {t("auth.forgotPassword")}
            </a>
          </p>

          {/* Register Link */}
          <p className="mt-4 text-center text-sm text-gray-600">
            {t("auth.noAccount")}{" "}
            <Link
              href="/admin/register"
              className="font-medium text-orange-600 hover:text-orange-700"
            >
              {t("auth.registerHere")}
            </Link>
          </p>

          {/* Dev Credentials (only in development) */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="mb-2 text-xs font-medium text-gray-700">
                🔧 {t("auth.devCredentials")}:
              </p>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>
                  <strong>Admin:</strong> admin@iabconnect.ch / Admin-Dev-2026!
                </li>
                <li>
                  <strong>{t("roles.board")}:</strong> vorstand@iabconnect.ch /
                  Vorstand-Dev-2026!
                </li>
                <li>
                  <strong>{t("roles.member")}:</strong> member@iabconnect.ch /
                  Member-Dev-2026!
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} {settings.applicationName}
        </p>
      </div>

      {/* Account Disabled Modal */}
      {showDisabledModal && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black px-4">
          <div className="animate-in fade-in zoom-in w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl duration-200">
            <div className="text-center">
              {/* Warning Icon */}
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <svg
                  className="h-8 w-8 text-amber-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              <h3 className="mb-2 text-xl font-bold text-gray-900">
                {t("auth.accountDisabled")}
              </h3>

              <p className="mb-6 text-gray-600">
                {t("auth.accountDisabledMessage")}
              </p>

              <button
                onClick={() => setShowDisabledModal(false)}
                className="w-full rounded-lg bg-orange-600 px-4 py-3 font-medium text-white transition-colors hover:bg-orange-700"
              >
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
