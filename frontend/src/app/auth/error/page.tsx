"use client";

/**
 * Auth Error Page for IAB Connect
 * REQ-001: Handles authentication errors
 */
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

type ErrorType =
  | "Configuration"
  | "AccessDenied"
  | "Verification"
  | "OAuthSignin"
  | "OAuthCallback"
  | "OAuthCreateAccount"
  | "EmailCreateAccount"
  | "Callback"
  | "OAuthAccountNotLinked"
  | "SessionRequired"
  | "Default";

const errorMappings: Record<ErrorType, { titleKey: string; descKey: string }> = {
  Configuration: {
    titleKey: "authError.configurationError",
    descKey: "authError.configurationErrorDesc",
  },
  AccessDenied: {
    titleKey: "authError.accessDenied",
    descKey: "authError.accessDeniedDesc",
  },
  Verification: {
    titleKey: "authError.verificationFailed",
    descKey: "authError.verificationFailedDesc",
  },
  OAuthSignin: {
    titleKey: "authError.signInFailed",
    descKey: "authError.signInFailedDesc",
  },
  OAuthCallback: {
    titleKey: "authError.callbackError",
    descKey: "authError.callbackErrorDesc",
  },
  OAuthCreateAccount: {
    titleKey: "authError.accountCreationFailed",
    descKey: "authError.accountCreationFailedDesc",
  },
  EmailCreateAccount: {
    titleKey: "authError.accountCreationFailed",
    descKey: "authError.accountCreationFailedDesc",
  },
  Callback: {
    titleKey: "authError.callbackError",
    descKey: "authError.callbackErrorDesc",
  },
  OAuthAccountNotLinked: {
    titleKey: "authError.accountNotLinked",
    descKey: "authError.accountNotLinkedDesc",
  },
  SessionRequired: {
    titleKey: "auth.sessionRequired",
    descKey: "auth.sessionRequired",
  },
  Default: {
    titleKey: "authError.authenticationError",
    descKey: "authError.authenticationErrorDesc",
  },
};

export default function AuthErrorPage() {
  const t = useTranslations();
  const searchParams = useSearchParams();
  const errorType = (searchParams.get("error") ?? "Default") as ErrorType;

  const mapping = errorMappings[errorType] ?? errorMappings.Default;
  const title = t(mapping.titleKey);
  const description = t(mapping.descKey);

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-red-50 to-orange-100 px-4">
      <div className="max-w-md w-full">
        {/* Error Icon */}
        <div className="text-center mb-8">
          <div className="mx-auto h-20 w-20 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg
              className="h-10 w-10 text-red-600"
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
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="text-gray-600 mt-2">{description}</p>
        </div>

        {/* Error Card */}
        <div className="bg-white shadow-xl rounded-2xl p-8">
          <div className="space-y-4">
            <Link
              href="/login"
              className="w-full py-3 px-4 bg-orange-600 hover:bg-orange-700
                       text-white font-medium rounded-lg transition-colors duration-200
                       flex items-center justify-center gap-2"
            >
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
              <span>{t("authError.backToSignIn")}</span>
            </Link>

            <Link
              href="/"
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200
                       text-gray-700 font-medium rounded-lg transition-colors duration-200
                       flex items-center justify-center gap-2"
            >
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
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              <span>{t("authError.toHomepage")}</span>
            </Link>
          </div>

          {/* Debug info in development */}
          {process.env.NODE_ENV === "development" && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-700 mb-1">Debug Info:</p>
              <p className="text-xs text-gray-500 font-mono">Error Type: {errorType}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-sm text-gray-500">
          {t("authError.persistentProblems")}
        </p>
      </div>
    </div>
  );
}
