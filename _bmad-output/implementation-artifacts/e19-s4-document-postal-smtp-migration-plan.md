# Story E19-S4: Self-host SMTP migration plan (Postal on Hetzner)

Status: ready-for-dev

## Story

As **a maintainer planning Production mail without a third-party transactional-provider lock-in**, I want **a documented, ordered, reversible migration plan from the Beta Mailtrap Sandbox to a self-hosted Postal server on a separate VPS — covering why-self-host, the VPS + Postal install, the DNS records (SPF/DKIM/DMARC/rDNS), the exact backend config swap, IP-warmup expectations, a smoke test, and a rollback path**, so that **a future Production-Go-Live can deliver real outbound mail from infrastructure the project fully controls, and the cutover can be executed (or rolled back) without guesswork about deliverability**.

**Requirement:** REQ-088 AC-9. Epic E19, Story 4. Sources:

- [_bmad-output/planning-artifacts/epics-and-stories.md §Epic E19 Story E19-S4 (lines 1926–1942)](../planning-artifacts/epics-and-stories.md)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §5 Epic E19 — Story E19-S4 (lines 674–678)](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-018 Beta Mail Routing — Mailtrap Sandbox (lines 366–374)](../planning-artifacts/architecture.md)
- [backend/src/IabConnect.Infrastructure/Email/SmtpEmailSender.cs (the provider-agnostic sender)](../../backend/src/IabConnect.Infrastructure/Email/SmtpEmailSender.cs)
- [backend/src/IabConnect.Infrastructure/Email/SmtpSettings.cs (the `Smtp:*` config contract)](../../backend/src/IabConnect.Infrastructure/Email/SmtpSettings.cs)
- [backend/.env.example (the `Smtp__*` env-var names)](../../backend/.env.example)

## Refresh Notes (2026-06-05, bmad-create-story bulk refresh for entire Epic-19)

This story was authored from the 19-line 2026-05-15 stub against post-Epic-18 reality. Findings (A56 existing-implementation spike):

