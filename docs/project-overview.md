# IAB Connect - Project Overview

Date: 2026-05-12
Type: Multi-part full-stack Brownfield web application
Architecture: Modular monolith backend with Next.js frontend and Docker Compose infrastructure

## Executive Summary

IAB Connect is a member management, event, communication, finance, document, public website, and operations platform for the Indian Association Bern. The system is already beyond a simple MVP: it contains a broad ASP.NET Core backend, a role-aware Next.js frontend, Keycloak-based identity, PostgreSQL persistence, S3-compatible document storage via RustFS, Hangfire background jobs, and extensive project documentation.

The codebase is a practical Brownfield candidate for BMAD because it has clear module boundaries, extensive requirements documentation, and many implemented features, but also visible drift between documentation, frontend implementation conventions, and some older code patterns.

This rescan classified 973 repository files after excluding common build/dependency folders. The current implementation surface includes 44 backend endpoint modules, roughly 315 Minimal API route operations, 42 EF Core entity configurations, 32 first-class EF migrations, 14 frontend App Router route groups, and 16 shared UI primitives.

## Project Classification

- Repository type: Multi-part repository
- Backend part: `backend/`, project type `backend`
- Frontend part: `frontend/`, project type `web`
- Infrastructure part: `infra/`, project type `infra`
- Primary languages: C#, TypeScript, TSX, YAML
- Architecture pattern: Modular monolith plus client application

## Multi-Part Structure

### Backend API

- Location: `backend/`
- Purpose: HTTP API, application use cases, domain model, persistence, background jobs, integration services
- Stack: .NET 10, ASP.NET Core Minimal APIs, EF Core, PostgreSQL, MediatR, FluentValidation, Hangfire, Serilog
- Entry point: `backend/src/IabConnect.Api/Program.cs`

### Frontend Web App

- Location: `frontend/`
- Purpose: Authenticated admin/member UI plus public pages
- Stack: Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, next-auth, next-intl, TanStack Query, Radix UI
- Entry point: `frontend/src/app/layout.tsx`

### Infrastructure

- Location: `infra/`
- Purpose: Local development infrastructure and identity realm import
- Stack: Docker Compose, PostgreSQL 17, Keycloak 26.5.2, RustFS, MailHog, Seq
- Entry point: `infra/docker-compose.yml`

## Technology Stack Summary

| Area | Technology | Version / Notes |
| --- | --- | --- |
| Backend runtime | .NET SDK | 10.0.102 via `backend/global.json` |
| Backend API | ASP.NET Core | net10.0, Minimal APIs |
| Backend ORM | Entity Framework Core | 10.0.2 |
| Database | PostgreSQL | 17 in Docker Compose |
| Auth | Keycloak/OIDC | Keycloak 26.5.2 |
| Background jobs | Hangfire | 1.8.22 with PostgreSQL storage |
| Logging | Serilog | Console, File, Seq sinks |
| Frontend runtime | Node.js | `>=22.0.0` in `frontend/package.json` |
| Frontend framework | Next.js | 16.1.6 App Router with Turbopack |
| UI runtime | React | 19.2.4 |
| Styling | Tailwind CSS | 4.1.18 |
| i18n | next-intl | 4.8.1 |
| Auth client | next-auth | 4.24.13 |
| Object storage | RustFS | S3-compatible local service |

## Key Features

- Member management, self-service profile, segmentation, registration workflows
- Role-based administration with Keycloak identity and custom role concepts
- Event management, event registration, waitlists, check-in related flows
- Email templates, email campaigns, newsletter subscription/unsubscribe
- Document folders, versions, tags, permissions, S3-backed storage
- Finance module with accounts, categories, transactions, invoices, payments, dunning, receipts, fiscal periods, tax codes, expense claims
- Double-entry accounting extension with ledger accounts, journal entries, posting mappings, and accounting reports
- Sponsors, suppliers, public blog, public contact form, public events and sponsors pages
- Audit logging, privacy consent/deletion requests, data export, retention policies
- Global search, backups/restore, health checks, startup troubleshooting

## Architecture Highlights

- Backend is a modular monolith, not microservices. Modules are represented by folders and namespaces, not separately deployed services.
- API layer uses Minimal API endpoint mapping classes. Current route modules cover identity, users, members, events, communication, documents, finance, accounting, sponsors, suppliers, public content, audit, privacy, search, backup, and retention.
- Infrastructure contains EF Core persistence, repository implementations, Keycloak admin integration, email, document storage, finance export/generation services, search, backup, and retention services.
- Frontend has one global authenticated layout with Header/Sidebar, separate full-page layouts for `/login`, `/auth/*`, and `/public/*`, and route-heavy feature UI under 14 App Router route groups.
- Authorization is enforced in both backend policies and frontend visibility logic; backend remains the security boundary.
- Documentation is already substantial and should be treated as source material, but executable project files should win when exact versions disagree.

## Development Overview

### Prerequisites

- Docker Desktop
- .NET SDK 10
- Node.js 22 or newer
- npm
- Git

### Getting Started

1. Start local infrastructure from the repository root.
2. Run the backend from `backend/src/IabConnect.Api`.
3. Run the frontend from `frontend`.
4. Use Keycloak and seeded development data for local login.

### Key Commands

Backend:

```powershell
cd backend
dotnet test
cd src/IabConnect.Api
dotnet run
```

Frontend:

```powershell
cd frontend
npm run dev
npm run typecheck
npm run lint
```

Infrastructure:

```powershell
docker compose -f infra/docker-compose.yml up -d
```

## Repository Structure

The repository has three main implementation folders:

- `backend/`: .NET solution with source and tests
- `frontend/`: Next.js app, components, messages, client services, types
- `infra/`: local infrastructure, Keycloak realm and provider wiring

Existing documentation lives under `docs/`. BMAD-generated documentation is added alongside existing docs and should not overwrite the numbered project docs unless explicitly requested.

## Documentation Map

- [index.md](./index.md) - Master documentation index
- [source-tree-analysis.md](./source-tree-analysis.md) - Annotated directory structure
- [architecture-backend.md](./architecture-backend.md) - Backend architecture
- [architecture-frontend.md](./architecture-frontend.md) - Frontend architecture
- [architecture-infra.md](./architecture-infra.md) - Infrastructure architecture
- [integration-architecture.md](./integration-architecture.md) - Cross-part integration
- [api-contracts-backend.md](./api-contracts-backend.md) - API surface overview
- [data-models-backend.md](./data-models-backend.md) - Data model overview
- [component-inventory-frontend.md](./component-inventory-frontend.md) - Frontend component inventory
- [development-guide.md](./development-guide.md) - Development workflow
- [deployment-guide.md](./deployment-guide.md) - Deployment and operations notes

---

Generated using BMAD Method `document-project` workflow.

