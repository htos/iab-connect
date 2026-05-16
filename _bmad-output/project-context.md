---
project_name: 'iab-connect'
user_name: 'Harry'
date: '2026-05-11'
sections_completed: ['technology_stack', 'language_rules', 'framework_rules', 'testing_rules', 'quality_rules', 'workflow_rules', 'anti_patterns']
status: 'complete'
rule_count: 76
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

- Backend is .NET 10 / ASP.NET Core 10 with nullable reference types, implicit usings, warnings-as-errors, central package management, and latest analyzers. Do not downgrade runtime versions or introduce per-project package versions unless explicitly requested.
- Architecture is a modular monolith with Clean Architecture-style boundaries: `IabConnect.Api`, `IabConnect.Application`, `IabConnect.Domain`, `IabConnect.Infrastructure`. Do not introduce microservices for MVP work.
- Persistence is EF Core 10.0.2 with PostgreSQL via Npgsql EF Core 10.0.0. EF migrations belong in `backend/src/IabConnect.Infrastructure/Migrations`; never make manual schema changes.
- Backend patterns are Minimal API endpoint classes, MediatR 12.4.1 commands/queries, FluentValidation 11.11.0 validators, Serilog, Hangfire, QuestPDF, and Swiss QR bill generation.
- Auth uses Keycloak/OIDC with JWT bearer/OpenID Connect. UI hiding is not security; every protected operation must be authorized in the backend, and sensitive actions need audit/privacy consideration.
- Frontend is Node.js >= 22, Next.js 16 App Router with Turbopack, React 19, TypeScript 5 strict mode, Tailwind CSS 4, next-auth, next-intl, TanStack Query, React Hook Form, and Zod.
- Use executable project files as version source of truth: `package.json`, `.csproj`, `Directory.Packages.props`, and config files override older prose docs when versions disagree.
- Frontend UI should reuse Tailwind, Radix primitives, lucide-react icons, and shared components under `frontend/src/components/ui`. Primary color is `orange-600`; do not use blue primary buttons or links. All UI text must use next-intl translation keys.
- Backend tests use xUnit v3, FluentAssertions, Moq, Testcontainers PostgreSQL, ASP.NET Core MVC Testing, and coverlet. New domain entities/use cases need unit tests; repository behavior needs Testcontainers-backed PostgreSQL integration tests.
- Frontend tests use Vitest, Testing Library, and Playwright. Add or update tests when changing shared UI, forms, auth-dependent flows, or critical navigation.
- Local infrastructure is Docker Compose with PostgreSQL 17, Keycloak 26.5.2, and RustFS/S3-compatible storage. Backend and frontend run in separate terminals during development.

## Critical Implementation Rules

### Language-Specific Rules

- C# code must compile with nullable reference types and warnings-as-errors. Prefer `required`/`init` properties, records for request/response DTOs, sealed classes where inheritance is not intended, and explicit `CancellationToken` parameters on async operations.
- Keep C# project dependencies centrally versioned in `backend/Directory.Packages.props`. Do not add package versions directly to individual `.csproj` files.
- Use async/await end-to-end for I/O. Repository, MediatR handler, endpoint, EF Core, and storage/email APIs should accept and pass through `CancellationToken`.
- Backend DTOs should stay explicit and close to endpoint/application boundaries. Avoid leaking EF entities directly to API responses.
- TypeScript runs in strict mode with path alias `@/*` mapped to `frontend/src/*`. Prefer typed DTOs/API helpers over untyped objects and avoid `any` unless there is a narrow documented reason.
- Frontend components use double quotes, semicolons, 2-space indentation, trailing commas where configured, and Tailwind class sorting via Prettier.
- Client components must declare `"use client"` only when they need client-only behavior such as hooks, browser APIs, auth state, or event handlers.
- All user-visible frontend text must use `next-intl` translation keys. Do not add hardcoded German or English UI strings in components.
- Frontend date display must use `toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })` unless a feature explicitly requires another format.
- Frontend enum values must exactly match backend enum names, including PascalCase values expected by API contracts.

### Framework-Specific Rules

