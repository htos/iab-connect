# syntax=docker/dockerfile:1.7
#
# IAB Connect — Next.js 16 frontend (multi-stage, standalone output, non-root).
#
# Story: E12-S2 (Frontend Dockerfile, Next standalone).
# Companion: backend/Dockerfile (E12-S1).
#
# Stages:
#   deps    — node:22-alpine; `npm ci` against the lockfile. Isolated so source
#             edits do not invalidate the slow install layer.
#   build   — node:22-alpine; declares ALL 9 NEXT_PUBLIC_* as both ARG and ENV,
#             then `next build` bakes them into the static client bundle.
#             E11-S3's `output: "standalone"` + `outputFileTracingRoot` produce
#             a flat `.next/standalone/server.js`.
#   runtime — node:22-alpine; copies the standalone shape under /app, runs as
#             the pre-created `node` user (UID 1000), binds `0.0.0.0:3000`.
#
# Per-build OCI revision / created labels are injected by E20-S5 CI via
# `docker buildx build --label …` and are intentionally NOT baked here.

ARG NODE_TAG=22-alpine

# ---- deps stage ---------------------------------------------------------------
FROM node:${NODE_TAG} AS deps
WORKDIR /app

# Pin npm to the same patch version as the host that generated package-lock.json.
# node:22-alpine bundles npm 10.x while package-lock.json is authored with
# npm 11.x; the mismatched lockfile parser otherwise reports "out of sync"
# for optional peer-dep transitives (observed: @swc/helpers). Pin to a specific
# patch (not just major) so a future npm@11 minor/patch release cannot regress
# the build silently.
RUN npm install -g npm@11.6.0

# Lockfile-first copy maximizes layer-cache reuse: src/ edits do not invalidate
# the (slow) npm install layer; only package.json or package-lock.json do.
COPY package.json package-lock.json ./
RUN npm ci

# ---- build stage --------------------------------------------------------------
FROM node:${NODE_TAG} AS build
WORKDIR /app

# Build-time public env vars — baked into the client bundle by `next build`.
# CRITICAL: each NEXT_PUBLIC_* MUST be declared as BOTH ARG and ENV. ARG accepts
# the --build-arg value; ENV exposes it to the Node process running `next build`.
# Without the ENV bridge, process.env.NEXT_PUBLIC_* is undefined at build time
# and Next.js silently inlines empty strings into the static client chunks.
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

# Fail-fast if a required NEXT_PUBLIC_* build-arg is empty. Without this guard,
# `next build` silently inlines empty strings into the static client bundle,
# producing an image whose Keycloak deep-links collapse to relative URLs at
# runtime — the symptom appears only on first browser login (404 on OIDC
# discovery). Five vars are required for OIDC + API + Keycloak deep-links.
RUN test -n "$NEXT_PUBLIC_API_URL" \
     -a -n "$NEXT_PUBLIC_KEYCLOAK_URL" \
     -a -n "$NEXT_PUBLIC_KEYCLOAK_REALM" \
     -a -n "$NEXT_PUBLIC_KEYCLOAK_CLIENT_ID" \
     -a -n "$NEXT_PUBLIC_KEYCLOAK_ISSUER" \
     || (echo "ERROR: one or more required NEXT_PUBLIC_* build args are empty (API_URL, KEYCLOAK_URL, KEYCLOAK_REALM, KEYCLOAK_CLIENT_ID, KEYCLOAK_ISSUER). Pass them via --build-arg." >&2 && exit 1)

# `next build` honours next.config.ts (`output: "standalone"`, `outputFileTracingRoot`)
# and emits .next/standalone/server.js + a trimmed node_modules tree.
RUN npm run build

# ---- runtime stage ------------------------------------------------------------
FROM node:${NODE_TAG} AS runtime
WORKDIR /app

# HOSTNAME=0.0.0.0 is MANDATORY for Next.js standalone in Docker. The default is
# `localhost`, which loopback-binds inside the container and silently rejects
# host port-forwarded traffic ("Empty reply from server" / connection reset).
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# OCI image labels for GHCR provenance (ADR-014, ADR-009). Per-build labels
# (revision, created) are injected by E20-S5 CI at `docker buildx build` time
# and are intentionally NOT baked here.
LABEL org.opencontainers.image.source="https://github.com/htos/iab-connect" \
      org.opencontainers.image.licenses="AGPL-3.0-or-later" \
      org.opencontainers.image.title="IAB Connect Web" \
      org.opencontainers.image.description="Next.js frontend for IAB Connect — AGPL-3.0-or-later open-source membership platform." \
      org.opencontainers.image.vendor="IAB Connect contributors"

# Copy the standalone shape: server.js + trimmed node_modules at /app root,
# hashed client chunks under .next/static, static assets under public.
# --chown ensures the `node` user (UID 1000, pre-created in node:22-alpine)
# can read the files at runtime (default COPY ownership is root:root).
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

USER node

EXPOSE 3000

# HEALTHCHECK uses node-only HTTP (node:22-alpine doesn't ship curl/wget by
# default). A 4xx/5xx response is unhealthy; network/parse errors are unhealthy.
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/',r=>process.exit(r.statusCode<400?0:1)).on('error',()=>process.exit(1))" || exit 1

# Exec form ensures SIGTERM from Railway's redeploy reaches Node directly so
# the standalone server can flush in-flight requests before exit.
ENTRYPOINT ["node", "server.js"]
