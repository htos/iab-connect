# Testergebnisse — Audit & DSGVO-Modul IAB Connect

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
| 1. Audit-Events abfragen | 8 | | | | | |
| 2. Audit CSV-Export | 5 | | | | | |
| 3. Audit Entity/User History | 4 | | | | | |
| 4. Audit Kategorien & Event-Types | 4 | | | | | |
| 5. Einwilligung (Consent) | 12 | | | | | |
| 6. Datenexport (DSGVO Art. 20) | 4 | | | | | |
| 7. Löschantrag erstellen | 6 | | | | | |
| 8. Löschantrag bestätigen | 5 | | | | | |
| 9. Löschantrag Admin-Verarbeitung | 8 | | | | | |
| 10. Löschantrag stornieren | 4 | | | | | |
| 11. Autorisierung & Rollen | 10 | | | | | |
| **TOTAL** | **70** | | | | | |

**Bestanden-Quote:** ______ / 70 = ______%

---

## Detaillierte Testergebnisse

### 1. Audit-Events abfragen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AD-001 | Audit-Events auflisten | | |
| TC-AD-002 | Nach Datum filtern | | |
| TC-AD-003 | Nach EventType filtern | | |
| TC-AD-004 | Nach Category filtern | | |
| TC-AD-005 | Nach Severity filtern | | |
| TC-AD-006 | Volltextsuche | | |
| TC-AD-007 | Nach Success filtern | | |
| TC-AD-008 | Paginierung | | |

### 2. Audit CSV-Export

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AD-009 | CSV-Export Standard | | |
| TC-AD-010 | Export mit Datumsbereich | | |
| TC-AD-011 | Max 10.000 Records | | |
| TC-AD-012 | Self-Audit-Logging | | |
| TC-AD-013 | Leerer Zeitraum | | |

### 3. Audit Entity/User History

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AD-014 | Entity History | | |
| TC-AD-015 | User History | | |
| TC-AD-016 | Login-Tracking | | |
| TC-AD-017 | Nicht exist. Entity | | |

### 4. Audit Kategorien & Event-Types

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AD-018 | Kategorien abrufen | | |
| TC-AD-019 | Event-Types abrufen | | |
| TC-AD-020 | Alle 3 Severity-Levels | | |
| TC-AD-021 | Failure-Safe Logging | | |

### 5. Einwilligung (Consent)

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AD-022 | Eigene Einwilligungen | | |
| TC-AD-023 | DataProcessing erteilen | | |
| TC-AD-024 | Newsletter erteilen | | |
| TC-AD-025 | Alle 5 ConsentTypes | | |
| TC-AD-026 | DataProcessing widerrufen (UNGÜLTIG) | | |
| TC-AD-027 | Newsletter widerrufen | | |
| TC-AD-028 | Re-Grant | | |
| TC-AD-029 | Doppelt erteilen (Idempotent) | | |
| TC-AD-030 | Doppelt widerrufen (Idempotent) | | |
| TC-AD-031 | Bulk Consent Update | | |
| TC-AD-032 | Consent ohne Grant widerrufen | | |
| TC-AD-033 | ConsentType Eigenschaften | | |

### 6. Datenexport (DSGVO Art. 20)

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AD-034 | Datenexport (Eigene Daten) | | |
| TC-AD-035 | Vollständigkeit | | |
| TC-AD-036 | Ohne Consent | | |
| TC-AD-037 | Audit-Logging | | |

### 7. Löschantrag erstellen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AD-038 | Löschantrag erstellen | | |
| TC-AD-039 | Zweiter Antrag (UNGÜLTIG) | | |
| TC-AD-040 | Nach abgeschlossenem Antrag | | |
| TC-AD-041 | Nach abgelehntem Antrag | | |
| TC-AD-042 | Nach storniertem Antrag | | |
| TC-AD-043 | Eigene Anträge abrufen | | |

### 8. Löschantrag bestätigen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AD-044 | Gültiger Token | | |
| TC-AD-045 | Falscher Token | | |
| TC-AD-046 | Token abgelaufen | | |
| TC-AD-047 | Nicht Pending (UNGÜLTIG) | | |
| TC-AD-048 | Token Format Base64URL | | |

### 9. Löschantrag Admin-Verarbeitung

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AD-049 | Admin: Anträge auflisten | | |
| TC-AD-050 | Admin: Genehmigen | | |
| TC-AD-051 | Pending genehmigen (UNGÜLTIG) | | |
| TC-AD-052 | Admin: Ablehnen | | |
| TC-AD-053 | Under Review setzen | | |
| TC-AD-054 | Anonymisierung prüfen | | |
| TC-AD-055 | Consents gelöscht | | |
| TC-AD-056 | TODOs/Einschränkungen | | |

### 10. Löschantrag stornieren

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AD-057 | Pending stornieren | | |
| TC-AD-058 | Confirmed stornieren | | |
| TC-AD-059 | Completed stornieren (UNGÜLTIG) | | |
| TC-AD-060 | UnderReview stornieren | | |

### 11. Autorisierung & Rollen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AD-061 | Kein Token → 401 (Audit) | | |
| TC-AD-062 | Nur Admin hat Audit-Zugriff | | |
| TC-AD-063 | Member kein Audit-Zugriff | | |
| TC-AD-064 | Vorstand kein Audit-Zugriff | | |
| TC-AD-065 | Kein Token → 401 (Privacy) | | |
| TC-AD-066 | Member verwaltet Consents | | |
| TC-AD-067 | Member: kein Admin-Löschung | | |
| TC-AD-068 | Admin verarbeitet Löschanträge | | |
| TC-AD-069 | Kassier: kein Privacy-Admin | | |
| TC-AD-070 | Nur eigene Anträge sichtbar | | |

---

## Bug-Log

| Bug-Nr | TC-ID | Beschreibung | Schwere | Status |
|--------|-------|-------------|---------|--------|
| | | | | |

---

## Freigabe / Sign-Off

| Rolle | Name | Datum | Unterschrift |
|-------|------|-------|-------------|
| Tester | | | |
| Entwickler | | | |
| Product Owner | | | |
