# Story E19-S1: Custom-domain runbook entry

Status: ready-for-dev

## Story

As **a maintainer planning a future Production-Go-Live**, I want **a complete RUNBOOK section that documents migrating the three public Beta services from their Railway-default `*.up.railway.app` domains to custom domains — DNS, the Keycloak hostname change, every redirect-URI / web-origin update, `Frontend__BaseUrl`, and the build-time `NEXT_PUBLIC_API_URL` rebuild — with each step reversible**, so that **the Production custom-domain cutover is rehearsed on paper in advance and an operator can execute it (or roll it back) without reverse-engineering the issuer-parity wiring under pressure**.

**Requirement:** REQ-088 AC-10. Epic E19, Story 1. Sources:

- [_bmad-output/planning-artifacts/epics-and-stories.md §Epic E19 Story E19-S1 (lines 1872–1888)](../planning-artifacts/epics-and-stories.md)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §5 Epic E19 — Story E19-S1 (lines 656–660)](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-012 Service Topology on Railway (lines 272–303)](../planning-artifacts/architecture.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-015 Configuration and Environment Strategy (lines 329–341)](../planning-artifacts/architecture.md)
- [RUNBOOK-beta.md §8 Custom-domain migration (the placeholder this story fills)](./RUNBOOK-beta.md)
- [docs/14_beta_railway_setup.md §4.1 Capture hostnames / §5 Railway variables per service / §6 Build-time vs runtime / §6.3 Issuer parity invariant / §8.1 Public services](../../docs/14_beta_railway_setup.md)

## Refresh Notes (2026-06-05, bmad-create-story bulk refresh for entire Epic-19)

This story was authored from the 19-line 2026-05-15 stub against post-Epic-18 reality. Findings (A56 existing-implementation spike):

- **`RUNBOOK-beta.md` already exists and already carries a pre-laid `## 8. Custom-domain migration` placeholder section** ([RUNBOOK-beta.md:280–284](./RUNBOOK-beta.md)), marked "Placeholder — authored by E19-S1". E18-S1 laid this anchor per the A38 doc-bundle write-once rule. **This story FILLS §8 in place** — it does NOT create a new file and does NOT renumber. The TOC entry ([RUNBOOK-beta.md:28](./RUNBOOK-beta.md)) and the Quick-reference table ([RUNBOOK-beta.md:262–277](./RUNBOOK-beta.md)) are updated to point at the now-authored section.
- **The hard part is not DNS — it is the five-anchor `Keycloak__Authority` / issuer parity invariant.** A custom-domain swap changes the public URL of `web`, `api`, and `keycloak`, and the issuer parity invariant ([docs/14 §6.3](../../docs/14_beta_railway_setup.md), restated in [RUNBOOK §6.2](./RUNBOOK-beta.md)) requires **five** anchors to describe the same Keycloak public URL simultaneously: `api.Keycloak__Authority`, `web.KEYCLOAK_ISSUER`, `keycloak.KC_HOSTNAME` (bare host, no scheme), `api.KeycloakAdmin__BaseUrl`, and the GHA `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` build var. A custom-domain cutover that updates four of five is the most likely failure mode — the section MUST present the five anchors as a single atomic change set.
- **`NEXT_PUBLIC_API_URL` is build-time-constant** ([ADR-015](../planning-artifacts/architecture.md); [RUNBOOK §1 note](./RUNBOOK-beta.md); [SCP line 798 / architecture.md:989](../planning-artifacts/architecture.md)). It is baked into the `web` image at build time, NOT read at runtime. Therefore an `api` custom-domain swap is **not** a Railway-variable edit + redeploy — it requires a **frontend image rebuild** (push to `beta` with the new `NEXT_PUBLIC_API_URL_BETA` GHA repo variable, or a manual rebuild) before the `web` service will call the new API URL. Same for `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA`. The section MUST flag every `NEXT_PUBLIC_*` value as rebuild-required so the operator does not expect a variable edit to take effect.
- **Railway custom-domain mechanics (the dashboard "Custom Domain" flow + the CNAME target Railway issues) are NOT exercised in-session** → the DNS/CNAME steps and any `dig`/`nslookup`/`railway domain` commands get `[!] verify before executing` markers (A40). docs/14 §4.1 covers *capturing Railway-assigned* hostnames but does not cover *adding a custom domain* — that part is genuinely net-new operator guidance, so it is written conservatively and marked for live verification.
- **Reversibility is an explicit AC** (the epics test/evidence line: "each step is reversible and the DNS/IDP coordination is explicit"). Every change in the cutover gets a paired rollback note (revert the Railway variable / re-point DNS / rebuild with the old `NEXT_PUBLIC_*` / restore the realm client redirect URIs).
- **A42 reread-as-a-stranger** is mandatory at story close (documentation deliverable). **A45/A57** binary-reachability: any `dig`/`railway`/`kcadm.sh` command is operator-workstation-side or `[!]`-marked — none assume a binary present in the `api`/`web`/`keycloak` runtime images.
- **Zero production code, zero config change.** Pure documentation — the section describes a *future* cutover; it does not perform one.

