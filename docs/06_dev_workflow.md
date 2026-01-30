Titel
Development Workflow

Repo Struktur
frontend
Next.js App

backend
ASP.NET Core WebApi, Application, Domain, Infrastructure

docs
Dokumentation

infra
docker compose, scripts, deployment files

Branching
1) main ist stabil
2) feature branches pro Änderung
3) Merge via Pull Request

PR Regeln
1) Mindestens eine Review
2) Build und Tests müssen grün sein
3) Keine Secrets im Code
4) Kurze Beschreibung und Bezug zu Requirement ID falls vorhanden

Code Style
1) EditorConfig im Repo
2) C# analyzers aktiv
3) Frontend lint und format via ESLint und Prettier

DB Migration Workflow
1) EF Core Migrationen nur über definierte Commands
2) Jede Migration hat sprechenden Namen
3) Migrations laufen in Staging vor Produktion

Lokales Setup Schritte
1) docker compose up für postgres, keycloak, minio
2) Backend starten und DB Migration ausführen
3) Frontend starten mit Environment Variablen für API Base URL
4) Login über Keycloak testen

**WICHTIG: Backend und Frontend müssen in separaten Terminals gestartet werden!**
- Terminal 1: `cd backend/src/IabConnect.Api && dotnet run`
- Terminal 2: `cd frontend && npm run dev`
- Niemals beide in einem Terminal starten, da das Starten des einen den anderen Prozess beendet.

VS Code Setup
1) Launch Configs für Backend und Frontend
2) Tasks für build, test, migrations

---

## Manuelle Tests

### REQ-001: Login & Zugriff (Admin und Mitglieder)

**Voraussetzungen:**
- Docker Compose läuft (PostgreSQL, Keycloak, MinIO)
- Backend auf http://localhost:5000
- Frontend auf http://localhost:3000

**Test-Benutzer (Keycloak):**
| Benutzer | E-Mail | Passwort | Rollen |
|----------|--------|----------|--------|
| Admin | admin@iabconnect.ch | Admin-Dev-2026! | admin, vorstand, member |
| Vorstand | vorstand@iabconnect.ch | Vorstand-Dev-2026! | vorstand, member |
| Mitglied | member@iabconnect.ch | Member-Dev-2026! | member |

**Testschritte:**

1. **Login-Seite öffnen**
   - Öffne http://localhost:3000
   - Klicke auf "Anmelden" Button
   - ✅ Erwartung: Weiterleitung zur Login-Seite

2. **Keycloak-Login**
   - Klicke auf "Mit Keycloak anmelden"
   - ✅ Erwartung: Weiterleitung zu Keycloak
   - Gib Benutzername und Passwort ein
   - ✅ Erwartung: Weiterleitung zurück zur App nach erfolgreichem Login

3. **Admin-Benutzer testen**
   - Login als admin@iabconnect.ch
   - ✅ Erwartung: Dashboard zeigt alle Module (Events, Dokumente, Mitglieder, Kommunikation, Finanzen, Admin)
   - ✅ Erwartung: Admin-Badge wird angezeigt
   - ✅ Erwartung: Alle Rollen werden angezeigt (admin, vorstand, member)

4. **Vorstand-Benutzer testen**
   - Login als vorstand@iabconnect.ch
   - ✅ Erwartung: Dashboard zeigt Module (Events, Dokumente, Mitglieder, Kommunikation, Finanzen)
   - ✅ Erwartung: Admin-Bereich ist NICHT sichtbar
   - ✅ Erwartung: Vorstand-Badge wird angezeigt

5. **Mitglied-Benutzer testen**
   - Login als member@iabconnect.ch
   - ✅ Erwartung: Dashboard zeigt nur Events und Dokumente
   - ✅ Erwartung: Mitglieder, Kommunikation, Finanzen, Admin sind NICHT sichtbar
   - ✅ Erwartung: Mitglied-Badge wird angezeigt

6. **Logout testen**
   - Klicke auf "Abmelden"
   - ✅ Erwartung: Weiterleitung zur Login-Seite
   - ✅ Erwartung: Session ist beendet

7. **API-Schutz testen (Swagger)**
   - Öffne http://localhost:5000/swagger
   - Teste GET /api/v1/identity/me ohne Token
   - ✅ Erwartung: 401 Unauthorized
   - Authentifiziere mit OAuth2 und teste erneut
   - ✅ Erwartung: 200 OK mit Benutzerdaten

