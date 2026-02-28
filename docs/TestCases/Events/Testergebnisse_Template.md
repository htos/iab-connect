# Testergebnisse — Events-Modul IAB Connect

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
| 1. Event erstellen | 8 | | | | | |
| 2. Event aktualisieren | 6 | | | | | |
| 3. Event Status-Übergänge | 14 | | | | | |
| 4. Event löschen | 4 | | | | | |
| 5. Event-Liste & Filter | 10 | | | | | |
| 6. Öffentliche Events | 6 | | | | | |
| 7. Mitglieder-Registrierung | 10 | | | | | |
| 8. Öffentliche Registrierung | 10 | | | | | |
| 9. Kapazität & Warteliste | 12 | | | | | |
| 10. Registrierung stornieren | 6 | | | | | |
| 11. Check-In & QR-Code | 10 | | | | | |
| 12. No-Show & Warteliste verwalten | 6 | | | | | |
| 13. Meine Registrierungen | 3 | | | | | |
| 14. Statistiken | 3 | | | | | |
| 15. Autorisierung & Rollen | 12 | | | | | |
| **TOTAL** | **120** | | | | | |

**Bestanden-Quote:** ______ / 120 = ______%

---

## Detaillierte Testergebnisse

### 1. Event erstellen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-001 | Event mit Pflichtfeldern | | |
| TC-EV-002 | Event mit allen optionalen Feldern | | |
| TC-EV-003 | Titel fehlt | | |
| TC-EV-004 | StartDate fehlt | | |
| TC-EV-005 | EndDate vor StartDate | | |
| TC-EV-006 | Negative Kapazität | | |
| TC-EV-007 | Alle EventTypes | | |
| TC-EV-008 | Initial-Status = Draft | | |

### 2. Event aktualisieren

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-009 | Draft-Event aktualisieren | | |
| TC-EV-010 | Published Event aktualisieren | | |
| TC-EV-011 | Completed Event (UNGÜLTIG) | | |
| TC-EV-012 | Cancelled Event (UNGÜLTIG) | | |
| TC-EV-013 | Nicht existierend | | |
| TC-EV-014 | Kapazität unter Registrierungen | | |

### 3. Event Status-Übergänge

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-015 | Draft → Published | | |
| TC-EV-016 | Published → Completed | | |
| TC-EV-017 | Published → Cancelled | | |
| TC-EV-018 | Draft → Cancelled | | |
| TC-EV-019 | Completed → Draft (UNGÜLTIG) | | |
| TC-EV-020 | Cancelled → Published (UNGÜLTIG) | | |
| TC-EV-021 | Draft → Completed (UNGÜLTIG) | | |
| TC-EV-022 | Published → Draft (UNGÜLTIG) | | |
| TC-EV-023 | Published → RegistrationOpen | | |
| TC-EV-024 | RegistrationOpen → RegistrationClosed | | |
| TC-EV-025 | RegistrationClosed → Published | | |
| TC-EV-026 | RegistrationOpen → Cancelled | | |
| TC-EV-027 | Cancelled → Cancelled (Idempotent) | | |
| TC-EV-028 | Gleicher Status nochmal | | |

### 4. Event löschen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-029 | Draft-Event löschen | | |
| TC-EV-030 | Published Event löschen | | |
| TC-EV-031 | Event mit Registrierungen | | |
| TC-EV-032 | Nicht existierend | | |

### 5. Event-Liste & Filter

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-033 | Alle Events auflisten | | |
| TC-EV-034 | Nach Status filtern | | |
| TC-EV-035 | Nach EventType filtern | | |
| TC-EV-036 | Datumsbereich filtern | | |
| TC-EV-037 | Suchfunktion | | |
| TC-EV-038 | Sortierung (Datum) | | |
| TC-EV-039 | Paginierung | | |
| TC-EV-040 | Nur eigene Events | | |
| TC-EV-041 | Leere Ergebnisse | | |
| TC-EV-042 | Kombination multipler Filter | | |

### 6. Öffentliche Events

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-043 | Öffentliche Events (anonym) | | |
| TC-EV-044 | Nur Published/RegistrationOpen | | |
| TC-EV-045 | Draft NICHT öffentlich | | |
| TC-EV-046 | Abgelaufene Events | | |
| TC-EV-047 | Public Event Detail | | |
| TC-EV-048 | Visibility-Filterung | | |

