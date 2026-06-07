# Deferred-Work Triage — Beta-Go-Live (2026-06-07)

Triage der gesamten `deferred-work.md` (865 Zeilen) gegen die Frage: **Was ist
wirklich offen, bevor das Beta deployt und an externe Tester gegeben wird?**

Kontext: Alle 20 Epics sind `done`. Es gibt keine `create-story`/`dev-story`-Arbeit
mehr. Offen sind nur (a) der grüne Beta-Deploy auf Railway, (b) die
Walkthrough-Queue der `[!]`-Live-Items, und (c) die hier triagierten Defer-Items.

Buckets: **B0** erledigt/hinfällig · **B1** vor Deploy verifizieren · **B2**
vor externen Testern · **B3** funktionale Defects bei Feature-Nutzung · **B4**
Security-Härtung · **B5** Tech-Debt/Test/Kosmetik (nach Go-Live).

---

## B0 — Erledigt oder hinfällig (aus der Liste streichen)

| Item | Grund |
|---|---|
| **E13-FT-6** docker-exec Backup inkompatibel mit Railway | **RESOLVED** in E15-S3 — `PostgresBackupService` nutzt jetzt direktes `pg_dump`/`pg_restore` gegen den Connection-String (verifiziert im Code). Eintrag veraltet. |
| **E13-FT-10** DEC-1 ohne AskUserQuestion | **CLOSED 2026-06-01** (A41 Path B, im Doc vermerkt). |
| **E15-FT-6** Section-11.2-Cross-Link | "verified-during-retro", keine Aktion nötig. |
| **E11-S1** `Branding__SourceUrl` consumed-after-documented | Konsument E20-S3 ist inzwischen `done` → Forward-Reference aufgelöst. |
| Alle „Dismissed"-Abschnitte | Bereits mit Begründung verworfen — nicht actionen. |

---

## B1 — Vor dem grünen Beta-Deploy verifizieren (Deploy-Korrektheit)

Diese können das Live-Beta **still** brechen. Die meisten Owner-Stories sind `done`
— hier geht es ums **Bestätigen, dass die Korrektur tatsächlich gelandet ist**, als
Teil des Deploy-Walkthroughs.

| Item | Risiko | Aktion |
|---|---|---|
| **E12-S1 D3'** `ASPNETCORE_ENVIRONMENT`-Default + `UseForwardedHeaders` (`X-Forwarded-Proto`) | Hinter Railways TLS-Edge sendet ASP.NET sonst 307-HTTPS-Redirects, die Nicht-Browser-Clients brechen | Verifizieren, dass E13-S2 (env var) **und** E14-S2 (ForwardedHeaders-Middleware) gelandet sind |
| **E12-S3 D12'** Keycloak `${VAR}`-Fail-Fast-Guard | Unsubstituierte Secrets importieren als Literal → Backend-Token-Exchange bekommt **still 401** | Vor Deploy: alle drei KC-Secrets in Railway gesetzt; Guard/Smoke vorhanden |
| **E12-S4 D19'** `--import-realm`-Strategie in KC 26.5.2 | Bei „overwrite" werden Admin-Console-Edits bei jedem Redeploy überschrieben (Datenverlust) | Default gegen Annahme „IGNORE_EXISTING" prüfen; sonst `KC_IMPORT_REALM_STRATEGY` setzen |
| **E12-S3 D16'** Realm `sslRequired: "external"` | Beta effektiv HTTP-everywhere aus KC-Sicht | Nach bestätigter Railway-TLS-Termination auf `"all"` flippen (koppelt mit E14-S2) |
| **E11-S2 D1** `rustfsadmin`-Dev-Credentials in Base-`appsettings.json` + 5 eager-init-Keys | Committete Dev-Credentials im Repo; Beta überschreibt zwar per env var | Entscheidung: IOptions-Refactor (mechanisch, schließt E12-S1 D2'/D6' mit) **oder** als Dev-only akzeptieren |

---

