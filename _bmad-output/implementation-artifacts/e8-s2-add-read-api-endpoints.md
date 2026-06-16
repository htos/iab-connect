# Story E8.S2: Add Read API Endpoints

Status: done

## Story

As an external integration,
I want scoped, rate-limited, integration-safe read endpoints,
so that approved systems can consume only the low-risk IAB Connect data their credential is authorized for, without leaking sensitive fields.

## Acceptance Criteria

1. A dedicated external API route group exposes **initial low-risk read resources only** — published Events and published Blog posts (the only public, author-managed content aggregates; see E7-S4) — under a versioned external prefix (e.g. `/api/v1/external/*`).
2. Responses use **integration-safe DTOs that omit sensitive fields by default** — no contact email/phone, no organizer identity, no internal status/timestamps, no member or finance data. Sensitive fields are excluded by construction, not by caller opt-out.
3. Each endpoint applies **pagination, filtering, and rate limiting**: list endpoints return the shared paged envelope (`page`/`pageSize`/`sort`/`filter`) and inherit (at minimum) the global rate limiter; `pageSize` is clamped.
4. The external API contract is **documented** (endpoints, params, response shapes, auth/scope, rate limits).
5. **Access-denied and rate-limit behavior are testable**: a request with no/invalid credential → 401; a valid credential lacking the required scope → 403; a disabled `api` module → 403; over-limit → 429.

## Tasks / Subtasks

- [x] Task 0: Spike + confirm S1 seam (AC: all) — resolve DEC-1..DEC-5 (see Decision-Needed)
  - [x] Confirm E8-S1 shipped the consumable seam (A62 — a sibling DEC is not a delivered contract): the `"ApiKey"` authentication scheme, the `Scope:` policy prefix + `ScopeRequirement`, and the `Module:api` key/seed must actually exist. If any is missing, escalate — this story cannot enforce AC-5 without them.
  - [x] Confirm the route-mapping root `EndpointMapper.cs:10-88` (`MapApiEndpoints`, wired `DependencyInjection.cs:452`); the public-surface precedents (`BlogEndpoints.cs:18` `/api/v1/blog/public`, `EventEndpoints.cs:31-37` `/public` + `RequireModule("public_view")`).
  - [x] Confirm the paging contract: `PagedResult<T>` (`Application/Common/Result.cs:6-24`), `PaginationHelper` (`ParseSort:12-24`, `ParseFilter:29-42`, `ToPagedResult` clamps pageSize 1..100 `:48-67`); canonical query `GetInvoicesQuery.cs:33-39`.
  - [x] Confirm the two-DTO precedent for safe projection: `BlogEndpoints.cs:241-247` (`MapToPublicDto` omits internal fields). **Confirm the anti-precedent: `EventDto` LEAKS `ContactEmail`/`ContactPhone`/`OrganizerId`/`OrganizerName` to anonymous callers (`EventEndpoints.cs:754-794`) — must NOT be reused.** Confirm `MemberDto` exposes `Email`/`Phone` (`MemberEndpoints.cs:686-696`) → members excluded from v1.
  - [x] Confirm `ContentLanguage` (E7-S4) is public-safe on both `Event` and `BlogPost` and worth surfacing.
- [x] Task 1: External route group + DTOs (AC: 1, 2)
  - [x] New `ExternalApiEndpoints.cs` registering `var external = app.MapGroup("/api/v1/external")` wired into `EndpointMapper.cs` near the public block. Group carries `.RequireAuthorization(...)` with `AuthenticationSchemes="ApiKey"` (from S1), `.RequireAuthorization("Module:api")`, and `.RequireRateLimiting(...)` (DEC-5).
  - [x] New `External*Dto` records (whitelist-only) per resource — `ExternalEventDto` (id, title, description, start/end, location, visibility=Public-only, `contentLanguage`; NO contact/organizer fields), `ExternalBlogPostDto` (id, slug/title, summary/body, publishedAt, `contentLanguage`; NO internal status/timestamps). Distinct mappers `MapToExternalDto(...)`. Never reuse `EventDto`/`MemberDto`.
