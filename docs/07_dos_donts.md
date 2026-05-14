Titel
Do und Dont

Do
1) Baue zuerst Must have Features fertig, dann erweitern
2) Halte Module im Monolith klar getrennt
3) Authorisierung immer im Backend prüfen
4) Schreibe Audit Einträge bei sensiblen Aktionen
5) Nutze Migrationen, keine manuellen DB Änderungen
6) Halte Dokumentation aktuell bei jeder Änderung
7) Schreibe alle UI-Texte auf Englisch
8) Nutze i18n Keys für übersetzbare Texte (useTranslations Hook von next-intl)
9) Design Mobile-First mit Tailwind responsive Klassen
10) Verwende die Sidebar-Navigation für alle authentifizierten Seiten
11) Datumsformat immer dd/mm/yyyy verwenden (de-CH Locale): `toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })`
12) UI-Elemente basierend auf Berechtigungen ein-/ausblenden: Wenn ein User eine Aktion nicht ausführen darf (z.B. Löschen nur für Admin), dann darf diese Aktion auch nicht in der UI sichtbar sein
13) Schreibe Unit Tests für alle neuen Domain-Entities und Use Cases (xunit.v3 + FluentAssertions)
14) Schreibe Integration Tests für alle Repositories mit Testcontainers (echte PostgreSQL DB)
15) Tests müssen vor jedem Merge grün sein: `dotnet test` im Backend
16) **IMMER das Standard-Layout für alle Admin-/Feature-Seiten verwenden** (siehe Design-Standards unten)
17) **Immer Orange (#EA580C / orange-600) als Primärfarbe** für Buttons und Links, nicht Blau
18) **Enum-Werte im Frontend müssen exakt mit Backend-Enums übereinstimmen** (PascalCase)

## Design-Standards für Frontend-Seiten

### Standard Page Layout (PFLICHT für alle authentifizierten Seiten)

```tsx
// Loading State
<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
  <div className="text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
    <p className="mt-4 text-gray-600">{t("common.loading")}</p>
  </div>
</div>

// Main Layout
<main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
  <div className="max-w-7xl mx-auto">  {/* oder max-w-4xl für Formulare */}
    {/* Header */}
    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600 mt-1">{subtitle}</p>
      </div>
      {/* Primary Action Button */}
      <Link
        href="/..."
        className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
      >
        <PlusIcon /> Neu erstellen
      </Link>
    </div>
    {/* Content */}
  </div>
</main>
```

### Button-Styles (PFLICHT)

```tsx
// Primary Button (Hauptaktion)
className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"

// Secondary Button (Abbrechen etc.)
className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"

// Danger Button (Löschen)
className="text-red-600 hover:text-red-800"

// Link Style
className="text-orange-600 hover:underline"
```

### Card/Panel Style

```tsx
<div className="bg-white rounded-lg shadow p-6">
  {/* Content */}
</div>
```

### Tabellen

```tsx
<div className="bg-white rounded-lg shadow overflow-hidden">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          {header}
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {/* rows */}
    </tbody>
  </table>
</div>
```

Dont
1) Keine Microservices im MVP
2) Keine Business Logik in EF Entities
3) Keine direkten DB Queries im Controller
4) Keine Secrets in Git
5) Keine ungeschützten Admin Endpoints
6) Keine willkürlichen Dokumentations Formate ausserhalb der Templates
7) Keine hardcoded deutschen Texte in der UI
8) Keine fixed pixel Werte für responsive Layouts (nutze Tailwind Breakpoints)
9) Keine anderen Datumsformate als dd/mm/yyyy im Frontend
10) **KEINE blauen Buttons** (bg-blue-*) - immer orange-600 verwenden!
11) **KEINE abweichenden Layouts** - immer das Standard-Layout verwenden
12) **KEINE container mx-auto px-4 py-8** - immer `<main>` mit Standard-Klassen
13) **KEINE inline `api.get/post` Aufrufe in Event-Handlern** für Daten-Refresh nach Mutationen. Stattdessen: `refreshKey` State-Variable + `useEffect` mit `cancelled`-Flag für den Datenabruf. Handler machen nur die Mutation und setzen `setRefreshKey(k => k + 1)`. Inline-Fetches in onClick/onSubmit-Handlern führen zu permanentem Loading wegen Closure- und Race-Condition-Problemen.
14) **KEINE private Backing-Field Manipulationen für EF-tracked Collections** zum Speichern neuer Child-Entities. Statt `aggregate.AddChild()` + `dbContext.SaveChangesAsync()` → immer `dbContext.Set<ChildEntity>().Add(child)` direkt nutzen, da EF Core Change-Tracking über private Backing-Fields bei Aggregate-Patterns zu `DbUpdateConcurrencyException` führen kann.