## Acceptance Criteria

1. **AC-1 (section authored in place).** [RUNBOOK-beta.md](./RUNBOOK-beta.md) `## 8. Custom-domain migration` is filled (the placeholder blockquote replaced with real content). The TOC entry (line 28) drops the "*(placeholder — authored by E19-S1)*" suffix, and the Quick-reference table (§7) gains a "Custom-domain cutover → §8" row. No section is renumbered; §9 (E19-S3) placeholder is left untouched.
2. **AC-2 (DNS step).** §8 documents adding a custom domain to each of the **three public services** (`web`, `api`, `keycloak`) via the Railway dashboard Custom-Domain flow → the operator creates a `CNAME` (or `ALIAS`/`ANAME` at the apex) at their DNS provider pointing at the Railway-issued target, and waits for Railway to show the domain as "Active" (cert issued). DNS-provider commands and any verification (`dig +short <domain> CNAME`) carry `[!] verify before executing` (A40). The DNS step is presented as reversible (delete the custom domain in Railway + remove the DNS record reverts to the `*.up.railway.app` default, which keeps working throughout).
3. **AC-3 (Keycloak hostname change).** §8 documents updating `keycloak.KC_HOSTNAME` to the bare custom Keycloak hostname (no scheme) and redeploying `keycloak` so the realm import re-applies. States that `KC_HOSTNAME` is the canonical issuer host and is one of the five parity anchors. Cross-links [docs/14 §5.3](../../docs/14_beta_railway_setup.md).
4. **AC-4 (redirect-URI / web-origin update).** §8 documents updating the realm client's allowed redirect URIs + web origins for the new `web` custom domain — the root cause is the `keycloak.IABCONNECT_BETA_HOST` Railway variable (`https://<new-web-domain>`, **with** scheme), which resolves `${IABCONNECT_BETA_HOST}` in the realm import into the `iabconnect-frontend` client's `redirectUris[0]` / `webOrigins[0]`. States that if the realm was already imported, the operator must also repair the client's Valid Redirect URIs in the Admin Console. Consistent with [RUNBOOK §6.3](./RUNBOOK-beta.md) + [docs/14 §5.3 / §17.4](../../docs/14_beta_railway_setup.md).
5. **AC-5 (`Frontend__BaseUrl` update).** §8 documents updating `api.Frontend__BaseUrl` to the new `web` custom domain (`https://<new-web-domain>`) and redeploying `api` — this drives the backend CORS allow-list + any absolute URLs the API emits (e.g. links in outbound mail). Stated as a runtime Railway variable (edit + redeploy `api`; no image rebuild).
6. **AC-6 (build-time `NEXT_PUBLIC_*` rebuild — the critical caveat).** §8 explicitly states that `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` are **build-time-constant** (baked into the `web` image, per [ADR-015](../planning-artifacts/architecture.md)). Therefore changing the `api`/`keycloak` public URL requires updating the corresponding GHA repo variables (`NEXT_PUBLIC_API_URL_BETA`, `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA`) **and rebuilding + redeploying the `web` image** — a Railway-variable edit alone has no effect. Cross-links [docs/14 §6 Build-time vs runtime variables](../../docs/14_beta_railway_setup.md).
7. **AC-7 (five-anchor issuer-parity atomic change set).** §8 presents the five `Keycloak__Authority`/issuer anchors as **one atomic change set** that must all describe the new Keycloak custom URL after the cutover: `api.Keycloak__Authority`, `web.KEYCLOAK_ISSUER` (build-time → rebuild), `keycloak.KC_HOSTNAME` (bare host), `api.KeycloakAdmin__BaseUrl`, GHA `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` (build-time → rebuild). States that a partial update produces the [RUNBOOK §6.2 "API won't go healthy"](./RUNBOOK-beta.md) incident. Cross-links [docs/14 §6.3 parity script](../../docs/14_beta_railway_setup.md).
8. **AC-8 (ordered, reversible runbook with rollback per step).** §8 presents the cutover as an **ordered checklist** (suggested order: stand up DNS for all three domains while defaults still serve → update Keycloak `KC_HOSTNAME` + `IABCONNECT_BETA_HOST` + redeploy → update `api` `Keycloak__Authority`/`KeycloakAdmin__BaseUrl`/`Frontend__BaseUrl` + redeploy → rebuild `web` with new `NEXT_PUBLIC_*` GHA vars → browser smoke → only then optionally retire the old `*.up.railway.app` domains). **Each step carries an explicit rollback note.** The reversibility AC (epics test/evidence) is satisfied by these paired rollback notes.
9. **AC-9 (post-cutover verification + cookie/CORS smoke).** §8 ends with a verification block: the five-anchor parity holds (re-run the [docs/14 §6.3](../../docs/14_beta_railway_setup.md) parity check), a fresh browser login round-trips on the new `web` domain, `/health/ready` is 200, CORS `Access-Control-Allow-Origin` echoes the new `web` domain, and `/about` is reachable on the new `api` domain. States that the browser smoke is the only way to catch cookie-domain / issuer / CORS bugs (mirrors [docs/14 §10.4](../../docs/14_beta_railway_setup.md)).
10. **AC-10 (no contradiction; A42 reread).** Every env-var name, hostname placeholder, scheme rule (`KC_HOSTNAME` bare vs. `IABCONNECT_BETA_HOST`/`Frontend__BaseUrl` `https://`-prefixed), tag scheme, and build-time-vs-runtime claim in §8 matches the rest of RUNBOOK-beta.md, docs/14, architecture.md, and the realm JSON byte-for-byte. Verified by the A42 six-category reread (incl. A57 binary reachability for any `dig`/`railway`/`kcadm` command).
11. **AC-11 (peer review — reversibility + IDP coordination, deferred per A47).** A peer reads §8 and confirms each step is reversible and the DNS/IDP coordination is explicit (the epics test/evidence line). Marked `[!]` — requires a human reader and, for any live-fire rehearsal, a green Beta deploy + a spare domain. Deferred to the unified Wave-10 walkthrough; surfaced as a Q-item in Completion Notes.

