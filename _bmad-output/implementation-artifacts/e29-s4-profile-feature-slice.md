# Story E29.S4: Profile — Feature-Slice Extraction (profile + security)

Status: done

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

- [x] Task 0: Verify prerequisites + resolve the DECs (AC: all) — A43 (a)/(b)/(c) in Debug Log
  - [x] E29-S1 profile + security specs green at HEAD. Confirmed `features/profile/` did NOT exist. **A56 confirmed:** `ChannelPreferencesCard.test.tsx` existed (3 tests) — relocated with the component (import-path change only), kept green. Re-read both pages + `lib/api/privacy.ts`/`members.ts`/`users.ts` + sponsors slice (A56).
  - [x] **DEC-1 RESOLVED → A:** `/members/me` GET/PUT migrated to `useApiClient` via `profile-api.ts`; consent/channel on `@/lib/api/privacy`, sessions on `@/lib/api/users`, wrapped (modules untouched).
  - [x] **DEC-2 RESOLVED → A:** E22 RHF+Zod edit form (`profile.schema.ts` + `profile-form.tsx`; native `required` retained on the 5 required inputs so the S1 field-set assertion survives).
  - [x] **DEC-3 RESOLVED → A:** `types/profile.types.ts` re-exports from `@/lib/api/{members,privacy,users}`.
  - [x] **DEC-4 RESOLVED → A (with a channel-card sub-decision):** TanStack mutations for consent + session (A76 branches + 3 s/4 s timers + optimistic session removal via `setQueryData`). **Sub-decision:** the relocated `ChannelPreferencesCard` keeps its internal `useState` load/save machine (wrapping the slice api channel fns) rather than separate TanStack hooks — the "relocate behaviour-identical + keep the 3 card tests green with an import-path-only change, no QueryClientProvider" constraint outranks the hook-list recommendation, and it keeps the channel A76 surface byte-unchanged (lowest risk). No unused `use-channel-preference` hooks created.
- [x] Task 1: Scaffold slice `api` + `types` + `schemas` (AC: 6, 7) — `profile-api.ts` (`profileKeys` {me/consents/channelPreference/sessions}; `getMyProfile`/`updateMyProfile` via `useApiClient`; consent/channel/session byte-identical wrappers) + `types/profile.types.ts` (re-export) + `schemas/profile.schema.ts` + `profile-api.test.ts` (10 tests).
- [x] Task 2: Hooks (AC: 6, 7, 8) — `use-profile` (+404 no-member sentinel) / `use-update-profile` (seeds `profileKeys.me` from the PUT response via `setQueryData`, does NOT invalidate — preserves the god-page "never refetch after save"); `use-consents` / `use-toggle-consent`; `use-sessions` / `use-revoke-session` (optimistic removal via `setQueryData` + rollback on error, no success-invalidate). `use-profile.test.tsx` (8 tests: 404 sentinel + consent success/error + session optimistic-removal + rollback).
- [x] Task 3: Components — profile (AC: 1, 2, 3, 5, 6, 7) — `profile-page-content.tsx` (single `"use client"`; guard matrix + 404 no-member admin-vs-member view + links VERBATIM) + `profile-detail.tsx` + `profile-form.tsx` (RHF+Zod, 5 tests) + `consent-preferences.tsx` (THREE branches: silent load / success-3 s / error-no-timer via local `useRef` timer) + `channel-preferences-card.tsx` (relocated, behaviour-identical, 3 tests).
- [x] Task 4: Components — security (AC: 4, 5, 6) — `profile-security-content.tsx` (`!isAuthenticated`→`/login` guard; **the load-failure ALERT banner PRESERVED per the S1 net — the AC-4 "no error surface" wording was wrong; the shipped code + S1 spec show an alert**) + `session-list.tsx` (ip fallback / `formatDateTime` / client badges / `noSessions`). Revoke flow: confirm → `revokeMySession` → optimistic removal + 4 s timer; error no-timer + rollback; button-disabled while revoking. (No bare `confirm()`→destructive-dialog change needed here — the revoke kept its existing confirm UX; A86 contextual.)
- [x] Task 5: Thin route entries + i18n (AC: 5, 9) — `app/profile/page.tsx` → `<ProfilePageContent/>`, `app/profile/security/page.tsx` → `<ProfileSecurityContent/>` (no `"use client"`). NO i18n file change: reused existing `profile.*`/`form.*`/`status.*`/`profileSecurity.*`/`channelPreferences.*` keys (en↔de parity holds; hi subset permitted, parity test green); no new strings.
- [x] Task 6: Green-the-net + DoD gate (AC: 1-4, 10) — profile spec **18 green** (`/members/me` transport adapted to a `useApiClient` spy — the E24-S2 DEC-1c lesson; all behavioural assertions preserved); security spec **12 green UNCHANGED**; relocated card test 3 green; +26 slice unit tests; full suite **834 passed / 99 files** (811 + 26 − 3 moved, zero regressions); `tsc --noEmit` clean; `eslint` exit 0; `prettier --check` clean (only NEW files `--write`, A72); LF; **`next build` succeeds** (run at the epic boundary). A79 timer-coexistence + optimistic-removal recorded.

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

