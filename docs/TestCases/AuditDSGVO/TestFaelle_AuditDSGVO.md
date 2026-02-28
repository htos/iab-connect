# Testfälle — Modul Audit & Datenschutz (DSGVO)

> **Version:** 1.1 — Code-verifiziert  
> **Erstellt:** 2025-01-XX  
> **Modul:** Audit-Logging, Datenschutz (DSGVO), Einwilligung, Löschanträge, Datenexport  
> **Endpoints:** `/api/v1/audit`, `/api/v1/privacy`  
> **Testumgebung:** http://localhost:5000 (API), http://localhost:3000 (Frontend)

### Verifizierungshinweise (v1.1)
> **Geprüft gegen:** `AuditEndpoints.cs`, `PrivacyEndpoints.cs`, `DeletionRequest.cs`, `AuditEnums.cs`, `PrivacyDtos.cs`  
> **Wichtige Abweichungen vom Originalentwurf:**
> - Severity-Enum: `Info`/`Warning`/`Critical` (nicht `Error`)
> - Audit-Suche: Query-Parameter `search` (nicht `searchTerm`)
> - URL-Pfad: `delete-request` (nicht `deletion-request`), kein `/admin/`-Prefix
> - Cancel: `DELETE /delete-request` (nicht POST)
> - Approve/Reject: `PUT /delete-requests/{id}` mit `{ approve: bool, adminNotes?: string }` (ein Endpoint, nicht zwei separate)
> - Confirm: `POST /delete-request/confirm` mit `{ token }` Body (kein `{id}` in URL)
> - `confirmationToken` wird NICHT in der API-Response zurückgegeben
> - `ConsentStatusDto` hat kein `isIrrevocable`-Feld (nur `isRequired`)
> - PUT consents schützt DataProcessing-Widerruf NICHT (nur DELETE tut das) — **Sicherheitslücke**
> - Privacy-Datenexport hat KEIN Audit-Logging (`DataExported` wird nicht geloggt)
> - Audit-Endpoints: `RequireRole("admin")` — Auditor-Rolle erhält 403
> - POST `/audit/login` existiert für Login-Tracking (beliebiger auth. User)

---

## Übersicht

