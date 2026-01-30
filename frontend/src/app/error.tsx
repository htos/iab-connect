"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">
          {t("error.somethingWentWrong")}
        </h2>
        <p className="mt-2 text-gray-600">
          {t("error.unexpectedError")}
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
        >
          {t("common.tryAgain")}
        </button>
      </div>
    </div>
  );
}
