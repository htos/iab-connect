# Story 10.1: Add Module Settings Data Model and Service

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **the system**,
I want **module enablement state persisted and cached**,
so that **module configuration can drive navigation, routing, and backend enforcement**.

**Requirement:** REQ-087. Epic E10, Story 1 of 5 — the **foundation** of E10. E10-S2 (API + admin tab), E10-S3 (backend enforcement), E10-S4 (frontend enforcement) and E10-S5 (public view + cross-module) all build on the data model + service this story creates. Get the entity, table, service, and `ModuleKeys` contract right here.

## Acceptance Criteria

1. **`module_settings` table.** A new EF Core migration creates `module_settings` with columns: `id` (uuid PK), `module_key` (text, UNIQUE, NOT NULL), `enabled` (boolean, NOT NULL, DEFAULT true), `updated_at` (timestamptz, NOT NULL), `updated_by` (text, NULL). A unique index exists on `module_key`. No `organization_id` column (single-tenant — ADR-007).
2. **Seeded, behavior-preserving.** The same migration seeds the 7 module rows — `members`, `events`, `documents`, `communication`, `finance`, `partners`, `public_view` — all `enabled = true`. An existing deployment behaves identically after `database update`.
3. **`ModuleSetting` entity.** A new `ModuleSetting` entity in `IabConnect.Domain` mirrors the `SystemSettings` pattern: `: Entity` base, private setters, private EF constructor, a factory, and an explicit `SetEnabled(bool enabled, string? updatedBy)` mutation method that stamps `UpdatedAt`.
4. **`ModuleKeys` constants.** A `ModuleKeys` constants class is the single source of truth for the 7 module-key strings, placed in a layer **both `IabConnect.Api` and `IabConnect.Application` can reference** (mirror the existing `Roles` constants class location). Includes a way to enumerate all keys (for seeding/validation).
5. **EF configuration.** `ModuleSettingConfiguration : IEntityTypeConfiguration<ModuleSetting>` with `ToTable("module_settings")`, explicit snake_case `HasColumnName` for every column, the unique index on `module_key`. Auto-discovered by `ApplyConfigurationsFromAssembly` (no manual registration). `DbSet<ModuleSetting>` added to `ApplicationDbContext`.
6. **`IModuleSettingsRepository`.** Interface in `IabConnect.Application/Common` (mirror `ISystemSettingsRepository`), implementation in `Infrastructure/Persistence/Repositories` — methods to get all module settings, get one by key, and update. Registered Scoped in Infrastructure DI.
7. **Cached `IModuleSettingsService`.** A service exposing fast reads — `Task<bool> IsEnabledAsync(string moduleKey, ct)` and `Task<IReadOnlyDictionary<string,bool>> GetAllAsync(ct)` — backed by `IMemoryCache`, reading through `IModuleSettingsRepository`. A public `InvalidateCache()` method clears it (called by E10-S2's update command). `services.AddMemoryCache()` is registered (it is not registered anywhere today). The service is registered in DI.
8. **Quality gate.** `dotnet test` from `backend/` stays green (1837/1837, 0 warnings) plus new tests: a Testcontainers PostgreSQL integration test for table creation + seed + the unique constraint, and Application tests for the service's cache behavior and invalidation.

## Tasks / Subtasks

- [x] **Task 1 — `ModuleKeys` constants (AC: 4)** — create `ModuleKeys` mirroring `backend/src/IabConnect.Api/Authorization/Roles.cs` style. **Decision:** place it where both Api and Application can reference it — `Roles.cs` is in `IabConnect.Api/Authorization`, but `Application` cannot depend on `Api`. Put `ModuleKeys` in **`IabConnect.Domain`** (both Api and Application reference Domain) — e.g. `IabConnect.Domain/Common/ModuleKeys.cs`. Constants: `Members="members"`, `Events="events"`, `Documents="documents"`, `Communication="communication"`, `Finance="finance"`, `Partners="partners"`, `PublicView="public_view"`, plus `public static readonly IReadOnlyList<string> All`.
- [x] **Task 2 — `ModuleSetting` entity (AC: 3)** — `IabConnect.Domain/Common/ModuleSetting.cs`, mirror `SystemSettings.cs`: `: Entity`, props `ModuleKey` (string), `Enabled` (bool), `UpdatedAt` (DateTime), `UpdatedBy` (string?) all private-set; `private ModuleSetting()` EF ctor; `static ModuleSetting Create(string moduleKey, bool enabled, string? updatedBy)` factory with guard on `moduleKey`; `void SetEnabled(bool enabled, string? updatedBy)` stamping `UpdatedAt = DateTime.UtcNow`.
- [x] **Task 3 — EF config + DbSet (AC: 5)** — `Infrastructure/Persistence/Configurations/ModuleSettingConfiguration.cs` mirroring `SystemSettingsConfiguration.cs`: `ToTable("module_settings")`, `HasKey(m => m.Id)` → `id`, `module_key` (required, maxlength e.g. 50), `enabled`, `updated_at`, `updated_by` (nullable) — all explicit `HasColumnName`; `builder.HasIndex(m => m.ModuleKey).IsUnique()`. Add `public DbSet<ModuleSetting> ModuleSettings => Set<ModuleSetting>();` to `ApplicationDbContext.cs` (~line 48, sibling of `SystemSettings`). The global UTC `DateTime` converter applies automatically.
- [x] **Task 4 — Migration with seed (AC: 1, 2)** — `dotnet ef migrations add AddModuleSettings --project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api` (from `backend/`). The migration must `CreateTable("module_settings")` + `CreateIndex` unique on `module_key` + 7 `InsertData(...)` rows (all `enabled=true`, fixed `Guid`s, a fixed `updated_at` UTC timestamp). Add a class XML-doc explaining REQ-087 / ADR-007 / behavior-preserving seed (follow the `AddSystemSettingsAndCustomRoles` + `AddEventVolunteerPlanning` doc style). Verify `ApplicationDbContextModelSnapshot.cs` regenerates cleanly.
- [x] **Task 5 — Repository (AC: 6)** — `IabConnect.Application/Common/IModuleSettingsRepository.cs` (mirror `ISystemSettingsRepository`): `Task<IReadOnlyList<ModuleSetting>> GetAllAsync(ct)`, `Task<ModuleSetting?> GetByKeyAsync(string moduleKey, ct)`, `void Update(ModuleSetting setting)` (no SaveChanges — caller uses `IUnitOfWork`). Impl `Infrastructure/Persistence/Repositories/ModuleSettingsRepository.cs` (`sealed`, ctor injects `ApplicationDbContext`). Register Scoped in `Infrastructure/DependencyInjection.cs` next to line 95–97.
- [x] **Task 6 — Cached service (AC: 7)** — `IModuleSettingsService` interface + impl. **Decision:** Application-layer interface (`IabConnect.Application/Common/IModuleSettingsService.cs`), Infrastructure impl (it needs `IMemoryCache` + the repo) — register in Infrastructure DI. Methods: `Task<bool> IsEnabledAsync(string, ct)`, `Task<IReadOnlyDictionary<string,bool>> GetAllAsync(ct)`, `void InvalidateCache()`. Cache the full module map under one stable key with a sensible expiry; `InvalidateCache()` removes it. Add `services.AddMemoryCache();` to `Infrastructure/DependencyInjection.cs` (nothing registers it today — there's a `// TODO: Add caching` marker at line 271).
- [x] **Task 7 — Tests (AC: 8)**
  - [x] `IabConnect.Infrastructure.Tests` (Testcontainers PostgreSQL): migration applies; 7 rows seeded all enabled; the `module_key` unique constraint rejects a duplicate; repository round-trips an update.
  - [x] `IabConnect.Application.Tests`: `ModuleSetting.SetEnabled` stamps `UpdatedAt`; `IModuleSettingsService` caches reads (repo hit once), `InvalidateCache()` forces a re-read, `IsEnabledAsync` returns the seeded value.
  - [x] `dotnet test` from `backend/` green, 0 warnings.

## Dev Notes

### Pattern to mirror exactly: SystemSettings

E10-S1 is structurally a clone of the `SystemSettings` slice. Files to read and mirror:

- **Entity** — `backend/src/IabConnect.Domain/Common/SystemSettings.cs`: `: Entity`, private setters, `private SystemSettings()` EF ctor, `static CreateDefault()` factory, `UpdateBranding(...)` with guard clauses. `ModuleSetting` follows this shape — `Create(...)` factory + `SetEnabled(...)` mutator.
- **Repo interface** — `backend/src/IabConnect.Application/Common/ISystemSettingsRepository.cs`: namespace `IabConnect.Application.Common`, `GetSettingsAsync(ct)` + `void Update(...)` (no SaveChanges — caller owns `IUnitOfWork`).
- **Repo impl** — `backend/src/IabConnect.Infrastructure/Persistence/Repositories/SystemSettingsRepository.cs`: `sealed`, ctor injects `ApplicationDbContext`, `Update` calls `_context.X.Update(...)`.
- **EF config** — `backend/src/IabConnect.Infrastructure/Persistence/Configurations/SystemSettingsConfiguration.cs`: `ToTable`, `HasKey` → `id`, every prop explicit `HasColumnName` snake_case + `HasMaxLength` + `IsRequired`. Auto-discovered via `ApplicationDbContext.OnModelCreating` → `ApplyConfigurationsFromAssembly` (line ~108) — no manual registration.
- **DbSet** — `backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs:47`: `public DbSet<SystemSettings> SystemSettings => Set<SystemSettings>();` — add the `ModuleSettings` DbSet as a sibling. `ApplicationDbContext` is `sealed`; global UTC `DateTime` value converters (lines ~133–159) apply to all entities automatically.
- **`Roles` constants** — `backend/src/IabConnect.Api/Authorization/Roles.cs` is the constants-class style to mirror for `ModuleKeys` — **but** `Roles` lives in `Api` which `Application` can't reference; put `ModuleKeys` in `Domain` instead.

### Migration facts

- Migrations project = `IabConnect.Infrastructure` itself; startup project = `IabConnect.Api`. Command from `backend/`:
  `dotnet ef migrations add AddModuleSettings --project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api`
- Latest migration on disk: `20260514095833_HmacPepperCalendarSubscriptionTokens`.
- **CREATE TABLE + seed pattern reference:** `20260209191810_AddSystemSettingsAndCustomRoles.cs` (the `system_settings` `CreateTable` at lines ~35–50, unique `CreateIndex` at ~52–56). Migrations in this repo are normally pure schema; for seeding, `migrationBuilder.InsertData(...)` in the same `Up` after `CreateTable` is acceptable and is the right call here (7 fixed rows, behavior-preserving).
- Use **fixed** `Guid` literals and a **fixed** UTC `updated_at` for the 7 seed rows so the migration is deterministic.

### Caching — greenfield in this codebase

There is **zero caching infrastructure** today — grep for `IMemoryCache`/`AddMemoryCache` returns nothing; `Infrastructure/DependencyInjection.cs:271` is a literal `// TODO: Add caching (Redis)`. E10-S1 introduces the first cache. Keep it simple: `IMemoryCache`, one cache key for the whole module map, `InvalidateCache()` on write. Establish a clean, minimal convention — E10-S2's update command will call `InvalidateCache()`.

### Architecture & project constraints

- **ADR-007:** dedicated `module_settings` table, **no `organization_id`** — the app is single-tenant (`SystemSettings` is a singleton). Resolves OD-2. [Source: architecture.md#ADR-007]
- Modular monolith / Clean Architecture: entity + `ModuleKeys` in Domain; repo interface + service interface in Application; EF config + repo impl + service impl + migration in Infrastructure. [Source: architecture.md#ADR-001, project-context.md]
- EF migrations in `backend/src/IabConnect.Infrastructure/Migrations`; never hand-edit schema; descriptive name. [Source: project-context.md]
- C# nullable + warnings-as-errors; `CancellationToken` on async; central package versions (`IMemoryCache` is in `Microsoft.Extensions.Caching.Memory` — already transitively available via ASP.NET Core, confirm no new `Directory.Packages.props` entry needed). [Source: project-context.md]
- Repository/relational behavior tested with Testcontainers PostgreSQL, not EF InMemory. [Source: project-context.md]

### Project Structure Notes

NEW files: `Domain/Common/ModuleKeys.cs`, `Domain/Common/ModuleSetting.cs`, `Application/Common/IModuleSettingsRepository.cs`, `Application/Common/IModuleSettingsService.cs`, `Infrastructure/Persistence/Configurations/ModuleSettingConfiguration.cs`, `Infrastructure/Persistence/Repositories/ModuleSettingsRepository.cs`, `Infrastructure/.../ModuleSettingsService.cs` (impl), one migration. UPDATE: `ApplicationDbContext.cs` (DbSet), `Infrastructure/DependencyInjection.cs` (3 registrations + `AddMemoryCache`). No new NuGet package expected.

### References

- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#Story E10-S1: Add Module Settings Data Model and Service]
- [Source: _bmad-output/planning-artifacts/architecture.md#ADR-007] — schema, single-tenant rationale
- [Source: _bmad-output/planning-artifacts/prd.md#REQ-087] — acceptance criteria
- [Source: backend/src/IabConnect.Domain/Common/SystemSettings.cs] + [Source: backend/src/IabConnect.Infrastructure/Persistence/Configurations/SystemSettingsConfiguration.cs] — pattern to mirror
- [Source: backend/src/IabConnect.Infrastructure/Migrations/20260209191810_AddSystemSettingsAndCustomRoles.cs] — CREATE TABLE + unique index pattern
- [Source: backend/src/IabConnect.Api/Authorization/Roles.cs] — constants-class style for `ModuleKeys`

## Open Questions / Clarifications (for PM — not blocking dev start)

1. **`ModuleKeys` location.** Recommended `IabConnect.Domain/Common/ModuleKeys.cs` (only layer both Api and Application can reference). The `Roles` class lives in `Api/Authorization` but that placement won't work for a cross-layer contract. Confirm Domain placement is acceptable.
2. **`public_site_enabled` overlap.** E9-S1 adds `SystemSettings.PublicSiteEnabled`; this story seeds a `public_view` row in `module_settings`. Two switches for related concerns — E10-S5 must decide which is authoritative for the public site. Not blocking E10-S1, but flagging the design tension (carried from the readiness report).

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context) — bmad-dev-story workflow, 2026-05-14.

### Debug Log References

- `dotnet build` (full solution): succeeded, 0 warnings, 0 errors.
- `dotnet ef migrations add AddModuleSettings`: generated `20260514181057_AddModuleSettings`; `ApplicationDbContextModelSnapshot.cs` regenerated cleanly with the `ModuleSetting` entity.
- `dotnet test` (full backend suite): **1885 passed, 0 failed, 0 skipped, 0 warnings** (1430 Application, 71 Api, 384 Infrastructure). Baseline grew past the story's stated 1837 because E9-S1..S4 shipped after this story was contexted; all 13 new E10-S1 tests are included in the 1885.

### Completion Notes List

- Ultimate context engine analysis completed — comprehensive developer guide created.
- **AC-1/AC-4 (ModuleKeys location):** placed `ModuleKeys` in `IabConnect.Domain/Common/` as the story recommended — `Roles` lives in `IabConnect.Api` which `Application` cannot reference, so Domain is the only cross-layer home. Open Question 1 resolved as recommended.
- **AC-7 (caching):** `IMemoryCache` / `AddMemoryCache` were available transitively (via EF Core's `Microsoft.Extensions.Caching.Memory` dependency) — no new `Directory.Packages.props` entry needed. `AddMemoryCache()` replaced the `// TODO: Add caching (Redis)` marker in `Infrastructure/DependencyInjection.cs`; this is the first cache in the codebase.
- **AC-7 design choice:** `IsEnabledAsync` returns `true` for an unknown module key (behaviour-preserving — an unconfigured module is not treated as disabled). The seed guarantees all 7 `ModuleKeys` rows exist, so this only matters for never-seeded keys. Documented on the interface and covered by a unit test.
- **Migration:** `AddModuleSettings` creates the table + unique index and seeds the 7 modules (all `enabled = true`) with fixed `Guid` literals and a fixed UTC `updated_at` for determinism. `Down()` drops the table (which also removes the seed rows). Behaviour-preserving — an existing deployment behaves identically after `database update`.
- **Open Question 2 (`public_site_enabled` vs `public_view` overlap):** noted, not resolved here — it is explicitly E10-S5's decision. No action taken in E10-S1.
- Hybrid workflow: story set to `review`; per-project policy says no per-story code-review — epic-scope review runs after all E10 stories reach `review`.

### File List

**New:**
- `backend/src/IabConnect.Domain/Common/ModuleKeys.cs`
- `backend/src/IabConnect.Domain/Common/ModuleSetting.cs`
- `backend/src/IabConnect.Application/Common/IModuleSettingsRepository.cs`
- `backend/src/IabConnect.Application/Common/IModuleSettingsService.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/ModuleSettingConfiguration.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Repositories/ModuleSettingsRepository.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Services/ModuleSettingsService.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/20260514181057_AddModuleSettings.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/20260514181057_AddModuleSettings.Designer.cs`
- `backend/tests/IabConnect.Application.Tests/Common/ModuleSettingTests.cs`
- `backend/tests/IabConnect.Application.Tests/Common/ModuleSettingsServiceTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Repositories/ModuleSettingsMigrationTests.cs`

**Modified:**
- `backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs` — added `DbSet<ModuleSetting> ModuleSettings`
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` — registered `IModuleSettingsRepository`, `IModuleSettingsService`, `AddMemoryCache()`
- `backend/src/IabConnect.Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs` — regenerated (EF migration)

## Change Log

| Date       | Description                                                                 |
|------------|-----------------------------------------------------------------------------|
| 2026-05-14 | E10-S1 implemented: `module_settings` table + seed, `ModuleSetting` entity, `ModuleKeys` contract, EF config, repository, cached `IModuleSettingsService`, DI wiring. 13 new tests; full suite 1885/1885 green, 0 warnings. Status → review. |
| 2026-05-14 | Addressed code review findings — 3 [Review][Patch] items resolved: `IsEnabledAsync` warning-log for out-of-contract keys, `GetAllAsync` cache-stampede guard (`SemaphoreSlim` + double-check), `ModuleSetting.Create` key-in-`ModuleKeys.All` guard. 3 new Application tests; backend 1936/1936 green, 0 warnings. |
| 2026-05-15 | Round-2 epic-boundary re-review (bmad-code-review): 0 patches routed to S1, 3 defers added (multi-instance cache TTL, static `LoadGate` lifetime, hardcoded seed timestamp + `DateTime` vs `DateTimeOffset`). Auditor: all 3 round-1 [Review][Patch] items verified resolved. Status → done. |

## Review Findings

_Epic-10 boundary code review — bmad-code-review, 2026-05-14. Layers: Blind Hunter, Edge Case Hunter, Acceptance Auditor._

- [x] [Review][Patch] `IsEnabledAsync` silently returns `enabled` for any key not in `ModuleKeys.All` — a typo'd `Module:financ` policy string becomes a no-op gate with no log/error; add a warning log for out-of-contract keys (observability only, documented fail-open for known-but-unseeded keys stays) [backend/src/IabConnect.Infrastructure/Persistence/Services/ModuleSettingsService.cs] — **RESOLVED 2026-05-14:** `IsEnabledAsync` now logs a `Warning` for keys not in `ModuleKeys.All` (known-but-unseeded keys stay quiet — documented fail-open). Covered by `IsEnabledAsync_OutOfContractKey_LogsWarning` + `IsEnabledAsync_KnownKeyMissingSeedRow_DoesNotLogWarning`.
- [x] [Review][Patch] Cache stampede — concurrent cache-miss on `GetAllAsync` (cold start / right after `InvalidateCache()`) has each request run its own EF query; use a coordinated load (`IMemoryCache.GetOrCreateAsync` / `Lazy<Task>`) [backend/src/IabConnect.Infrastructure/Persistence/Services/ModuleSettingsService.cs] — **RESOLVED 2026-05-14:** `GetAllAsync` now serializes cold reads through a static `SemaphoreSlim` with a double-check after the gate — exactly one EF query per cold cache. Covered by `GetAllAsync_ConcurrentColdReads_HitRepositoryOnce`.
- [x] [Review][Patch] `ModuleSetting.Create` guards only `IsNullOrWhiteSpace` — the domain invariant "module key is one of the seven" is asserted nowhere; add a guard that `moduleKey` ∈ `ModuleKeys.All` [backend/src/IabConnect.Domain/Common/ModuleSetting.cs] — **RESOLVED 2026-05-14:** `Create` now rejects any key not in `ModuleKeys.All` with an `ArgumentException`.
- [x] [Review][Defer] `InvalidateCache()` clears only the local process — multi-instance deployments serve a stale module map until the per-process TTL expires [backend/src/IabConnect.Infrastructure/Persistence/Services/ModuleSettingsService.cs] — deferred, pre-existing architectural limitation; the `// TODO: Add caching (Redis)` marker this story replaced acknowledges it, and the modular-monolith MVP is single-instance

### Round 2 — Re-Review (2026-05-15)

_bmad-code-review epic-boundary re-review over full E10 diff (`7a07d7c..d1958da`, 93 files / +9.719/-821) after the 13-patch fix-pass. Layers: Blind Hunter (40 findings), Edge Case Hunter (37), Acceptance Auditor (**13/13 prior patches verified**, 0 AC defects). E10-S1 routing: 0 patches, 3 defers._

- [x] [Review][Defer] `IMemoryCache` is process-local plus 30s middleware TTL — admin's enable/disable change can be invisible to peer instances and to the Edge cache for up to 30s [backend/src/IabConnect.Infrastructure/Persistence/Services/ModuleSettingsService.cs, frontend/src/middleware.ts] — deferred, extends the existing E10.S1 multi-instance defer; Redis is the planned fix when multi-instance ships
- [x] [Review][Defer] Static `LoadGate` `SemaphoreSlim` lifetime is process-wide, not scoped — leaks across DI scope disposal / hot reload / parallel tests [backend/src/IabConnect.Infrastructure/Persistence/Services/ModuleSettingsService.cs] — deferred, acceptable for single-instance MVP; bind to `IMemoryCache` instance when Redis lands
- [x] [Review][Defer] Migration seeds `updated_at = 2026-05-14 00:00:00` (hard-coded historical UTC) and `ModuleSetting.UpdatedAt` is `DateTime` not `DateTimeOffset` — fresh deploys show a stale "last changed" date; round-trip `DateTime.Kind` may be `Unspecified` [backend/src/IabConnect.Infrastructure/Migrations/20260514181057_AddModuleSettings.cs:55-57] — deferred, fold into the cross-cutting `DateTime.Kind` cleanup track (cf. epic-3 A13 deferred-work entries)