- **`_bmad-output/implementation-artifacts/SMTP-MIGRATION-POSTAL.md` does NOT exist** (repo glob returns nothing). This is **genuine net-new authoring** — the only E19 story that creates a new file rather than filling a RUNBOOK section. Target path is exactly `_bmad-output/implementation-artifacts/SMTP-MIGRATION-POSTAL.md` per the SCP + epics AC.
- **The backend mail path is already provider-agnostic and the migration is config-only — no code change.** [SmtpEmailSender.cs](../../backend/src/IabConnect.Infrastructure/Email/SmtpEmailSender.cs) uses `System.Net.Mail.SmtpClient(host, port)` with `EnableSsl`, `DeliveryMethod=Network`, and `NetworkCredential(username, password)` when a username is set. [SmtpSettings.cs](../../backend/src/IabConnect.Infrastructure/Email/SmtpSettings.cs) is the `Smtp` section with **`Host`, `Port`, `Username`, `Password`, `EnableSsl`, `FromName`, `FromEmail`**. So the Mailtrap→Postal cutover is purely a change to `Smtp__Host` / `Smtp__Port` / `Smtp__Username` / `Smtp__Password` / `Smtp__EnableSsl` (env-var form, double-underscore) on the `api` Railway service + a redeploy. ADR-018 calls this a "four-environment-variable change"; the plan must name the exact keys (and note `EnableSsl` is the fifth — Postal submission on 587 uses STARTTLS → `Smtp__EnableSsl=true`, vs. Mailtrap sandbox which typically runs without). **The plan documents config + infra, not code.**
- **`System.Net.Mail.SmtpClient` capability note:** it supports SMTP AUTH + STARTTLS (via `EnableSsl`) on submission ports 587/465 — compatible with Postal's SMTP submission endpoint. It does **not** do OAuth2/XOAUTH2; Postal uses username+password SMTP credentials, so this is fine. The plan states this so a reader doesn't expect an API-key transport (Postal also has an HTTP API, but the app speaks SMTP — stay on SMTP, zero code change).
- **Why self-host at all (from ADR-018):** cloud PaaS outbound mail is structurally hostile — port 25 outbound is blocked, cloud IP ranges sit on RBL blocklists, and reverse-DNS can't be set. A dedicated VPS (Hetzner) is the cheapest place the operator controls **rDNS/PTR** + a clean-reputation IP, which is the precondition for deliverability. The plan must lead with this rationale so the "why not just point at Gmail/SES" question is pre-answered (SES/Postmark/Brevo are the third-party-lock-in path ADR-018 explicitly contrasts against the sovereignty path).
- **IP warmup is the highest-risk-to-omit topic** (it's named in the epics AC). A brand-new VPS IP has no sending reputation; blasting full volume on day 1 gets the domain throttled/blocklisted. The plan must cover gradual volume ramp, monitoring bounce/complaint rates, and the SPF/DKIM/DMARC + rDNS prerequisites that warmup depends on.
- **A40/A57 binary reachability:** every Postal-install command (Docker/`postal` CLI), DNS-record creation, and `dig`/`host` verification is **operator-VPS-side / DNS-provider-side**, NOT run from any IAB Connect runtime image — each carries `[!] verify before executing` against Postal's current install docs (Postal was not exercised in-session; A40). The plan cross-references Postal's official docs rather than inventing exact commands where it can.
- **This is a future-plan document, NOT a live cutover.** Unlike E19-S2's drill, the doc itself does not need a green Beta to author or to peer-review — the AC-9 peer review is a human-reader task that can run any time (it is `[!]` human-verify but **not** beta-green-gated; distinguish it from the A47 live-Beta queue).
- **A42 reread-as-a-stranger** mandatory at close. **Zero production code, zero config change** — the deliverable is one new Markdown plan.

## Acceptance Criteria

1. **AC-1 (file exists at the spec'd path).** [`_bmad-output/implementation-artifacts/SMTP-MIGRATION-POSTAL.md`](./SMTP-MIGRATION-POSTAL.md) exists with an SPDX header, an H1, and a short intent preface (this is a Production-prep migration *plan* from Mailtrap Sandbox to self-hosted Postal; it is not yet executed).
2. **AC-2 (why-self-host rationale).** The doc opens with the ADR-018 rationale: cloud-PaaS outbound-mail hostility (port-25 block, RBL-listed cloud IPs, no rDNS) → a controlled VPS with rDNS/PTR + clean IP is the deliverability precondition; and the sovereignty-vs-lock-in trade-off (Postal self-host vs. SES/Postmark/Brevo third-party). Cross-links [ADR-018](../planning-artifacts/architecture.md).
3. **AC-3 (VPS + Postal install — DEC-1/DEC-2).** A section documents provisioning the VPS (Hetzner as the worked example) and installing Postal (Docker-based, per Postal's official install docs), with each shell command / Postal-CLI step carrying `[!] verify before executing` against Postal's current docs (A40). Names the prerequisite that the VPS provider must allow outbound port 25 + rDNS configuration (Hetzner does; the doc says to confirm for any alternative provider).
4. **AC-4 (DNS records — SPF/DKIM/DMARC/rDNS).** A section enumerates the required DNS records: SPF (TXT authorizing the Postal IP), DKIM (the Postal-generated public key as a TXT record), DMARC (a TXT policy record), and the **rDNS/PTR** record set at the VPS provider (Hetzner control panel) so the sending IP reverse-resolves to the mail hostname. Each record's purpose is stated; verification via `dig`/`host` is `[!]`-marked (A40). States that a missing/incorrect SPF/DKIM/rDNS is the most common deliverability failure.
5. **AC-5 (the exact backend config swap — config-only, no code).** A section gives the precise cutover: change the `api` Railway service env vars **`Smtp__Host`** → the Postal SMTP submission host, **`Smtp__Port`** → 587 (or 465), **`Smtp__Username`** / **`Smtp__Password`** → the Postal SMTP credentials, **`Smtp__EnableSsl`** → `true` (STARTTLS on 587) → redeploy `api`. States explicitly that **no application code changes** — the sender is provider-agnostic ([SmtpEmailSender.cs](../../backend/src/IabConnect.Infrastructure/Email/SmtpEmailSender.cs) / [SmtpSettings.cs](../../backend/src/IabConnect.Infrastructure/Email/SmtpSettings.cs)). Names `Smtp__FromName` / `Smtp__FromEmail` as the sender identity that must align with the SPF/DKIM domain. Env-var names match `backend/.env.example` byte-for-byte (A51 parity).
6. **AC-6 (IP-warmup expectations).** A section covers IP warmup: a brand-new VPS IP has no reputation → ramp send volume gradually (a documented schedule, e.g. low daily volume rising over ~1–2 weeks), monitor bounce + complaint rates + the Postal dashboard delivery stats, and do not cut all traffic over on day 1. States that warmup is meaningless without SPF/DKIM/DMARC/rDNS in place first (AC-4 is a prerequisite). This is the named epics-AC topic.
7. **AC-7 (ordered order-of-operations + smoke test).** The doc presents the migration as an **ordered checklist** (provision VPS → install Postal → DNS records incl. rDNS → verify DNS propagation → create Postal SMTP credentials + sending domain → send a test mail + confirm DKIM-signed delivery → begin warmup → swap `api` `Smtp__*` + redeploy → monitor) with a smoke test: a real outbound mail (e.g. a password-reset) is sent through Postal and confirmed delivered + DKIM-pass at an external inbox. Realistic order is the epics test/evidence line.
8. **AC-8 (rollback path — explicit).** The doc has an explicit rollback section: revert the `api` `Smtp__*` env vars to the Mailtrap Sandbox values + redeploy → outbound mail returns to the sandbox immediately (no code change, no data migration). States rollback is instantaneous because the transport is config-only, and that the Postal VPS can stay provisioned during a rollback for a retry. Explicit rollback is the epics test/evidence line.
9. **AC-9 (peer review — realistic order + explicit rollback).** A peer reads the plan and confirms the order-of-operations is realistic and the rollback steps are explicit (the epics test/evidence line). Marked `[!]` human-verify — a human-reader task; **not** beta-green-gated (this is a future-plan doc, distinct from the A47 live-Beta queue). Surfaced as a Q-item in Completion Notes; may be folded into the Wave-10 walkthrough for convenience.
10. **AC-10 (no contradiction; A42 reread).** Every config key (`Smtp__Host/Port/Username/Password/EnableSsl/FromName/FromEmail`), port number, the "config-only / no code change" claim, and the ADR-018 rationale in the doc matches `SmtpSettings.cs`, `SmtpEmailSender.cs`, `backend/.env.example`, and architecture.md byte-for-byte. Verified by the A42 six-category reread (incl. A57 — every install/DNS command is operator-VPS-side + `[!]`-marked, none assumed in an IAB Connect image).

## Decision-Needed (per A32 / A41)

### DEC-1: VPS provider framing — Hetzner-specific worked example vs. provider-agnostic

**Scope:** The epic title names "Postal on Hetzner". How tightly does the doc bind to Hetzner?

**Options:**

- **(A) Hetzner as the concrete worked example (rDNS via the Hetzner control panel, a specific small VPS tier), with a short "any provider that allows outbound port 25 + rDNS works identically" note.** (RECOMMENDED) The epic explicitly names Hetzner; a concrete worked example (especially the rDNS step, which is provider-UI-specific) is more actionable than abstractions, and the one-paragraph note keeps it portable. Hetzner is the realistic OSS-budget choice (cheap, EU, allows port 25 + rDNS).
- **(B) Fully provider-agnostic with placeholders only.** More portable but the rDNS/PTR step — the deliverability-critical one — has no concrete worked example, which is exactly where operators get stuck.

**Recommendation:** **A** (Hetzner worked example + portability note), matching the epic title.

### DEC-2: Mail-server software — Postal vs. alternatives (mailcow / docker-mailserver)

**Scope:** The epic names Postal. ADR-018 also lists mailcow, docker-mailserver, xmox as self-host options. Does the doc commit to Postal or compare?

**Options:**

- **(A) Postal as the documented path (it is purpose-built as a transactional/SMTP-relay server with a delivery dashboard + per-domain DKIM + SMTP credentials), with a one-paragraph "alternatives" note pointing at mailcow/docker-mailserver from ADR-018 for operators who want a full mail-hosting stack.** (RECOMMENDED) The epic + SCP both name Postal specifically; Postal's transactional-relay model (vs. mailcow's full-mailbox-hosting model) is the right fit for app-outbound-only mail. The note preserves the ADR-018 option space without doubling the doc.
- **(B) Comparative doc weighing Postal vs. mailcow vs. docker-mailserver in depth.** More thorough but dilutes the named deliverable (a Postal migration plan) into a survey; the comparison already lives in ADR-018.

**Recommendation:** **A** (Postal path + brief alternatives note), matching the epic + SCP.

## Tasks / Subtasks

> Subtask checkbox convention (per A30): `[x]` = dev-agent verified · `[!]` = needs human verify (manual / live infrastructure / cannot run in-process) · `[ ]` = pending.

### Task 0: Spike — confirm SMTP contract + file absence + resolve DECs (A28; A41 escape if pre-declared)

- [ ] 0.1 Confirm `SMTP-MIGRATION-POSTAL.md` absent (glob) — genuine net-new.
- [ ] 0.2 Re-confirm the `Smtp:*` contract from [SmtpSettings.cs](../../backend/src/IabConnect.Infrastructure/Email/SmtpSettings.cs) (`Host/Port/Username/Password/EnableSsl/FromName/FromEmail`) + the `Smtp__*` env-var form in [backend/.env.example](../../backend/.env.example) (A51 parity).
- [ ] 0.3 Re-confirm the sender is provider-agnostic + speaks SMTP (`System.Net.Mail.SmtpClient`, STARTTLS via `EnableSsl`) in [SmtpEmailSender.cs](../../backend/src/IabConnect.Infrastructure/Email/SmtpEmailSender.cs) → migration is config-only, no code.
- [ ] 0.4 Re-confirm ADR-018 rationale (port-25 block / RBL / rDNS / four-var change / Postal-Hetzner sovereignty).
- [ ] 0.5 Resolve DEC-1 + DEC-2 (A41 escape if pre-declared, else AskUserQuestion per A32 step d) — record (a)/(b)/(c) per A43.
- [ ] 0.6 Spike outcome recorded in Dev Agent Record.

### Task 1: Author the doc skeleton + why-self-host + install (AC-1, AC-2, AC-3)

- [ ] 1.1 Create `SMTP-MIGRATION-POSTAL.md` with SPDX header + H1 + intent preface (plan, not yet executed).
- [ ] 1.2 Why-self-host section (ADR-018 PaaS-mail hostility + sovereignty-vs-lock-in); cross-link ADR-018.
- [ ] 1.3 (DEC-1/DEC-2) VPS (Hetzner worked example) + Postal install (Docker, official-docs cross-ref); all commands `[!] verify` (A40); port-25 + rDNS prerequisite note.

### Task 2: Author DNS + the config swap + IP warmup (AC-4, AC-5, AC-6)

- [ ] 2.1 DNS section: SPF + DKIM + DMARC + rDNS/PTR (purpose each; `dig`/`host` verify `[!]`); missing-record = top deliverability failure.
- [ ] 2.2 Config-swap section: exact `Smtp__Host/Port/Username/Password/EnableSsl` change on `api` + redeploy; **no code change**; `Smtp__FromName/FromEmail` ↔ SPF/DKIM domain alignment; env-var names byte-match `.env.example` (A51).
- [ ] 2.3 IP-warmup section: gradual volume ramp schedule + bounce/complaint monitoring + Postal dashboard; SPF/DKIM/DMARC/rDNS as warmup prerequisite.

### Task 3: Author order-of-operations + smoke test + rollback (AC-7, AC-8)

- [ ] 3.1 Ordered checklist (provision → install → DNS+rDNS → verify propagation → Postal creds+domain → test mail+DKIM-pass → warmup → swap `Smtp__*`+redeploy → monitor).
- [ ] 3.2 Smoke test: a real outbound (password-reset) through Postal confirmed delivered + DKIM-pass at an external inbox.
- [ ] 3.3 Rollback section: revert `Smtp__*` to Mailtrap + redeploy → instant (config-only, no data migration); keep VPS provisioned for retry.

### Task 4: A42 reread + Quality-Gates closing (AC-10, AC-9)

- [ ] 4.1 A42 six-category reread: (1) no internal contradiction (e.g. port/EnableSsl consistency); (2) no pre-filled "done" status (it's a plan); (3) cross-refs to Postal docs are pointers, not invented exact commands; (4) `Smtp__*` keys + ports + "no code change" claim match `SmtpSettings.cs`/`SmtpEmailSender.cs`/`.env.example`/ADR-018; (5) no sprint leakage; (6) A57 — every install/DNS command operator-VPS-side + `[!]`-marked, none in an IAB Connect image.
- [ ] 4.2 AC-Subitem Completion Check (A29) — Quality-Gates table one row per AC; the DNS sub-records (SPF/DKIM/DMARC/rDNS) each a line.
- [ ] 4.3 AC-9 peer review → Completion Notes Q-item (human-reader; not beta-green-gated).
- [ ] 4.4 Flip status to `review`.

## Dev Notes

### What this story does (and does NOT) do

- **Does:** author the new `SMTP-MIGRATION-POSTAL.md` — a complete, ordered, reversible Mailtrap→Postal-on-Hetzner migration plan: rationale, VPS+Postal install, SPF/DKIM/DMARC/rDNS, the config-only backend swap, IP warmup, smoke test, rollback.
- **Does NOT:** execute the migration; provision a VPS; change any application code or config (the `Smtp__*` swap is documented for a future operator, not applied here); touch RUNBOOK-beta.md; require a green Beta to author or peer-review.

### Verified facts (grounding for the ACs)

- **Config contract** ([SmtpSettings.cs](../../backend/src/IabConnect.Infrastructure/Email/SmtpSettings.cs), section `Smtp`): `Host` (default `localhost`), `Port` (default 1025 = Mailhog), `Username?`, `Password?`, `EnableSsl` (default false), `FromName` (default `Organization`), `FromEmail` (default `noreply@example.org`). Env-var form is double-underscore: `Smtp__Host` etc. (confirm against [backend/.env.example](../../backend/.env.example)).
- **Sender** ([SmtpEmailSender.cs](../../backend/src/IabConnect.Infrastructure/Email/SmtpEmailSender.cs)): `System.Net.Mail.SmtpClient(host, port){ EnableSsl, DeliveryMethod=Network }`; `NetworkCredential(username, password)` only when username is set; HTML + plain-text alternate views. Provider-agnostic SMTP — **Postal cutover = config only, no code**. STARTTLS via `EnableSsl=true` on 587. No OAuth2 (Postal uses user+pass SMTP creds → fine).
- **ADR-018 rationale:** PaaS outbound-mail hostility (port-25 block, RBL'd cloud IPs, no rDNS); Mailtrap Sandbox in Beta; "transition to a real provider is a four-environment-variable change"; "self-hosted Postal-on-Hetzner path is documented in E19 as the Production-Sovereignty option."
- **rDNS** is set at the VPS provider (Hetzner control panel), not in app DNS — the deliverability-critical, provider-specific step.

### A31 cross-story orthogonal-AC invariants in scope

1. **`Smtp__*` env-var parity** (AC-5/AC-10, A51) — the keys in the plan must byte-match `SmtpSettings.cs` section names + `backend/.env.example`. A drifted key (`Smtp__SslEnabled` vs `Smtp__EnableSsl`) would silently no-op.
2. **"Config-only / no code change" invariant** (AC-5) — must be true and stated; the sender is already provider-agnostic, so the plan must NOT prescribe a code edit.
3. **Mailtrap rollback parity** (AC-8) — the rollback values are the current Beta `Smtp__*` (Mailtrap Sandbox) per ADR-018; the plan references them as the revert target.

### Anti-patterns (do NOT)

- Do **not** prescribe a code change — the SMTP sender is provider-agnostic; the migration is `Smtp__*` env vars + redeploy (AC-5).
- Do **not** drift the config keys — match `SmtpSettings.cs` / `.env.example` exactly (A51).
- Do **not** invent exact Postal-install/CLI commands — cross-reference Postal's official docs + `[!] verify` (A40); Postal was not exercised in-session.
- Do **not** omit rDNS/PTR or IP warmup — they are the named, deliverability-critical topics (AC-4/AC-6).
- Do **not** present the plan as executed or pre-tick an order-of-operations — it's a future plan (A42 pre-filled-status).
- Do **not** assume any install/DNS command runs in an IAB Connect image — all are operator-VPS/DNS-side (A57).

## Quality-Gates Closing

| AC | Evidence (planned) | Status |
|---|---|---|
| AC-1 file at spec'd path + SPDX + preface | new SMTP-MIGRATION-POSTAL.md | pending |
| AC-2 why-self-host rationale | ADR-018 PaaS-hostility + sovereignty-vs-lock-in | pending |
| AC-3 VPS + Postal install | Hetzner example + Docker install + `[!]` + port-25/rDNS prereq | pending |
| AC-4 (SPF) | DNS record line + purpose + `[!]` verify | pending |
| AC-4 (DKIM) | DNS record line + purpose + `[!]` verify | pending |
| AC-4 (DMARC) | DNS record line + purpose + `[!]` verify | pending |
| AC-4 (rDNS/PTR) | VPS-provider record + purpose + `[!]` verify | pending |
| AC-5 config swap (no code) | `Smtp__Host/Port/Username/Password/EnableSsl` + redeploy; key-parity | pending |
| AC-6 IP warmup | ramp schedule + bounce/complaint monitoring + prereq note | pending |
| AC-7 order-of-operations + smoke | ordered checklist + DKIM-pass external-inbox smoke | pending |
| AC-8 rollback explicit | revert `Smtp__*` to Mailtrap + redeploy; instant/config-only | pending |
| AC-9 peer review realistic/rollback | human-reader Q1 (not beta-green-gated) | deferred-human-verify (A47-style) |
| AC-10 no contradiction / A42 reread | six-category reread + diff vs SmtpSettings/sender/.env.example/ADR-018 | pending |

## Tests / Evidence

- **Primary deliverable:** `_bmad-output/implementation-artifacts/SMTP-MIGRATION-POSTAL.md` (net-new Markdown plan).
- **No automated tests** — documentation artifact; correctness enforced by the A42 reread (AC-10) + peer review (AC-9).
- **No live infrastructure** is provisioned by this story — the actual Postal stand-up + cutover is a future Production-prep execution; this story delivers the plan.

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
- **A40** verify/`[!]`-mark shell commands for tools not exercised in-session (Postal install/CLI, `dig`/`host`)
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log for DEC resolution
- **A42** + **A57** reread-as-a-stranger (six categories incl. binary reachability — all install/DNS commands operator-VPS-side)
- **A51** A31 invariant via direct artifact-read (`Smtp__*` keys must byte-match `SmtpSettings.cs` + `.env.example`)
- **A56** existing-implementation spike (file absent → genuine net-new; backend sender already provider-agnostic → config-only migration)

## Story Completion Status

Status: ready-for-dev

Comprehensive context engine analysis completed — comprehensive developer guide created. A new `SMTP-MIGRATION-POSTAL.md` to be authored: a complete, ordered, reversible Mailtrap-Sandbox → self-hosted-Postal-on-Hetzner migration plan (rationale per ADR-018, VPS + Postal install, SPF/DKIM/DMARC/rDNS, the config-only `Smtp__*` backend swap with byte-matched keys, IP-warmup expectations, DKIM-pass smoke test, instant config-only rollback). DEC-1 (Hetzner worked example) + DEC-2 (Postal path) carry recommendations for dev-story resolution. AC-9 peer review is a human-reader task (not beta-green-gated). Zero production code, zero config change.
