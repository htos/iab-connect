# Testfälle — Modul Dokumente (Dokumentenverwaltung)

> **Version:** 1.1 (verifiziert gegen Code)  
> **Erstellt:** 2025-01-XX  
> **Modul:** Dokumentenverwaltung (Ordner, Dokumente, Versionen, Tags)  
> **Endpoints:** `/api/v1/document-folders`, `/api/v1/documents`  
> **Testumgebung:** http://localhost:5000 (API), http://localhost:3000 (Frontend)  
> **Storage:** RustFS (S3-kompatibel), Bucket: `iabconnect-documents`
>
> **⚠️ Verifizierungs-Hinweise:**
> - Ordner-/Dokument-Löschung → HTTP **200 OK** (Soft-Delete), NICHT 204
> - `InvalidOperationException` → HTTP **409 Conflict** (nicht 400)
> - Kein Endpoint für Ordner-Verschiebung (parentFolderId) oder Dokument-Verschiebung (folderId)
> - Neue Version: `POST /{id}/upload-version` (nicht PUT)
> - Kategorien: General, Protocol, Contract, Invoice, Regulation, Template, Report, Photo, Presentation, Other
> - Tags-Query: `?tags=...` (plural), nicht `?tag=...`

---

## Übersicht

| # | Bereich | Anzahl Testfälle |
|---|---------|-----------------|
| 1 | [Ordner erstellen](#1-ordner-erstellen) | 6 |
| 2 | [Ordner aktualisieren & löschen](#2-ordner-aktualisieren-löschen) | 8 |
| 3 | [Ordner-Hierarchie](#3-ordner-hierarchie) | 5 |
| 4 | [Dokument hochladen](#4-dokument-hochladen) | 8 |
| 5 | [Dokument aktualisieren](#5-dokument-aktualisieren) | 6 |
| 6 | [Dokument löschen](#6-dokument-löschen) | 4 |
| 7 | [Dokument-Status (State Machine)](#7-dokument-status-state-machine) | 10 |
| 8 | [Versionen](#8-versionen) | 8 |
| 9 | [Tags](#9-tags) | 6 |
| 10 | [Suche & Filter](#10-suche-filter) | 6 |
| 11 | [Ordner-Berechtigungen](#11-ordner-berechtigungen) | 8 |
| 12 | [Autorisierung & Rollen](#12-autorisierung-rollen) | 10 |
| 13 | [Sichtbarkeit & Ablaufdatum](#13-sichtbarkeit-ablaufdatum) | 6 |
| 14 | [Validierung & Grenzwerte](#14-validierung-grenzwerte) | 7 |
| **Total** | | **98** |

---

## Testbenutzer

| Rolle | E-Mail | Passwort | Relevante Rechte |
|-------|--------|----------|-----------------|
| Admin | admin@iabconnect.ch | Admin-Dev-2026! | Vollzugriff, Ordner verwalten |
| Vorstand | vorstand@iabconnect.ch | Vorstand-Dev-2026! | Dokumente hochladen/aktualisieren/Status |
| Member | member@iabconnect.ch | Member-Dev-2026! | Nur Lesen (Published, nicht abgelaufen) |
| Kassier | kassier@iabconnect.ch | Kassier-Dev-2026! | Nur Lesen |

---

## 1. Ordner erstellen

### TC-DO-001: Ordner auf Root-Ebene erstellen
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `POST /api/v1/document-folders` mit:
   ```json
   {
     "name": "Vereinsdokumente",
     "description": "Offizielle Vereinsdokumente"
   }
   ```
**Erwartetes Ergebnis:**
- HTTP 201 Created
- `parentFolderId: null`

---

### TC-DO-002: Unterordner erstellen
**Vorbedingung:** Root-Ordner "Vereinsdokumente" existiert  
**Schritte:**
1. `POST /api/v1/document-folders` mit `parentFolderId: {root-id}`  
**Erwartetes Ergebnis:**
- HTTP 201 Created
- Unterordner dem Root zugeordnet

---

### TC-DO-003: Ordner erstellen — Name leer
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `POST /api/v1/document-folders` mit `"name": ""`  
**Erwartetes Ergebnis:**
- HTTP 400/500, Validierungsfehler

---

### TC-DO-004: Ordner erstellen — Nicht existierender Parent
**Schritte:**
1. `POST /api/v1/document-folders` mit `parentFolderId: {random-guid}`  
**Erwartetes Ergebnis:**
- HTTP **400 Bad Request**, `"Parent folder not found"` (Results.BadRequest, nicht 404)

---

### TC-DO-005: Ordner erstellen — Name max 255 Zeichen
**Schritte:**
1. `POST /api/v1/document-folders` mit Name = 255 Zeichen  
**Erwartetes Ergebnis:**
- HTTP 201 Created

---

### TC-DO-006: Ordner erstellen — Name > 255 Zeichen
**Schritte:**
1. `POST /api/v1/document-folders` mit Name = 256 Zeichen  
**Erwartetes Ergebnis:**
- HTTP 400/500, Validierungsfehler

---

## 2. Ordner aktualisieren & löschen

### TC-DO-007: Ordner aktualisieren
**Vorbedingung:** Ordner existiert  
**Schritte:**
1. `PUT /api/v1/document-folders/{id}` mit neuem `name` und `description`  
**Erwartetes Ergebnis:**
- HTTP 200 OK

---

### TC-DO-008: Ordner aktualisieren — Nicht existierend
**Schritte:**
1. `PUT /api/v1/document-folders/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404, `"Folder not found"`

---

### TC-DO-009: Leeren Ordner löschen
**Vorbedingung:** Leerer Ordner existiert  
**Schritte:**
1. `DELETE /api/v1/document-folders/{id}`  
**Erwartetes Ergebnis:**
- HTTP **200 OK** mit Body `{ message: "Folder deleted" }` (Soft-Delete, nicht 204)
**Vorbedingung:** Ordner ohne Dokumente  
**Schritte:**
1. `DELETE /api/v1/document-folders/{id}`  
**Erwartetes Ergebnis:**
- HTTP 204 No Content

---

### TC-DO-010: Ordner mit Dokumenten löschen (UNGÜLTIG)
**Vorbedingung:** Ordner enthält mind. 1 Dokument  
**Schritte:**
1. `DELETE /api/v1/document-folders/{id}`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Cannot delete folder with documents. Move or delete documents first."`

---

### TC-DO-011: Ordner löschen — Nicht existierend
**Schritte:**
1. `DELETE /api/v1/document-folders/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404

---

### TC-DO-012: Ordner mit Unterordnern löschen
**Vorbedingung:** Ordner A mit Unterordner B  
**Schritte:**
1. `DELETE /api/v1/document-folders/{id_A}`  
**Erwartetes Ergebnis:**
- ⚠️ HTTP **200 OK** — Kein Unterordner-Check vorhanden
- Nur `HasDocumentsAsync` wird geprüft, kein `HasSubFoldersAsync`
- **Code-Lücke:** Unterordner werden zu Waisen (verwaiste parentFolderId)
**Vorbedingung:** Ordner mit leeren Unterordnern  
**Schritte:**
1. `DELETE /api/v1/document-folders/{id}`  
**Erwartetes Ergebnis:**
- HTTP 400 oder 204 (prüfen ob Unterordner auch geprüft werden)

---

### TC-DO-013: Ordner-Beschreibung max 1000 Zeichen
**Schritte:**
1. Ordner erstellen mit Description = 1000 Zeichen  
**Erwartetes Ergebnis:**
- HTTP 201 Created

---

### TC-DO-014: Ordner-Beschreibung > 1000 Zeichen
**Schritte:**
1. Ordner erstellen mit Description = 1001 Zeichen  
**Erwartetes Ergebnis:**
- HTTP 400/500

---

## 3. Ordner-Hierarchie

### TC-DO-015: Ordner als eigenen Parent setzen (UNGÜLTIG)
**Vorbedingung:** Ordner existiert  
**Schritte:**
1. ⚠️ **Kein Endpoint für Ordner-Verschiebung vorhanden**
2. `UpdateFolderRequest` hat KEIN `parentFolderId`-Feld (nur `Name`, `Description`, `SortOrder`)
3. Domain-Methode `Move()` existiert, ist aber nicht via API erreichbar  
**Erwartetes Ergebnis:**
- Test nicht via API durchführbar

---

### TC-DO-016: Mehrstufige Hierarchie erstellen
**Schritte:**
1. Root erstellen → A
2. Unterordner B in A erstellen
3. Unterordner C in B erstellen  
**Erwartetes Ergebnis:**
- 3-stufige Hierarchie korrekt

---

### TC-DO-017: Ordner-Baum auflisten
**Schritte:**
1. `GET /api/v1/document-folders`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Hierarchische Liste aller Ordner

---

### TC-DO-018: Ordner-Details mit Dokumenten-Anzahl
**Schritte:**
1. `GET /api/v1/document-folders/{id}`  
**Erwartetes Ergebnis:**
- ⚠️ Response enthält `DocumentFolderDto(Id, Name, Description, ParentFolderId, SortOrder, Permissions, CreatedAt)`
- **KEINE Dokumenten-Anzahl** und keine Unterordner-Liste in der Antwort

---

### TC-DO-019: Ordner verschieben (Parent ändern)
**Vorbedingung:** Ordner B unter Root A  
**Schritte:**
1. ⚠️ **Kein Endpoint für Ordner-Verschiebung vorhanden** (gleiche Lücke wie TC-DO-015)  
**Erwartetes Ergebnis:**
- Test nicht via API durchführbar

---

## 4. Dokument hochladen

### TC-DO-020: Dokument hochladen (PDF)
**Vorbedingung:** Ordner existiert, eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/documents` als `multipart/form-data`:
   - `file`: PDF-Datei (z.B. 1 MB)
   - `folderId`: {folder-id}
   - `name`: "Jahresbericht 2024"
   - `description`: "Offizieller Jahresbericht"
   - `category`: "Report"
**Erwartetes Ergebnis:**
- HTTP 201 Created
- `status: "Draft"`, `version: 1`
- Datei in S3 → `documents/{docId}/{guid}.pdf`

---

### TC-DO-021: Dokument ohne FolderId (UNGÜLTIG)
**Schritte:**
1. `POST /api/v1/documents` ohne `folderId`  
**Erwartetes Ergebnis:**
- HTTP 400, `"folderId is required"`

---

### TC-DO-022: Dokument ohne Datei (UNGÜLTIG)
**Schritte:**
1. `POST /api/v1/documents` ohne `file`  
**Erwartetes Ergebnis:**
- HTTP 400, `"File is required"`

---

### TC-DO-023: Dokument ohne Name
**Schritte:**
1. `POST /api/v1/documents` mit `"name": ""`  
**Erwartetes Ergebnis:**
- HTTP 400/500, `"Document name is required."`

---

### TC-DO-024: Dokument — Nicht-Multipart Request
**Schritte:**
1. `POST /api/v1/documents` mit `Content-Type: application/json`  
**Erwartetes Ergebnis:**
- HTTP 400, `"Request must be multipart/form-data"`

---

### TC-DO-025: Dokument hochladen — Alle 10 Kategorien
**Schritte:**
1. Dokument für jede Kategorie erstellen:
   - General, Protocol, Contract, Invoice, Regulation, Template, Report, Photo, Presentation, Other  
**Erwartetes Ergebnis:**
- Alle 10 Kategorien akzeptiert

> ⚠️ **Code-Verifizierung v1.1:** Enum-Werte korrigiert: General=0, Protocol=1, Contract=2, Invoice=3, Regulation=4, Template=5, Report=6, Photo=7, Presentation=8, Other=9. Originale Form/Policy/Letter existieren nicht.

---

### TC-DO-026: Dokument hochladen — Nicht existierender Ordner
**Schritte:**
1. `POST /api/v1/documents` mit `folderId: {random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 400 Bad Request, `"Folder not found"`

> ⚠️ **Code-Verifizierung v1.1:** Endpoint verwendet `Results.BadRequest()` → HTTP 400 (nicht 404).

---

### TC-DO-027: Dokument-Name max 500 Zeichen
**Schritte:**
1. Dokument hochladen mit Name = 500 Zeichen → 201
2. Dokument hochladen mit Name = 501 Zeichen → 500

> ⚠️ **Code-Verifizierung v1.1:** Keine Domain-Validierung für Name-Länge. MaxLength(500) nur in EF-Konfiguration → bei Überschreitung DB-Exception → HTTP 500. **Code-Lücke.**

---

## 5. Dokument aktualisieren

### TC-DO-028: Dokument-Metadaten aktualisieren
**Vorbedingung:** Dokument existiert  
**Schritte:**
1. `PUT /api/v1/documents/{id}` als `application/json` mit geändertem `name`, `description`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Metadaten aktualisiert

> ⚠️ **Code-Verifizierung v1.1:** PUT-Endpoint akzeptiert JSON (`UpdateDocumentRequest`), NICHT multipart/form-data. Neue Dateien via separatem `POST /{id}/upload-version`.

---

### TC-DO-029: Dokument — Neue Datei hochladen (Update)
**Vorbedingung:** Dokument mit Version 1 existiert  
**Schritte:**
1. `POST /api/v1/documents/{id}/upload-version` als `multipart/form-data` mit neuer `file`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Neue Version erstellt (auto-increment)

> ⚠️ **Code-Verifizierung v1.1:** Neue Datei-Versionen via separatem `POST /upload-version`-Endpoint, nicht via PUT.

---

### TC-DO-030: Dokument aktualisieren — Ordner wechseln
**Vorbedingung:** Dokument in Ordner A  
**Schritte:**
1. `PUT /api/v1/documents/{id}` mit `folderId: {ordner-B-id}`  
**Erwartetes Ergebnis:**
- ~~HTTP 200 OK~~ **Nicht möglich**

> ⚠️ **Code-Verifizierung v1.1:** `UpdateDocumentRequest` enthält kein `folderId`-Feld. Dokument-Verschiebung zwischen Ordnern ist nicht implementiert. **Fehlender Endpoint.**

---

### TC-DO-031: Dokument aktualisieren — Nicht existierend
**Schritte:**
1. `PUT /api/v1/documents/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404, `"Document not found"`

---

### TC-DO-032: Dokument — Description max 2000 Zeichen
**Schritte:**
1. Update mit Description = 2000 Zeichen → 200
2. Update mit Description = 2001 Zeichen → 500

> ⚠️ **Code-Verifizierung v1.1:** Keine Domain-Validierung für Description-Länge. MaxLength(2000) nur in EF-Konfiguration → bei Überschreitung DB-Exception → HTTP 500. **Code-Lücke.**

---

### TC-DO-033: Dokument herunterladen
**Vorbedingung:** Dokument existiert  
**Schritte:**
1. `GET /api/v1/documents/{id}/download`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Binary Content
- Korrekter Content-Type (z.B. `application/pdf`)

---

## 6. Dokument löschen

### TC-DO-034: Dokument löschen
**Vorbedingung:** Dokument existiert  
**Schritte:**
1. `DELETE /api/v1/documents/{id}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Dokument soft-deleted (`IsDeleted = true`)

> ⚠️ **Code-Verifizierung v1.1:** Endpoint gibt HTTP 200 zurück (nicht 204). Nur Soft-Delete: `IsDeleted = true`, `DeletedAt` gesetzt. S3-Dateien werden NICHT gelöscht.

---

### TC-DO-035: Dokument löschen — Nicht existierend
**Schritte:**
1. `DELETE /api/v1/documents/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404

---

### TC-DO-036: Archiviertes Dokument löschen
**Vorbedingung:** Dokument im Status `Archived`  
**Schritte:**
1. `DELETE /api/v1/documents/{id}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK (Löschen immer möglich, Soft-Delete)

> ⚠️ **Code-Verifizierung v1.1:** HTTP 200 (nicht 204). Soft-Delete.

---

### TC-DO-037: Published Dokument löschen
**Vorbedingung:** Dokument im Status `Published`  
**Schritte:**
1. `DELETE /api/v1/documents/{id}`  
**Erwartetes Ergebnis:**
- HTTP 200 OK (kein Status-Schutz, Soft-Delete)

> ⚠️ **Code-Verifizierung v1.1:** Kein Schutz für Published-Status. Löschen ist immer möglich.

---

## 7. Dokument-Status (State Machine)

### TC-DO-038: Draft → Reviewed (Review)
**Vorbedingung:** Dokument im Status `Draft`  
**Schritte:**
1. `POST /api/v1/documents/{id}/review`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Reviewed"`

---

### TC-DO-039: Reviewed → Published (Publish)
**Vorbedingung:** Dokument im Status `Reviewed`  
**Schritte:**
1. `POST /api/v1/documents/{id}/publish`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Published"`

---

### TC-DO-040: Draft → Published (Publish, direkt)
**Vorbedingung:** Dokument im Status `Draft`  
**Schritte:**
1. `POST /api/v1/documents/{id}/publish`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Published"` (Publish erlaubt von Draft und Reviewed)

---

### TC-DO-041: Published → Archived (Archive)
**Vorbedingung:** Dokument im Status `Published`  
**Schritte:**
1. `POST /api/v1/documents/{id}/archive`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- `status: "Archived"`

---

### TC-DO-042: Draft → Archived (Archive)
**Schritte:**
1. `POST /api/v1/documents/{id}/archive` (Status: Draft)  
**Erwartetes Ergebnis:**
- HTTP 200 OK (Archive ist von jedem Status möglich, idempotent)

---

### TC-DO-043: Archived → Archived (Archive, idempotent)
**Vorbedingung:** Dokument bereits `Archived`  
**Schritte:**
1. `POST /api/v1/documents/{id}/archive`  
**Erwartetes Ergebnis:**
- HTTP 200 OK (idempotent, kein Fehler)

---

### TC-DO-044: Review von Published (UNGÜLTIG)
**Vorbedingung:** Dokument im Status `Published`  
**Schritte:**
1. `POST /api/v1/documents/{id}/review`  
**Erwartetes Ergebnis:**
- HTTP 409 Conflict, `"Cannot review: document is in 'Published' status."`

> ⚠️ **Code-Verifizierung v1.1:** `InvalidOperationException` → HTTP 409 via ExceptionHandlingMiddleware.

---

### TC-DO-045: Review von Archived (UNGÜLTIG)
**Vorbedingung:** Dokument im Status `Archived`  
**Schritte:**
1. `POST /api/v1/documents/{id}/review`  
**Erwartetes Ergebnis:**
- HTTP 409 Conflict, `"Cannot review: document is in 'Archived' status."`

> ⚠️ **Code-Verifizierung v1.1:** `InvalidOperationException` → HTTP 409 via ExceptionHandlingMiddleware.

---

### TC-DO-046: Publish von Archived (UNGÜLTIG)
**Vorbedingung:** Dokument im Status `Archived`  
**Schritte:**
1. `POST /api/v1/documents/{id}/publish`  
**Erwartetes Ergebnis:**
- HTTP 409 Conflict, `"Cannot publish: document is in 'Archived' status."`

> ⚠️ **Code-Verifizierung v1.1:** `InvalidOperationException` → HTTP 409 via ExceptionHandlingMiddleware.

---

### TC-DO-047: Review von Reviewed (UNGÜLTIG)
**Vorbedingung:** Dokument im Status `Reviewed`  
**Schritte:**
1. `POST /api/v1/documents/{id}/review`  
**Erwartetes Ergebnis:**
- HTTP 409 Conflict, `"Cannot review: document is in 'Reviewed' status."`

> ⚠️ **Code-Verifizierung v1.1:** `InvalidOperationException` → HTTP 409 via ExceptionHandlingMiddleware.

---

## 8. Versionen

### TC-DO-048: Neue Version beim Upload
**Vorbedingung:** Dokument mit Version 1  
**Schritte:**
1. `POST /api/v1/documents/{id}/upload-version` mit neuer Datei  
**Erwartetes Ergebnis:**
- Version 2 erstellt (max(version)+1)

> ⚠️ **Code-Verifizierung v1.1:** Neue Versionen via separatem `POST /upload-version`-Endpoint, nicht via PUT.

---

### TC-DO-049: Version History abrufen
**Vorbedingung:** Dokument mit mehreren Versionen  
**Schritte:**
1. `GET /api/v1/documents/{id}/versions`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Liste aller Versionen mit Versionsnummer, Dateigrösse, Datum

---

### TC-DO-050: Spezifische Version herunterladen
**Vorbedingung:** Dokument mit Version 1 und 2  
**Schritte:**
1. `GET /api/v1/documents/{id}/versions/{versionNumber}/download`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Datei der spezifischen Version

---

### TC-DO-051: Alte Version wiederherstellen
**Vorbedingung:** Dokument mit Version 1 und 2  
**Schritte:**
1. `POST /api/v1/documents/{id}/versions/1/restore`  
**Erwartetes Ergebnis:**
- HTTP 200 OK
- Neue Version 3 erstellt (Kopie von Version 1)
- Kommentar: `"Restored from version 1"`

---

### TC-DO-052: Nicht existierende Version wiederherstellen
**Schritte:**
1. `POST /api/v1/documents/{id}/versions/99/restore`  
**Erwartetes Ergebnis:**
- HTTP 404, `"Version 99 not found"` (oder ähnlich)

---

### TC-DO-053: Version Auto-Increment Reihenfolge
**Schritte:**
1. Upload → Version 1
2. Update → Version 2
3. Update → Version 3
4. Restore Version 1 → Version 4  
**Erwartetes Ergebnis:**
- Versionen: 1, 2, 3, 4 (lückenlos aufsteigend)

---

### TC-DO-054: Version Unique Constraint
**Vorbedingung:** Dokument mit Version 1  
**Schritte:**
1. Datenbank-Check: (DocumentId, VersionNumber) ist unique  
**Erwartetes Ergebnis:**
- Keine doppelten Versionsnummern pro Dokument

---

### TC-DO-055: Alle Versionen enthalten eigene S3-Datei
**Vorbedingung:** Dokument mit 3 Versionen  
**Schritte:**
1. Jede Version einzeln herunterladen  
**Erwartetes Ergebnis:**
- Jede Version hat eigene S3-Datei und eigenen Inhalt

---

## 9. Tags

### TC-DO-056: Tags zu Dokument hinzufügen
**Vorbedingung:** Dokument existiert  
**Schritte:**
1. Dokument erstellen/aktualisieren mit Tags: `["Finanzen", "Jahresbericht", "2024"]`  
**Erwartetes Ergebnis:**
- Tags gespeichert
- Lowercase-normalisiert: `"finanzen"`, `"jahresbericht"`, `"2024"`

---

### TC-DO-057: Tag Normalisierung (Lowercase)
**Schritte:**
1. Tags setzen: `["IMPORTANT", "Urgent", "low"]`  
**Erwartetes Ergebnis:**
- Gespeichert als: `"important"`, `"urgent"`, `"low"`

---

### TC-DO-058: Duplikat-Tags (Silent Dedup)
**Schritte:**
1. Tags setzen: `["Finance", "finance", "FINANCE"]`  
**Erwartetes Ergebnis:**
- Nur ein Tag: `"finance"` (Duplikate stillschweigend entfernt)

---

### TC-DO-059: Tag max 100 Zeichen
**Schritte:**
1. Tag mit 100 Zeichen → OK
2. Tag mit 101 Zeichen → 500

> ⚠️ **Code-Verifizierung v1.1:** Keine Domain-Validierung für Tag-Länge. MaxLength(100) nur in EF-Konfiguration → bei Überschreitung DB-Exception → HTTP 500. **Code-Lücke.**

---

### TC-DO-060: Unique Constraint (DocumentId, TagName)
**Vorbedingung:** Dokument mit Tag "finanzen"  
**Schritte:**
1. Erneut Tag "finanzen" hinzufügen  
**Erwartetes Ergebnis:**
- Kein Duplikat (Dedup oder Fehler)

---

### TC-DO-061: Tags bei Suche verwenden
**Vorbedingung:** Dokument mit Tag "protokoll" existiert  
**Schritte:**
1. `GET /api/v1/documents?tags=protokoll`  
**Erwartetes Ergebnis:**
- Dokument in Ergebnissen enthalten

> ⚠️ **Code-Verifizierung v1.1:** Query-Parameter heisst `tags` (Plural), nicht `tag`.

---

## 10. Suche & Filter

### TC-DO-062: Dokumente nach Ordner filtern
**Schritte:**
1. `GET /api/v1/documents?folderId={id}`  
**Erwartetes Ergebnis:**
- Nur Dokumente des Ordners

---

### TC-DO-063: Dokumente nach Status filtern
**Schritte:**
1. `GET /api/v1/documents?status=Published`  
**Erwartetes Ergebnis:**
- Nur Published Dokumente

---

### TC-DO-064: Dokumente nach Kategorie filtern
**Schritte:**
1. `GET /api/v1/documents?category=Report`  
**Erwartetes Ergebnis:**
- Nur Report-Dokumente

---

### TC-DO-065: Volltextsuche
**Schritte:**
1. `GET /api/v1/documents?search=Jahresbericht`  
**Erwartetes Ergebnis:**
- Dokumente mit "Jahresbericht" im Namen/Beschreibung

---

### TC-DO-066: Paginierung
**Vorbedingung:** > 20 Dokumente  
**Schritte:**
1. `GET /api/v1/documents?page=1&pageSize=10`
2. `GET /api/v1/documents?page=2&pageSize=10`  
**Erwartetes Ergebnis:**
- Korrekte Paginierung, keine Duplikate

---

### TC-DO-067: PageSize max 100
**Schritte:**
1. `GET /api/v1/documents?pageSize=200`  
**Erwartetes Ergebnis:**
- PageSize wird auf 100 gecappt

---

## 11. Ordner-Berechtigungen

### TC-DO-068: Ordner-Berechtigung setzen
**Vorbedingung:** Ordner existiert, eingeloggt als `admin`  
**Schritte:**
1. Berechtigung für Rolle `Member` mit `Read` setzen  
**Erwartetes Ergebnis:**
- Berechtigung gespeichert

---

### TC-DO-069: Ordner-Berechtigung — 3 Access-Rollen
**Schritte:**
1. Prüfe alle DocumentAccessRole-Werte: `Member`, `Vorstand`, `Admin`  
**Erwartetes Ergebnis:**
- Alle 3 Rollen verwendbar

---

### TC-DO-070: Ordner-Berechtigung — 3 Permission-Typen
**Schritte:**
1. Prüfe alle DocumentPermissionType-Werte: `Read`, `Write`, `Manage`  
**Erwartetes Ergebnis:**
- Alle 3 Typen setzbar

---

### TC-DO-071: Berechtigung-Hierarchie (>=)
**Vorbedingung:** Ordner mit `Vorstand = Write`  
**Schritte:**
1. `admin` Zugriff prüfen  
**Erwartetes Ergebnis:**
- Admin hat automatisch mindestens Write (Admin >= Vorstand)

---

### TC-DO-072: Member sieht nur berechtigte Ordner
**Vorbedingung:** Ordner A mit Member=Read, Ordner B ohne Member-Berechtigung  
**Schritte:**
1. Als `member` Ordner auflisten  
**Erwartetes Ergebnis:**
- Nur Ordner A sichtbar (je nach Implementierung)

---

### TC-DO-073: Berechtigung ändern
**Vorbedingung:** Berechtigung existiert  
**Schritte:**
1. Berechtigung von `Read` auf `Write` ändern  
**Erwartetes Ergebnis:**
- Aktualisiert

---

### TC-DO-074: Berechtigung entfernen
**Schritte:**
1. Berechtigung löschen  
**Erwartetes Ergebnis:**
- ~~Zugriff entzogen~~ **Nicht möglich**

> ⚠️ **Code-Verifizierung v1.1:** Kein Endpoint zum Entfernen einzelner Berechtigungen implementiert. **Fehlender Endpoint.**

---

### TC-DO-075: Admin sieht alle Dokumente
**Vorbedingung:** Dokumente in verschiedenen Status und Ordnern  
**Schritte:**
1. Als `admin` alle Dokumente auflisten  
**Erwartetes Ergebnis:**
- Alle Dokumente sichtbar (Draft, Reviewed, Published, Archived)

---

## 12. Autorisierung & Rollen

### TC-DO-076: Unautorisiert — Kein Token
**Schritte:**
1. `GET /api/v1/documents` ohne Auth  
**Erwartetes Ergebnis:**
- HTTP 401 Unauthorized

---

### TC-DO-077: Member kann Dokumente lesen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `GET /api/v1/documents` → 200
2. `GET /api/v1/documents/{id}` → 200  
**Erwartetes Ergebnis:**
- Beide erfolgreich (RequireMember für GET)

---

### TC-DO-078: Member kann NICHT hochladen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/documents`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireVorstand für Upload)

---

### TC-DO-079: Member kann KEINE Ordner erstellen
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/document-folders`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireAdmin für Ordner CUD)

---

### TC-DO-080: Vorstand kann Dokumente hochladen
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. Dokument hochladen → 201
2. Dokument aktualisieren → 200
3. Status ändern → 200  
**Erwartetes Ergebnis:**
- Alle erfolgreich

---

### TC-DO-081: Vorstand kann KEINE Ordner erstellen
**Vorbedingung:** Eingeloggt als `vorstand`  
**Schritte:**
1. `POST /api/v1/document-folders`  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden (RequireAdmin)

---

### TC-DO-082: Admin hat Ordner-Vollzugriff
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. Ordner erstellen → 201
2. Ordner aktualisieren → 200
3. Ordner löschen → 204  
**Erwartetes Ergebnis:**
- Alle erfolgreich

---

### TC-DO-083: Kassier kann Dokumente lesen aber nicht erstellen
**Vorbedingung:** Eingeloggt als `kassier`  
**Schritte:**
1. `GET /api/v1/documents` → 403
2. `POST /api/v1/documents` → 403  
**Erwartetes Ergebnis:**
- Beide Zugriffe verboten (403 Forbidden)

> ⚠️ **Code-Verifizierung v1.1:** Kassier ist NICHT in der `RequireMember`-Policy enthalten. Daher erhält Kassier auch bei GET 403. Kassier hat keinen Zugriff auf Dokument-Endpoints.

---

### TC-DO-084: Dokument-Status nur mit RequireVorstand änderbar
**Vorbedingung:** Eingeloggt als `member`  
**Schritte:**
1. `POST /api/v1/documents/{id}/publish` → 403  
**Erwartetes Ergebnis:**
- HTTP 403 Forbidden

---

### TC-DO-085: Admin kann Dokument-Status ändern
**Vorbedingung:** Eingeloggt als `admin`  
**Schritte:**
1. `POST /api/v1/documents/{id}/publish` → 200  
**Erwartetes Ergebnis:**
- Erfolgreich

---

## 13. Sichtbarkeit & Ablaufdatum

### TC-DO-086: Member sieht nur Published Dokumente
**Vorbedingung:** Dokumente in Status Draft, Reviewed, Published, Archived  
**Schritte:**
1. Als `member` Dokumente auflisten  
**Erwartetes Ergebnis:**
- Nur `Published` und nicht abgelaufene Dokumente sichtbar

---

### TC-DO-087: Admin/Vorstand sieht alle Status
**Vorbedingung:** Dokumente in allen 4 Status  
**Schritte:**
1. Als `admin` oder `vorstand` auflisten  
**Erwartetes Ergebnis:**
- Alle Dokumente sichtbar (Draft, Reviewed, Published, Archived)

---

### TC-DO-088: Ablaufdatum setzen
**Schritte:**
1. Dokument erstellen (ohne `expiresAt`)
2. `PUT /api/v1/documents/{id}` mit `expiresAt: "2025-06-01T00:00:00Z"`  
**Erwartetes Ergebnis:**
- Ablaufdatum korrekt gespeichert

> ⚠️ **Code-Verifizierung v1.1:** `expiresAt` kann nur via PUT-Update gesetzt werden. `CreateDocumentRequest` (multipart/form-data Upload) hat kein `expiresAt`-Feld.

---

### TC-DO-089: Abgelaufenes Dokument für Member unsichtbar
**Vorbedingung:** Published Dokument mit `expiresAt` in Vergangenheit  
**Schritte:**
1. Als `member` Dokument suchen  
**Erwartetes Ergebnis:**
- Dokument NICHT in der Liste (Member sieht nur Published + nicht abgelaufen)

---

### TC-DO-090: Abgelaufenes Dokument für Admin sichtbar
**Vorbedingung:** Published Dokument mit `expiresAt` in Vergangenheit  
**Schritte:**
1. Als `admin` Dokument suchen  
**Erwartetes Ergebnis:**
- Dokument sichtbar

---

### TC-DO-091: Dokument ohne Ablaufdatum = unbegrenzt
**Schritte:**
1. Dokument ohne `expiresAt` erstellen  
**Erwartetes Ergebnis:**
- Dokument hat kein Ablaufdatum → immer sichtbar (wenn Published)

---

## 14. Validierung & Grenzwerte

### TC-DO-092: FileSize muss positiv sein
**Schritte:**
1. Datei mit 0 Bytes hochladen  
**Erwartetes Ergebnis:**
- HTTP 400, `"File is required."`

> ⚠️ **Code-Verifizierung v1.1:** Fehlermeldung ist `"File is required."` (nicht `"File size must be positive."`).

---

### TC-DO-093: Sehr grosse Datei hochladen
**Schritte:**
1. Datei mit 50 MB hochladen  
**Erwartetes Ergebnis:**
- Erfolgreich oder Server-Limit-Fehler (je nach Konfiguration)

---

### TC-DO-094: Dokument-Name mit Sonderzeichen
**Schritte:**
1. Name: `"Protokoll Sitzung #5 — 01/2024 (v2.0).pdf"`  
**Erwartetes Ergebnis:**
- Name korrekt gespeichert

---

### TC-DO-095: S3-Storage Key Format prüfen
**Vorbedingung:** Dokument hochgeladen  
**Schritte:**
1. S3-Bucket prüfen  
**Erwartetes Ergebnis:**
- Key-Pattern: `documents/{documentId}/{guid}{extension}`

---

### TC-DO-096: Verschiedene Dateitypen hochladen
**Schritte:**
1. PDF, DOCX, XLSX, PNG, JPG, ZIP hochladen  
**Erwartetes Ergebnis:**
- Alle Dateitypen akzeptiert (keine Einschränkung in Domain)

---

### TC-DO-097: Concurrent Uploads — Gleicher Ordner
**Schritte:**
1. 5 Dokumente gleichzeitig in gleichen Ordner hochladen  
**Erwartetes Ergebnis:**
- Alle erfolgreich, keine Konflikte

---

### TC-DO-098: Dokument nicht existierend — Detail
**Schritte:**
1. `GET /api/v1/documents/{random-guid}`  
**Erwartetes Ergebnis:**
- HTTP 404, `"Document not found"`