## Decision-Needed (per A32 / A41)

### DEC-1: Cutover scope — `web`-only custom domain vs. all three public services

**Scope:** The epics AC names "DNS, Keycloak hostname change, redirect URI update, `Frontend__BaseUrl` update" — which implies `web` + `keycloak` at minimum. Does §8 cover a custom domain for `api` too (and therefore the `NEXT_PUBLIC_API_URL` rebuild)?

**Options:**

- **(A) Cover custom domains for all three public services (`web`, `api`, `keycloak`), including the `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` rebuild requirement.** (RECOMMENDED, post-MVP) The standing "kein MVP" directive favours the complete cutover. The `api` custom domain is the highest-value omission to avoid: it is the one whose change is build-time (most surprising), and a Production deployment will almost certainly want a branded API host. Covering all three is the only way the five-anchor parity section (AC-7) is coherent.
- **(B) Cover `web` + `keycloak` only; keep `api` on its Railway-default domain and note the `api` custom domain as a future extension.** Smaller surface, satisfies the literal AC, but leaves the build-time `NEXT_PUBLIC_API_URL` caveat — the trickiest part — undocumented, and makes AC-6/AC-7 partial.

**Recommendation:** **A** (all three), given the post-MVP directive and that the build-time `api`-URL caveat is the single most failure-prone step.

### DEC-2: Domain topology — subdomains of one apex vs. independent domains

**Scope:** Should §8 assume the three services live under one apex (e.g. `app.example.org`, `api.example.org`, `auth.example.org`) or document arbitrary independent domains?

**Options:**

- **(A) Document the subdomain-of-one-apex topology as the worked example, with a one-paragraph note that independent domains work identically (each is just another Railway custom domain + CNAME).** (RECOMMENDED) The subdomain topology is the realistic Production layout, keeps the worked example concrete, and the cookie-domain / CORS notes are clearest when the three hosts share a registrable domain. The note covers the general case without doubling the prose.
- **(B) Write the section domain-topology-agnostic with placeholders only.** More general but less actionable — an operator following an abstract `<web-domain>`/`<api-domain>`/`<keycloak-domain>` checklist has no worked cookie-domain example to copy.

