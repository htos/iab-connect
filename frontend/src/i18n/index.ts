// Client-side exports only - server code is in request.ts
export { useChangeLocale } from "./client";
export type { Locale } from "./client";

// Re-export constants that don't depend on server components.
// MUST stay byte-equal to the `locales` array in request.ts (enforced by the
// locale-list lockstep test in src/i18n/locales.lockstep.test.ts — A51).
export const locales = ["en", "de", "hi"] as const;
export const defaultLocale = "en";
