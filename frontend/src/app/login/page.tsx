"use client";

/**
 * Login Page for IAB Connect
 * REQ-001: Login & Zugriff (Admin und Mitglieder)
 */
import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations();

  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const errorParam = searchParams.get("error");

  // Handle error from URL
  useEffect(() => {
    if (errorParam) {
      switch (errorParam) {
        case "OAuthCallback":
          setError(t("auth.signInError"));
          break;
        case "OAuthSignin":
          setError(t("auth.keycloakNotReachable"));
          break;
        case "AccessDenied":
          setError(t("auth.accessDenied"));
          break;
        default:
          setError(t("auth.unknownError"));
      }
    }
  }, [errorParam, t]);

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
    </div>
  );
}