- Backend endpoints are Minimal API endpoint extension classes under `IabConnect.Api/Endpoints`. New endpoint groups should follow the existing `MapXEndpoints(this RouteGroupBuilder group)` pattern with route groups, tags, names, descriptions, and explicit authorization policies.
- Keep business rules out of endpoint handlers and EF entities. Endpoints should orchestrate HTTP concerns, authorization, mapping, MediatR/repository calls, audit logging, and response shaping.
- Use MediatR commands/queries and FluentValidation for application use cases that contain business workflow or validation beyond simple reads. Keep validators in the application layer, not in API handlers.
- Backend authorization must be enforced with policies/permissions in the API/application layer. Frontend role checks are only UX controls and never replace backend authorization.
- Sensitive backend actions such as create/update/delete, status changes, privacy actions, finance operations, and access-denied cases should write audit/security logs using the existing audit services.
- EF Core changes should go through repositories/ApplicationDbContext patterns already present in Infrastructure. Do not put direct database queries in controllers/endpoints unless the existing endpoint already uses that pattern for simple read/statistics behavior.
- Next.js uses the App Router under `frontend/src/app`. Authenticated feature pages must use the standard page layout from `docs/13_frontend_design_standards.md`: `<main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">` with an appropriate max-width container.
- Reuse existing navigation/auth/layout components before creating new ones: `MainLayout`, `Header`, `Sidebar`, `PublicHeader`, `PublicFooter`, `useAuth`, and shared UI components under `frontend/src/components/ui`.
- Authenticated list/table pages must include search/filter UI above the data table or card grid and must hide unavailable actions based on permissions/roles.
- For frontend data refresh after mutations, prefer a `refreshKey` state plus `useEffect` with cancellation guards. Do not add inline duplicate `api.get/post` refresh chains inside event handlers.
- Use orange primary actions and links (`orange-600`/`orange-700`) and lucide-react icons where available. Avoid introducing new blue primary actions or manual SVG icons when a shared icon/component exists.
- Public website routes live under `frontend/src/app/public` and use the public layout/header/footer instead of authenticated sidebar layout.

### Testing Rules

- Backend tests are split by layer: `IabConnect.Application.Tests` for domain/use-case/validator behavior, `IabConnect.Infrastructure.Tests` for persistence/integration infrastructure, and `IabConnect.Api.Tests` for API/middleware/host behavior.
- Add or update backend unit tests for new domain entities, value objects, domain events, validators, MediatR handlers, and application services. Use xUnit v3 with FluentAssertions; use Moq only for external boundaries.
- Repository and persistence behavior should be tested in `IabConnect.Infrastructure.Tests` with Testcontainers PostgreSQL when behavior depends on real PostgreSQL or EF Core relational semantics. Do not rely on EF InMemory for repository behavior that needs relational correctness.
- API-level tests can use `Microsoft.AspNetCore.Mvc.Testing`; keep them focused on routing, middleware, auth behavior, serialization, and response contracts rather than duplicating all application-layer tests.
- Finance, privacy, audit, authorization, backup/restore, email sending, document storage, and other sensitive workflows need regression tests when changed.
- Frontend currently has test tooling but few visible test files. Add Vitest/Testing Library tests for shared UI, form validation, API helper behavior, auth-dependent rendering, and stateful components when touched.
- Use Playwright for browser-critical flows such as login-dependent navigation, member/event/finance workflows, public pages, and flows where responsive layout or routing matters.
- Before merging backend changes, run `dotnet test` from `backend`. Before merging frontend changes, run at least `npm run typecheck`, `npm run lint`, and relevant Vitest/Playwright tests from `frontend`.

### Code Quality & Style Rules

- Respect `.editorconfig`: LF line endings, UTF-8, trim trailing whitespace, final newline, 2-space default indentation, 4-space indentation for C#.
- Backend builds enforce analyzers, code style, nullable reference types, and warnings-as-errors. Fix warnings instead of suppressing them unless there is a narrow, documented reason.
- Keep module boundaries clear in the modular monolith. Do not create cross-module shortcuts that bypass Application/Domain abstractions or Infrastructure repositories/services.
- Documentation updates must follow existing `docs/` conventions. Requirements content comes from `docs/Anforderungen_WebApp_Indischer_Kulturverein.csv`; status belongs in `docs/10_requirements_status.md`; do not edit requirement CSV content unless explicitly requested.
- When requirement status changes, update `docs/10_requirements_status.md` and keep `docs/01_requirements.md` consistent as the readable view.
- Frontend formatting is governed by Prettier: double quotes, semicolons, 2-space indentation, print width 80, trailing commas where configured, and Tailwind class sorting.
- Use shared UI and layout patterns before creating new styles. Authenticated pages must match `docs/13_frontend_design_standards.md`; avoid ad hoc layouts, blue primary actions, and hardcoded UI strings.
- Prefer lucide-react icons over inline SVGs when an equivalent icon exists. Keep manual SVGs only when no suitable shared/library icon exists.
- Keep comments useful and sparse. Existing comments often reference requirement IDs; preserve or add REQ references when implementing requirement-driven behavior.
- Do not commit secrets, local logs, build outputs, generated `bin/obj`, `.next`, or environment files.

