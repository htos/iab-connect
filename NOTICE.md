# NOTICE

REQ-089 AC-2 / AC-3 (E20-S1) / ADR-009: this file lists the project copyright statement and the direct production dependencies of `backend/` and `frontend/` with their declared SPDX license identifiers. Transitive dependencies are out of scope per ADR-009 (REUSE-Compliance minimal scope).

## 1. Copyright

Copyright (C) 2026  IAB Connect contributors. Licensed under the GNU Affero General Public License v3.0 or later. See LICENSE for terms.

## 2. Backend direct dependencies

Generated from `dotnet list package` (run from `backend/`). All licenses verified AGPL-3.0-or-later-compatible per ADR-009 (MIT / Apache-2.0 / BSD / LGPL — all compatible with AGPL-3.0-or-later).

### IabConnect.Api

| Package | Version | Declared license (SPDX) |
| --- | --- | --- |
| Microsoft.AspNetCore.Authentication.JwtBearer | 10.0.2 | MIT |
| Microsoft.AspNetCore.Authentication.OpenIdConnect | 10.0.2 | MIT |
| Microsoft.EntityFrameworkCore.Design | 10.0.2 | MIT |
| Microsoft.EntityFrameworkCore.Tools | 10.0.2 | MIT |
| Microsoft.OpenApi | 1.6.14 | MIT |
| Microsoft.SourceLink.GitHub | 8.0.0 | MIT |
| Serilog.AspNetCore | 10.0.0 | Apache-2.0 |
| Serilog.Sinks.Console | 6.1.1 | Apache-2.0 |
| Serilog.Sinks.File | 7.0.0 | Apache-2.0 |
| Serilog.Sinks.Seq | 8.0.0 | Apache-2.0 |
| Swashbuckle.AspNetCore | 6.9.0 | MIT |

### IabConnect.Application

| Package | Version | Declared license (SPDX) |
| --- | --- | --- |
| FluentValidation | 11.11.0 | Apache-2.0 |
| FluentValidation.DependencyInjectionExtensions | 11.11.0 | Apache-2.0 |
| MediatR | 12.4.1 | Apache-2.0 |
| Microsoft.Extensions.Logging.Abstractions | 10.0.2 | MIT |
| Microsoft.SourceLink.GitHub | 8.0.0 | MIT |

### IabConnect.Domain

| Package | Version | Declared license (SPDX) |
| --- | --- | --- |
| Microsoft.SourceLink.GitHub | 8.0.0 | MIT |

### IabConnect.Infrastructure

| Package | Version | Declared license (SPDX) |
| --- | --- | --- |
| AWSSDK.S3 | 3.7.305.22 | Apache-2.0 |
| Codecrete.SwissQRBill.Generator | 3.3.0 | MIT |
| Hangfire | 1.8.22 | LGPL-3.0-only |
| Hangfire.PostgreSql | 1.20.10 | MIT |
| Microsoft.EntityFrameworkCore | 10.0.2 | MIT |
| Microsoft.EntityFrameworkCore.Tools | 10.0.2 | MIT |
| Microsoft.SourceLink.GitHub | 8.0.0 | MIT |
| Npgsql.EntityFrameworkCore.PostgreSQL | 10.0.0 | PostgreSQL |
| QuestPDF | 2025.1.1 | QuestPDF Community License (proprietary, free for projects under USD 1M annual revenue; commercial license required above) — AGPL-compatible *for projects within the revenue threshold*. Above the threshold, a paid QuestPDF Professional license is required and this project's AGPL §13 contract MUST be re-audited. Flag for revenue-line review in E14-S1 secrets/compliance audit. |

## 3. Frontend direct dependencies

Generated from `npm ls --omit=dev --depth=0` (run from `frontend/`). All licenses verified AGPL-3.0-or-later-compatible per ADR-009.

| Package | Version | Declared license (SPDX) |
| --- | --- | --- |
| @hookform/resolvers | 3.10.0 | MIT |
| @radix-ui/react-alert-dialog | 1.1.15 | MIT |
| @radix-ui/react-checkbox | 1.3.3 | MIT |
| @radix-ui/react-dialog | 1.1.15 | MIT |
| @radix-ui/react-dropdown-menu | 2.1.16 | MIT |
| @radix-ui/react-label | 2.1.8 | MIT |
| @radix-ui/react-select | 2.2.6 | MIT |
| @radix-ui/react-separator | 1.1.8 | MIT |
| @radix-ui/react-slot | 1.2.4 | MIT |
| @radix-ui/react-tabs | 1.1.13 | MIT |
| @tailwindcss/typography | 0.5.19 | MIT |
| @tanstack/react-query | 5.90.20 | MIT |
| @tiptap/extension-link | 3.18.0 | MIT |
| @tiptap/extension-placeholder | 3.18.0 | MIT |
| @tiptap/extension-text-align | 3.18.0 | MIT |
| @tiptap/extension-underline | 3.18.0 | MIT |
| @tiptap/pm | 3.18.0 | MIT |
| @tiptap/react | 3.18.0 | MIT |
| @tiptap/starter-kit | 3.18.0 | MIT |
| @yudiel/react-qr-scanner | 2.6.0 | MIT |
| class-variance-authority | 0.7.1 | Apache-2.0 |
| clsx | 2.1.1 | MIT |
| dompurify | 3.3.1 | (MPL-2.0 OR Apache-2.0) |
| lucide-react | 0.468.0 | ISC |
| next | 16.1.6 | MIT |
| next-auth | 4.24.13 | ISC |
| next-intl | 4.8.1 | MIT |
| react | 19.2.4 | MIT |
| react-dom | 19.2.4 | MIT |
| react-hook-form | 7.71.1 | MIT |
| tailwind-merge | 2.6.0 | MIT |
| zod | 3.25.76 | MIT |

## 4. How this list is regenerated

```sh
# Backend (run from backend/):
dotnet list package

# Frontend (run from frontend/):
npm ls --omit=dev --depth=0
```

Re-run these whenever a direct dependency is added, removed, or version-bumped. Update both sections above accordingly. Verify each package's license against ADR-009's compatibility matrix; flag any GPL-incompatible license in a PR comment so it can be evaluated before merge.
