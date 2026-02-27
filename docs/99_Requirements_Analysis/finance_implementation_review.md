# Finance-Modul — Vollständige Implementierungsanalyse

> **Zweck:** Fachliche und technische Validierung durch einen Finanzexperten und einen Entwickler  
> **Stand:** 27.02.2026  
> **Scope:** Backend (Domain, Application, API, Infrastructure), Frontend (Pages, Types, Navigation), Tests  
> **Projekt:** IAB Connect — Vereinsverwaltung für einen indisch-asiatischen Kulturverein

---

## Inhaltsverzeichnis

1. [Projektkontext](#1-projektkontext)
2. [Fachliche Übersicht: Was macht das Finanzmodul?](#2-fachliche-übersicht-was-macht-das-finanzmodul)
3. [Requirements-Matrix](#3-requirements-matrix)
4. [Datenmodell im Detail](#4-datenmodell-im-detail)
5. [Fachliche Prozesse und Workflows](#5-fachliche-prozesse-und-workflows)
6. [Technische Architektur](#6-technische-architektur)
7. [API-Endpunkte vollständig](#7-api-endpunkte-vollständig)
8. [Frontend-Implementierung](#8-frontend-implementierung)
9. [Steuer-/MwSt-Logik im Detail](#9-steuer-mwst-logik-im-detail)
10. [Rechnungsstellung im Detail](#10-rechnungsstellung-im-detail)
11. [Zahlungsmanagement im Detail](#11-zahlungsmanagement-im-detail)
12. [Bankimport und Kontoabgleich](#12-bankimport-und-kontoabgleich)
13. [Mahnwesen](#13-mahnwesen)
14. [Belegmanagement](#14-belegmanagement)
15. [Spesenabrechnung (Expense Claims)](#15-spesenabrechnung-expense-claims)
16. [Geschäftsperioden (Fiscal Periods)](#16-geschäftsperioden-fiscal-periods)
17. [Aktivitätsbereiche (Activity Areas)](#17-aktivitätsbereiche-activity-areas)
18. [Exporte](#18-exporte)
19. [PDF-Generierung und Swiss QR-Rechnung](#19-pdf-generierung-und-swiss-qr-rechnung)
20. [eInvoice / Elektronische Rechnung (UBL 2.1)](#20-einvoice--elektronische-rechnung-ubl-21)
21. [Finance-Dashboard](#21-finance-dashboard)
22. [Sicherheit und Berechtigungen](#22-sicherheit-und-berechtigungen)
23. [Audit-Trail](#23-audit-trail)
24. [Bekannte Einschränkungen und offene Punkte](#24-bekannte-einschränkungen-und-offene-punkte)
25. [Bewertungs-Checkliste für Reviewer](#25-bewertungs-checkliste-für-reviewer)

---

## 1. Projektkontext

**IAB Connect** ist eine Vereinsverwaltungs-Webanwendung für den Indisch-Asiatischen Bildungsverein (IAB). Der Verein benötigt ein integriertes Finanzsystem, das folgende Kernprozesse abbildet:

- **Vereinsbuchhaltung** (Einnahmen/Ausgaben-Rechnung, keine doppelte Buchführung)
- **Rechnungsstellung** an Mitglieder, Sponsoren, Lieferanten
- **Zahlungserfassung** und Abgleich mit Rechnungen
- **Bankimport** von Kontobewegungen (CSV und ISO 20022 camt)
- **Mahnwesen** bei überfälligen Rechnungen
- **Belegverwaltung** mit Dateispeicherung
- **Steuerkonformität** für CH (Schweiz) und EU
- **Spesenabrechnungen** für Vereinsmitglieder
- **Reporting und Export** für Steuerberater/Wirtschaftsprüfer

**Zielgruppe:**
- **Kassier** (Finanzverantwortlicher des Vereins) — Hauptnutzer
- **Vorstand** — Genehmigungen, Übersicht
- **Admin** — Vollzugriff
- **Auditor** — Nur-Lese-Zugriff

**Technischer Stack:**
- Backend: .NET 10, ASP.NET Core Minimal API, PostgreSQL, MediatR (CQRS), FluentValidation
- Frontend: Next.js (React), TypeScript, Tailwind CSS
- Auth: Keycloak (OpenID Connect)
- Dateispeicherung: S3-kompatibel (RustFS/MinIO)
- PDF: QuestPDF + Codecrete.SwissQRBill
- eInvoice: UBL 2.1 / EN 16931

---

## 2. Fachliche Übersicht: Was macht das Finanzmodul?

Das Finanzmodul bildet eine **vereinfachte Einnahmen-Ausgaben-Rechnung** ab. Es handelt sich **nicht** um eine doppelte Buchführung (Soll/Haben), sondern um ein kategorisiertes Journal mit folgenden Kernfunktionen:

### 2.1 Kontenverwaltung (Kontenplan)
- Finanzkonten vom Typ **Kasse, Bank, Sonstige**
- Jedes Konto hat eine eindeutige Nummer, einen Namen und eine optionale Beschreibung
- Konten können aktiviert/deaktiviert werden (Soft-State)
- Sortierung über `SortOrder`-Feld

### 2.2 Kategorienverwaltung
- Buchungskategorien (z.B. "Mitgliedsbeiträge", "Raummiete", "Catering")
- Jede Kategorie ist einem Typ zugeordnet: **Einnahme** oder **Ausgabe**
- Farbcode für visuelle Darstellung im Frontend
- Aktivierung/Deaktivierung möglich

### 2.3 Buchungen (Transaktionen)
- Jede Buchung erfasst: Datum, Beschreibung, Betrag, Typ (Einnahme/Ausgabe)
- Zuordnung zu genau einem Konto (Pflicht) und optional einer Kategorie
- Optional: Referenznummer, Notizen, Beleg (Receipt), Aktivitätsbereich (ActivityArea)
- Optional: Steuercode (TaxCode) mit automatischer Brutto/Netto/MwSt-Berechnung
- Soft-Delete (Buchung wird als gelöscht markiert, nicht physisch entfernt)

### 2.4 Rechnungsstellung
- Rechnungen mit automatischer Nummernvergabe (Format: `INV-YYYY-NNNN`)
- Empfängertypen: Mitglied, Sponsor, Lieferant, Sonstige
- Mehrzeilige Rechnungspositionen (Line Items) mit Menge × Einzelpreis
- Optionale MwSt pro Position (Netto- oder Bruttoeingabe)
- Status-Workflow: `Entwurf → Versendet → Bezahlt / Überfällig / Storniert`
- PDF-Generierung mit QuestPDF
- Swiss QR-Zahlteil für CH-Jurisdiktion
- EU-Konformitätsfelder (VAT-ID, Steuerbefreiung, Reverse Charge)
- eInvoice-Export als UBL 2.1 XML (EN 16931)

### 2.5 Zahlungsverwaltung
- Zahlungen mit Richtung (Einnahme/Ausgabe) und Methode (Bar/Überweisung/Online)
- Optional verknüpft mit einer Rechnung → automatische Statusänderung bei Vollzahlung
- Freigabe-Workflow: `Entwurf → Eingereicht → Genehmigt → Bezahlt` (bei Überschreitung eines Schwellwerts)
- Auto-Booking: Bei Markierung als "bezahlt" wird automatisch eine Buchung erstellt

### 2.6 Bankimport
- CSV-Upload mit Client-seitigem Parsing
- ISO 20022 camt.053 (Kontoauszug) und camt.054 (Belastungs-/Gutschriftsanzeige) Import
- 5-stufiges Auto-Matching gegen offene Rechnungen
- Manuelles Matching, Ignorieren und Rückgängig-Machen

### 2.7 Mahnwesen
- Mahnungen für überfällige Rechnungen (Stufe 1-3)
- Status-Workflow: `Erstellt → Versendet`
- Verknüpft mit einer Rechnung über `InvoiceId`

### 2.8 Spesenabrechnungen
- Mitarbeiter/Mitglieder reichen Spesenbelege ein
- 6-stufiger Workflow: `Entwurf → Eingereicht → In Prüfung → Genehmigt → Erstattet` (oder Abgelehnt)
- Bei Erstattung wird automatisch eine Zahlung und Buchung erstellt

### 2.9 Geschäftsperioden
- Monatliche Geschäftsperioden (z.B. "2026-01", "2026-02")
- 3 Status: **Offen** (bearbeitbar), **Geschlossen** (weich — Warnung), **Gesperrt** (hart — keine Änderungen)
- Periodensperre verhindert Mutation von Buchungen/Rechnungen/Zahlungen in gesperrten Zeiträumen
- Abschlusswerte (Einnahmen, Ausgaben, Schlussaldo) werden bei Periodenabschluss gespeichert

### 2.10 Exports
- **Buchungsjournal-CSV**: Alle Buchungen mit Datum, Beschreibung, Betrag, Typ, Konto, Kategorie
- **Offene-Posten-CSV**: Alle unbezahlten Rechnungen
- **MwSt-Zusammenfassung-CSV**: Gruppiert nach Steuersatz mit Netto/Steuer/Brutto

---

## 3. Requirements-Matrix

### Kern-Finanz-Requirements

| ID | Titel | Priorität | Status | Beschreibung |
|---|---|---|---|---|
| **REQ-038** | Mini-Buchhaltung Grundfunktionen | Must have | ✅ Done | Konten, Kategorien, Buchungen (CRUD), Einnahmen/Ausgaben-Übersicht |
| **REQ-039** | Rechnungsstellung | Must have | ✅ Done | Rechnungen erstellen, versenden, stornieren, PDF-Generierung |
| **REQ-040** | Zahlungsverwaltung und Abgleich | Must have | ✅ Done | Zahlungen erfassen, mit Rechnungen verknüpfen, Auto-Mark-as-Paid |
| **REQ-041** | Bankimport CSV | Should have | ✅ Done | CSV/camt Upload, Auto-Matching, Match/Ignore |
| **REQ-042** | Mahnwesen | Should have | ✅ Done | Mahnungen Stufe 1-3, Erstellen, Versenden (nur Statusänderung, kein E-Mail) |
| **REQ-043** | Belegmanagement | Should have | ✅ Done | Beleg-Upload zu S3/RustFS, SHA256-Integrity, Download |
| **REQ-044** | Budget und Kostenstellen | Could have | ❌ Backlog | Nicht implementiert |
| **REQ-045** | Export für Steuer/Buchhaltung | Must have | ✅ Done | Journal-CSV, Offene-Posten-CSV, MwSt-Summary-CSV |

### Erweiterte Finanz-Requirements

| ID | Titel | Priorität | Status | Beschreibung |
|---|---|---|---|---|
| **REQ-060** | FinanceProfile (Jurisdiktion/Währung) | Must have | ✅ Done | CH/EU Auswahl, Organisation, Bank, Fiscal Year Start |
| **REQ-061** | Receipt-Storage (S3/RustFS) | Must have | ✅ Done | Datei-Upload mit SHA256, File-Type-Validierung |
| **REQ-062** | VAT/MWST TaxCodes | Must have | ✅ Done | Konfigurierbare Steuercodes, Per-Item-Tax auf Rechnungen+Buchungen |
| **REQ-063** | Swiss QR-Zahlteil | Should have | ✅ Done | QR-IBAN/SCOR Referenz, PNG-Bild im PDF |
| **REQ-064** | EU-Rechnungskonformität | Should have | ✅ Done | Invoice Templates, VAT-ID, Steuerbefreiung, Reverse Charge |
| **REQ-065** | eInvoice Export (UBL 2.1) | Should have | ✅ Done | EN 16931 konform, Feature-flagged |
| **REQ-066** | Geschäftsperioden / Periodensperren | Must have | ✅ Done | Open/Closed/Locked, Check in 10 Command-Handlers |
| **REQ-067** | Zahlungs-Freigabe / Spesenabrechnung | Should have | ✅ Done | Payment Approval Workflow + ExpenseClaim Lifecycle |
| **REQ-068** | ActivityArea Dimension-Tagging | Could have | ✅ Done | Tagging auf Buchungen + Rechnungspositionen, P&L-Report |
| **REQ-069** | camt Import (ISO 20022) | Should have | ✅ Done | camt.053/054 Parser, 5-stufiger Matcher |

---

## 4. Datenmodell im Detail

### 4.1 Entity-Übersicht

Das Finanzmodul umfasst **16 Domain-Entities**, die alle dem Rich Domain Model Pattern folgen (private Setter, Factory-Methoden, Geschäftslogik in der Entity):

```
Account ──────────┐
Category ─────────┤
                   ▼
            Transaction ◄──── Receipt
                   ▲
                   │
            Payment ──────────► Invoice ──────► InvoiceItem
                                  │                 │
                                  ▼                 ├── TaxCode (FK)
                           DunningNotice            └── ActivityArea (FK)
                                  
BankImport ────► BankImportItem
FinanceProfile
TaxCode
InvoiceTemplate
FiscalPeriod
ExpenseClaim ──► Payment ──► Transaction
ActivityArea
```

### 4.2 Account (Finanzkonto)

**Fachlich:** Repräsentiert ein Finanzkonto (z.B. "Vereinskasse", "PostFinance-Konto", "Bargeld").

| Feld | Typ | Beschreibung |
|---|---|---|
| `Id` | Guid | Primärschlüssel |
| `Name` | string | Kontoname (Pflicht) |
| `Number` | string | Eindeutige Kontonummer (Pflicht, Unique-Index) |
| `Type` | AccountType | `Cash`, `Bank`, `Other` |
| `Description` | string? | Optionale Beschreibung |
| `IsActive` | bool | Aktiv/Inaktiv-Flag (Default: true) |
| `SortOrder` | int | Sortierreihenfolge |
| `CreatedAt/By` | DateTime/string | Erstellt-Zeitstempel und Benutzer |
| `UpdatedAt/By` | DateTime?/string? | Letzte Änderung |
| `IsDeleted/DeletedAt/DeletedBy` | Soft-Delete-Felder | Soft-Delete-Tracking |

**Geschäftsregeln:**
- Name und Nummer sind Pflichtfelder (Validierung im Factory-Method `Create`)
- Konten können aktiviert/deaktiviert werden ohne Löschung
- Soft-Delete statt physischer Löschung

**Technische Anmerkung:** Der `AccountType` im Code enthält die Werte `Cash, Bank, Other`. In der existierenden Dokumentation wird fälschlich `Income, Expense, Asset, Liability` aufgeführt — **der Code zeigt die tatsächlichen 3 Werte**.

### 4.3 Category (Buchungskategorie)

**Fachlich:** Klassifiziert Buchungen nach Verwendungszweck (z.B. "Mitgliedsbeiträge", "Eventeinnahmen", "Raummiete").

| Feld | Typ | Beschreibung |
|---|---|---|
| `Id` | Guid | Primärschlüssel |
| `Name` | string | Kategoriename (Pflicht) |
| `Type` | TransactionType | `Income` oder `Expense` |
| `Color` | string | Hex-Farbcode (Default: `#6b7280`) |
| `IsActive` | bool | Aktiv/Inaktiv (Default: true) |
| `CreatedAt/By` | — | Audit-Felder |

**Geschäftsregeln:**
- Jede Kategorie ist entweder für Einnahmen ODER Ausgaben (nicht beides)
- Farbcode für visuelle Unterscheidung im Frontend

### 4.4 Transaction (Buchung)

**Fachlich:** Einzelne Finanzbuchung — das Herzstück der Einnahmen-Ausgaben-Rechnung.

| Feld | Typ | Beschreibung |
|---|---|---|
| `Id` | Guid | Primärschlüssel |
| `Date` | DateTime (UTC) | Buchungsdatum |
| `Description` | string | Beschreibung (Pflicht) |
| `Amount` | decimal | Betrag in Profilwährung (> 0, immer positiv) |
| `Type` | TransactionType | `Income` oder `Expense` |
| `AccountId` | Guid (FK) | Verknüpftes Finanzkonto (Pflicht) |
| `CategoryId` | Guid? (FK) | Optionale Kategorie |
| `Reference` | string? | Externe Referenznummer |
| `Notes` | string? | Freitextnotizen |
| `ReceiptId` | Guid? (FK) | Optionaler Beleg |
| `ActivityAreaId` | Guid? (FK) | Optionaler Aktivitätsbereich |
| `TaxCodeId` | Guid? (FK) | Optionaler Steuercode |
| `TaxRate` | decimal? | Steuersatz (Snapshot vom TaxCode) |
| `TaxAmount` | decimal? | Berechneter MwSt-Betrag |
| `NetAmount` | decimal? | Nettobetrag (Amount - TaxAmount) |

**Geschäftsregeln:**
- Betrag muss > 0 sein (Typ bestimmt ob Einnahme oder Ausgabe)
- Beschreibung ist Pflicht
- **MwSt-Berechnung (Herausrechnung aus Brutto):**
  ```
  TaxAmount = Amount × TaxRate / (1 + TaxRate)
  NetAmount = Amount - TaxAmount
  ```
  Beispiel: Amount=107.70, TaxRate=0.077 → TaxAmount=7.70, NetAmount=100.00
- Alle Datumsangaben werden als UTC gespeichert
- Soft-Delete implementiert

**Fachliche Bewertung — MwSt-Berechnung:**
Die Formel `Amount × Rate / (1 + Rate)` ist die korrekte Herausrechnungsformel für die Schweizer MWST (Inclusive Tax). Das bedeutet: **Der eingegebene `Amount` ist immer der Bruttobetrag** (inkl. MWST). Die MWST wird herausgerechnet. Dies ist in der Schweiz üblich, kann aber für EU-Anwendungen (wo oft Netto + MWST = Brutto gerechnet wird) zu Verwirrung führen.

### 4.5 Invoice (Rechnung)

**Fachlich:** Ausgangsrechnung an Mitglieder, Sponsoren oder andere Empfänger.

| Feld | Typ | Beschreibung |
|---|---|---|
| `Id` | Guid | Primärschlüssel |
| `InvoiceNumber` | string | Auto-generiert, Format: `INV-YYYY-NNNN` (Unique-Index) |
| `Date` | DateTime (UTC) | Rechnungsdatum |
| `DueDate` | DateTime (UTC) | Fälligkeitsdatum |
| `Status` | InvoiceStatus | `Draft`, `Sent`, `Paid`, `Overdue`, `Cancelled` |
| `RecipientType` | RecipientType | `Member`, `Sponsor`, `Vendor`, `Other` |
| `RecipientId` | Guid? | Optionaler FK zum Empfänger (Member-ID etc.) |
| `RecipientName` | string | Empfängername (denormalisiert für PDF) |
| `RecipientAddress` | string? | Empfängeradresse |
| `SubTotal` | decimal | Zwischensumme (Summe aller Positionen, berechnet) |
| `TaxRate` | decimal | Legacy-Steuersatz der Gesamtrechnung |
| `TaxAmount` | decimal | Legacy-Steuerbetrag (SubTotal × TaxRate / 100) |
| `Total` | decimal | Gesamtbetrag (berechnet) |
| `SubtotalNet` | decimal | Netto-Zwischensumme (REQ-062, Summe aller Item-NetAmounts) |
| `TotalTax` | decimal | Gesamte MwSt (Summe aller Item-TaxAmounts) |
| `TotalGross` | decimal | Bruttobetrag (Summe aller Item-GrossAmounts) |
| `Notes` | string? | Rechnungsnotizen |
| `PaymentTerms` | string? | Zahlungsbedingungen (REQ-064, EU) |
| `TemplateId` | Guid? | Optionaler FK zum InvoiceTemplate |
| `CancellationReason` | string? | Stornogrund (bei Status=Cancelled) |
| `CancelledAt` | DateTime? | Stornierungszeitpunkt |
| `Items` | List\<InvoiceItem\> | Rechnungspositionen (1:N) |

**Berechnung der Totals (RecalculateTotals):**
```
SubTotal = Summe(Items.Amount)
TaxAmount = Round(SubTotal × TaxRate / 100, 2)     // Legacy-Berechnung
SubtotalNet = Summe(Items.NetAmount ?? Items.Amount) // Per-Item-Tax (REQ-062)
TotalTax = Summe(Items.TaxAmount ?? 0)               // Per-Item-Tax
TotalGross = Summe(Items.GrossAmount ?? Items.Amount) // Per-Item-Tax
Total = TotalGross > 0 ? TotalGross : SubTotal + TaxAmount  // Hybrid
```

**Geschäftsregeln:**
- Nur Entwürfe (`Draft`) können bearbeitet werden
- Nur Entwürfe können versendet werden (`Draft → Sent`)
- Nur versendete Rechnungen können als überfällig markiert werden (`Sent → Overdue`)
- Nur versendete oder überfällige können storniert werden (`Sent/Overdue → Cancelled`)
- Stornierung erfordert einen Grund und erzeugt eine Gegenbuchung (Storno-Transaktion)
- Bezahlung wird automatisch über Zahlungsverknüpfung gesteuert

### 4.6 InvoiceItem (Rechnungsposition)

**Fachlich:** Einzelne Position auf einer Rechnung.

| Feld | Typ | Beschreibung |
|---|---|---|
| `Id` | Guid | Primärschlüssel |
| `InvoiceId` | Guid (FK) | Zugehörige Rechnung |
| `Description` | string | Positionsbeschreibung (Pflicht) |
| `Quantity` | decimal | Menge |
| `UnitPrice` | decimal | Einzelpreis |
| `Amount` | decimal | = Round(Quantity × UnitPrice, 2) |
| `TaxCodeId` | Guid? (FK) | Optionaler Steuercode |
| `TaxRate` | decimal? | Steuersatz (Snapshot) |
| `TaxAmount` | decimal? | Berechneter MwSt-Betrag |
| `NetAmount` | decimal? | Nettobetrag |
| `GrossAmount` | decimal? | Bruttobetrag |
| `IsGrossEntry` | bool | true = UnitPrice ist brutto, false = netto |
| `ActivityAreaId` | Guid? (FK) | Optionaler Aktivitätsbereich |

**MwSt-Berechnung pro Position:**

Wenn `IsGrossEntry = true` (Preis ist brutto):
```
GrossAmount = Quantity × UnitPrice
NetAmount = Round(GrossAmount / (1 + TaxRate), 2)
TaxAmount = GrossAmount - NetAmount
```

Wenn `IsGrossEntry = false` (Preis ist netto — Standard):
```
NetAmount = Quantity × UnitPrice
TaxAmount = Round(NetAmount × TaxRate, 2)
GrossAmount = NetAmount + TaxAmount
```

**Fachliche Bewertung:** Die duale Unterstützung von Brutto- und Nettoeingabe ist korrekt und wichtig. In der Schweiz sind Preise üblicherweise brutto (inkl. MWST), in der EU wird häufig netto kalkuliert.

### 4.7 Payment (Zahlung)

**Fachlich:** Geldeingang oder -ausgang, optional verknüpft mit einer Rechnung.

| Feld | Typ | Beschreibung |
|---|---|---|
| `Id` | Guid | Primärschlüssel |
| `Date` | DateTime (UTC) | Zahlungsdatum |
| `Amount` | decimal | Betrag (> 0) |
| `Direction` | PaymentDirection | `Income` (Einnahme) oder `Expense` (Ausgabe) |
| `Method` | PaymentMethod | `Cash`, `Transfer`, `Online` |
| `Reference` | string? | Zahlungsreferenz |
| `InvoiceId` | Guid? (FK) | Optionale Rechnungsverknüpfung |
| `TransactionId` | Guid? (FK) | Verknüpfte Buchung (Auto-Booking) |
| `Notes` | string? | Notizen |
| `ReceiptId` | Guid? (FK) | Optionaler Beleg |
| `Status` | PaymentStatus | `Draft`, `Submitted`, `Approved`, `Rejected`, `Paid` |
| `ApprovedBy/At/Comment` | — | Genehmigungsdaten |
| `RejectedBy/At/Reason` | — | Ablehnungsdaten |

**Geschäftsregeln (Approval Workflow):**
1. `Draft → Submitted`: Einreichen zur Genehmigung
2. `Submitted → Approved`: Genehmigung (mit optionalem Kommentar)
3. `Submitted → Rejected`: Ablehnung (mit Pflicht-Begründung)
4. `Approved/Draft → Paid`: Markierung als bezahlt
5. `Rejected → Draft`: Zurücksetzen zur Überarbeitung

**Schwellwert-Prüfung (REQ-067):**
- Im FinanceProfile sind Schwellwerte konfigurierbar (`ApprovalThresholdChf`, `ApprovalThresholdEur`)
- Wenn `Amount >= Schwellwert` → Zahlung MUSS genehmigt sein, bevor sie als bezahlt markiert werden kann
- Unter dem Schwellwert kann direkt `Draft → Paid` gewechselt werden

**Auto-Booking:** Wenn eine Zahlung als "bezahlt" markiert wird und noch keine Buchung verknüpft ist, wird automatisch eine Transaction erstellt (via `IAutoBookingService`).

### 4.8 BankImport / BankImportItem

**Fachlich:** Import von Kontobewegungen aus Bankdateien (CSV oder ISO 20022 camt).

**BankImport (Batch-Header):**
| Feld | Typ | Beschreibung |
|---|---|---|
| `Id` | Guid | Primärschlüssel |
| `ImportDate` | DateTime | Importzeitpunkt |
| `FileName` | string | Dateiname der importierten Datei |
| `Status` | BankImportStatus | `Pending`, `Processed` |
| `Format` | BankImportFormat | `Csv`, `Camt053`, `Camt054` |
| `OriginalFileStoragePath` | string? | Pfad zur gespeicherten Originaldatei |
| `ImportedBy` | string | Benutzername |
| `Items` | List\<BankImportItem\> | Einzelne Kontobewegungen (1:N) |

**BankImportItem (Einzelne Kontobewegung):**
| Feld | Typ | Beschreibung |
|---|---|---|
| `Id` | Guid | Primärschlüssel |
| `BankImportId` | Guid (FK) | Zugehöriger Import-Batch |
| `TransactionDate` | DateTime | Buchungsdatum der Bank |
| `Description` | string | Buchungstext der Bank |
| `Amount` | decimal | Betrag (positiv/negativ) |
| `Iban` | string? | IBAN des Gegenkontos |
| `Reference` | string? | Referenznummer |
| `Status` | BankImportItemStatus | `Unmatched`, `Matched`, `Ignored` |
| `MatchedPaymentId` | Guid? | FK zur gematchten Zahlung |
| `EndToEndId` | string? | ISO 20022: End-to-End-Referenz |
| `CreditorReference` | string? | ISO 20022: Gläubigerreferenz |
| `RemittanceInfo` | string? | ISO 20022: Verwendungszweck |
| `DebtorName/Iban` | string? | ISO 20022: Auftraggeber |
| `SuggestedInvoiceId` | Guid? | Auto-Match-Vorschlag |
| `MatchConfidence` | decimal? | Konfidenz des Auto-Match (0.0-1.0) |

### 4.9 DunningNotice (Mahnung)

**Fachlich:** Zahlungserinnerung für überfällige Rechnungen.

| Feld | Typ | Beschreibung |
|---|---|---|
| `InvoiceId` | Guid (FK) | Zugehörige überfällige Rechnung |
| `Level` | int | Mahnstufe 1-3 |
| `Date` | DateTime | Erstellungsdatum |
| `DueDate` | DateTime | Zahlungsfrist der Mahnung |
| `Status` | DunningStatus | `Created`, `Sent` |
| `SentAt` | DateTime? | Versendezeitpunkt |
| `Notes` | string? | Notizen |

**Geschäftsregeln:**
- Mahnstufe 1-3 (1. Erinnerung, 2. Mahnung, 3. Letzte Mahnung)
- "Versendet" ändert nur den Status — es wird **kein E-Mail** automatisch verschickt

### 4.10 Receipt (Beleg)

**Fachlich:** Digitalisierter Beleg (Quittung, Rechnung, Kontoauszug etc.).

| Feld | Typ | Beschreibung |
|---|---|---|
| `FileName` | string | Originaler Dateiname |
| `FilePath` | string | S3-Speicherpfad |
| `ContentType` | string | MIME-Type (application/pdf, image/jpeg etc.) |
| `FileSize` | long | Dateigröße in Bytes |
| `FileHash` | string? | SHA256-Hash für Integritätsprüfung |
| `UploadedAt/By` | — | Upload-Tracking |
| `Notes` | string? | Notizen zum Beleg |

**Speicherpfad-Konvention:** `finance-documents/receipts/{receiptId}/{filename}`

### 4.11 FinanceProfile (Finanzprofil)

**Fachlich:** Zentrale Konfiguration des Finanzsystems — bestimmt Jurisdiktion, Währung und Organisationsdaten.

| Feld | Typ | Beschreibung |
|---|---|---|
| `Jurisdiction` | Jurisdiction | `CH` (Schweiz) oder `EU` |
| `CountryCode` | string? | ISO-Ländercode (z.B. "DE", "AT") |
| `Currency` | FinanceCurrency | `CHF` oder `EUR` |
| `FiscalYearStartMonth` | int | Monat des Geschäftsjahresbeginns (1-12) |
| `OrganizationName` | string | Vereinsname |
| `OrganizationAddress/City/PostalCode/Country` | string | Adresse |
| `OrganizationEmail/Phone/Website` | string? | Kontaktdaten |
| `OrganizationUid` | string? | UID/Handelsregisternummer |
| `VatStatus` | VatStatus | `NotRegistered`, `Registered`, `SmallBusiness` |
| `VatNumber` | string? | MwSt-Nummer (z.B. "CHE-123.456.789 MWST") |
| `BankName/Iban/Bic` | string? | Bankverbindung |
| `ApprovalThresholdChf` | decimal? | Schwellwert für Zahlungsfreigabe (CHF) |
| `ApprovalThresholdEur` | decimal? | Schwellwert für Zahlungsfreigabe (EUR) |
| `IsActive` | bool | Nur ein Profil kann aktiv sein |

**Geschäftsregeln:**
- Es darf **maximal ein aktives FinanceProfile** gleichzeitig existieren
- Das Profil steuert:
  - Welcher PDF-Generator verwendet wird (Swiss QR-Bill vs. Standard)
  - Welche Währung auf Rechnungen/PDFs angezeigt wird
  - Ob EU-Konformitätsprüfungen beim Rechnungsversand greifen
  - Welche Schwellwerte für den Zahlungs-Freigabe-Workflow gelten

### 4.12 TaxCode (Steuercode)

**Fachlich:** Konfigurierbarer MwSt-/Steuersatz für granulare Steuerbehandlung.

| Feld | Typ | Beschreibung |
|---|---|---|
| `Code` | string | Kurzcode, z.B. "NORMAL", "REDUCED", "EXEMPT" (Großbuchstaben) |
| `Label` | string | Anzeigename, z.B. "Normalsatz 8.1%" |
| `Rate` | decimal | Steuersatz als Dezimalzahl (0.081 = 8.1%), Wertebereich 0-1 |
| `IsDefault` | bool | Default-Steuercode für neue Buchungen |
| `IsActive` | bool | Aktiv/Inaktiv |

**Fachliche Bewertung:**
- Rate als Dezimalzahl 0-1 statt Prozent 0-100 — konsistent, aber Frontend zeigt % an
- Schweizer MWST-Sätze (Stand 2025): Normalsatz 8.1%, Reduziert 2.6%, Sondersatz 3.8%
- EU-Sätze variieren nach Land, werden über die Konfiguration abgebildet

### 4.13 InvoiceTemplate (Rechnungsvorlage)

**Fachlich:** Konfigurierbare Rechnungsvorlage für EU-Konformitätsfelder.

| Feld | Typ | Beschreibung |
|---|---|---|
| `Name` | string | Vorlagenname |
| `Jurisdiction` | Jurisdiction | CH oder EU |
| `CountryCode` | string? | Optional: spezifisches EU-Land |
| `IsDefault` | bool | Standardvorlage für die Jurisdiktion |
| `ShowVatId` | bool | VAT-ID auf Rechnung anzeigen |
| `ShowTaxExemptionNote` | bool | Steuerbefreiungshinweis anzeigen |
| `TaxExemptionNote` | string? | z.B. "Steuerbefreit nach §4 UStG" |
| `ShowReverseChargeNote` | bool | Reverse-Charge-Hinweis anzeigen |
| `ReverseChargeNote` | string? | z.B. "Reverse charge applies" |
| `ShowPaymentTerms` | bool | Zahlungsbedingungen anzeigen |
| `DefaultPaymentTerms` | string? | z.B. "Zahlbar innerhalb 30 Tagen" |
| `ShowBankDetails` | bool | Bankverbindung im Footer |
| `LogoUrl/HeaderText/FooterText/LegalNotice` | string? | Darstellungsoptionen |
| `Language` | string | ISO 639-1 Sprachcode (Default: "en") |

### 4.14 FiscalPeriod (Geschäftsperiode)

**Fachlich:** Monatliche Abrechnungsperiode mit Sperrmechanismus.

| Feld | Typ | Beschreibung |
|---|---|---|
| `Name` | string | z.B. "2026-01" |
| `Year` | int | Geschäftsjahr |
| `Month` | int | Monat (1-12) |
| `StartDate/EndDate` | DateTime | Zeitraum der Periode |
| `Status` | FiscalPeriodStatus | `Open`, `Closed`, `Locked` |
| `LockedAt/By` | — | Zeitpunkt und Benutzer der Sperre |
| `UnlockedAt/By` | — | Zeitpunkt und Benutzer der Entsperrung |
| `TotalIncome/TotalExpense/ClosingBalance` | decimal? | Abschlusswerte (nur bei Closed) |

**Status-Bedeutung:**
- **Open**: Alle Mutationen erlaubt
- **Closed**: Soft-Close — Abschlusswerte gespeichert, Admin kann noch editieren (Warnung im UI)
- **Locked**: Hard-Lock — keine Mutationen erlaubt, nur Admin kann entsperren

**Geschäftsregeln:**
- `EnsurePeriodNotLockedAsync(date)` wird in **10 Command-Handlers** aufgerufen:
  - CreateTransaction, UpdateTransaction, DeleteTransaction
  - CreateInvoice, UpdateInvoice, CancelInvoice
  - CreatePayment, UpdatePayment, MarkPaymentAsPaid, DeletePayment
- Bei `Close` werden Einnahmen/Ausgaben/Schlussaldo aus den Buchungen der Periode berechnet und gespeichert

### 4.15 ExpenseClaim (Spesenabrechnung)

**Fachlich:** Erstattungsantrag eines Mitglieds für getätigte Ausgaben.

| Feld | Typ | Beschreibung |
|---|---|---|
| `Title` | string | Titel der Spesenabrechnung |
| `Description` | string | Beschreibung |
| `Amount` | decimal | Erstattungsbetrag (> 0) |
| `Currency` | FinanceCurrency | Währung (CHF/EUR) |
| `Date` | DateTime | Datum der Ausgabe |
| `Status` | ExpenseClaimStatus | 6 Status-Stufen |
| `ClaimantId` | Guid | Mitglieds-ID des Antragstellers |
| `ClaimantName` | string | Name (denormalisiert) |
| `ReceiptId` | Guid? (FK) | Optionaler Beleg |
| `ReviewedBy/At/Comment` | — | Prüfungsdaten (Kassier) |
| `ApprovedBy/At/Comment` | — | Genehmigungsdaten (Vorstand) |
| `RejectedBy/At/Reason` | — | Ablehnungsdaten |
| `PaymentId` | Guid? (FK) | FK zur Erstattungszahlung |
| `ReimbursedAt/By` | — | Erstattungsdaten |

### 4.16 ActivityArea (Aktivitätsbereich)

**Fachlich:** Dimension für die Zuordnung von Buchungen und Rechnungspositionen zu Vereinsbereichen.

| Feld | Typ | Beschreibung |
|---|---|---|
| `Name` | string | z.B. "Events", "Mitgliederverwaltung", "Administration" |
| `Code` | string | Kurzcode, z.B. "EVT", "MBR", "ADM" (Großbuchstaben) |
| `Description` | string? | Beschreibung |
| `Color` | string? | Hex-Farbcode für UI |
| `IsActive` | bool | Aktiv/Inaktiv |
| `SortOrder` | int | Sortierung |

**Verwendung:**
- FK auf `Transaction.ActivityAreaId` → Zuordnung von Buchungen zu Bereichen
- FK auf `InvoiceItem.ActivityAreaId` → Zuordnung von Rechnungspositionen
- P&L-Report: Einnahmen/Ausgaben/Saldo pro Aktivitätsbereich mit Datumsfilter

---

## 5. Fachliche Prozesse und Workflows

### 5.1 Rechnungs-Lebenszyklus

```
                    ┌──────────┐
 Erstellen ────────►│  Draft   │
                    └────┬─────┘
                         │ MarkAsSent()
                         ▼
                    ┌──────────┐     Vollzahlung
                    │   Sent   │────────────────►┌──────────┐
                    └────┬─────┘                 │   Paid   │
                         │                       └──────────┘
                         │ MarkAsOverdue()
                         ▼
                    ┌──────────┐     Vollzahlung
                    │ Overdue  │────────────────►┌──────────┐
                    └────┬─────┘                 │   Paid   │
                         │                       └──────────┘
                         │ Cancel(reason)
            Sent ────────┤
                         ▼
                    ┌──────────────┐
                    │  Cancelled   │ + Storno-Gegenbuchung
                    └──────────────┘
```

**EU-Validierung vor Versand (REQ-064):**
- Wenn Jurisdiktion = EU:
  - VatNumber muss vorhanden sein (wenn `VatStatus = Registered`)
  - Alle Rechnungspositionen müssen einen TaxCode haben

### 5.2 Zahlungs-Freigabe-Workflow (REQ-067)

```
                    ┌──────────┐
 Erstellen ────────►│  Draft   │◄────── ResetToDraft()
                    └────┬─────┘              ▲
                         │ Submit()           │ (bei Ablehnung)
                         ▼                    │
                    ┌──────────────┐          │
                    │  Submitted   │──────────┘ Reject(reason)
                    └────┬─────────┘
                         │ Approve(comment?)
                         ▼
                    ┌──────────────┐
                    │  Approved    │
                    └────┬─────────┘
                         │ MarkAsPaid()
                         ▼                    
                    ┌──────────┐     + Auto-Booking
                    │   Paid   │────────────────► Transaction
                    └──────────┘

Kurzweg (unter Schwellwert):
    Draft ────────────► Paid + Auto-Booking
```

### 5.3 Spesen-Workflow (REQ-067)

```
                    ┌──────────┐
 Erstellen ────────►│  Draft   │◄────── ResetToDraft()
                    └────┬─────┘              ▲
                         │ Submit()           │ (bei Ablehnung)
                         ▼                    │
                    ┌──────────────┐          │
                    │  Submitted   │──────────┤ Reject(reason)
                    └────┬─────────┘          │
                         │ Review(comment?)   │
                         ▼                    │
                    ┌──────────────┐          │
                    │ UnderReview  │──────────┘ Reject(reason)
                    └────┬─────────┘
                         │ Approve(comment?)
                         ▼
                    ┌──────────────┐
                    │  Approved    │
                    └────┬─────────┘
                         │ Reimburse(paymentId)
                         ▼                    
                    ┌──────────────┐   + Payment + Auto-Booking
                    │ Reimbursed   │──────────────► Transaction
                    └──────────────┘
```

### 5.4 Bankimport-Prozess (REQ-069)

```
               ┌───────────────┐
 Upload ──────►│ BankImport    │ Status: Pending
               │ (Batch)       │
               └───────┬───────┘
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
         ┌─────────┐ ┌─────────┐ ┌─────────┐
         │ Item 1  │ │ Item 2  │ │ Item N  │ Status: Unmatched
         └────┬────┘ └────┬────┘ └────┬────┘
              │           │           │
              ▼           ▼           ▼
    Auto-Match-Algorithmus (5 Stufen)
              │           │           │
              ▼           ▼           ▼
   ┌──────────────┐  ┌──────┐  ┌─────────┐
   │ Matched      │  │Ignore│  │ Manual   │
   │ (Payment-FK) │  │      │  │ Unmatch  │
   └──────────────┘  └──────┘  └─────────┘
```

**5-stufiger Auto-Match-Algorithmus:**

| Priorität | Methode | Konfidenz | Beschreibung |
|---|---|---|---|
| 1 | EndToEndId exakt | **1.00** | End-to-End-ID stimmt exakt mit Rechnungsnummer überein |
| 2 | CreditorReference exakt | **0.95** | Gläubigerreferenz stimmt mit Rechnungsnummer überein |
| 3 | RemittanceInfo enthält | **0.80** | Verwendungszweck enthält die Rechnungsnummer |
| 4 | Betrag + Datum (±30 Tage) | **0.60** | Gleicher Betrag, Datum nahe am Fälligkeitsdatum |
| 5 | Nur Betrag | **0.40** | Gleicher Betrag (ohne Datumsübereinstimmung) |

### 5.5 Periodensperre-Mechanismus (REQ-066)

```
Jeder Mutations-Command-Handler:
    ─── EnsurePeriodNotLockedAsync(date) ───►
         │
         ├── Keine Periode für Datum → OK (weiter)
         ├── Periode Status = Open → OK (weiter)
         ├── Periode Status = Closed → OK (weiter, aber UI zeigt Warnung)
         └── Periode Status = Locked → FEHLER: InvalidOperationException
                                       "Fiscal period {name} is locked."
```

---

## 6. Technische Architektur

### 6.1 Clean Architecture Schichten

```
┌──────────────────────────────────────────────────────────┐
│                    IabConnect.Api                         │
│  (ASP.NET Core Minimal API Endpoints)                    │
│  - Endpoints/*.cs (Route-Mapping, Auth, Request/Response)│
│  - DTOs/*.cs (API-spezifische Datenmodelle)              │
│  - Authorization/ (Policies)                             │
│  - Middleware/ (Exception Handling)                       │
└──────────────────────┬───────────────────────────────────┘
                       │ MediatR.ISender.Send()
                       ▼
┌──────────────────────────────────────────────────────────┐
│                IabConnect.Application                     │
│  (Business Logic, CQRS Handlers, Validators)             │
│  - Finance/Invoices/Commands/CreateInvoiceCommand.cs     │
│  - Finance/Invoices/Commands/CreateInvoiceCommandHandler │
│  - Finance/Invoices/Commands/CreateInvoiceCommandValidator│
│  - Finance/Invoices/Queries/GetInvoicesQuery.cs          │
│  - ... (~210 CQRS-Dateien)                               │
│  - IFinanceRepositories.cs (Repository-Interfaces)       │
│  - IInvoicePdfGenerator.cs, IEInvoiceExporter.cs         │
│  - IFiscalPeriodService.cs, IAutoBookingService.cs       │
└──────────────────────┬───────────────────────────────────┘
                       │ Dependency Inversion
                       ▼
┌──────────────────────────────────────────────────────────┐
│                 IabConnect.Domain                         │
│  (Entities, Value Objects, Enums)                        │
│  - Finance/Account.cs, Transaction.cs, Invoice.cs, ...   │
│  - Finance/FinanceEnums.cs                               │
│  - Common/Entity.cs, ISoftDeletable.cs                   │
└──────────────────────────────────────────────────────────┘
                       ▲
                       │ Implementation
┌──────────────────────┴───────────────────────────────────┐
│              IabConnect.Infrastructure                    │
│  (DB Context, Repository Implementations, External Svcs) │
│  - Finance/QuestPdfInvoiceGenerator.cs                   │
│  - Finance/SwissQrBillInvoiceGenerator.cs                │
│  - Finance/UblInvoiceExporter.cs                         │
│  - Finance/CamtParser.cs                                 │
│  - Finance/BankImportMatcher.cs                          │
│  - Finance/InvoicePdfGeneratorFactory.cs                 │
│  - Persistence/AppDbContext.cs (EF Core)                 │
│  - Persistence/Repositories/*.cs                         │
└──────────────────────────────────────────────────────────┘
```

### 6.2 CQRS-Pattern (Command Query Responsibility Segregation)

**Jeder Anwendungsfall** wird durch ein eigenständiges Command oder Query abgebildet:

**Beispiel: Rechnung erstellen**
```
CreateInvoiceCommand (DTO mit Input-Daten)
    ↓
CreateInvoiceCommandValidator (FluentValidation)
    ↓ (MediatR Pipeline Behavior)
CreateInvoiceCommandHandler
    ├── FiscalPeriodService.EnsurePeriodNotLockedAsync()
    ├── InvoiceRepository.GetNextInvoiceNumberAsync()
    ├── Invoice.Create() (Factory-Method)
    ├── TaxCodeRepository.GetByIdAsync() (für Steuer-Snapshot)
    ├── Invoice.AddItemWithTax() (per Position)
    ├── InvoiceRepository.AddAsync()
    ├── UnitOfWork.SaveChangesAsync()
    └── AuditService.LogActionAsync()
```

**Anzahl CQRS-Dateien pro Bereich:**

| Bereich | Commands | Queries | Validators | Handler | Gesamt |
|---|---|---|---|---|---|
| Accounts | 3 | 2 | 2 | 5 | 12 |
| Categories | 3 | 2 | 2 | 5 | 12 |
| Transactions | 5 | 2 | 2 | 7 | 16 |
| Invoices | 5 | 5 | 2 | 10 | 22 |
| Payments | 8 | 2 | 5 | 10 | 25 |
| BankImports | 3 | 2 | 2 | 5 | 12 |
| Dunning | 2 | 2 | 1 | 4 | 9 |
| Receipts | 2 | 3 | 1 | 5 | 11 |
| ExpenseClaims | 7 | 2 | 5 | 9 | 23 |
| FiscalPeriods | 5 | 2 | 4 | 7 | 18 |
| TaxCodes | 3 | 1 | 2 | 4 | 10 |
| InvoiceTemplates | 3 | 2 | 2 | 5 | 12 |
| ActivityAreas | 3 | 2 | 2 | 5 | 12 |
| Exports | — | 3 | — | 3 | 6 |
| Dashboard | — | 1 | — | 1 | 2 |
| FinanceProfile | 2 | 1 | 1 | 3 | 7 |
| **Gesamt** | | | | | **~210** |

### 6.3 Datenbank

- **PostgreSQL** mit EF Core
- Tabellennamen in **snake_case** (PostgreSQL-Konvention)
- Enums als **String** gespeichert (nicht als Integer)
- Geldbeträge: `precision(18, 2)` — 18 Stellen gesamt, 2 Dezimalstellen
- Mengen: `precision(18, 4)` — 4 Dezimalstellen für Quantity
- **Unique-Indexe:** `accounts.number`, `invoices.invoice_number`
- **Cascade-Delete:** `Invoice → InvoiceItems`, `BankImport → BankImportItems`
- **Soft-Delete:** alle Finance-Entities (globaler Query-Filter auf `IsDeleted = false`)

### 6.4 Dependency Injection

Alle Abhängigkeiten werden über das DI-System registriert:
- Repositories: Scoped (eine Instanz pro HTTP-Request)
- MediatR Handlers: Transient
- FluentValidation Validators: Transient (via MediatR Pipeline Behavior)
- PDF-Generatoren: Transient (über Factory)
- FiscalPeriodService: Scoped
- AutoBookingService: Scoped

---

## 7. API-Endpunkte vollständig

### 7.1 Konten (`/api/v1/finance/accounts`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Alle Konten laden |
| `GET` | `/{id}` | FinanceRead | Konto nach ID |
| `POST` | `/` | FinanceWrite | Konto erstellen (auditiert) |
| `PUT` | `/{id}` | FinanceWrite | Konto aktualisieren (auditiert) |
| `DELETE` | `/{id}` | FinanceWrite | Konto löschen (Soft-Delete, auditiert) |

### 7.2 Kategorien (`/api/v1/finance/categories`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Alle Kategorien |
| `GET` | `/{id}` | FinanceRead | Kategorie nach ID |
| `POST` | `/` | FinanceWrite | Kategorie erstellen |
| `PUT` | `/{id}` | FinanceWrite | Kategorie aktualisieren |
| `DELETE` | `/{id}` | FinanceWrite | Kategorie löschen |

### 7.3 Buchungen (`/api/v1/finance/transactions`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Buchungen laden (Filter: `from`, `to`, `type`) |
| `GET` | `/summary` | FinanceRead | Aggregierte Einnahmen/Ausgaben/Saldo |
| `GET` | `/{id}` | FinanceRead | Einzelne Buchung |
| `POST` | `/` | FinanceWrite | Buchung erstellen (Periodensperre-Check) |
| `PUT` | `/{id}` | FinanceWrite | Buchung aktualisieren (Periodensperre-Check) |
| `DELETE` | `/{id}` | FinanceWrite | Buchung löschen (Periodensperre-Check) |
| `POST` | `/{id}/receipt` | FinanceWrite | Beleg an Buchung anhängen |
| `DELETE` | `/{id}/receipt` | FinanceWrite | Beleg von Buchung lösen |

### 7.4 Rechnungen (`/api/v1/finance/invoices`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Rechnungen (Filter: `status`) |
| `GET` | `/open` | FinanceRead | Offene Rechnungen (Sent + Overdue) |
| `GET` | `/{id}` | FinanceRead | Rechnungsdetail mit Positionen |
| `POST` | `/` | FinanceWrite | Rechnung erstellen (Periodensperre-Check) |
| `PUT` | `/{id}` | FinanceWrite | Rechnung aktualisieren (nur Draft) |
| `DELETE` | `/{id}` | FinanceWrite | Rechnung löschen (Soft-Delete) |
| `POST` | `/{id}/send` | FinanceWrite | Rechnung versenden (Draft → Sent, EU-Validierung) |
| `POST` | `/{id}/cancel` | FinanceWrite | Rechnung stornieren (+ Gegenbuchung) |
| `GET` | `/{id}/pdf` | FinanceRead | PDF herunterladen |
| `GET` | `/{id}/einvoice` | FinanceRead | eInvoice UBL 2.1 XML (Feature-flagged) |

### 7.5 Zahlungen (`/api/v1/finance/payments`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Alle Zahlungen |
| `GET` | `/{id}` | FinanceRead | Zahlung nach ID |
| `POST` | `/` | FinanceWrite | Zahlung erstellen (+ Auto-MarkAsPaid bei Vollzahlung) |
| `PUT` | `/{id}` | FinanceWrite | Zahlung aktualisieren |
| `DELETE` | `/{id}` | FinanceWrite | Zahlung löschen |
| `POST` | `/{id}/submit` | FinanceWrite | Zur Genehmigung einreichen |
| `POST` | `/{id}/approve` | FinanceWrite | Genehmigen |
| `POST` | `/{id}/reject` | FinanceWrite | Ablehnen (mit Begründung) |
| `POST` | `/{id}/mark-paid` | FinanceWrite | Als bezahlt markieren (Schwellwert-Check) |
| `POST` | `/{id}/receipt` | FinanceWrite | Beleg anhängen |
| `DELETE` | `/{id}/receipt` | FinanceWrite | Beleg lösen |

### 7.6 Bankimport (`/api/v1/finance/bank-imports`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Import-Historie |
| `POST` | `/` | FinanceWrite | CSV-Import hochladen |
| `POST` | `/camt` | FinanceWrite | camt.053/054 Import |
| `GET` | `/{id}` | FinanceRead | Import-Detail mit Items |
| `PUT` | `/{id}/items/{itemId}/match` | FinanceWrite | Item matchen |
| `PUT` | `/{id}/items/{itemId}/ignore` | FinanceWrite | Item ignorieren |

### 7.7 Mahnwesen (`/api/v1/finance/dunning`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Alle Mahnungen |
| `POST` | `/` | FinanceWrite | Mahnung erstellen |
| `POST` | `/{id}/send` | FinanceWrite | Mahnung als versendet markieren |

### 7.8 Belege (`/api/v1/finance/receipts`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Alle Belege |
| `POST` | `/` | FinanceWrite | Beleg hochladen (multipart/form-data) |
| `GET` | `/{id}` | FinanceRead | Beleg-Metadaten |
| `GET` | `/{id}/download` | FinanceRead | Datei herunterladen |
| `DELETE` | `/{id}` | FinanceWrite | Beleg löschen (Soft-Delete + S3-Löschung) |

### 7.9 Spesenabrechnungen (`/api/v1/finance/expense-claims`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Alle ExpenseClaims (Filter: `status`, `claimantId`) |
| `GET` | `/{id}` | FinanceRead | Detail |
| `POST` | `/` | FinanceWrite | Erstellen |
| `PUT` | `/{id}` | FinanceWrite | Aktualisieren (nur Draft) |
| `DELETE` | `/{id}` | FinanceWrite | Löschen |
| `POST` | `/{id}/submit` | FinanceWrite | Einreichen |
| `POST` | `/{id}/review` | FinanceWrite | Prüfung (Kassier) |
| `POST` | `/{id}/approve` | FinanceWrite | Genehmigung (Vorstand) |
| `POST` | `/{id}/reject` | FinanceWrite | Ablehnung |
| `POST` | `/{id}/reimburse` | FinanceWrite | Erstattung |

### 7.10 Geschäftsperioden (`/api/v1/finance/fiscal-periods`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Alle Perioden (Filter: `year`) |
| `GET` | `/{id}` | FinanceRead | Periode nach ID |
| `POST` | `/generate` | FinanceWrite | Perioden für ein Jahr generieren |
| `POST` | `/{id}/lock` | FinanceWrite | Periode sperren |
| `POST` | `/{id}/unlock` | FinanceWrite | Periode entsperren |
| `POST` | `/{id}/close` | FinanceWrite | Periode abschließen |
| `POST` | `/{id}/reopen` | FinanceWrite | Periode wiedereröffnen |

### 7.11 Steuercodes (`/api/v1/finance/tax-codes`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Alle aktiven Steuercodes |
| `POST` | `/` | FinanceWrite | Steuercode erstellen |
| `PUT` | `/{id}` | FinanceWrite | Steuercode aktualisieren |
| `DELETE` | `/{id}` | FinanceWrite | Steuercode löschen |

### 7.12 Rechnungsvorlagen (`/api/v1/finance/invoice-templates`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Alle Vorlagen (Filter: `jurisdiction`) |
| `GET` | `/{id}` | FinanceRead | Vorlage nach ID |
| `POST` | `/` | FinanceWrite | Vorlage erstellen |
| `PUT` | `/{id}` | FinanceWrite | Vorlage aktualisieren |
| `DELETE` | `/{id}` | FinanceWrite | Vorlage löschen |

### 7.13 Aktivitätsbereiche (`/api/v1/finance/activity-areas`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Alle aktiven Bereiche |
| `GET` | `/report` | FinanceRead | P&L-Report pro Bereich (Filter: `from`, `to`) |
| `POST` | `/` | FinanceWrite | Bereich erstellen |
| `PUT` | `/{id}` | FinanceWrite | Bereich aktualisieren |
| `DELETE` | `/{id}` | FinanceWrite | Bereich löschen |

### 7.14 Exporte (`/api/v1/finance/exports`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/journal` | FinanceRead | Buchungsjournal-CSV (Filter: `from`, `to`) |
| `GET` | `/open-items` | FinanceRead | Offene-Posten-CSV |
| `GET` | `/vat-summary` | FinanceRead | MwSt-Zusammenfassung-CSV (Filter: `from`, `to`) |

### 7.15 Dashboard (`/api/v1/finance/dashboard`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Aggregierte KPIs (s. Abschnitt 21) |

### 7.16 Finanzprofil (`/api/v1/finance/profile`)

| Method | Route | Auth | Beschreibung |
|---|---|---|---|
| `GET` | `/` | FinanceRead | Aktives Profil laden |
| `POST` | `/` | FinanceWrite | Profil erstellen |
| `PUT` | `/{id}` | FinanceWrite | Profil aktualisieren |

---

## 8. Frontend-Implementierung

### 8.1 Routenstruktur

Das Frontend nutzt **Next.js App Router** mit folgender Struktur unter `/finance`:

| Route | Seite | Beschreibung |
|---|---|---|
| `/finance` | Dashboard | KPI-Karten, Quick-Links, letzte Buchungen |
| `/finance/transactions` | Buchungen | CRUD mit 5 Filtern, Modal, Beleg-Verknüpfung |
| `/finance/invoices` | Rechnungsliste | Status-/Datumsfilter, Senden/Stornieren |
| `/finance/invoices/new` | Rechnung erstellen | Multi-Positionen, Steuerberechnung, Empfänger |
| `/finance/invoices/[id]` | Rechnungsdetail | Header, Positionen, PDF-Download, Zahlungen |
| `/finance/payments` | Zahlungen | 2 Tabs (Offene Posten + Alle), Approval-Workflow |
| `/finance/dunning` | Mahnungen | Liste, Erstellen (Auto-Stufe), Versenden |
| `/finance/receipts` | Belege | Upload, Download, Löschen |
| `/finance/expense-claims` | Spesenabrechnungen | Workflow, Status-Filter, Rollen-basierte Aktionen |
| `/finance/fiscal-periods` | Geschäftsperioden | Lock/Unlock/Close mit Bestätigung |
| `/finance/categories` | Kategorien | CRUD mit Farbwähler |
| `/finance/accounts` | Konten | CRUD |
| `/finance/activity-areas` | Aktivitätsbereiche | Management + P&L-Report |
| `/finance/bank-import` | Bankimport | Upload CSV/camt, Match/Ignore |
| `/finance/exports` | Exporte | Journal-CSV, Offene-Posten-CSV |
| `/finance/settings` | Einstellungen-Hub | Karten-Grid mit Links |
| `/finance/settings/profile` | Finanzprofil | Jurisdiktion, Währung, Organisation, Bank |
| `/finance/settings/tax-codes` | Steuercodes | CRUD |
| `/finance/settings/invoice-templates` | Rechnungsvorlagen | EU-Konformitätsfelder |
| `/finance/settings/activity-areas` | Aktivitätsbereiche | Verwaltung |

### 8.2 TypeScript-Typen

Zentrale Typdefinitionen in `frontend/src/types/finance.ts`:
- `TaxCode`, `InvoiceItem`, `Invoice`, `ExpenseClaim`, `InvoiceTemplate`
- `FiscalPeriod`, `BankImportItem`, `ActivityArea`, `ActivityAreaReport`
- Enums: `InvoiceStatus`, `RecipientType`, `PaymentStatus`, `ExpenseClaimStatus`, `FiscalPeriodStatus`, `BankImportItemStatus`

### 8.3 Berechtigungen im Frontend

Definiert in `src/lib/auth.ts`:
- `canReadFinance`: Rollen **Admin**, **Kassier**, **Auditor**
- `canWriteFinance`: Rollen **Admin**, **Kassier**
- `isKassier`: Rolle **Kassier** (für Spesen-Review)

### 8.4 Internationalisierung (i18n)

- ~130 Finance-spezifische Übersetzungsschlüssel in `messages/de.json` und `messages/en.json`
- Abschnitte: `finance`, `financeErrors`, `expenseClaims`, `activityAreas`, `paymentApproval`

---

## 9. Steuer-/MwSt-Logik im Detail

### 9.1 Konfigurierbare Steuercodes

Steuercodes werden in der Datenbank verwaltet und können vom Admin angelegt/geändert werden:

| Beispiel-Code | Label | Rate | Verwendung |
|---|---|---|---|
| `NORMAL` | Normalsatz 8.1% | 0.081 | Standard-MWST Schweiz |
| `REDUCED` | Reduzierter Satz 2.6% | 0.026 | Lebensmittel, Bücher etc. |
| `SPECIAL` | Sondersatz 3.8% | 0.038 | Beherbergung |
| `EXEMPT` | Steuerbefreit | 0.000 | Bildung, Gesundheit |
| `DE19` | Normalsatz DE 19% | 0.190 | Deutschland Standard |
| `DE7` | Ermäßigt DE 7% | 0.070 | Deutschland ermäßigt |

### 9.2 Anwendung auf Buchungen (Transactions)

Wenn ein TaxCode zugewiesen wird, wird der **Snapshot des Rate-Werts** in der Buchung gespeichert (nicht der FK allein). Das stellt sicher, dass spätere Änderungen am Steuersatz die historische Buchung nicht verfälschen.

**Berechnung (immer Herausrechnung = Brutto → Netto):**
```
TaxAmount = Round(Amount × TaxRate / (1 + TaxRate), 2)
NetAmount = Amount - TaxAmount
```

### 9.3 Anwendung auf Rechnungspositionen (InvoiceItems)

Rechnungspositionen unterstützen **zwei Eingabemodi:**

**Nettoeingabe** (`IsGrossEntry = false`, Standard):
```
NetAmount = Quantity × UnitPrice
TaxAmount = Round(NetAmount × TaxRate, 2)
GrossAmount = NetAmount + TaxAmount
```

**Bruttoeingabe** (`IsGrossEntry = true`):
```
GrossAmount = Quantity × UnitPrice
NetAmount = Round(GrossAmount / (1 + TaxRate), 2)
TaxAmount = GrossAmount - NetAmount
```

### 9.4 Aggregation auf Rechnungsebene

Die Rechnung aggregiert aus allen Positionen:
```
SubtotalNet = Σ(Items.NetAmount)
TotalTax    = Σ(Items.TaxAmount)
TotalGross  = Σ(Items.GrossAmount)
Total       = TotalGross (wenn Per-Item-Tax vorhanden) oder SubTotal + TaxAmount (Legacy)
```

### 9.5 VAT-Summary auf dem PDF

Wenn Rechnungspositionen MwSt-Daten haben, wird auf dem PDF eine **VAT Summary (MWST-Zusammenfassung)** gruppiert nach Steuersatz angezeigt:

| Steuersatz | Netto | MwSt | Brutto |
|---|---|---|---|
| 8.1% | CHF 1'000.00 | CHF 81.00 | CHF 1'081.00 |
| 2.6% | CHF 500.00 | CHF 13.00 | CHF 513.00 |
| **Gesamt** | **CHF 1'500.00** | **CHF 94.00** | **CHF 1'594.00** |

### 9.6 EU-Konformität

Bei `Jurisdiction = EU` wird vor dem Rechnungsversand geprüft:
- Falls `VatStatus = Registered` → VatNumber muss im FinanceProfile gesetzt sein
- Alle Rechnungspositionen müssen einen TaxCode zugewiesen haben

Auf dem PDF werden zusätzlich angezeigt (via InvoiceTemplate):
- VAT-ID des Verkäufers
- Steuerbefreiungshinweis (z.B. "Steuerbefreit nach §4 UStG")
- Reverse-Charge-Vermerk
- Zahlungsbedingungen
- Rechtshinweis

---

## 10. Rechnungsstellung im Detail

### 10.1 Rechnungserstellung

1. **Frontend** ruft `POST /api/v1/finance/invoices` mit Positionen auf
2. **CreateInvoiceCommandValidator** prüft:
   - Datum, Fälligkeitsdatum nicht leer
   - RecipientType gültig (Member/Sponsor/Vendor/Other)
   - RecipientName nicht leer, max. 300 Zeichen
   - Mindestens eine Position
   - Pro Position: Description nicht leer, Quantity > 0, UnitPrice ≥ 0
3. **CreateInvoiceCommandHandler**:
   - Prüft Periodensperre für Rechnungsdatum
   - Generiert nächste Rechnungsnummer (`INV-YYYY-NNNN`)
   - Erstellt Invoice-Entity über Factory-Method
   - Für jede Position mit TaxCodeId: Liest TaxCode und speichert Rate-Snapshot
   - Fügt Items mit `AddItemWithTax()` hinzu (triggert Neuberechnung)
   - Speichert in DB
   - Schreibt Audit-Log

### 10.2 Rechnungsnummern-Generierung

Format: `INV-{Jahr}-{laufendeNummer:4-stellig}`  
Beispiel: `INV-2026-0001`, `INV-2026-0042`

Die Generierung erfolgt über `IInvoiceRepository.GetNextInvoiceNumberAsync()`. 

**Bekanntes Problem:** Es gibt kein DB-Level-Locking. Bei gleichzeitigen Requests könnte theoretisch dieselbe Nummer vergeben werden. In der Praxis (Vereinsumgebung mit wenigen Nutzern) ist dies unwahrscheinlich, aber für Auditor-Review relevant.

### 10.3 PDF-Generierung

Die PDF-Generierung nutzt das **Template Method Pattern** mit austauschbaren Generatoren:

```
IInvoicePdfGeneratorFactory.GetGeneratorAsync()
    │
    ├── CH + IBAN vorhanden → SwissQrBillInvoiceGenerator
    └── Alle anderen       → QuestPdfInvoiceGenerator (Base)
```

**QuestPdfInvoiceGenerator** (Base-Klasse):
- Seite A4, 40pt Rand
- Header: Organisation + Logo-Platzhalter
- Metadaten: Rechnungsdatum, Fälligkeitsdatum, Status, Empfänger
- Positionstabelle: 2 Layouts (mit/ohne MwSt-Spalten)
- Totals: Netto/MwSt/Brutto oder einfach Subtotal/Tax/Total
- VAT-Summary (wenn MwSt vorhanden)
- EU-Compliance-Notizen (wenn Template vorhanden)
- Footer: Zahlungsanweisungen, IBAN, BIC, Bankname

**SwissQrBillInvoiceGenerator** (Erweiterung):
- Erbt alles von Base
- Überschreibt `ComposeAdditionalSections()`
- Generiert Swiss QR-Zahlteil via Codecrete.SwissQRBill.Generator
- QR-Code enthält: IBAN, Betrag, Währung, Empfänger, strukturierte Referenz
- Strukturierte Referenz: QR-Referenz (27 Ziffern) für QR-IBAN, SCOR (ISO 11649) für Normal-IBAN
- Darstellung: Neue Seite nach Rechnungsinhalt, gestrichelte Trennlinie, QR-Bill als PNG

---

## 11. Zahlungsmanagement im Detail

### 11.1 Zahlungserfassung

Beim Erstellen einer Zahlung mit `InvoiceId`:
1. Prüfung der Periodensperre
2. Speicherung der Zahlung
3. **Auto-MarkAsPaid**: Alle Zahlungen zur Rechnung werden summiert. Wenn `SummeZahlungen ≥ Rechnungstotal` → Rechnung wird automatisch als `Paid` markiert

### 11.2 Konsistenz-Management

Die Methode `Invoice.RecalculatePaymentStatus(totalPaidAmount, updatedBy)` wird aufgerufen, wenn Zahlungen verändert werden:
- Wenn `totalPaid ≥ Total` → Status bleibt/wird `Paid`
- Wenn `totalPaid < Total` und Status war `Paid` → Status wird auf `Sent` zurückgesetzt

**Bekanntes Problem:** Die Neuberechnung beim Löschen/Ändern einer Zahlung ist im Handler implementiert, aber es fehlt die Prüfung in einigen Edge Cases (z.B. Payment Update ohne InvoiceId-Änderung).

### 11.3 Auto-Booking

Beim Markieren als "bezahlt" (`MarkPaymentAsPaidCommandHandler`):
1. Payment wird geladen
2. Periodensperre wird geprüft
3. Schwellwert wird geprüft (wenn FinanceProfile vorhanden)
4. `Payment.MarkAsPaid()` wird aufgerufen
5. Wenn `TransactionId = null`: `AutoBookingService.CreateTransactionForPaymentAsync()` erstellt automatisch eine Buchung:
   - Typ: `Income` wenn `Direction = Income`, `Expense` wenn `Direction = Expense`
   - Beschreibung: Referenz zum Payment
   - Verknüpfung: `Payment.TransactionId` wird gesetzt

---

## 12. Bankimport und Kontoabgleich

### 12.1 CSV-Import

Der CSV-Import erwartet **Client-seitig geparste Daten** (kein Server-seitiges CSV-Parsing):
- Frontend parst die CSV-Datei und sendet strukturierte JSON-Daten an `POST /api/v1/finance/bank-imports`
- Jede Zeile enthält: Datum, Beschreibung, Betrag, IBAN, Referenz

### 12.2 camt-Import (ISO 20022)

Der camt-Import verarbeitet **server-seitig** XML-Dateien:
1. Upload via `POST /api/v1/finance/bank-imports/camt` (multipart/form-data)
2. **CamtParser** erkennt automatisch camt.053 (Statement) oder camt.054 (Notification)
3. Unterstützt Namespace-Versionen .001.02 bis .001.08
4. Pro Eintrag (`Ntry`) werden extrahiert:
   - Buchungsdatum, Betrag, Währung, Kredit/Debit-Indikator
   - References: EndToEndId, CreditorReference
   - RemittanceInfo (Verwendungszweck)
   - Debtor/Creditor Name und IBAN
5. **BankImportMatcher** führt automatisches Matching durch
6. Jedes Item erhält `SuggestedInvoiceId` und `MatchConfidence`

### 12.3 Auto-Match-Logik

Der `BankImportMatcher` iteriert über alle ungematchten Items und vergleicht sie mit allen offenen Rechnungen. **Es wird immer der Match mit der höchsten Konfidenz genommen.** Bei einem perfekten Match (Konfidenz 1.0 = EndToEndId) wird die Suche für dieses Item sofort abgebrochen.

---

## 13. Mahnwesen

### 13.1 Mahnungserstellung

- Mahnungen werden manuell erstellt (kein automatischer Mahnlauf)
- Die Mahnstufe (1-3) muss angegeben werden (das Frontend schlägt die nächste Stufe automatisch vor)
- Ein Fälligkeitsdatum muss angegeben werden
- Es werden bis zu 3 Mahnungen pro Rechnung unterstützt

### 13.2 Mahnungsversand

- `POST /{id}/send` ändert den Status von `Created` auf `Sent` und setzt `SentAt`
- **Es wird kein E-Mail versendet** — der tatsächliche Versand muss manuell erfolgen
- Das ist ein bekannter offener Punkt

### 13.3 Bekannte Einschränkung

- `DunningNotice.Create()` prüft **nicht**, ob die verknüpfte Rechnung tatsächlich überfällig ist
- Es gibt keinen automatischen Scheduled Job, der Rechnungen als "überfällig" markiert

---

## 14. Belegmanagement

### 14.1 Upload-Prozess

1. Frontend sendet Datei via `POST /api/v1/finance/receipts` (multipart/form-data)
2. **UploadReceiptCommandValidator** prüft: Datei vorhanden
3. **UploadReceiptCommandHandler**:
   - Ruft `IFinanceDocumentStorage.ValidateFile()` auf:
     - Erlaubte Typen: PDF, JPEG, PNG, GIF, TIFF, BMP, WEBP
     - Maximale Größe: konfigurierbar
   - `IFinanceDocumentStorage.UploadReceiptAsync()`:
     - Berechnet SHA256-Hash der Datei
     - Speichert in S3/RustFS unter `finance-documents/receipts/{receiptId}/{filename}`
     - Gibt `StoragePath`, `FileHash`, `FileSize` zurück
   - Erstellt Receipt-Entity mit Metadaten
   - Aktualisiert Storage-Metadaten auf der Entity

### 14.2 Download

- `GET /api/v1/finance/receipts/{id}/download`
- Liest die Datei aus S3/RustFS und streamt sie zum Client
- Content-Type und Dateiname werden aus der Receipt-Entity übernommen

### 14.3 Löschung

- Soft-Delete auf der Receipt-Entity
- Physische Datei wird aus S3/RustFS gelöscht

---

## 15. Spesenabrechnung (Expense Claims)

### 15.1 Erstellung

- Mitglied erstellt einen ExpenseClaim mit Titel, Beschreibung, Betrag, Datum
- Optional: Beleg (Receipt) anhängen
- Status beginnt bei `Draft`

### 15.2 Workflow-Rollen

| Schritt | Auslöser | Berechtigung |
|---|---|---|
| Erstellen/Bearbeiten | Antragsteller | FinanceWrite |
| Einreichen (Submit) | Antragsteller | FinanceWrite |
| Prüfung (Review) | Kassier | FinanceWrite |
| Genehmigung (Approve) | Vorstand | FinanceWrite |
| Ablehnung (Reject) | Kassier oder Vorstand | FinanceWrite |
| Erstattung (Reimburse) | Kassier | FinanceWrite |

### 15.3 Erstattung

Bei `Reimburse()`:
1. Ein Payment wird erstellt (Direction: Expense, Status: Paid)
2. Eine Buchung wird automatisch erstellt (Typ: Expense)
3. `ExpenseClaim.PaymentId` wird gesetzt
4. Status wechselt zu `Reimbursed`

---

## 16. Geschäftsperioden (Fiscal Periods)

### 16.1 Generierung

- `POST /api/v1/finance/fiscal-periods/generate` generiert alle 12 Monate eines Jahres
- `FiscalYearStartMonth` aus dem FinanceProfile bestimmt den Startmonat
- Jede Periode: `StartDate = Erster Tag des Monats`, `EndDate = Letzter Tag`

### 16.2 Status-Übergänge

| Aktion | Von | Nach | Effekt |
|---|---|---|---|
| `Lock(lockedBy, notes?)` | Open/Closed | **Locked** | Keine Mutationen erlaubt |
| `Unlock(unlockedBy)` | Locked | **Open** | Mutationen wieder erlaubt |
| `Close(closedBy, totals, notes?)` | Open | **Closed** | Soft-Close, Totals gespeichert |
| `Reopen(reopenedBy)` | Closed | **Open** | Totals gelöscht |

### 16.3 Enforcement

`FiscalPeriodService.EnsurePeriodNotLockedAsync(date)`:
- Sucht die Periode, die das gegebene Datum enthält
- Wenn keine Periode existiert: **Erlaubt** (keine Einschränkung)
- Wenn Periode `Status = Locked`: **Wirft InvalidOperationException**
- Wenn Periode `Status = Closed`: **Erlaubt** (nur Warnung im UI)
- Wenn Periode `Status = Open`: **Erlaubt**

---

## 17. Aktivitätsbereiche (Activity Areas)

### 17.1 Zweck

Aktivitätsbereiche ermöglichen eine **dimensionale Zuordnung** von Buchungen und Rechnungspositionen zu logischen Vereinsbereichen (z.B. "Events", "Administration", "Jugendarbeit").

### 17.2 Verwendung

- `Transaction.ActivityAreaId` → Buchung einem Bereich zuordnen
- `InvoiceItem.ActivityAreaId` → Rechnungsposition einem Bereich zuordnen
- `GET /api/v1/finance/activity-areas/report?from=&to=` → P&L-Report pro Bereich:
  - Einnahmen pro Bereich
  - Ausgaben pro Bereich
  - Saldo pro Bereich
  - Filterbar nach Zeitraum

### 17.3 Export

Die Journal-CSV-Datei enthält die Spalten `ActivityAreaId` und `ActivityAreaCode` pro Buchung.

---

## 18. Exporte

### 18.1 Buchungsjournal (Journal-CSV)

**Route:** `GET /api/v1/finance/exports/journal?from=&to=`

**CSV-Spalten:**
```
Date;Description;Amount;Type;AccountId;CategoryId;Reference;Notes;ActivityAreaId;ActivityAreaCode
```

- Semikolon-separiert
- Datumswerte im Format `yyyy-MM-dd`
- Beträge mit 2 Dezimalstellen (Punkt als Dezimaltrennzeichen)
- CSV-Escaping: Werte mit Semikolon, Anführungszeichen oder Zeilenumbruch werden in Anführungszeichen gesetzt
- Audit-Logging des Exports

### 18.2 Offene Posten (Open Items CSV)

**Route:** `GET /api/v1/finance/exports/open-items`

Listet alle Rechnungen mit Status `Sent` oder `Overdue` als CSV.

### 18.3 MwSt-Zusammenfassung (VAT Summary CSV)

**Route:** `GET /api/v1/finance/exports/vat-summary?from=&to=`

**CSV-Spalten:**
```
Period;TaxCodeId;TaxRate;NetAmount;TaxAmount;GrossAmount;TransactionCount
```

- Gruppiert alle Buchungen nach Steuersatz
- Nur Buchungen mit zugewiesenem TaxCode
- Netto/Steuer/Brutto pro Gruppe

---

## 19. PDF-Generierung und Swiss QR-Rechnung

### 19.1 Basis-PDF (QuestPDF)

**Bibliothek:** QuestPDF (Open-Source .NET PDF-Generator)

**Layout:**
1. **Header:** Organisationsname (18pt, fett), Adresse, E-Mail, Logo-Platzhalter
2. **Rechnungstitel:** "Invoice INV-YYYY-NNNN" (20pt, fett)
3. **Metadaten (2-spaltig):**
   - Links: Rechnungsdatum, Fälligkeitsdatum, Status
   - Rechts: Empfängername, Adresse, Typ
4. **Positionstabelle:**
   - Ohne MwSt: Description | Qty | Unit Price | Amount
   - Mit MwSt: Description | Qty | Unit Price | Net | Tax % | Tax | Gross
   - Alternating Row Colors (weiß/hellgrau)
5. **Totals:**
   - Mit MwSt: Net Subtotal, Total Tax, Total
   - Ohne MwSt: Subtotal, Tax (x%), Total
6. **VAT Summary** (wenn MwSt-Daten vorhanden): Tabelle gruppiert nach Steuersatz
7. **EU-Compliance-Notizen** (wenn InvoiceTemplate vorhanden)
8. **Footer:** Zahlungsanweisungen, IBAN/BIC/Bankname, Organisationsreferenz, Seitenzahlen

### 19.2 Swiss QR-Bill

**Bibliothek:** Codecrete.SwissQRBill.Generator

**Funktionsweise:**
1. `InvoicePdfGeneratorFactory` erkennt CH-Jurisdiktion + IBAN → wählt `SwissQrBillInvoiceGenerator`
2. Generiert normalen Rechnungsinhalt (erbt von Base)
3. Überschreibt `ComposeAdditionalSections()`:
   - Neue Seite (PageBreak)
   - Gestrichelte Trennlinie
   - QR-Zahlteil als PNG-Bild

**QR-Bill-Inhalt:**
| Feld | Wert |
|---|---|
| IBAN | Aus FinanceProfile.BankIban |
| Betrag | Invoice.Total |
| Währung | FinanceProfile.Currency (CHF/EUR) |
| Empfänger (Kreditor) | Organisationsname + Adresse aus FinanceProfile |
| Zahlungspflichtiger (Debitor) | Rechnungsempfänger (Name) |
| Referenz | QR-Referenz oder ISO 11649 (je nach IBAN-Typ) |
| Unstrukturierte Nachricht | "Invoice INV-YYYY-NNNN" |
| Sprache | Deutsch |
| Format | PNG, nur QR-Bill (nicht A4) |
| Trennlinie | Gestrichelt mit Schere |

**Referenz-Generierung (`SwissQrReferenceHelper`):**
- **QR-IBAN** (beginnt mit 30/31 nach Clearing): QR-Referenz (26 Ziffern + 1 Prüfziffer = 27 Ziffern), numerisch aus Rechnungsnummer extrahiert
- **Normal-IBAN**: Creditor Reference ISO 11649 (Format: "RF" + 2 Prüfziffern + max. 21 alphanumerische Zeichen)

---

## 20. eInvoice / Elektronische Rechnung (UBL 2.1)

### 20.1 Standard

**EN 16931** — Europäische Norm für die elektronische Rechnungsstellung  
**UBL 2.1** — OASIS Universal Business Language (Syntax-Binding)

### 20.2 Implementierung

**Klasse:** `UblInvoiceExporter` (implementiert `IEInvoiceExporter`)

Generiert ein XML-Dokument mit folgender Struktur (BT = Business Term aus EN 16931):

| BT/BG | Feld | Quelle |
|---|---|---|
| BT-1 | Invoice number | `InvoiceNumber` |
| BT-2 | Issue date | `Date` |
| BT-3 | Invoice type code | "380" (Commercial Invoice) |
| BT-5 | Currency | FinanceProfile.Currency |
| BT-9 | Due date | `DueDate` |
| BT-20 | Payment terms | `PaymentTerms` |
| BT-22 | Notes | `Notes` |
| BT-24 | Spec identifier | "urn:cen.eu:en16931:2017" |
| **BG-4** | **Seller** | FinanceProfile |
| BT-27 | Seller name | OrganizationName |
| BT-31 | Seller VAT ID | VatNumber |
| BT-30 | Registration name | OrganizationName |
| BT-42 | Contact email | OrganizationEmail |
| **BG-7** | **Buyer** | Invoice |
| BT-44 | Buyer name | RecipientName |
| **BG-16** | **Payment means** | |
| BT-81 | Code | 58 (SEPA) / 30 (Credit Transfer) |
| BT-83 | Remittance info | InvoiceNumber |
| **BG-17** | **Bank account** | BankIban, BankBic, BankName |
| **BG-22** | **Totals** | |
| BT-106 | Net total | SubtotalNet |
| BT-109 | Tax-exclusive total | SubtotalNet |
| BT-112 | Tax-inclusive total | Total |
| BT-115 | Payable amount | Total |
| **BG-23** | **VAT breakdown** | Gruppiert nach TaxRate |
| **BG-25** | **Invoice lines** | Pro InvoiceItem |
| BT-126 | Line ID | Laufende Nummer |
| BT-129 | Quantity | Quantity (unitCode: C62) |
| BT-131 | Line net amount | NetAmount |
| BT-153 | Item name | Description |

### 20.3 VAT Category Codes

Die Zuordnung erfolgt über den TaxCode:

| Bedingung | Code | Bedeutung |
|---|---|---|
| Rate > 0 | **S** | Standard rate |
| Rate = 0 | **Z** | Zero rated |
| Code enthält "EXEMPT"/"BEFREIT" | **E** | Exempt |
| Code enthält "REVERSE"/"RC" | **AE** | Reverse charge |

### 20.4 Feature-Flag

Die eInvoice-Funktion ist über ein Feature-Flag gesteuert (`eInvoice: true/false` in der API-Konfiguration). Wenn deaktiviert, gibt der Endpunkt `404 Not Found` zurück.

---

## 21. Finance-Dashboard

### 21.1 KPI-Daten

Der Dashboard-Endpunkt (`GET /api/v1/finance/dashboard`) aggregiert folgende Kennzahlen:

| KPI | Berechnung | Quelle |
|---|---|---|
| **TotalIncome** | Summe aller Einnahmen-Buchungen | TransactionRepository.GetSummaryAsync() |
| **TotalExpense** | Summe aller Ausgaben-Buchungen | TransactionRepository.GetSummaryAsync() |
| **Balance** | TotalIncome - TotalExpense | Berechnet |
| **InvoicesTotalOutstanding** | Summe aller offenen Rechnungen | InvoiceRepository.GetOpenItemsAsync() |
| **InvoicesOverdueCount** | Anzahl überfälliger Rechnungen | Gefiltert: Status = Overdue |
| **InvoicesOverdueAmount** | Summe überfälliger Rechnungen | Gefiltert: Status = Overdue |
| **InvoicesOpenCount** | Anzahl offener Rechnungen | Sent + Overdue |
| **PaymentsTotalPending** | Summe nicht-bezahlter Zahlungen | Nicht Paid und nicht Rejected |
| **PaymentsTotalPaid** | Summe bezahlter Zahlungen | Status = Paid |
| **PaymentsPendingCount** | Anzahl nicht-bezahlter Zahlungen | Nicht Paid und nicht Rejected |
| **ExpenseClaimsTotalPending** | Summe offener Spesenanträge | Nicht Reimbursed und nicht Rejected |
| **ExpenseClaimsTotalReimbursed** | Summe erstatteter Spesen | Status = Reimbursed |
| **ExpenseClaimsPendingCount** | Anzahl offener Spesenanträge | Nicht Reimbursed und nicht Rejected |
| **CurrentFiscalPeriod** | Name der aktuellen Periode | FiscalPeriodRepository.GetByDateAsync(now) |
| **CurrentPeriodStatus** | Status der aktuellen Periode | Open/Closed/Locked |

---

## 22. Sicherheit und Berechtigungen

### 22.1 Autorisierungspolicies

Alle Finance-Endpunkte sind über zwei Policies geschützt:

| Policy | Erlaubte Rollen | Verwendung |
|---|---|---|
| `RequireFinanceRead` | Admin, Kassier, Auditor | Alle GET-Endpunkte |
| `RequireFinanceWrite` | Admin, Kassier | Alle POST/PUT/DELETE-Endpunkte |

### 22.2 Benutzerzuordnung

Der aktuell angemeldete Benutzer wird aus dem JWT-Token extrahiert:
```csharp
ctx.User.FindFirst("preferred_username")?.Value
?? ctx.User.FindFirst(ClaimTypes.Email)?.Value
?? "system"
```

Dieser Name wird in `CreatedBy`, `UpdatedBy`, `LockedBy` etc. gespeichert.

### 22.3 Frontend-Schutz

Alle Finance-Seiten prüfen `canReadFinance` / `canWriteFinance` und zeigen bei fehlendem Zugriff eine "Kein Zugriff"-Meldung.

---

## 23. Audit-Trail

### 23.1 Audit-Events

Jede finanzrelevante Aktion wird über `IAuditService.LogActionAsync()` protokolliert:

| Event-Typ | Geschrieben bei |
|---|---|
| `FinanceCreated` | Erstellen von Konten, Kategorien, Buchungen, Rechnungen, Zahlungen, Mahnungen, Belegen, Spesen, Perioden, TaxCodes, Templates, ActivityAreas |
| `FinanceUpdated` | Aktualisieren von Entitäten, MarkAsPaid |
| `FinanceDeleted` | Löschen (Soft-Delete) |
| `FinanceStatusChanged` | Statuswechsel (Invoice Sent, Cancel, Lock/Unlock Period etc.) |
| `FinanceExported` | CSV-Export (Journal, Open Items, VAT Summary) |

### 23.2 Audit-Daten

Jeder Audit-Eintrag enthält:
- Event-Typ
- Beschreibung (menschenlesbar)
- Entity-Typ (z.B. "Invoice")
- Entity-ID
- Zeitstempel
- Benutzer

---

## 24. Bekannte Einschränkungen und offene Punkte

### 24.1 Fachliche Einschränkungen

| Thema | Beschreibung | Priorität |
|---|---|---|
| **Keine doppelte Buchführung** | Das System ist eine Einnahmen-Ausgaben-Rechnung, KEIN doppeltes Buchführungssystem (Soll/Haben) | Design-Entscheidung |
| **Kein automatischer Mahnlauf** | Rechnungen werden nicht automatisch als "überfällig" markiert | Mittel |
| **Kein E-Mail-Versand bei Mahnungen** | "Senden" ändert nur den Status, versendet keine E-Mail | Mittel |
| **Keine Teilzahlungs-Tracking** | Es gibt kein "Restzahlung"-Feld auf der Rechnung (wird über Summe aller Payments berechnet) | Design-Entscheidung |
| **Budget/Kostenstellen** | REQ-044 ist nicht implementiert | Backlog |
| **Kein Bearbeitungs-UI für bestehende Rechnungen** | Nur Draft-Rechnungen können via API bearbeitet werden, kein Frontend-Editor für Änderungen | Mittel |

### 24.2 Technische Einschränkungen

| Thema | Beschreibung | Priorität |
|---|---|---|
| **Race Condition bei Rechnungsnummern** | Kein DB-Level-Lock bei `GetNextInvoiceNumberAsync()` | Mittel |
| **Keine Paginierung** | Alle Listen-Endpunkte laden alle Daten | Mittel |
| **CSV-Parsing client-seitig** | Bankimport-CSV wird im Browser geparst | Niedrig |
| **MwSt-Berechnung nur Brutto→Netto bei Buchungen** | Bei Transactions wird IMMER vom Brutto herausgerechnet (kein Umschalten auf Nettoeingabe wie bei InvoiceItems) | Fachlich zu prüfen |
| **Frontend: Inline API-Calls** | Kein dedizierter Finance-API-Service, alle Calls inline in Komponenten | Qualität |
| **Mahnung ohne Überfälligkeits-Check** | `DunningNotice.Create()` prüft nicht den Invoice-Status | Mittel |

### 24.3 Fehlende API-Endpunkte (Domain-Methoden existieren)

| Feature | Domain-Methode | API-Endpunkt |
|---|---|---|
| Rechnungs-Überfälligkeits-Markierung | `Invoice.MarkAsOverdue()` | Fehlt (braucht Scheduled Job) |
| Konto aktivieren/deaktivieren | `Account.Activate()/Deactivate()` | Fehlt |
| Kategorie aktivieren/deaktivieren | `Category.Activate()/Deactivate()` | Fehlt |
| Bank-Import-Item unmatch | `BankImportItem.Unmatch()` | Fehlt |
| Mahnungen nach Rechnung filtern | `IDunningNoticeRepository.GetByInvoiceIdAsync()` | Fehlt |

---

## 25. Bewertungs-Checkliste für Reviewer

### Für den Finanzexperten

- [ ] Ist die Einnahmen-Ausgaben-Rechnung als Grundansatz für einen Verein geeignet?
- [ ] Ist die MwSt-Berechnung (Herausrechnung aus Brutto bei Transactions) fachlich korrekt?
- [ ] Ist die duale Netto/Brutto-Eingabe bei Rechnungspositionen korrekt umgesetzt?
- [ ] Sind die Swiss QR-Referenz- und ISO 11649-Generierung korrekt?
- [ ] Ist der 5-stufige Bankimport-Matching-Algorithmus sinnvoll?
- [ ] Ist der Zahlungs-Freigabe-Workflow (Schwellwert-basiert) für einen Verein angemessen?
- [ ] Ist der 6-stufige Spesen-Workflow (Draft→Submitted→UnderReview→Approved→Reimbursed) angemessen oder zu komplex?
- [ ] Ist die Periodensperre (Open/Closed/Locked) fachlich korrekt?
- [ ] Ist die Rechnungs-Stornierung mit Gegenbuchung korrekt?
- [ ] Sind die Exportformate (Journal-CSV, Offene-Posten-CSV, MwSt-Summary-CSV) für einen Steuerberater brauchbar?
- [ ] Fehlen fachlich relevante Features?

### Für den Entwickler

- [ ] Ist die Clean Architecture (Domain → Application → Infrastructure → API) sauber umgesetzt?
- [ ] Ist das CQRS-Pattern mit MediatR korrekt angewendet?
- [ ] Sind die Entity-Validierungen (Factory-Methods, private Setter) konsistent?
- [ ] Ist das Soft-Delete-Pattern korrekt implementiert?
- [ ] Ist die MwSt-Berechnung mathematisch korrekt (Rundung auf 2 Dezimalstellen)?
- [ ] Ist die Rechnungsnummern-Generierung (Race Condition) ein akzeptables Risiko?
- [ ] Ist das Template Method Pattern für PDF-Generierung (Base + Swiss QR-Bill) sauber?
- [ ] Ist der UBL 2.1 eInvoice-Export EN 16931-konform?
- [ ] Ist die Periodensperre in allen relevanten Handlers implementiert?
- [ ] Sind die 420+ Unit-Tests ausreichend?
- [ ] Ist die fehlende Paginierung ein Problem für die erwartete Datenmenge?
- [ ] Ist das Frontend (inline API-Calls, keine Service-Layer) akzeptabel oder technische Schuld?

---

> **Zusammenfassung:** Das Finanzmodul ist umfangreich implementiert mit 16 Domain-Entities, ~210 CQRS-Dateien, 420+ Unit-Tests, vollständiger Frontend-Abdeckung und erweiterten Features (Swiss QR-Bill, eInvoice UBL 2.1, Periodensperre, Spesen-Workflow, camt-Import). Die größten offenen Punkte sind: fehlender automatischer Mahnlauf, keine Paginierung, Race Condition bei Rechnungsnummern und fehlendes E-Mail-Versand bei Mahnungen.