| # | Bereich | Anzahl Testfälle |
|---|---------|-----------------|
| 1 | [Audit-Events abfragen](#1-audit-events-abfragen) | 8 |
| 2 | [Audit CSV-Export](#2-audit-csv-export) | 5 |
| 3 | [Audit Entity/User History](#3-audit-entityuser-history) | 4 |
| 4 | [Audit Kategorien & Event-Types](#4-audit-kategorien-event-types) | 4 |
| 5 | [Einwilligung (Consent)](#5-einwilligung-consent) | 12 |
| 6 | [Datenexport (DSGVO Art. 20)](#6-datenexport-dsgvo-art-20) | 4 |
| 7 | [Löschantrag erstellen](#7-löschantrag-erstellen) | 6 |
| 8 | [Löschantrag bestätigen](#8-löschantrag-bestätigen) | 5 |
| 9 | [Löschantrag Admin-Verarbeitung](#9-löschantrag-admin-verarbeitung) | 8 |
| 10 | [Löschantrag stornieren](#10-löschantrag-stornieren) | 4 |
| 11 | [Autorisierung & Rollen](#11-autorisierung-rollen) | 10 |
| **Total** | | **70** |

---

## Testbenutzer

| Rolle | E-Mail | Passwort | Relevante Rechte |
|-------|--------|----------|-----------------|
| Admin | admin@iabconnect.ch | Admin-Dev-2026! | Audit-Vollzugriff, Löschanträge verarbeiten |
| Auditor | auditor@iabconnect.ch | Auditor-Dev-2026! | Audit lesen & exportieren |
| Member | member@iabconnect.ch | Member-Dev-2026! | Eigene Consent, Export, Löschanträge |
| Vorstand | vorstand@iabconnect.ch | Vorstand-Dev-2026! | Kein direkter Audit-Zugriff |

---

## 1. Audit-Events abfragen

### TC-AD-001: Audit-Events auflisten
**Vorbedingung:** Eingeloggt als `admin`, Audit-Events existieren  
**Schritte:**
1. `GET /api/v1/audit`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Paginierte Liste von Audit-Events
- Felder: `id`, `eventType`, `category`, `severity`, `userId`, `entityType`, `entityId`, `success`, `timestamp`, `details`

---

### TC-AD-002: Audit-Events nach Datum filtern
**Schritte:**
1. `GET /api/v1/audit?fromDate=2025-01-01&toDate=2025-01-31`  
**Erwartetes Ergebnis:**
- Nur Events im Januar 2025

---

### TC-AD-003: Audit-Events nach EventType filtern
**Schritte:**
1. `GET /api/v1/audit?eventType=MemberCreated`  
**Erwartetes Ergebnis:**
- Nur MemberCreated Events

---

### TC-AD-004: Audit-Events nach Category filtern
**Schritte:**
1. `GET /api/v1/audit?category=Finance`  
**Erwartetes Ergebnis:**
- Nur Finance-Kategorie Events

---

### TC-AD-005: Audit-Events nach Severity filtern
**Schritte:**
1. `GET /api/v1/audit?severity=Critical`  
**Erwartetes Ergebnis:**
- Nur Critical-Events (3 Levels: Info, Warning, Critical)

> ⚠️ **Code-Verifizierung v1.1:** Enum-Wert ist `Critical` (nicht `Error`). `AuditSeverity { Info, Warning, Critical }`.

---

### TC-AD-006: Audit-Events Volltextsuche
**Schritte:**
1. `GET /api/v1/audit?search=admin`  
**Erwartetes Ergebnis:**
- Events die "admin" enthalten

> ⚠️ **Code-Verifizierung v1.1:** Query-Parameter heisst `search` (nicht `searchTerm`). Wird intern auf `filter.SearchTerm` gemappt.

---

### TC-AD-007: Audit-Events nach Success filtern
**Schritte:**
1. `GET /api/v1/audit?success=false`  
**Erwartetes Ergebnis:**
- Nur fehlgeschlagene Events

---

### TC-AD-008: Audit-Events Paginierung
**Schritte:**
1. `GET /api/v1/audit?page=1&pageSize=10`
2. `GET /api/v1/audit?page=2&pageSize=10`  
**Erwartetes Ergebnis:**
- Korrekte Paginierung, keine Duplikate

---

## 2. Audit CSV-Export

### TC-AD-009: CSV-Export Standard (letzter Monat)
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/audit/export`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Content-Type: `text/csv`
- Standard: Events des letzten Monats
- Self-Audit: `DataExported` Event wird geloggt

---

### TC-AD-010: CSV-Export mit Datumsbereich
**Schritte:**
1. `GET /api/v1/audit/export?fromDate=2025-01-01&toDate=2025-01-31`  
**Erwartetes Ergebnis:**
- CSV mit Events aus Januar 2025

---

### TC-AD-011: CSV-Export — Max 10.000 Records
**Vorbedingung:** > 10.000 Events existieren  
**Schritte:**
1. `GET /api/v1/audit/export` ohne Datumsfilter  
**Erwartetes Ergebnis:**
- Maximal 10.000 Zeilen exportiert

---

### TC-AD-012: CSV-Export — Self-Audit-Logging
**Schritte:**
1. CSV-Export durchführen
2. Audit-Events erneut abfragen  
**Erwartetes Ergebnis:**
- Neues Event vom Typ `DataExported` wurde geloggt

---

### TC-AD-013: CSV-Export — Leerer Zeitraum
**Schritte:**
1. `GET /api/v1/audit/export?fromDate=3000-01-01&toDate=3000-01-31`  
**Erwartetes Ergebnis:**
- Leere CSV (nur Header) oder HTTP 200 mit leerem Body

---

## 3. Audit Entity/User History

### TC-AD-014: Entity History abrufen
**Vorbedingung:** Änderungen an einem Member durchgeführt  
**Schritte:**
1. `GET /api/v1/audit/entity/{entityType}/{entityId}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Chronologische Liste aller Audit-Events für diese Entity

---

### TC-AD-015: User History abrufen
**Schritte:**
1. `GET /api/v1/audit/user/{userId}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Alle Aktionen des Users

---

### TC-AD-016: Login-Tracking
**Schritte:**
1. `POST /api/v1/audit/login` (beliebiger authentifizierter User)  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Login-Event wird im Audit-Log gespeichert

> ⚠️ **Code-Verifizierung v1.1:** Login-Tracking erfolgt via `POST /audit/login` (nicht GET /logins). Endpoint ist für jeden authentifizierten User zugänglich (`.RequireAuthorization()`).

---

### TC-AD-017: Entity History — Nicht existierende Entity
**Schritte:**
1. `GET /api/v1/audit/entity/Member/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK mit leerer Liste (oder 404)

---

## 4. Audit Kategorien & Event-Types

### TC-AD-018: Kategorien abrufen
**Schritte:**
1. `GET /api/v1/audit/categories`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Liste der 6 Kategorien

---

### TC-AD-019: Event-Types abrufen
**Schritte:**
1. `GET /api/v1/audit/event-types`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Liste der 28+ Event-Types

---

### TC-AD-020: Alle 3 Severity-Levels vorhanden
**Schritte:**
1. Audit-Events mit verschiedenen Severity prüfen  
**Erwartetes Ergebnis:**
- `Info`, `Warning`, `Critical` alle vorhanden

> ⚠️ **Code-Verifizierung v1.1:** Severity ist `Critical` (nicht `Error`).

---

### TC-AD-021: Audit-Logging ist Failure-Safe
**Info:** Alle `LogAsync` Calls sind fire-and-forget mit Exception Swallowing  
**Schritte:**
1. Datenbank-Verbindung für Audit temporär unterbrechen
2. Normale Operation durchführen  
**Erwartetes Ergebnis:**
- Hauptoperation erfolgreich, Audit-Logging schlägt still fehl
- Keine Ausnahme an den Aufrufer

---

## 5. Einwilligung (Consent)

### TC-AD-022: Eigene Einwilligungen abrufen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/privacy/consents`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Liste eigener Consents mit `type`, `isGranted`, `grantedAt`, `revokedAt`

---

### TC-AD-023: Einwilligung erteilen — DataProcessing (Pflicht)
**Vorbedingung:** Keine DataProcessing-Einwilligung  
**Schritte:**
1. `PUT /api/v1/privacy/consents` mit:
   ```json
   { "consents": [{ "type": 0, "isGranted": true }] }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- DataProcessing Consent erstellt mit `isGranted: true`

---

### TC-AD-024: Einwilligung erteilen — Newsletter
**Schritte:**
1. `PUT /api/v1/privacy/consents` mit `{ "type": 1, "isGranted": true }`  
**Erwartetes Ergebnis:**
- Newsletter-Einwilligung erteilt

---

### TC-AD-025: Alle 5 ConsentTypes prüfen
**Schritte:**
1. Einwilligungen für alle Typen erstellen:
   - `0` = DataProcessing (Pflicht)
   - `1` = Newsletter
   - `2` = Marketing
   - `3` = EventNotifications
   - `4` = PhotoUsage  
**Erwartetes Ergebnis:**
- Alle 5 Typen akzeptiert

---

### TC-AD-026: DataProcessing widerrufen (UNGÜLTIG)
**Vorbedingung:** DataProcessing Consent erteilt  
**Schritte:**
1. `PUT /api/v1/privacy/consents` mit `{ "type": 0, "isGranted": false }`  
**Erwartetes Ergebnis:**
- ⚠️ **ACHTUNG:** PUT-Endpoint prüft DataProcessing-Widerruf NICHT!
- Nur `DELETE /api/v1/privacy/consents/0` gibt HTTP 400 zurück mit `"Please submit a deletion request instead."`

> ⚠️ **Code-Verifizierung v1.1 — Sicherheitslücke:** PUT consents erlaubt DataProcessing-Widerruf (kein Guard). Nur DELETE-Endpoint (`RevokeConsent`) blockiert dies. **Code-Bug.**

---

### TC-AD-027: Newsletter-Einwilligung widerrufen
**Vorbedingung:** Newsletter Consent erteilt  
**Schritte:**
1. `PUT /api/v1/privacy/consents` mit `{ "type": 1, "isGranted": false }`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `isGranted: false`, `revokedAt` gesetzt

---

### TC-AD-028: Widerrufene Einwilligung erneut erteilen (Re-Grant)
**Vorbedingung:** Newsletter Consent widerrufen  
**Schritte:**
1. `PUT /api/v1/privacy/consents` mit `{ "type": 1, "isGranted": true }`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Re-Granted mit neuem `grantedAt`, `revokedAt: null`

---

### TC-AD-029: Einwilligung doppelt erteilen (Idempotent)
**Vorbedingung:** Newsletter Consent bereits erteilt  
**Schritte:**
1. `PUT /api/v1/privacy/consents` mit `{ "type": 1, "isGranted": true }`  
**Erwartetes Ergebnis:**
- Keine Änderung (oder Re-Grant ohne Effekt)

---

### TC-AD-030: Einwilligung doppelt widerrufen (Idempotent)
**Vorbedingung:** Newsletter Consent bereits widerrufen  
**Schritte:**
1. `PUT /api/v1/privacy/consents` mit `{ "type": 1, "isGranted": false }`  
**Erwartetes Ergebnis:**
- Idempotent — `Revoke()` ist idempotent

---

### TC-AD-031: Bulk Consent Update
**Schritte:**
1. `PUT /api/v1/privacy/consents` mit:
   ```json
   {
     "consents": [
       { "type": 0, "isGranted": true },
       { "type": 1, "isGranted": true },
       { "type": 2, "isGranted": false },
       { "type": 3, "isGranted": true },
       { "type": 4, "isGranted": false }
     ]
   }
   ```
**Erwartetes Ergebnis:**
- Alle 5 Consents in einem Request verarbeitet
- Neue erstellt, bestehende aktualisiert

---

### TC-AD-032: Consent ohne Grant — Widerrufen
**Vorbedingung:** Kein Consent für Marketing vorhanden  
**Schritte:**
1. `PUT /api/v1/privacy/consents` mit `{ "type": 2, "isGranted": false }`  
**Erwartetes Ergebnis:**
- Kein neuer Consent erstellt (oder erstellt mit revoked)

---

### TC-AD-033: Consent-Typen Eigenschaft prüfen
**Schritte:**
1. Consent-Details prüfen  
**Erwartetes Ergebnis:**
- DataProcessing (`type: 0`): `isRequired: true`
- Alle anderen: `isRequired: false`

> ⚠️ **Code-Verifizierung v1.1:** `ConsentStatusDto` hat KEIN `isIrrevocable`-Feld. Nur `isRequired` existiert. Felder: `type`, `typeName`, `description`, `isRequired`, `isGranted`, `grantedAt`, `revokedAt`.

---

## 6. Datenexport (DSGVO Art. 20)

### TC-AD-034: Datenexport (Eigene Daten)
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/privacy/export`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- JSON-Dokument mit:
  - Member-Profil
  - Alle Consents
  - Letzte 1000 Audit-Events

---

### TC-AD-035: Datenexport — Vollständigkeit
**Schritte:**
1. Export durchführen
2. Profildaten prüfen  
**Erwartetes Ergebnis:**
- Persönliche Daten (Name, E-Mail, Adresse, etc.)
- Consent-History
- Aktivitäts-Log (max 1000)

---

### TC-AD-036: Datenexport — Ohne Consent
**Vorbedingung:** User ohne DataProcessing Consent  
**Schritte:**
1. `GET /api/v1/privacy/export`  
**Erwartetes Ergebnis:**
- HTTP 200 OK (Export sollte immer möglich sein, rechtsgrundlage DSGVO Art. 20)

---

### TC-AD-037: Datenexport — Audit-Logging
**Schritte:**
1. Datenexport durchführen
2. Audit-Events prüfen  
**Erwartetes Ergebnis:**
- ~~`DataExported` Event geloggt~~ **Kein Audit-Logging!**

> ⚠️ **Code-Verifizierung v1.1:** Privacy-Datenexport (`GET /privacy/export`) hat KEIN Audit-Logging. `IAuditService` wird nicht injiziert. **Code-Lücke.** (Nur Audit-CSV-Export loggt `DataExported`.)

---

## 7. Löschantrag erstellen

### TC-AD-038: Löschantrag erstellen
**Vorbedingung:** Eingeloggt als `member`, kein aktiver Löschantrag  
**Schritte:**
1. `POST /api/v1/privacy/delete-request` mit:
   ```json
   { "reason": "Ich möchte meine Daten löschen lassen." }
   ```
**Erwartetes Ergebnis:**
- HTTP 201 Created
- Status: `Pending`
- `confirmationToken` wird intern generiert (Base64URL), aber NICHT in API-Response zurückgegeben

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request` (nicht `deletion-request`). HTTP 201 (nicht 200). Token/tokenExpiresAt NICHT in Response (`DeletionRequestDto` enthält sie nicht). Token muss per E-Mail zugestellt werden (TODO: E-Mail-Versand nicht implementiert).

---

### TC-AD-039: Zweiter Löschantrag (UNGÜLTIG)
**Vorbedingung:** Aktiver Löschantrag (Pending/Confirmed/UnderReview)  
**Schritte:**
1. `POST /api/v1/privacy/delete-request`  
**Erwartetes Ergebnis:**
- HTTP 400, Duplikat nicht erlaubt (nur ein aktiver Antrag pro User)

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request`.

---

### TC-AD-040: Löschantrag nach abgeschlossenem Antrag
**Vorbedingung:** Früherer Antrag mit Status `Completed`  
**Schritte:**
1. `POST /api/v1/privacy/delete-request`  
**Erwartetes Ergebnis:**
- HTTP 201 Created (Completed zählt nicht als "aktiv")

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request`. HTTP 201.

---

### TC-AD-041: Löschantrag nach abgelehntem Antrag
**Vorbedingung:** Früherer Antrag mit Status `Rejected`  
**Schritte:**
1. `POST /api/v1/privacy/delete-request`  
**Erwartetes Ergebnis:**
- HTTP 201 Created (Rejected zählt nicht als "aktiv")

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request`. HTTP 201.

---

### TC-AD-042: Löschantrag nach storniertem Antrag
**Vorbedingung:** Früherer Antrag mit Status `Cancelled`  
**Schritte:**
1. `POST /api/v1/privacy/delete-request`  
**Erwartetes Ergebnis:**
- HTTP 201 Created (Cancelled zählt nicht als "aktiv")

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request`. HTTP 201.

---

### TC-AD-043: Löschantrag — Eigenen Antrag abrufen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/privacy/delete-request`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Eigener aktiver Löschantrag mit Status, Reason

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request` (Singular). Gibt einzelnen aktiven Antrag zurück (nicht Liste). Ohne aktiven Antrag: HTTP 404.

---

## 8. Löschantrag bestätigen

### TC-AD-044: Löschantrag bestätigen (gültiger Token)
**Vorbedingung:** Pending Löschantrag mit gültigem Token  
**Schritte:**
1. `POST /api/v1/privacy/delete-request/confirm` mit:
   ```json
   { "token": "{base64url-token}" }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Status: `Confirmed`

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request/confirm` (kein `{id}` in URL). Token-Lookup via `GetByTokenAsync()`. Token muss manuell bekannt sein (nicht in API-Response).

---

### TC-AD-045: Löschantrag bestätigen — Falscher Token
**Schritte:**
1. `POST /api/v1/privacy/delete-request/confirm` mit falschem Token  
**Erwartetes Ergebnis:**
- HTTP 404, Token nicht gefunden

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request/confirm`. `GetByTokenAsync` gibt null zurück → 404 (nicht 400).

---

### TC-AD-046: Löschantrag bestätigen — Token abgelaufen (> 7 Tage)
**Vorbedingung:** Token erstellt vor > 7 Tagen  
**Schritte:**
1. `POST /api/v1/privacy/delete-request/confirm`  
**Erwartetes Ergebnis:**
- HTTP 400, Token abgelaufen

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request/confirm`.

---

### TC-AD-047: Löschantrag bestätigen — Nicht Pending (UNGÜLTIG)
**Vorbedingung:** Antrag im Status `Confirmed`  
**Schritte:**
1. `POST /api/v1/privacy/delete-request/confirm`  
**Erwartetes Ergebnis:**
- HTTP 400 (Confirm nur von Pending aus möglich)

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request/confirm`.

---

### TC-AD-048: Token Format — Base64URL
**Schritte:**
1. Löschantrag erstellen
2. Token in Datenbank prüfen (nicht in API-Response verfügbar)  
**Erwartetes Ergebnis:**
- Token ist Base64URL-encoded (keine +, /, =)

> ⚠️ **Code-Verifizierung v1.1:** `confirmationToken` wird NICHT in der API-Response zurückgegeben. Token nur per DB-Zugriff oder E-Mail (nicht implementiert) verfügbar.

---

## 9. Löschantrag Admin-Verarbeitung

### TC-AD-049: Admin: Löschanträge auflisten
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/privacy/delete-requests`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Liste aller Löschanträge aller Benutzer

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-requests` (Plural, kein `/admin/`-Prefix). RequireAdmin Policy.

---

### TC-AD-050: Admin: Löschantrag genehmigen
**Vorbedingung:** Löschantrag im Status `Confirmed` oder `UnderReview`  
**Schritte:**
1. `PUT /api/v1/privacy/delete-requests/{id}` mit:
   ```json
   { "approve": true }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Status: `Completed`
- **Aktionen durchgeführt:**
  - Member wird Soft-Deleted
  - Audit-Events werden anonymisiert (`AnonymizeUser("deleted-user")`)
  - Alle Consents werden gelöscht

> ⚠️ **Code-Verifizierung v1.1:** Ein einziger `PUT /delete-requests/{id}`-Endpoint für Approve UND Reject (via `approve: bool`). Kein separater `/approve`-Endpoint.

---

### TC-AD-051: Admin: Genehmigung — Pending Antrag (UNGÜLTIG)
**Vorbedingung:** Löschantrag im Status `Pending`  
**Schritte:**
1. `PUT /api/v1/privacy/delete-requests/{id}` mit `{ "approve": true }`  
**Erwartetes Ergebnis:**
- HTTP 400, nur Confirmed/UnderReview können verarbeitet werden

> ⚠️ **Code-Verifizierung v1.1:** PUT (nicht POST). Gleicher Endpoint wie Genehmigung.

---

### TC-AD-052: Admin: Löschantrag ablehnen
**Vorbedingung:** Löschantrag im Status `Confirmed` oder `UnderReview`  
**Schritte:**
1. `PUT /api/v1/privacy/delete-requests/{id}` mit:
   ```json
   { "approve": false, "adminNotes": "Offene Verbindlichkeiten, bitte zuerst klären." }
   ```
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Status: `Rejected`
- `adminNotes` gespeichert

> ⚠️ **Code-Verifizierung v1.1:** Gleicher `PUT /delete-requests/{id}`-Endpoint mit `approve: false`. Kein separater `/reject`-Endpoint.

---

### TC-AD-053: Admin: Antrag auf "Under Review" setzen
**Vorbedingung:** Bestätigter Löschantrag  
**Schritte:**
1. Status auf `UnderReview` setzen  
**Erwartetes Ergebnis:**
- `UnderReview` ist ein transienter Status, wird intern während der Verarbeitung gesetzt

> ⚠️ **Code-Verifizierung v1.1:** `UnderReview` wird im `ProcessDeletionRequest`-Handler automatisch gesetzt (via `SetUnderReview()`), direkt vor `Complete()`. Kein separater Endpoint zum manuellen Setzen.

---

### TC-AD-054: Anonymisierung nach Genehmigung prüfen
**Vorbedingung:** Löschantrag genehmigt  
**Schritte:**
1. Audit-Events des gelöschten Users prüfen  
**Erwartetes Ergebnis:**
- `userId` in Audit-Events ersetzt durch `"deleted-user"`

---

### TC-AD-055: Consents nach Genehmigung gelöscht
**Vorbedingung:** Löschantrag genehmigt  
**Schritte:**
1. Consents des Users prüfen  
**Erwartetes Ergebnis:**
- Keine Consents mehr vorhanden

---

### TC-AD-056: TODOs bei Löschung — Bekannte Einschränkungen
**Info:** Bekannte TODOs in der Implementierung  
**Schritte:**
1. Nach Genehmigung prüfen:
   - ⚠️ E-Mail-Bestätigung wird NICHT gesendet
   - ⚠️ Keycloak-User wird NICHT gelöscht/deaktiviert  
**Erwartetes Ergebnis:**
- Dokumentierte Einschränkungen bestätigen

---

## 10. Löschantrag stornieren

### TC-AD-057: Löschantrag stornieren (User)
**Vorbedingung:** Eigener Antrag im Status `Pending`  
**Schritte:**
1. `DELETE /api/v1/privacy/delete-request`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Status: `Cancelled`

> ⚠️ **Code-Verifizierung v1.1:** Cancel via `DELETE /delete-request` (nicht POST). Kein `{id}` in URL — storniert den aktiven Antrag des Users.

---

### TC-AD-058: Confirmed Antrag stornieren
**Vorbedingung:** Antrag im Status `Confirmed`  
**Schritte:**
1. `DELETE /api/v1/privacy/delete-request`  
**Erwartetes Ergebnis:**
- HTTP 200 OK (Cancel hat wenig State-Guards)

> ⚠️ **Code-Verifizierung v1.1:** DELETE (nicht POST).

---

### TC-AD-059: Completed Antrag stornieren (UNGÜLTIG)
**Vorbedingung:** Antrag im Status `Completed`  
**Schritte:**
1. `DELETE /api/v1/privacy/delete-request`  
**Erwartetes Ergebnis:**
- HTTP 404 (kein aktiver Antrag vorhanden, Completed gilt als abgeschlossen)

> ⚠️ **Code-Verifizierung v1.1:** DELETE (nicht POST). Kein aktiver Antrag → 404 (nicht 400). Cancel sucht nur aktive Anträge.

---

### TC-AD-060: UnderReview Antrag stornieren
**Vorbedingung:** Antrag im Status `UnderReview`  
**Schritte:**
1. `DELETE /api/v1/privacy/delete-request`  
**Erwartetes Ergebnis:**
- HTTP 200 OK oder 404 (je nachdem ob UnderReview als "aktiv" gilt)

> ⚠️ **Code-Verifizierung v1.1:** DELETE (nicht POST). UnderReview ist transient (nur intern gesetzt), daher in Praxis selten antragbar.

---

## 11. Autorisierung & Rollen

### TC-AD-061: Unautorisiert — Kein Token (Audit)
**Schritte:**
1. `GET /api/v1/audit` ohne Auth  
**Erwartetes Ergebnis:**
- HTTP 401 Unauthorized

---

### TC-AD-062: Nur Admin hat Audit-Zugriff
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/audit` → 200
2. `GET /api/v1/audit/export` → 200  
**Erwartetes Ergebnis:**
- Beide erfolgreich (RequireRole("admin"))

> ⚠️ **Code-Verifizierung v1.1:** Audit-Endpoints verwenden inline `RequireRole("admin")`. Auditor-Rolle erhält 403 auf ALLEN Audit-Endpoints (nur Admin hat Zugriff). **Designentscheidung oder Code-Lücke.**

---

### TC-AD-063: Member hat KEINEN Audit-Zugriff
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/audit` → 403  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden

---

### TC-AD-064: Vorstand hat KEINEN Audit-Zugriff
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `GET /api/v1/audit` → 403  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireRole("admin") — nicht RequireVorstand)

---

### TC-AD-065: Unautorisiert — Kein Token (Privacy)
**Schritte:**
1. `GET /api/v1/privacy/consents` ohne Auth  
**Erwartetes Ergebnis:**
- HTTP 401 Unauthorized

---

### TC-AD-066: Member kann eigene Consents verwalten
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/privacy/consents` → 200
2. `PUT /api/v1/privacy/consents` → 200
3. `GET /api/v1/privacy/export` → 200
4. `POST /api/v1/privacy/delete-request` → 201  
**Erwartetes Ergebnis:**
- Alle erfolgreich (RequireMember)

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request`. POST gibt 201 zurück.

---

### TC-AD-067: Member kann KEINE Admin-Löschung verwalten
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/privacy/delete-requests` → 403
2. `PUT /api/v1/privacy/delete-requests/{id}` mit `{ "approve": true }` → 403  
**Erwartetes Ergebnis:**
- Beide 403 Forbidden (RequireAdmin)

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-requests` (Plural). PUT (nicht POST approve).

---

### TC-AD-068: Admin kann Löschanträge verarbeiten
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `GET /api/v1/privacy/delete-requests` → 200
2. `PUT /api/v1/privacy/delete-requests/{id}` mit `{ "approve": true }` → 200
3. `PUT /api/v1/privacy/delete-requests/{id}` mit `{ "approve": false }` → 200  
**Erwartetes Ergebnis:**
- Alle erfolgreich

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-requests`. Ein PUT-Endpoint für Approve und Reject.

---

### TC-AD-069: Kassier hat KEINEN Privacy-Admin-Zugriff
**Vorbedingung:** Eingeloggt als `kassier`  
**Schritte:**
1. `GET /api/v1/privacy/delete-requests` → 403  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-requests` (kein `/admin/`-Prefix).

---

### TC-AD-070: Löschantrag — Nur eigener Antrag sichtbar
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/privacy/delete-request`  
**Erwartetes Ergebnis:**
- Nur eigener aktiver Antrag, nicht die anderer Benutzer

> ⚠️ **Code-Verifizierung v1.1:** URL ist `delete-request` (Singular). Gibt einzelnen aktiven Antrag des eingeloggten Users zurück.
