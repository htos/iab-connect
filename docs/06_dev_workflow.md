Titel
Development Workflow

Repo Struktur
frontend
Next.js App

backend
ASP.NET Core WebApi, Application, Domain, Infrastructure

docs
Dokumentation

infra
docker compose, scripts, deployment files

Branching

1. main ist stabil
2. feature branches pro Ã„nderung
3. Merge via Pull Request

PR Regeln

1. Mindestens eine Review
2. Build und Tests mÃ¼ssen grÃ¼n sein
3. Keine Secrets im Code
4. Kurze Beschreibung und Bezug zu Requirement ID falls vorhanden

Code Style

1. EditorConfig im Repo
2. C# analyzers aktiv
3. Frontend lint und format via ESLint und Prettier

DB Migration Workflow

1. EF Core Migrationen nur Ã¼ber definierte Commands
2. Jede Migration hat sprechenden Namen
3. Migrations laufen in Staging vor Produktion

Lokales Setup Schritte

1. docker compose up fÃ¼r postgres, keycloak, rustfs
2. Backend starten und DB Migration ausfÃ¼hren
3. Frontend starten mit Environment Variablen fÃ¼r API Base URL
4. Login Ã¼ber Keycloak testen

**WICHTIG: Backend und Frontend mÃ¼ssen in separaten Terminals gestartet werden!**

- Terminal 1: `cd backend/src/IabConnect.Api && dotnet run`
- Terminal 2: `cd frontend && npm run dev`
- Niemals beide in einem Terminal starten, da das Starten des einen den anderen Prozess beendet.

VS Code Setup

1. Launch Configs fÃ¼r Backend und Frontend
2. Tasks fÃ¼r build, test, migrations

---

## Tests

### Automatisierte Tests (Backend)

```bash
cd backend
dotnet test          # alle Tests
dotnet test --filter "FullyQualifiedName~Finance"   # nur Finance-Tests
```

### Manuelle / E2E Tests

Manuelle TestfÃ¤lle sind in `docs/TestCases/` dokumentiert, gruppiert nach Modul:

- Auth, Mitglieder, Events, Kommunikation, Finanzen, Dokumente, Audit/DSGVO
- GesamtÃ¼bersicht: `docs/TestCases/Gesamtuebersicht.md`
