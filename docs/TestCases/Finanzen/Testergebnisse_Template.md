# Testergebnisse — Finanzmodul IAB Connect

> **Tester:** ________________________  
> **Testdatum:** ________________________  
> **Umgebung:** ☐ Lokal (localhost) · ☐ Staging · ☐ Produktion  
> **Version/Commit:** ________________________  
> **Browser:** ________________________  
> **Betriebssystem:** ________________________

---

## Legende

| Symbol | Status | Bedeutung |
|--------|--------|-----------|
| ✅ | **Bestanden** | Erwartetes Ergebnis stimmt überein |
| ❌ | **Fehlgeschlagen** | Erwartetes Ergebnis stimmt NICHT überein |
| ⚠️ | **Teilweise** | Grundfunktion ok, aber Abweichungen vorhanden |
| ⏭️ | **Übersprungen** | Test nicht durchgeführt (Grund angeben) |
| 🔄 | **Blockiert** | Abhängigkeit nicht erfüllt |

---

## Zusammenfassung

| Bereich | Total | ✅ | ❌ | ⚠️ | ⏭️ | 🔄 |
|---------|-------|-----|-----|------|------|------|
| TC-FP: Finanzprofil | 9 | | | | | |
| TC-KO: Konten | 10 | | | | | |
| TC-KA: Kategorien | 5 | | | | | |
| TC-ST: Steuercodes | 8 | | | | | |
| TC-BU: Buchungen | 15 | | | | | |
| TC-RE: Rechnungen | 31 | | | | | |
| TC-ZA: Zahlungen | 19 | | | | | |
| TC-SP: Spesenabrechnungen | 12 | | | | | |
| TC-BI: Bankimport | 7 | | | | | |
| TC-MA: Mahnwesen | 5 | | | | | |
| TC-BE: Belege | 9 | | | | | |
| TC-GP: Geschäftsperioden | 14 | | | | | |
| TC-RV: Rechnungsvorlagen | 4 | | | | | |
| TC-TB: Tätigkeitsbereiche | 3 | | | | | |
| TC-DB: Dashboard | 2 | | | | | |
| TC-EX: Exporte | 3 | | | | | |
| TC-AR: Archivierung | 9 | | | | | |
| TC-RN: Rechnungsnummern | 7 | | | | | |
| TC-EI: eInvoice | 8 | | | | | |
| TC-PA: pain.001 | 11 | | | | | |
| TC-PDF: PDF / QR-Bill | 5 | | | | | |
| TC-BJ: Background Jobs | 3 | | | | | |
| TC-AU: Berechtigungen | 7 | | | | | |
| TC-PG: Paginierung | 5 | | | | | |
| TC-SD: Soft-Delete | 2 | | | | | |
| TC-FE: Frontend | 7 | | | | | |
| **TOTAL** | **228** | | | | | |

**Bestanden-Quote:** ______ / 228 = ______%

---

## Detaillierte Testergebnisse

### TC-FP: Finanzprofil

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-FP-001 | Finanzprofil für Schweizer Verein erstellen | | | |
| TC-FP-002 | Finanzprofil für EU-Verein erstellen | | | |
| TC-FP-003 | Bestehendes Profil ändern | | | |
| TC-FP-004 | Zweites Profil deaktiviert bestehendes automatisch | | | |
| TC-FP-005 | Organisationsname >200 Zeichen abgelehnt | | | |
| TC-FP-006 | FiscalYearStartMonth ausserhalb 1–12 abgelehnt | | | |
| TC-FP-007 | Ungültige Enum-Werte (Jurisdiction, Currency, VatStatus) | | | |
| TC-FP-008 | Adressfelder MaxLength-Grenzen | | | |
| TC-FP-009 | Whitespace-only Pflichtfelder abgelehnt | | | |

---

