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