## Symmetric-Guard Checklist (Epic-1-Retro Action A2)

When introducing a normalization or a guard (case-folding, trimming, diacritic-folding, null/empty check, role check, etc.) in **any** matching or validation method of a service or repository, **audit every sibling method in the same class for the same guard** before merging. Guards must be symmetric across reads, writes, existence checks, and lookups — a guard applied only to one method leaves the others vulnerable to the case it was meant to defend against.

Concrete examples in this repo:

- `MemberRepository.EmailExistsAsync` and `GetByEmailAsync` currently use exact-equality on `Email`. If E2.S2 introduces case-insensitive email normalization in `CreateMemberCommandHandler`, both repository methods must be updated in the same change so the existence check and the lookup stay aligned with the create path.
- `IDuplicateMatcher.NormalizeEmail` folds case + trims; any future inline email comparison (validators, command handlers, search predicates) must use the same helper rather than re-implementing `.ToLowerInvariant()` locally.
- `IDuplicateMatcher.FoldName` strips diacritics ("Müller" → "Muller"); if a future feature compares names server-side, it must use the same folding so "Müller" and "Mueller" stay matchable.

When in doubt, grep the class for the field name (e.g. `Email`, `FirstName`, `Phone`) and confirm every comparison uses the same normalization helper. Record the audit in the story's Completion Notes.

- **Migration discipline when introducing a normalized variant.** When a `GetByXNormalizedAsync` / `XExistsNormalizedAsync` pair lands alongside a raw `GetByXAsync` / `XExistsAsync` pair, **every caller of the raw methods in `backend/src/` must be migrated to the normalized variant in the same change**. The legacy methods may stay registered for one further story (deprecation window) only if a follow-up story is already planned to remove them. Document each migrated callsite in the story's Debug Log so the next reviewer can confirm completeness. Tests that intentionally exercise the legacy methods are exempt and stay until the legacy methods themselves are removed.

- **Soft-retire flag discipline.** When introducing a soft-retire flag (e.g., `Member.MergedIntoMemberId`, future `IsArchived`-like fields), **every read query whose semantics rely on "active records only" must filter the flag**. This is asymmetric exposure: a forensics-friendly `GetByIdAsync` should still return the retired row, but a duplicate-detection or autocomplete query MUST exclude it — otherwise the retired record reappears in user-facing surfaces and creates "ghost" matches. Audit every read on the aggregate when adding the flag; the test plan must include at least one negative-path test asserting the flag-filtered queries don't return retired rows. Document the audit in the story's Completion Notes.

## Concurrency Checklist (Epic-2-Retro Action A6)

When introducing **any** new transactional operation that mutates more than one row — merges, batch reassignments, capacity-bounded inserts, idempotent dismissals, anything moving references across aggregates — audit the code path for these four windows. Concurrent admin actions (or admin-vs-user races) WILL hit them in production; absence in tests is not evidence of absence in reality.

1. **Transaction-first, then read.** Open the transaction (`_context.Database.BeginTransactionAsync`) **before** the blocker / pre-condition reads. If the blocker checks run before `BeginTransaction`, a concurrent writer can slip a row in between the check and the rewrite. For high-contention rows, take a row-level lock immediately after `BeginTransaction`:

   ```csharp
   await using var transaction = await _context.Database.BeginTransactionAsync(ct);
   _ = await _context.Members
       .FromSqlInterpolated($"SELECT * FROM members WHERE id = {sourceId} FOR UPDATE")
       .AsTracking()
       .ToListAsync(ct);
   // … blocker reads + rewrites now run under the row lock
   ```

   Real example: `MemberMergeService.MergeAsync` (REQ-018 E2.S3) takes `FOR UPDATE` on the source `Member` row so a concurrent admin can't insert a draft invoice between the blocker count and the `ExecuteUpdate` rewrite.

2. **Pre-dedupe every aggregate moved within the transaction.** When rewriting `MemberId` / `ClaimantId` / `RecipientId` / `EventId` references from source to target via `ExecuteUpdate`, **every table touched in the transaction must be audited for `(target_id, key)` collisions** — not just the one with a documented unique constraint. If a unique index will fire mid-transaction (`(CampaignId, MemberId)`, `(EventId, MemberId)`, `(SegmentId, MemberId)`, …), pre-delete the offending source rows via `ExecuteDelete` first, capture the count in the audit dictionary, and proceed. Symmetric guards across tables — fixing only `MemberSegmentAssignment` while ignoring `EmailRecipient` is the same bug class as fixing only `EmailExistsAsync` while ignoring `GetByEmailAsync`. Real example: `MemberMergeService` pre-dedupes `MemberSegmentAssignment` + `EmailRecipient` + `EventRegistration` in one transaction before any `ExecuteUpdate` fires.