### TC-KO: Konten

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-KO-001 | Neues Finanzkonto erstellen | | | |
| TC-KO-002 | Bankkonto erstellen | | | |
| TC-KO-003 | Kontoname und Beschreibung ändern | | | |
| TC-KO-004 | Konto deaktivieren | | | |
| TC-KO-005 | Deaktiviertes Konto wieder aktivieren | | | |
| TC-KO-006 | Konto löschen | | | |
| TC-KO-007 | Doppelte Kontonummer wird abgelehnt | | | |
| TC-KO-008 | Konto ohne Name/Nummer ablehnen | | | |
| TC-KO-009 | Kontoname >200 und Kontonummer >50 Zeichen | | | |
| TC-KO-010 | Ungültiger AccountType (z.B. CreditCard) | | | |

---

### TC-KA: Kategorien

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-KA-001 | Neue Einnahmekategorie erstellen | | | |
| TC-KA-002 | Neue Ausgabekategorie erstellen | | | |
| TC-KA-003 | Kategorie deaktivieren und wieder aktivieren | | | |
| TC-KA-004 | Kategorie löschen | | | |
| TC-KA-005 | Kategoriename >200 Zeichen abgelehnt | | | |

---

### TC-ST: Steuercodes

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-ST-001 | MwSt 8.1% Normalsatz erstellen | | | |
| TC-ST-002 | MwSt 2.6% Reduzierter Satz erstellen | | | |
| TC-ST-003 | MwSt-befreiter Steuercode erstellen | | | |
| TC-ST-004 | Doppelter Steuercode-Name ablehnen | | | |
| TC-ST-005 | Steuersatz ändern | | | |
| TC-ST-006 | Steuercode löschen | | | |
| TC-ST-007 | Steuersatz >1.0 oder <0 abgelehnt | | | |
| TC-ST-008 | Steuercode Code/Label MaxLength | | | |

---

### TC-BU: Buchungen

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-BU-001 | Neue Einnahme erfassen | | | |
| TC-BU-002 | Neue Ausgabe erfassen | | | |
| TC-BU-003 | Buchung ohne MwSt erstellen | | | |
| TC-BU-004 | Bestehende Buchung bearbeiten | | | |
| TC-BU-005 | Buchung löschen | | | |
| TC-BU-006 | Beleg an Buchung anhängen | | | |
| TC-BU-007 | Beleg von Buchung entfernen | | | |
| TC-BU-008 | Buchung in gesperrter Periode ablehnen | | | |
| TC-BU-009 | Ungültiger Betrag wird abgelehnt | | | |
| TC-BU-010 | Buchung einem Tätigkeitsbereich zuweisen | | | |
| TC-BU-011 | Buchungszusammenfassung abrufen | | | |
| TC-BU-012 | Beschreibung >500 Zeichen abgelehnt | | | |
| TC-BU-013 | Ungültiger TransactionType (z.B. Transfer) | | | |
| TC-BU-014 | MwSt-Rundung bei Kleinstbetrag (0.01 CHF) | | | |
| TC-BU-015 | Unicode in Buchungsbeschreibung | | | |

---

