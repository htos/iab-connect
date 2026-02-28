# Testfälle — Modul Identität & Authentifizierung

> **Version:** 1.1 — Code-verifiziert  
> **Erstellt:** 2025-01-XX  
> **Modul:** Identity, Benutzerverwaltung, Rollen, Registrierung, Einstellungen  
> **Endpoints:** `/api/v1/identity`, `/api/v1/users`, `/api/v1/custom-roles`, `/api/v1/registration`, `/api/v1/settings`  
> **Testumgebung:** http://localhost:5000 (API), http://localhost:3000 (Frontend)  
> **Keycloak:** http://localhost:8080 (Realm: iabconnect)

### Verifizierungshinweise (v1.1)
> **Geprüft gegen:** `UserEndpoints.cs`, `IdentityEndpoints.cs`, `CustomRoleEndpoints.cs`, `RegistrationEndpoints.cs`, `Permission.cs`  
> **Wichtige Abweichungen vom Originalentwurf:**
> - `/me` gibt `givenName`/`familyName` zurück, NICHT `firstName`/`lastName`. Keine `permissions[]`.
> - Custom Roles: Endpoint ist `/api/v1/custom-roles` (nicht `/roles`)
> - Enable/Disable: `PUT /users/{id}/enabled` mit Body `{ enabled: true/false }` (nicht `/enable` oder `/disable`)
> - Passwort-Reset: `POST /reset-password` ohne Body (sendet E-Mail), gibt 204 zurück
> - Rollenzuweisung: `PUT /users/{id}/roles` (Sync/Replace-All), nicht POST/DELETE
> - `check-role/{role}` gibt immer 200 mit `{ hasRole: bool }` zurück (nie 403)
> - Alle Keycloak-Kommunikationsfehler werden als HTTP 500 gewrappt
> - 36 Permissions geprüft — mehrere Namen korrigiert (siehe TC-AU-061)

---

## Übersicht

