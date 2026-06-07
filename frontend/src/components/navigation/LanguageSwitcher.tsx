"use client";

/**
 * Language Switcher Component
 * Allows users to switch between English, German, and Hindi.
 * Hindi (hi) is on an incremental expansion path — un-translated keys fall back to
 * English (see src/i18n/request.ts), so the switcher is always shown (E7-S3 DEC-2).
 */
import { useTranslations } from "next-intl";
import { useChangeLocale, type Locale } from "@/i18n";

const languages: { code: Locale; flag: string }[] = [
  { code: "en", flag: "🇬🇧" },
  { code: "de", flag: "🇩🇪" },
  { code: "hi", flag: "🇮🇳" },
];

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const { currentLocale, changeLocale, isPending } = useChangeLocale();

  return (
    <div className="flex items-center gap-1">
      {languages.map((lang) => (
        <button
          key={lang.code}
          onClick={() => changeLocale(lang.code)}
          disabled={isPending || currentLocale === lang.code}
          className={`rounded-lg p-1.5 text-lg transition-all ${
            currentLocale === lang.code
              ? "bg-orange-100 ring-2 ring-orange-500"
              : "opacity-60 hover:bg-gray-100 hover:opacity-100"
          } ${isPending ? "cursor-wait opacity-50" : ""}`}
          title={t(lang.code)}
          aria-label={t(lang.code)}
        >
          {lang.flag}
        </button>
      ))}
    </div>
  );
}
