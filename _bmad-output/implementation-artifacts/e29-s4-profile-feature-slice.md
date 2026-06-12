# Story E29.S4: Profile — Feature-Slice Extraction (profile + security)

Status: ready-for-dev

Depends on: **E29-S1 (this net must be green at HEAD first)**, plus E21-S3 + E21-S5 (closed) and the **E22 RHF+Zod form sub-recipe** (closed — reused for the profile edit form). Inherits E21-S1 boundary decisions (DEC-1 `useApiClient`, DEC-2 destructive colours). Independent of S2/S3 once S1 is green. **Closes the program's small-surface backlog.**

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a maintainer,
I want the Profile and Profile Security pages refactored into a `src/features/profile/` feature-slice following the proven slice shape + the E22 form sub-recipe,
so that the member self-service surface matches the standard architecture with the consent, channel-preference, and session/security behaviours preserved exactly.

## Acceptance Criteria

**Behaviour preserved (all E29-S1 profile + security tests stay green):**

1. `/profile` works **exactly** as before: the guard matrix (`!isAuthenticated` → `/login`; authenticated-but-`!isMember` → `/`; member with a `GET /api/v1/members/me` **404** → the no-member-record view with the `isAdmin||isVorstand`-vs-member message + `/admin` and `/profile/security` links), the `/members/me` load + skeleton, the view↔edit toggle, the profile `PUT /api/v1/members/me` submit (success closes edit + updates state; error surfaces the banner + stays in edit), Cancel reset, and all `profile.*`/`form.*`/`status.*`/`membershipType.*`/`common.*`/`error.*` i18n.

2. **Consent (A76 — three branches, preserved verbatim):** the `getConsents` load whose failure is **silently swallowed** (empty catch, non-critical); the grant/revoke toggle whose **success** sets a message + **auto-dismisses after 3000 ms**; and whose **explicit error** sets a message with **no timer**. All three branches preserved exactly.

3. The **channel-preferences card** works exactly as before (load via `getChannelPreference`; radio change → `updateChannelPreference` → refetch + success/error message; disabled "coming soon" channels rendered `.opacity-60`; radios disabled while saving). The existing `ChannelPreferencesCard.test.tsx` stays green.

4. `/profile/security` works **exactly** as before: the `!isAuthenticated` → `/login` guard (no member check), the `getMySessions` load (best-effort — empty list on error, no error surface), the session-list render (ipAddress fallback, `start`/`lastAccess` via `formatDateTime`, `clients[]` badges), the `noSessions` empty state, and the **revoke** action (`window.confirm(revokeConfirm)` → `revokeMySession` → **optimistic removal** from the list + success message **auto-dismiss 4000 ms**; error message no-timer; the button disabled while `revokingSessionId`). Revoke is the **only** mutating action — no device-change action exists; do NOT add one.

**Improvements:**

5. `app/profile/page.tsx` and `app/profile/security/page.tsx` become **thin entries** (no `"use client"`) each rendering a `features/profile/components` content component (the only `"use client"` is the composition root).