### TC-RE: Rechnungen

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-RE-001 | Neue Rechnung als Entwurf erstellen | | | |
| TC-RE-002 | Rechnung mit Bruttoeingabe erstellen | | | |
| TC-RE-003 | Rechnung mit mehreren Positionen und verschiedenen Steuersätzen | | | |
| TC-RE-004 | Entwurfsrechnung versenden | | | |
| TC-RE-005 | Draft-Rechnung bearbeiten | | | |
| TC-RE-006 | Sent-Rechnung kann nicht bearbeitet werden | | | |
| TC-RE-007 | Gesendete Rechnung als überfällig markieren | | | |
| TC-RE-008 | Mark-Overdue wird abgelehnt wenn nicht fällig | | | |
| TC-RE-009 | Gesendete Rechnung stornieren | | | |
| TC-RE-010 | Draft-Rechnung kann nicht storniert werden | | | |
| TC-RE-011 | Rechnung wird automatisch als bezahlt markiert | | | |
| TC-RE-012 | Teilzahlung lässt Rechnung im Status Sent | | | |
| TC-RE-013 | Offene Rechnungen abfragen | | | |
| TC-RE-014 | Rechnung löschen | | | |
| TC-RE-015 | Rechnung ohne Positionen wird abgelehnt | | | |
| TC-RE-016 | EU Rechnung: MwSt-Pflichtfelder beim Versenden | | | |
| TC-RE-017 | RecipientName >300 Zeichen abgelehnt | | | |
| TC-RE-018 | Ungültiger RecipientType | | | |
| TC-RE-019 | Position Quantity ≤ 0 abgelehnt | | | |
| TC-RE-020 | Position UnitPrice < 0 abgelehnt, = 0 erlaubt | | | |
| TC-RE-021 | Paid → MarkAsPaid abgelehnt | | | |
| TC-RE-022 | Cancelled → MarkAsPaid abgelehnt | | | |
| TC-RE-023 | Positions-Manipulation auf Sent-Rechnung | | | |
| TC-RE-024 | Storno ohne Begründung abgelehnt | | | |
| TC-RE-025 | Brutto-Position mit Rate = 0 (Division-Edge) | | | |
| TC-RE-026 | Gemischte Netto/Brutto-Positionen | | | |
| TC-RE-027 | Position mit extremer Menge × Preis | | | |
| TC-RE-028 | DueDate < Date — KEIN Fehler (⚠️ Known Gap) | | | |
| TC-RE-029 | Rechnung mit Datum in ferner Zukunft (2099) | | | |
| TC-RE-030 | Empfänger mit Umlauten in PDF/XML | | | |
| TC-RE-031 | Storno erstellt Expense-Transaktion (nicht Income) | | | |

---

### TC-ZA: Zahlungen

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-ZA-001 | Eingehende Zahlung erstellen | | | |
| TC-ZA-002 | Zahlung zur Genehmigung einreichen | | | |
| TC-ZA-003 | Eingereichte Zahlung genehmigen | | | |
| TC-ZA-004 | Eingereichte Zahlung ablehnen | | | |
| TC-ZA-005 | Ablehnung ohne Begründung wird abgelehnt | | | |
| TC-ZA-006 | Genehmigte Zahlung als bezahlt markieren | | | |
| TC-ZA-007 | Kleine Zahlung direkt als bezahlt markieren | | | |
| TC-ZA-008 | Grosse Zahlung ohne Genehmigung ablehnen | | | |
| TC-ZA-009 | Beleg an Zahlung anhängen und entfernen | | | |
| TC-ZA-010 | Zahlung in gesperrter Periode ablehnen | | | |
| TC-ZA-011 | ResetToDraft nur von Rejected möglich | | | |
| TC-ZA-012 | Doppelte Genehmigung verhindern | | | |
| TC-ZA-013 | Bezahlte Zahlung ablehnen wird abgelehnt | | | |
| TC-ZA-014 | Zahlung löschen → Rechnungsstatus zurückgesetzt | | | |
| TC-ZA-015 | Überbezahlung — Rechnung wird trotzdem Paid | | | |
| TC-ZA-016 | Exakte Teilzahlungssumme = Rechnungstotal → Paid | | | |
| TC-ZA-017 | Zahlung für Draft-Rechnung lässt Status unverändert | | | |
| TC-ZA-018 | MarkAsPaid ohne aktives Konto → Fehler | | | |
| TC-ZA-019 | Zahlung löschen → Auto-Booking mitgelöscht | | | |

---

### TC-SP: Spesenabrechnungen

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-SP-001 | Neue Spesenabrechnung erstellen | | | |
| TC-SP-002 | Kompletter Spesenworkflow durchlaufen | | | |
| TC-SP-003 | Spesenabrechnung ablehnen | | | |
| TC-SP-004 | Fehlendes Ablehnungsgrund wird abgelehnt | | | |
| TC-SP-005 | Abgelehnte Spesenabrechnung auf Draft zurücksetzen | | | |
| TC-SP-006 | Draft-Spesenabrechnung bearbeiten | | | |
| TC-SP-007 | Submitted direkt genehmigen (ohne Review) abgelehnt | | | |
| TC-SP-008 | Erstattung ohne Genehmigung abgelehnt | | | |
| TC-SP-009 | Ablehnung aus UnderReview möglich | | | |
| TC-SP-010 | Erstattete Spesen ablehnen abgelehnt | | | |
| TC-SP-011 | Update nur im Draft-Status | | | |
| TC-SP-012 | Spesenerstattung → Expense-Transaktion | | | |

