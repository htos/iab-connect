# IAB Connect - Integration Architecture

Date: 2026-05-12

## Overview

IAB Connect integrates a Next.js frontend, ASP.NET Core backend, Keycloak identity provider, PostgreSQL database, RustFS object storage, MailHog/SMTP email, Hangfire background jobs, and optional Seq logging.

## Cross-Part Communication

### Frontend to Backend

- Type: HTTP/JSON API
- Base URL: `NEXT_PUBLIC_API_URL`, default `http://localhost:5000`
- Auth: bearer access token from NextAuth/Keycloak session
- API shape: `/api/v1/...`

### Frontend to Keycloak

- Type: OIDC via next-auth
- Purpose: login, logout, access token/session management
- Roles: exposed to frontend session and used for UI visibility

### Backend to Keycloak

- Type: JWT validation and admin REST API
- Purpose: validate access tokens, map realm roles, manage users through service account

### Backend to PostgreSQL

- Type: EF Core via Npgsql
- Purpose: application data, migrations, query processing
- Also used as Hangfire storage

### Backend to RustFS

- Type: AWS S3 SDK against S3-compatible endpoint
- Purpose: document and finance receipt storage

### Backend to SMTP/MailHog

- Type: SMTP
- Purpose: development email capture and production email delivery path

### Backend to Seq/File/Console

- Type: Serilog sinks
- Purpose: structured logging and diagnostics

## Data Flow Examples

### Authenticated API Request

1. User logs into Keycloak through NextAuth.
2. Frontend receives a session and access token.
3. Frontend sends bearer token to backend.
4. Backend validates JWT and maps Keycloak realm roles.
5. Endpoint policy and optional permission checks authorize the operation.
6. Endpoint delegates to repository, MediatR handler, or application service.
7. Backend returns JSON response.

### Document Upload

1. Frontend sends authenticated upload request.
2. Backend enforces document permissions.
3. Backend stores metadata in PostgreSQL.
4. Backend stores binary content in RustFS via S3-compatible API.
5. Audit/security behavior should be preserved for sensitive document operations.

### Finance Invoice Flow

1. Frontend creates or edits invoice through finance API.
2. Backend validates finance write permission.
3. Application/domain logic creates invoice entities and invoice items.
4. Infrastructure may generate PDFs, Swiss QR bills, eInvoice exports, payments, dunning notices, and accounting postings.
5. Finance data must respect audit, soft-delete/cancellation, retention, and accounting-mode behavior.

### Backup Flow

1. Admin invokes backup endpoint.
2. Backend writes BackupRecord metadata.
3. PostgresBackupService uses Docker operations to run backup/restore against the PostgreSQL container.
4. Backup actions are sensitive and should remain admin-only with audit behavior.

## Security Boundaries

- Backend is the security boundary for all protected operations.
- Frontend role checks are convenience and UX only.
- Search, export, backup, finance, privacy, document, and admin operations expose sensitive data and require conservative authorization.
- Keycloak is the source of truth for users and roles.

## Integration Risks

- Version drift between docs and executable project files can mislead agents; prefer package and project files for exact versions.
- Sharing PostgreSQL between Keycloak and application in local dev makes migrations behavior important.
- Direct frontend fetch patterns exist alongside API helper patterns; new code should converge toward typed helpers and consistent refresh behavior.
- Infrastructure is development-oriented; production needs hardened secrets, TLS, backup policy, and monitoring.

---

Generated using BMAD Method `document-project` workflow.