6. A `features/profile/` slice exists mirroring `features/sponsors/`:
   - `api/profile-api.ts` — encapsulated `/api/v1/members/me`, consent (`/api/v1/privacy/consents` + `/{type}`), channel-preference (`/api/v1/privacy/channel-preferences`), and session (`/api/v1/…sessions…`) URLs + a `profileKeys` query-key factory (`me` / `consents` / `channelPreference` / `sessions`). **DEC-1 (transport)** — see DEC block.
   - `hooks/` — `use-profile` (get `/members/me` `useQuery` with a no-member-record 404 branch) + `use-update-profile` (mutation invalidating `profileKeys.me`); `use-consents` + `use-toggle-consent` (mutation invalidating `profileKeys.consents`); `use-channel-preference` + `use-update-channel-preference`; `use-sessions` + `use-revoke-session` (mutation invalidating `profileKeys.sessions`, or optimistic per AC-4).
   - `schemas/profile.schema.ts` — Zod for the profile edit form (behaviour-preserving: `firstName`/`lastName`/`street`/`postalCode`/`city` required, `phone`/`country` optional; i18n-key messages `form.required`).
   - `components/` — `profile-page-content.tsx`, `profile-detail.tsx`, `profile-form.tsx` (RHF+Zod), `consent-preferences.tsx`, `channel-preferences-card.tsx` (relocating the existing `ChannelPreferencesCard` **without behaviour change**), `profile-security-content.tsx`, `session-list.tsx`.
   - `types/profile.types.ts` — re-exporting `MemberDto`/`UpdateOwnProfileRequest` (from `@/lib/api/members`), `ConsentDto`/`ChannelPreferenceDto` (from `@/lib/api/privacy`), `UserSession` (from `@/lib/api/users`) — DEC-3 = the E23-S2/E24-S2 re-export pattern (`features→lib` legal).

7. The profile edit form uses **React Hook Form + Zod** (E22 sub-recipe) behind a stable, tested contract; validation messages via next-intl (no hard-coded strings); the `PUT /members/me` round-trip (edit→prefill→update→exit-edit) is unchanged.

8. Consent toggle, channel-preference, and session revoke become **mutations** that invalidate (or optimistically update) their respective queries; the consent **silent-load** / **success-3 s-timer** / **explicit-error-no-timer** branches and the session **optimistic-removal + 4 s timer** are preserved exactly (A76). The manual→TanStack deltas (A79) are decided explicitly (retry / refetch-spinner / sticky-error / how the auto-dismiss timers coexist with mutation state) and documented.

9. i18n parity: reuse the existing `profile.*`/`form.*`/`status.*`/`profileSecurity.*`/`channelPreferences.*` keys; if `hi.json` lacks parity for the touched set, bring it to parity and keep `messages.parity.test.ts` green (hi may stay a subset; record the baseline; no key renames/removals — hi.json currently has **zero** profile keys, so this is a net-add to parity, not a rename).

10. No new `any`, no new hard-coded user-facing strings, no new direct `/api/v1` URL in route files, no duplicate UI primitive. The 404 no-member-record view's admin-vs-member branch + links are preserved verbatim.

## Tasks / Subtasks

- [ ] Task 0: Verify prerequisites + resolve the DECs (AC: all) — record A43 (a)/(b)/(c) per DEC
  - [ ] E29-S1 profile + security specs green at HEAD. Confirm `features/profile/` does NOT exist. **A56 correction:** `ChannelPreferencesCard.test.tsx` ALREADY exists (3 tests) — relocate the component, keep the test green (move/adjust the import path only). Re-read both pages + `lib/api/privacy.ts` + `lib/api/members.ts` + `lib/api/users.ts` + the sponsors slice (A56).
  - [ ] **DEC-1 (transport):** recommended **A** — migrate the profile `/members/me` GET/PUT (currently raw `fetch` + `useAuth().accessToken`) to `useApiClient` via `profile-api.ts`; keep consent/channel/session on their existing `@/lib/api/privacy`/`@/lib/api/users` modules wrapped behind the slice `api`/hooks (those modules already centralize the URLs). Secondary: migrate everything to `useApiClient` (larger blast radius into privacy/users modules — out of scope unless trivial).
  - [ ] **DEC-2 (edit form):** recommended **A** — adopt the E22 RHF+Zod sub-recipe (epic goal; behaviour-preserving). Secondary: keep manual `useState` (misses the goal).
  - [ ] **DEC-3 (type home):** recommended **re-export** from `@/lib/api/{members,privacy,users}` via `types/profile.types.ts` (boundary-legal `features→lib`).
  - [ ] **DEC-4 (consent/session mutation semantics):** recommended **TanStack mutations** with the A76 branches preserved — consent: silent-load (query `onError` no-op surface) + success-3 s-timer + explicit-error-no-timer; session: optimistic removal via `setQueryData` + 4 s success timer + error path. Document how the timers coexist with mutation state (A79).