- [x] Task 2: Endpoints + queries (AC: 1, 2, 3)
  - [x] `GET /api/v1/external/events` + `/events/{id}` and `GET /api/v1/external/blog` + `/blog/{id}`. Each requires the matching scope from S1 via `.RequireAuthorization("Scope:events:read")` / `"Scope:blog:read"`.
  - [x] Reuse the existing **published-only** read paths (`IEventRepository.GetPublicEventsAsync` / `IBlogPostRepository.GetPublishedAsync`) — never expose drafts/unpublished. Project to `External*Dto`.
  - [x] List endpoints return `PagedResult<ExternalXDto>` via `PaginationHelper` with `page`/`pageSize`/`sort`/`filter` (pageSize clamped 1..100); a single-item GET returns 404 for unpublished/nonexistent ids (no existence oracle for private data).
- [x] Task 3: Rate limiting (AC: 3, 5)
  - [x] Attach a rate-limit policy to the external group (DEC-5: inherit global limiter, or add a dedicated `"external-api"` named policy in `RateLimiterRegistration.cs` partitioned on the `ApiClient` id from the `NameIdentifier` claim S1 sets).
- [x] Task 4: Contract documentation (AC: 4)
  - [x] Add an "External API" section documenting the endpoints, query params, response DTO shapes, the `ApiKey` auth header + required scopes, rate limits, and error format. Per repo convention, hand-written tables in `docs/api-contracts-backend.md` (DEC-4); additionally tag endpoints `.WithTags("External API")` + `.Produces<...>()` so the dev-only Swagger reflects them.
- [x] Task 5: Tests (AC: all)
  - [x] API: list returns only published rows projected to the safe DTO; **assert the DTO does NOT contain contact/organizer/member/finance fields** (serialize + assert absent — the load-bearing AC-2 test); pagination clamps + sort/filter parse; `/{id}` 404 for unpublished. Auth matrix (AC-5): no key → 401, wrong scope → 403, `Module:api` disabled → 403, over-limit → 429 (or a deterministic policy-attached assertion if time-based 429 is environment-fragile, per `RateLimitingTests` DEC-2 precedent).
  - [x] A63: register any new injected service in endpoint-metadata harnesses that map the external group.
- [x] Task 6: Quality gates (AC: all)
  - [x] A29 per-AC table. AC-2 sensitive-field-exclusion proven per-resource (events + blog), not aggregate.
  - [x] Backend builds 0/0; `dotnet test` (Api + Application + Testcontainers where repo paths are touched). No frontend surface in this story (admin UI is S1; consumers are external) — note that explicitly.

## Dev Notes

### Refresh Notes (A56 existing-implementation spike, 2026-06-07)

Bulk-refreshed from the 2026-05-12 stub. Greenfield external surface. Spike findings:

