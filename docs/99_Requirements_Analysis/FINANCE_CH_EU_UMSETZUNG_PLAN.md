# Finance CH/EU Umsetzung und Compliance Plan

Stand: 2026-02-27  
Geltungsbereich: IAB Connect Finance-Modul (Vereine in Schweiz und EU)

## Ziele

1. Finance-Modul so absichern, dass es für Vereins-Buchhaltung in der Schweiz und in der EU praxisnah nutzbar ist.
2. Dokumentation, Requirements und Status konsistent halten (CSV ↔ Status ↔ API Contracts ↔ Data Model ↔ Implementation Review).
3. Kritische Compliance-Risiken (Aufbewahrung, Revisionssicherheit, Rechnungsanforderungen) eliminieren.
4. Offene technische Punkte aus der Implementation-Review schliessen (fehlende Endpunkte, Background-Jobs, Pagination, Frontend-Pattern).

## Nicht-Ziele

1. Keine vollständige doppelte Buchhaltung (Fibu/ERP) ersetzen. Fokus bleibt “Mini-Buchhaltung für Vereine” mit Export/Integrationen.
2. Keine Rechts- oder Steuerberatung. Jurisdiktions-spezifische Details (insb. EU-Länder) bleiben konfigurierbar und erweiterbar.

---

## Ist-Stand (laut finance_implementation_review.md und requirements_status)

Das Finance-Modul deckt aktuell (Stand Review) u.a. ab:

- FinanceProfile (Jurisdiktion CH/EU, Währung, Org-Daten)
- Accounts/Categories/Transactions (CRUD, Audit)
- Invoices (CRUD, Status-Workflow), InvoiceItems, PDF-Generierung
- Payments inkl. Teilzahlungen, Ausgleich, Approval Workflow + Expense Claims
- Dunning Notices (Mahnwesen, Stufen)
- Receipts mit Upload/Download (Object Storage), Hash/Validation
- TaxCodes (MWST/VAT), pro Position, VAT Summary
- CH: QR-Zahlteil auf PDF (IG QR-bill v2.3)
- EU: Invoice Templates + Pflichtfelder
- eInvoice Export (EN 16931/UBL 2.1) als Erweiterungspunkt
- FiscalPeriods (Generate/Lock/Unlock) und Sperr-Checks in Commands
- BankImport CSV + BankImport camt.053/054 (ISO 20022) mit Matching-Strategie

Wichtig: Es gibt dokumentierte Restpunkte (API-Endpunkte, Background Jobs, Pagination, Frontend-Pattern).

---

## Externe Anforderungen (Kurz-Checkliste)

### Schweiz

- Vereinsbuchführung: Vorstand muss eine Buchhaltung führen, die Vermögenslage sowie Einnahmen/Ausgaben nachvollziehbar macht (ZGB Art. 69a).
- Aufbewahrung: Buchungsbelege und Geschäftsbücher müssen i.d.R. 10 Jahre aufbewahrt werden (OR Art. 958f).
- MWST (falls steuerpflichtig): Rechnungsangaben müssen MWST-konform sein (MWSTG/MWSTV, u.a. Leistungsinhalt, Entgelt, Steuersatz/Steuerbetrag, Datum/Zeitraum der Leistung).
- QR-Rechnung: Einhaltung der Swiss Implementation Guidelines QR-bill (SIX), Versionen beachten (v2.3 seit Nov 2025; v2.4 ist angekündigt).

### EU (generisch)

- VAT invoicing: Pflichtangaben nach EU-VAT-Directive (2006/112/EC), insbesondere Art. 226 (u.a. fortlaufende Nummer, Datum, Lieferant/Kunde, VAT-ID je Fall, Leistungsbeschreibung, Bemessungsgrundlage, Steuersätze, Steuerbetrag).
- Aufbewahrung: Speicherfrist wird durch Mitgliedsstaaten bestimmt (Directive 2006/112/EC Art. 247). Anforderungen an Authentizität/Integrität/Lesbarkeit und “reliable audit trail” sind relevant.
- eInvoicing: Öffentliche Stellen müssen EN 16931-konforme eInvoices empfangen können (Directive 2014/55/EU). Für B2B entstehen in vielen Ländern zusätzliche Mandate (landesspezifisch → Extension Points notwendig).
- Peppol BIS Billing 3.0 ist in vielen Ländern/Netzwerken ein praxisnaher CIUS-Standard (nicht überall verpflichtend).