- [ ] Task 1: Scaffold slice `api` + `types` + `schemas` (AC: 6, 7) — `profile-api.ts` (`profileKeys` {me/consents/channelPreference/sessions} + fns; `/members/me` via `useApiClient`, consent/channel/session wrapping the privacy/users modules; URLs/bodies byte-identical) + `types/profile.types.ts` (re-export) + `schemas/profile.schema.ts` + `profile-api.test.ts`.
- [ ] Task 2: Hooks (AC: 6, 7, 8) — `use-profile` (+404 no-member branch) / `use-update-profile`; `use-consents` / `use-toggle-consent`; `use-channel-preference` / `use-update-channel-preference`; `use-sessions` / `use-revoke-session` (optimistic). Invalidation on the right keys. `use-profile.test.tsx` + a consent + a session mutation test.
- [ ] Task 3: Components — profile (AC: 1, 2, 3, 5, 6, 7) — `profile-page-content.tsx` (single `"use client"`; the guard matrix + 404 no-member view with admin-vs-member message + links verbatim) + `profile-detail.tsx` (view mode) + `profile-form.tsx` (RHF+Zod edit) + `consent-preferences.tsx` (three branches) + `channel-preferences-card.tsx` (relocated, behaviour-identical). Preserve the consent 3 s timer + the view↔edit toggle.
- [ ] Task 4: Components — security (AC: 4, 5, 6) — `profile-security-content.tsx` (`!isAuthenticated`→`/login` guard) + `session-list.tsx` (ip fallback / `formatDateTime` / client badges / `noSessions`) + the revoke flow (confirm → `revokeMySession` → optimistic removal + 4 s timer; error no-timer; button-disabled while revoking). Delete/revoke destructive affordance: introduce `destructive` only where a bare `confirm()` is replaced (A86).
- [ ] Task 5: Thin route entries + i18n (AC: 5, 9) — `app/profile/page.tsx` → `<ProfilePageContent/>`, `app/profile/security/page.tsx` → `<ProfileSecurityContent/>` (no `"use client"`). Add the touched `profile.*`/`profileSecurity.*`/`channelPreferences.*` keys to hi.json for parity; `messages.parity.test.ts` green; no renames/removals.
- [ ] Task 6: Green-the-net + DoD gate (AC: 1-4, 10) — E29-S1 profile + security specs green (transport-mock re-pointed; the form/consent/revoke mechanism assertions are the licensed-update surface per the S1 A76/A79 note); `ChannelPreferencesCard.test.tsx` green at its new path; new slice unit tests; `npx tsc --noEmit` + `npx eslint <changed>` + `npx prettier --check <changed>` + `npm test -- --run` clean; `next build` succeeds; LF (A73). Record the A79 timer-coexistence decision.

## Dev Notes

The **most stateful** E29 slice: a profile edit form (RHF+Zod, reusing the E22 form sub-recipe) plus three side-effecting concerns (consent, channel preferences, session/security). The consent **silent-vs-explicit failure** branches and the session **optimistic-removal** are the behavioural invariants — preserve verbatim. `ChannelPreferencesCard` relocates into the slice without behaviour change (and its existing test moves with it).

### Scope Boundaries

- In scope: `src/features/profile/` (`api`/`hooks`/`components`/`schemas`/`types`) for both profile pages; thin route entries; relocating `ChannelPreferencesCard` + its test; new slice unit tests; hi.json parity for the touched keys.
- Out of scope: any backend/route/API-contract change (the `/members/me`, privacy, and session endpoints stay byte-identical); modifying `@/lib/api/privacy.ts`/`members.ts`/`users.ts` beyond what wrapping requires; adding a device-management/"change" action that doesn't exist today (AC-4); the suppliers/sponsors/members/events/documents slices.