---

### TC-BI: Bankimport

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-BI-001 | CSV-Bankdaten importieren | | | |
| TC-BI-002 | ISO 20022 camt.053 Datei importieren | | | |
| TC-BI-003 | Automatic Matching Algorithm testen | | | |
| TC-BI-004 | Bankimport-Item manuell zuordnen | | | |
| TC-BI-005 | Bankimport-Item ignorieren | | | |
| TC-BI-006 | Zugeordnetes Item wieder freigeben | | | |
| TC-BI-007 | camt-Import ohne .xml Extension abgelehnt | | | |

---

### TC-MA: Mahnwesen

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-MA-001 | Erste Mahnung für überfällige Rechnung | | | |
| TC-MA-002 | Mahnung als versendet markieren | | | |
| TC-MA-003 | Zweite und dritte Mahnung | | | |
| TC-MA-004 | Mahnungen nach Rechnung filtern | | | |
| TC-MA-005 | Mahnstufe ausserhalb 1–3 abgelehnt | | | |

---

### TC-BE: Belege

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-BE-001 | PDF-Beleg hochladen | | | |
| TC-BE-002 | JPEG-Beleg hochladen | | | |
| TC-BE-003 | Nicht-Bild/PDF Datei wird abgelehnt | | | |
| TC-BE-004 | Beleg aus S3 herunterladen | | | |
| TC-BE-005 | Beleg löschen | | | |
| TC-BE-006 | Datei >10 MB abgelehnt | | | |
| TC-BE-007 | Leere Datei (0 Bytes) abgelehnt | | | |
| TC-BE-008 | Nur PDF/JPEG/PNG/TIFF erlaubt (nicht GIF/BMP/WEBP) | | | |
| TC-BE-009 | Falsche Extension vs. ContentType | | | |

---

### TC-GP: Geschäftsperioden

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-GP-001 | 12 Monatsperioden für 2026 generieren | | | |
| TC-GP-002 | Abgelaufene Periode schliessen | | | |
| TC-GP-003 | Periode unwiderruflich sperren | | | |
| TC-GP-004 | Gesperrte Periode wieder öffnen | | | |
| TC-GP-005 | Geschlossene Periode wiedereröffnen | | | |
| TC-GP-006 | Alle 10 Handlers blockieren Mutationen | | | |
| TC-GP-007 | EndDate ≤ StartDate abgelehnt | | | |
| TC-GP-008 | Locked-Periode erneut sperren abgelehnt | | | |
| TC-GP-009 | Open-Periode entsperren abgelehnt | | | |
| TC-GP-010 | Locked-Periode schliessen abgelehnt | | | |
| TC-GP-011 | Open-Periode wiedereröffnen abgelehnt | | | |
| TC-GP-012 | Jahr ausserhalb 2000–2100 abgelehnt | | | |
| TC-GP-013 | Geschäftsjahresbeginn im April | | | |
| TC-GP-014 | Schaltjahr Februar korrekt | | | |

---

### TC-RV: Rechnungsvorlagen

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-RV-001 | CH Rechnungsvorlage erstellen | | | |
| TC-RV-002 | EU Rechnungsvorlage mit Compliance-Feldern | | | |
| TC-RV-003 | Vorlage löschen | | | |
| TC-RV-004 | Vorlagen-Feld-Maximallängen | | | |

---

### TC-TB: Tätigkeitsbereiche

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-TB-001 | Neuen Tätigkeitsbereich erstellen | | | |
| TC-TB-002 | Ergebnis pro Tätigkeitsbereich abrufen | | | |
| TC-TB-003 | Feld-Maximallängen bei Tätigkeitsbereichen | | | |

