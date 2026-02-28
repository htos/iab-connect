# Testfälle — Modul Kommunikation (E-Mail-Kampagnen & Templates)

> **Version:** 1.1 (verifiziert gegen Code)  
> **Erstellt:** 2025-01-XX  
> **Modul:** Kommunikation / E-Mail-Marketing  
> **Endpoints:** `/api/v1/email-campaigns`, `/api/v1/email-templates`  
> **Testumgebung:** http://localhost:5000 (API), http://localhost:3000 (Frontend)  
> **E-Mail-Test:** MailHog auf http://localhost:8025 (SMTP localhost:1025)
>
> **⚠️ Verifizierungs-Hinweise:**
> - `InvalidOperationException` → HTTP **409 Conflict** (nicht 400)
> - `ArgumentException` → HTTP **400** mit Parameter-Suffix
> - `MarkAsFailed()` wird nie aufgerufen — Kampagne kann Status `Failed` NIE erreichen
> - `Update()` prüft nur auf `null`, nicht `""` — leere Strings werden akzeptiert (Bug)

---

## Übersicht

| # | Bereich | Anzahl Testfälle |
|---|---------|-----------------|
| 1 | [Kampagne erstellen](#1-kampagne-erstellen) | 7 |
| 2 | [Kampagne aktualisieren](#2-kampagne-aktualisieren) | 5 |
| 3 | [Kampagne löschen](#3-kampagne-löschen) | 4 |
| 4 | [Kampagne senden](#4-kampagne-senden) | 7 |
| 5 | [Kampagne planen (Schedule)](#5-kampagne-planen) | 5 |
| 6 | [Kampagne abbrechen](#6-kampagne-abbrechen) | 5 |
| 7 | [Kampagne erneut senden](#7-kampagne-erneut-senden) | 6 |
| 8 | [Test-E-Mail](#8-test-e-mail) | 4 |
| 9 | [Empfänger & Segmente](#9-empfänger-segmente) | 6 |
| 10 | [Statistiken](#10-statistiken) | 3 |
| 11 | [E-Mail-Templates](#11-e-mail-templates) | 12 |
| 12 | [Personalisierung & Platzhalter](#12-personalisierung-platzhalter) | 5 |
| 13 | [Autorisierung & Rollen](#13-autorisierung-rollen) | 8 |
| 14 | [Status-Übergänge (State Machine)](#14-status-übergänge) | 10 |
| **Total** | | **87** |

---

## Testbenutzer

| Rolle | E-Mail | Passwort | Relevante Rechte |
|-------|--------|----------|-----------------|
| Admin | admin@iabconnect.ch | Admin-Dev-2026! | Vollzugriff |
| Vorstand | vorstand@iabconnect.ch | Vorstand-Dev-2026! | Kampagnen erstellen/senden (RequireVorstand) |
| Member | member@iabconnect.ch | Member-Dev-2026! | Nur Templates lesen (RequireAuthorization) |
| Kassier | kassier@iabconnect.ch | Kassier-Dev-2026! | Keine Kampagnen-Rechte |

---

## 1. Kampagne erstellen

### TC-KO-001: Kampagne mit Pflichtfeldern erstellen
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/email-campaigns` mit:
   ```json
   {
     "name": "Newsletter Januar",
     "subject": "Neuigkeiten vom Verein",
     "htmlContent": "<h1>Hallo {{firstName}}</h1><p>News...</p>",
     "fromName": "IAB Connect",
     "fromEmail": "info@iabconnect.ch",
     "segmentType": 0
   }
   ```
**Erwartetes Ergebnis:**
- HTTP 201 Created
- `status: "Draft"`
- `totalRecipients: 0` (noch nicht geladen)

---

### TC-KO-002: Kampagne mit allen optionalen Feldern
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/email-campaigns` inkl. `plainTextContent`, `replyToEmail`, `segmentFilter`, `eventId`  
**Erwartetes Ergebnis:**
- HTTP 201 Created
- Alle Felder korrekt gespeichert

---

### TC-KO-003: Kampagne erstellen — Name leer
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/email-campaigns` mit `"name": ""`  
**Erwartetes Ergebnis:**
- HTTP 400/500 (Domain: `ArgumentException("Campaign name is required")`)

---

### TC-KO-004: Kampagne erstellen — Subject leer
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/email-campaigns` mit `"subject": ""`  
**Erwartetes Ergebnis:**
- HTTP 400/500, `"Subject is required"`

---

### TC-KO-005: Kampagne erstellen — HTML-Content leer
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/email-campaigns` mit `"htmlContent": ""`  
**Erwartetes Ergebnis:**
- HTTP 400/500, `"HTML content is required"`

---

### TC-KO-006: Kampagne erstellen — FromEmail leer
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/email-campaigns` mit `"fromEmail": ""`  
**Erwartetes Ergebnis:**
- HTTP 400/500, `"From email is required"`

---

### TC-KO-007: Kampagne erstellen — Alle 5 Segment-Typen
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. Kampagne mit `segmentType: 0` (AllActiveMembers)
2. Kampagne mit `segmentType: 1` (Custom)
3. Kampagne mit `segmentType: 2` (Manual)
4. Kampagne mit `segmentType: 3` (EventParticipants)
5. Kampagne mit `segmentType: 4` (NewsletterSubscribers)  
**Erwartetes Ergebnis:**
- Alle erstellt (MVP: alle Typen laden gleiche Empfänger — alle aktiven Mitglieder)

---

## 2. Kampagne aktualisieren

### TC-KO-008: Draft-Kampagne aktualisieren
**Vorbedingung:** Draft-Kampagne existiert  
**Schritte:**
1. `PUT /api/v1/email-campaigns/{id}` mit geänderten `name`, `subject`, `htmlContent`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Aktualisierte Daten

---

### TC-KO-009: Nicht-Draft Kampagne aktualisieren (UNGÜLTIG)
**Vorbedingung:** Kampagne im Status `Sent`  
**Schritte:**
1. `PUT /api/v1/email-campaigns/{id}` mit neuen Daten  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Only draft campaigns can be edited"` (InvalidOperationException → ProblemDetails)

---

### TC-KO-010: Kampagne aktualisieren — Nicht existierend
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `PUT /api/v1/email-campaigns/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

### TC-KO-011: Kampagne aktualisieren — FromName leer
**Vorbedingung:** Draft-Kampagne existiert  
**Schritte:**
1. `PUT /api/v1/email-campaigns/{id}` mit `"fromName": ""`  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **200 OK** — `Update()` prüft FromName nur auf `null` (via `??`), NICHT auf `""` (leerer String)
- **Code-Lücke:** `Create()` nutzt `IsNullOrWhiteSpace`, `Update()` nur `?? throw` — inkonsistente Validierung

---

### TC-KO-012: Segment-Typ einer Draft-Kampagne ändern
**Vorbedingung:** Draft-Kampagne existiert  
**Schritte:**
1. `PUT /api/v1/email-campaigns/{id}` mit neuem `segmentType`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Segment aktualisiert

---

## 3. Kampagne löschen

### TC-KO-013: Draft-Kampagne löschen
**Vorbedingung:** Draft-Kampagne existiert  
**Schritte:**
1. `DELETE /api/v1/email-campaigns/{id}`  
**Erwartetes Ergebnis:**
- HTTP 204 No Content (oder 200 OK)
- Kampagne gelöscht

---

### TC-KO-014: Nicht-Draft Kampagne löschen (UNGÜLTIG)
**Vorbedingung:** Kampagne im Status `Sent`  
**Schritte:**
1. `DELETE /api/v1/email-campaigns/{id}`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Only draft campaigns can be deleted"`

---

### TC-KO-015: Kampagne löschen — Nicht existierend
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `DELETE /api/v1/email-campaigns/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404 Not Found

---

### TC-KO-016: Geplante Kampagne löschen (UNGÜLTIG)
**Vorbedingung:** Kampagne im Status `Scheduled`  
**Schritte:**
1. `DELETE /api/v1/email-campaigns/{id}`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Only draft campaigns can be deleted"`

---

## 4. Kampagne senden

### TC-KO-017: Kampagne sofort senden
**Vorbedingung:** Draft-Kampagne existiert, aktive Mitglieder mit E-Mail vorhanden  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/send`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Response: `{ message: "Campaign sending started", recipientCount: X, jobId: "..." }`
- Hangfire-Job erstellt
- Empfänger werden geladen und E-Mails gesendet
- In MailHog prüfen: E-Mails angekommen

---

### TC-KO-018: Kampagne senden — Keine Empfänger
**Vorbedingung:** Keine aktiven Mitglieder mit E-Mail  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/send`  
**Erwartetes Ergebnis:**
- `recipientCount: 0`
- Keine E-Mails gesendet

---

### TC-KO-019: Kampagne senden — Nicht-Draft (UNGÜLTIG)
**Vorbedingung:** Kampagne bereits `Sent`  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/send`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict** (AddRecipient erfordert Draft-Status)
- Fehlermeldung: `"Recipients can only be added to draft campaigns"`

---

### TC-KO-020: Kampagne senden — Nicht existierend
**Schritte:**
1. `POST /api/v1/email-campaigns/{random-guid}/send`  
**Erwartetes Ergebnis:**
- HTTP 404

---

### TC-KO-021: Kampagne senden — E-Mail-Inhalt prüfen
**Vorbedingung:** Kampagne mit Personalisierung gesendet  
**Schritte:**
1. Kampagne senden
2. In MailHog E-Mail öffnen
3. Inhalt prüfen  
**Erwartetes Ergebnis:**
- `{{firstName}}`, `{{lastName}}`, `{{email}}`, `{{fullName}}` korrekt ersetzt
- Betreff korrekt
- Absender korrekt

---

### TC-KO-022: Kampagne senden — Empfänger-Status nachverfolgen
**Vorbedingung:** Kampagne gesendet  
**Schritte:**
1. `GET /api/v1/email-campaigns/{id}/recipients`  
**Erwartetes Ergebnis:**
- Empfänger mit `status: "Sent"` oder progressiv höherem Status
- `sentAt` Timestamp gesetzt

---

### TC-KO-023: Kampagne senden — Fehlerbehandlung (3 Retries)
**Vorbedingung:** SMTP nicht erreichbar  
**Schritte:**
1. SMTP stoppen, Kampagne senden  
**Erwartetes Ergebnis:**
- Hangfire versucht 3 Mal (AutomaticRetry)
- Empfänger markiert als `Failed` mit Fehlermeldung
- Kampagne Status: `Failed` oder `Sent` (teilweise)

---

## 5. Kampagne planen

### TC-KO-024: Kampagne für Zukunft planen
**Vorbedingung:** Draft-Kampagne existiert  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/schedule` mit:
   ```json
   { "scheduledAt": "2025-03-15T10:00:00Z" }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Response enthält `status: "Scheduled"`, `scheduledAt`, `hangfireJobId`
- Empfänger werden sofort geladen

---

### TC-KO-025: Kampagne planen — Vergangenheit (UNGÜLTIG)
**Vorbedingung:** Draft-Kampagne existiert  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/schedule` mit `scheduledAt` in der Vergangenheit  
**Erwartetes Ergebnis:**
- HTTP 400/500, `"Scheduled time must be in the future"`

---

### TC-KO-026: Kampagne planen — Nicht-Draft (UNGÜLTIG)
**Vorbedingung:** Kampagne im Status `Sent`  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/schedule`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Only draft campaigns can be scheduled"` (AddRecipient erfordert Draft)

---

### TC-KO-027: Geplante Kampagne absagen
**Vorbedingung:** Scheduled Kampagne existiert  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/cancel`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Cancelled"`
- Hangfire-Job gecancelt

---

### TC-KO-028: Kampagne planen — Nicht existierend
**Schritte:**
1. `POST /api/v1/email-campaigns/{random-guid}/schedule`  
**Erwartetes Ergebnis:**
- HTTP 404

---

## 6. Kampagne abbrechen

### TC-KO-029: Draft-Kampagne abbrechen
**Vorbedingung:** Draft-Kampagne existiert  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/cancel`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Cancelled"`

---

### TC-KO-030: Scheduled Kampagne abbrechen
**Vorbedingung:** Scheduled Kampagne existiert  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/cancel`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Cancelled"`

---

### TC-KO-031: Sending Kampagne abbrechen
**Vorbedingung:** Kampagne gerade beim Senden  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/cancel`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Cancelled"`

---

### TC-KO-032: Sent Kampagne abbrechen (UNGÜLTIG)
**Vorbedingung:** Kampagne bereits `Sent`  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/cancel`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Cannot cancel campaign in status Sent"`

---

### TC-KO-033: Cancelled Kampagne abbrechen (UNGÜLTIG)
**Vorbedingung:** Kampagne bereits `Cancelled`  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/cancel`  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Cannot cancel campaign in status Cancelled"`

---

## 7. Kampagne erneut senden

### TC-KO-034: Sent-Kampagne erneut senden
**Vorbedingung:** Kampagne im Status `Sent`  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/resend`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Response: `{ message: "Campaign resend started", recipientCount, jobId }`

---

### TC-KO-035: Nicht-Sent Kampagne erneut senden (UNGÜLTIG)
**Vorbedingung:** Kampagne im Status `Draft`  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/resend`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Only sent campaigns can be resent"`

---

### TC-KO-036: Fehlgeschlagene Empfänger erneut senden
**Vorbedingung:** Sent-Kampagne mit fehlgeschlagenen Empfängern  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/resend-failed`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Nur `Failed` und `Bounced` Empfänger werden zurückgesetzt (`ResetToPending`)
- Response: `{ message: "Campaign resend for failed recipients started", recipientCount, jobId }`

---

### TC-KO-037: Fehlgeschlagene erneut senden — Keine fehlgeschlagenen Empfänger
**Vorbedingung:** Sent-Kampagne, alle Empfänger erfolgreich  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/resend-failed`  
**Erwartetes Ergebnis:**
- HTTP 400, `"No failed recipients to resend"`

---

### TC-KO-038: Fehlgeschlagene erneut senden — Nicht Sent (UNGÜLTIG)
**Vorbedingung:** Kampagne im Status `Draft`  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/resend-failed`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Only sent campaigns can be resent"`

---

### TC-KO-039: Erneut senden — Nicht existierend
**Schritte:**
1. `POST /api/v1/email-campaigns/{random-guid}/resend`  
**Erwartetes Ergebnis:**
- HTTP 404

---

## 8. Test-E-Mail

### TC-KO-040: Test-E-Mail senden
**Vorbedingung:** Kampagne existiert  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/test` mit:
   ```json
   { "testEmail": "test@example.com" }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Response: `{ message: "Test email sent to test@example.com" }`
- Betreff in MailHog: `"[TEST] Neuigkeiten vom Verein"` (Prefix `[TEST] `)

---

### TC-KO-041: Test-E-Mail — Subject hat [TEST] Prefix
**Vorbedingung:** Kampagne mit Subject "Newsletter"  
**Schritte:**
1. Test-E-Mail senden
2. In MailHog prüfen  
**Erwartetes Ergebnis:**
- Betreff: `"[TEST] Newsletter"`

---

### TC-KO-042: Test-E-Mail — Kein Hangfire-Job
**Vorbedingung:** Kampagne existiert  
**Schritte:**
1. Test-E-Mail senden
2. Hangfire-Dashboard prüfen  
**Erwartetes Ergebnis:**
- Kein Hangfire-Job erstellt (Test geht direkt über `IEmailSender.SendAsync`)
- Kein Empfänger-Tracking
- Kampagnen-Status unverändert

---

### TC-KO-043: Test-E-Mail — Nicht existierende Kampagne
**Schritte:**
1. `POST /api/v1/email-campaigns/{random-guid}/test`  
**Erwartetes Ergebnis:**
- HTTP 404

---

## 9. Empfänger & Segmente

### TC-KO-044: Empfänger-Liste abrufen
**Vorbedingung:** Kampagne mit Empfängern (nach Send)  
**Schritte:**
1. `GET /api/v1/email-campaigns/{id}/recipients`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Paginierte Liste (Standard: pageSize=50)
- Empfänger mit Status, E-Mail, Name

---

### TC-KO-045: Empfänger-Liste — Nach Status filtern
**Vorbedingung:** Kampagne mit verschiedenen Empfänger-Status  
**Schritte:**
1. `GET /api/v1/email-campaigns/{id}/recipients?status=8` (Failed)  
**Erwartetes Ergebnis:**
- Nur Failed Empfänger

---

### TC-KO-046: Empfänger-Vorschau
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/recipients/preview` mit:
   ```json
   { "segmentType": 0 }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Vorschau der Empfänger basierend auf Segment

---

### TC-KO-047: E-Mail-Normalisierung bei Empfängern
**Vorbedingung:** Mitglied mit E-Mail `Test@Example.COM` existiert  
**Schritte:**
1. Kampagne senden
2. Empfänger-Liste prüfen  
**Erwartetes Ergebnis:**
- E-Mail gespeichert als `test@example.com` (lowercase, trimmed)

---

### TC-KO-048: Empfänger-Status Progressive Tracking
**Vorbedingung:** Kampagne gesendet  
**Schritte:**
1. Empfänger-Status nachverfolgen  
**Erwartetes Ergebnis:**
- Status-Progression: Pending → Sent → Delivered → Opened → Clicked
- Jeder Status setzt Timestamp nur einmal (erste Mal)
- Status geht nur vorwärts (Opened wird nicht rückgesetzt)

---

### TC-KO-049: Alle Empfänger-Status prüfen
**Vorbedingung:** Kampagne gesendet mit verschiedenen Ergebnissen  
**Schritte:**
1. Prüfe ob alle 10 Status existieren: Pending(0), Sent(1), Delivered(2), Opened(3), Clicked(4), Bounced(5), Complained(6), Unsubscribed(7), Failed(8), Skipped(9)  
**Erwartetes Ergebnis:**
- Status-Werte korrekt

---

## 10. Statistiken

### TC-KO-050: Kampagnen-Statistiken
**Vorbedingung:** Gesendete Kampagne  
**Schritte:**
1. `GET /api/v1/email-campaigns/{id}/statistics`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `totalRecipients`, `sentCount`, `deliveredCount`, `openedCount`, `clickedCount`, `bouncedCount`, `failedCount`

---

### TC-KO-051: Statistiken — Nicht existierende Kampagne
**Schritte:**
1. `GET /api/v1/email-campaigns/{random-guid}/statistics`  
**Erwartetes Ergebnis:**
- HTTP 404

---

### TC-KO-052: Kampagnen-Liste mit Suche und Filter
**Vorbedingung:** Mehrere Kampagnen verschiedener Status  
**Schritte:**
1. `GET /api/v1/email-campaigns?search=Newsletter&status=0` (Draft)  
**Erwartetes Ergebnis:**
- Nur Draft-Kampagnen mit "Newsletter" im Namen

---

## 11. E-Mail-Templates

### TC-KO-053: Template erstellen
**Vorbedingung:** Eingeloggt (jeder authentifizierte User)  
**Schritte:**
1. `POST /api/v1/email-templates` mit:
   ```json
   {
     "name": "Willkommen",
     "subject": "Willkommen bei {{organizationName}}",
     "htmlContent": "<h1>Hallo {{firstName}}</h1>",
     "textContent": "Hallo {{firstName}}",
     "category": "onboarding",
     "description": "Willkommens-E-Mail für neue Mitglieder"
   }
   ```
**Erwartetes Ergebnis:**
- HTTP 201 Created
- `version: 1`, `isActive: true`

---

### TC-KO-054: Template erstellen — Name leer
**Schritte:**
1. `POST /api/v1/email-templates` mit `"name": ""`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Name and Subject are required"`

---

### TC-KO-055: Template erstellen — Subject leer
**Schritte:**
1. `POST /api/v1/email-templates` mit `"subject": ""`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Name and Subject are required"`

---

### TC-KO-056: Template erstellen — Duplikat-Name
**Vorbedingung:** Template "Willkommen" existiert  
**Schritte:**
1. `POST /api/v1/email-templates` mit `"name": "Willkommen"`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Template with this name already exists"`

---

### TC-KO-057: Template aktualisieren
**Vorbedingung:** Template existiert mit `version: 1`  
**Schritte:**
1. `PUT /api/v1/email-templates/{id}` mit geänderten Daten  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `version: 2` (Auto-Increment)

---

### TC-KO-058: Template Version Auto-Increment
**Vorbedingung:** Template mit `version: 1`  
**Schritte:**
1. Update → `version: 2`
2. Nochmal Update → `version: 3`  
**Erwartetes Ergebnis:**
- Version inkrementiert bei jedem Update

---

### TC-KO-059: Template löschen
**Vorbedingung:** Template existiert  
**Schritte:**
1. `DELETE /api/v1/email-templates/{id}`  
**Erwartetes Ergebnis:**
- HTTP 204 No Content

---

### TC-KO-060: Template deaktivieren
**Vorbedingung:** Aktives Template  
**Schritte:**
1. `POST /api/v1/email-templates/{id}/deactivate`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `isActive: false`

---

### TC-KO-061: Template Vorschau (Preview)
**Vorbedingung:** Template mit Platzhaltern existiert  
**Schritte:**
1. `POST /api/v1/email-templates/{id}/preview` mit:
   ```json
   { "variables": { "firstName": "Hans", "organizationName": "IAB" } }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `htmlContent` mit ersetzten Platzhaltern
- `subject` mit ersetzten Platzhaltern

---

### TC-KO-062: Template nach Kategorie abrufen
**Vorbedingung:** Templates in verschiedenen Kategorien  
**Schritte:**
1. `GET /api/v1/email-templates/category/onboarding`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Nur Templates der Kategorie "onboarding"

---

### TC-KO-063: Template-Liste abrufen
**Vorbedingung:** Mehrere Templates existieren  
**Schritte:**
1. `GET /api/v1/email-templates`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Liste aller Templates mit `id`, `name`, `subject`, `version`, `isActive`

---

### TC-KO-064: Template mit Variablen-Definition
**Vorbedingung:** Eingeloggt  
**Schritte:**
1. `POST /api/v1/email-templates` mit `variables`:
   ```json
   {
     "variables": [
       { "name": "firstName", "description": "Vorname", "isRequired": true },
       { "name": "eventName", "description": "Event-Name", "defaultValue": "Vereinsevent" }
     ]
   }
   ```
**Erwartetes Ergebnis:**
- Template gespeichert mit Variablen-Definitionen

---

## 12. Personalisierung & Platzhalter

### TC-KO-065: Kampagne mit {{firstName}} Platzhalter
**Vorbedingung:** Kampagne mit `htmlContent: "Hallo {{firstName}}!"`  
**Schritte:**
1. Kampagne senden an Mitglied "Hans Muster"
2. E-Mail in MailHog prüfen  
**Erwartetes Ergebnis:**
- Inhalt: `"Hallo Hans!"`

---

### TC-KO-066: Kampagne mit {{fullName}} Platzhalter
**Vorbedingung:** Kampagne mit `htmlContent: "Lieber {{fullName}}"`  
**Schritte:**
1. Kampagne senden
2. E-Mail prüfen  
**Erwartetes Ergebnis:**
- Inhalt: `"Lieber Hans Muster"`

---

### TC-KO-067: Kampagne mit {{email}} Platzhalter
**Vorbedingung:** Kampagne mit `htmlContent: "Dein Account: {{email}}"`  
**Schritte:**
1. Kampagne senden  
**Erwartetes Ergebnis:**
- Inhalt: `"Dein Account: hans.muster@example.com"`

---

### TC-KO-068: Fehlender Platzhalter → Leer
**Vorbedingung:** Empfänger ohne FirstName (`firstName: null`)  
**Schritte:**
1. Kampagne mit `{{firstName}}` senden  
**Erwartetes Ergebnis:**
- `{{firstName}}` wird durch leeren String ersetzt

---

### TC-KO-069: Unbekannter Platzhalter bleibt stehen
**Vorbedingung:** Kampagne mit `{{unbekannt}}`  
**Schritte:**
1. Kampagne senden  
**Erwartetes Ergebnis:**
- `{{unbekannt}}` bleibt als Text stehen (nur 4 Platzhalter werden ersetzt)

---

## 13. Autorisierung & Rollen

### TC-KO-070: Unautorisiert — Kein Token
**Schritte:**
1. `GET /api/v1/email-campaigns` ohne Auth  
**Erwartetes Ergebnis:**
- HTTP 401 Unauthorized

---

### TC-KO-071: Member kann KEINE Kampagnen erstellen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/email-campaigns`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireVorstand)

---

### TC-KO-072: Kassier kann KEINE Kampagnen erstellen
**Vorbedingung:** Eingeloggt als `kassier`  
**Schritte:**
1. `POST /api/v1/email-campaigns`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden

---

### TC-KO-073: Vorstand hat Kampagnen-Vollzugriff
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. Erstellen → 201
2. Aktualisieren → 200
3. Senden → 200
4. Löschen (Draft) → 204  
**Erwartetes Ergebnis:**
- Alle Operationen erfolgreich

---

### TC-KO-074: Admin hat Kampagnen-Vollzugriff
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. Alle CRUD-Operationen testen  
**Erwartetes Ergebnis:**
- Alle erfolgreich

---

### TC-KO-075: Jeder Authentifizierte kann Templates lesen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/email-templates` → 200
2. `GET /api/v1/email-templates/{id}` → 200  
**Erwartetes Ergebnis:**
- Beide erfolgreich (RequireAuthorization — jeder auth. User)

---

### TC-KO-076: Jeder Authentifizierte kann Templates erstellen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/email-templates` mit gültigen Daten  
**Erwartetes Ergebnis:**
- HTTP 201 Created (RequireAuthorization)

---

### TC-KO-077: Template-Endpoints ohne Auth
**Schritte:**
1. `GET /api/v1/email-templates` ohne Auth  
**Erwartetes Ergebnis:**
- HTTP 401 Unauthorized

---

## 14. Status-Übergänge (State Machine)

### TC-KO-078: Draft → Scheduled (planen)
**Schritte:**
1. Schedule-Endpoint aufrufen  
**Erwartetes Ergebnis:**
- `status: "Scheduled"`

---

### TC-KO-079: Draft → Sending → Sent (senden)
**Schritte:**
1. Send-Endpoint aufrufen
2. Status während Versand: `"Sending"`
3. Nach Versand: `"Sent"`  
**Erwartetes Ergebnis:**
- Statusverlauf korrekt

---

### TC-KO-080: Scheduled → Sending → Sent (geplanter Versand)
**Schritte:**
1. Geplante Kampagne zum geplanten Zeitpunkt prüfen  
**Erwartetes Ergebnis:**
- Hangfire-Job triggert → Sending → Sent

---

### TC-KO-081: Draft → Cancelled
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/cancel`  
**Erwartetes Ergebnis:**
- `status: "Cancelled"`

---

### TC-KO-082: Scheduled → Cancelled
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/cancel`  
**Erwartetes Ergebnis:**
- `status: "Cancelled"`

---

### TC-KO-083: Sent → Sending (Resend)
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/resend`  
**Erwartetes Ergebnis:**
- Status geht vorübergehend auf `"Sending"`, dann `"Sent"`

---

### TC-KO-084: ANY → Failed (Fehler)
**Schritte:**
1. Kampagne bei der der Versand fehlschlägt  
**Erwartetes Ergebnis:**
- `status: "Failed"` (MarkAsFailed hat keine Status-Guard)

---

### TC-KO-085: Failed → Cancelled
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/cancel`  
**Erwartetes Ergebnis:**
- `status: "Cancelled"` (Failed kann gecancelt werden)

---

### TC-KO-086: Sent → Cancel (UNGÜLTIG)
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/cancel` (Status = Sent)  
**Erwartetes Ergebnis:**
- HTTP **409 Conflict**, `"Cannot cancel campaign in status Sent"`

---

### TC-KO-087: Cancelled → Resend (UNGÜLTIG)
**Schritte:**
1. `POST /api/v1/email-campaigns/{id}/resend` (Status = Cancelled)  
**Erwartetes Ergebnis:**
- HTTP 400, `"Only sent campaigns can be resent"`
