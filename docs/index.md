# IAB Connect Documentation Index

Type: Multi-part full-stack Brownfield application
Primary Languages: C#, TypeScript
Architecture: Modular monolith backend, Next.js frontend, Docker Compose infrastructure
Last Updated: 2026-05-12

## Project Overview

IAB Connect is a web application for the Indian Association Bern. It combines member management, events, communication, documents, finance/accounting, public website features, privacy/audit/retention, search, backups, and administration.

Latest rescan summary: 3 project parts, 973 repository files after common exclusions, 44 backend endpoint modules, roughly 315 mapped backend route operations, 42 EF Core configuration files, 32 first-class EF migrations, 14 frontend route groups, and 16 shared UI primitives.

## Project Structure

This project consists of three documented parts.

### Backend API (`backend`)

- Type: Backend
- Location: `backend/`
- Tech Stack: .NET 10, ASP.NET Core, EF Core, PostgreSQL, MediatR, FluentValidation, Hangfire, Serilog
- Entry Point: `backend/src/IabConnect.Api/Program.cs`

### Frontend Web App (`frontend`)

- Type: Web
- Location: `frontend/`
- Tech Stack: Next.js 16, React 19, TypeScript, Tailwind CSS, next-auth, next-intl, TanStack Query
- Entry Point: `frontend/src/app/layout.tsx`

### Infrastructure (`infra`)

- Type: Infrastructure
- Location: `infra/`
- Tech Stack: Docker Compose, PostgreSQL 17, Keycloak 26.5.2, RustFS, MailHog, Seq
- Entry Point: `infra/docker-compose.yml`

## Cross-Part Integration

Frontend calls the backend over HTTP/JSON using `NEXT_PUBLIC_API_URL`. Authentication is handled through NextAuth/Keycloak, while the backend validates JWT bearer tokens and maps Keycloak roles. Backend data is persisted in PostgreSQL through EF Core, document content is stored in RustFS through S3-compatible APIs, and background jobs run through Hangfire with PostgreSQL storage.

## Quick Reference

### Backend

- Stack: .NET 10, ASP.NET Core, EF Core, PostgreSQL, MediatR, Hangfire
- Entry: `backend/src/IabConnect.Api/Program.cs`
- Pattern: Modular monolith with Api/Application/Domain/Infrastructure boundaries
- Test command: `cd backend; dotnet test`

### Frontend

- Stack: Next.js 16, React 19, TypeScript, Tailwind CSS
- Entry: `frontend/src/app/layout.tsx`
- Pattern: App Router with authenticated shell and separate public layout
- Dev command: `cd frontend; npm run dev`

### Infrastructure

- Stack: Docker Compose, PostgreSQL, Keycloak, RustFS, MailHog, Seq
- Entry: `infra/docker-compose.yml`
- Start command: `docker compose -f infra/docker-compose.yml up -d`

## Generated Documentation

### Core Documentation

- [Project Overview](./project-overview.md) - Executive summary and high-level architecture
- [Source Tree Analysis](./source-tree-analysis.md) - Annotated directory structure
- [Project Parts Metadata](./project-parts.json) - Machine-readable multi-part structure

### Part-Specific Documentation

#### Backend API

- [Backend Architecture](./architecture-backend.md) - Technical backend architecture
- [API Contracts](./api-contracts-backend.md) - Backend API surface overview
- [Data Models](./data-models-backend.md) - EF Core/domain data model overview

#### Frontend Web App

- [Frontend Architecture](./architecture-frontend.md) - Technical frontend architecture
- [Frontend Component Inventory](./component-inventory-frontend.md) - Reusable component catalog

#### Infrastructure

- [Infrastructure Architecture](./architecture-infra.md) - Docker/local infrastructure architecture
- [Deployment Guide](./deployment-guide.md) - Deployment and operations notes

### Integration

- [Integration Architecture](./integration-architecture.md) - How parts communicate

### Development

- [Development Guide](./development-guide.md) - Local setup and development workflow

## Existing Documentation

- [Agent Context](./00_agent_context.md) - Original project agent context
- [Requirements](./01_requirements.md) - Human-readable requirements view
- [Architecture](./02_architecture.md) - Existing architecture notes
- [API Contracts](./03_api_contracts.md) - Existing API contract documentation
- [Data Model](./04_data_model.md) - Existing data model documentation
- [Security and Privacy](./05_security_privacy.md) - Auth, audit, privacy, retention
- [Development Workflow](./06_dev_workflow.md) - Existing development workflow
- [Do and Don't](./07_dos_donts.md) - Concrete implementation rules
- [Backlog](./08_backlog.md) - Backlog notes
- [Decisions Log](./09_decisions_log.md) - Architecture and product decisions
- [Requirements Status](./10_requirements_status.md) - Status tracking
- [Requirements Workflow](./11_requirements_workflow.md) - Requirements process
- [Stack Versions](./12_stack_versions.md) - Version decisions
- [Frontend Design Standards](./13_frontend_design_standards.md) - Frontend design system rules
- [Startup Troubleshooting](./STARTUP_TROUBLESHOOTING.md) - Local startup troubleshooting
- [Requirements CSV](./Anforderungen_WebApp_Indischer_Kulturverein.csv) - Source of requirements
- [BMAD Project Context](../_bmad-output/project-context.md) - Lean agent implementation rules

## Getting Started

### Prerequisites

- Docker Desktop
- .NET SDK 10
- Node.js 22 or newer
- npm
- Git

### Setup

```powershell
cd "B:\Projects\IAB Connect\iab-connect"
docker compose -f infra/docker-compose.yml up -d
cd frontend
npm install
```

### Run Locally

Backend terminal:

```powershell
cd "B:\Projects\IAB Connect\iab-connect\backend\src\IabConnect.Api"
dotnet run
```

Frontend terminal:

```powershell
cd "B:\Projects\IAB Connect\iab-connect\frontend"
npm run dev
```

### Run Tests

Backend:

```powershell
cd backend
dotnet test
```

Frontend:

```powershell
cd frontend
npm run typecheck
npm run lint
npm test
```

## For AI-Assisted Development

This documentation was generated specifically to help AI agents understand and extend this Brownfield codebase.

### When Planning New Features

UI-only features:

- Read `architecture-frontend.md`
- Read `component-inventory-frontend.md`
- Read `13_frontend_design_standards.md`
- Read `_bmad-output/project-context.md`

Backend/API features:

- Read `architecture-backend.md`
- Read `api-contracts-backend.md`
- Read `data-models-backend.md`
- Read `_bmad-output/project-context.md`

Full-stack features:

- Read backend, frontend, and integration architecture docs
- Check existing requirements and decisions
- Use `project-context.md` for implementation rules

Finance, privacy, backup, document, search, and export features:

- Treat as sensitive areas
- Preserve authorization, audit, retention, and testing behavior

---

Documentation generated by BMAD Method `document-project` workflow.