---

### TC-DB: Dashboard

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-DB-001 | Dashboard zeigt korrekte KPIs | | | |
| TC-DB-002 | Dashboard zeigt Null-Werte ohne Daten | | | |

---

### TC-EX: Exporte

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-EX-001 | Journal als CSV exportieren | | | |
| TC-EX-002 | Offene Posten als CSV exportieren | | | |
| TC-EX-003 | MwSt-Zusammenfassung als CSV exportieren | | | |

---

### TC-AR: Archivierung (REQ-070)

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-AR-001 | Finalisierte Rechnung archivieren | | | |
| TC-AR-002 | Keine Änderungen an archivierten Rechnungen | | | |
| TC-AR-003 | Beleg archivieren | | | |
| TC-AR-004 | Archivierte Rechnung als Admin wiederherstellen | | | |
| TC-AR-005 | Archivierten Beleg wiederherstellen | | | |
| TC-AR-006 | Physische Löschung nach Ablauf Aufbewahrungsfrist | | | |
| TC-AR-007 | Purge löscht keine aktiven Archive | | | |
| TC-AR-008 | Kassier/Auditor können nicht purgen | | | |
| TC-AR-009 | Archivierungsgrund >1000 Zeichen abgelehnt | | | |

---

### TC-RN: Rechnungsnummern (REQ-071)

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-RN-001 | Rechnungsnummer wird automatisch vergeben | | | |
| TC-RN-002 | Nummernkreis startet pro Geschäftsjahr neu | | | |
| TC-RN-003 | Rechnungsnummer unveränderlich nach Versand | | | |
| TC-RN-004 | Eindeutigkeit der Rechnungsnummer | | | |
| TC-RN-005 | Negativer Counter-Seed abgelehnt | | | |
| TC-RN-006 | Leerer Prefix abgelehnt | | | |
| TC-RN-007 | 4-stelliges Format (D4) und Überlauf | | | |

---

### TC-EI: eInvoice (REQ-072)

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-EI-001 | Vollständige Rechnung besteht Validierung | | | |
| TC-EI-002 | eInvoice ohne Empfängername wird abgelehnt | | | |
| TC-EI-003 | Falsche Steuerkategorie wird erkannt | | | |
| TC-EI-004 | UBL 2.1 eInvoice XML abrufen | | | |
| TC-EI-005 | eInvoice Feature-Flag deaktiviert | | | |
| TC-EI-006 | Ungültiges XML → Fatal-Fehler | | | |
| TC-EI-007 | Fehlende Verkäufer-Adresse (BR-08, BR-09) | | | |
| TC-EI-008 | EU Registered ohne VatNumber | | | |

---

### TC-PA: pain.001 (REQ-073)

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-PA-001 | CH SPS Zahlungsdatei exportieren | | | |
| TC-PA-002 | SEPA Zahlungsdatei exportieren | | | |
| TC-PA-003 | Validierung zeigt Fehler vor Export an | | | |
| TC-PA-004 | Nicht-genehmigte Zahlungen werden abgelehnt | | | |
| TC-PA-005 | Kontrollsumme und Anzahl Transaktionen | | | |
| TC-PA-006 | Ungültige IBAN-Formate | | | |
| TC-PA-007 | Ungültige BIC-Formate (nur 8 oder 11 Zeichen) | | | |
| TC-PA-008 | CH SPS mit Nicht-CH-IBAN Warnung | | | |
| TC-PA-009 | EndToEndId >35 Zeichen abgelehnt | | | |
| TC-PA-010 | MessageId >35 Zeichen abgelehnt | | | |
| TC-PA-011 | Währungsmismatch Warnung | | | |

---