3. **Save between in-place mutations that hit a unique partial index.** EF Core orders `UPDATE` statements arbitrarily on `SaveChanges`. If two entities are mutated such that an intermediate state would violate a unique partial index (classic case: a single `KeycloakUserId` unique index where `keycloak_user_id IS NOT NULL`, when transferring the link from source to target), capture the value, clear the source, **`SaveChangesAsync`**, then set the target, **`SaveChangesAsync`** again. Both saves remain inside the same transaction. Don't rely on EF picking the safe order. Real example: `MemberMergeService` transfer branch — `source.ClearKeycloakLink(); SaveChanges(); target.LinkToKeycloak(captured); SaveChanges();`.

4. **Catch-and-recover on unique-index violations for idempotent inserts.** "Read-null then insert" is a TOCTOU window. Two concurrent admins both see `GetByCanonicalPairAsync == null`, both `Add`, the second hits the unique index and surfaces a 500. For idempotent operations (dismissals, canonical-pair flags, "I've already done this" markers), catch `DbUpdateException` at the Infrastructure layer and re-fetch the winning row — return `(existing, created: false)`. Keep the `DbUpdateException` import out of the Application layer; expose it via a repository method like `AddAtomicAsync` returning `(entity, created)`. Real example: `IDuplicateCandidateDismissalRepository.AddAtomicAsync` (REQ-018 E2.S4).

When in doubt, the test that proves a concurrency fix works is a **two-task xUnit integration test** that races two `Task`s against a real `postgres:18` Testcontainer — not a unit test with a mock.

## Pattern Chars in User Input (Epic-2-Retro Action A7)

When matching user-supplied text against a database column via `LIKE` / `ILIKE` / regex / `~`, **escape the pattern metacharacters of the matching engine** before composing the pattern. Failure to escape means the user can:

- Cause false-positive matches (`john_doe@example.com` matches `johnXdoe@example.com` because `_` is a single-char wildcard).
- Use the endpoint as an existence-enumeration oracle (probe email patterns until 409 fires).
- Block legitimate writes when the engine throws on malformed escape sequences.

For PostgreSQL `EF.Functions.ILike` / `LIKE`, the wildcards are `%`, `_`, and `\` (when `ESCAPE '\'` is configured). The three-argument `ILike(column, pattern, escapeChar)` overload supports an explicit escape character; combine it with an input-escape helper:

```csharp
private const string LikeEscapeChar = "\\";

private static string EscapeLikePattern(string value)
{
    // Order matters: escape the escape char first, then the wildcards.
    return value
        .Replace("\\", "\\\\")
        .Replace("%", "\\%")
        .Replace("_", "\\_");
}

// Usage
var pattern = EscapeLikePattern(normalizedInput);
return await _context.Members
    .AnyAsync(m => EF.Functions.ILike(m.Email, pattern, LikeEscapeChar), ct);
```

Real example: `MemberRepository.BuildNormalizedEmailPatterns` (REQ-018 review patch P1).

