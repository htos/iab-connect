// Public registration feature API (E27-S6). DEC-2 = A: the public self-signup
// form joins this slice. `@/lib/api/registration.registerUser` is a public,
// UNAUTHENTICATED raw-`fetch` function that THROWS an `Error` on a non-OK
// response (reading `error.detail` then `error.title` — A89). We WRAP it here
// (A62 wrap-don't-relocate); the page stays unguarded (public exception).
import {
  registerUser as serviceRegisterUser,
  type RegisterRequest,
  type RegisterResponse,
} from "@/lib/api/registration";

// Endpoint base (E21-S1 rule 5). The real fetch lives in the wrapped service;
// this const documents the slice's surface.
export const REGISTRATION_BASE = "/api/v1/registration";

/**
 * Register a new (disabled-until-approval) user. Delegates verbatim to the
 * public service fn — which throws on failure, so the register page content
 * surfaces the thrown `Error` to the form for the `already exists` mapping.
 */
export function registerUser(data: RegisterRequest): Promise<RegisterResponse> {
  return serviceRegisterUser(data);
}
