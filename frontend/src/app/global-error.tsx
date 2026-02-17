"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="de">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center p-24">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">
              Etwas ist schiefgelaufen / Something went wrong
            </h2>
            <p className="mt-2 text-gray-600">
              Ein unerwarteter Fehler ist aufgetreten. / An unexpected error
              occurred.
            </p>
            <button
              onClick={reset}
              className="mt-6 rounded-md bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500"
            >
              Erneut versuchen / Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