### Architecture Guardrails

- Mirror the sponsors slice exactly (api → `*Keys` + fns; hooks → query/mutation + invalidation; thin `"use client"` root; relative intra-slice imports only — E21-S5 boundary).
- `useApiClient` returns `{data,error,status}` and never throws (auth.ts:169-295); DEC-1=A migrates `/members/me` to it (hooks throw on `result.error`/non-2xx to drive TanStack rejection; a 404 sets the no-member-record sentinel). The privacy/users modules return their own shapes — wrap them; throw on their error to drive mutations.
- A85 (stable parent→child callbacks): the consent/channel/session toggles pass callbacks into child components; stabilize with `useCallback` (read latest state via ref) so a subscribing child effect doesn't re-fire and clobber just-set state — exactly the E23-S2 member-form lesson. A64/A78: stable mocked hooks in tests; in prod, don't keep `t` in a query dep chain.
- A86 (contextual destructive colour): the session revoke replaces a `confirm()` → may adopt the `destructive` dialog variant; preserve any existing explicit colour elsewhere.
- Do NOT change request/response contracts — `/members/me` GET/PUT body (`UpdateOwnProfileRequest` field set), consent grant/revoke URLs, channel-pref PUT body `{preferredChannel}`, the sessions GET + `revokeMySession` URL — byte-identical.
- DoD as E29-S2 (changed-files eslint/prettier; never `npm run format`; `prettier --write` only on NEW files; LF). A58/A72/A73.

### A76/A79 note on the consent + session branches (the bug-magnet surface)

The three consent branches + the session optimistic-removal are exactly what a manual→TanStack migration silently changes (the A76/A79 class):
- Consent **silent load failure** must STAY silent (don't surface a TanStack query error banner the god-page never showed).
- Consent **success 3 s auto-dismiss** vs **error no-timer** must both survive (decide how the timer coexists with `mutation.isSuccess`/`isError` — A79; the simplest is a local effect keyed on the success message, mirroring HEAD).
- Session **optimistic removal** before the network settles must be preserved (`setQueryData` on `profileKeys.sessions`, rollback on error) — a naive invalidate-on-success would re-show the row until the refetch completes (an A79 delta).
Write these at the outcome level so the mechanism (TanStack mutation) changes under a still-green S1 net.

### Decision-Needed (resolve at Task 0 per A41/A32; record A43 (a)/(b)/(c))

- **DEC-1 transport:** A) `/members/me`→`useApiClient`; consent/channel/session wrap the existing privacy/users modules. B) migrate everything to `useApiClient`. **Recommended: A.**
- **DEC-2 edit form:** A) E22 RHF+Zod. B) manual `useState`. **Recommended: A.**
- **DEC-3 type home:** A) re-export from `@/lib/api/{members,privacy,users}`. B) relocate (violates E21-S5). **Recommended: A.**
- **DEC-4 mutation/timer semantics:** A) TanStack mutations + preserve the A76 branches + the 3 s/4 s timers via local effects + optimistic session removal via `setQueryData`. B) keep manual state for the side-effects, TanStack only for `/members/me`. **Recommended: A** (the epic goal), with the timer-coexistence documented.

### Testing Requirements

- The E29-S1 profile + security specs are the regression oracle — keep green; only the transport-mock target re-points and the form/consent/revoke *mechanism* assertions are the licensed-update surface (per the S1 A76/A79 note). The guard matrix, the 404 no-member view, fetch URLs, navigation, the consent three branches, and the session optimistic removal must stay green verbatim.
- `ChannelPreferencesCard.test.tsx` moves with the component; update its import path only — keep its 3 tests green.
- Add focused slice unit tests: `profile-api` URL/key shape; `use-profile` (404→no-member sentinel); `use-toggle-consent` (success vs error branch); `use-revoke-session` (optimistic removal + rollback); the `profile-form` RHF+Zod (mirror `sponsor-form.test.tsx`). A35/A46 cleanup; A78 stable mocks.

