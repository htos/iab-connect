# Story E18-S2: Beta tester onboarding guide

Status: review

## Story

As **a Beta tester**, I want **a short German-language guide explaining how I sign up, what the Beta covers, how to see the emails the app sends, how to report feedback, and the known limitations**, so that **I can self-onboard and start testing without back-and-forth with the maintainer**.

**Requirement:** REQ-088 AC-9 (AC-7 in SCP §5). Epic E18, Story 2. Sources:

- [_bmad-output/planning-artifacts/epics-and-stories.md §Epic E18 Story E18-S2 (lines 1810–1826)](../planning-artifacts/epics-and-stories.md)
- [_bmad-output/planning-artifacts/sprint-change-proposal-2026-05-15.md §5 Epic E18 — Story E18-S2 (lines 632–636)](../planning-artifacts/sprint-change-proposal-2026-05-15.md)
- [_bmad-output/planning-artifacts/architecture.md ADR-018 Beta Mail Routing — Mailtrap Sandbox (lines 366–374)](../planning-artifacts/architecture.md)
- [docs/14_beta_railway_setup.md §16 First Beta-Admin seeding + §5.3 Mailtrap/password-reset](../../docs/14_beta_railway_setup.md)

## Refresh Notes (2026-06-05, bmad-create-story bulk refresh for entire Epic-18)

Authored from the 19-line 2026-05-15 stub. This is a **genuine net-new documentation deliverable** (the file does not exist), but its content depends on facts verified at refresh:

- **Target path is `_bmad-output/implementation-artifacts/BETA-TESTER-GUIDE.md`** per the SCP (line 636) + epics file (line 1818). German language, **≤ 2 pages**.
- **Document language exception:** the project's `document_output_language` is English, but this artifact's AC **mandates German** (its audience is the German-speaking Verein testers, per ADR-018). The guide body is German; this story file (the spec) stays English.
- **Signup path is self-registration — VERIFIED, with a load-bearing Mailtrap caveat.** [infra/keycloak/realms-beta/iabconnect-realm.json](../../infra/keycloak/realms-beta/iabconnect-realm.json) has `registrationAllowed: true`, `registrationEmailAsUsername: true`, `verifyEmail: true`, `resetPasswordAllowed: true`. So testers self-register via the Keycloak login page's "Register" link **using their email as username**. BUT `verifyEmail: true` means Keycloak sends a verification email — and per ADR-018 that email lands in the **Mailtrap sandbox, not the tester's real inbox**. The guide MUST explain this honestly: the tester cannot complete email verification from their own inbox; the operator either shares the Mailtrap inbox link / forwards the verification mail, OR pre-verifies the account (the docs/14 §16 operator flow toggles "Email verified" ON for operator-created accounts). This is the single most important thing to get right (A42 imprecise-claim category) — promising testers a normal "check your email" flow would strand every one of them.
- **Mailtrap inbox access (ADR-018):** mails are visible in the Mailtrap inbox but never delivered to real recipients. Testers either receive a Mailtrap inbox share link or use Mailtrap's "forward-to-email" feature. SMTP keys: `Smtp__Host=sandbox.smtp.mailtrap.io`, `Smtp__Port=587`, `Smtp__EnableSsl=true`, `Smtp__Username`/`Smtp__Password` (sealed) per [docs/14 §5.1](../../docs/14_beta_railway_setup.md).
- **Mail-triggering flows a tester will encounter** (so the guide can say "you'll see these in Mailtrap"): account email-verification + password reset (Keycloak), invoice send (finance), event registration/waitlist/reminder notifications, email campaigns. The guide's "see your mails" section names the flows a pilot tester actually hits (signup → finance task → event task per the AC's evidence test).
- **Feedback section depends on E18-S4 + E18-S3:** the guide tells testers to use the BETA banner's "Feedback geben" link (de.json `beta.feedbackLink`) which opens the `beta-feedback` GitHub issue template (E18-S4). The guide's feedback wording MUST match what E18-S4 ships (A31 soft cross-story consistency). Author this story AFTER E18-S3 + E18-S4 so the banner + template are settled.
- **A42 reread-as-a-stranger** mandatory at close (documentation deliverable).

## Acceptance Criteria

