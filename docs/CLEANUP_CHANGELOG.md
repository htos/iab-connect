# Project Cleanup Changelog

> **Datum**: 2026-03-01  
> **Scope**: Gesamte Codebasis — Backend, Frontend, Tests, Infra, Docs

---

## 1. Backend

### 1.1 GetUserName / GetUserId Konsolidierung

- **Neu**: `IabConnect.Api/Extensions/HttpContextExtensions.cs` — zentrale Extension-Methoden für `HttpContext.GetUserName()` und `HttpContext.GetUserId()`
- **Entfernt**: Duplizierte `private static string GetUserName(HttpContext ctx)` Methoden aus **16 Endpoint-Dateien**
- **Betroffen**: AccountEndpoints, ArchiveEndpoints, BankImportEndpoints, CategoryEndpoints, DunningEndpoints, EmailCampaignEndpoints, ExpenseClaimEndpoints, FiscalPeriodEndpoints, InvoiceEndpoints, PaymentEndpoints, ReceiptEndpoints, TransactionEndpoints, LedgerAccountEndpoints, JournalEntryEndpoints, PostingMappingEndpoints, FinanceProfileEndpoints, SettingsEndpoints, CustomRoleEndpoints
- **Einheitliche Fallback-Kette**: `preferred_username` → `name` → `email` → `ClaimTypes.Email` → `"system"`

### 1.2 Tote / Stub-Endpoints entfernt

- **Entfernt aus `EndpointMapper.cs`** (~80 Zeilen):
  - `MapCommunicationEndpoints()` — 2 TODO-Stubs
  - `MapFinanceEndpoints()` — leer (Endpoints längst in eigene Dateien migriert)
  - `MapReportingEndpoints()` — 3 TODO-Stubs

### 1.3 Ungenutzte NuGet-Packages

- **Entfernt aus `Directory.Packages.props`**: `AspNetCore.HealthChecks.Redis 8.0.1` (kein Redis im Projekt)
- **Entfernt aus `IabConnect.Api.Tests.csproj`**: Moq, Testcontainers, Testcontainers.PostgreSql (nur `HealthEndpointTests.cs` vorhanden, verwendet keines davon)

---

## 2. Frontend

### 2.1 Tote Komponenten entfernt

| Datei / Verzeichnis | Zeilen | Grund |
|---|---|---|
| `components/navigation/MainNavigation.tsx` | ~415 | Alte Top-Bar-Navigation, nirgends importiert |
| `lib/auth/auth-context.tsx` | ~80 | Toter Auth-Context (AuthProvider/useAuth), nie verwendet |
| `components/providers/AuthProvider.tsx` | ~40 | Wrapper für toten Auth-Context |
| `components/providers/LoginTracker.tsx` | ~30 | Nur von totem AuthProvider importiert |
| `components/events/` (6 Dateien) | ~500 | EventCheckIn, EventParticipantsList, EventRegistration, EventTicket, MyRegistrations — nie von einer Page importiert |
| `components/ui/index.ts` | ~15 | Barrel-Export, nirgends importiert |

### 2.2 Toter Nav-Eintrag

- **Entfernt**: `/reports` Eintrag aus `Sidebar.tsx` (~18 Zeilen inkl. SVG-Icon) — keine `/reports` Route vorhanden

### 2.3 PagedResult-Typ konsolidiert

- **Neu**: `src/types/common.ts` — kanonische `PagedResult<T>` Definition
- **Aktualisiert**: 5 Dateien re-exportieren nun aus `@/types/common`:
  - `types/finance.ts`, `lib/services/api.ts`, `lib/services/events.ts`, `lib/api/members.ts`, `lib/api/email-campaigns.ts`

### 2.4 Format-Utils vereinheitlicht

- **Neu**: `formatCHF` Alias in `src/lib/utils.ts`
- **Aktualisiert**: 11 Finance-Pages importieren nun `formatCHF` / `formatCurrency` aus `@/lib/utils` statt lokaler Definitionen:
  - dunning, transactions, finance (dashboard), payments, invoices, invoices/new, bank-import, invoices/[id], accounts, journal-entries, accounting-reports

---

## 3. Tests

### 3.1 Doppelte Test-Fixtures entfernt

- **Gelöscht**: `tests/IabConnect.Application.Tests/Finance/Fixtures/` (sample_camt053.xml und sample_camt054.xml) — byte-identisch mit `Infrastructure.Tests/` Versionen, dort bereits als `EmbeddedResource` referenziert