**Recommendation:** **A** (apex-subdomains worked example + general-case note).

## Tasks / Subtasks

> Subtask checkbox convention (per A30): `[x]` = dev-agent verified · `[!]` = needs human verify (manual / live infrastructure / cannot run in-process) · `[ ]` = pending.

### Task 0: Spike — confirm anchors + resolve DECs (A28 spike-first; A41 escape if pre-declared)

- [ ] 0.1 Confirm RUNBOOK-beta.md §8 placeholder + TOC entry (line 28) + Quick-reference table still present and unchanged since E18-S1 close (re-grep `Custom-domain migration`).
- [ ] 0.2 Re-confirm the five issuer-parity anchor names against [docs/14 §6.3](../../docs/14_beta_railway_setup.md) + [RUNBOOK §6.2](./RUNBOOK-beta.md) (`Keycloak__Authority`, `KEYCLOAK_ISSUER`, `KC_HOSTNAME`, `KeycloakAdmin__BaseUrl`, `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA`) — names must match byte-for-byte.
- [ ] 0.3 Re-confirm the `${...}` realm-import placeholders that depend on host (`${IABCONNECT_BETA_HOST}`, `${FRONTEND_PUBLIC_URL}` / equivalent) per A39 — `grep -oP '\$\{[A-Z_]+\}' infra/keycloak/realms-beta/iabconnect-realm.json | sort -u`.
- [ ] 0.4 Resolve DEC-1 + DEC-2 (A41 autonomous-mode escape if pre-declared, else AskUserQuestion per A32 step d) — record (a)/(b)/(c) per A43.
- [ ] 0.5 Spike outcome recorded in Dev Agent Record.

### Task 1: Author §8 prose — DNS + Railway custom-domain flow (AC-2, AC-8 ordering)

- [ ] 1.1 Replace the §8 placeholder with the authored section header + a one-paragraph intent ("this rehearses a future Production cutover; the `*.up.railway.app` defaults keep serving throughout until you retire them").
- [ ] 1.2 Document the Railway dashboard Custom-Domain flow per service + the CNAME/ALIAS DNS record at the operator's provider; mark DNS verification (`dig +short`) `[!] verify before executing` (A40).
- [ ] 1.3 (DEC-2=A) Present the apex-subdomain worked example (`app.`/`api.`/`auth.`) + the independent-domains note.

### Task 2: Author the Keycloak + redirect-URI + Frontend__BaseUrl steps (AC-3, AC-4, AC-5)

- [ ] 2.1 §8 step: `keycloak.KC_HOSTNAME` → bare new host (no scheme) + redeploy; cross-link docs/14 §5.3.
- [ ] 2.2 §8 step: `keycloak.IABCONNECT_BETA_HOST` → `https://<new-web-domain>` (scheme mandatory) → realm import re-applies redirect URIs / web origins; + Admin-Console manual-repair note for an already-imported realm.
- [ ] 2.3 §8 step: `api.Frontend__BaseUrl` → `https://<new-web-domain>` + redeploy `api` (runtime variable; CORS + mail links).

### Task 3: Author the build-time rebuild caveat + five-anchor atomic change set (AC-6, AC-7)

- [ ] 3.1 §8 callout: `NEXT_PUBLIC_API_URL` + `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA` are build-time-constant → require GHA repo-variable update + `web` image rebuild + redeploy; a Railway-variable edit alone is a no-op. Cross-link docs/14 §6.
- [ ] 3.2 §8 table: the five issuer-parity anchors as one atomic change set, with which are runtime (edit+redeploy) vs. build-time (rebuild); note partial update → RUNBOOK §6.2 incident. Cross-link docs/14 §6.3.

### Task 4: Author the ordered reversible checklist + verification block (AC-8, AC-9)

- [ ] 4.1 §8 ordered checklist (DNS-first → Keycloak → api → web rebuild → smoke → retire defaults), each step with a paired rollback note (AC-8 reversibility).
- [ ] 4.2 §8 verification block: re-run docs/14 §6.3 parity check + browser login round-trip + `/health/ready` 200 + CORS echo + `/about` reachable on new `api` domain (AC-9).
- [ ] 4.3 Update TOC line 28 (drop placeholder suffix) + add §7 Quick-reference row.

### Task 5: A42 reread-as-a-stranger pass + Quality-Gates closing (AC-10, AC-11)

