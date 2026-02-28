# Testfälle — Modul Mitglieder/CRM

> **Version:** 1.0  
> **Erstellt:** 2025-01-XX  
> **Modul:** Mitgliederverwaltung (REQ-013, REQ-014, REQ-016, REQ-007, REQ-017)  
> **Endpoints:** `/api/v1/members`  
> **Testumgebung:** http://localhost:5000 (API), http://localhost:3000 (Frontend)

---

## Übersicht

| # | Bereich | Anzahl Testfälle |
|---|---------|-----------------|
| 1 | [Mitglied erstellen (POST)](#1-mitglied-erstellen) | 12 |
| 2 | [Mitglied aktualisieren (PUT)](#2-mitglied-aktualisieren) | 10 |
| 3 | [Mitglied löschen (DELETE)](#3-mitglied-löschen) | 5 |
| 4 | [Mitgliederliste (GET)](#4-mitgliederliste) | 8 |
| 5 | [Mitglied Detail (GET /{id})](#5-mitglied-detail) | 5 |
| 6 | [Eigenes Profil (GET/PUT /me)](#6-eigenes-profil) | 10 |
| 7 | [Profil-Status / Onboarding (GET /me/profile-status)](#7-profil-status-onboarding) | 7 |
| 8 | [Status ändern (PUT /{id}/status)](#8-status-ändern) | 10 |
| 9 | [Mitgliedschaftstyp ändern (PUT /{id}/type)](#9-mitgliedschaftstyp-ändern) | 6 |
| 10 | [Statistiken (GET /statistics)](#10-statistiken) | 4 |
| 11 | [Autorisierung & Rollen](#11-autorisierung-rollen) | 12 |
| 12 | [Validierung & Grenzwerte](#12-validierung-grenzwerte) | 10 |
| **Total** | | **99** |

---

## Testbenutzer

| Rolle | E-Mail | Passwort | Relevante Rechte |
|-------|--------|----------|-----------------|
| Admin | admin@iabconnect.ch | Admin-Dev-2026! | Alle Rechte inkl. Löschen |
| Vorstand | vorstand@iabconnect.ch | Vorstand-Dev-2026! | CRUD (ohne Löschen), Status/Typ ändern |
| Kassier | kassier@iabconnect.ch | Kassier-Dev-2026! | Nur eigenes Profil lesen/bearbeiten |
| Member | member@iabconnect.ch | Member-Dev-2026! | Nur eigenes Profil lesen/bearbeiten |

---

## 1. Mitglied erstellen

### TC-MG-001: Mitglied mit allen Pflichtfeldern erstellen
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit Body:
   ```json
   {
     "firstName": "Hans",
     "lastName": "Muster",
     "email": "hans.muster@example.com",
     "street": "Bahnhofstrasse 1",
     "city": "Zürich",
     "postalCode": "8001",
     "membershipType": 0
   }
   ```
2. Response prüfen  
**Erwartetes Ergebnis:**
- HTTP 201 Created
- Location-Header: `/api/v1/members/{id}`
- Response enthält `MemberDto` mit `status: 0` (Pending), `memberSince: <heute>`
- `country` = `"Schweiz"` (Default)

---

### TC-MG-002: Mitglied mit allen optionalen Feldern erstellen
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `POST /api/v1/members` mit Body inkl. `phone: "+41 79 123 45 67"`, `country: "Österreich"`  
**Erwartetes Ergebnis:**
- HTTP 201 Created
- `phone` und `country` korrekt gespeichert
- `country` = `"Österreich"` (nicht Default "Schweiz")

---

### TC-MG-003: Mitglied erstellen — Duplikat-E-Mail
**Vorbedingung:** Mitglied mit `hans.muster@example.com` existiert  
**Schritte:**
1. `POST /api/v1/members` mit selber E-Mail  
**Erwartetes Ergebnis:**
- HTTP 409 Conflict
- Fehlermeldung: `"E-Mail-Adresse bereits vergeben"`

---

### TC-MG-004: Mitglied erstellen — Vorname leer
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `"firstName": ""`  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — Endpoint hat KEINE Validierung für leeren Vornamen
- `CreateMemberCommandValidator` existiert, wird aber nie aufgerufen (Endpoint umgeht MediatR)
- **Code-Lücke:** Validator muss am Endpoint registriert oder MediatR-Pipeline genutzt werden

---

### TC-MG-005: Mitglied erstellen — Nachname leer
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `"lastName": ""`  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — Endpoint hat KEINE Validierung für leeren Nachnamen
- **Code-Lücke:** Gleiche Ursache wie TC-MG-004

---

### TC-MG-006: Mitglied erstellen — E-Mail ungültig
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `"email": "keine-email"`  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — Endpoint hat KEINE E-Mail-Format-Validierung
- **Code-Lücke:** Gleiche Ursache wie TC-MG-004

---

### TC-MG-007: Mitglied erstellen — E-Mail leer
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `"email": ""`  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — Endpoint hat KEINE E-Mail-Pflichtfeld-Validierung
- **Code-Lücke:** Gleiche Ursache wie TC-MG-004

---

### TC-MG-008: Mitglied erstellen — Strasse leer
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `"street": ""`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"Street is required"` (englisch, via `Address.Create` → `ArgumentException`)

---

### TC-MG-009: Mitglied erstellen — PLZ leer
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `"postalCode": ""`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"Postal code is required"` (englisch, via `Address.Create` → `ArgumentException`)

---

### TC-MG-010: Mitglied erstellen — Ungültiger Mitgliedschaftstyp
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `"membershipType": 99`  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — JSON deserialisiert `99` als `(MembershipType)99` ohne Validierung
- **Code-Lücke:** Kein `IsInEnum()`-Check am Endpoint

---

### TC-MG-011: Mitglied erstellen — Alle 4 Mitgliedschaftstypen
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. Erstelle Mitglied mit `membershipType: 0` (Einzelmitglied)
2. Erstelle Mitglied mit `membershipType: 1` (Student)
3. Erstelle Mitglied mit `membershipType: 2` (Familienmitglied)
4. Erstelle Mitglied mit `membershipType: 3` (Ehrenmitglied)  
**Erwartetes Ergebnis:**
- Alle 4 erstellt mit korrektem `membershipTypeDisplay`

---

### TC-MG-012: Mitglied erstellen über Frontend
**Vorbedingung:** Eingeloggt als `vorstand` im Frontend  
**Schritte:**
1. Navigiere zu `/members/new`
2. Alle Pflichtfelder ausfüllen (Vorname, Nachname, E-Mail, Strasse, PLZ, Stadt)
3. Mitgliedschaftstyp wählen
4. Formular absenden  
**Erwartetes Ergebnis:**
- Erfolgsmeldung angezeigt
- Weiterleitung zur Mitgliederübersicht
- Neues Mitglied in der Liste sichtbar mit Status "Ausstehend"

---

## 2. Mitglied aktualisieren

### TC-MG-013: Mitglied — Name und Adresse aktualisieren
**Vorbedingung:** Mitglied existiert, eingeloggt als `vorstand`  
**Schritte:**
1. `PUT /api/v1/members/{id}` mit geänderten `firstName`, `street`, `city`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Aktualisierte Daten in Response

---

### TC-MG-014: Mitglied aktualisieren — E-Mail ändern
**Vorbedingung:** Mitglied existiert, eingeloggt als `vorstand`  
**Schritte:**
1. `PUT /api/v1/members/{id}` mit neuer, einzigartiger E-Mail  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- E-Mail aktualisiert

---

### TC-MG-015: Mitglied aktualisieren — E-Mail-Duplikat
**Vorbedingung:** Zwei Mitglieder A und B existieren  
**Schritte:**
1. `PUT /api/v1/members/{id_B}` mit E-Mail von Mitglied A  
**Erwartetes Ergebnis:**
- HTTP 409 Conflict
- Fehlermeldung: `"E-Mail-Adresse bereits vergeben"`

---

### TC-MG-016: Mitglied aktualisieren — Nicht existierendes Mitglied
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `PUT /api/v1/members/{random-guid}` mit gültigen Daten  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found
- Fehlermeldung: `"Mitglied nicht gefunden"`

---

### TC-MG-017: Mitglied aktualisieren — Telefonnummer hinzufügen
**Vorbedingung:** Mitglied ohne Telefon existiert  
**Schritte:**
1. `PUT /api/v1/members/{id}` mit `"phone": "+41 79 999 88 77"`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Telefon gespeichert

---

### TC-MG-018: Mitglied aktualisieren — Telefon entfernen
**Vorbedingung:** Mitglied mit Telefon existiert  
**Schritte:**
1. `PUT /api/v1/members/{id}` mit `"phone": null`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Telefon entfernt

---

### TC-MG-019: Mitglied aktualisieren — Land ändern
**Vorbedingung:** Mitglied mit `country: "Schweiz"` existiert  
**Schritte:**
1. `PUT /api/v1/members/{id}` mit `"country": "Deutschland"`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Land = "Deutschland"

---

### TC-MG-020: Mitglied aktualisieren über Frontend
**Vorbedingung:** Eingeloggt als `vorstand`, Mitglied existiert  
**Schritte:**
1. Navigiere zu `/members/{id}/edit`
2. Vorname und Strasse ändern
3. Speichern  
**Erwartetes Ergebnis:**
- Erfolgsmeldung angezeigt
- Änderungen sichtbar in der Detailansicht

---

### TC-MG-021: Mitglied aktualisieren — Leere Pflichtfelder
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `PUT /api/v1/members/{id}` mit `"firstName": ""`, `"street": ""`  
**Erwartetes Ergebnis:**
- HTTP **400** Bad Request (immer 400, nie 500; `Address.Create` wirft `ArgumentException`)
- Änderung wird nicht gespeichert
- ⚠️ Hinweis: Leerer `firstName` allein (mit gültigem `street`) gibt **200** — keine firstName-Validierung am Endpoint

---

### TC-MG-022: Mitglied aktualisieren — Eigene E-Mail beibehalten
**Vorbedingung:** Mitglied existiert  
**Schritte:**
1. `PUT /api/v1/members/{id}` mit gleicher E-Mail wie aktuell  
**Erwartetes Ergebnis:**
- HTTP 200 OK (kein Duplikat-Fehler)

---

## 3. Mitglied löschen

### TC-MG-023: Mitglied löschen als Admin
**Vorbedingung:** Mitglied existiert, eingeloggt als `admin`  
**Schritte:**
1. `DELETE /api/v1/members/{id}`  
**Erwartetes Ergebnis:**
- HTTP 204 No Content
- Mitglied ist **permanent gelöscht** (Hard Delete)
- Nachfolgendes `GET /api/v1/members/{id}` → 404

---

### TC-MG-024: Mitglied löschen als Vorstand → Abgelehnt
**Vorbedingung:** Mitglied existiert, eingeloggt als `vorstand`  
**Schritte:**
1. `DELETE /api/v1/members/{id}`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden
- Mitglied bleibt bestehen

---

### TC-MG-025: Mitglied löschen — Nicht existierend
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `DELETE /api/v1/members/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

### TC-MG-026: Mitglied löschen über Frontend
**Vorbedingung:** Eingeloggt als `admin`, Mitglied existiert  
**Schritte:**
1. Navigiere zu `/members/{id}`
2. Lösch-Button klicken
3. Browser-Dialog bestätigen  
**Erwartetes Ergebnis:**
- Mitglied gelöscht
- Weiterleitung zur Mitgliederliste
- Mitglied nicht mehr sichtbar

---

### TC-MG-027: Lösch-Button nur für Admin sichtbar
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. Navigiere zu `/members/{id}`
2. Prüfe ob Lösch-Button vorhanden  
**Erwartetes Ergebnis:**
- Kein Lösch-Button sichtbar

---

## 4. Mitgliederliste

### TC-MG-028: Mitgliederliste — Standard-Paginierung
**Vorbedingung:** Mehr als 20 Mitglieder existieren, eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/members`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Max. 20 Einträge (Standard `pageSize`)
- `totalCount` zeigt Gesamtanzahl

---

### TC-MG-029: Mitgliederliste — Paginierung
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/members?page=2&pageSize=5`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Max. 5 Einträge
- Korrekte Offset-Berechnung

---

### TC-MG-030: Mitgliederliste — Suche nach Name
**Vorbedingung:** Mitglied "Hans Muster" existiert  
**Schritte:**
1. `GET /api/v1/members?search=Hans`  
**Erwartetes Ergebnis:**
- "Hans Muster" in den Ergebnissen

---

### TC-MG-031: Mitgliederliste — Filter nach Status
**Vorbedingung:** Mitglieder mit verschiedenen Status existieren  
**Schritte:**
1. `GET /api/v1/members?status=1` (Aktiv)  
**Erwartetes Ergebnis:**
- Nur aktive Mitglieder in der Liste

---

### TC-MG-032: Mitgliederliste — Filter nach Typ
**Vorbedingung:** Verschiedene Mitgliedschaftstypen existieren  
**Schritte:**
1. `GET /api/v1/members?type=1` (Student)  
**Erwartetes Ergebnis:**
- Nur Studenten-Mitglieder

---

### TC-MG-033: Mitgliederliste — Kombinationsfilter
**Vorbedingung:** Mitglieder mit verschiedenen Status und Typen  
**Schritte:**
1. `GET /api/v1/members?status=1&type=0&search=M`  
**Erwartetes Ergebnis:**
- Nur aktive Einzelmitglieder deren Name/E-Mail "M" enthält

---

### TC-MG-034: Mitgliederliste — Leeres Ergebnis
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/members?search=XXXXXXXXXXXXXX`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Leere `items`-Liste, `totalCount: 0`

---

### TC-MG-035: Mitgliederliste im Frontend
**Vorbedingung:** Eingeloggt als `vorstand`, mehrere Mitglieder existieren  
**Schritte:**
1. Navigiere zu `/members`
2. Suchfeld nutzen
3. Filter-Dropdowns nutzen
4. Paginierung testen  
**Erwartetes Ergebnis:**
- Tabelle mit Mitgliedern angezeigt
- Suche und Filter funktionieren
- Paginierung mit "Vorherige"/"Nächste" Buttons
- Seite X von Y Anzeige

---

## 5. Mitglied Detail

### TC-MG-036: Mitglied-Detailansicht
**Vorbedingung:** Mitglied existiert, eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/members/{id}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Alle Felder korrekt: firstName, lastName, email, phone, street, city, postalCode, country, membershipType, membershipTypeDisplay, status, statusDisplay, memberSince

---

### TC-MG-037: Mitglied nicht gefunden
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/members/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found
- Fehlermeldung: `"Mitglied nicht gefunden"`

---

### TC-MG-038: Mitglied Detail — Display-Werte prüfen
**Vorbedingung:** Aktives Familienmitglied existiert  
**Schritte:**
1. `GET /api/v1/members/{id}`  
**Erwartetes Ergebnis:**
- `statusDisplay: "Aktiv"`
- `membershipTypeDisplay: "Familienmitglied"`

---

### TC-MG-039: Mitglied Detail im Frontend
**Vorbedingung:** Eingeloggt als `vorstand`, Mitglied existiert  
**Schritte:**
1. Navigiere zu `/members/{id}`  
**Erwartetes Ergebnis:**
- Profil-Karte mit Name, Kontaktdaten, Adresse
- Mitgliedschafts-Informationen (Typ, Status, Mitglied seit)
- Quick-Actions (Status- und Typ-Dropdown)
- Bearbeitungs- und Lösch-Buttons (Lösch nur für Admin)

---

### TC-MG-040: Mitglied Detail — Zugriffskontrolle
**Vorbedingung:** Mitglied existiert, eingeloggt als `kassier`  
**Schritte:**
1. `GET /api/v1/members/{id}`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireVorstand-Policy: nur `admin` und `vorstand` erlaubt — `kassier` ist NICHT in der Policy)
- ⚠️ Hinweis: Kassier hat zwar `member:read`-Permission, aber die Policy-Rollenprüfung blockiert vorher

---

## 6. Eigenes Profil

### TC-MG-041: Eigenes Profil abrufen
**Vorbedingung:** Eingeloggt als `member`, Profil existiert  
**Schritte:**
1. `GET /api/v1/members/me`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Eigene Profildaten

---

### TC-MG-042: Eigenes Profil — Kein Profil vorhanden
**Vorbedingung:** Benutzer hat kein Mitgliedsprofil  
**Schritte:**
1. `GET /api/v1/members/me`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found
- Fehlermeldung: `"Mitgliedsprofil nicht gefunden"`

---

### TC-MG-043: Eigenes Profil aktualisieren
**Vorbedingung:** Eingeloggt als `member`, Profil existiert  
**Schritte:**
1. `PUT /api/v1/members/me` mit:
   ```json
   {
     "firstName": "Neuer Vorname",
     "lastName": "Neuer Nachname",
     "street": "Neue Strasse 5",
     "city": "Bern",
     "postalCode": "3000",
     "phone": "+41 79 111 22 33"
   }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Name, Adresse, Telefon aktualisiert

---

### TC-MG-044: Eigenes Profil — E-Mail kann NICHT geändert werden
**Vorbedingung:** Eingeloggt als `member`, E-Mail = `member@iabconnect.ch`  
**Schritte:**
1. `PUT /api/v1/members/me` (Request-DTO enthält kein E-Mail-Feld)  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- E-Mail bleibt unverändert auf `member@iabconnect.ch`
- Das `UpdateOwnProfileRequest`-DTO hat **kein** `email`-Feld

---

### TC-MG-045: Eigenes Profil — Country Default
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `PUT /api/v1/members/me` ohne `country`-Feld  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Country bleibt unverändert (oder Default "Schweiz" bei null)

---

### TC-MG-046: Eigenes Profil — Kassier kann eigenes Profil bearbeiten
**Vorbedingung:** Eingeloggt als `kassier`  
**Schritte:**
1. `GET /api/v1/members/me` → Profil abrufen
2. `PUT /api/v1/members/me` → Adresse ändern  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **403 Forbidden** — `RequireMember`-Policy enthält nur `admin`, `vorstand`, `member`
- `kassier` ist NICHT in der Policy, trotz `member:read:own` und `member:update:own` Permissions
- **Code-Lücke:** Entweder `kassier` zur RequireMember-Policy hinzufügen, oder sicherstellen dass kassier auch die `member`-Rolle in Keycloak hat

---

### TC-MG-047: Eigenes Profil — Vorstand kann eigenes Profil bearbeiten
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/members/me`
2. `PUT /api/v1/members/me`  
**Erwartetes Ergebnis:**
- Beide HTTP 200 OK

---

### TC-MG-048: Eigenes Profil — Admin kann eigenes Profil bearbeiten
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/members/me`
2. `PUT /api/v1/members/me`  
**Erwartetes Ergebnis:**
- Beide HTTP 200 OK

---

### TC-MG-049: Eigenes Profil — Leere Adressfelder
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `PUT /api/v1/members/me` mit `"street": ""`, `"city": ""`  
**Erwartetes Ergebnis:**
- HTTP **400** Bad Request (immer 400, nie 500; `Address.Create` wirft `ArgumentException` bei leeren Pflichtfeldern)

---

### TC-MG-050: Eigenes Profil — Unautorisiert
**Vorbedingung:** Kein Auth-Token  
**Schritte:**
1. `GET /api/v1/members/me` ohne Authorization-Header  
**Erwartetes Ergebnis:**
- HTTP 401 Unauthorized

---

## 7. Profil-Status / Onboarding

### TC-MG-051: Profil-Status — Vollständiges Profil
**Vorbedingung:** Mitglied mit Adresse und Telefon existiert  
**Schritte:**
1. `GET /api/v1/members/me/profile-status`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `isComplete: true`
- `completionPercentage: 100`
- `hasProfile: true`
- 3 Checklist-Items: `profile` ✓, `address` ✓, `phone` ✓

---

### TC-MG-052: Profil-Status — Adresse fehlt
**Vorbedingung:** Mitglied mit Platzhalter-Adresse ("Nicht angegeben")  
**Schritte:**
1. `GET /api/v1/members/me/profile-status`  
**Erwartetes Ergebnis:**
- `isComplete: false`
- `completionPercentage: 33` (1 von 3 Items komplett)
- `nextAction: "Bitte geben Sie Ihre Adresse an"`
- `address`-Item: `isComplete: false`, `isRequired: true`

---

### TC-MG-053: Profil-Status — Telefon fehlt (optional)
**Vorbedingung:** Mitglied mit gültiger Adresse aber ohne Telefon  
**Schritte:**
1. `GET /api/v1/members/me/profile-status`  
**Erwartetes Ergebnis:**
- `isComplete: true` (Telefon ist NICHT required)
- `completionPercentage: 67` (2 von 3 Items)
- `nextAction: "Bitte geben Sie Ihre Telefonnummer an (optional)"`
- `phone`-Item: `isComplete: false`, `isRequired: false`

---

### TC-MG-054: Profil-Status — Kein Profil
**Vorbedingung:** Benutzer hat kein Mitgliedsprofil  
**Schritte:**
1. `GET /api/v1/members/me/profile-status`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `hasProfile: false`
- `isComplete: false`
- `completionPercentage: 0`
- Alle Items `isComplete: false`

---

### TC-MG-055: Profil-Status — PLZ "0000" gilt als unvollständig
**Vorbedingung:** Mitglied mit `postalCode: "0000"` (Platzhalter from `CreateEmpty`)  
**Schritte:**
1. `GET /api/v1/members/me/profile-status`  
**Erwartetes Ergebnis:**
- `address`-Item: `isComplete: false`

---

### TC-MG-056: Profil-Status — Adresse "Nicht angegeben" gilt als unvollständig
**Vorbedingung:** Mitglied mit `street: "Nicht angegeben"`, `city: "Nicht angegeben"`  
**Schritte:**
1. `GET /api/v1/members/me/profile-status`  
**Erwartetes Ergebnis:**
- `address`-Item: `isComplete: false`

---

### TC-MG-057: Profil-Status — Checklist-Items Struktur
**Vorbedingung:** Mitglied existiert  
**Schritte:**
1. `GET /api/v1/members/me/profile-status`  
**Erwartetes Ergebnis:**
- Genau 3 Checklist-Items mit:
  - `key: "profile"`, `label: "Profil erstellt"`, `isRequired: true`
  - `key: "address"`, `label: "Adresse angegeben"`, `isRequired: true`
  - `key: "phone"`, `label: "Telefonnummer angegeben"`, `isRequired: false`

---

## 8. Status ändern

### TC-MG-058: Status ändern — Pending → Active
**Vorbedingung:** Mitglied mit Status `Pending` existiert  
**Schritte:**
1. `PUT /api/v1/members/{id}/status` mit `{"status": 1}` (Active)  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Status = `Active`, `statusDisplay: "Aktiv"`
- Domain Event `MemberActivatedEvent` ausgelöst

---

### TC-MG-059: Status ändern — Active → Inactive
**Vorbedingung:** Mitglied mit Status `Active`  
**Schritte:**
1. `PUT /api/v1/members/{id}/status` mit `{"status": 2}` (Inactive)  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Status = `Inactive`, `statusDisplay: "Inaktiv"`
- Domain Event `MemberDeactivatedEvent` ausgelöst

---

### TC-MG-060: Status ändern — Active → Suspended
**Vorbedingung:** Mitglied mit Status `Active`  
**Schritte:**
1. `PUT /api/v1/members/{id}/status` mit `{"status": 3}` (Suspended)  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Status = `Suspended`, `statusDisplay: "Gesperrt"`
- Domain Event `MemberSuspendedEvent` ausgelöst

---

### TC-MG-061: Status ändern — Suspended → Active (Reaktivierung)
**Vorbedingung:** Mitglied mit Status `Suspended`  
**Schritte:**
1. `PUT /api/v1/members/{id}/status` mit `{"status": 1}` (Active)  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Status = `Active`
- Statusübergang unrestriktiv erlaubt

---

### TC-MG-062: Status ändern — Idempotenz (Active → Active)
**Vorbedingung:** Mitglied bereits `Active`  
**Schritte:**
1. `PUT /api/v1/members/{id}/status` mit `{"status": 1}` (Active)  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Keine Änderung, kein Domain Event
- No-Op Verhalten

---

### TC-MG-063: Status ändern — Pending nicht über API setzbar
**Vorbedingung:** Aktives Mitglied existiert  
**Schritte:**
1. `PUT /api/v1/members/{id}/status` mit `{"status": 0}` (Pending)  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"Ungültiger Status"`
- Pending kann nur bei Erstellung gesetzt werden

---

### TC-MG-064: Status ändern — Ungültiger Status-Wert
**Vorbedingung:** Mitglied existiert  
**Schritte:**
1. `PUT /api/v1/members/{id}/status` mit `{"status": 99}`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request

---

### TC-MG-065: Status ändern — Nicht existierendes Mitglied
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `PUT /api/v1/members/{random-guid}/status` mit `{"status": 1}`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

### TC-MG-066: Status ändern über Frontend
**Vorbedingung:** Eingeloggt als `vorstand`, Mitglied existiert  
**Schritte:**
1. Navigiere zu `/members/{id}`
2. Status-Dropdown auf "Aktiv" ändern  
**Erwartetes Ergebnis:**
- Status wird aktualisiert
- Status-Badge zeigt neuen Wert an

---

### TC-MG-067: Status ändern — Alle Übergänge testen
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. Active → Inactive ✓
2. Inactive → Suspended ✓
3. Suspended → Active ✓
4. Active → Suspended ✓
5. Suspended → Inactive ✓
6. Inactive → Active ✓  
**Erwartetes Ergebnis:**
- Alle Übergänge erfolgreich (unrestriktiv)
- Nur "zurück zu Pending" ist nicht möglich

---

## 9. Mitgliedschaftstyp ändern

### TC-MG-068: Typ ändern — Regular → Student
**Vorbedingung:** Mitglied mit Typ `Regular` existiert  
**Schritte:**
1. `PUT /api/v1/members/{id}/type` mit `{"membershipType": 1}` (Student)  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `membershipType: 1`, `membershipTypeDisplay: "Student/Lernender"`
- Domain Event `MembershipTypeChangedEvent` mit OldType=Regular, NewType=Student

---

### TC-MG-069: Typ ändern — Idempotenz (gleicher Typ)
**Vorbedingung:** Mitglied mit Typ `Regular`  
**Schritte:**
1. `PUT /api/v1/members/{id}/type` mit `{"membershipType": 0}` (Regular)  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Kein Domain Event (No-Op)

---

### TC-MG-070: Typ ändern — Alle 4 Typen
**Vorbedingung:** Mitglied existiert  
**Schritte:**
1. Typ auf Regular (0) → `membershipTypeDisplay: "Einzelmitglied"`
2. Typ auf Student (1) → `membershipTypeDisplay: "Student/Lernender"`
3. Typ auf Family (2) → `membershipTypeDisplay: "Familienmitglied"`
4. Typ auf Honorary (3) → `membershipTypeDisplay: "Ehrenmitglied"`  
**Erwartetes Ergebnis:**
- Alle Änderungen erfolgreich mit korrekten Display-Werten

---

### TC-MG-071: Typ ändern über Frontend
**Vorbedingung:** Eingeloggt als `vorstand`, Mitglied existiert  
**Schritte:**
1. Navigiere zu `/members/{id}`
2. Typ-Dropdown auf "Ehrenmitglied" ändern  
**Erwartetes Ergebnis:**
- Typ wird aktualisiert

---

### TC-MG-072: Typ ändern — Nicht existierendes Mitglied
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `PUT /api/v1/members/{random-guid}/type` mit `{"membershipType": 0}`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

### TC-MG-073: Typ ändern — Ungültiger Typ
**Vorbedingung:** Mitglied existiert  
**Schritte:**
1. `PUT /api/v1/members/{id}/type` mit `{"membershipType": 99}`  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **200 OK** — `ChangeMembershipType()` hat KEINE Validierung für ungültige Enum-Werte
- **Code-Lücke:** Im Gegensatz zu `UpdateMemberStatus` (hat `switch`/`default` → 400) fehlt beim Typ-Handler die Prüfung

---

## 10. Statistiken

### TC-MG-074: Mitglieder-Statistiken abrufen
**Vorbedingung:** Mitglieder mit verschiedenen Status/Typen existieren  
**Schritte:**
1. `GET /api/v1/members/statistics`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `MemberStatisticsDto` mit: `totalMembers`, `activeMembers`, `pendingMembers`, `inactiveMembers`, `suspendedMembers`, `regularMembers`, `studentMembers`, `familyMembers`, `honoraryMembers`
- `totalMembers = activeMembers + pendingMembers + inactiveMembers + suspendedMembers`

---

### TC-MG-075: Statistiken — Korrekte Zählung
**Vorbedingung:** Bekannte Anzahl pro Status/Typ  
**Schritte:**
1. 3 aktive, 2 ausstehende, 1 inaktives Mitglied erstellen
2. `GET /api/v1/members/statistics`  
**Erwartetes Ergebnis:**
- `totalMembers: 6`, `activeMembers: 3`, `pendingMembers: 2`, `inactiveMembers: 1`

---

### TC-MG-076: Statistiken — Nur Vorstand/Admin
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/members/statistics`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden

---

### TC-MG-077: Statistiken im Frontend
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. Navigiere zu `/members`  
**Erwartetes Ergebnis:**
- Statistik-Karten oben auf der Seite angezeigt
- Zeigen: Total, Aktiv, Ausstehend, etc.

---

## 11. Autorisierung & Rollen

### TC-MG-078: Unautorisiert — Kein Token
**Vorbedingung:** Kein Auth-Token  
**Schritte:**
1. `GET /api/v1/members` ohne Authorization-Header  
**Erwartetes Ergebnis:**
- HTTP 401 Unauthorized

---

### TC-MG-079: Member kann keine Mitgliederliste sehen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/members`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireVorstand-Policy)

---

### TC-MG-080: Member kann kein Mitglied erstellen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/members` mit gültigen Daten  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden

---

### TC-MG-081: Kassier kann keine Mitglieder verwalten
**Vorbedingung:** Eingeloggt als `kassier`  
**Schritte:**
1. `GET /api/v1/members` → 403
2. `POST /api/v1/members` → 403
3. `PUT /api/v1/members/{id}` → 403
4. `PUT /api/v1/members/{id}/status` → 403  
**Erwartetes Ergebnis:**
- Alle Anfragen HTTP 403 Forbidden

---

### TC-MG-082: Vorstand kann Mitglieder erstellen und bearbeiten
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` → 201
2. `PUT /api/v1/members/{id}` → 200
3. `PUT /api/v1/members/{id}/status` → 200
4. `PUT /api/v1/members/{id}/type` → 200  
**Erwartetes Ergebnis:**
- Alle Operationen erfolgreich

---

### TC-MG-083: Vorstand kann NICHT löschen
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `DELETE /api/v1/members/{id}`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireAdmin + Permission.MemberDelete)

---

### TC-MG-084: Admin hat Vollzugriff
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/members` → 200
2. `POST /api/v1/members` → 201
3. `PUT /api/v1/members/{id}` → 200
4. `DELETE /api/v1/members/{id}` → 204
5. `GET /api/v1/members/statistics` → 200  
**Erwartetes Ergebnis:**
- Alle Operationen erfolgreich

---

### TC-MG-085: Frontend Zugriffskontrolle — Member
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. Navigiere zu `/members`  
**Erwartetes Ergebnis:**
- Weiterleitung zu `/` (keine Berechtigung)

---

### TC-MG-086: Frontend Zugriffskontrolle — Nicht eingeloggt
**Vorbedingung:** Nicht eingeloggt  
**Schritte:**
1. Navigiere zu `/members`  
**Erwartetes Ergebnis:**
- Weiterleitung zu `/login`

---

### TC-MG-087: Status ändern — Permission MemberStatusChange
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `PUT /api/v1/members/{id}/status` mit neuem Status  
**Erwartetes Ergebnis:**
- HTTP 200 OK (vorstand hat `member:status:change` Permission)

---

### TC-MG-088: Mitglied-Detail — CanAccessMemberAsync Prüfung
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/members/{id}` → Prüfe `CanAccessMemberAsync(Permission.MemberRead)`  
**Erwartetes Ergebnis:**
- HTTP 200 OK (vorstand hat `member:read`)

---

### TC-MG-089: Mitglied-Update — CanAccessMemberAsync Prüfung
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `PUT /api/v1/members/{id}` → Prüfe `CanAccessMemberAsync(Permission.MemberUpdate)`  
**Erwartetes Ergebnis:**
- HTTP 200 OK (vorstand hat `member:update`)

---

## 12. Validierung & Grenzwerte

### TC-MG-090: Vorname — Maximale Länge (100 Zeichen)
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `firstName` = 100 Zeichen → OK
2. `POST /api/v1/members` mit `firstName` = 101 Zeichen → Fehler  
**Erwartetes Ergebnis:**
- 100 Zeichen: HTTP 201
- 101 Zeichen: ⚠️ HTTP **201** — Keine Max-Längen-Validierung am Endpoint
- `CreateMemberCommandValidator` (max 100) existiert, wird aber nie aufgerufen
- **Code-Lücke:** DB überschreitung führt erst zu HTTP 500

---

### TC-MG-091: Nachname — Maximale Länge (100 Zeichen)
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `lastName` = 101 Zeichen  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — Gleiche Lücke wie TC-MG-090

---

### TC-MG-092: E-Mail — Maximale Länge (255 Zeichen)
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `email` = 256 Zeichen (gültige Format)  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — Gleiche Lücke wie TC-MG-090

---

### TC-MG-093: Telefon — Maximale Länge (30 Zeichen)
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `phone` = 31 Zeichen  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — Gleiche Lücke wie TC-MG-090

---

### TC-MG-094: Strasse — Maximale Länge (200 Zeichen)
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `street` = 201 Zeichen  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — `Address.Create()` prüft nur auf leer, NICHT auf Länge

---

### TC-MG-095: Stadt — Maximale Länge (100 Zeichen)
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `city` = 101 Zeichen  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — Gleiche Lücke wie TC-MG-094

---

### TC-MG-096: PLZ — Maximale Länge (20 Zeichen)
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `postalCode` = 21 Zeichen  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — Gleiche Lücke wie TC-MG-094

---

### TC-MG-097: Land — Maximale Länge (100 Zeichen)
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `country` = 101 Zeichen  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **201 Created** — Gleiche Lücke wie TC-MG-094

---

### TC-MG-098: Adress-Felder werden getrimmt
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/members` mit `street: "  Bahnhofstrasse 1  "`  
**Erwartetes Ergebnis:**
- HTTP 201 Created
- Gespeichert als `"Bahnhofstrasse 1"` (ohne führende/nachfolgende Leerzeichen)

---

### TC-MG-099: Hard Delete vs. Soft Delete — Verhalten prüfen
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. Mitglied erstellen
2. `DELETE /api/v1/members/{id}`
3. Direkte DB-Abfrage: `SELECT * FROM members WHERE id = '{id}'`  
**Erwartetes Ergebnis:**
- Datensatz komplett entfernt (Hard Delete via `Remove()`)
- NICHT als `is_deleted = true` markiert
- Kein Datensatz in der DB vorhanden
