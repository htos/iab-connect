# IAB Connect - Source Tree Analysis

Date: 2026-05-12

## Overview

IAB Connect is organized as a multi-part repository with a .NET backend, a Next.js frontend, and Docker-based local infrastructure. Existing project documentation lives in `docs/`; BMAD-generated Brownfield documentation is also written there.

## Complete Directory Structure

```text
iab-connect/
|-- backend/
|   |-- IabConnect.sln
|   |-- Directory.Build.props
|   |-- Directory.Packages.props
|   |-- global.json
|   |-- src/
|   |   |-- IabConnect.Api/
|   |   |   |-- Program.cs
|   |   |   |-- DependencyInjection.cs
|   |   |   |-- Endpoints/
|   |   |   |-- Authorization/
|   |   |   |-- Middleware/
|   |   |   |-- HealthChecks/
|   |   |-- IabConnect.Application/
|   |   |   |-- Behaviors/
|   |   |   |-- Common/
|   |   |   |-- Members/
|   |   |   |-- Events/
|   |   |   |-- Communication/
|   |   |   |-- Finance/
|   |   |   |-- Privacy/
|   |   |   |-- Reporting/
|   |   |   |-- Search/
|   |   |   |-- Sponsors/
|   |   |-- IabConnect.Domain/
|   |   |   |-- Common/
|   |   |   |-- Members/
|   |   |   |-- Events/
|   |   |   |-- Communication/
|   |   |   |-- Documents/
|   |   |   |-- Finance/
|   |   |   |-- Privacy/
|   |   |   |-- Sponsors/
|   |   |   |-- Operations/
|   |   |-- IabConnect.Infrastructure/
|   |   |   |-- Persistence/
|   |   |   |-- Migrations/
|   |   |   |-- Audit/
|   |   |   |-- Email/
|   |   |   |-- Finance/
|   |   |   |-- Identity/
|   |   |   |-- Search/
|   |   |   |-- Storage/
|   |-- tests/
|       |-- IabConnect.Api.Tests/
|       |-- IabConnect.Application.Tests/
|       |-- IabConnect.Infrastructure.Tests/
|-- frontend/
|   |-- package.json
|   |-- next.config.ts
|   |-- tsconfig.json
|   |-- eslint.config.mjs
|   |-- messages/
|   |-- src/
|       |-- app/
|       |   |-- api/auth/[...nextauth]/route.ts
|       |   |-- admin/
|       |   |-- members/
|       |   |-- finance/
|       |   |-- communication/
|       |   |-- documents/
|       |   |-- public/
|       |-- components/
|       |   |-- navigation/
|       |   |-- providers/
|       |   |-- search/
|       |   |-- ui/
|       |-- i18n/
|       |-- lib/
|       |   |-- api/
|       |   |-- services/
|       |-- types/
|-- infra/
|   |-- docker-compose.yml
|   |-- keycloak/
|       |-- realms/
|       |-- providers/
|-- docs/
|   |-- 00_agent_context.md
|   |-- 01_requirements.md
|   |-- 02_architecture.md
|   |-- 03_api_contracts.md
|   |-- 04_data_model.md
|   |-- 05_security_privacy.md
|   |-- 06_dev_workflow.md
|   |-- 07_dos_donts.md
|   |-- 08_backlog.md
|   |-- 09_decisions_log.md
|   |-- 10_requirements_status.md
|   |-- 11_requirements_workflow.md
|   |-- 12_stack_versions.md
|   |-- 13_frontend_design_standards.md
|   |-- STARTUP_TROUBLESHOOTING.md
|-- _bmad-output/
|   |-- project-context.md
```

## Critical Directories

### `backend/src/IabConnect.Api`

HTTP entry point and composition root for API-specific services, middleware, endpoint mapping, authentication, authorization, CORS, Swagger, health checks, Serilog request logging, and Hangfire dashboard registration.

### `backend/src/IabConnect.Api/Endpoints`

Minimal API endpoint modules. Each file maps one bounded area such as members, finance accounts, invoices, backups, retention, search, users, or public blog/contact endpoints.

### `backend/src/IabConnect.Application`

Application layer with MediatR handlers, validators, interfaces, pipeline behaviors, and use-case orchestration. Finance has the densest command/query structure.

### `backend/src/IabConnect.Domain`

Domain entities, value objects, aggregate roots, enums, repository interfaces, and domain events. Important domains include Members, Events, Finance, Documents, Communication, Privacy, Sponsors, Blog, Audit, Operations.

