# Testfälle — Modul Events / Veranstaltungen

> **Version:** 1.1 (verifiziert gegen Code)  
> **Erstellt:** 2025-01-XX  
> **Modul:** Veranstaltungsverwaltung (REQ-020 bis REQ-030)  
> **Endpoints:** `/api/v1/events`, `/api/v1/events/{id}/registrations`, `/api/v1/registrations`  
> **Testumgebung:** http://localhost:5000 (API), http://localhost:3000 (Frontend)
>
> **⚠️ Verifizierungs-Hinweise:**
> - `InvalidOperationException` → HTTP **409 Conflict** (via ExceptionHandlingMiddleware), NICHT 400
> - `ArgumentException` → HTTP **400** mit Parameter-Suffix: z.B. `"Title is required (Parameter 'title')"`
> - `/complete`-Endpoint existiert NICHT — `Event.Complete()` ist nur Domain-Methode
> - Tags sind `List<string>` im JSON, nicht komma-getrennte Strings

---

## Übersicht

| # | Bereich | Anzahl Testfälle |
|---|---------|-----------------|
| 1 | [Event erstellen](#1-event-erstellen) | 8 |
| 2 | [Event aktualisieren](#2-event-aktualisieren) | 6 |
| 3 | [Event Status-Übergänge](#3-event-status-übergänge) | 14 |
| 4 | [Event löschen](#4-event-löschen) | 4 |
| 5 | [Event-Liste & Filter](#5-event-liste-filter) | 10 |
| 6 | [Öffentliche Events](#6-öffentliche-events) | 6 |
| 7 | [Mitglieder-Registrierung](#7-mitglieder-registrierung) | 10 |
| 8 | [Öffentliche Registrierung](#8-öffentliche-registrierung) | 10 |
| 9 | [Kapazität & Warteliste](#9-kapazität-warteliste) | 12 |
| 10 | [Registrierung stornieren](#10-registrierung-stornieren) | 6 |
| 11 | [Check-In & QR-Code](#11-check-in-qr-code) | 10 |
| 12 | [No-Show & Warteliste verwalten](#12-no-show-warteliste-verwalten) | 6 |
| 13 | [Meine Registrierungen](#13-meine-registrierungen) | 3 |
| 14 | [Statistiken](#14-statistiken) | 3 |
| 15 | [Autorisierung & Rollen](#15-autorisierung-rollen) | 12 |
| **Total** | | **120** |

---

## Testbenutzer

| Rolle | E-Mail | Passwort | Relevante Rechte |
|-------|--------|----------|-----------------|
| Admin | admin@iabconnect.ch | Admin-Dev-2026! | Alle Rechte inkl. Löschen |
| Vorstand | vorstand@iabconnect.ch | Vorstand-Dev-2026! | Events erstellen/bearbeiten/publizieren |
| Event-Manager | (falls vorhanden) | — | Events verwalten, Registrierungen |
| Member | member@iabconnect.ch | Member-Dev-2026! | Events sehen (nur Published), sich registrieren |

---

## 1. Event erstellen

### TC-EV-001: Event mit Pflichtfeldern erstellen
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/events` mit Body:
   ```json
   {
     "title": "Kulturabend",
     "description": "Ein Abend mit indischer Kultur",
     "location": "Vereinslokal Zürich",
     "startDate": "2025-03-15T18:00:00Z",
     "endDate": "2025-03-15T22:00:00Z"
   }
   ```
**Erwartetes Ergebnis:**
- HTTP 201 Created
- `status: "Draft"` (Standard)
- `visibility: "MembersOnly"` (Standard)
- `timeZone: "Europe/Zurich"` (Standard)
- `isAllDay: false` (Standard)

---

### TC-EV-002: Event mit allen optionalen Feldern
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/events` mit allen Feldern:
   - `shortDescription`, `locationAddress`, `locationUrl`
   - `isAllDay: true`, `timeZone: "Europe/Berlin"`
   - `maxParticipants: 50`, `registrationRequired: true`
   - `registrationDeadline: "2025-03-14T23:59:00Z"`
   - `waitlistEnabled: true`
   - `visibility: 1` (Public), `category: 1` (Cultural)
   - `tags: ["kultur", "musik", "indien"]` (Array, NICHT komma-getrennt)
   - `imageUrl`, `imageAltText`, `organizerName`, `contactEmail`, `contactPhone`
   - `cost: 25.50`, `costDescription: "inkl. Essen"`  
**Erwartetes Ergebnis:**
- HTTP 201 Created
- Alle Felder korrekt gespeichert

---

### TC-EV-003: Event erstellen — Titel fehlt
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/events` mit `"title": ""`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"Title is required"`

---

### TC-EV-004: Event erstellen — Beschreibung fehlt
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/events` mit `"description": ""`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"Description is required"`

---

### TC-EV-005: Event erstellen — Location fehlt
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/events` mit `"location": ""`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"Location is required"`

---

### TC-EV-006: Event erstellen — EndDate vor StartDate
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/events` mit `startDate: "2025-03-15T22:00:00Z"`, `endDate: "2025-03-15T18:00:00Z"`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"End date cannot be before start date"`

---

### TC-EV-007: Event erstellen — Negative Kosten
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/events` mit `"cost": -10`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"Cost cannot be negative"`

---

### TC-EV-008: Event erstellen — Negative MaxParticipants
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/events` mit `"maxParticipants": -1`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"Max participants cannot be negative"`

---

## 2. Event aktualisieren

### TC-EV-009: Event Details aktualisieren
**Vorbedingung:** Draft-Event existiert  
**Schritte:**
1. `PUT /api/v1/events/{id}` mit geänderten `title`, `description`, `location`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Aktualisierte Daten

---

### TC-EV-010: Event Zeitplan aktualisieren
**Vorbedingung:** Draft-Event existiert  
**Schritte:**
1. `PUT /api/v1/events/{id}` mit neuen `startDate`, `endDate`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Neuer Zeitplan gespeichert

---

### TC-EV-011: Event aktualisieren — EndDate vor StartDate
**Vorbedingung:** Event existiert  
**Schritte:**
1. `PUT /api/v1/events/{id}` mit `endDate` < `startDate`  
**Erwartetes Ergebnis:**
- HTTP 400, `"End date cannot be before start date"`

---

### TC-EV-012: Event aktualisieren — Nicht existierend
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `PUT /api/v1/events/{random-guid}` mit gültigen Daten  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

### TC-EV-013: Registrierungseinstellungen aktualisieren
**Vorbedingung:** Event existiert  
**Schritte:**
1. `PUT /api/v1/events/{id}` mit:
   - `registrationRequired: true`
   - `maxParticipants: 100`
   - `waitlistEnabled: true`
   - `registrationDeadline: "2025-03-14T23:59:00Z"`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Einstellungen gespeichert

---

### TC-EV-014: Event Kosten und Sichtbarkeit aktualisieren
**Vorbedingung:** Event existiert  
**Schritte:**
1. `PUT /api/v1/events/{id}` mit:
   - `cost: 15.00`, `costDescription: "Eintritt"`
   - `visibility: 1` (Public)
   - `category: 9` (Festival)  
**Erwartetes Ergebnis:**
- HTTP 200 OK

---

## 3. Event Status-Übergänge

### TC-EV-015: Draft → Published (Veröffentlichen)
**Vorbedingung:** Draft-Event existiert  
**Schritte:**
1. `POST /api/v1/events/{id}/publish`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Published"`

---

### TC-EV-016: Published → Draft (Zurückziehen)
**Vorbedingung:** Published Event existiert  
**Schritte:**
1. `POST /api/v1/events/{id}/unpublish`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Draft"`

---

### TC-EV-017: Draft → Cancelled (Absagen)
**Vorbedingung:** Draft-Event existiert  
**Schritte:**
1. `POST /api/v1/events/{id}/cancel` mit `{"reason": "Zu wenig Anmeldungen"}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Cancelled"`

---

### TC-EV-018: Published → Cancelled (Absagen)
**Vorbedingung:** Published Event existiert  
**Schritte:**
1. `POST /api/v1/events/{id}/cancel` mit `{"reason": "Wetter"}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Cancelled"`

---

### TC-EV-019: Published → Completed (Abschliessen)
**Vorbedingung:** Published Event existiert  
**Schritte:**
1. ⚠️ **Kein `/complete`-Endpoint vorhanden**
2. `Event.Complete()` existiert nur als Domain-Methode, ist nicht via API erreichbar  
**Erwartetes Ergebnis:**
- Test nicht via API durchführbar — Endpoint muss erst implementiert werden

---

### TC-EV-020: Cancelled → Published (UNGÜLTIG)
**Vorbedingung:** Cancelled Event existiert  
**Schritte:**
1. `POST /api/v1/events/{id}/publish`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"Cannot publish a cancelled event"`

---

### TC-EV-021: Already Published → Publish (UNGÜLTIG)
**Vorbedingung:** Published Event  
**Schritte:**
1. `POST /api/v1/events/{id}/publish`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"Event is already published"`

---

### TC-EV-022: Draft → Unpublish (UNGÜLTIG)
**Vorbedingung:** Draft Event  
**Schritte:**
1. `POST /api/v1/events/{id}/unpublish`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request
- Fehlermeldung: `"Event is not published"`

---

### TC-EV-023: Cancelled → Cancel (UNGÜLTIG)
**Vorbedingung:** Cancelled Event  
**Schritte:**
1. `POST /api/v1/events/{id}/cancel`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict** (InvalidOperationException → Middleware)
- ProblemDetails: `{ title: "Business Rule Violation", detail: "Event is already cancelled" }`

---

### TC-EV-024: Draft → Complete (UNGÜLTIG)
**Vorbedingung:** Draft Event  
**Schritte:**
1. ⚠️ **Kein `/complete`-Endpoint vorhanden** — `Event.Complete()` existiert nur als Domain-Methode
2. Nicht via API testbar  
**Erwartetes Ergebnis:**
- Test nicht durchführbar — Endpoint muss erst implementiert werden

---

### TC-EV-025: Cancelled → Unpublish (UNGÜLTIG)
**Vorbedingung:** Cancelled Event  
**Schritte:**
1. `POST /api/v1/events/{id}/unpublish`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Event is not published"`

---

### TC-EV-026: Status-Übergang — Nicht existierendes Event
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/events/{random-guid}/publish`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

### TC-EV-027: Cancel mit optionalem Grund
**Vorbedingung:** Draft Event existiert  
**Schritte:**
1. `POST /api/v1/events/{id}/cancel` mit `{"reason": ""}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Event abgesagt auch ohne Grund

---

### TC-EV-028: Vollständiger Lifecycle Draft → Published → Completed
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. Event erstellen (Draft)
2. Publizieren (Published)
3. ⚠️ **Abschliessen NICHT möglich** — kein `/complete`-Endpoint vorhanden  
**Erwartetes Ergebnis:**
- Schritte 1–2 erfolgreich
- Schritt 3 nicht via API durchführbar

---

## 4. Event löschen

### TC-EV-029: Event löschen als Admin
**Vorbedingung:** Event existiert, eingeloggt als `admin`  
**Schritte:**
1. `DELETE /api/v1/events/{id}`  
**Erwartetes Ergebnis:**
- HTTP 204 No Content
- Event ist soft-deleted (`IsDeleted = true`)
- Nachfolgendes `GET` → 404

---

### TC-EV-030: Event löschen als Vorstand → Abgelehnt
**Vorbedingung:** Event existiert, eingeloggt als `vorstand`  
**Schritte:**
1. `DELETE /api/v1/events/{id}`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireAdmin)

---

### TC-EV-031: Event löschen — Nicht existierend
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `DELETE /api/v1/events/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

### TC-EV-032: Bereits gelöschtes Event nochmal löschen
**Vorbedingung:** Event bereits soft-deleted  
**Schritte:**
1. `DELETE /api/v1/events/{id}` erneut  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found (Global Query Filter filtert gelöschte Events)

---

## 5. Event-Liste & Filter

### TC-EV-033: Event-Liste — Mitglied sieht nur Published
**Vorbedingung:** Draft + Published Events existieren, eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/events`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Nur Events mit Status "Published" in der Liste
- Draft/Cancelled/Completed Events NICHT sichtbar

---

### TC-EV-034: Event-Liste — Vorstand sieht alle Status
**Vorbedingung:** Events in verschiedenen Status existieren  
**Schritte:**
1. `GET /api/v1/events` als `vorstand`  
**Erwartetes Ergebnis:**
- Alle Events sichtbar (Draft, Published, Cancelled, Completed)

---

### TC-EV-035: Event-Liste — Admin sieht alle Status
**Vorbedingung:** Events in verschiedenen Status existieren  
**Schritte:**
1. `GET /api/v1/events` als `admin`  
**Erwartetes Ergebnis:**
- Alle Events sichtbar

---

### TC-EV-036: Upcoming Events
**Vorbedingung:** Events mit Start in Zukunft und Vergangenheit  
**Schritte:**
1. `GET /api/v1/events/upcoming`  
**Erwartetes Ergebnis:**
- Nur zukünftige Events

---

### TC-EV-037: Event Detail — Mitglied sieht nur Published
**Vorbedingung:** Draft Event existiert, eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/events/{draft-event-id}`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

### TC-EV-038: Event Detail — Vorstand sieht Draft
**Vorbedingung:** Draft Event existiert, eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/events/{draft-event-id}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK

---

### TC-EV-039: Event Detail — Nicht existierend
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/events/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

### TC-EV-040: Event Suche
**Vorbedingung:** Event "Kulturabend" existiert  
**Schritte:**
1. `GET /api/v1/events?search=Kultur`  
**Erwartetes Ergebnis:**
- "Kulturabend" in den Ergebnissen (Suche in Title, Description, Location, OrganizerName)

---

### TC-EV-041: Event Statistiken
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/events/statistics`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Statistik-Daten (Total, nach Status, etc.)

---

### TC-EV-042: Computed Properties prüfen
**Vorbedingung:** Event mit bekannten Start-/Enddaten  
**Schritte:**
1. Event mit `startDate` in Vergangenheit und `endDate` in Zukunft abrufen  
**Erwartetes Ergebnis:**
- `hasStarted: true`
- `hasEnded: false`
- `isFree` korrekt basierend auf `cost`

---

## 6. Öffentliche Events

### TC-EV-043: Öffentliche Event-Liste (kein Auth)
**Vorbedingung:** Public + Published Events existieren  
**Schritte:**
1. `GET /api/v1/events/public` ohne Auth-Header  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Nur Events mit `visibility: Public` UND `status: Published`
- Keine MembersOnly/InviteOnly/Hidden Events

---

### TC-EV-044: Öffentliches Event Detail (kein Auth)
**Vorbedingung:** Public + Published Event existiert  
**Schritte:**
1. `GET /api/v1/events/public/{id}` ohne Auth-Header  
**Erwartetes Ergebnis:**
- HTTP 200 OK

---

### TC-EV-045: Öffentliches Event Detail — Nicht Public
**Vorbedingung:** MembersOnly + Published Event existiert  
**Schritte:**
1. `GET /api/v1/events/public/{id}` ohne Auth-Header  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found (nicht Public)

---

### TC-EV-046: Öffentliches Event Detail — Nicht Published
**Vorbedingung:** Public + Draft Event existiert  
**Schritte:**
1. `GET /api/v1/events/public/{id}` ohne Auth-Header  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found (nicht Published)

---

### TC-EV-047: Öffentliche Liste — Vergangene Events ausgeblendet
**Vorbedingung:** Public + Published Event mit `endDate` in Vergangenheit  
**Schritte:**
1. `GET /api/v1/events/public`  
**Erwartetes Ergebnis:**
- Vergangene Events NICHT in der Liste (Filter: `EndDate >= from`)

---

### TC-EV-048: Öffentliche Events — Alle Sichtbarkeiten testen
**Vorbedingung:** Events mit allen 4 Visibility-Werten (Published)  
**Schritte:**
1. `GET /api/v1/events/public`  
**Erwartetes Ergebnis:**
- Nur `Public` (1) Events sichtbar
- `MembersOnly` (0), `InviteOnly` (2), `Hidden` (3) NICHT sichtbar

---

## 7. Mitglieder-Registrierung

### TC-EV-049: Mitglied registriert sich für Event
**Vorbedingung:** Published Event mit `registrationRequired: true`, eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations` mit:
   ```json
   {
     "name": "Max Muster",
     "email": "member@iabconnect.ch",
     "numberOfGuests": 1
   }
   ```
**Erwartetes Ergebnis:**
- HTTP 201 Created
- `status: "Confirmed"` (Mitglieder werden automatisch bestätigt)
- `confirmedAt` ist gesetzt
- QR-Code-Token generiert (Format: `REG-{...}`, 24 Zeichen)

---

### TC-EV-050: Mitglied-Registrierung — Event nicht Published
**Vorbedingung:** Draft Event existiert  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Event is not published"`

---

### TC-EV-051: Mitglied-Registrierung — Keine Registrierung erforderlich
**Vorbedingung:** Published Event mit `registrationRequired: false`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Event does not require registration"`

---

### TC-EV-052: Mitglied-Registrierung — Deadline abgelaufen
**Vorbedingung:** Published Event mit `registrationDeadline` in Vergangenheit  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Registration deadline has passed"`

---

### TC-EV-053: Mitglied-Registrierung — Doppelte Registrierung
**Vorbedingung:** Member bereits registriert  
**Schritte:**
1. Erneut `POST /api/v1/events/{id}/registrations`  
**Erwartetes Ergebnis:**
- HTTP 409 Conflict, `"You are already registered for this event"`

---

### TC-EV-054: Mitglied-Registrierung — Nach Stornierung erneut registrieren
**Vorbedingung:** Member hat Registrierung storniert  
**Schritte:**
1. Registrierung stornieren
2. Erneut registrieren  
**Erwartetes Ergebnis:**
- HTTP 201 Created
- Neue Registrierung (stornierte wird in ExistsAsync ausgeschlossen)

---

### TC-EV-055: Mitglied-Registrierung — Gäste (NumberOfGuests)
**Vorbedingung:** Published Event mit Registrierung  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations` mit `"numberOfGuests": 5`  
**Erwartetes Ergebnis:**
- HTTP 201 Created
- `numberOfGuests: 5`

---

### TC-EV-056: Mitglied-Registrierung — Gäste < 1
**Vorbedingung:** Published Event  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations` mit `"numberOfGuests": 0`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Number of guests must be at least 1"`

---

### TC-EV-057: Mitglied-Registrierung — Gäste > 20
**Vorbedingung:** Published Event  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations` mit `"numberOfGuests": 21`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Number of guests cannot exceed 20"`

---

### TC-EV-058: Mitglied-Registrierung — Name und E-Mail fehlen
**Vorbedingung:** Published Event  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations` mit `"name": "", "email": ""`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Name and email are required"`

---

## 8. Öffentliche Registrierung

### TC-EV-059: Öffentliche Registrierung — Gast
**Vorbedingung:** Public + Published Event mit Registrierung, kein Auth  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/public` mit:
   ```json
   {
     "name": "Gast Person",
     "email": "gast@example.com",
     "numberOfGuests": 2
   }
   ```
**Erwartetes Ergebnis:**
- HTTP 201 Created
- `status: "Pending"` (Gäste werden NICHT automatisch bestätigt)
- QR-Code-Token generiert

---

### TC-EV-060: Öffentliche Registrierung — Event nicht Public
**Vorbedingung:** MembersOnly + Published Event  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/public`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Event is not public"`

---

### TC-EV-061: Öffentliche Registrierung — Event nicht Published
**Vorbedingung:** Public + Draft Event  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/public`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Event is not published"`

---

### TC-EV-062: Öffentliche Registrierung — Duplikat-E-Mail
**Vorbedingung:** `gast@example.com` bereits registriert  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/public` mit selber E-Mail  
**Erwartetes Ergebnis:**
- HTTP 409 Conflict, `"Email is already registered for this event"`

---

### TC-EV-063: Öffentliche Registrierung — E-Mail Case-Insensitive
**Vorbedingung:** `gast@example.com` registriert  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/public` mit `"email": "GAST@EXAMPLE.COM"`  
**Erwartetes Ergebnis:**
- HTTP 409 Conflict (E-Mail wird lowercase normalisiert)

---

### TC-EV-064: Öffentliche Registrierung — Deadline abgelaufen
**Vorbedingung:** Event mit abgelaufener `registrationDeadline`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/public`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Registration deadline has passed"`

---

### TC-EV-065: Öffentliche Registrierung — Keine Registrierung erforderlich
**Vorbedingung:** Event mit `registrationRequired: false`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/public`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Event does not require registration"`

---

### TC-EV-066: Öffentliche Registrierung — Ungültige E-Mail
**Vorbedingung:** Public + Published Event  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/public` mit `"email": "keine-email"`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Invalid email format"`

---

### TC-EV-067: Öffentliche Registrierung — Name fehlt
**Vorbedingung:** Public + Published Event  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/public` mit `"name": ""`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Participant name is required"`

---

### TC-EV-068: Öffentliche Registrierung — Event nicht gefunden
**Vorbedingung:** Kein Auth  
**Schritte:**
1. `POST /api/v1/events/{random-guid}/registrations/public`  
**Erwartetes Ergebnis:**
- HTTP 404, `"Event not found"`

---

## 9. Kapazität & Warteliste

### TC-EV-069: Event voll — Warteliste aktiviert
**Vorbedingung:** Event mit `maxParticipants: 2`, `waitlistEnabled: true`, 2 bestätigte Registrierungen  
**Schritte:**
1. Neue Registrierung mit `numberOfGuests: 1`  
**Erwartetes Ergebnis:**
- HTTP 201 Created
- `status: "Waitlisted"` (auf Warteliste)
- `isWaitlisted: true`
- `waitlistPosition: 1`

---

### TC-EV-070: Event voll — Warteliste NICHT aktiviert
**Vorbedingung:** Event mit `maxParticipants: 2`, `waitlistEnabled: false`, 2 bestätigte Registrierungen  
**Schritte:**
1. Neue Registrierung  
**Erwartetes Ergebnis:**
- HTTP 400, `"Event is fully booked"`

---

### TC-EV-071: Kapazität mit Gästezahl — Grenzfall
**Vorbedingung:** Event mit `maxParticipants: 10`, 9 bestätigte Teilnehmer  
**Schritte:**
1. Registrierung mit `numberOfGuests: 2`  
**Erwartetes Ergebnis:**
- Warteliste (wenn aktiviert) oder 400 (9 + 2 = 11 > 10)

---

### TC-EV-072: Kapazität mit Gästezahl — Exakt voll
**Vorbedingung:** Event mit `maxParticipants: 10`, 8 bestätigte Teilnehmer  
**Schritte:**
1. Registrierung mit `numberOfGuests: 2`  
**Erwartetes Ergebnis:**
- HTTP 201 Created, `status: "Confirmed"` (8 + 2 = 10 = MaxParticipants)

---

### TC-EV-073: Auto-Promote bei Stornierung
**Vorbedingung:** Event voll, Warteliste mit 1 Person  
**Schritte:**
1. Bestätigte Registrierung stornieren  
**Erwartetes Ergebnis:**
- Person von Warteliste wird automatisch `Confirmed`
- `isWaitlisted: false`

---

### TC-EV-074: Manuelle Wartelisten-Promotion
**Vorbedingung:** Warteliste mit Einträgen  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/promote-from-waitlist`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Nächste Person (nach WaitlistPosition sortiert) wird `Confirmed`
- Verbleibende Wartelisten-Positionen um 1 verringert

---

### TC-EV-075: Wartelisten-Promotion — Leere Warteliste
**Vorbedingung:** Keine Personen auf Warteliste  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/promote-from-waitlist`  
**Erwartetes Ergebnis:**
- HTTP 404 (keine Person zum Promoten)

---

### TC-EV-076: Warteliste — Mehrere Positionen
**Vorbedingung:** Event voll mit 3 Personen auf Warteliste  
**Schritte:**
1. Prüfe `waitlistPosition` der 3 Einträge (1, 2, 3)
2. Position 1 promoten
3. Prüfe Positionen der verbleibenden (1, 2)  
**Erwartetes Ergebnis:**
- Position wird korrekt dekrementiert

---

### TC-EV-077: Warteliste abrufen
**Vorbedingung:** Event mit Wartelisten-Einträgen  
**Schritte:**
1. `GET /api/v1/events/{id}/registrations/waitlist`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Liste sortiert nach `waitlistPosition`

---

### TC-EV-078: Kapazitätsberechnung — Nur Confirmed + CheckedIn zählen
**Vorbedingung:** Event mit `maxParticipants: 3`  
**Schritte:**
1. 3 Registrierungen erstellen (Confirmed)
2. Eine stornieren → Platz frei
3. Neue Registrierung → Confirmed  
**Erwartetes Ergebnis:**
- Stornierte Registrierungen zählen NICHT zur Kapazität
- Neue Registrierung erfolgreich

---

### TC-EV-079: Keine Kapazitätsbegrenzung
**Vorbedingung:** Event ohne `maxParticipants` (null)  
**Schritte:**
1. 100 Registrierungen erstellen  
**Erwartetes Ergebnis:**
- Alle erfolgreich, keine Warteliste

---

### TC-EV-080: Kapazität = 0
**Vorbedingung:** Event mit `maxParticipants: 0`  
**Schritte:**
1. Registrierung versuchen  
**Erwartetes Ergebnis:**
- Sofort auf Warteliste (wenn aktiviert) oder `"Event is fully booked"`

---

## 10. Registrierung stornieren

### TC-EV-081: Eigene Registrierung stornieren
**Vorbedingung:** Mitglied hat Registrierung  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/cancel`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Cancelled"`
- `cancelledByParticipant: true`

---

### TC-EV-082: Admin storniert fremde Registrierung
**Vorbedingung:** Registrierung existiert, eingeloggt als `admin`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/cancel`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `cancelledByParticipant: false`

---

### TC-EV-083: Fremde Registrierung stornieren — Kein Admin
**Vorbedingung:** Registrierung von anderem Mitglied, eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/cancel`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden

---

### TC-EV-084: Bereits stornierte Registrierung erneut stornieren
**Vorbedingung:** Registrierung bereits `Cancelled`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/cancel`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Registration is already cancelled"`

---

### TC-EV-085: Stornierung mit Grund
**Vorbedingung:** Bestätigte Registrierung existiert  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/cancel` mit `{"reason": "Terminkonflikt"}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Grund gespeichert

---

### TC-EV-086: Wartelisten-Eintrag stornieren
**Vorbedingung:** Person auf Warteliste  
**Schritte:**
1. Wartelisten-Registrierung stornieren  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Cancelled"`

---

## 11. Check-In & QR-Code

### TC-EV-087: Check-In per Registrierungs-ID
**Vorbedingung:** Bestätigte Registrierung existiert  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/check-in`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "CheckedIn"`
- `checkedInAt` gesetzt

---

### TC-EV-088: Check-In per QR-Code-Token
**Vorbedingung:** Registrierung mit QR-Token existiert  
**Schritte:**
1. `POST /api/v1/registrations/check-in/{qrCodeToken}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "CheckedIn"`

---

### TC-EV-089: Check-In — Bereits eingecheckt
**Vorbedingung:** Registrierung bereits `CheckedIn`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/check-in`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Participant is already checked in"`

---

### TC-EV-090: Check-In — Stornierte Registrierung
**Vorbedingung:** Registrierung `Cancelled`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/check-in`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Cannot check in a cancelled registration"`

---

### TC-EV-091: Check-In — Wartelisten-Registrierung
**Vorbedingung:** Registrierung `Waitlisted`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/check-in`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Cannot check in a waitlisted registration"`

---

### TC-EV-092: Check-In — Pending Registrierung (Gast)
**Vorbedingung:** Gast-Registrierung mit `status: "Pending"`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/check-in`  
**Erwartetes Ergebnis:**
- HTTP 200 OK (Pending darf eingecheckt werden)
- `status: "CheckedIn"`

---

### TC-EV-093: QR-Code-Token Format
**Vorbedingung:** Registrierung erstellt  
**Schritte:**
1. QR-Code-Token aus Registrierungsdaten extrahieren  
**Erwartetes Ergebnis:**
- Format: `REG-{alphanumerisch}`, exakt 24 Zeichen, Grossbuchstaben

---

### TC-EV-094: Check-In mit ungültigem QR-Code
**Vorbedingung:** —  
**Schritte:**
1. `POST /api/v1/registrations/check-in/INVALID-TOKEN-12345678`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

### TC-EV-095: Gast-Registrierung bestätigen
**Vorbedingung:** Gast-Registrierung mit `status: "Pending"`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/confirm`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Confirmed"`, `confirmedAt` gesetzt

---

### TC-EV-096: Stornierte Registrierung bestätigen (UNGÜLTIG)
**Vorbedingung:** Registrierung `Cancelled`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/confirm`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Cannot confirm a cancelled registration"`

---

## 12. No-Show & Warteliste verwalten

### TC-EV-097: No-Show markieren
**Vorbedingung:** Bestätigte Registrierung (nicht eingecheckt)  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/no-show`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "NoShow"`, `isNoShow: true`

---

### TC-EV-098: No-Show — Stornierte Registrierung
**Vorbedingung:** Registrierung `Cancelled`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/no-show`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Cannot mark a cancelled registration as no-show"`

---

### TC-EV-099: No-Show — Bereits eingecheckt
**Vorbedingung:** Registrierung `CheckedIn`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations/{regId}/no-show`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Cannot mark a checked-in participant as no-show"`

---

### TC-EV-100: Registrierungsliste abrufen
**Vorbedingung:** Event mit Registrierungen  
**Schritte:**
1. `GET /api/v1/events/{id}/registrations`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Paginierte Liste aller Registrierungen

---

### TC-EV-101: Registrierung aktualisieren
**Vorbedingung:** Aktive Registrierung existiert  
**Schritte:**
1. `PUT /api/v1/events/{id}/registrations/{regId}` mit geänderten Daten  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Aktualisierte Daten

---

### TC-EV-102: Stornierte Registrierung aktualisieren (UNGÜLTIG)
**Vorbedingung:** Registrierung `Cancelled`  
**Schritte:**
1. `PUT /api/v1/events/{id}/registrations/{regId}` mit neuen Daten  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Cannot update a cancelled registration"`

---

## 13. Meine Registrierungen

### TC-EV-103: Eigene Registrierungen abrufen
**Vorbedingung:** Mitglied hat sich für mehrere Events registriert  
**Schritte:**
1. `GET /api/v1/my-registrations`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Liste aller eigenen Registrierungen

---

### TC-EV-104: Eigene Registrierungen — Keine vorhanden
**Vorbedingung:** Mitglied hat keine Registrierungen  
**Schritte:**
1. `GET /api/v1/my-registrations`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Leere Liste

---

### TC-EV-105: Eigene Registrierungen — Ohne Auth
**Vorbedingung:** Kein Auth-Token  
**Schritte:**
1. `GET /api/v1/my-registrations` ohne Authorization-Header  
**Erwartetes Ergebnis:**
- HTTP 401 Unauthorized

---

## 14. Statistiken

### TC-EV-106: Registrierungs-Statistiken
**Vorbedingung:** Event mit verschiedenen Registrierungsstatus  
**Schritte:**
1. `GET /api/v1/events/{id}/registrations/statistics`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Anzahl pro Status (Confirmed, Pending, Cancelled, Waitlisted, CheckedIn, NoShow)

---

### TC-EV-107: Event-Statistiken — Gesamt
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/events/statistics`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Gesamtstatistiken über alle Events

---

### TC-EV-108: Statistiken — Member hat keinen Zugriff
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/events/statistics`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireVorstand)

---

## 15. Autorisierung & Rollen

### TC-EV-109: Unautorisiert — Kein Token
**Vorbedingung:** Kein Auth-Token  
**Schritte:**
1. `GET /api/v1/events` ohne Authorization-Header  
**Erwartetes Ergebnis:**
- HTTP 401 Unauthorized

---

### TC-EV-110: Member kann Events sehen (nur Published)
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/events` → Nur Published Events  
**Erwartetes Ergebnis:**
- HTTP 200 OK, nur Published Events

---

### TC-EV-111: Member kann KEIN Event erstellen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/events` mit gültigen Daten  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireVorstand)

---

### TC-EV-112: Member kann KEIN Event publizieren
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/events/{id}/publish`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden

---

### TC-EV-113: Vorstand kann Events erstellen und publizieren
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/events` → 201
2. `POST /api/v1/events/{id}/publish` → 200  
**Erwartetes Ergebnis:**
- Beide Operationen erfolgreich

---

### TC-EV-114: Vorstand kann NICHT löschen
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `DELETE /api/v1/events/{id}`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireAdmin)

---

### TC-EV-115: Admin hat Vollzugriff
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. Erstellen → 201
2. Publizieren → 200
3. Absagen → 200
4. Löschen → 204  
**Erwartetes Ergebnis:**
- Alle Operationen erfolgreich

---

### TC-EV-116: Member kann sich registrieren
**Vorbedingung:** Published Event, eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/events/{id}/registrations`  
**Erwartetes Ergebnis:**
- HTTP 201 Created

---

### TC-EV-117: Member kann Registrierungsliste NICHT sehen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/events/{id}/registrations`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (admin, vorstand, event-manager erforderlich)

---

### TC-EV-118: Event-Manager kann Registrierungen verwalten
**Vorbedingung:** Eingeloggt als `event-manager`  
**Schritte:**
1. `GET /api/v1/events/{id}/registrations` → 200
2. Check-In durchführen → 200
3. Registrierung bestätigen → 200  
**Erwartetes Ergebnis:**
- Alle Registrierungs-Verwaltungsoperationen erfolgreich

---

### TC-EV-119: Public Endpoints ohne Auth
**Vorbedingung:** Kein Auth-Token  
**Schritte:**
1. `GET /api/v1/events/public` → 200
2. `POST /api/v1/events/{id}/registrations/public` → 201  
**Erwartetes Ergebnis:**
- Beide ohne Auth möglich

---

### TC-EV-120: Registrierung Event nicht gefunden
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/events/{random-guid}/registrations`  
**Erwartetes Ergebnis:**
- HTTP 404, `"Event not found"`
