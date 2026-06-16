// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * E28-S3: thin route entry for the public newsletter page. Stays a CLIENT island
 * (DEC-2=A — the subscribe description reads `applicationName` from the client
 * `AppSettingsProvider` context); the subscribe/unsubscribe forms are now RHF+Zod.
 */
export { default } from "@/features/public/components/newsletter-content";