8. **Rollenbasierte API-Endpunkte**
   - GET /api/v1/identity/roles → Zeigt Benutzerrollen
   - GET /api/v1/identity/check-admin → Nur für Admin
   - GET /api/v1/identity/check-vorstand → Nur für Vorstand/Admin
   - GET /api/v1/identity/check-member → Für alle Mitglieder

---

### REQ-013 bis REQ-016: Mitgliederverwaltung

**Voraussetzungen:**
- Backend und Frontend laufen
- Login als Admin oder Vorstand

**Testschritte:**

1. **Mitgliederliste öffnen (REQ-016)**
   - Login als admin@iabconnect.ch oder vorstand@iabconnect.ch
   - Navigiere zu /members (über Navigation "Mitglieder")
   - ✅ Erwartung: Leere Liste mit "Keine Mitglieder gefunden" oder vorhandene Mitglieder
   - ✅ Erwartung: Statistik-Karten zeigen Übersicht (Aktiv, Ausstehend, etc.)

2. **Neues Mitglied anlegen (REQ-013, REQ-015)**
   - Klicke auf "Neues Mitglied"
   - Fülle Pflichtfelder aus:
     - Vorname: Max
     - Nachname: Muster
     - E-Mail: max.muster@example.ch
     - Strasse: Teststrasse 1
     - PLZ: 3000
     - Ort: Bern
     - Mitgliedschaftsart: Einzelmitglied
   - Klicke "Mitglied anlegen"
   - ✅ Erwartung: Weiterleitung zur Mitgliederliste
   - ✅ Erwartung: Neues Mitglied erscheint in der Liste mit Status "Ausstehend"

3. **Mitglied suchen & filtern**
   - Gib "Max" in Suchfeld ein und klicke "Suchen"
   - ✅ Erwartung: Nur Mitglieder mit "Max" im Namen/E-Mail
   - Wähle Status-Filter "Ausstehend"
   - ✅ Erwartung: Nur Mitglieder mit Status Pending
   - Wähle Typ-Filter "Einzelmitglied"
   - ✅ Erwartung: Nur Regular-Mitglieder

4. **Mitgliederdetails anzeigen**
   - Klicke auf das Augen-Symbol bei einem Mitglied
   - ✅ Erwartung: Detailseite mit allen Informationen
   - ✅ Erwartung: Profilbild-Initialen, Status-/Typ-Badges
   - ✅ Erwartung: Kontaktdaten, Adresse, Mitgliedschaft-Info

5. **Status ändern (REQ-014)**
   - Auf Detailseite: Ändere Status von "Ausstehend" zu "Aktiv"
   - ✅ Erwartung: Status wird aktualisiert, Badge wechselt zu grün
   - ✅ Erwartung: Statistik-Karten auf Listenansicht aktualisieren sich

6. **Mitgliedschaftsart ändern (REQ-014)**
   - Auf Detailseite: Ändere Typ von "Einzelmitglied" zu "Student"
   - ✅ Erwartung: Typ wird aktualisiert, Badge wechselt Farbe

7. **Mitglied bearbeiten**
   - Klicke auf Bearbeiten-Symbol
   - Ändere Telefonnummer auf +41 79 123 45 67
   - Klicke "Speichern"
   - ✅ Erwartung: Weiterleitung zu Detailseite mit aktualisierten Daten

8. **Mitglied löschen**
   - Auf Detailseite: Klicke "Löschen"
   - Bestätige im Dialog
   - ✅ Erwartung: Weiterleitung zur Mitgliederliste
   - ✅ Erwartung: Mitglied ist nicht mehr in der Liste

9. **Self-Service Profil testen (REQ-016)**
   - Logout und Login als member@iabconnect.ch
   - Navigiere zu /profile (über Navigation "Mein Profil")
   - ✅ Erwartung: Eigenes Profil wird angezeigt (oder Hinweis "Kein Profil gefunden")
   - Falls Profil existiert: Klicke "Bearbeiten"
   - ✅ Erwartung: Name, Telefon, Adresse editierbar
   - ✅ Erwartung: E-Mail NICHT editierbar