## B2 — Vor den ersten externen (Nicht-Harry-)Testern

Aus „Forward-tracked from E13" — die echten Pre-Tester-Gates.

| Item | Sev | Aktion |
|---|---|---|
| **E13-FT-1** Mailtrap-Sandbox → echter SMTP | **HIGH** | Ohne das bekommt **kein** Tester Passwort-Reset/Rechnung/Dunning-Mail. Plan fertig in `SMTP-MIGRATION-POSTAL.md`; Provider wählen (Brevo/Postmark/Postal), SPF+DKIM in DNS, `Smtp__*` auf Railway swappen, externer Versand-Smoke |
| **E13-FT-5** env-var Keycloak-`KEYCLOAK_ADMIN` retiren | Security | Nach Anlage des persönlichen Admins: env-var-Admin im master-Realm löschen + zwei env vars entfernen |
| **E13-FT-3** HSTS 30d → ≥6 Monate + `includeSubDomains` | Security | `services.AddHsts(...)` in `DependencyInjection.cs` vor `app.UseHsts()`; **kein** `preload`-Submit vor Custom-Domain |
| **E13-FT-4** `rustfs:latest` → Digest pinnen | Supply-Chain | Railway-Image-Source auf `rustfs/rustfs@sha256:<digest>` (Digest in docs/14 erfasst) |
| **E13-FT-2** Custom-Domain-CNAMEs | optional | Beta kann auf `*.up.railway.app` bleiben; erst bei registrierter Domain (Runbook §8 / E19-S1) |

---

## B3 — Funktionale Defects, die bei Feature-Nutzung greifen

Keine Deploy-Blocker, aber **echte Bugs**, sobald der betroffene Pfad getestet wird.
Priorisieren nach dem geplanten Test-Umfang.

| Item | Sev | Greift wenn… |
|---|---|---|
| **E4-FT-1** Paid-Event Waitlist-Promotion erzeugt keine Rechnung | **HIGH** | Bezahlte Events die Warteliste nutzen → Promovierter wird `Confirmed` ohne Invoice/Mail |
| **E4-FT-2** Member-Paid-Registration-UI fehlt (nur Public-Pfad gebaut) | **HIGH** | Multi-Tier-Member-Event → Member-Anmeldung unbuchbar (400). **QGT überzeichnet Coverage → korrigieren** |
| **E4-FT-3** `MaxQuantity` (Verkaufslimit/Kategorie) nie geprüft | MED | Gedeckelte Tiers (Early-Bird) → Üb_verkauf |
| **E4-FT-4 / E4-FT-6** Currency-Mismatch ohne aktives FinanceProfile / Roster+Mail nutzen aktuelle statt Invoice-Währung | MED | Multi-Currency / Finance-enabled-aber-unkonfiguriert |
| **E4-FT-5** Roster-Payment-Stats nur seitenweit, als Event-Total dargestellt | MED | Events mit >20 bezahlten Anmeldungen → „amount owed" unterzählt |
| **E4-FT-8** Zero-Amount-Kategorie inkonsistent über drei Surfaces | MED | „register-but-track"-Tiers à 0 |
| **E6-FT-1** DoubleEntry-Modus zeigt Soll/Ist-Actuals = 0 | MED | Nur DoubleEntry-Installs (Beta-Default ist SimpleCash → ok) |
| **E6-FT-2** Concurrent Duplicate-Budget → 500 statt 409 | LOW | Race beim Budget-Anlegen |
| **E5-FT-1** Zeit-relative Trigger nicht an reale Event/Renewal-Records gebunden | MED | „X Tage vorher"-Automationen — v1 ist Once-per-Recipient-Broadcast |
| **E5-FT-5** Keine Per-Definition-Isolation in `ExecuteDueAsync` | MED | Eine korrupte Automation stoppt den ganzen Lauf |
| **E7-FT-1** Blog-Admin-UI fehlt (ContentLanguage nur via API) | LOW | Blog-Inhalte über UI pflegen |
| **E8-FT-1..4** Webhook-Politur (Retry-Threshold, SSRF-DNS, payment.received-Hooks, History-Range) | LOW | Externe Webhook-Consumer in Anger |