### `backend/src/IabConnect.Infrastructure`

EF Core DbContext, configurations, repositories, migrations, Keycloak admin integration, email, S3/RustFS storage, finance PDF/eInvoice/payment exports, backup/restore, retention, search, and Hangfire job implementations.

### `backend/tests`

Layered test projects for API, application/domain behavior, and infrastructure/persistence behavior.

### `frontend/src/app`

Next.js App Router. Contains authenticated feature routes, public routes, auth route handler, layouts, loading/error/not-found boundaries, and feature page implementations.

### `frontend/src/components`

Reusable frontend components: navigation shell, global search, providers, email template form, and Radix-inspired shared UI primitives.

### `frontend/src/lib`

Frontend infrastructure code: auth helpers, API clients, feature API wrappers, document/event services, utility functions.

### `frontend/messages`

Translation JSON files for next-intl. UI text should be added here rather than hardcoded in components.

### `infra`

Local infrastructure definition and Keycloak import/provider support.

## Entry Points

- Backend API: `backend/src/IabConnect.Api/Program.cs`
- Backend endpoint mapping: `backend/src/IabConnect.Api/Endpoints/EndpointMapper.cs`
- Backend persistence: `backend/src/IabConnect.Infrastructure/Persistence/ApplicationDbContext.cs`
- Frontend root layout: `frontend/src/app/layout.tsx`
- Frontend providers: `frontend/src/app/providers.tsx`
- Frontend auth route: `frontend/src/app/api/auth/[...nextauth]/route.ts`
- Frontend authenticated shell: `frontend/src/components/navigation/MainLayout.tsx`
- Infrastructure: `infra/docker-compose.yml`

## File Organization Patterns

- Backend projects follow Api/Application/Domain/Infrastructure separation.
- Backend modules are folder-based rather than separately deployed.
- API endpoints are grouped by feature area and mapped through `EndpointMapper`.
- Application commands, queries, handlers, and validators are organized by domain folder.
- Infrastructure repositories are registered centrally in `IabConnect.Infrastructure.DependencyInjection`.
- Frontend routes are feature-oriented under `src/app`.
- Frontend shared UI lives in `src/components/ui`; shell/navigation in `src/components/navigation`.
- Frontend service/API helpers are split between `src/lib/api`, `src/lib/services`, and broader auth/client helpers.

## Key File Types

### C# source

- Pattern: `backend/src/**/*.cs`
- Purpose: API, domain, application, infrastructure, tests
- Examples: `Program.cs`, `ApplicationDbContext.cs`, `MemberEndpoints.cs`

### TSX pages/components

- Pattern: `frontend/src/**/*.tsx`
- Purpose: Next.js pages, layouts, client components, shared UI
- Examples: `layout.tsx`, `MainLayout.tsx`, `members/page.tsx`

### TypeScript services/types

- Pattern: `frontend/src/**/*.ts`
- Purpose: API wrappers, auth helpers, types, i18n
- Examples: `auth.ts`, `api-client.ts`, `i18n/request.ts`

### EF Core migrations

- Pattern: `backend/src/IabConnect.Infrastructure/Migrations/*.cs`
- Purpose: database schema evolution

### Markdown/CSV documentation

- Pattern: `docs/*.md`, `docs/*.csv`
- Purpose: requirements, architecture, status, decisions, BMAD output

## Asset Locations

- Static frontend assets: `frontend/public` if present
- IAB logo/documentation assets: referenced under `docs/assets` in README, if present
- S3/RustFS document storage: runtime bucket `iabconnect-documents`

## Configuration Files

- `backend/global.json`: .NET SDK version
- `backend/Directory.Build.props`: backend build rules
- `backend/Directory.Packages.props`: central package versions
- `backend/src/IabConnect.Api/appsettings*.json`: API configuration
- `frontend/package.json`: frontend dependencies and scripts
- `frontend/next.config.ts`: Next.js/i18n/security header configuration
- `frontend/tsconfig.json`: TypeScript strict mode/path aliases
- `frontend/.prettierrc`: frontend formatting
- `frontend/eslint.config.mjs`: frontend linting
- `infra/docker-compose.yml`: local infrastructure

## Notes for Development

- Treat `backend/`, `frontend/`, and `infra/` as separate implementation parts with explicit integration contracts.
- Keep generated output out of `bin/`, `obj/`, `.next/`, and `node_modules/`.
- Existing numbered documentation is project-owned; BMAD-generated docs should be updated intentionally and not casually overwritten.

---

Generated using BMAD Method `document-project` workflow.