1. **AC-1 (file exists, German, ≤2 pages).** [`_bmad-output/implementation-artifacts/BETA-TESTER-GUIDE.md`](./BETA-TESTER-GUIDE.md) exists, is written in German, and is concise enough to print on ≤2 pages (roughly ≤ ~900 words / scannable headings + short lists, not prose walls).
2. **AC-2 (signup process — accurate).** A section explains how a tester signs up: open the Beta URL → "Registrieren" on the Keycloak login page → register with email-as-username. It states the **Mailtrap email-verification caveat** truthfully: the verification email does not arrive in the tester's real inbox (Beta uses a mail sandbox); the operator pre-verifies the account or shares the Mailtrap link, so the tester should expect to coordinate that one step with the maintainer. Cross-references the operator side in [docs/14 §16 + §5.3](../../docs/14_beta_railway_setup.md). No false "check your inbox to confirm" promise (A42).
3. **AC-3 (scope of beta).** A section states what the Beta is for and what testers should/shouldn't expect: real features to exercise (members, finance, events), data may be reset at any time (mirrors the BETA banner message), not for production/real-money use, stability caveats.
4. **AC-4 (how to access the Mailtrap inbox).** A section explains that emails the app sends (verification, password reset, invoices, event notifications) are captured in a Mailtrap sandbox and how the tester sees them — via a shared Mailtrap inbox link or the "forward-to-email" feature (per ADR-018) — and that they will NOT arrive in the tester's normal mailbox.
5. **AC-5 (how to file feedback).** A section tells testers to click "Feedback geben" in the orange BETA banner (top of every page), which opens a pre-structured GitHub issue (the `beta-feedback` template from E18-S4). Wording consistent with the shipped banner label + template (A31 soft check).
6. **AC-6 (known limitations).** A section lists the current Beta limitations honestly: mail is sandboxed (no real delivery); data resets; no custom domain yet; any features explicitly out of Beta scope; uptime is best-effort.
7. **AC-7 (no contradiction; accurate against reality).** Every concrete claim (Beta URL placeholder, the "Registrieren" flow, the Mailtrap behaviour, the banner feedback link, the reset-data caveat) matches the actual realm config, ADR-018, and the shipped banner/template. Verified by the A42 reread pass.
8. **AC-8 (pilot-tester evidence — deferred per A47).** A pilot tester reads the guide and successfully completes signup + one finance task + one event task on Beta. Marked `[!]` — requires a green Beta deploy + a real human pilot. Deferred to the unified Wave-9 walkthrough; surfaced as a Q-item.

## Decision-Needed (per A32 / A41)

### DEC-1: How to present the self-registration + Mailtrap-verification reality

**Scope:** AC-2/AC-4. The realm allows self-registration but `verifyEmail: true` + Mailtrap sandbox means the tester can't self-complete verification.

**Options:**

- **(A) Document self-registration as the entry, with an explicit "the maintainer activates your account / shares the verification mail" coordination step, and point operators to docs/14 §16 to pre-verify.** (RECOMMENDED) Truthful, matches the verified realm config + ADR-018, and keeps the tester's path short (register, then ping the maintainer once). Aligns with the docs/14 §16 operator flow (operator can create + pre-verify accounts).
- **(B) Document operator-provisioned accounts only** (operator creates each tester in Keycloak, ticks Email-verified, shares a password-reset/login) and omit self-registration. Simpler tester story but ignores that the realm DOES allow self-registration and pushes all account creation onto the maintainer — contradicts the "self-onboarding without maintainer back-and-forth" story goal.
- **(C) Document self-registration as fully self-service** (tester checks their own inbox). **Factually wrong** under the Mailtrap sandbox — would strand every tester. Rejected.

**Recommendation:** **A.** Self-registration + one honest coordination step for verification.

### DEC-2: Guide format — standalone Markdown vs. also surfacing in-app

**Scope:** The AC names a Markdown file. Should the guide also be linked from the app (e.g. from the banner or a help link)?

**Options:**

- **(A) Standalone `BETA-TESTER-GUIDE.md` only; the maintainer shares it with testers out-of-band (the canonical AC deliverable).** (RECOMMENDED) Matches the AC scope exactly; zero production-code change; the banner already carries the feedback link, which is the only in-app affordance the SCP scopes for Beta.
- **(B) Also add an in-app "Hilfe/Guide" link.** Scope creep — new UI, new i18n keys, new layout surface — beyond the AC and beyond Beta minimum. Defer to a future story if testers ask for it.