10. **API-Endpunkte testen (Swagger)**
    - GET /api/members → Paginierte Mitgliederliste (Vorstand/Admin)
    - GET /api/members/{id} → Einzelnes Mitglied
    - POST /api/members → Neues Mitglied anlegen
    - PUT /api/members/{id} → Mitglied bearbeiten
    - DELETE /api/members/{id} → Mitglied löschen
    - PATCH /api/members/{id}/status → Status ändern
    - PATCH /api/members/{id}/type → Mitgliedschaftsart ändern
    - GET /api/members/statistics → Mitgliederstatistik
    - GET /api/members/me → Eigenes Profil (Member)
    - PUT /api/members/me → Eigenes Profil bearbeiten (Member)

---

### REQ-002: Benutzerverwaltung (Admin)

**Voraussetzungen:**
- Backend und Frontend laufen
- Keycloak Admin Client `iabconnect-admin` konfiguriert (siehe unten)
- Login als Admin

**Keycloak Setup (einmalig):**
1. Öffne Keycloak Admin Console: http://localhost:8080/admin
2. Login als admin / Admin-Dev-2026!
3. Wähle Realm "iabconnect"
4. Gehe zu Clients → Create client
   - Client ID: `iabconnect-admin`
   - Client authentication: ON
   - Service accounts roles: ON
5. Nach Erstellung: Client → Service account roles
   - Assign role → Filter by clients
   - Wähle realm-management: manage-users, view-users, query-users
6. Client → Credentials → Secret kopieren
7. In appsettings.Development.json aktualisieren:
   ```json
   "KeycloakAdmin": {
     "BaseUrl": "http://localhost:8080",
     "Realm": "iabconnect",
     "ClientId": "iabconnect-admin",
     "ClientSecret": "<KOPIERTES_SECRET>"
   }
   ```

**Testschritte:**

1. **Benutzerliste öffnen**
   - Login als admin@iabconnect.ch
   - Navigiere zu /users (über Navigation "Benutzer" im Admin-Bereich)
   - ✅ Erwartung: Liste aller Keycloak-Benutzer
   - ✅ Erwartung: E-Mail, Name, Rollen-Badges, Aktiv-Status
   - ✅ Erwartung: Pagination funktioniert

2. **Benutzer suchen**
   - Gib "admin" in Suchfeld ein
   - Klicke auf Suchen-Icon oder drücke Enter
   - ✅ Erwartung: Nur Benutzer mit "admin" im Namen/E-Mail

3. **Neuen Benutzer anlegen**
   - Klicke auf "Neuer Benutzer"
   - Fülle aus:
     - E-Mail: test.user@example.ch
     - Vorname: Test
     - Nachname: User
     - Aktiviert: ✓
     - Einladung senden: ✓
   - Wähle Rollen: member
   - Klicke "Benutzer erstellen"
   - ✅ Erwartung: Weiterleitung zur Benutzerliste
   - ✅ Erwartung: Neuer Benutzer erscheint in der Liste
   - ✅ Erwartung: (Falls SMTP konfiguriert) Einladungs-E-Mail wird gesendet

4. **Benutzer bearbeiten**
   - Klicke auf Bearbeiten-Icon bei einem Benutzer
   - Ändere den Nachnamen
   - Füge Rolle "vorstand" hinzu
   - Klicke "Speichern"
   - ✅ Erwartung: Änderungen werden in Keycloak gespeichert
   - ✅ Erwartung: Rollen-Badges aktualisieren sich

5. **Benutzer deaktivieren**
   - In der Benutzerliste: Klicke auf Toggle-Switch in "Aktiv"-Spalte
   - ✅ Erwartung: Benutzer wird deaktiviert
   - ✅ Erwartung: Status wechselt auf "Deaktiviert"
   - ✅ Erwartung: Deaktivierter Benutzer kann sich nicht mehr einloggen

6. **Benutzer aktivieren**
   - Klicke erneut auf Toggle-Switch
   - ✅ Erwartung: Benutzer wird wieder aktiviert

7. **Passwort-Reset senden**
   - Klicke auf Schlüssel-Icon bei einem Benutzer
   - Bestätige im Dialog
   - ✅ Erwartung: (Falls SMTP konfiguriert) Passwort-Reset-E-Mail wird gesendet
   - ✅ Erwartung: Erfolgsmeldung wird angezeigt