- [ ] 5.1 A42 six-category reread: (1) no cross-section contradictions with §1/§6 of RUNBOOK; (2) §8 no longer reads as a placeholder; (3) cross-links use docs/14 section numbers; (4) every env-var/host/scheme-rule/tag matches code+docs/14+realm JSON; (5) no sprint-tracking leakage; (6) A57 — `dig`/`railway`/`kcadm` are operator-workstation or `[!]`-marked, none assumed in a runtime image.
- [ ] 5.2 AC-10 no-contradiction diff vs. RUNBOOK §1/§6 + docs/14 §5/§6 + architecture.md ADR-012/ADR-015 + realm JSON.
- [ ] 5.3 AC-Subitem Completion Check (A29 / A54) — Quality-Gates table has one row per AC (incl. the AC-11 deferred row).
- [ ] 5.4 (A47) AC-11 peer review + any live-fire rehearsal → Completion Notes Q-item (needs human reader + green Beta + spare domain).
- [ ] 5.5 Flip status to `review`.

## Dev Notes

### What this story does (and does NOT) do

- **Does:** fill RUNBOOK-beta.md §8 with a complete, ordered, reversible custom-domain cutover runbook covering DNS, Keycloak hostname, redirect URIs/web origins, `Frontend__BaseUrl`, the build-time `NEXT_PUBLIC_*` rebuild, and the five-anchor issuer parity.
- **Does NOT:** perform an actual cutover; create a new file; renumber any section; touch §9 (E19-S3); change any production code or config; require a green Beta to author (only the AC-11 peer/live-fire rehearsal needs that).

### Verified facts (grounding for the ACs)

- **Five issuer-parity anchors** ([docs/14 §6.3](../../docs/14_beta_railway_setup.md), [RUNBOOK §6.2](./RUNBOOK-beta.md)): `api.Keycloak__Authority`, `web.KEYCLOAK_ISSUER`, `keycloak.KC_HOSTNAME` (**bare host, no scheme**), `api.KeycloakAdmin__BaseUrl`, GHA `NEXT_PUBLIC_KEYCLOAK_ISSUER_BETA`. All five must equal the same Keycloak public URL after cutover.
- **Build-time vs runtime** ([ADR-015](../planning-artifacts/architecture.md), [docs/14 §6](../../docs/14_beta_railway_setup.md)): `NEXT_PUBLIC_*` values are baked into the `web` image at build → changing them needs a GHA repo-variable update + image rebuild + redeploy. `Keycloak__Authority`, `KeycloakAdmin__BaseUrl`, `Frontend__BaseUrl`, `KC_HOSTNAME`, `IABCONNECT_BETA_HOST` are runtime Railway variables → edit + redeploy is enough.
- **Scheme rules:** `KC_HOSTNAME` is the **bare** hostname (no `https://`); `IABCONNECT_BETA_HOST` and `Frontend__BaseUrl` are **`https://`-prefixed** full origins. Getting this wrong is the [RUNBOOK §6.3 redirect_uri](./RUNBOOK-beta.md) incident.
- **Topology** ([ADR-012](../planning-artifacts/architecture.md)): only `web`, `api`, `keycloak` are public (custom-domain-eligible); `postgres-app`, `postgres-kc`, `rustfs` are private (`*.railway.internal`) and never get custom domains.
- **Tag/deploy mechanics:** redeploys are per-service and version-independent ([RUNBOOK §1/§2](./RUNBOOK-beta.md)); `:beta` moving + `:sha-<commit>` immutable; no `:latest`.

### A31 cross-story orthogonal-AC invariants in scope

1. **Five-anchor issuer parity** (AC-7) — the custom-domain change must keep all five anchors equal; this is the same invariant tested at [RUNBOOK §6.2](./RUNBOOK-beta.md) and scripted at [docs/14 §6.3](../../docs/14_beta_railway_setup.md). §8 must not introduce a sixth anchor or rename one.
2. **`NEXT_PUBLIC_*` build-time-constant invariant** (AC-6) — already documented at [RUNBOOK §1 note](./RUNBOOK-beta.md) + [SCP line 798](../planning-artifacts/sprint-change-proposal-2026-05-15.md); §8 must state the rebuild requirement consistently, not contradict it.
3. **RUNBOOK ↔ docs/14 ↔ realm-JSON env-var parity** (AC-10) — every env-var name and scheme rule must match all three sources (enforced by the A42 reread, not an automated test — Markdown doc).
4. **A38 doc-bundle anchor integrity** — §8 fills the pre-laid placeholder without renumbering; §9 (E19-S3) stays a placeholder for that story.

