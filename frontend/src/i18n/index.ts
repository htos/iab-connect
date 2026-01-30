// Client-side exports only - server code is in request.ts
export { useChangeLocale } from "./client";
export type { Locale } from "./client";

// Re-export constants that don't depend on server components
export const locales = ["en", "de"] as const;
export const defaultLocale = "en";
