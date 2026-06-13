// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The public forms slice transport (E28-S3; E31-S1 made it the real home).
 *
 * The public anonymous newsletter + unsubscribe fns were RELOCATED here verbatim
 * off the now-retired `privacy` (E31-S1, DEC-1=A). `privacy.ts`'s
 * authenticated consent/channel half moved to
 * `features/profile/api/privacy-consent.ts`. Behaviour is byte-identical to the
 * legacy module.
 *
 * BUILD the contact `submitContact` fn — the contact POST was a raw inline fetch
 * with no module. `useApiClient` is unusable here (401-gates on no-auth,
 * `auth.ts:178`), so this is a plain `fetch`, byte-identical to the god-page.
 */

import type { PublicContactValues } from "../schemas/public-contact.schema";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000";

// Public API (no auth required)
export interface UnsubscribeVerifyResult {
  alreadyUnsubscribed: boolean;
  email: string;
  unsubscribedAt?: string;
}

export interface UnsubscribeConfirmResult {
  success: boolean;
  email: string;
  message: string;
}

export async function verifyUnsubscribe(
  token: string
): Promise<UnsubscribeVerifyResult> {
  const response = await fetch(
    `${baseUrl}/api/v1/public/newsletter/unsubscribe/${encodeURIComponent(token)}`
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Invalid token");
  }
  return response.json();
}

export async function confirmUnsubscribe(
  token: string
): Promise<UnsubscribeConfirmResult> {
  const response = await fetch(
    `${baseUrl}/api/v1/public/newsletter/unsubscribe/${encodeURIComponent(token)}`,
    { method: "POST" }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Unsubscribe failed");
  }
  return response.json();
}

export async function subscribeNewsletter(
  email: string,
  firstName?: string,
  lastName?: string
): Promise<{ success: boolean; message: string }> {
  const response = await fetch(
    `${baseUrl}/api/v1/public/newsletter/subscribe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, firstName, lastName }),
    }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Subscribe failed");
  }
  return response.json();
}

export async function unsubscribeByEmail(
  email: string
): Promise<{ success: boolean; email: string; message: string }> {
  const response = await fetch(
    `${baseUrl}/api/v1/public/newsletter/unsubscribe`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }
  );
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error ?? "Unsubscribe failed");
  }
  return response.json();
}

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