| # | Bereich | Anzahl Testfälle |
|---|---------|-----------------|
| 1 | [Eigene Identität](#1-eigene-identität) | 8 |
| 2 | [Benutzerverwaltung (CRUD)](#2-benutzerverwaltung-crud) | 10 |
| 3 | [Benutzer aktivieren/deaktivieren](#3-benutzer-aktivierendeaktivieren) | 8 |
| 4 | [Passwort zurücksetzen](#4-passwort-zurücksetzen) | 4 |
| 5 | [Rollenzuweisung](#5-rollenzuweisung) | 6 |
| 6 | [Custom Roles](#6-custom-roles) | 10 |
| 7 | [Registrierung](#7-registrierung) | 8 |
| 8 | [Anwendungseinstellungen](#8-anwendungseinstellungen) | 6 |
| 9 | [Berechtigungen (36 Permissions)](#9-berechtigungen) | 8 |
| 10 | [Keycloak-Synchronisation](#10-keycloak-synchronisation) | 6 |
| 11 | [Autorisierung & Zugriffskontrolle](#11-autorisierung-zugriffskontrolle) | 12 |
| **Total** | | **86** |

---

## Testbenutzer

| Rolle | E-Mail | Passwort | Relevante Rechte |
|-------|--------|----------|-----------------|
| Admin | admin@iabconnect.ch | Admin-Dev-2026! | Vollzugriff: User Mgmt, Rollen, Einstellungen |
| Vorstand | vorstand@iabconnect.ch | Vorstand-Dev-2026! | Eingeschränkt (user:read eigene) |
| Member | member@iabconnect.ch | Member-Dev-2026! | Nur eigene Identität |
| Kassier | kassier@iabconnect.ch | Kassier-Dev-2026! | Keine User-Mgmt-Rechte |

---

## 1. Eigene Identität

### TC-AU-001: Eigene Identität abrufen (/me)
**Vorbedingung:** Eingeloggt als beliebiger Benutzer  
**Schritte:**
1. `GET /api/v1/identity/me`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Response enthält: `userId`, `email`, `name`, `givenName`, `familyName`, `roles[]`

> ⚠️ **Code-Verifizierung v1.1:** Felder sind `givenName`/`familyName` (nicht `firstName`/`lastName`). Kein `permissions[]`-Feld in /me-Response.

---

### TC-AU-002: Eigene Rollen abrufen
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/identity/roles`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Enthält `"admin"` Rolle

---

### TC-AU-003: Admin-Check — Als Admin
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/identity/admin-check`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Response: `{ "hasAccess": true, "message": "Admin-Zugriff bestätigt" }`

---

### TC-AU-004: Admin-Check — Als Member (KEIN Zugriff)
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/identity/admin-check`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden

---

### TC-AU-005: Vorstand-Check — Als Vorstand
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/identity/vorstand-check`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Response: `{ "hasAccess": true, "message": "Vorstand-Zugriff bestätigt" }`

---

### TC-AU-006: Vorstand-Check — Als Admin (implizit)
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/identity/vorstand-check`  
**Erwartetes Ergebnis:**
- HTTP 200 OK (Admin impliziert Vorstand: IsVorstand = admin OR vorstand)

---

### TC-AU-007: Member-Check — Als Member
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/identity/member-check`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Response: `{ "hasAccess": true, "message": "Mitglied-Zugriff bestätigt" }`

---

### TC-AU-008: Rollen-Check — Beliebige Rolle
**Vorbedingung:** Eingeloggt als `kassier`  
**Schritte:**
1. `GET /api/v1/identity/check-role/kassier` → 200, `{ hasRole: true }`
2. `GET /api/v1/identity/check-role/admin` → 200, `{ hasRole: false }`  
**Erwartetes Ergebnis:**
- Immer HTTP 200, Ergebnis in `hasRole`-Feld

> ⚠️ **Code-Verifizierung v1.1:** Endpoint gibt immer HTTP 200 zurück mit `RoleCheckResponse { Role, HasRole }`. Keine 403 bei fehlender Rolle.

---

## 2. Benutzerverwaltung (CRUD)

### TC-AU-009: Alle Benutzer auflisten
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/users`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Paginierte Liste aller Keycloak-Benutzer
- Felder: `id`, `email`, `firstName`, `lastName`, `enabled`, `emailVerified`, `createdAt`, `roles[]`

> ⚠️ **Code-Verifizierung v1.1:** Kein `username`-Feld in UserDto. Zusätzlich `emailVerified` und `createdAt`.

---

### TC-AU-010: Einzelnen Benutzer abrufen
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/users/{userId}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Detaillierte Benutzerinformationen

---

### TC-AU-011: Benutzer erstellen
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `POST /api/v1/users` mit:
   ```json
   {
     "email": "new@example.com",
     "firstName": "Neu",
     "lastName": "User",
     "temporaryPassword": "Secure-Pass-2026!",
     "enabled": true,
     "sendInvitation": true,
     "roles": ["member"]
   }
   ```
**Erwartetes Ergebnis:**
- HTTP 201 Created
- Benutzer in Keycloak erstellt
- Rollen zugewiesen

> ⚠️ **Code-Verifizierung v1.1:** Feld heisst `temporaryPassword` (nicht `password`). Kein `username`-Feld — E-Mail wird als Username verwendet. Returns 201.

---

### TC-AU-012: Benutzer erstellen — Duplikat E-Mail/Username
**Vorbedingung:** Benutzer mit `admin@iabconnect.ch` existiert  
**Schritte:**
1. `POST /api/v1/users` mit `"email": "admin@iabconnect.ch"`  
**Erwartetes Ergebnis:**
- HTTP 409 Conflict, `"User with this email or username already exists"`

---

### TC-AU-013: Benutzer aktualisieren
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `PUT /api/v1/users/{userId}` mit geänderten `firstName`, `lastName`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Daten in Keycloak aktualisiert

---

### TC-AU-014: Benutzer löschen
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `DELETE /api/v1/users/{userId}`  
**Erwartetes Ergebnis:**
- HTTP 204 No Content
- Benutzer in Keycloak gelöscht

> ⚠️ **Code-Verifizierung v1.1:** Gibt 204 No Content zurück (nicht 200).

---

### TC-AU-015: Benutzer nicht gefunden
**Schritte:**
1. `GET /api/v1/users/{random-id}`  
**Erwartetes Ergebnis:**
- HTTP 404 oder 500, `"An internal error occurred. Please try again later."` (alle Fehler werden als 500 gewrappt)

---

### TC-AU-016: Benutzer suchen
**Vorbedingung:** Mehrere Benutzer existieren  
**Schritte:**
1. `GET /api/v1/users?search=admin`  
**Erwartetes Ergebnis:**
- Filterte Ergebnisse

---

### TC-AU-017: Benutzerliste — Paginierung
**Schritte:**
1. `GET /api/v1/users?first=0&max=5`  
**Erwartetes Ergebnis:**
- Max 5 Ergebnisse

---

### TC-AU-018: Alle Fehler als 500 gewrappt
**Schritte:**
1. Verschiedene Fehlersituationen testen (ungültige Daten, nicht gefunden, etc.)  
**Erwartetes Ergebnis:**
- Alle Keycloak-Fehler werden als HTTP 500 zurückgegeben mit:
  `"An internal error occurred. Please try again later."` (ausser 409 für Duplikate)

---

## 3. Benutzer aktivieren/deaktivieren

### TC-AU-019: Benutzer aktivieren
**Vorbedingung:** Deaktivierter Benutzer  
**Schritte:**
1. `PUT /api/v1/users/{userId}/enabled` mit `{ "enabled": true }`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Benutzer in Keycloak aktiviert (`enabled: true`)

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/enabled` (nicht `/enable`). Body: `SetUserEnabledRequest { Enabled: bool }`.

---

### TC-AU-020: Benutzer aktivieren — Member wird erstellt
**Vorbedingung:** Benutzer ohne zugehöriges Member-Entity  
**Schritte:**
1. `PUT /api/v1/users/{userId}/enabled` mit `{ "enabled": true }`  
**Erwartetes Ergebnis:**
- Member automatisch erstellt mit:
  - `Address.Create("", "", "", "")` (leere Strings)
  - `MembershipType.Regular`
  - `Activate()` aufgerufen → Status `Active`

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/enabled`. `Address.Create` mit leeren Strings — funktioniert, da nur null geprüft wird.

---

### TC-AU-021: Benutzer deaktivieren
**Vorbedingung:** Aktiver Benutzer  
**Schritte:**
1. `PUT /api/v1/users/{userId}/enabled` mit `{ "enabled": false }`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Benutzer in Keycloak deaktiviert (`enabled: false`)

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/enabled` (nicht `/disable`).

---

### TC-AU-022: Benutzer deaktivieren — Member wird NICHT deaktiviert (über enabled-Endpoint)
**Vorbedingung:** Benutzer mit aktivem Member  
**Schritte:**
1. `PUT /api/v1/users/{userId}/enabled` mit `{ "enabled": false }`
2. Member-Status prüfen  
**Erwartetes Ergebnis:**
- ⚠️ Member bleibt aktiv (asymmetrisches Verhalten: `SetUserEnabled(false)` deaktiviert NICHT das Member)

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/enabled`. Nur `UpdateUser(enabled: false)` deaktiviert Member, nicht `SetUserEnabled`.

---

### TC-AU-023: Update User mit enabled=true — Member erstellt/aktiviert
**Vorbedingung:** Deaktivierter Benutzer  
**Schritte:**
1. `PUT /api/v1/users/{userId}` mit `"enabled": true`  
**Erwartetes Ergebnis:**
- Member erstellt oder aktiviert (UpdateUser-Logik)

---

### TC-AU-024: Update User mit enabled=false — Member wird deaktiviert
**Vorbedingung:** Aktiver Benutzer mit Member  
**Schritte:**
1. `PUT /api/v1/users/{userId}` mit `"enabled": false`  
**Erwartetes Ergebnis:**
- Member deaktiviert (`Deactivate()`)

---

### TC-AU-025: Bereits aktiver Benutzer aktivieren (Idempotent)
**Vorbedingung:** Bereits aktivierter Benutzer  
**Schritte:**
1. `PUT /api/v1/users/{userId}/enabled` mit `{ "enabled": true }`  
**Erwartetes Ergebnis:**
- HTTP 200 OK (keine Änderung)

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/enabled`.

---

### TC-AU-026: Bereits deaktivierter Benutzer deaktivieren
**Vorbedingung:** Bereits deaktivierter Benutzer  
**Schritte:**
1. `PUT /api/v1/users/{userId}/enabled` mit `{ "enabled": false }`  
**Erwartetes Ergebnis:**
- HTTP 200 OK (keine Änderung)

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/enabled`.

---

## 4. Passwort zurücksetzen

### TC-AU-027: Passwort zurücksetzen (Admin)
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `POST /api/v1/users/{userId}/reset-password` (kein Body)  
**Erwartetes Ergebnis:**
- HTTP 204 No Content
- Passwort-Reset-E-Mail an Benutzer gesendet

> ⚠️ **Code-Verifizierung v1.1:** Methode ist POST (nicht PUT). Kein Passwort im Body — sendet E-Mail via `SendPasswordResetEmailAsync`. Gibt 204 zurück.

---

### TC-AU-028: Passwort zurücksetzen — User nicht gefunden
**Schritte:**
1. `POST /api/v1/users/{random-id}/reset-password`  
**Erwartetes Ergebnis:**
- HTTP 500, `"An internal error occurred. Please try again later."`

> ⚠️ **Code-Verifizierung v1.1:** POST (nicht PUT). Kein Passwort-Body. Test für "leeres Passwort" entfällt, da kein Passwort akzeptiert wird.

---

### TC-AU-029: Passwort zurücksetzen — E-Mail-Versand verifizieren
**Schritte:**
1. `POST /api/v1/users/{userId}/reset-password`
2. E-Mail-Postfach prüfen  
**Erwartetes Ergebnis:**
- Passwort-Reset-E-Mail erhalten (via Keycloak)

> ⚠️ **Code-Verifizierung v1.1:** Ehemals "User nicht gefunden" — nach TC-AU-028 konsolidiert. Dieser TC prüft nun den E-Mail-Versand.

---

### TC-AU-030: Login nach Passwort-Reset
**Vorbedingung:** Passwort-Reset-E-Mail gesendet  
**Schritte:**
1. Passwort via Reset-Link ändern
2. Mit neuem Passwort einloggen → Erfolg  
**Erwartetes Ergebnis:**
- Neues Passwort funktioniert

> ⚠️ **Code-Verifizierung v1.1:** Passwort wird NICHT direkt via API gesetzt. Benutzer erhält Reset-E-Mail und setzt Passwort selbst.

---

## 5. Rollenzuweisung

### TC-AU-031: Rollen eines Benutzers synchronisieren
**Vorbedingung:** Eingeloggt als `admin`, Benutzer existiert  
**Schritte:**
1. `PUT /api/v1/users/{userId}/roles` mit:
   ```json
   { "roles": ["member", "kassier"] }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Rollen in Keycloak synchronisiert (alte entfernt, neue hinzugefügt)

> ⚠️ **Code-Verifizierung v1.1:** PUT (nicht POST). Sync-Logik: berechnet Diff zwischen aktuellen und neuen Rollen, fügt fehlende hinzu und entfernt überzählige.

---

### TC-AU-032: Rolle entfernen (via Sync)
**Vorbedingung:** Benutzer hat Rollen `member`, `kassier`  
**Schritte:**
1. `PUT /api/v1/users/{userId}/roles` mit:
   ```json
   { "roles": ["member"] }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `kassier` in Keycloak entfernt (nicht in neuem Set enthalten)

> ⚠️ **Code-Verifizierung v1.1:** Kein separater DELETE-Endpoint. Rollen-Entfernung erfolgt durch Sync: nur Rollen im neuen Set bleiben.

---

### TC-AU-033: Alle 6 Standard-Rollen zuweisen
**Schritte:**
1. Nacheinander zuweisen: `admin`, `vorstand`, `kassier`, `event-manager`, `member`, `auditor`  
**Erwartetes Ergebnis:**
- Alle 6 Rollen erfolgreich zuweisbar

---

### TC-AU-034: Rollen eines Benutzers abrufen
**Schritte:**
1. `GET /api/v1/users/{userId}/roles`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Liste der zugewiesenen Rollen

---

### TC-AU-035: Nicht existierende Rolle zuweisen
**Schritte:**
1. `PUT /api/v1/users/{userId}/roles` mit `"roles": ["super-admin"]`  
**Erwartetes Ergebnis:**
- HTTP 500, `"An internal error occurred. Please try again later."` (Rolle existiert nicht in Keycloak)

> ⚠️ **Code-Verifizierung v1.1:** PUT (nicht POST). Keycloak-Fehler wird als 500 gewrappt.

---

### TC-AU-036: Mehrere Rollen gleichzeitig zuweisen
**Schritte:**
1. `PUT /api/v1/users/{userId}/roles` mit `"roles": ["kassier", "event-manager"]`  
**Erwartetes Ergebnis:**
- Beide Rollen zugewiesen

> ⚠️ **Code-Verifizierung v1.1:** PUT (nicht POST). Sync ersetzt alle Rollen.

---

## 6. Custom Roles

### TC-AU-037: Custom Role erstellen
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `POST /api/v1/custom-roles` mit:
   ```json
   {
     "name": "Schriftführer",
     "description": "Protokolle verwalten",
     "linkedRole": "Member"
   }
   ```
**Erwartetes Ergebnis:**
- HTTP 201 Created
- `isActive: true`

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/custom-roles` (nicht `/roles`). Feld heisst `linkedRole` (nicht `baseRole`). Kein `permissions[]` im Create-Request.

---

### TC-AU-038: Custom Role — Duplikat-Name
**Vorbedingung:** Rolle "Schriftführer" existiert  
**Schritte:**
1. `POST /api/v1/custom-roles` mit `"name": "Schriftführer"`  
**Erwartetes Ergebnis:**
- HTTP 409 Conflict, `"A role with name 'Schriftführer' already exists."`

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/custom-roles`.

---

### TC-AU-039: Custom Role aktualisieren
**Vorbedingung:** Custom Role existiert  
**Schritte:**
1. `PUT /api/v1/custom-roles/{id}` mit geänderten Daten  
**Erwartetes Ergebnis:**
- HTTP 200 OK

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/custom-roles`.

---

### TC-AU-040: Custom Role löschen
**Schritte:**
1. `DELETE /api/v1/custom-roles/{id}`  
**Erwartetes Ergebnis:**
- HTTP 204 No Content

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/custom-roles`.

---

### TC-AU-041: Custom Role nicht gefunden
**Schritte:**
1. `GET /api/v1/custom-roles/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404, `"Custom role not found"`

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/custom-roles`.

---

### TC-AU-042: Aktive Custom Roles — Öffentlich zugänglich
**Schritte:**
1. `GET /api/v1/custom-roles/active` (OHNE Authentication)  
**Erwartetes Ergebnis:**
- HTTP 200 OK (AllowAnonymous)
- Liste der aktiven Custom Roles

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/custom-roles/active`.

---

### TC-AU-043: BaseRole-Werte prüfen
**Schritte:**
1. Custom Role mit `baseRole: "Admin"` → OK
2. Custom Role mit `baseRole: "Vorstand"` → OK
3. Custom Role mit `baseRole: "Member"` → OK
4. Custom Role mit `baseRole: "InvalidRole"` → Fehler  
**Erwartetes Ergebnis:**
- Nur 3 BaseRole-Werte erlaubt: Admin, Vorstand, Member

---

### TC-AU-044: Custom Role mit Permissions auflisten
**Schritte:**
1. `GET /api/v1/custom-roles`  
**Erwartetes Ergebnis:**
- Alle Custom Roles auflisten

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/custom-roles`.

---

### TC-AU-045: Custom Role aktivieren/deaktivieren
**Schritte:**
1. Rolle deaktivieren
2. `GET /api/v1/roles/active` prüfen  
**Erwartetes Ergebnis:**
- Deaktivierte Rolle nicht in aktiver Liste

---

### TC-AU-046: BaseRole Hierarchie validieren
**Vorbedingung:** Custom Role mit `baseRole: "Member"`  
**Schritte:**
1. Benutzer mit dieser Custom Role einloggen
2. `GET /api/v1/identity/admin-check` → 403
3. `GET /api/v1/identity/member-check` → 200  
**Erwartetes Ergebnis:**
- BaseRole bestimmt Zugriffshierarchie

---

## 7. Registrierung

### TC-AU-047: Erfolgreiche Registrierung
**Vorbedingung:** KEIN Auth-Token nötig (AllowAnonymous)  
**Schritte:**
1. `POST /api/v1/registration` mit:
   ```json
   {
     "email": "neues.mitglied@example.com",
     "password": "Sicheres-Pw-2026!",
     "firstName": "Max",
     "lastName": "Muster"
   }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Response: `{ "message": "Registration successful. Your account needs to be approved by an administrator before you can log in." }`
- Keycloak: User erstellt mit `enabled: false`, Action `VERIFY_EMAIL`
- Rolle `member` zugewiesen

---

### TC-AU-048: Registrierung — E-Mail leer
**Schritte:**
1. `POST /api/v1/registration` mit `"email": ""`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Email is required"`

---

### TC-AU-049: Registrierung — Passwort zu kurz
**Schritte:**
1. `POST /api/v1/registration` mit `"password": "123"` (< 8 Zeichen)  
**Erwartetes Ergebnis:**
- HTTP 400, `"Password must be at least 8 characters"`

---

### TC-AU-050: Registrierung — Vorname/Nachname fehlt
**Schritte:**
1. `POST /api/v1/registration` ohne `firstName` und `lastName`  
**Erwartetes Ergebnis:**
- HTTP 400, `"First name and last name are required"`

> ⚠️ **Code-Verifizierung v1.1:** Einzelne kombinierte Fehlermeldung (nicht zwei separate). Beide Felder in einer Prüfung.

---

### TC-AU-051: Registrierung — Duplikat E-Mail
**Vorbedingung:** `admin@iabconnect.ch` existiert  
**Schritte:**
1. `POST /api/v1/registration` mit `"email": "admin@iabconnect.ch"`  
**Erwartetes Ergebnis:**
- HTTP 409, `"A user with this email address already exists"`

> ⚠️ **Code-Verifizierung v1.1:** Exakte Fehlermeldung korrigiert. Alternativ bei DB-Member: `"A member with this email address already exists"`.

---

### TC-AU-052: Registrierter User kann sich noch NICHT einloggen
**Vorbedingung:** Gerade registriert  
**Schritte:**
1. Login mit registrierten Credentials  
**Erwartetes Ergebnis:**
- Login fehlgeschlagen (User ist `enabled: false`)

---

### TC-AU-053: Admin aktiviert registrierten User
**Vorbedingung:** Registrierter User (disabled)  
**Schritte:**
1. Admin: `PUT /api/v1/users/{userId}/enabled` mit `{ "enabled": true }`
2. User: Login versuchen  
**Erwartetes Ergebnis:**
- Login erfolgreich
- Member automatisch erstellt mit `MembershipType.Regular` und Status `Active`

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/enabled` (nicht `/enable`).

---

### TC-AU-054: Registrierung erfordert keinen Auth-Token
**Schritte:**
1. `POST /api/v1/registration` komplett ohne Authorization Header  
**Erwartetes Ergebnis:**
- Funktioniert (AllowAnonymous)

---

## 8. Anwendungseinstellungen

### TC-AU-055: Öffentliche Einstellungen abrufen
**Schritte:**
1. `GET /api/v1/settings/public` (OHNE Auth)  
**Erwartetes Ergebnis:**
- HTTP 200 OK (AllowAnonymous)
- `applicationName`, `logoText`, `logoBackgroundColor`, `logoTextColor`

---

### TC-AU-056: Einstellungen abrufen (Admin)
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/settings`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Alle Settings inkl. geschützte Felder

---

### TC-AU-057: Einstellungen aktualisieren
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `PUT /api/v1/settings` mit:
   ```json
   {
     "applicationName": "Indischer Verein",
     "logoText": "IAB",
     "logoBackgroundColor": "#1a365d",
     "logoTextColor": "#ffffff"
   }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Einstellungen aktualisiert

---

### TC-AU-058: Einstellungen — Alle Felder required
**Schritte:**
1. `PUT /api/v1/settings` mit fehlendem `applicationName`  
**Erwartetes Ergebnis:**
- HTTP 400/500 (Alle Felder sind required)

---

### TC-AU-059: Einstellungen aktualisieren — Nicht Admin
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `PUT /api/v1/settings`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden

---

### TC-AU-060: Einstellungen lesen — Nicht Admin
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/settings`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (geschützter Endpoint, NICHT public)

---

## 9. Berechtigungen (36 Permissions)

### TC-AU-061: Alle 36 Permissions prüfen
**Schritte:**
1. Prüfe ob alle Permissions korrekt definiert sind:
   - **Member (7):** `member:read`, `member:read:own`, `member:create`, `member:update`, `member:update:own`, `member:delete`, `member:status:change`
   - **User Mgmt (5):** `user:read`, `user:create`, `user:update`, `user:delete`, `user:role:assign`
   - **Event (8):** `event:read`, `event:read:own`, `event:create`, `event:update`, `event:update:own`, `event:delete`, `event:delete:own`, `event:publish`
   - **Document (8):** `document:read`, `document:read:own`, `document:create`, `document:update`, `document:update:own`, `document:delete`, `document:delete:own`, `document:approve`
   - **Finance (5):** `finance:read`, `finance:create`, `finance:update`, `finance:delete`, `finance:export`
   - **Audit (2):** `audit:read`, `audit:export`
   - **System (1):** `system:settings`  
**Erwartetes Ergebnis:**
- Alle 36 Permissions existieren

> ⚠️ **Code-Verifizierung v1.1:** Zahlreiche Permission-Namen korrigiert. Wichtigste Änderungen:
> - Event: `event:registration:manage`, `event:checkin:manage`, `event:statistics:view` → `event:read:own`, `event:update:own`, `event:delete:own`
> - Document: `document:publish`, `document:review`, `document:permission:manage`, `document:version:manage` → `document:read:own`, `document:update:own`, `document:delete:own`, `document:approve`
> - Finance: `finance:write`, `finance:approve`, `finance:admin` → `finance:create`, `finance:update`, `finance:delete`
> - System: `system:settings:manage` → `system:settings`
> - User Mgmt: 5 Permissions (nicht 4) — inkl. `user:role:assign`

---

### TC-AU-062: Admin hat alle Permissions
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/identity/me`
2. Rollen prüfen → enthält `admin`  
**Erwartetes Ergebnis:**
- Admin-Rolle vorhanden (Permissions sind server-seitig, nicht in /me-Response)

> ⚠️ **Code-Verifizierung v1.1:** `/me`-Response enthält KEIN `permissions[]`-Feld. Permissions werden server-seitig über `GetPermissionsForRoles()` aufgelöst. Prüfung nur indirekt möglich (Endpoint-Zugriff testen).

---

### TC-AU-063: Member Basis-Permissions
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. Endpoint-Zugriffe testen (Permissions sind server-seitig)  
**Erwartetes Ergebnis:**
- Hat: `member:read:own`, `member:update:own`, `event:read`, `event:read:own`, `document:read`, `document:read:own`
- NICHT: `member:create`, `user:read`, `finance:read`, etc.

> ⚠️ **Code-Verifizierung v1.1:** Permissions nicht via `/me` abrufbar. Prüfung nur indirekt über Endpoint-Zugriffe.

---

### TC-AU-064: Vorstand Permissions
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. Endpoint-Zugriffe testen  
**Erwartetes Ergebnis:**
- Enthält Member-Permissions PLUS: `member:read`, `member:create`, `member:update`, `member:delete`, `member:status:change`, `event:create`, `event:update`, `event:delete`, `event:publish`, `document:create`, `document:update`, `document:delete`, `document:approve`

> ⚠️ **Code-Verifizierung v1.1:** Permissions server-seitig. Vorstand hat deutlich mehr Rechte als im Originalentwurf.

---

### TC-AU-065: Kassier Permissions
**Vorbedingung:** Eingeloggt als `kassier`  
**Schritte:**
1. Endpoint-Zugriffe testen  
**Erwartetes Ergebnis:**
- Enthält: `member:read`, `member:read:own`, `member:update:own`, `finance:read`, `finance:create`, `finance:update`, `finance:delete`, `finance:export`, `document:read`, `document:read:own`, `document:create`, `document:update:own`, `audit:read`
- NICHT: `user:create`, `user:delete`, `finance:approve`

> ⚠️ **Code-Verifizierung v1.1:** Kassier hat 13 Permissions. `finance:write` → `finance:create`/`finance:update`/`finance:delete` (granularer). Auch `document:create` und `audit:read`.

---

### TC-AU-066: Event-Manager Permissions
**Vorbedingung:** Benutzer mit Rolle `event-manager`  
**Schritte:**
1. Endpoint-Zugriffe testen  
**Erwartetes Ergebnis:**
- Enthält: `member:read`, `member:read:own`, `member:update:own`, `event:read`, `event:read:own`, `event:create`, `event:update`, `event:update:own`, `event:delete`, `event:delete:own`, `document:read`, `document:read:own`, `document:create`, `document:update:own`
- NICHT: `event:publish` (nur Vorstand/Admin)

> ⚠️ **Code-Verifizierung v1.1:** Event-Manager hat 12 Permissions. Hat NICHT `event:publish` — nur Vorstand/Admin können Events veröffentlichen.

---

### TC-AU-067: Auditor Permissions
**Vorbedingung:** Eingeloggt als `auditor`  
**Schritte:**
1. Endpoint-Zugriffe testen  
**Erwartetes Ergebnis:**
- Enthält: `finance:read`, `finance:export`, `member:read`, `member:read:own`, `audit:read`
- NICHT: `finance:create`, `user:create`, `audit:export`

> ⚠️ **Code-Verifizierung v1.1:** Auditor hat nur 5 Permissions. Hat `finance:export` aber NICHT `audit:export`. Hat `member:read` für Kontext bei Audit-Prüfung.

---

### TC-AU-068: Permission-basierte Zugriffskontrolle
**Vorbedingung:** Benutzer ohne `finance:read`  
**Schritte:**
1. `GET /api/v1/finance/accounts`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (Permission:finance:read Policy)

---

## 10. Keycloak-Synchronisation

### TC-AU-069: Keycloak-User in DB reflektiert
**Vorbedingung:** Neuer User in Keycloak erstellt (via API)  
**Schritte:**
1. User in Keycloak-Admin prüfen  
**Erwartetes Ergebnis:**
- User existiert mit korrektem Realm, Rollen, enabled-Status

---

### TC-AU-070: Enable-Sync: Keycloak → Member erstellt
**Vorbedingung:** User ohne Member-Entity  
**Schritte:**
1. `PUT /api/v1/users/{userId}/enabled` mit `{ "enabled": true }`  
**Erwartetes Ergebnis:**
- Member mit `Address.Create("", "", "", "")`, `MembershipType.Regular`
- `Activate()` aufgerufen

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/enabled`. `Address.Create` mit vier leeren Strings (nur null wird abgelehnt).

---

### TC-AU-071: Update User (enabled=false) — Member deaktiviert
**Schritte:**
1. `PUT /api/v1/users/{userId}` mit `"enabled": false`  
**Erwartetes Ergebnis:**
- Member.Deactivate() aufgerufen → Status `Inactive`

---

### TC-AU-072: SetUserEnabled(false) — Member bleibt aktiv ⚠️
**Schritte:**
1. `PUT /api/v1/users/{userId}/disable`
2. Member-Status prüfen  
**Erwartetes Ergebnis:**
- ⚠️ **Bekanntes asymmetrisches Verhalten**: Member wird NICHT deaktiviert
- Nur `UpdateUser(enabled: false)` deaktiviert Member, NICHT `SetUserEnabled(false)`

---

### TC-AU-073: Rollen in Keycloak nach Zuweisung
**Schritte:**
1. `PUT /api/v1/users/{userId}/roles` mit `{ "roles": ["kassier"] }`
2. In Keycloak Admin Console prüfen  
**Erwartetes Ergebnis:**
- Rolle `kassier` dem User zugewiesen in Keycloak

> ⚠️ **Code-Verifizierung v1.1:** PUT (nicht POST). Sync-Logik.

---

### TC-AU-074: Password Reset in Keycloak
**Schritte:**
1. `POST /api/v1/users/{userId}/reset-password`
2. In Keycloak prüfen  
**Erwartetes Ergebnis:**
- Passwort-Reset-E-Mail gesendet (via Keycloak `executeActionsEmail`)

> ⚠️ **Code-Verifizierung v1.1:** POST (nicht PUT). Sendet E-Mail, setzt kein Passwort direkt.

---

## 11. Autorisierung & Zugriffskontrolle

### TC-AU-075: Unautorisiert — Kein Token
**Schritte:**
1. `GET /api/v1/users` ohne Auth  
**Erwartetes Ergebnis:**
- HTTP 401 Unauthorized

---

### TC-AU-076: Member kann KEINE User verwalten
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/users` → 403
2. `POST /api/v1/users` → 403
3. `DELETE /api/v1/users/{id}` → 403  
**Erwartetes Ergebnis:**
- Alle 403 Forbidden (RequireAdmin)

---

### TC-AU-077: Vorstand kann KEINE User verwalten
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/users` → 403  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireAdmin)

---

### TC-AU-078: Kassier kann KEINE User verwalten
**Vorbedingung:** Eingeloggt als `kassier`  
**Schritte:**
1. `POST /api/v1/users` → 403  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden

---

### TC-AU-079: Admin hat User-Vollzugriff
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/users` → 200
2. `POST /api/v1/users` → 201
3. `PUT /api/v1/users/{id}` → 200
4. `DELETE /api/v1/users/{id}` → 204  
**Erwartetes Ergebnis:**
- Alle erfolgreich

> ⚠️ **Code-Verifizierung v1.1:** POST gibt 201 (Created), DELETE gibt 204 (No Content).

---

### TC-AU-080: Custom Roles — Nur Admin CUD
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/custom-roles` → 403
2. `PUT /api/v1/custom-roles/{id}` → 403
3. `DELETE /api/v1/custom-roles/{id}` → 403  
**Erwartetes Ergebnis:**
- Alle 403 Forbidden

> ⚠️ **Code-Verifizierung v1.1:** Endpoint ist `/custom-roles`.

---

### TC-AU-081: AllowAnonymous Endpoints prüfen
**Schritte:**
1. `GET /api/v1/custom-roles/active` ohne Auth → 200
2. `GET /api/v1/settings/public` ohne Auth → 200
3. `POST /api/v1/registration` ohne Auth → 200  
**Erwartetes Ergebnis:**
- Alle 3 Endpoints ohne Auth erreichbar

> ⚠️ **Code-Verifizierung v1.1:** `/custom-roles/active` (nicht `/roles/active`).

---

### TC-AU-082: Identity-Endpoints für jeden Auth-User
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/identity/me` → 200
2. `GET /api/v1/identity/roles` → 200  
**Erwartetes Ergebnis:**
- Alle Identity-Endpoints erreichbar für jeden authentifizierten User

---

### TC-AU-083: Rollen-Hierarchie Test — Admin = alles
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/identity/admin-check` → 200
2. `GET /api/v1/identity/vorstand-check` → 200
3. `GET /api/v1/identity/member-check` → 200  
**Erwartetes Ergebnis:**
- Admin hat implizit alle 3 Zugriffsebenen

---

### TC-AU-084: Rollen-Hierarchie — Vorstand
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/identity/admin-check` → 403
2. `GET /api/v1/identity/vorstand-check` → 200
3. `GET /api/v1/identity/member-check` → 200  
**Erwartetes Ergebnis:**
- Vorstand: Admin NEIN, Vorstand JA, Member JA

---

### TC-AU-085: Rollen-Hierarchie — Member
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/identity/admin-check` → 403
2. `GET /api/v1/identity/vorstand-check` → 403
3. `GET /api/v1/identity/member-check` → 200  
**Erwartetes Ergebnis:**
- Member: Admin NEIN, Vorstand NEIN, Member JA

---

### TC-AU-086: Kassier Rollenhierarchie
**Vorbedingung:** Eingeloggt als `kassier`  
**Schritte:**
1. `GET /api/v1/identity/admin-check` → 403
2. `GET /api/v1/identity/vorstand-check` → 403
3. `GET /api/v1/identity/member-check` → 200 oder 403  
**Erwartetes Ergebnis:**
- ⚠️ Kassier ist nicht in BaseRole (nur Admin/Vorstand/Member). IsMember = "member" OR "vorstand" OR "admin" → kassier hat KEIN `member`-Check, es sei denn zusätzliche Rolle zugewiesen