---

## Gap- und Risikoanalyse (Soll vs Ist)

### 1) Kritisch: Aufbewahrung und Revisionssicherheit vs. physisches Löschen

Problem:
- Das DELETE-Verhalten für Belege/Receipts muss 100% retention-konform sein. Eine physische Löschung im Object Storage innerhalb der Aufbewahrungsfrist ist in der Regel nicht zulässig (Konflikt zu Datenschutz-Konzept, OR 958f und eigener Doku).

Zielzustand:
- “Delete” = Archivierung (Soft-Delete) + Audit-Event.
- Hard-Delete nur nach Retention-Ablauf und nur mit explizitem Admin-Override + Audit.

Umsetzung:
- Siehe Phase 1 und neues Requirement REQ-070.

### 2) Kritisch: Dokumentations-Drift (Data Model / finanzen.md vs Implementierung)

Beispiele:
- AccountType Werte widersprechen sich zwischen Doku und Review.
- Amount-Semantik (sign vs. absolute + Direction) widerspricht sich.
- finanzen.md listet fehlende Endpunkte, die in api_contracts / E2E Guide bereits existieren.

Zielzustand:
- Single source of truth:
  - Requirements: CSV
  - Status: requirements_status.md
  - API: api_contracts.md
  - Datenmodell: data_model.md
  - Finance-Readme: finanzen.md muss mit Ist-Stand übereinstimmen

Umsetzung:
- Phase 0 und Phase 4.

### 3) Lücken aus finance_implementation_review.md (24.x)

- 24.3 Fehlende API-Endpunkte:
  - Mark invoices overdue (Scheduled Job + Endpoint)
  - Accounts: Activate/Deactivate
  - Categories: Activate/Deactivate
  - BankImport: Unmatch Item
  - DunningNotices: Filter by invoiceId (optional)
- 24.2/24.4: Pagination fehlt; Frontend Patterns (Inline API Calls) müssen korrigiert werden.

Umsetzung:
- Phase 2 (API) + Phase 3 (Jobs) + Phase 4 (Quality)

### 4) EU eInvoice Export: Konformität ist nicht maschinell nachgewiesen

Status:
- Export ist implementiert, aber es fehlt ein belastbarer Validator-Loop (EN16931 / Peppol).

Zielzustand:
- Validator in CI + in API (vor Export/Versand) liefert strukturierte Fehler.
- Optional: Peppol BIS Billing 3.0 CIUS pro Profil.

Umsetzung:
- Phase 3/4 + neues Requirement REQ-072.

---

## Umsetzungsplan (Phasen)

### Phase 0 – Konsistenz & Scope-Freeze (kurz, aber zwingend)

1. Dokumentations-Drift feststellen:
   - Vergleich: finance_implementation_review.md ↔ finanzen.md ↔ data_model.md ↔ api_contracts.md ↔ requirements_status.md.
2. Regeln festziehen:
   - Keine “Quickfixes” im Frontend; React Query Pattern konsequent (siehe docs/07_dos_donts.md).
3. Decide:
   - Hard-Delete Policy für Finance-Daten (nur nach Retention?) → als Konfiguration dokumentieren.

Deliverables:
- Aktualisierte Doku-Dateien (siehe Phase 4)
- Entscheidungsnotiz zur Retention/Hard-Delete Policy

### Phase 1 – Retention, Archivierung, Revisionssicherheit (REQ-061 + REQ-070)

Backend:
1. Receipt DELETE: niemals Datei physisch löschen, sondern Archived/DeletedAt setzen.
2. Object Storage Lifecycle:
   - Versioning + optional Object Lock aktivieren (wenn RustFS unterstützt).
