// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * E28-S3: the public forms slice transport (DEC-1=A).
 *
 * WRAP (thin re-export) the existing `@/lib/api/privacy` public fns for newsletter +
 * unsubscribe — `privacy.ts` is NOT edited (A87/A94; it also owns authenticated
 * consent/channel endpoints used elsewhere, so it is not relocated). The re-export
 * is a live binding, so a test that mocks `@/lib/api/privacy` still intercepts these
 * (the S1 form specs rely on this).
 *
 * BUILD the contact `submitContact` fn — the contact POST was a raw inline fetch with
 * no module. `useApiClient` is unusable here (401-gates on no-auth, `auth.ts:178`),
 * so this is a plain `fetch`, byte-identical to the god-page.
 */

export {
  subscribeNewsletter,
  unsubscribeByEmail,
  verifyUnsubscribe,
  confirmUnsubscribe,
} from "@/lib/api/privacy";

import type { PublicContactValues } from "../schemas/public-contact.schema";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

/**
 * Contact submit — `POST /api/v1/public/contact` with the byte-identical payload
 * `{ name, email, subject, message, website }` (the honeypot `website` STAYS in the
 * body). Throws on a non-2xx so the caller flips to the error state, mirroring the
 * god-page's `throw new Error("Request failed")`.
 */
export async function submitContact(
  payload: PublicContactValues
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/v1/public/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Request failed");
}