claude-opus-4-8[1m] (dev-story orchestration + 1 general-purpose sub-agent for the full profile+security slice extraction).

### Debug Log References

**DEC-1/2/3/4 (all = recommended A) — per A43, autonomous mode ("für das ganze epic … ohne stop"):**
- **DEC-1 (transport) = A:** (a) `/members/me` GET/PUT → `useApiClient`; consent/channel on `@/lib/api/privacy`, sessions on `@/lib/api/users`, wrapped. (b) epic-goal transport unification, minimal blast radius (privacy/users shared elsewhere); story recommended A; autonomous. (c) `profile-api.ts` `getMyProfile`/`updateMyProfile` via `useApiClient`; the S1 profile spec's `/members/me` transport adapted to a `useApiClient` spy (the E24-S2 DEC-1c lesson).
- **DEC-2 (edit form) = A:** RHF+Zod (`profile.schema.ts` + `profile-form.tsx`, native `required` retained so the S1 field-set assertion survives).
- **DEC-3 (type home) = A:** `types/profile.types.ts` re-exports from `@/lib/api/{members,privacy,users}`.
- **DEC-4 (mutation/timer) = A + channel-card sub-decision:** TanStack mutations for consent + session (A76 branches + 3 s/4 s timers + optimistic session removal via `setQueryData`); the relocated `ChannelPreferencesCard` keeps its internal `useState` machine (relocate-behaviour-identical + keep the 3 card tests green with an import-path-only change outranks the hook-list rec; keeps the channel A76 surface byte-unchanged).

### Completion Notes List

- **Behaviour preserved: profile spec 18 green (transport adapted), security spec 12 green UNCHANGED, relocated card test 3 green.** The only S1 edits are to `app/profile/page.test.tsx` and are transport-only (the licensed mechanism surface): `@/lib/auth` mock now also returns a stable `useApiClient` spy (`apiGet`/`apiPut`); `vi.stubGlobal("fetch")` for `/members/me` replaced by `apiGet`/`apiPut` mockImplementations; assertions read the apiClient spy calls + the PUT body from the positional arg. Every behavioural assertion (guard matrix, consent 3 branches, view↔edit, PUT success/error, no-member view) preserved.
- **Consent THREE branches (A76):** `useConsents` query error never surfaced (reads `data ?? []`) → silent load stays silent; `useToggleConsent` drives explicit `onSuccess`/`onError` → success message + local `useRef` 3000 ms timer, error message NO timer. TanStack never owns the toast (mirrors HEAD).
- **Session optimistic removal (A79):** `useRevokeSession.onMutate` snapshots + `setQueryData` removes the row BEFORE the network settles; `onError` rolls back (error → row re-appears); deliberately does NOT invalidate on success (a naive invalidate would re-show the row until refetch — the A79 delta avoided). 4000 ms timers in both `onSuccess`/`onError`.
- **Profile-security ALERT banner PRESERVED** (followed the S1 net, the oracle — NOT the story AC-4 "no error surface" wording which was based on a wrong spike): `useSessions` error surfaces into the `role="alert"` banner while the list reads `data ?? []`.
- **Profile PUT-success A79 delta:** `useUpdateProfile.onSuccess` seeds `profileKeys.me` from the PUT response via `setQueryData` and does NOT invalidate (a refetch would clobber the just-saved record with the stale GET) — restores the god-page "set member from PUT response, never refetch". This fixed the only initially-red S1 assertion.
- **A85 stabilisation:** `handleToggle` (consent) + `handleRevoke` (session) are `useCallback`-stabilised; mutation outcomes drive explicit per-call `onSuccess`/`onError` rather than a subscribing effect on `mutation.isSuccess/isError`, so a re-render can't re-fire the toast and clobber a just-set message (the E23-S2 member-form lesson). `SessionList`/`ConsentPreferences` children get stable callback identities.
- **i18n:** no message-file change — reused existing keys; hi.json has zero profile keys today (a permitted subset; parity test green). No new strings.
- **Gates:** full suite **834 passed / 99 files** (811 baseline + 26 new − 3 relocated card tests; zero regressions); `tsc --noEmit` clean; `eslint` exit 0; `prettier --check` clean; LF (A73); **`next build` succeeds** (epic-boundary). privacy/users/members modules untouched; old `ChannelPreferencesCard.tsx` + test deleted (no dangling duplicate). Orchestrator re-verified independently.