For regex matchers (PostgreSQL `~`, C# `Regex`), escape via `Regex.Escape(input)` before composing the pattern. For `JSONPath` / `JMESPath` / future query DSLs, use the engine's parameterised-input API rather than string-concatenation.

**Adversarial test data discipline (Action A8).** Every matcher / search / normalisation test suite MUST include at least one `[InlineData]` row exercising:

- LIKE wildcards in the input (`a_b@x.com`, `a%b@x.com`, `a\b@x.com`).
- Leading / trailing whitespace.
- Mixed-case domain (`User@Example.Com`).
- Unicode normalisation forms (NFC vs NFD: precomposed `ä` vs decomposed `ä`).
- Control characters where the column allows them.

A test suite that only covers the friendly normalisations (diacritics, case-folding, `+tag` aliases) is not enough to prove the matcher is safe. The LIKE-wildcard injection in `BuildNormalizedEmailPatterns` survived 17 repository tests + the full `DuplicateMatcherTests` suite because no row contained `_` or `%`.

## Event-Scoping / IDOR Enforcement Checklist (Epic-3-Retro Action A12)

Cross-event IDOR was the dominant defect class of Epic 3 — it took **four review rounds** to fully close on the volunteer surface (E3.S3: C1 authorization bypass → R3-C2/C3 cross-event IDOR → R4-P-S3-2 list-query IDOR → R4-P-S3-5 fail-open guard). The root cause every time: a command or query carried a child-entity ID but not its parent `EventId`, so the handler never verified the child actually belonged to the event in the route. Patching sibling handlers one finding at a time never abstracted the pattern, so each round re-discovered it on a different endpoint.

**The rule — no exceptions, no "the sibling handler already does it":**

When a command or query carries a **child-entity ID** scoped to a parent (e.g. `roleId`, `shiftId`, `assignmentId`, `registrationId`, `feeId`, anything under an `event/{eventId}/...` route), it **MUST also carry the parent `EventId`**, and the handler **MUST enforce `child.EventId == request.EventId`** before reading or mutating the child.

1. **Carry the parent ID end-to-end.** The route already has `{eventId}` — propagate it into the command/query record, do not drop it. A command shaped `UpdateXCommand(Guid XId, ...)` with no `EventId` is the smell; it should be `UpdateXCommand(Guid EventId, Guid XId, ...)`.
2. **Enforce in the handler, not the endpoint.** Load the child, compare `child.EventId == request.EventId`. Endpoint-only checks are bypassed by internal MediatR callers.
3. **Return opaque `NotFound` on mismatch** — never a distinct "wrong event" vs "does not exist" response. Distinguishable errors turn the endpoint into a cross-event enumeration oracle. (A `LogAccessDenied` audit row on mismatch is still required — log internally, stay opaque externally.)
4. **List/collection queries are in scope too.** A `GET .../{shiftId}/assignments` that filters by `shiftId` only — ignoring the route `eventId` — lets any caller enumerate rosters across every event. The handler must first verify the parent (`shift.EventId == request.EventId` **and** the event is visible to the caller) before returning the collection. R4-P-S3-2 was exactly this: list queries that skipped event existence/visibility and enumerated Hidden/InviteOnly events.
5. **No fail-open guards.** An ownership check that passes when `callerMemberId == null` (R4-P-S3-5) is worse than no check — it looks safe in review. Null/absent caller identity must fail **closed**.
6. **Audit the whole endpoint group when you touch one.** When adding or fixing event-scoping on any handler, grep the endpoint group for every sibling command/query carrying a child ID and confirm each one carries + enforces `EventId`. This is the same symmetric-guard discipline as A2 — fixing only `UpdateEventVolunteerShiftCommand` while leaving `UpdateEventVolunteerRoleCommand` unguarded is the bug. Record the audit in the story's Completion Notes.

When in doubt, the test that proves event-scoping works is an **API/integration test that issues a cross-event request** — `PUT /events/{eventA}/volunteer-roles/{roleId-belonging-to-eventB}` — and asserts `404` plus a `LogAccessDenied` audit row. Every story that adds an event-scoped child endpoint must include at least one such cross-event negative test.

## DateTime.Kind=Utc Construction Guard (Epic-3-Retro Action A13)

`DateTime.Kind` mishandling was a recurring Epic-3 defect family — H-S1-2 (CSV `CheckedInAt`), H-S5-2 (ICS `DTSTART`/`DTEND`), part of S4-C3 (reminder times), R4-P-S3-1 (`EventVolunteerShift` times). Root cause every time: a domain field stored a `DateTime` with `Kind=Unspecified` or `Kind=Local`, and a downstream exporter called `.ToUniversalTime()` — which silently shifts the wall-clock for `Unspecified` and double-shifts for `Local`.

**The rule:** every domain aggregate constructor / factory / mutator that **accepts an inbound `DateTime` (or `DateTime?`) parameter** MUST normalise it through `DateTimeUtcGuard.EnsureUtc(...)` (`IabConnect.Domain.Common`) before assigning it to a property. Timestamps the aggregate sets itself from `DateTime.UtcNow` are already UTC and need no guard — the guard is specifically for **values that crossed the domain boundary from a caller**.

```csharp
// Factory / mutator accepting caller-supplied DateTime:
public static EventVolunteerShift Create(..., DateTime startsAt, DateTime endsAt, ...)
{
    startsAt = DateTimeUtcGuard.EnsureUtc(startsAt);   // ✅ guard at the boundary
    endsAt = DateTimeUtcGuard.EnsureUtc(endsAt);
    if (endsAt <= startsAt) throw new ArgumentException(...);
    // ... assign the already-normalised values
}
```

Established call sites to mirror: `Event.Create` / `Event.UpdateSchedule` / `Event.UpdateRegistrationSettings`, `EventVolunteerShift.Create` / `UpdateDetails`, `EventVolunteerAssignment.MarkReminderSent`. Do **not** re-implement with a bare `DateTime.SpecifyKind(...)` — the older Finance-module pattern (`Payment`, `Transaction`) only handles `Unspecified` and mishandles `Local`; `DateTimeUtcGuard.EnsureUtc` handles all three `Kind` cases. New E4 fee/finance entities that carry caller-supplied dates must adopt the guard.
