// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * E28-S4: thin route entry for the public license page. The static AGPL-3.0
 * content now lives in the `features/public/` slice as an async Server Component
 * (`license-content.tsx`); this entry re-exports it so the route stays an async
 * Server Component (the existing RSC test's `await LicensePage()` keeps working —
 * only the import path moved). DEC-1=A.
 */
export { default } from "@/features/public/components/license-content";
