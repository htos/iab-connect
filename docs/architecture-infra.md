# IAB Connect - Infrastructure Architecture

Date: 2026-05-12
Part: Infrastructure
Location: `infra/`

## Purpose

The infrastructure folder defines the local development environment and identity import support for IAB Connect. It is centered on Docker Compose and provides dependencies needed by the backend and frontend.

## Services

### PostgreSQL

- Image: `postgres:17`
- Container: `iabconnect-postgres`
- Host port: `5433`
- Database: `iabconnect`
- Also used by Keycloak in local development

### Keycloak

- Image: `quay.io/keycloak/keycloak:26.5.2`
- Container: `iabconnect-keycloak`
- Host port: `8080`
- Command: `start-dev --import-realm`
- Imports realm files from `infra/keycloak/realms`
- Loads custom provider jar for disabling new users

### RustFS

- Image: `rustfs/rustfs:latest`
- Container: `iabconnect-rustfs`
- Host ports: `9000`, `9001`
- S3-compatible object storage for documents
- Bucket initialized by `rustfs-init` using MinIO client

### MailHog

- Image: `mailhog/mailhog:latest`
- Ports: SMTP `1025`, UI `8025`
- Captures local development email

### Seq

- Image: `datalust/seq:latest`
- Ports: ingestion `5341`, UI `8081`
- Optional structured log viewer

## Integration With Backend

The backend connects to these services through appsettings/environment configuration:

- PostgreSQL connection string
- Keycloak authority/client configuration
- SMTP host/port for email
- S3-compatible document storage settings
- Seq logging sink, if enabled

## Development Notes

- Start from repository root with `docker compose -f infra/docker-compose.yml up -d`.
- Backend and frontend are not containerized in the current local development model; they run locally in separate terminals.
- PostgreSQL and Keycloak share a database in local development; backend migrations must use EF migrations rather than `EnsureCreated`.
- Backup/restore code uses Docker operations against the PostgreSQL container.

## Operational Risks

- Local passwords and development secrets are suitable for development only.
- Production should use separate secrets, TLS termination, controlled migration execution, storage backups, database backups, and monitored logs.
- Restore testing is important because the application contains finance, document, privacy, and audit data.

---

Generated using BMAD Method `document-project` workflow.

