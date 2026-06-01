# Story 13.2: Configure Railway environment variables

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **the deployed application running on Railway**,
I want **all configuration supplied through Railway service variables (resolved with `${{<service>.<VAR>}}` cross-references) so that no secrets are baked into the container image and no production values live in the repository**,
so that **the Beta deployment can reach a healthy state on first deploy, the runtime configuration surface is auditable from the Railway dashboard, and self-hosters can reproduce the wiring from the documented variable list**.

**Requirement:** REQ-088 AC-4 (Beta Deployment Readiness — environment-variable-driven configuration). Epic E13 (Railway Beta Deployment), Story 2 of 4. Wave-6 middle deliverable.

**Upstream (HARD dependencies — this story is blocked until all are confirmed):**
- **E13-S1 (Railway project + 6 services)** — all six service skeletons (`web`, `api`, `keycloak`, `rustfs`, `postgres-app`, `postgres-kc`) must exist with the JDBC seed block for `keycloak` (E13-S1 AC-7) and the RustFS root credentials (E13-S1 AC-5). The `${{<service>.<VAR>}}` references this story writes will resolve to empty strings if the referenced service doesn't exist; Railway treats missing references as empty without erroring at save-time — silent failure.
- **Wave-3 Dockerfiles done** ([backend/Dockerfile](backend/Dockerfile), [frontend/Dockerfile](frontend/Dockerfile), [infra/keycloak/Dockerfile](infra/keycloak/Dockerfile)) — defining what env vars each image consumes. Verified done (Epic-12).
- **Wave-2 config surface done** ([backend/.env.example](backend/.env.example), [frontend/.env.example](frontend/.env.example), [backend/src/IabConnect.Api/appsettings.Beta.json](backend/src/IabConnect.Api/appsettings.Beta.json)) — the canonical inventory of variables this story populates on Railway. Verified done (Epic-11).
- **Wave-5 GHCR `:beta` image refresh after E13-S1 chicken-and-egg resolution** — the `web` image must have been rebuilt with the correct `NEXT_PUBLIC_*_BETA` GHA repo variables AFTER Railway assigned hostnames in E13-S1 Task 2; otherwise the frontend bundle has the wrong `NEXT_PUBLIC_API_URL` baked in and runtime env vars CANNOT fix it (NEXT_PUBLIC_* is build-time-only — [frontend/.env.example](frontend/.env.example) lines 18, 41, 50 spell this out).

**Downstream:**
- **E13-S3** (networking) — depends on `keycloak`'s `KC_HOSTNAME` and `api`'s `Frontend__BaseUrl` set in this story, both of which assume public domains are enabled.
- **E13-S4** (health + first deploy) — depends on every service reaching a healthy boot, which depends on every required variable in this story being populated.
- **E14** (security audit) — verifies the secret surface this story establishes (Sealed flags, no plaintext secrets in logs, etc.).
- **E15-S3** (daily backup) — consumes `Backup__EncryptionKey`, `Backup__Directory`, RustFS access credentials (all in `api` service).
- **E17-S1** (Serilog Console-only in containers) — already baked into [appsettings.Beta.json](backend/src/IabConnect.Api/appsettings.Beta.json) lines 2-5, no runtime override needed.

**Wave context:** Wave 6 middle. **NO source-code artifacts** beyond updating [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md) (created in E13-S1) with the variable enumeration. All work happens in the Railway dashboard Variables tabs per service.

## Acceptance Criteria

1. **Each service's variables match the canonical list documented in [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md) — section "Railway Variables per Service"**. The doc must inventory every variable, its value or `${{…}}` reference, its Sealed status (yes/no), and a one-sentence rationale citing the consuming file:line (e.g., "Read at [backend/src/IabConnect.Api/DependencyInjection.cs#L139](backend/src/IabConnect.Api/DependencyInjection.cs#L139)"). The doc IS the contract; the Railway state must mirror it byte-for-byte.