### Anti-patterns (do NOT)

- Do **not** create a new `CUSTOM-DOMAIN.md` — the SCP + epics AC + the E18-S1 A38 anchor all put this content in RUNBOOK §8.
- Do **not** present the `NEXT_PUBLIC_API_URL` change as a Railway-variable edit — it is build-time; saying otherwise strands the operator.
- Do **not** add `https://` to `KC_HOSTNAME` or drop it from `IABCONNECT_BETA_HOST`/`Frontend__BaseUrl`.
- Do **not** prescribe `dig`/`railway domain`/`kcadm.sh` commands without an `[!] verify before executing` marker — none were exercised in-session (A40/A57).
- Do **not** retire the `*.up.railway.app` defaults as step 1 — they are the rollback safety net; retire them last (AC-8).

## Quality-Gates Closing

| AC | Evidence (planned) | Status |
|---|---|---|
| AC-1 §8 authored in place + TOC/QuickRef updated | placeholder replaced; line 28 suffix dropped; §7 row added; no renumber | pending |
| AC-2 DNS + Railway custom-domain flow | §8 per-service Custom-Domain flow + CNAME + `[!]` dig | pending |
| AC-3 Keycloak hostname | §8 `KC_HOSTNAME` bare-host + redeploy; docs/14 §5.3 | pending |
| AC-4 redirect-URI / web-origin | §8 `IABCONNECT_BETA_HOST` https-scheme + Admin-Console repair; docs/14 §5.3/§17.4 | pending |
| AC-5 `Frontend__BaseUrl` | §8 runtime var + redeploy `api` | pending |
| AC-6 build-time rebuild caveat | §8 `NEXT_PUBLIC_*` rebuild callout; docs/14 §6 | pending |
| AC-7 five-anchor atomic change set | §8 parity table; docs/14 §6.3 | pending |
| AC-8 ordered reversible checklist | §8 ordered steps + paired rollback notes | pending |
| AC-9 verification + smoke | §8 verification block (parity + login + health + CORS + /about) | pending |
| AC-10 no contradiction / A42 reread | six-category reread + diff vs docs/14 + realm JSON | pending |
| AC-11 peer review reversibility/IDP coord | live walkthrough (Q1) | deferred-pending-beta-green (A47) |

## Tests / Evidence

- **Primary deliverable:** edits to `_bmad-output/implementation-artifacts/RUNBOOK-beta.md` §8 (+ TOC line 28 + §7 Quick-reference row).
- **No automated tests** — documentation artifact; correctness enforced by the A42 reread (AC-10) + peer review (AC-11, deferred).
- **Live-fire evidence** (an actual custom-domain rehearsal on a spare domain against a green Beta) deferred to the unified Wave-10 walkthrough per A47.

## Dev Agent Record

### Agent Model Used

_(populated by dev-story)_

### Debug Log References

_(DEC-1 + DEC-2 resolution recorded here at dev-story time per A43 (a)/(b)/(c))_

### Completion Notes List

_(populated by dev-story)_

### File List

_(populated by dev-story)_

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention
- **A38** doc-bundle pattern (this story fills the E18-S1 RUNBOOK §8 anchor without renumbering)
- **A39** grep realm JSON for `${...}` placeholders when touching Keycloak env vars
- **A40** verify/`[!]`-mark shell commands for tools not exercised in-session (`dig`, `railway`, `kcadm.sh`)
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log for DEC resolution
- **A42** + **A45** + **A57** reread-as-a-stranger pass (six categories incl. binary reachability)
- **A47** uniform autonomous-mode escape for `[!]` live-walkthrough queue (AC-11)
- **A56** existing-implementation spike (RUNBOOK §8 placeholder already exists → fill-in, not net-new file)

## Story Completion Status

Status: ready-for-dev

Comprehensive context engine analysis completed — comprehensive developer guide created. §8 of RUNBOOK-beta.md to be filled in place with an ordered, reversible custom-domain cutover (DNS → Keycloak hostname → redirect URIs → `Frontend__BaseUrl` → build-time `NEXT_PUBLIC_*` rebuild → five-anchor issuer parity → smoke), each step with a rollback note. DEC-1 (all-three-services) + DEC-2 (apex-subdomain example) carry recommendations for dev-story resolution. AC-11 peer review deferred-pending-beta-green per A47.
