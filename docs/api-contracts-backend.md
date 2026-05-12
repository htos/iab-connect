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

