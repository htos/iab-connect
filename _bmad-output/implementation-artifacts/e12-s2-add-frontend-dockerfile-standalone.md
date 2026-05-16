# Story 12.2: Frontend Dockerfile (Next standalone)

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **the CI pipeline (GitHub Actions) and self-hosters**,
I want **a reproducible, multi-stage Docker image for the Next.js 16 frontend that bakes ALL `NEXT_PUBLIC_*` build-time-constants from build-args, ships only `.next/standalone/server.js`, and runs as a non-root node user**,
so that **Railway and any forker can pull or build identical artifacts where the API URL, Keycloak realm, document host, env label, and OSS source URL are all set per-environment without source changes**.

**Requirement:** REQ-088 AC-1 (deployable via published, versioned Docker images). Epic E12 (Dockerization), Story 2 of 4. Wave-3 sibling of E12-S1.

**Upstream:**
- E11-S1 ([frontend/.env.example](frontend/.env.example)) documented the `NEXT_PUBLIC_*` build-time-constant surface.
- E11-S3 ([frontend/next.config.ts](frontend/next.config.ts)) added `output: "standalone"` and `outputFileTracingRoot: path.join(__dirname)` so `next build` emits `.next/standalone/server.js` (the entrypoint this story's runtime stage invokes). Without E11-S3 this story is dead-on-arrival — it is the hard precondition.
- E12-S1 (Backend Dockerfile) established the multi-stage + non-root + OCI-labels + build-args-via-`ARG`-then-`ENV` pattern; this story reuses that pattern at the same depth.

**Downstream:**
- **E20-S4** (Frontend license footer) — reads `NEXT_PUBLIC_SOURCE_URL` baked here.
- **E20-S5** (GHCR publishing) — drives `docker buildx build --build-arg NEXT_PUBLIC_*=… --label org.opencontainers.image.{revision,created}=…` for both backend (E12-S1) and frontend (this story).
- **E13-S1..S4** (Railway deploy) — pulls the image this story produces as the `web` service ([architecture.md ADR-012](_bmad-output/planning-artifacts/architecture.md)).
- **E12-S4** (`docker-compose.full.yml`) — wires this image alongside backend + keycloak for local Beta-shape testing.

**Wave context:** Wave 3 (Containerization) — runs in parallel with E12-S1 (backend Dockerfile) and E12-S3 (Keycloak image). All three Wave-3 deliverables are needed before Wave 4 (E20-S3 `/about` consumer + E20-S4 footer consumer) and Wave 5 (E20-S5 CI publishing).

## Acceptance Criteria

1. **`frontend/Dockerfile` exists** with three clearly named stages — `deps` (Node 22 Alpine, `npm ci`), `build` (Node 22 Alpine, `next build` with all NEXT_PUBLIC_* build-args), and `runtime` (Node 22 Alpine, runs `node server.js` against the standalone output). All three stages use the **same** Node base image tag (`node:22-alpine`) so the layer set is consistent.

2. **Node version pin.** Both build and runtime stages use `node:22-alpine` (matches [frontend/package.json:75-77](frontend/package.json#L75-L77) `"engines": { "node": ">=22.0.0" }`). The `-alpine` variant is acceptable for the frontend (Node is fine on Alpine; the .NET Alpine-ICU concern from E12-S1 is .NET-specific and does not apply here). Image size target ≤ 250 MB — Alpine base + `.next/standalone` is comfortably under this.

3. **`deps` stage installs production deps via `npm ci`.** Copy [frontend/package.json](frontend/package.json) and `frontend/package-lock.json` first (separately from source), then `RUN npm ci --frozen-lockfile`. This isolates the slow dependency-install layer from source edits — subsequent builds that only change `src/` re-use this layer.

4. **`build` stage receives ALL `NEXT_PUBLIC_*` build-args.** Declare each `NEXT_PUBLIC_*` env var from [frontend/.env.example](frontend/.env.example) as a build `ARG` and `ENV` before invoking `next build`. The complete list (9 vars):
   - `NEXT_PUBLIC_API_URL` (required) — backend base URL.
   - `NEXT_PUBLIC_KEYCLOAK_URL` (required) — Keycloak base URL for client-side links.
   - `NEXT_PUBLIC_KEYCLOAK_REALM` (required) — Keycloak realm name.
   - `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` (required) — Keycloak client ID for password-reset link.
   - `NEXT_PUBLIC_KEYCLOAK_ISSUER` (required) — full realm issuer URL for logout deep-link.
   - `NEXT_PUBLIC_ENV_LABEL` (optional, empty in Dev/Prod, `beta` in Beta) — triggers BETA banner.
   - `NEXT_PUBLIC_DOCUMENT_HOST` (optional, default `localhost:9000`) — next/image remotePatterns host.
   - `NEXT_PUBLIC_SOURCE_URL` (optional, default `https://github.com/htos/iab-connect`) — AGPL §13 source link for footer (E20-S4) and feedback fallback (E11-S2).
   - `NEXT_PUBLIC_FEEDBACK_URL` (optional, default empty) — overrides the BETA banner feedback link.
   - Pattern per arg:
     ```dockerfile
     ARG NEXT_PUBLIC_API_URL
     ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
     ```
   - **Why both `ARG` and `ENV`:** `ARG` accepts the build-time value, `ENV` makes it visible to the `next build` process. Without the `ENV`, `process.env.NEXT_PUBLIC_API_URL` is `undefined` inside the Node build runtime and Next.js inlines the dev-fallback string (or empty string for optional vars) into the client bundle — silent miscompile.

5. **`build` stage runs `next build` and emits standalone output.** After copying `src/`, `public/`, `next.config.ts`, `tsconfig.json`, and `messages/`, run `RUN npm run build` (which invokes `next build`). Per E11-S3, `next.config.ts` already has `output: "standalone"` and `outputFileTracingRoot: path.join(__dirname)`, so the output appears at `.next/standalone/server.js` (flat shape, not nested under `<workspace>/<project>/server.js`). The build stage MUST NOT set `NODE_ENV=development` — Next.js production optimizations (tree-shaking, minification, server-component pre-rendering) depend on the default `NODE_ENV=production` semantics of `next build`.

6. **`runtime` stage uses `node:22-alpine` and runs as the `node` user.** The `node:22-alpine` image ships a pre-created user `node` with UID 1000 and HOME `/home/node`. Use `USER node` (named user is fine here — Alpine's busybox `id node` resolves cleanly; the Kubernetes `runAsNonRoot` consideration from E12-S1 is satisfied by Alpine's pre-created node user). `WORKDIR /app`.

7. **`runtime` stage COPYs from `--from=build` in the exact standalone shape.** Three COPY instructions:
   - `COPY --from=build --chown=node:node /app/.next/standalone ./` — copies `server.js` + the trimmed `node_modules/` tree to `/app/`.
   - `COPY --from=build --chown=node:node /app/.next/static ./.next/static` — copies hashed client chunks.
   - `COPY --from=build --chown=node:node /app/public ./public` — copies public assets.
   - The `--chown=node:node` flag ensures the runtime user can read the files (default COPY ownership is root).

8. **`runtime` stage `EXPOSE 3000` and `ENV PORT=3000 HOSTNAME=0.0.0.0`.** The standalone `server.js` reads `PORT` and `HOSTNAME` from env vars; the default `HOSTNAME` is `localhost` which only binds to the container's loopback and is NOT reachable from outside the container. Setting `HOSTNAME=0.0.0.0` is **mandatory** for Railway / Docker port forwarding to work — this is the #1 silent-failure mode for Next.js standalone images. `NODE_ENV=production` is set explicitly (the Node Alpine base does not set it).

9. **`ENTRYPOINT` and `CMD`.** Use `ENTRYPOINT ["node", "server.js"]` (exec form). No `CMD` needed. Exec form is mandatory so SIGTERM from Railway's redeploy reaches Node directly (same rationale as E12-S1 AC-11).

10. **`frontend/.dockerignore` exists.** Excludes at minimum, grouped by category:
    - **Build outputs:** `.next/`, `out/`, `dist/`, `build/`.
    - **Dependencies:** `node_modules/` (forces clean `npm ci` in deps stage).
    - **Test artifacts:** `coverage/`, `playwright-report/`, `test-results/`, `e2e/`, `tests/`, `**/*.test.ts`, `**/*.test.tsx`, `**/*.spec.ts`, `**/*.spec.tsx`.
    - **Local config + secrets:** `.env`, `.env.*` (but explicitly NOT `.env.example` — keep that), `*.pfx`, `*.key`.
    - **IDE / editor:** `.vs/`, `.idea/`, `.vscode/`, `*.swp`, `.DS_Store`.
    - **Source-control:** `.git/` (relative protection in case build context expands).
    - **Misc:** `README.md` (not needed in image), `CHANGELOG.md`, `LICENSE` (E20-S1 will land a top-level LICENSE; the frontend image does not need its own copy because the AGPL footer + `/about` endpoint cover §13 disclosure).

11. **OCI image labels** mirroring E12-S1 ADR-014 conventions. Runtime stage `LABEL`s:
    - `org.opencontainers.image.source="https://github.com/htos/iab-connect"`
    - `org.opencontainers.image.licenses="AGPL-3.0-or-later"`
    - `org.opencontainers.image.title="IAB Connect Web"`
    - `org.opencontainers.image.description="Next.js frontend for IAB Connect — AGPL-3.0-or-later open-source membership platform."`
    - `org.opencontainers.image.vendor="IAB Connect contributors"`
    - Per-build `revision` and `created` labels are injected at `docker buildx build --label …` time by E20-S5; do NOT bake them into the Dockerfile.

12. **No `BUILD_SHA` / `BUILD_DATE` on the frontend (intentional asymmetry with E12-S1).** The frontend does not implement an `/about` endpoint — AGPL §13 disclosure for the frontend is the footer link added by E20-S4 plus the link to the backend's `/about` from the footer. So the frontend image does NOT need `BUILD_SHA` / `BUILD_DATE` build-args. The OCI `revision` label set by E20-S5 already records the commit SHA in image metadata for forks that want to introspect.

13. **Build success.** From the repository root:
    ```sh
    docker build \
      --build-arg NEXT_PUBLIC_API_URL=http://localhost:5000 \
      --build-arg NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080 \
      --build-arg NEXT_PUBLIC_KEYCLOAK_REALM=iabconnect \
      --build-arg NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=iabconnect-frontend \
      --build-arg NEXT_PUBLIC_KEYCLOAK_ISSUER=http://localhost:8080/realms/iabconnect \
      -t iabc-web:test frontend/
    ```
    completes successfully. Image size ≤ 250 MB.

14. **Beta-shape build evidence.** A second build with Beta-shape args:
    ```sh
    docker build \
      --build-arg NEXT_PUBLIC_API_URL=https://api.example.app \
      --build-arg NEXT_PUBLIC_KEYCLOAK_URL=https://kc.example.app \
      --build-arg NEXT_PUBLIC_KEYCLOAK_REALM=iabconnect \
      --build-arg NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=iabconnect-frontend \
      --build-arg NEXT_PUBLIC_KEYCLOAK_ISSUER=https://kc.example.app/realms/iabconnect \
      --build-arg NEXT_PUBLIC_ENV_LABEL=beta \
      --build-arg NEXT_PUBLIC_DOCUMENT_HOST=docs.example.app \
      --build-arg NEXT_PUBLIC_SOURCE_URL=https://github.com/htos/iab-connect \
      -t iabc-web:beta-shape frontend/
    ```
    After build, run from a temporary container:
    ```sh
    docker run --rm --entrypoint /bin/sh iabc-web:beta-shape -c "grep -r 'api.example.app' /app/.next/static 2>&1 | head -5"
    docker run --rm --entrypoint /bin/sh iabc-web:beta-shape -c "grep -r 'docs.example.app' /app 2>&1 | head -5"
    ```
    Expected: both greps return matches (Beta API URL baked into client chunks; document host baked into `required-server-files.json`). Capture in Completion Notes.

15. **Runtime smoke — server boots on 0.0.0.0:3000.**
    ```sh
    docker run --rm -p 3000:3000 \
      -e NEXTAUTH_URL=http://localhost:3000 \
      -e NEXTAUTH_SECRET=test-secret-min-32-chars-aaaaaaaaaaaaaa \
      -e KEYCLOAK_CLIENT_ID=iabconnect-frontend \
      -e KEYCLOAK_CLIENT_SECRET=test \
      -e KEYCLOAK_ISSUER=http://localhost:8080/realms/iabconnect \
      iabc-web:test
    ```
    Expected stdout (within 5 seconds): `▲ Next.js 16.x.x` banner followed by `- Local:        http://localhost:3000` and (CRITICAL) `- Network:      http://0.0.0.0:3000` — the Network line proves `HOSTNAME=0.0.0.0` took effect. From a SECOND terminal: `curl -sf http://localhost:3000/` returns HTTP 200 (or a 307 redirect to a default locale path — both are healthy). Capture both stdout lines and the curl response in Completion Notes.

16. **Quality gates.** From `frontend/`:
    - [ ] `npm run typecheck` — exit 0.
    - [ ] `npm run lint` — green (same 2 pre-existing baseline errors in `frontend/src/app/members/segments/page.tsx` documented in `_bmad-output/implementation-artifacts/deferred-work.md` — no NEW lint errors).
    - [ ] `npm run build` — green (sanity-check that `next build` still produces standalone output on the dev machine; the Dockerfile invokes the same command).
    - [ ] `npm test -- --run` — Vitest test count unchanged from the e11-s3 close (127 + any tests landed since; this story adds NONE).
    - **AC-Subitem Completion Check** (project-context A29): list per-AC status in Completion Notes — AC-1..AC-16 each marked `covered / N/A / deferred` with one-line evidence pointer.

## Tasks / Subtasks

- [ ] **Task 1 — Author `frontend/.dockerignore` (AC: 10)** — file at `frontend/.dockerignore` with the exclusion list per AC-10. Order entries by category with leading comments. Verify `frontend/.gitignore` does NOT already cover all the entries (don't duplicate but don't rely on .gitignore — `.dockerignore` is the source of truth for build-context exclusion).

- [ ] **Task 2 — Author `frontend/Dockerfile` (AC: 1-12)** — file at `frontend/Dockerfile`. Reference structure:
  ```dockerfile
  # syntax=docker/dockerfile:1.7

  ARG NODE_TAG=22-alpine

  # ---- deps stage -------------------------------------------------------------
  FROM node:${NODE_TAG} AS deps
  WORKDIR /app

  # Copy lockfile first for layer caching on dependency edits.
  COPY package.json package-lock.json ./
  RUN npm ci --frozen-lockfile

  # ---- build stage ------------------------------------------------------------
  FROM node:${NODE_TAG} AS build
  WORKDIR /app

  # Build-time public env vars — baked into the client bundle by `next build`.
  # ALL must be declared as BOTH ARG and ENV: ARG accepts --build-arg; ENV exposes
  # to the `next build` Node process (otherwise process.env.NEXT_PUBLIC_* is undefined
  # at build time and Next.js silently inlines empty strings into the client bundle).
  ARG NEXT_PUBLIC_API_URL
  ARG NEXT_PUBLIC_KEYCLOAK_URL
  ARG NEXT_PUBLIC_KEYCLOAK_REALM
  ARG NEXT_PUBLIC_KEYCLOAK_CLIENT_ID
  ARG NEXT_PUBLIC_KEYCLOAK_ISSUER
  ARG NEXT_PUBLIC_ENV_LABEL=
  ARG NEXT_PUBLIC_DOCUMENT_HOST=localhost:9000
  ARG NEXT_PUBLIC_SOURCE_URL=https://github.com/htos/iab-connect
  ARG NEXT_PUBLIC_FEEDBACK_URL=
  ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
      NEXT_PUBLIC_KEYCLOAK_URL=$NEXT_PUBLIC_KEYCLOAK_URL \
      NEXT_PUBLIC_KEYCLOAK_REALM=$NEXT_PUBLIC_KEYCLOAK_REALM \
      NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID \
      NEXT_PUBLIC_KEYCLOAK_ISSUER=$NEXT_PUBLIC_KEYCLOAK_ISSUER \
      NEXT_PUBLIC_ENV_LABEL=$NEXT_PUBLIC_ENV_LABEL \
      NEXT_PUBLIC_DOCUMENT_HOST=$NEXT_PUBLIC_DOCUMENT_HOST \
      NEXT_PUBLIC_SOURCE_URL=$NEXT_PUBLIC_SOURCE_URL \
      NEXT_PUBLIC_FEEDBACK_URL=$NEXT_PUBLIC_FEEDBACK_URL

  COPY --from=deps /app/node_modules ./node_modules
  COPY . .
  RUN npm run build

  # ---- runtime stage ----------------------------------------------------------
  FROM node:${NODE_TAG} AS runtime
  WORKDIR /app

  ENV NODE_ENV=production \
      PORT=3000 \
      HOSTNAME=0.0.0.0

  # OCI labels for GHCR provenance (ADR-014, ADR-009). Per-build labels are
  # injected at `docker buildx build --label …` time by E20-S5 CI.
  LABEL org.opencontainers.image.source="https://github.com/htos/iab-connect" \
        org.opencontainers.image.licenses="AGPL-3.0-or-later" \
        org.opencontainers.image.title="IAB Connect Web" \
        org.opencontainers.image.description="Next.js frontend for IAB Connect — AGPL-3.0-or-later open-source membership platform." \
        org.opencontainers.image.vendor="IAB Connect contributors"

  # Copy the standalone output (server.js + trimmed node_modules) + static assets + public.
  # --chown ensures the `node` user (UID 1000, pre-created in node:22-alpine) can read them.
  COPY --from=build --chown=node:node /app/.next/standalone ./
  COPY --from=build --chown=node:node /app/.next/static ./.next/static
  COPY --from=build --chown=node:node /app/public ./public

  USER node

  EXPOSE 3000

  ENTRYPOINT ["node", "server.js"]
  ```

- [ ] **Task 3 — Sanity-check `next.config.ts` standalone shape (AC: 1, 7)** — before docker-build, run from `frontend/`:
  ```sh
  npm run build
  ls -la .next/standalone/server.js
  ls -la .next/static
  ls -la public
  ```
  All three paths must exist. If `.next/standalone/server.js` is missing OR is nested under a `frontend/` subdir, E11-S3's `output: "standalone"` + `outputFileTracingRoot: path.join(__dirname)` did not take effect — escalate (do NOT proceed with Dockerfile authoring blind; the COPY paths in Task 2 assume the flat shape).

- [ ] **Task 4 — Build with Dev-shape args (AC: 13)** — from repo root:
  ```sh
  docker build \
    --build-arg NEXT_PUBLIC_API_URL=http://localhost:5000 \
    --build-arg NEXT_PUBLIC_KEYCLOAK_URL=http://localhost:8080 \
    --build-arg NEXT_PUBLIC_KEYCLOAK_REALM=iabconnect \
    --build-arg NEXT_PUBLIC_KEYCLOAK_CLIENT_ID=iabconnect-frontend \
    --build-arg NEXT_PUBLIC_KEYCLOAK_ISSUER=http://localhost:8080/realms/iabconnect \
    -t iabc-web:test frontend/
  ```
  Expected: success, image size ≤ 250 MB. Capture `docker images iabc-web:test --format '{{.Size}}'` in Completion Notes.

- [ ] **Task 5 — Build with Beta-shape args + bake-evidence greps (AC: 14)** — see AC-14 for the full command and grep expectations. Capture both grep outputs verbatim in Completion Notes.

- [ ] **Task 6 — Runtime smoke test on 0.0.0.0:3000 (AC: 8, 15)** — see AC-15 command. CRITICAL: confirm the `Network: http://0.0.0.0:3000` line in stdout — this proves `HOSTNAME=0.0.0.0` overrode the default `localhost` bind. Without this, the container is unreachable from the host even though port-forwarding is set. Capture stdout + curl response in Completion Notes.

- [ ] **Task 7 — Verify non-root user (AC: 6)** —
  ```sh
  docker run --rm --entrypoint /bin/sh iabc-web:test -c "id && ls -la /app/server.js"
  ```
  Expected: `uid=1000(node) gid=1000(node) groups=1000(node)` and `/app/server.js` owned by node:node (not root).

- [ ] **Task 8 — Frontend quality gates (AC: 16)** — from `frontend/`:
  - [ ] 8.1 `npm run typecheck` — exit 0.
  - [ ] 8.2 `npm run lint` — only the 2 pre-existing baseline errors remain.
  - [ ] 8.3 `npm run build` — green (already exercised by Task 3 but rerun after any iteration).
  - [ ] 8.4 `npm test -- --run` — Vitest unchanged from E11-S3 baseline (~127 tests across 17 files).
  - [ ] 8.5 AC-Subitem Completion Check per project-context A29 — list AC-1..AC-16 with `covered / N/A / deferred` markers in Completion Notes.

- [ ] **Task 9 — Add README "Build" section note (documentation hygiene)** — in `README.md`, append a single line in the same "Build" / "Docker" section that E12-S1 Task 8 touched:
  ```
  # Frontend container image (Beta-shape): docker build --build-arg NEXT_PUBLIC_API_URL=… --build-arg NEXT_PUBLIC_KEYCLOAK_ISSUER=… -t iabc-web frontend/
  ```
  Keep it minimal — the full GHCR-publish flow (with all build-args) is documented by E20-S5.

- [!] **Task 10 — Manual verification: SOURCE_URL fork-friendly bake (AC: 4, 14)** — `[!]` per project-context A30 because this requires running an interactive browser session that the dev agent cannot launch:
  - Build with `--build-arg NEXT_PUBLIC_SOURCE_URL=https://github.com/example-fork/iab-connect`.
  - Start the container.
  - Open `http://localhost:3000` in a browser → confirm the footer (once E20-S4 lands) links to the fork URL.
  - Mark `[x]` only after human review confirms. **Note:** Until E20-S4 lands, this task is partially blocked — the dev agent should verify the baked string via `docker run --rm --entrypoint /bin/sh iabc-web:test -c "grep -r 'example-fork' /app/.next/static" || true` instead and mark `[!]` until E20-S4 closes.

## Dev Notes

### Stack version pinning (AC: 2)

[Source: [frontend/package.json](frontend/package.json), [frontend/package.json:75-77](frontend/package.json#L75-L77)]

- Engines: Node ≥ 22 (matches `node:22-alpine`).
- Next.js: `^16.1.6` — Next 16's stable Turbopack is dev-only; production `next build` still uses webpack-compatible bundling. `output: "standalone"` is officially supported.
- React: `^19.2.4` — only matters at the application level, not the Dockerfile.
- TypeScript: `^5.9.3` — `tsconfig.json` `moduleResolution: "bundler"` ([frontend/tsconfig.json:15](frontend/tsconfig.json#L15)) is compatible with Next 16's build pipeline.

### Why three stages (deps, build, runtime) and not two

The deps→build separation is a Next.js best-practice (per the Next.js documentation example Dockerfile). With only build+runtime stages, ANY source edit invalidates the `npm ci` layer cache because `COPY . .` happens before the install. With deps as a separate stage, only `package.json` / `package-lock.json` changes invalidate the install — typical iteration on `src/` re-uses the cached `node_modules` layer, cutting cold-start docker-build time from ~4 minutes to ~30 seconds.

### Why all `NEXT_PUBLIC_*` are build-args (AC: 4)

[Source: [frontend/.env.example:8-10](frontend/.env.example#L8-L10), [next.config.ts:27-33](frontend/next.config.ts#L27-L33)]

`NEXT_PUBLIC_*` env vars are inlined into the static client bundle at `next build` time. Once baked, they cannot be changed without a rebuild. The image must therefore receive them at build time, not runtime. Server-only env vars (`NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `KEYCLOAK_CLIENT_SECRET`, `KEYCLOAK_ISSUER`) are read at runtime by NextAuth via the Node `process.env` API — those stay as runtime `-e` flags / Railway env vars, NOT build-args.

The 9 `NEXT_PUBLIC_*` vars and their consumers:
- `NEXT_PUBLIC_API_URL` — backend base URL; read by ~25 client/server modules (per [.env.example:18](frontend/.env.example#L18)).
- `NEXT_PUBLIC_KEYCLOAK_URL`, `NEXT_PUBLIC_KEYCLOAK_REALM`, `NEXT_PUBLIC_KEYCLOAK_CLIENT_ID` — password-reset deep-link constructor at `app/login/page.tsx:154`.
- `NEXT_PUBLIC_KEYCLOAK_ISSUER` — logout redirect at `lib/auth.ts:135`.
- `NEXT_PUBLIC_ENV_LABEL` — BETA banner trigger (E11-S2, lives in the Layout).
- `NEXT_PUBLIC_DOCUMENT_HOST` — next/image `remotePatterns` host (E11-S3).
- `NEXT_PUBLIC_SOURCE_URL` — license footer (E20-S4) + BETA banner feedback fallback (E11-S2).
- `NEXT_PUBLIC_FEEDBACK_URL` — overrides BETA banner feedback link (E11-S2).

### Why `HOSTNAME=0.0.0.0` is mandatory (AC: 8)

[Source: Next.js standalone runtime docs; observed-failure-mode]

The standalone `server.js` invokes Node's `http.createServer().listen(port, hostname)`. Default hostname is `localhost`, which on Linux resolves to `127.0.0.1` — a loopback bind that ONLY accepts connections from inside the container. Docker port-forwarding (`-p 3000:3000`) shovels host traffic into the container's network namespace; if the server is loopback-bound, that traffic never reaches the listener and connections hang or RST. Setting `HOSTNAME=0.0.0.0` makes the server bind to all interfaces.

This is the #1 silent-failure mode for Next.js standalone in Docker. The error symptom is `curl: (52) Empty reply from server` or `connection reset by peer` — no log line, no exception. The bake-evidence in Task 6 explicitly looks for the `Network: http://0.0.0.0:3000` line in stdout to confirm.

### Why Alpine is safe for Node (and not safe for .NET)

[Source: E12-S1 ADR-017 + ICU rationale]

Alpine's `musl` libc and stripped-down Linux userspace breaks .NET's ICU-dependent globalization (cron parsing, timezone resolution). Node has no such dependency — its V8 runtime ships its own ICU data in the v8 binary, and Node's `Intl` API works on Alpine out of the box. So `node:22-alpine` is the correct choice for the frontend even though `aspnet:10.0-alpine` would be wrong for the backend. The two stories make different stack-specific image choices for the same valid reason.

### Why `output: "standalone"` and not `next start`

[Source: [frontend/next.config.ts:13-22](frontend/next.config.ts#L13-L22), E11-S3 AC-2]

`next start` requires the full `node_modules/` tree (~500 MB on disk) in the runtime image — a significant size hit. `next build` with `output: "standalone"` emits a self-contained `server.js` + minimal trimmed `node_modules/` (only the packages actually imported at request-handling time), reducing runtime image footprint to ~60 MB on top of the Alpine base. The trade-off is that `server.js` is a generated entrypoint that does NOT pick up `npm` lifecycle scripts at boot — so anything that would have run via `next start`'s wrapping must be encoded into the standalone build at build time (handled by `outputFileTracingRoot` in `next.config.ts`).

### `outputFileTracingRoot` necessity

[Source: [next.config.ts:18-22](frontend/next.config.ts#L18-L22)]

E11-S3 added `outputFileTracingRoot: path.join(__dirname)` to pin the trace root to `frontend/`. Without this, Next.js infers a workspace root from the nearest parent lockfile — and `iab-connect/` may have ambient lockfiles in `_bmad/`, `_bmad-output/`, or future tooling subdirs. The wrong inferred root produces a nested `.next/standalone/iab-connect/frontend/server.js` instead of the expected flat `.next/standalone/server.js`. The Task 3 sanity-check explicitly catches this regression.

### What this story does NOT do

- Does NOT publish to GHCR — that's E20-S5.
- Does NOT add the backend Dockerfile — that's E12-S1.
- Does NOT add the custom Keycloak image — that's E12-S3.
- Does NOT add `docker-compose.full.yml` — that's E12-S4.
- Does NOT implement the license footer that consumes `NEXT_PUBLIC_SOURCE_URL` — that's E20-S4. This story bakes the env var; consumption is downstream.
- Does NOT modify any frontend application code (`src/**`). The only frontend file edited (if any) is `.dockerignore`. Source code is read-only context for this story.
- Does NOT implement `/api/health` (Next.js health endpoint for ADR-017) — that's E17-S3 (Wave 8).

### Project Structure Notes

**NEW files** (2):
- `frontend/Dockerfile`
- `frontend/.dockerignore`

**EDIT files** (1):
- `README.md` — one-line build-command note per Task 9.

**NO source code changes** in `frontend/src/**`. The bake-time vars are already consumed by source written in E11-S3 + earlier; this story exposes them via the Dockerfile contract.

### References

- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 3 — REQ-088 AC-1]
- [Source: _bmad-output/planning-artifacts/architecture.md#L272-L304 — ADR-012 Service Topology on Railway]
- [Source: _bmad-output/planning-artifacts/architecture.md#L317-L328 — ADR-014 Container Image Distribution — GHCR]
- [Source: _bmad-output/planning-artifacts/architecture.md#L329-L342 — ADR-015 Configuration and Environment Strategy]
- [Source: _bmad-output/planning-artifacts/architecture.md#L396-L407 — ADR-021 Source-Disclosure Mechanism]
- [Source: _bmad-output/planning-artifacts/epics-and-stories.md#L1293-L1312 — Epic E12 Story E12-S2 spec]
- [Source: frontend/package.json — Node ≥ 22, Next ^16.1.6 pin]
- [Source: frontend/next.config.ts:13-22 — output:standalone + outputFileTracingRoot from E11-S3]
- [Source: frontend/.env.example — full NEXT_PUBLIC_* env var inventory]
- [Source: _bmad-output/implementation-artifacts/e12-s1-add-backend-dockerfile-multistage.md — pattern reused (multi-stage, non-root, OCI labels, build-args via ARG+ENV)]
- [Source: _bmad-output/implementation-artifacts/e11-s3-make-next-config-environment-driven.md — Wave-2 closing story; bake-evidence convention]
- [Source: project-context.md A28-A30 — Spike-First / AC-Subitem Check / Three-State Task Checkbox]
- [Source: https://nextjs.org/docs/app/api-reference/next-config-js/output — Next.js standalone output docs]

## Dev Agent Record

### Agent Model Used

_To be filled by dev agent on first commit._

### Debug Log References

### Completion Notes List

### File List

## Questions / Clarifications

1. **README "Build" section location.** Same Q as E12-S1 Task 8 — if no "Build" section exists, append a minimal `### Docker (Beta-shape)` section under the closest existing "Local development" heading, keeping it ≤ 4 lines total for both backend + frontend image commands.

2. **`package-lock.json` presence.** The Dockerfile's `npm ci --frozen-lockfile` requires `frontend/package-lock.json` to exist. If absent (e.g., `pnpm-lock.yaml` or `yarn.lock` is the lockfile instead), the deps stage will fail. Sanity-check before authoring: `ls frontend/package-lock.json`. If absent, escalate to the user before adapting the Dockerfile to a different package manager.

3. **License footer / fork SOURCE_URL bake (Task 10).** Until E20-S4 lands the footer that visually surfaces `NEXT_PUBLIC_SOURCE_URL`, the only way to verify the bake is via `grep` against the static bundle. Once E20-S4 closes, the manual verification becomes a browser DOM check — re-evaluate the `[!]` marker then.
