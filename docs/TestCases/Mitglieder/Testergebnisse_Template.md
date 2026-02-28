# Testergebnisse — Mitglieder-Modul IAB Connect

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
| 1. Mitglied erstellen | 12 | | | | | |
| 2. Mitglied aktualisieren | 10 | | | | | |
| 3. Mitglied löschen | 5 | | | | | |
| 4. Mitgliederliste | 8 | | | | | |
| 5. Mitglied Detail | 5 | | | | | |
| 6. Eigenes Profil | 10 | | | | | |
| 7. Profil-Status/Onboarding | 7 | | | | | |
| 8. Status ändern | 10 | | | | | |
| 9. Mitgliedschaftstyp ändern | 6 | | | | | |
| 10. Statistiken | 4 | | | | | |
| 11. Autorisierung & Rollen | 12 | | | | | |
| 12. Validierung & Grenzwerte | 10 | | | | | |
| **TOTAL** | **99** | | | | | |

**Bestanden-Quote:** ______ / 99 = ______%

---

## Detaillierte Testergebnisse

### 1. Mitglied erstellen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-001 | Mitglied mit Pflichtfeldern erstellen | | |
| TC-MG-002 | Mitglied mit allen Feldern erstellen | | |
| TC-MG-003 | Vorname fehlt | | |
| TC-MG-004 | Nachname fehlt | | |
| TC-MG-005 | Ungültige E-Mail | | |
| TC-MG-006 | Strasse fehlt | | |
| TC-MG-007 | PLZ fehlt | | |
| TC-MG-008 | Ort fehlt | | |
| TC-MG-009 | Land fehlt | | |
| TC-MG-010 | Alle MembershipTypes | | |
| TC-MG-011 | Duplikat E-Mail | | |
| TC-MG-012 | Initiale Werte prüfen | | |

### 2. Mitglied aktualisieren

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-013 | Grunddaten aktualisieren | | |
| TC-MG-014 | Adresse ändern | | |
| TC-MG-015 | Nur PhoneNumber ändern | | |
| TC-MG-016 | Notes-Feld aktualisieren | | |
| TC-MG-017 | Nicht existierend | | |
| TC-MG-018 | E-Mail auf Duplikat ändern | | |
| TC-MG-019 | Alle Felder gleichzeitig | | |
| TC-MG-020 | Maxlength FirstName (100) | | |
| TC-MG-021 | Maxlength LastName (100) | | |
| TC-MG-022 | Maxlength Email (256) | | |

### 3. Mitglied löschen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-023 | Mitglied Hard-Delete | | |
| TC-MG-024 | Nicht existierend löschen | | |
| TC-MG-025 | Gelöschtes nochmal löschen | | |
| TC-MG-026 | Aktives Mitglied löschen | | |
| TC-MG-027 | Mitglied mit verknüpften Daten | | |

### 4. Mitgliederliste

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-028 | Alle Mitglieder auflisten | | |
| TC-MG-029 | Nach Status filtern | | |
| TC-MG-030 | Nach MembershipType filtern | | |
| TC-MG-031 | Suchfunktion (Name/E-Mail) | | |
| TC-MG-032 | Sortierung | | |
| TC-MG-033 | Paginierung | | |
| TC-MG-034 | Leere Liste | | |
| TC-MG-035 | Kombination Filter + Suche | | |

### 5. Mitglied Detail

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-036 | Detail abrufen | | |
| TC-MG-037 | Nicht existierend | | |
| TC-MG-038 | Adresse in Response | | |
| TC-MG-039 | Zeitstempel prüfen | | |
| TC-MG-040 | Audit-History sichtbar | | |

### 6. Eigenes Profil

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-041 | Eigenes Profil abrufen | | |
| TC-MG-042 | Eigenes Profil aktualisieren | | |
| TC-MG-043 | Nur eigene Daten sichtbar | | |
| TC-MG-044 | Fremdes Profil lesen (verboten) | | |
| TC-MG-045 | Profil-Bild Platzhalter | | |
| TC-MG-046 | Telefonnummer ändern | | |
| TC-MG-047 | E-Mail ändern (eigenes Profil) | | |
| TC-MG-048 | Adresse ändern (eigenes Profil) | | |
| TC-MG-049 | Read-only Felder | | |
| TC-MG-050 | Profil ohne Member-Eintrag | | |

### 7. Profil-Status/Onboarding

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-051 | Profil-Status abrufen | | |
| TC-MG-052 | Onboarding Checkliste | | |
| TC-MG-053 | Telefonnummer fehlt → incomplete | | |
| TC-MG-054 | E-Mail fehlt → incomplete | | |
| TC-MG-055 | Unvollständige Adresse | | |
| TC-MG-056 | Alle Felder ausgefüllt → complete | | |
| TC-MG-057 | Fehlende Felder → MissingFields-Hinweis | | |

### 8. Status ändern

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-058 | Active → Inactive | | |
| TC-MG-059 | Inactive → Active | | |
| TC-MG-060 | Active → Suspended | | |
| TC-MG-061 | Suspended → Active | | |
| TC-MG-062 | Inactive → Suspended | | |
| TC-MG-063 | Suspended → Inactive | | |
| TC-MG-064 | Active → Active (Idempotent) | | |
| TC-MG-065 | Ungültiger Status-Wert | | |
| TC-MG-066 | Status ohne Berechtigung | | |
| TC-MG-067 | Status-Änderung Audit-Log | | |

### 9. Mitgliedschaftstyp ändern

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-068 | Regular → Honorary | | |
| TC-MG-069 | Regular → Youth | | |
| TC-MG-070 | Alle 6 MembershipTypes | | |
| TC-MG-071 | Gleicher Typ nochmal | | |
| TC-MG-072 | Ungültiger Typ | | |
| TC-MG-073 | Typ-Änderung Audit-Log | | |

### 10. Statistiken

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-074 | Mitgliederstatistik | | |
| TC-MG-075 | Statistik nach Status | | |
| TC-MG-076 | Statistik nach MembershipType | | |
| TC-MG-077 | Neue Mitglieder (Zeitraum) | | |

### 11. Autorisierung & Rollen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-078 | Kein Token → 401 | | |
| TC-MG-079 | Member liest eigenes Profil | | |
| TC-MG-080 | Member kann NICHT andere lesen | | |
| TC-MG-081 | Member kann NICHT erstellen | | |
| TC-MG-082 | Vorstand kann alle lesen | | |
| TC-MG-083 | Vorstand kann erstellen | | |
| TC-MG-084 | Admin hat Vollzugriff | | |
| TC-MG-085 | Kassier kann NICHT verwalten | | |
| TC-MG-086 | Auditor kann NICHT verwalten | | |
| TC-MG-087 | Admin kann Status ändern | | |
| TC-MG-088 | Admin kann löschen | | |
| TC-MG-089 | CanAccessMemberAsync Prüfung | | |

### 12. Validierung & Grenzwerte

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-MG-090 | FirstName max 100 | | |
| TC-MG-091 | LastName max 100 | | |
| TC-MG-092 | Email max 256 | | |
| TC-MG-093 | PhoneNumber max 20 | | |
| TC-MG-094 | City max 100 | | |
| TC-MG-095 | PostalCode max 20 | | |
| TC-MG-096 | Country max 100 | | |
| TC-MG-097 | Street max 200 | | |
| TC-MG-098 | Notes max 2000 | | |
| TC-MG-099 | Concurrent Updates | | |

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
