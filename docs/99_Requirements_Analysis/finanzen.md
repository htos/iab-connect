# Finanzen-Modul — Detaillierte Übersicht

> Stand: 28.02.2026 | Autor: Requirements-Engineering-Analyse
> Scope: Backend (Domain, Application, API, Infrastructure), Frontend (Pages, Components, API-Client), Dokumentation

---

## Inhaltsverzeichnis

1. [Zusammenfassung](#1-zusammenfassung)
2. [Requirements-Status](#2-requirements-status)
3. [Umgesetzte Features (Backend)](#3-umgesetzte-features-backend)
4. [Umgesetzte Features (Frontend)](#4-umgesetzte-features-frontend)
5. [Offene Punkte & Lücken](#5-offene-punkte--lücken)
6. [Architektur- & Code-Qualitätsprobleme](#6-architektur---code-qualitätsprobleme)
7. [UX-Probleme im Frontend](#7-ux-probleme-im-frontend)
8. [Empfohlene nächste Ziele](#8-empfohlene-nächste-ziele)
9. [Datenmodell-Übersicht](#9-datenmodell-übersicht)
10. [API-Endpunkt-Übersicht](#10-api-endpunkt-übersicht)

---

## 1. Zusammenfassung

Das Finanzmodul ist das umfangreichste Feature des Projekts. 7 von 8 Kern-Finanz-Requirements sind Done (REQ-038 bis REQ-043, REQ-045), alle 10 erweiterten Finanz-Requirements sind Done (REQ-060 bis REQ-069), und 4 weitere Finanz-Requirements sind Done (REQ-070 bis REQ-073). Es umfasst:

- 17 Domain-Entities (Account, Category, Transaction, Invoice, InvoiceItem, Payment, BankImport, BankImportItem, DunningNotice, Receipt, FinanceProfile, TaxCode, ActivityArea, FiscalPeriod, ExpenseClaim, InvoiceTemplate, InvoiceNumberCounter)
- ~210 CQRS-Dateien (Commands, Queries, Handlers, Validators via MediatR + FluentValidation)
- API-Endpunkte fuer alle Finance-Bereiche, alle paginiert (PagedResult<T>)
- 12+ Frontend-Seiten unter /finance
- ~130 i18n-Keys in DE und EN
- 420+ Finance-Unit-Tests
- Soft-Delete/Storno auf allen Entities implementiert
- IArchivable Interface mit 10-Jahre Retention auf Receipt, Invoice, Transaction (REQ-070)
- Receipt-File-Storage via S3/RustFS mit SHA256-Integrity
- Invoice-PDF via QuestPDF, Swiss QR-Zahlteil via Codecrete.SwissQRBill
- FinanceProfile (CH/EU Jurisdiktion, Waehrung, Org-Details)
- VAT/MWST (konfigurierbare TaxCodes, Per-Item-Tax, VAT-Export)
- EU-Rechnungskonformitaet mit InvoiceTemplate (VAT-ID, Reverse Charge, Rechtshinweise)
- eInvoice Export (EN 16931/UBL 2.1) mit Feature-Flag
- eInvoice Validierung (En16931Validator, BR-01..BR-AE-01, ICiusProfile) (REQ-072)
- Geschaeftsperioden (FiscalPeriod) mit Open/Closed/Locked und Periodensperre
- Zahlungs-Freigabe-Workflow und Spesenabrechnung (ExpenseClaim)
- ActivityArea Dimension-Tagging mit P&L-Report
- camt Import (ISO 20022 camt.053/054) mit 5-stufigem Referenz-Matching
- InvoiceNumberCounter mit PostgreSQL atomic UPSERT, per-profile/per-fiscal-year (REQ-071)
- pain.001 Export (CH SPS / SEPA, pain.001.001.09) (REQ-073)
- Hangfire Background Jobs (MarkInvoicesOverdueJob daily, DunningScheduleGenerationJob weekly)

### Bewertung

| Bereich           | Status                                                   |
| ----------------- | -------------------------------------------------------- |
| Domain-Modell     | Solide, gut strukturiert, Soft-Delete auf allen Entities |
| Application Layer | CQRS/MediatR vollstaendig refactored, FluentValidation   |
| API-Endpunkte     | Funktional, CQRS-basiert                                 |
| Frontend-Seiten   | Alle vorhanden                                           |
| Tests             | 420+ Finance-Unit-Tests                                  |
| Dokumentation     | Aktualisiert                                             |

---

## 2. Requirements-Status

### Kern-Finanz-Requirements

| ID          | Titel                            | Prio        | Status     | Sprint   |
| ----------- | -------------------------------- | ----------- | ---------- | -------- |
| **REQ-038** | Mini-Buchhaltung Grundfunktionen | Must have   | ✅ Done    | Sprint 2 |
| **REQ-039** | Rechnungsstellung                | Must have   | ✅ Done    | Sprint 2 |
| **REQ-040** | Zahlungsverwaltung und Abgleich  | Must have   | ✅ Done    | Sprint 2 |
| **REQ-041** | Bankimport CSV                   | Should have | ✅ Done    | Sprint 2 |
| **REQ-042** | Mahnwesen                        | Should have | ✅ Done    | Sprint 2 |
| **REQ-043** | Belegmanagement                  | Should have | ✅ Done    | Sprint 2 |
| **REQ-044** | Budget und Kostenstellen         | Could have  | ❌ Backlog | —        |
| **REQ-045** | Export für Steuer/Buchhaltung    | Must have   | ✅ Done    | Sprint 2 |

### Erweiterte Finanz-Requirements

| ID          | Titel                                    | Prio        | Status     | Sprint   |
| ----------- | ---------------------------------------- | ----------- | ---------- | -------- |
| **REQ-060** | FinanceProfile (Jurisdiktion/Waehrung)   | Must have   | ✅ Done    | Sprint 3 |
| **REQ-061** | Receipt-Storage (S3/RustFS)              | Must have   | ✅ Done    | Sprint 3 |
| **REQ-062** | VAT/MWST TaxCodes                        | Must have   | ✅ Done    | Sprint 3 |
| **REQ-063** | Swiss QR-Zahlteil                        | Should have | ✅ Done    | Sprint 3 |
| **REQ-064** | EU-Rechnungskonformitaet                 | Should have | ✅ Done    | Sprint 4 |
| **REQ-065** | eInvoice Export (UBL 2.1)                | Should have | ✅ Done    | Sprint 4 |
| **REQ-066** | Geschaeftsperioden / Periodensperren     | Must have   | ✅ Done    | Sprint 4 |
| **REQ-067** | Zahlungs-Freigabe / Spesenabrechnung     | Should have | ✅ Done    | Sprint 4 |
| **REQ-068** | ActivityArea Dimension-Tagging           | Could have  | ✅ Done    | Sprint 4 |
| **REQ-069** | camt Import (ISO 20022)                  | Should have | ✅ Done    | Sprint 4 |

### Sprint 5 Finanz-Requirements

| ID          | Titel                                         | Prio        | Status     | Sprint   |
| ----------- | --------------------------------------------- | ----------- | ---------- | -------- |
| **REQ-070** | Revisionssicheres Archiv / Retention          | Must have   | ✅ Done    | Sprint 5 |
| **REQ-071** | Rechnungsnummern-Serien (konkurenzsicher)     | Must have   | ✅ Done    | Sprint 5 |
| **REQ-072** | eInvoice Validierung (EN 16931 / CIUS)        | Should have | ✅ Done    | Sprint 5 |
| **REQ-073** | pain.001 Export (CH SPS / SEPA)               | Could have  | ✅ Done    | Sprint 5 |

### Finanz-abhängige Requirements (andere Bereiche)

| ID      | Bereich        | Bezug zu Finanzen                    | Status     |
| ------- | -------------- | ------------------------------------ | ---------- |
| REQ-009 | Identity       | MFA für Kassier-Rolle erzwingbar     | ❌ Backlog |
| REQ-011 | Identity       | Audit-Log für Finanzdaten-Änderungen | ✅ Done    |
| REQ-015 | Mitglieder/CRM | Beiträge/Sollstellungen/Rechnungen   | ✅ Done    |
| REQ-016 | Mitglieder/CRM | Self-Service: Rechnungen einsehen    | ✅ Done    |
| REQ-022 | Events         | Ticketing erzeugt Rechnung           | ❌ Backlog |
| REQ-027 | Kommunikation  | Template mit Platzhalter "Betrag"    | ✅ Done    |
| REQ-028 | Kommunikation  | Automations: Beitrags-/Mahnungsmails | ❌ Backlog |
| REQ-033 | Sponsoren      | Verknüpfung mit Rechnungen           | ❌ Backlog |
| REQ-050 | Reporting      | Dashboard KPIs: Offene Beiträge      | ❌ Backlog |
| REQ-051 | Reporting      | Finanzexport (CSV/Excel)             | ❌ Backlog |
| REQ-052 | Reporting      | Suche/Filter in Rechnungen           | ❌ Backlog |
| REQ-058 | Betrieb        | Webhook: "Zahlung eingegangen"       | ❌ Backlog |
| REQ-059 | Betrieb        | Systemeinstellungen: Beitragssätze   | ✅ Done    |

### Vorgeschlagen (nicht formalisiert)

| ID      | Beschreibung                                  |
| ------- | --------------------------------------------- |
| —       | (keine offenen Vorschlaege)                   |

---

## 3. Umgesetzte Features (Backend)

### 3.1 Domain-Entities (vollständig implementiert)

| Entity             | Datei                              | REQ     | Beschreibung                                                                                   |
| ------------------ | ---------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| **Account**        | `Domain/Finance/Account.cs`        | REQ-038 | Finanzkonten (Cash/Bank/Other), CRUD + Activate/Deactivate                                     |
| **Category**       | `Domain/Finance/Category.cs`       | REQ-038 | Buchungskategorien mit Farbcode, CRUD + Activate/Deactivate                                    |
| **Transaction**    | `Domain/Finance/Transaction.cs`    | REQ-038 | Buchungen (Einnahmen/Ausgaben), Beleg-Verknüpfung                                              |
| **Invoice**        | `Domain/Finance/Invoice.cs`        | REQ-039 | Rechnungen mit Nummernkreis INV-YYYY-NNNN, Status-Workflow (Draft→Sent→Paid/Overdue/Cancelled) |
| **InvoiceItem**    | `Domain/Finance/InvoiceItem.cs`    | REQ-039 | Rechnungspositionen mit Menge × Einzelpreis                                                    |
| **Payment**        | `Domain/Finance/Payment.cs`        | REQ-040 | Zahlungen (Bar/Überweisung/Online), optional verknüpft mit Rechnung + Buchung                  |
| **BankImport**     | `Domain/Finance/BankImport.cs`     | REQ-041 | Import-Batch-Header mit Status                                                                 |
| **BankImportItem** | `Domain/Finance/BankImportItem.cs` | REQ-041 | Einzelne Import-Zeilen, Match/Ignore/Unmatch                                                   |
| **DunningNotice**  | `Domain/Finance/DunningNotice.cs`  | REQ-042 | Mahnungen Stufe 1-3, Draft→Sent Workflow                                                       |
| **Receipt**        | `Domain/Finance/Receipt.cs`        | REQ-043 | Belegerfassung (nur Metadaten, kein echter File-Upload!)                                       |
| **FinanceProfile** | `Domain/Finance/FinanceProfile.cs` | REQ-060 | CH/EU Jurisdiktion, Waehrung, Org-Details                                                      |
| **TaxCode**        | `Domain/Finance/TaxCode.cs`        | REQ-062 | Konfigurierbare Steuercodes (Name, Rate, Code), Per-Item-Tax                                   |
| **InvoiceTemplate**| `Domain/Finance/InvoiceTemplate.cs`| REQ-064 | EU-Pflichtfelder (VAT-ID, Steuerbefreiung, Reverse Charge, Zahlungsbedingungen), ISoftDeletable |
| **InvoiceNumberCounter** | `Domain/Finance/InvoiceNumberCounter.cs` | REQ-071 | Atomarer Zähler pro Profil/Geschäftsjahr, PostgreSQL UPSERT                      |
| **FiscalPeriod**   | `Domain/Finance/FiscalPeriod.cs`   | REQ-066 | Geschaeftsperioden mit Status (Open/Closed/Locked), monatliche Perioden                        |
| **ExpenseClaim**   | `Domain/Finance/ExpenseClaim.cs`   | REQ-067 | Spesenabrechnung mit Lebenszyklus (Draft bis Reimbursed)                                       |
| **ActivityArea**   | `Domain/Finance/ActivityArea.cs`   | REQ-068 | Dimension-Tagging (Name, Code, Color, SortOrder), FK auf Transaction/InvoiceItem               |

### 3.2 Enums

| Enum                   | Werte                                 |
| ---------------------- | ------------------------------------- |
| `AccountType`          | Cash, Bank, Other                     |
| `TransactionType`      | Income, Expense                       |
| `InvoiceStatus`        | Draft, Sent, Paid, Overdue, Cancelled |
| `RecipientType`        | Member, Sponsor, Vendor, Other        |
| `PaymentMethod`        | Cash, Transfer, Online                |
| `BankImportStatus`     | Pending, Processed                    |
| `BankImportItemStatus` | Unmatched, Matched, Ignored           |
| `DunningStatus`        | Created, Sent                         |

### 3.3 Application Layer

- ~210 CQRS-Dateien: Commands, Queries, Handlers, Validators via MediatR
- FluentValidation fuer alle Create/Update-Commands
- Repository-Interfaces in Application/Finance/IFinanceRepositories.cs
- IFinanceDocumentStorage Interface fuer S3-basierte Beleg-Speicherung
- IInvoicePdfGenerator und IInvoicePdfGeneratorFactory fuer PDF-Generierung
- IEInvoiceExporter Strategy-Interface mit UblInvoiceExporter (EN 16931/UBL 2.1)
- IFiscalPeriodService fuer Periodensperren in 10 Command-Handlers
- CamtParser fuer camt.053/054, BankImportMatcher mit 5-stufiger Strategie
- Business-Logik aus Endpoints in Handler extrahiert (Clean Architecture)

### 3.4 API-Endpunkte (implementiert)

| Bereich      | Route-Prefix                   | Endpunkte                                                                     | Auth       |
| ------------ | ------------------------------ | ----------------------------------------------------------------------------- | ---------- |
| Accounts     | `/api/v1/finance/accounts`     | GET, POST, PUT, DELETE, POST /{id}/activate, POST /{id}/deactivate           | Read/Write |
| Categories   | `/api/v1/finance/categories`   | GET, POST, PUT, DELETE, POST /{id}/activate, POST /{id}/deactivate           | Read/Write |
| Transactions | `/api/v1/finance/transactions` | GET, GET /summary, GET /{id}, POST, PUT, DELETE                               | Read/Write |
| Invoices     | `/api/v1/finance/invoices`     | GET, GET /open, GET /{id}, POST, PUT, DELETE, POST /{id}/send, POST /{id}/mark-overdue, POST /{id}/archive, POST /{id}/restore, POST /{id}/validate-einvoice | Read/Write |
| Payments     | `/api/v1/finance/payments`     | GET, POST, PUT, DELETE                                                        | Read/Write |
| Bank Imports | `/api/v1/finance/bank-imports` | GET, POST, GET /{id}, PUT match, PUT ignore, PUT unmatch                      | Read/Write |
| Dunning      | `/api/v1/finance/dunning`      | GET, GET ?invoiceId=, POST, POST /{id}/send                                   | Read/Write |
| Receipts     | `/api/v1/finance/receipts`     | GET, POST, GET /{id}, DELETE, POST /{id}/archive, POST /{id}/restore          | Read/Write |
| Exports      | `/api/v1/finance/exports`      | GET /journal, GET /open-items, GET /vat-summary, POST /pain001, POST /pain001/validate | Read  |
| Admin        | `/api/v1/admin/finance`        | POST /purge-archived                                                          | Admin      |

**Autorisierung:** `RequireFinanceRead` (admin, kassier, auditor) / `RequireFinanceWrite` (admin, kassier)

### 3.5 Infrastructure (DB)

- Alle Tabellen in **snake_case** (PostgreSQL-Konvention)
- Enums als **String** gespeichert
- Geld-Felder: `precision(18,2)`, Mengen: `precision(18,4)`
- Unique-Index auf `accounts.number` und `invoices.invoice_number`
- Cascade-Delete für InvoiceItems und BankImportItems
- Soft-Delete implementiert auf allen Finance-Entities (IsDeleted, DeletedAt, DeletedBy)
- Invoice-Storno mit eigener Cancel/Storno-Logik

---

## 4. Umgesetzte Features (Frontend)

### 4.1 Seiten/Routen

| Route                    | Funktionalität                                                                                             | REQ     |
| ------------------------ | ---------------------------------------------------------------------------------------------------------- | ------- |
| `/finance`               | Dashboard mit KPI-Karten (Einnahmen, Ausgaben, Saldo), offene Rechnungen, letzte 10 Buchungen, Quick-Links | REQ-038 |
| `/finance/transactions`  | Buchungen CRUD mit 5 Filtern (Datum, Typ, Konto, Kategorie), Modal                                         | REQ-038 |
| `/finance/invoices`      | Rechnungsliste mit Status- und Datumsfilter, Senden/Stornieren                                             | REQ-039 |
| `/finance/invoices/new`  | Rechnung erstellen: Multi-Positionen, Empfänger-Auswahl, Steuerberechnung                                  | REQ-039 |
| `/finance/invoices/[id]` | Rechnungsdetail: Header, Positionen, Aktionen, Zahlungshistorie                                            | REQ-039 |
| `/finance/payments`      | Zwei Tabs: Offene Posten + Alle Zahlungen, Zahlungs-Modal                                                  | REQ-040 |
| `/finance/accounts`      | Konten CRUD mit Modal                                                                                      | REQ-038 |
| `/finance/categories`    | Kategorien CRUD mit Farbwähler                                                                             | REQ-038 |
| `/finance/bank-import`   | CSV-Upload, Import-Historie, Match/Ignore pro Zeile                                                        | REQ-041 |
| `/finance/dunning`       | Mahnungen: Liste, Erstellen (Auto-Stufe), Versenden                                                        | REQ-042 |
| `/finance/receipts`      | Belege: Karten-Grid, Upload, Download, Löschen                                                             | REQ-043 |
| `/finance/exports`       | Journal-CSV + Offene-Posten-CSV Export                                                                     | REQ-045 |

### 4.2 Navigation

- **Sidebar:** Finance-Menügruppe mit 8 Untereinträgen (Dashboard, Buchungen, Rechnungen, Zahlungen, Bankimport, Mahnungen, Belege, Exporte)
- **Rollen-Schutz:** Nur sichtbar für `KASSIER`, `AUDITOR`, `ADMIN`
- **i18n:** ~130 Keys in DE und EN vorhanden

---

## 5. Offene Punkte & Lücken

### 5.1 Erledigte TODOs

| Ort            | Loesung                                                      | Status   |
| -------------- | ------------------------------------------------------------ | -------- |
| Receipt-Upload | S3/RustFS Storage mit SHA256-Integrity, File-Type-Validation | Erledigt |
| Invoice-PDF    | QuestPDF-basierte PDF-Generierung                            | Erledigt |
| QR-Bill        | Swiss QR-Zahlteil via Codecrete.SwissQRBill                  | Erledigt |
| Soft-Delete    | Alle Entities mit IsDeleted/DeletedAt/DeletedBy              | Erledigt |
| CQRS/MediatR   | ~210 Dateien refactored                                      | Erledigt |
| Tests          | 420+ Finance-Unit-Tests                                      | Erledigt |
| EU-Compliance  | InvoiceTemplate, EU-Validierung, QuestPDF EU-Abschnitte      | Erledigt |
| eInvoice       | UBL 2.1 Export (EN 16931), Feature-flagged                   | Erledigt |
| FiscalPeriods  | Geschaeftsperioden mit Sperren, 10 Handler integriert        | Erledigt |
| ExpenseClaims  | Spesenabrechnung mit Approval-Workflow                       | Erledigt |
| ActivityAreas  | Dimension-Tagging mit P&L-Report                             | Erledigt |
| camt Import    | ISO 20022 Parser + 5-stufiges Referenz-Matching              | Erledigt |

### 5.2 Fehlende API-Endpunkte — ERLEDIGT (Sprint 5)

Alle zuvor fehlenden Endpunkte wurden implementiert:

| Feature                           | Domain-Methode vorhanden                         | API-Endpunkt                       | Status   |
| --------------------------------- | ------------------------------------------------ | ---------------------------------- | -------- |
| Rechnung als überfällig markieren | `Invoice.MarkAsOverdue()`                        | POST `/{id}/mark-overdue`          | Erledigt |
| Konto aktivieren/deaktivieren     | `Account.Activate/Deactivate()`                  | POST `/{id}/activate/deactivate`   | Erledigt |
| Kategorie aktivieren/deaktivieren | `Category.Activate/Deactivate()`                 | POST `/{id}/activate/deactivate`   | Erledigt |
| Bank-Import-Eintrag unmatch       | `BankImportItem.Unmatch()`                       | PUT `/{id}/items/{itemId}/unmatch` | Erledigt |
| Mahnung nach Rechnung abrufen     | `IDunningNoticeRepository.GetByInvoiceIdAsync()` | GET `/dunning?invoiceId=`          | Erledigt |

### 5.3 Verbleibende offene Features

| Feature                        | Beschreibung                                           | Prioritaet |
| ------------------------------ | ------------------------------------------------------ | ---------- |
| Mahnungs-Email                 | MarkAsSent aendert nur Status, kein E-Mail-Versand     | Mittel     |
| Rechnungs-Bearbeitung          | Keine Edit-Seite fuer bestehende Rechnungen            | Mittel     |
| Seed-Daten                     | Keine Finance-Testdaten fuer Entwicklung               | Niedrig    |
| Server-seitiges CSV-Parsing    | Bankimport erwartet Client-parsed Daten                | Niedrig    |
| Budget/Kostenstellen (REQ-044) | Noch nicht umgesetzt                                   | Backlog    |
| Integration-Tests              | End-to-End-Verifikation fuer neue Features             | Mittel     |

### 5.4 Dokumentations-Abweichungen

| Doku (04_data_model.md / 02_architecture.md) | Code (tatsächlich implementiert)                       |
| -------------------------------------------- | ------------------------------------------------------ |
| `LedgerEntry`                                | → `Transaction`                                        |
| `CostCenter`                                 | → Nicht implementiert (nur `cost_center`-Feld geplant) |
| 3 Entities (Invoice, Payment, LedgerEntry)   | 10 Entities implementiert                              |

---

## 6. Architektur- & Code-Qualitätsprobleme

### 6.1 Backend

| Problem                                 | Beschreibung                                                             | Schwere |
| --------------------------------------- | ------------------------------------------------------------------------ | ------- |
| Race Condition                          | Invoice-Nummern-Generierung ohne DB-Level-Locking                        | Erledigt: InvoiceNumberCounter mit PostgreSQL UPSERT (REQ-071) |
| Payment-Update-Problem                  | Aendern/Loeschen einer Zahlung revidiert MarkAsPaid nicht                | Mittel  |
| Mahnung ohne Pruefung                   | DunningNotice.Create prueft nicht, ob Rechnung wirklich ueberfaellig ist | Mittel  |
| BankImport-Match/Ignore nicht auditiert | Audit-Log fehlt fuer diese Aktionen                                      | Erledigt: Audit-Logging implementiert |

Erledigt:

- CQRS/MediatR: 126 Dateien, Clean Architecture
- FluentValidation: Input-Validierung fuer alle Commands
- Soft-Delete: Alle Entities
- Double-Save behoben

### 6.2 Frontend

| Problem                            | Beschreibung                                                          | Schwere |
| ---------------------------------- | --------------------------------------------------------------------- | ------- |
| **Keine shared Types**             | TypeScript-Interfaces in jeder Page-Datei dupliziert                  | 🟡      |
| **Kein Finance-API-Service**       | Alle API-Calls inline in Komponenten                                  | 🟡      |
| **Keine reusable Components**      | `formatCHF()`, Status-Badges, Modals, Error-Banner überall dupliziert | 🟡      |
| **Hardcoded Strings**              | Payments- und BankImport-Seite teilweise nicht i18n-konform           | 🟡      |
| **Inkonsistenter Cancel-Endpunkt** | Liste nutzt DELETE, Detail nutzt POST /cancel                         | 🔴      |
| **CHF hardcoded**                  | Währung fest auf CHF eingestellt, nicht konfigurierbar                | 🟡      |
| **Dead Code**                      | `formatCurrency` in accounts/page.tsx deklariert aber ungenutzt       | 🟢      |

---

## 7. UX-Probleme im Frontend

| Problem                          | Beschreibung                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| Keine Breadcrumbs                | Auf den meisten Finance-Seiten fehlt die Breadcrumb-Navigation                     |
| Keine Erfolgsmeldungen           | Nach CRUD-Aktionen keine Toast-Benachrichtigungen (Keys existieren aber ungenutzt) |
| Delete ohne Undo                 | Alle Löschvorgänge sind destruktiv ohne Rückgängig-Option                          |
| Payment-Delete ohne Bestätigung  | "Delete"-Button löscht direkt ohne Bestätigungsdialog                              |
| BankImport-Match: nur Payment-ID | Rohes Textfeld statt durchsuchbarem Dropdown                                       |
| Dashboard: 6 von 8 Quick-Links   | Mahnungen, Belege, Exporte fehlen im Quick-Link-Grid                               |
| Keine Pagination                 | Alle Listen laden alle Daten ohne Pagination                                       |
| Kein Skeleton Loading            | Nur Spinner, keine Skeleton-UI                                                     |
| Keine mobile Optimierung         | Tabellen nur mit overflow-x, kein responsives Card-Layout                          |
| Stornieren-Button-Label falsch   | Nutzt Status-Label `cancelled` statt Aktion `cancel`                               |

---

## 8. Empfohlene nächste Ziele

### Phase 1: Qualitaet und Stabilitaet (Prioritaet: HOCH) -- ERLEDIGT

| #   | Ziel                          | Status                                               |
| --- | ----------------------------- | ---------------------------------------------------- |
| 1   | Tests schreiben               | Erledigt: 210 Finance-Unit-Tests                     |
| 2   | Input-Validierung hinzufuegen | Erledigt: FluentValidation fuer alle Commands        |
| 3   | Beleg-Upload implementieren   | Erledigt: S3/RustFS mit SHA256, File-Type-Validation |
| 4   | Rechnungs-PDF-Generierung     | Erledigt: QuestPDF, erweiterbare Templates           |
| 5   | Soft-Delete implementieren    | Erledigt: Alle Finance-Entities                      |

### Phase 2: Vollstaendigkeit (Prioritaet: MITTEL)

| #   | Ziel                                        | Status                                       |
| --- | ------------------------------------------- | -------------------------------------------- |
| 6   | Fehlende API-Endpunkte nachruesten          | Erledigt: MarkOverdue, Activate/Deactivate, Unmatch, DunningNotice Filter |
| 7   | Application Layer aufbauen                  | Erledigt: 126 CQRS-Dateien                   |
| 8   | Mahnungs-Email-Versand                      | Offen                                        |
| 9   | Scheduled Job fuer ueberfaellige Rechnungen | Erledigt: Hangfire MarkInvoicesOverdueJob (daily) |
| 10  | Paginierung                                 | Erledigt: PagedResult<T> auf allen 13 Listen-Endpunkten |
| 11  | Rechnungs-Bearbeitungsseite                 | Offen                                        |

### Phase 3: Frontend-Refactoring (Prioritaet: MITTEL)

| #   | Ziel                             | Status |
| --- | -------------------------------- | ------ |
| 12  | Shared Finance-Types extrahieren | Offen  |
| 13  | Finance-API-Service erstellen    | Offen  |
| 14  | Reusable Components              | Offen  |
| 15  | i18n vervollstaendigen           | Offen  |
| 16  | Breadcrumbs und Success-Toasts   | Offen  |

### Phase 4: Erweiterte Features (Prioritaet: NIEDRIG)

| #   | Ziel                          | Status                                             |
| --- | ----------------------------- | -------------------------------------------------- |
| 17  | REQ-044: Budget/Kostenstellen | Backlog                                            |
| 18  | REQ-061: Receipt-Storage      | Erledigt (S3 implementiert, Unit-Tests vorhanden)  |
| 19  | Finanz-Reporting Dashboard    | Offen                                              |
| 20  | Server-seitiges CSV-Parsing   | Offen                                              |
| 21  | Cross-Modul-Integration       | Offen                                              |
| 22  | Dokumentation aktualisieren   | Erledigt                                           |

---

## 9. Datenmodell-Übersicht

```
┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
│     Account      │     │    Category      │     │     Receipt      │
│──────────────────│     │──────────────────│     │──────────────────│
│ Id (Guid)        │     │ Id (Guid)        │     │ Id (Guid)        │
│ Name             │     │ Name             │     │ FileName         │
│ Number (unique)  │     │ Type (Inc/Exp)   │     │ FilePath         │
│ Type (4 types)   │     │ Color            │     │ ContentType      │
│ Description?     │     │ IsActive         │     │ FileSize         │
│ IsActive         │     │ CreatedAt/By     │     │ UploadedAt/By    │
│ SortOrder        │     └──────────────────┘     │ Notes?           │
│ CreatedAt/By     │              │                └────────┬─────────┘
│ UpdatedAt/By?    │              │                         │
└────────┬─────────┘              │                         │
         │                        │ FK (optional)           │ FK (optional)
         │ FK (required)          ▼                         ▼
         ▼               ┌──────────────────────────────────────────┐
┌────────────────────────│           Transaction                    │
│                        │──────────────────────────────────────────│
│                        │ Id, Date, Description, Amount (>0)       │
│                        │ Type (Income/Expense)                    │
│                        │ AccountId (FK), CategoryId? (FK)         │
│                        │ ReceiptId? (FK), Reference?, Notes?      │
│                        │ CreatedAt/By, UpdatedAt/By?              │
│                        └──────────────────────────────────────────┘
│
│  ┌──────────────────────────────────┐     ┌──────────────────────┐
│  │           Invoice                │────▶│    InvoiceItem       │
│  │──────────────────────────────────│ 1:N │──────────────────────│
│  │ Id, InvoiceNumber (INV-YYYY-NNNN)│     │ Id, InvoiceId (FK)   │
│  │ Date, DueDate, Status            │     │ Description          │
│  │ RecipientType, RecipientId?      │     │ Quantity, UnitPrice  │
│  │ RecipientName, RecipientAddress?  │     │ Amount (calculated)  │
│  │ SubTotal, TaxRate, TaxAmount     │     └──────────────────────┘
│  │ Total, Notes?                    │
│  │ CreatedAt/By, UpdatedAt/By?      │
│  └──────────┬───────────────────────┘
│             │
│     ┌───────┴───────────────────┐
│     │                           │
│     ▼                           ▼
│  ┌──────────────────┐   ┌──────────────────┐
│  │    Payment        │   │  DunningNotice   │
│  │──────────────────│   │──────────────────│
│  │ Id, Date, Amount  │   │ Id, InvoiceId    │
│  │ Method (3 types)  │   │ Level (1-3)      │
│  │ Reference?        │   │ Date, DueDate    │
│  │ InvoiceId? (FK)   │   │ Status (2 types) │
│  │ TransactionId?(FK)│   │ SentAt?, Notes?  │
│  │ Notes?            │   │ CreatedBy        │
│  │ CreatedAt/By      │   └──────────────────┘
│  │ UpdatedAt/By?     │
│  └──────────────────┘
│
│  ┌──────────────────────────────────┐     ┌──────────────────────┐
│  │         BankImport               │────▶│   BankImportItem     │
│  │──────────────────────────────────│ 1:N │──────────────────────│
│  │ Id, ImportDate, FileName          │     │ Id, BankImportId     │
│  │ Status (Pending/Processed)        │     │ TransactionDate      │
│  │ ImportedBy                        │     │ Description, Amount  │
│  └──────────────────────────────────┘     │ Iban?, Reference?    │
│                                           │ Status (3 types)     │
│                                           │ MatchedPaymentId?    │
│                                           └──────────────────────┘
```

---

## 10. API-Endpunkt-Übersicht

### Accounts (`/api/v1/finance/accounts`)

| Method | Route   | Beschreibung        |
| ------ | ------- | ------------------- |
| GET    | `/`     | Alle Konten laden   |
| POST   | `/`     | Konto erstellen     |
| PUT    | `/{id}` | Konto aktualisieren |
| DELETE | `/{id}` | Konto löschen       |

### Categories (`/api/v1/finance/categories`)

| Method | Route   | Beschreibung            |
| ------ | ------- | ----------------------- |
| GET    | `/`     | Alle Kategorien laden   |
| POST   | `/`     | Kategorie erstellen     |
| PUT    | `/{id}` | Kategorie aktualisieren |
| DELETE | `/{id}` | Kategorie löschen       |

### Transactions (`/api/v1/finance/transactions`)

| Method | Route      | Beschreibung                       |
| ------ | ---------- | ---------------------------------- |
| GET    | `/`        | Buchungen (Filter: from, to, type) |
| GET    | `/summary` | Einnahmen/Ausgaben/Saldo           |
| GET    | `/{id}`    | Einzelne Buchung                   |
| POST   | `/`        | Buchung erstellen                  |
| PUT    | `/{id}`    | Buchung aktualisieren              |
| DELETE | `/{id}`    | Buchung löschen                    |

### Invoices (`/api/v1/finance/invoices`)

| Method | Route        | Beschreibung                    |
| ------ | ------------ | ------------------------------- |
| GET    | `/`          | Rechnungen (Filter: status)     |
| GET    | `/open`      | Offene Rechnungen               |
| GET    | `/{id}`      | Rechnungsdetail                 |
| POST   | `/`          | Rechnung erstellen              |
| PUT    | `/{id}`      | Rechnung aktualisieren          |
| DELETE | `/{id}`      | Rechnung löschen                |
| POST   | `/{id}/send` | Rechnung versenden (Draft→Sent) |

### Payments (`/api/v1/finance/payments`)

| Method | Route   | Beschreibung                                       |
| ------ | ------- | -------------------------------------------------- |
| GET    | `/`     | Alle Zahlungen                                     |
| POST   | `/`     | Zahlung erfassen (Auto-MarkAsPaid bei Vollzahlung) |
| PUT    | `/{id}` | Zahlung aktualisieren                              |
| DELETE | `/{id}` | Zahlung löschen                                    |

### Bank Imports (`/api/v1/finance/bank-imports`)

| Method | Route                         | Beschreibung             |
| ------ | ----------------------------- | ------------------------ |
| GET    | `/`                           | Import-Historie          |
| POST   | `/`                           | CSV-Import hochladen     |
| GET    | `/{id}`                       | Import-Detail mit Zeilen |
| PUT    | `/{id}/items/{itemId}/match`  | Zeile matchen            |
| PUT    | `/{id}/items/{itemId}/ignore` | Zeile ignorieren         |
| PUT    | `/{id}/items/{itemId}/unmatch`| Zeile unmatch            |

### Dunning (`/api/v1/finance/dunning`)

| Method | Route        | Beschreibung      |
| ------ | ------------ | ----------------- |
| GET    | `/`          | Alle Mahnungen (Filter: invoiceId) |
| POST   | `/`          | Mahnung erstellen |
| POST   | `/{id}/send` | Mahnung versenden |

### Receipts (`/api/v1/finance/receipts`)

| Method | Route   | Beschreibung                     |
| ------ | ------- | -------------------------------- |
| GET    | `/`     | Alle Belege                      |
| POST   | `/`     | Beleg hochladen (nur Metadaten!) |
| GET    | `/{id}` | Beleg-Detail                     |
| DELETE | `/{id}` | Beleg löschen                    |
| POST   | `/{id}/archive` | Beleg archivieren         |
| POST   | `/{id}/restore` | Beleg wiederherstellen    |

### Exports (`/api/v1/finance/exports`)

| Method | Route         | Beschreibung                           |
| ------ | ------------- | -------------------------------------- |
| GET    | `/journal`    | Buchungsjournal-CSV (Filter: from, to) |
| GET    | `/open-items` | Offene-Posten-Liste CSV                |
| GET    | `/vat-summary`| MwSt-Zusammenfassung-CSV               |
| POST   | `/pain001`    | pain.001 Zahlungsdatei Export          |
| POST   | `/pain001/validate` | pain.001 Validierung             |

### Admin (`/api/v1/admin/finance`)

| Method | Route             | Beschreibung                              |
| ------ | ----------------- | ----------------------------------------- |
| POST   | `/purge-archived` | Archivierte Daten nach RetainUntil löschen |

### Pagination

Alle GET Listen-Endpunkte (13 Endpunkte) unterstützen Pagination:
- Query-Parameter: `?page=1&pageSize=20&sort=date:desc&filter=status:Sent`
- Response: `PagedResult<T>` mit `items`, `page`, `pageSize`, `totalCount`, `totalPages`

---

## 11. Archivierung und Retention (REQ-070)

- **IArchivable Interface** auf Receipt, Invoice, Transaction
- Felder: `IsArchived`, `ArchivedAt`, `ArchivedBy`, `ArchiveReason`, `RetainUntil`
- Archive/Restore Endpoints: `POST /{id}/archive`, `POST /{id}/restore`
- Admin Purge: `POST /admin/finance/purge-archived` (nur nach RetainUntil)
- 10-Jahre Retention Policy
- Archivierte Entities sind read-only (Mutation wird abgelehnt)
- Admin kann Restore durchführen
- Alle Archive/Restore/Purge Aktionen werden auditiert

## 12. Invoice Number Counter (REQ-071)

- **InvoiceNumberCounter Entity** mit PostgreSQL atomic UPSERT
- Per-FinanceProfile, Per-Fiscal-Year Zähler
- Felder: `FinanceProfileId`, `FiscalYear`, `Prefix`, `CurrentValue`, `UpdatedAt`
- Konkurenzsichere Nummernvergabe (kein Race Condition mehr)
- Rechnungsnummer ist immutable nach Send (Status >= Sent)

## 13. eInvoice Validierung (REQ-072)

- **En16931Validator** mit Business Rules BR-01..BR-AE-01
- Prüft Pflichtfelder, VAT-Breakdown, MonetaryTotals
- **ICiusProfile** Extension Point für profilspezifische CIUS-Validierung
- Endpoint: `POST /invoices/{id}/validate-einvoice`
- Strukturierte ValidationErrors (Feld, Regel, Message)

## 14. pain.001 Export (REQ-073)

- **Pain001Generator** mit Profil-Unterstützung:
  - CH SPS (Swiss Payment Standards)
  - SEPA (EU)
- Format: pain.001.001.09
- Endpoints:
  - `POST /exports/pain001` — Export generieren
  - `POST /exports/pain001/validate` — Validierung vor Export
- Remittance Information (InvoiceNumber/Reference) wird befüllt
- IBAN/BIC Validierung

## 15. Background Jobs (Hangfire)

- **MarkInvoicesOverdueJob**: Täglich, markiert überfällige Rechnungen (DueDate < heute, Status = Sent). Idempotent, AutoRetry(3).
- **DunningScheduleGenerationJob**: Wöchentlich, generiert Mahnungen für überfällige Rechnungen. Idempotent, AutoRetry(3).

---

> Fazit: Das Finanzmodul ist funktional breit aufgestellt. Alle 10 erweiterten Finanz-Requirements (REQ-060 bis REQ-069) und 4 Sprint-5-Requirements (REQ-070 bis REQ-073) sind Done. 420+ Unit-Tests, FluentValidation, Soft-Delete auf allen Entities, IArchivable auf Receipt/Invoice/Transaction, CQRS/MediatR mit ~210 Dateien, 17 Domain-Entities. Alle Listen-Endpunkte paginiert (PagedResult<T>). Hangfire Background Jobs (MarkInvoicesOverdueJob, DunningScheduleGenerationJob). Naechste Schritte: Mahnungs-E-Mail-Versand, Integration-Tests, Budget/Kostenstellen (REQ-044).
