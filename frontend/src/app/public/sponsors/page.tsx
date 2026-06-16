// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * E28-S2: thin route entry for the public sponsors page. The content is now an
 * async Server Component in the `features/public/` slice; this entry re-exports it
 * so the route is an RSC that fetches at request time (SEO/SSR improvement over the
 * former client `useEffect` fetch). DEC-4=A.
 */
export { default } from "@/features/public/components/sponsors-content";
