# Testergebnisse — Kommunikation-Modul IAB Connect

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
| 1. Kampagne erstellen | 7 | | | | | |
| 2. Kampagne aktualisieren | 5 | | | | | |
| 3. Kampagne löschen | 4 | | | | | |
| 4. Kampagne senden | 7 | | | | | |
| 5. Kampagne planen | 5 | | | | | |
| 6. Kampagne abbrechen | 5 | | | | | |
| 7. Kampagne erneut senden | 6 | | | | | |
| 8. Test-E-Mail | 4 | | | | | |
| 9. Empfänger & Segmente | 6 | | | | | |
| 10. Statistiken | 3 | | | | | |
| 11. E-Mail-Templates | 12 | | | | | |
| 12. Personalisierung & Platzhalter | 5 | | | | | |
| 13. Autorisierung & Rollen | 8 | | | | | |
| 14. Status-Übergänge | 10 | | | | | |
| **TOTAL** | **87** | | | | | |

**Bestanden-Quote:** ______ / 87 = ______%

---

## Detaillierte Testergebnisse

### 1. Kampagne erstellen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-001 | Kampagne mit Pflichtfeldern | | |
| TC-KO-002 | Kampagne mit allen optionalen Feldern | | |
| TC-KO-003 | Name leer | | |
| TC-KO-004 | Subject leer | | |
| TC-KO-005 | HTML-Content leer | | |
| TC-KO-006 | FromEmail leer | | |
| TC-KO-007 | Alle 5 Segment-Typen | | |

### 2. Kampagne aktualisieren

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-008 | Draft-Kampagne aktualisieren | | |
| TC-KO-009 | Nicht-Draft aktualisieren (UNGÜLTIG) | | |
| TC-KO-010 | Nicht existierend | | |
| TC-KO-011 | FromName leer | | |
| TC-KO-012 | Segment-Typ ändern | | |

### 3. Kampagne löschen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-013 | Draft-Kampagne löschen | | |
| TC-KO-014 | Nicht-Draft löschen (UNGÜLTIG) | | |
| TC-KO-015 | Nicht existierend | | |
| TC-KO-016 | Geplante Kampagne löschen (UNGÜLTIG) | | |

### 4. Kampagne senden

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-017 | Sofort senden | | |
| TC-KO-018 | Keine Empfänger | | |
| TC-KO-019 | Nicht-Draft senden (UNGÜLTIG) | | |
| TC-KO-020 | Nicht existierend | | |
| TC-KO-021 | E-Mail-Inhalt prüfen | | |
| TC-KO-022 | Empfänger-Status nachverfolgen | | |
| TC-KO-023 | Fehlerbehandlung (3 Retries) | | |

### 5. Kampagne planen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-024 | Für Zukunft planen | | |
| TC-KO-025 | Vergangenheit (UNGÜLTIG) | | |
| TC-KO-026 | Nicht-Draft planen (UNGÜLTIG) | | |
| TC-KO-027 | Geplante Kampagne absagen | | |
| TC-KO-028 | Nicht existierend | | |

### 6. Kampagne abbrechen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-029 | Draft abbrechen | | |
| TC-KO-030 | Scheduled abbrechen | | |
| TC-KO-031 | Sending abbrechen | | |
| TC-KO-032 | Sent abbrechen (UNGÜLTIG) | | |
| TC-KO-033 | Cancelled abbrechen (UNGÜLTIG) | | |

### 7. Kampagne erneut senden

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-034 | Sent erneut senden | | |
| TC-KO-035 | Nicht-Sent erneut senden (UNGÜLTIG) | | |
| TC-KO-036 | Fehlgeschlagene erneut senden | | |
| TC-KO-037 | Keine fehlgeschlagenen Empfänger | | |
| TC-KO-038 | Nicht-Sent — resend-failed | | |
| TC-KO-039 | Nicht existierend | | |

### 8. Test-E-Mail

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-040 | Test-E-Mail senden | | |
| TC-KO-041 | [TEST] Prefix im Betreff | | |
| TC-KO-042 | Kein Hangfire-Job | | |
| TC-KO-043 | Nicht existierend | | |

### 9. Empfänger & Segmente

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-044 | Empfänger-Liste abrufen | | |
| TC-KO-045 | Nach Status filtern | | |
| TC-KO-046 | Empfänger-Vorschau | | |
| TC-KO-047 | E-Mail-Normalisierung | | |
| TC-KO-048 | Progressive Status Tracking | | |
| TC-KO-049 | Alle 10 Empfänger-Status | | |

### 10. Statistiken

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-050 | Kampagnen-Statistiken | | |
| TC-KO-051 | Nicht existierend | | |
| TC-KO-052 | Kampagnen-Liste mit Suche | | |

### 11. E-Mail-Templates

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-053 | Template erstellen | | |
| TC-KO-054 | Name leer | | |
| TC-KO-055 | Subject leer | | |
| TC-KO-056 | Duplikat-Name | | |
| TC-KO-057 | Template aktualisieren | | |
| TC-KO-058 | Version Auto-Increment | | |
| TC-KO-059 | Template löschen | | |
| TC-KO-060 | Template deaktivieren | | |
| TC-KO-061 | Template Vorschau | | |
| TC-KO-062 | Nach Kategorie abrufen | | |
| TC-KO-063 | Template-Liste | | |
| TC-KO-064 | Variablen-Definition | | |

### 12. Personalisierung & Platzhalter

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-065 | {{firstName}} Platzhalter | | |
| TC-KO-066 | {{fullName}} Platzhalter | | |
| TC-KO-067 | {{email}} Platzhalter | | |
| TC-KO-068 | Fehlender Platzhalter → Leer | | |
| TC-KO-069 | Unbekannter Platzhalter | | |

### 13. Autorisierung & Rollen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-070 | Kein Token → 401 | | |
| TC-KO-071 | Member kann NICHT erstellen | | |
| TC-KO-072 | Kassier kann NICHT erstellen | | |
| TC-KO-073 | Vorstand hat Vollzugriff | | |
| TC-KO-074 | Admin hat Vollzugriff | | |
| TC-KO-075 | Auth-User kann Templates lesen | | |
| TC-KO-076 | Auth-User kann Templates erstellen | | |
| TC-KO-077 | Templates ohne Auth → 401 | | |

### 14. Status-Übergänge

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-KO-078 | Draft → Scheduled | | |
| TC-KO-079 | Draft → Sending → Sent | | |
| TC-KO-080 | Scheduled → Sending → Sent | | |
| TC-KO-081 | Draft → Cancelled | | |
| TC-KO-082 | Scheduled → Cancelled | | |
| TC-KO-083 | Sent → Sending (Resend) | | |
| TC-KO-084 | ANY → Failed | | |
| TC-KO-085 | Failed → Cancelled | | |
| TC-KO-086 | Sent → Cancel (UNGÜLTIG) | | |
| TC-KO-087 | Cancelled → Resend (UNGÜLTIG) | | |

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
