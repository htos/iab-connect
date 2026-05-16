# Story 12.4: Optional `docker-compose.full.yml` for local Beta-like testing

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **a developer or self-hoster**,
I want **an optional `infra/docker-compose.full.yml` overlay that adds the three application images (backend, frontend, Keycloak-with-SPI) on top of the existing local infrastructure stack**,
so that **I can run a Railway-equivalent topology locally to verify a Beta-shape deployment before pushing to the `beta` branch — or to reproduce a Beta bug without burning Railway minutes**.

**Requirement:** REQ-088 AC-1 (deployable via published, versioned Docker images). Epic E12 (Dockerization), Story 4 of 4 — the **closing story** of E12 and the **last Wave-3 deliverable**. After this story closes, the Wave-3 epic-boundary `code-review` + `retrospective` becomes runnable.

**Upstream (HARD dependencies — this story is blocked until all three exist on disk):**
- **E12-S1 (Backend Dockerfile)** ([backend/Dockerfile](backend/Dockerfile)) — must exist. The full-compose file `build:` directive references this path.
- **E12-S2 (Frontend Dockerfile)** ([frontend/Dockerfile](frontend/Dockerfile)) — must exist. Same reason.
- **E12-S3 (Keycloak Dockerfile)** ([infra/keycloak/Dockerfile](infra/keycloak/Dockerfile)) — must exist. Same reason.
- Existing local infrastructure: [infra/docker-compose.yml](infra/docker-compose.yml) — Postgres 17, RustFS, RustFS-init, Mailhog, Seq. The overlay extends this; it does NOT replace it.

**Downstream:**
- **E13-S1..S4** (Railway provisioning) — uses this story's compose file as a local mirror of the Railway topology to validate env-var wiring before pushing.
- **E18-S1** (Beta runbook) — references this compose file as the "before-you-push-to-beta" smoke procedure.
- **E20-S5** (GHCR publishing) — has a parallel "pull images from GHCR instead of build locally" mode that this compose file optionally supports (see AC-4).

**Wave context:** Wave 3 closer. Has a HARD start gate — E12-S1 + E12-S2 + E12-S3 must all be `done` (or at minimum `review`) before this story's dev-agent starts Task 1; otherwise the `docker compose build` will fail at file-not-found. The dev agent MUST verify the three Dockerfiles exist on disk before proceeding — this is the most important spike check in the story.

## Acceptance Criteria

1. **`infra/docker-compose.full.yml` exists** as a compose **overlay file**, not a replacement for [infra/docker-compose.yml](infra/docker-compose.yml). The intended invocation is:
   ```sh
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml up -d
   ```
   The overlay adds three new services (`api`, `web`, `keycloak-full`) and modifies the Postgres + Keycloak wiring to mirror the Railway topology (per ADR-012). The original `infra/docker-compose.yml` continues to work standalone for everyday local dev (where backend and frontend run via `dotnet run` / `npm run dev` on the host).

