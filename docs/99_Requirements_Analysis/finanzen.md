# Finanzen-Modul — Detaillierte Übersicht

> Stand: 15.02.2026 | Autor: Requirements-Engineering-Analyse
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

Das Finanzmodul ist das umfangreichste Feature des Projekts. 7 von 8 Kern-Finanz-Requirements sind Done (REQ-038 bis REQ-043, REQ-045), 4 weitere sind InProgress (REQ-060 bis REQ-063). Es umfasst:

- 12 Domain-Entities (Account, Category, Transaction, Invoice, InvoiceItem, Payment, BankImport, BankImportItem, DunningNotice, Receipt, FinanceProfile, TaxCode)
- 126 CQRS-Dateien (Commands, Queries, Handlers, Validators via MediatR + FluentValidation)
- API-Endpunkte fuer alle Finance-Bereiche
- 12 Frontend-Seiten unter /finance
- ~130 i18n-Keys in DE und EN
- 210 Finance-Unit-Tests
- Soft-Delete/Storno auf allen Entities implementiert
- Receipt-File-Storage via S3/RustFS mit SHA256-Integrity
- Invoice-PDF via QuestPDF, Swiss QR-Zahlteil via Codecrete.SwissQRBill
- FinanceProfile (CH/EU Jurisdiktion, Waehrung, Org-Details)
- VAT/MWST (konfigurierbare TaxCodes, Per-Item-Tax, VAT-Export)

### Bewertung

| Bereich           | Status                                                   |
| ----------------- | -------------------------------------------------------- |
| Domain-Modell     | Solide, gut strukturiert, Soft-Delete auf allen Entities |
| Application Layer | CQRS/MediatR vollstaendig refactored, FluentValidation   |
| API-Endpunkte     | Funktional, CQRS-basiert                                 |
| Frontend-Seiten   | Alle vorhanden                                           |
| Tests             | 210 Finance-Unit-Tests                                   |
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
| REQ-061 | Finanzen: Eigener Bucket für Bilder/Dokumente |

---

## 3. Umgesetzte Features (Backend)

### 3.1 Domain-Entities (vollständig implementiert)

| Entity             | Datei                              | REQ     | Beschreibung                                                                                   |
| ------------------ | ---------------------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| **Account**        | `Domain/Finance/Account.cs`        | REQ-038 | Finanzkonten (Income/Expense/Asset/Liability), CRUD + Activate/Deactivate                      |
| **Category**       | `Domain/Finance/Category.cs`       | REQ-038 | Buchungskategorien mit Farbcode, CRUD + Activate/Deactivate                                    |
| **Transaction**    | `Domain/Finance/Transaction.cs`    | REQ-038 | Buchungen (Einnahmen/Ausgaben), Beleg-Verknüpfung                                              |
| **Invoice**        | `Domain/Finance/Invoice.cs`        | REQ-039 | Rechnungen mit Nummernkreis INV-YYYY-NNNN, Status-Workflow (Draft→Sent→Paid/Overdue/Cancelled) |
| **InvoiceItem**    | `Domain/Finance/InvoiceItem.cs`    | REQ-039 | Rechnungspositionen mit Menge × Einzelpreis                                                    |
| **Payment**        | `Domain/Finance/Payment.cs`        | REQ-040 | Zahlungen (Bar/Überweisung/Online), optional verknüpft mit Rechnung + Buchung                  |
| **BankImport**     | `Domain/Finance/BankImport.cs`     | REQ-041 | Import-Batch-Header mit Status                                                                 |
| **BankImportItem** | `Domain/Finance/BankImportItem.cs` | REQ-041 | Einzelne Import-Zeilen, Match/Ignore/Unmatch                                                   |
| **DunningNotice**  | `Domain/Finance/DunningNotice.cs`  | REQ-042 | Mahnungen Stufe 1-3, Draft→Sent Workflow                                                       |
| **Receipt**        | `Domain/Finance/Receipt.cs`        | REQ-043 | Belegerfassung (nur Metadaten, kein echter File-Upload!)                                       |

### 3.2 Enums