### TC-PDF: PDF / QR-Bill

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-PDF-001 | PDF für gesendete Rechnung herunterladen | | | |
| TC-PDF-002 | Rechnung mit Swiss QR-Bill | | | |
| TC-PDF-003 | QR-Referenz wird bei QR-IBAN generiert | | | |
| TC-PDF-004 | ISO 11649 Creditor Reference bei normaler IBAN | | | |
| TC-PDF-005 | EU-Rechnung ohne Swiss QR-Bill | | | |

---

### TC-BJ: Background Jobs

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-BJ-001 | Täglicher Job markiert überfällige Rechnungen | | | |
| TC-BJ-002 | Wöchentlicher Job erstellt Mahnungen | | | |
| TC-BJ-003 | Jobs sind idempotent | | | |

---

### TC-AU: Berechtigungen

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-AU-001 | Admin hat vollen Zugriff | | | |
| TC-AU-002 | Kassier kann lesen und schreiben | | | |
| TC-AU-003 | Kassier kann nicht purgen | | | |
| TC-AU-004 | Auditor kann nur lesen | | | |
| TC-AU-005 | Vorstand: nur Zahlungen genehmigen/ablehnen | | | |
| TC-AU-006 | Einfaches Mitglied hat keinen Finanzzugriff | | | |
| TC-AU-007 | Ohne Token kein Zugriff | | | |

---

### TC-PG: Paginierung

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-PG-001 | Standard-Paginierung | | | |
| TC-PG-002 | Zweite Seite abfragen | | | |
| TC-PG-003 | PageSize auf 5 setzen | | | |
| TC-PG-004 | Ergebnisse sortieren | | | |
| TC-PG-005 | Alle 13 Endpunkte unterstützen Paginierung | | | |

---

### TC-SD: Soft-Delete

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-SD-001 | Soft-Delete für alle Finanzentitäten | | | |
| TC-SD-002 | Soft-gelöschte Daten in DB prüfen | | | |

---

### TC-FE: Frontend

| Test-ID | Titel | Status | Kommentar / Abweichung | Screenshot |
|---------|-------|--------|------------------------|------------|
| TC-FE-001 | Finance Sidebar und Navigation | | | |
| TC-FE-002 | Mobile Darstellung prüfen | | | |
| TC-FE-003 | Orange als Primärfarbe, KEIN Blau | | | |
| TC-FE-004 | Alle Texte übersetzt (i18n) | | | |
| TC-FE-005 | Frontend-Formulare validieren Pflichtfelder | | | |
| TC-FE-006 | API-Fehler werden dem Benutzer angezeigt | | | |
| TC-FE-007 | Paginierung in Listenseiten funktioniert | | | |

---

## Gefundene Fehler (Bug-Log)

| Bug-Nr | Test-ID | Priorität | Beschreibung | Schritte zur Reproduktion | Erwartetes Verhalten | Tatsächliches Verhalten | Screenshot | Status |
|--------|---------|-----------|--------------|---------------------------|----------------------|------------------------|------------|--------|
| BUG-001 | | | | | | | | ☐ Offen |
| BUG-002 | | | | | | | | ☐ Offen |
| BUG-003 | | | | | | | | ☐ Offen |
| BUG-004 | | | | | | | | ☐ Offen |
| BUG-005 | | | | | | | | ☐ Offen |
| BUG-006 | | | | | | | | ☐ Offen |
| BUG-007 | | | | | | | | ☐ Offen |
| BUG-008 | | | | | | | | ☐ Offen |
| BUG-009 | | | | | | | | ☐ Offen |
| BUG-010 | | | | | | | | ☐ Offen |

> Weitere Zeilen bei Bedarf hinzufügen. Bug-Status: ☐ Offen | ☑ Behoben | ☒ Nicht behebbar (mit Begründung)

---

## Abschluss

| Feld | Eintrag |
|------|---------|
| **Testabschluss-Datum:** | |
| **Gesamtbewertung:** | ☐ Bestanden · ☐ Bedingt bestanden · ☐ Nicht bestanden |
| **Offene Blocker:** | |
| **Nächste Schritte:** | |
| **Unterschrift Tester:** | |
| **Unterschrift Projektleitung:** | |
