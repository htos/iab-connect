# IAB Connect - Backend API Contracts

Date: 2026-05-12
Part: Backend API

## Overview

The backend exposes ASP.NET Core Minimal APIs under `/api/v1` plus selected health and infrastructure endpoints. Endpoint modules live in `backend/src/IabConnect.Api/Endpoints` and are registered through `EndpointMapper.cs`.

This document is a Brownfield API map. The 2026-05-12 rescan found 44 endpoint modules and roughly 315 mapped route operations. For exact request and response DTOs, inspect the endpoint file and application command/query types.

## API Conventions

- JSON uses camelCase property names.
- Enums are serialized as strings.
- Authenticated endpoints use JWT bearer tokens.
- Authorization is applied through named policies and role/permission checks.
- Swagger is available in Development at `/swagger`.
- Health endpoints are available at `/health`, `/health/ready`, and admin-only `/health/detail`.

## Public and Auth Routes

| Area | Base Path | Notes |
| --- | --- | --- |
| Registration | `/api/v1/registration` | Public self-registration |
| Newsletter | `/api/v1/public/newsletter` | Subscribe/unsubscribe and token verification |
| Contact | `/api/v1/public/contact` | Public contact form with honeypot behavior |
| Blog public | `/api/v1/blog/public` | Public blog reads |
| Sponsors public | `/api/v1/sponsors/public` | Public sponsor list |
| Settings public | `/api/v1/settings/public` | Public application settings |

## Endpoint Module Inventory

| Area | Endpoint Modules / Operation Count |
| --- | --- |
| Finance and accounting | 22 endpoint files, including accounts, activity areas, bank imports, dunning, expense claims, exports, fiscal periods, invoices, templates, journal entries, ledger accounts, payments, posting mappings, receipts, reports, tax codes, and transactions |
| Documents | `DocumentEndpoints.cs`, 21 mapped operations across folders, documents, permissions, versions, and downloads |
| Events | `EventEndpoints.cs` and `EventRegistrationEndpoints.cs`, 31 mapped operations total |
| Communication | `EmailCampaignEndpoints.cs`, `EmailTemplateEndpoints.cs`, `UnsubscribeEndpoints.cs`, 26 mapped operations total |
| Admin/security/operations | Users, roles, audit, privacy, backups, retention, settings, search, identity, and health |
| Public content/partners | Blog, contact, sponsors, suppliers, registration, and newsletter public routes |

## Identity, Users, Roles, Audit, Privacy

| Area | Base Path | Authorization |
| --- | --- | --- |
| Identity | `/api/v1/identity` | Authenticated identity-related endpoints |
| Users | `/api/v1/users` | `RequireAdmin` |
| Custom roles | `/api/v1/custom-roles` | Admin/custom role policies |
| Audit | `/api/v1/audit` | Admin/auditor or authenticated event tracking |
| Privacy | `/api/v1/privacy` | Member/admin depending on operation |
| Settings admin | `/api/v1/settings` | Admin |

## Members

Base path: `/api/v1/members`

Key operations:

- `GET /me`
- `PUT /me`
- `GET /me/profile-status`
- `GET /`
- `GET /{id}`
- `POST /`
- `PUT /{id}`
- `DELETE /{id}`
- `PUT /{id}/status`
- `PUT /{id}/type`
- `GET /statistics`

Member segments have a separate module under `/api/v1/member-segments`.

## Events

Event modules cover event CRUD, registration, waitlist/attendance-related behavior, and member-facing registration flows. Relevant endpoint files:

- `EventEndpoints.cs`
- `EventRegistrationEndpoints.cs`

## Communication

| Area | Endpoint File | Purpose |
| --- | --- | --- |
| Email campaigns | `EmailCampaignEndpoints.cs` | Campaign CRUD, send/schedule/statistics behavior |
| Email templates | `EmailTemplateEndpoints.cs` | Template CRUD/editor support |
| Newsletter unsubscribe | `UnsubscribeEndpoints.cs` | Public subscription lifecycle |

## Documents

`DocumentEndpoints.cs` handles document folders, uploads, downloads, permissions, versions, and board/admin document operations. Storage metadata is in PostgreSQL and binary content is stored in RustFS through S3-compatible APIs.

## Finance

Finance is the largest API surface. Endpoint groups include:

- `/api/v1/finance/accounts`
- `/api/v1/finance/categories`
- `/api/v1/finance/transactions`
- `/api/v1/finance/invoices`
- `/api/v1/finance/payments`
- `/api/v1/finance/bank-imports`
- `/api/v1/finance/dunning`
- `/api/v1/finance/receipts`
- `/api/v1/finance/exports`
- `/api/v1/finance/profile`
- `/api/v1/finance/tax-codes`
- `/api/v1/finance/fiscal-periods`
- `/api/v1/finance/expense-claims`
- `/api/v1/finance/invoice-templates`
- `/api/v1/finance/activity-areas`
- `/api/v1/finance/dashboard`
- `/api/v1/finance/accounting-reports`
- `/api/v1/finance/ledger-accounts`
- `/api/v1/finance/journal-entries`
- `/api/v1/finance/posting-mappings`