| Enum                   | Werte                                 |
| ---------------------- | ------------------------------------- |
| `AccountType`          | Income, Expense, Asset, Liability     |
| `TransactionType`      | Income, Expense                       |
| `InvoiceStatus`        | Draft, Sent, Paid, Overdue, Cancelled |
| `RecipientType`        | Member, Sponsor, Vendor, Other        |
| `PaymentMethod`        | Cash, Transfer, Online                |
| `BankImportStatus`     | Pending, Processed                    |
| `BankImportItemStatus` | Unmatched, Matched, Ignored           |
| `DunningStatus`        | Created, Sent                         |

### 3.3 Application Layer

- 126 CQRS-Dateien: Commands, Queries, Handlers, Validators via MediatR
- FluentValidation fuer alle Create/Update-Commands
- Repository-Interfaces in Application/Finance/IFinanceRepositories.cs
- IFinanceDocumentStorage Interface fuer S3-basierte Beleg-Speicherung
- IInvoicePdfGenerator und IInvoicePdfGeneratorFactory fuer PDF-Generierung
- Business-Logik aus Endpoints in Handler extrahiert (Clean Architecture)

### 3.4 API-Endpunkte (implementiert)

| Bereich      | Route-Prefix                   | Endpunkte                                                     | Auth       |
| ------------ | ------------------------------ | ------------------------------------------------------------- | ---------- |
| Accounts     | `/api/v1/finance/accounts`     | GET, POST, PUT, DELETE                                        | Read/Write |
| Categories   | `/api/v1/finance/categories`   | GET, POST, PUT, DELETE                                        | Read/Write |
| Transactions | `/api/v1/finance/transactions` | GET, GET /summary, GET /{id}, POST, PUT, DELETE               | Read/Write |
| Invoices     | `/api/v1/finance/invoices`     | GET, GET /open, GET /{id}, POST, PUT, DELETE, POST /{id}/send | Read/Write |
| Payments     | `/api/v1/finance/payments`     | GET, POST, PUT, DELETE                                        | Read/Write |
| Bank Imports | `/api/v1/finance/bank-imports` | GET, POST, GET /{id}, PUT match, PUT ignore                   | Read/Write |
| Dunning      | `/api/v1/finance/dunning`      | GET, POST, POST /{id}/send                                    | Read/Write |
| Receipts     | `/api/v1/finance/receipts`     | GET, POST, GET /{id}, DELETE                                  | Read/Write |
| Exports      | `/api/v1/finance/exports`      | GET /journal, GET /open-items                                 | Read       |

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
| CQRS/MediatR   | 126 Dateien refactored                                       | Erledigt |
| Tests          | 210 Finance-Unit-Tests                                       | Erledigt |

### 5.2 Fehlende API-Endpunkte (Domain-Methoden existieren, aber kein Endpunkt)

| Feature                           | Domain-Methode vorhanden                         | API-Endpunkt                     |
| --------------------------------- | ------------------------------------------------ | -------------------------------- |
| Rechnung als bezahlt markieren    | `Invoice.MarkAsPaid()`                           | ❌ Nur indirekt via Zahlung      |
| Rechnung als überfällig markieren | `Invoice.MarkAsOverdue()`                        | ❌ Fehlt (braucht Scheduled Job) |
| Rechnung stornieren               | `Invoice.Cancel()`                               | ❌ Fehlt (DELETE ≠ Cancel)       |
| Konto aktivieren/deaktivieren     | `Account.Activate/Deactivate()`                  | ❌                               |
| Kategorie aktivieren/deaktivieren | `Category.Activate/Deactivate()`                 | ❌                               |
| Beleg an Buchung anhängen         | `Transaction.AttachReceipt()`                    | ❌                               |
| Beleg von Buchung lösen           | `Transaction.DetachReceipt()`                    | ❌                               |
| Bank-Import-Eintrag unmatch       | `BankImportItem.Unmatch()`                       | ❌                               |
| Mahnung nach Rechnung abrufen     | `IDunningNoticeRepository.GetByInvoiceIdAsync()` | ❌                               |
| Konto nach Nummer suchen          | `IAccountRepository.GetByNumberAsync()`          | ❌                               |

