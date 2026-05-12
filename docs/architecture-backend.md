# IAB Connect - Backend Architecture

Date: 2026-05-12
Part: Backend API
Location: `backend/`

## Purpose

The backend is the authoritative security, business logic, persistence, background job, and integration layer for IAB Connect. It exposes an ASP.NET Core HTTP API consumed by the Next.js frontend and stores data in PostgreSQL through EF Core.

## Architectural Style

The backend is a modular monolith using Clean Architecture-style project boundaries:

- `IabConnect.Api`: HTTP endpoints, middleware, API pipeline, auth policies, Swagger, health checks
- `IabConnect.Application`: use cases, MediatR handlers, validators, application services, interfaces
- `IabConnect.Domain`: entities, value objects, aggregate roots, enums, domain events, repository interfaces
- `IabConnect.Infrastructure`: EF Core, repositories, migrations, external integrations, jobs, storage, email, search

The important architectural decision is that modules are code boundaries, not deployment boundaries. New feature work should preserve this unless a future explicit architecture change is approved.

## Entry Point and Startup Flow

Main entry: `backend/src/IabConnect.Api/Program.cs`

Startup flow:

1. Bootstrap Serilog.
2. Build WebApplication.
3. Register API, Application, and Infrastructure services.
4. Apply EF Core migrations except in Testing environment.
5. Seed development data in Development.
6. Seed default retention policies.
7. Configure API middleware pipeline.
8. Register endpoints and recurring Hangfire jobs.

The application exposes health checks and Swagger in development. Kestrel server headers are suppressed.

## API Layer

Endpoint mapping is centralized in `EndpointMapper.cs`. Most API modules are Minimal API endpoint classes under `IabConnect.Api/Endpoints`.

The 2026-05-12 rescan found 44 endpoint modules and roughly 315 mapped route operations. `DocumentEndpoints.cs`, `EventRegistrationEndpoints.cs`, `EmailCampaignEndpoints.cs`, finance endpoints, and admin/backup endpoints are among the larger route surfaces.

Major endpoint groups include:

- Identity and user management
- Members and member segments
- Audit and privacy
- Events and event registrations
- Email campaigns and templates
- Settings and custom roles
- Documents
- Finance: accounts, categories, transactions, invoices, payments, bank imports, dunning, receipts, profile, tax codes, fiscal periods, expense claims, invoice templates, activity areas, dashboard, archive
- Double-entry accounting: ledger accounts, journal entries, posting mappings, accounting reports
- Sponsors and suppliers
- Blog and public contact
- Reporting and exports
- Global search
- Backup/restore
- Retention policies

## Application Layer

The application layer provides use-case orchestration. Finance has been refactored heavily toward CQRS/MediatR. Pipeline behaviors include logging and validation.

Common patterns:

- MediatR commands and queries for workflow-oriented use cases
- FluentValidation validators for input rules
- Repository and service interfaces owned by Application/Domain
- `CancellationToken` propagation
- Application services for cross-cutting use cases such as audit, authorization, search, retention, backup, finance exports

## Domain Layer

Domain modules include:

- Members
- Events
- Communication
- Documents
- Finance
- Privacy
- Sponsors
- Blog
- Audit
- Authorization
- Operations
- Common abstractions

Finance is the densest domain and includes both cash/subledger concepts and optional double-entry accounting concepts. Existing compliance behavior around soft delete, invoice cancellation/reversal, audit, retention, and accounting mode should not be bypassed.

## Infrastructure Layer

Infrastructure is responsible for:

- `ApplicationDbContext`
- EF Core configurations and migrations
- Repository implementations
- Keycloak admin service
- SMTP email sending
- Hangfire jobs
- RustFS/S3 document storage
- Finance PDF generation with QuestPDF and Swiss QR bill support
- eInvoice UBL export and validation
- pain.001 export
- PostgreSQL global search
- PostgreSQL backup/restore via Docker
- Retention enforcement

## Persistence Architecture

Persistence uses EF Core 10 with PostgreSQL. `ApplicationDbContext` has DbSets for all major aggregates and applies configurations from the Infrastructure assembly.

Notable persistence behavior:

- UTC normalization for all DateTime/DateTime? properties before hitting Npgsql.
- EF migrations live in `IabConnect.Infrastructure/Migrations`.
- Hangfire also uses PostgreSQL storage.
- Soft-delete and archive concepts exist, especially in finance and retention areas.

## Authentication and Authorization

Authentication uses Keycloak/OIDC and JWT bearer validation. Backend policies include:

- `RequireAdmin`
- `RequireVorstand`
- `RequireMember`
- `RequireFinanceRead`
- `RequireFinanceWrite`
- `RequireSearch`

Keycloak realm roles are mapped into standard role claims. Additional permission-based authorization is registered through a policy provider and handler.

Backend authorization is the security boundary. Frontend role checks should only hide UI affordances.

## Background Jobs

Hangfire is configured in Infrastructure and registered in the API pipeline. Recurring jobs include:

- Mark invoices overdue
- Generate dunning notices
- Enforce retention policies

Email campaigns and scheduled backups also use background-job infrastructure.

## Logging, Health, and Operations

- Serilog is the logging backbone.
- CorrelationId middleware adds request tracing.
- ExceptionHandlingMiddleware centralizes error behavior.
- Health endpoints expose basic, readiness, and detailed admin-only health checks.
- Backup endpoints and retention endpoints are admin-sensitive and must preserve audit/security behavior.

## Testing Strategy

Backend tests are split into:

- `IabConnect.Api.Tests`
- `IabConnect.Application.Tests`
- `IabConnect.Infrastructure.Tests`

Application/domain behavior should be unit tested. Repository behavior that depends on PostgreSQL semantics should use Testcontainers PostgreSQL rather than EF InMemory.

Current backend test inventory is concentrated in `IabConnect.Application.Tests`, especially finance, with additional API and Infrastructure repository tests. New changes in finance, privacy, audit, backup, documents, search, exports, and persistence should add regression coverage because those areas carry authorization, compliance, or data-integrity risk.

## Key Risks and Observations

- The backend has a very broad feature surface; changes should be scoped by module.
- Some endpoint modules still include direct orchestration and mapping logic; new complex behavior should move into Application/MediatR patterns.
- PostgreSQL and Keycloak share the same database in local development; migrations must use EF migrations, not `EnsureCreated`, outside Testing.
- Finance/accounting behavior has compliance implications; avoid quick fixes that skip audit, retention, cancellation, soft-delete, or accounting-mode checks.

---

Generated using BMAD Method `document-project` workflow.

