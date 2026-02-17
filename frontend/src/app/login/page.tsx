"use client";

/**
 * Login Page for IAB Connect
 * REQ-001: Login & Zugriff (Admin und Mitglieder)
 */
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const t = useTranslations();

  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // Derive disabled account state from URL params
  const isAccountDisabled = !!errorParam && (
    !!errorDescription?.toLowerCase().includes("disabled") ||
    !!errorDescription?.toLowerCase().includes("deaktiviert") ||
    errorParam === "access_denied"
  );

  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(() => {
    if (!errorParam || isAccountDisabled) return null;
    switch (errorParam) {
      case "OAuthCallback": return t("auth.signInError");
      case "OAuthSignin": return t("auth.keycloakNotReachable");
      case "AccessDenied": return t("auth.accessDenied");
      default: return t("auth.unknownError");
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100 px-4">
      <div className="max-w-md w-full">
        {/* Logo and Title */}
        <div className="text-center mb-8">
          <div className="mx-auto h-20 w-20 bg-orange-600 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl text-white font-bold">IAB</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">IAB Connect</h1>
          <p className="text-gray-600 mt-2">Indischer Kulturverein Bern</p>
        </div>

        {/* Login Card */}
        <div className="bg-white shadow-xl rounded-2xl p-8">
          <h2 className="text-xl font-semibold text-center text-gray-800 mb-6">
            {t("auth.signIn")}
          </h2>

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Login Button */}
          <button
            onClick={handleLogin}
            disabled={isSigningIn}
            className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400
                     text-white font-medium rounded-lg transition-colors duration-200
                     flex items-center justify-center gap-2"
          >
            {isSigningIn ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>{t("auth.signingIn")}</span>
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
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
            {t("auth.useYourCredentials")}
          </p>

          {/* Forgot Password Link */}
          <p className="mt-4 text-center text-sm text-gray-600">
            <a
              href={`${process.env.NEXT_PUBLIC_KEYCLOAK_URL || "http://localhost:8080"}/realms/${process.env.NEXT_PUBLIC_KEYCLOAK_REALM || "iabconnect"}/login-actions/reset-credentials?client_id=${process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || "iabconnect-frontend"}`}
              className="text-orange-600 hover:text-orange-700 font-medium"
            >
              {t("auth.forgotPassword")}
            </a>
          </p>

          {/* Register Link */}
          <p className="mt-4 text-center text-sm text-gray-600">
            {t("auth.noAccount")}{" "}
            <Link href="/admin/register" className="text-orange-600 hover:text-orange-700 font-medium">
              {t("auth.registerHere")}
            </Link>
          </p>

          {/* Dev Credentials (only in development) */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-2">
                🔧 {t("auth.devCredentials")}:
              </p>
              <ul className="text-xs text-gray-600 space-y-1">
                <li>
                  <strong>Admin:</strong> admin@iabconnect.ch / Admin-Dev-2026!
                </li>
                <li>
                  <strong>{t("roles.board")}:</strong> vorstand@iabconnect.ch / Vorstand-Dev-2026!
                </li>
                <li>
                  <strong>{t("roles.member")}:</strong> member@iabconnect.ch / Member-Dev-2026!
                </li>
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-500">
          © {new Date().getFullYear()} Indischer Kulturverein Bern
        </p>
      </div>

      {/* Account Disabled Modal */}
      {showDisabledModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in duration-200">
            <div className="text-center">
              {/* Warning Icon */}
              <div className="mx-auto h-16 w-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {t("auth.accountDisabled")}
              </h3>

              <p className="text-gray-600 mb-6">
                {t("auth.accountDisabledMessage")}
              </p>

              <button
                onClick={() => setShowDisabledModal(false)}
                className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-lg transition-colors"
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