**Recommendation:** **A.** Standalone Markdown; out-of-band sharing.

## Tasks / Subtasks

> Subtask checkbox convention (per A30): `[x]` = dev-agent verified · `[!]` = needs human verify (live pilot) · `[ ]` = pending.

### Task 0: Spike — confirm realm + mail facts + resolve DECs (A28 spike-first)

- [x] 0.1 Confirmed realm flags `registrationAllowed: true` / `registrationEmailAsUsername: true` / `verifyEmail: true` / `resetPasswordAllowed: true` in [realms-beta/iabconnect-realm.json](../../infra/keycloak/realms-beta/iabconnect-realm.json).
- [x] 0.2 Confirmed ADR-018 Mailtrap routing (`sandbox.smtp.mailtrap.io`) + SMTP keys (docs/14 §5).
- [x] 0.3 Confirmed shipped banner feedback label (de.json `beta.feedbackLink` = "Feedback geben") + E18-S4 template `beta-feedback.md` — feedback section matches.
- [x] 0.4 Authored LAST in the epic (after E18-S1/S3/S4) so banner + template are settled.
- [x] 0.5 DEC-1=A (self-registration + maintainer pre-verify step) + DEC-2=A (standalone Markdown) resolved via A41 — see Debug Log References.
- [x] 0.6 Spike outcome recorded in Dev Agent Record.

### Task 1: Author the guide (AC-1..AC-6)

- [x] 1.1 Created `BETA-TESTER-GUIDE.md` (German, SPDX header), 579 words / ~1.3 pages, scannable headings (AC-1).
- [x] 1.2 §1 "Anmeldung / Registrierung" — self-registration (email-as-username) + honest Mailtrap-verification coordination step ("Bestätigungs-E-Mail landet im Test-Postfach … gib der Betreuung Bescheid") (DEC-1=A) (AC-2).
- [x] 1.3 §2 "Was ist die Beta?" — scope (Mitglieder/Finanzen/Events), data-reset caveat (mirrors banner), not-for-production (AC-3).
- [x] 1.4 §3 "E-Mails ansehen (Mailtrap)" — sandbox behaviour + Mailtrap inbox-link/forward + which flows send mail (verify/reset/invoice/event) (AC-4).
- [x] 1.5 §4 "Feedback geben" — the orange Beta banner "Feedback geben" link → GitHub `beta-feedback` template + Correlation-ID hint; wording matches E18-S4 (AC-5).
- [x] 1.6 §5 "Bekannte Einschränkungen" — sandboxed mail, data resets, no custom domain, best-effort uptime (AC-6).

### Task 2: A42 reread + Quality-Gates close (AC-7, AC-8 deferred)

- [x] 2.1 A42 six-category reread complete: (1) no cross-section contradictions; (2) no pre-filled placeholders; (3) no stale anchors (Beta URL is an operator-filled placeholder; no hard docs/14 line anchors embedded); (4) **the Mailtrap claim is exactly true** — the guide states the verification email goes to the test inbox and the tester must coordinate, never promises a real inbox email; (5) no sprint-tracking leakage; (6) the GitHub template exists (E18-S4) + the banner link is shipped.
- [x] 2.2 Length check: 579 words ≈ 1.3 pages (≤2).
- [x] 2.3 AC-Subitem Completion Check (A29) — Quality-Gates table filled.
- [!] 2.4 AC-8 pilot-tester evidence deferred per A47 → Completion Notes Q1 (needs a green Beta deploy + a human pilot: signup + 1 finance + 1 event task).
- [x] 2.5 Status flipped to `review`.

## Dev Notes

### Verified facts the guide must reflect (do not invent)

| Fact | Value | Source |
|---|---|---|
| Self-registration | `registrationAllowed: true`, email-as-username | [realms-beta json:7–8](../../infra/keycloak/realms-beta/iabconnect-realm.json) |
| Email verification | `verifyEmail: true` → mail to **Mailtrap**, not real inbox | realm json:10 + [ADR-018](../planning-artifacts/architecture.md) |
| Password reset | `resetPasswordAllowed: true` (also lands in Mailtrap) | realm json:11 + docs/14 §5.3 |
| Mail routing | Mailtrap sandbox; never delivered to real recipients | [ADR-018](../planning-artifacts/architecture.md) |
| SMTP keys | `Smtp__Host=sandbox.smtp.mailtrap.io`, `__Port=587`, `__EnableSsl=true`, `__Username/__Password` sealed | docs/14 §5.1 |
| Mail-sending flows | account verify/reset, invoice send, event reg/waitlist/reminder, email campaign | backend (EventNotificationService, Invoice/EmailCampaign endpoints, Keycloak) |
| Feedback affordance | BETA banner "Feedback geben" → GitHub `beta-feedback` template | E18-S3 banner + E18-S4 template |
| Data-reset message | matches banner: "Daten können jederzeit zurückgesetzt werden" | de.json `beta.bannerMessage` |

