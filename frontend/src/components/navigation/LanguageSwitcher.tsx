"use client";

/**
 * Language Switcher Component
 * Allows users to switch between English and German
 */
import { useTranslations } from "next-intl";
import { useChangeLocale, type Locale } from "@/i18n";

const languages: { code: Locale; flag: string }[] = [
  { code: "en", flag: "🇬🇧" },
  { code: "de", flag: "🇩🇪" },
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
          className={`p-1.5 rounded-lg text-lg transition-all ${
            currentLocale === lang.code
              ? "bg-orange-100 ring-2 ring-orange-500"
              : "hover:bg-gray-100 opacity-60 hover:opacity-100"
          } ${isPending ? "opacity-50 cursor-wait" : ""}`}
          title={t(lang.code)}
          aria-label={t(lang.code)}
        >
          {lang.flag}
        </button>
      ))}
    </div>
  );
}
