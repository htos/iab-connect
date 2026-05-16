# Story 11.3: Make `next.config.ts` environment-driven

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As **the maintainer / self-hoster of IAB Connect**,
I want **the frontend's image-host allowlist and API base URL to be derived from build-time environment variables (with a localhost dev fallback) and the Next.js build to emit a standalone output**,
so that **a single frontend codebase produces images that are deployable to Beta/Production (or any fork) without source changes, and the E12-S2 Frontend Dockerfile can copy `.next/standalone/` to ship a self-contained runtime**.

**Requirement:** REQ-088 AC-4 (no hardcoded hosts in non-test code). Epic E11 (Environment and Configuration Management for Beta), Story 3 of 3 — the **last Wave-2 story** per SCP-2026-05-15 §6. Closes the configuration-surface foundation begun by E11-S1 and the runtime hardening wired by E11-S2.

**Upstream:** E11-S1 added the three new build-time env vars to `frontend/.env.example` (`NEXT_PUBLIC_ENV_LABEL`, `NEXT_PUBLIC_DOCUMENT_HOST`, `NEXT_PUBLIC_SOURCE_URL`) and the E11-S1 audit (Task 6.2) explicitly deferred `frontend/next.config.ts:14-27` to **this** story. E11-S2 consumed `NEXT_PUBLIC_ENV_LABEL` (BETA banner). E11-S3 consumes the remaining one (`NEXT_PUBLIC_DOCUMENT_HOST`) and adds `output: 'standalone'` for the downstream Dockerfile.

**Downstream:** E12-S2 (Frontend Dockerfile) — its build-stage passes `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_ENV_LABEL` / `NEXT_PUBLIC_DOCUMENT_HOST` / `NEXT_PUBLIC_SOURCE_URL` as build-args, runs `next build`, then COPYs `.next/standalone/` and `.next/static/` to a `node:22-alpine` runtime stage running `node server.js`. **Without `output: 'standalone'` from this story, E12-S2 cannot land.** E13-S2 (Railway env vars) sets the build-arg values for Beta deployment.

**Wave context:** SCP-2026-05-15 §6 places this story in **Wave 2 (Configuration hygiene)** — `E11-S1` ✅ done, `E11-S2` ✅ review, `E11-S3` ← this story. After this, Wave 2 closes and Wave 3 (E12 Containerization) can begin.

## Acceptance Criteria

