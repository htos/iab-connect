# Deferred Work

Items deferred during code reviews — not caused by the reviewed change, but worth addressing in a dedicated pass.

---

## Forward-tracked from: bmad-create-story bulk refresh of Epic-13 (2026-06-01)

These are items the dev-agent will NOT do during E13 execution but that MUST happen before Beta is opened to real users beyond Harry's trusted-tester circle. Tracked here (not in a story file) because they outlive any single E13 story.

- **E13-FT-1: Switch outbound mail from Mailtrap Sandbox to a real SMTP provider.** Decided at E13 create-story (2026-06-01): keep ADR-018 Mailtrap-Sandbox for the initial Beta deploy so the Beta wiring is verified end-to-end without deliverability risk. **Trigger to flip:** before the first non-Harry tester is invited (so they can actually receive password-reset, invoice, dunning, and volunteer-reminder mails). **Provider candidates per ADR-018 / E19-S4:** Brevo (free tier 300/day, EU jurisdiction), Postmark (transactional-mail focused, paid), Postal on Hetzner (sovereign, self-hosted, more ops). Provider choice deferred to E19-S4 (`document-postal-smtp-migration-plan`), which authors the migration plan; E14-S2 or a new story does the actual variable swap on Railway. **Variables to change** (set on `api` Railway service, Sealed): `Smtp__Host`, `Smtp__Port`, `Smtp__Username`, `Smtp__Password`, `Smtp__EnableSsl`, `Smtp__FromEmail` (move from `noreply@iabconnect.app` placeholder to the real verified-sender address). SPF + DKIM records for the chosen From: domain must be in DNS BEFORE the flip. **Verification:** send a test password-reset to an external mailbox; check inbox + spam folder; verify SPF=pass / DKIM=pass / DMARC=aligned in the message headers.
- **E13-FT-2: Custom-domain CNAMEs for the Railway public hostnames.** Per E13-S3 Q1: Beta stays on `*.up.railway.app` Railway-assigned hostnames initially. **Trigger to flip:** when the `iabconnect.app` (or chosen) domain is registered AND DNS is under maintainer control. E19-S1 (`add-custom-domain-runbook-entry`) is the canonical story; folding into E13 was explicitly declined at create-story time. Variables to update: every `${{<service>.RAILWAY_PUBLIC_DOMAIN}}` reference in `api`/`web`/`keycloak` env vars, plus the 12 `_BETA` GHA repo variables that bake into the next `web` image build. Plan for a coordinated change (one push, one image rebuild, one env-var swap, one Railway redeploy of all 3 image services).
- **E13-FT-3: HSTS max-age bump from default 30 days to ≥ 6 months + `includeSubDomains` + `preload`.** Per E13-S3 Q2: the live Beta deploy starts with `app.UseHsts()` default (30 days, no subdomains). **Trigger to flip:** before the first non-Harry tester uses the Beta (so their browser's HSTS cache reflects the long lifetime). Owner: E14-S2 (`review-security-headers-and-https`). Code change: in [backend/src/IabConnect.Api/DependencyInjection.cs](backend/src/IabConnect.Api/DependencyInjection.cs) before line 257 (`app.UseHsts()`), add `services.AddHsts(o => { o.MaxAge = TimeSpan.FromDays(365); o.IncludeSubDomains = true; o.Preload = true; });`. Coordination: do NOT submit to https://hstspreload.org until production custom domain is in place AND maintainer is confident no subdomain serves cleartext (preload-list inclusion is hard to reverse).
- **E13-FT-4: Pin `rustfs/rustfs` to a specific digest instead of `:latest`.** Per E13-S1 AC-2: initial deploy used `rustfs/rustfs:latest` with the digest captured at deploy time. **Trigger to flip:** anytime — E13-S1 should already record the resolved digest in [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md). Action: change the Railway `rustfs` service image source from `rustfs/rustfs:latest` to `rustfs/rustfs@sha256:<captured-digest>`. Reason: supply-chain hygiene per ADR-014 deferred-work; protects against an unexpected upstream `:latest` change silently breaking the Beta. Re-pinning after an intentional RustFS upgrade is a 30-second Railway edit.
- **E13-FT-5: Retire the env-var-seeded `KEYCLOAK_ADMIN` master account.** Per E13-S2 AC-4: Beta boots with `KEYCLOAK_ADMIN`/`KEYCLOAK_ADMIN_PASSWORD` seeded in Railway Sealed vars. After Harry creates a personal admin account (E13-S2 Task 3 augmentation, post-decision 2026-06-01), the env-var admin remains in the database as a parallel credential. **Trigger to flip:** anytime after E13-S2 Task 3 confirms the personal admin works. Action: delete the env-var admin user from the Keycloak Admin Console master realm; remove the two env vars from Railway. Reason: anyone with read access to Railway's Sealed values can otherwise log in as a master-realm admin.

---

## Deferred from: code review of Epic-20 boundary (2026-06-01)

Triage: 3 review layers (Blind Hunter + Edge Case Hunter + Acceptance Auditor) over the full E20 close diff (e20-s1 through e20-s5, ~1207 lines covering 4 markdown files, 2 GitHub workflows, 5 backend source + 2 tests, 4 frontend source + 2 tests). 19 findings → 4 patches applied in this session (P1 NOTICE.md QuestPDF license correction, P2 DCO `--no-merges`, P3 build-images.yml concurrency group, P4 TestWebApplicationFactory clears BUILD_SHA/BUILD_DATE for CI-host independence) + 11 defers (below) + 4 dismisses.

### Per-story defers

#### e20-s1 — LICENSE/DCO/CONTRIBUTING/NOTICE

- **E20-S1-D1: DCO `git rev-list base..head` may fail for cross-fork PRs.** `actions/checkout` with `ref: ${{ github.event.pull_request.head.sha }}` + `fetch-depth: 0` fetches all branches of the BASE repo, so PRs from forks targeting our `main`/`beta` are fine (base lives in our repo). Risk remains for cross-fork PRs (the workflow being run by a fork against another fork). **Action when picked up:** add `git fetch --no-tags --depth=1 origin "$BASE_SHA"` fallback step before rev-list, OR switch to `gh api repos/.../pulls/.../commits` for robust base-resolution.
- **E20-S1-D2: DCO regex misses CRLF-terminated trailers.** `^Signed-off-by: .+ <.+@.+>$` with bash `grep -E` against `git show -s --format=%B` — `git show` normalizes most cases, but a commit message authored on Windows with literal `\r\n` line endings (uncommon but possible) bypasses the `$` anchor. **Action when picked up:** sed-strip CR before grep, OR add `[[:space:]]*$` tolerance to the regex.
- **E20-S1-D3: DCO does not enforce trailer-email-matches-author-email.** CONTRIBUTING.md says "The email in the trailer must match the email on the commit author", but the workflow doesn't verify — any email shaped `<x@y>` passes. **Action when picked up:** capture both `git show -s --format=%ae` and the trailer email via `grep -oE`, compare case-insensitively.
- **E20-S1-D4: `actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683` (v4.2.2) is 18+ months old at 2026-06-01.** Pinned SHA is immutable so functionally safe, but Dependabot for `github-actions` ecosystem would surface refresh PRs. **Action when picked up:** add `.github/dependabot.yml` configuring weekly checks; refresh SHA + comment as Dependabot proposes.

#### e20-s4 — frontend license footer

- **E20-S4-D1: LicensePage `fs.readFileSync` runs per-request, not at build time.** Comment claims build-time semantics, but the async server component is invoked per request unless wrapped in `unstable_cache` or marked `force-static`. In Next.js standalone Docker (E12-S2 build context = `./frontend`), `process.cwd()` is `/app` and `path.join(cwd, "..", "LICENSE")` resolves to `/LICENSE` which is never present — every request falls through to the gnu.org-link branch. AGPL §13 disclosure still holds via the fallback. **Action when picked up:** decide between (a) extend GHCR workflow build context to repo root + COPY LICENSE into frontend image; (b) inline a stripped LICENSE as a `.ts` module; (c) commit to the gnu.org-link UX and simplify the page. Recommended (a) for AGPL §13 self-hosted-tarball intent.
- **E20-S4-D2: LicenseFooter renders on `/public/license` itself — self-referential link.** The footer's `Link href="/public/license"` is rendered ON `/public/license`, producing a no-op self-nav. Screen readers announce a link to the current page. **Action when picked up:** in LicenseFooter, use `usePathname` to suppress the `Link` (render as plain `<span>`) when pathname starts with `/public/license`.
- **E20-S4-D3: `_comment_licenseFooter` JSON pseudo-key leaks into next-intl namespace.** A typo `t("_comment_licenseFooter")` would render the policy comment as UI text. **Action when picked up:** establish an i18n JSON convention (strip keys starting with `_` at build time via a next-intl plugin, OR move comments to a sibling `.policy.md` file).
- **E20-S4-D4: AGPL §13 disclosure does not surface running-version to the user.** `LicenseFooter` shows license + source link but not the commitSha/buildDate from `/about`. AGPL §13 requires offering the **corresponding source for the running version** — without a visible version pin, a user offered a tarball can't tell which commit it should match. **Action when picked up:** add an optional `<span className="text-gray-400">build {commitSha.slice(0,7)}</span>` to LicenseFooter, fetched from `/about` on mount (client-side, after hydration to avoid SSR latency).
- **E20-S4-D5: Real `npm run build` against on-disk LICENSE was not verified.** The Vitest mock proves the projection logic; an actual `next build` after E20-S1's LICENSE landed wasn't executed. **Action when picked up:** during human-verify pass (E20-S4 Task 8.5), confirm `/public/license` shows the embedded LICENSE block, not the gnu.org fallback. If fallback appears, D1 is the real fix.

#### e20-s5 — GHCR pipeline

- **E20-S5-D1: BUILD_DATE has no defensive fallback for non-push events.** `${{ github.event.head_commit.timestamp }}` is empty on workflow re-runs that lose context or future `workflow_dispatch` trigger additions. **Action when picked up:** change to `${{ github.event.head_commit.timestamp || github.event.repository.updated_at }}` or add a `date -u +%FT%TZ` shell step before build.
- **E20-S5-D2: Build-args block sends frontend NEXT_PUBLIC_* values to api/keycloak matrix entries too.** Currently harmless because `backend/Dockerfile` and `infra/keycloak/Dockerfile` don't declare those ARG names. Risk: a future Dockerfile change silently consumes frontend config. **Action when picked up:** restructure matrix to declare `build-args` per matrix entry (via `matrix.include.build_args` multi-line YAML string).
- **E20-S5-D3: `revision` + `created` OCI labels rely on `metadata-action` auto-population.** Spec called them out explicitly. Auto-population is correct behavior of `docker/metadata-action` v5.x, but should be verified at first publish via `docker inspect`. **RESOLVED 2026-06-01 18:31 UTC** via Task 7 manual verify: `docker inspect ghcr.io/htos/iabc-api:beta` returned 9 OCI labels (spec required 7) including `revision=58382e8188ca9ecb8dd8114f2cf4494bea69a17c` (matches fix-commit SHA) + `created=2026-06-01T18:31:46.214Z` (proper ISO-8601 UTC). Plus bonus `version=beta` auto-populated from branch ref. No drift across the 9-anchor license-string parity check or 15-anchor sourceUrl parity check.
- **E20-S5-D5: workflow initial-run failure from unverified docker/* action SHA pins (NEW from Task 5 execution).** Initial workflow runs on beta and main (commits ed5e8db merge of 682072f, runs `actions/runs/26773377771` + `actions/runs/26773415494`) failed with `Unable to resolve action docker/build-push-action@263435318d21b8e681c14492fe198d362a7d2c1c` at workflow-parse time — the dev-agent had guessed 4 docker/* action SHAs without API verification. Fix commit `58382e8` switched the 4 actions to floating `@v3`/`@v5`/`@v6` major-version tags; `actions/checkout` kept its proven SHA pin. Workflow run #3 (`actions/runs/26774085850`) on beta then succeeded, producing all 3 images with correct OCI labels (verified Task 7 above). **Action when picked up:** add `.github/dependabot.yml` configuring `github-actions` ecosystem; Dependabot proposes SHA-pin PRs refreshing the comment + digest in lock-step. Closes the supply-chain gap of floating tags being silently re-pointable.

### Dismisses (recorded for completeness)

- F4 `frontend/next-env.d.ts:3` modified (Blind Hunter HIGH) — DISMISS: file is auto-regenerated by `npm run build`/`dev`; the diff reflects a transient regen by my test run, not an intentional hand-edit. Next.js will overwrite as needed.
- F12 `NEXT_PUBLIC_SOURCE_URL` hardcoded in build-images.yml (Blind Hunter LOW) — DISMISS: intentional. The canonical value is also the upstream identifier under AGPL §13; a fork wanting to disclose its fork URL edits the workflow file as a one-line change. Documented in the workflow header comment block.
- F13 `AboutEndpoints.cs` comment cites `InternalsVisibleTo` at `DependencyInjection.cs:16` (Blind Hunter LOW) — DISMISS: Blind Hunter false positive. The `[assembly:]` attribute does live at `DependencyInjection.cs:16` (verified by grep at story implementation). C# permits assembly-level attributes at the top of any file in the assembly.
- F16 German `Quellcode` vs English `Source` width asymmetry (Edge Case LOW) — DISMISS: intentional translation per next-intl policy. Width tolerance is a visual-polish concern, not a correctness defect; the existing Tailwind `flex-wrap` handles it.

---

## Epic-3-retro §9 Cleanup Sprint — Triage & Resolutions (2026-05-14)

The Epic-3 retrospective (`epic-3-retro-2026-05-14.md` §9) scheduled a dedicated cleanup sprint before Epic 4. This section records its outcome; the per-review sections below are left as the historical record.

### ✅ Resolved this sprint

| Item | Resolution | Commit |
|---|---|---|
| Shared `ICollectionFixture<TestWebApplicationFactory>` (A15) | Fixture already existed; the 3 deferred test classes (`EventCheckInRosterEndpointTests`, `MemberCreateDuplicateConflictTests`, `MemberDuplicateGroupsEndpointTests`) were migrated onto it — real runtime `→401` tests re-enabled in place of metadata-only stand-ins. | `1200958` |
| `DateTime.Kind` enforcement at domain construction (A13) | `Event` / `EventVolunteerShift` were already guarded (Round-4 fix-pass); `EventVolunteerAssignment.MarkReminderSent` now normalises via `DateTimeUtcGuard.EnsureUtc`. Checklist added to `docs/07_dos_donts.md`. | `1200958` |
| `calendar-feed-api-tests` — zero-coverage AC-1 privacy filter (R3-H-S5-7/8, R4-Defer-S5-5) | `GetPublicCalendarFeedQueryHandlerTests` (Application, +4) + `EventCalendarFeedEndpointTests` (API, +7) authored. The public-feed visibility guarantee now has automated coverage. | `38a2d83` |
| FOR UPDATE row-lock coverage audit | **calendar-token rotate/revoke** (R3-H-S5-5, `member-rotate-row-lock`): new `ICalendarTokenService` — rotate+revoke run under a FOR UPDATE lock on the member row. **CancelRegistration** (H-S2-5): new `IEventRegistrationCancellationService` — cancel + waitlist promotion run under FOR UPDATE locks on the event + registration rows. **UpdateShift TOCTOU**: audited — already closed in Round 3 (`UpdateShiftAsync` wraps capacity + field updates in one FOR UPDATE transaction). Both new services ship two-task Testcontainers race tests. | `22803c0` |
| Role-registry single source of truth (R3-Defer-5) | New `Roles` constants class (`IabConnect.Api.Authorization`); `DependencyInjection` policies, `EventVolunteerEndpoints.IsStaffCaller`, and the Event-family endpoint role checks all read from it. The `StaffRoles` hand-mirror is gone. | `421c616` |
| `calendar-token-hmac-rehash` (R3-H-S5-3) | `Member.HashCalendarToken` now takes an optional pepper — when configured, the stored value is `HMAC-SHA256(pepper, SHA256(token))`; when absent it stays plain SHA-256 (backwards-compatible). New `CalendarTokenOptions` (`Auth:CalendarTokenPepper`); `MemberRepository` + `CalendarTokenService` apply it. New `HmacPepperCalendarSubscriptionTokens` migration re-hashes existing digests forward via pgcrypto `hmac()` — **pepper-gated** (no-op when the `Auth__CalendarTokenPepper` env var is absent, so dev/CI/Testcontainers are unaffected). A parity test pins that the pgcrypto SQL equals the .NET hasher byte-for-byte. **Rollout: set `Auth__CalendarTokenPepper` in staging/prod before deploying this migration** (see `CalendarTokenOptions` XML doc + `appsettings.json` comment for the adopt-later caveat). | _this sprint_ |

### 📝 Spec-text-drift reconciled (Round-4 AC-drift items)

The Round-4 review flagged a batch of items where the shipped code intentionally diverged from the original AC text and the AC was never updated. **Disposition: the code is canonical.** Each item's full reconciliation rationale is already recorded in the relevant story file's `## Round 4 Review Findings` section (the `R4-Defer-*` entries). They are no longer tracked as open drift:

- **R4-Defer-S1-1** — roster query returns the `EventCheckInRosterLookup` envelope (Round-2 H-S1-3 fix), not `EventCheckInRosterDto?`.
- **R4-Defer-S3-1** — read endpoints use `RequireEventStaffOrMember` (Round-3 R3-DN-4 decision), not `RequireMember`.
- **R4-Defer-S3-2** — `IncreaseCapacity` → `UpdateCapacity(newCapacity, currentConfirmedCount)` (Round-3 H-S3-4 bidirectional-capacity fix).
- **R4-Defer-S3-3** — assignment constraint/FK cases live in `EventVolunteerAssignmentConcurrencyTests.cs`, not a separate `EventVolunteerAssignmentRepositoryTests.cs`.
- **R4-Defer-S4-1** — reminder window is 36h (Round-2 H-S4-4 fix; a 24h window misses next-evening shifts at the 09:00 cadence), not 24h.
- **R4-Defer-S4-2** — `SendVolunteerShiftReminderAsync` carries a `Member` parameter (avoids a duplicate fetch; documented in XML doc) not in the original AC-5 signature.
- **R4-Defer-S5-3** — `URL` ICS property emitted unescaped (Round-3 R3-L-S5-1 fix, RFC 5545 §3.3.13).
- **R4-Defer-S5-4** — `Member.CalendarSubscriptionToken` → `...Hash`, stores the SHA-256 digest (Round-2 H-S5-1 hardening).

### 🚀 Rollout note — `calendar-token-hmac-rehash` (shipped, pepper-gated)

The HMAC-pepper hardening shipped this sprint (see the Resolved table above) in a deliberately **non-breaking, pepper-gated** form — the original "needs a deployment decision" concern was resolved by making both the hasher and the migration fall back cleanly when no pepper is configured:

- **Dev / CI / Testcontainers** — no `Auth__CalendarTokenPepper` set → hasher uses plain SHA-256, migration is a no-op. Nothing changes, nothing breaks.
- **Staging / Production** — set `Auth__CalendarTokenPepper` (a strong random secret) **before** deploying the `HmacPepperCalendarSubscriptionTokens` migration. The migration then re-hashes existing stored digests forward; the app's hasher computes the matching HMAC at request time.
- **Adopt-later caveat** — the migration is one-shot (EF history). An environment that ran it without a pepper and later wants the hardening must have members re-rotate their calendar tokens (documented in `CalendarTokenOptions` and the `appsettings.json` comment).

### Remainder triage

The pre-Epic-3 items (Epic-1 / Epic-2 boundary sections) and the bulk of the Epic-3 Round-2/3/4 items below remain **open and unchanged** — they are genuinely low-severity / pre-existing / cosmetic and were correctly deferred. Notable still-open cross-cutting threads for future planning: the **server-side i18n / comms track** (Epic-3 planning + R3-Defer-S4 items — explicitly coordinated with Epic 5, not pulled forward), per-route **rate limiting** (Epic-1/Epic-2 — API-gateway concern), and the **`.gitattributes` CRLF/LF** chore. Inline role-string literals in the non-Event endpoint files (Audit / Document / Settings / CustomRole / Identity) were left as-is by the P3 role-registry refactor — converting them is mechanical and can fold into those files' next change; the `Roles` constants class is in place for it.

---

## Deferred from: Epic Boundary Review E1.S1–S4 (2026-05-13)

- **[E1.S2] Concurrent MFA resets send two re-enrollment emails** — admin-only action; race window is small and consequence is cosmetic (duplicate emails to target user)
- **[E1.S2] No rate limiting on `POST /users/{userId}/reset-mfa`** — broader API gateway concern; an admin could spam a user's inbox; address with a per-user-per-window throttle at API level
- **[E1.S2] Keycloak 200 with empty body for `/credentials` causes `JsonException`** — pre-existing; Keycloak spec guarantees a JSON array for this endpoint; add null-coalescing on deserialisation if Keycloak version ever changes
- **[E1.S3] Session ID case sensitivity** — Keycloak session IDs are lowercase UUIDs; `Guid.TryParse` accepts both cases; ownership string comparison could fail if Keycloak ever returns mixed-case IDs
- **[E1.S3/E1.S4] `window.confirm()` for revoke confirmation is not WCAG-compliant or stylable** — replace with a modal component in a UX polish sprint
- **[E1.S3/E1.S4] `initialFetchDone` ref prevents session list refetch after silent token renewal** — Refresh button provides manual workaround; revisit when next-auth silent refresh is implemented
- **[E1.S3] `SessionMapper.ToDto` maps null Id to `""` after P6 filters** — code smell; `SessionDto.Id` can be an empty string if the filter is ever removed; consider making Id nullable or using a sentinel value
- **[E1.S4] TOCTOU race on session ownership check** — Keycloak session UUIDs not guessable; race window negligible; document as known limitation
- **[E1.S4] Race: user deleted between `GetUserByIdAsync` and `GetUserSessionsAsync`** — acceptable race; audit records correct reason for each branch
- **[E1.S4] Double Keycloak API calls per revoke** — user-existence pre-check is redundant given subsequent session-ownership check; refactor in a Keycloak service cleanup sprint
- **[E1.S4] Non-UUID `sub` claim in token causes `ArgumentException` → 500** — requires compromised token passing signature verification; document as known non-GDPR risk
- **[E1.S4] Admin `RevokeUserSession` 404 for both user-not-found and session-not-found** — common REST pattern; frontend error message mismatch is cosmetic

## Deferred from: code review of Epic-2 boundary (e2-s1, e2-s2, e2-s3, e2-s4) (2026-05-13)

- **[E2.S1] Phone normalization for national-format / trunk-prefix variants** [`backend/src/IabConnect.Application/Members/Duplicates/DuplicateMatcher.cs:853-864`] — Story Decision Log explicitly fixed Option B (digits-only) for MVP; revisit when localised matching becomes a requirement.
- **[E2.S1] Street prefix `StartsWith` over-matches short tokens** [`backend/src/IabConnect.Application/Members/Duplicates/DuplicateMatcher.cs:940-948`] — matcher-tuning task; add min-length 4–5 or Levenshtein distance.
- **[E2.S2] `DuplicateMemberConflictResponse.ExistingMemberId` leaked to caller** [`backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs:84,101`] — Vorstand-gated, intended UX for deep-link to existing record; revisit if endpoint authZ is loosened.
- **[E2.S2] 409 UI fallback renders empty-name placeholder candidate** [`frontend/src/app/members/new/page.tsx:15229-15247`] — backend Exact guard is the source of truth; fallback display is cosmetic.
- **[E2.S2] Vorstand-claimed POST integration test deferred** — handler-level `CreateMemberCommandHandlerDuplicateTests` proves backend rejection; Serilog test-host conflict blocks WebApplicationFactory path.
- **[E2.S2] PUT email update self-match normalization edge** [`backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs:97-104`] — current `request.Email != member.Email` pre-check handles the common path.
- **[E2.S3] Asymmetric `(Guid?)` cast on `ExecuteUpdateAsync`** [`backend/src/IabConnect.Infrastructure/Members/MemberMergeService.cs:1851-1880`] — verify column nullabilities match each cast; mismatch throws at EF translation.
- **[E2.S3] Migration `Down` destroys merge linkage / dismissal rows** [`Migrations 20260513102726 + 20260513112857`] — forensics-destructive but EF default; address in ops runbook or archive-first.
- **[E2.S4] `FindDuplicateGroupsQueryHandler` O(n²) bucket validation** [`backend/src/IabConnect.Application/Members/Queries/FindDuplicateGroupsQueryHandler.cs:1108-1226`] — documented scaling limitation; revisit at scale or add a duplicates-cache layer.
- **[E2.S4] No per-route rate limit on duplicates / duplicate-groups / duplicate-dismissals endpoints** [`backend/src/IabConnect.Api/Endpoints/MemberEndpoints.cs`] — broader API gateway concern.
- **[E2.S4] CRLF/LF inconsistency across 16+ files** — pre-existing repo policy; address with `.gitattributes text=auto eol=lf` in a chore commit.
- **[E2.S4] `KeyNotFoundException` for merged-into source maps to 404** [`DismissDuplicateCandidateCommandHandler.cs:502-512`] — semantically 410 Gone; cosmetic REST nit.
- **[E2.S4] Exact-bucket dismissal filter produces asymmetric inclusion** [`FindDuplicateGroupsQueryHandler.cs:1239-1271`] — UI edge case showing orphan single-member "group".
- **[E2.S4] Vitest DOM-environment deferral for `DuplicateWarning` + `/members/duplicates/page`** — blocked on `jsdom` devDep; bundled with frontend test-tooling track.

## Deferred from: code review of e1-s2, e1-s3, e1-s4 (2026-05-13)

- **Stale Keycloak admin token not cleared on 401 from Admin API** [`backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`] — Token is cached until expiry; a 401 response from the Admin API does not invalidate the cache, causing repeated stale-token usage until TTL expires. Pre-existing issue in the `CreateRequestAsync`/`GetAccessTokenAsync` caching logic.
- **Non-404 Keycloak status codes become opaque 500** [`backend/src/IabConnect.Infrastructure/Identity/KeycloakAdminService.cs`] — 401/403/429/503 from Keycloak Admin API all propagate as `HttpRequestException` via `EnsureSuccessStatusCode`, surfacing as generic 500 to callers with no differentiation. Pre-existing pattern throughout the service.
- **MediatR/FluentValidation not used for Keycloak session/MFA endpoint handlers** [`backend/src/IabConnect.Api/Endpoints/UserEndpoints.cs`, `backend/src/IabConnect.Api/Endpoints/IdentityEndpoints.cs`] — New session/MFA endpoints call `IKeycloakAdminService` directly from handlers rather than dispatching MediatR commands. Follows the existing codebase pattern for thin Keycloak-proxying operations; revisit if business logic accretes.

## Deferred from: Epic-3 story planning (2026-05-13)

- **[E3.S3] Per-shift task lists / `Aufgabenlisten`** — REQ-024 functional list item 1 ("Aufgabenlisten") deferred from E3.S3. Story models Roles + Shifts + Assignments only; granular sub-tasks within a shift (a separate `EventVolunteerTask` entity with FK to `EventVolunteerShift`) are out of scope until a concrete user need surfaces. Architecture (lines 349-369) suggested only the three entities; the German requirement was broader. Track for a follow-up story when an event manager actually requests sub-task tracking inside a shift.
- **[E3.S4] Volunteer reminder opt-out / global member email preferences** — No per-member email-preference system exists today. Volunteer shift reminders are sent unconditionally to anyone signed up. A cross-cutting opt-out mechanism (likely matching Epic 5 / REQ-030 channel preferences) should cover ALL existing email types simultaneously (reminders, registration confirmations, waitlist promotions, dunning, etc.) rather than adding a feature-specific flag. Estimated scope: 1 new domain field per Member + a preference-resolution helper in `EventNotificationService` + UI in profile settings. Coordinated with the Epic-5 Communication Automation track.
- **[E3.S4] Server-side i18n rendering pipeline for `EventNotificationService`** — E3.S4 introduces the FIRST bilingual email (DE + EN both in the same message via `const string` literals). The existing 6 German-only notification methods at [EventNotificationService.cs:29-145](backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs#L29-L145) are NOT retrofitted in S4. A general server-side next-intl rendering pipeline (or resource files + a member-language resolver) should land as a dedicated cross-cutting communication-track story before email volume grows further. Coordinated with the Epic-5 Communication Automation track and the opt-out work above.

## Deferred from: epic-3 code review (2026-05-13)

Items raised during the Epic-3 boundary review and classified as defer (pre-existing concerns, low severity, or follow-up work outside the patch scope). Full evidence in [epic-3-review-2026-05-13.md](epic-3-review-2026-05-13.md). 46 items total — abbreviated below.

### Cross-cutting (epic-wide)
- **Shared `ICollectionFixture<TestWebApplicationFactory>` for API endpoint runtime tests** — Three Epic-3 stories (S1, S2, S5) deferred runtime endpoint auth tests citing the same Serilog bootstrap-logger collision pattern. A shared collection-fixture across all API test classes would unblock the family. Priority: top of epic-4 prerequisites or a chore commit.
- **DateTime.Kind enforcement at domain construction** — Several findings (H-S1-2, H-S5-2, H-S4 conversion) share a root cause: domain entities (`Event`, `EventRegistration`, `Member`) do not assert `Kind=Utc` on construction. A single guard in the constructors + a Symmetric-Guard-Checklist entry closes the family. Track as a defensive-coding chore.
- **FOR UPDATE row-lock coverage audit** — Project convention "FOR UPDATE on any shared mutable state" is unevenly applied. CancelRegistration, UpdateShift, and token rotate paths lack it. A project-wide audit closing the family is a one-day task.

### S1 (12 items)
- **[E3.S1] CSV writes `IsWaitlisted`/`IsCheckedIn` as English literal "true"/"false"** — German Excel won't auto-recognize as booleans. Cosmetic. (Blind-F16)
- **[E3.S1] DateTime.UtcNow read twice (cutoff + GeneratedAt) without snapshot** — testability gap; not a runtime defect. (Edge-E2)
- **[E3.S1] CSV writer doesn't quote NUL or Next Line (U+0085) control chars** — defense-in-depth. (Edge-E5)
- **[E3.S1] `evt.IsDeleted` check unreachable (EF global filter handles it)** — dead-code cleanup. (Edge-E9)
- **[E3.S1] Empty `ParticipantName` sorts first; printed row has no human lookup key** — UX hazard, not correctness. (Edge-E10)
- **[E3.S1] `CheckedInCount` excludes rows filtered by `includeWaitlisted`** — same family as M-S1-1 if D-S1-2 resolves accordingly. (Edge-E12)
- **[E3.S1] Empty `?includeWaitlisted=` yields a 400 instead of default-false** — frontend serialization edge. (Edge-E13)
- **[E3.S1] 404 body on archive-expired CSV is JSON not text/csv** — Content-Type negotiation nit. (Edge-E15)
- **[E3.S1] `ExportEventCheckInRosterQueryHandler` re-enters MediatR → pipeline behaviors run twice** — double-audit/double-rate-limit if those behaviors become non-idempotent. (Blind-F14)
- **[E3.S1] `OrderBy(StringComparer.Ordinal)` over folded names may misorder names containing apostrophes** — locale-sensitive sort gap. (Blind-F15)
- **[E3.S1] No `LogAccessDenied` on Conflict/NotFound paths of check-in endpoints** — audit-coverage discipline. (Blind-F13)
- **[E3.S1] `!` on `Registration` in `CheckedIn` outcome dereference** — defensive; type-safe in current code path. (Blind-F3 — moved to S2 file scope)

### S2 (8 items)
- **[E3.S2] AC-4 PARTIAL: Audit moved from handler to endpoint** — documented deviation; observable behavior preserved. (Auditor)
- **[E3.S2] AC-8 PARTIAL: Vitest doesn't directly assert idempotent banner / invalid-QR banner state** — test gap. (Auditor)
- **[E3.S2] `CheckInSearchHasher` Base64 (not Base64Url) — `+`/`/` chars in hash** — forward-compat trap for future URL/path use. (Blind-F8)
- **[E3.S2] Idempotent-path tracking-dirty risk (defensive `ChangeTracker.Clear`)** — current code is safe; defense for future. (Blind-F9)
- **[E3.S2] Concurrent-test serialization on shared Npgsql pool** — test-validity concern, not runtime. (Blind-F10)
- **[E3.S2] Manual-check-in cancelled-race UX** — backend correctly Conflicts; frontend banner timing nit. (Edge-E4)
- **[E3.S2] Pending → CheckedIn transition skips Confirmed** — reports keyed on `ConfirmedAt` may break; depends on H-S2-4 resolution. (Edge-E8)
- **[E3.S2] Inner-whitespace hash drift in `CheckInSearchHasher`** — forensic correlation gap, not security. (Edge-E10)
- **[E3.S2] Unknown-status rethrow → 500 without audit** — future-proofing. (Edge-E13)
- **[E3.S2] Frontend roster filter uses culture-less `.toLowerCase()`** — Turkish-i / Eszett mismatch. (Edge-E14)
- **[E3.S2] HTTPS-less origin lacks "HTTPS required" banner** — kiosk UX. (Edge-E16)
- **[E3.S2] Cross-event audit `eventId` uses registration's actual event, not URL event** — forensic correlation, depends on D-S2-1. (Edge-E18)

### S3 (12 items)
- **[E3.S3] Audit `AssignedBy` cannot distinguish self-signup from staff-assign with same caller** — store a `WasSelfSignup` flag. (Edge-E1)
- **[E3.S3] `AssignVolunteer` no try/catch for unhandled `VolunteerAssignmentOutcome.Cancelled`** — defensive; current enum doesn't reach it. (Blind-F2)
- **[E3.S3] Waitlist-position promotion NullReferenceException on legacy null Position** — domain invariant; current data is clean. (Blind-F3)
- **[E3.S3] AC-10 PARTIAL: missing `AssignVolunteerCommandHandlerTests` + `SelfSignUpForVolunteerShiftCommandHandlerTests` theory rows** — covered indirectly by Infrastructure integration tests. (Auditor)
- **[E3.S3] `GetByEventAndNameAsync` uses CLR `ToLower()` — Turkish-locale CLR vs Postgres `lower()` divergence** — culture-sensitivity edge. (Blind-F8)
- **[E3.S3] `UpdateDetails` allows StartsAt in the past + capacity bypass via `IncreaseCapacity`** — domain invariant; depends on M-S3-9. (Blind-F9)
- **[E3.S3] `GetRemindersDueAsync` no member-status filter** — reminder edge; coordinate with S4. (Blind-F11)
- **[E3.S3] `AddAtomicAsync` race-recovery re-fetch may return null on concurrent cancel** — stress-scenario only. (Blind-F13)
- **[E3.S3] `AllowSelfSignup` flag drift via `UpdateDetails`** — design intent unclear; defer. (Blind-F14)
- **[E3.S3] Re-assignment after cancel: old Cancelled row accumulates** — by-design forensic history. (Edge-E12)
- **[E3.S3] No `DELETE` endpoint for `EventVolunteerRole` — FK RESTRICT guard never reached** — feature missing, not bug. (Edge-E17)
- **[E3.S3] No `(shift_id, position) UNIQUE WHERE Status='Waitlisted'` DB constraint** — application-level invariant only. (Edge-E20)
- **[E3.S3] `BeginTransactionAsync` default isolation undocumented (READ COMMITTED)** — documentation gap. (Edge-E21)
- **[E3.S3] Early-return paths inside `AssignAsync` rely on implicit `await using` rollback** — semantically odd but functional. (Edge-E22)
- **[E3.S3] Volunteer overlap detection across shifts of same role** — no domain or validator check; member can be double-booked. (Edge-E25)
- **[E3.S3] `Cancel a Confirmed shift` returns 404 for both wrong-event and not-found** — info-leak via timing. (Edge-E16)

### S4 (8 items)
- **[E3.S4] AC-9 / D7 test coverage deferred against spec mandate** — Completion Notes acknowledged: page-level Vitest, integration repo test, job-registration test, bilingual email render test, adversarial test rows. (Auditor)
- **[E3.S4] `MarkReminderSentAsync` after success can fail → next-day duplicate send (at-least-once)** — acceptable trade-off; combined with C2 fix this is documented. (Edge-E12)
- **[E3.S4] PII (member email) logged at Information level** — GDPR/Swiss DPA caution; pre-existing pattern in adjacent code. (Edge-E11)
- **[E3.S4] Subject not RFC-2047 encoded if title contains non-ASCII** — depends on SMTP library encoding behavior; coordinate with H-S4-2. (Blind-F5 — withdrawn after re-read)
- **[E3.S4] Stale `eventCancelled` prop on self-signup section** — race window small; backend rejects. (Edge-E10)
- **[E3.S4] Admin volunteers page swallows partial-load failure** — UX inconsistency. (Edge-E13)
- **[E3.S4] `editingShiftId` non-null + `roleId` empty corrupts shift on update** — guard inconsistency; current flow is safe. (Blind-F7)
- **[E3.S4] `noShifts` translation reused as "no shifts at all" and "no shifts in this role"** — i18n key duplication. (Blind-F14)

### S2 fix-pass deferred (2026-05-13)
- **[E3.S2] H-S2-5 CancelRegistration FOR UPDATE row lock** — needs a new cancellation service mirroring `EventRegistrationCheckInService`. Combine with cross-cutting FOR UPDATE coverage audit (theme #1: also covers rotate-token, UpdateShift) in a single design pass.

### S5 (6 items)
- **[E3.S5] AC-1 absence-of-`RequireAuthorization` pattern vs spec's explicit `.AllowAnonymous()`** — style nit; spec acknowledges precedent. (Auditor)
- **[E3.S5] AC-10 PARTIAL: missing `GetPublicCalendarFeedQueryHandlerTests` + `EventCalendarFeedEndpointTests`** — explicitly deferred in dev-story Completion Notes. (Auditor)
- **[E3.S5] `RegenerateCalendarToken` no retry on partial-unique-index collision** — collision probability 1 in 2^256; spec asked for it. (Blind-F12)
- **[E3.S5] Cancelled/Draft `BuildSingle` would mislabel `STATUS:CONFIRMED`** — defense-in-depth; endpoint pre-filters. (Edge-E8)
- **[E3.S5] `subscriptionUrl` hard-codes `/api/v1/events/...` route prefix** — stale-URL risk on version bump. (Blind-F13)
- **[E3.S5] `Uri.EscapeDataString` no-op on Base64Url tokens** — defensive but harmless today. (Edge-E11)
- **[E3.S5] Token-not-found 404 enumeration timing fingerprint (3 code paths)** — depends on H-S5-1 hash fix. (Blind-F11)
- **[E3.S5] `RegenerateCalendarToken` allowed on Deactivated/Merged Member** — feed filter handles it; cosmetic invariant. (Edge-E17)
- **[E3.S5] `EscapeIcsText` strips TAB (RFC 5545 allows HTAB as content char)** — minor data-fidelity loss. (Edge-E14)
- **[E3.S5] `URL:` value over-escapes commas/semicolons (RFC 5545 §3.3.13 not §3.3.11)** — defensive over-escaping. (Edge-E13)
- **[E3.S5] `AppendLineFolded` walk-back theoretical infinite loop** — unreachable in practice. (Edge-E16)
- **[E3.S5] `Build_LineFolding_DoesNotSplitUtf8MultiByteSequences` test gap** — doesn't catch "drop codepoint entirely". (Edge-E15)

## Deferred from: code review of Epic-3 boundary Round 3 (e3-s1, e3-s2, e3-s3, e3-s4, e3-s5) (2026-05-14)

- **[E3.S2] CancelRegistration FOR UPDATE row lock** [`backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:465-484`] — already deferred from round-2 H-S2-5; concurrent cancellation can double-promote a waitlist row. Address in a cross-cutting cancellation-concurrency track.
- **[E3.S2] CancellationToken not plumbed through pre-existing Epic-2 endpoints** [`backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:204-640`] — `RegisterPublic`, `RegisterMember`, `CancelRegistration`, `MarkAsNoShow`, `RevertNoShow`, `RevertCheckIn`, `RevertCancellation`, `GetStatistics`, `ExportRegistrationsPdf`. Pre-existing surface; client aborts continue to completion server-side. Out-of-scope for E3.
- **[E3.S3] `IsStaffCaller` hardcoded role list** [`backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs:31`] — duplicates the `RequireEventStaff` policy role set. Latent only when a new staff role is added; needs role-registry single-source-of-truth refactor.
- **[E3.S3] No DELETE endpoint for `EventVolunteerRole`** — design intent: manager flow uses `IsActive=false` deactivation, never hard-delete. RESTRICT FK on `assignment.role_id` protects against accidental delete. Track if managers ever request the wholesale-delete flow.
- **[E3.S4] Hardcoded DE/EN strings in `EventNotificationService` reminder body** [`backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs:183-232`] — D8 carve-out from i18n parity rule (server-side bilingual email is intentional). Address with the 6 pre-existing German-only methods in a cross-cutting communication-i18n track.
- **[E3.S4] `ZurichTimeZone` cached at static initialization** [`backend/src/IabConnect.Infrastructure/Events/EventNotificationService.cs:90-101`] — host `tzdata` updates require process restart for reminder times to reflect new DST rules. Standard .NET pattern; operationally rare on managed Linux hosts that restart for security updates anyway.

## Deferred from: code review of Epic-3 boundary Round 4 (e3-s1, e3-s2, e3-s3, e3-s4, e3-s5) (2026-05-14)

- **[E3.S1] Roster query return-type drift** [`backend/src/IabConnect.Application/Events/CheckIn/GetEventCheckInRosterQuery.cs`] — AC-1/AC-3 still say `IRequest<EventCheckInRosterDto?>`, code returns the `IRequest<EventCheckInRosterLookup>` envelope (intentional Round-2 H-S1-3 fix). Spec reconciliation only.
- **[E3.S2] QR-code check-in has no event scoping** [`backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:~605`] — any global `RequireEventStaff` user can check in registrations of any event via a held QR token. Pre-existing global-role limitation; tracked with the role-registry work alongside R3-Defer-5.
- **[E3.S2] Manual-search check-in omits `searchQueryHash` when `SearchQuery` is empty** [`backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs:~517-525`] — AC-4 says `additionalData` MUST include it for the manual path; arguably acceptable since there is no query to hash. Revisit if audit completeness needs a sentinel.
- **[E3.S3] Read endpoints use `RequireEventStaffOrMember`, AC-7 says `RequireMember`** — intentional Round-3 R3-DN-4 decision; spec reconciliation only.
- **[E3.S3] `IncreaseCapacity` renamed to `UpdateCapacity(newCapacity, currentConfirmedCount)`** [`backend/src/IabConnect.Domain/Events/Volunteers/EventVolunteerShift.cs`] — intentional Round-3 H-S3-4 fix (bidirectional capacity), functional superset of AC-1; spec reconciliation only.
- **[E3.S3] `EventVolunteerAssignmentRepositoryTests` not present under that name** [`backend/tests/IabConnect.Infrastructure.Tests/Events/`] — constraint/FK cases folded into `EventVolunteerAssignmentConcurrencyTests.cs`; verify a `CountConfirmedAsync` excludes-cancelled assertion exists when the S3 test-gap patches are addressed.
- **[E3.S4] Reminder window is 36h, AC-5 says 24h** [`backend/src/IabConnect.Application/Events/Jobs/VolunteerShiftReminderService.cs`] — intentional Round-2 H-S4-4 fix; spec reconciliation only.
- **[E3.S4] `SendVolunteerShiftReminderAsync` signature adds a `Member` parameter not in AC-5** [`backend/src/IabConnect.Application/Events/IEventNotificationService.cs`] — avoids a duplicate fetch, documented in XML doc; spec reconciliation only.
- **[E3.S4] Frontend `volunteers/__tests__/page.test.tsx` still missing** [`frontend/src/app/(dashboard)/events/[id]/volunteers/`] — already deferred Round 3 as R3-H-S4-3 (`frontend-test-coverage-volunteers-page`); re-surfaced by the Round-4 auditor, no production impact.
- **[E3.S5] `ResolveBaseUrl` re-validates per request and throws → 500 on misconfig** [`backend/src/IabConnect.Api/Endpoints/EventEndpoints.cs`] — already documented Round 3 R3-H-S5-2 as out-of-scope; proper fix is `IOptions<T>.ValidateOnStart()`.
- **[E3.S5] `HashCalendarSubscriptionTokens` `length<>64` guard would leave a 64-char cleartext token unhashed** [`backend/src/IabConnect.Infrastructure/Migrations/20260513205649_HashCalendarSubscriptionTokens.cs`] — safe today (~43-char tokens), one-shot migration already deployed; hex-shape check or `is_hashed` flag is the correct hardening if token format changes.
- **[E3.S5] `URL` property emitted unescaped, AC-6 lists it among text-escaped properties** [`backend/src/IabConnect.Application/Events/Calendar/CalendarFeedBuilder.cs`] — intentional Round-3 R3-L-S5-1 fix (RFC 5545 §3.3.13); spec reconciliation only.
- **[E3.S5] `Member.CalendarSubscriptionToken` renamed to `...Hash`, stores SHA-256 digest** [`backend/src/IabConnect.Domain/Members/Member.cs`] — intentional Round-2 H-S5-1 security hardening; spec reconciliation only vs AC-3.
- **[E3.S5] `GetPublicCalendarFeedQueryHandlerTests` + `EventCalendarFeedEndpointTests` still missing** [`backend/tests/IabConnect.Application.Tests/Events/Calendar/`, `backend/tests/IabConnect.Api.Tests/`] — already deferred Round 3 as R3-H-S5-7 / R3-H-S5-8 (`calendar-feed-api-tests`); re-surfaced by the Round-4 auditor. The public-feed visibility filter (AC-1 privacy guarantee) has zero automated coverage — raise priority.

---

## Deferred from: code review of Epic 9 (2026-05-14)

- **[E9.S3] Extra DB round-trip per email/PDF send, no `SystemSettings` caching** [`EventNotificationService.cs`, `DunningEmailService.cs`, `EventRegistrationPdfExporter.cs`] — each send independently calls `ISystemSettingsRepository.GetSettingsAsync` to read `ApplicationName`; a campaign to N recipients = N identical queries on a singleton row the frontend already caches for 300s. Not a correctness bug; introduced by E9 but a shared `SystemSettings` cache is a caching-strategy decision beyond this epic.
- **[E9.S3] Email HTML encodes the org name but not adjacent user-controlled fields** [`DunningEmailService.cs`, `EventNotificationService.cs`] — the E9 code wraps the new dynamic `appName` in `WebUtility.HtmlEncode`, but the same templates still interpolate `{invoice.RecipientName}`, `{notice.Notes}`, `{evt.Title}`, `{registration.ParticipantEmail}` etc. raw — a pre-existing HTML-injection hole the new code draws attention to without closing. Worth a dedicated email-template encoding pass.
- **[E9.S2] Pre-existing lint baseline failure in untouched files** [`frontend/src/app/members/segments/page.tsx`, `frontend/src/app/admin/backups/page.tsx`] — all 4 E9 stories self-report this baseline `npm run lint` failure; the files were not touched by E9, so it is not an E9 regression. Flagged for the E9 retrospective / a cleanup pass.

---

## Deferred from: code review of Epic 10 (2026-05-14)

- **[E10.S1] `InvalidateCache()` clears only the local process** [`backend/src/IabConnect.Infrastructure/Persistence/Services/ModuleSettingsService.cs`] — `IMemoryCache` is per-process; in a multi-instance deployment only the node that served the PUT invalidates, others serve a stale module map until the per-process TTL expires. Pre-existing architectural limitation — the `// TODO: Add caching (Redis)` marker this story replaced acknowledges it; the modular-monolith MVP is single-instance. Distributed cache (Redis) is the planned fix.
- **[E10.S2] `ModuleSettingsEndpointTests` is metadata-only** [`backend/tests/IabConnect.Api.Tests/Endpoints/ModuleSettingsEndpointTests.cs`] — pins the admin-role policy at the endpoint-metadata layer; does not spin up the host to prove a non-admin gets a runtime 403 (AC-7 / Task-5 wording). Test-fidelity gap, not a code defect — runtime "never-gated" coverage for the module-settings group already exists in E10-S3's `ModuleEnforcementEndpointTests`.
- **[E10.S2] `UpdateModuleSettingCommand` returns 404 for a valid-but-unseeded key** [`backend/src/IabConnect.Application/ModuleSettings/Commands/UpdateModuleSettingCommand.cs`] — a key in `ModuleKeys.All` whose seed row is missing passes validation, then `GetByKeyAsync` returns null → `KeyNotFoundException` → 404, with no upsert/self-heal path. Only reachable from a broken DB state (failed/partial migration seed); not caused by this change.
- **[E10.S5] Playwright E2E suite authored but unverified in CI** [`frontend/e2e/module-enforcement.spec.ts`] — the suite `test.skip()`s itself without `E2E_ADMIN_PASSWORD`, so AC-6/AC-7 "the E2E suite passes" is unproven. Needs the full local stack (Docker + Keycloak + seeded admin) to run for real; the backend + Vitest suites are the CI-runnable proof of the same behaviour. Run it when the full stack is available.

---

## Deferred from: code review of Epic 10 boundary re-review (2026-05-15)

Round 2 of the Epic-10 epic-boundary review, run over the full E10 diff (`7a07d7c..d1958da`, 93 files / +9.719/-821 lines) after the 13-patch fix-pass. Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor (13/13 prior patches verified). Per-story round-2 defers are recorded inline in the e10-s1..s5 `## Review Findings` sections; the two items below are cross-cutting (don't belong to a single story).

- **[Cross-cutting] Audit actor identity uses username, not stable `sub` claim** — `Member.UpdatedBy`, `SystemSettings.UpdatedBy`, `ModuleSetting.UpdatedBy`, and audit-row actor fields throughout the codebase store `HttpContext.GetUserName()`. A Keycloak user rename breaks forensic traceability of any historical action by that user. Pre-existing project-wide pattern; cross-cutting audit-identity hardening track. (Surfaced again by E10's `UpdateModuleSettingCommand` + `ModuleAuthorizationHandler` audit writes.)
- **[Cross-cutting] `ModuleAuthorizationHandler` writes one audit row per denied request with no rate-limit / coalescing** — a misconfigured polling client (e.g. once-per-second to `/api/v1/finance/transactions` while `Module:finance` is off) produces ~86k audit rows/day in the "System Security" category. Same pattern applies to other audit-write-on-deny endpoints across the codebase. Cross-cutting audit-volume control track.

---

## Deferred from: E11-S1 implementation (2026-05-16)

The configuration-surface foundation story (`e11-s1-add-env-examples-and-document-config-precedence`) intentionally limits its scope to documentation, `.env.example` files, `.gitignore` tightening, README precedence, and the `appsettings.Beta.json` skeleton. The findings below were surfaced by the AC-5 hardcoded-host audit but deferred per story scope so that no code paths change in E11-S1.

### E11-S1 follow-up: `appsettings.json` base cleanup

**Trigger story:** E11-S2 (`ASPNETCORE_ENVIRONMENT=Beta`) — first story where Beta loads base `appsettings.json` then `appsettings.Beta.json` without dev overlays and would inherit `localhost:5433` until env-var overrides resolve.

**Keys to move from `backend/src/IabConnect.Api/appsettings.json` to `backend/src/IabConnect.Api/appsettings.Development.json`:**

- `ConnectionStrings.DefaultConnection` (currently `Host=localhost;Port=5433;…` in both files — base should be empty or a non-host placeholder)
- `Keycloak.Authority` (currently `http://localhost:8080/realms/iabconnect` in both — base should be empty)
- `DocumentStorage.ServiceUrl` (currently `http://localhost:9000` in both — base should be empty)
- `DocumentStorage.AccessKey` / `SecretKey` (currently `rustfsadmin` literal credentials in BOTH files — must NEVER appear in base; dev-only credential)
- `DocumentStorage.BucketName` (currently `iabconnect-documents` in both — base should be empty)
- `Smtp.Host` (currently `localhost` in both — base should be empty)

**Rationale:** The base `appsettings.json` should contain production-safe non-sensitive defaults so Beta/Production cleanly layer overrides without inheriting dev hosts. Today the duplication between base and Development is harmless because the Development overlay re-sets every key — but Beta will not.

**Why deferred:** A single-file move could introduce a regression if any code path reads `appsettings.json` without `appsettings.Development.json` overlay (test hosts, isolated unit tests). E11-S2 is the natural trigger because it adds the Beta-load path and would otherwise hit this issue first.

### E11-S1 follow-up: Beta `Serilog.WriteTo` array-merge silently surfaces base File sink

**File:** `backend/src/IabConnect.Api/appsettings.Beta.json`

**Discovered by:** code-review-2026-05-16 (Blind Hunter F1, re-classified to defer after verifying .NET config array semantics).

**Problem:** .NET Configuration merges JSON arrays **by index**, not wholesale-replace. Beta's `"Serilog": { "WriteTo": [{ "Name": "Console" }] }` overrides base's `WriteTo[0]` (Console — fine) but base's `WriteTo[1]` (File sink at `appsettings.json:21-30`) survives the merge → Beta would still write File logs, contradicting ADR-017's "Console-only in Beta" decision.

**Fix:** Structural, tied to the `appsettings.json base cleanup` entry below. Move the File sink from base `appsettings.json` into `appsettings.Development.json`, leaving base with Console-only. After that move, Beta inherits the Console-only configuration correctly without needing any change to `appsettings.Beta.json`.

**Why deferred:** Same trigger as the base cleanup (E11-S2 wires `ASPNETCORE_ENVIRONMENT=Beta` and is the first place this matters). The Beta skeleton committed by E11-S1 expresses the right INTENT; the execution depends on the base cleanup landing first.

**E11-S2 acceptance criterion to add:** "After moving the File sink to `appsettings.Development.json`, verify with `dotnet run --launch-profile=https` and `ASPNETCORE_ENVIRONMENT=Beta` that `logs/` is empty (only Console sink active)."

### E11-S1 follow-up: `KeycloakHealthCheck.cs` configuration-key typo

**File:** `backend/src/IabConnect.Api/HealthChecks/KeycloakHealthCheck.cs:16`

**Current:** `var authority = configuration["Authentication:Authority"];`

**Should be:** `var authority = configuration["Keycloak:Authority"];`

**Impact:** `Authentication:Authority` is not a defined section anywhere in the codebase, so the read returns `null`. The health-check then either no-ops or follows a default-URL code path. The `Keycloak:Authority` value IS the intended source (matches the OIDC binding at `Api/DependencyInjection.cs:121-122`).

**Why deferred:** Fixing the typo changes runtime behavior — the health check would start actually validating Keycloak reachability and might return 503 in environments where the Keycloak URL is wrong or unreachable. That is a real correctness improvement but a behavior change worth its own story with proper before/after smoke-tests in Dev and Beta.

### E11-S2 follow-up: eager-init keys block cleanup of `ConnectionStrings:DefaultConnection` + `DocumentStorage:*`

**Discovered by:** E11-S2 implementation (2026-05-16). Partial-revert applied.

**Problem:** The E11-S2 base cleanup (AC-2) successfully moved `Keycloak:Authority` and `Smtp:Host` from `appsettings.json` to `appsettings.Development.json`. The five originally-planned keys `ConnectionStrings:DefaultConnection` + `DocumentStorage:ServiceUrl`/`AccessKey`/`SecretKey`/`BucketName` were REVERTED to their dev defaults because emptying them broke existing `WebApplicationFactory`-based API tests:

1. **`ConnectionStrings:DefaultConnection`** — Hangfire's `UsePostgreSqlStorage` (`Infrastructure/DependencyInjection.cs:181-193`) eagerly calls `PostgreSqlStorage..ctor → CreateAndOpenConnection` at DI registration. Empty string → `Npgsql.InvalidOperationException: The ConnectionString property has not been initialized` → 57 API tests crash at `WebApplicationFactory.CreateClient()`.
2. **`DocumentStorage:*`** — `Infrastructure/DependencyInjection.cs:259` calls `configuration.GetSection(...).Get<DocumentStorageSettings>()` at DI registration and captures the value in an `AddSingleton<IAmazonS3>` factory closure. Empty values → S3 client init or first call fails → `SettingsEndpointTests.GetLogo_NoLogoConfigured_Returns404` returns 500 instead of 404.

**Common root cause:** both registrations read configuration EAGERLY (not via IOptions). The `TestWebApplicationFactory`'s `ConfigureAppConfiguration` InMemoryCollection override is applied during `builder.Build()` — AFTER `AddInfrastructureServices` has already captured the empty base values into singleton closures.

**Contrast with the SUCCESSFUL cleanups:** `Keycloak:Authority` (`Api/DependencyInjection.cs:122`) reads inside the `AddJwtBearer(options => { ... })` post-configure callback, which fires lazily when `JwtBearerOptions` is resolved per request — by then the InMemory override is effective. `Smtp:Host` is bound via `services.Configure<SmtpSettings>(configuration.GetSection(...))` (`Infrastructure/DependencyInjection.cs:196`), also lazy. These two cleanups landed cleanly.

**Fix path (recommend in order):**
1. **Refactor Infrastructure DI to use IOptions for DocumentStorage** — change line 259 to `services.AddSingleton<IAmazonS3>(sp => { var opts = sp.GetRequiredService<IOptions<DocumentStorageSettings>>().Value; ... })`. This makes the binding lazy. Low risk, mechanical change.
2. **Make Hangfire init lazy** — wrap `UsePostgreSqlStorage(...)` in `services.AddSingleton<JobStorage>(sp => new PostgreSqlStorage(...))` or use `IHostedService` initialization. Higher risk because Hangfire's registration patterns are fixed by the library.
3. **Or change `TestWebApplicationFactory` to inject configuration via env-vars BEFORE host construction.** Most invasive (changes shared test infra).

**Why deferred:** All three fixes are structural and orthogonal to E11-S2's Beta-environment-label goal. The leak (committed `rustfsadmin` credentials in base) is real but limited-impact: Production sets env vars; Beta sets env vars; only Dev inherits the literal credentials from base, which is the intended Dev experience. Recommend tackling as a focused refactor story (or fold into E15-S2 if `Database__AutoMigrate` work touches the same DI registration patterns).

**Workaround in E11-S2:** `AppSettingsLayeringTests.BaseConfig_DevDefaultsAreEmptied` and `BetaLayered_DoesNotInheritDevDefaults` Theory excludes the eager-init keys from the InlineData with a code comment explaining the deferral. The two non-eager keys (`Keycloak:Authority`, `Smtp:Host`) remain cleanly emptied and asserted.

### E11-S1 follow-up: `Branding__SourceUrl` consumed-after-documented

**Variable:** `Branding__SourceUrl` (added to `backend/.env.example` by E11-S1)

**Consumer:** E20-S3 (`/about` endpoint) — not yet implemented.

**Note:** Listing the variable in `.env.example` ahead of consumption is intentional so deployers can configure it before E20-S3 ships. No code currently reads `Branding:SourceUrl`. This is not a defect; just a forward-reference.


---

## Deferred from: code review of Epic E11 boundary (2026-05-16)

Adversarial review of Epic E11 (Environment and Configuration Management for Beta) across S1+S2+S3 produced 7 defers. Full per-story findings in [e11-s2-introduce-aspnetcore-environment-beta.md → Review Findings](e11-s2-introduce-aspnetcore-environment-beta.md) and [e11-s3-make-next-config-environment-driven.md → Review Findings](e11-s3-make-next-config-environment-driven.md).

### E11-S2 follow-up: BetaBanner test mutates `process.env` at runtime to test build-time-inlined var

[Source: BetaBanner.test.tsx:30-50, story R2 risk]

Tests pass under Vitest (Node sees the env-var write) but do NOT prove the Next.js production-build inlining of `NEXT_PUBLIC_ENV_LABEL`. A real fix needs a Next.js build-output integration test (grep `.next/static/chunks/` for the dismissed-key string and the inlined-label string). Repo lacks this test infrastructure today. **Action when picked up:** add a build-output integration smoke test (Playwright after `npm run build`, or a Vitest test that shells out to `npm run build` once per CI run).

### E11-S2 follow-up: `appsettings.Beta.json` `Logging.LogLevel.Default` may duplicate Serilog config

[Source: appsettings.Beta.json:7-12, appsettings.json:6]

Beta adds `Logging.LogLevel.Default = "Information"` while base has `Serilog.MinimumLevel.Default = "Information"`. When Serilog hosting is wired (it is — base file uses `Serilog.Using` for AspNetCore), `Logging:LogLevel` is typically non-load-bearing. **Action when picked up:** 30-minute runtime check; if redundant, remove the Beta section.

### E11-S2 follow-up: Empty `Keycloak.Authority` / `Smtp.Host` in base produce slow runtime failures

[Source: DependencyInjection.cs:132, SmtpEmailSender.cs:31; ties into existing `E11-S2 follow-up: eager-init keys block cleanup`]

After E11-S2 AC-2 emptied `Keycloak.Authority` and `Smtp.Host` in base, a Beta deployment without env-var overrides produces (a) `IDX20803: Unable to obtain configuration from: ''` on first authed request (JwtBearer lazy OIDC-discovery), and (b) `SocketException: No such host is known` after ~100s on first outbound mail. Fast-fail at startup would be better. **Action when picked up:** add `IValidateOptions<KeycloakOptions>` + `IValidateOptions<SmtpOptions>` with `Required` attributes on Authority/Host, wire via `services.AddOptions<T>().ValidateOnStart()`. Same change set as the existing eager-init refactor entry — bundle.

### E11-S2 follow-up: `AppSettingsLayeringTests` excludes the 5 deferred eager-init keys

[Source: AppSettingsLayeringTests.cs Theory InlineData]

Theory only asserts `Keycloak:Authority` and `Smtp:Host` are empty in the base+Beta layering. The 5 deferred keys (`ConnectionStrings:DefaultConnection`, `DocumentStorage:ServiceUrl`/`AccessKey`/`SecretKey`/`BucketName`) are NOT regression-tested. **Action when picked up:** after the eager-init refactor lands, extend the Theory data to assert all 7 keys empty in the base+Beta layer. Tied to D1 / E11-S2 AC-2 resolution.

### E11-S2 follow-up: Task 11 (manual smoke tests) marked `[x]` despite unverified

[Source: e11-s2 story file Task 11 + Completion Notes]

Dev-agent disclosed it could not run `dotnet run` / `npm run dev` interactively; documented expected outcomes instead of observed evidence. Process pattern, not E11-S2-specific. **Action when picked up:** address in the Epic-11 retrospective as a process-improvement (e.g., add a "Manual smoke not run by dev agent — needs human verification" status to the Tasks/Subtasks state machine, so reviewers don't confuse a green checkbox with empirical evidence).

### E11-S3 follow-up: `outputFileTracingRoot` scope-add disclosed in Completion Notes

[Source: next.config.ts:22]

Not a defect; flagged for transparency in the epic-boundary review record. The disclosure is in [e11-s3 Completion Notes](e11-s3-make-next-config-environment-driven.md) — sound justification + bounded change. No follow-up action needed; this entry exists only so the review trail is complete.

### Repo-wide follow-up: `.env.example` line-number references rot

[Source: backend/.env.example:103-107, frontend/.env.example similar patterns]

Many env-example comments cite specific `appsettings.json:NN` line numbers. These rot when the configuration file changes. Repo-wide pattern, not E11-specific. **Action when picked up:** replace line-number anchors with section anchors (e.g., "appsettings.json `Hangfire:DashboardPath` section") in a focused documentation-hygiene pass.

### E11-S2 follow-up: `BetaEnvironmentHardeningTests` HTTP-pipeline coverage (D2 resolution)

[Source: BetaEnvironmentHardeningTests.cs; E11-S2 AC-9; epic-boundary review decision D2 2026-05-16]

Spec listed 5 Beta-vs-Production hardenings to assert (Swagger 404, Hangfire 404, HSTS, HTTPS-redirect, strict CORS). Implementation covers only `JwtBearerOptions.RequireHttpsMetadata` (3 DI-level tests) — the other 4 are gated by `Program.cs:88 MigrateAsync()` which blocks a real `WebApplicationFactory<Program>.UseEnvironment("Beta")` because in-memory EF Core can't run the production-migration branch. **Action when picked up:** when E15-S2 adds the `Database__AutoMigrate` toggle, extend `BetaEnvironmentHardeningTests` to use a real Beta-WAF with `Database:AutoMigrate=false`, then HTTP-assert the 4 remaining hardenings against the live pipeline. Closes E11-S2 AC-9 fully.

### E11-S2 follow-up: rustfsadmin dev credentials in base appsettings.json (D1 resolution)

[Source: backend/src/IabConnect.Api/appsettings.json:38-41; E11-S2 AC-2 partial; epic-boundary review decision D1 2026-05-16]

The eager-init blocker (Hangfire `PostgreSqlStorage..ctor` + `Get<DocumentStorageSettings>()` singleton-closure baking at DI registration time) prevents emptying the 5 keys (`ConnectionStrings:DefaultConnection`, 4 `DocumentStorage:*`) without breaking the TestWebApplicationFactory InMemory override path. **Action when picked up (BEFORE any actual Beta deployment):** refactor DocumentStorage from singleton-eager-init to `IOptions<DocumentStorageSettings>` (the spec's documented Fix-path #1, "low risk, mechanical"); refactor Hangfire to use `IPostgreSqlStorageOptions` factory that reads connection-string lazily; then empty all 5 keys in base. Closes E11-S2 AC-2 fully and removes the last live `rustfsadmin` literal from base config. **Ties together with the existing "eager-init keys block cleanup" entry** — these are aspects of the same refactor, do as one PR.

## Deferred from: code review of Epic-12 boundary (2026-05-16)

Epic-12 (Dockerization) boundary review: full diff across e12-s1..e12-s4 (~924 lines code/config + ~1,945 lines story docs). Adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) produced 3 decision-needed, 7 patches, 28 defers, ~17 dismisses. The defers are listed below per source story for traceability.

### E12-S1 follow-up: PublishSingleFile override fragility (D1')

[Source: backend/Dockerfile:25-29; e12-s1 Review Findings 2026-05-16]

`/p:PublishSingleFile=false /p:UseAppHost=false` is a Dockerfile-level override of `Directory.Build.props:14`. If a maintainer adds another Release-conditioned single-file emitter later, the override list silently drifts and the runtime `ENTRYPOINT ["dotnet", "IabConnect.Api.dll"]` can't launch the resulting binary. **Action when picked up:** move the `PublishSingleFile=true` property to `IabConnect.Api.csproj` only, OR gate it behind `<DockerBuild>true</DockerBuild>` so the Dockerfile sets the gate explicitly. ~30 min.

### E12-S1 follow-up: DocumentStorage empty-default late-500 fail-mode (D2')

[Source: Infrastructure/DependencyInjection.cs:259-270; e12-s1 Review Findings 2026-05-16]

AC-8 of E12-S1 documents this fail mode: missing Railway env vars surface as a runtime 500 on first `IDocumentStorage` resolution rather than a boot crash. Bundles with the existing E11-S2 entry "Empty `Keycloak.Authority` / `Smtp.Host` in base produce slow runtime failures". **Action when picked up:** add `services.AddOptions<DocumentStorageSettings>().Bind(...).Validate(...).ValidateOnStart()` once the singleton-eager-closure is refactored to `IOptions<T>` (the D1 resolution of the earlier rustfsadmin entry).

### E12-S1 follow-up: `ASPNETCORE_ENVIRONMENT` no Dockerfile default (D3')

[Source: backend/Dockerfile ENV block:36-41; e12-s1 Review Findings 2026-05-16]

Missing the env var on Railway makes ASP.NET default to `Production`, activating HSTS + `UseHttpsRedirection`. Railway terminates TLS edge-side and forwards plain HTTP, so HttpsRedirection emits 307 that breaks non-browser clients. No `UseForwardedHeaders` is wired to recognize `X-Forwarded-Proto`. **Action when picked up:** E13-S2 sets the env var explicitly; E14-S2 owns the ForwardedHeaders middleware. Confirm both land before the first Railway deploy.

### E12-S1 follow-up: TestWebApplicationFactory static-ctor process-global env mutation (D4')

[Source: backend/tests/IabConnect.Api.Tests/TestWebApplicationFactory.cs:27-43; e12-s1 Review Findings 2026-05-16]

Static ctor calls `Environment.SetEnvironmentVariable` for `DocumentStorage__*`. Persists for the lifetime of the xUnit AppDomain. Any future test that reads these keys via raw `Environment.GetEnvironmentVariable` (or asserts their absence) sees leaked values. **Action when picked up:** convert to `IAsyncLifetime` fixture (`InitializeAsync` sets, `DisposeAsync` clears); replace static ctor with instance ctor.

### E12-S1 follow-up: NuGet cache mount missing (D5')

[Source: backend/Dockerfile:18; e12-s1 Review Findings 2026-05-16]

`RUN dotnet restore` is not wrapped in `--mount=type=cache,target=/root/.nuget/packages`. With `# syntax=docker/dockerfile:1.7` already declared, the change is one-line. CI-speed improvement. **Action when picked up:** add cache mount + verify with `time docker build --no-cache` baseline vs cached build.

### E12-S1 follow-up: AppSettingsLayeringTests new theory rows are change-detector tests (D6')

[Source: backend/tests/IabConnect.Api.Tests/AppSettingsLayeringTests.cs:73-98; e12-s1 Review Findings 2026-05-16]

The 6 new `DocumentStorage:*` rows pass tautologically — they assert `BeNullOrEmpty()` for keys that were just stripped from the JSON. A behavioral invariant test would be stronger. **Action when picked up:** after the `IValidateOptions<DocumentStorageSettings>.ValidateOnStart()` refactor lands (D2'), add a behavioral test that constructs `WebApplicationFactory<Program>` with `Database:AutoMigrate=false` + missing DocumentStorage env vars and asserts `OptionsValidationException` at startup.

### E12-S1 follow-up: Image size 384 MB vs AC-12 target ≤ 350 MB (D7')

[Source: e12-s1 AC-12, story Completion Notes; e12-s1 Review Findings 2026-05-16]

Root cause: `Directory.Build.props:14` `PublishTrimmed=false` + framework-dependent publish + wide package profile (EF Core, Hangfire, Serilog, QuestPDF, MediatR, AWS S3) producing a 154 MB published-app payload. **Action when picked up:** dedicated trimming/AOT story to evaluate `PublishTrimmed=true` + `PublishReadyToRun=true` + `TrimMode=partial`; expected outcome ≥ 80 MB reduction. Validate that QuestPDF + Hangfire + Npgsql trim safely.

### E12-S1 follow-up: AC-2 base-image text drift (D8')

[Source: e12-s1 AC-2, backend/Dockerfile:7,32; e12-s1 Review Findings 2026-05-16]

Microsoft moved `mcr.microsoft.com/dotnet/aspnet:10.0` to Ubuntu Noble; AC-2 text says Debian-bookworm. AC-3 timezone-resolution outcome preserved (ICU + tzdata pre-bundled). **Action when picked up:** spec-text fix in Epic-12 retrospective; no implementation change.

### E12-S2 follow-up: `HOSTNAME=0.0.0.0` collides with POSIX hostname convention (D9')

[Source: frontend/Dockerfile:82; e12-s2 Review Findings 2026-05-16]

`HOSTNAME` is both the Next.js standalone server's bind directive AND the conventional POSIX hostname env. Railway, K8s downward-API, `docker run --hostname` can silently override. **Action when picked up:** add wrapper script `docker-entrypoint.sh` that forces `HOSTNAME=0.0.0.0 exec node server.js`; runbook entry for E18-S1.

### E12-S2 follow-up: `.dockerignore` excludes test source but not test configs (D10')

[Source: frontend/.dockerignore:26-32; e12-s2 Review Findings 2026-05-16]

`playwright.config.ts`, `vitest.config.ts`, `eslint.config.mjs` reach the build stage. Cosmetic build-context bloat; runtime image unaffected. **Action when picked up:** one-line `.dockerignore` extension.

### E12-S2 follow-up: `public/.gitkeep` exposed at root URL (D11')

[Source: frontend/public/.gitkeep; e12-s2 Review Findings 2026-05-16]

Next.js standalone exposes `public/` at URL root; `https://web/.gitkeep` returns HTTP 200 0 bytes. Security scanners flag exposed dotfiles. **Action when picked up:** add a runtime-stage `RUN rm -f /app/public/.gitkeep` once `public/` has at least one other file.

### E12-S3 follow-up: Keycloak `${VAR}` placeholder fail-fast guard missing (D12')

[Source: realms-beta/iabconnect-realm.json:228,252,256,261; e12-s3 Review Findings 2026-05-16]

Unsubstituted `${IABCONNECT_ADMIN_CLIENT_SECRET}` / `${IABCONNECT_FRONTEND_CLIENT_SECRET}` / `${FRONTEND_PUBLIC_URL}` import as LITERAL strings. Backend's real-secret auth gets 401 silently on every token exchange. **Action when picked up:** add a bash wrapper around `kc.sh start --optimized` that fails fast if any of the three env vars is empty or unsubstituted. E13-S2 / E18-S1 runbook addition.

### E12-S3 follow-up: KC_DB build-time-frozen + `:smoke` companion tag must NOT publish (D13')

[Source: infra/keycloak/Dockerfile:32-37; e12-s3 Review Findings 2026-05-16]

Quarkus augments per-driver classes at `kc.sh build` time, so `KC_DB` must match runtime. Production image bakes `KC_DB=postgres`; local non-postgres smoke uses a separate `:smoke` tag baked with `KC_DB=dev-file`. **Action when picked up:** E20-S5 GHCR-publish workflow must explicitly exclude the `:smoke` tag; runbook entry that only the `postgres`-baked image goes to the registry.

### E12-S3 follow-up: Realm-check probe doesn't verify SPI registration (D14')

[Source: docker-compose.full.yml:64-72; e12-s3 Review Findings 2026-05-16]

`/.well-known/openid-configuration` 200 only proves realm metadata is in the DB. If `kc.sh build` silently dropped `disable-new-users-spi-1.0.0.jar`, realm-check passes but the eventsListener is dark. **Action when picked up:** extend the probe to authenticate against admin REST API and query `/admin/realms/iabconnect/events/config` to assert `eventsListeners` contains `disable-new-users`. Pairs with realm-check budget extension (D29').

### E12-S3 follow-up: `service-account-iabconnect-admin` retains full `realm-admin` role (D15')

[Source: realms-beta/iabconnect-realm.json:267-278; e12-s3 Review Findings 2026-05-16]

No credentials block (clean) but the role mapping is maximum-scope. If the `iabconnect-admin` client secret leaks, full realm-admin. `KeycloakAdminService.cs:403` likely uses only a narrow subset (create-user, reset-password, query-users). **Action when picked up:** least-privilege refactor — define a custom role aggregating only the scopes the backend actually calls; audit `KeycloakAdminService` for the actual scope footprint first. E14-S5 audit story is a natural pair.

### E12-S3 follow-up: Realm `sslRequired: "external"` permits HTTP for internal callers (D16')

[Source: realms-beta/iabconnect-realm.json:6; e12-s3 Review Findings 2026-05-16]

Combined with `KC_HOSTNAME_STRICT: "false"` this means Beta is effectively HTTP-everywhere from Keycloak's perspective (Docker bridge IP, Railway proxy IP all count as "internal"). **Action when picked up:** flip to `"all"` once Railway TLS edge-termination is confirmed (E14-S2 security headers + HTTPS story).

### E12-S3 follow-up: SPI jar pulled by literal filename — version-bump tripwire (D17')

[Source: infra/keycloak/Dockerfile:15,24; e12-s3 Review Findings 2026-05-16]

`disable-new-users-spi-1.0.0.jar` literal; SPI `pom.xml` version bump silently breaks the build. **Action when picked up:** change to glob `cp /build/target/disable-new-users-spi-*.jar /opt/keycloak/providers/` + a count-equals-1 guard.

### E12-S3 follow-up: Epic-12 parent AC for S3 enumerates non-existent `EventStaff` role (D18')

[Source: epics-and-stories.md:1324; e12-s3 Review Findings 2026-05-16]

Sanitized realm correctly preserves dev (7 roles: mfa-required, admin, vorstand, member, kassier, auditor, event-manager). Parent-epic AC is the defect. **Action when picked up:** Epic-12 retrospective fixes the parent AC text OR adds `event-staff` to both dev and sanitized realms (decision: is EventStaff a real role on the roadmap or AC drafting noise?).

### E12-S4 follow-up: `--import-realm` re-import on every restart (D19')

[Source: docker-compose.full.yml:26, infra/docker-compose.yml:28; e12-s4 Review Findings 2026-05-16]

Pre-existing pattern in base; overlay propagates. Keycloak 26.5.2 default with `--import-realm` is "import once, skip if realm exists" — for Beta with persistent Postgres, subsequent deploys preserve admin-console edits. **Action when picked up:** verify the actual `KC_IMPORT_REALM_STRATEGY` default in 26.5.2 against this assumption; if "overwrite", file as Beta-blocker and add `KC_IMPORT_REALM_STRATEGY=IGNORE_EXISTING` to the overlay.

### E12-S4 follow-up: Hardcoded local-dev secrets in overlay YAML (D20')

[Source: docker-compose.full.yml:41-43,121,142,149; e12-s4 Review Findings 2026-05-16]

`admin-service-secret-2026`, `frontend-dev-secret-2026`, `local-dev-secret-min-32-chars-aaaaaaaaaaaaaaa` are committed in the overlay. They match values in `infra/keycloak/realms/iabconnect-realm.json` + `appsettings.Development.json` (also committed). Local-dev convenience values, not real Beta secrets. **Action when picked up:** externalize to `infra/.env.full.example` with `${VAR}` references; marginal defense-in-depth; ergonomic trade-off.

### E12-S4 follow-up: No `init: true` / tini for PID-1 (D21')

[Source: backend/Dockerfile:67, frontend/Dockerfile:107, compose overlay; e12-s4 Review Findings 2026-05-16]

Relevant once features `Process.Start` shell out (PDF export, ImageMagick, future SPI tooling). **Action when picked up:** add `init: true` per-service in compose overlay (compose-level tini); for standalone Dockerfile use, `apk add tini` + `ENTRYPOINT ["tini", "--", ...]` in runtime stages.

### E12-S4 follow-up: `curlimages/curl:8.10.1` tag-pinned not digest-pinned (D22')

[Source: docker-compose.full.yml:54; e12-s4 Review Findings 2026-05-16]

Supply-chain hygiene. **Action when picked up:** pin via `@sha256:...` once the Beta image inventory is locked in E20-S5.

### E12-S4 follow-up: AC-8 service-count typo (D23')

[Source: e12-s4 AC-8, story line 206; e12-s4 Review Findings 2026-05-16]

AC-8 says "8 services" but the enumeration miscounted "6 long-running" then listed 7. Implementation correctly delivers 9 services (7 long-running + 2 one-shot). **Action when picked up:** retrospective AC text fix.

### E12-S4 follow-up: A29 sub-item completion table for AC-9 not granular (D24')

[Source: e12-s4 Completion Notes AC-Subitem table; e12-s4 Review Findings 2026-05-16]

AC-9 contains 4 smoke targets; A29 requires per-sub-item status. Evidence IS captured elsewhere (Completion Notes lines 575-579). **Action when picked up:** retrospective doc-format fix; consider sub-item-table template in story-context skill.

### E12-S4 follow-up: Pre-existing seq restart loop (D25')

[Source: e12-s4 story line 520; e12-s4 Review Findings 2026-05-16]

`datalust/seq:latest` tag drift; overlay made zero edits to seq. **Action when picked up:** pin seq to a stable tag in `infra/docker-compose.yml` (separate work item, not Epic-12 scope).

### E12-S4 follow-up: Smtp asymmetry undocumented (D26')

[Source: docker-compose.full.yml:112-114, README Option 4; e12-s4 Review Findings 2026-05-16]

Overlay uses Mailhog (accepts anything, no TLS); real Beta uses Mailtrap with `Smtp__EnableSsl=true`. Tester who exports `.env` with `EnableSsl=true` to mirror Beta gets connection failures against Mailhog. **Action when picked up:** README Option 4 operational note "Smtp differences between local Beta-shape and real Beta".

### E12-S4 follow-up: `NEXT_PUBLIC_FEEDBACK_URL` not in overlay (D27')

[Source: docker-compose.full.yml:140-148; e12-s4 Review Findings 2026-05-16]

Defaults to empty per `frontend/Dockerfile:55`; BETA banner falls back to `${NEXT_PUBLIC_SOURCE_URL}/issues/new`. Overlay can't smoke-test the explicit-FEEDBACK_URL branch. **Action when picked up:** add `NEXT_PUBLIC_FEEDBACK_URL: "https://github.com/htos/iab-connect/issues/new"` to overlay args.

### E12-S4 follow-up: `disabled-by-full` profile back-and-forth on shared Postgres (D28')

[Source: docker-compose.full.yml:14-15, infra/docker-compose.yml:13; e12-s4 Review Findings 2026-05-16]

Switching between base `docker compose up` (volume-mounted SPI path, dev realm) and overlay `up -f -f` (custom image, sanitized realm) leaves hybrid realm state in shared Postgres. **Action when picked up:** README Option 4 operational note about `docker compose down -v` between modes; or scope a separate `postgres-kc` for the overlay.

### E12-S4 follow-up: Realm-check 50s budget is non-gating (D29')

[Source: docker-compose.full.yml:64-72; e12-s4 Review Findings 2026-05-16]

`api` depends on `keycloak-full` (`service_started`) but NOT on `keycloak-full-realm-check` (`service_completed_successfully`). Cold Quarkus + Postgres schema bootstrap can take 60-90s. **Action when picked up:** ties into Patch P5 (HEALTHCHECK + service_healthy) — extend budget to 120s (24×5s) AND make api boot wait on `keycloak-full-realm-check.condition: service_completed_successfully`.

### E12-S4 follow-up: AC-9 RustFS console smoke 403/501 not 200 (D30')

[Source: e12-s4 AC-9, story line 212; e12-s4 Review Findings 2026-05-16]

`curl -sf` treats non-2xx as failure → AC-9 command's literal exit code would be non-zero. 403/501 with valid `x-request-id` does prove reachability (AC-9 closing sentence's intent). **Action when picked up:** change AC-9 smoke target to a S3-API endpoint that returns 200 (e.g., MinIO-compatible `/minio/health/live` if RustFS exposes one); retrospective AC update.

