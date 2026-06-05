<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# SMTP migration plan — Mailtrap Sandbox → self-hosted Postal

**Audience:** the maintainer planning Production outbound mail.
**Status:** a **migration plan**, not yet executed. Beta keeps using the Mailtrap Sandbox ([ADR-018](../planning-artifacts/architecture.md))
until this cutover runs. Every command that touches the VPS, Postal, or DNS is operator-side and carries an `[!] verify before executing`
marker — confirm it against Postal's current install docs before running it in anger.

## 1. Why self-host (and why not just point at a provider)

Cloud PaaS outbound mail is structurally hostile to real-world delivery ([ADR-018](../planning-artifacts/architecture.md)): outbound
port 25 is blocked to arbitrary hosts, cloud IP ranges sit on RBL blocklists, and reverse-DNS cannot be configured on a Railway service.
Tester- and member-visible features (password reset, invoices, dunning notices, volunteer-shift reminders, email campaigns) all generate
outbound mail. For Beta the app routes that mail to the **Mailtrap Sandbox** — captured, never delivered, zero deliverability risk.

For Production there are two paths:

- **Third-party transactional provider** (SES / Postmark / Brevo) — fastest to deliverability, but re-introduces the vendor lock-in this
  project's OSS-sovereignty posture is trying to avoid.
- **Self-hosted Postal on a VPS you control** — a dedicated IP whose **rDNS/PTR** you can set and whose reputation you build. This is the
  sovereignty path ADR-018 names. It is more setup, but it keeps the whole stack self-hostable.

This plan documents the **Postal** path. Postal is a purpose-built transactional/SMTP-relay server (delivery dashboard, per-domain DKIM,
SMTP credentials) — the right fit for "the app sends outbound mail", as opposed to a full mailbox-hosting stack.

> **Alternatives (from ADR-018):** if you want a full mail-hosting stack (mailboxes, IMAP) rather than a relay, `mailcow` or
> `docker-mailserver` are the comparison points. For app-outbound-only mail, Postal is the lighter fit. This plan stays on Postal.

## 2. The backend is already provider-agnostic — this is a config-only migration

The application's mail sender ([`SmtpEmailSender.cs`](../../backend/src/IabConnect.Infrastructure/Email/SmtpEmailSender.cs)) speaks plain
SMTP via `System.Net.Mail.SmtpClient(host, port)` with `EnableSsl` (STARTTLS) and `NetworkCredential(username, password)`. The
[`Smtp` settings contract](../../backend/src/IabConnect.Infrastructure/Email/SmtpSettings.cs) is the entire surface. **Switching from
Mailtrap to Postal is an environment-variable change on the `api` service + a redeploy — no application code changes.**

| Env var (`api` service) | Mailtrap (Beta) | Postal (Production) |
|---|---|---|
| `Smtp__Host` | Mailtrap sandbox host | your Postal SMTP submission host (e.g. `postal.example.org`) |
| `Smtp__Port` | Mailtrap port | `587` (STARTTLS) — **use 587, not 465** (see note below) |
| `Smtp__EnableSsl` | (sandbox: typically `false`) | `true` |
| `Smtp__Username` | Mailtrap user | Postal SMTP credential username |
| `Smtp__Password` | Mailtrap pass | Postal SMTP credential password |
| `Smtp__FromEmail` | `noreply@example.org` | a `From` address **on a domain you authenticate via SPF/DKIM** (see §4) |
| `Smtp__FromName` | `IAB Connect` | unchanged (display name) |

> **Use port 587 (STARTTLS), not 465.** `System.Net.Mail.SmtpClient` with `EnableSsl=true` performs **STARTTLS** (explicit TLS upgrade on
> a plaintext-opened connection) — it does **not** reliably support implicit TLS / SMTPS on port 465. Point `Smtp__Port` at Postal's
> **submission (587)** endpoint. `System.Net.Mail.SmtpClient` does SMTP AUTH + STARTTLS but **not** OAuth2/XOAUTH2. Postal uses
> username+password SMTP credentials, so this is fully compatible — stay on the SMTP transport (Postal also has an HTTP API, but the app
> speaks SMTP; using it requires no code
> change). The env-var names above are double-underscore form and match [`backend/.env.example`](../../backend/.env.example) byte-for-byte.

## 3. Provision the VPS + install Postal

**Worked example: Hetzner.** Any provider that (a) allows outbound port 25 and (b) lets you set rDNS/PTR works identically — confirm both
before committing. Hetzner is the realistic OSS-budget choice (cheap EU VPS, outbound 25 allowed on request, rDNS configurable in the
control panel).

1. Provision a small VPS (a 2 vCPU / 4 GB tier is comfortable for Postal + its MariaDB). Give it a **static IPv4** (and IPv6 if you'll
   send over it). `[!] verify` Hetzner has unblocked outbound port 25 for the account (it is gated to reduce abuse — open a request).
2. Point a hostname at the VPS: an `A` record `postal.example.org → <vps-ip>`. This is the mail server's own hostname (HELO/EHLO name +
   the name the PTR will resolve to).
3. Install Postal per its **official install docs** (Docker-based: Postal + MariaDB + RabbitMQ via the `postal` helper). `[!] verify
   before executing` every step against <https://docs.postalserver.io/> for the current version — the install commands change between
   Postal releases, so this plan cross-references rather than freezing a command list that will rot.
