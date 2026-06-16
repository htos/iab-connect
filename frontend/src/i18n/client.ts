"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";

export type Locale = "en" | "de" | "hi";

export function useChangeLocale() {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const currentLocale = useLocale();

  const changeLocale = (newLocale: Locale) => {
    // Set cookie for persistence
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000`;

    startTransition(() => {
      router.refresh();
    });
  };

  return {
    currentLocale: currentLocale as Locale,
    changeLocale,
    isPending,
  };
}