### Project Structure Notes

- Target tree: `src/features/profile/{api/profile-api.ts, hooks/use-*.ts, components/*.tsx (incl. relocated channel-preferences-card.tsx + its .test.tsx), schemas/profile.schema.ts, types/profile.types.ts}`; thin entries at `app/profile/page.tsx` + `app/profile/security/page.tsx`.

### References

- Slice templates: `frontend/src/features/sponsors/` (`sponsor-form.tsx` + `sponsor-form.test.tsx` for the RHF+Zod form; `use-create-sponsor.ts` invalidation), `frontend/src/features/members/` (core + `types/member.types.ts` re-export), `frontend/src/features/events/` (detail slice).
- Pages to migrate: `frontend/src/app/profile/page.tsx` (guard matrix :149-159; `/members/me` GET :80-94 + PUT :183-205; 404 no-member view :243-276; edit fields :414-534; consent load :114-123 + toggle :125-147 incl. 3 s timer :141; channel card render :677), `frontend/src/app/profile/security/page.tsx` (guard :82-86; `getMySessions` :42-57; session render :165-245; revoke :63-76 incl. 4 s timer :76; `formatDateTime` :15-26), `frontend/src/app/profile/ChannelPreferencesCard.tsx` (+ its existing `.test.tsx`).
- Services to wrap: `frontend/src/lib/api/privacy.ts` (`getConsents`/`grantConsent`/`revokeConsent` :23-55; `getChannelPreference`/`updateChannelPreference` :57-97; `ConsentDto` :7-15, `ChannelPreferenceDto` :63-66), `frontend/src/lib/api/members.ts` (`UpdateOwnProfileRequest` :82-90, `MemberDto`), `frontend/src/lib/api/users.ts` (`getMySessions` :357-371, `revokeMySession` :403-423, `UserSession` :53-59).
- `frontend/src/lib/auth.ts:169-295` (`useApiClient` `{data,error,status}` + `useAuth` `accessToken`/`isMember`/role flags); `frontend/eslint.config.mjs` (E21-S5 boundary :11-65); `frontend/messages/messages.parity.test.ts` (hi may be a subset; hi has ZERO profile keys today).
- E29-S1; project-context.md A34/A56/A58/A64/A72/A73/A76/A78/A79/A83/A85/A86; `docs/architecture-frontend.md` "Pilot Result Note — Suppliers (E21-S3)" + "Form Sub-Recipe".

## Validation Notes

- Created 2026-06-12 as part of the whole-epic E29 preparation (front-loaded batch per A34). Status ready-for-dev. HARD-ordered after E29-S1. Four DECs carry recommended options for A41/A32 + A43 (a)/(b)/(c).
- **A56 spike findings (load-bearing):** Profile uses raw `fetch`+`useAuth().accessToken` for `/members/me` (DEC-1=A migrates to `useApiClient`); consent/channel via `@/lib/api/privacy`, sessions via `@/lib/api/users` (wrap). **`ChannelPreferencesCard.test.tsx` ALREADY exists** (A56 correction — relocate + keep green). The consent **three branches** (silent load / success-3 s / explicit-error-no-timer) + the session **optimistic removal + 4 s timer** are the A76/A79 invariants. hi.json has **zero** profile keys today → AC-9 is a net-add to parity, not a rename. Revoke is the ONLY security mutation (no device-change) — do not invent one (AC-4).

## Dev Agent Record

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

## Change Log

- 2026-06-12: Story created (profile + security → `src/features/profile/` slice; DEC-1 transport, DEC-2 RHF+Zod edit form, DEC-3 type re-export, DEC-4 mutation/timer semantics; A76 consent three-branch + session optimistic-removal invariants; A85 stable callbacks; ChannelPreferencesCard relocation + existing test). Status ready-for-dev. Closes the E29 small-surface backlog.