### 5.3 Verbleibende offene Features

| Feature                        | Beschreibung                                           | Prioritaet |
| ------------------------------ | ------------------------------------------------------ | ---------- |
| Mahnungs-Email                 | MarkAsSent aendert nur Status, kein E-Mail-Versand     | Mittel     |
| Paginierung                    | Keine Paginierung auf allen Listen-Endpunkten          | Mittel     |
| Volltextsuche                  | Keine Suchfunktion auf Listen                          | Mittel     |
| Rechnungs-Bearbeitung          | Keine Edit-Seite fuer bestehende Rechnungen            | Mittel     |
| Seed-Daten                     | Keine Finance-Testdaten fuer Entwicklung               | Niedrig    |
| Scheduled Job: Ueberfaellig    | Kein automatisches Markieren ueberfaelliger Rechnungen | Mittel     |
| Server-seitiges CSV-Parsing    | Bankimport erwartet Client-parsed Daten                | Niedrig    |
| Budget/Kostenstellen (REQ-044) | Noch nicht umgesetzt                                   | Backlog    |
| Integration-Tests              | REQ-060 bis REQ-063 benoetigen End-to-End-Verifikation | Hoch       |

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
| Race Condition                          | Invoice-Nummern-Generierung ohne DB-Level-Locking                        | Mittel  |
| Payment-Update-Problem                  | Aendern/Loeschen einer Zahlung revidiert MarkAsPaid nicht                | Mittel  |
| Mahnung ohne Pruefung                   | DunningNotice.Create prueft nicht, ob Rechnung wirklich ueberfaellig ist | Mittel  |
| BankImport-Match/Ignore nicht auditiert | Audit-Log fehlt fuer diese Aktionen                                      | Mittel  |

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
| 6   | Fehlende API-Endpunkte nachruesten          | Teilweise erledigt (Cancel/Storno vorhanden) |
| 7   | Application Layer aufbauen                  | Erledigt: 126 CQRS-Dateien                   |
| 8   | Mahnungs-Email-Versand                      | Offen                                        |
| 9   | Scheduled Job fuer ueberfaellige Rechnungen | Offen                                        |
| 10  | Paginierung                                 | Offen                                        |
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
| 18  | REQ-061: Receipt-Storage      | InProgress (S3 implementiert, E2E-Test ausstehend) |
| 19  | Finanz-Reporting Dashboard    | Offen                                              |
| 20  | Server-seitiges CSV-Parsing   | Offen                                              |
| 21  | Cross-Modul-Integration       | Offen                                              |
| 22  | Dokumentation aktualisieren   | Teilweise erledigt                                 |

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

### Dunning (`/api/v1/finance/dunning`)

| Method | Route        | Beschreibung      |
| ------ | ------------ | ----------------- |
| GET    | `/`          | Alle Mahnungen    |
| POST   | `/`          | Mahnung erstellen |
| POST   | `/{id}/send` | Mahnung versenden |

### Receipts (`/api/v1/finance/receipts`)

| Method | Route   | Beschreibung                     |
| ------ | ------- | -------------------------------- |
| GET    | `/`     | Alle Belege                      |
| POST   | `/`     | Beleg hochladen (nur Metadaten!) |
| GET    | `/{id}` | Beleg-Detail                     |
| DELETE | `/{id}` | Beleg löschen                    |

### Exports (`/api/v1/finance/exports`)

| Method | Route         | Beschreibung                           |
| ------ | ------------- | -------------------------------------- |
| GET    | `/journal`    | Buchungsjournal-CSV (Filter: from, to) |
| GET    | `/open-items` | Offene-Posten-Liste CSV                |

---

> Fazit: Das Finanzmodul ist funktional breit aufgestellt. Die frueheren Qualitaetsluecken (fehlende Tests, Validierung, Soft-Delete, kein CQRS) sind behoben. 210 Unit-Tests, FluentValidation, Soft-Delete auf allen Entities, CQRS/MediatR mit 126 Dateien. Naechste Schritte: Integration-Tests fuer REQ-060 bis REQ-063, Paginierung, Mahnungs-E-Mail-Versand.