### Development Workflow Rules

- Work from the real repository root: `B:\Projects\IAB Connect\iab-connect`. The parent folder is not the Git repository.
- Use feature branches for changes and keep `main` stable. PRs require green build/tests, no secrets, a short description, and a requirement ID when applicable.
- For backend development, run commands from `backend`: `dotnet test` for all backend tests and EF commands with `--project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api`.
- For frontend development, run commands from `frontend`: `npm run dev`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test`, and Playwright commands as needed.
- Local infrastructure starts with Docker Compose from the repository root using `infra/docker-compose.yml`. PostgreSQL, Keycloak, RustFS, MailHog, and related services are infrastructure, not application code.
- Backend and frontend must run in separate terminals: backend from `backend/src/IabConnect.Api` with `dotnet run`, frontend from `frontend` with `npm run dev`.
- EF Core migrations must have descriptive names and be reviewed before production. Apply migrations in staging before production.
- Deployment expects controlled backend migrations, Docker/container infrastructure, separate secrets per environment, monitoring/logging, and backup/restore validation.
- Use Conventional Commits style from the README when making commits: `<type>(<scope>): <description>`.
- BMAD artifacts belong under `_bmad-output`; do not mix planning/implementation artifacts into source folders unless they are intended project documentation.

### Story Authoring & Dev-Story Execution Rules (from Epic-11 retro A28-A30, 2026-05-16; Epic-12 retro A31-A33, 2026-05-16)

- **Spike-First for "low-risk mechanical" cleanup specs.** When a story AC describes a refactor as "low-risk mechanical", "trivial cleanup", or similar low-friction language (such as E11-S2 AC-2's appsettings.json base cleanup that hit a Hangfire eager-init blocker), the dev-agent MUST execute a `Task 0: Spike` that reads all consumers and identifies init-timing constraints BEFORE the cleanup subtasks begin. Spike output is one line: either "Confirmed low-risk → proceed" OR "Blocker found: <description> → escalate scope".
- **AC-Subitem Completion Check at Story Close.** When an AC enumerates "N items" (for example "tests assert 5 hardenings: Swagger 404, Hangfire 404, HSTS, HTTPS redirect, strict CORS"), the Quality-Gates closing Task MUST explicitly list each sub-item's status (covered / deferred / N/A). Aggregate claims like "all 5 verified" without per-item evidence are insufficient — they hide partial completion until epic-boundary review.
- **Three-State Task Checkbox for Manual-Verify ACs.** Use the explicit convention: `[x]` = dev-agent verified · `[!]` = needs human verify (manual smoke, browser interaction, infrastructure stand-up, dev-API not interactively launchable) · `[ ]` = pending. Manual-verification tasks bound by dev-agent non-interactivity get `[!]` (not `[x]`) so review-tracking sees the human-verification queue. The convention also lives in `docs/07_dos_donts.md`.
- **Cross-Story Orthogonal-AC Inventory at create-story time.** Stories in the same wave often share invariants that no single AC text enumerates: image-surface (no dev secrets in published OCI image), build-arg propagation (every Dockerfile `ARG` has a producer story + consumer story), env-var consistency (server-side env vs build-arg-baked env for the same logical value carry byte-equal strings), health-gate completeness (every long-running container has HEALTHCHECK + every dependent service uses `service_healthy`). `bmad-create-story` MUST add a Quality-Gates row per orthogonal dimension the story touches even when the AC text doesn't enumerate it. Pattern surfaced in E12-S1 (P2: `appsettings.Development.json` shipped in image despite AC-7's intent — AC-7 only covered base `appsettings.json` strings-grep, not the runtime-image filesystem inventory).
- **Decision-Resolution with Manual-Verify Hand-off.** When a code-review Decision-Needed finding can only be falsified via browser/manual/full-stack interaction, the Decision options presented via `AskUserQuestion` MUST include a "(X) verify-first via [specific manual step]" branch. If the user picks verify-first, the resolution is `resolved-pending-verify` (not `resolved`); the Story Tasks/Subtasks queues an `[!]` marker that references the Decision-ID; the code-review Findings section tracks these in a "Decisions Pending Verify" sub-bucket separate from Resolved and from regular Defers, so the Beta-deploy gate sees them. Pattern surfaced in E12-S4 D3 (NEXTAUTH issuer divergence — unverifiable without browser smoke, resolved via verify-first queued behind Task 8 `[!]`).
- **Base-Image User Verification in Dockerfile Spikes.** When a Dockerfile spec prescribes `USER <name-or-uid>` semantics, the Task-0 spike MUST verify what user the upstream base image already provides (e.g., `mcr.microsoft.com/dotnet/aspnet:10.0` ships `USER $APP_UID`/`app` (1654); `node:22-alpine` ships `USER node` (1000)). If a pre-created user matches the spec intent, use it (more portable: `USER app` or `USER $APP_UID`). Only fall back to raw numeric `USER N` if no pre-created user matches AND a `useradd` + `chown` chain is added explicitly. Raw `USER N` against a base image whose UID-N user doesn't exist yields a process with no `/home`, no `/etc/passwd` entry, and read-only access to root-owned files — breaking ASP.NET DataProtection writes silently. Pattern surfaced in E12-S1 P1 (`USER 1000` → P1 fixed to `USER $APP_UID` after E12 boundary review).

### Critical Don't-Miss Rules

- Do not treat UI role checks as security. Every protected backend operation needs policy/permission enforcement and sensitive failures should be audit logged.
- Do not add microservices, message brokers, or separate deployables for MVP work unless explicitly requested. The architecture decision is modular monolith first.
- Do not put business logic in EF entities, API endpoints, or frontend components when it belongs in Domain/Application services, MediatR handlers, validators, or repositories.
- Do not bypass existing finance/accounting compliance patterns: finance deletes are often soft deletes, sent/overdue invoices use cancellation/reversal behavior, and double-entry behavior is controlled by finance profile/accounting mode.
- Do not manipulate private backing-field aggregate collections and assume EF will persist new child entities. For known problematic aggregate child persistence, add child entities directly to the relevant `DbSet` as documented in `docs/07_dos_donts.md`.
- Do not change requirement source content in the CSV unless explicitly asked. Update requirement status separately and preserve REQ IDs.
- Do not introduce hardcoded UI text, German UI literals, or enum values that differ from backend contracts. UI text goes through next-intl and enum values must match PascalCase API values.
- Do not use blue as the primary action/link color in authenticated UI. Use orange-600/orange-700 and the standard page layout.
- Do not add list/table pages without search/filter controls.
- Do not refresh frontend data by chaining duplicate fetches inside mutation handlers. Use a refresh trigger state and effect/cancellation pattern.
- Do not use EF InMemory as proof that PostgreSQL repository behavior is correct. Use Testcontainers for relational behavior, concurrency, query filters, constraints, and migrations-sensitive logic.
- Do not weaken privacy/retention/audit behavior for convenience. Member, finance, document, backup, search, and export features can expose sensitive data and must preserve authorization, audit, and retention rules.

---

## Usage Guidelines

**For AI Agents:**

- Read this file before implementing any code.
- Follow all rules exactly as documented.
- When in doubt, prefer the more restrictive option.
- Update this file if durable project patterns change.

**For Humans:**

- Keep this file lean and focused on agent needs.
- Update it when the stack, architecture, or workflow changes.
- Review periodically for outdated rules.
- Remove rules that become obvious or no longer prevent mistakes.

Last Updated: 2026-05-16 (Epic-12 retro added A31-A33: Cross-Story Orthogonal-AC Inventory / Decision-Resolution with Manual-Verify Hand-off / Base-Image User Verification in Dockerfile Spikes; A28-A30 from Epic-11 carry forward)
