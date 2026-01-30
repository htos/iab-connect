import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["en", "de"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export default getRequestConfig(async () => {
  // Get locale from cookie, fallback to default
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get("NEXT_LOCALE");
  const locale = (localeCookie?.value as Locale) || defaultLocale;

  // Static imports for messages
  const messages =
    locale === "de"
      ? (await import("../../messages/de.json")).default
      : (await import("../../messages/en.json")).default;

  return {
    locale,
    messages,
  };
});
