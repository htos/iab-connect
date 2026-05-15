#!/usr/bin/env bash
# Generates stub story files for E11-S2..E20-S5 (Beta-pivot stubs).
# Run once after Sprint Change Proposal 2026-05-15. Idempotent (overwrites).
set -euo pipefail

OUT_DIR="_bmad-output/implementation-artifacts"
mkdir -p "$OUT_DIR"

write_stub() {
  local epic="$1" story="$2" file="$3" title="$4" role="$5" capability="$6" benefit="$7" req="$8"
  local path="${OUT_DIR}/${file}"
  cat > "$path" <<STORY
# Story ${epic}.${story}: ${title}

Status: draft

<!-- Stub file. Acceptance criteria are authored in Sprint Change Proposal 2026-05-15 Section 5. Run bmad-create-story against this file when the story enters active sprint scope. -->

## Story

As **${role}**, I want **${capability}**, so that **${benefit}**.

**Requirement:** ${req}. Epic E${epic}, Story ${story}. Detailed acceptance criteria authored in Sprint Change Proposal 2026-05-15 Section 5; this stub exists so bmad-create-story can be invoked against it.

## Acceptance Criteria

To be fleshed out via bmad-create-story. The SCP Section 5 entry for E${epic}-S${story} is the source of truth pending that workflow run.

## References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md — Epic E${epic} Story E${epic}-S${story}]
STORY
}

write_stub 11 2 "e11-s2-introduce-aspnetcore-environment-beta.md" "Introduce ASPNETCORE_ENVIRONMENT=Beta" "the maintainer" "a distinct Beta environment label" "Production-grade hardenings apply while a tester-visible label can differentiate Beta from Production" "REQ-088 AC-7"
write_stub 11 3 "e11-s3-make-next-config-environment-driven.md" "Make next.config.ts environment-driven" "the maintainer" "frontend image and API hosts to be environment-driven" "the build is not hardcoded to localhost" "REQ-088 AC-4"

write_stub 12 2 "e12-s2-add-frontend-dockerfile-standalone.md" "Frontend Dockerfile (Next standalone)" "the CI pipeline" "a reproducible frontend image with correct build-time public variables baked in" "Railway pulls identical artifacts on every deploy" "REQ-088 AC-1"
write_stub 12 3 "e12-s3-add-custom-keycloak-image-with-spi.md" "Custom Keycloak image with SPI baked-in" "the deployment" "Keycloak disable-new-users SPI to travel inside the container image" "Railway does not need volume mounts for it" "REQ-088 AC-1"
write_stub 12 4 "e12-s4-add-optional-docker-compose-full.md" "Optional docker-compose.full.yml for local Beta-like testing" "a developer" "to test the full container stack locally" "I can verify a Railway-equivalent setup before pushing to beta" "REQ-088 AC-1"

write_stub 13 1 "e13-s1-create-railway-project-and-services.md" "Create Railway project and services" "the maintainer" "a Railway project iab-connect-beta provisioned with five services" "GitHub-driven deploys can target it" "REQ-088 AC-3"
write_stub 13 2 "e13-s2-configure-railway-environment-variables.md" "Configure Railway environment variables" "the deployed application" "all configuration supplied through Railway variables" "no secrets live in the image" "REQ-088 AC-4"
write_stub 13 3 "e13-s3-enforce-public-and-private-networking.md" "Public networking and private networking enforced" "a security operator" "only the three application services public and the datastore services private" "the database is not internet-reachable" "REQ-088 AC-3"
write_stub 13 4 "e13-s4-add-health-probes-and-first-deploy.md" "Health probes and first end-to-end deploy" "Railway" "healthcheck endpoints to determine readiness" "failed deploys are auto-restarted" "REQ-088 AC-5"

write_stub 14 1 "e14-s1-secrets-audit-and-repo-cleanup.md" "Secrets audit and repository cleanup" "the security reviewer" "to confirm no historic secrets remain in the repo" "the public OSS release is not compromised" "REQ-088 AC-4"
write_stub 14 2 "e14-s2-review-security-headers-and-https.md" "Security headers and HTTPS enforcement review" "the deployed application" "verified Beta security headers and HTTPS enforcement" "the Beta deployment matches Production hardening" "REQ-088 AC-4"
write_stub 14 3 "e14-s3-verify-hangfire-dashboard-dev-only.md" "Verify Hangfire dashboard is dev-only in Beta" "the security reviewer" "confirmation that /hangfire returns 404 in Beta" "the Hangfire dashboard cannot be reached publicly" "REQ-088 AC-4"
write_stub 14 4 "e14-s4-add-rate-limiting-baseline.md" "Rate-limiting baseline" "the deployed API" "conservative rate limits on anonymous and authenticated endpoints" "abuse and brute-force attempts are throttled" "REQ-088 AC-4"
write_stub 14 5 "e14-s5-audit-logs-for-sensitive-data.md" "Log audit for sensitive data" "the security reviewer" "Serilog configuration that does not log passwords or tokens" "secrets are not exposed in Railway logs" "REQ-088 AC-4"