8. **Benutzer löschen**
   - Klicke auf Papierkorb-Icon bei einem Test-Benutzer
   - Bestätige im Dialog
   - ✅ Erwartung: Benutzer wird aus der Liste entfernt
   - ✅ Erwartung: Benutzer existiert nicht mehr in Keycloak

9. **Rollen-Management**
   - Bearbeite einen Benutzer
   - Ändere Rollen: Entferne alle, füge nur "admin" hinzu
   - ✅ Erwartung: Nur Admin-Rolle wird angezeigt
   - Logout und Login als dieser Benutzer
   - ✅ Erwartung: Benutzer hat nur Admin-Rechte

10. **API-Endpunkte testen (Swagger, nur Admin)**
    - GET /api/v1/users → Paginierte Benutzerliste
    - GET /api/v1/users/{id} → Einzelner Benutzer
    - POST /api/v1/users → Neuen Benutzer anlegen
    - PUT /api/v1/users/{id} → Benutzer bearbeiten
    - DELETE /api/v1/users/{id} → Benutzer löschen
    - PUT /api/v1/users/{id}/enabled → Aktivieren/Deaktivieren
    - POST /api/v1/users/{id}/reset-password → Passwort-Reset
    - GET /api/v1/users/{id}/roles → Rollen des Benutzers
    - PUT /api/v1/users/{id}/roles → Rollen zuweisen
    - GET /api/v1/users/roles → Alle verfügbaren Rollen

---

### REQ-004: Feingranulare Zugriffskontrolle

**Voraussetzungen:**
- Backend und Frontend laufen
- Test-Benutzer vorhanden (admin, vorstand, member)

**Testschritte:**

1. **Admin-Berechtigungen prüfen**
   - Login als admin@iabconnect.ch
   - Navigiere zu /members
   - ✅ Erwartung: Lösch-Button (Papierkorb) ist bei jedem Mitglied sichtbar
   - ✅ Erwartung: Alle CRUD-Operationen möglich

2. **Vorstand-Berechtigungen prüfen**
   - Login als vorstand@iabconnect.ch
   - Navigiere zu /members
   - ✅ Erwartung: Lösch-Button ist NICHT sichtbar (nur Admin darf löschen)
   - ✅ Erwartung: Anlegen, Bearbeiten, Status-Ändern möglich
   - Navigiere zur Mitglieder-Detailseite
   - ✅ Erwartung: Lösch-Button auf Detailseite ist NICHT sichtbar

3. **Member-Berechtigungen prüfen**
   - Login als member@iabconnect.ch
   - ✅ Erwartung: Mitglieder-Menüpunkt ist NICHT sichtbar
   - Versuche direkt /members zu öffnen
   - ✅ Erwartung: Kein Zugriff / Weiterleitung
   - Navigiere zu /profile
   - ✅ Erwartung: Nur eigenes Profil kann bearbeitet werden

4. **Backend-Autorisierung testen (API)**
   - Als Vorstand: Versuche DELETE /api/v1/members/{id}
   - ✅ Erwartung: 403 Forbidden (nur Admin darf löschen)
   - Als Member: Versuche GET /api/v1/members
   - ✅ Erwartung: 403 Forbidden (nur Vorstand/Admin)

---

### REQ-007: Registrierung & Onboarding

**Voraussetzungen:**
- Docker Compose läuft
- Backend und Frontend laufen
- (Optional) SMTP-Server für E-Mail-Versand konfiguriert

**SMTP-Konfiguration für E-Mail-Tests (Mailhog):**
Im Development-Setup ist Mailhog bereits konfiguriert und fängt alle E-Mails ab:
- **SMTP-Server:** mailhog:1025 (intern im Docker-Netzwerk)
- **Web-UI:** http://localhost:8025 (alle gefangenen E-Mails ansehen)

Nach dem Neustart von Docker Compose werden alle E-Mails von Keycloak an Mailhog gesendet.

```bash
# Docker Compose neu starten um Mailhog zu aktivieren
cd infra
docker compose down
docker compose up -d
```

**Testschritte:**

1. **Selbstregistrierung testen**
   - Öffne http://localhost:3000/login
   - Klicke auf "Jetzt registrieren"
   - ✅ Erwartung: Weiterleitung zur Registrierungsseite
   - Fülle aus:
     - Vorname: Neu
     - Nachname: Mitglied
     - E-Mail: neu.mitglied@example.ch
     - Passwort: Test1234!
     - Passwort bestätigen: Test1234!
   - Klicke "Registrieren"
   - ✅ Erwartung: Erfolgsmeldung "Registrierung erfolgreich"
   - ✅ Erwartung: Hinweis auf Admin-Freischaltung