### 3.2 EmailTemplateTests → FluentAssertions

- **Konvertiert**: `EmailTemplateTests.cs` von xUnit `Assert.*` (14 Aufrufe) zu FluentAssertions `.Should().*`
- **Hinzugefügt**: Fehlende `using Xunit;` Direktive

### 3.3 Ungenutzte Package-Referenzen

- Moq, Testcontainers, Testcontainers.PostgreSql aus `Api.Tests.csproj` entfernt (s. Backend 1.3)

---

## 4. Keycloak

### 4.1 Fehlende Rollen + Testbenutzer (KRITISCH)

- **3 neue Rollen** im Realm hinzugefügt:
  - `kassier` — Kassier/Treasurer, Finanzverantwortung
  - `auditor` — Revisor, Finanzeinsicht (read-only)
  - `event-manager` — Event-Manager, Eventverantwortung
- **3 neue Gruppen**: Kassier (kassier+member), Revisoren (auditor+member), Event-Manager (event-manager+member)
- **3 neue Testbenutzer**:
  - `kassier@iabconnect.ch` / `Kassier-Dev-2026!`
  - `auditor@iabconnect.ch` / `Auditor-Dev-2026!`
  - `events@iabconnect.ch` / `Events-Dev-2026!`

---

## 5. Infrastruktur

### 5.1 Docker Compose v2 CLI

- **Aktualisiert**: `start-all.bat` — `docker-compose` → `docker compose`
- **Aktualisiert**: `README.md` — alle `docker-compose` Befehle → `docker compose`

### 5.2 .gitignore bereinigt

- **Entfernt**: ~50 irrelevante Einträge (Gatsby, Vue, Svelte, Nuxt, Docusaurus, FuseBox, DynamoDB, Firebase, jspm, Snowpack, Bower, etc.)
- **Hinzugefügt**: OS-Dateien (Thumbs.db, .DS_Store), IDE-Verzeichnisse (.vs/, .idea/), Maven target/, Docker override, TestResults/

---

## 6. Dokumentation

### 6.1 Versionskorrekturen (`12_stack_versions.md`)

| Eintrag | Vorher | Nachher (korrekt) |
|---|---|---|
| Swashbuckle.AspNetCore | 10.1.0 | 6.9.0 |
| next-auth | 5.x | 4.x |
| PostgreSQL | 18.1 | 17 |

### 6.2 README.md

- **MailHog URL**: `localhost:1080` → `localhost:8025`
- **Node.js Prerequisite**: `20+` → `22+` (package.json verlangt `>=22.0.0`)
- **Zustand entfernt** aus Tech-Stack-Tabelle (nicht installiert)
- **TipTap Version**: `2.x` → `3.x`
- **Rollen-Tabelle**: kassier, auditor, event-manager hinzugefügt
- **RBAC Feature**: Rollenliste aktualisiert
- **Docker CLI**: alle `docker-compose` → `docker compose`

### 6.3 Architektur (`02_architecture.md`)

- "Hangfire oder Quartz" → "Hangfire" (Quartz wird nicht verwendet)
- "RustFS oder File Storage" → "RustFS" (Entscheidung steht fest)
- **Sponsors and Vendors Modul entfernt** (nicht implementiert, keine Endpoints)

### 6.4 API Contracts (`03_api_contracts.md`)

- **Sponsors/Vendors Endpoints entfernt** (GET/POST /api/sponsors, GET/POST /api/vendors) — nicht implementiert

### 6.5 Decisions Log (`09_decisions_log.md`)

- "59 Requirements" → "85 Requirements inkl. Finance Addon"

### 6.6 Dev Workflow (`06_dev_workflow.md`)

- **~500 Zeilen stale manuelle Testfälle entfernt** — bereits in `docs/TestCases/` dokumentiert
- **Neuer Abschnitt**: Verweis auf `docs/TestCases/` und `dotnet test` Befehle

### 6.7 Redundante Dateien

- **Gelöscht**: `docs/requirements_workflow.md` — Duplikat von `docs/11_requirements_workflow.md`

---

## Verifikation

- **Backend Build**: 0 Fehler, 0 Warnungen
- **Backend Tests**: 1.124 Tests bestanden (915 Application + 208 Infrastructure + 1 Api)
- **Frontend TypeScript**: 0 Fehler (`tsc --noEmit`)