2. **The overlay adds an `api` service** that builds from [backend/Dockerfile](backend/Dockerfile):
   ```yaml
   api:
     build:
       context: ../backend
       dockerfile: Dockerfile
       args:
         BUILD_SHA: local-dev
         BUILD_DATE: ${BUILD_DATE:-local-dev}
     image: iabc-api:local
     container_name: iabconnect-api
     restart: unless-stopped
     environment:
       ASPNETCORE_ENVIRONMENT: Beta
       ConnectionStrings__DefaultConnection: "Host=postgres;Port=5432;Database=iabconnect;Username=postgres;Password=postgres"
       Keycloak__Authority: "http://keycloak-full:8080/realms/iabconnect"
       Keycloak__ClientId: "iabconnect-api"
       Keycloak__ClientSecret: ""
       DocumentStorage__ServiceUrl: "http://rustfs:9000"
       DocumentStorage__AccessKey: "rustfsadmin"
       DocumentStorage__SecretKey: "rustfsadmin"
       DocumentStorage__BucketName: "iabconnect-documents"
       DocumentStorage__UseHttps: "false"
       Smtp__Host: "mailhog"
       Smtp__Port: "1025"
       Smtp__EnableSsl: "false"
       Frontend__BaseUrl: "http://localhost:3000"
       RetentionEnforcement__Enabled: "false"
     ports:
       - "5000:8080"
     depends_on:
       postgres:
         condition: service_healthy
       keycloak-full:
         condition: service_started
       rustfs-init:
         condition: service_completed_successfully
   ```
   - **Port mapping note:** the container listens on 8080 (per E12-S1 AC-5); the host port 5000 matches the existing dev workflow's `dotnet run` default so the frontend's `NEXT_PUBLIC_API_URL=http://localhost:5000` works unchanged.
   - **`ASPNETCORE_ENVIRONMENT=Beta`** activates the [appsettings.Beta.json](backend/src/IabConnect.Api/appsettings.Beta.json) overlay (Console-only Serilog, retention-disabled). This is the Beta-shape; if a developer wants Dev-shape locally, they remove the override.
   - **DocumentStorage credentials** are the local-dev `rustfsadmin/rustfsadmin` values — appropriate because the full-compose stack runs against the LOCAL RustFS service in the same compose network, not against a real Beta RustFS. E12-S1 AC-7 stripped these from base appsettings.json; the overlay restores them via env vars (which is exactly the pattern that justified the AC-7 stripping in the first place).