write_stub 15 1 "e15-s1-verify-two-postgres-separation.md" "Verify two-Postgres separation in Beta" "the operator" "postgres-app and postgres-kc as distinct Railway services" "App migrations cannot corrupt the Keycloak schema" "REQ-088 AC-3"
write_stub 15 2 "e15-s2-add-database-automigrate-toggle.md" "Add Database__AutoMigrate toggle" "the deployed API" "a config toggle for the startup migration step" "Production can require manual migration while Beta retains auto-migrate" "REQ-088 AC-3"
write_stub 15 3 "e15-s3-add-daily-postgres-backup-to-rustfs.md" "Daily PostgreSQL backup to RustFS" "the operator" "a daily pg_dump that lands encrypted in the RustFS backups bucket" "Beta has a 24-hour RPO" "REQ-088 AC-6"
write_stub 15 4 "e15-s4-document-beta-seeding-strategy.md" "Beta seeding strategy" "the maintainer" "documentation of how the first Beta admin is provisioned" "onboarding has a deterministic starting state" "REQ-088 AC-3"

write_stub 16 1 "e16-s1-verify-frontend-public-urls.md" "Verify frontend public URLs" "the deployed frontend" "build artifacts that reference the correct Beta API and Keycloak domains" "no localhost references reach production code paths" "REQ-088 AC-5"
write_stub 16 2 "e16-s2-validate-end-to-end-oidc-in-beta.md" "End-to-end OIDC test in Beta" "a tester" "a working login flow against the Beta Keycloak" "the integration is verified before tester onboarding" "REQ-088 AC-5"
write_stub 16 3 "e16-s3-validate-document-upload-against-rustfs.md" "Document upload and download against RustFS" "a tester" "to upload and download documents in Beta" "the storage integration is verified end-to-end" "REQ-088 AC-5"

write_stub 17 1 "e17-s1-restrict-serilog-to-console-in-containers.md" "Serilog Console-only for container envs" "the deployed API" "a Console-only logging configuration in Beta" "container ephemeral filesystem does not break logging" "REQ-088 AC-5"
write_stub 17 2 "e17-s2-validate-structured-logs-with-correlation-id.md" "Structured logs with CorrelationId" "the operator" "Railway logs with CorrelationId enrichment" "incidents can be traced across the request lifecycle" "REQ-088 AC-5"
write_stub 17 3 "e17-s3-add-frontend-api-health-endpoint.md" "Frontend /api/health endpoint" "Railway" "a healthcheck endpoint on the web service" "liveness can be polled" "REQ-088 AC-5"
write_stub 17 4 "e17-s4-add-external-uptime-monitoring.md" "External uptime monitoring" "the operator" "a 5-minute polling monitor on /health/ready" "outages are detected within 15 minutes" "REQ-088 AC-5"

write_stub 18 1 "e18-s1-author-runbook-beta.md" "Author RUNBOOK-beta.md" "the operator" "a deployment plus rollback plus restore runbook for Beta" "incidents have a documented response" "REQ-088 AC-10"
write_stub 18 2 "e18-s2-author-beta-tester-onboarding-guide.md" "Beta tester onboarding guide" "a Beta tester" "a one-page guide explaining login scope and feedback" "tester self-onboarding without maintainer back-and-forth" "REQ-088 AC-7"
write_stub 18 3 "e18-s3-add-beta-banner-in-ui.md" "Beta banner in UI" "a Beta tester" "a persistent orange banner indicating Beta status" "expectations are set about data and stability" "REQ-088 AC-7"
write_stub 18 4 "e18-s4-add-feedback-channel.md" "Feedback channel" "a Beta tester" "a clear path to report bugs and suggestions" "tester feedback reaches the maintainer" "REQ-088 AC-7"

write_stub 19 1 "e19-s1-add-custom-domain-runbook-entry.md" "Custom-domain runbook entry" "the operator" "documented steps to migrate from Railway-default to a custom domain" "production migration is planned" "REQ-088 AC-10"
write_stub 19 2 "e19-s2-perform-backup-restore-drill.md" "Backup restore drill" "the operator" "a tested backup-to-restore cycle" "the recovery procedure is proven not just documented" "REQ-088 AC-6"
write_stub 19 3 "e19-s3-define-production-gate-checklist.md" "Production gate checklist" "the maintainer" "measurable thresholds for response-time error-rate and uptime" "the Beta-to-Production transition has clear criteria" "REQ-088 AC-10"
write_stub 19 4 "e19-s4-document-postal-smtp-migration-plan.md" "Self-host SMTP migration plan (Postal on Hetzner)" "the operator" "a documented path from Mailtrap-Sandbox to self-hosted Postal" "the OSS-sovereignty option is ready when needed" "REQ-088 AC-9"

write_stub 20 2 "e20-s2-add-spdx-headers-policy-for-new-files.md" "Add SPDX headers policy for new files going forward" "a contributor" "a documented policy for SPDX headers on new files" "REUSE-compliance grows incrementally without a mass sweep" "REQ-089 AC-6"
write_stub 20 3 "e20-s3-add-backend-about-endpoint.md" "Add backend /about endpoint" "a user of a network-deployed instance" "to find the source code corresponding to the running version" "AGPL section 13 rights can be exercised" "REQ-089 AC-5"
write_stub 20 4 "e20-s4-add-frontend-license-footer.md" "Add frontend license footer" "a network user" "a persistent footer link to the source repository" "the running instance discloses its source per AGPL section 13" "REQ-089 AC-4"
write_stub 20 5 "e20-s5-add-ghcr-image-publishing-pipeline.md" "GHCR image publishing pipeline" "a self-hoster" "pre-built application images on GHCR" "I do not have to build from source" "REQ-088 AC-1 + REQ-089 AC-7"

echo "Stub count: $(ls "$OUT_DIR" | grep -E '^e(1[1-9]|20)-s[0-9]+-.*\.md$' | wc -l)"
