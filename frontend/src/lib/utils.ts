import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combines class names using clsx and tailwind-merge
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a date for display in German locale
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Formats a date with time for display in German locale
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("de-CH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Formats a currency amount. Defaults to Swiss Francs for backward compatibility, but accepts
 * an ISO-4217 code (e.g. "EUR") so white-label deployments and per-event fee currencies
 * (REQ-022 / E4) render with the correct symbol instead of a hardcoded "CHF".
 */
export function formatCurrency(
  amount: number,
  currency: string = "CHF"
): string {
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency,
  }).format(amount);
}

/**
 * Alias for formatCurrency — used in many finance pages
 */
export const formatCHF = formatCurrency;