2. **`api` service has all required runtime variables set**:
   - **Application**: `ASPNETCORE_ENVIRONMENT=Beta` (activates [appsettings.Beta.json](backend/src/IabConnect.Api/appsettings.Beta.json) overlay per ADR-015 — Console-only Serilog, retention-disabled).
   - **Database**: `ConnectionStrings__DefaultConnection=Host=${{postgres-app.RAILWAY_PRIVATE_DOMAIN}};Port=${{postgres-app.PGPORT}};Database=${{postgres-app.PGDATABASE}};Username=${{postgres-app.PGUSER}};Password=${{postgres-app.PGPASSWORD}}` (Sealed). Format matches Npgsql connection-string syntax consumed at [backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L53](backend/src/IabConnect.Infrastructure/DependencyInjection.cs#L53).
   - **Identity (Keycloak)**: `Keycloak__Authority=https://${{keycloak.RAILWAY_PUBLIC_DOMAIN}}/realms/iabconnect`, `Keycloak__ClientId=iabconnect-api`, `Keycloak__ClientSecret=<from realm; Sealed>`, `KeycloakAdmin__BaseUrl=https://${{keycloak.RAILWAY_PUBLIC_DOMAIN}}`, `KeycloakAdmin__Realm=iabconnect`, `KeycloakAdmin__ClientId=iabconnect-admin`, `KeycloakAdmin__ClientSecret=<from realm; Sealed>`, `Auth__CalendarTokenPepper=<random ≥ 32 chars; Sealed>`.
   - **Frontend (CORS)**: `Frontend__BaseUrl=https://${{web.RAILWAY_PUBLIC_DOMAIN}}` — used at [backend/src/IabConnect.Api/DependencyInjection.cs#L111](backend/src/IabConnect.Api/DependencyInjection.cs#L111) for the strict CORS allowlist (Beta NOT Development per ADR-015 → the strict branch at line 124-129 runs; one allowed origin only).
   - **Object storage**: `DocumentStorage__ServiceUrl=http://${{rustfs.RAILWAY_PRIVATE_DOMAIN}}:9000`, `DocumentStorage__AccessKey=${{rustfs.RUSTFS_ROOT_USER}}`, `DocumentStorage__SecretKey=${{rustfs.RUSTFS_ROOT_PASSWORD}}` (Sealed), `DocumentStorage__BucketName=iabconnect-documents`, `DocumentStorage__UseHttps=false` (private network, no TLS).
   - **Mail (Mailtrap sandbox per ADR-018 — see also deferred-work.md E13-FT-1)**: `Smtp__Host=sandbox.smtp.mailtrap.io`, `Smtp__Port=587`, `Smtp__EnableSsl=true`, `Smtp__Username=<Mailtrap inbox creds; Sealed>`, `Smtp__Password=<Mailtrap inbox creds; Sealed>`, `Smtp__FromEmail=noreply@iabconnect.app`, `Smtp__FromName=IAB Connect`, `Email__UnsubscribeSecret=<random ≥ 32 chars; Sealed>`. **Tracked**: switch to real SMTP provider before opening Beta to non-Harry testers (see deferred-work.md E13-FT-1 + E19-S4).
   - **Branding** (defaults from [appsettings.json](backend/src/IabConnect.Api/appsettings.json) already ship `IAB Connect API` — override only if a fork wants a different name): `Branding__SourceUrl=https://github.com/htos/iab-connect` (matches `/about` endpoint contract per E20-S3 / ADR-021). Leave `Branding__ApiTitle` unset to inherit the default; the orange BETA banner from `NEXT_PUBLIC_ENV_LABEL=beta` (E11-S2) is the legitimate Beta-environment indicator — branding strings stay production-clean.
   - **Invoicing** (real values — invoices are generated and visible to testers even though mail is sandboxed; see Q1): `InvoiceSettings__OrganizationName=<real org name>`, `InvoiceSettings__OrganizationAddress=<real postal address>`, `InvoiceSettings__OrganizationEmail=info@iabconnect.app`, `InvoiceSettings__PaymentInstructions=<real payment instructions>`, `InvoiceSettings__Currency=CHF`, `InvoiceSettings__DefaultPaymentTermDays=30`. **The 3 angle-bracketed values MUST be set by Harry before Task 1.2 saves** — these strings appear on every generated invoice PDF and on the Swiss QR-bill.
   - **Operations**: `RetentionEnforcement__Enabled=false` (REQ-088 / ADR-020 — also enforced by [appsettings.Beta.json](backend/src/IabConnect.Api/appsettings.Beta.json) lines 11-13; runtime env var is belt-and-suspenders), `Backup__Directory=/tmp/backups` (ephemeral path; the encrypted dump is immediately uploaded to RustFS per E15-S3 — local-disk landing is throwaway), `Backup__EncryptionKey=<base64-encoded 32-byte random; Sealed>`, `Database__AutoMigrate=true` (ADR-015 — Beta auto-migrates).
   - **Logging**: `Logging__LogLevel__Default=Information` (matches [appsettings.Beta.json](backend/src/IabConnect.Api/appsettings.Beta.json) line 8). Hangfire dashboard variable NOT set — [appsettings.json#L55-L57](backend/src/IabConnect.Api/appsettings.json) is irrelevant in Beta because the dashboard is mounted only when `IsDevelopment()` per [backend/src/IabConnect.Api/DependencyInjection.cs#L293-L295](backend/src/IabConnect.Api/DependencyInjection.cs#L293-L295).

3. **`web` service has all required runtime variables set** (NEXT_PUBLIC_* are NOT runtime — they're baked into the image per [frontend/Dockerfile#L44-L66](frontend/Dockerfile#L44-L66) — but server-side NextAuth + Keycloak secrets ARE runtime):
   - **NextAuth**: `NEXTAUTH_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}` (must match the actual Railway public hostname; used by NextAuth callback handling), `NEXTAUTH_SECRET=<random ≥ 32 chars; Sealed>` (HMAC for NextAuth JWT signing — rotating invalidates all active sessions; read at [frontend/middleware.ts](frontend/middleware.ts), commented in [frontend/.env.example#L24-L26](frontend/.env.example#L24-L26)).
   - **Keycloak OIDC (server-side)**: `KEYCLOAK_CLIENT_ID=iabconnect-frontend`, `KEYCLOAK_CLIENT_SECRET=<from realm; Sealed>`, `KEYCLOAK_ISSUER=https://${{keycloak.RAILWAY_PUBLIC_DOMAIN}}/realms/iabconnect` (read at [frontend/src/app/api/auth/[...nextauth]/route.ts](frontend/src/app/api/auth/[...nextauth]/route.ts)).
   - **CRITICAL parity invariant**: `KEYCLOAK_ISSUER` (runtime, this story) MUST be byte-identical to `NEXT_PUBLIC_KEYCLOAK_ISSUER` (baked into image via `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` repo variable — E13-S1 Task 0.2 chicken-and-egg). Documented in [frontend/.env.example#L34-L36](frontend/.env.example#L34-L36). If they drift, server-side OIDC verification rejects browser-issued tokens silently (404 on OIDC discovery OR redirect-loop on login). The Quality-Gates verification step diffs the two values.
   - **Optional**: `NODE_ENV=production` (already baked at [frontend/Dockerfile#L94](frontend/Dockerfile#L94); runtime override not needed). `PORT` — Railway auto-injects; the image defaults to 3000 but Railway may override; both behaviors are safe because Next.js standalone reads `process.env.PORT`.

4. **`keycloak` service has all required runtime variables set** (in addition to the JDBC block from E13-S1 AC-7):
   - **Hostname**: `KC_HOSTNAME=${{keycloak.RAILWAY_PUBLIC_DOMAIN}}` (Railway-assigned `<service>-<random>.up.railway.app`). This is the canonical hostname Keycloak emits in token issuers and OIDC discovery; mismatch breaks JWT validation downstream.
   - **Proxy**: `KC_PROXY=edge` (Railway terminates TLS at the edge; the container speaks HTTP internally — Keycloak must trust the `X-Forwarded-*` headers).
   - **HTTP enabled**: `KC_HTTP_ENABLED=true` (container speaks HTTP behind Railway's TLS terminator). Without this, Keycloak refuses to start because the default mode requires HTTPS.
   - **Health probe enablement**: `KC_HEALTH_ENABLED=true` (exposes `/health/ready`; consumed by E13-S4 AC-3).
   - **Metrics**: `KC_METRICS_ENABLED=false` (no Prometheus scrape in Beta; defer to E17 if needed).
   - **Admin bootstrap** (one-time, per the iabconnect-realm.json import contract): `KEYCLOAK_ADMIN=admin` AND `KEYCLOAK_ADMIN_PASSWORD=<random ≥ 16 chars; Sealed>` — Keycloak 26 uses these env-var names for the initial master admin. Document the admin password in a Bitwarden/1Password entry; ONLY Harry knows it. **AFTER first Keycloak boot, this story's Task 3.6 creates a personal Harry-admin account in the master realm and queues the env-var-seeded `admin` for removal** (tracked at deferred-work.md E13-FT-5 because the actual delete requires a successful login as the personal admin — chicken-and-egg if it fails). The env-var pair remains in Railway until E13-FT-5 fires.
   - **Realm-secret placeholder substitution** ([infra/keycloak/realms-beta/iabconnect-realm.json](infra/keycloak/realms-beta/iabconnect-realm.json) — placeholders `${IABCONNECT_*_CLIENT_SECRET}` are resolved by Keycloak's env-var substitution at realm-import time):
     - `IABCONNECT_API_CLIENT_SECRET=<random ≥ 32 chars; Sealed>` (the value of the `iabconnect-api` client secret in the imported realm — must match `api` service's `Keycloak__ClientSecret`).
     - `IABCONNECT_ADMIN_CLIENT_SECRET=<random ≥ 32 chars; Sealed>` (the value of the `iabconnect-admin` client secret — must match `api` service's `KeycloakAdmin__ClientSecret`).
     - `IABCONNECT_FRONTEND_CLIENT_SECRET=<random ≥ 32 chars; Sealed>` (the value of the `iabconnect-frontend` client secret — must match `web` service's `KEYCLOAK_CLIENT_SECRET`).
   - **JVM tuning** (optional but documented in `docs/14_beta_railway_setup.md`): `JAVA_OPTS_KC_HEAP=-Xms256m -Xmx512m` (Hobby plan memory ceiling; raise if Keycloak OOMs on first import).

5. **All sensitive variables are marked `Sealed`** where Railway supports it. Specifically, every variable in ACs 2/3/4 annotated `(Sealed)` must have the Seal toggle ON in Railway's Variables tab. Sealed variables are encrypted at rest, visible only to the deploying user, and never echo to logs. Unsealing a variable is a one-way action per Railway docs — verify the seal state via the lock icon in the dashboard.

6. **The `api` service has `RetentionEnforcement__Enabled=false`** as an explicit env var (REQ-088 / ADR-020). This duplicates the [appsettings.Beta.json](backend/src/IabConnect.Api/appsettings.Beta.json) value (lines 11-13) because:
   - ASP.NET Core env-var-source precedence beats JSON sources (per [backend/.env.example#L6-L7](backend/.env.example#L6-L7)).
   - Future operators looking at the Railway dashboard see the flag without needing to know about the JSON overlay layering.
   - A misconfigured `ASPNETCORE_ENVIRONMENT` (e.g., accidentally `Production` instead of `Beta`) would NOT enable retention enforcement — defense in depth.

7. **The `web` service has `NEXT_PUBLIC_ENV_LABEL=beta` baked** (per E11-S2; covered upstream via `NEXT_PUBLIC_ENV_LABEL_BETA` GHA repo variable set in E13-S1 prerequisites; this story verifies via `/about`-adjacent test in AC-9). **And** `NEXT_PUBLIC_SOURCE_URL=https://github.com/htos/iab-connect` baked (per E20-S3 / E20-S4 / ADR-021). Both are runtime-immutable; no Railway env var fixes a drift.

8. **The Keycloak realm-import contract is intact**: a Keycloak service boot AFTER all 4 `IABCONNECT_*_CLIENT_SECRET` variables are set should produce three clients with non-empty secrets in the realm. Verify via `kc.sh export --realm iabconnect --file /tmp/realm-check.json` after first boot (or by inspecting the Admin Console at `https://<keycloak-public-domain>/admin/`, Clients tab — secrets are visible to the master admin).

9. **Cross-story orthogonal-AC verification** (per A31):
   - **OIDC issuer parity (3 anchors)**: `KEYCLOAK_ISSUER` (web runtime) ≡ `NEXT_PUBLIC_KEYCLOAK_ISSUER` (web image baked) ≡ `Keycloak__Authority` (api runtime). All three must be `https://<keycloak-public-domain>/realms/iabconnect`. Diff the three values; if any drift, login flow breaks silently.
   - **Client-secret three-way parity (3 anchors per client × 3 clients = 9 checks)**: every `<*_CLIENT_SECRET>` Sealed value in Keycloak's env block matches the corresponding consumer's secret (api's `Keycloak__ClientSecret` = realm's `iabconnect-api` secret = `IABCONNECT_API_CLIENT_SECRET`; similarly for `iabconnect-admin` and `iabconnect-frontend`).
   - **Frontend BaseUrl ≡ CORS allowlist**: `Frontend__BaseUrl` (api runtime) MUST equal `NEXTAUTH_URL` (web runtime) MUST equal the Railway public domain of `web`. CORS allowlist on the api side (strict in Beta — [DependencyInjection.cs#L124-L129](backend/src/IabConnect.Api/DependencyInjection.cs#L124-L129)) admits only this one origin.
   - **RustFS-credential parity (3 anchors)**: `RUSTFS_ROOT_USER` (set on rustfs in E13-S1) ≡ `DocumentStorage__AccessKey` (this story, api) via `${{rustfs.RUSTFS_ROOT_USER}}` reference; same for password.
   - **`Branding__SourceUrl` parity**: api runtime equals [appsettings.json:38](backend/src/IabConnect.Api/appsettings.json) default equals [/about](backend/src/IabConnect.Api/Endpoints/AboutEndpoints.cs) endpoint contract (E20-S3) equals `NEXT_PUBLIC_SOURCE_URL` baked in web image.

10. **Documentation update**: [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md) "Railway Variables per Service" section enumerates every variable from ACs 2/3/4 with: name, value-or-reference, Sealed (Y/N), rationale-with-anchor. Section header level matches the file structure created in E13-S1 Task 6.

11. **No secret value is committed to the repo** in service of this story: not in `docs/14_beta_railway_setup.md`, not in the story file's task list, not in any [.env.example](backend/.env.example) update. The doc records variable NAMES and `${{…}}` REFERENCES — never the resolved Sealed values. Verified by `git grep -inE 'NEXTAUTH_SECRET\s*=|CLIENT_SECRET\s*=|EncryptionKey\s*=' -- docs/ _bmad-output/` returning only references to the variable name + Sealed flag, NEVER a value that looks like a real secret.

## Tasks / Subtasks

- [ ] **Task 0 — SPIKE: confirm Wave-3 + Wave-5 + E13-S1 prerequisites, classify build-time vs runtime vars** (AC-1..AC-11)
  - [ ] 0.1 Verify E13-S1 done: all 6 Railway services exist, JDBC seed block on `keycloak` set, RustFS credentials on `rustfs` set + Sealed. Snapshot the Railway Variables tabs.
  - [ ] 0.2 Verify Wave-3 Dockerfiles in beta:HEAD: read each Dockerfile and confirm the env-var contract: backend reads `ConnectionStrings__DefaultConnection`, `Keycloak__*`, `Frontend__BaseUrl`, `DocumentStorage__*`, `Smtp__*`, `Auth__CalendarTokenPepper`, `RetentionEnforcement__Enabled`, `Backup__*` (cross-check against [backend/.env.example](backend/.env.example)); frontend reads `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `KEYCLOAK_*` server-side ([frontend/.env.example](frontend/.env.example) lines 23-37); keycloak reads `KC_DB_*` (set in E13-S1), `KC_HOSTNAME`, `KC_PROXY`, `KC_HTTP_ENABLED`, `KC_HEALTH_ENABLED`, `KEYCLOAK_ADMIN`, `KEYCLOAK_ADMIN_PASSWORD`, `IABCONNECT_*_CLIENT_SECRET` (realm placeholders per [infra/keycloak/Dockerfile#L30](infra/keycloak/Dockerfile#L30) + ADR-016).
  - [ ] 0.3 **Build-time vs runtime classification** (critical so the dev-agent doesn't try to set NEXT_PUBLIC_* on Railway thinking it'll take effect):
    - Build-time only (baked at GHA image build via build-args): `BUILD_SHA`, `BUILD_DATE`, all 9 `NEXT_PUBLIC_*` ([frontend/Dockerfile#L49-L57](frontend/Dockerfile#L49-L57)).
    - Runtime: every backend `__`-syntax var; web's NextAuth + server-side Keycloak vars; keycloak's KC_* vars (except KC_DB which is build-time-frozen under `--optimized` per [infra/keycloak/Dockerfile#L32-L37](infra/keycloak/Dockerfile#L32-L37)).
    - Document the classification in `docs/14_beta_railway_setup.md` so a future operator does not try to set `NEXT_PUBLIC_API_URL` on Railway and wonder why it had no effect.
  - [ ] 0.4 Resolve Q1-Q4 below by reading existing artifacts. Spike output: one line either `proceed` OR `escalate: <blocker>`.

- [ ] **Task 1 — Populate `api` service variables** (AC-2, AC-5, AC-6)
  - [ ] 1.1 Generate Sealed random values where required: `Auth__CalendarTokenPepper` (≥ 32 chars), `Email__UnsubscribeSecret` (≥ 32 chars), `Backup__EncryptionKey` (32 bytes base64-encoded). Use a known-good generator (`openssl rand -base64 32` for the last one, `pwgen -s 64 1` for the others). NEVER use predictable values. NEVER commit the values; they live ONLY in Railway.
  - [ ] 1.2 Add every variable from AC-2 to the `api` service Variables tab. Sealed where the AC annotates `(Sealed)`. References use `${{<service>.<VAR>}}` syntax with the exact service names from E13-S1.
  - [ ] 1.3 Verify Railway resolves all references after save by clicking "Deploy" → wait for deploy to start (don't wait for healthy — env-var resolution happens at deploy-trigger time, error in resolution surfaces in deploy logs as `Reference 'X' could not be resolved`).

- [ ] **Task 2 — Populate `web` service variables** (AC-3, AC-5, AC-7)
  - [ ] 2.1 Generate Sealed `NEXTAUTH_SECRET` (≥ 32 chars).
  - [ ] 2.2 Add every variable from AC-3 to the `web` service Variables tab. Sealed where the AC annotates `(Sealed)`.
  - [ ] 2.3 **Critical parity check**: confirm `KEYCLOAK_ISSUER` value equals the `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` GHA repo variable byte-for-byte. Read the repo variable with `gh api /repos/htos/iab-connect/actions/variables/NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA --jq .value` and diff. Drift between these two strings is the #1 silent-failure mode for the login flow.

- [ ] **Task 3 — Populate `keycloak` service variables (KC_* runtime + realm-import placeholders)** (AC-4, AC-5, AC-8)
  - [ ] 3.1 Generate Sealed `KEYCLOAK_ADMIN_PASSWORD` (≥ 16 chars); store in Harry's password manager IMMEDIATELY — recovery from a lost admin password requires Railway's `kc.sh bootstrap-admin` one-shot, awkward but possible.
  - [ ] 3.2 Generate Sealed `IABCONNECT_API_CLIENT_SECRET`, `IABCONNECT_ADMIN_CLIENT_SECRET`, `IABCONNECT_FRONTEND_CLIENT_SECRET` (each ≥ 32 chars).
  - [ ] 3.3 Add all KC_* runtime vars from AC-4 to the `keycloak` service Variables tab.
  - [ ] 3.4 In the `api` service Variables tab, set `Keycloak__ClientSecret=${{keycloak.IABCONNECT_API_CLIENT_SECRET}}` and `KeycloakAdmin__ClientSecret=${{keycloak.IABCONNECT_ADMIN_CLIENT_SECRET}}`. Verify Sealed propagation works through the reference (Railway preserves Sealed-on-Sealed across `${{…}}`).
  - [ ] 3.5 In the `web` service Variables tab, set `KEYCLOAK_CLIENT_SECRET=${{keycloak.IABCONNECT_FRONTEND_CLIENT_SECRET}}`.
  - [ ] 3.6 [!] **Personal admin bootstrap** (Harry, after `keycloak` reaches healthy state): sign in to `https://<keycloak-public-domain>/admin/` as `admin` (the env-var-seeded master admin) → Users → Add user `harry@iabconnect.app` → Credentials tab → set permanent password → Role mappings → assign `admin` role from the master realm. Verify the personal admin can sign in (open a private/incognito window, log out the env-var admin's session). Record that the personal admin works in the Quality-Gates evidence column for AC-4. The env-var-seeded `admin` user stays in the database for now — deletion is tracked at deferred-work.md E13-FT-5 (deletion blocked on the personal admin proving fully functional across a Beta-week of normal use).

- [ ] **Task 4 — Cross-story orthogonal parity verification** (AC-9, per A31)
  - [ ] 4.1 **OIDC issuer 3-way diff**: `KEYCLOAK_ISSUER` (web Variables) vs `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` (`gh api`) vs `Keycloak__Authority` (api Variables). All three must be `https://<keycloak-public-domain>/realms/iabconnect` byte-identical.
  - [ ] 4.2 **Client-secret 3-way checks (×3 clients)**: for each of `iabconnect-api`, `iabconnect-admin`, `iabconnect-frontend`, verify the value chain consumer↔reference↔realm-import-placeholder is consistent. Sealed values are not readable from the UI; this check is structural (the `${{…}}` reference must resolve to the right named source), not byte-comparative.
  - [ ] 4.3 **Frontend BaseUrl ≡ CORS allowlist**: `Frontend__BaseUrl` (api) = `NEXTAUTH_URL` (web) = Railway public domain of `web` ≡ `https://<web-public-domain>`. Document the resolved string in the Quality-Gates table.
  - [ ] 4.4 **RustFS credentials**: `${{rustfs.RUSTFS_ROOT_USER}}` reference resolves correctly (visible in api deploy logs as a non-empty value).
  - [ ] 4.5 **Branding source URL parity**: `Branding__SourceUrl` (api Variables) = [appsettings.json](backend/src/IabConnect.Api/appsettings.json) default = [AboutEndpoints.cs](backend/src/IabConnect.Api/Endpoints/AboutEndpoints.cs) projection literal = `NEXT_PUBLIC_SOURCE_URL` baked in image. Document.

- [ ] **Task 5 — Trigger a fresh deploy and verify env-var resolution** (AC-9)
  - [ ] 5.1 In each of `api`, `web`, `keycloak`: click "Deploy" → "Redeploy" to force a fresh container start with the new env-var set.
  - [ ] 5.2 [!] **Manual smoke** (dev-agent records as `[!]` per A30, Harry verifies):
    - `keycloak` reaches a healthy state in the deploy logs (look for "Keycloak 26.5.2 on JVM ... started in"). If it crash-loops with a JDBC error, KC_DB_URL or password is wrong → re-verify E13-S1 AC-7 + this story Task 3.
    - `api` reaches a healthy state. First-boot symptoms can include EF Core migration log lines (expected — Beta auto-migrates per ADR-015); a 30-60s warm-up to reach `/health/ready=200` is normal.
    - `web` reaches a healthy state. NextAuth log line `[next-auth] ... GET /api/auth/providers 200` indicates the server-side OIDC discovery succeeded against `KEYCLOAK_ISSUER` — confirms parity AC-9.1.
  - [ ] 5.3 [!] Browser smoke (Harry, NOT dev-agent): navigate to `https://<web-public-domain>/login`, attempt sign-in against Keycloak — expect redirect to `https://<keycloak-public-domain>/realms/iabconnect/protocol/openid-connect/auth?...`. If the redirect URL has the wrong hostname OR wrong realm OR a port number, ACs 4 (`KC_HOSTNAME`) or 9.1 (issuer parity) is broken — surface as Story Question.

- [ ] **Task 6 — Document the full variable surface in `docs/14_beta_railway_setup.md`** (AC-1, AC-10)
  - [ ] 6.1 Append a new section "## Railway Variables per Service" under E13-S1's existing structure. One subsection per service (`api`, `web`, `keycloak` — `rustfs`, `postgres-app`, `postgres-kc` already covered in E13-S1).
  - [ ] 6.2 For each service, one Markdown table with columns: Variable | Value or Reference | Sealed | Rationale (with file:line anchor).
  - [ ] 6.3 Add a Markdown subsection "## Build-time vs Runtime variables" reproducing the classification from Task 0.3.
  - [ ] 6.4 Add a Markdown subsection "## Secret rotation" documenting how to rotate each Sealed value (admin password, client secrets, NEXTAUTH_SECRET, EncryptionKey) — what breaks when each rotates.

- [ ] **Task 7 — Secrets-in-repo guard** (AC-11)
  - [ ] 7.1 Run `git grep -inE 'NEXTAUTH_SECRET\s*=|CLIENT_SECRET\s*=|EncryptionKey\s*=|RUSTFS_ROOT_PASSWORD\s*=' -- ':(exclude)*.env.example'` and confirm zero hits assigning real-looking values (placeholder strings in .env.example like `__set_in_environment__` are OK and excluded).
  - [ ] 7.2 Confirm `docs/14_beta_railway_setup.md` Task 6 deliverable does NOT contain real Sealed values; it contains names and references and the canonical Mailtrap host (`sandbox.smtp.mailtrap.io`) which is the public hostname of Mailtrap, NOT a secret.

- [ ] **Task 8 — Quality-Gates Closing Check (per A29)**
  - [ ] 8.1 Complete the Quality-Gates table at the bottom of this file with one row per AC sub-item.

## Dev Notes

### Environment variable resolution order in .NET (re-affirmed)

Per [backend/.env.example#L6-L7](backend/.env.example#L6-L7), the precedence chain is `appsettings.json < appsettings.{ASPNETCORE_ENVIRONMENT}.json < environment variables < command-line args`. This means:

- `appsettings.Beta.json` provides defaults; env vars override.
- For boolean/numeric values that need to be flexible per-deploy without re-baking the image, prefer env vars (`RetentionEnforcement__Enabled`, `Database__AutoMigrate`).
- For sensitive values that MUST be different per-deploy, env vars are the ONLY safe channel.

### Why we duplicate `RetentionEnforcement__Enabled=false` in BOTH appsettings.Beta.json AND Railway env

Belt and suspenders per AC-6. The JSON sets it true→false for the Beta environment; an explicit Railway env var means a misconfigured `ASPNETCORE_ENVIRONMENT` (e.g., a deploy-debug accident sets it to Production) still leaves retention OFF. Defense-in-depth is cheap (one env-var line per service) and the consequence of mistake is data loss.

### Why `Frontend__BaseUrl` matters for CORS even though the frontend bundle hardcodes the API URL

The api service runs Beta-shape per ADR-015, which means [DependencyInjection.cs#L122-L130](backend/src/IabConnect.Api/DependencyInjection.cs#L122-L130) executes the strict CORS branch: ONE allowed origin only (the `Frontend__BaseUrl`). If browsers call `https://<web-public-domain>` but the env var is left as `http://localhost:3000` (the default), every browser request from production fails with a CORS preflight rejection — JS console fills with `Access-Control-Allow-Origin` errors and the UI looks dead. This story's AC-2 prevents that.

### Mailtrap sandbox endpoint (ADR-018) — and the planned flip to real SMTP

The canonical Mailtrap Sandbox SMTP endpoint is `sandbox.smtp.mailtrap.io` on port 587 with STARTTLS. The username/password come from Mailtrap's inbox settings (Harry creates a sandbox inbox; gets credentials; pastes Sealed into Railway). Mails fired by the app land in the Mailtrap inbox and are visible to anyone with credentials to that inbox; they NEVER deliver to real recipients. Per ADR-018 this is the entire point for the initial Beta deploy — zero deliverability risk + zero reputation exposure while the Railway wiring is verified end-to-end.

**This is explicitly a starting state, not the steady state.** Before Beta is opened to any non-Harry tester (so testers can actually receive password-reset, invoice, dunning, and volunteer-reminder mails), the SMTP variables must flip to a real provider — tracked at [deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md) E13-FT-1. Provider candidates per ADR-018 / E19-S4: Brevo (free tier 300/day, EU jurisdiction), Postmark (transactional-focused, paid), Postal on Hetzner (sovereign, self-hosted). E19-S4 authors the migration plan; the actual swap is a 7-variable Sealed-value update on the `api` Railway service + SPF/DKIM DNS records for the chosen sender domain.

### Keycloak admin bootstrap and personal-admin migration (AC-4 + Task 3.6)

Keycloak 26 supports `KEYCLOAK_ADMIN` + `KEYCLOAK_ADMIN_PASSWORD` env vars for the initial master-realm admin user, created on first boot. The env-var-seeded admin is a stop-gap with two problems: (1) anyone with read access to Railway's Sealed values can sign in as it; (2) actions are attributed to a generic `admin` audit-trail entry, not to a real person. Task 3.6 makes Harry create a personal admin account (`harry@iabconnect.app`) and verify it works as a parallel credential. The env-var admin stays in the database for a week of normal Beta use (chicken-and-egg insurance: if the personal admin breaks somehow, the env-var admin is the recovery path). After a week of clean operations, [deferred-work.md](_bmad-output/implementation-artifacts/deferred-work.md) E13-FT-5 fires the deletion + env-var removal.

### Why every Keycloak client secret is THREE-WAY shared

Each Keycloak client (`iabconnect-api`, `iabconnect-admin`, `iabconnect-frontend`) has a single secret that lives in three places:
1. The realm-import JSON has a placeholder `${IABCONNECT_*_CLIENT_SECRET}` that Keycloak substitutes from env-var at realm-import time → secret stored in Keycloak's database.
2. The consuming service's env var stores the same literal secret to authenticate to Keycloak (api stores it under `Keycloak__ClientSecret`; web stores it under `KEYCLOAK_CLIENT_SECRET`).
3. Railway resolves the consuming-service env var via `${{keycloak.IABCONNECT_*_CLIENT_SECRET}}` reference — which means BOTH live in Railway's vault (so changing the keycloak one auto-propagates to the consumer, as long as the consumer's variable is a reference not a literal).

If the three drift (e.g., Harry pastes the keycloak value as a literal into the consumer instead of using `${{…}}`), the consumer's auth to Keycloak fails silently with `401 Unauthorized` on the token endpoint.

### Why we ship `NEXT_PUBLIC_*` baked but Server-side `KEYCLOAK_*` as runtime

Next.js's `NEXT_PUBLIC_*` is build-time-only (a constant substitution into the static client bundle). Server-side env vars are read at runtime. Both can name the same logical value (`KEYCLOAK_ISSUER` vs `NEXT_PUBLIC_KEYCLOAK_ISSUER`) and BOTH must be identical because:
- The browser uses `NEXT_PUBLIC_KEYCLOAK_ISSUER` for the password-reset deep link and logout redirect (clicked from the UI).
- The Next.js server uses `KEYCLOAK_ISSUER` for OIDC discovery (the API call from server-side NextAuth to Keycloak's `/.well-known/openid-configuration`).
- If they drift, the browser-initiated login round-trip starts at issuer A and ends at issuer B → token validation rejects the result.

This is a known footgun and is why [frontend/.env.example#L34-L36](frontend/.env.example#L34-L36) carries an explicit IMPORTANT comment about it.

### LLM dev-agent guardrails

- **Do NOT** try to set NEXT_PUBLIC_* on Railway thinking it will take effect at runtime — it won't, because they're baked at GHA image-build time. Setting them on Railway is harmless but misleading (operator confusion).
- **Do NOT** commit a real Sealed value to ANY file under `_bmad-output/`, `docs/`, or anywhere else in the repo. Sealed values exist ONLY in Railway Variables tab + Harry's password manager.
- **Do NOT** use `${{…}}` reference syntax for values that need to be sealed at the consumer-end if the source variable isn't Sealed — Railway propagates Sealed status from source to reference, but only if the source itself is Sealed. Verify in the dashboard.
- **Do NOT** scope-creep into E13-S3 (networking) or E13-S4 (health probes). It is tempting to enable public domains now because some of this story's verifications need them; do them in E13-S3 explicitly.
- **DO** verify every env-var consumer file:line is current before pasting a reference (per A28 spike-first — the `__`-syntax convention is .NET-specific; the `KC_*` convention is Keycloak-specific; the `NEXT_PUBLIC_*` convention is Next.js-specific; don't cross the streams).
- **DO** document every variable in `docs/14_beta_railway_setup.md` Task 6 — this story's primary deliverable beyond the dashboard state IS the documentation. Future operators (Harry-in-six-months, fork maintainers, the next agent) recover the configuration surface from the doc.

### References

- [Source: _bmad-output/planning-artifacts/architecture.md#L329-L341 (ADR-015 Configuration and Environment Strategy)]
- [Source: _bmad-output/planning-artifacts/architecture.md#L343-L351 (ADR-016 Custom Keycloak Image)]
- [Source: _bmad-output/planning-artifacts/architecture.md#L366-L374 (ADR-018 Mailtrap Sandbox)]
- [Source: _bmad-output/planning-artifacts/architecture.md#L386-L394 (ADR-020 Beta-Mode Job Suppression)]
- [Source: _bmad-output/planning-artifacts/prd.md#L466-L472 (REQ-088 AC-4)]
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1383-L1405 (Story E13-S2 ACs)]
- [Source: backend/.env.example] — canonical inventory of backend env vars + consumer anchors.
- [Source: frontend/.env.example] — canonical inventory of frontend env vars + the issuer-parity warning.
- [Source: backend/src/IabConnect.Api/appsettings.Beta.json] — Console-Serilog + RetentionEnforcement=false defaults.
- [Source: infra/keycloak/realms-beta/iabconnect-realm.json] — realm import with `${IABCONNECT_*_CLIENT_SECRET}` placeholders (E12-S3).
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs#L106-L132 (CORS strict-allowlist branch)]
- [Source: backend/src/IabConnect.Api/DependencyInjection.cs#L134-L165 (Keycloak JWT bearer)]
- [Source: frontend/src/app/api/auth/[...nextauth]/route.ts] — server-side OIDC discovery against `KEYCLOAK_ISSUER`.

## Quality Gates — Closing Check (A29)

Status: `covered` · `deferred` · `N/A`.

| AC | Sub-item | Status | Evidence anchor |
|----|----------|--------|-----------------|
| 1 | docs/14_beta_railway_setup.md "Railway Variables per Service" enumerates every variable | | |
| 2 | api: `ASPNETCORE_ENVIRONMENT=Beta` | | |
| 2 | api: `ConnectionStrings__DefaultConnection` set + Sealed | | |
| 2 | api: Keycloak block (Authority, ClientId, ClientSecret, Admin-* ×4, CalendarTokenPepper) | | |
| 2 | api: `Frontend__BaseUrl` = Railway web public domain | | |
| 2 | api: DocumentStorage block (4 vars + Sealed secret) | | |
| 2 | api: Smtp block (8 vars + 2 Sealed) | | |
| 2 | api: Branding overrides (ApiTitle, SourceUrl) | | |
| 2 | api: Invoice block (6 vars — 3 real strings supplied by Harry per Q1) | | |
| 2 | api: Operations (RetentionEnforcement=false, Backup ×3, Database__AutoMigrate=true) | | |
| 2 | api: Logging level | | |
| 3 | web: `NEXTAUTH_URL` = Railway web public domain | | |
| 3 | web: `NEXTAUTH_SECRET` set + Sealed | | |
| 3 | web: server-side KEYCLOAK_* (ClientId, ClientSecret, Issuer) | | |
| 3 | web: KEYCLOAK_ISSUER byte-equals NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA repo variable | | |
| 4 | keycloak: KC_HOSTNAME, KC_PROXY=edge, KC_HTTP_ENABLED, KC_HEALTH_ENABLED, KC_METRICS_ENABLED | | |
| 4 | keycloak: KEYCLOAK_ADMIN + KEYCLOAK_ADMIN_PASSWORD (Sealed) | | |
| 4 | keycloak: IABCONNECT_API/ADMIN/FRONTEND_CLIENT_SECRET (×3 Sealed) | | |
| 4 | [!] Personal Harry-admin account created in master realm (Task 3.6) | | |
| 5 | All AC-annotated `(Sealed)` variables show the lock icon in Railway | | |
| 6 | api `RetentionEnforcement__Enabled=false` explicit env var | | |
| 7 | web NEXT_PUBLIC_ENV_LABEL=beta (baked, verify) | | |
| 7 | web NEXT_PUBLIC_SOURCE_URL=https://github.com/htos/iab-connect (baked, verify) | | |
| 8 | [!] Keycloak realm-import contract intact (3 clients with non-empty secrets) | | |
| 9 | OIDC issuer parity verified across 3 anchors | | |
| 9 | Client-secret 3-way structural parity verified for all 3 clients | | |
| 9 | Frontend BaseUrl ≡ NEXTAUTH_URL ≡ Railway web public domain | | |
| 9 | RustFS credentials reference resolves to non-empty | | |
| 9 | Branding SourceUrl parity (4 anchors) | | |
| 10 | docs/14_beta_railway_setup.md updated with full variable surface + classification + rotation | | |
| 11 | No real secret value committed to repo (git grep clean) | | |

## Story Questions (for the dev-agent to surface; resolve OR escalate)

- **Q1 — Real invoicing strings.** Harry MUST supply real values for `InvoiceSettings__OrganizationName`, `InvoiceSettings__OrganizationAddress`, `InvoiceSettings__PaymentInstructions` before Task 1.2 sets them on Railway. These strings appear on every generated invoice PDF + Swiss QR-bill; placeholders like "Test address" or "Sandbox" are not acceptable per the non-MVP framing of this deploy. Default `InvoiceSettings__Currency=CHF` + `DefaultPaymentTermDays=30` are sensible defaults but can be overridden.
- **Q2 — Mailtrap sandbox account exists?** ADR-018 names Mailtrap Sandbox as the initial Beta mail destination. If Harry doesn't already have a Mailtrap account, Task 1.1 is preceded by a 5-min Mailtrap signup. NOTE: per deferred-work.md E13-FT-1, this flips to a real SMTP provider before non-Harry testers are onboarded.
- **Q3 — `iabconnect.app` registered?** AC-2 uses `noreply@iabconnect.app` and the public hostnames in E13-S2 ref the brand. Confirm registration; if the domain differs, swap throughout. Custom-domain wiring is E19-S1 / deferred-work.md E13-FT-2 — Beta runs on `*.up.railway.app` initially.
- **Q4 — `Backup__Directory=/tmp/backups` OK for first deploy?** Path matters only when E15-S3 (daily backup) actually runs. `/tmp/backups` is safe (Linux always-writable, ephemeral; backup is gzipped + immediately uploaded to RustFS). Confirm.
- **Q5 — `iabconnect-realm.json` env-var substitution compatible with Keycloak 26.5.2?** Realm uses `${IABCONNECT_API_CLIENT_SECRET}` Bash-style. Keycloak 26.x supports this natively; if Task 3.3 inspection shows literal `${…}` strings instead of resolved values, surface to Harry — may need `KC_FEATURES=runtime-property-substitution`.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7 (1M context, BMM dev-story workflow)

### Debug Log References

### Completion Notes List

### File List

- [docs/14_beta_railway_setup.md](docs/14_beta_railway_setup.md) — EDIT (append "Railway Variables per Service" + "Build-time vs Runtime variables" + "Secret rotation" sections; AC-10).
- No source code changes (all work in Railway dashboard; doc is the only repo-tracked artifact).
