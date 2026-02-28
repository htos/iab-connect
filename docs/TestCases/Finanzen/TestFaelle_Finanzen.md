# Testfälle Finanzmodul — IAB Connect

> **Stand:** 28.02.2026  
> **Version:** 1.0  
> **Umfang:** Sämtliche Finanzfunktionen (Backend-API + Frontend-UI)  
> **Zielgruppe:** Manuelle Tester, QA, Projektleitung

---

## Inhaltsverzeichnis

1. [Voraussetzungen & Test-Umgebung](#1-voraussetzungen--test-umgebung)
2. [Testdaten & Benutzer](#2-testdaten--benutzer)
3. [TC-FP: Finanzprofil](#3-tc-fp-finanzprofil)
4. [TC-KO: Konten (Accounts)](#4-tc-ko-konten-accounts)
5. [TC-KA: Kategorien (Categories)](#5-tc-ka-kategorien-categories)
6. [TC-ST: Steuercodes (Tax Codes)](#6-tc-st-steuercodes-tax-codes)
7. [TC-BU: Buchungen (Transactions)](#7-tc-bu-buchungen-transactions)
8. [TC-RE: Rechnungen (Invoices)](#8-tc-re-rechnungen-invoices)
9. [TC-ZA: Zahlungen (Payments)](#9-tc-za-zahlungen-payments)
10. [TC-SP: Spesenabrechnung (Expense Claims)](#10-tc-sp-spesenabrechnung-expense-claims)
11. [TC-BI: Bankimport](#11-tc-bi-bankimport)
12. [TC-MA: Mahnwesen (Dunning)](#12-tc-ma-mahnwesen-dunning)
13. [TC-BE: Belege (Receipts)](#13-tc-be-belege-receipts)
14. [TC-GP: Geschäftsperioden (Fiscal Periods)](#14-tc-gp-geschäftsperioden-fiscal-periods)
15. [TC-RV: Rechnungsvorlagen (Invoice Templates)](#15-tc-rv-rechnungsvorlagen-invoice-templates)
16. [TC-TB: Tätigkeitsbereiche (Activity Areas)](#16-tc-tb-tätigkeitsbereiche-activity-areas)
17. [TC-DB: Dashboard](#17-tc-db-dashboard)
18. [TC-EX: Exporte](#18-tc-ex-exporte)
19. [TC-AR: Archivierung & Aufbewahrung (REQ-070)](#19-tc-ar-archivierung--aufbewahrung-req-070)
20. [TC-RN: Rechnungsnummern (REQ-071)](#20-tc-rn-rechnungsnummern-req-071)
21. [TC-EI: eInvoice Validierung (REQ-072)](#21-tc-ei-einvoice-validierung-req-072)
22. [TC-PA: pain.001 Export (REQ-073)](#22-tc-pa-pain001-export-req-073)
23. [TC-PDF: PDF-Erzeugung & Swiss QR-Bill](#23-tc-pdf-pdf-erzeugung--swiss-qr-bill)
24. [TC-BJ: Hintergrundjobs (Background Jobs)](#24-tc-bj-hintergrundjobs-background-jobs)
25. [TC-AU: Berechtigungen & Sicherheit (Authorization)](#25-tc-au-berechtigungen--sicherheit-authorization)
26. [TC-PA: Paginierung & Sortierung](#26-tc-pg-paginierung--sortierung)
27. [TC-SD: Soft-Delete Verhalten](#27-tc-sd-soft-delete-verhalten)
28. [TC-FE: Frontend Spezifisch](#28-tc-fe-frontend-spezifisch)

---

## 1. Voraussetzungen & Test-Umgebung

### Systemstart

```bash
# 1. Infrastruktur starten (Docker)
cd infra
docker compose up -d

# 2. Backend starten
cd backend
dotnet run --project src/IabConnect.Api

# 3. Frontend starten
cd frontend
npm run dev
```

### URLs

| Dienst | URL |
|--------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:5000 |
| Swagger UI | http://localhost:5000/swagger |
| Keycloak Admin | http://localhost:8080 (admin/admin) |
| PostgreSQL | localhost:5433 (postgres/postgres, DB: iabconnect) |
| RustFS (S3) Console | http://localhost:9001 |
| MailHog (E-Mail) | http://localhost:8025 |
| Seq (Logs) | http://localhost:5341 |

### Token holen (PowerShell)

```powershell
$body = @{
    grant_type    = "password"
    client_id     = "iabconnect-api"
    client_secret = "dev-secret-change-me"
    username      = "admin@iabconnect.ch"
    password      = "Admin-Dev-2026!"
}
$response = Invoke-RestMethod -Uri "http://localhost:8080/realms/iabconnect/protocol/openid-connect/token" -Method POST -Body $body
$TOKEN = $response.access_token
# Verwenden: -Headers @{ Authorization = "Bearer $TOKEN" }
```

---

## 2. Testdaten & Benutzer

| Benutzer | E-Mail | Passwort | Rollen | Finanzzugriff |
|----------|--------|----------|--------|---------------|
| Admin | admin@iabconnect.ch | `Admin-Dev-2026!` | admin, vorstand, member | Lesen + Schreiben + Admin |
| Kassier | kassier@iabconnect.ch | `Kassier-Dev-2026!` | kassier | Lesen + Schreiben |
| Auditor | auditor@iabconnect.ch | `Auditor-Dev-2026!` | auditor | Nur Lesen |
| Vorstand | vorstand@iabconnect.ch | `Vorstand-Dev-2026!` | vorstand, member | ❌ Kein Zugriff |
| Mitglied | member@iabconnect.ch | `Member-Dev-2026!` | member | ❌ Kein Zugriff |

> **Hinweis:** Kassier und Auditor müssen ggf. in Keycloak manuell angelegt werden.

---

## 3. TC-FP: Finanzprofil

### TC-FP-001: Finanzprofil erstellen (CH)

| Feld | Wert |
|------|------|
| **ID** | TC-FP-001 |
| **Titel** | Finanzprofil für Schweizer Verein erstellen |
| **Voraussetzung** | Eingeloggt als Admin/Kassier, kein Profil vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Einstellungen → Profil**
2. Fülle aus:
   - Rechtsraum: **CH**
   - Währung: **CHF**
   - Geschäftsjahresbeginn: **Januar (1)**
   - Organisation: "IAB Kulturverein"
   - Adresse: "Musterstrasse 1", PLZ "8001", Ort "Zürich", Land "CH"
   - UID: "CHE-123.456.789"
   - MwSt-Status: **Registriert**
   - MwSt-Nr: "CHE-123.456.789 MWST"
   - Bank: "PostFinance", IBAN: "CH93 0076 2011 6238 5295 7", BIC: "POFICHBEXXX"
   - Genehmigungsschwelle: 500.00 CHF
3. Speichern

**Erwartetes Ergebnis:**
- Profil wird erstellt
- Profil ist aktiv (IsActive = true)
- Alle Felder korrekt gespeichert
- Profil wird auf der Übersichtsseite angezeigt

---

### TC-FP-002: Finanzprofil erstellen (EU)

| Feld | Wert |
|------|------|
| **ID** | TC-FP-002 |
| **Titel** | Finanzprofil für EU-Verein erstellen |
| **Voraussetzung** | Eingeloggt als Admin/Kassier, kein Profil vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Einstellungen → Profil**
2. Fülle aus:
   - Rechtsraum: **EU**
   - Ländercode: **DE**
   - Währung: **EUR**
   - Geschäftsjahresbeginn: **Januar (1)**
   - Organisation: "Indischer Kulturverein e.V."
   - Adresse: "Berliner Str. 10", PLZ "10115", Ort "Berlin", Land "DE"
   - UID: "DE123456789"
   - MwSt-Status: **Registriert**
   - MwSt-Nr: "DE123456789"
   - Bank: "Deutsche Bank", IBAN: "DE89 3704 0044 0532 0130 00", BIC: "COBADEFFXXX"
   - Genehmigungsschwelle: 500.00 EUR
3. Speichern

**Erwartetes Ergebnis:**
- Profil wird erstellt mit Jurisdiction = EU
- CountryCode = "DE"
- Alle EU-spezifischen Felder korrekt gespeichert

---

### TC-FP-003: Finanzprofil aktualisieren

| Feld | Wert |
|------|------|
| **ID** | TC-FP-003 |
| **Titel** | Bestehendes Profil ändern |
| **Voraussetzung** | Profil existiert |
| **Priorität** | Mittel |

**Schritte:**

1. Navigiere zu **Finanzen → Einstellungen → Profil**
2. Ändere den Organisationsnamen auf "IAB Kulturverein Zürich"
3. Ändere die Genehmigungsschwelle auf 1000.00
4. Speichern

**Erwartetes Ergebnis:**
- Änderungen werden übernommen
- Alte Werte sind überschrieben
- Keine Neuanlage, sondern Update

---

### TC-FP-004: Nur ein aktives Profil erlaubt

| Feld | Wert |
|------|------|
| **ID** | TC-FP-004 |
| **Titel** | Zweites Profil deaktiviert das bestehende automatisch |
| **Voraussetzung** | Ein aktives Profil existiert bereits |
| **Priorität** | Hoch |

**Schritte:**

1. Via API: `POST /api/v1/finance/profile` mit neuem Profil (anderes Jurisdiction)
2. Prüfe Antwort und altes Profil

**Erwartetes Ergebnis:**
- HTTP 200 — neues Profil wird erfolgreich erstellt
- Das **vorherige Profil** wird automatisch **deaktiviert** (IsActive = false)
- Nur das neue Profil ist aktiv
- ⚠️ Es kommt KEIN 400/409 Fehler — das System erlaubt den Wechsel

---

## 4. TC-KO: Konten (Accounts)

### TC-KO-001: Konto erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-KO-001 |
| **Titel** | Neues Finanzkonto erstellen |
| **Voraussetzung** | Eingeloggt als Admin/Kassier |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Konten**
2. Klicke "Neues Konto"
3. Fülle aus:
   - Name: "Vereinskasse"
   - Nummer: "1000"
   - Typ: **Cash**
   - Beschreibung: "Bargeldkasse des Vereins"
4. Speichern

**Erwartetes Ergebnis:**
- Konto wird in der Kontenliste angezeigt
- Typ = Cash, IsActive = true
- ID (GUID) wurde vergeben

---

### TC-KO-002: Bankkonto erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-KO-002 |
| **Titel** | Bankkonto erstellen |
| **Voraussetzung** | Eingeloggt als Admin/Kassier |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle ein Konto mit:
   - Name: "PostFinance Geschäft"
   - Nummer: "1020"
   - Typ: **Bank**
   - Beschreibung: "Geschäftskonto PostFinance"
2. Speichern

**Erwartetes Ergebnis:**
- Bankkonto in Liste sichtbar mit Typ = Bank

---

### TC-KO-003: Konto aktualisieren

| Feld | Wert |
|------|------|
| **ID** | TC-KO-003 |
| **Titel** | Kontoname und Beschreibung ändern |
| **Voraussetzung** | Konto "Vereinskasse" existiert |
| **Priorität** | Mittel |

**Schritte:**

1. Klicke auf Konto "Vereinskasse" → Bearbeiten
2. Ändere Name auf "Hauptkasse"
3. Ändere Beschreibung auf "Hauptkasse für Vereinsanlässe"
4. Speichern

**Erwartetes Ergebnis:**
- Name und Beschreibung aktualisiert
- Kontonummer unverändert

---

### TC-KO-004: Konto deaktivieren

| Feld | Wert |
|------|------|
| **ID** | TC-KO-004 |
| **Titel** | Konto deaktivieren |
| **Voraussetzung** | Aktives Konto vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. Via API: `POST /api/v1/finance/accounts/{id}/deactivate`  
   oder in der UI: Konto auswählen → "Deaktivieren"
2. Prüfe Kontostatus

**Erwartetes Ergebnis:**
- Konto IsActive = false
- Konto wird in Dropdown-Listen für neue Buchungen nicht mehr angezeigt (optional)
- Bestehende Buchungen mit diesem Konto bleiben bestehen

---

### TC-KO-005: Konto aktivieren

| Feld | Wert |
|------|------|
| **ID** | TC-KO-005 |
| **Titel** | Deaktiviertes Konto wieder aktivieren |
| **Voraussetzung** | Deaktiviertes Konto vorhanden (TC-KO-004) |
| **Priorität** | Mittel |

**Schritte:**

1. Via API: `POST /api/v1/finance/accounts/{id}/activate`
2. Prüfe Kontostatus

**Erwartetes Ergebnis:**
- Konto IsActive = true
- Konto wieder in Dropdown-Listen verfügbar

---

### TC-KO-006: Konto löschen (Soft-Delete)

| Feld | Wert |
|------|------|
| **ID** | TC-KO-006 |
| **Titel** | Konto löschen |
| **Voraussetzung** | Konto ohne aktive Referenzen |
| **Priorität** | Mittel |

**Schritte:**

1. Konto "Hauptkasse" auswählen → Löschen
2. Bestätigen
3. Prüfe Kontenliste

**Erwartetes Ergebnis:**
- Konto verschwindet aus der Liste
- In der Datenbank: `is_deleted = true`, `deleted_at` gesetzt
- Konto wird durch den Global Query Filter ausgeblendet

---

### TC-KO-007: Konto mit doppelter Nummer ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-KO-007 |
| **Titel** | Doppelte Kontonummer wird abgelehnt |
| **Voraussetzung** | Konto mit Nummer "1000" existiert |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle ein neues Konto mit Nummer "1000"
2. Speichern

**Erwartetes Ergebnis:**
- Fehlermeldung: Kontonummer existiert bereits (Unique Index Verletzung)
- Konto wird nicht erstellt

---

### TC-KO-008: Pflichtfelder validieren

| Feld | Wert |
|------|------|
| **ID** | TC-KO-008 |
| **Titel** | Konto ohne Name/Nummer ablehnen |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Konto mit leerem Namen → Speichern
2. Erstelle Konto mit leerer Nummer → Speichern

**Erwartetes Ergebnis:**
- Validierungsfehler für fehlenden Namen
- Validierungsfehler für fehlende Nummer

---

## 5. TC-KA: Kategorien (Categories)

### TC-KA-001: Einnahmekategorie erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-KA-001 |
| **Titel** | Neue Einnahmekategorie erstellen |
| **Voraussetzung** | Eingeloggt als Admin/Kassier |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Kategorien**
2. Klicke "Neue Kategorie"
3. Fülle aus:
   - Name: "Mitgliedsbeiträge"
   - Typ: **Income**
   - Farbe: "#22c55e" (Grün)
4. Speichern

**Erwartetes Ergebnis:**
- Kategorie wird angezeigt mit grünem Farbpunkt
- Typ = Income

---

### TC-KA-002: Ausgabekategorie erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-KA-002 |
| **Titel** | Neue Ausgabekategorie erstellen |
| **Voraussetzung** | Eingeloggt als Admin/Kassier |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Kategorie:
   - Name: "Raummiete"
   - Typ: **Expense**
   - Farbe: "#ef4444" (Rot)
2. Speichern

**Erwartetes Ergebnis:**
- Kategorie wird angezeigt mit rotem Farbpunkt
- Typ = Expense

---

### TC-KA-003: Kategorie deaktivieren/aktivieren

| Feld | Wert |
|------|------|
| **ID** | TC-KA-003 |
| **Titel** | Kategorie deaktivieren und wieder aktivieren |
| **Voraussetzung** | Aktive Kategorie vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /api/v1/finance/categories/{id}/deactivate`
2. Prüfe: IsActive = false
3. `POST /api/v1/finance/categories/{id}/activate`
4. Prüfe: IsActive = true

**Erwartetes Ergebnis:**
- Status wechselt korrekt
- Deaktivierte Kategorie wird bei neuen Buchungen nicht angeboten

---

### TC-KA-004: Kategorie löschen (Soft-Delete)

| Feld | Wert |
|------|------|
| **ID** | TC-KA-004 |
| **Titel** | Kategorie löschen |
| **Voraussetzung** | Kategorie ohne aktive Buchungen |
| **Priorität** | Mittel |

**Schritte:**

1. Kategorie "Raummiete" auswählen → Löschen
2. Bestätigen

**Erwartetes Ergebnis:**
- Kategorie verschwindet aus der Liste
- DB: `is_deleted = true`

---

## 6. TC-ST: Steuercodes (Tax Codes)

### TC-ST-001: Schweizer MwSt-Normalsatz erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-ST-001 |
| **Titel** | MwSt 8.1% Normalsatz erstellen |
| **Voraussetzung** | Eingeloggt als Admin/Kassier |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Einstellungen → Steuercodes**
2. Erstelle Steuercode:
   - Code: "NORMAL"
   - Bezeichnung: "Normalsatz 8.1%"
   - Satz: **0.081**
   - Standard: Ja
3. Speichern

**Erwartetes Ergebnis:**
- Steuercode NORMAL mit Rate 0.081 aktiv
- IsDefault = true

---

### TC-ST-002: Reduzierter Satz erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-ST-002 |
| **Titel** | MwSt 2.6% Reduzierter Satz erstellen |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Steuercode:
   - Code: "REDUZIERT"
   - Bezeichnung: "Reduzierter Satz 2.6%"
   - Satz: **0.026**
   - Standard: Nein
2. Speichern

**Erwartetes Ergebnis:**
- Steuercode angelegt, IsDefault = false

---

### TC-ST-003: Befreiter Steuercode erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-ST-003 |
| **Titel** | MwSt-befreiter Steuercode erstellen |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Steuercode:
   - Code: "EXEMPT"
   - Bezeichnung: "Steuerbefreit"
   - Satz: **0.0**
2. Speichern

**Erwartetes Ergebnis:**
- Steuercode EXEMPT mit Rate 0.0 angelegt

---

### TC-ST-004: Doppelter Code ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-ST-004 |
| **Titel** | Doppelter Steuercode-Name ablehnen |
| **Voraussetzung** | Code "NORMAL" existiert |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Steuercode mit Code "NORMAL"
2. Speichern

**Erwartetes Ergebnis:**
- Fehlermeldung: Code existiert bereits (Unique Constraint)

---

### TC-ST-005: Steuercode aktualisieren

| Feld | Wert |
|------|------|
| **ID** | TC-ST-005 |
| **Titel** | Steuersatz ändern |
| **Voraussetzung** | Steuercode NORMAL existiert |
| **Priorität** | Mittel |

**Schritte:**

1. Steuercode NORMAL bearbeiten → Rate auf 0.077 ändern
2. Speichern

**Erwartetes Ergebnis:**
- Rate aktualisiert
- **Bestehende Buchungen behalten ihren Snapshot-Satz** (unverändert)

---

### TC-ST-006: Steuercode löschen

| Feld | Wert |
|------|------|
| **ID** | TC-ST-006 |
| **Titel** | Steuercode löschen |
| **Voraussetzung** | Steuercode ohne aktive Referenzen |
| **Priorität** | Mittel |

**Schritte:**

1. Steuercode "REDUZIERT" auswählen → Löschen
2. Bestätigen

**Erwartetes Ergebnis:**
- Soft-Delete: Code verschwindet aus Liste
- Bestehende Referenzen (TaxRate-Snapshots) bleiben erhalten

---

## 7. TC-BU: Buchungen (Transactions)

### TC-BU-001: Einnahme-Buchung erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-BU-001 |
| **Titel** | Neue Einnahme erfassen |
| **Voraussetzung** | Konto + Kategorie + Steuercode vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Buchungen**
2. Klicke "Neue Buchung"
3. Fülle aus:
   - Datum: Heutiges Datum
   - Beschreibung: "Mitgliedsbeitrag Max Muster"
   - Betrag: **120.00**
   - Typ: **Income**
   - Konto: "Vereinskasse"
   - Kategorie: "Mitgliedsbeiträge"
   - Steuercode: "NORMAL" (8.1%)
4. Speichern

**Erwartetes Ergebnis:**
- Buchung erscheint in der Liste
- **Steuerberechnung (Brutto→Netto Herausrechnung):**
  - MwSt-Betrag = 120.00 × 0.081 / (1 + 0.081) = 120.00 × 0.081 / 1.081 = **8.99**
  - Nettobetrag = 120.00 − 8.99 = **111.01**
  - TaxRate = 0.081 (Snapshot)
- Buchung hat Typ = Income

---

### TC-BU-002: Ausgabe-Buchung erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-BU-002 |
| **Titel** | Neue Ausgabe erfassen |
| **Voraussetzung** | Konto + Ausgabekategorie vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Buchung:
   - Datum: Heutiges Datum
   - Beschreibung: "Miete Vereinslokal März 2026"
   - Betrag: **800.00**
   - Typ: **Expense**
   - Konto: "PostFinance Geschäft"
   - Kategorie: "Raummiete"
   - Steuercode: keiner (steuerfrei)
2. Speichern

**Erwartetes Ergebnis:**
- Buchung erscheint mit Typ = Expense
- TaxRate/TaxAmount/NetAmount = null (kein Steuercode)

---

### TC-BU-003: Buchung ohne Steuercode erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-BU-003 |
| **Titel** | Buchung ohne MwSt erstellen |
| **Voraussetzung** | Konto vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Buchung mit Betrag 50.00, ohne Steuercode
2. Speichern

**Erwartetes Ergebnis:**
- TaxRate, TaxAmount, NetAmount sind null/leer
- Betrag bleibt 50.00

---

### TC-BU-004: Buchung aktualisieren

| Feld | Wert |
|------|------|
| **ID** | TC-BU-004 |
| **Titel** | Bestehende Buchung bearbeiten |
| **Voraussetzung** | Buchung aus TC-BU-001 vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. Buchung "Mitgliedsbeitrag Max Muster" auswählen → Bearbeiten
2. Betrag auf 150.00 ändern
3. Speichern

**Erwartetes Ergebnis:**
- Betrag aktualisiert auf 150.00
- Steuerberechnung wird neu berechnet (MwSt ≈ 11.24, Netto ≈ 138.76)

---

### TC-BU-005: Buchung löschen (Soft-Delete)

| Feld | Wert |
|------|------|
| **ID** | TC-BU-005 |
| **Titel** | Buchung löschen |
| **Voraussetzung** | Buchung vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. Buchung auswählen → Löschen → Bestätigen

**Erwartetes Ergebnis:**
- Buchung verschwindet aus der Liste
- is_deleted = true in DB

---

### TC-BU-006: Beleg an Buchung anhängen

| Feld | Wert |
|------|------|
| **ID** | TC-BU-006 |
| **Titel** | Beleg (Receipt) an Buchung anhängen |
| **Voraussetzung** | Buchung + hochgeladener Beleg vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /api/v1/finance/transactions/{id}/receipt` mit ReceiptId im Body
2. Prüfe Buchung: ReceiptId gesetzt

**Erwartetes Ergebnis:**
- Buchung hat ReceiptId
- Beleg kann via Buchungsdetail heruntergeladen werden

---

### TC-BU-007: Beleg von Buchung entfernen

| Feld | Wert |
|------|------|
| **ID** | TC-BU-007 |
| **Titel** | Beleg von Buchung entfernen |
| **Voraussetzung** | Buchung mit Beleg (TC-BU-006) |
| **Priorität** | Mittel |

**Schritte:**

1. `DELETE /api/v1/finance/transactions/{id}/receipt`
2. Prüfe Buchung: ReceiptId = null

**Erwartetes Ergebnis:**
- ReceiptId ist entfernt
- Beleg selbst bleibt bestehen

---

### TC-BU-008: Buchung in gesperrter Periode ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-BU-008 |
| **Titel** | Buchung in gesperrter Geschäftsperiode ablehnen |
| **Voraussetzung** | Geschäftsperiode für Januar 2026 ist "Locked" |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Buchung mit Datum 15.01.2026 (liegt in gesperrter Periode)
2. Speichern

**Erwartetes Ergebnis:**
- Fehlermeldung: Periode ist gesperrt
- Buchung wird NICHT erstellt

---

### TC-BU-009: Buchung mit Betrag 0 oder negativ ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-BU-009 |
| **Titel** | Ungültiger Betrag wird abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Buchung mit Betrag **0** → erwarte Fehler
2. Erstelle Buchung mit Betrag **-50** → erwarte Fehler

**Erwartetes Ergebnis:**
- Validierungsfehler: Amount must be > 0

---

### TC-BU-010: Buchung mit Tätigkeitsbereich

| Feld | Wert |
|------|------|
| **ID** | TC-BU-010 |
| **Titel** | Buchung einem Tätigkeitsbereich zuweisen |
| **Voraussetzung** | Mindestens ein Tätigkeitsbereich vorhanden |
| **Priorität** | Niedrig |

**Schritte:**

1. Erstelle Buchung mit ActivityAreaId
2. Speichern

**Erwartetes Ergebnis:**
- ActivityAreaId korrekt gespeichert
- Erscheint im Tätigkeitsbereich-Report

---

### TC-BU-011: Buchungszusammenfassung

| Feld | Wert |
|------|------|
| **ID** | TC-BU-011 |
| **Titel** | Buchungszusammenfassung abrufen |
| **Voraussetzung** | Mehrere Buchungen vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. `GET /api/v1/finance/transactions/summary`

**Erwartetes Ergebnis:**
- Antwort enthält: TotalIncome, TotalExpense, Balance
- Berechnung: Balance = TotalIncome − TotalExpense

---

## 8. TC-RE: Rechnungen (Invoices)

### TC-RE-001: Rechnung erstellen (Draft)

| Feld | Wert |
|------|------|
| **ID** | TC-RE-001 |
| **Titel** | Neue Rechnung als Entwurf erstellen |
| **Voraussetzung** | Finanzprofil + Steuercode vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Rechnungen → Neue Rechnung**
2. Fülle aus:
   - Datum: 28.02.2026
   - Fälligkeitsdatum: 30.03.2026
   - Empfängertyp: **Member**
   - Empfängername: "Max Muster"
   - Empfängeradresse: "Testweg 5, 8001 Zürich"
3. Füge Position hinzu:
   - Beschreibung: "Jahresbeitrag 2026"
   - Menge: 1
   - Einzelpreis: 120.00
   - Steuercode: NORMAL (8.1%)
   - Bruttoeingabe: Nein
4. Speichern

**Erwartetes Ergebnis:**
- Rechnung erstellt mit Status = **Draft**
- Rechnungsnummer automatisch vergeben (z.B. "INV-2026-0001")
- Positionen-Berechnung (Netto-Eingabe):
  - NetAmount = 1 × 120.00 = **120.00**
  - TaxAmount = 120.00 × 0.081 = **9.72**
  - GrossAmount = 120.00 + 9.72 = **129.72**
- Rechnungstotale:
  - SubtotalNet = 120.00
  - TotalTax = 9.72
  - TotalGross/Total = 129.72

---

### TC-RE-002: Rechnung mit Brutto-Positionen

| Feld | Wert |
|------|------|
| **ID** | TC-RE-002 |
| **Titel** | Rechnung mit Bruttoeingabe erstellen |
| **Voraussetzung** | Steuercode vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Rechnung mit Position:
   - Beschreibung: "Kursgebühr"
   - Menge: 2
   - Einzelpreis: 54.00 (= Bruttopreis)
   - Steuercode: NORMAL (8.1%)
   - **IsGrossEntry: Ja**
2. Speichern

**Erwartetes Ergebnis:**
- Berechnung (Brutto-Eingabe):
  - GrossAmount = 2 × 54.00 = **108.00**
  - NetAmount = 108.00 / (1 + 0.081) = 108.00 / 1.081 = **99.91**
  - TaxAmount = 108.00 − 99.91 = **8.09**

---

### TC-RE-003: Rechnung mit mehreren Positionen

| Feld | Wert |
|------|------|
| **ID** | TC-RE-003 |
| **Titel** | Rechnung mit mehreren Positionen und verschiedenen Steuersätzen |
| **Voraussetzung** | Steuercodes NORMAL + REDUZIERT vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Rechnung mit:
   - Position 1: "Kursgebühr" — 100.00, NORMAL (8.1%)
   - Position 2: "Lehrmaterial" — 50.00, REDUZIERT (2.6%)
   - Position 3: "Raummiete" — 200.00, EXEMPT (0%)
2. Speichern

**Erwartetes Ergebnis:**
- Position 1: Net=100.00, Tax=8.10, Gross=108.10
- Position 2: Net=50.00, Tax=1.30, Gross=51.30
- Position 3: Net=200.00, Tax=0.00, Gross=200.00
- **Totale:** SubtotalNet=350.00, TotalTax=9.40, TotalGross=359.40

---

### TC-RE-004: Rechnung versenden (Draft → Sent)

| Feld | Wert |
|------|------|
| **ID** | TC-RE-004 |
| **Titel** | Entwurfsrechnung versenden |
| **Voraussetzung** | Rechnung im Status Draft (TC-RE-001) |
| **Priorität** | Hoch |

**Schritte:**

1. Rechnung öffnen → "Versenden" klicken
2. Bestätigen

**Erwartetes Ergebnis:**
- Status wechselt zu **Sent**
- Rechnungsnummer ist jetzt **unveränderlich** (Immutability nach Send)
- Rechnung kann nicht mehr bearbeitet werden (nur noch Storno möglich)

---

### TC-RE-005: Entwurfsrechnung bearbeiten

| Feld | Wert |
|------|------|
| **ID** | TC-RE-005 |
| **Titel** | Draft-Rechnung bearbeiten |
| **Voraussetzung** | Rechnung im Status Draft |
| **Priorität** | Mittel |

**Schritte:**

1. Draft-Rechnung öffnen → Bearbeiten
2. Empfängername ändern, Position ändern
3. Speichern

**Erwartetes Ergebnis:**
- Änderungen werden übernommen
- Totale werden neu berechnet

---

### TC-RE-006: Gesendete Rechnung bearbeiten ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-RE-006 |
| **Titel** | Sent-Rechnung kann nicht bearbeitet werden |
| **Voraussetzung** | Rechnung im Status Sent (TC-RE-004) |
| **Priorität** | Hoch |

**Schritte:**

1. Via API: `PUT /api/v1/finance/invoices/{id}` mit geänderten Daten
2. Prüfe Antwort

**Erwartetes Ergebnis:**
- Fehler 400: "Invoice can only be updated in Draft status" (oder ähnlich)
- Keine Änderungen gespeichert

---

### TC-RE-007: Rechnung als überfällig markieren

| Feld | Wert |
|------|------|
| **ID** | TC-RE-007 |
| **Titel** | Gesendete Rechnung mit abgelaufenem Fälligkeitsdatum als überfällig markieren |
| **Voraussetzung** | Rechnung Status=Sent, DueDate < heute |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Rechnung mit DueDate in der Vergangenheit (z.B. 01.01.2026)
2. Sende die Rechnung (→ Sent)
3. `POST /api/v1/finance/invoices/{id}/mark-overdue`

**Erwartetes Ergebnis:**
- Status wechselt zu **Overdue**
- Audit-Log-Eintrag erstellt

---

### TC-RE-008: Mark-Overdue bei noch nicht fällig ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-RE-008 |
| **Titel** | Mark-Overdue wird abgelehnt wenn Fälligkeitsdatum noch nicht erreicht |
| **Voraussetzung** | Rechnung Status=Sent, DueDate in der Zukunft |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/finance/invoices/{id}/mark-overdue` für nicht-fällige Rechnung

**Erwartetes Ergebnis:**
- Fehler: Rechnung ist noch nicht überfällig

---

### TC-RE-009: Rechnung stornieren (Storno mit Umkehrbuchung)

| Feld | Wert |
|------|------|
| **ID** | TC-RE-009 |
| **Titel** | Gesendete Rechnung stornieren |
| **Voraussetzung** | Rechnung Status = Sent oder Overdue |
| **Priorität** | Hoch |

**Schritte:**

1. Rechnung öffnen → "Stornieren" klicken
2. Stornierungsgrund eingeben: "Kundenanfrage - Rechnung fehlerhaft"
3. Konto für Umkehrbuchung auswählen
4. Bestätigen

**Erwartetes Ergebnis:**
- Status wechselt zu **Cancelled**
- CancellationReason gespeichert
- CancelledAt gesetzt
- **Automatische Storno-Buchung** (Umkehrbuchung) wird erstellt:
  - Typ = **Expense** (Umkehrbuchung)
  - Description = "STORNO: {InvoiceNumber}"
  - Betrag = Rechnungsbetrag
  - Reference = "STORNO-{InvoiceNumber}"
- Audit-Log-Eintrag

---

### TC-RE-010: Draft-Rechnung stornieren ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-RE-010 |
| **Titel** | Draft-Rechnung kann nicht storniert werden |
| **Voraussetzung** | Rechnung Status = Draft |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /api/v1/finance/invoices/{id}/cancel` für Draft-Rechnung

**Erwartetes Ergebnis:**
- Fehler: Nur Sent/Overdue Rechnungen können storniert werden
- Hinweis: Draft-Rechnungen einfach löschen

---

### TC-RE-011: Rechnung als bezahlt markieren (via Zahlung)

| Feld | Wert |
|------|------|
| **ID** | TC-RE-011 |
| **Titel** | Rechnung wird automatisch als bezahlt markiert bei voller Zahlung |
| **Voraussetzung** | Gesendete Rechnung (Sent), Total = 129.72 |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Zahlung (Payment) mit:
   - InvoiceId: ID der Rechnung
   - Betrag: **129.72** (= Total der Rechnung)
   - Direction: Income
   - Method: Transfer
2. Markiere Zahlung als Paid

**Erwartetes Ergebnis:**
- Rechnungsstatus wechselt automatisch zu **Paid**
- Auto-MarkAsPaid Logik: Summe aller Zahlungen ≥ Rechnungstotal

---

### TC-RE-012: Teilzahlung — Rechnung bleibt offen

| Feld | Wert |
|------|------|
| **ID** | TC-RE-012 |
| **Titel** | Teilzahlung lässt Rechnung im Status Sent |
| **Voraussetzung** | Gesendete Rechnung, Total = 200.00 |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Zahlung mit Betrag 100.00 für die Rechnung
2. Markiere Zahlung als Paid

**Erwartetes Ergebnis:**
- Rechnungsstatus bleibt **Sent** (100 < 200)
- Zwei weitere Teilzahlungen à 50.00 → nach der letzten: Status = **Paid**

---

### TC-RE-013: Offene Rechnungen abfragen

| Feld | Wert |
|------|------|
| **ID** | TC-RE-013 |
| **Titel** | Offene Rechnungen (Sent + Overdue) abrufen |
| **Voraussetzung** | Verschiedene Rechnungsstatus vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. `GET /api/v1/finance/invoices/open`

**Erwartetes Ergebnis:**
- Nur Rechnungen mit Status Sent oder Overdue
- Keine Draft, Paid oder Cancelled

---

### TC-RE-014: Rechnung löschen (Soft-Delete)

| Feld | Wert |
|------|------|
| **ID** | TC-RE-014 |
| **Titel** | Rechnung löschen |
| **Voraussetzung** | Rechnung vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. Rechnung auswählen → Löschen → Bestätigen

**Erwartetes Ergebnis:**
- Verschwindet aus Liste
- DB: is_deleted = true

---

### TC-RE-015: Rechnung ohne Positionen ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-RE-015 |
| **Titel** | Rechnung ohne Positionen wird abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Rechnung ohne Positionen
2. Speichern

**Erwartetes Ergebnis:**
- Validierungsfehler: Mindestens eine Position erforderlich

---

### TC-RE-016: EU Rechnung — MwSt-Validierung beim Versenden

| Feld | Wert |
|------|------|
| **ID** | TC-RE-016 |
| **Titel** | EU Rechnung: MwSt-Pflichtfelder beim Versenden prüfen |
| **Voraussetzung** | EU Profil mit VatStatus=Registered, VatNumber gesetzt |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Rechnung mit EU-Profil
2. Füge Position OHNE Steuercode hinzu
3. Versuche zu versenden

**Erwartetes Ergebnis:**
- Fehler: Bei EU/Registered müssen alle Positionen einen Steuercode haben

---

## 9. TC-ZA: Zahlungen (Payments)

### TC-ZA-001: Zahlung erstellen (Eingang)

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-001 |
| **Titel** | Eingehende Zahlung erstellen |
| **Voraussetzung** | Eingeloggt als Admin/Kassier |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Zahlungen**
2. Erstelle Zahlung:
   - Datum: Heutiges Datum
   - Betrag: 129.72
   - Richtung: **Income**
   - Methode: **Transfer**
   - Referenz: "Banküberweisung Max Muster"
   - Rechnung: [Zugehörige Rechnung auswählen]
3. Speichern

**Erwartetes Ergebnis:**
- Zahlung erstellt mit Status = **Draft**
- InvoiceId verknüpft

---

### TC-ZA-002: Zahlung einreichen (Submit)

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-002 |
| **Titel** | Zahlung zur Genehmigung einreichen |
| **Voraussetzung** | Zahlung im Status Draft (TC-ZA-001) |
| **Priorität** | Hoch |

**Schritte:**

1. Zahlung auswählen → "Einreichen"
2. Bestätigen

**Erwartetes Ergebnis:**
- Status wechselt zu **Submitted**

---

### TC-ZA-003: Zahlung genehmigen (Approve)

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-003 |
| **Titel** | Eingereichte Zahlung genehmigen |
| **Voraussetzung** | Zahlung im Status Submitted |
| **Priorität** | Hoch |

**Schritte:**

1. Zahlung auswählen → "Genehmigen"
2. Bestätigen

**Erwartetes Ergebnis:**
- Status wechselt zu **Approved**
- ApprovedBy + ApprovedAt gesetzt

---

### TC-ZA-004: Zahlung ablehnen (Reject)

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-004 |
| **Titel** | Eingereichte Zahlung ablehnen |
| **Voraussetzung** | Zahlung im Status Submitted |
| **Priorität** | Hoch |

**Schritte:**

1. Zahlung auswählen → "Ablehnen"
2. Ablehnungsgrund eingeben: "Betrag stimmt nicht überein"
3. Bestätigen

**Erwartetes Ergebnis:**
- Status wechselt zu **Rejected**
- RejectedBy + RejectedAt + RejectionReason gespeichert

---

### TC-ZA-005: Ablehnung ohne Grund ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-005 |
| **Titel** | Ablehnung ohne Begründung wird abgelehnt |
| **Voraussetzung** | Zahlung im Status Submitted |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/finance/payments/{id}/reject` ohne/mit leerem Reason

**Erwartetes Ergebnis:**
- Validierungsfehler: Ablehnungsgrund ist Pflichtfeld

---

### TC-ZA-006: Zahlung als bezahlt markieren (mit Genehmigung)

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-006 |
| **Titel** | Genehmigte Zahlung als bezahlt markieren |
| **Voraussetzung** | Zahlung im Status Approved, Betrag ≥ Schwelle |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/finance/payments/{id}/mark-paid`

**Erwartetes Ergebnis:**
- Status wechselt zu **Paid**
- **Auto-Booking:** Eine Buchung (Transaction) wird automatisch erstellt
  - Typ = PaymentDirection (Income/Expense)
  - Verknüpfung: Payment.TransactionId gesetzt
- Falls InvoiceId gesetzt: Prüfung ob Rechnung als Paid markiert wird

---

### TC-ZA-007: Zahlung unter Schwelle direkt bezahlen (Shortcut)

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-007 |
| **Titel** | Kleine Zahlung direkt als bezahlt markieren |
| **Voraussetzung** | Genehmigungsschwelle = 500.00, Zahlung mit Betrag = 200.00, Status = Draft |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/finance/payments/{id}/mark-paid` (Betrag 200.00 < Schwelle 500.00)

**Erwartetes Ergebnis:**
- Status springt direkt von Draft → **Paid** (Shortcut, ohne Approved-Phase)
- Auto-Booking erstellt Buchung

---

### TC-ZA-008: Zahlung über Schwelle ohne Genehmigung ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-008 |
| **Titel** | Grosse Zahlung ohne Genehmigung ablehnen |
| **Voraussetzung** | Schwelle = 500.00, Zahlung Betrag = 1000.00, Status = Draft |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/finance/payments/{id}/mark-paid`

**Erwartetes Ergebnis:**
- Fehler: Betrag liegt über Genehmigungsschwelle, Zahlung muss zuerst genehmigt werden

---

### TC-ZA-009: Beleg an Zahlung anhängen/entfernen

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-009 |
| **Titel** | Beleg an Zahlung anhängen und wieder entfernen |
| **Voraussetzung** | Zahlung + Beleg vorhanden |
| **Priorität** | Niedrig |

**Schritte:**

1. `POST /api/v1/finance/payments/{id}/receipt` → ReceiptId anhängen
2. Prüfe: ReceiptId gesetzt
3. `DELETE /api/v1/finance/payments/{id}/receipt`
4. Prüfe: ReceiptId = null

**Erwartetes Ergebnis:**
- Beleg wird korrekt verknüpft und entknüpft

---

### TC-ZA-010: Zahlung in gesperrter Periode ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-010 |
| **Titel** | Zahlung in gesperrter Geschäftsperiode ablehnen |
| **Voraussetzung** | Periode "Locked", Zahlung mit passendem Datum |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Zahlung mit Datum in gesperrter Periode

**Erwartetes Ergebnis:**
- Fehler: Geschäftsperiode ist gesperrt

---

## 10. TC-SP: Spesenabrechnung (Expense Claims)

### TC-SP-001: Spesenabrechnung erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-SP-001 |
| **Titel** | Neue Spesenabrechnung erstellen |
| **Voraussetzung** | Eingeloggt als Admin/Kassier |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Spesenabrechnungen**
2. Erstelle:
   - Titel: "Büromaterial März 2026"
   - Beschreibung: "Druckerpapier und Toner"
   - Betrag: **85.50**
   - Währung: CHF
   - Datum: 01.03.2026
   - Antragsteller: "Hans Müller"
3. Speichern

**Erwartetes Ergebnis:**
- Spesenabrechnung erstellt mit Status = **Draft**

---

### TC-SP-002: Vollständiger Workflow Draft → Reimbursed

| Feld | Wert |
|------|------|
| **ID** | TC-SP-002 |
| **Titel** | Kompletter Spesenworkflow durchlaufen |
| **Voraussetzung** | Spesenabrechnung (TC-SP-001) |
| **Priorität** | Hoch |

**Schritte:**

1. **Submit:** `POST /expense-claims/{id}/submit` → Status = **Submitted**
2. **Review (Kassier):** `POST /expense-claims/{id}/review` → Status = **UnderReview**
3. **Approve (Vorstand):** `POST /expense-claims/{id}/approve` → Status = **Approved**
4. **Reimburse:** `POST /expense-claims/{id}/reimburse` → Status = **Reimbursed**

**Erwartetes Ergebnis:**
- Jeder Statuswechsel korrekt
- Bei Reimburse:
  - **Zahlung** (Payment) wird automatisch erstellt (Direction=Expense, Amount=85.50)
  - **Buchung** (Transaction) wird automatisch erstellt
  - ExpenseClaim.PaymentId + ReimbursedAt/By gesetzt

---

### TC-SP-003: Spesenabrechnung ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-SP-003 |
| **Titel** | Spesenabrechnung ablehnen |
| **Voraussetzung** | Spesenabrechnung im Status Submitted oder UnderReview |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /expense-claims/{id}/reject` mit Reason = "Beleg fehlt"

**Erwartetes Ergebnis:**
- Status = **Rejected**
- RejectedBy/At/Reason gespeichert

---

### TC-SP-004: Ablehnung ohne Grund ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-SP-004 |
| **Titel** | Fehlendes Ablehnungsgrund wird abgelehnt |
| **Voraussetzung** | Spesenabrechnung im Status Submitted |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /expense-claims/{id}/reject` ohne/mit leerem Reason

**Erwartetes Ergebnis:**
- Validierungsfehler: Ablehnungsgrund ist Pflichtfeld

---

### TC-SP-005: Abgelehnte Spesen zurücksetzen

| Feld | Wert |
|------|------|
| **ID** | TC-SP-005 |
| **Titel** | Abgelehnte Spesenabrechnung auf Draft zurücksetzen |
| **Voraussetzung** | Status = Rejected |
| **Priorität** | Mittel |

**Schritte:**

1. Bearbeite die abgelehnte Spesenabrechnung (wird auf Draft resettet)
2. Prüfe: Status = Draft, Rejection-Daten gelöscht

**Erwartetes Ergebnis:**
- Status = **Draft**
- Kann erneut eingereicht werden

---

### TC-SP-006: Draft-Spesen bearbeiten

| Feld | Wert |
|------|------|
| **ID** | TC-SP-006 |
| **Titel** | Draft-Spesenabrechnung bearbeiten |
| **Voraussetzung** | Status = Draft |
| **Priorität** | Mittel |

**Schritte:**

1. Betrag auf 95.00 ändern, Titel anpassen
2. Speichern

**Erwartetes Ergebnis:**
- Änderungen übernommen
- Nur im Draft-Status möglich

---

## 11. TC-BI: Bankimport

### TC-BI-001: CSV Bankimport

| Feld | Wert |
|------|------|
| **ID** | TC-BI-001 |
| **Titel** | CSV-Bankdaten importieren |
| **Voraussetzung** | Eingeloggt als Admin/Kassier |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Bank Import**
2. Wähle "CSV Import"
3. Die CSV-Daten werden clientseitig geparst und als JSON gesendet an die API:
   ```json
   {
     "fileName": "PostFinance_2026-02.csv",
     "items": [
       { "transactionDate": "2026-02-01", "description": "Mitgliedsbeitrag", "amount": 120.00, "reference": "INV-2026-0001" },
       { "transactionDate": "2026-02-05", "description": "Zahlung XY", "amount": -500.00 }
     ]
   }
   ```
4. Import bestätigen

**Erwartetes Ergebnis:**
- BankImport erstellt mit Status = **Pending**
- BankImportItems werden angelegt (2 Items)
- **Auto-Matching** läuft:
  - Item 1 (Reference enthält "INV-2026-0001") → SuggestedInvoiceId gesetzt, MatchConfidence ≥ 0.80
  - Item 2 → kein Match, Confidence = null

---

### TC-BI-002: camt.053 Import

| Feld | Wert |
|------|------|
| **ID** | TC-BI-002 |
| **Titel** | ISO 20022 camt.053 Datei importieren |
| **Voraussetzung** | camt.053 XML-Datei vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/finance/bank-imports/camt` als multipart/form-data mit XML-Datei
2. Prüfe Response

**Erwartetes Ergebnis:**
- BankImport erstellt mit Format = Camt053
- Alle Buchungszeilen als BankImportItems
- EndToEndId, CreditorReference, RemittanceInfo etc. aus XML extrahiert

---

### TC-BI-003: 5-Stufen-Matching prüfen

| Feld | Wert |
|------|------|
| **ID** | TC-BI-003 |
| **Titel** | Automatic Matching Algorithm testen |
| **Voraussetzung** | Offene Rechnungen + Bankimport-Items vorhanden |
| **Priorität** | Hoch |

**Schritte:**

Erstelle Rechnungen und Bankimport-Items, die die 5 Matching-Stufen testen:

1. **Stufe 1 — EndToEndId exakt:** Item mit EndToEndId = Rechnungsnummer → Confidence = **1.00**
2. **Stufe 2 — CreditorReference exakt:** Item mit CreditorReference = Rechnungsnummer → Confidence = **0.95**
3. **Stufe 3 — RemittanceInfo enthält:** Item mit RemittanceInfo die Rechnungsnummer enthält → Confidence = **0.80**
4. **Stufe 4 — Betrag + Datum (±30 Tage):** Item mit gleichem Betrag wie Rechnung, Datum ±30 Tage → Confidence = **0.60**
5. **Stufe 5 — Nur Betrag:** Item mit gleichem Betrag, kein Datumsmatch → Confidence = **0.40**

**Erwartetes Ergebnis:**
- Jede Stufe produziert die korrekten Confidence-Werte
- Höchste Confidence wird bevorzugt
- Items mit Confidence = 1.0 werden sofort zugeordnet

---

### TC-BI-004: Item manuell zuordnen (Match)

| Feld | Wert |
|------|------|
| **ID** | TC-BI-004 |
| **Titel** | Bankimport-Item manuell einer Zahlung zuordnen |
| **Voraussetzung** | Unmatched BankImportItem + Payment vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. `PUT /api/v1/finance/bank-imports/{id}/items/{itemId}/match` mit PaymentId
2. Prüfe Item-Status

**Erwartetes Ergebnis:**
- Status wechselt zu **Matched**
- MatchedPaymentId gesetzt
- Audit-Log-Eintrag erstellt

---

### TC-BI-005: Item ignorieren (Ignore)

| Feld | Wert |
|------|------|
| **ID** | TC-BI-005 |
| **Titel** | Bankimport-Item ignorieren |
| **Voraussetzung** | Unmatched BankImportItem |
| **Priorität** | Mittel |

**Schritte:**

1. `PUT /api/v1/finance/bank-imports/{id}/items/{itemId}/ignore`
2. Prüfe Item-Status

**Erwartetes Ergebnis:**
- Status = **Ignored**
- Audit-Log-Eintrag erstellt

---

### TC-BI-006: Match rückgängig machen (Unmatch)

| Feld | Wert |
|------|------|
| **ID** | TC-BI-006 |
| **Titel** | Zugeordnetes Item wieder freigeben |
| **Voraussetzung** | Matched BankImportItem (TC-BI-004) |
| **Priorität** | Mittel |

**Schritte:**

1. `PUT /api/v1/finance/bank-imports/{id}/items/{itemId}/unmatch`
2. Prüfe Item-Status

**Erwartetes Ergebnis:**
- Status zurück auf **Unmatched**
- MatchedPaymentId gelöscht
- Automatisch erstellte Buchung wird rückgängig gemacht/gelöscht
- Audit-Log-Eintrag

---

## 12. TC-MA: Mahnwesen (Dunning)

### TC-MA-001: Mahnung erstellen (Stufe 1)

| Feld | Wert |
|------|------|
| **ID** | TC-MA-001 |
| **Titel** | Erste Mahnung für überfällige Rechnung erstellen |
| **Voraussetzung** | Überfällige Rechnung (Status = Overdue) |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Mahnwesen**
2. Erstelle Mahnung:
   - Rechnung: [Überfällige Rechnung auswählen]
   - Stufe: **1**
   - Fälligkeitsdatum: 14 Tage ab heute
   - Notizen: "Erste Zahlungserinnerung"
3. Speichern

**Erwartetes Ergebnis:**
- Mahnung erstellt mit Status = **Created**, Level = 1
- InvoiceId verknüpft

---

### TC-MA-002: Mahnung versenden (Created → Sent)

| Feld | Wert |
|------|------|
| **ID** | TC-MA-002 |
| **Titel** | Mahnung als versendet markieren |
| **Voraussetzung** | Mahnung Status = Created (TC-MA-001) |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /api/v1/finance/dunning/{id}/send`

**Erwartetes Ergebnis:**
- Status = **Sent**
- SentAt gesetzt
- **Hinweis:** Es wird KEINE E-Mail versendet, nur der Status ändert sich

---

### TC-MA-003: Mahnung Stufe 2 und 3

| Feld | Wert |
|------|------|
| **ID** | TC-MA-003 |
| **Titel** | Zweite und dritte Mahnung erstellen |
| **Voraussetzung** | Stufe-1-Mahnung existiert (TC-MA-001) |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Mahnung mit Level = 2 für dieselbe Rechnung
2. Erstelle Mahnung mit Level = 3 für dieselbe Rechnung
3. Prüfe alle 3 Mahnungen

**Erwartetes Ergebnis:**
- Drei Mahnungen: Level 1, 2, 3
- Maximal Level 3 pro Rechnung

---

### TC-MA-004: Mahnungen nach Rechnung filtern

| Feld | Wert |
|------|------|
| **ID** | TC-MA-004 |
| **Titel** | Mahnungen nach RechnungsID filtern |
| **Voraussetzung** | Mahnungen für verschiedene Rechnungen vorhanden |
| **Priorität** | Niedrig |

**Schritte:**

1. `GET /api/v1/finance/dunning?invoiceId={id}`

**Erwartetes Ergebnis:**
- Nur Mahnungen für die angegebene Rechnung
- Andere Rechnungen ausgeblendet

---

## 13. TC-BE: Belege (Receipts)

### TC-BE-001: Beleg hochladen (PDF)

| Feld | Wert |
|------|------|
| **ID** | TC-BE-001 |
| **Titel** | PDF-Beleg hochladen |
| **Voraussetzung** | Testdatei: quittung.pdf |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Belege**
2. Klicke "Beleg hochladen"
3. Wähle Datei: quittung.pdf
4. Notiz: "Quittung Büromaterial"
5. Hochladen

**Erwartetes Ergebnis:**
- Beleg in der Belegliste sichtbar
- FileName, ContentType (application/pdf), FileSize, FileHash korrekt
- Datei in S3/RustFS gespeichert unter `finance-documents/receipts/{id}/quittung.pdf`

---

### TC-BE-002: Beleg hochladen (Bild)

| Feld | Wert |
|------|------|
| **ID** | TC-BE-002 |
| **Titel** | JPEG-Beleg hochladen |
| **Voraussetzung** | Testdatei: beleg.jpg |
| **Priorität** | Mittel |

**Schritte:**

1. Lade beleg.jpg hoch

**Erwartetes Ergebnis:**
- ContentType = image/jpeg
- Erlaubte Typen: PDF, JPEG, PNG, TIFF (kein GIF, BMP oder WEBP!)

---

### TC-BE-003: Ungültiges Dateiformat ablehnen

| Feld | Wert |
|------|------|
| **ID** | TC-BE-003 |
| **Titel** | Nicht-Bild/PDF Datei wird abgelehnt |
| **Voraussetzung** | Testdatei: test.exe oder test.docx |
| **Priorität** | Mittel |

**Schritte:**

1. Versuche test.exe hochzuladen

**Erwartetes Ergebnis:**
- Fehler: Ungültiges Dateiformat

---

### TC-BE-004: Beleg herunterladen

| Feld | Wert |
|------|------|
| **ID** | TC-BE-004 |
| **Titel** | Beleg aus S3 herunterladen |
| **Voraussetzung** | Beleg hochgeladen (TC-BE-001) |
| **Priorität** | Hoch |

**Schritte:**

1. `GET /api/v1/finance/receipts/{id}/download`

**Erwartetes Ergebnis:**
- Datei wird als Stream zurückgegeben
- Content-Type und Content-Disposition korrekt
- Dateiinhalt identisch mit hochgeladener Datei

---

### TC-BE-005: Beleg löschen

| Feld | Wert |
|------|------|
| **ID** | TC-BE-005 |
| **Titel** | Beleg löschen |
| **Voraussetzung** | Beleg vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. Beleg auswählen → Löschen → Bestätigen

**Erwartetes Ergebnis:**
- Soft-Delete: is_deleted = true
- Beleg nicht mehr in der Liste

---

## 14. TC-GP: Geschäftsperioden (Fiscal Periods)

### TC-GP-001: Perioden für ein Jahr generieren

| Feld | Wert |
|------|------|
| **ID** | TC-GP-001 |
| **Titel** | 12 Monatsperioden für 2026 generieren |
| **Voraussetzung** | Finanzprofil vorhanden, keine Perioden für 2026 |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Geschäftsperioden**
2. Klicke "Perioden generieren" für Jahr 2026
3. Bestätigen

**Erwartetes Ergebnis:**
- 12 Perioden erstellt (2026-01 bis 2026-12)
- Alle mit Status = **Open**
- Start-/Endatum korrekt (01.01.–31.01., 01.02.–28.02. etc.)

---

### TC-GP-002: Periode schliessen (Close)

| Feld | Wert |
|------|------|
| **ID** | TC-GP-002 |
| **Titel** | Abgelaufene Periode schliessen |
| **Voraussetzung** | Periode Januar 2026, Status = Open |
| **Priorität** | Hoch |

**Schritte:**

1. Periode "2026-01" auswählen → "Schliessen"
2. Bestätigen

**Erwartetes Ergebnis:**
- Status = **Closed**
- TotalIncome, TotalExpense, ClosingBalance berechnet und gespeichert
- **Buchungen in dieser Periode sind weiterhin möglich** (Warnung, aber nicht blockiert)

---

### TC-GP-003: Periode sperren (Lock)

| Feld | Wert |
|------|------|
| **ID** | TC-GP-003 |
| **Titel** | Periode unwiderruflich sperren |
| **Voraussetzung** | Periode 2026-01, Status = Open oder Closed |
| **Priorität** | Hoch |

**Schritte:**

1. Periode "2026-01" auswählen → "Sperren"
2. Bestätigen

**Erwartetes Ergebnis:**
- Status = **Locked**
- LockedAt/LockedBy gesetzt
- **Sämtliche Mutationen in dieser Periode werden blockiert:**
  - Keine neuen Buchungen
  - Keine neuen Rechnungen
  - Keine Zahlungen
  - Kein Storno
  - usw. (10 Handlers prüfen dies)

---

### TC-GP-004: Gesperrte Periode entsperren (Unlock)

| Feld | Wert |
|------|------|
| **ID** | TC-GP-004 |
| **Titel** | Gesperrte Periode wieder öffnen |
| **Voraussetzung** | Periode Status = Locked (TC-GP-003) |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /api/v1/finance/fiscal-periods/{id}/unlock`

**Erwartetes Ergebnis:**
- Status = **Open**
- UnlockedAt/UnlockedBy gesetzt
- Buchungen wieder möglich

---

### TC-GP-005: Geschlossene Periode wiedereröffnen (Reopen)

| Feld | Wert |
|------|------|
| **ID** | TC-GP-005 |
| **Titel** | Geschlossene Periode wiedereröffnen |
| **Voraussetzung** | Periode Status = Closed |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /api/v1/finance/fiscal-periods/{id}/reopen`

**Erwartetes Ergebnis:**
- Status = **Open**
- TotalIncome/TotalExpense/ClosingBalance werden gelöscht

---

### TC-GP-006: Buchung in gesperrter Periode — alle Handler prüfen

| Feld | Wert |
|------|------|
| **ID** | TC-GP-006 |
| **Titel** | Alle 10 Handlers blockieren Mutationen in gesperrter Periode |
| **Voraussetzung** | Gesperrte Periode für einen bestimmten Monat |
| **Priorität** | Hoch |

**Schritte:**

Für ein Datum innerhalb der gesperrten Periode teste:

1. **Buchung erstellen** → Fehler erwartet
2. **Buchung bearbeiten** → Fehler erwartet (beide Daten geprüft: alt und neu)
3. **Buchung löschen** → Fehler erwartet
4. **Rechnung erstellen** → Fehler erwartet
5. **Rechnung bearbeiten** → Fehler erwartet
6. **Rechnung stornieren** → Fehler erwartet
7. **Zahlung erstellen** → Fehler erwartet
8. **Zahlung bearbeiten** → Fehler erwartet (bei manchen implementiert)
9. **Zahlung als bezahlt markieren** → Fehler erwartet
10. **Zahlung löschen** → Fehler erwartet

**Erwartetes Ergebnis:**
- Alle 10 Operationen liefern einen Fehler (InvalidOperationException: "Period is locked")

---

## 15. TC-RV: Rechnungsvorlagen (Invoice Templates)

### TC-RV-001: CH-Vorlage erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-RV-001 |
| **Titel** | CH Rechnungsvorlage erstellen |
| **Voraussetzung** | Eingeloggt als Admin/Kassier |
| **Priorität** | Mittel |

**Schritte:**

1. Navigiere zu **Finanzen → Einstellungen → Rechnungsvorlagen**
2. Erstelle:
   - Name: "Standard CH"
   - Rechtsraum: CH
   - Standard: Ja
   - MwSt-ID anzeigen: Ja
   - Bankdetails anzeigen: Ja
   - Zahlungsbedingungen: "Zahlbar innerhalb 30 Tagen"
   - Fusstext: "Vielen Dank für Ihr Vertrauen"
3. Speichern

**Erwartetes Ergebnis:**
- Vorlage erstellt, IsDefault = true für CH

---

### TC-RV-002: EU-Vorlage mit Compliance-Feldern

| Feld | Wert |
|------|------|
| **ID** | TC-RV-002 |
| **Titel** | EU Rechnungsvorlage mit allen EU-Pflichtfeldern |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Vorlage:
   - Name: "EU Standard DE"
   - Rechtsraum: EU
   - Ländercode: DE
   - Alle EU-Felder aktivieren:
     - MwSt-ID anzeigen: Ja
     - Steuerbefreiungsvermerk: "Steuerbefreit gemäss §4 UStG"
     - Reverse-Charge-Vermerk: "Steuerschuldnerschaft des Leistungsempfängers"
     - Zahlungsbedingungen anzeigen: Ja
     - Bankdaten anzeigen: Ja
     - Rechtlicher Hinweis: "Eingetragener Verein, Amtsgericht Berlin"
2. Speichern

**Erwartetes Ergebnis:**
- Vorlage mit allen EU-Compliance-Feldern gespeichert

---

### TC-RV-003: Vorlage löschen (Soft-Delete)

| Feld | Wert |
|------|------|
| **ID** | TC-RV-003 |
| **Titel** | Vorlage löschen |
| **Voraussetzung** | Vorlage vorhanden |
| **Priorität** | Niedrig |

**Schritte:**

1. Vorlage auswählen → Löschen → Bestätigen

**Erwartetes Ergebnis:**
- Soft-Delete: is_deleted = true, deleted_at gesetzt
- Vorlage nicht mehr in Liste
- Rechnungen, die diese Vorlage referenzieren, behalten die Referenz (FK nicht gebrochen)

---

## 16. TC-TB: Tätigkeitsbereiche (Activity Areas)

### TC-TB-001: Tätigkeitsbereich erstellen

| Feld | Wert |
|------|------|
| **ID** | TC-TB-001 |
| **Titel** | Neuen Tätigkeitsbereich erstellen |
| **Voraussetzung** | Eingeloggt als Admin/Kassier |
| **Priorität** | Mittel |

**Schritte:**

1. Navigiere zu **Finanzen → Tätigkeitsbereiche**
2. Erstelle:
   - Name: "Kulturveranstaltungen"
   - Code: "KULTUR"
   - Beschreibung: "Alle kulturellen Events"
   - Farbe: "#f59e0b"
3. Speichern

**Erwartetes Ergebnis:**
- Tätigkeitsbereich in Liste sichtbar, IsActive = true

---

### TC-TB-002: Tätigkeitsbereich-Report (P&L)

| Feld | Wert |
|------|------|
| **ID** | TC-TB-002 |
| **Titel** | Ergebnis pro Tätigkeitsbereich abrufen |
| **Voraussetzung** | Buchungen mit verschiedenen ActivityAreaIds |
| **Priorität** | Mittel |

**Schritte:**

1. `GET /api/v1/finance/activity-areas/report?from=2026-01-01&to=2026-12-31`

**Erwartetes Ergebnis:**
- P&L-Report nach Tätigkeitsbereichen aufgeschlüsselt
- Einnahmen, Ausgaben, Saldo pro Bereich

---

## 17. TC-DB: Dashboard

### TC-DB-001: Dashboard KPIs

| Feld | Wert |
|------|------|
| **ID** | TC-DB-001 |
| **Titel** | Dashboard zeigt korrekte KPIs |
| **Voraussetzung** | Diverse Finanzdaten vorhanden (Buchungen, Rechnungen, Zahlungen, Spesen) |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen** (Dashboard)
2. Prüfe alle angezeigten KPIs

**Erwartetes Ergebnis:**

| KPI | Prüfung |
|-----|---------|
| Total Einnahmen | = Summe aller Income-Buchungen |
| Total Ausgaben | = Summe aller Expense-Buchungen |
| Saldo | = Einnahmen − Ausgaben |
| Offene Rechnungen (Anzahl) | = Count(Status = Sent + Overdue) |
| Offene Rechnungen (Betrag) | = Σ(Total) für Sent + Overdue |
| Überfällige Rechnungen (Anzahl/Betrag) | = nur Overdue |
| Pendente Zahlungen (Anzahl/Betrag) | = nicht Paid/Rejected |
| Pendente Spesenabrechnungen (Anzahl/Betrag) | = nicht Reimbursed/Rejected |
| Aktuelle Geschäftsperiode | = Name + Status der laufenden Periode |

---

### TC-DB-002: Dashboard ohne Daten

| Feld | Wert |
|------|------|
| **ID** | TC-DB-002 |
| **Titel** | Dashboard zeigt Null-Werte ohne Finanzdaten |
| **Voraussetzung** | Keine Finanzdaten vorhanden |
| **Priorität** | Niedrig |

**Schritte:**

1. Dashboard aufrufen bei leerem System

**Erwartetes Ergebnis:**
- Alle KPIs = 0.00
- Keine Fehler

---

## 18. TC-EX: Exporte

### TC-EX-001: Journal-Export (CSV)

| Feld | Wert |
|------|------|
| **ID** | TC-EX-001 |
| **Titel** | Journal als CSV exportieren |
| **Voraussetzung** | Buchungen vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. Navigiere zu **Finanzen → Exporte**
2. Wähle "Journal-Export"
3. Zeitraum: 01.01.2026 – 31.12.2026
4. Herunterladen

**Erwartetes Ergebnis:**
- CSV-Datei wird heruntergeladen
- Enthält alle Buchungen im Zeitraum
- Spalten: Datum, Beschreibung, Betrag, Typ, Konto, Kategorie, MwSt etc.

---

### TC-EX-002: Offene Posten Export

| Feld | Wert |
|------|------|
| **ID** | TC-EX-002 |
| **Titel** | Offene Posten als CSV exportieren |
| **Voraussetzung** | Offene Rechnungen vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. `GET /api/v1/finance/exports/open-items`

**Erwartetes Ergebnis:**
- CSV mit allen offenen Rechnungen (Sent + Overdue)
- Spalten: Rechnungsnummer, Empfänger, Betrag, Fälligkeitsdatum, Status

---

### TC-EX-003: MwSt-Zusammenfassung Export

| Feld | Wert |
|------|------|
| **ID** | TC-EX-003 |
| **Titel** | MwSt-Zusammenfassung als CSV exportieren |
| **Voraussetzung** | Buchungen mit MwSt vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. `GET /api/v1/finance/exports/vat-summary?from=2026-01-01&to=2026-12-31`

**Erwartetes Ergebnis:**
- CSV mit MwSt-Zusammenfassung nach Steuersätzen gruppiert
- Pro Satz: Steuersatz, Nettobetrag, MwSt-Betrag, Bruttobetrag

---

## 19. TC-AR: Archivierung & Aufbewahrung (REQ-070)

### TC-AR-001: Rechnung archivieren

| Feld | Wert |
|------|------|
| **ID** | TC-AR-001 |
| **Titel** | Finalisierte Rechnung archivieren |
| **Voraussetzung** | Gesendete oder bezahlte Rechnung vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/finance/invoices/{id}/archive` mit Body:
   ```json
   { "reason": "Geschäftsjahr 2025 abgeschlossen" }
   ```
2. Prüfe Rechnung

**Erwartetes Ergebnis:**
- IsArchived = true
- ArchivedAt = aktueller Zeitstempel
- ArchivedBy = eingeloggter Benutzer
- ArchiveReason = "Geschäftsjahr 2025 abgeschlossen"
- RetainUntil = ca. 10 Jahre nach Geschäftsjahresende (z.B. 31.12.2035)
- Audit-Log-Eintrag: FinanceArchived

---

### TC-AR-002: Archivierte Rechnung ist schreibgeschützt

| Feld | Wert |
|------|------|
| **ID** | TC-AR-002 |
| **Titel** | Keine Änderungen an archivierten Rechnungen |
| **Voraussetzung** | Archivierte Rechnung (TC-AR-001) |
| **Priorität** | Hoch |

**Schritte:**

1. `PUT /api/v1/finance/invoices/{id}` (Update versuchen) → Fehler erwartet
2. `DELETE /api/v1/finance/invoices/{id}` (Löschen versuchen) → Fehler erwartet
3. `POST /api/v1/finance/invoices/{id}/cancel` (Storno versuchen) → Fehler erwartet
4. `GET /api/v1/finance/invoices/{id}` (Lesen) → sollte funktionieren
5. `GET /api/v1/finance/invoices/{id}/pdf` (PDF) → sollte funktionieren

**Erwartetes Ergebnis:**
- Schreiboperationen werden abgelehnt
- Leseoperationen funktionieren normal (Download, Export, Ansicht)

---

### TC-AR-003: Beleg archivieren

| Feld | Wert |
|------|------|
| **ID** | TC-AR-003 |
| **Titel** | Beleg archivieren |
| **Voraussetzung** | Beleg vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/finance/receipts/{id}/archive` mit Reason
2. Prüfe Beleg

**Erwartetes Ergebnis:**
- IsArchived = true, RetainUntil gesetzt
- Beleg kann weiterhin heruntergeladen werden
- Beleg kann nicht gelöscht werden

---

### TC-AR-004: Archivierte Rechnung wiederherstellen (Admin)

| Feld | Wert |
|------|------|
| **ID** | TC-AR-004 |
| **Titel** | Archivierte Rechnung als Admin wiederherstellen |
| **Voraussetzung** | Archivierte Rechnung, eingeloggt als Admin |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/finance/invoices/{id}/restore`
2. Prüfe Rechnung

**Erwartetes Ergebnis:**
- IsArchived = false
- ArchivedAt/ArchivedBy/ArchiveReason zurückgesetzt
- Rechnung wieder bearbeitbar (falls Draft) oder stornierbar (falls Sent)
- Audit-Log: FinanceRestored

---

### TC-AR-005: Beleg wiederherstellen (Admin)

| Feld | Wert |
|------|------|
| **ID** | TC-AR-005 |
| **Titel** | Archivierten Beleg wiederherstellen |
| **Voraussetzung** | Archivierter Beleg |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /api/v1/finance/receipts/{id}/restore`

**Erwartetes Ergebnis:**
- IsArchived = false
- Beleg wieder löschbar

---

### TC-AR-006: Admin-Purge für abgelaufene Archive

| Feld | Wert |
|------|------|
| **ID** | TC-AR-006 |
| **Titel** | Physische Löschung nach Ablauf der Aufbewahrungsfrist |
| **Voraussetzung** | Archiviertes Item mit RetainUntil in der Vergangenheit |
| **Priorität** | Hoch |

**Schritte:**

1. Eingeloggt als **Admin**
2. `POST /api/v1/admin/finance/purge-archived`
3. Prüfe DB

**Erwartetes Ergebnis:**
- Nur Items mit RetainUntil < heute werden physisch gelöscht
- Items mit RetainUntil in der Zukunft bleiben bestehen
- Audit-Log: FinancePurged

---

### TC-AR-007: Purge für nicht-abgelaufene Archive wird abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-AR-007 |
| **Titel** | Purge löscht keine Items mit aktiver Aufbewahrungsfrist |
| **Voraussetzung** | Archiviertes Item mit RetainUntil in der Zukunft |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/admin/finance/purge-archived`
2. Prüfe: Item noch vorhanden

**Erwartetes Ergebnis:**
- Item bleibt in DB erhalten
- Kein physisches Löschen

---

### TC-AR-008: Nicht-Admin kann nicht purgen

| Feld | Wert |
|------|------|
| **ID** | TC-AR-008 |
| **Titel** | Kassier/Auditor können nicht purgen |
| **Voraussetzung** | Eingeloggt als Kassier |
| **Priorität** | Hoch |

**Schritte:**

1. Als Kassier: `POST /api/v1/admin/finance/purge-archived`

**Erwartetes Ergebnis:**
- 403 Forbidden

---

## 20. TC-RN: Rechnungsnummern (REQ-071)

### TC-RN-001: Automatische Nummernvergabe

| Feld | Wert |
|------|------|
| **ID** | TC-RN-001 |
| **Titel** | Rechnungsnummer wird automatisch vergeben |
| **Voraussetzung** | Finanzprofil vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle 3 Rechnungen nacheinander

**Erwartetes Ergebnis:**
- Rechnungsnummern: INV-2026-0001, INV-2026-0002, INV-2026-0003
- Fortlaufend, keine Lücken

---

### TC-RN-002: Nummern pro Geschäftsjahr

| Feld | Wert |
|------|------|
| **ID** | TC-RN-002 |
| **Titel** | Nummernkreis startet pro Geschäftsjahr neu |
| **Voraussetzung** | Rechnungen aus 2026 vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Rechnung mit Datum 01.01.2027

**Erwartetes Ergebnis:**
- Neue Nummer: INV-2027-0001 (Neues Jahr, neuer Zähler)

---

### TC-RN-003: Rechnungsnummer unveränderlich nach Versand

| Feld | Wert |
|------|------|
| **ID** | TC-RN-003 |
| **Titel** | Rechnungsnummer kann nach Versand nicht geändert werden |
| **Voraussetzung** | Versendete Rechnung (Status = Sent) |
| **Priorität** | Hoch |

**Schritte:**

1. Via API: `PUT /api/v1/finance/invoices/{id}` mit geänderter InvoiceNumber

**Erwartetes Ergebnis:**
- Update wird abgelehnt (Status ≠ Draft → Update generell blockiert)
- InvoiceNumber ist unveränderlich nach Send

---

### TC-RN-004: Eindeutigkeit der Rechnungsnummer

| Feld | Wert |
|------|------|
| **ID** | TC-RN-004 |
| **Titel** | Doppelte Rechnungsnummern werden durch DB-Constraint verhindert |
| **Voraussetzung** | Mindestens eine Rechnung existiert |
| **Priorität** | Hoch |

**Schritte:**

1. Versuche direkt in DB eine Rechnung mit bereits bestehender InvoiceNumber einzufügen

**Erwartetes Ergebnis:**
- Unique Index Violation
- PostgreSQL verhindert das Duplikat

---

## 21. TC-EI: eInvoice Validierung (REQ-072)

### TC-EI-001: Gültige eInvoice validieren

| Feld | Wert |
|------|------|
| **ID** | TC-EI-001 |
| **Titel** | Vollständige Rechnung besteht EN 16931 Validierung |
| **Voraussetzung** | Vollständig ausgefüllte Rechnung (alle Pflichtfelder) |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle vollständige Rechnung mit:
   - Empfängername + Adresse
   - Mindestens 1 Position mit Steuercode
   - Rechnungsdatum + Fälligkeitsdatum
2. `POST /api/v1/finance/invoices/{id}/validate-einvoice`

**Erwartetes Ergebnis:**
- Response: `{ "isValid": true, "errors": [], "warnings": [...] }`
- Keine Fehler
- Evtl. Warnungen (z.B. "No payment terms specified")

---

### TC-EI-002: Fehlerhafte eInvoice — fehlende Pflichtfelder

| Feld | Wert |
|------|------|
| **ID** | TC-EI-002 |
| **Titel** | eInvoice ohne Empfängername wird abgelehnt |
| **Voraussetzung** | Rechnung ohne Empfängeradresse |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Rechnung mit fehlendem Empfängernamen oder fehlender Adresse
2. `POST /api/v1/finance/invoices/{id}/validate-einvoice`

**Erwartetes Ergebnis:**
- `isValid: false`
- Errors enthält z.B.:
  - `{ "ruleId": "BR-07", "field": "BT-44", "message": "Buyer name is required" }`
  - `{ "ruleId": "BR-10", "field": "BG-8", "message": "Buyer postal address is required" }`

---

### TC-EI-003: Steuerkategorie-Validierung

| Feld | Wert |
|------|------|
| **ID** | TC-EI-003 |
| **Titel** | Falsche Steuerkategorie wird erkannt |
| **Voraussetzung** | Rechnung mit Nullsatz-Steuercode aber Rate > 0 |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Rechnung mit Position: Steuercode "EXEMPT" aber Rate = 0.081

**Erwartetes Ergebnis:**
- Validierungsfehler: BR-E-01 (Exempt muss Rate = 0% haben)

---

### TC-EI-004: eInvoice XML generieren

| Feld | Wert |
|------|------|
| **ID** | TC-EI-004 |
| **Titel** | UBL 2.1 eInvoice XML abrufen |
| **Voraussetzung** | Vollständige, gültige, versendete Rechnung |
| **Priorität** | Hoch |

**Schritte:**

1. `GET /api/v1/finance/invoices/{id}/einvoice`
2. Prüfe XML-Struktur

**Erwartetes Ergebnis:**
- XML im UBL 2.1 Format
- Enthält: CustomizationID, ID, IssueDate, InvoiceTypeCode, DocumentCurrencyCode
- Seller (AccountingSupplierParty), Buyer (AccountingCustomerParty)
- InvoiceLine pro Position
- TaxTotal mit TaxSubtotal pro Steuersatz
- LegalMonetaryTotal (LineExtensionAmount, TaxExclusiveAmount, TaxInclusiveAmount, PayableAmount)

---

### TC-EI-005: eInvoice Feature-Flag deaktiviert

| Feld | Wert |
|------|------|
| **ID** | TC-EI-005 |
| **Titel** | eInvoice Endpoint gibt 404 wenn Feature deaktiviert |
| **Voraussetzung** | eInvoice Feature-Flag = false in Config |
| **Priorität** | Niedrig |

**Schritte:**

1. Deaktiviere eInvoice Feature in appsettings.json
2. `GET /api/v1/finance/invoices/{id}/einvoice`

**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

## 22. TC-PA: pain.001 Export (REQ-073)

### TC-PA-001: CH SPS Zahlungsdatei exportieren

| Feld | Wert |
|------|------|
| **ID** | TC-PA-001 |
| **Titel** | pain.001 Export für Schweizer Zahlungen |
| **Voraussetzung** | CH Profil, genehmigte Zahlungen mit IBAN CH... vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle 2-3 genehmigte Zahlungen mit CH-IBAN-Empfänger
2. `POST /api/v1/finance/exports/pain001` mit Body:
   ```json
   {
     "paymentIds": ["guid1", "guid2"],
     "profile": "ChSps",
     "requestedExecutionDate": "2026-03-01"
   }
   ```
3. Prüfe XML-Response

**Erwartetes Ergebnis:**
- pain.001.001.09 XML-Datei
- GrpHdr: MsgId, CreDtTm, NbOfTxs = 2, CtrlSum korrekt
- PmtInf: Debtor = Organisation aus Profil, IBAN aus Profil
- Pro Zahlung: CdtTrfTxInf mit EndToEndId, Betrag, Creditor, IBAN, Referenz
- Namespace: `urn:iso:std:iso:20022:tech:xsd:pain.001.001.09`

---

### TC-PA-002: SEPA Zahlungsdatei exportieren

| Feld | Wert |
|------|------|
| **ID** | TC-PA-002 |
| **Titel** | pain.001 Export für SEPA-Zahlungen |
| **Voraussetzung** | EU Profil, genehmigte Zahlungen mit DE-IBAN vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle genehmigte Zahlungen mit EU-IBAN
2. `POST /api/v1/finance/exports/pain001` mit `"profile": "Sepa"`

**Erwartetes Ergebnis:**
- SEPA-spezifische XML:
  - ServiceLevel: SEPA
  - EUR als Währung
  - Creditor Reference im ISO 11649 Format

---

### TC-PA-003: pain.001 Validierung vor Export

| Feld | Wert |
|------|------|
| **ID** | TC-PA-003 |
| **Titel** | Validierung zeigt Fehler vor dem Export an |
| **Voraussetzung** | Zahlungen, eine davon ohne IBAN |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/finance/exports/pain001/validate` mit PaymentIds inkl. einer Zahlung ohne IBAN

**Erwartetes Ergebnis:**
- `isValid: false`
- Errors: "Creditor IBAN is required for payment XY"

---

### TC-PA-004: pain.001 — nur genehmigte Zahlungen

| Feld | Wert |
|------|------|
| **ID** | TC-PA-004 |
| **Titel** | Nicht-genehmigte Zahlungen werden beim Export abgelehnt |
| **Voraussetzung** | Zahlung im Status Draft oder Submitted |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/finance/exports/pain001` mit einer Draft-Zahlung

**Erwartetes Ergebnis:**
- Fehler: "Payment must be in Approved status"

---

### TC-PA-005: pain.001 — Kontrollsumme

| Feld | Wert |
|------|------|
| **ID** | TC-PA-005 |
| **Titel** | Kontrollsumme und Anzahl Transaktionen prüfen |
| **Voraussetzung** | 3 Zahlungen: 100.00, 250.50, 1000.00 |
| **Priorität** | Mittel |

**Schritte:**

1. Exportiere alle 3 Zahlungen
2. Prüfe XML: NbOfTxs und CtrlSum

**Erwartetes Ergebnis:**
- NbOfTxs = 3
- CtrlSum = 1350.50
- Summe der Einzelbeträge = CtrlSum

---

## 23. TC-PDF: PDF-Erzeugung & Swiss QR-Bill

### TC-PDF-001: Rechnungs-PDF generieren

| Feld | Wert |
|------|------|
| **ID** | TC-PDF-001 |
| **Titel** | PDF für gesendete Rechnung herunterladen |
| **Voraussetzung** | Versendete Rechnung mit Positionen |
| **Priorität** | Hoch |

**Schritte:**

1. `GET /api/v1/finance/invoices/{id}/pdf`
2. PDF öffnen und prüfen

**Erwartetes Ergebnis:**
- A4 PDF
- **Header:** Organisationsname, Adresse, E-Mail
- **Titel:** "Invoice INV-2026-XXXX"
- **Metadaten:** Rechnungsdatum, Fälligkeitsdatum, Status, Empfänger
- **Positionstabelle:** Beschreibung, Menge, Einzelpreis, Netto, MwSt%, MwSt, Brutto
- **Totale:** Netto-Subtotal, Total MwSt, Gesamtbetrag
- **MwSt-Zusammenfassung** (wenn verschiedene Sätze)
- **Fusstext:** Zahlungsinformationen, IBAN, Bank, Seitennummer

---

### TC-PDF-002: Swiss QR-Bill (CH Profil)

| Feld | Wert |
|------|------|
| **ID** | TC-PDF-002 |
| **Titel** | Rechnung mit Swiss QR-Bill |
| **Voraussetzung** | CH Profil mit IBAN, versendete Rechnung |
| **Priorität** | Hoch |

**Schritte:**

1. `GET /api/v1/finance/invoices/{id}/pdf` (CH Profil)
2. PDF öffnen — ab Seite 2

**Erwartetes Ergebnis:**
- **Neue Seite** nach der Rechnung
- Gestrichelte Trennlinie mit Schere
- **QR-Code** mit Zahlungsinformationen:
  - IBAN des Vereins
  - Betrag + Währung (CHF)
  - Gläubiger (Organisationsname + Adresse)
  - Schuldner (Empfänger)
  - Referenz (QR-Referenz oder SCOR)
  - "Invoice INV-2026-XXXX"
- Human-readable Infos neben dem QR-Code

---

### TC-PDF-003: QR-Referenz für QR-IBAN

| Feld | Wert |
|------|------|
| **ID** | TC-PDF-003 |
| **Titel** | QR-Referenz wird bei QR-IBAN generiert |
| **Voraussetzung** | IBAN mit Clearing 30 oder 31 (QR-IBAN) |
| **Priorität** | Hoch |

**Schritte:**

1. Konfiguriere IBAN mit QR-IBAN Format
2. Generiere PDF

**Erwartetes Ergebnis:**
- QR-Referenz: 27-stellig, numerisch (aus Rechnungsnummer abgeleitet)

---

### TC-PDF-004: Creditor Reference für normale IBAN (ISO 11649)

| Feld | Wert |
|------|------|
| **ID** | TC-PDF-004 |
| **Titel** | ISO 11649 Creditor Reference bei normaler IBAN |
| **Voraussetzung** | Normale IBAN (nicht QR-IBAN) |
| **Priorität** | Hoch |

**Schritte:**

1. Konfiguriere normale CH-IBAN
2. Generiere PDF

**Erwartetes Ergebnis:**
- Creditor Reference im Format "RF" + 2 Prüfziffern + bis zu 21 alphanumerische Zeichen

---

### TC-PDF-005: PDF für EU-Rechnung (ohne QR-Bill)

| Feld | Wert |
|------|------|
| **ID** | TC-PDF-005 |
| **Titel** | EU-Rechnung ohne Swiss QR-Bill |
| **Voraussetzung** | EU Profil |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle und sende Rechnung mit EU-Profil
2. `GET /api/v1/finance/invoices/{id}/pdf`

**Erwartetes Ergebnis:**
- Standard-PDF OHNE Swiss QR-Bill (Factory wählt Base-Generator)
- EU-Compliance-Informationen aus Template (MwSt-ID, Steuerbefreiungsvermerk etc.)

---

## 24. TC-BJ: Hintergrundjobs (Background Jobs)

### TC-BJ-001: MarkInvoicesOverdue Job

| Feld | Wert |
|------|------|
| **ID** | TC-BJ-001 |
| **Titel** | Täglicher Job markiert überfällige Rechnungen |
| **Voraussetzung** | Rechnungen mit Status=Sent und DueDate < heute |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle 3 Rechnungen:
   - Rechnung A: Status=Sent, DueDate = gestern → soll Overdue werden
   - Rechnung B: Status=Sent, DueDate = morgen → soll Sent bleiben
   - Rechnung C: Status=Overdue → soll Overdue bleiben (idempotent)
2. Warte auf den täglichen Job ODER triggere ihn manuell via Hangfire Dashboard (http://localhost:5000/hangfire)
3. Prüfe Status aller 3 Rechnungen

**Erwartetes Ergebnis:**
- Rechnung A: **Overdue** ✅
- Rechnung B: **Sent** (unverändert) ✅
- Rechnung C: **Overdue** (unverändert) ✅ (Idempotenz)

---

### TC-BJ-002: DunningScheduleGeneration Job

| Feld | Wert |
|------|------|
| **ID** | TC-BJ-002 |
| **Titel** | Wöchentlicher Job erstellt Mahnungen |
| **Voraussetzung** | Status=Overdue Rechnungen ohne kürzliche Mahnung |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Situation:
   - Rechnung X: Status=Overdue, keine Mahnung → soll Mahnung erhalten
   - Rechnung Y: Status=Overdue, letzte Mahnung vor 10 Tagen → soll KEINE neue bekommen (14-Tage Karenzzeit)
   - Rechnung Z: Status=Overdue, letzte Mahnung vor 20 Tagen → soll neue Mahnung bekommen
2. Triggere DunningScheduleGeneration Job
3. Prüfe Mahnungen

**Erwartetes Ergebnis:**
- Rechnung X: Neue Mahnung Stufe 1 erstellt ✅
- Rechnung Y: Keine neue Mahnung ✅ (innerhalb Karenzzeit)
- Rechnung Z: Neue Mahnung (nächste Stufe) erstellt ✅

---

### TC-BJ-003: Job Idempotenz

| Feld | Wert |
|------|------|
| **ID** | TC-BJ-003 |
| **Titel** | Jobs sind idempotent — mehrfaches Ausführen ändert nichts |
| **Voraussetzung** | — |
| **Priorität** | Hoch |

**Schritte:**

1. Führe MarkInvoicesOverdue Job 3× hintereinander aus
2. Prüfe: Keine doppelten Status-Änderungen

**Erwartetes Ergebnis:**
- Ergebnis nach 1. und 3. Durchlauf identisch
- Keine Fehler, keine Duplikate

---

## 25. TC-AU: Berechtigungen & Sicherheit (Authorization)

### TC-AU-001: Admin hat vollen Zugriff

| Feld | Wert |
|------|------|
| **ID** | TC-AU-001 |
| **Titel** | Admin kann alle Finanzoperationen durchführen |
| **Voraussetzung** | Eingeloggt als Admin |
| **Priorität** | Hoch |

**Schritte:**

1. Lese Finanzdaten (GET) → OK
2. Erstelle/Bearbeite/Lösche Buchung → OK
3. Archive/Restore → OK
4. Purge archived → OK

**Erwartetes Ergebnis:**
- Alle Operationen erfolgreich (HTTP 2xx)

---

### TC-AU-002: Kassier kann lesen und schreiben

| Feld | Wert |
|------|------|
| **ID** | TC-AU-002 |
| **Titel** | Kassier hat Lese- und Schreibzugriff |
| **Voraussetzung** | Token von kassier@iabconnect.ch |
| **Priorität** | Hoch |

**Schritte:**

1. GET /api/v1/finance/dashboard → OK
2. POST Buchung erstellen → OK
3. POST Rechnung erstellen → OK

**Erwartetes Ergebnis:**
- Alle Finanz-Read + Write Operationen erlaubt

---

### TC-AU-003: Kassier kann NICHT purgen

| Feld | Wert |
|------|------|
| **ID** | TC-AU-003 |
| **Titel** | Kassier kann Admin-Purge nicht ausführen |
| **Voraussetzung** | Token von kassier@iabconnect.ch |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /api/v1/admin/finance/purge-archived` als Kassier

**Erwartetes Ergebnis:**
- HTTP **403 Forbidden**

---

### TC-AU-004: Auditor kann nur lesen

| Feld | Wert |
|------|------|
| **ID** | TC-AU-004 |
| **Titel** | Auditor hat nur Lesezugriff |
| **Voraussetzung** | Token von auditor@iabconnect.ch |
| **Priorität** | Hoch |

**Schritte:**

1. GET /api/v1/finance/dashboard → **200 OK**
2. GET /api/v1/finance/invoices → **200 OK**
3. POST Buchung erstellen → **403 Forbidden**
4. DELETE Rechnung löschen → **403 Forbidden**
5. POST /archive → **403 Forbidden**

**Erwartetes Ergebnis:**
- Alle GET-Endpunkte: 200
- Alle POST/PUT/DELETE: 403

---

### TC-AU-005: Vorstand hat eingeschränkten Finanzzugriff

| Feld | Wert |
|------|------|
| **ID** | TC-AU-005 |
| **Titel** | Vorstand kann nur Zahlungen genehmigen/ablehnen |
| **Voraussetzung** | Token von vorstand@iabconnect.ch |
| **Priorität** | Hoch |

**Schritte:**

1. GET /api/v1/finance/dashboard → **403 Forbidden**
2. GET /api/v1/finance/invoices → **403 Forbidden**
3. POST /api/v1/finance/payments/{id}/approve → **200 OK** ✅
4. POST /api/v1/finance/payments/{id}/reject → **200 OK** ✅

**Erwartetes Ergebnis:**
- Kein Zugriff auf allgemeine Finance-Read-Endpunkte (Dashboard, Rechnungen, Buchungen, etc.)
- **Ausnahme**: Vorstand kann Zahlungen genehmigen und ablehnen (RequireVorstand-Policy)
- Finance-Sidebar im Frontend nicht sichtbar (ausser Zahlungsgenehmigung)

---

### TC-AU-006: Mitglied hat keinen Finanzzugriff

| Feld | Wert |
|------|------|
| **ID** | TC-AU-006 |
| **Titel** | Einfaches Mitglied sieht Finanzen nicht |
| **Voraussetzung** | Token von member@iabconnect.ch |
| **Priorität** | Hoch |

**Schritte:**

1. GET /api/v1/finance/dashboard → **403 Forbidden**

**Erwartetes Ergebnis:**
- 403 auf alle Finance-Endpunkte

---

### TC-AU-007: Unauthentifizierter Zugriff

| Feld | Wert |
|------|------|
| **ID** | TC-AU-007 |
| **Titel** | Ohne Token kein Zugriff |
| **Voraussetzung** | Kein Authorization-Header |
| **Priorität** | Hoch |

**Schritte:**

1. GET /api/v1/finance/dashboard ohne Token

**Erwartetes Ergebnis:**
- HTTP **401 Unauthorized**

---

## 26. TC-PG: Paginierung & Sortierung

### TC-PG-001: Standard-Paginierung

| Feld | Wert |
|------|------|
| **ID** | TC-PG-001 |
| **Titel** | List-Endpunkte liefern paginierte Ergebnisse |
| **Voraussetzung** | > 20 Buchungen vorhanden |
| **Priorität** | Hoch |

**Schritte:**

1. `GET /api/v1/finance/transactions` (ohne Parameter)
2. Prüfe Response-Struktur

**Erwartetes Ergebnis:**
```json
{
  "items": [...],     // max 20 Einträge
  "page": 1,
  "pageSize": 20,
  "totalCount": 35,   // Gesamtanzahl
  "totalPages": 2     // ceil(35/20)
}
```

---

### TC-PG-002: Seite wechseln

| Feld | Wert |
|------|------|
| **ID** | TC-PG-002 |
| **Titel** | Zweite Seite abfragen |
| **Voraussetzung** | > 20 Einträge |
| **Priorität** | Hoch |

**Schritte:**

1. `GET /api/v1/finance/transactions?page=2&pageSize=20`

**Erwartetes Ergebnis:**
- page = 2
- Items = restliche Einträge (z.B. 15)
- totalCount gleich wie vorher

---

### TC-PG-003: Seitengrösse anpassen

| Feld | Wert |
|------|------|
| **ID** | TC-PG-003 |
| **Titel** | PageSize auf 5 setzen |
| **Voraussetzung** | Mindestens 10 Einträge |
| **Priorität** | Mittel |

**Schritte:**

1. `GET /api/v1/finance/transactions?pageSize=5`

**Erwartetes Ergebnis:**
- Genau 5 Items
- totalPages = ceil(total / 5)

---

### TC-PG-004: Sortierung

| Feld | Wert |
|------|------|
| **ID** | TC-PG-004 |
| **Titel** | Ergebnisse sortieren |
| **Voraussetzung** | Mehrere Buchungen mit verschiedenen Daten/Beträgen |
| **Priorität** | Mittel |

**Schritte:**

1. `GET /api/v1/finance/transactions?sort=amount:desc`
2. Prüfe Reihenfolge

**Erwartetes Ergebnis:**
- Items nach Betrag absteigend sortiert

---

### TC-PG-005: Paginierung auf allen Endpunkten

| Feld | Wert |
|------|------|
| **ID** | TC-PG-005 |
| **Titel** | Alle 13 List-Endpunkte unterstützen Paginierung |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

Prüfe für jeden Endpunkt die paginierte Antwort:

1. GET /accounts
2. GET /categories
3. GET /transactions
4. GET /invoices
5. GET /payments
6. GET /bank-imports
7. GET /dunning
8. GET /receipts
9. GET /expense-claims
10. GET /fiscal-periods
11. GET /tax-codes
12. GET /invoice-templates
13. GET /activity-areas

**Erwartetes Ergebnis:**
- Alle liefern `{ items, page, pageSize, totalCount, totalPages }`

---

## 27. TC-SD: Soft-Delete Verhalten

### TC-SD-001: Soft-Delete über alle Entitäten

| Feld | Wert |
|------|------|
| **ID** | TC-SD-001 |
| **Titel** | Soft-Delete funktioniert für alle Finanzentitäten |
| **Voraussetzung** | Je eine Instanz pro Typ |
| **Priorität** | Hoch |

**Schritte:**

Für jeden Typ löschen und prüfen:

1. **Account** → DELETE → verschwindet aus Liste, DB: is_deleted=true
2. **Category** → DELETE → verschwindet, is_deleted=true
3. **Transaction** → DELETE → verschwindet, is_deleted=true
4. **Invoice** → DELETE → verschwindet, is_deleted=true
5. **Payment** → DELETE → verschwindet, is_deleted=true
6. **DunningNotice** → DELETE → verschwindet, is_deleted=true
7. **Receipt** → DELETE → verschwindet, is_deleted=true
8. **TaxCode** → DELETE → verschwindet, is_deleted=true
9. **ExpenseClaim** → DELETE → verschwindet, is_deleted=true
10. **ActivityArea** → DELETE → verschwindet, is_deleted=true
11. **InvoiceTemplate** → DELETE → verschwindet, is_deleted=true

**Erwartetes Ergebnis:**
- Keiner dieser Typen wird physisch gelöscht
- Alle haben is_deleted=true, deleted_at gesetzt
- Gelöschte Einträge werden durch Global Query Filter ausgeblendet

---

### TC-SD-002: Gelöschte Einträge in DB noch vorhanden

| Feld | Wert |
|------|------|
| **ID** | TC-SD-002 |
| **Titel** | Soft-gelöschte Daten in DB prüfen |
| **Voraussetzung** | Soft-gelöschte Daten (TC-SD-001) |
| **Priorität** | Mittel |

**Schritte:**

1. Verbinde mit PostgreSQL (localhost:5433)
2. `SELECT * FROM accounts WHERE is_deleted = true;`
3. `SELECT * FROM invoices WHERE is_deleted = true;`

**Erwartetes Ergebnis:**
- Datensätze sind vorhanden
- is_deleted = true, deleted_at hat Zeitstempel

---

## 28. TC-FE: Frontend Spezifisch

### TC-FE-001: Finance Dashboard Navigation

| Feld | Wert |
|------|------|
| **ID** | TC-FE-001 |
| **Titel** | Finance Sidebar und Navigation |
| **Voraussetzung** | Eingeloggt als Admin/Kassier |
| **Priorität** | Hoch |

**Schritte:**

1. Login als Admin
2. Prüfe: Sidebar zeigt "Finanzen" Menüpunkt
3. Klicke "Finanzen" → Dashboard wird angezeigt
4. Navigation zu allen Unterseiten:
   - Buchungen
   - Rechnungen
   - Zahlungen
   - Bank Import
   - Mahnwesen
   - Belege
   - Spesenabrechnungen
   - Geschäftsperioden
   - Exporte
   - Tätigkeitsbereiche
   - Einstellungen

**Erwartetes Ergebnis:**
- Alle Links funktionieren
- Seiten laden ohne Fehler
- Korrekte Breadcrumbs (falls vorhanden)

---

### TC-FE-002: Responsive Design

| Feld | Wert |
|------|------|
| **ID** | TC-FE-002 |
| **Titel** | Mobile Darstellung prüfen |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Öffne Finance Dashboard auf Mobile-Viewport (375px)
2. Prüfe: Layout passt sich an, keine abgeschnittenen Inhalte
3. Teste Rechnungsliste, Buchungsliste, Formulare

**Erwartetes Ergebnis:**
- Mobile-first Tailwind Layouts reagieren korrekt
- Tabellen sind scrollbar oder stacken vertikal
- Buttons bleiben erreichbar

---

### TC-FE-003: Farben und Styling (Orange-Theme)

| Feld | Wert |
|------|------|
| **ID** | TC-FE-003 |
| **Titel** | Orange als Primärfarbe, KEIN Blau |
| **Voraussetzung** | — |
| **Priorität** | Hoch |

**Schritte:**

1. Prüfe alle Seiten:
   - Primäre Buttons sind Orange (#EA580C)
   - KEINE blauen Buttons
   - Focus-Ringe sind orange
   - Active/Hover States in Orange-Tönen

**Erwartetes Ergebnis:**
- Strikte Einhaltung des Orange-Themes
- Kein Blau ausser in Links (falls Standard bleiben soll)

---

### TC-FE-004: i18n — Alle Texte übersetzt

| Feld | Wert |
|------|------|
| **ID** | TC-FE-004 |
| **Titel** | Keine hardcodierten Strings im Frontend |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Wechsle Sprache auf English
2. Navigiere durch alle Finance-Seiten
3. Suche nach deutschen Texten, die nicht übersetzt wurden

**Erwartetes Ergebnis:**
- Alle Texte kommen aus i18n (de.json/en.json)
- Keine hardcodierten deutschen Strings

---

### TC-FE-005: Formular-Validierung im Frontend

| Feld | Wert |
|------|------|
| **ID** | TC-FE-005 |
| **Titel** | Frontend-Formulare validieren Pflichtfelder |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Versuche leeres Buchungsformular abzusenden
2. Versuche Rechnung ohne Positionen zu erstellen
3. Versuche Zahlung mit Betrag 0 abzusenden

**Erwartetes Ergebnis:**
- Client-seitige Validierungsmeldungen
- Formular wird nicht abgesendet

---

### TC-FE-006: Fehlerbehandlung (API Fehler)

| Feld | Wert |
|------|------|
| **ID** | TC-FE-006 |
| **Titel** | API-Fehler werden dem Benutzer angezeigt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Versuche eine Aktion, die einen Fehler verursacht (z.B. Buchung in gesperrter Periode)
2. Prüfe: Fehlermeldung wird angezeigt

**Erwartetes Ergebnis:**
- Verständliche Fehlermeldung im UI
- Kein leerer Bildschirm oder unbehandelter Fehler
- Fehlerformat: `{ code, message, details[], traceId }`

---

### TC-FE-007: Paginierung im Frontend

| Feld | Wert |
|------|------|
| **ID** | TC-FE-007 |
| **Titel** | Paginierung in Listenseiten funktioniert |
| **Voraussetzung** | > 20 Einträge vorhanden |
| **Priorität** | Mittel |

**Schritte:**

1. Öffne Buchungsliste
2. Prüfe: maximal 20 Einträge angezeigt
3. Navigiere zu Seite 2
4. Prüfe: nächste Einträge geladen

**Erwartetes Ergebnis:**
- Paginierungssteuerung sichtbar
- Seitenwechsel lädt neue Daten
- TotalCount wird angezeigt

---

---

## 29. TC-EC: Edge Cases & Grenzwerte (Codebase-Review)

> Die folgenden Testfälle wurden durch systematische Codeanalyse aller Validatoren, Domain-Guards,
> Command-Handler und Infrastruktur-Klassen identifiziert. Sie decken Grenzfälle ab, die in den
> Basis-Testfällen (Kapitel 3–28) nicht enthalten sind.

### 29.1 Validator-Grenzwerte (MaxLength, Enum, Range)

---

#### TC-FP-005: Organisationsname MaxLength(200)

| Feld | Wert |
|------|------|
| **ID** | TC-FP-005 |
| **Titel** | Organisationsname mit >200 Zeichen wird abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /api/v1/finance/profile` mit OrganizationName = 201× "A"

**Erwartetes Ergebnis:**
- 400 Bad Request: "Organization name must not exceed 200 characters."

---

#### TC-FP-006: Ungültiger Geschäftsjahresbeginn

| Feld | Wert |
|------|------|
| **ID** | TC-FP-006 |
| **Titel** | FiscalYearStartMonth ausserhalb 1–12 wird abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /api/v1/finance/profile` mit FiscalYearStartMonth = **0** → Fehler
2. FiscalYearStartMonth = **13** → Fehler

**Erwartetes Ergebnis:**
- Validierungsfehler: "Fiscal year start month must be between 1 and 12."

---

#### TC-FP-007: Ungültige Enum-Werte (Jurisdiction, Currency, VatStatus)

| Feld | Wert |
|------|------|
| **ID** | TC-FP-007 |
| **Titel** | Ungültige Enum-Werte für Profil-Felder |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Jurisdiction = "US" → Fehler (nur CH, EU)
2. Currency = "USD" → Fehler (nur CHF, EUR)
3. VatStatus = "Unknown" → Fehler

**Erwartetes Ergebnis:**
- Validierungsfehler für jeden ungültigen Enum-Wert

---

#### TC-FP-008: Adressfelder MaxLength-Grenzen

| Feld | Wert |
|------|------|
| **ID** | TC-FP-008 |
| **Titel** | Adressfelder-Maximallängen werden validiert |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. OrganizationAddress = 501 Zeichen (max 500) → Fehler
2. OrganizationCity = 101 Zeichen (max 100) → Fehler
3. OrganizationPostalCode = 21 Zeichen (max 20) → Fehler
4. OrganizationCountry = 101 Zeichen (max 100) → Fehler

**Erwartetes Ergebnis:**
- Je ein Validierungsfehler pro überlangem Feld

---

#### TC-FP-009: Whitespace-Only Pflichtfelder abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-FP-009 |
| **Titel** | Nur Leerzeichen in Pflichtfeldern werden als leer behandelt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. OrganizationName = "   " (nur Leerzeichen) → Fehler
2. OrganizationCity = "\t\n" (Tab/Newline) → Fehler

**Erwartetes Ergebnis:**
- NotEmpty-Validierung fängt Whitespace-Only Strings ab

---

#### TC-KO-009: Konto Name/Nummer MaxLength

| Feld | Wert |
|------|------|
| **ID** | TC-KO-009 |
| **Titel** | Kontoname >200 und Kontonummer >50 Zeichen abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. Name = 201 Zeichen → Fehler (max 200)
2. Number = 51 Zeichen → Fehler (max 50)

**Erwartetes Ergebnis:**
- Validierungsfehler für jedes überlange Feld

---

#### TC-KO-010: Ungültiger AccountType

| Feld | Wert |
|------|------|
| **ID** | TC-KO-010 |
| **Titel** | Ungültiger Kontotyp (z.B. CreditCard) wird abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Type = "CreditCard" → Fehler

**Erwartetes Ergebnis:**
- "Invalid account type." — Nur Cash, Bank, Other erlaubt

---

#### TC-KA-005: Kategorie Name MaxLength(200)

| Feld | Wert |
|------|------|
| **ID** | TC-KA-005 |
| **Titel** | Kategoriename >200 Zeichen abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. Name = 201 Zeichen → Fehler

**Erwartetes Ergebnis:**
- "Category name must not exceed 200 characters."

---

#### TC-ST-007: Steuersatz ausserhalb 0–1

| Feld | Wert |
|------|------|
| **ID** | TC-ST-007 |
| **Titel** | Rate >1.0 oder <0 wird abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Hoch |

**Schritte:**

1. Rate = **1.5** → Fehler
2. Rate = **-0.1** → Fehler
3. Rate = **8.1** (Prozent statt Dezimal — häufiger Benutzerfehler!) → Fehler

**Erwartetes Ergebnis:**
- "Rate must be between 0 and 1."

---

#### TC-ST-008: Steuercode Code/Label MaxLength

| Feld | Wert |
|------|------|
| **ID** | TC-ST-008 |
| **Titel** | Code >20 und Label >100 Zeichen abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. Code = 21 Zeichen → Fehler (max 20)
2. Label = 101 Zeichen → Fehler (max 100)

**Erwartetes Ergebnis:**
- Validierungsfehler für jedes überlange Feld

---

#### TC-BU-012: Buchung Beschreibung MaxLength(500)

| Feld | Wert |
|------|------|
| **ID** | TC-BU-012 |
| **Titel** | Beschreibung >500 Zeichen abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. Description = 501 Zeichen → Fehler

**Erwartetes Ergebnis:**
- "Description must not exceed 500 characters."

---

#### TC-BU-013: Ungültiger TransactionType

| Feld | Wert |
|------|------|
| **ID** | TC-BU-013 |
| **Titel** | Ungültiger Buchungstyp (z.B. Transfer) wird abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Type = "Transfer" → Fehler (nur Income, Expense)
2. Type = "" → Fehler

**Erwartetes Ergebnis:**
- "Invalid transaction type."

---

#### TC-RE-017: Empfängername MaxLength(300)

| Feld | Wert |
|------|------|
| **ID** | TC-RE-017 |
| **Titel** | RecipientName >300 Zeichen abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. RecipientName = 301 Zeichen → Fehler

**Erwartetes Ergebnis:**
- "Recipient name must not exceed 300 characters."

---

#### TC-RE-018: Ungültiger RecipientType

| Feld | Wert |
|------|------|
| **ID** | TC-RE-018 |
| **Titel** | Ungültiger Empfängertyp abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. RecipientType = "Customer" → Fehler (nur Member, Sponsor, Vendor, Other)

**Erwartetes Ergebnis:**
- "Invalid recipient type."

---

#### TC-RE-019: Position Quantity ≤ 0 abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-RE-019 |
| **Titel** | Rechnungsposition mit Menge ≤ 0 wird abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Hoch |

**Schritte:**

1. Item Quantity = **0** → Fehler
2. Item Quantity = **-1** → Fehler

**Erwartetes Ergebnis:**
- "Item quantity must be greater than zero."

---

#### TC-RE-020: Position UnitPrice < 0 abgelehnt, = 0 erlaubt

| Feld | Wert |
|------|------|
| **ID** | TC-RE-020 |
| **Titel** | Negativer Einzelpreis abgelehnt, Null erlaubt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. UnitPrice = **-50.00** → Fehler
2. UnitPrice = **0.00** → OK (Gratis-Position)

**Erwartetes Ergebnis:**
- UnitPrice < 0: "Unit price must be non-negative."
- UnitPrice = 0: Erfolgreich

---

#### TC-TB-003: Tätigkeitsbereich MaxLength-Grenzen

| Feld | Wert |
|------|------|
| **ID** | TC-TB-003 |
| **Titel** | Feld-Maximallängen bei Tätigkeitsbereichen |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. Name = 201 Zeichen (max 200) → Fehler
2. Code = 51 Zeichen (max 50) → Fehler
3. Description = 501 Zeichen (max 500) → Fehler
4. Color = 8 Zeichen (max 7) → Fehler

**Erwartetes Ergebnis:**
- Validierungsfehler pro überlangem Feld

---

#### TC-RV-004: Rechnungsvorlage MaxLength-Grenzen

| Feld | Wert |
|------|------|
| **ID** | TC-RV-004 |
| **Titel** | Vorlagen-Feld-Maximallängen |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. Name = 201 Zeichen (max 200) → Fehler
2. CountryCode = 3 Zeichen (max 2) → Fehler
3. TaxExemptionNote = 501 Zeichen (max 500) → Fehler
4. HeaderText = 1001 Zeichen (max 1000) → Fehler
5. FooterText = 1001 Zeichen (max 1000) → Fehler
6. Language = 6 Zeichen (max 5) → Fehler

**Erwartetes Ergebnis:**
- Validierungsfehler pro überlangem Feld

---

#### TC-AR-009: Archivierungsgrund MaxLength(1000)

| Feld | Wert |
|------|------|
| **ID** | TC-AR-009 |
| **Titel** | Archivierungsgrund >1000 Zeichen abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. `POST /archive` mit Reason = 1001 Zeichen → Fehler

**Erwartetes Ergebnis:**
- Validierungsfehler: Reason darf max 1000 Zeichen lang sein

---

### 29.2 Domain-Statusübergänge & Guard Clauses

---

#### TC-RE-021: Bezahlte Rechnung nochmals als bezahlt markieren abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-RE-021 |
| **Titel** | Paid → MarkAsPaid wird abgelehnt |
| **Voraussetzung** | Rechnung Status = Paid |
| **Priorität** | Hoch |

**Schritte:**

1. Versuche MarkAsPaid auf bereits bezahlte Rechnung

**Erwartetes Ergebnis:**
- "Cannot mark cancelled or already paid invoice as paid."

---

#### TC-RE-022: Stornierte Rechnung als bezahlt markieren abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-RE-022 |
| **Titel** | Cancelled → MarkAsPaid wird abgelehnt |
| **Voraussetzung** | Rechnung Status = Cancelled |
| **Priorität** | Hoch |

**Schritte:**

1. Storniere Rechnung, versuche dann MarkAsPaid

**Erwartetes Ergebnis:**
- "Cannot mark cancelled or already paid invoice as paid."

---

#### TC-RE-023: Positions-Manipulation auf Sent-Rechnung abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-RE-023 |
| **Titel** | Positionen auf gesendeter Rechnung hinzufügen/entfernen abgelehnt |
| **Voraussetzung** | Rechnung Status = Sent |
| **Priorität** | Hoch |

**Schritte:**

1. AddItem, RemoveItem, SetItems auf Sent-Rechnung

**Erwartetes Ergebnis:**
- "Only draft invoices can be modified."

---

#### TC-RE-024: Storno ohne Begründung abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-RE-024 |
| **Titel** | Storno ohne/mit leerem Reason wird abgelehnt |
| **Voraussetzung** | Rechnung Status = Sent |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /cancel` mit Reason = "" → Fehler
2. `POST /cancel` mit Reason = null → Fehler

**Erwartetes Ergebnis:**
- Validierungsfehler: "Cancellation reason is required."
- Domain-Guard prüft ebenfalls

---

#### TC-ZA-011: Payment ResetToDraft nur von Rejected

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-011 |
| **Titel** | ResetToDraft nur von Rejected-Status möglich |
| **Voraussetzung** | Zahlungen in verschiedenen Status |
| **Priorität** | Mittel |

**Schritte:**

1. Von Draft → ResetToDraft → Fehler
2. Von Submitted → ResetToDraft → Fehler
3. Von Approved → ResetToDraft → Fehler
4. Von Paid → ResetToDraft → Fehler
5. Von **Rejected → ResetToDraft → OK**

**Erwartetes Ergebnis:**
- Nur von Rejected: Status = Draft, Rejection-Daten gelöscht
- Alle anderen: "Only rejected payments can be reset to draft."

---

#### TC-ZA-012: Doppelte Genehmigung verhindern

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-012 |
| **Titel** | Bereits genehmigte Zahlung kann nicht nochmals genehmigt werden |
| **Voraussetzung** | Zahlung Status = Approved |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /approve` auf Approved-Zahlung

**Erwartetes Ergebnis:**
- "Only submitted payments can be approved."

---

#### TC-ZA-013: Bezahlte Zahlung ablehnen wird abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-013 |
| **Titel** | Paid-Zahlung kann nicht abgelehnt werden |
| **Voraussetzung** | Zahlung Status = Paid |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /reject` auf Paid-Zahlung

**Erwartetes Ergebnis:**
- "Only submitted payments can be rejected."

---

#### TC-SP-007: Direkt-Genehmigung aus Submitted abgelehnt (Review fehlt)

| Feld | Wert |
|------|------|
| **ID** | TC-SP-007 |
| **Titel** | Submitted-Spesen direkt genehmigen (ohne Review) wird abgelehnt |
| **Voraussetzung** | Spesenabrechnung Status = Submitted |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /approve` bei Status = Submitted (nicht UnderReview)

**Erwartetes Ergebnis:**
- "Only claims under review can be approved."
- Workflow: Draft → Submitted → UnderReview → Approved (Reihenfolge erzwungen)

---

#### TC-SP-008: Erstattung ohne Genehmigung abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-SP-008 |
| **Titel** | Nicht-genehmigte Spesen können nicht erstattet werden |
| **Voraussetzung** | Status = Submitted oder UnderReview |
| **Priorität** | Hoch |

**Schritte:**

1. `POST /reimburse` bei Status Submitted → Fehler
2. `POST /reimburse` bei Status UnderReview → Fehler

**Erwartetes Ergebnis:**
- "Only approved claims can be reimbursed."

---

#### TC-SP-009: Ablehnung aus UnderReview möglich

| Feld | Wert |
|------|------|
| **ID** | TC-SP-009 |
| **Titel** | Spesen im Review-Status können abgelehnt werden |
| **Voraussetzung** | Status = UnderReview |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /reject` bei Status UnderReview mit Reason

**Erwartetes Ergebnis:**
- Status = **Rejected** — Ablehnung aus Submitted UND UnderReview erlaubt

---

#### TC-SP-010: Erstattete Spesen ablehnen wird abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-SP-010 |
| **Titel** | Reimbursed-Spesen können nicht abgelehnt werden |
| **Voraussetzung** | Status = Reimbursed |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /reject` bei Status Reimbursed

**Erwartetes Ergebnis:**
- "Only submitted or reviewed claims can be rejected."

---

#### TC-SP-011: Update nur im Draft-Status

| Feld | Wert |
|------|------|
| **ID** | TC-SP-011 |
| **Titel** | Nur Draft-Spesen können bearbeitet werden |
| **Voraussetzung** | Status = Submitted |
| **Priorität** | Mittel |

**Schritte:**

1. `PUT /expense-claims/{id}` bei Status Submitted → Fehler

**Erwartetes Ergebnis:**
- "Only draft claims can be updated."

---

#### TC-MA-005: Mahnstufe ausserhalb 1–3 abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-MA-005 |
| **Titel** | Level 0 oder >3 wird abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Hoch |

**Schritte:**

1. Level = **0** → Fehler (Validator: GreaterThan(0))
2. Level = **4** → Fehler (Domain Guard: 1–3)

**Erwartetes Ergebnis:**
- "Dunning level must be between 1 and 3."

---

### 29.3 Steuerberechnung & Rundung

---

#### TC-BU-014: MwSt-Rundung bei Kleinstbetrag (0.01 CHF)

| Feld | Wert |
|------|------|
| **ID** | TC-BU-014 |
| **Titel** | Steuerberechnung bei 0.01 CHF mit 8.1% MwSt |
| **Voraussetzung** | Steuercode NORMAL (0.081) |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Buchung: Betrag = **0.01**, Steuercode NORMAL

**Erwartetes Ergebnis:**
- TaxAmount = 0.01 × 0.081 / 1.081 ≈ 0.000749... → gerundet: **0.00**
- NetAmount = **0.01**
- Kein Fehler, kein Division-by-Zero

---

#### TC-RE-025: Brutto-Position mit Rate = 0 (Division-Edge)

| Feld | Wert |
|------|------|
| **ID** | TC-RE-025 |
| **Titel** | Brutto-Position mit Steuersatz 0 — keine Division durch Null |
| **Voraussetzung** | Steuercode EXEMPT (Rate=0) |
| **Priorität** | Hoch |

**Schritte:**

1. Position: UnitPrice=100, IsGrossEntry=**true**, Rate=**0.0**

**Erwartetes Ergebnis:**
- GrossAmount = 100.00, NetAmount = **100.00**, TaxAmount = **0.00**
- Kein Fehler (Code prüft `rate > 0` vor Division)

---

#### TC-RE-026: Gemischte Netto/Brutto-Positionen in einer Rechnung

| Feld | Wert |
|------|------|
| **ID** | TC-RE-026 |
| **Titel** | Rechnung mit sowohl Netto- als auch Brutto-Positionen |
| **Voraussetzung** | Steuercode NORMAL (0.081) |
| **Priorität** | Hoch |

**Schritte:**

1. Position 1: Netto 100.00, Rate 0.081 → Net=100, Tax=8.10, Gross=108.10
2. Position 2: Brutto 108.00, Rate 0.081 → Gross=108, Net=99.91, Tax=8.09

**Erwartetes Ergebnis:**
- SubtotalNet = 199.91, TotalTax = 16.19, TotalGross = 216.10

---

#### TC-RE-027: Position mit extremer Menge × Preis

| Feld | Wert |
|------|------|
| **ID** | TC-RE-027 |
| **Titel** | Position mit Quantity=999999, UnitPrice=9999.99 |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Position mit Qty=999999, UnitPrice=9999.99

**Erwartetes Ergebnis:**
- Kein OverflowException (decimal handhabt bis 7.9 × 10²⁸)
- Berechnung korrekt

---

### 29.4 Zahlungs-/Rechnungskonsistenz

---

#### TC-ZA-014: Zahlung löschen → Rechnungsstatus zurückgesetzt

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-014 |
| **Titel** | Zahlung löschen setzt Rechnungsstatus von Paid auf Sent zurück |
| **Voraussetzung** | Rechnung Paid via Zahlung |
| **Priorität** | Hoch |

**Schritte:**

1. Rechnung Total=200 → Senden → Zahlung 200 → Rechnung = Paid
2. Lösche die Zahlung
3. Prüfe Rechnungsstatus

**Erwartetes Ergebnis:**
- Rechnungsstatus → **Sent** (nicht mehr Paid)
- Auto-Booking-Transaktion ebenfalls soft-deleted

---

#### TC-ZA-015: Überbezahlung — Rechnung wird trotzdem Paid

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-015 |
| **Titel** | Zahlung 150 für Rechnung mit Total 100 → Paid |
| **Voraussetzung** | Rechnung Total=100, Status=Sent |
| **Priorität** | Mittel |

**Schritte:**

1. Zahlung 150.00 für Rechnung (Total=100)

**Erwartetes Ergebnis:**
- Rechnung = **Paid** (150 ≥ 100)
- Überschuss wird nicht automatisch erstattet

---

#### TC-ZA-016: Exakter Schwellenwert — Teilzahlungen bis Total

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-016 |
| **Titel** | Exakte Summe der Teilzahlungen = Rechnungstotal → Paid |
| **Voraussetzung** | Rechnung Total=129.72 |
| **Priorität** | Hoch |

**Schritte:**

1. Zahlung 1: 50.00 → Sent
2. Zahlung 2: 50.00 → Sent (100 < 129.72)
3. Zahlung 3: 29.72 → **Paid** (129.72 = 129.72)

**Erwartetes Ergebnis:**
- Exakt am Schwellwert: Status = Paid

---

#### TC-ZA-017: Zahlung für Draft-Rechnung ändert Status nicht

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-017 |
| **Titel** | Zahlung für Draft-Rechnung lässt Status unverändert |
| **Voraussetzung** | Rechnung Status=Draft |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Zahlung mit InvoiceId der Draft-Rechnung

**Erwartetes Ergebnis:**
- Zahlung wird erstellt
- Rechnungsstatus bleibt **Draft** (kein Auto-MarkAsPaid für Draft)

---

### 29.5 Datei-Upload & Speicherung

---

#### TC-BE-006: Datei >10 MB abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-BE-006 |
| **Titel** | Upload über 10 MB wird abgelehnt |
| **Voraussetzung** | Testdatei >10 MB |
| **Priorität** | Hoch |

**Schritte:**

1. Upload einer Datei mit >10.485.760 Bytes

**Erwartetes Ergebnis:**
- "File size exceeds maximum allowed size of 10 MB."

---

#### TC-BE-007: Leere Datei (0 Bytes) abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-BE-007 |
| **Titel** | Leerer Datei-Upload wird abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Upload einer leeren Datei (0 Bytes)

**Erwartetes Ergebnis:**
- "File is empty." (Doppelte Validierung: Validator + Infrastructure)

---

#### TC-BE-008: Nur PDF, JPEG, PNG, TIFF erlaubt (nicht GIF/BMP/WEBP)

| Feld | Wert |
|------|------|
| **ID** | TC-BE-008 |
| **Titel** | Nur 4 Dateitypen erlaubt — GIF/BMP/WEBP abgelehnt |
| **Voraussetzung** | Verschiedene Testdateien |
| **Priorität** | Hoch |

**Schritte:**

1. test.pdf → ✅ Erlaubt
2. test.jpg → ✅ Erlaubt
3. test.png → ✅ Erlaubt
4. test.tiff → ✅ Erlaubt
5. test.gif → ❌ **Abgelehnt**
6. test.bmp → ❌ **Abgelehnt**
7. test.webp → ❌ **Abgelehnt**

**Erwartetes Ergebnis:**
- GIF, BMP, WEBP werden mit "File type not allowed" abgelehnt

---

#### TC-BE-009: Falsche Extension vs. ContentType

| Feld | Wert |
|------|------|
| **ID** | TC-BE-009 |
| **Titel** | Extension stimmt nicht mit ContentType überein → abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Upload: datei.xlsx mit ContentType application/pdf

**Erwartetes Ergebnis:**
- "File extension '.xlsx' is not allowed." (Extension UND ContentType werden separat geprüft)

---

### 29.6 pain.001 & IBAN/BIC Validierung

---

#### TC-PA-006: Ungültige IBAN-Formate

| Feld | Wert |
|------|------|
| **ID** | TC-PA-006 |
| **Titel** | IBAN-Formatvalidierung bei pain.001 |
| **Voraussetzung** | — |
| **Priorität** | Hoch |

**Schritte:**

1. IBAN = "INVALID" → Fehler
2. IBAN = "XX00123" (zu kurz) → Fehler
3. IBAN = "CH93 0076 2011 6238 5295 7" (mit Leerzeichen) → OK (normalisiert)
4. IBAN = "" → "Debtor IBAN is required."

**Erwartetes Ergebnis:**
- IBAN-Regex: `^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$`

---

#### TC-PA-007: Ungültige BIC-Formate

| Feld | Wert |
|------|------|
| **ID** | TC-PA-007 |
| **Titel** | BIC-Formatvalidierung — nur 8 oder 11 Zeichen |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. BIC = "ABC" (zu kurz) → Fehler
2. BIC = "POFICHBE" (8 Zeichen) → OK
3. BIC = "POFICHBEXXX" (11 Zeichen) → OK
4. BIC = "POFICHBEXX" (10 Zeichen) → Fehler

**Erwartetes Ergebnis:**
- BIC muss exakt 8 oder 11 Zeichen haben

---

#### TC-PA-008: CH SPS mit Nicht-CH-IBAN Warnung

| Feld | Wert |
|------|------|
| **ID** | TC-PA-008 |
| **Titel** | CH SPS Profil warnt bei nicht-CH/LI IBAN |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Validate mit Profile=ChSps, Debtor-IBAN = "DE89370400440532013000"

**Erwartetes Ergebnis:**
- Warnung: "Debtor IBAN country 'DE' is not CH/LI for CH SPS profile."
- Kein Fehler, aber Warnung

---

#### TC-PA-009: EndToEndId >35 Zeichen abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-PA-009 |
| **Titel** | ISO 20022 Feldlängenbeschränkung EndToEndId |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Export mit EndToEndId = 36 Zeichen

**Erwartetes Ergebnis:**
- "EndToEndId exceeds 35 characters."

---

#### TC-PA-010: MessageId >35 Zeichen abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-PA-010 |
| **Titel** | ISO 20022 Header-Feldlängenbeschränkung |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. Export mit MessageId = 36 Zeichen

**Erwartetes Ergebnis:**
- "MessageId exceeds 35 characters."

---

#### TC-PA-011: Währungsmismatch Warnung

| Feld | Wert |
|------|------|
| **ID** | TC-PA-011 |
| **Titel** | Verschiedene Währung in Zahlung vs. Profil erzeugt Warnung |
| **Voraussetzung** | Profil-Währung = CHF |
| **Priorität** | Mittel |

**Schritte:**

1. Export mit Payment Currency=EUR, Profil Currency=CHF

**Erwartetes Ergebnis:**
- Warnung: "Payment currency 'EUR' differs from profile currency 'CHF'."

---

### 29.7 Geschäftsperioden-Grenzfälle

---

#### TC-GP-007: EndDate ≤ StartDate abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-GP-007 |
| **Titel** | Periode mit EndDate vor StartDate abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Periode: EndDate = StartDate − 1 Tag

**Erwartetes Ergebnis:**
- "End date must be after start date."

---

#### TC-GP-008: Bereits gesperrte Periode erneut sperren abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-GP-008 |
| **Titel** | Lock auf Locked-Periode → Fehler |
| **Voraussetzung** | Status = Locked |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /lock` auf Locked-Periode

**Erwartetes Ergebnis:**
- "Period is already locked."

---

#### TC-GP-009: Nicht-gesperrte Periode entsperren abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-GP-009 |
| **Titel** | Unlock auf Open-Periode → Fehler |
| **Voraussetzung** | Status = Open |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /unlock` auf Open-Periode

**Erwartetes Ergebnis:**
- "Period is not locked."

---

#### TC-GP-010: Locked-Periode schliessen abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-GP-010 |
| **Titel** | Gesperrte Periode kann nicht geschlossen werden |
| **Voraussetzung** | Status = Locked |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /close` auf Locked-Periode

**Erwartetes Ergebnis:**
- "Cannot close a locked period. Unlock first."

---

#### TC-GP-011: Open-Periode wiedereröffnen abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-GP-011 |
| **Titel** | Bereits offene Periode kann nicht wiedereröffnet werden |
| **Voraussetzung** | Status = Open |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /reopen` auf Open-Periode

**Erwartetes Ergebnis:**
- "Only closed periods can be reopened."

---

#### TC-GP-012: Jahr ausserhalb 2000–2100 abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-GP-012 |
| **Titel** | Periodengenerierung nur für Jahre 2000–2100 |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. Year = **1999** → Fehler
2. Year = **2101** → Fehler

**Erwartetes Ergebnis:**
- "Year must be between 2000 and 2100."

---

#### TC-GP-013: Geschäftsjahresbeginn im April

| Feld | Wert |
|------|------|
| **ID** | TC-GP-013 |
| **Titel** | Perioden korrekt bei FiscalYearStartMonth = 4 (April) |
| **Voraussetzung** | Profil mit FiscalYearStartMonth = 4 |
| **Priorität** | Hoch |

**Schritte:**

1. Generiere Perioden für 2026

**Erwartetes Ergebnis:**
- Geschäftsjahr: April 2026 — März 2027
- 12 Perioden mit korrekten Start-/Enddaten

---

#### TC-GP-014: Schaltjahr Februar

| Feld | Wert |
|------|------|
| **ID** | TC-GP-014 |
| **Titel** | Februar 2028 (Schaltjahr) hat EndDate 29.02. |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Generiere Perioden für **2028** (Schaltjahr)
2. Prüfe Periode 2028-02

**Erwartetes Ergebnis:**
- EndDate = **29.02.2028** (nicht 28.02.)

---

### 29.8 Auto-Booking & Kaskaden

---

#### TC-ZA-018: MarkAsPaid ohne aktives Konto → Fehler

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-018 |
| **Titel** | Keine aktiven Konten → Auto-Booking schlägt fehl |
| **Voraussetzung** | Alle Konten deaktiviert/gelöscht |
| **Priorität** | Hoch |

**Schritte:**

1. Deaktiviere alle Konten
2. `POST /mark-paid` für eine Zahlung

**Erwartetes Ergebnis:**
- "No active account found. Please create at least one active account."

---

#### TC-ZA-019: Zahlung löschen → Auto-Booking-Transaktion mitgelöscht

| Feld | Wert |
|------|------|
| **ID** | TC-ZA-019 |
| **Titel** | Löschen einer Paid-Zahlung löscht verknüpfte Transaktion |
| **Voraussetzung** | Paid-Zahlung mit Auto-Booking |
| **Priorität** | Hoch |

**Schritte:**

1. MarkAsPaid → Transaktion wird automatisch erstellt
2. Lösche die Zahlung
3. Prüfe: Transaktion ebenfalls soft-deleted

**Erwartetes Ergebnis:**
- Payment.IsDeleted = true
- Verknüpfte Transaction.IsDeleted = true (Kaskade)

---

#### TC-SP-012: Spesenerstattung → Expense-Transaktion

| Feld | Wert |
|------|------|
| **ID** | TC-SP-012 |
| **Titel** | Spesenerstattung erstellt automatisch Expense-Transaktion |
| **Voraussetzung** | Genehmigte Spesenabrechnung |
| **Priorität** | Hoch |

**Schritte:**

1. Reimburse einer genehmigten Spesenabrechnung
2. Prüfe erstellte Objekte

**Erwartetes Ergebnis:**
- Transaktion: Type = **Expense**, Amount = Spesenbetrag
- Description enthält Spesen-Titel
- Payment.TransactionId gesetzt

---

### 29.9 eInvoice-Validierung (EN 16931)

---

#### TC-EI-006: Ungültiges XML → Fatal-Fehler

| Feld | Wert |
|------|------|
| **ID** | TC-EI-006 |
| **Titel** | Manipuliertes XML → Fatal-Fehler |
| **Voraussetzung** | — |
| **Priorität** | Hoch |

**Schritte:**

1. eInvoice-Validierung mit defektem XML

**Erwartetes Ergebnis:**
- Error: `{ ruleId: "XML-PARSE", severity: "Fatal" }`

---

#### TC-EI-007: Fehlende Verkäufer-Adresse (BR-08, BR-09)

| Feld | Wert |
|------|------|
| **ID** | TC-EI-007 |
| **Titel** | eInvoice ohne Seller-Adresse und Land |
| **Voraussetzung** | Profil ohne vollständige Adresse |
| **Priorität** | Hoch |

**Schritte:**

1. Rechnung mit unvollständigem Profil → validate-einvoice

**Erwartetes Ergebnis:**
- BR-08: "An Invoice shall have the Seller postal address."
- BR-09: "An Invoice shall have the Seller country code."

---

#### TC-EI-008: EU VatStatus=Registered ohne VatNumber

| Feld | Wert |
|------|------|
| **ID** | TC-EI-008 |
| **Titel** | EU-Profil Registered ohne VatNumber → Fehler beim Senden |
| **Voraussetzung** | EU-Profil, VatStatus=Registered, VatNumber="" |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle EU-Profil mit Registered-Status aber ohne VatNumber
2. Erstelle + versuche Rechnung zu senden

**Erwartetes Ergebnis:**
- "EU compliance: Finance profile is VAT-registered but has no VAT number configured."

---

### 29.10 Rechnungsnummern-Grenzfälle

---

#### TC-RN-005: Negativer Counter-Seed abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-RN-005 |
| **Titel** | InvoiceNumberCounter SeedValue(-1) → Fehler |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. Direkter Domain-Test: SeedValue(-1)

**Erwartetes Ergebnis:**
- "Value must be non-negative."

---

#### TC-RN-006: Leerer Prefix abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-RN-006 |
| **Titel** | Counter ohne Prefix → Fehler |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. Direkter Domain-Test: Create(profileId, 2026, "")

**Erwartetes Ergebnis:**
- "Prefix is required."

---

#### TC-RN-007: 4-stelliges Format (D4) und Überlauf

| Feld | Wert |
|------|------|
| **ID** | TC-RN-007 |
| **Titel** | Nummer ist immer 4-stellig, bei >9999 wird 5-stellig |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Rechnung #1 → "INV-2026-**0001**"
2. Rechnung #9999 → "INV-2026-**9999**"
3. Rechnung #10000 → "INV-2026-**10000**" (5 Ziffern, kein Fehler)

**Erwartetes Ergebnis:**
- Format: `{Prefix}{CurrentValue:D4}` — mindestens 4 Stellen, bei Bedarf mehr

---

### 29.11 Datumsgrenzen & Sonderfälle

---

#### TC-RE-028: DueDate vor Date — kein Validierungsfehler (⚠️ Known Gap)

| Feld | Wert |
|------|------|
| **ID** | TC-RE-028 |
| **Titel** | Fälligkeitsdatum vor Rechnungsdatum wird NICHT abgelehnt |
| **Voraussetzung** | — |
| **Priorität** | Hoch |

**Schritte:**

1. Erstelle Rechnung: Date = 01.03.2026, DueDate = 01.02.2026

**Erwartetes Ergebnis:**
- ⚠️ **Rechnung wird erstellt** — es gibt KEINE Validierung die DueDate ≥ Date prüft
- Dies ist ein **bekannter Feature-Gap** (logisch falsch, aber vom System akzeptiert)

---

#### TC-RE-029: Rechnung mit Datum in ferner Zukunft

| Feld | Wert |
|------|------|
| **ID** | TC-RE-029 |
| **Titel** | Rechnung mit Datum 01.01.2099 |
| **Voraussetzung** | — |
| **Priorität** | Niedrig |

**Schritte:**

1. Erstelle Rechnung: Date = 01.01.2099

**Erwartetes Ergebnis:**
- Wird erstellt (keine Datumsbegrenzung)
- Rechnungsnummer: INV-**2099**-0001

---

#### TC-BI-007: camt-Import ohne .xml Extension abgelehnt

| Feld | Wert |
|------|------|
| **ID** | TC-BI-007 |
| **Titel** | camt-Import akzeptiert nur .xml Dateien |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. `POST /bank-imports/camt` mit Datei "import.csv"

**Erwartetes Ergebnis:**
- "File must be an XML file."

---

### 29.12 Sonderzeichen & Encoding

---

#### TC-BU-015: Unicode in Buchungsbeschreibung

| Feld | Wert |
|------|------|
| **ID** | TC-BU-015 |
| **Titel** | Unicode-Zeichen werden korrekt gespeichert |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Erstelle Buchung: Description = "Büromöbel für Naïve Café — à la carte 日本語 🎵"
2. Lade Buchung erneut

**Erwartetes Ergebnis:**
- Beschreibung identisch zurückgegeben, keine Encoding-Fehler

---

#### TC-RE-030: Empfänger mit Umlauten im PDF und eInvoice XML

| Feld | Wert |
|------|------|
| **ID** | TC-RE-030 |
| **Titel** | Sonderzeichen korrekt in PDF und XML |
| **Voraussetzung** | — |
| **Priorität** | Mittel |

**Schritte:**

1. Rechnung: RecipientName = "Müller & Söhne GmbH — «Créations»"
2. Generiere PDF → Umlaute korrekt
3. Generiere eInvoice XML → korrekt escapt (& → \&amp;)

**Erwartetes Ergebnis:**
- PDF zeigt Umlaute korrekt
- XML korrekt escapt

---

#### TC-RE-031: Storno erstellt Expense-Transaktion (nicht Income)

| Feld | Wert |
|------|------|
| **ID** | TC-RE-031 |
| **Titel** | Storno-Buchung hat korrekt Typ = Expense |
| **Voraussetzung** | Gesendete Rechnung |
| **Priorität** | Hoch |

**Schritte:**

1. Storniere gesendete Rechnung
2. Prüfe erstellte Storno-Transaktion

**Erwartetes Ergebnis:**
- Type = **Expense** (Umkehrbuchung)
- Description = "STORNO: {InvoiceNumber}"
- Reference = "STORNO-{InvoiceNumber}"

---

---

## Testfall-Übersicht (Zusammenfassung)

| Bereich | Testfall-ID Bereich | Anzahl |
|---------|---------------------|--------|
| Finanzprofil | TC-FP-001 bis TC-FP-009 | 9 |
| Konten | TC-KO-001 bis TC-KO-010 | 10 |
| Kategorien | TC-KA-001 bis TC-KA-005 | 5 |
| Steuercodes | TC-ST-001 bis TC-ST-008 | 8 |
| Buchungen | TC-BU-001 bis TC-BU-015 | 15 |
| Rechnungen | TC-RE-001 bis TC-RE-031 | 31 |
| Zahlungen | TC-ZA-001 bis TC-ZA-019 | 19 |
| Spesenabrechnungen | TC-SP-001 bis TC-SP-012 | 12 |
| Bankimport | TC-BI-001 bis TC-BI-007 | 7 |
| Mahnwesen | TC-MA-001 bis TC-MA-005 | 5 |
| Belege | TC-BE-001 bis TC-BE-009 | 9 |
| Geschäftsperioden | TC-GP-001 bis TC-GP-014 | 14 |
| Rechnungsvorlagen | TC-RV-001 bis TC-RV-004 | 4 |
| Tätigkeitsbereiche | TC-TB-001 bis TC-TB-003 | 3 |
| Dashboard | TC-DB-001 bis TC-DB-002 | 2 |
| Exporte | TC-EX-001 bis TC-EX-003 | 3 |
| Archivierung (REQ-070) | TC-AR-001 bis TC-AR-009 | 9 |
| Rechnungsnummern (REQ-071) | TC-RN-001 bis TC-RN-007 | 7 |
| eInvoice (REQ-072) | TC-EI-001 bis TC-EI-008 | 8 |
| pain.001 (REQ-073) | TC-PA-001 bis TC-PA-011 | 11 |
| PDF / QR-Bill | TC-PDF-001 bis TC-PDF-005 | 5 |
| Background Jobs | TC-BJ-001 bis TC-BJ-003 | 3 |
| Berechtigungen | TC-AU-001 bis TC-AU-007 | 7 |
| Paginierung | TC-PG-001 bis TC-PG-005 | 5 |
| Soft-Delete | TC-SD-001 bis TC-SD-002 | 2 |
| Frontend | TC-FE-001 bis TC-FE-007 | 7 |
| **TOTAL** | | **228** |