### File List

**New — slice (`frontend/src/features/profile/`):**
- `api/profile-api.ts`, `api/profile-api.test.ts`
- `types/profile.types.ts`
- `schemas/profile.schema.ts`
- `hooks/use-profile.ts`, `hooks/use-update-profile.ts`, `hooks/use-consents.ts`, `hooks/use-toggle-consent.ts`, `hooks/use-sessions.ts`, `hooks/use-revoke-session.ts`, `hooks/use-profile.test.tsx`
- `components/profile-page-content.tsx`, `profile-detail.tsx`, `profile-form.tsx`, `profile-form.test.tsx`, `consent-preferences.tsx`, `channel-preferences-card.tsx` (relocated), `channel-preferences-card.test.tsx` (relocated), `profile-security-content.tsx`, `session-list.tsx`

**Modified — thin route entries + spec transport adaptation:** `frontend/src/app/profile/page.tsx`, `frontend/src/app/profile/security/page.tsx`, `frontend/src/app/profile/page.test.tsx` (transport-only). `security/page.test.tsx` UNCHANGED.

**Deleted (card relocation):** `frontend/src/app/profile/ChannelPreferencesCard.tsx`, `frontend/src/app/profile/ChannelPreferencesCard.test.tsx`.

**Untouched:** `frontend/src/lib/api/privacy.ts`, `frontend/src/lib/api/members.ts`, `frontend/src/lib/api/users.ts`.

**Tracking:** `_bmad-output/implementation-artifacts/sprint-status.yaml` (e29-s4 → review).

## Change Log

- 2026-06-12: Story created (profile + security → `src/features/profile/` slice; DEC-1 transport, DEC-2 RHF+Zod, DEC-3 type re-export, DEC-4 mutation/timer; A76 consent three-branch + session optimistic-removal; A85; ChannelPreferencesCard relocation). Status ready-for-dev. Closes the E29 small-surface backlog.
- 2026-06-12: Implemented. Slice scaffolded (api/types/schemas/hooks/components); both pages → thin entries; card relocated (+test); DEC-1/2/3/4=A. Profile spec transport-adapted (18 green), security spec unchanged (12), +26 slice tests; full suite 834 green; tsc/eslint/prettier clean; next build succeeds. Consent 3 branches + session optimistic-removal + security alert preserved; A85 stable callbacks. Status → review.

## Senior Developer Review (AI) — Epic-Boundary, 2026-06-12

**Outcome: Approved with patches applied (2).** Most stateful slice; guard matrix + consent THREE branches + session optimistic-removal + the security ALERT-banner-on-load-failure all preserved (the impl correctly followed the S1 net over the wrong AC-4 "silent" wording); A85 stable callbacks applied. Boundary patches: **P4** `use-profile` retried the deterministic 404 (no-member sentinel) before the no-member view — now excluded from retry; **P5** the profile-edit Zod schema trimmed the PUT body — now byte-identical to HEAD (de-trimmed). 3 deferred (E29-CR-D1 revoke transient state / E29-CR-D3 concurrent-revoke / E29-CR-D4 consent-toast-on-refetch-fail). Full review + patch detail: `epic-29-boundary-review-2026-06-12.md`.
