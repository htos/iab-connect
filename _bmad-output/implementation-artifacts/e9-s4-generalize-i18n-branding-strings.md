# Story 9.4: Generalize i18n Branding Strings

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an **Admin**,
I want **translation files free of organization-specific text**,
so that **the language files are reusable across deployments and the UI never shows another organization's name through i18n strings**.

**Requirement:** REQ-086. Epic E9, Story 4 of 4 — closes the de-branding sweep.
**Depends on E9-S1** for the `organizationName` source (the `applicationName` from `useAppSettings()`), and is the natural home for the `public/contact` strings deferred from E9-S2 (see that story's Q3). **Coordinate with Epic 7** — E7-S3/E7-S4 also edit `de.json`/`en.json`.

## Acceptance Criteria

1. **Org-specific strings generalized.** The 22 confirmed organization-specific occurrences (11 per file) in `frontend/messages/de.json` and `en.json` are generalized — Category A keys interpolate `{organizationName}`, Category B is unified de/en, Category C placeholder examples become generic. The Dev Notes table is the authoritative checklist.
2. **`{organizationName}` is wired.** Components consuming the Category-A keys pass `{ organizationName }` into `t()`. The value comes from `useAppSettings().settings.applicationName`. After this story no i18n string renders a hardcoded "IAB" / "Indischer Kulturverein Bern" / "Indian Cultural Association Bern" / "Bern".
3. **de/en stay parallel.** Both files keep their identical 45-namespace structure; every changed key changes in both files. The pre-existing `auth.useYourCredentials` de/en inconsistency (de already says "Association Connect", en says "IAB Connect") is resolved consistently.
4. **Placeholder examples are generic.** `events.*` location/address placeholder examples no longer reference "Bern" / "Gemeindesaal Bern" — they become neutral examples.
5. **Behavior preserved.** With the configured org name supplied, rendered text reads naturally in both languages. No missing-key fallbacks, no `{organizationName}` leaking unrendered.
6. **Quality gate.** `npm run typecheck`, `npm run lint`, `npm run format:check` pass; the next-intl build/type validation for messages passes. Manual: switch language + set a custom org name → all listed surfaces read correctly.

## Tasks / Subtasks

- [x] **Task 1 — Category A: interpolate `{organizationName}` (AC: 1, 2)** — edited in **both** `de.json` and `en.json` + wired the consuming components:
  - [x] `home.dashboardDescription`, `home.welcomeGuest` → `app/page.tsx` passes `{ organizationName: settings.applicationName }` (the `useAppSettings()` hook was added in E9-S2).
  - [x] `publicFooter.description`, `publicFooter.copyright` → `PublicFooter.tsx` passes `{ organizationName }`; `copyright` also parameterizes `{year}` (Q1 recommendation — component passes `new Date().getFullYear()`).
  - [x] `newsletter.subscribeDescription` → `app/public/newsletter/page.tsx` (added `useAppSettings()`) passes `{ organizationName }`.
- [x] **Task 2 — Category B: unify `auth.useYourCredentials` (AC: 3)** — both files now interpolate `{organizationName}` (Q3 recommendation); `login/page.tsx` gained `useAppSettings()` and passes the param. The pre-existing de/en inconsistency is resolved.
- [x] **Task 3 — Category C: generic placeholder examples (AC: 1, 4)** — the 4 `events.form.*` placeholder keys in both files: `z.B. Gemeindesaal` / `e.g. Community Hall` and `z.B. Musterstrasse 123, 12345 Musterstadt` / `e.g. Example Street 123, 12345 Example City`. ("Gemeindesaal" / "Community Hall" are the story-specified target values — generic nouns, not org-specific.)
- [x] **Task 4 — public/contact strings (absorbed from E9-S2 Q3)** — `public/contact/page.tsx`: the contact email is now the `publicContact.contactEmail` i18n key (neutral `info@example.org` — email is genuinely not on the public settings endpoint). The address-block org line renders `settings.applicationName` via `useAppSettings()` (the org **name** *is* public — strictly better than a hardcoded neutral i18n string and consistent with E9-S2's logo treatment). See Completion Notes / Q2.
- [x] **Task 5 — Tests & verification (AC: 5, 6)**
  - [x] Vitest: `i18n-branding.test.tsx` renders `PublicFooter` + the `newsletter` page with an interpolating `useTranslations` mock + a custom `useAppSettings()` name → asserts the name appears and no raw `{organizationName}`/`{year}` leaks. (`app/page.tsx` org-name rendering is also covered by `page.test.tsx`.)
  - [x] `npm run typecheck` green; the next-intl param wiring type-checks.
  - [x] `npm run typecheck` + `prettier` green on all changed files; `npm run lint` — changed files clean (pre-existing baseline failure unchanged).
- [x] **Task 6 — re-grep before finishing (AC: 1)** — re-grepped both files for `IAB`, `Indischer Kulturverein`, `Indian`, `Kulturverein`, `Bern`, `iab-kulturverein` (case-insensitive) → **zero org-specific matches remain** (the only `Gemeindesaal` hits are the story-specified generic target value).

## Dev Notes

### A. Confirmed org-specific strings (the checklist — map by KEY PATH, not line number)

**Category A — interpolate `{organizationName}`:**
| Key path | de.json (current) | en.json (current) | → |
|----------|-------------------|-------------------|---|
| `home.dashboardDescription` | `Hier ist dein IAB Connect Dashboard.` | `Here is your IAB Connect Dashboard.` | `... {organizationName} ...` |
| `home.welcomeGuest` | `Willkommen bei der Webanwendung des Indischen Kulturvereins Bern. ...` | `Welcome to the web application of the Indian Cultural Association Bern. ...` | `... von {organizationName}. ...` / `... of {organizationName}. ...` |
| `publicFooter.description` | `Der Indische Kulturverein Bern fördert ...` | `The Indian Cultural Association Bern promotes ...` | `{organizationName} fördert ...` / `{organizationName} promotes ...` |
| `publicFooter.copyright` | `© 2025 Indischer Kulturverein Bern. Alle Rechte vorbehalten.` | `© 2025 Indian Cultural Association Bern. All rights reserved.` | `© {year} {organizationName}. ...` |
| `newsletter.subscribeDescription` | `... vom Indischen Kulturverein Bern ...` | `... from the Indian Association Bern ...` | `... von {organizationName} ...` / `... from {organizationName} ...` |

**Category B — unify (already inconsistent de/en):**
| Key path | de.json | en.json | → |
|----------|---------|---------|---|
| `auth.useYourCredentials` | `Verwende deine Association Connect Zugangsdaten` | `Use your IAB Connect credentials` | unify — interpolate `{organizationName}` in both |

**Category C — generic placeholder examples (string-only, no component change):**
| Key path | de.json | en.json | → |
|----------|---------|---------|---|
| `events.*.locationPlaceholder` | `z.B. Gemeindesaal Bern` | `e.g. Community Hall Bern` | `z.B. Gemeindesaal` / `e.g. Community Hall` |
| `events.*.locationNamePlaceholder` | `z.B. Gemeindesaal Bern` | `e.g. Community Hall Bern` | same |
| `events.*.addressPlaceholder` | `z.B. Musterstrasse 123, 3000 Bern` | `e.g. Example Street 123, 3000 Bern` | `z.B. Musterstrasse 123, 12345 Musterstadt` / `e.g. Example Street 123, 12345 Example City` |
| `events.*.locationAddressPlaceholder` | `z.B. Musterstrasse 123, 3000 Bern` | `e.g. Example Street 123, 3000 Bern` | same |

(The 4 `events.*` placeholder keys sit in a sub-object ~lines 770–783 of de.json; confirm the exact parent key — `events.form` or `events.create` — at dev time.)

### B. Component changes required (the real work — string edits are trivial)

| Key | Component | File:line (approx) | Change |
|-----|-----------|--------------------|--------|
| `home.welcomeGuest` | `app/page.tsx` | ~76 | `t("home.welcomeGuest", { organizationName })` |
| `home.dashboardDescription` | `app/page.tsx` | ~122 | `t("home.dashboardDescription", { organizationName })` |
| `auth.useYourCredentials` | `app/login/page.tsx` | ~132 | pass `{ organizationName }` (if interpolation chosen) |
| `newsletter.subscribeDescription` | `app/public/newsletter/page.tsx` | ~132 | pass `{ organizationName }` |
| `publicFooter.description` + `.copyright` | `components/navigation/PublicFooter.tsx` | 22 + copyright render | pass `{ organizationName }` (+ `{ year }`) |
| `events.*` placeholders | event form components | — | none — pure static text |

`organizationName` source: `const { settings } = useAppSettings();` → `settings.applicationName`. `app/page.tsx`, `PublicFooter.tsx` may already gain `useAppSettings()` in E9-S2 — coordinate so the hook is imported once.

### C. i18n facts the dev needs

- next-intl **single-brace** interpolation is already idiomatic here: `home.welcome` = `"Willkommen, {name}!"`, `members.totalMembers` = `"{count} Mitglieder insgesamt"`. Use `{organizationName}` — single brace.
- ⚠️ Do NOT confuse with `emailTemplates.subjectPlaceholder` = `"z.B. Willkommen bei '{{organizationName}}'"` — that **double-brace** is *literal escaped example text* (the email-template engine's own syntax shown to the user), not a next-intl variable. Leave it alone.
- Both files: 45 top-level namespaces, **structurally parallel**. Line numbers drift ~1 from ~line 1086 onward — **map by key path**.
- de.json = 2554 lines, en.json = 2553 lines.

### D. Cross-coordination — Epic 7 (IMPORTANT)

E7-S3 (Hindi expansion) and E7-S4 (content language metadata) **also edit `de.json`/`en.json`**. The readiness report and epic dependency #10 flag this. Mitigation:
- This story's edits are surgically scoped to the **11 listed key paths per file** — touch nothing else.
- Re-grep by key path immediately before implementing (Task 6) — do not trust the line numbers in this doc if E7 landed first.
- If E7 introduces a Hindi `hi.json`, this story does **not** need to populate it (E9-S4 predates Hindi; E7-S3 owns `hi.json` structure).

### E. Architecture & project constraints

- All user-visible frontend text uses next-intl keys; no hardcoded literals in components. [Source: project-context.md]
- Frontend formatting: double quotes, 2-space indent, Prettier — JSON files included. Keep both message files valid JSON, parallel structure. [Source: project-context.md]
- Backend enum/contract values are NOT translated — N/A here, but don't touch any enum-like keys. [Source: project-context.md]
- `useAppSettings()` is the settings access path. [Source: architecture.md#REQ-086]

### Project Structure Notes

UPDATE-only — `de.json`, `en.json`, and ~5 consuming components. No new files, no new packages. ~22 string occurrences + ~5–6 component `t()` call-site changes. The component wiring (passing `organizationName`) is the substance; the JSON edits are mechanical.

### References

- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#Story E9-S4: Generalize i18n Branding Strings]
- [Source: _bmad-output/planning-artifacts/architecture.md#REQ-055/REQ-086] — next-intl, no hardcoded strings
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-14.md] — i18n scan (~19 occurrences)
- [Source: _bmad-output/planning-artifacts/implementation-readiness-report-2026-05-14.md] — E7 ↔ E9-S4 merge-coordination note
- [Source: frontend/messages/de.json], [Source: frontend/messages/en.json]
- [Source: e9-s2-replace-hardcoded-organization-references-in-frontend.md] — Q3 defers `public/contact` strings here

## Open Questions / Clarifications (for PM — not blocking dev start)

1. **`copyright` year.** `publicFooter.copyright` currently hardcodes `© 2025`. Parameterize `{year}` (component passes `new Date().getFullYear()`), or keep a hardcoded year? Recommend parameterize.
2. **`public/contact` strings (absorbed from E9-S2 Q3).** Confirm the contact email + address-block org line become `publicContact.*` i18n keys here (recommended — the public settings endpoint deliberately omits contact fields). Alternative: expose contact fields publicly via an E9-S1 change.
3. **Category B wording.** `auth.useYourCredentials` — interpolate `{organizationName}` (consistent with Category A) or neutral "your account credentials"? Recommend interpolation.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (bmad-dev-story)

### Debug Log References

- Re-grep (Task 6) was run against the current message files — E7 had not landed, so the key paths matched the Dev Notes table directly.

### Completion Notes List

- All 11 org-specific key paths per file generalized: Category A (5 keys) interpolate `{organizationName}`, Category B (`auth.useYourCredentials`) unified via `{organizationName}`, Category C (4 `events.form.*` placeholders) made generic. de/en stay structurally parallel.
- **Component wiring** — `app/page.tsx`, `PublicFooter.tsx` already had `useAppSettings()` (E9-S2); `login/page.tsx`, `public/newsletter/page.tsx`, `public/contact/page.tsx` gained the hook. All Category-A/B `t()` call sites pass `{ organizationName }` (+ `{ year }` for `copyright`).
- **Q1 (copyright year)** — parameterized `{year}` as recommended.
- **Q2 (public/contact strings) — DECISION:** the contact **email** became the neutral `publicContact.contactEmail` i18n key (`info@example.org`) — email is genuinely not exposed by `/api/v1/settings/public`. The address-block **org line** renders `settings.applicationName` via `useAppSettings()` instead of a hardcoded i18n string — the org *name* IS public, so this renders the real configured org and is consistent with E9-S2's logo-from-settings pattern. This is a deliberate, defensible deviation from the literal "both become i18n keys" wording; flagging for the reviewer.
- **Q3 (Category B wording)** — interpolated `{organizationName}` as recommended.
- **Task 6 re-grep** — zero residual `IAB` / `Indischer Kulturverein` / `Indian` / `Kulturverein` / `Bern` / `iab-kulturverein` in either message file. The `emailTemplates.subjectPlaceholder` double-brace `{{organizationName}}` (literal escaped example text, NOT a next-intl variable) was correctly left untouched per Dev Notes §C.
- **Epic 7 coordination** — edits were surgically scoped to the 11 listed key paths per file; nothing else in `de.json`/`en.json` was touched.
- **Validation** — `npm run typecheck` green; `npx vitest run` → **54/54 pass** (full suite, +2 new in `i18n-branding.test.tsx`, no regressions); `prettier` applied to all changed files. `npm run lint` — changed files clean; the **pre-existing baseline lint failure** (`react-hooks/set-state-in-effect` in `members/segments/page.tsx` + `admin/backups/page.tsx`, untouched by E9) is unchanged — flagged as an E9-retro cleanup candidate.

### File List

**Frontend (new — tests):**
- `frontend/src/app/i18n-branding.test.tsx`

**Frontend (modified):**
- `frontend/messages/de.json`
- `frontend/messages/en.json`
- `frontend/src/app/page.tsx`
- `frontend/src/components/navigation/PublicFooter.tsx`
- `frontend/src/app/login/page.tsx`
- `frontend/src/app/public/newsletter/page.tsx`
- `frontend/src/app/public/contact/page.tsx`

### Change Log

- 2026-05-14 — Story 9.4 implemented (REQ-086, E9-S4): the 11 org-specific i18n key paths per message file generalized — Category A/B interpolate `{organizationName}` (consuming components wired via `useAppSettings()`), Category C placeholder examples made generic; `public/contact` strings absorbed from E9-S2 Q3 (contact email → neutral i18n key, address org line → `settings.applicationName`). 1 new Vitest file (2 cases); full suite 54/54 green; typecheck clean. Re-grep confirms zero residual org strings. Status → review. **Epic 9 complete — all 4 stories in `review`.**

## Review Findings

_Epic-boundary code review — 2026-05-14 (bmad-code-review). 3 layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor._

### Patches

- [x] [Review][Patch] `public/contact` address block hardcodes non-i18n literals [`app/public/contact/page.tsx`] — S4 Task 4 correctly moved the org-name line to `settings.applicationName` and the email to the `publicContact.contactEmail` key, but the address block still contains raw literal JSX (`Musterstrasse 42`, `8000 Zürich`) and a hardcoded phone (`+41 44 123 45 67`). Not org-specific, so the de-brand intent is met — but it violates the project-context.md rule that all user-visible frontend text goes through `next-intl`. Move the street/city/phone literals to i18n keys.
