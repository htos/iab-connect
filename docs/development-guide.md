# IAB Connect - Development Guide

Date: 2026-05-12

## Prerequisites

- Docker Desktop
- .NET SDK 10
- Node.js 22 or newer
- npm
- Git

## Repository Root

Use the actual repository root:

```powershell
cd "B:\Projects\IAB Connect\iab-connect"
```

The parent folder is not the Git repository.

## Start Infrastructure

```powershell
docker compose -f infra/docker-compose.yml up -d
docker compose -f infra/docker-compose.yml ps
```

Local services:

- App frontend: `http://localhost:3000`
- Backend API: `http://localhost:5000`
- Keycloak: `http://localhost:8080`
- PostgreSQL: `localhost:5433`
- RustFS: `http://localhost:9000` and console `http://localhost:9001`
- MailHog: `http://localhost:8025`
- Seq: `http://localhost:8081`

## Backend Development

Run backend:

```powershell
cd backend\src\IabConnect.Api
dotnet run
```

Run backend tests:

```powershell
cd backend
dotnet test
```

Create migration:

```powershell
cd backend
dotnet ef migrations add MigrationName --project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api
```

Apply migrations:

```powershell
cd backend
dotnet ef database update --project src/IabConnect.Infrastructure --startup-project src/IabConnect.Api
```

## Frontend Development

Install dependencies:

```powershell
cd frontend
npm install
```

Run frontend:

```powershell
cd frontend
npm run dev
```

Quality checks:

```powershell
cd frontend
npm run typecheck
npm run lint
npm run format:check
npm test
```

E2E:

```powershell
cd frontend
npm run e2e
```

## Terminal Model

Backend and frontend must run in separate terminals:

- Terminal 1: `backend/src/IabConnect.Api`, `dotnet run`
- Terminal 2: `frontend`, `npm run dev`

Infrastructure runs separately through Docker Compose.

## Development Rules

- Keep backend module boundaries clear.
- Use MediatR/FluentValidation for non-trivial application workflows.
- Use backend policies/permissions for security.
- Keep frontend UI text in next-intl translation files.
- Use standard authenticated page layout and orange primary styling.
- Update docs when behavior or requirements change.
- Do not edit requirements CSV unless explicitly requested.

## Testing Expectations

- New domain entities, value objects, validators, handlers, and services need application/domain tests.
- Repository behavior needs Infrastructure tests and Testcontainers PostgreSQL when relational behavior matters.
- Shared frontend UI, forms, auth-dependent rendering, and critical workflows should get Vitest/Testing Library or Playwright coverage.

## Troubleshooting

See `docs/STARTUP_TROUBLESHOOTING.md` for local startup issues. Common areas:

- PostgreSQL port conflicts
- Keycloak realm import
- Docker service health
- DB migrations
- Frontend environment variables

---

Generated using BMAD Method `document-project` workflow.