4. Create an **organization** + a **mail server** + a **sending domain** (`example.org`) in the Postal web UI, and create an **SMTP
   credential** (username + password) — these become `Smtp__Username` / `Smtp__Password`.

## 4. DNS records (the deliverability-critical part)

A new IP with no authentication records gets filtered or rejected. Set **all four** before sending anything that matters:

| Record | Where | Purpose | Verify |
|---|---|---|---|
| **SPF** (TXT on `example.org`) | DNS provider | authorizes the Postal VPS IP to send for `example.org` (e.g. `v=spf1 ip4:<vps-ip> ~all`, or `include:` Postal's spf domain) | `[!]` `dig +short example.org TXT` |
| **DKIM** (TXT, Postal-generated selector) | DNS provider | publishes Postal's public key so receivers verify the signature Postal adds | `[!]` `dig +short <selector>._domainkey.example.org TXT` |
| **DMARC** (TXT on `_dmarc.example.org`) | DNS provider | policy tying SPF+DKIM together (start `p=none` for monitoring, tighten to `quarantine`/`reject` after warmup) | `[!]` `dig +short _dmarc.example.org TXT` |
| **rDNS / PTR** (`<vps-ip>` → `postal.example.org`) | **VPS provider** (Hetzner control panel, **not** your DNS host) | the sending IP must reverse-resolve to the mail hostname; a missing/mismatched PTR is the most common hard-reject cause | `[!]` `dig +short -x <vps-ip>` |

> Postal's web UI shows the exact SPF/DKIM records to publish for your sending domain and turns green when it can verify them — use that
> as the source of truth for the record values. A missing or wrong **SPF / DKIM / rDNS** is the number-one deliverability failure.

## 5. IP warmup

A brand-new VPS IP has **no sending reputation**. Sending full volume on day 1 gets the domain throttled or blocklisted.

- **Prerequisite:** SPF + DKIM + DMARC + rDNS (§4) must be in place and verifying **before** warmup begins — warmup on an
  unauthenticated IP just builds a *bad* reputation faster.
- **Ramp gradually.** Start with low daily volume (tens of mails) and roughly double every couple of days over ~1–2 weeks, prioritising
  mail to engaged recipients (real testers / admins who will open it) before any bulk campaign traffic.
- **Watch the signals.** Monitor the Postal dashboard's delivery stats + **bounce rate** + **complaint rate**; if bounces/complaints
  spike, pause the ramp and investigate (usually an auth-record or content/list-hygiene problem) before continuing.
- **Tighten DMARC** from `p=none` to `quarantine`/`reject` only once DKIM/SPF are consistently passing in the DMARC aggregate reports.

## 6. Cutover — ordered order-of-operations

1. Provision the VPS (§3.1) + confirm outbound-25 and rDNS are available.
2. Install Postal + create the org / mail server / sending domain / SMTP credential (§3.3–3.4).
3. Publish the DNS records, **including rDNS/PTR** (§4); wait for Postal to verify SPF + DKIM green.
4. **Send a test mail through Postal** (Postal UI "send test" or an `swaks`/manual SMTP submission) to an external inbox you control;
   confirm it **arrives** and shows **DKIM=pass / SPF=pass** in the receiving provider's "show original" headers. `[!] verify`.
5. Begin **IP warmup** (§5) while Beta is still on Mailtrap — warmup does not require the app to be cut over yet (you can warm up with
   test/marketing traffic from Postal directly).
6. **Cut the app over:** set the `api` service `Smtp__Host` / `Smtp__Port` / `Smtp__EnableSsl` / `Smtp__Username` / `Smtp__Password`
   (and `Smtp__FromEmail` to an authenticated-domain address) per §2 → **redeploy `api`**.
7. **Smoke test through the app:** trigger a real outbound (e.g. a password-reset for a test account) and confirm it is delivered +
   DKIM-pass at an external inbox.
8. **Monitor** the Postal dashboard + the `api` mail logs (`SmtpEmailSender` logs "Email sent successfully" / "Failed to send") for the
   first days; keep ramping per §5.

## 7. Rollback

Because the transport is **config-only**, rollback is immediate and lossless:

1. Revert the `api` `Smtp__*` env vars to the Mailtrap Sandbox values.
2. Redeploy `api`.

Outbound mail returns to the sandbox at once — no code change, no data migration. Leave the Postal VPS provisioned during a rollback so
you can fix the issue (usually an auth-record or warmup problem) and retry the cutover without rebuilding the server.

## 8. References

- [ADR-018 — Beta Mail Routing — Mailtrap Sandbox](../planning-artifacts/architecture.md) (the why-self-host rationale + the
  four-variable-change framing + Postal-on-Hetzner as the Production-Sovereignty option).
- [`SmtpEmailSender.cs`](../../backend/src/IabConnect.Infrastructure/Email/SmtpEmailSender.cs) /
  [`SmtpSettings.cs`](../../backend/src/IabConnect.Infrastructure/Email/SmtpSettings.cs) — the provider-agnostic SMTP surface (no code
  change needed).
- [`backend/.env.example`](../../backend/.env.example) — the canonical `Smtp__*` env-var names + the port-587-STARTTLS / port-25-blocked
  notes.
- Postal official docs: <https://docs.postalserver.io/> (install + DNS + SMTP credentials — the source of truth for exact commands).
- Production-gate row: [RUNBOOK-beta.md §9.2 "Real outbound SMTP"](./RUNBOOK-beta.md) — this migration is a Production-cutover blocker.
