import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

export const locales = ["en", "de", "hi"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

type Messages = Record<string, unknown>;

// Deep-merge `override` onto `base`, recursing into nested objects. Used so a
// partially-translated locale (Hindi, on an incremental expansion path) always
// resolves every key: any key absent from the override falls back to the English
// base value, never to a thrown error or a blank (E7-S3 AC-3).
function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const key of Object.keys(override)) {
    const b = base[key];
    const o = override[key];
    if (
      b &&
      o &&
      typeof b === "object" &&
      typeof o === "object" &&
      !Array.isArray(b) &&
      !Array.isArray(o)
    ) {
      out[key] = deepMerge(b as Messages, o as Messages);
    } else {
      out[key] = o;
    }
  }
  return out;
}

export default getRequestConfig(async () => {
  // Get locale from cookie, fallback to default. Unknown cookie values fall back
  // to the default locale rather than loading a missing message file.
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get("NEXT_LOCALE")?.value;
  const locale: Locale = locales.includes(cookieValue as Locale)
    ? (cookieValue as Locale)
    : defaultLocale;

  const english = (await import("../../messages/en.json")).default as Messages;

  let messages: Messages;
  if (locale === "de") {
    messages = (await import("../../messages/de.json")).default as Messages;
  } else if (locale === "hi") {
    // Overlay the (possibly partial) Hindi seed onto the complete English base so
    // every key resolves — proves both "structure introduced" and "missing keys
    // fall back safely" (AC-2 / AC-3).
    const hindi = (await import("../../messages/hi.json")).default as Messages;
    messages = deepMerge(english, hindi);
  } else {
    messages = english;
  }

  return {
    locale,
    messages,
    // Safety net: never throw on a missing message. The deep-merge above already
    // guarantees an English fallback for `hi`; this keeps a stray missing key from
    // crashing the render and surfaces a readable path instead of a blank.
    getMessageFallback: ({ key, namespace }) =>
      namespace ? `${namespace}.${key}` : key,
    onError: () => {
      // Intentionally swallow MISSING_MESSAGE (and similar) — see getMessageFallback.
    },
  };
});
