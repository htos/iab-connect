// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * E28-S3: thin route entry for the public contact page. The page stays a CLIENT
 * island (DEC-2=A — the sidebar reads `applicationName` from the client
 * `AppSettingsProvider` context); the form is now RHF+Zod. The content lives in the
 * `features/public/` slice.
 */
export { default } from "@/features/public/components/contact-content";
