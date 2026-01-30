# Stack Versions & Technology Choices

> **Stand**: 2026-01-30  
> **Verantwortlich**: Software Architektur Agent

Alle Versionen wurden am 30.01.2026 aus den offiziellen Quellen recherchiert.

---

## Backend (.NET / C#)

| Technologie | Version | LTS/Stable | Support bis | Quelle |
|-------------|---------|------------|-------------|--------|
| **.NET** | 10.0.2 | LTS | November 2028 | [dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/10.0) |
| **ASP.NET Core** | 10.0 | LTS | November 2028 | [dotnet.microsoft.com](https://dotnet.microsoft.com/download/dotnet/10.0) |
| **Entity Framework Core** | 10.0.2 | LTS | November 2028 | [nuget.org](https://www.nuget.org/packages/Microsoft.EntityFrameworkCore) |
| **Npgsql.EntityFrameworkCore.PostgreSQL** | 10.0.x | Stable | - | [nuget.org](https://www.nuget.org/packages/Npgsql.EntityFrameworkCore.PostgreSQL) |
| **Microsoft.AspNetCore.Authentication.JwtBearer** | 10.0.2 | LTS | November 2028 | [nuget.org](https://www.nuget.org/packages/Microsoft.AspNetCore.Authentication.JwtBearer) |
| **Microsoft.AspNetCore.Authentication.OpenIdConnect** | 10.0.2 | LTS | November 2028 | [nuget.org](https://www.nuget.org/packages/Microsoft.AspNetCore.Authentication.OpenIdConnect) |
| **Swashbuckle.AspNetCore** | 10.1.0 | Stable | - | [nuget.org](https://www.nuget.org/packages/Swashbuckle.AspNetCore) |
| **Serilog.AspNetCore** | 10.0.0 | Stable | - | [nuget.org](https://www.nuget.org/packages/Serilog.AspNetCore) |
| **Hangfire** | 1.8.22 | Stable | - | [nuget.org](https://www.nuget.org/packages/Hangfire) |
| **MediatR** | 12.x | Stable | - | [nuget.org](https://www.nuget.org/packages/MediatR) |
| **FluentValidation** | 11.x | Stable | - | [nuget.org](https://www.nuget.org/packages/FluentValidation) |

### Testing (Backend)

| Technologie | Version | Quelle |
|-------------|---------|--------|
| **xunit.v3** | 3.x | [nuget.org](https://www.nuget.org/packages/xunit.v3) |
| **FluentAssertions** | 8.8.0 | [nuget.org](https://www.nuget.org/packages/FluentAssertions) |
| **Testcontainers** | 4.10.0 | [nuget.org](https://www.nuget.org/packages/Testcontainers) |
| **Moq** | 4.x | [nuget.org](https://www.nuget.org/packages/Moq) |

---

## Frontend (Node.js / TypeScript)

| Technologie | Version | LTS/Stable | Quelle |
|-------------|---------|------------|--------|
| **Node.js** | 24.13.0 | LTS | [nodejs.org](https://nodejs.org/) |
| **Next.js** | 16.1.6 | Stable | [nextjs.org](https://nextjs.org/) |
| **React** | 19.2.4 | Stable | [npmjs.com/package/react](https://www.npmjs.com/package/react) |
| **TypeScript** | 5.9.3 | Stable | [npmjs.com/package/typescript](https://www.npmjs.com/package/typescript) |
| **Tailwind CSS** | 4.1.18 | Stable | [npmjs.com/package/tailwindcss](https://www.npmjs.com/package/tailwindcss) |
| **Turbopack** | (bundled) | Stable | via Next.js 16 |

### Testing (Frontend)

| Technologie | Version | Quelle |
|-------------|---------|--------|
| **Playwright** | 1.58.0 | [npmjs.com/package/playwright](https://www.npmjs.com/package/playwright) |
| **Vitest** | 3.x | [npmjs.com/package/vitest](https://www.npmjs.com/package/vitest) |
| **Testing Library** | 16.x | [npmjs.com](https://www.npmjs.com/package/@testing-library/react) |

### Zusätzliche Frontend-Pakete

| Technologie | Version | Zweck |
|-------------|---------|-------|
| **next-auth** | 5.x | OIDC/Keycloak Integration |
| **@tanstack/react-query** | 5.x | Server State Management |
| **zod** | 3.x | Schema Validation |
| **react-hook-form** | 7.x | Form Handling |
| **lucide-react** | latest | Icons |

---

## Infrastruktur

| Technologie | Version | Quelle |
|-------------|---------|--------|
| **PostgreSQL** | 18.1 | [postgresql.org](https://www.postgresql.org/download/) |
| **Keycloak** | 26.5.2 | [keycloak.org](https://www.keycloak.org/downloads) |
| **MinIO** | latest | [min.io](https://min.io/) |
| **Docker** | latest | [docker.com](https://www.docker.com/) |
| **Docker Compose** | v2.x | [docker.com](https://www.docker.com/) |

---

## Entwicklungstools

| Tool | Version | Zweck |
|------|---------|-------|
| **ESLint** | 9.x | Code Quality (Frontend) |
| **Prettier** | 3.x | Code Formatting |
| **Husky** | 9.x | Git Hooks |
| **lint-staged** | 15.x | Staged Files Linting |

---

## Architektur-Entscheidungen

### Warum .NET 10 LTS?
- Long-Term Support bis November 2028
- Performance-Verbesserungen gegenüber .NET 8
- Native AOT Support für Container
- Verbesserte Minimal APIs

### Warum Next.js 16?
- Turbopack ist stabil
- App Router vollständig ausgereift
- React 19 Server Components Support
- Optimierte Build-Performance

### Warum PostgreSQL 18?
- JSONB für flexible Datenstrukturen
- Hervorragende Performance
- Open Source, keine Lizenzkosten
- Exzellente EF Core Integration

### Warum Keycloak?
- Vollständige OIDC/OAuth2 Implementation
- Admin-UI für Benutzerverwaltung
- Multi-Tenant fähig
- Active Directory Integration möglich
- Self-Hosted (DSGVO-konform)

---

## Versions-Update-Policy

1. **Security Updates**: Sofort einspielen
2. **Minor Updates**: Monatlich prüfen
3. **Major Updates**: Nach Stabilitätsphase (3 Monate nach Release)
4. **LTS Wechsel**: Frühzeitig planen (6 Monate vor Support-Ende)

---

*Letzte Aktualisierung: 2026-01-30*
