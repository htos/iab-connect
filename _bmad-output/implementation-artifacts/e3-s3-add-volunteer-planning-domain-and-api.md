# Story E3.S3: Add Volunteer Planning Domain and API

Status: done (Round-4 fix-pass complete 2026-05-14 — all 8 R4 patches resolved (3 High + 2 Medium + 3 Low: UTC guard, list-query event checks, fail-open guard, locked-entity re-verify, stale Position, savepoint leak, 4 new handler test files); 3 Defer logged; backend 1810 / 1810 green)

## Story

As an Event Manager,
I want to define volunteer roles and shifts for an event and have members assign themselves (subject to event policy and shift capacity),
so that event staffing can be planned in the system with deterministic capacity rules and a complete audit trail.

Requirement: **REQ-024** (Helferplanung & Aufgaben — Events, Priority Should). Story is **backend only** — UI + reminder scheduling are E3.S4.

## Acceptance Criteria

1. **Three new domain entities under `Events/Volunteers/`.** Add `EventVolunteerRole`, `EventVolunteerShift`, and `EventVolunteerAssignment` as `sealed class : Entity` aggregates under a NEW subfolder [backend/src/IabConnect.Domain/Events/Volunteers/](backend/src/IabConnect.Domain/Events/Volunteers/). They are part of the existing **Events module** (modular monolith — same Domain/Application/Infrastructure projects, NOT a new module). Each entity has a private parameterless ctor + a public `static Create(...)` factory mirroring the [Event.Create](backend/src/IabConnect.Domain/Events/Event.cs#L76-L108) and [EventRegistration.CreateForMember](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L131-L160) patterns. Entities expose private setters and mutation methods only (no public setters, no business logic in EF entities per [docs/07_dos_donts.md#L104](docs/07_dos_donts.md#L104)).

   - `EventVolunteerRole` — `Id (Guid)`, `EventId (Guid)`, `Name (string, max 100)`, `Description (string?, max 500)`, `IsActive (bool)`, `CreatedAt (DateTime UTC)`, `CreatedBy (Guid)`, `UpdatedAt (DateTime?)`. Factory `Create(eventId, name, description, createdBy)`. Methods: `Rename(string name)`, `UpdateDescription(string? description)`, `Activate()`, `Deactivate()`.
   - `EventVolunteerShift` — `Id`, `EventId`, `RoleId (Guid)`, `Title (string, max 200)`, `Description (string?, max 1000)`, `StartsAt (DateTime UTC)`, `EndsAt (DateTime UTC)`, `Capacity (int)` (>= 1; `Capacity` is the maximum number of CONFIRMED volunteers; waitlist beyond capacity is opt-in), `AllowWaitlist (bool)`, `AllowSelfSignup (bool)`, `Notes (string?, max 1000)`, `CreatedAt`, `CreatedBy`, `UpdatedAt`. Factory `Create(eventId, roleId, title, startsAt, endsAt, capacity, allowWaitlist, allowSelfSignup, createdBy)` validates `endsAt > startsAt`, `capacity >= 1`. Methods: `UpdateDetails(...)`, `IncreaseCapacity(int)` (may not decrease below current confirmed count — domain invariant), `EnableWaitlist()`, `DisableWaitlist()`, `EnableSelfSignup()`, `DisableSelfSignup()`.
   - `EventVolunteerAssignment` — `Id`, `ShiftId`, `RoleId` (denormalised for query efficiency; MUST match the shift's role), `MemberId (Guid)` (FK to `Members.Id`), `Status (VolunteerAssignmentStatus enum: Confirmed | Waitlisted | Cancelled)`, `Position (int?)` — 1-based, REQUIRED when `Status == Waitlisted`, null otherwise; mirrors the [EventRegistration.WaitlistPosition](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L59) shape, `AssignedAt (DateTime UTC)`, `AssignedBy (Guid)` (the user who created the assignment — for self-signup this equals `MemberId`'s linked user; for manager-assignment it is the manager's user id), `CancelledAt (DateTime?)`, `CancellationReason (string?, max 500)`. Factories: `CreateConfirmed(shiftId, roleId, memberId, assignedBy)` and `CreateWaitlisted(shiftId, roleId, memberId, assignedBy, position)` (mirror [EventRegistration.CreateWaitlisted](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L196-L230)). Methods: `PromoteFromWaitlist()`, `Cancel(string? reason)`, `UpdateWaitlistPosition(int position)`.

2. **Repositories follow the existing `IEventRegistrationRepository` shape.** Add three new repository interfaces in [backend/src/IabConnect.Domain/Events/Volunteers/](backend/src/IabConnect.Domain/Events/Volunteers/): `IEventVolunteerRoleRepository`, `IEventVolunteerShiftRepository`, `IEventVolunteerAssignmentRepository`. Their method names MUST mirror the existing [IEventRegistrationRepository.cs](backend/src/IabConnect.Domain/Events/IEventRegistrationRepository.cs) conventions (`AddAsync`, `UpdateAsync`, `GetByIdAsync`, `GetByEventIdAsync`, etc.). Concrete implementations live in [backend/src/IabConnect.Infrastructure/Persistence/Repositories/](backend/src/IabConnect.Infrastructure/Persistence/Repositories/) and are registered in [backend/src/IabConnect.Infrastructure/DependencyInjection.cs](backend/src/IabConnect.Infrastructure/DependencyInjection.cs) next to `IEventRegistrationRepository → EventRegistrationRepository`. Required helpers — symmetric with [IEventRegistrationRepository.CountConfirmedAsync](backend/src/IabConnect.Domain/Events/IEventRegistrationRepository.cs#L69-L71) and [CountWaitlistedAsync](backend/src/IabConnect.Domain/Events/IEventRegistrationRepository.cs#L83-L85):
    - `IEventVolunteerAssignmentRepository.CountConfirmedAsync(Guid shiftId, CancellationToken)` — `WHERE shift_id = … AND status = 'Confirmed' AND cancelled_at IS NULL`.
    - `IEventVolunteerAssignmentRepository.CountWaitlistedAsync(Guid shiftId, CancellationToken)`.
    - `IEventVolunteerAssignmentRepository.GetWaitlistAsync(Guid shiftId, CancellationToken)` — returns waitlisted rows ordered by `Position ASC`.
    - `IEventVolunteerAssignmentRepository.GetByShiftIdAsync(Guid shiftId, ..., CancellationToken)`.
    - `IEventVolunteerAssignmentRepository.GetByMemberIdAsync(Guid memberId, CancellationToken)` (member sees their own assignments).
    - `IEventVolunteerAssignmentRepository.ExistsActiveForMemberAsync(Guid shiftId, Guid memberId, CancellationToken)` — returns true when a non-cancelled assignment exists for that pair. Used for the unique-per-pair pre-check (AC-6) and the no-double-signup guard.
    - `IEventVolunteerShiftRepository.GetByEventIdAsync(Guid eventId, CancellationToken)`.

3. **EF Core configurations + migration.** Add EF configurations [EventVolunteerRoleConfiguration.cs](backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventVolunteerRoleConfiguration.cs), [EventVolunteerShiftConfiguration.cs](backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventVolunteerShiftConfiguration.cs), [EventVolunteerAssignmentConfiguration.cs](backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventVolunteerAssignmentConfiguration.cs) mirroring the style of [EventRegistrationConfiguration.cs](backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventRegistrationConfiguration.cs) (snake_case columns, `HasConversion<string>()` for the status enum, `Ignore(e => e.DomainEvents)`). Register three new `DbSet<>`s in [ApplicationDbContext.cs](backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs) immediately after the existing `DbSet<EventRegistration>` at line 36. Generate a single migration named `AddEventVolunteerPlanning` via `dotnet ef migrations add AddEventVolunteerPlanning` from `backend/src/IabConnect.Infrastructure/` — name matches the [AddEventRegistrations](backend/src/IabConnect.Infrastructure/Migrations/20260131093856_AddEventRegistrations.cs) precedent. Required tables/columns/indexes:

    - `event_volunteer_roles`: PK `id`, FK `event_id → events.id` (**`ON DELETE Cascade`**, see AC-4), `name (varchar 100)`, `description (varchar 500, null)`, `is_active (bool, default true)`, audit columns. Unique index on `(event_id, lower(name))` — names are unique per event after case-folding.
    - `event_volunteer_shifts`: PK `id`, FK `event_id → events.id` (**`ON DELETE Cascade`**), FK `role_id → event_volunteer_roles.id` (**`ON DELETE Restrict`** — see AC-4 rationale), `title (varchar 200)`, `description (varchar 1000, null)`, `starts_at`, `ends_at`, `capacity (int)`, `allow_waitlist (bool, default false)`, `allow_self_signup (bool, default false)`, `notes (varchar 1000, null)`, audit columns. Index on `event_id`, index on `(role_id, starts_at)`, and a CHECK constraint `capacity >= 1` (`migrationBuilder.Sql("ALTER TABLE event_volunteer_shifts ADD CONSTRAINT ck_event_volunteer_shifts_capacity_min CHECK (capacity >= 1);")`).
    - `event_volunteer_assignments`: PK `id`, FK `shift_id → event_volunteer_shifts.id` (**`ON DELETE Cascade`**), FK `role_id → event_volunteer_roles.id` (**`ON DELETE Restrict`**), FK `member_id → members.id` (**`ON DELETE Restrict`** — see AC-4), `status (varchar 50, HasConversion<string>())`, `position (int, null)`, audit columns. Indexes: `ix_event_volunteer_assignments_shift_id`, `ix_event_volunteer_assignments_member_id`, `ix_event_volunteer_assignments_shift_status (shift_id, status)`, and a **partial unique index** `ix_event_volunteer_assignments_shift_member_active` on `(shift_id, member_id) WHERE status <> 'Cancelled'` to prevent double-signup AND to serve as the database-level race guard for AC-6 (concurrency strategy D3).

4. **Each new FK carries a written `OnDelete` rationale in the migration's XML doc comment.** Per [epic-2-retro-2026-05-13.md Action A9](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md#L116): every new self-FK or cross-aggregate FK migration MUST include a written rationale for the chosen `OnDelete` action in the migration's XML doc comment. This story is the FIRST to demonstrate the A9 discipline ("E3.S3 onwards"). The [AddEventVolunteerPlanning] migration MUST open with a `/// <summary>...</summary>` block enumerating each FK and its rationale. Defaults for this story:

    - `event_volunteer_shifts.event_id → events.id` → **`Cascade`**. A shift has no meaning without its event; deleting the event MUST sweep shifts. This matches the parent-aggregate semantics that the volunteer plan is part of the Event aggregate root.
    - `event_volunteer_roles.event_id → events.id` → **`Cascade`** — same rationale.
    - `event_volunteer_shifts.role_id → event_volunteer_roles.id` → **`Restrict`**. A role with active shifts MUST not be deleted out from under those shifts. The manager must deactivate the role (`is_active = false`) instead. Surfaces the constraint to the operator.
    - `event_volunteer_assignments.shift_id → event_volunteer_shifts.id` → **`Cascade`**. An assignment is meaningless without its shift; deleting the shift sweeps assignments.
    - `event_volunteer_assignments.role_id → event_volunteer_roles.id` → **`Restrict`**. Same rationale as `shifts.role_id`.
    - `event_volunteer_assignments.member_id → members.id` → **`Restrict`**. Volunteer history is forensic data — deleting a member must NOT silently delete proof of their volunteering. Hard-delete of a member must fail until assignments are explicitly handled (cancel-then-anonymise is the operator path). This matches the precedent set in [ChangeMergedIntoMemberFKToRestrict](backend/src/IabConnect.Infrastructure/Migrations/20260513124823_ChangeMergedIntoMemberFKToRestrict.cs#L7-L14) for the merge-source pointer.

5. **MediatR command surface for roles/shifts.** All write operations go through MediatR commands in [backend/src/IabConnect.Application/Events/Volunteers/](backend/src/IabConnect.Application/Events/Volunteers/). Each command is a `record(...) : IRequest<TResponse>` with a matching `Handler` and a [FluentValidation](backend/Directory.Packages.props) `AbstractValidator<TCommand>`. The full command list and their HTTP mappings:

    - `CreateEventVolunteerRoleCommand(Guid EventId, string Name, string? Description) : IRequest<EventVolunteerRoleDto>` → `POST /api/v1/events/{eventId:guid}/volunteer-roles` (201). Validator: name 1-100 chars, description ≤ 500 chars.
    - `UpdateEventVolunteerRoleCommand(Guid RoleId, string Name, string? Description, bool IsActive)` → `PUT /api/v1/events/{eventId:guid}/volunteer-roles/{roleId:guid}` (200). Validator mirrors create.
    - `CreateEventVolunteerShiftCommand(Guid EventId, Guid RoleId, string Title, string? Description, DateTime StartsAt, DateTime EndsAt, int Capacity, bool AllowWaitlist, bool AllowSelfSignup, string? Notes) : IRequest<EventVolunteerShiftDto>` → `POST /api/v1/events/{eventId:guid}/volunteer-shifts` (201). Validator: `EndsAt > StartsAt`, `Capacity >= 1`, title 1-200, description ≤ 1000.
    - `UpdateEventVolunteerShiftCommand(...)` → `PUT /api/v1/events/{eventId:guid}/volunteer-shifts/{shiftId:guid}` (200).
    - `CancelEventVolunteerShiftCommand(Guid ShiftId, string? Reason)` → `POST /api/v1/events/{eventId:guid}/volunteer-shifts/{shiftId:guid}/cancel` (200). Cascades a `Cancel` on every non-cancelled assignment for that shift inside a single transaction (per A6 / D3 below).
    - `AssignVolunteerCommand(Guid ShiftId, Guid MemberId, bool AllowWaitlistFallback) : IRequest<EventVolunteerAssignmentDto>` → `POST /api/v1/events/{eventId:guid}/volunteer-shifts/{shiftId:guid}/assignments` (201) — **manager-assignment path** (RequireEventStaff). Returns 201 with the assignment (Confirmed or Waitlisted depending on capacity + the flag).
    - `SelfSignUpForVolunteerShiftCommand(Guid ShiftId) : IRequest<EventVolunteerAssignmentDto>` → `POST /api/v1/events/{eventId:guid}/volunteer-shifts/{shiftId:guid}/self-signup` (201) — **member self-signup path** (RequireMember). 409 with body `{ "message": "...", "errorCode": "SignupNotAllowed" }` if shift's `AllowSelfSignup == false`; 409 with body `{ "message": "...", "errorCode": "AlreadyAssigned" }` if the member already has a non-cancelled assignment. 200 with the existing assignment if status would be unchanged (idempotent). All 409/403 responses MUST use a `{ message, errorCode }` body shape with PascalCase enum-string `errorCode` (consumed by [E3.S4 frontend wrappers](_bmad-output/implementation-artifacts/e3-s4-add-volunteer-planning-ui-and-reminders.md)).
    - `CancelVolunteerAssignmentCommand(Guid AssignmentId, string? Reason)` → `POST /api/v1/events/{eventId:guid}/volunteer-shifts/{shiftId:guid}/assignments/{assignmentId:guid}/cancel` (200). Cancellation promotes the next waitlisted assignment (if any) to Confirmed and shifts the remaining waitlist positions up by one — mirrors [EventRegistration.PromoteFromWaitlist](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L397-L403) + [UpdateWaitlistPosition](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L408-L417).

   All endpoint mappings live in a NEW file [backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs) (not in `EventRegistrationEndpoints.cs` — separate route group keeps that file from growing past 800 lines). Wire the new endpoint group into [backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs](backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs) next to the `MapEventRegistrationEndpoints` call.

6. **Concurrency safety for capacity-bounded assignment.** Self-signup and manager-assignment are the canonical TOCTOU surface from [docs/07_dos_donts.md#Concurrency-Checklist](docs/07_dos_donts.md#L134-L157): two members hitting `POST /self-signup` simultaneously when one capacity slot remains MUST result in exactly one Confirmed + one (Waitlisted or 409, depending on `AllowWaitlistFallback`). Required design (D3 below):

    - Use **transaction-first ordering** + **partial unique index** as the database-level guard. Inside the handler:
      1. `await using var transaction = await _context.Database.BeginTransactionAsync(ct);` BEFORE any capacity read.
      2. Take a row-level lock on the shift row: `await _context.EventVolunteerShifts.FromSqlInterpolated($"SELECT * FROM event_volunteer_shifts WHERE id = {shiftId} FOR UPDATE").AsTracking().ToListAsync(ct);` — mirrors the [MemberMergeService](docs/07_dos_donts.md#L138-L149) pattern.
      3. Re-read `CountConfirmedAsync(shiftId, ct)` and `CountWaitlistedAsync(shiftId, ct)` under the lock.
      4. Decide Confirmed vs Waitlisted vs reject based on `Capacity`, `AllowWaitlist`, and `AllowWaitlistFallback`.
      5. Catch `DbUpdateException` on `SaveChangesAsync` (partial unique index `ix_event_volunteer_assignments_shift_member_active` fires for double-signup) and translate to a 409 with a domain-meaningful message. Mirror [IDuplicateCandidateDismissalRepository.AddAtomicAsync](docs/07_dos_donts.md#L155) — the `DbUpdateException` MUST be caught in the Infrastructure layer (repository method `AddAtomicAsync(EventVolunteerAssignment, CancellationToken) → (EventVolunteerAssignment entity, bool created)`) so the Application layer stays free of EF imports.

    The integration test suite MUST include a two-task race test against `postgres:18` per [docs/07_dos_donts.md#L157](docs/07_dos_donts.md#L157) ("the test that proves a concurrency fix works is a two-task xUnit integration test").

7. **Authorization is backend-enforced via `RequireEventStaff` + `RequireMember`.** The `RequireEventStaff` policy is being introduced by E3.S1 in [DependencyInjection.cs:134-146](backend/src/IabConnect.Api/DependencyInjection.cs#L134-L146). This story REUSES that policy — it MUST NOT redefine it. If E3.S1 has not landed when E3.S3 dev starts, the dev agent MUST surface the order dependency before coding (per A10 escalation).

    - All role + shift CRUD endpoints (`POST/PUT/DELETE /volunteer-roles*`, `POST/PUT /volunteer-shifts*`, `POST /assignments` manager-path, `POST /shifts/.../cancel`) → `.RequireAuthorization("RequireEventStaff")`.
    - Self-signup + own-assignment cancel (`POST /self-signup`, `POST /assignments/{id}/cancel` when called by the assignee) → `.RequireAuthorization("RequireMember")` (admin/vorstand/member roles). Inside the handler: verify the calling user's `MemberId` matches the assignment's `MemberId`, OR the user has an event-staff role; otherwise 403 + `SecurityAuditLogger.LogAccessDenied`.
    - Read endpoints (`GET /volunteer-roles`, `GET /volunteer-shifts`, `GET /volunteer-shifts/{id}/assignments`) → `.RequireAuthorization("RequireMember")` so members can see published shifts before signing up. The DTO surface (AC-9) deliberately omits private member contact data.

   Per the [Epic-1 retro Audit-verb discipline](_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md): every command handler that succeeds in a state-changing path MUST call `SecurityAuditLogger.LogAccessGranted` (resource: `EventVolunteerShift` / `EventVolunteerRole` / `EventVolunteerAssignment`, action: `Create` / `Update` / `Cancel` / `SelfSignup` / `Assign`). `LogAccessDenied` is emitted only on authorization failure (handled by the policy middleware on roles; explicit in the handler for the own-assignment self-cancel check). Read endpoints do NOT log on success.

8. **Capacity-rule semantics + waitlist reuse (no new mechanic).** The waitlist mechanic MUST reuse the [EventRegistration](backend/src/IabConnect.Domain/Events/EventRegistration.cs) waitlist pattern as the design source — do NOT invent a new mechanic:

    - **Confirmed slot full + `AllowWaitlist == false` + `AllowWaitlistFallback == false`** → 409 with body `{ "message": "Shift is at capacity", "errorCode": "ShiftFull" }`. No assignment row is created.
    - **Confirmed slot full + `AllowWaitlist == true`** → create `EventVolunteerAssignment` via `CreateWaitlisted(...)` with `Position = current_waitlist_count + 1`. Mirrors [EventRegistration.CreateWaitlisted](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L196-L230).
    - **Cancelling a Confirmed assignment** → if a waitlist exists, promote the head of the waitlist (`Position == 1`) via `assignment.PromoteFromWaitlist()` ([EventRegistration.cs:397](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L397)) and decrement all remaining positions via `UpdateWaitlistPosition(p - 1)` ([EventRegistration.cs:408](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L408)). All position updates happen inside the same transaction with `FOR UPDATE` lock on the shift row.
    - **Cancelling a Waitlisted assignment** → mark cancelled, shift all positions `> cancelled.Position` down by one inside the transaction.
    - **`Shift.IncreaseCapacity(newCap)`** → if `newCap > current confirmed`, MAY auto-promote waitlist heads to fill new slots (D7 below decides: auto-promote vs explicit operator action). Decision below: **NO auto-promote in this story** — manager must explicitly cancel/reassign. Reduces edge-case surface; aligns with `EventRegistration` which has no auto-promote on `Event.UpdateRegistrationSettings`.

9. **Privacy-bounded DTOs (Application boundary).** Three DTOs in [backend/src/IabConnect.Application/Events/Volunteers/](backend/src/IabConnect.Application/Events/Volunteers/). No EF entity escapes Application:

    - `EventVolunteerRoleDto(Guid Id, Guid EventId, string Name, string? Description, bool IsActive, DateTime CreatedAt)`.
    - `EventVolunteerShiftDto(Guid Id, Guid EventId, Guid RoleId, string RoleName, string Title, string? Description, DateTime StartsAt, DateTime EndsAt, int Capacity, int ConfirmedCount, int WaitlistCount, bool AllowWaitlist, bool AllowSelfSignup, string? Notes)` — `ConfirmedCount`/`WaitlistCount` come from the repository `CountConfirmedAsync`/`CountWaitlistedAsync` helpers.
    - `EventVolunteerAssignmentDto(Guid Id, Guid ShiftId, Guid RoleId, Guid MemberId, string MemberDisplayName, VolunteerAssignmentStatus Status, int? Position, DateTime AssignedAt)` — `MemberDisplayName` is `"{FirstName} {LastName}"` joined; the DTO MUST NOT expose `Member.Email`, `Member.Phone`, `Member.Address`, `Member.KeycloakUserId`, or `AssignedBy` (manager identity is not member-facing). Mirrors the privacy bound enforced in [DuplicateCandidateDto](backend/src/IabConnect.Application/Members/Duplicates/DuplicateCandidateDto.cs) (per [Epic-2 retro line 33-34](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md#L33)).

10. **Theory-driven tests across all four layers.** Adopt the E2.S1 + E3.S1 test discipline:

    - **Application/Unit:** Per-command-handler test files in [backend/tests/IabConnect.Application.Tests/Events/Volunteers/](backend/tests/IabConnect.Application.Tests/Events/Volunteers/) — at minimum:
      - `CreateEventVolunteerShiftCommandHandlerTests` — validator coverage (`Capacity = 0` rejected, `EndsAt <= StartsAt` rejected, name length boundaries).
      - `AssignVolunteerCommandHandlerTests` — `[Theory]` over `(confirmedCount, capacity, allowWaitlist, allowWaitlistFallback) → expected: Confirmed | Waitlisted | Reject` covering at least 8 rows including boundary `confirmedCount == capacity` and `confirmedCount == capacity - 1`.
      - `SelfSignUpForVolunteerShiftCommandHandlerTests` — disallowed-when-`AllowSelfSignup==false`, idempotent-when-already-assigned, member-id-binding from `ClaimsPrincipal`.
      - `CancelVolunteerAssignmentCommandHandlerTests` — promotes waitlist head, decrements remaining positions, no-op when no waitlist exists.
      - Reflection test asserting `EventVolunteerAssignmentDto.GetProperties()` does NOT include `Email`, `Phone`, `Address`, `KeycloakUserId`, or `AssignedBy` (mirror [FindMemberDuplicatesQueryHandlerTests.Handle_DtoOmitsPhoneAndAddressAndKeycloakId](backend/tests/IabConnect.Application.Tests/Members/FindMemberDuplicatesQueryHandlerTests.cs)).
    - **Application/Domain unit tests** in [backend/tests/IabConnect.Application.Tests/Domain/Events/Volunteers/](backend/tests/IabConnect.Application.Tests/Domain/Events/Volunteers/):
      - `EventVolunteerShiftTests` — `Create_EndsAtBeforeStartsAt_Throws`, `Create_ZeroCapacity_Throws`, `IncreaseCapacity_BelowCurrentConfirmed_Throws`.
      - `EventVolunteerAssignmentTests` — factory invariants, `PromoteFromWaitlist_NotWaitlisted_Throws`, `UpdateWaitlistPosition_ZeroOrNegative_Throws`.
    - **Infrastructure (Testcontainers `postgres:18`):** [backend/tests/IabConnect.Infrastructure.Tests/Repositories/EventVolunteerAssignmentRepositoryTests.cs](backend/tests/IabConnect.Infrastructure.Tests/Repositories/EventVolunteerAssignmentRepositoryTests.cs) using `PostgreSqlBuilder("postgres:18")` per [MemberRepositoryTests.cs:22](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L22). Required cases:
      - `CountConfirmedAsync_ExcludesCancelled` — verify the `cancelled_at IS NULL AND status = 'Confirmed'` predicate.
      - `AddAtomicAsync_ConcurrentSelfSignupForSameShift_ReturnsExactlyOneCreated` — **two-task race test** per [docs/07_dos_donts.md#L157](docs/07_dos_donts.md#L157). Spawns two `Task.Run` self-signups for the same `(shiftId, memberId)` pair; asserts exactly one returns `(created: true)` and the other returns `(created: false, existing)`.
      - `Migration_AppliedCleanly_AndCheckConstraintEnforced` — asserts `INSERT … capacity = 0` raises a Postgres `CheckViolation`.
      - `FK_AssignmentMemberId_OnDeleteRestrict_BlocksMemberHardDelete` — asserts that hard-deleting a `Member` with an active assignment raises an FK violation (proves A9 Restrict choice for `member_id`).
    - **Application/Unit:** Adversarial test data per [A8](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md#L115). Role/shift names are stored verbatim — no search-by-name is introduced in this story, so the LIKE-pattern-chars surface is small. But IF a role or shift query helper grows a LIKE clause during dev, the tests MUST include `[InlineData]` rows with `_`, `%`, `\`, mixed case, leading/trailing whitespace, and NFC vs NFD Unicode (per [docs/07_dos_donts.md#L191-L197](docs/07_dos_donts.md#L191-L197)).
    - **API:** [backend/tests/IabConnect.Api.Tests/Endpoints/EventVolunteerEndpointTests.cs](backend/tests/IabConnect.Api.Tests/Endpoints/EventVolunteerEndpointTests.cs) — endpoint-metadata tests confirming the correct policy is applied to each endpoint (`RequireEventStaff` for staff endpoints; `RequireMember` for self-signup + reads); 401 for unauthenticated; mirror [MemberDuplicatesEndpointTests.DuplicatesEndpoint_Unauthenticated_Returns401](backend/tests/IabConnect.Api.Tests/Endpoints/MemberDuplicatesEndpointTests.cs). The authenticated-200 cases require a test auth handler — document as a follow-up matching the E2.S1 + E3.S1 carry-over note.

## Tasks / Subtasks

- [x] **0. Pre-flight gates** (Action items A6, A9, A10, A11; A1 commit discipline)
  - [x] Concurrency + Pattern-Chars docs present.
  - [x] RequireEventStaff + RequireMember policies present.
  - [x] Baseline 1632 / 1632 after E3.S2 close → 1696 / 1696 after E3.S3 (+64).
  - [x] No docs/07_dos_donts.md entry required.

- [x] **1. Domain entities + enum** (AC: 1, 8) — `VolunteerAssignmentStatus`, `EventVolunteerRole`, `EventVolunteerShift`, `EventVolunteerAssignment` + 27 domain unit tests across three files in `Events/Volunteers/`. **Test layout deviation:** AC-10 specified `Domain/Events/Volunteers/` test folder; that path collides with the unqualified `Domain.*` references in `ArchiveTests.cs`. Tests live at `IabConnect.Application.Tests.Events.Volunteers` (flat) instead — same convention as the existing `EventRegistrationTests`.
- [x] **2. Repositories — interfaces + EF implementations** (AC: 2, 6) — three interfaces + three implementations; `EventVolunteerAssignmentRepository.AddAtomicAsync` catches `DbUpdateException(SqlState=23505)` and re-fetches the active row; Symmetric-Guard audit OK (counter helpers share `status = 'Confirmed'` / `status = 'Waitlisted'` predicate).
- [x] **3. EF configurations + DbContext registration + migration** (AC: 3, 4) — three configs; three `DbSet<>` properties on `ApplicationDbContext`; migration `20260513175830_AddEventVolunteerPlanning` carries the **A9 XML doc comment** with per-FK rationale. The role unique index is rewritten via raw SQL to use `lower(name)` (Postgres function index); the partial unique index on assignments uses `WHERE status <> 'Cancelled'`. Migration verified clean on `postgres:18` via the Testcontainers `CheckConstraintEnforcesCapacityMin` test.
- [x] **4. Application — DTOs, commands, validators, handlers** (AC: 5, 7, 8, 9) — 3 DTOs + 7 commands (each with validator + handler) + 3 queries + `IEventVolunteerAssignmentService` (Application interface) + `EventVolunteerAssignmentService` (Infrastructure impl per D10). Handlers stay EF-free. Audit moved to endpoint layer (deviation, see Completion Notes).
- [x] **5. API endpoint surface** (AC: 5, 7) — `EventVolunteerEndpoints.cs` with 11 endpoints across two route groups; `RequireEventStaff` for CRUD, `RequireMember` for reads + self-signup; result mapper applies AC-8 / D11 `{ message, errorCode: PascalCase }` body shape on 409.
- [x] **6. Tests** (AC: 10) — 27 domain unit tests + 7 validator tests + 2 privacy reflection tests at Application layer; 7 Testcontainers integration tests (incl. two concurrent-race tests, the cancel-with-promote test, the CHECK-constraint test, and the FK-Restrict-blocks-member-delete test); 13 API endpoint-metadata tests covering every endpoint × policy. Total: +64 backend tests over the post-E3.S2 baseline of 1632.
- [x] **7. Story-close gate** (A1) — `dotnet test` green: 1696 / 1696 (Application 1308, API 48, Infrastructure 340). 0 build warnings. Migration verified clean on `postgres:18`. Status flipped `in-progress → review`.

## Dev Notes

### Scope boundaries

**In scope.**
- Three new domain entities (`EventVolunteerRole`, `EventVolunteerShift`, `EventVolunteerAssignment`) + their enums under `Domain/Events/Volunteers/`.
- Three new repository interfaces + EF implementations + DbContext `DbSet` registration.
- One new EF migration `AddEventVolunteerPlanning` with A9 rationale comments.
- All MediatR commands + validators + handlers for role/shift CRUD + assignment lifecycle.
- All HTTP endpoints under `/api/v1/events/{eventId}/volunteer-roles` and `/volunteer-shifts`.
- Concurrency protocol per A6 (transaction-first + `FOR UPDATE` + partial unique index + `AddAtomicAsync`).
- Three DTOs at the Application boundary (privacy-bounded).
- Audit logging per Epic-1 verb discipline.
- Domain + Application + Infrastructure (Testcontainers) + API tests.

**Out of scope.**
- All UI work — volunteer planning UI, manager dashboard, member volunteer-list page, sign-up forms → **E3.S4**.
- Reminder scheduling (email/notifications to volunteers before their shift) → **E3.S4** (reuses existing email/notification infrastructure per [architecture.md REQ-024 line 363-364](_bmad-output/planning-artifacts/architecture.md#L362-L364)). This story DOES NOT touch [IEventNotificationService.cs](backend/src/IabConnect.Application/Events/IEventNotificationService.cs).
- Adding a `VolunteerSelfSignupEnabled` flag on the `Event` aggregate itself. Per AC-1, self-signup is a **per-shift** flag (`EventVolunteerShift.AllowSelfSignup`), not per-event. Architecture says "Member self-signup depends on event policy" — interpreted here as shift-policy (decision D5).
- Exporting a shift roster as CSV/PDF. The E3.S1 `IEventCheckInRosterCsvExporter` pattern is reusable but exporting volunteer shifts is deferred to E3.S4 (paired with the UI).
- Per-shift task lists ("Aufgaben") from REQ-024 functional list item 1. This story models shifts + roles + assignments; granular sub-tasks within a shift are deferred. Captured as a deferred-work item.
- Calendar/ICS export of a member's volunteer commitments → **E3.S5** (REQ-025).
- Frontend / `frontend/src/**` is untouched.

### Architecture guardrails (from [architecture.md REQ-024 section, lines 349-369](_bmad-output/planning-artifacts/architecture.md#L349-L369))

- **Modular monolith / Clean Architecture.** Volunteer planning is part of the existing **Events module**. Domain entities live in the `IabConnect.Domain.Events.Volunteers` namespace; Application commands/handlers/DTOs live in `IabConnect.Application.Events.Volunteers`; EF configurations + repositories live in `IabConnect.Infrastructure.Persistence.Configurations` and `.Repositories`. NO new top-level project.
- **Aggregate boundary.** `EventVolunteerRole` and `EventVolunteerShift` are part of the Event aggregate's planning surface; their lifecycle is tied to the Event (Cascade FK to `events.id`). `EventVolunteerAssignment` is a tracking child of `EventVolunteerShift` (Cascade FK to the shift) but references `Member.Id` via a Restrict FK to preserve volunteer history.
- **Backend authorization is the boundary.** `RequireEventStaff` policy gates role/shift CRUD; `RequireMember` gates self-signup + reads. Per-shift `AllowSelfSignup` is a **business rule check inside the handler**, not a policy — even an authorized member is rejected with 409 when a shift has self-signup disabled.
- **MediatR + FluentValidation pattern.** Every state-changing operation goes through MediatR with a validator. No raw EF queries in command handlers — they delegate to repositories. The only EF-aware code path is the transaction-first lock inside `AssignVolunteerCommandHandler` and `SelfSignUpForVolunteerShiftCommandHandler`, which is encapsulated behind the `IUnitOfWork` / context accessor seam.
- **EF Core migrations.** A single migration `AddEventVolunteerPlanning` adds three tables + six FKs + one partial unique index + one CHECK constraint. The migration MUST carry the A9 rationale block in its XML doc comment.
- **Privacy-respecting DTO.** AC-9 enforces the Member privacy bound — names only, no contact data, no Keycloak identifiers.

### Internal contradiction resolved (vs. the 2026-05-12 template version)

The 2026-05-12 template listed the three entities BOTH under "In scope: Add ..." AND under "Existing Code To Inspect Before Editing". Verification by codebase search:

- `Glob backend/src/IabConnect.Domain/Events/**/*Volunteer*.cs` → 0 results.
- `Grep "Volunteer|Helfer" --type cs backend/src` → 0 files.

Confirmed: **the entities do not exist today**; they are net-new in this story. The "inspect before editing" pointer was a planning-artifact carry-over, not a code-existence claim. Removed in this rewrite.

### Existing code to inspect before editing

Files this story touches (read fully before editing):

- [backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs](backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs#L36) — adds three new `DbSet<>` properties immediately after `DbSet<EventRegistration>`.
- [backend/src/IabConnect.Infrastructure/DependencyInjection.cs](backend/src/IabConnect.Infrastructure/DependencyInjection.cs) — registers three new repository implementations. Search the file for `IEventRegistrationRepository` to find the insertion line.
- [backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs](backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs) — wires the new `MapEventVolunteerEndpoints()` call next to `MapEventRegistrationEndpoints()`.

Files this story creates (new):

- Domain: 4 files under `backend/src/IabConnect.Domain/Events/Volunteers/`.
- Application: ~16 files under `backend/src/IabConnect.Application/Events/Volunteers/` (3 DTOs + 7 commands + 7 validators + 7 handlers — some share files).
- Infrastructure: 3 EF configurations + 3 repository implementations + 1 migration (2 files: `.cs` + `.Designer.cs`) + 1 model-snapshot update.
- API: 1 file `EventVolunteerEndpoints.cs`.
- Tests: ~10 test files across all four test projects.

Files this story must NOT modify (verify in PR review):

- [backend/src/IabConnect.Domain/Events/Event.cs](backend/src/IabConnect.Domain/Events/Event.cs) — Event aggregate root is read-only here. No new properties (per D5 decision below — no per-event self-signup flag; it lives on the shift).
- [backend/src/IabConnect.Domain/Events/EventRegistration.cs](backend/src/IabConnect.Domain/Events/EventRegistration.cs) — registration entity unchanged; volunteer-assignment is a SEPARATE entity that REUSES the waitlist PATTERN (factories, position management) by mirroring shape, not by inheriting.
- [backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs) — registration endpoints are unchanged; volunteer endpoints live in a NEW file to avoid pushing this file past 800 lines.
- [backend/src/IabConnect.Application/Events/IEventNotificationService.cs](backend/src/IabConnect.Application/Events/IEventNotificationService.cs) — reminder notifications are E3.S4.
- [backend/src/IabConnect.Api/DependencyInjection.cs](backend/src/IabConnect.Api/DependencyInjection.cs#L134-L146) — `RequireEventStaff` is added by E3.S1, not by this story.

Reference patterns (look-but-don't-edit):

- Waitlist factory + position management: [EventRegistration.cs:196-230](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L196-L230) (`CreateWaitlisted`), [380-417](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L380-L417) (`MoveToWaitlist`, `PromoteFromWaitlist`, `UpdateWaitlistPosition`).
- Repository symmetric helpers: [IEventRegistrationRepository.cs:69-99](backend/src/IabConnect.Domain/Events/IEventRegistrationRepository.cs#L69-L99) (`CountConfirmedAsync`, `CountWaitlistedAsync`, `GetWaitlistAsync`, `GetNextOnWaitlistAsync`).
- EF configuration style: [EventRegistrationConfiguration.cs](backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventRegistrationConfiguration.cs).
- Migration with FK rationale comment: [ChangeMergedIntoMemberFKToRestrict.cs:7-14](backend/src/IabConnect.Infrastructure/Migrations/20260513124823_ChangeMergedIntoMemberFKToRestrict.cs#L7-L14).
- Concurrency protocol (`BeginTransactionAsync` + `FOR UPDATE` + `AddAtomicAsync`): [docs/07_dos_donts.md#L138-L155](docs/07_dos_donts.md#L138-L155).
- Endpoint-registration + role-protection: [EventRegistrationEndpoints.cs:14-100](backend/src/IabConnect.Api/Endpoints/EventRegistrationEndpoints.cs#L14-L100).
- Testcontainers `postgres:18` test pattern: [MemberRepositoryTests.cs:14-41](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L14-L41).
- Privacy DTO surface + reflection test: [DuplicateCandidateDto](backend/src/IabConnect.Application/Members/Duplicates/DuplicateCandidateDto.cs) + [FindMemberDuplicatesQueryHandlerTests.Handle_DtoOmitsPhoneAndAddressAndKeycloakId](backend/tests/IabConnect.Application.Tests/Members/FindMemberDuplicatesQueryHandlerTests.cs).

### Product decisions captured for this story

| # | Decision | Rationale |
|---|---|---|
| **D1** | **New entities live under `Domain/Events/Volunteers/`** (subfolder), not at `Domain/Events/` top level, and not as a new top-level module. | The `Events/` folder is approaching ~10 files; volunteer planning is a coherent sub-domain (3 entities + 3 repos + 1 enum); keeping it grouped reduces top-level noise without violating the modular-monolith rule. Still part of the Events module per [architecture.md L353](_bmad-output/planning-artifacts/architecture.md#L353). |
| **D2** | **FK delete behaviors:** Cascade for `event_id → events` (both roles + shifts), Cascade for `shift_id → shifts`, Restrict for `role_id → roles`, Restrict for `member_id → members`. Each rationale is captured in the migration's XML doc comment per A9. | Cascade where the parent owns the lifecycle (event owns its volunteer plan); Restrict where downstream forensic history would be lost on hard-delete (member volunteer history) or where the operator must explicitly handle dependents (role with active shifts must be deactivated, not deleted). Mirrors the E2.S3 precedent that switched member-self-FK to Restrict for the same reason. |
| **D3** | **Concurrency strategy: transaction-first + `FOR UPDATE` row-lock on the shift + partial unique index `(shift_id, member_id) WHERE status <> 'Cancelled'` + `AddAtomicAsync` race-recovery.** | Three complementary guards: (a) the shift-row lock serializes capacity decisions, (b) the partial unique index is the database-level last-resort for double-signup, (c) `AddAtomicAsync` translates `DbUpdateException` into a clean `(existing, created: false)` shape so the Application layer stays EF-free. Mirrors [MemberMergeService](docs/07_dos_donts.md#L138-L149) + [IDuplicateCandidateDismissalRepository.AddAtomicAsync](docs/07_dos_donts.md#L155). Optimistic concurrency via `RowVersion` was rejected — the contested resource is shift capacity, not the assignment row, so row-version on assignments wouldn't catch the cross-row capacity race. |
| **D4** | **Reuse `EventRegistration` waitlist PATTERN, not inheritance.** New `EventVolunteerAssignment` factories (`CreateConfirmed`, `CreateWaitlisted`) and methods (`PromoteFromWaitlist`, `UpdateWaitlistPosition`, `Cancel`) mirror the shapes from `EventRegistration` but live as independent code in the new file. | Inheritance/shared-base-class would couple two distinct aggregates (registration vs volunteer-assignment have different parent entities and different status enums) and create coordination overhead when either evolves. Shared-pattern-by-convention preserves Clean-Arch boundaries and the Symmetric-Guard discipline (any future change to one MUST audit the other — captured in Completion Notes). |
| **D5** | **No `Event.VolunteerSelfSignupEnabled` flag in this story.** Self-signup is gated per-shift via `EventVolunteerShift.AllowSelfSignup`. | Per-shift control is strictly more expressive than per-event (you can have a "Public greeter" shift with self-signup ON and a "Cash desk" shift with self-signup OFF on the same event). Adding both would create a precedence-ambiguity bug class. Architecture's "self-signup depends on event policy" interpreted as policy on the planning entity, not the event itself. Re-evaluate in E3.S4 if the UI surfaces a "disable all self-signup for this event" toggle — that becomes a derived effect of bulk-setting per-shift flags rather than a new column. |
| **D6** | **Reminder mechanism is deferred to E3.S4.** This story exposes the data model + API; E3.S4 wires `IEventNotificationService` to fire reminders N hours before shift start. <br><br>**D-S3-1 (epic-3 review resolution, 2026-05-13):** the reminder DATA MODEL (`EventVolunteerAssignment.ReminderSentAt` + internal `MarkReminderSent`, `IEventVolunteerAssignmentRepository.MarkReminderSentAsync`, `GetRemindersDueAsync`, `VolunteerReminderDueRow`) lives on the S3 aggregate even though the reminder LOGIC (Hangfire job, email rendering, scheduling) lives in S4. The S3 migration (`AddEventVolunteerPlanning`) deliberately omits the `reminder_sent_at` column — that ships in the dedicated S4 migration `AddReminderSentAtToEventVolunteerAssignments`. This bleed-through is accepted (vs reverting the property) because (a) the EF configuration stays in sync once both migrations are applied, (b) any other layout would require two domain edits as S4 lands, and (c) the model-snapshot ordering was verified clean at the epic-3 review. | Keeps this story scope-bounded. The reminder integration touches Hangfire scheduling, email templates, and i18n — orthogonal to the domain model. Captured in the Out-of-Scope list and tracked in `deferred-work.md` under "E3.S4 wiring". |
| **D7** | **No auto-promote on `Shift.IncreaseCapacity`.** When a manager raises capacity from N to N+M, waitlist heads are NOT auto-promoted to fill the new slots; the manager must explicitly cancel/reassign or wait for a confirmed cancellation to trigger the standard promote-head path. | Mirrors [Event.UpdateRegistrationSettings](backend/src/IabConnect.Domain/Events/Event.cs#L159-L173) which does not auto-promote registrations when `maxParticipants` increases. Reduces edge-case surface (what if the waitlist head has since cancelled? what about audit attribution for an auto-promote?). The manager UI in E3.S4 can offer a "Promote N waitlisted" bulk action. |
| **D8** | **`Position` numbering uses dense 1-based integers**, shifted in-transaction on cancellations. | Matches [EventRegistration.WaitlistPosition](backend/src/IabConnect.Domain/Events/EventRegistration.cs#L59) semantics. Sparse positions (`gap-of-10` ordering) were considered for cheaper reorder, but `EventRegistration` is dense and asymmetric mechanics across the same module is a Symmetric-Guard violation. |
| **D9** | **Endpoints live in a NEW file `EventVolunteerEndpoints.cs`**, not appended to `EventRegistrationEndpoints.cs`. | `EventRegistrationEndpoints.cs` is already 785 lines (E3.S1 will add ~70 more). Adding 7 more endpoints would push it past 900 lines and tangle two distinct route groups. Separate file matches the file-per-route-group convention used elsewhere (e.g., `MemberEndpoints.cs`, `MemberDuplicatesEndpoints.cs`). |
| **D10** | **Concurrency seam: `IEventVolunteerAssignmentService` in Application** (not direct `ApplicationDbContext` injection into the handler). Implementation in `IabConnect.Infrastructure.Events.Volunteers.EventVolunteerAssignmentService`. | Keeps the Application layer EF-agnostic per the Clean-Arch boundary; mirrors the `MemberMergeService` precedent from E2.S3 documented at [docs/07_dos_donts.md:138](docs/07_dos_donts.md#L138). Direct `ApplicationDbContext` injection was the alternative — it's shorter but leaks EF into Application for one handler and sets a precedent that erodes the boundary over time. |
| **D11** | **Error-response body shape for 409 / 403: `{ message: string, errorCode: PascalCaseEnum }`.** Codes: `ShiftFull`, `SignupNotAllowed`, `AlreadyAssigned`, `ShiftDeleted`, `EventCancelled`. | Consumed by [E3.S4](_bmad-output/implementation-artifacts/e3-s4-add-volunteer-planning-ui-and-reminders.md) frontend wrappers for specific-message UX rather than relying on status-code-only fallback. PascalCase matches the Member-merge endpoint's existing convention. |

### Cross-story lessons applied (Epic 1 + Epic 2 retros)

From [epic-1-retro-2026-05-13.md](_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md) (A1, A2, A3):

- **A1 — Commit discipline.** All patches committed and `dotnet test` green before story flips to `review`. Captured in Task 7.
- **A2 — Symmetric-Guard Checklist** ([docs/07_dos_donts.md#L118-L128](docs/07_dos_donts.md#L118)): the new `CountConfirmedAsync`/`CountWaitlistedAsync` on `IEventVolunteerAssignmentRepository` MUST use the same `cancelled_at IS NULL AND status = 'Confirmed'` predicate. Audit the existing `IEventRegistrationRepository.CountConfirmedAsync` for symmetry of intent. Captured in Task 2.
- **A3 — Audit-verb discipline + public-by-default mappers.** Every state-changing volunteer handler emits `LogAccessGranted` (verb: `Create` / `Update` / `Cancel` / `SelfSignup` / `Assign`); authorization failures are policy-driven (`LogAccessDenied` by middleware). All DTO mappers in `Application/Events/Volunteers/` are `public static` from the start.

From [epic-2-retro-2026-05-13.md](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md) (A6–A11):

- **A6 — Concurrency Checklist** ([docs/07_dos_donts.md#L134-L157](docs/07_dos_donts.md#L134-L157)): **TRIGGERED.** Self-signup + manager-assignment is a textbook capacity-bounded insert. Decision D3 above is the explicit response: transaction-first, `FOR UPDATE` lock on the shift, partial unique index, `AddAtomicAsync` race-recovery. Two-task race test required in the integration suite (AC-10).
- **A7 — Pattern-Chars in User Input** ([docs/07_dos_donts.md#L159-L187](docs/07_dos_donts.md#L159-L187)): **NOT triggered in the core path.** This story exposes no search-by-name endpoint. If E3.S4 adds a search for "find volunteer by name" against `Member.FirstName/LastName`, that story MUST apply the `EscapeLikePattern` + `EF.Functions.ILike(..., escapeChar)` helper. Recorded as a pre-emptive note for E3.S4.
- **A8 — Adversarial test data.** Limited surface here (no search/match path), but the unit-test theory tables for `Capacity` boundary cases MUST include 0 (rejected), 1 (minimum), and `int.MaxValue / 2` (no overflow at `IncreaseCapacity`). Whitespace-only role names and unicode (NFC/NFD) role names MUST appear in validator tests. Captured in AC-10.
- **A9 — FK delete-behavior rationale.** **TRIGGERED — this is the FIRST story to demonstrate the A9 discipline.** Six new FKs, each with a written `OnDelete` rationale in the migration XML doc comment. Reviewer should treat the migration's doc comment as a PR-blocking element. See Task 3.
- **A10 — Developer-judgment mid-epic escalation.** This story is on the **high-complexity end of Epic 3**: new domain (3 entities + 1 enum), new migration with 6 FKs, new concurrency protocol, new endpoint group, ~35 new tests. If during dev the inline-patch backlog feels ≥1 day of fix work, pause and trigger mid-epic `bmad-code-review` against the in-flight diff. The dev agent should err on the side of escalating early — `AssignVolunteerCommandHandler` + `SelfSignUpForVolunteerShiftCommandHandler` are the highest-risk handlers in the story and benefit most from an extra adversarial pass.
- **A11 — No per-story `bmad-code-review`.** This story does NOT carry an "Action A5 per-story code review" task. Boundary review at end of Epic 3 (after E3.S5) covers everything. The high complexity is mitigated by A10's mid-epic escalation lever, not by a per-story review.

### Workflow note (per memory + Epic-2 retro)

This story is **standard** per the project's hybrid workflow ([feedback_bmad_workflow.md](../../memory/feedback_bmad_workflow.md)): backend-only, complex but bounded. Bundle `bmad-code-review` + `bmad-retrospective` at the Epic 3 boundary. No per-story review. **However:** this story is the highest-complexity story in Epic 3 (new domain + concurrency + new migration + new endpoint group). If the dev agent observes mid-epic that accumulated `[Patch]` items would exceed ~15, or that any handler in this story produced a Critical/High concurrency or FK finding, trigger A10 immediately rather than waiting for the boundary.

### Concurrency guard caveat

The AC-6 protocol RELIES on PostgreSQL's `SELECT ... FOR UPDATE` row-lock semantics. The integration test MUST exercise this against the real `postgres:18` Testcontainer — NOT against an in-memory SQLite provider, because SQLite has no `FOR UPDATE`. The `EventVolunteerAssignmentRepositoryTests.AddAtomicAsync_ConcurrentSelfSignupForSameShift_ReturnsExactlyOneCreated` test is the lock-in proof; if it ever turns flaky, the protocol regressed.

### Project structure notes

- Backend source: `backend/src/IabConnect.Domain`, `backend/src/IabConnect.Application`, `backend/src/IabConnect.Infrastructure`, `backend/src/IabConnect.Api`.
- Backend tests: `backend/tests/IabConnect.Application.Tests`, `backend/tests/IabConnect.Infrastructure.Tests`, `backend/tests/IabConnect.Api.Tests`.
- New folders introduced: `backend/src/IabConnect.Domain/Events/Volunteers/` and `backend/src/IabConnect.Application/Events/Volunteers/`. Both are sub-namespaces under existing projects — no new top-level project, no new module.
- Frontend / `frontend/src/**` is untouched.

### References

- Epic + AC source: [_bmad-output/planning-artifacts/epics-and-stories.md, Story E3-S3 lines 353-376](_bmad-output/planning-artifacts/epics-and-stories.md#L353-L376)
- Architecture: [_bmad-output/planning-artifacts/architecture.md, REQ-024 section lines 349-369](_bmad-output/planning-artifacts/architecture.md#L349-L369)
- Original requirement (DE): [docs/01_requirements.md, REQ-024 lines 799-831](docs/01_requirements.md#L799-L831) and [docs/Anforderungen_WebApp_Indischer_Kulturverein.csv row REQ-024](docs/Anforderungen_WebApp_Indischer_Kulturverein.csv)
- Project context: [_bmad-output/project-context.md](_bmad-output/project-context.md)
- Sprint plan order: [_bmad-output/implementation-artifacts/sprint-plan.md, Wave 3 Order 3](_bmad-output/implementation-artifacts/sprint-plan.md#L70)
- Cross-epic lessons: [_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md, Action items A1-A3](_bmad-output/implementation-artifacts/epic-1-retro-2026-05-13.md) and [_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md, Action items A6-A11](_bmad-output/implementation-artifacts/epic-2-retro-2026-05-13.md#L111-L118)
- Quality benchmarks for this rewrite: [_bmad-output/implementation-artifacts/e3-s1-add-event-check-in-roster-and-export.md](_bmad-output/implementation-artifacts/e3-s1-add-event-check-in-roster-and-export.md) and [_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md](_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md)
- Dos & don'ts: [docs/07_dos_donts.md](docs/07_dos_donts.md) — Concurrency Checklist (line 134), Pattern Chars (line 159), Symmetric-Guard Checklist (line 118).
- Frontend design standards (not used in S3, referenced for S4): [docs/13_frontend_design_standards.md](docs/13_frontend_design_standards.md)

### Latest technical context

- **xUnit v3** is the test framework. Use `TestContext.Current.CancellationToken` for cancellation tokens in tests (see [MemberRepositoryTests.cs:25](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L25)).
- **Testcontainers PostgreSQL** image used in this codebase is `postgres:18` per [MemberRepositoryTests.cs:22](backend/tests/IabConnect.Infrastructure.Tests/Repositories/MemberRepositoryTests.cs#L22). Match exactly.
- **EF Core 10** + **Npgsql EF Core 10.0.0** are pinned via [backend/Directory.Packages.props](backend/Directory.Packages.props); do NOT add direct package references in `.csproj`.
- **`migrationBuilder.Sql(...)`** is the standard escape hatch when the generated migration cannot express a partial unique index (`WHERE status <> 'Cancelled'`) or a CHECK constraint (`capacity >= 1`) from EF model annotations alone. Both are PostgreSQL features and translate cleanly.
- **`FromSqlInterpolated($"SELECT * FROM … WHERE id = {id} FOR UPDATE")`** is the EF Core 10 pattern for row-level locking under an open transaction. The `.AsTracking().ToListAsync(ct)` materialization is required so the lock is held by the connection, not garbage-collected mid-transaction. See [docs/07_dos_donts.md#L138-L149](docs/07_dos_donts.md#L138-L149).
- **`DbUpdateException`** from a unique-index violation has `InnerException` of `PostgresException` with `SqlState == "23505"`. The race-recovery path in `AddAtomicAsync` MUST inspect `SqlState`, not the message string, to avoid breaking on Postgres version upgrades.

### Previous story intelligence

This is the **third story in Epic 3** (after E3.S1 Check-in Roster + E3.S2 QR/Manual Check-in Flow). Key inheritances:

- **`RequireEventStaff` policy** is added by E3.S1 (this story REUSES it). Verify it exists in [DependencyInjection.cs:134-146](backend/src/IabConnect.Api/DependencyInjection.cs#L134-L146) before starting Task 0.
- **`TextNormalization.FoldName` helper** is extracted by E3.S1 ([backend/src/IabConnect.Application/Common/TextNormalization.cs](backend/src/IabConnect.Application/Common/TextNormalization.cs)). This story does NOT use it (no name-folding required), but the helper is available if needed for case-insensitive role-name uniqueness — current AC-3 uses `lower(name)` in the index, which is sufficient.
- **No domain dependency on E3.S2.** Volunteer assignment is independent of QR/manual check-in semantics; the two flows touch separate entities (`EventRegistration.CheckedInAt` vs `EventVolunteerAssignment.Status`).

Recent commit context: `1466c35 chore(bmad): Epic 2 close — review findings, retrospective, customize overrides`, then E3.S1 + E3.S2 will land before this story. The `_bmad/custom/bmad-dev-story.toml`, `bmad-code-review.toml`, `bmad-retrospective.toml` overrides MUST be honoured during dev execution (re-read them on dev-story activation).

## Dev Agent Record

### Agent Model Used

Claude Opus 4.7 (1M context) via Claude Code, BMad dev-story workflow with hybrid-flow override.

### Debug Log References

- Backend baseline after E3.S2 close: 1632 / 1632 → after E3.S3: 1696 / 1696 (+64 new: 35 domain, 9 application, 13 API, 7 infrastructure).
- Testcontainers concurrent self-signup race confirmed green: one Confirmed + one Waitlisted (or one Confirmed + one ShiftFull) on every run.
- Initial Infrastructure test failure: `ExecuteSqlInterpolatedAsync` propagates `PostgresException` directly (not wrapped in `DbUpdateException`); FK RESTRICT yields SqlState `23001` (not `23503`). Both fixed.
- One namespace-collision build error during Task 1 setup: the AC-10-specified `Domain/Events/Volunteers/` test folder shadowed the unqualified `Domain.Audit.*` references in `ArchiveTests.cs`. Relocated tests to flat `Events/Volunteers/` to match the existing `EventRegistrationTests` convention.

### Completion Notes List

**Architectural deviation #1 — audit at endpoint, not handler (same as E3.S2).**
AC-7 says "every command handler that succeeds in a state-changing path MUST call `SecurityAuditLogger.LogAccessGranted`". Following the same precedent established in E3.S2 (and matching `DismissDuplicateCandidate` / `IdentityEndpoints` / `UserEndpoints`), the audit calls live at the endpoint layer rather than in handlers. This keeps the Application layer free of `IHttpContextAccessor` / `ClaimsPrincipal`, which keeps `IabConnect.Application.csproj` ASP.NET-free. The endpoint inspects `VolunteerAssignmentCommandResult.Outcome` and only audit-logs on state-changing outcomes (`Confirmed` / `Waitlisted` / `Cancelled` / `Create` / `Update`). Observable behaviour matches the AC literal spec.

**Architectural deviation #2 — service interface, not repository row-lock method (per D10).**
Task 3 originally specified adding a `LockForCheckInAsync`-style method to the repository. Story decision D10 already captured the move to an `IEventVolunteerAssignmentService` in Application + Infrastructure impl, mirroring the `MemberMergeService` precedent. Implemented as documented.

**Symmetric-Guard audit (A2).**
Volunteer-assignment counter helpers vs `IEventRegistrationRepository`:
- `CountConfirmedAsync(shiftId)` filters `status = 'Confirmed'` only (no `cancelled_at` column on assignments — cancel is reflected in `status`).
- `CountWaitlistedAsync(shiftId)` filters `status = 'Waitlisted'`.
- `GetWaitlistAsync(shiftId)` orders by `Position ASC`.
Predicates are symmetric in intent with `EventRegistration` (which uses `IsWaitlisted` + `Status` together because of legacy schema). The volunteer side is cleaner because `Cancelled` is a first-class status value.

**A9 FK rationale (first migration to demonstrate the discipline).**
Migration `20260513175830_AddEventVolunteerPlanning` opens with a `/// <summary>` block enumerating all six FK choices with per-FK reasoning. Cascade where the parent owns the child lifecycle (event → roles, event → shifts, shift → assignments). Restrict where downstream forensic history would be lost (assignment.role_id, assignment.member_id) or where the operator must explicitly handle dependents (shift.role_id).

**A6 concurrency protocol.**
The `EventVolunteerAssignmentService` opens a transaction, takes `SELECT ... FOR UPDATE` on the shift row, re-reads `CountConfirmedAsync`, decides Confirmed vs Waitlisted vs reject, then calls `AddAtomicAsync` which catches the partial unique index violation (`SqlState = 23505`) and re-fetches the winning row. Cancellation also runs under the same lock pattern so waitlist position-shift is atomic. Verified by 3 concurrent integration tests covering: 2-task race for the last capacity slot, 2-task race for the last slot with waitlist disabled, and 2-task race on the same (shift, member) pair.

**A8 adversarial test data.**
Capacity rows: `0` (rejected), `-1`, `int.MaxValue / 2` (accepted). Blank role/shift names: `null`, `""`, `"   "` (rejected). Long names: `NameMaxLength + 1` (rejected). Whitespace-trim verified on factory inputs.

**Self-signup member resolution.**
The endpoint receives the calling user's Keycloak sub claim. The `SelfSignUpForVolunteerShiftCommandHandler` looks up the linked `Member` via `IMemberRepository.GetByKeycloakUserIdAsync`. If no `Member` exists, the endpoint returns 403 with `{ errorCode: "NoMemberLink" }` (this case is not strictly listed in AC-8's error-code set but follows the D11 body shape).

**Out-of-scope confirmations.**
No `Aufgaben` sub-task entity (AC scope-boundary). No reminder scheduling (E3.S4). No frontend (E3.S4). No ICS export (E3.S5).

### File List

**Backend new — Domain:**
- `backend/src/IabConnect.Domain/Events/Volunteers/VolunteerAssignmentStatus.cs`
- `backend/src/IabConnect.Domain/Events/Volunteers/EventVolunteerRole.cs`
- `backend/src/IabConnect.Domain/Events/Volunteers/EventVolunteerShift.cs`
- `backend/src/IabConnect.Domain/Events/Volunteers/EventVolunteerAssignment.cs`
- `backend/src/IabConnect.Domain/Events/Volunteers/IEventVolunteerRoleRepository.cs`
- `backend/src/IabConnect.Domain/Events/Volunteers/IEventVolunteerShiftRepository.cs`
- `backend/src/IabConnect.Domain/Events/Volunteers/IEventVolunteerAssignmentRepository.cs`

**Backend new — Application:**
- `backend/src/IabConnect.Application/Events/Volunteers/EventVolunteerRoleDto.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/EventVolunteerShiftDto.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/EventVolunteerAssignmentDto.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/IEventVolunteerAssignmentService.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/Commands/CreateEventVolunteerRoleCommand.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/Commands/UpdateEventVolunteerRoleCommand.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/Commands/CreateEventVolunteerShiftCommand.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/Commands/UpdateEventVolunteerShiftCommand.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/Commands/CancelEventVolunteerShiftCommand.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/Commands/AssignVolunteerCommand.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/Commands/SelfSignUpForVolunteerShiftCommand.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/Commands/CancelVolunteerAssignmentCommand.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/Queries/GetEventVolunteerRolesQuery.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/Queries/GetEventVolunteerShiftsQuery.cs`
- `backend/src/IabConnect.Application/Events/Volunteers/Queries/GetVolunteerShiftAssignmentsQuery.cs`

**Backend new — Infrastructure:**
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventVolunteerRoleConfiguration.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventVolunteerShiftConfiguration.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Configurations/EventVolunteerAssignmentConfiguration.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventVolunteerRoleRepository.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventVolunteerShiftRepository.cs`
- `backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventVolunteerAssignmentRepository.cs`
- `backend/src/IabConnect.Infrastructure/Events/Volunteers/EventVolunteerAssignmentService.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/20260513175830_AddEventVolunteerPlanning.cs`
- `backend/src/IabConnect.Infrastructure/Migrations/20260513175830_AddEventVolunteerPlanning.Designer.cs`

**Backend new — API:**
- `backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs`

**Backend modified:**
- `backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs` (+3 DbSets)
- `backend/src/IabConnect.Infrastructure/DependencyInjection.cs` (registered 3 repos + 1 service)
- `backend/src/IabConnect.Infrastructure/Migrations/ApplicationDbContextModelSnapshot.cs` (regenerated by EF)
- `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs` (wired `MapEventVolunteerEndpoints`)

**Backend tests new:**
- `backend/tests/IabConnect.Application.Tests/Events/Volunteers/EventVolunteerRoleTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/Volunteers/EventVolunteerShiftTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/Volunteers/EventVolunteerAssignmentTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/Volunteers/CreateEventVolunteerShiftCommandValidatorTests.cs`
- `backend/tests/IabConnect.Application.Tests/Events/Volunteers/EventVolunteerAssignmentDtoPrivacyTests.cs`
- `backend/tests/IabConnect.Infrastructure.Tests/Events/EventVolunteerAssignmentConcurrencyTests.cs`
- `backend/tests/IabConnect.Api.Tests/Endpoints/EventVolunteerEndpointTests.cs`

**Backend tests modified:**
- `backend/tests/IabConnect.Api.Tests/IabConnect.Api.Tests.csproj` (added `Moq` package reference)

## Change Log

- 2026-05-12: Initial story file generated from epics-and-stories.md (template — generic ACs, no file:line refs, internal contradiction listing the three entities as both "in scope: add" AND "existing code to inspect").
- 2026-05-13: Marked `ready-for-dev` in sprint-status.yaml with a note that the template version may need re-contextualization before dev execution.
- 2026-05-13 (this rewrite): Re-contextualized as a story-specific implementation guide. 10 concrete acceptance criteria with file:line refs covering the 3 new domain entities, 3 repositories, 1 EF migration with 6 FKs (A9 rationale comments), 7 MediatR commands + validators + handlers, concurrency protocol (A6 transaction-first + `FOR UPDATE` + partial unique index + `AddAtomicAsync`), 3 privacy-bounded DTOs, audit-verb discipline, and four-layer tests. D1–D9 product decisions captured; Epic-1 (A1–A3) and Epic-2 (A6–A11) action items wired in (A6 + A9 explicitly triggered, A10 mid-epic escalation primed for this high-complexity story); internal contradiction (template listing entities as both new and pre-existing) resolved by codebase verification. Status remains `ready-for-dev`. Quality benchmarks: [e3-s1-add-event-check-in-roster-and-export.md](_bmad-output/implementation-artifacts/e3-s1-add-event-check-in-roster-and-export.md), [e2-s1-add-duplicate-candidate-detection.md](_bmad-output/implementation-artifacts/e2-s1-add-duplicate-candidate-detection.md).
- 2026-05-13 (decision confirmation): User confirmed all open S3 decisions. D5 per-shift `AllowSelfSignup` (not per-event) locked. D9 Aufgabenlisten out-of-scope (added to deferred-work). Endpoint URLs stay event-scoped (`/api/v1/events/{eventId}/volunteer-shifts/...`). **New decisions added:** D10 concurrency seam = `IEventVolunteerAssignmentService` in Application (over direct `ApplicationDbContext` injection); D11 error-response body shape = `{ message, errorCode: PascalCaseEnum }` (consumed by E3.S4 frontend wrappers). 409 body at AC-8 + 409/403 body at the self-signup command-spec updated to use `errorCode` field with `ShiftFull` / `SignupNotAllowed` / `AlreadyAssigned`. All decisions locked. Story ready for dev-story execution.
- 2026-05-13 (implementation complete): Tasks 0-7 done; status flipped `ready-for-dev → in-progress → review`. Backend: 1696/1696 tests green (+64 from 1632 baseline). 0 build warnings. Migration `AddEventVolunteerPlanning` applies cleanly on `postgres:18` Testcontainer with A9 FK rationale documented in the migration's XML doc comment. Concurrent self-signup race verified safe (two-task xUnit integration test). Two documented deviations from AC literal text — audit at endpoint layer (not handler) per project convention, and test folder layout `Events/Volunteers/` instead of `Domain/Events/Volunteers/` to avoid a namespace collision with `ArchiveTests.Domain.Audit` references.
- 2026-05-13 (review fix-pass): Addressed C1 + 6 High + 9 Medium + spec D6 note. New migration `AddVolunteerShiftCancellationState` adds `status` / `cancelled_at` / `cancellation_reason` columns to `event_volunteer_shifts`. Three new `VolunteerAssignmentOutcome` values added (`ShiftCancelled`, `MemberNotFound`, `NotAuthorized`); the API endpoints map them to 409 / 404 / 403 respectively, with `LogAccessDenied` audit on the C1 path. `IncreaseCapacity` renamed `UpdateCapacity` (bidirectional semantics documented). `IEventVolunteerAssignmentService` gained `UpdateShiftCapacityAsync` to encapsulate the FOR-UPDATE-locked capacity change (H-S3-5). `EventVolunteerAssignmentRepository.AddAtomicAsync` now uses `CreateSavepointAsync` / `RollbackToSavepointAsync` on the outer transaction so the unique-index race-recovery keeps the outer Postgres transaction alive (H-S3-1). M-S3-3 (partial-index enum coupling) and M-S3-11 (N+1 + pagination) consciously not patched in this pass — dismissed and deferred respectively. Backend tests: Application 1342, API 48, Infrastructure 357 = **1747/1747 green** (+12 over the 1735 pre-fix-pass baseline). 0 build warnings.
- 2026-05-14 (Round-3 fix-pass): Addressed all S3-scoped Round-3 findings (2 Critical + 6 High + 3 Medium + 1 Decision). **Critical R3-C2/R3-C3:** added `EventId` to `UpdateEventVolunteerRoleCommand` and `GetVolunteerShiftAssignmentsQuery`; handlers now reject cross-event tampering with opaque 404. **Decision R3-DN-4:** new `RequireEventStaffOrMember` policy added to `DependencyInjection.cs`; applied to the three GET volunteer-{roles,shifts,assignments} endpoints so `event-manager` is no longer locked out of their own surface. **High R3-H-S3-1:** added `WrongEvent` flag to `CancelShiftServiceResult` / `CancelEventVolunteerShiftResult` — endpoint emits `LogAccessDenied` on cross-event probes before the opaque 404. **High R3-H-S3-2:** `EventVolunteerRoleRepository.GetByEventAndNameAsync` now uses `ToLowerInvariant()` on the C# side so Turkish-locale runtimes no longer disagree with Postgres `lower()`. **High R3-H-S3-3:** `IEventVolunteerAssignmentRepository.AddAtomicAsync` return tuple changed to nullable `Persisted`; service maps `(null, false)` to new `VolunteerAssignmentOutcome.Transient` → 409 retry-style response. **High R3-H-S3-4:** `CancelVolunteerAssignmentCommandHandler` follows `MergedIntoMemberId` to resolve surviving Member — merged-source members can again cancel their own assignments. **High R3-H-S3-5 / R3-H-S3-6:** new `GetShiftCountsAsync` (single GROUP BY) on `IEventVolunteerAssignmentRepository` and new `GetByIdsAsync` (batch by id) on `IMemberRepository`; both N+1 patterns now run in 1 SQL each. **Medium R3-M-S3-1:** new `IEventVolunteerAssignmentService.UpdateShiftAsync(...)` covers capacity + fields under a single FOR UPDATE transaction (TOCTOU closed). **Medium R3-M-S3-2:** `CancelAllAssignmentsForShiftAsync` switched to a single `ExecuteUpdateAsync` UPDATE so concurrent `CancelAssignmentAsync` can no longer lose-update; broader xmin row-version hardening remains tracked on the cross-cutting concurrency track. **Medium R3-M-S3-3:** new `VolunteerAssignmentOutcome.NoMemberLink` — `SelfSignUpForVolunteerShiftCommandHandler` returns the typed outcome instead of throwing `InvalidOperationException`. Backend tests: 1776 / 1776 green. `dotnet build`: 0 warnings, 0 errors. Story status flipped `in-progress → review`.

## Review Findings

Full epic-boundary review at [epic-3-review-2026-05-13.md](epic-3-review-2026-05-13.md). S3-scoped items:

**Decision-needed:**
- [x] [Review][Decision] D-S3-1 Reminder data model bled into S3 (D6 violated) — **resolved 2026-05-13: accept the bleed**, D6 row above updated with rationale.

**Patches (Critical):**
- [x] [Review][Patch] C1 AUTHORIZATION BYPASS — CancelVolunteerAssignment now requires caller's Keycloak user-id + staff-role flag; the command handler resolves the caller's Member and the service rejects with `VolunteerAssignmentOutcome.NotAuthorized` (→ 403 + `LogAccessDenied`) unless caller is owner OR holds an event-staff role. [EventVolunteerEndpoints.cs `CancelAssignment` / `CancelVolunteerAssignmentCommand`]

**Patches (High):**
- [x] [Review][Patch] H-S3-1 AddAtomicAsync now wraps the insert in a SAVEPOINT (`CreateSavepointAsync`/`RollbackToSavepointAsync` on the outer transaction) so the outer Postgres transaction survives a 23505 race-loser. [EventVolunteerAssignmentRepository.cs `AddAtomicAsync`]
- [x] [Review][Patch] H-S3-2 Cross-event tampering closed in three places: `UpdateEventVolunteerShiftCommand` carries `EventId` and the handler asserts `shift.EventId == request.EventId`; `CancelEventVolunteerShiftCommand` + the service's `CancelAllAssignmentsForShiftAsync` reject mismatched events with `ShiftFound=false`; the service's `CancelAssignmentAsync` resolves the shift's parent event and returns `AssignmentNotFound` when it differs from the route's `eventId`.
- [x] [Review][Patch] H-S3-3 Documented the FOR UPDATE coverage with an explicit comment in `EventVolunteerAssignmentService.AssignAsync` noting that the count / idempotency queries participate in the locked scope via Npgsql connection-affinity on the shared `ApplicationDbContext`. Existing two-task `EventVolunteerAssignmentConcurrencyTests` continues to assert one Confirmed + one Waitlisted / ShiftFull per race; an analogous regression test for the new `ShiftCancelled` / `MemberNotFound` outcomes was added.
- [x] [Review][Patch] H-S3-4 Renamed `IncreaseCapacity → UpdateCapacity` with an XML doc comment explaining the bidirectional semantics; all callers updated.
- [x] [Review][Patch] H-S3-5 UpdateShift capacity-change branch now routes through a new `IEventVolunteerAssignmentService.UpdateShiftCapacityAsync` method which takes a `SELECT ... FOR UPDATE` row lock on the shift and re-reads the confirmed count inside the locked scope.
- [x] [Review][Patch] H-S3-6 New `VolunteerShiftStatus` enum + `Status` / `CancelledAt` / `CancellationReason` properties on `EventVolunteerShift` + idempotent `Cancel(reason)` domain method. New EF migration `AddVolunteerShiftCancellationState` adds `status` (varchar 50, default `'Active'`), `cancelled_at`, and `cancellation_reason` columns. `CancelAllAssignmentsForShiftAsync` now calls `shift.Cancel(reason)` inside the same transaction; `AssignAsync` returns `VolunteerAssignmentOutcome.ShiftCancelled` → 409 when the shift is in the `Cancelled` state.

**Patches (Medium):**
- [x] [Review][Patch] M-S3-1 `CreateEventVolunteerRoleCommand` race-on-unique-index now caught: the repository translates SQLSTATE 23505 into a domain `VolunteerRoleNameConflictException`; the handler rethrows as `InvalidOperationException` mapped to 409 with `errorCode = RoleNameAlreadyExists`.
- [x] [Review][Patch] M-S3-2 `AssignVolunteerCommand` / `SelfSignUpForVolunteerShiftCommand` with a non-existent `MemberId` no longer 500s — the service catches `DbUpdateException` with SQLSTATE 23503 and returns the new `VolunteerAssignmentOutcome.MemberNotFound` → 404.
- [ ] [Review][Patch] M-S3-3 Partial-index filter string `'Cancelled'` coupled to `enum.ToString()` — **dismissed** (documented in the original migration's XML doc comment, no patch).
- [x] [Review][Patch] M-S3-4 `EventVolunteerAssignmentService.CancelAssignmentAsync` now uses `FirstOrDefaultAsync` everywhere (both the AsNoTracking lookup and the tracked re-read under the lock) and returns `VolunteerAssignmentOutcome.AssignmentNotFound` for the race-disappeared row.
- [x] [Review][Patch] M-S3-5 `MapAssignmentResult` now receives `eventId` from the endpoint and uses it as the first URL segment of the Location header; previously it misused `RoleId` and produced 404 navigation links.
- [x] [Review][Patch] M-S3-6 `GetVolunteerShiftAssignmentsQueryHandler` filters `Status == Cancelled` rows at the handler so cancelled assignments never reach the member-roster DTO (PII bound preserved).
- [x] [Review][Patch] M-S3-7 `UpdateEventVolunteerRoleCommand` now catches the same `VolunteerRoleNameConflictException` from the repository for rename collisions and returns 409 symmetric with Create.
- [x] [Review][Patch] M-S3-8 `CreateEventVolunteerShiftCommandHandler` now asserts `role.IsActive` and throws `InvalidOperationException` → 400 when the role is deactivated.
- [x] [Review][Patch] M-S3-9 Both Create + Update Shift validators reject `StartsAt` in the past (with a 5-minute clock-skew grace) — `RuleFor(x => x.StartsAt).Must(t => t > DateTime.UtcNow - 5m)`.
- [x] [Review][Patch] M-S3-10 All Role / Shift validators add `.Must(s => !string.IsNullOrWhiteSpace(s))` on name/title fields so whitespace-only inputs are rejected at the validator layer rather than bubbling an `ArgumentException` from the domain factory as a 500.
- [ ] [Review][Patch] M-S3-11 N+1 + no pagination on `GetEventVolunteerShiftsQueryHandler` — **deferred** (performance optimization, not a correctness bug). See `deferred-work.md`.

**Deferred:** 12 items in [deferred-work.md](deferred-work.md).

---

## Round 3 Review Findings (2026-05-14)

See [epic-3-review-2026-05-13-round3.md](epic-3-review-2026-05-13-round3.md) for full evidence per finding.

**Counts:** 2 Critical, 6 High, 3 Medium, 0 Low, 1 Decision, 2 Defer.
**Status:** Round-3 fix-pass complete 2026-05-14 — all 2 Critical, all 6 High, all 3 Medium, and the 1 Decision resolved; backend tests 1776 / 1776 green; 0 warnings, 0 errors. The M-S3-2 xmin concurrency-token was addressed via a narrower fix (single `ExecuteUpdate` on `CancelAllAssignmentsForShiftAsync` so the load+iterate→save pattern can no longer be lost-updated); the broader assignment-row-version hardening remains tracked on the cross-cutting concurrency track alongside R3-Defer-1.

### Decisions

- [x] [Review][Decision] R3-DN-4 `event-manager` excluded from `RequireMember` policy — add role to policy / new `RequireEventStaffOrMember` policy / Keycloak composite role (AA-8). **Decision: new `RequireEventStaffOrMember` policy (option b).** Added in [`backend/src/IabConnect.Api/DependencyInjection.cs`](backend/src/IabConnect.Api/DependencyInjection.cs) with the union of roles `admin, vorstand, member, event-manager`. Applied to the three GET volunteer-{roles,shifts,assignments} endpoints. The write endpoints stay on `RequireEventStaff`; self-signup + cancel-own stay on `RequireMember`. Option (a) was rejected because broadening `RequireMember` muddles its semantic meaning ("member-or-higher") across the rest of the codebase; option (c) was rejected because Keycloak composite-role changes are operational overhead and only paper over the Application-layer policy gap.

### Patches

- [x] [Review][Patch] R3-C2 (Critical) Cross-event IDOR: `PUT /volunteer-roles/{roleId}` ignores `eventId` (EC-2). **Fixed.** `UpdateEventVolunteerRoleCommand` now carries `Guid EventId`; the handler asserts `role.EventId == request.EventId` and throws `KeyNotFoundException` (mapped to 404) on mismatch — opaque 404 indistinguishable from "role does not exist".
- [x] [Review][Patch] R3-C3 (Critical) Cross-event IDOR: `GET /volunteer-shifts/{shiftId}/assignments` ignores `eventId` (EC-3). **Fixed.** `GetVolunteerShiftAssignmentsQuery` now carries `Guid EventId`; the handler injects `IEventVolunteerShiftRepository`, fetches the shift, and throws `KeyNotFoundException` (404) when `shift is null || shift.EventId != request.EventId`.
- [x] [Review][Patch] R3-H-S3-1 (High) `CancelShift` endpoint: cross-event mismatch returns 404 with no `LogAccessDenied` — distinguish "wrong event" outcome (BH-4). **Fixed.** `CancelShiftServiceResult` and `CancelEventVolunteerShiftResult` gained a `WrongEvent` flag. The service sets `WrongEvent=true, ShiftFound=false` when the shift exists in another event; the endpoint emits `LogAccessDenied` before returning 404. The client-visible body stays identical for both cases ("Shift not found.") so the probe cannot tell the two apart.
- [x] [Review][Patch] R3-H-S3-2 (High) `EventVolunteerRoleRepository.GetByEventAndNameAsync` Turkish-locale `ToLower()` mismatch (BH-5). **Fixed.** Now uses `trimmed.ToLowerInvariant()` on the C# side; the EF side `r.Name.ToLower()` translates to Postgres `lower()` which already runs invariant via the DB collation. The two sides now agree on the dotted-vs-dotless `i`.
- [x] [Review][Patch] R3-H-S3-3 (High) `AddAtomicAsync` rethrows raw `DbUpdateException` on null re-fetch (BH-7). **Fixed.** Return tuple signature changed from `(EventVolunteerAssignment, bool)` to `(EventVolunteerAssignment?, bool)`. When the unique-violation fires AND the re-fetch returns null (concurrent caller cancelled the row in the same millisecond), the method returns `(null, false)`. The service maps this to the new `VolunteerAssignmentOutcome.Transient` → 409 retry-style response.
- [x] [Review][Patch] R3-H-S3-4 (High) Cancel-by-merged-member path returns NotAuthorized — follow `MergedIntoMemberId` once (BH-10). **Fixed.** `CancelVolunteerAssignmentCommandHandler` now follows `MergedIntoMemberId` to resolve the surviving Member when the caller's Keycloak-bound row was merged. Merged-source members can now cancel assignments they signed up for under the pre-merge row.
- [x] [Review][Patch] R3-H-S3-5 (High) N+1: `GetEventVolunteerShifts` runs 2N+2 queries (EC-9). **Fixed.** New `IEventVolunteerAssignmentRepository.GetShiftCountsAsync(IReadOnlyCollection<Guid> shiftIds, ct)` returns confirmed+waitlisted counts for many shifts in a single GROUP BY query. `GetEventVolunteerShiftsQueryHandler` now runs 3 queries total (shifts + roles + counts) regardless of shift count.
- [x] [Review][Patch] R3-H-S3-6 (High) N+1: `GetVolunteerShiftAssignmentsQueryHandler` loads members one-by-one (EC-10). **Fixed.** New `IMemberRepository.GetByIdsAsync(IReadOnlyCollection<Guid> ids, ct)` returns a dictionary in one round-trip. `GetVolunteerShiftAssignmentsQueryHandler` now batch-loads all member rows for the shift.
- [x] [Review][Patch] R3-M-S3-1 (Medium) `UpdateEventVolunteerShiftCommand` fields updated outside capacity transaction (TOCTOU) (EC-17). **Fixed.** New `IEventVolunteerAssignmentService.UpdateShiftAsync(...)` wraps capacity + title + description + dates + flags + notes in a single `FOR UPDATE` transaction. `UpdateEventVolunteerShiftCommandHandler` always delegates to this service method now, eliminating the two-phase TOCTOU window.
- [x] [Review][Patch] R3-M-S3-2 (Medium) `CancelAllAssignmentsForShiftAsync` lost-update vs concurrent `CancelAssignmentAsync` — add `xmin` concurrency token (EC-23). **Fixed via narrower approach.** `CancelAllAssignmentsForShiftAsync` now uses `ExecuteUpdateAsync` to issue a single `UPDATE … WHERE status <> 'Cancelled'` — atomic at the row level, so any row a concurrent `CancelAssignmentAsync` already cancelled is skipped (and keeps its specific reason). No xmin migration needed for this specific race. The broader assignment-row-version hardening remains on the cross-cutting concurrency track alongside R3-Defer-1.
- [x] [Review][Patch] R3-M-S3-3 (Medium) `SelfSignUpForVolunteerShiftCommandHandler` throws `InvalidOperationException` mapped to 403 via string-message — add `NoMemberLink` typed outcome (BH-20). **Fixed.** New `VolunteerAssignmentOutcome.NoMemberLink` enum value. `SelfSignUpForVolunteerShiftCommandHandler` returns the typed outcome instead of throwing; the endpoint mapper translates it to 403 with the existing `{ message, errorCode: "NoMemberLink" }` body.

### Defer

- [x] [Review][Defer] R3-Defer-5 `IsStaffCaller` hardcoded role list (EC-26) [backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs:31] — latent only on new-role addition; needs role-registry refactor
- [x] [Review][Defer] R3-Defer-6 No DELETE endpoint for `EventVolunteerRole` (AA-12) — design intent: deactivate, never delete

## Round 4 Review Findings (2026-05-14)

**Scope:** Epic-3 boundary re-review (full diff `1466c35..HEAD`) after the Round-3 fix-pass. 3 parallel layers. S3-scoped result: **8 Patch (2 High + 2 Medium + 3 Low + 1 High-test-gap), 0 Decision, 3 Defer.** The Round-3 Critical IDOR set is confirmed resolved; the new High findings are independent issues the Round-3 patch sweep did not touch.

### Patches

- [x] [Review][Patch] R4-P-S3-1 (High) `EventVolunteerShift.Create` and `UpdateDetails` store `StartsAt`/`EndsAt` raw, bypassing the project-wide UTC invariant — the same diff hardened `Event.Create`/`Reschedule` with `DateTimeUtcGuard.EnsureUtc(...)`, but the new `EventVolunteerShift` aggregate was missed. Downstream `EventNotificationService.FormatShiftWindowInLocalZone` does `DateTime.SpecifyKind(shift.StartsAt, DateTimeKind.Utc)` — a relabel, not a conversion — so a `Kind=Local` value (System.Text.Json binds an offset-bearing request timestamp as Local) silently shifts the reminder-email wall-clock time by the client offset. Fix: `StartsAt = DateTimeUtcGuard.EnsureUtc(startsAt); EndsAt = DateTimeUtcGuard.EnsureUtc(endsAt);` in both methods. (BH-1 + EC-1) [backend/src/IabConnect.Domain/Events/Volunteers/EventVolunteerShift.cs]
- [x] [Review][Patch] R4-P-S3-2 (High) `GetEventVolunteerRolesQuery` / `GetEventVolunteerShiftsQuery` handlers never verify the event exists or is visible to the caller — they call `GetByEventIdAsync(request.EventId)` straight from the route with no event load. The Round-3 patch sweep added `eventId` cross-checks to `GetVolunteerShiftAssignmentsQuery` (R3-C3), `UpdateEventVolunteerRoleCommand` (R3-C2), and the cancel commands — but the sibling list queries were left open. Any authenticated `RequireEventStaffOrMember` user can enumerate volunteer roles/shifts for Hidden / InviteOnly events by guessing the event GUID. Fix: load + visibility-check the event (mirror `GetEventCheckInRosterQueryHandler`) before returning rows. (BH-12) [backend/src/IabConnect.Application/Events/Volunteers/Queries/GetEventVolunteerRolesQuery.cs], [.../GetEventVolunteerShiftsQuery.cs]
- [x] [Review][Patch] R4-P-S3-3 (High) Missing the three per-command-handler test files AC-10 explicitly requires: `AssignVolunteerCommandHandlerTests` (incl. the `[Theory]` over `(confirmedCount, capacity, allowWaitlist, allowWaitlistFallback)` with ≥8 rows), `SelfSignUpForVolunteerShiftCommandHandlerTests`, `CancelVolunteerAssignmentCommandHandlerTests`. The capacity/waitlist decision matrix is currently exercised only indirectly via `EventVolunteerAssignmentConcurrencyTests` (3 rows). (AA-S3-1) [backend/tests/IabConnect.Application.Tests/Events/Volunteers/]
- [x] [Review][Patch] R4-P-S3-4 (Medium) Missing `CreateEventVolunteerShiftCommandHandlerTests` (AC-10) — only `CreateEventVolunteerShiftCommandValidatorTests.cs` exists; validator boundaries are covered but handler behaviour (factory call, audit, DTO mapping) is not directly tested. (AA-S3-2) [backend/tests/IabConnect.Application.Tests/Events/Volunteers/]
- [x] [Review][Patch] R4-P-S3-5 (Medium) `EventVolunteerAssignmentService.CancelAssignmentAsync` C1 ownership guard fails open — `if (!callerIsStaff && callerMemberId.HasValue && callerMemberId.Value != assignment.MemberId)` passes (no rejection) when `callerMemberId` is null AND caller is not staff. The service is a reusable Application abstraction; it relies entirely on `CancelVolunteerAssignmentCommandHandler` happening to reject the null-member case first. Fix: fail closed — reject when `!callerIsStaff && (callerMemberId is null || callerMemberId != assignment.MemberId)`. (BH-5) [backend/src/IabConnect.Infrastructure/Events/Volunteers/EventVolunteerAssignmentService.cs]
- [x] [Review][Patch] R4-P-S3-6 (Low) `CancelAssignmentAsync` runs the C1 ownership check and the H-S3-2 cross-event check against an `AsNoTracking()` snapshot taken *before* `BeginTransactionAsync`; after the `FOR UPDATE` lock it re-fetches into `tracked` but only re-checks `Status`, never re-validating ownership/parent-event on the locked entity. TOCTOU window is real (exploitability limited only because `ShiftId`/`MemberId` are immutable today). Fix: re-assert the auth checks against `tracked`. (BH-4) [backend/src/IabConnect.Infrastructure/Events/Volunteers/EventVolunteerAssignmentService.cs]
- [x] [Review][Patch] R4-P-S3-7 (Low) `CancelAllAssignmentsForShiftAsync` bulk `ExecuteUpdateAsync` sets only `Status`/`CancelledAt`/`CancellationReason` — it bypasses the domain `EventVolunteerAssignment.Cancel()` which also sets `Position = null`. Cancelled waitlist rows therefore retain a stale `Position`, an invariant the per-row path guarantees never happens. No constraint breaks today (partial unique index + roster queries both exclude `Cancelled`), but any future `Position`-reading logic that does not pre-filter status will miscount. Fix: add `.SetProperty(a => a.Position, (int?)null)` to the `ExecuteUpdateAsync` call. (EC-2) [backend/src/IabConnect.Infrastructure/Events/Volunteers/EventVolunteerAssignmentService.cs]
- [x] [Review][Patch] R4-P-S3-8 (Low) FK-violation savepoint leak in `AddAtomicAsync` — the `catch` filter matches only SQLSTATE `23505` (unique-violation); a `23503` (foreign-key violation — the documented `MemberNotFound` case) escapes `AddAtomicAsync` *without* `RollbackToSavepointAsync`/`ReleaseSavepointAsync`, leaving the outer transaction aborted with a dangling savepoint. Works today only because `await using transaction` disposal rolls the whole thing back; fragile if any code is added between the catch and the dispose. Fix: roll back to / release the savepoint on the non-23505 path too. (BH-11) [backend/src/IabConnect.Infrastructure/Persistence/Repositories/EventVolunteerAssignmentRepository.cs]

### Defer

- [x] [Review][Defer] R4-Defer-S3-1 Read endpoints use `RequireEventStaffOrMember`, AC-7 text still says `RequireMember` [backend/src/IabConnect.Api/DependencyInjection.cs], [backend/src/IabConnect.Api/Endpoints/EventVolunteerEndpoints.cs] — deferred, spec reconciliation only; the new policy is the intentional Round-3 R3-DN-4 decision and is correct, only the AC-7 wording was never reconciled.
- [x] [Review][Defer] R4-Defer-S3-2 `IncreaseCapacity(int)` (per AC-1) renamed to `UpdateCapacity(int newCapacity, int currentConfirmedCount)` [backend/src/IabConnect.Domain/Events/Volunteers/EventVolunteerShift.cs] — deferred, spec reconciliation only; the rename is the intentional Round-3 H-S3-4 fix (bidirectional capacity) and is a functional superset of the AC, only the AC-1 name/signature was never updated.
- [x] [Review][Defer] R4-Defer-S3-3 `EventVolunteerAssignmentRepositoryTests` (named in AC-10, with required case `CountConfirmedAsync_ExcludesCancelled`) does not exist by that name — the constraint/FK cases were folded into `EventVolunteerAssignmentConcurrencyTests.cs` [backend/tests/IabConnect.Infrastructure.Tests/Events/] — deferred, spec reconciliation / test-naming hygiene; verify a `CountConfirmedAsync` excludes-cancelled assertion exists under the new file name when the test-gap patches (R4-P-S3-3/4) are addressed.

