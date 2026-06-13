"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { verifyUnsubscribe, confirmUnsubscribe } from "../api/public-forms-api";

type PageState = "loading" | "confirm" | "already" | "success" | "error";

/**
 * E28-S3: the public unsubscribe-by-token flow (client state-machine island —
 * DEC-5=A, explicitly NOT an RHF form: it has no editable inputs, only a confirm
 * button). `verifyUnsubscribe(token)` on mount → `confirm`/`already`;
 * `confirmUnsubscribe(token)` → `success`. The five `PageState` renders + the error
 * precedence (`invalidToken` / `err.message` / `error`) are preserved verbatim. NO
 * redirect / NO auth check (middleware exempts `/public/unsubscribe*`).
 */
export default function UnsubscribeFlow() {
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
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="w-full max-w-md">
        {state === "loading" && (
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-orange-600"></div>
            <p className="mt-4 text-gray-600">{t("loading")}</p>
          </div>
        )}

        {state === "confirm" && (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100">
              <svg
                className="h-8 w-8 text-orange-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-xl font-bold text-gray-900">
              {t("confirmTitle")}
            </h1>
            <p className="mb-6 text-gray-600">{t("confirmText", { email })}</p>
            <button
              onClick={handleConfirm}
              disabled={submitting}
              className="w-full rounded-lg bg-orange-600 px-6 py-3 font-medium text-white transition-colors hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "..." : t("confirmButton")}
            </button>
          </div>
        )}

        {state === "already" && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-8 text-center">
            <h1 className="mb-2 text-xl font-bold text-yellow-700">
              {t("title")}
            </h1>
            <p className="text-yellow-600">{t("alreadyUnsubscribed")}</p>
          </div>
        )}

        {state === "success" && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-8 text-center">
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
            <h1 className="mb-2 text-xl font-bold text-green-700">
              {t("success")}
            </h1>
            <p className="text-green-600">{t("successText")}</p>
          </div>
        )}

        {state === "error" && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
            <h1 className="mb-2 text-xl font-bold text-red-700">
              {t("title")}
            </h1>
            <p className="text-red-600">{errorMessage}</p>
          </div>
        )}
      </div>
    </div>
  );
}