Related archive endpoints also cover finance receipt and invoice archive flows plus admin finance archive operations.

Finance read operations typically require `RequireFinanceRead`; write operations typically require `RequireFinanceWrite`; some restore/purge/admin actions require `RequireAdmin`.

## Sponsors and Suppliers

| Area | Base Path | Notes |
| --- | --- | --- |
| Sponsors | `/api/v1/sponsors` | Vorstand/admin management plus public read endpoint |
| Suppliers | `/api/v1/suppliers` | Admin-only supplier management |

## Reporting, Search, Backups, Retention

| Area | Base Path | Authorization |
| --- | --- | --- |
| Reports | `/api/v1/reports` | Vorstand, FinanceRead, Admin depending on report/export |
| Global search | `/api/v1/search` | `RequireSearch` |
| Backups | `/api/v1/admin/backups` | `RequireAdmin` |
| Retention | `/api/v1/admin/retention` | `RequireAdmin` |
| External API credentials (admin) | `/api/v1/admin/api-clients` | `RequireAdmin` |
| External API (integrations) | `/api/v1/external` | `ApiKey` scheme + `Scope:*` + `Module:api` |

## External API (REQ-058, Epic E8)

A dedicated, versioned integration surface under `/api/v1/external/*` for approved external systems.
It is **separate** from the first-party `/api/v1/*` endpoints and the anonymous `*/public` reads, with
its own authentication, authorization, and rate-limit contract.

### v1 scope (deliberately small)

The external API currently exposes **only published Events and published Blog posts** — the low-risk,
public, author-managed content. Members, finance, documents, audit, users and registration data are
**not** exposed. New resources are added only after a per-resource integration-safety review.

### Authentication

- Credentials are created/revoked by an admin under `POST/GET /api/v1/admin/api-clients` (`RequireAdmin`).
- The secret is returned **exactly once** at creation; only a one-way hash + a non-secret lookup prefix
  are stored.
- External requests authenticate with the header `X-Api-Key: iabc.{prefix}.{secret}` (the `ApiKey`
  authentication scheme — a second scheme alongside the first-party Keycloak JWT bearer).

### Authorization & limits

| Layer | Rule |
| --- | --- |
| Authentication | `X-Api-Key` (scheme `ApiKey`); absent/invalid → **401** |
| Scope | per-endpoint `Scope:events:read` / `Scope:blog:read`; credential lacking it → **403** |
| Module | `Module:api`; if an admin disabled the `api` module → **403** |
| Rate limit | per-credential `external-api` policy (default 300/min, partitioned on the credential id) → **429** over limit |

### Endpoints

| Method | Path | Scope | Returns |
| --- | --- | --- | --- |
| GET | `/api/v1/external/events` | `events:read` | `PagedResult<ExternalEventDto>` |
| GET | `/api/v1/external/events/{id}` | `events:read` | `ExternalEventDto` (404 if not published) |
| GET | `/api/v1/external/blog` | `blog:read` | `PagedResult<ExternalBlogPostDto>` |
| GET | `/api/v1/external/blog/{id}` | `blog:read` | `ExternalBlogPostDto` (404 if not published) |

List endpoints accept `page`, `pageSize` (clamped 1..100), `sort` (`field:asc|desc`), and
`filter` (`language=de,category=News`). Responses use the standard `PagedResult<T>` envelope.

### Integration-safe DTOs (whitelist only)

- **`ExternalEventDto`**: id, title, description, shortDescription, start/end, isAllDay, timeZone,
  location(+address/url), category, tags, image(+alt), cost(+description), contentLanguage.
  Deliberately **omits** organizer identity, contact email/phone, internal status, audit timestamps,
  visibility and soft-delete flags.
- **`ExternalBlogPostDto`**: id, title, slug, summary, content, author, category, tags, publishedAt,
  imageUrl, contentLanguage. **Omits** internal status and created/updated timestamps.

These records are whitelist-by-construction; the internal `EventDto`/`MemberDto` are never reused
(they carry contact/organizer/PII). Swagger (dev-only) tags these endpoints `External API`.

## Security Notes

- UI action hiding is not security.
- Sensitive exports, search, backups, retention, finance, documents, and privacy endpoints require conservative backend authorization.
- Access-denied and sensitive successful operations should be audit logged where existing services support it.

## Extension Guidance

When adding endpoints:

1. Add to a feature endpoint file or create a new `XEndpoints.cs`.
2. Register it from `EndpointMapper.cs`.
3. Use named routes and descriptions.
4. Apply explicit authorization.
5. Use MediatR/Application services for non-trivial behavior.
6. Add tests in the appropriate backend test project.

---

Generated using BMAD Method `document-project` workflow.

