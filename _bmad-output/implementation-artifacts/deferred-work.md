# Deferred Work

Items deferred during code reviews — not caused by the reviewed change, but worth addressing in a dedicated pass.

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