- **No external/versioned API surface exists today.** The route root is `EndpointMapper.cs:10-88` (`MapApiEndpoints`, wired `DependencyInjection.cs:452`); modules self-prefix with literal `/api/v1/...`. The only "non-internal" surfaces are `*/public` anonymous reads (Blog `/api/v1/blog/public` `BlogEndpoints.cs:18`; Events `/public` `EventEndpoints.cs:31-37`; Settings `/api/v1/settings/public`; the ICS calendar feed). The architecture note prefers a **separate external group** when the contract differs — create `/api/v1/external/*`, do not piggyback the inconsistent `*/public` groups (they'd couple the external contract to internal frontend churn).
- **Paging is standardized:** `PagedResult<T>` (`Result.cs:6-24`: Items/TotalCount/Page/PageSize + computed TotalPages/HasNext/HasPrevious); `PaginationHelper` clamps pageSize 1..100 (`:48-67`), parses `sort` as `field:desc` (`:12-24`) and `filter` as `key=value,key2=value2` (`:29-42`); canonical example `GetInvoicesQuery.cs:33-39`. Reuse this; do NOT copy the ad-hoc anonymous-object envelope in `GetEvents` (`EventEndpoints.cs:382-391`).
- **Integration-safe DTO precedent exists in Blog:** `BlogEndpoints.cs:241-247` has two mappers — `MapToPublicDto → PublicBlogPostDto` (omits internal `Status`/`CreatedAt`/`UpdatedAt`) vs `MapToAdminDto`. Follow this two-DTO shape. **Anti-precedent (do NOT copy): public Events reuse the full `EventDto` for anonymous callers, leaking `ContactEmail`/`ContactPhone`/`OrganizerId`/`OrganizerName` (`EventEndpoints.cs:326,754-794`)** — the external `ExternalEventDto` MUST drop those. `MemberDto` exposes `Email`/`Phone` (`MemberEndpoints.cs:686-696`) → members are high-risk, excluded from v1.
- **Low-risk v1 set = published Events + published Blog only.** Both already have published-only repository reads (`GetPublicEventsAsync` / `GetPublishedAsync`); both carry `ContentLanguage` (E7-S4) which is public-safe and useful to integrations. HIGH-risk and excluded from v1: members (PII), finance (invoices/payments/IBAN), documents, audit log, users/roles, registration PII.
- **Rate limiting (E14-S4) is free for the global case:** the global limiter (`RateLimiterRegistration.cs:45-75`) applies to all endpoints; pipeline order (`DependencyInjection.cs:355` `UseRateLimiter` after auth) means external reads are limited with no extra code. A dedicated `"external-api"` policy is optional (DEC-5). The strict policy `"strict-identity"` (`RateLimitingOptions.cs:35`) partitions on `NameIdentifier` — works once S1's ApiKey handler sets a `sub`/`NameIdentifier` claim per client.
- **Contract docs exist (hand-written):** `docs/03_api_contracts.md` (German, principles + route list, documents the `page/pageSize/sort/filter` + `PagedResult<T>` contract + `code/message/details/traceId` error shape) and `docs/api-contracts-backend.md` (2026-05-12 brownfield map, base-path + auth-policy tables). Swagger/OpenAPI IS enabled but **Dev-only** (`DependencyInjection.cs:110-146` `AddSwaggerGen`, served `:328-334`). Add a hand-written external section + `.WithTags`.

### Files to change

- API (new): `Endpoints/ExternalApiEndpoints.cs` + the `External*Dto` records (co-located or under `Endpoints/External`).
- API (modified): `Endpoints/EndpointMapper.cs` (map external group); optionally `RateLimiting/RateLimiterRegistration.cs` (new `external-api` policy if DEC-5=B).
- Application (modified, if MediatR projection chosen): external query/DTO mapping reusing existing published-only reads.
- Docs: `docs/api-contracts-backend.md` (+ optionally `docs/03_api_contracts.md`) external section.
- Tests: `IabConnect.Api.Tests` (projection/safety/auth-matrix/pagination) + A63 harness registrations.

### Scope Boundaries

In scope:

- `/api/v1/external/{events,blog}` read endpoints (list + by-id), integration-safe DTOs, pagination/filter, scope + module + rate-limit enforcement, contract docs.

Out of scope:

- Any write/mutation external endpoint (read-only surface).
- Members, finance, documents, audit, users, registrations (high-risk; not v1).
- Webhooks (E8-S3/S4); credential management + auth scheme (E8-S1).
- Per-client custom quotas (defer until real consumer load is known).

### Architecture Guardrails

- External DTOs are **whitelist-only**: add a field only when it is deliberately public. Never expose EF entities or reuse internal/public DTOs that carry contact/organizer/PII (the `EventDto` leak is the cautionary example).
- Backend is the only security boundary: scheme + `Scope:` + `Module:api` enforced server-side; published-only repository reads prevent draft leakage; `/{id}` returns 404 (not 403) for unpublished to avoid an existence oracle.
- Reuse `PagedResult<T>` + `PaginationHelper`; clamp pageSize; deterministic sort to keep pagination stable.
- Rate limiting must be attached so AC-5 over-limit is provable; prefer a deterministic policy-attached assertion over a flaky time-based 429 (per `RateLimitingTests` DEC-2).
- A68/A71: AC-1 ships a deliberately small v1 resource set — the contract doc + Swagger tag must state that the external API currently exposes ONLY events + blog (degrade-to-less, stated visibly), not imply broader coverage.

### Testing Requirements

- Backend: API tests via `Mvc.Testing`. The load-bearing test is **serialize each external DTO and assert sensitive fields are absent** (contact/organizer/member/finance) — per resource. Plus: published-only filtering, pagination clamp + sort/filter parse, `/{id}` 404 unpublished, and the AC-5 auth matrix (401/403-scope/403-module/429). Use Testcontainers only where new repository paths are added (the reads reuse existing repos). No EF InMemory for relational correctness.
- Gates: `dotnet test`. A63 harness DI for any new injected service.

### Decision-Needed (resolve at Task 0 per A32/A41)

- **DEC-1 — v1 resource set.**
  - (A, recommended) **Events + Blog (published) only.** Rationale: tightest "approved low-risk" AC-1 scope; both have published-only repo reads; minimizes external attack surface + DTO-leak review burden.
  - (B) + public Settings/branding. Deferrable to v1.1. (C) broader (sponsors). Rejected for v1.
- **DEC-2 — Route group.**
  - (A, recommended) **New dedicated `/api/v1/external/*`** in `ExternalApiEndpoints.cs`. Rationale: architecture prefers a separate group when the contract differs; independent versioning + clean Swagger tag.
  - (B) reuse `*/public`. Rejected: couples the external contract to internal frontend churn.
- **DEC-3 — DTOs.**
  - (A, recommended) **New `External*Dto` whitelist records per resource.** Rationale: the existing public `EventDto` already leaks contact/organizer PII (`EventEndpoints.cs:754`); reuse would propagate that leak.
  - (B) reuse public DTOs. Rejected (leak).
- **DEC-4 — Contract docs.**
  - (A, recommended) **Both**: hand-written section in `api-contracts-backend.md` + `.WithTags("External API")` Swagger metadata. Rationale: matches the repo's hand-written convention AND the already-wired Swagger, minimal added effort.
  - (B) Swagger only / (C) md only. Rejected: half the convention.
- **DEC-5 — Rate-limit policy.**
  - (A, recommended) **Inherit the global limiter for v1.** Rationale: already covers external reads with zero added code; satisfies "rate-limited". Add a named `external-api` policy only when external quotas must diverge from first-party.
  - (B) dedicated `external-api` policy now. Acceptable if a distinct external quota is a hard requirement; partitions on the ApiClient `NameIdentifier`.

### Project Structure Notes

- API: `IabConnect.Api/Endpoints/ExternalApiEndpoints.cs` (+ DTOs); `EndpointMapper.cs`; optional `RateLimiting/RateLimiterRegistration.cs`.
- Tests: `IabConnect.Api.Tests` (external endpoint projection/safety/auth/pagination).
- Docs: `docs/api-contracts-backend.md`.

### References

- `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs:10-88`, `DependencyInjection.cs:452` (route root), `:110-146,:328-334` (Swagger dev-only)
- `backend/src/IabConnect.Application/Common/Result.cs:6-24` (`PagedResult<T>`), `PaginationHelper.cs:12-24,29-42,48-67`, `Finance/Queries/GetInvoicesQuery.cs:33-39`
- `backend/src/IabConnect.Api/Endpoints/BlogEndpoints.cs:18,241-247` (two-DTO precedent), `EventEndpoints.cs:31-37,326,754-794` (public read + `EventDto` leak anti-precedent), `MemberEndpoints.cs:686-696` (`MemberDto` PII)
- `backend/src/IabConnect.Api/RateLimiting/RateLimiterRegistration.cs:45-75`, `RateLimitingOptions.cs:35`, `DependencyInjection.cs:355`
- E8-S1 seam (this story consumes): `"ApiKey"` scheme, `Scope:` policy, `Module:api` key
- `docs/03_api_contracts.md`, `docs/api-contracts-backend.md` (contract convention)
- `_bmad-output/planning-artifacts/architecture.md:739-758` (REQ-058); `prd.md:428-435` (REQ-058 ACs); `epics-and-stories.md:884-906` (E8-S2 source)
- `_bmad-output/project-context.md` (A56 spike, A62 sibling-DEC-not-contract, A63 harness DI, A68/A71 visible-degrade)

## Validation Notes

- Bulk-refreshed 2026-06-07 as part of full Epic-8 dev-ready prep (A34). Real ACs + spike-grounded anchors; the DTO-leak anti-precedent and the v1 low-risk resource set are the load-bearing findings.
- Checklist coverage: ACs concrete + testable; reuse (PagedResult/PaginationHelper/published-only repos) over reinvention; sensitive-field exclusion proven by test; depends-on-S1 seam flagged via A62; rate-limit AC made deterministically testable.
- Remaining risk: AC-5 enforcement entirely depends on S1's scheme/scope/module seam shipping (A62) — Task 0 must verify, not assume. The exact published-read repository method names are named by the spike; confirm at Task 0.

## Dev Agent Record

### Agent Model Used

claude-opus-4-8 (1M context) — autonomous full-epic dev-story run (E8 S1→S4).

### Debug Log References

Task 0 — S1 seam VERIFIED shipped (A62): `ApiKey` scheme, `Scope:` policy prefix + `ScopeRequirement`, `Module:api` key + seed all exist (built in S1; tests green). DEC resolutions (A41, option A except DEC-5):
- **DEC-1 = A** v1 = published Events + published Blog only (`GetPublicEventsAsync` already published+Public; `GetPublishedAsync`).
- **DEC-2 = A** new dedicated `/api/v1/external/*` group, not the `*/public` groups.
- **DEC-3 = A** new `External*Dto` whitelist records; internal `EventDto`/`MemberDto` never reused (leak/PII).
- **DEC-4 = A** both: hand-written `docs/api-contracts-backend.md` section + `.WithTags`/`.Produces<>()` Swagger metadata.
- **DEC-5 = B** (over recommended A): dedicated `external-api` named rate-limit policy partitioned on credential id (default 300/min). Rationale: AC-5 429 deterministically testable per-credential + distinct external quota; global limiter still applies too.

### Completion Notes List

- ✅ AC-1 dedicated versioned group `/api/v1/external/{events,blog}` (list + by-id); v1 = published Events + Blog only.
- ✅ AC-2 (load-bearing) whitelist DTOs omit contact/organizer/PII/internal-status by construction; test serializes the response + asserts organizer sentinel + `organizerName`/`contactEmail`/`contactPhone`/`organizerId` absent.
- ✅ AC-3 `PagedResult<T>` + `PaginationHelper` paging (pageSize clamped 1..100, test 500→100), `sort`/`filter` (language/category), stable sort `ThenBy(Id)`.
- ✅ AC-4 documented in `docs/api-contracts-backend.md` + Swagger tags; states v1 = events+blog only (A68/A71).
- ✅ AC-5 full auth matrix end-to-end vs the live pipeline: no key → 401, garbage → 401, wrong scope → 403, `Module:api` disabled → 403, over-limit → 429; `/{id}` 404 (no existence oracle), published-only reads.
- **Quality gates:** `IabConnect.Api.Tests` **276 passed / 0 failed** (9 new external e2e tests — these also exercise the S1 ApiKey+scope+module chain end-to-end, the flow deferred from S1). Build 0/0. No frontend surface (admin UI was S1; consumers external) — noted.

### File List

API (new): `Endpoints/ExternalApiEndpoints.cs` (+`ExternalEventDto`/`ExternalBlogPostDto`).
API (modified): `Endpoints/EndpointMapper.cs`, `RateLimiting/RateLimitingOptions.cs` (+`ExternalApiPermitLimit`/`ExternalApiPolicyName`), `RateLimiting/RateLimiterRegistration.cs` (+`external-api` policy).
Tests (new): `Api.Tests/Endpoints/ExternalApiEndpointTests.cs`. (modified): `Api.Tests/TestWebApplicationFactory.cs` (test external limit = 5).
Docs (modified): `docs/api-contracts-backend.md`.

## Change Log

- 2026-05-12: Story created from multi-epic sprint plan and marked ready for development.
- 2026-06-07: Implemented (autonomous E8 run). DEC-5=B (dedicated external-api rate policy) for testable 429; others option A. Api.Tests 276 green. Status → review.
- 2026-06-07: Bulk-refreshed to comprehensive dev-ready spec (A34) — real ACs, A56 spike (no external surface; PagedResult/PaginationHelper reuse; Blog two-DTO precedent + EventDto/MemberDto leak anti-precedents; published Events+Blog v1 set), DEC-1..5, consumes the S1 auth/scope/module seam.