3. Audit Manifest:
   - Beim Upload Hash speichern (bereits vorhanden), aber zusätzlich:
     - Manifest pro FiscalPeriod erzeugbar (ZIP Export, Hashliste).
4. Restore/Unarchive:
   - Admin-only endpoint, Audit event.

Frontend:
- “Archiviert” Status sichtbar, Filter in Receipt Liste.
- Nur Admin kann “Hard delete after retention” (wenn überhaupt).

Tests:
- Integration Test: Delete receipt -> file still retrievable, hash unchanged.
- Security test: role checks.

### Phase 2 – API-Vollständigkeit und Contracts

Backend:
- Missing Endpoints implementieren (finance_implementation_review.md 24.3):
  - PUT /invoices/{id}/mark-overdue oder Background-run endpoint
  - PUT /accounts/{id}/activate|deactivate
  - PUT /categories/{id}/activate|deactivate
  - PUT /bank-imports/{id}/items/{itemId}/unmatch
  - GET /dunning-notices?invoiceId=...

Doku:
- docs/03_api_contracts.md aktualisieren (unmatch endpoint aufnehmen).
- E2E Guide erweitern um Tests für neue Endpunkte.

### Phase 3 – Background Jobs und betriebliche Robustheit

1. “Overdue Marking” als Hangfire Job:
   - täglich; beachtet FinanceProfile (Zahlungsfrist).
2. Dunning Runs:
   - optionaler Job “vorschlagen/erstellen”; Versand nur manuell oder genehmigt.
3. Monitoring:
   - Audit + Logs für Job Läufe.

### Phase 4 – Quality: Pagination, Concurrency, Frontend Patterns, Doku

Backend:
- Pagination standardisieren (Invoices, Transactions, Receipts, BankImports, DunningNotices).
- InvoiceNumber Generator:
  - Concurrency-safe (REQ-071) und immutable nach “Sent”.
- Validation zentralisieren (FluentValidation), keine Controller-Logik.

Frontend:
- API Calls über React Query Hooks, keine Inline fetch.
- UI Standards beachten (docs/13_frontend_design_standards.md).

Docs:
- finanzen.md: Ist-Stand aktualisieren (Endpoints, Enums, Semantik).
- 04_data_model.md: Enums/Amounts/SoftDelete Regeln konsistent machen.
- 01_requirements.md regenerieren aus CSV + requirements_status.md.

### Phase 5 – EU eInvoicing Validierung (REQ-072) + Optional Peppol

Backend:
- Validator (Schema + Schematron):
  - EN16931 UBL baseline
  - optional Peppol BIS Billing 3.0
- Validation Ergebnis als strukturierte Fehlerliste.
- CI Step mit Fixtures.

Frontend:
- Button “Validate eInvoice” + Anzeige Fehler.
- Block export/send bei Must errors.

### Phase 6 – Optional: Zahlungsdatei Export pain.001 (REQ-073)

- pain.001 Export aus Approved Payments.
- Validierung und Testcases.

---

## Abnahme-Checkliste (Definition of Done)

1. Retention: kein physisches Löschen innerhalb Retention; Audit vorhanden; Restore möglich.
2. API: alle dokumentierten Domain-Methoden haben Endpunkte; Contracts stimmen.
3. Jobs: Overdue marking automatisiert; Dunning optional.
4. Pagination: alle Listen-Endpunkte paginiert; UI nutzt Pagination.
5. Doku: finanzen.md, data_model.md, api_contracts.md und requirements.md konsistent.
6. Tests: Unit + Integration + E2E decken kritische Flows ab (Invoice lifecycle, Payments, Receipt storage, Bank import, Fiscal lock).

---

## Offene Entscheidungen (muss via #askUser geklärt werden)

1. Soll Hard-Delete von Finanzdokumenten überhaupt unterstützt werden (auch nach Retention)?
2. Welche Retention gilt als Minimum: 10 Jahre global oder per Jurisdiktion konfigurierbar?
3. Welche eInvoice Formate sind wirklich Ziel: nur EN16931 UBL oder zusätzlich Peppol BIS?
4. pain.001 Export: Muss das Must/Should werden oder bleibt es optional?

