"use client";

/**
 * REQ-029: Public newsletter unsubscribe page.
 * Accessible without authentication via token in URL.
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { verifyUnsubscribe, confirmUnsubscribe } from "@/lib/api/privacy";

type PageState = "loading" | "confirm" | "already" | "success" | "error";

export default function UnsubscribePage() {
  const t = useTranslations("unsubscribe");
  const params = useParams();
  const token = params.token as string;

  const [state, setState] = useState<PageState>("loading");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setState("error");
      setErrorMessage(t("invalidToken"));
      return;
    }

    verifyUnsubscribe(token)
      .then((result) => {
        setEmail(result.email);
        setState(result.alreadyUnsubscribed ? "already" : "confirm");
      })
      .catch((err) => {
        setState("error");
        setErrorMessage(err.message || t("invalidToken"));
      });
  }, [token, t]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await confirmUnsubscribe(token);
      setState("success");
    } catch {
      setState("error");
      setErrorMessage(t("error"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {state === "loading" && (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">{t("loading")}</p>
          </div>
        )}

        {state === "confirm" && (
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <div className="h-16 w-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">{t("confirmTitle")}</h1>
            <p className="text-gray-600 mb-6">{t("confirmText", { email })}</p>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {submitting ? "..." : t("confirmButton")}
            </button>
          </div>
        )}

        {state === "already" && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
            <h1 className="text-xl font-bold text-yellow-700 mb-2">{t("title")}</h1>
            <p className="text-yellow-600">{t("alreadyUnsubscribed")}</p>
          </div>
        )}

        {state === "success" && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-green-700 mb-2">{t("success")}</h1>
            <p className="text-green-600">{t("successText")}</p>
          </div>
        )}

        {state === "error" && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
            <h1 className="text-xl font-bold text-red-700 mb-2">{t("title")}</h1>
            <p className="text-red-600">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