3. **The overlay adds a `web` service** that builds from [frontend/Dockerfile](frontend/Dockerfile):
   ```yaml
   web:
     build:
       context: ../frontend
       dockerfile: Dockerfile
       args:
         NEXT_PUBLIC_API_URL: "http://localhost:5000"
         NEXT_PUBLIC_KEYCLOAK_URL: "http://localhost:8080"
         NEXT_PUBLIC_KEYCLOAK_REALM: "iabconnect"
         NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "iabconnect-frontend"
         NEXT_PUBLIC_KEYCLOAK_ISSUER: "http://localhost:8080/realms/iabconnect"
         NEXT_PUBLIC_ENV_LABEL: "beta"
         NEXT_PUBLIC_DOCUMENT_HOST: "localhost:9000"
         NEXT_PUBLIC_SOURCE_URL: "https://github.com/htos/iab-connect"
     image: iabc-web:local
     container_name: iabconnect-web
     restart: unless-stopped
     environment:
       NEXTAUTH_URL: "http://localhost:3000"
       NEXTAUTH_SECRET: "local-dev-secret-min-32-chars-aaaaaaaaaaaaaaa"
       KEYCLOAK_CLIENT_ID: "iabconnect-frontend"
       KEYCLOAK_CLIENT_SECRET: "frontend-dev-secret-2026"
       KEYCLOAK_ISSUER: "http://keycloak-full:8080/realms/iabconnect"
     ports:
       - "3000:3000"
     depends_on:
       api:
         condition: service_started
       keycloak-full:
         condition: service_started
   ```
   - **Build-arg URLs use `localhost`** (NOT `keycloak-full` or `api`) because `NEXT_PUBLIC_*` vars are inlined into the static client bundle and read by the user's BROWSER, which resolves `localhost` to the host. The server-side runtime env vars (`KEYCLOAK_ISSUER`) use the compose-internal hostname `keycloak-full` because they're read by the Node.js process inside the container.
   - **`NEXT_PUBLIC_ENV_LABEL=beta`** triggers the BETA banner (E11-S2), giving developers a visible cue that they're on the full-stack overlay versus regular local dev.
   - **`KEYCLOAK_CLIENT_SECRET=frontend-dev-secret-2026`** is the LOCAL DEV secret from [infra/keycloak/realms/iabconnect-realm.json:252](infra/keycloak/realms/iabconnect-realm.json#L252) — appropriate because the custom Keycloak image's sanitized realm (E12-S3) substitutes `${IABCONNECT_FRONTEND_CLIENT_SECRET}` from the env var `IABCONNECT_FRONTEND_CLIENT_SECRET` we set on the `keycloak-full` service in AC-4.

4. **The overlay adds a `keycloak-full` service** that builds from [infra/keycloak/Dockerfile](infra/keycloak/Dockerfile):
   ```yaml
   keycloak-full:
     build:
       context: ./keycloak
       dockerfile: Dockerfile
     image: iabc-keycloak:local
     container_name: iabconnect-keycloak-full
     restart: unless-stopped
     environment:
       KC_DB: postgres
       KC_DB_URL: "jdbc:postgresql://postgres:5432/iabconnect"
       KC_DB_USERNAME: postgres
       KC_DB_PASSWORD: postgres
       KC_HOSTNAME: localhost
       KC_HTTP_ENABLED: "true"
       KEYCLOAK_ADMIN: admin
       KEYCLOAK_ADMIN_PASSWORD: admin-full
       IABCONNECT_ADMIN_CLIENT_SECRET: "admin-service-secret-2026"
       IABCONNECT_FRONTEND_CLIENT_SECRET: "frontend-dev-secret-2026"
       FRONTEND_PUBLIC_URL: "http://localhost:3000"
     ports:
       - "8080:8080"
     depends_on:
       postgres:
         condition: service_healthy
   ```
   - **Service name is `keycloak-full`** (NOT `keycloak`) to avoid colliding with the existing `keycloak` service from [infra/docker-compose.yml:25](infra/docker-compose.yml#L25). The compose overlay model uses the service NAME as the merge key — if both files have `keycloak:`, the overlay overrides the base. We want to ADD a second service that COEXISTS conceptually, but we cannot bind both to host port 8080 simultaneously. The compose-up command in AC-7 documents the "either local-dev OR full-overlay, not both" workflow.
   - **Realm placeholder env vars** (`IABCONNECT_ADMIN_CLIENT_SECRET`, `IABCONNECT_FRONTEND_CLIENT_SECRET`, `FRONTEND_PUBLIC_URL`) supply the `${VAR}` substitutions in E12-S3's sanitized realm import.

5. **The overlay disables the BASE `keycloak` service to avoid port conflict.** Two equivalent mechanisms:
   - Option A (preferred): The overlay sets the base `keycloak` service to `profiles: ["disabled-by-full"]` — compose treats profile-mismatched services as not-up. The overlay snippet:
     ```yaml
     keycloak:
       profiles: ["disabled-by-full"]
     ```
   - Option B: The overlay redirects the base `keycloak` service's port mapping to a non-conflicting host port (e.g., 8089), but this leaves both Keycloak instances running and confuses log analysis.

   Choose Option A unless Task 0's spike turns up a compose-version compatibility issue.

6. **The overlay adds a one-shot bootstrap service `keycloak-full-realm-check`** that confirms the custom-image realm imported successfully and the SPI loaded:
   ```yaml
   keycloak-full-realm-check:
     image: curlimages/curl:8
     container_name: iabconnect-keycloak-full-realm-check
     depends_on:
       keycloak-full:
         condition: service_started
     restart: "no"
     entrypoint:
       - sh
       - -c
       - |
         for i in 1 2 3 4 5 6 7 8 9 10; do
           if curl -sf http://keycloak-full:8080/realms/iabconnect/.well-known/openid-configuration >/dev/null; then
             echo "REALM_OK"
             exit 0
           fi
           sleep 5
         done
         echo "REALM_NOT_READY"
         exit 1
   ```
   - This is a docker-compose-native health gate. If it exits non-zero, the dev knows the Keycloak image / realm import failed before they spend time debugging the API.

7. **README "Local Beta-shape testing" section** documents the workflow:
   ```markdown
   ## Local Beta-shape testing (optional)

   To run the same container topology Railway uses (backend image + frontend image + custom Keycloak image, all built locally):

   ```sh
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml up --build -d
   ```

   - Web UI: <http://localhost:3000> (logged in via Keycloak at <http://localhost:8080>)
   - API: <http://localhost:5000/swagger> (Swagger disabled in Beta; the URL returns 404 — expected)
   - Realm probe: <http://localhost:8080/realms/iabconnect/.well-known/openid-configuration>

   For everyday local dev (backend via `dotnet run`, frontend via `npm run dev`):

   ```sh
   docker compose -f infra/docker-compose.yml up -d
   ```
   ```
   - The "Swagger disabled in Beta" note is non-obvious: developers used to seeing Swagger in local-dev should know that ASPNETCORE_ENVIRONMENT=Beta closes it.

8. **Build and up succeed.** From the repo root:
   ```sh
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml build
   docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml up -d
   ```
   Expected: all 8 services reach `running` or `exited 0` (rustfs-init and keycloak-full-realm-check) within 2 minutes. Capture `docker compose -f ... -f ... ps` output in Completion Notes — it should show 6 long-running services (postgres, rustfs, mailhog, seq, api, web, keycloak-full) and 2 one-shot services completed.

9. **End-to-end smoke.** From the host:
   - [ ] `curl -sf http://localhost:3000/` returns 200 or a healthy 307 redirect.
   - [ ] `curl -sf http://localhost:8080/realms/iabconnect/.well-known/openid-configuration` returns 200 with JSON.
   - [ ] `curl -sf http://localhost:5000/health/live` returns 200 (or whatever the backend exposes — verify the endpoint exists; if not, document the alternative).
   - [ ] `curl -sf http://localhost:9001/` (RustFS console) returns 200 — confirms RustFS is reachable from the host.
   - Capture all four outputs in Completion Notes.

10. **Teardown is clean.**
    ```sh
    docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml down -v
    ```
    All 8 containers stop. The `-v` flag clears named volumes (Postgres, RustFS, Seq) — without it, a partial-bootstrap state persists across restarts and confuses future debugging. Document the teardown command in README alongside the up command (AC-7).

11. **Quality gates.** From repo root:
    - [ ] 11.1 `docker compose -f infra/docker-compose.yml config` — green (the base file still parses standalone).
    - [ ] 11.2 `docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml config` — green (the merged file parses).
    - [ ] 11.3 Build (AC-8) — green.
    - [ ] 11.4 Up + smoke (AC-9) — green.
    - [ ] 11.5 Teardown (AC-10) — green.
    - [ ] 11.6 AC-Subitem Completion Check per project-context A29 — list AC-1..AC-11 with `covered / N/A / deferred` markers in Completion Notes.

## Tasks / Subtasks

- [ ] **Task 0 — Spike: verify all three Dockerfiles exist on disk (AC: gate; project-context A28)**:
  - [ ] 0.1 Check [backend/Dockerfile](backend/Dockerfile) exists. If absent, escalate: "Blocker — E12-S1 not yet landed. Cannot build api service." HALT.
  - [ ] 0.2 Check [frontend/Dockerfile](frontend/Dockerfile) exists. If absent, escalate: "Blocker — E12-S2 not yet landed. Cannot build web service." HALT.
  - [ ] 0.3 Check [infra/keycloak/Dockerfile](infra/keycloak/Dockerfile) exists AND [infra/keycloak/realms-beta/iabconnect-realm.json](infra/keycloak/realms-beta/iabconnect-realm.json) exists. If either absent, escalate: "Blocker — E12-S3 not yet landed. Cannot build keycloak-full service." HALT.
  - [ ] 0.4 Verify compose version compatibility: `docker compose version` reports v2.20+ (required for `profiles:` and `service_completed_successfully` condition). If older, document the workaround (split into a deeper Docker Compose v2 install instruction in README).

- [ ] **Task 1 — Author `infra/docker-compose.full.yml` (AC: 1-6)** — file at `infra/docker-compose.full.yml`. Reference structure (the overlay merges with `docker-compose.yml`'s `services:` block):
  ```yaml
  # Optional Beta-shape overlay — extends infra/docker-compose.yml with the three
  # containerized application services (backend, frontend, Keycloak-with-SPI).
  #
  # Invocation:
  #   docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml up --build -d
  #
  # See README "Local Beta-shape testing" section for the full developer workflow.

  services:
    # Disable the base keycloak service to free host port 8080 for keycloak-full.
    keycloak:
      profiles: ["disabled-by-full"]

    # Custom Keycloak image with the disable-new-users SPI baked in + sanitized realm.
    # See infra/keycloak/Dockerfile (E12-S3).
    keycloak-full:
      build:
        context: ./keycloak
        dockerfile: Dockerfile
      image: iabc-keycloak:local
      container_name: iabconnect-keycloak-full
      restart: unless-stopped
      environment:
        KC_DB: postgres
        KC_DB_URL: "jdbc:postgresql://postgres:5432/iabconnect"
        KC_DB_USERNAME: postgres
        KC_DB_PASSWORD: postgres
        KC_HOSTNAME: localhost
        KC_HTTP_ENABLED: "true"
        KEYCLOAK_ADMIN: admin
        KEYCLOAK_ADMIN_PASSWORD: admin-full
        IABCONNECT_ADMIN_CLIENT_SECRET: "admin-service-secret-2026"
        IABCONNECT_FRONTEND_CLIENT_SECRET: "frontend-dev-secret-2026"
        FRONTEND_PUBLIC_URL: "http://localhost:3000"
      ports:
        - "8080:8080"
      depends_on:
        postgres:
          condition: service_healthy

    # Health gate: confirms Keycloak realm-import succeeded before downstream services rely on it.
    keycloak-full-realm-check:
      image: curlimages/curl:8
      container_name: iabconnect-keycloak-full-realm-check
      depends_on:
        keycloak-full:
          condition: service_started
      restart: "no"
      entrypoint:
        - sh
        - -c
        - |
          for i in 1 2 3 4 5 6 7 8 9 10; do
            if curl -sf http://keycloak-full:8080/realms/iabconnect/.well-known/openid-configuration >/dev/null; then
              echo "REALM_OK"
              exit 0
            fi
            sleep 5
          done
          echo "REALM_NOT_READY"
          exit 1

    # Backend API image (E12-S1).
    api:
      build:
        context: ../backend
        dockerfile: Dockerfile
        args:
          BUILD_SHA: local-dev
          BUILD_DATE: local-dev
      image: iabc-api:local
      container_name: iabconnect-api
      restart: unless-stopped
      environment:
        ASPNETCORE_ENVIRONMENT: Beta
        ConnectionStrings__DefaultConnection: "Host=postgres;Port=5432;Database=iabconnect;Username=postgres;Password=postgres"
        Keycloak__Authority: "http://keycloak-full:8080/realms/iabconnect"
        Keycloak__ClientId: "iabconnect-api"
        Keycloak__ClientSecret: ""
        DocumentStorage__ServiceUrl: "http://rustfs:9000"
        DocumentStorage__AccessKey: "rustfsadmin"
        DocumentStorage__SecretKey: "rustfsadmin"
        DocumentStorage__BucketName: "iabconnect-documents"
        DocumentStorage__UseHttps: "false"
        Smtp__Host: "mailhog"
        Smtp__Port: "1025"
        Smtp__EnableSsl: "false"
        Frontend__BaseUrl: "http://localhost:3000"
        RetentionEnforcement__Enabled: "false"
      ports:
        - "5000:8080"
      depends_on:
        postgres:
          condition: service_healthy
        keycloak-full:
          condition: service_started
        rustfs-init:
          condition: service_completed_successfully

    # Frontend image (E12-S2). NEXT_PUBLIC_* baked at build time — host-resolvable URLs.
    web:
      build:
        context: ../frontend
        dockerfile: Dockerfile
        args:
          NEXT_PUBLIC_API_URL: "http://localhost:5000"
          NEXT_PUBLIC_KEYCLOAK_URL: "http://localhost:8080"
          NEXT_PUBLIC_KEYCLOAK_REALM: "iabconnect"
          NEXT_PUBLIC_KEYCLOAK_CLIENT_ID: "iabconnect-frontend"
          NEXT_PUBLIC_KEYCLOAK_ISSUER: "http://localhost:8080/realms/iabconnect"
          NEXT_PUBLIC_ENV_LABEL: "beta"
          NEXT_PUBLIC_DOCUMENT_HOST: "localhost:9000"
          NEXT_PUBLIC_SOURCE_URL: "https://github.com/htos/iab-connect"
      image: iabc-web:local
      container_name: iabconnect-web
      restart: unless-stopped
      environment:
        NEXTAUTH_URL: "http://localhost:3000"
        NEXTAUTH_SECRET: "local-dev-secret-min-32-chars-aaaaaaaaaaaaaaa"
        KEYCLOAK_CLIENT_ID: "iabconnect-frontend"
        KEYCLOAK_CLIENT_SECRET: "frontend-dev-secret-2026"
        KEYCLOAK_ISSUER: "http://keycloak-full:8080/realms/iabconnect"
      ports:
        - "3000:3000"
      depends_on:
        api:
          condition: service_started
        keycloak-full:
          condition: service_started
  ```

- [ ] **Task 2 — Update README with the "Local Beta-shape testing" section (AC: 7)** — append the section per AC-7. Place it AFTER any existing "Local development" / "Running locally" section so the everyday-local-dev path remains the first thing developers see. Keep the wording action-oriented; do NOT add aspirational "and you can also..." prose.

- [ ] **Task 3 — Config-parse verification (AC: 11.1, 11.2)** — from repo root:
  ```sh
  docker compose -f infra/docker-compose.yml config | head -10
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml config | head -30
  ```
  Both must exit 0 and emit valid YAML. Any "service references unknown profile" or "duplicate key" error means the overlay merge logic is wrong — escalate.

- [ ] **Task 4 — Build all images (AC: 8)** — from repo root:
  ```sh
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml build
  ```
  Expected: api, web, keycloak-full images all build successfully. Capture per-service build time in Completion Notes.

- [ ] **Task 5 — Up + verify all 8 services healthy (AC: 8, 9)**:
  ```sh
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml up -d
  sleep 60
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml ps
  ```
  Capture the `ps` output. All long-running services should be `running`; rustfs-init and keycloak-full-realm-check should be `exited (0)`. Then run the four smoke curls from AC-9 and capture each response status.

- [ ] **Task 6 — Teardown verification (AC: 10)**:
  ```sh
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml down -v
  docker compose -f infra/docker-compose.yml -f infra/docker-compose.full.yml ps  # should be empty
  ```
  Confirm no containers remain. Confirm volumes deleted via `docker volume ls | grep iab` returning empty.

- [ ] **Task 7 — Quality gates (AC: 11)** — re-run Tasks 3-6 in order in a clean state. Capture AC-Subitem Completion Check per project-context A29.

- [!] **Task 8 — Manual verification: end-to-end login round-trip via the full overlay (AC: 9, downstream E13)** — `[!]` per project-context A30 because this requires interactive browser:
  - Bring up the full stack via Task 5.
  - Open `http://localhost:3000` in a browser → confirm BETA banner visible.
  - Click Login → land on Keycloak login page at `http://localhost:8080/realms/iabconnect/...`.
  - Create a tester user via Keycloak Admin Console at `http://localhost:8080/admin` (login `admin`/`admin-full`).
  - Log in as the tester user → confirm redirect back to `http://localhost:3000/` with a valid session.
  - Verify the BETA banner persists, AGPL footer placeholder (until E20-S4) renders or is absent (acceptable both ways pre-E20-S4).
  - Mark `[x]` only after human review confirms all 6 sub-steps.

## Dev Notes

### Why an overlay, not a replacement

[Source: existing [infra/docker-compose.yml](infra/docker-compose.yml); compose-merge semantics; everyday-dev workflow preservation]

Most everyday local dev runs backend via `dotnet run` and frontend via `npm run dev` against the base compose stack (postgres + keycloak + rustfs + mailhog + seq). Replacing `docker-compose.yml` with a "now containerizes everything" file breaks this workflow — every code change requires a rebuild. The overlay keeps the base file as the everyday baseline and ADDS containerized application services for the Beta-shape verification use-case. Developers run `up -d` with only the base file 99% of the time; the overlay is the special-purpose mode.

### Service name collision: `keycloak` vs `keycloak-full`

[Source: AC-4, AC-5, compose-merge semantics]

Compose merges overlay services with the base file by service NAME. If the overlay named its service `keycloak`, it would OVERRIDE the base's keycloak (which still works for everyday dev). To preserve the base service as-is — so a developer running `docker compose -f base only` gets the unchanged dev workflow — the overlay names its service `keycloak-full`. The `profiles: ["disabled-by-full"]` injection on the base `keycloak` prevents host-port 8080 conflict when the overlay is active.

The alternative ("the overlay deactivates the base keycloak by setting `image: iabc-keycloak:local` and copies all the overrides") is structurally equivalent but uses compose-merge in a confusing way. Profile-based deactivation is the clearer pattern.

### Why local-dev secrets in the overlay (not env-var indirection)

[Source: AC-2, AC-3, AC-4; "this is local-dev convenience, not Beta"]

The `IABCONNECT_ADMIN_CLIENT_SECRET` / `IABCONNECT_FRONTEND_CLIENT_SECRET` / `KEYCLOAK_CLIENT_SECRET` / `DocumentStorage__AccessKey` values in this overlay are the SAME local-dev secrets that already exist in [infra/keycloak/realms/iabconnect-realm.json](infra/keycloak/realms/iabconnect-realm.json) and [backend/src/IabConnect.Api/appsettings.Development.json](backend/src/IabConnect.Api/appsettings.Development.json). They are NOT real Beta secrets. Hardcoding them in `docker-compose.full.yml` is acceptable because:
1. The file is for local-dev (Beta-SHAPE, not actual Beta).
2. The values are already public via the dev realm/appsettings.
3. Using `${VAR:-default}` indirection adds env-var-setup ceremony that defeats the "just run docker compose up" UX.

For actual Beta deployment, env vars come from Railway (E13-S2), NOT from this compose file.

### Why `condition: service_completed_successfully` for rustfs-init

[Source: [infra/docker-compose.yml:78-90](infra/docker-compose.yml#L78-L90)]

The base file's `rustfs-init` is a one-shot mc-cli service that creates the `iabconnect-documents` bucket. Without that bucket, the api service's first document upload fails with `NoSuchBucket`. Compose v2.20+ supports the `service_completed_successfully` depends-on condition; the api service waits for rustfs-init to exit 0 before starting. This is the documented compose pattern for "one-shot bootstrap → long-running consumer" topologies.

If compose v2.20+ isn't available (Task 0.4), the workaround is to add a `restart: on-failure` policy on the api service so it retries until the bucket exists — uglier but functional on older compose.

### Why the realm-check health gate (AC: 6)

[Source: Beta-shape verification requirement; compose's lack of built-in custom-image healthcheck for Keycloak]

Compose's healthcheck mechanism works for the postgres + rustfs services (defined in the base file), but Keycloak does NOT ship a stable healthcheck endpoint in 26.x by default (an opt-in `/health` requires `--health-enabled` and a CLI flag — adds complexity). Instead, this story adds a tiny one-shot `curlimages/curl` service that polls the OIDC well-known endpoint up to 10 times with 5-second backoffs. If the realm imported and the SPI didn't crash startup, this returns 200 within ~30s. If it doesn't, the dev sees `REALM_NOT_READY` in `docker compose logs` and knows the failure boundary is at Keycloak, not at the api or web.

### Cross-network resolution: localhost vs compose hostnames

[Source: AC-3 detailed annotation]

This is the trickiest topology decision in the overlay. Two rules:
1. **Browser-resolved URLs use `localhost`.** `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_KEYCLOAK_URL`, `NEXT_PUBLIC_KEYCLOAK_ISSUER`, `NEXT_PUBLIC_KEYCLOAK_REALM` are baked into the static client bundle and read by the user's browser. The browser sees `localhost:5000`, `localhost:8080`. These work because of the host port-forwarding (`ports: ["5000:8080"]`, `ports: ["8080:8080"]`).
2. **Server-resolved URLs use compose hostnames.** `KEYCLOAK_ISSUER` (server-side, read by NextAuth on the web container), `Keycloak__Authority` (read by the api container), `ConnectionStrings__DefaultConnection` (read by the api container) all use `keycloak-full`, `postgres`, `rustfs`, `mailhog` because the requesting process is INSIDE the compose network where those hostnames resolve.

Getting this wrong is the most common docker-compose stack bug. The overlay's annotations in AC-2/3/4 make the rules explicit per env var.

### Postgres separation: NOT mirrored locally

[Source: ADR-012; AC-2 + AC-4 share `KC_DB_URL=jdbc:postgresql://postgres:5432/iabconnect`]

ADR-012 mandates TWO managed Postgres instances on Railway (`postgres-app` for the API, `postgres-kc` for Keycloak) for ownership/migration separation. Locally, the overlay reuses the SINGLE base Postgres service for both consumers (api uses database `iabconnect`; Keycloak uses the same database, which works because Keycloak's tables are namespaced and Keycloak's auto-DDL doesn't conflict with the api's EF Core migrations). This is a deliberate local-dev simplification — the Railway topology decision is preserved in the runbook (E13-S4 / E18-S1), NOT in this story's compose file. Splitting locally would require a second Postgres service in the overlay, adding orchestration cost for no functional gain in local-dev.

### What this story does NOT do

- Does NOT publish to GHCR — that's E20-S5.
- Does NOT create the three Dockerfiles — those are E12-S1, E12-S2, E12-S3 (HARD upstream deps).
- Does NOT add Beta tester users — those are created manually via Admin Console (Task 8).
- Does NOT add a "pull from GHCR instead of build locally" variant — a follow-up post-E20-S5 can add it.
- Does NOT add Caddy / Traefik in front of api+web — Railway's edge handles TLS in real Beta; local-dev does not need it.
- Does NOT modify [infra/docker-compose.yml](infra/docker-compose.yml) — except for the `profiles:` disable injection in the overlay, which compose merges WITHOUT editing the base file on disk.
- Does NOT add backend Hangfire dashboard wiring — Hangfire dashboard is dev-only and out of scope here.

### Project Structure Notes

**NEW files** (1):
- `infra/docker-compose.full.yml`

**EDIT files** (1):
- `README.md` — append "Local Beta-shape testing" section per Task 2.

**NO changes** to: [infra/docker-compose.yml](infra/docker-compose.yml), backend source, frontend source, Keycloak SPI, dev realm.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 3 — REQ-088 AC-1]
- [Source: _bmad-output/planning-artifacts/architecture.md#L262-L271 — ADR-011 Beta Deployment Target — Railway]
- [Source: _bmad-output/planning-artifacts/architecture.md#L272-L304 — ADR-012 Service Topology on Railway]
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1335-L1353 — Epic E12 Story E12-S4 spec]
- [Source: infra/docker-compose.yml — base local-dev stack, preserved unchanged]
- [Source: _bmad-output/implementation-artifacts/e12-s1-add-backend-dockerfile-multistage.md — backend image and env-var contract]
- [Source: _bmad-output/implementation-artifacts/e12-s2-add-frontend-dockerfile-standalone.md — frontend image and build-arg contract]
- [Source: _bmad-output/implementation-artifacts/e12-s3-add-custom-keycloak-image-with-spi.md — Keycloak image and realm-substitution contract]
- [Source: project-context.md A28-A30 — Spike-First / AC-Subitem Check / Three-State Task Checkbox]
- [Source: https://docs.docker.com/compose/multiple-compose-files/merge/ — Compose overlay merge semantics]
- [Source: https://docs.docker.com/compose/profiles/ — Compose profiles documentation]

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent on first commit._

### Debug Log References

### Completion Notes List

### File List

## Questions / Clarifications

1. **`/health/live` endpoint existence (AC: 9)** — the smoke curl assumes the backend exposes `/health/live`. If the backend's actual health endpoints are `/health/ready` and `/health/live` (per ADR-017), this is fine. If only one exists, document which and update the smoke command. Spike: grep for `MapHealthChecks` in backend source.

2. **Compose v2.20+ availability (AC: gate)** — Task 0.4 verifies. If the developer environment has older compose, the `service_completed_successfully` and `profiles:` features may need fallback. Document the minimum version in README.

3. **Single Postgres for api + Keycloak** — the overlay shares the base Postgres across both consumers. If Keycloak's auto-DDL ever conflicts with EF Core migrations (it has not historically, but could), the workaround is to add a `postgres-kc` service in the overlay. Surface this if AC-9 smoke fails with a database-related Keycloak boot error.

4. **`web` service login round-trip without an actual user** — Task 8 requires creating a tester user via Keycloak Admin Console. This is a one-time manual step per fresh stack-up; the alternative would be a bootstrap script that uses Keycloak Admin API to create the user. Out-of-scope for E12-S4 but a reasonable E18 follow-up.
