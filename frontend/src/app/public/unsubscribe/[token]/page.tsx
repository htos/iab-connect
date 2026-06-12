// SPDX-License-Identifier: AGPL-3.0-or-later
/**
 * E28-S3: thin route entry for the public unsubscribe-by-token page. Stays a CLIENT
 * state-machine island (DEC-5=A — it reads the `[token]` via `useParams`, verifies
 * on mount, and confirms; NOT an RHF form). No redirect / no auth (middleware
 * exempts `/public/unsubscribe*`).
 */
export { default } from "@/features/public/components/unsubscribe-flow";