---

## B4 — Security-Härtung (vor breiterem/öffentlichem Test sinnvoll)

| Item | Aktion |
|---|---|
| **E9.S3 E-Mail-HTML-Injection** (MED) | User-Felder (`RecipientName`, `Notes`, `Title`, `ParticipantEmail`) roh in HTML-Templates interpoliert → dedizierter Encoding-Pass über alle Mail-Templates |
| **E12-S3 D15'** Service-Account hat vollen `realm-admin` | Least-Privilege: Custom-Rolle nur mit tatsächlich genutzten Scopes (KeycloakAdminService-Footprint zuerst auditieren) |
| **E10 Cross-Cutting** Audit-Actor = username statt `sub` | Bei Keycloak-Rename bricht Forensik — projektweite Audit-Identity-Härtung |
| **E10 Cross-Cutting** Audit-Write-on-deny ungedrosselt | Fehlkonfigurierter Polling-Client → ~86k Audit-Rows/Tag; Coalescing/Rate-Limit |
| **E15-FT-1** PGDG GPG-Key-Fingerprint-Pinning im Dockerfile | Supply-Chain; vor dem E19-S3 Production-Gate |

---

## B5 — Tech-Debt / Test-Härtung / Kosmetik (nach Go-Live, eigener Cleanup-Sprint)

Kein Tester-Blocker. Als dedizierte Aufräum-Mini-Sprint(s) nach dem Go-Live mit
`[CR]`/`[AR]`/`[ECH]` abarbeiten. Cluster:

- **Test-Robustheit:** E17-FT-1..14 (Anchor-/Path-/Regex-Fragilität, coarse A31-Parity, fehlende Runtime-Assertions), diverse „metadata-only"/„skip-without-env" Test-Gaps (E10-S2, E10-S5 Playwright, E2/E3-Coverage), E13-FT-9 A35-Konvention.
- **Container/Build-Hygiene:** E12 D5' (NuGet-Cache-Mount), D7' (Image 384→≤350 MB Trimming), D9' (`HOSTNAME`-Kollision), D10'/D11' (.dockerignore/.gitkeep), D17' (SPI-Jar-Glob), D21' (tini/PID-1), D22'/seq-Pin, plus AC-Text-Drifts (D8'/D18'/D23'/D24'/D30').
- **Config-Hygiene:** `.env.example` Zeilennummern-Rot, `KeycloakHealthCheck` Key-Typo (E11-S1), `Logging:LogLevel`-Redundanz, eager-init IOptions-Refactor (verbindet B1-E11-S2-D1).
- **Architektur/Perf:** E10-S1 `IMemoryCache` per-process (Redis), E9.S3 SystemSettings-Caching, E5-FT-3/4/6, E6-FT-3.
- **Historisch (E1/E2/E3):** per-Route Rate-Limiting, `.gitattributes` CRLF/LF, kosmetische REST-Nits (404-vs-410, info-leak-timing), i18n-Key-Dups, Phone-/Address-Matcher-Tuning, diverse „defense-in-depth"-Defers.

---

## Empfohlene Reihenfolge

1. **Grünen Beta-Deploy** nach `RUNBOOK-beta.md` — dabei **B1** als Verifikations-Checkliste mitführen.
2. **Walkthrough-Queue** (die 10 `[!]`-Live-Items E14/E16/E17/E18/E19) per `[CK]` Checkpoint gegen das Live-Beta.
3. **B2** Pre-Tester-Gates flippen (zuerst E13-FT-1 SMTP).
4. **B4** Security-Härtung + die **HIGH**-Items aus **B3** (E4-FT-1/E4-FT-2), soweit die bezahlten/Member-Pfade getestet werden.
5. Externe Tester einladen.
6. **B5** als Cleanup-Sprint(s) nach Go-Live.