### 7. Mitglieder-Registrierung

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-049 | Erfolgreich registrieren | | |
| TC-EV-050 | Doppelt registrieren (UNGÜLTIG) | | |
| TC-EV-051 | Nicht-Published Event | | |
| TC-EV-052 | Nicht existierendes Event | | |
| TC-EV-053 | Eigene Registrierung abrufen | | |
| TC-EV-054 | Plus-One registrieren | | |
| TC-EV-055 | Anmerkungen/Notizen | | |
| TC-EV-056 | Diät-Angaben | | |
| TC-EV-057 | Registrierung bei vollem Event | | |
| TC-EV-058 | Registrierung bei geschlossener Anmeldung | | |

### 8. Öffentliche Registrierung

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-059 | Gast-Registrierung (anonym) | | |
| TC-EV-060 | Pflichtfelder prüfen | | |
| TC-EV-061 | E-Mail erforderlich | | |
| TC-EV-062 | Name erforderlich | | |
| TC-EV-063 | Duplikat E-Mail (gleicher Event) | | |
| TC-EV-064 | Nicht-öffentliches Event | | |
| TC-EV-065 | Volles Event | | |
| TC-EV-066 | Gast auf Warteliste | | |
| TC-EV-067 | Bestätigungsdetails | | |
| TC-EV-068 | Öffentliche Registrierung abrufen | | |

### 9. Kapazität & Warteliste

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-069 | Kapazitätsgrenze erreicht | | |
| TC-EV-070 | Automatisch auf Warteliste | | |
| TC-EV-071 | Warteliste-Reihenfolge | | |
| TC-EV-072 | Auto-Promote bei Storno | | |
| TC-EV-073 | Warteliste → Confirmed (Promote) | | |
| TC-EV-074 | Manuell promoten | | |
| TC-EV-075 | Kein Platz → Waitlisted bleibt | | |
| TC-EV-076 | Kapazität erhöhen → Auto-Promote | | |
| TC-EV-077 | Unlimited Capacity (null) | | |
| TC-EV-078 | Kapazität 0 = sofort Warteliste | | |
| TC-EV-079 | Warteliste-Position | | |
| TC-EV-080 | Mehrere gleichzeitige Stornos | | |

### 10. Registrierung stornieren

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-081 | Confirmed stornieren | | |
| TC-EV-082 | Waitlisted stornieren | | |
| TC-EV-083 | Storno → Auto-Promote | | |
| TC-EV-084 | Bereits storniert | | |
| TC-EV-085 | CheckedIn stornieren | | |
| TC-EV-086 | Nicht eigene Registrierung | | |

### 11. Check-In & QR-Code

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-087 | QR-Code generieren | | |
| TC-EV-088 | QR-Check-In | | |
| TC-EV-089 | Doppelter Check-In | | |
| TC-EV-090 | Check-In ohne Registrierung | | |
| TC-EV-091 | Check-In für stornierte Reg. | | |
| TC-EV-092 | Check-In Zeitstempel | | |
| TC-EV-093 | Manueller Check-In | | |
| TC-EV-094 | QR-Code Format | | |
| TC-EV-095 | Check-In nach Event-Ende | | |
| TC-EV-096 | Bulk-Check-In | | |

### 12. No-Show & Warteliste verwalten

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-097 | No-Show markieren | | |
| TC-EV-098 | No-Show → Platz frei | | |
| TC-EV-099 | Warteliste manuell verwalten | | |
| TC-EV-100 | Warteliste-Reihenfolge ändern | | |
| TC-EV-101 | Alle Registrierungen eines Events | | |
| TC-EV-102 | Registrierungen nach Status | | |

### 13. Meine Registrierungen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-103 | Eigene Registrierungen | | |
| TC-EV-104 | Vergangene Events | | |
| TC-EV-105 | Keine Registrierungen | | |

### 14. Statistiken

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-106 | Event-Statistiken | | |
| TC-EV-107 | Registrierungsstatistik | | |
| TC-EV-108 | Check-In Rate | | |

### 15. Autorisierung & Rollen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-EV-109 | Kein Token → 401 | | |
| TC-EV-110 | Öffentlich → anonym OK | | |
| TC-EV-111 | Member kann registrieren | | |
| TC-EV-112 | Member kann NICHT erstellen | | |
| TC-EV-113 | Vorstand kann erstellen | | |
| TC-EV-114 | Admin hat Vollzugriff | | |
| TC-EV-115 | Event-Manager Vollzugriff | | |
| TC-EV-116 | Kassier kann keine Events | | |
| TC-EV-117 | Auditor kann keine Events | | |
| TC-EV-118 | Check-In nur Admin/Vorstand | | |
| TC-EV-119 | Status nur Admin/Vorstand | | |
| TC-EV-120 | Registrierungen verwalten | | |

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
