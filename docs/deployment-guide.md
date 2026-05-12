# IAB Connect - Deployment Guide

Date: 2026-05-12

## Current Deployment Model

The repository primarily documents local development with Docker Compose infrastructure and locally-run backend/frontend processes. Existing docs describe a future production model with controlled backend migrations, containerized infrastructure, TLS termination, monitoring, backups, and environment-specific secrets.

## Production Components

Expected production components:

- ASP.NET Core backend API
- Next.js frontend
- PostgreSQL database
- Keycloak identity provider
- S3-compatible object storage or equivalent
- SMTP/email provider
- Structured logging/monitoring
- Backup and restore storage/process

## Environment Configuration

Backend needs:

- Database connection string
- Keycloak authority/client/audience/admin service configuration
- SMTP settings
- Document storage settings
- Seq/logging settings if enabled
- Backup Docker/container settings where applicable

Frontend needs:

- `NEXT_PUBLIC_API_URL`
- Keycloak/NextAuth settings
- NextAuth secret/callback configuration

## Deployment Process Notes

1. Build backend and frontend.
2. Apply database migrations in a controlled way.
3. Deploy backend and frontend with environment-specific secrets.
4. Verify Keycloak realm/client configuration.
5. Verify object storage bucket and permissions.
6. Verify SMTP/email behavior.
7. Verify health checks and logs.
8. Verify backup and restore procedure.

## Migration Guidance

- Use EF Core migrations only.
- Review generated migrations before deployment.
- Apply migrations in staging before production.
- Avoid manual schema changes.
- Consider Keycloak and application DB coexistence in local development when debugging migration behavior.

## Security and Compliance

- Use production secrets, never development defaults.
- Use TLS for public endpoints.
- Keep backend authorization as the security boundary.
- Audit sensitive actions.
- Preserve retention/anonymization rules.
- Test backup restore periodically.

## Operational Checks

- `/health`
- `/health/ready`
- admin-only `/health/detail`
- Serilog/Seq logs
- Hangfire recurring jobs
- Mail delivery path
- RustFS/S3 storage availability
- PostgreSQL backup/restore

## Open Deployment Gaps

- No full production CI/CD pipeline was verified in this scan.
- Local Compose is development-oriented and should not be treated as production hardening.
- Production infrastructure-as-code is not present beyond Docker Compose.

---

Generated using BMAD Method `document-project` workflow.

