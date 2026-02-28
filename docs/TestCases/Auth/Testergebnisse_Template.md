# Testergebnisse — Auth-Modul IAB Connect

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
| 1. Eigene Identität | 8 | | | | | |
| 2. Benutzerverwaltung (CRUD) | 10 | | | | | |
| 3. Benutzer aktivieren/deaktivieren | 8 | | | | | |
| 4. Passwort zurücksetzen | 4 | | | | | |
| 5. Rollenzuweisung | 6 | | | | | |
| 6. Custom Roles | 10 | | | | | |
| 7. Registrierung | 8 | | | | | |
| 8. Anwendungseinstellungen | 6 | | | | | |
| 9. Berechtigungen (36 Permissions) | 8 | | | | | |
| 10. Keycloak-Synchronisation | 6 | | | | | |
| 11. Autorisierung & Zugriffskontrolle | 12 | | | | | |
| **TOTAL** | **86** | | | | | |

**Bestanden-Quote:** ______ / 86 = ______%

---

## Detaillierte Testergebnisse

### 1. Eigene Identität

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AU-001 | Eigene Identität (/me) | | |
| TC-AU-002 | Eigene Rollen | | |
| TC-AU-003 | Admin-Check als Admin | | |
| TC-AU-004 | Admin-Check als Member | | |
| TC-AU-005 | Vorstand-Check als Vorstand | | |
| TC-AU-006 | Vorstand-Check als Admin | | |
| TC-AU-007 | Member-Check als Member | | |
| TC-AU-008 | Rollen-Check beliebige Rolle | | |

### 2. Benutzerverwaltung (CRUD)

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AU-009 | Alle Benutzer auflisten | | |
| TC-AU-010 | Einzelnen Benutzer abrufen | | |
| TC-AU-011 | Benutzer erstellen | | |
| TC-AU-012 | Duplikat E-Mail/Username | | |
| TC-AU-013 | Benutzer aktualisieren | | |
| TC-AU-014 | Benutzer löschen | | |
| TC-AU-015 | Benutzer nicht gefunden | | |
| TC-AU-016 | Benutzer suchen | | |
| TC-AU-017 | Paginierung | | |
| TC-AU-018 | Alle Fehler als 500 gewrappt | | |

### 3. Benutzer aktivieren/deaktivieren

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AU-019 | Benutzer aktivieren | | |
| TC-AU-020 | Aktivieren → Member erstellt | | |
| TC-AU-021 | Benutzer deaktivieren | | |
| TC-AU-022 | Deaktivieren → Member NICHT deaktiviert ⚠️ | | |
| TC-AU-023 | Update enabled=true → Member aktiv | | |
| TC-AU-024 | Update enabled=false → Member deaktiviert | | |
| TC-AU-025 | Bereits aktiv → idempotent | | |
| TC-AU-026 | Bereits deaktiviert → idempotent | | |

### 4. Passwort zurücksetzen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AU-027 | Passwort zurücksetzen | | |
| TC-AU-028 | Leeres Passwort | | |
| TC-AU-029 | User nicht gefunden | | |
| TC-AU-030 | Login nach Reset | | |

### 5. Rollenzuweisung

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AU-031 | Rolle zuweisen | | |
| TC-AU-032 | Rolle entfernen | | |
| TC-AU-033 | Alle 6 Standard-Rollen | | |
| TC-AU-034 | Rollen abrufen | | |
| TC-AU-035 | Nicht existierende Rolle | | |
| TC-AU-036 | Mehrere Rollen gleichzeitig | | |

### 6. Custom Roles

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AU-037 | Custom Role erstellen | | |
| TC-AU-038 | Duplikat-Name → 409 | | |
| TC-AU-039 | Custom Role aktualisieren | | |
| TC-AU-040 | Custom Role löschen | | |
| TC-AU-041 | Nicht gefunden → 404 | | |
| TC-AU-042 | Aktive Roles (AllowAnonymous) | | |
| TC-AU-043 | BaseRole-Werte prüfen | | |
| TC-AU-044 | Roles mit Permissions listen | | |
| TC-AU-045 | Aktivieren/Deaktivieren | | |
| TC-AU-046 | BaseRole Hierarchie | | |

### 7. Registrierung

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AU-047 | Erfolgreiche Registrierung | | |
| TC-AU-048 | E-Mail leer | | |
| TC-AU-049 | Passwort zu kurz | | |
| TC-AU-050 | Vorname/Nachname fehlt | | |
| TC-AU-051 | Duplikat E-Mail | | |
| TC-AU-052 | Kann noch NICHT einloggen | | |
| TC-AU-053 | Admin aktiviert → Login OK | | |
| TC-AU-054 | Kein Auth-Token nötig | | |

### 8. Anwendungseinstellungen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AU-055 | Öffentliche Einstellungen | | |
| TC-AU-056 | Admin Einstellungen | | |
| TC-AU-057 | Einstellungen aktualisieren | | |
| TC-AU-058 | Alle Felder required | | |
| TC-AU-059 | Nicht Admin → 403 (Update) | | |
| TC-AU-060 | Nicht Admin → 403 (Read) | | |

### 9. Berechtigungen (36 Permissions)

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AU-061 | Alle 36 Permissions | | |
| TC-AU-062 | Admin hat alle | | |
| TC-AU-063 | Member Basis-Permissions | | |
| TC-AU-064 | Vorstand Permissions | | |
| TC-AU-065 | Kassier Permissions | | |
| TC-AU-066 | Event-Manager Permissions | | |
| TC-AU-067 | Auditor Permissions | | |
| TC-AU-068 | Permission-basierte Kontrolle | | |

### 10. Keycloak-Synchronisation

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AU-069 | User in Keycloak reflektiert | | |
| TC-AU-070 | Enable → Member erstellt | | |
| TC-AU-071 | Update(disabled) → Member deaktiviert | | |
| TC-AU-072 | SetEnabled(false) → Member bleibt ⚠️ | | |
| TC-AU-073 | Rollen in Keycloak | | |
| TC-AU-074 | Password Reset in Keycloak | | |

### 11. Autorisierung & Zugriffskontrolle

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-AU-075 | Kein Token → 401 | | |
| TC-AU-076 | Member kann keine User verwalten | | |
| TC-AU-077 | Vorstand kann keine User verwalten | | |
| TC-AU-078 | Kassier kann keine User verwalten | | |
| TC-AU-079 | Admin hat Vollzugriff | | |
| TC-AU-080 | Custom Roles nur Admin CUD | | |
| TC-AU-081 | AllowAnonymous Endpoints | | |
| TC-AU-082 | Identity für jeden Auth-User | | |
| TC-AU-083 | Admin = alle Hierarchien | | |
| TC-AU-084 | Vorstand Hierarchie | | |
| TC-AU-085 | Member Hierarchie | | |
| TC-AU-086 | Kassier Hierarchie | | |

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
