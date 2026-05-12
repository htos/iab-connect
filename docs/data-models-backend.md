# IAB Connect - Backend Data Models

Date: 2026-05-12
Part: Backend API

## Overview

IAB Connect uses EF Core with PostgreSQL. The main DbContext is `ApplicationDbContext` in `IabConnect.Infrastructure.Persistence`. Domain entities live in `IabConnect.Domain`, while table mapping and repository behavior live in Infrastructure.

The 2026-05-12 rescan found 42 configured persistence mappings, 32 first-class EF migrations, and DbSets for the core membership, communication, document, finance, double-entry, sponsor/supplier, blog/contact, backup, retention, audit, privacy, and settings areas.

## Persistence Conventions

- EF Core migrations are in `backend/src/IabConnect.Infrastructure/Migrations`.
- DbSets are declared in `ApplicationDbContext`.
- EF configurations are applied from the Infrastructure assembly.
- DateTime values are normalized to UTC through global value converters and SaveChanges normalization.
- PostgreSQL-specific behavior should be validated with Testcontainers-backed integration tests.

## Persistence Inventory

| Inventory Item | Current Count / Notes |
| --- | --- |
| EF configuration files | 42 files under `Persistence/Configurations` |
| First-class migrations | 32 migration files, excluding designer snapshots |
| Latest migration | `20260308172932_AddMemberSegments` |
| DbContext | `ApplicationDbContext` with DbSets for all major modules |
| Snapshot | `ApplicationDbContextModelSnapshot.cs` |

## Core Entity Areas

### Members

Entities:

- `Member`
- `Address`
- `MemberSegment`
- `MemberSegmentAssignment`

Purpose: member profiles, membership status/type, segmentation, self-service profile data.

### Identity and Authorization

Entities:

- `CustomRole`
- `SystemSettings`
- Permission definitions in domain authorization code

Keycloak remains the source of truth for users and realm roles. Local entities support application-level settings and custom role concepts.

### Audit

Entities:

- `AuditEvent`
- Audit enums/categories/severity

Purpose: compliance and security trail for identity, member, finance, document, backup, privacy, and system actions.

### Privacy

Entities:

- `Consent`
- `DeletionRequest`

Purpose: consent tracking, data export/deletion request lifecycle, DSGVO-related workflows.

### Events

Entities:

- `Event`
- `EventRegistration`
- Event/registration enums

Purpose: event lifecycle, registration, status, capacity/waitlist-related behavior.

### Communication

Entities:

- `EmailCampaign`
- `EmailRecipient`
- `EmailTemplate`
- `NewsletterSubscriber`
- `ContactMessage`

Purpose: email templates, campaigns, recipients, newsletter subscription/unsubscribe, public contact form.

### Documents

Entities:

- `DocumentFolder`
- `Document`
- `DocumentVersion`
- `DocumentTag`
- `FolderPermission`

Purpose: foldered document management with metadata in PostgreSQL and content in RustFS/S3-compatible storage.

### Finance

Entities:

- `Account`
- `Category`
- `Transaction`
- `Invoice`
- `InvoiceItem`
- `Payment`
- `BankImport`
- `BankImportItem`
- `DunningNotice`
- `Receipt`
- `FinanceProfile`
- `TaxCode`
- `FiscalPeriod`
- `ExpenseClaim`
- `InvoiceTemplate`
- `ActivityArea`
- `InvoiceNumberCounter`

Purpose: association finance, invoicing, payments, dunning, receipts, fiscal periods, tax, activity areas, finance profile settings.

### Double-Entry Accounting

Entities:

- `LedgerAccount`
- `JournalEntry`
- `JournalEntryLine`
- `PostingMapping`

Purpose: optional general ledger layer controlled by FinanceProfile accounting mode. Existing subledger remains the user-facing input layer.

### Sponsors and Suppliers

Entities:

- `Sponsor`
- `SponsorPackage`
- `Supplier`
- `ContractLink`

Purpose: partner management, public sponsor presentation, packages, supplier tracking, linked references.

### Public Content

Entities:

- `BlogPost`
- `ContactMessage`

Purpose: public website content and contact intake.

### Operations

Entities:

- `BackupRecord`
- `RetentionPolicy`

Purpose: backup metadata and retention/anonymization/deletion policy configuration.

## Migration Strategy

- Use EF Core migrations with descriptive names.
- Apply migrations in development and production through controlled startup/deployment behavior.
- Avoid manual database schema changes.
- Review migrations carefully because the app shares PostgreSQL with Keycloak in local development and contains compliance-sensitive data.

## Data Integrity and Compliance Notes

- Finance entities often require soft-delete, archiving, cancellation/reversal, or retention behavior rather than hard delete.
- Audit logs have retention/anonymization requirements.
- Backup and restore metadata must remain admin-sensitive.
- Search and exports can expose personal or finance data and must preserve authorization constraints.
- Date/time storage must remain UTC-safe for Npgsql.

## Extension Guidance

When adding models:

1. Add domain entity/value object in the correct domain folder.
2. Add DbSet only when persistence is required.
3. Add EF configuration in Infrastructure.
4. Add migration in Infrastructure.
5. Register repository/service if needed.
6. Add unit and integration tests appropriate to the behavior.

---

Generated using BMAD Method `document-project` workflow.