### The one claim that must be exactly right

Beta mail is **sandboxed** (`verifyEmail: true` + Mailtrap). A tester who self-registers will NOT receive the verification email in their own inbox. The guide must say so plainly and give the coordination step (maintainer pre-verifies / shares the Mailtrap mail), pointing operators at docs/14 §16. Getting this wrong strands every tester at signup — it is the highest-risk imprecise-claim surface (A42 category 4).

### Cross-story dependencies (recommend authoring last in the epic)

- E18-S3 (banner) — the guide references its "Feedback geben" link + data-reset text.
- E18-S4 (feedback template) — the guide's feedback section must match the shipped GitHub template.
- Author order within Wave-9: E18-S1 (RUNBOOK) → E18-S3 (banner verify) → E18-S4 (feedback template) → **E18-S2 (this guide)**.

### What this story does NOT do

- It does NOT change any production code, realm config, or SMTP settings (the realm already allows registration; ADR-018 already routes to Mailtrap).
- It does NOT build an in-app help/guide UI (DEC-2=A — standalone Markdown).
- It does NOT switch Beta off the Mailtrap sandbox (that is E19-S4's Postal migration plan).

### A31 cross-story orthogonal-AC invariants in scope

1. **Guide feedback section ↔ E18-S4 template + E18-S3 banner label** — soft consistency (AC-5/AC-7), verified by A42 reread, not automated (Markdown deliverable).
2. **Guide data-reset wording ↔ banner `beta.bannerMessage`** — the guide echoes the banner's promise so a tester sees one consistent message (AC-3).

## Quality-Gates Closing

| AC | Evidence | Status |
|---|---|---|
| AC-1 file, German, ≤2pp | BETA-TESTER-GUIDE.md (German, 579 words ≈ 1.3 pages) | covered |
| AC-2 signup + Mailtrap caveat | §1 Anmeldung — self-registration + honest test-inbox coordination step | covered |
| AC-3 scope of beta | §2 Was ist die Beta? — scope + data-reset + not-for-production | covered |
| AC-4 Mailtrap inbox access | §3 E-Mails ansehen — sandbox + inbox-link/forward + mail-sending flows | covered |
| AC-5 file feedback | §4 Feedback geben — banner "Feedback geben" → GitHub beta-feedback template + Correlation-ID | covered |
| AC-6 known limitations | §5 Bekannte Einschränkungen — sandboxed mail / data resets / no custom domain / best-effort uptime | covered |
| AC-7 no contradiction | A42 reread; Mailtrap claim exactly true (no false "check your inbox" promise) | covered |
| AC-8 pilot-tester evidence | live walkthrough (Q1) | deferred-pending-beta-green (A47) |

## Tests / Evidence

- **Primary deliverable:** `_bmad-output/implementation-artifacts/BETA-TESTER-GUIDE.md` (net-new German Markdown).
- **No automated tests** — documentation artifact; correctness enforced by the A42 reread (AC-7) + the pilot read-through (AC-8, deferred).
- **Pilot evidence:** deferred to Wave-9 walkthrough per A47 (AC-8 — signup + 1 finance + 1 event task on Beta).

## Dev Agent Record

### Agent Model Used

claude-opus-4-8[1m] (Opus 4.8, 1M context)

### Debug Log References

**DEC-1 (how to present self-registration + Mailtrap verification) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c):**
- (a) **Option chosen:** A (document self-registration as the entry + an explicit "the maintainer activates your account / forwards the verification mail" coordination step).
- (b) **Rationale:** story recommendation = A; user autonomous-mode verbatim quote = "das ganze epic umsetzen ohne unterbrechung und ohne stop bis alle stories implementiert sind. danach gemäss plan eine retro durchführen." (2026-06-05); architectural justification = the beta realm verifiably allows self-registration (`registrationAllowed: true`) but `verifyEmail: true` + Mailtrap sandbox means the tester cannot self-complete verification — A is the only truthful path; B (operator-only) contradicts the self-onboarding story goal; C (self-service inbox) is factually wrong and would strand every tester.
- (c) **Consequence chain:** §1 documents register → ping maintainer → freischalten; §3 explains the sandbox; no false "check your inbox" promise anywhere.