2. **Registrierter Benutzer kann sich NICHT einloggen**
   - Versuche Login mit neu.mitglied@example.ch
   - ✅ Erwartung: Fehlermeldung "Konto nicht freigeschaltet"
   - ✅ Erwartung: In Keycloak ist User disabled

3. **Admin aktiviert den Benutzer**
   - Login als admin@iabconnect.ch
   - Navigiere zu /users
   - Finde den neuen Benutzer
   - ✅ Erwartung: Benutzer ist deaktiviert (Toggle aus)
   - Aktiviere den Toggle
   - ✅ Erwartung: Benutzer wird aktiviert
   - ✅ Erwartung: Member-Eintrag wird automatisch erstellt

4. **Aktivierter Benutzer kann sich einloggen**
   - Logout als Admin
   - Login als neu.mitglied@example.ch
   - ✅ Erwartung: Login erfolgreich
   - ✅ Erwartung: Dashboard wird angezeigt

5. **Onboarding-Banner testen**
   - Nach Login als neu.mitglied@example.ch
   - ✅ Erwartung: Onboarding-Banner auf Dashboard
   - ✅ Erwartung: Fortschrittsbalken zeigt < 100%
   - ✅ Erwartung: Checkliste zeigt offene Punkte (Adresse)
   - Klicke "Jetzt vervollständigen"
   - ✅ Erwartung: Weiterleitung zu /profile

6. **Profil vervollständigen**
   - Klicke "Bearbeiten" auf Profilseite
   - Fülle Adresse aus:
     - Strasse: Musterstrasse 1
     - PLZ: 3000
     - Ort: Bern
   - Klicke "Speichern"
   - ✅ Erwartung: Profil wird gespeichert
   - Navigiere zurück zum Dashboard
   - ✅ Erwartung: Onboarding-Banner zeigt höheren Fortschritt
   - ✅ Erwartung: Bei 100% verschwindet das Banner

7. **Banner ausblenden testen**
   - Falls Banner noch sichtbar: Klicke X-Button
   - ✅ Erwartung: Banner wird für 24h ausgeblendet
   - Seite neu laden
   - ✅ Erwartung: Banner bleibt ausgeblendet

8. **Einladung per Mail-Link testen (falls SMTP konfiguriert)**
   - Login als admin@iabconnect.ch
   - Navigiere zu /users/new
   - Fülle aus:
     - E-Mail: einladung.test@example.ch
     - Vorname: Einladung
     - Nachname: Test
     - Aktiviert: ✓
     - Einladungs-E-Mail senden: ✓
   - Klicke "Benutzer erstellen"
   - ✅ Erwartung: Benutzer wird erstellt
   - ✅ Erwartung: E-Mail mit Passwort-Link wird gesendet
   - (Prüfe E-Mail-Postfach oder Mailhog wenn konfiguriert)

9. **API-Endpunkte testen**
   - POST /api/v1/registration → Neuen Benutzer registrieren (Public)
   - GET /api/v1/members/me/profile-status → Onboarding-Status abrufen

---

### REQ-008: Passwort Reset & Account Recovery

**Voraussetzungen:**
- Backend und Frontend laufen
- Keycloak läuft mit aktiviertem resetPasswordAllowed
- Mailhog läuft (für E-Mail-Tests): http://localhost:8025

**Testschritte:**

1. **Self-Service Passwort-Reset über Login-Seite**
   - Gehe zu http://localhost:3000/login
   - ✅ Erwartung: "Passwort vergessen?" Link ist sichtbar
   - Klicke auf "Passwort vergessen?"
   - ✅ Erwartung: Weiterleitung zu Keycloak Reset-Seite
   - Gib eine existierende E-Mail-Adresse ein (z.B. member@iabconnect.ch)
   - Klicke "Submit"
   - ✅ Erwartung: Bestätigung dass E-Mail gesendet wurde
   - Öffne Mailhog: http://localhost:8025
   - ✅ Erwartung: E-Mail mit Reset-Link ist eingegangen
   - Klicke auf den Link in der E-Mail
   - ✅ Erwartung: Keycloak Passwort-Ändern-Seite erscheint
   - Gib neues Passwort ein (z.B. Member-Dev-2026!!)
   - ✅ Erwartung: Passwort wurde geändert

