// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * E28-S2: thin route entry for the public events list. The content is now an async
 * Server Component in the `features/public/` slice (fetches at request time + SSRs
 * the cards; the search + category filter is a client island). DEC-4=A.
 */
export { default } from "@/features/public/components/events-list";