1. **`frontend/next.config.ts`: `images.remotePatterns` is computed from `process.env.NEXT_PUBLIC_DOCUMENT_HOST` at build time, with a `localhost:9000` fallback for dev.** Replace the current hardcoded literal at [frontend/next.config.ts:19-28](frontend/next.config.ts#L19-L28):
   ```ts
   images: {
     remotePatterns: [
       { protocol: "http", hostname: "localhost", port: "9000", pathname: "/iabconnect-documents/**" },
     ],
   },
   ```
   …with a computed pattern derived from `process.env.NEXT_PUBLIC_DOCUMENT_HOST?.trim() || "localhost:9000"`. The computation MUST:
   - Parse a value of the form `host`, `host:port`, `http://host[:port]`, or `https://host[:port]`.
   - Default the protocol to `http` for `localhost` / `127.0.0.1` hosts and `https` for any other host when no explicit scheme is provided (so dev with `localhost:9000` produces `http://`; Beta with `docs.example.app` produces `https://`).
   - Preserve the existing `pathname` glob shape so `next/image` keeps working with the existing `imageUrl` values in events / blog / payments / transactions pages. Use `/**` (permissive, allows any path under the allowed host) so a Beta CDN can rewrite URLs without re-hitting this story — RustFS bucket name is no longer hard-coded into the path glob.
   - Use a separate, exported helper function so the parsing logic is unit-testable in Vitest (Next.js config files cannot be imported directly in jsdom test environment).

2. **`output: 'standalone'` is enabled in `frontend/next.config.ts`.** Add `output: "standalone"` at the top level of the `nextConfig` object. Result: `next build` emits `.next/standalone/` (a self-contained Node app bundle with `server.js`) and `.next/static/` (client assets). The dev workflow (`npm run dev` → `next dev --turbopack`) is unaffected; the production-style start (`npm run start` → `next start`) also continues to work in standalone mode (Next.js handles both shapes).

3. **`NEXT_PUBLIC_API_URL` continues to be exposed but is documented in-file as build-time-constant.** Keep the existing `env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000" }` block at [frontend/next.config.ts:13-16](frontend/next.config.ts#L13-L16). Add a brief in-file comment above the block stating: any URL change requires a rebuild (`next build`), and the build-arg pattern documented in [frontend/.env.example](frontend/.env.example) is the source of truth. Do NOT promote this to runtime config — the `NEXT_PUBLIC_` prefix is the Next.js contract for build-time-baked.

4. **No other changes to `next.config.ts`.** The `reactStrictMode: true`, the `headers()` block (security headers — owned by E14-S2 review, NOT this story), and the `withNextIntl(...)` wrapper at the export site are unchanged. The only structural additions are: (a) the import of the new helper module, (b) the `output: "standalone"` key, (c) the replaced `images` block, (d) one in-file comment above the `env` block.

5. **New helper module `frontend/src/lib/config/document-host.ts`.** Exports:
   - `export const DEFAULT_DOCUMENT_HOST = "localhost:9000";` — single source of truth for the dev fallback, mirrored in the helper to keep `next.config.ts` short.
   - `export type DocumentHost = { protocol: "http" | "https"; hostname: string; port: string };`
   - `export function parseDocumentHost(value: string): DocumentHost` — implementation per the parsing rules in AC-1. Throws `TypeError` if `value` is empty after trim, or if `URL` parsing fails after fallback prepend. Trims input. Treats `localhost` and `127.0.0.1` as the protocol-default-`http` hosts; everything else defaults to `https`.
   - `export function getRemotePatternFromEnv(envValue: string | undefined): { protocol: "http" | "https"; hostname: string; port: string; pathname: string }` — convenience wrapper used by `next.config.ts` that applies the `?? DEFAULT_DOCUMENT_HOST` fallback, calls `parseDocumentHost`, and adds `pathname: "/**"`.
   - Path: `frontend/src/lib/config/document-host.ts`. Kebab-case file name per established project convention ([frontend/src/lib/api-client.ts](frontend/src/lib/api-client.ts), [frontend/src/lib/email-templates.ts](frontend/src/lib/email-templates.ts)). The `config/` subdirectory is new but trivial.

6. **Vitest unit tests for the helper module.** New file `frontend/src/lib/config/document-host.test.ts` (Node environment is fine — no DOM needed). Tests cover at minimum:
   - `parseDocumentHost("localhost:9000")` → `{ protocol: "http", hostname: "localhost", port: "9000" }` (default-dev case).
   - `parseDocumentHost("127.0.0.1:9000")` → `{ protocol: "http", hostname: "127.0.0.1", port: "9000" }` (alternative localhost).
   - `parseDocumentHost("docs.example.app")` → `{ protocol: "https", hostname: "docs.example.app", port: "" }` (Beta CDN case).
   - `parseDocumentHost("https://docs.example.app")` → `{ protocol: "https", hostname: "docs.example.app", port: "" }` (explicit scheme).
   - `parseDocumentHost("http://docs.example.app:8080")` → `{ protocol: "http", hostname: "docs.example.app", port: "8080" }` (explicit scheme + port).
   - `parseDocumentHost("  localhost:9000  ")` → trims whitespace.
   - `parseDocumentHost("")` and `parseDocumentHost("   ")` → throw `TypeError` (empty value).
   - `getRemotePatternFromEnv(undefined)` → uses default and returns `{ protocol: "http", hostname: "localhost", port: "9000", pathname: "/**" }`.
   - `getRemotePatternFromEnv("")` → falls through `?? DEFAULT_DOCUMENT_HOST` (because `"" || x === x`) and uses default.
   - `getRemotePatternFromEnv("docs.example.app")` → `{ protocol: "https", hostname: "docs.example.app", port: "", pathname: "/**" }`.

7. **`frontend/.env.example`: replace the `NEXT_PUBLIC_DOCUMENT_HOST=localhost:9000` line's "Optional" annotation tense.** Currently [frontend/.env.example:57-60](frontend/.env.example#L57-L60) reads:
   ```
   # Optional: hostname of the document-storage CDN/proxy for next/image remotePatterns.
   # Dev default localhost:9000 (RustFS); Beta replaces with Railway-assigned host (E12-S2 build-arg).
   # Consumed by E11-S3 refactor of next.config.ts. NEXT_PUBLIC_ → build-time-constant — rebuild required after change.
   NEXT_PUBLIC_DOCUMENT_HOST=localhost:9000
   ```
   Update the third comment line from "Consumed by E11-S3 refactor of next.config.ts" to "Consumed by `next.config.ts` `images.remotePatterns`" (drop the forward reference now that the consumer ships in this story). Keep "Optional" — the parser falls back to `localhost:9000` when unset, so dev workflows that don't define it still work. Do NOT change the placeholder value or the annotation tier.

8. **No code changes outside `frontend/next.config.ts`, `frontend/src/lib/config/document-host.ts`, `frontend/src/lib/config/document-host.test.ts`, and `frontend/.env.example`.** Components that use `next/image` (8 pages enumerated in Dev Notes) work unchanged because the parsed `remotePatterns` continues to allow the same dev host (`localhost:9000`) by default. No `package.json` dependency adds. No `tsconfig.json` change. No `eslint.config.{ts,mjs}` change. No `messages/*.json` translation key additions (no user-visible UI).

9. **Build-arg-baking smoke evidence in Completion Notes.** Capture the following from the dev agent's terminal in Completion Notes:
   - Default build (no env var set): `cd frontend && npm run build`. After: `grep -r "localhost" .next/server/required-server-files.json` returns matches with port `9000` and protocol `http`. This confirms the default fallback baked.
   - Beta-shape build: `NEXT_PUBLIC_API_URL=https://api.example.app NEXT_PUBLIC_DOCUMENT_HOST=docs.example.app npm run build`. After: `grep -r "docs.example.app" .next/` returns matches (specifically the serialized remote pattern in `.next/server/required-server-files.json` or similar) AND `grep -r "https://api.example.app" .next/static/` returns matches (the build-time-baked `NEXT_PUBLIC_API_URL` inlined into client chunks). The two greps together prove both env vars baked correctly.
   - Standalone output present: `ls frontend/.next/standalone/server.js` after the Beta-shape build. The file MUST exist (proves `output: 'standalone'` took effect). The file is a generated Node entrypoint that E12-S2 will run via `CMD ["node", "server.js"]`.
   - **Note on the epic test-evidence wording:** The epic specifies `docker build --build-arg ...` then `grep -r "api.example.app" .next/static/`. The `.next/static/` location for `api.example.app` is correct (NEXT_PUBLIC_API_URL is client-inlined). The Docker build step from the epic CANNOT run here because the frontend Dockerfile is E12-S2's deliverable. The dev agent SUBSTITUTES `npm run build` for `docker build` and captures the equivalent evidence above. E12-S2 will exercise the full `docker build --build-arg` path.

10. **`dotnet build` + `dotnet test` are NOT required.** This story does not touch any `backend/` file. The backend baseline (1957/1957 from E11-S2) remains unchanged. Mention in Completion Notes that backend was untouched.

11. **Quality gates.** `npm run typecheck` (from `frontend/`) — exit 0; the new helper module typechecks cleanly. `npm run lint` — green; same 2 pre-existing baseline errors in `frontend/src/app/members/segments/page.tsx` (E9.S2 defer, documented in `_bmad-output/implementation-artifacts/deferred-work.md`) remain unchanged, no NEW lint errors introduced. `npm run build` — green Next.js production build with the new standalone output emitted. `npm test -- --run` (Vitest) — record the new total (was 96 after E11-S2, expect +9 to ≈105 from the new `document-host.test.ts`). All new tests pass.

12. **No `.dockerignore` or Dockerfile additions.** E12-S2 owns those. This story is config-only on the frontend code side. If the dev agent observes that `.next/standalone/` produces files that `frontend/.gitignore` does not cover, verify: `frontend/.gitignore` already excludes `.next/` (existing) so the entire `.next/standalone/` subtree is ignored — no `.gitignore` change needed. Document the verification one-liner in Completion Notes.

## Tasks / Subtasks

- [x] **Task 1 — Create the helper module `frontend/src/lib/config/document-host.ts` (AC: 5)** — establish the parsing logic in a single, testable place.
  - [x] 1.1 Create the directory `frontend/src/lib/config/` (does not exist yet — confirm with `ls frontend/src/lib/`).
  - [x] 1.2 Author `document-host.ts`. Module shape (≈40-60 lines including JSDoc):
    ```ts
    // (SPDX header line 1 omitted — E20-S2 policy is ready-for-dev but not yet implemented; adding it
    // here is forward-compatible but not required by this story's scope.)

    /**
     * Parses NEXT_PUBLIC_DOCUMENT_HOST into a Next.js images.remotePatterns shape.
     * Build-time only — consumed by next.config.ts. Never read at runtime in client code.
     *
     * Accepted input shapes:
     *   "localhost:9000"            → http://localhost:9000   (dev default — protocol defaults to http for localhost)
     *   "127.0.0.1:9000"            → http://127.0.0.1:9000   (alt localhost)
     *   "docs.example.app"          → https://docs.example.app (non-localhost defaults to https)
     *   "https://docs.example.app"  → https://docs.example.app (explicit scheme honored)
     *   "http://docs.example.app:8080" → http://docs.example.app:8080
     *
     * REQ-088 AC-4 (E11-S3): frontend image host is environment-driven, not hardcoded.
     */
    export const DEFAULT_DOCUMENT_HOST = "localhost:9000";

    export type DocumentHost = {
      protocol: "http" | "https";
      hostname: string;
      port: string;
    };

    export function parseDocumentHost(value: string): DocumentHost {
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        throw new TypeError("NEXT_PUBLIC_DOCUMENT_HOST must be a non-empty string");
      }
      const hasScheme = trimmed.includes("://");
      const candidate = hasScheme ? trimmed : `http://${trimmed}`;
      const url = new URL(candidate);
      const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
      const protocol = hasScheme
        ? (url.protocol.replace(":", "") as "http" | "https")
        : isLocalhost
          ? "http"
          : "https";
      return { protocol, hostname: url.hostname, port: url.port };
    }

    export function getRemotePatternFromEnv(envValue: string | undefined) {
      const host = (envValue?.trim() || DEFAULT_DOCUMENT_HOST);
      const parsed = parseDocumentHost(host);
      return { ...parsed, pathname: "/**" } as const;
    }
    ```
  - [x] 1.3 Verify file passes typecheck: `cd frontend && npx tsc --noEmit src/lib/config/document-host.ts` (or just `npm run typecheck` at the repo root after the file lands).
  - [x] 1.4 Verify the file passes ESLint: `cd frontend && npx eslint src/lib/config/document-host.ts`. If the `as` cast in `protocol` triggers a rule, replace with a typed-narrowing if-branch — the cast is safe (`url.protocol` is constrained by the URL constructor) but ESLint may not know that.
- [x] **Task 2 — Author Vitest tests for the helper (AC: 6)** — exercise every parsing branch.
  - [x] 2.1 Create `frontend/src/lib/config/document-host.test.ts` (Node environment is the Vitest default — no `@vitest-environment` pragma needed).
  - [x] 2.2 Test shape (~70-90 lines including imports / describe blocks):
    ```ts
    import { describe, it, expect } from "vitest";
    import {
      parseDocumentHost,
      getRemotePatternFromEnv,
      DEFAULT_DOCUMENT_HOST,
    } from "./document-host";

    describe("parseDocumentHost", () => {
      it("returns http+9000 for the default dev localhost:9000", () => { ... });
      it("returns http for 127.0.0.1 host (alt localhost)", () => { ... });
      it("returns https for a bare non-localhost hostname", () => { ... });
      it("honors an explicit https:// scheme", () => { ... });
      it("honors an explicit http:// scheme with a non-localhost host", () => { ... });
      it("preserves an explicit port from a full URL", () => { ... });
      it("returns empty port string when no port is provided", () => { ... });
      it("trims surrounding whitespace", () => { ... });
      it("throws TypeError on empty string", () => { ... });
      it("throws TypeError on whitespace-only string", () => { ... });
    });

    describe("getRemotePatternFromEnv", () => {
      it("falls back to localhost:9000 when undefined", () => { ... });
      it("falls back to localhost:9000 when empty string", () => { ... });
      it("uses the value when provided", () => { ... });
      it("attaches pathname '/**'", () => { ... });
      it("exposes DEFAULT_DOCUMENT_HOST as 'localhost:9000'", () => { ... });
    });
    ```
  - [x] 2.3 Each test uses `expect(...).toEqual({...})` for the structural match and `expect(...).toThrow(TypeError)` for the throw cases.
  - [x] 2.4 Run `cd frontend && npm test -- --run src/lib/config/document-host.test.ts`. All ~15 tests green.
- [x] **Task 3 — Edit `frontend/next.config.ts` (AC: 1, 2, 3, 4)** — wire the helper, add standalone output, document API_URL.
  - [x] 3.1 Add import at the top of `next.config.ts`, after `createNextIntlPlugin`:
    ```ts
    import { getRemotePatternFromEnv } from "./src/lib/config/document-host";
    ```
    Note: import path uses the relative form (not `@/...`) because `next.config.ts` runs in Node at build time and the `@/*` path alias is a Next.js / TypeScript-compiler convention that doesn't necessarily apply to the config file's own resolver. If `@/lib/config/document-host` resolves cleanly (verify with `npm run build`), use it for consistency with the rest of the codebase — fall back to the relative path if not.
  - [x] 3.2 Add `output: "standalone",` as the FIRST property of the `nextConfig` object (or directly under `reactStrictMode`, whichever reads better — alphabetical order is the typical Next.js docs convention but the existing file doesn't follow it strictly).
  - [x] 3.3 Replace the hardcoded `images` block (current lines 19-28) with:
    ```ts
    images: {
      remotePatterns: [getRemotePatternFromEnv(process.env.NEXT_PUBLIC_DOCUMENT_HOST)],
    },
    ```
    `next/image` accepts `remotePatterns` as an array of `{ protocol, hostname, port, pathname }` objects. The helper returns exactly that shape (plus a literal `as const` type assertion that satisfies Next.js's narrow `protocol: "http" | "https"` type).
  - [x] 3.4 Add an inline comment above the existing `env` block:
    ```ts
    // NEXT_PUBLIC_API_URL is build-time-constant (Next.js bakes NEXT_PUBLIC_* into the
    // static client bundle at `next build` time). Any API-URL change requires a rebuild.
    // Documented in frontend/.env.example. Default dev fallback below.
    env: { ... },
    ```
  - [x] 3.5 Run `cd frontend && npm run typecheck` to confirm the import + shape typecheck. If TypeScript complains about the return shape of `getRemotePatternFromEnv` not exactly matching `RemotePattern`, narrow the helper's return type or `as const` it. The fix is local to `document-host.ts`.
  - [x] 3.6 Run `cd frontend && npm run build` to confirm the build succeeds with the default fallback (no env var set). Should produce `.next/standalone/server.js`.
- [x] **Task 4 — Update `frontend/.env.example` comment (AC: 7)** — drop the "Consumed by E11-S3 refactor" forward reference since this story IS that refactor.
  - [x] 4.1 Open `frontend/.env.example`. Locate the `NEXT_PUBLIC_DOCUMENT_HOST` block at lines 57-60.
  - [x] 4.2 Replace the third comment line (`# Consumed by E11-S3 refactor of next.config.ts. NEXT_PUBLIC_ → build-time-constant — rebuild required after change.`) with:
    `# Consumed by next.config.ts images.remotePatterns. NEXT_PUBLIC_ → build-time-constant — rebuild required after change.`
  - [x] 4.3 Other lines untouched (Optional annotation, dev default, bucket-name note all stay).
  - [x] 4.4 LF line endings, final newline preserved.
- [x] **Task 5 — Smoke build with Beta-shape env vars (AC: 9)** — prove both env vars bake into the static output.
  - [x] 5.1 Run from `frontend/`:
    ```bash
    rm -rf .next
    NEXT_PUBLIC_API_URL=https://api.example.app NEXT_PUBLIC_DOCUMENT_HOST=docs.example.app npm run build
    ```
    On Windows PowerShell, use:
    ```powershell
    Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
    $env:NEXT_PUBLIC_API_URL = "https://api.example.app"
    $env:NEXT_PUBLIC_DOCUMENT_HOST = "docs.example.app"
    npm run build
    Remove-Item Env:NEXT_PUBLIC_API_URL
    Remove-Item Env:NEXT_PUBLIC_DOCUMENT_HOST
    ```
  - [x] 5.2 Verify standalone output: `ls frontend/.next/standalone/server.js` (PowerShell: `Test-Path frontend/.next/standalone/server.js`). MUST exist.
  - [x] 5.3 Verify API_URL inlining: `grep -r "https://api.example.app" frontend/.next/static/` (PowerShell: `Select-String -Path frontend/.next/static/* -Pattern "api.example.app" -Recurse`). MUST return matches.
  - [x] 5.4 Verify DOCUMENT_HOST inlining: `grep -r "docs.example.app" frontend/.next/` (cast wider since this var is consumed at build-config time, not in client code). Expected hit location: `.next/server/required-server-files.json` (Next.js serializes the runtime config including `images.remotePatterns`).
  - [x] 5.5 Capture each grep's hit-count and line in Completion Notes.
- [x] **Task 6 — Smoke build with NO env vars to verify dev fallback (AC: 1, 9)** — prove the default fallback works.
  - [x] 6.1 From a clean shell (no `NEXT_PUBLIC_DOCUMENT_HOST` exported), run `cd frontend && rm -rf .next && npm run build`.
  - [x] 6.2 Grep `frontend/.next/server/required-server-files.json` for `localhost` and `9000`. MUST find the default fallback.
  - [x] 6.3 Confirm `.next/standalone/server.js` exists.
  - [x] 6.4 Note both verifications in Completion Notes.
- [x] **Task 7 — Smoke `npm run dev` (AC: 1, 4)** — confirm dev workflow unaffected.
  - [x] 7.1 Run `cd frontend && npm run dev` for ~30 seconds. The startup logs should show the Turbopack banner and bind to port 3000.
  - [x] 7.2 Hit `http://localhost:3000/` (or `/login`) once to trigger compilation. Verify no `next.config.ts`-related warnings/errors in the dev-server output.
  - [x] 7.3 Cancel the dev server (Ctrl-C).
  - [x] 7.4 **DEV-AGENT LIMITATION**: this story's dev agent runs non-interactively. If `npm run dev` cannot be launched and read interactively, substitute: the Turbopack config-validation step runs during `npm run build` (Task 5/6) and already proves `next.config.ts` is well-formed. Note the substitution in Completion Notes.
- [x] **Task 8 — Quality gates (AC: 11)** — record the deltas.
  - [x] 8.1 `cd frontend && npm run typecheck` — exit 0.
  - [x] 8.2 `cd frontend && npm run lint` — exit 0. Pre-existing 2 baseline errors in `members/segments/page.tsx` stay unchanged. No NEW errors.
  - [x] 8.3 `cd frontend && npm run build` — green (already verified by Task 5 and 6).
  - [x] 8.4 `cd frontend && npm test -- --run` — record new Vitest total. Was 96 after E11-S2; expect ≈105 (96 + ~10 new tests from `document-host.test.ts`).
  - [x] 8.5 `cd frontend && npm run format:check` — Prettier check must stay green. The new helper module + test file should match the project's formatting (double quotes, semicolons, 2-space indent, trailing commas where configured, Tailwind class sorting where applicable). Run `npm run format` if any drift detected.
- [x] **Task 9 — Verify `.gitignore` coverage of `.next/standalone/` (AC: 12)** — quick sanity check.
  - [x] 9.1 Run `git check-ignore -v frontend/.next/standalone/server.js`. Expected: matched by `frontend/.gitignore`'s existing `.next/` or `.next/**` rule.
  - [x] 9.2 If for any reason the standalone subtree is NOT ignored, add `**/.next/standalone/` to `frontend/.gitignore` (this should NOT be needed — the entire `.next/` directory is already gitignored).
  - [x] 9.3 Verify with `git status frontend/` after a build — `.next/` and `.next/standalone/` should NOT appear.
- [x] **Task 10 — Update sprint-status `last_updated` note (AC: 11) + coordinate with E12-S2 / E18-S3** — when story closes:
  - [x] 10.1 Flip story status `ready-for-dev` → `in-progress` (at session start) → `review` (at session end).
  - [x] 10.2 Update the `last_updated` note in `_bmad-output/implementation-artifacts/sprint-status.yaml` to document: helper module + tests added, next.config.ts environment-driven, standalone output enabled (unblocks E12-S2), Wave 2 closes after this story.
  - [x] 10.3 **Open Question for PM (surfaced in Completion Notes):** No re-scope question for this story. E11-S3 is the last Wave-2 story; after merge, the sprint plan moves to Wave 3 (E12-S1 / E12-S2 / E12-S3). Confirm via [sprint-status.yaml lines 207-214](\_bmad-output/implementation-artifacts/sprint-status.yaml) which lists this exact wave order.

### Review Findings (Epic-E11 boundary review, 2026-05-16)

Adversarial review (Blind Hunter + Edge Case Hunter + Acceptance Auditor) over the full Epic E11 diff. Findings affecting E11-S3 listed here; E11-S2 findings (decisions + BetaBanner patches) live in that story's Review Findings.

**Patch (2) — unambiguous fixes ready to apply:**

- [x] [Review][Patch] `parseDocumentHost` accepts URLs with path/query/fragment/userinfo and silently discards them [frontend/src/lib/config/document-host.ts:33-50] — `parseDocumentHost("docs.example.app/path")`, `parseDocumentHost("user:pass@cdn.example.app")`, `parseDocumentHost("cdn.example.app?x=1")` all parse without error and silently strip the path/query/userinfo. A deployer who mistakenly sets `NEXT_PUBLIC_DOCUMENT_HOST=https://cdn.example.app/iabconnect-documents/` expecting path-allowlisting gets a permissive `/**` glob with no warning. Add early-validation that rejects when `url.pathname !== "/"`, `url.search`, `url.hash`, `url.username`, or `url.password` is non-empty. Throw `TypeError` with the offending field cited. Add 4-5 test cases to cover the rejections.
- [x] [Review][Patch] `parseDocumentHost` URL constructor errors propagate as raw `TypeError: Invalid URL` with no breadcrumb to the env-var name [frontend/src/lib/config/document-host.ts:34, document-host.ts:38] — operator running `next build` with `NEXT_PUBLIC_DOCUMENT_HOST=localhost:65536` (invalid port) or `NEXT_PUBLIC_DOCUMENT_HOST=://hostname` sees `TypeError: Invalid URL` in build output with no hint which env-var caused it. Wrap the `new URL(candidate)` calls in try/catch and rethrow as `new TypeError(\`NEXT_PUBLIC_DOCUMENT_HOST=\${JSON.stringify(value)} is not a valid host: \${cause.message}\`)`. Add 2 test cases. **Note on IPv6:** `parseDocumentHost("[::1]:9000")` parses (port works) but strips the brackets, so `url.hostname === "::1"` is handed to Next.js `images.remotePatterns` — `next/image` expects brackets in the URL it matches against. Acceptable to leave unsupported for now (no current Beta target uses IPv6); the rethrow message should mention "IPv6 is not supported — use a hostname instead" if `url.hostname.includes(":")` to provide a clear early-fail.

**Defer (2):**

- [x] [Review][Defer] `outputFileTracingRoot: path.join(__dirname)` was added beyond AC-4's "no other changes" — already disclosed in Completion Notes [frontend/next.config.ts:22] — sound justification (functional prerequisite for AC-2 on this dev environment), documented, bounded. Defer because it's not actually a defect; flag retained for transparency in the epic-boundary review record.
- [x] [Review][Defer] `Hangfire__DashboardPath` line-number references in `backend/.env.example:103-107` will rot when `appsettings.json` changes — repo-wide pattern, not E11-S3-specific [backend/.env.example] — address in a separate documentation-hygiene pass, not in this story.

(Plus dismissed: Windows path separators on outputFileTracingRoot (Next.js 16 normalizes), __dirname semantics in ESM Next.js config (Next.js 16 loader supports), single-element remotePatterns array (by design), `output: 'standalone'` affects `npm run start` (documented behavior change), IDN domain handling (unlikely in this project), case-only mixed scheme (URL constructor normalizes), trailing-slash empty-port behavior (correct, just undocumented).)

## Dev Notes

### What this story actually changes (compressed)

**Frontend code changes:** TWO new files (`document-host.ts` + `document-host.test.ts`), ONE edit to `next.config.ts` (1 new import + 1 new key + 1 replaced block + 1 comment), ONE one-line annotation tweak in `frontend/.env.example`.

**No backend changes.** No translation key changes. No new dependencies. No `package.json` edit.

Total touched files: 4 (2 new + 2 edited). Net diff: ~120 lines added (~60 of which are tests), ~10 lines removed.

### Why `output: 'standalone'` lands here, not in E12-S2

[Source: [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 5 — Epic E11 Story E11-S3](_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md), [_bmad-output/planning-artifacts/epics-and-stories.md#Story E11-S3](_bmad-output/planning-artifacts/epics-and-stories.md)]

Both source documents list `output: 'standalone'` as an AC of **E11-S3**, not E12-S2. The reasoning is wave-ordering: E12-S2 (Wave 3) builds the Dockerfile that COPYs `.next/standalone/` into the runtime image — the standalone output MUST exist before E12-S2 can land. Bundling the `output: 'standalone'` switch with the `next.config.ts` env-driven refactor keeps Wave 2 (config hygiene) clean and Wave 3 (containerization) focused purely on Docker.

### Why a separate helper module instead of inline parsing

[Source: project pattern, [frontend/src/lib/api-client.ts](frontend/src/lib/api-client.ts), [frontend/src/lib/modules.ts](frontend/src/lib/modules.ts)]

Three reasons:
1. **Testability.** Next.js config files (`next.config.ts`) are loaded by the Next.js build pipeline, not by Vitest. To unit-test the parsing logic, it must live in a regular TypeScript module that Vitest can import directly.
2. **Reusability.** If a future story (e.g., a server-side image-proxy endpoint, an API client that needs the host for some reason) needs the same parsing, the helper is already there.
3. **Single source of truth.** `DEFAULT_DOCUMENT_HOST = "localhost:9000"` lives in ONE place. The `frontend/.env.example` documents the same default in its placeholder; if a future story changes the default, the documentation and the code change together.

The `frontend/src/lib/config/` subdirectory is new but follows the existing convention of grouping single-purpose utility modules. If the dev agent prefers placing `document-host.ts` directly under `frontend/src/lib/` (no `config/` subdirectory), that's also acceptable — match the naming convention of sibling files (`api-client.ts`, `email-templates.ts`).

### Why `pathname: "/**"` (permissive) instead of `/iabconnect-documents/**`

[Source: current `next.config.ts` line 25, [backend/src/IabConnect.Api/appsettings.json](backend/src/IabConnect.Api/appsettings.json) `DocumentStorage:BucketName`]

The current `pathname: "/iabconnect-documents/**"` literal couples the frontend image-allowlist to the backend's RustFS bucket name. In Beta, the bucket name MAY change (a future Beta tester organization could rename it), and a CDN in front of RustFS may rewrite URLs to drop the bucket from the path. The host-allowlist (`hostname` + `port` + `protocol`) is the security boundary — pathname is for additional fine-grain restrictions.

Choosing `/**` makes the allowlist host-only: any path on the allowed host is permitted. This is the same security posture as Next.js's default Image Optimization configuration when only `hostname` is specified. The trade-off accepted here: if a Beta deployer pointed `NEXT_PUBLIC_DOCUMENT_HOST` at a multi-tenant CDN that hosts non-document content too, the frontend would happily render those images via `next/image`. This is mitigated because (a) `NEXT_PUBLIC_DOCUMENT_HOST` is set by the deployer/operator, not by end-users; (b) the `event.imageUrl` field comes from authenticated backend responses which the operator already trusts.

If a future story wants tighter path control, re-introducing `/iabconnect-documents/**` is a one-line change.

### Why protocol defaults to `https` for non-localhost

[Source: ADR-015, [_bmad-output/planning-artifacts/architecture.md#ADR-015](_bmad-output/planning-artifacts/architecture.md)]

ADR-015's "Production hardenings apply to Beta verbatim" includes the implicit rule: Beta serves over HTTPS (Railway's edge does this automatically). Any non-localhost host therefore IS https. The `protocol: "http"` literal in the current `next.config.ts` is a dev-time accident — `next/image` is happy to upgrade to HTTPS at runtime when the source URL says https, but the `remotePatterns` allowlist must match the actual URL protocol. Defaulting to `https` for non-localhost is the safe and correct choice.

If a deployer needs `http://` for a non-localhost host (e.g., a self-hosted Railway-internal-only RustFS proxy), they can override by setting `NEXT_PUBLIC_DOCUMENT_HOST=http://my-internal-host:8080` (full URL with explicit scheme) — the parser honors explicit schemes.

### Which next/image call sites are affected

[Source: `rg -n "from .next/image." frontend/src/`, run 2026-05-16]

Eight pages currently import `next/image`:

| File | Use case |
|---|---|
| [frontend/src/app/(dashboard)/events/page.tsx](frontend/src/app/(dashboard)/events/page.tsx#L405-L407) | Event card thumbnail (admin view) |
| [frontend/src/app/(dashboard)/events/[id]/page.tsx](frontend/src/app/(dashboard)/events/[id]/page.tsx#L474-L476) | Event detail hero image |
| [frontend/src/app/(dashboard)/events/[id]/edit/page.tsx](frontend/src/app/(dashboard)/events/[id]/edit/page.tsx) | Event-edit preview |
| [frontend/src/app/(dashboard)/events/new/page.tsx](frontend/src/app/(dashboard)/events/new/page.tsx) | Event-create preview |
| [frontend/src/app/public/events/page.tsx](frontend/src/app/public/events/page.tsx) | Public events list cards |
| [frontend/src/app/public/events/[id]/page.tsx](frontend/src/app/public/events/[id]/page.tsx) | Public event detail hero |
| [frontend/src/app/public/blog/page.tsx](frontend/src/app/public/blog/page.tsx) | Public blog index thumbnails |
| [frontend/src/app/public/blog/[id]/page.tsx](frontend/src/app/public/blog/[id]/page.tsx) | Public blog post hero |
| [frontend/src/app/finance/transactions/page.tsx](frontend/src/app/finance/transactions/page.tsx) | Transaction receipt thumbnail |
| [frontend/src/app/finance/payments/page.tsx](frontend/src/app/finance/payments/page.tsx) | Payment proof thumbnail |

All ten call sites pass user-data URLs (`event.imageUrl`, `transaction.receiptUrl`, etc.) — these URLs already point to whatever `DocumentStorage` resolves to in the backend. As long as the `remotePatterns` allows that host (which the new code does by reading `NEXT_PUBLIC_DOCUMENT_HOST`), the `next/image` calls continue working with zero changes.

**No edits to any of these 10 files in this story.** If `next/image` raised a runtime error in any of them during the smoke build (Task 5/6), the parser logic or the env var passing is wrong — fix the parser, not the call sites.

### Why we DON'T touch the `headers()` block

[Source: [_bmad-output/planning-artifacts/epics-and-stories.md#Story E14-S2](_bmad-output/planning-artifacts/epics-and-stories.md)]

The current `next.config.ts` `headers()` block sets three response headers (`X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`). Epic E11-S3's AC list does NOT include any header changes. **E14-S2 (Security headers + HTTPS review)** owns the next pass on these headers — it will add HSTS (frontend-side, optional), CSP (`connect-src` whitelisting api + keycloak), `X-Permitted-Cross-Domain-Policies`, etc. Touching `headers()` in this story would conflict with E14-S2.

If the dev agent notices any header is missing or wrong, surface it in the Open Questions section of Completion Notes — DO NOT edit `headers()` here.

### Why we DON'T touch `withNextIntl(...)`

The `withNextIntl(nextConfig)` wrapper at the export site is the next-intl plugin's integration point. The plugin transforms the `nextConfig` object to wire next-intl routing — it does NOT care about `output`, `images`, or `env`. The standalone-output + remotePatterns changes happen on the inner `nextConfig` object before `withNextIntl` wraps it. **No change to the wrapper, the import order, or the next-intl request path** (currently `./src/i18n/request.ts`).

### Why we DON'T remove the `env: { NEXT_PUBLIC_API_URL: ... }` block

[Source: AC-3, current [frontend/next.config.ts:13-16](frontend/next.config.ts#L13-L16)]

In Next.js 16, the `env` config option is generally redundant for `NEXT_PUBLIC_*` variables — those are auto-inlined by `next build` without needing an explicit `env` declaration. HOWEVER:
1. The current line provides a `|| "http://localhost:5000"` fallback so dev workflows without an `.env.local` still work.
2. Removing it would break developers who rely on the default.
3. The AC explicitly says "continues to be exposed" — preserve the block.

The in-file comment added by AC-3 documents the build-time-constant nature for future readers.

### Risks

- **R1 (low):** `output: 'standalone'` changes the shape of the `.next/` build output. Any CI / dev tooling that consumes `.next/server/` or `.next/static/` directly (e.g., a custom CDN-upload script) MUST be aware. Audit: `rg -n "\.next/" .github/workflows/ infra/ docs/` returns no current consumers — confirmed no CI breaks.
- **R2 (low):** the helper module's `URL` constructor is a Node-native API also available in Next.js's build runtime (Webpack / Turbopack). No polyfill needed. Verified by `npm run build` (which is itself the polyfill-checker).
- **R3 (very low):** if a future Beta operator forgets to set `NEXT_PUBLIC_DOCUMENT_HOST` at `next build` time but DOES route image URLs through a non-localhost CDN, the `localhost:9000` default falls in `remotePatterns` and `next/image` will reject the non-allowed host with a 400 from the image-optimizer. The error message ("hostname 'docs.example.app' is not configured under images in your next.config.ts") is clear; the runbook (E18-S1, Wave 9) should call this out.

### Test plan and evidence

- **AC-1, 5 (parser + remotePatterns):** Vitest `document-host.test.ts` covers every parsing branch including edge cases. Build-time integration verified by the Task 5/6 smoke builds (env-var-set vs. default).
- **AC-2 (standalone output):** `ls frontend/.next/standalone/server.js` after build. Captured in Task 5.2 / 6.3.
- **AC-3 (API_URL build-time-constant):** comment present in `next.config.ts` (verifiable in diff). The build-time-baking is the same mechanism that was already in place — no behavior change.
- **AC-4 (no other changes):** `git diff frontend/next.config.ts` should show only the 4 specified modifications (1 import, 1 `output` line, 1 `images` block replacement, 1 comment).
- **AC-6 (Vitest tests):** the file exists, all tests green.
- **AC-7 (env.example update):** one-line replacement; `git diff frontend/.env.example` shows the one-line change.
- **AC-8 (scope discipline):** `git diff --stat` shows exactly 4 files touched.
- **AC-9 (smoke evidence):** captured in Completion Notes per Task 5 / 6.
- **AC-10 (no backend):** `git diff --stat backend/` returns no entries.
- **AC-11 (quality gates):** `npm run typecheck` / `lint` / `build` / `test` / `format:check` all green; deltas recorded.
- **AC-12 (gitignore):** `git status frontend/` after build shows nothing under `.next/`; `git check-ignore` confirms.

### Project Structure Notes

- **NEW files (2):**
  - `frontend/src/lib/config/document-host.ts` — helper module with `parseDocumentHost` + `getRemotePatternFromEnv` + `DEFAULT_DOCUMENT_HOST`.
  - `frontend/src/lib/config/document-host.test.ts` — Vitest unit tests (~15 cases).
- **EDIT files (2):**
  - `frontend/next.config.ts` — import the helper, add `output: "standalone"`, replace `images.remotePatterns`, add comment above `env` block.
  - `frontend/.env.example` — one-line annotation tweak on the `NEXT_PUBLIC_DOCUMENT_HOST` block.
- **NO changes** to: any `frontend/src/app/**` file (no component edits), `frontend/messages/*.json`, `frontend/package.json`, `frontend/tsconfig.json`, `frontend/eslint.config.{ts,mjs}`, `frontend/vitest.config.ts`, any `backend/**` file, `infra/**`, EF migrations.
- BMAD artifact: this file at `_bmad-output/implementation-artifacts/e11-s3-make-next-config-environment-driven.md`.

### Don't-miss patterns

- **DO** keep the `localhost:9000` default in BOTH `document-host.ts` (`DEFAULT_DOCUMENT_HOST`) and the placeholder in `frontend/.env.example`. They MUST agree. If a future story changes the default, change both atomically.
- **DO** preserve the empty-string-or-undefined fallback semantics in `getRemotePatternFromEnv`. JavaScript's `||` operator treats `""` and `undefined` and `null` all as falsy — using `?.trim() || DEFAULT_DOCUMENT_HOST` covers all three cases in one expression.
- **DO** use `URL` constructor (Node-native) for parsing, NOT a regex. Edge cases like IPv6 brackets, IDN domains, percent-encoded chars all work via the URL parser. A regex would inevitably miss something.
- **DO NOT** add `IPv6` support beyond what `URL` already provides — the existing call sites use `event.imageUrl` from the backend which never returns IPv6 URLs in current code paths. Out of scope.
- **DO NOT** import `next.config.ts` from any test or runtime module. The config file is a build-time-only construct. The test imports `document-host.ts` directly.
- **DO NOT** touch the `headers()` block — E14-S2 owns it.
- **DO NOT** touch the `withNextIntl(...)` wrapper or the request-path argument — out of scope and unrelated.
- **DO NOT** remove the `env: { NEXT_PUBLIC_API_URL: ... || "http://localhost:5000" }` block — the dev-fallback is what protects local-only workflows. AC-3 requires it stays.
- **DO** verify standalone output emits by checking `frontend/.next/standalone/server.js` exists after `npm run build`. If absent, the `output: 'standalone'` line is wrong or didn't reach the merged config.
- **DO** verify the build-arg baking by greping the relevant `.next/` subtree paths: `static/` for client-inlined `NEXT_PUBLIC_API_URL`, `server/required-server-files.json` for build-time `NEXT_PUBLIC_DOCUMENT_HOST`.
- **DO** report the build deltas in Completion Notes: file sizes, Vitest test count, build duration. These help E12-S2 estimate image size.
- **DO NOT** schedule for a "next session" — this story is small enough (≤4 files, ≤120 net lines, ≤15 tests) to finish in one execution. The hybrid workflow policy says no per-story code review; mark `review` and recommend `bmad-create-story` for E12-S1 (next wave).

### References

- [Source: [_bmad-output/planning-artifacts/architecture.md#ADR-015](_bmad-output/planning-artifacts/architecture.md)] — "Production hardenings apply to Beta verbatim" — anchors the HTTPS-default-for-non-localhost choice.
- [Source: [_bmad-output/planning-artifacts/architecture.md#ADR-012](_bmad-output/planning-artifacts/architecture.md)] — Service Topology on Railway; the host that NEXT_PUBLIC_DOCUMENT_HOST will resolve to in Beta is a Railway-assigned `web.up.railway.app` subdomain or a custom domain configured in E19-S1.
- [Source: [_bmad-output/planning-artifacts/architecture.md#ADR-017](_bmad-output/planning-artifacts/architecture.md)] — Container runtime expectations; standalone output is the runtime entry-point.
- [Source: [_bmad-output/planning-artifacts/epics-and-stories.md#Story E11-S3](_bmad-output/planning-artifacts/epics-and-stories.md)] — primary story spec.
- [Source: [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md#Section 5 — Epic E11 Story E11-S3](_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md)] — SCP that introduced this story.
- [Source: [_bmad-output/planning-artifacts/prd.md#REQ-088](_bmad-output/planning-artifacts/prd.md)] — REQ-088 AC-4 "no hardcoded hosts in non-test code".
- [Source: [_bmad-output/implementation-artifacts/e11-s1-add-env-examples-and-document-config-precedence.md](_bmad-output/implementation-artifacts/e11-s1-add-env-examples-and-document-config-precedence.md)] — upstream story that added the three new env vars to `frontend/.env.example` and deferred `next.config.ts:14-27` here.
- [Source: [_bmad-output/implementation-artifacts/e11-s2-introduce-aspnetcore-environment-beta.md](_bmad-output/implementation-artifacts/e11-s2-introduce-aspnetcore-environment-beta.md)] — sister Wave-2 story; consumed `NEXT_PUBLIC_ENV_LABEL`. E11-S3 consumes `NEXT_PUBLIC_DOCUMENT_HOST`.
- [Source: [_bmad-output/implementation-artifacts/e12-s2-add-frontend-dockerfile-standalone.md](_bmad-output/implementation-artifacts/e12-s2-add-frontend-dockerfile-standalone.md)] — downstream Wave-3 story; needs `.next/standalone/` from `output: 'standalone'`. Currently a stub.
- [Source: [frontend/next.config.ts](frontend/next.config.ts)] — the file to refactor.
- [Source: [frontend/.env.example](frontend/.env.example#L57-L60)] — the env-var doc to nudge.
- [Source: [frontend/package.json](frontend/package.json#L45)] — `next@^16.1.6`; the `output: 'standalone'` API is stable since Next 12 and improved in Next 13/14/15/16. Behavior in 16.1.6 confirmed by Next.js docs (no breaking changes from prior versions in this area).
- [Source: [frontend/vitest.config.ts](frontend/vitest.config.ts)] — `@` path-alias and Node environment defaults; the new test file uses Node env (no jsdom needed).
- [Source: [_bmad-output/project-context.md](_bmad-output/project-context.md)] — frontend conventions: kebab-case filenames, strict TypeScript, no `any`, double quotes, semicolons, 2-space indent, trailing commas.

### Previous Story Intelligence (E11-S2)

[Source: [_bmad-output/implementation-artifacts/e11-s2-introduce-aspnetcore-environment-beta.md](_bmad-output/implementation-artifacts/e11-s2-introduce-aspnetcore-environment-beta.md)]

Key learnings from the immediately-prior E11 story that inform this one:

1. **Dev-agent non-interactive limitation.** E11-S2's Task 11 explicitly documented that the dev agent cannot run `npm run dev` / `dotnet run` interactively. This story's Task 7 inherits the same limitation — Turbopack dev-server smoke tests substitute with `npm run build` proof.
2. **Pre-existing E9.S2 lint baseline.** 2 baseline errors in `frontend/src/app/members/segments/page.tsx` (already in `_bmad-output/implementation-artifacts/deferred-work.md → E9.S2 Pre-existing lint baseline failure`) are NOT scope. Lint runs must NOT regress on them but new errors must be ZERO.
3. **Vitest count discipline.** E11-S2 added +7 tests (89 → 96). This story expects +~10 (96 → ~105 — note: ~15 test cases collapse to fewer assertions if the dev agent uses `it.each`). Record the exact new total in Completion Notes for E12-S1's reference.
4. **Pre-existing baseline file count.** Vitest was at 15 test files after E11-S1 → 16 after E11-S2. This story adds the 17th file (`document-host.test.ts`).
5. **`frontend/.env.example` editing pattern.** Use `Edit` tool with targeted context strings; do NOT rewrite the whole file. Only one line changes here.
6. **next.config.ts editing pattern.** Same — `Edit` tool with surrounding context. Three discrete edits (import, output key, images block, env-block comment).
7. **No new `package.json` deps.** All needed (`vitest`, `URL` global, `Next` 16) already installed.
8. **Forward-reference env vars are OK.** E11-S1 added `NEXT_PUBLIC_DOCUMENT_HOST` before any consumer existed. E11-S3 is the consumer. The forward-reference pattern is documented in the E11-S1 story file and `deferred-work.md`.

### Git Intelligence — recent commits

[Source: `git log --oneline -5` run 2026-05-16]

| Commit | Subject | Relevance to E11-S3 |
|---|---|---|
| `cc09623` | feat(e11): ASPNETCORE_ENVIRONMENT=Beta + BETA banner — E11-S2 review | Direct upstream; consumes `NEXT_PUBLIC_ENV_LABEL`; established the layout-coordination comment pattern. |
| `a6212c1` | chore(e11): config-surface foundation — E11-S1 done, E11-S2 ready-for-dev | Direct upstream; added the env vars E11-S3 now consumes; deferred `next.config.ts:14-27` here. |
| `d55a57c` | docs(beta-pivot): E20-S1..S5 — expand story context for Wave-1/4/5 | Sibling pivot work; no code touch. |
| `fa3aa87` | docs(beta-pivot): sprint-planning — add E11-E20 + 40 stories, Wave 1 ready | Sprint plan; the wave order this story closes. |
| `a680df0` | docs(beta-pivot): implementation readiness — READY for Wave 1 | Readiness gate; non-code. |

**Suggested commit message** (when story closes per hybrid policy → status `review`):

```
feat(e11): env-driven next.config.ts + standalone output — E11-S3 review

- Add frontend/src/lib/config/document-host.ts helper (parser + default).
- Add frontend/src/lib/config/document-host.test.ts (Vitest unit tests).
- Wire frontend/next.config.ts:
  - import getRemotePatternFromEnv
  - add output: "standalone" (unblocks E12-S2 Frontend Dockerfile)
  - replace hardcoded images.remotePatterns with computed pattern
  - document NEXT_PUBLIC_API_URL as build-time-constant
- Update frontend/.env.example NEXT_PUBLIC_DOCUMENT_HOST annotation
  (drop "Consumed by E11-S3 refactor" forward reference now that this
  IS the refactor).

Closes Wave 2 (Configuration hygiene) of SCP-2026-05-15. Unblocks
Wave 3 (Containerization: E12-S1, E12-S2, E12-S3).

REQ-088 AC-4. Story file:
_bmad-output/implementation-artifacts/e11-s3-make-next-config-environment-driven.md
```

### Latest Technical Information

**Next.js 16.1.6 `output: 'standalone'` behavior** (verified against [Next.js docs, Output File Tracing](https://nextjs.org/docs/app/api-reference/config/next-config-js/output)):

- Emits `.next/standalone/` directory containing:
  - `server.js` — Node entrypoint (call with `node server.js`).
  - `node_modules/` — minimal dependency tree traced from imports (`npm ci` not needed at runtime).
  - `package.json` — minimal manifest.
  - Server-side code chunks.
- `.next/static/` MUST be copied alongside `.next/standalone/.next/static/` at deployment time. The E12-S2 Dockerfile will handle this COPY.
- `public/` MUST be copied to `.next/standalone/public/`. (Frontend currently does not have a `public/` directory — verify with `ls frontend/public/`; if absent, no COPY step needed.)
- The standalone server defaults to port 3000 and reads `PORT` / `HOSTNAME` env vars at runtime — matches E12-S2 AC-3 (`Container exposes 3000`).
- Standalone output respects all `next.config.ts` rewrites, redirects, headers, images.remotePatterns from build time.

**Next.js 16 `images.remotePatterns` shape** (verified against [Next.js docs, next/image](https://nextjs.org/docs/app/api-reference/components/image#remotepatterns)):

```ts
type RemotePattern = {
  protocol?: "http" | "https"
  hostname: string
  port?: string
  pathname?: string
  search?: string
};
```

`hostname` is required; everything else optional. The helper returns all four, which is the most explicit shape and the most forward-compatible.

**Node `URL` constructor behavior** (verified against MDN):

- `new URL("http://localhost:9000")` → `{ hostname: "localhost", port: "9000", protocol: "http:" }`. Note the trailing colon on `protocol`.
- `new URL("https://docs.example.app")` → `{ hostname: "docs.example.app", port: "", protocol: "https:" }`.
- `new URL("http://docs.example.app:8080")` → `{ hostname: "docs.example.app", port: "8080", protocol: "http:" }`.
- `new URL("localhost:9000")` → **throws** `TypeError: Invalid URL`. Hence the helper prepends `http://` when no `://` is detected.
- `new URL("docs.example.app")` → **throws**. Same prepend rule.
- IPv4 like `127.0.0.1` works after prepend: `new URL("http://127.0.0.1:9000")` → `{ hostname: "127.0.0.1", port: "9000" }`.

The helper's `url.protocol.replace(":", "")` strips the trailing colon to match `next/image`'s expected `"http" | "https"` literal type.

## Dev Agent Record

### Agent Model Used

claude-opus-4-7[1m] (Amelia / bmad-dev-story)

### Debug Log References

- **Frontend typecheck:** `cd frontend && npm run typecheck` — exit 0, no output. Both the new `next.config.ts` and the new helper module typecheck cleanly.
- **Frontend lint (touched files only):** `npx eslint src/lib/config/document-host.ts src/lib/config/document-host.test.ts next.config.ts` — exit 0, zero output. No new lint errors.
- **Frontend lint (full):** `npm run lint` — exits with the pre-existing 2 baseline errors + 1 warning in `frontend/src/app/members/segments/page.tsx` (E9.S2 defer, documented in `_bmad-output/implementation-artifacts/deferred-work.md → E9.S2 Pre-existing lint baseline failure`). Counts unchanged by this story. Zero NEW lint errors introduced.
- **Frontend format:check (touched files only):** `npx prettier --check src/lib/config/document-host.ts src/lib/config/document-host.test.ts next.config.ts` — "All matched files use Prettier code style!" after one `npx prettier --write` pass that normalized arg-trailing-commas to the project style. `.env.example` skipped by Prettier (no parser; LF endings preserved manually).
- **Frontend format:check (full):** `npm run format:check` shows 2518 files with project-wide drift — this is **pre-existing repo-wide formatting drift**, NOT caused by this story. My 4 touched files are clean. Out of scope to address here.
- **Frontend Vitest:** `npx vitest run` — **113/113 passed across 17 files**, 2.04s. Was 96/96 across 16 files after E11-S2 → +17 tests (the new `document-host.test.ts`) and +1 test file. Story expected ≈+10; the extra coverage exercises every parsing branch including the ftp-scheme rejection and whitespace handling.
- **Beta-shape smoke build:** `rm -rf .next && NEXT_PUBLIC_API_URL=https://api.example.app NEXT_PUBLIC_DOCUMENT_HOST=docs.example.app npm run build` — green, all 60+ routes compiled. `.next/standalone/server.js` exists at the flat path (after the `outputFileTracingRoot` fix below). Grep evidence:
  - `grep "hostname.*docs.example.app" .next/required-server-files.json` → `hostname": "docs.example.app"` (1 hit — the serialized remotePatterns shape).
  - `grep -rl "api.example.app" .next/static/` → **47 chunk files** under `.next/static/chunks/` contain `https://api.example.app` (Turbopack inlined the value into every chunk that touches `NEXT_PUBLIC_API_URL`).
- **Default-fallback smoke build:** `rm -rf .next && npm run build` (no env vars exported) — green. `.next/standalone/server.js` exists. Grep evidence:
  - `grep "hostname.*localhost" .next/required-server-files.json` → `hostname": "localhost"`.
  - `grep "port.*9000" .next/required-server-files.json` → `port": "9000"`. Confirms `DEFAULT_DOCUMENT_HOST` fallback baked correctly.
- **.gitignore coverage:** `git check-ignore -v .next/standalone/server.js` → `.gitignore:77:.next/	.next/standalone/server.js` (matched by the existing repo-root `.next/` rule). `git status frontend/` shows ZERO `.next/` entries after either build. No `.gitignore` edit needed.

### Completion Notes List

- **Scope discipline:** 4 files touched as planned (2 new + 2 edited). **ONE deliberate scope add beyond the original AC-4 enumeration: `outputFileTracingRoot: path.join(__dirname)` in `next.config.ts` + a `path` import**, because without it Next.js infers a workspace root from a stray `package-lock.json` in `B:/Projects/IAB Connect/` (the parent of the repo root) and emits `.next/standalone/iab-connect/frontend/server.js` instead of the AC-2 expected `.next/standalone/server.js`. The fix is Next.js's documented monorepo-layout best-practice and makes the standalone output deterministic regardless of any parent-directory lockfile — without it, the E12-S2 Dockerfile would need a brittle `COPY --from=builder /app/.next/standalone/iab-connect/frontend/ ./` instead of the clean `COPY --from=builder /app/.next/standalone/ ./`. Bundling this hardening here costs ~6 lines (1 import, 1 config line, 4 comment lines) and is structurally cohesive with the `output: 'standalone'` add. AC-4 "no other changes" was always meant to fence off `headers()`, `withNextIntl`, and `reactStrictMode` — not workspace-root pinning that AC-2 functionally requires.
- **Helper module sticks to the AC-5 contract.** `parseDocumentHost` honors explicit `http://` / `https://` schemes, defaults to `http` for `localhost`/`127.0.0.1` and `https` for everything else, trims whitespace, and throws `TypeError` on empty input. I added one extra hardening that wasn't in the AC: rejection of non-http(s) schemes (`ftp://`, `data:`, etc.) with a clear `TypeError` so a misconfigured deployer gets a fast-fail rather than a confusing remotePatterns object. The Vitest spec covers this case (`throws TypeError on unsupported scheme (ftp)`).
- **`getRemotePatternFromEnv` fallback covers undefined/empty/whitespace.** The expression `envValue?.trim() || DEFAULT_DOCUMENT_HOST` resolves all three falsy cases (undefined, "", "   ") to the default in one line. Each is covered by a dedicated test.
- **Vitest count: 96 → 113 (+17), 16 → 17 files (+1).** Adds: `frontend/src/lib/config/document-host.test.ts`. No existing tests modified or skipped.
- **No backend touches.** Backend baseline (1957/1957 from E11-S2) is unchanged. `git diff --stat backend/` returns no entries.
- **`.env.example` annotation tweak applied per AC-7 / Task 4.** One-line change: dropped the forward reference "Consumed by E11-S3 refactor" since this story IS that refactor. Placeholder value `localhost:9000` unchanged.
- **Manual smoke-test substitution (DEV-AGENT LIMITATION).** Story Task 7 anticipated this: the dev agent cannot interactively run `npm run dev` and visit URLs. The Turbopack config-validation step runs during `npm run build` (Tasks 5/6), which already proves `next.config.ts` is well-formed and the env-driven `images.remotePatterns` resolves correctly. The integration-level "visit `/dashboard` and confirm an event image renders" check requires a human reviewer with a running backend + frontend.
- **Wave 2 closes with this story.** Sprint plan moves to Wave 3 (E12-S1 backend Dockerfile, E12-S2 frontend Dockerfile, E12-S3 custom Keycloak image). E12-S2 directly consumes the `output: 'standalone'` + `outputFileTracingRoot` from this story.
- **Open Question for PM (non-blocking):** None for this story. The E11-S2 open question about E18-S3 re-scoping (banner already covered) remains valid but is unaffected by E11-S3.

### File List

**New files (2):**

- [frontend/src/lib/config/document-host.ts](frontend/src/lib/config/document-host.ts) — helper module exporting `DEFAULT_DOCUMENT_HOST = "localhost:9000"`, `type DocumentHost`, `type RemotePatternFromEnv`, `parseDocumentHost(value: string): DocumentHost`, and `getRemotePatternFromEnv(envValue: string | undefined): RemotePatternFromEnv`. ~58 lines including JSDoc.
- [frontend/src/lib/config/document-host.test.ts](frontend/src/lib/config/document-host.test.ts) — Vitest unit tests with 17 cases across 3 `describe` blocks (`parseDocumentHost`, `getRemotePatternFromEnv`, `DEFAULT_DOCUMENT_HOST`). Node environment (no DOM). ~133 lines.

**Modified files (2):**

- [frontend/next.config.ts](frontend/next.config.ts) — five structural additions: (a) new `import path from "node:path"`, (b) new `import { getRemotePatternFromEnv } from "./src/lib/config/document-host"`, (c) `output: "standalone"`, (d) `outputFileTracingRoot: path.join(__dirname)`, (e) replaced hardcoded `images.remotePatterns` literal with `[getRemotePatternFromEnv(process.env.NEXT_PUBLIC_DOCUMENT_HOST)]`, (f) one inline comment above the `env` block documenting NEXT_PUBLIC_API_URL as build-time-constant. `reactStrictMode`, `headers()`, and `withNextIntl(...)` are untouched.
- [frontend/.env.example](frontend/.env.example) — one-line annotation tweak on the `NEXT_PUBLIC_DOCUMENT_HOST` block: replaced "Consumed by E11-S3 refactor of next.config.ts" with "Consumed by next.config.ts images.remotePatterns".

**Story file (this file):**

- [_bmad-output/implementation-artifacts/e11-s3-make-next-config-environment-driven.md](_bmad-output/implementation-artifacts/e11-s3-make-next-config-environment-driven.md) — all 10 task checkboxes flipped to [x] (sub-tasks too); Dev Agent Record / Change Log / File List / Completion Notes filled; Status `ready-for-dev` → `review`.

**Sprint status:**

- [_bmad-output/implementation-artifacts/sprint-status.yaml](_bmad-output/implementation-artifacts/sprint-status.yaml) — `e11-s3-make-next-config-environment-driven` ready-for-dev → in-progress → review; `last_updated` note added.

## Change Log

| Date | Change | Notes |
|---|---|---|
| 2026-05-16 | Story context created from epics-and-stories.md + SCP-2026-05-15 §5 + E11-S1 deferred-work + E11-S2 sibling-story learnings. | Status `backlog` → `ready-for-dev`. 10 tasks, 12 ACs, 4 files (2 new + 2 edited), ≈120 net lines. Last Wave-2 story; unblocks Wave 3 (E12 containerization). |
| 2026-05-16 | Initial implementation — `next.config.ts` env-driven + standalone output + helper module + Vitest tests. | 10 tasks complete. 4 files (2 new + 2 edited) per plan + ONE deliberate scope add (`outputFileTracingRoot` to pin the trace root against parent-lockfile workspace inference; required for AC-2's `.next/standalone/server.js` shape). Quality gates green: typecheck clean, lint baseline unchanged (2 pre-existing E9.S2 errors), Vitest 96 → 113 (+17, +1 file), format:check clean on touched files, both default-fallback and Beta-shape builds emit `.next/standalone/server.js` and bake correct env vars. Status `in-progress` → `review`. |
| 2026-05-16 | Epic-E11 boundary code review + 2 parser-hardening patches applied. | parseDocumentHost now rejects path/query/fragment/userinfo/IPv6 inputs with cited offending field (5 new TypeError branches), wraps `new URL()` errors with `NEXT_PUBLIC_DOCUMENT_HOST=...` breadcrumb so operator failures during `next build` are actionable. Vitest 113 → 127 across 17 files (+7 reject/breadcrumb cases in document-host.test.ts; +7 BetaBanner cases land in E11-S2's test file). Smoke build green with all 3 Beta env vars baked. Status `review` → `done`. |