2. **Login mit neuem Passwort**
   - Gehe zu http://localhost:3000/login
   - Logge dich mit E-Mail und neuem Passwort ein
   - ✅ Erwartung: Login erfolgreich

3. **Rate Limiting testen**
   - Versuche mehrfach hintereinander Passwort-Reset anzufordern
   - ✅ Erwartung: Nach mehreren Versuchen wird gebremst (Keycloak Brute Force Protection)

4. **Admin-initiierter Passwort-Reset**
   - Login als admin@iabconnect.ch
   - Navigiere zu /users
   - Wähle einen Benutzer aus
   - Klicke auf "Passwort zurücksetzen" Button
   - ✅ Erwartung: Bestätigungsdialog erscheint
   - Bestätige
   - ✅ Erwartung: "Passwort-Reset-E-Mail wurde gesendet"
   - Öffne Mailhog
   - ✅ Erwartung: Reset-E-Mail ist eingegangen

5. **Reset-Link Ablauf testen**
   - Fordere einen Passwort-Reset an
   - Warte nicht zu lange (Standard: 12 Stunden Gültigkeit)
   - Der Link sollte nur einmal verwendbar sein
   - ✅ Erwartung: Nach Verwendung ist der Link ungültig

6. **API-Endpunkte (Admin)**
   - POST /api/v1/users/{userId}/reset-password → Passwort-Reset E-Mail senden

---

### REQ-011: Audit Log (Sicherheits- & Datenänderungen)

**Voraussetzungen:**
- Backend und Frontend laufen
- Login als Admin

**Testschritte:**

1. **Audit-Log Seite öffnen**
   - Login als admin@iabconnect.ch
   - Navigiere zu http://localhost:3000/audit
   - ✅ Erwartung: Audit-Log Seite mit Tabelle wird angezeigt
   - ✅ Erwartung: Filterbereich ist verfügbar (Filter-Button)

2. **Audit-Events durchsuchen**
   - Klicke auf "Filter" um Filteroptionen anzuzeigen
   - ✅ Erwartung: Filter für Datum, Kategorie, Ereignistyp, Schweregrad, Status
   - Wähle Kategorie "Authentifizierung"
   - ✅ Erwartung: Nur Login/Logout Events werden angezeigt
   - Wähle Zeitraum (Von/Bis)
   - ✅ Erwartung: Nur Events im Zeitraum werden angezeigt

3. **Audit-Events durch Aktionen generieren**
   - Öffne zweites Browser-Fenster
   - Login/Logout durchführen
   - Zurück zur Audit-Seite und aktualisieren
   - ✅ Erwartung: Login-Event erscheint in der Liste
   - Navigiere zu /users und ändere einen Benutzer
   - ✅ Erwartung: Benutzer-Update-Event erscheint in der Liste
   - Navigiere zu /members und ändere ein Mitglied
   - ✅ Erwartung: Mitglied-Update-Event erscheint in der Liste

4. **CSV-Export testen**
   - Klicke auf "CSV Export" Button
   - ✅ Erwartung: CSV-Datei wird heruntergeladen
   - ✅ Erwartung: Dateiname enthält Datum (audit_export_YYYYMMDD_HHmmss.csv)
   - Öffne CSV in Editor oder Excel
   - ✅ Erwartung: Spalten: Timestamp, EventType, Category, Severity, UserId, UserName, IpAddress, EntityType, EntityId, Action, Success, ErrorMessage

5. **Pagination testen**
   - Wenn mehr als 50 Events vorhanden
   - ✅ Erwartung: Pagination wird angezeigt
   - Klicke "Weiter" / "Zurück"
   - ✅ Erwartung: Seite wechselt

6. **API-Endpunkte testen (Swagger)**
   - GET /api/v1/audit → Audit-Events abrufen (paginiert)
   - GET /api/v1/audit/export → CSV-Export
   - GET /api/v1/audit/entity/{type}/{id} → Entity-History
   - GET /api/v1/audit/user/{userId} → Benutzer-History
   - GET /api/v1/audit/categories → Verfügbare Kategorien
   - GET /api/v1/audit/event-types → Verfügbare Event-Typen
   - ✅ Erwartung: Alle Endpunkte erfordern Admin-Berechtigung