**DEC-2 (guide format: standalone Markdown vs. in-app) — resolved A via A41 autonomous-mode escape per A43 (a)/(b)/(c):**
- (a) **Option chosen:** A (standalone `BETA-TESTER-GUIDE.md`; maintainer shares it out-of-band).
- (b) **Rationale:** story recommendation = A; same user quote; architectural justification = matches the AC scope exactly; zero production-code change; the banner already carries the only in-app feedback affordance the SCP scopes for Beta.
- (c) **Consequence chain:** one Markdown file; no new UI / i18n keys / layout surface.

### Spike outcome (Task 0.6)

The beta realm allows self-registration but verification email is sandboxed (Mailtrap, ADR-018). The guide's load-bearing correctness surface is the Mailtrap caveat — handled in §1 + §3 + §5. Authored last in the epic so the banner (E18-S3) + feedback template (E18-S4) wording is settled. German-language deliverable (AC exception to `document_output_language: English`, since the audience is the German Verein testers per ADR-018).

### Completion Notes List

- **What was implemented:** `_bmad-output/implementation-artifacts/BETA-TESTER-GUIDE.md` — German, 579 words (~1.3 pages), 5 sections: Anmeldung (self-registration + Mailtrap coordination), Was ist die Beta?, E-Mails ansehen (Mailtrap), Feedback geben (banner → GitHub template), Bekannte Einschränkungen.
- **Highest-risk surface handled truthfully:** the Mailtrap email-verification caveat is stated plainly in §1/§3/§5 — no "check your real inbox" promise.
- **DEC-1=A + DEC-2=A** auto-resolved via A41; (a)/(b)/(c) Debug Log above.
- **German-language exception** to `document_output_language: English` noted (audience-mandated by the AC + ADR-018).
- **Zero production code / zero tests** — documentation artifact; correctness enforced by the A42 reread (AC-7, clean).

### Unified human-verify queue (per A47 surface convention)

- **Q1 (AC-8 pilot read-through):** during the Wave-9 unified walkthrough, a pilot tester reads the guide and successfully completes signup + one finance task + one event task on a green Beta deploy.

### File List

**NEW:**
- `_bmad-output/implementation-artifacts/BETA-TESTER-GUIDE.md`

**MODIFIED:**
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (e18-s2: ready-for-dev → in-progress → review)
- `_bmad-output/implementation-artifacts/e18-s2-author-beta-tester-onboarding-guide.md` (this story file)

### Change Log

- 2026-06-05 — E18-S2 dev-story: authored German `BETA-TESTER-GUIDE.md` (579 words, 5 sections). The Mailtrap email-verification caveat is stated truthfully (testers self-register but verification mail is sandboxed → coordinate with maintainer). DEC-1=A (self-registration + coordination) + DEC-2=A (standalone Markdown) auto-resolved via A41. AC-1..AC-7 covered; AC-8 (pilot read-through) deferred-pending-beta-green per A47 → Q1. Zero production code, zero tests.

## Project Context Reference

[_bmad-output/project-context.md](../project-context.md) — see especially:

- **A30** three-state checkbox convention
- **A34** bulk spec-refresh at epic start (batch with E18-S1/S3/S4)
- **A41** + **A43** autonomous-mode escape + (a)/(b)/(c) Debug Log for DEC resolution
- **A42** reread-as-a-stranger pass (six categories — the Mailtrap claim is the critical category-4 surface)
- **A47** uniform autonomous-mode escape for `[!]` live-walkthrough queue (AC-8)

## Story Completion Status

Status: review (was: ready-for-dev; flipped by dev-story 2026-06-05)

German `BETA-TESTER-GUIDE.md` authored (579 words, 5 sections), with the Mailtrap email-verification caveat stated truthfully. Authored last in the epic so the banner + feedback-template wording match. AC-1..AC-7 covered; AC-8 (pilot read-through) deferred-pending-beta-green per A47 → Q1.
