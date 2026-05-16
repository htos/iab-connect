<p align="center">
  <img src="docs/assets/logo.png" alt="IAB Connect Logo" width="200" height="200" />
</p>

<h1 align="center">IAB Connect</h1>

<p align="center">
  <strong>A Modern Member Management & Communication Platform for the Indian Association Berne</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/.NET-10.0-512BD4?style=flat-square&logo=dotnet" alt=".NET 10" />
  <img src="https://img.shields.io/badge/Next.js-16.1-black?style=flat-square&logo=next.js" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-336791?style=flat-square&logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Keycloak-26.5-4D4D4D?style=flat-square&logo=keycloak" alt="Keycloak" />
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker" alt="Docker" />
  <img src="https://img.shields.io/badge/License-Private-red?style=flat-square" alt="License" />
</p>

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the Application](#running-the-application)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Authentication & Authorization](#authentication--authorization)
- [Database](#database)
- [Testing](#testing)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

---

## 🌟 Overview

**IAB Connect** is a comprehensive, full-stack web application designed specifically for the **Indian Association Berne (IAB)** — a vibrant cultural organization in Switzerland. This platform serves as a centralized hub for member management, event organization, communication, and community engagement.

Built with modern technologies and following industry best practices, IAB Connect provides a seamless experience for both administrators and members, enabling efficient management of association activities while maintaining the highest standards of security and data privacy (GDPR/DSG compliant).

### Why IAB Connect?

- 🏛️ **Purpose-Built**: Tailored specifically for cultural associations and non-profit organizations
- 🔐 **Enterprise Security**: OAuth 2.0/OIDC authentication with Keycloak identity management
- 🌍 **Internationalization**: Full German and English language support
- 📱 **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- 🚀 **Modern Architecture**: Clean Architecture principles with Domain-Driven Design
- ⚡ **High Performance**: Optimized queries, caching, and efficient resource usage

---

## ✨ Features

### 👥 Member Management

- **Self-Registration Portal** with admin approval workflow
- **Member Profiles** with customizable fields and privacy settings
- **Membership Types**: Regular, Student, Family, and Honorary memberships
- **Status Tracking**: Active, Pending, Inactive, and Suspended states
- **Bulk Operations**: Import/export member data, batch updates
- **Member Directory**: Searchable, filterable member listings with privacy controls

### 📅 Event Management

- **Event Creation & Scheduling** with rich text descriptions
- **Event Categories**: Cultural, Social, Educational, Sports, Religious, Meeting, Other
- **Registration System**: RSVP tracking with capacity limits and waitlists
- **Recurring Events**: Support for recurring event patterns
- **Event Calendar**: Visual calendar view with filtering options
- **Event Statistics**: Attendance tracking and analytics

### 📧 Email Campaigns

- **Campaign Builder**: Visual rich-text editor for HTML emails
- **Recipient Segmentation**: Target specific member groups
- **Email Templates**: Reusable templates with variable placeholders
- **Campaign Analytics**: Open rates, click tracking, delivery statistics
- **Scheduling**: Schedule campaigns for future delivery
- **Bounce Handling**: Automatic bounce and unsubscribe management

### 🔐 Security & Privacy

- **Role-Based Access Control (RBAC)**: Admin, Board Member, Kassier, Auditor, Event-Manager, Member roles
- **Permission System**: Granular permissions for all operations
- **Audit Logging**: Complete audit trail for compliance
- **GDPR/DSG Compliance**: Data privacy controls and consent management
- **Two-Factor Authentication**: Enhanced account security (via Keycloak)
- **Session Management**: Secure session handling with token refresh

### 👤 User Management

- **Identity Integration**: Keycloak-based user management
- **Role Assignment**: Flexible role and permission management
- **Account Lifecycle**: Account creation, suspension, and deletion
- **Password Policies**: Configurable password requirements
- **Login History**: Track user access patterns

### 📊 Dashboard & Analytics

- **Admin Dashboard**: Overview of key metrics and activities
- **Member Statistics**: Membership trends and demographics
- **Event Analytics**: Event participation and engagement metrics
- **Activity Feed**: Real-time updates on association activities

---

## 🛠️ Tech Stack

### Backend

| Technology                | Version | Purpose                    |
| ------------------------- | ------- | -------------------------- |
| **.NET**                  | 10.0    | Application framework      |
| **ASP.NET Core**          | 10.0    | Web API framework          |
| **Entity Framework Core** | 10.0    | ORM and database access    |
| **MediatR**               | 12.x    | CQRS and mediator pattern  |
| **FluentValidation**      | 11.x    | Input validation           |
| **Hangfire**              | 1.8.x   | Background job processing  |
| **Serilog**               | 4.x     | Structured logging         |
| **Seq**                   | -       | Log aggregation and search |

### Frontend

| Technology       | Version | Purpose                         |
| ---------------- | ------- | ------------------------------- |
| **Next.js**      | 16.1.6  | React framework with App Router |
| **React**        | 19.x    | UI component library            |
| **TypeScript**   | 5.x     | Type-safe JavaScript            |
| **Tailwind CSS** | 4.x     | Utility-first CSS framework     |
| **next-intl**    | 4.x     | Internationalization            |
| **TipTap**       | 3.x     | Rich text editor                |

### Infrastructure

| Technology         | Version | Purpose                        |
| ------------------ | ------- | ------------------------------ |
| **PostgreSQL**     | 17      | Primary database               |
| **Keycloak**       | 26.5.2  | Identity and access management |
| **RustFS**         | Latest  | S3-compatible object storage   |
| **MailHog**        | Latest  | Email testing (development)    |
| **Docker**         | Latest  | Containerization               |
| **Docker Compose** | Latest  | Container orchestration        |

---

## 🏗️ Architecture

IAB Connect follows **Clean Architecture** principles combined with **Domain-Driven Design (DDD)** patterns:

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│  ┌─────────────────────────┐  ┌─────────────────────────────┐  │
│  │   Next.js Frontend      │  │    ASP.NET Core API         │  │
│  │   (React, TypeScript)   │  │    (Minimal APIs)           │  │
│  └─────────────────────────┘  └─────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                        APPLICATION LAYER                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Use Cases • Commands • Queries • DTOs • Validators     │    │
│  │  MediatR Handlers • Behaviors (Validation, Logging)     │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                          DOMAIN LAYER                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Entities • Value Objects • Domain Events • Interfaces  │    │
│  │  Business Rules • Domain Services                        │    │
│  └─────────────────────────────────────────────────────────┘    │
├─────────────────────────────────────────────────────────────────┤
│                      INFRASTRUCTURE LAYER                        │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐    │
│  │  PostgreSQL  │ │   Keycloak   │ │  External Services   │    │
│  │  (EF Core)   │ │   (Identity) │ │  (Email, Storage)    │    │
│  └──────────────┘ └──────────────┘ └──────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

- **CQRS Pattern**: Separation of read and write operations using MediatR
- **Repository Pattern**: Abstraction over data access with EF Core
- **Domain Events**: Loose coupling between bounded contexts
- **Dependency Injection**: IoC container for managing dependencies
- **Middleware Pipeline**: Cross-cutting concerns (auth, logging, error handling)

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your development machine:

| Requirement        | Version | Installation                                               |
| ------------------ | ------- | ---------------------------------------------------------- |
| **Docker Desktop** | Latest  | [Download](https://www.docker.com/products/docker-desktop) |
| **.NET SDK**       | 10.0+   | [Download](https://dotnet.microsoft.com/download)          |
| **Node.js**        | 22+     | [Download](https://nodejs.org/)                            |
| **Git**            | Latest  | [Download](https://git-scm.com/)                           |

### Installation

1. **Clone the Repository**

   ```bash
   git clone https://github.com/htos/iab-connect.git
   cd iab-connect
   ```

2. **Start Infrastructure Services**

   ```bash
   # Ensure Docker Desktop is running
   docker compose -f infra/docker-compose.yml up -d

   # Wait 20-30 seconds for services to initialize
   # Verify all containers are running
   docker compose -f infra/docker-compose.yml ps
   ```

3. **Set Up the Database**

   ```bash
   cd backend

   # Apply database migrations
   dotnet ef database update \
     --project src/IabConnect.Infrastructure \
     --startup-project src/IabConnect.Api
   ```

4. **Install Frontend Dependencies**
   ```bash
   cd frontend
   npm install
   ```

### Configuration

Configuration is environment-variable-driven. The canonical lists of variables consumed by the
application are [`backend/.env.example`](backend/.env.example) and
[`frontend/.env.example`](frontend/.env.example) — copy each to its sibling `.env` /
`.env.local` (both gitignored) and fill in values for local development, or set the variables on
your deployment target (Railway, Docker, systemd, etc.). Real secrets never live in committed
files.

#### Backend precedence

The .NET configuration system layers sources; later layers override earlier ones:

```
appsettings.json
  ↓ (base; committed; non-sensitive defaults)
appsettings.{ASPNETCORE_ENVIRONMENT}.json
  ↓ (committed; per-environment non-sensitive overrides — Development / Beta / Production)
Environment variables
  ↓ (uncommitted; source of all secrets)
Command-line arguments
  ↓ (rare; mostly for ad-hoc overrides)
```

Nested configuration keys use `:` inside JSON (`"Keycloak": { "ClientSecret": "..." }`) and
`__` (two underscores) inside environment variables (POSIX shells and Windows env vars do not
allow `:` in variable names). .NET aliases `__` to `:` automatically:

```bash
# This env var:
export Keycloak__ClientSecret="..."

# overrides this appsettings.json entry:
"Keycloak": { "ClientSecret": "..." }
```

The currently active environment file is `appsettings.Development.json` (when
`ASPNETCORE_ENVIRONMENT=Development`, the default). Beta deployments load
`appsettings.Beta.json`; Production deployments load `appsettings.Production.json` (or omit it).

#### Frontend precedence

Next.js layers `.env*` files in this order; later layers override earlier ones:

```
.env                              (committed defaults — not used in this repo)
  ↓
.env.development | .env.production (committed per-mode non-secrets — not used in this repo)
  ↓
.env.local                        (uncommitted; local overrides incl. dev secrets)
  ↓
Runtime environment (Railway / CI)
```

For local development, `frontend/.env.local` is the file you actually edit.

#### Build-time vs. runtime variables (Next.js)

Variables prefixed with `NEXT_PUBLIC_` are **substituted into the static client bundle at
`next build` time**. They are visible to any browser and CANNOT be changed at runtime —
changing `NEXT_PUBLIC_API_URL` requires a `next build` rebuild for the new value to take effect.
Non-`NEXT_PUBLIC_*` vars (`NEXTAUTH_SECRET`, `KEYCLOAK_CLIENT_SECRET`, …) are runtime-only and
readable only from server components, API routes, and middleware.

Sensitive secrets MUST NOT carry the `NEXT_PUBLIC_` prefix.

See [ADR-015 — Configuration and Environment Strategy](_bmad-output/planning-artifacts/architecture.md#adr-015-configuration-and-environment-strategy)
for rationale.

### Running the Application

#### Option 1: Development Mode (Recommended)

**Terminal 1 - Backend:**

```bash
cd backend/src/IabConnect.Api
dotnet run
# API available at http://localhost:5000
```

**Terminal 2 - Frontend:**

```bash
cd frontend
npm run dev
# App available at http://localhost:3000
```

#### Option 2: Using VS Code Tasks

1. Open the project in VS Code
2. Press `Ctrl+Shift+P` → "Tasks: Run Task"
3. Select "Start Backend" and "Start Frontend"

#### Option 3: Container images (Beta-shape)

```bash
# Backend image (multi-stage; bakes BUILD_SHA / BUILD_DATE as unknown by default)
docker build -t iabc-api backend/

# Frontend image — ALL 5 required NEXT_PUBLIC_* must be passed as --build-arg.
# The build now fails fast if any of these five are empty.
docker build \
  --build-arg NEXT_PUBLIC_API_URL=https://api.example.app \
  --build-arg NEXT_PUBLIC_KEYCLOAK_URL=https://kc.example.app \
  --build-arg NEXT_PUBLIC_KEYCLOAK_REALM=iabconnect \
  --build-arg NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=iabconnect-frontend \
  --build-arg NEXT_PUBLIC_KEYCLOAK_ISSUER=https://kc.example.app/realms/iabconnect \
  -t iabc-web frontend/
```

The full GHCR-publish flow with build-arg injection (commit-SHA, ISO date, the rest of the `NEXT_PUBLIC_*` set) is documented separately.

#### Option 4: Local Beta-shape testing (full overlay)

To run the same container topology Railway uses (backend image + frontend image + custom Keycloak image with SPI baked in, all built locally) without burning Railway minutes:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml up --build -d
```

- Web UI: <http://localhost:3000> (BETA banner visible — login via Keycloak)
- Keycloak: <http://localhost:8080> (admin console at `/admin`, login `admin` / `admin-full`)
- API: <http://localhost:5000/health/ready>
- Realm probe: <http://localhost:8080/realms/iabconnect/.well-known/openid-configuration>
- MailHog: <http://localhost:8025> · RustFS console: <http://localhost:9001>

The overlay adds three new services (`api`, `web`, `keycloak-full`) plus a one-shot `keycloak-full-realm-check` health gate. It disables the base `keycloak` service via the `disabled-by-full` profile to free host port 8080. Everyday local dev (Option 1) is unaffected — the base file still works standalone.

**What this overlay does NOT simulate (vs real Beta on Railway):**

The api service runs with `ASPNETCORE_ENVIRONMENT=Development` rather than `Beta` because the backend hardcodes `RequireHttpsMetadata = !(IsDevelopment || Testing)` and local Keycloak runs HTTP only. A surface-level consequence is that several Development-only features are active here that real Beta disables:

- `/swagger` is mounted (real Beta returns 404)
- CORS is permissive (real Beta uses strict CORS via `appsettings.Beta.json`)
- HSTS + HTTPS-redirect are skipped (real Beta enables both)
- Serilog uses Development sinks rather than Beta's Console-only configuration
- Development data seeders + EF `AutoMigrate` run on first boot

The "Beta-shape" intent of the overlay is preserved by (a) Railway-mirroring port mapping (5000/3000/8080), (b) frontend BETA banner via `NEXT_PUBLIC_ENV_LABEL=beta`, (c) container topology with sanitized realm + custom Keycloak image, (d) `RetentionEnforcement__Enabled=false` matching Beta's retention suppression. Real Beta on Railway runs `ASPNETCORE_ENVIRONMENT=Beta` once E14-S2 surfaces `Keycloak__RequireHttpsMetadata` as a config key.

Teardown (drops named volumes — Postgres, RustFS, Seq):

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml down -v
```

Requires Docker Compose v2.20+ (for `profiles:` and `service_completed_successfully`).

### Default Credentials

| Service            | URL                   | Username            | Password        |
| ------------------ | --------------------- | ------------------- | --------------- |
| **Application**    | http://localhost:3000 | admin@iabconnect.ch | Admin-Dev-2026! |
| **Keycloak Admin** | http://localhost:8080 | admin               | admin-dev-2026  |
| **MailHog**        | http://localhost:8025 | -                   | -               |
| **Seq Logs**       | http://localhost:5341 | -                   | -               |
| **RustFS Console** | http://localhost:9001 | rustfsadmin         | rustfsadmin     |

---

## 📁 Project Structure

```
iab-connect/
├── 📂 backend/                      # .NET Backend Solution
│   ├── 📂 src/
│   │   ├── 📂 IabConnect.Api/       # API Layer (Endpoints, DTOs)
│   │   │   ├── Authorization/       # Auth policies and handlers
│   │   │   ├── DTOs/                # Data Transfer Objects
│   │   │   ├── Endpoints/           # Minimal API endpoints
│   │   │   ├── Program.cs           # Application entry point
│   │   │   └── appsettings.json     # Configuration
│   │   │
│   │   ├── 📂 IabConnect.Application/  # Application Layer
│   │   │   ├── Behaviors/           # MediatR pipeline behaviors
│   │   │   ├── Members/             # Member use cases
│   │   │   ├── Communication/       # Email campaign use cases
│   │   │   ├── Events/              # Event use cases
│   │   │   └── Common/              # Shared application logic
│   │   │
│   │   ├── 📂 IabConnect.Domain/    # Domain Layer
│   │   │   ├── Members/             # Member entities & rules
│   │   │   ├── Communication/       # Email domain models
│   │   │   ├── Events/              # Event entities & rules
│   │   │   ├── Authorization/       # Permission definitions
│   │   │   └── Common/              # Base entities, interfaces
│   │   │
│   │   └── 📂 IabConnect.Infrastructure/  # Infrastructure Layer
│   │       ├── Persistence/         # EF Core DbContext, configs
│   │       ├── Migrations/          # Database migrations
│   │       ├── Identity/            # Keycloak integration
│   │       ├── Email/               # Email service implementation
│   │       └── Audit/               # Audit logging
│   │
│   └── 📂 tests/                    # Test Projects
│       ├── IabConnect.Api.Tests/
│       ├── IabConnect.Application.Tests/
│       └── IabConnect.Infrastructure.Tests/
│
├── 📂 frontend/                     # Next.js Frontend
│   ├── 📂 src/
│   │   ├── 📂 app/                  # App Router pages
│   │   │   ├── (auth)/              # Authentication pages
│   │   │   ├── admin/               # Admin dashboard
│   │   │   ├── members/             # Member management
│   │   │   ├── events/              # Event management
│   │   │   └── email-campaigns/     # Email campaigns
│   │   │
│   │   ├── 📂 components/           # React components
│   │   │   ├── ui/                  # Base UI components
│   │   │   ├── navigation/          # Navigation components
│   │   │   └── [feature]/           # Feature-specific components
│   │   │
│   │   ├── 📂 lib/                  # Utilities and API clients
│   │   ├── 📂 types/                # TypeScript type definitions
│   │   └── 📂 i18n/                 # Internationalization config
│   │
│   └── 📂 messages/                 # Translation files
│       ├── de.json                  # German translations
│       └── en.json                  # English translations
│
├── 📂 infra/                        # Infrastructure Configuration
│   ├── docker-compose.yml           # Docker services definition
│   └── 📂 keycloak/
│       └── 📂 realms/
│           └── iabconnect-realm.json  # Keycloak realm config
│
└── 📂 docs/                         # Documentation
    ├── 00_agent_context.md          # AI agent context
    ├── 01_requirements.md           # Functional requirements
    ├── 02_architecture.md           # Architecture documentation
    ├── 03_api_contracts.md          # API specifications
    ├── 04_data_model.md             # Data model documentation
    ├── 05_security_privacy.md       # Security guidelines
    ├── 06_dev_workflow.md           # Development workflow
    ├── 07_dos_donts.md              # Coding guidelines
    └── STARTUP_TROUBLESHOOTING.md   # Troubleshooting guide
```

---

## 📡 API Documentation

### API Base URL

- **Development**: `http://localhost:5000/api/v1`
- **Production**: `https://api.iabconnect.ch/api/v1`

### Authentication

All API endpoints (except health checks) require Bearer token authentication:

```http
Authorization: Bearer <access_token>
```

### Core Endpoints

#### Members

| Method   | Endpoint              | Description                  |
| -------- | --------------------- | ---------------------------- |
| `GET`    | `/members`            | List all members (paginated) |
| `GET`    | `/members/{id}`       | Get member by ID             |
| `GET`    | `/members/me`         | Get current user's profile   |
| `POST`   | `/members`            | Create new member            |
| `PUT`    | `/members/{id}`       | Update member                |
| `DELETE` | `/members/{id}`       | Delete member (soft delete)  |
| `GET`    | `/members/statistics` | Get member statistics        |

#### Events

| Method   | Endpoint               | Description                 |
| -------- | ---------------------- | --------------------------- |
| `GET`    | `/events`              | List all events (paginated) |
| `GET`    | `/events/{id}`         | Get event by ID             |
| `POST`   | `/events`              | Create new event            |
| `PUT`    | `/events/{id}`         | Update event                |
| `DELETE` | `/events/{id}`         | Delete event                |
| `POST`   | `/events/{id}/publish` | Publish event               |
| `POST`   | `/events/{id}/cancel`  | Cancel event                |
| `GET`    | `/events/statistics`   | Get event statistics        |

#### Email Campaigns

| Method   | Endpoint                           | Description          |
| -------- | ---------------------------------- | -------------------- |
| `GET`    | `/email-campaigns`                 | List campaigns       |
| `GET`    | `/email-campaigns/{id}`            | Get campaign details |
| `POST`   | `/email-campaigns`                 | Create campaign      |
| `PUT`    | `/email-campaigns/{id}`            | Update campaign      |
| `DELETE` | `/email-campaigns/{id}`            | Delete campaign      |
| `POST`   | `/email-campaigns/{id}/send`       | Send campaign        |
| `GET`    | `/email-campaigns/{id}/statistics` | Campaign statistics  |

#### Users (Admin)

| Method   | Endpoint                   | Description         |
| -------- | -------------------------- | ------------------- |
| `GET`    | `/users`                   | List Keycloak users |
| `GET`    | `/users/{id}`              | Get user details    |
| `POST`   | `/users/{id}/roles`        | Assign roles        |
| `DELETE` | `/users/{id}/roles/{role}` | Remove role         |

### Response Format

All API responses follow a consistent format:

**Success Response:**

```json
{
  "data": { ... },
  "message": "Operation successful",
  "timestamp": "2026-02-03T22:45:00Z"
}
```

**Paginated Response:**

```json
{
  "items": [ ... ],
  "page": 1,
  "pageSize": 10,
  "totalCount": 150,
  "totalPages": 15,
  "hasNextPage": true,
  "hasPreviousPage": false
}
```

**Error Response:**

```json
{
  "type": "ValidationError",
  "title": "One or more validation errors occurred",
  "status": 400,
  "errors": {
    "email": ["Invalid email format"],
    "firstName": ["First name is required"]
  }
}
```

---

## 🔐 Authentication & Authorization

### Authentication Flow

IAB Connect uses **OpenID Connect (OIDC)** with Keycloak for authentication:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  User    │────▶│ Frontend │────▶│ Keycloak │────▶│ Backend  │
│          │◀────│          │◀────│          │◀────│   API    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                │                │
     │  1. Login      │                │                │
     │───────────────▶│                │                │
     │                │  2. Redirect   │                │
     │                │───────────────▶│                │
     │                │                │                │
     │  3. Authenticate                │                │
     │────────────────────────────────▶│                │
     │                │                │                │
     │  4. Auth Code  │                │                │
     │◀───────────────────────────────│                │
     │                │                │                │
     │                │ 5. Exchange    │                │
     │                │    for Token   │                │
     │                │───────────────▶│                │
     │                │                │                │
     │                │ 6. Access &    │                │
     │                │    Refresh     │                │
     │                │◀───────────────│                │
     │                │                │                │
     │                │ 7. API Request │                │
     │                │    + Token     │                │
     │                │───────────────────────────────▶│
     │                │                │                │
     │                │ 8. Validate    │                │
     │                │    Token       │                │
     │                │                │◀───────────────│
```

### Authorization Model

#### Roles

| Role              | Description                   | Permissions                                      |
| ----------------- | ----------------------------- | ------------------------------------------------ |
| **Admin**         | Full system access            | All permissions                                  |
| **Board Member**  | Association management        | Manage events, view members, send emails         |
| **Kassier**       | Treasurer / Finance lead      | Finance read & write (accounts, invoices, etc.)  |
| **Auditor**       | Financial auditor (read-only) | Finance read access                              |
| **Event-Manager** | Event management lead         | Manage events, registrations, check-ins          |
| **Member**        | Regular member access         | View own profile, view public events, RSVP       |

#### Permissions

```csharp
public static class Permissions
{
    // Member permissions
    public const string MembersRead = "members:read";
    public const string MembersWrite = "members:write";
    public const string MembersDelete = "members:delete";

    // Event permissions
    public const string EventsRead = "events:read";
    public const string EventsWrite = "events:write";
    public const string EventsPublish = "events:publish";

    // Email permissions
    public const string EmailCampaignsRead = "email-campaigns:read";
    public const string EmailCampaignsWrite = "email-campaigns:write";
    public const string EmailCampaignsSend = "email-campaigns:send";

    // Admin permissions
    public const string UsersManage = "users:manage";
    public const string AuditRead = "audit:read";
}
```

---

## 🗄️ Database

### Database Schema

IAB Connect uses PostgreSQL with the following main entities:

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│     Members     │       │     Events      │       │ EmailCampaigns  │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ Id (PK)         │       │ Id (PK)         │       │ Id (PK)         │
│ KeycloakUserId  │       │ Title           │       │ Name            │
│ FirstName       │       │ Description     │       │ Subject         │
│ LastName        │       │ StartDate       │       │ HtmlContent     │
│ Email           │       │ EndDate         │       │ Status          │
│ Phone           │       │ Location        │       │ SegmentType     │
│ MembershipType  │       │ Category        │       │ CreatedById     │
│ Status          │       │ Status          │       │ SentAt          │
│ MemberSince     │       │ Visibility      │       │ CreatedAt       │
│ Address_*       │       │ OrganizerName   │       └────────┬────────┘
│ CreatedAt       │       │ Cost            │                │
│ UpdatedAt       │       │ MaxParticipants │                │
│ IsDeleted       │       │ CreatedAt       │       ┌────────▼────────┐
└─────────────────┘       │ IsDeleted       │       │ EmailRecipients │
                          └─────────────────┘       ├─────────────────┤
                                                    │ Id (PK)         │
┌─────────────────┐       ┌─────────────────┐       │ CampaignId (FK) │
│  EmailTemplates │       │   AuditLogs     │       │ MemberId (FK)   │
├─────────────────┤       ├─────────────────┤       │ Email           │
│ Id (PK)         │       │ Id (PK)         │       │ Status          │
│ Name            │       │ EntityType      │       │ SentAt          │
│ Subject         │       │ EntityId        │       │ OpenedAt        │
│ HtmlContent     │       │ Action          │       │ ClickedAt       │
│ Category        │       │ UserId          │       └─────────────────┘
│ IsActive        │       │ Changes         │
│ CreatedAt       │       │ Timestamp       │
└─────────────────┘       └─────────────────┘
```

### Running Migrations

```bash
cd backend

# Create a new migration
dotnet ef migrations add <MigrationName> \
  --project src/IabConnect.Infrastructure \
  --startup-project src/IabConnect.Api

# Apply migrations
dotnet ef database update \
  --project src/IabConnect.Infrastructure \
  --startup-project src/IabConnect.Api

# Revert last migration
dotnet ef database update <PreviousMigrationName> \
  --project src/IabConnect.Infrastructure \
  --startup-project src/IabConnect.Api

# Remove last migration (if not applied)
dotnet ef migrations remove \
  --project src/IabConnect.Infrastructure \
  --startup-project src/IabConnect.Api
```

---

## 🧪 Testing

### Backend Tests

```bash
cd backend

# Run all tests
dotnet test

# Run with coverage
dotnet test --collect:"XPlat Code Coverage"

# Run specific test project
dotnet test tests/IabConnect.Application.Tests

# Run specific test
dotnet test --filter "FullyQualifiedName~MemberTests"
```

### Test Structure

```
tests/
├── IabConnect.Api.Tests/           # API integration tests
│   └── HealthEndpointTests.cs
├── IabConnect.Application.Tests/   # Application layer unit tests
│   ├── Members/
│   ├── Events/
│   └── Communication/
└── IabConnect.Infrastructure.Tests/ # Infrastructure tests
    └── Repositories/
```

### Frontend Tests

```bash
cd frontend

# Run tests
npm test

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

---

## 🚢 Deployment

### Production Checklist

- [ ] Update all secrets and passwords
- [ ] Configure production database connection string
- [ ] Set up SSL/TLS certificates
- [ ] Configure Keycloak for production
- [ ] Set up email service (SMTP provider)
- [ ] Configure object storage (S3/Azure Blob)
- [ ] Set up monitoring and alerting
- [ ] Configure backup strategy
- [ ] Review and update CORS settings
- [ ] Enable rate limiting
- [ ] Set up CI/CD pipeline

### Environment Variables (Production)

```env
# Database
DATABASE_URL=postgresql://user:password@host:5432/iabconnect

# Keycloak
KEYCLOAK_URL=https://auth.iabconnect.ch
KEYCLOAK_REALM=iabconnect
KEYCLOAK_CLIENT_SECRET=<production-secret>

# Email
SMTP_HOST=smtp.provider.com
SMTP_PORT=587
SMTP_USERNAME=<username>
SMTP_PASSWORD=<password>

# Storage
S3_ENDPOINT=https://s3.iabconnect.ch
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>

# Logging
SEQ_URL=https://logs.iabconnect.ch
SEQ_API_KEY=<api-key>
```

---

## 🔧 Troubleshooting

For detailed troubleshooting instructions, see [STARTUP_TROUBLESHOOTING.md](docs/STARTUP_TROUBLESHOOTING.md).

### Quick Fixes

**PostgreSQL Port Conflict:**

```powershell
# Stop local PostgreSQL service (Windows)
net stop postgresql-x64-17
```

**Keycloak Authentication Issues:**

```bash
# Verify realm import
docker logs iabconnect-keycloak | grep -i "realm"

# Reset Keycloak (deletes all data)
docker compose -f infra/docker-compose.yml down -v
docker compose -f infra/docker-compose.yml up -d
```

**Database Migration Issues:**

```bash
cd backend
dotnet ef database update \
  --project src/IabConnect.Infrastructure \
  --startup-project src/IabConnect.Api
```

---

## 📚 Documentation

| Document                                           | Description                                |
| -------------------------------------------------- | ------------------------------------------ |
| [Requirements](docs/01_requirements.md)            | Functional and non-functional requirements |
| [Architecture](docs/02_architecture.md)            | System architecture and design decisions   |
| [API Contracts](docs/03_api_contracts.md)          | API endpoint specifications                |
| [Data Model](docs/04_data_model.md)                | Database schema and relationships          |
| [Security & Privacy](docs/05_security_privacy.md)  | Security guidelines and GDPR compliance    |
| [Development Workflow](docs/06_dev_workflow.md)    | Git workflow and coding standards          |
| [Do's and Don'ts](docs/07_dos_donts.md)            | Coding guidelines and best practices       |
| [Troubleshooting](docs/STARTUP_TROUBLESHOOTING.md) | Common issues and solutions                |

---

## 🤝 Contributing

We welcome contributions from the community! Please follow these guidelines:

### Development Workflow

1. **Fork** the repository
2. **Create** a feature branch: `git checkout -b feature/amazing-feature`
3. **Commit** your changes: `git commit -m 'feat: add amazing feature'`
4. **Push** to the branch: `git push origin feature/amazing-feature`
5. **Open** a Pull Request

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Code Standards

- Follow existing code style and patterns
- Write unit tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting PR
- Keep PRs focused and reasonably sized

---

## 📄 License

This project is **proprietary software** developed exclusively for private uses.

**© 2026 Harwinder Singh. All Rights Reserved.**

Unauthorized copying, modification, distribution, or use of this software is strictly prohibited without explicit written permission from Hawinder Singh.

---

## 📞 Support

- **Email**: support@iabconnect.ch
- **Documentation**: [docs/](docs/)
- **Issue Tracker**: [GitHub Issues](https://github.com/htos/iab-connect/issues)

---

<p align="center">
  Made with ❤️ for all Associations by Harwinder and Claude ;)
</p>

<p align="center">
  <a href="https://iabconnect.ch">Website</a> •
  <a href="https://docs.iabconnect.ch">Documentation</a> •
  <a href="mailto:support@iabconnect.ch">Contact</a>
</p>
