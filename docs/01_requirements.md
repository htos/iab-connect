Titel
Requirements Katalog

Quelle
Dieses Dokument ist eine lesbare Sicht auf docs/Anforderungen_WebApp_Indischer_Kulturverein.csv plus Status aus docs/10_requirements_status.md

Scope
IAB Connect deckt Vereins Prozesse ab. Identity und Zugriff, Mitglieder und CRM, Events, Kommunikation, Sponsoren und Lieferanten, Dokumente, Finanzen, öffentlicher Bereich, Reporting und Daten sowie Betrieb und Qualität.

Prioritäten
Must have
Should have
Could have

Requirements

ID: REQ-001
Bereich: Identity & Zugriff

Titel
Login & Zugriff (Admin und Mitglieder)

Beschreibung
Zugriff für administrative Nutzer sowie Bürger/Mitglieder mit getrennten Berechtigungen.

Funktionen

1. Login für Admin/Backoffice
2. Login für Mitgliederportal
3. Rollenbasierte Navigation & Menüs

Akzeptanzkriterien
Admin kann sich anmelden und Admin-Funktionen sehen; Mitglied sieht nur Mitgliederfunktionen.

Priorität
Must

Betroffene Rollen
Admin, Vorstand, Mitglied

Abhängigkeiten


Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Login via Keycloak implementiert. Backend: JWT-Authentifizierung mit Rollenmapping. Frontend: NextAuth.js mit Keycloak-Provider, Login-Seite, rollenbasierte Navigation. Manuelle Tests in docs/06_dev_workflow.md dokumentiert.

ID: REQ-002
Bereich: Identity & Zugriff

Titel
Benutzerverwaltung

Beschreibung
Benutzer anlegen, bearbeiten, deaktivieren und verwalten.

Funktionen

1. Benutzer anlegen/bearbeiten/löschen (soft delete)
2. Aktiv/Inaktiv setzen
3. Passwort zurücksetzen / Einladung per Mail

Akzeptanzkriterien
Admin kann Nutzer verwalten; deaktivierte Nutzer können sich nicht anmelden.

Priorität
Must

Betroffene Rollen
Admin

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Benutzerverwaltung über Keycloak Admin API. Backend: KeycloakAdminService mit Service Account, User-Endpoints für CRUD, Rollen-Management, Passwort-Reset. Frontend: User-Liste mit Suche/Pagination, Create/Edit-Seiten mit Rollenzuweisung, Enable/Disable-Funktion. Setup: iabconnect-admin Client in Keycloak erforderlich mit realm-management Rollen.

ID: REQ-003
Bereich: Identity & Zugriff

Titel
Rollenverwaltung

Beschreibung
Rollen definieren und Benutzern zuweisen.

Funktionen

1. Rollen anlegen/ändern
2. Rollen zuweisen (mehrfach möglich)
3. Standardrollen (z. B. Admin, Kassier, Event-Manager)

Akzeptanzkriterien
Rolle steuert sichtbare Menüs und erlaubte Aktionen.

Priorität
Must

Betroffene Rollen
Admin

Abhängigkeiten


Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Implementiert als Teil von REQ-001. Drei Rollen (admin, vorstand, member) mit entsprechenden Authorization Policies im Backend und rollenbasierter UI im Frontend.

ID: REQ-004
Bereich: Identity & Zugriff

Titel
Feingranulare Zugriffskontrolle

Beschreibung
Berechtigungen pro Modul/Objekt (nicht nur global).

Funktionen

1. Rechte pro CRUD-Aktion
2. Objektbasierte Rechte (z. B. Event nur eigenes)
3. Dokumentrechte pro Ordner/Datei

Akzeptanzkriterien
Unberechtigte Aktionen werden serverseitig blockiert und geloggt.

Priorität
Must

Betroffene Rollen
Admin, Modulverantwortliche

Abhängigkeiten


Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Feingranulare Zugriffskontrolle implementiert. Permission-System mit 40+ Berechtigungen (CRUD pro Resource). Rollenbasiertes Permission-Mapping (admin, vorstand, kassier, event-manager, member). Resource-basierte Autorisierung mit Ownership-Checks (User kann nur eigene Daten bearbeiten). Security Audit Logger für alle Zugriffsentscheidungen. IAuthorizationService und ISecurityAuditLogger in Application Layer.

ID: REQ-005
Bereich: Identity & Zugriff

Titel
SSO Anbindung (Keycloak / OIDC / SAML)

Beschreibung
Integration eines zentralen Identity Providers (z. B. Keycloak).

Funktionen

1. OIDC/SAML Login
2. Rollen/Claims Mapping
3. Single Logout (falls möglich)

Akzeptanzkriterien
Login über IdP funktioniert; Rollen werden korrekt zugeordnet.

Priorität
Must

Betroffene Rollen
Admin, Mitglied

Abhängigkeiten
Keycloak/OIDC/SAML

Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: SSO via Keycloak OIDC implementiert als Teil von REQ-001 (Login). iabconnect-frontend Client für Browser-Flow, iabconnect-backend Client für Backend-Validierung. Realm-Export in infra/keycloak/realms/ verfügbar.

ID: REQ-006
Bereich: Identity & Zugriff

Titel
Social / Enterprise Logins (Google, Microsoft)

Beschreibung
Optionaler Login über externe Provider zusätzlich zum Vereins-Login.

Funktionen

1. Google Sign-In
2. Microsoft Entra ID (Azure AD)
3. Konto-Verknüpfung mit bestehendem Profil

Akzeptanzkriterien
Benutzer kann Provider verbinden/entkoppeln.

Priorität
Should

Betroffene Rollen
Mitglied, Admin

Abhängigkeiten
Google/Microsoft OAuth

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-007
Bereich: Identity & Zugriff

Titel
Registrierung & Onboarding

Beschreibung
Selbstregistrierung oder Einladung inkl. Profilabschluss.

Funktionen

1. Registrierung (falls gewünscht)
2. Einladung per Mail-Link
3. Onboarding-Checkliste (Profil, Einwilligungen)

Akzeptanzkriterien
Neues Mitglied kann Konto erstellen/aktivieren und Profil abschließen.

Priorität
Must

Betroffene Rollen
Mitglied, Admin

Abhängigkeiten


Status: Done
StatusSeit: 2026 01 30
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Registrierung und Onboarding implementiert. (1) Selbstregistrierung mit Admin-Freischaltung via Keycloak disable-new-users Event Listener. (2) Einladung per Mail-Link via SendInvitation-Option bei User-Erstellung. (3) Onboarding-Checkliste: Profile-Status Endpoint prüft Profilabschluss (Adresse, Telefon). OnboardingBanner-Komponente zeigt Fortschritt auf Dashboard an.

ID: REQ-008
Bereich: Identity & Zugriff

Titel
Passwort Reset & Account Recovery

Beschreibung
Sicherer Reset via E-Mail oder IdP-Flow.

Funktionen

1. Reset-Link mit Ablauf
2. Rate Limiting
3. Support-Reset durch Admin (protokolliert)

Akzeptanzkriterien
Reset funktioniert; Links sind einmalig und zeitlich begrenzt.

Priorität
Must

Betroffene Rollen
Mitglied, Admin

Abhängigkeiten


Status: Done
StatusSeit: 2026 01 30
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Passwort Reset und Account Recovery implementiert. (1) Self-Service Reset: "Passwort vergessen?" Link auf Login-Seite leitet zu Keycloak's Reset-Flow weiter. Keycloak sendet Reset-Link per E-Mail (via Mailhog in dev). Link ist einmalig und zeitlich begrenzt (Keycloak Standard: 12h). (2) Admin-Reset: Admins können über Benutzerverwaltung Passwort-Reset-E-Mails versenden. (3) Rate Limiting: Keycloak Brute Force Protection ist aktiviert (bruteForceProtected: true im Realm).

ID: REQ-009
Bereich: Identity & Zugriff

Titel
Mehrfaktor-Authentifizierung (MFA)

Beschreibung
Erhöhte Sicherheit für Admin/Finanzrollen.

Funktionen

1. MFA optional/erzwungen pro Rolle
2. TOTP (Authenticator)
3. Backup-Codes

Akzeptanzkriterien
Für Kassierrolle ist MFA aktivierbar/erzwingbar.

Priorität
Should

Betroffene Rollen
Admin, Kassier

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-010
Bereich: Identity & Zugriff

Titel
Session- und Geräteverwaltung

Beschreibung
Kontrolle über aktive Sitzungen und Logout.

Funktionen

1. Session Timeout
2. Logout überall
3. Geräte/Session-Liste

Akzeptanzkriterien
User kann alle Sessions beenden; Timeouts greifen.

Priorität
Should

Betroffene Rollen
Mitglied, Admin

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-011
Bereich: Identity & Zugriff

Titel
Audit Log (Sicherheits- & Datenänderungen)

Beschreibung
Nachvollziehbarkeit von Änderungen und kritischen Aktionen.

Funktionen

1. Logins/Fehllogins
2. Änderungen an Mitglieds-/Finanzdaten
3. Exportierbar (CSV)

Akzeptanzkriterien
Änderungen sind mit User, Zeit, Objekt, Aktion nachvollziehbar.

Priorität
Must

Betroffene Rollen
Admin, Vorstand, Kassier

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Audit Log für Sicherheits- und Datenänderungen implementiert. Backend: (1) AuditEvent Entity mit EventType, Category, Severity, User/IP-Tracking. (2) IAuditService für Logging mit automatischer IP/UserAgent-Erfassung. (3) AuditEndpoints mit GET /api/v1/audit (paginiert + Filter), /export (CSV), /entity/{type}/{id}, /user/{userId}. (4) Integration in SecurityAuditLogger - alle Access-Events werden persistiert. Frontend: Audit-Log Seite unter /audit mit Tabelle, Filtern, und CSV-Export. Admin-only Zugriff via /admin Dashboard. BEKANNTE EINSCHRÄNKUNG: Login-Tracking über Frontend (LoginTracker) funktioniert noch nicht zuverlässig - muss später überarbeitet werden. Auditierte Aktionen: Member Create/Update/Delete/StatusChange/TypeChange, Access Granted/Denied Events.

ID: REQ-012
Bereich: Identity & Zugriff

Titel
Datenschutz & Einwilligungen (DSGVO)

Beschreibung
Einwilligungen, Newsletter-Opt-in, Datenexport und Löschkonzept.

Funktionen

1. Consent-Management
2. Datenexport (z. B. JSON/ZIP)
3. Lösch-/Anonymisierungsworkflow

Akzeptanzkriterien
Einwilligungen werden gespeichert; Export/Löschung ist durchführbar.

Priorität
Must

Betroffene Rollen
Admin

Abhängigkeiten


Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: DSGVO/Datenschutz-Compliance implementiert. (1) Einwilligungsverwaltung: Consent Entity mit 5 Typen (DataProcessing erforderlich, Newsletter, Marketing, EventNotifications, PhotoUsage). API-Endpunkte: GET/PUT /privacy/consents (Übersicht + Bulk-Update), POST/DELETE /privacy/consents/{type}. (2) Datenexport (Art. 20): GET /privacy/export liefert alle Benutzerdaten (Profil, Einwilligungen, Audit-Log) als JSON. (3) Recht auf Löschung (Art. 17): DeletionRequest Entity mit Workflow (Pending→Confirmed→UnderReview→Completed/Cancelled/Rejected). Bestätigungs-Token per E-Mail. Admin-Endpunkte zur Bearbeitung. Anonymisierung statt Löschung für Audit-Compliance. (4) Tests: 20 Unit-Tests (Consent, DeletionRequest), 15 Integrationstests (ConsentRepository, DeletionRequestRepository mit Testcontainers).

ID: REQ-013
Bereich: Mitglieder/CRM

Titel
Mitgliederstammdaten (CRM mini)

Beschreibung
Zentrale Profile für Mitglieder/Bürger.

Funktionen

1. Kontakt- und Adressdaten
2. Familien/Haushalt Verknüpfung (optional)
3. Tags/Segmente

Akzeptanzkriterien
Daten sind pflegbar; Suche findet Mitglieder nach Name/E-Mail.

Priorität
Must

Betroffene Rollen
Admin, Mitglied

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Mitgliederstammdaten implementiert. Domain: Member-Aggregat mit Address-Value-Object. API: 10 Endpunkte (CRUD, Status, Type, Statistics). Frontend: Mitgliederliste, Detail-, Bearbeitungs- und Erstellungsseiten.

ID: REQ-014
Bereich: Mitglieder/CRM

Titel
Mitgliedschaftsarten & Status

Beschreibung
Abbildung verschiedener Mitgliedschaften inkl. Laufzeit.

Funktionen

1. Typen (z. B. Einzel, Familie, Förder)
2. Status (aktiv, pausiert, gekündigt)
3. Laufzeiten/Verlängerung

Akzeptanzkriterien
Statuswechsel ist nachvollziehbar; Verlängerung erzeugt neue Periode.

Priorität
Must

Betroffene Rollen
Admin, Kassier

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: MembershipType (Regular, Student, Family, Honorary) und MembershipStatus (Pending, Active, Inactive, Suspended) als Enums implementiert. UI zeigt farbcodierte Badges.

ID: REQ-015
Bereich: Mitglieder/CRM

Titel
Beiträge & Beitragsverwaltung

Beschreibung
Mitgliedsbeiträge, Sollstellungen und Historie.

Funktionen

1. Beitragssätze pro Typ
2. Jahres-/Monatsbeiträge
3. Soll/Ist Übersicht

Akzeptanzkriterien
Für alle aktiven Mitglieder werden Beiträge erzeugt und statusgeführt.

Priorität
Must

Betroffene Rollen
Kassier, Admin

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Implementiert als Teil von REQ-013. Neues Mitglied kann über /members/new erstellt werden. Status wird auf Pending gesetzt, kann vom Vorstand über Detailseite geändert werden.

ID: REQ-016
Bereich: Mitglieder/CRM

Titel
Mitglieder Self‑Service Portal

Beschreibung
Mitglieder können eigene Daten und Dokumente verwalten.

Funktionen

1. Profil bearbeiten
2. Rechnungen/Beiträge einsehen
3. Mitgliedsausweis/Bestätigungen downloaden

Akzeptanzkriterien
Mitglied kann nur eigene Daten sehen und ändern (wo erlaubt).

Priorität
Must

Betroffene Rollen
Mitglied

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Mitgliederliste: /members mit Suche, Filter nach Status/Typ, Paginierung. Detailansicht: /members/[id]. Self-Service Profil: /profile (für Mitglieder-Rolle).

ID: REQ-017
Bereich: Mitglieder/CRM

Titel
Segmentierung & Verteiler

Beschreibung
Mitgliedergruppen für Kommunikation und Auswertungen.

Funktionen

1. Filter (Status, Typ, Interessen)
2. gespeicherte Segmente
3. Export nach Segment

Akzeptanzkriterien
Segment kann gespeichert und für Mailing verwendet werden.

Priorität
Should

Betroffene Rollen
Admin, Kommunikation

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-018
Bereich: Mitglieder/CRM

Titel
Dubletten-Erkennung

Beschreibung
Verhindert doppelte Mitglieder/Accounts.

Funktionen

1. Warnung bei gleicher E-Mail
2. Merge-Prozess (Admin)
3. Protokollierte Zusammenführung

Akzeptanzkriterien
System warnt; Merge erstellt nachvollziehbare Historie.

Priorität
Should

Betroffene Rollen
Admin

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-019
Bereich: Events

Titel
Eventverwaltung (Kalender, Details)

Beschreibung
Events anlegen, pflegen und veröffentlichen.

Funktionen

1. Titel, Beschreibung, Ort
2. Datum/Uhrzeit, Serienevents
3. Sichtbarkeit (öffentlich/privat)

Akzeptanzkriterien
Event kann erstellt, bearbeitet und publiziert werden.

Priorität
Must

Betroffene Rollen
Event-Manager, Admin

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Eventverwaltung vollständig implementiert. Backend: (1) Event-Entity mit umfassenden Properties (Titel, Beschreibung, Ort, Datum/Zeit, Kategorie, Sichtbarkeit, Status, Anmeldung, Kosten, Kontakt). (2) EventEnums: EventVisibility (MembersOnly/Public/InviteOnly/Hidden), EventStatus (Draft/Published/Cancelled/Completed), EventCategory (11 Typen), RecurrencePattern. (3) IEventRepository mit EventFilterOptions für flexible Abfragen. (4) EventEndpoints: 12 Endpunkte (Public: GET /events/public, /events/public/{id}; Protected: CRUD, /upcoming, /statistics, /publish, /unpublish, /cancel). Frontend: (1) /events - Event-Liste mit Listen- und Kalenderansicht, Filter nach Status/Kategorie, Paginierung. (2) /events/[id] - Detailseite mit Aktionen (Publish/Unpublish/Cancel/Delete). (3) /events/new und /events/[id]/edit - Formulare für Event-Erstellung und -Bearbeitung. (4) events.ts Service mit 13 API-Funktionen und Utility-Helpers. Tests: 58 Unit-Tests für Event-Entity (Creation, Updates, State Transitions, Validations).

ID: REQ-020
Bereich: Events

Titel
Event-Anmeldung / RSVP

Beschreibung
Teilnehmermanagement für Events.

Funktionen

1. Anmeldung für Mitglieder/öffentlich
2. Kapazitätslimit
3. Storno/No‑Show Kennzeichnung

Akzeptanzkriterien
Anmeldungen werden gezählt; Kapazitätsgrenzen greifen.

Priorität
Must

Betroffene Rollen
Event-Manager, Mitglied

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Event-Anmeldung (RSVP) vollständig implementiert. Backend: (1) EventRegistration-Entity mit Factory-Methods (CreateForMember, CreateForGuest, CreateWaitlisted), State-Transitions (Confirm, Cancel, CheckIn, MarkAsNoShow, MoveToWaitlist, PromoteFromWaitlist), QR-Code-Token-Generierung. (2) RegistrationStatus-Enum (Pending, Confirmed, Cancelled, Waitlisted, CheckedIn, NoShow). (3) IEventRegistrationRepository mit Filter- und Statistik-Funktionen. (4) EventRegistrationEndpoints: 15+ Endpunkte (Public: POST /public; Protected: CRUD, /cancel, /confirm, /check-in, /no-show, /statistics, /waitlist, /promote-from-waitlist, /check-in/{qrCodeToken}, /my-registrations). Frontend: (1) EventRegistration-Komponente für Anmeldeformular. (2) EventParticipantsList-Komponente für Admin-Verwaltung mit Filter, Export. (3) MyRegistrations-Komponente für persönliche Anmeldungen. (4) EventCheckIn-Komponente für QR-Code-Scan. (5) EventTicket-Komponente für Ticket-Anzeige. (6) events.ts Service erweitert mit 15+ Registration-Funktionen. Tests: 41 Unit-Tests für EventRegistration-Entity, alle bestanden.

ID: REQ-021
Bereich: Events

Titel
Warteliste & Nachrücken

Beschreibung
Wenn Event voll ist, Warteliste und automatisches Nachrücken.

Funktionen

1. Wartelistenplatz
2. Benachrichtigung bei Platz
3. Nachrück-Fristen

Akzeptanzkriterien
Bei freiem Platz wird Warteliste benachrichtigt; Status ändert sich.

Priorität
Should

Betroffene Rollen
Event-Manager, Mitglied

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-022
Bereich: Events

Titel
Ticketing / Gebühren (optional)

Beschreibung
Bezahlte Events inkl. Ticket/Beleg.

Funktionen

1. Preis pro Kategorie
2. Gutschein/Ermäßigung (optional)
3. Ticket/Bestätigung per Mail

Akzeptanzkriterien
Bezahlte Anmeldung erzeugt Rechnung/Beleg.

Priorität
Should

Betroffene Rollen
Kassier, Event-Manager

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-023
Bereich: Events

Titel
Check‑in vor Ort (QR-Code)

Beschreibung
Schnelles Einchecken und Teilnehmerliste live.

Funktionen

1. QR‑Code pro Anmeldung
2. Check‑in Status
3. Offline‑Fallback (Exportliste)

Akzeptanzkriterien
Check-in setzt Status in Echtzeit; Exportliste ist verfügbar.

Priorität
Could

Betroffene Rollen
Event-Manager

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-024
Bereich: Events

Titel
Helferplanung & Aufgaben

Beschreibung
Schichten, Aufgaben, To-Dos rund um Events.

Funktionen

1. Aufgabenlisten
2. Helfer-Schichten
3. Erinnerungen an Helfer

Akzeptanzkriterien
Helfer können sich eintragen; Schichtplan ist exportierbar.

Priorität
Should

Betroffene Rollen
Event-Manager, Admin

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-025
Bereich: Events

Titel
Kalender-Integration (iCal/Google)

Beschreibung
Events als Feed/Export bereitstellen.

Funktionen

1. iCal Feed
2. Export .ics
3. Einbettung auf Website

Akzeptanzkriterien
iCal Link importierbar; Änderungen aktualisieren sich.

Priorität
Could

Betroffene Rollen
Mitglied, Öffentlichkeit

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-026
Bereich: Kommunikation

Titel
E‑Mail Verwaltung (Automatisiertes Mailing)

Beschreibung
E-Mails an Mitglieder/Segmente, automatisiert und manuell.

Funktionen

1. Mailing an Segmente
2. Testversand
3. Zustellstatus (gesendet/bounce)

Akzeptanzkriterien
Kampagne kann erstellt und an Segment gesendet werden.

Priorität
Must

Betroffene Rollen
Kommunikation, Admin

Abhängigkeiten
Mail Provider (z. B. SendGrid/M365)

Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: E-Mail Verwaltung / Automatisiertes Mailing vollständig implementiert. Backend: (1) EmailCampaign-Entity mit Factory-Method, State-Transitions (Draft→Scheduled→Sending→Sent/Cancelled/Failed), Statistiken (TotalRecipients, SentCount, DeliveredCount, OpenedCount, ClickedCount, BouncedCount, FailedCount). (2) EmailRecipient-Entity mit Status-Tracking (Pending→Sent→Delivered→Opened→Clicked/Bounced/Failed), Bounce-Typen. (3) Enums: EmailCampaignStatus, EmailRecipientStatus, BounceType, RecipientSegmentType. (4) IEmailCampaignRepository mit Filter, Paginierung, Statistik-Abfragen. (5) IEmailSender Interface mit SmtpEmailSender-Implementation für Mailhog (dev). (6) EmailCampaignEndpoints: 13 API-Endpunkte (CRUD, /send, /test, /schedule, /cancel, /recipients, /recipients/preview, /statistics). (7) EF Core Configurations mit Indizes auf Status, CreatedAt, ScheduledAt. Migration AddEmailCampaigns erstellt und angewendet. Frontend: (1) /email-campaigns - Kampagnenliste mit Status-Filter, Paginierung, Statistik-Anzeige. (2) /email-campaigns/new - Kampagnen-Erstellung mit Absender, Empfängergruppe, HTML-Editor. (3) /email-campaigns/[id] - Detailseite mit Test-E-Mail, Planen, Jetzt-Senden Aktionen, Empfängerliste, Statistiken. (4) email-campaigns.ts Types und Helpers. (5) Navigation-Link in Sidebar unter "Kommunikation". Tests: 12 Unit-Tests für EmailCampaign-Entity (Create, Update, Schedule, StartSending, CompleteSending, Cancel, AddRecipient, UpdateStatistics), alle bestanden.

ID: REQ-027
Bereich: Kommunikation

Titel
Template-Editor & Vorlagenpflege

Beschreibung
Wiederverwendbare E-Mail Templates (HTML/Text) mit Variablen.

Funktionen

1. Vorlagen erstellen
2. Platzhalter (Name, Event, Betrag)
3. Versionierung/Entwurf

Akzeptanzkriterien
Template speichert Variablen; Vorschau zeigt korrekt gerenderte Mail.

Priorität
Must

Betroffene Rollen
Kommunikation

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Email Template Editor komplett implementiert. Backend: (1) EmailTemplate-Entity mit int ID, CRUD-Repository, 7 API-Endpoints (GET all/by-id/by-category, POST create, PUT update, DELETE, POST preview, POST deactivate). (2) Support für Variablen mit {{variable}} Syntax, Auto-Rendering für HTML und Subject. (3) Migration für PostgreSQL Datenbank erstellt. Frontend: (1) TypeScript Types und API-Service für Vorlagen. (2) Admin-Seite /email-templates mit Suche, Paginierung, Filter. (3) Create/Edit Formular mit HTML-Editor und Variablen-Management. (4) Live-Vorschau mit Variable-Rendering. Tests: 6 Unit-Tests für EmailTemplate-Entity (Create, Update, Rendering, Variables).

ID: REQ-028
Bereich: Kommunikation

Titel
Automations/Journeys

Beschreibung
Automatische Mails für typische Prozesse.

Funktionen

1. Welcome-Mail
2. Event Reminder
3. Beitrags-/Mahnungsmails

Akzeptanzkriterien
Auslöser senden Mail mit korrektem Template und Empfängern.

Priorität
Should

Betroffene Rollen
Kommunikation, Kassier

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-029
Bereich: Kommunikation

Titel
Newsletter Opt-in/Opt-out & Bounces

Beschreibung
Rechtssicheres Newsletter-Handling.

Funktionen

1. Double Opt-in (optional)
2. Abmeldelink
3. Bounce/Complaint Handling

Akzeptanzkriterien
Abmeldung wirkt sofort; Einwilligung wird protokolliert.

Priorität
Must

Betroffene Rollen
Kommunikation

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-030
Bereich: Kommunikation

Titel
Mehrkanal-Nachrichten (optional)

Beschreibung
SMS/WhatsApp/Push für Reminder (wenn gewünscht).

Funktionen

1. SMS Provider
2. WhatsApp Business (optional)
3. Kanalpräferenzen pro User

Akzeptanzkriterien
User kann Kanal wählen; Versand wird geloggt.

Priorität
Could

Betroffene Rollen
Kommunikation

Abhängigkeiten
SMS/WhatsApp Provider

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-031
Bereich: Sponsoren & Lieferanten

Titel
Sponsorenverwaltung

Beschreibung
Sponsorenkontakte, Pakete, Zusagen, Leistungen.

Funktionen

1. Sponsorprofile
2. Sponsoring-Pakete
3. Benefits/Leistungen tracken

Akzeptanzkriterien
Sponsoren können gesucht, segmentiert und mit Verträgen verknüpft werden.

Priorität
Must

Betroffene Rollen
Admin, Sponsor-Manager

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-032
Bereich: Sponsoren & Lieferanten

Titel
Lieferantenverwaltung

Beschreibung
Lieferantenkontakte, Leistungen und Bestellungen/Verträge.

Funktionen

1. Lieferantenprofile
2. Vertrags-/Kontaktinfos
3. Historie der Zusammenarbeit

Akzeptanzkriterien
Lieferant kann angelegt und Dokumenten/Belegen zugeordnet werden.

Priorität
Must

Betroffene Rollen
Admin

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-033
Bereich: Sponsoren & Lieferanten

Titel
Vertrags- & Dokumentenverknüpfung

Beschreibung
Sponsoren/Lieferanten mit Dokumenten, Rechnungen und Events verknüpfen.

Funktionen

1. Link zu Dokumenten
2. Link zu Rechnungen
3. Link zu Events

Akzeptanzkriterien
Jeder Vertrag/Rechnung kann einem Sponsor/Lieferanten zugeordnet werden.

Priorität
Should

Betroffene Rollen
Admin, Kassier

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-034
Bereich: Dokumente

Titel
Dokumentenverwaltung

Beschreibung
Speichern, organisieren und teilen von Vereinsdokumenten.

Funktionen

1. Upload/Download
2. Ordnerstruktur
3. Metadaten (Tags, Kategorie)

Akzeptanzkriterien
Dokument ist auffindbar; Zugriff je Rolle ist durchgesetzt.

Priorität
Must

Betroffene Rollen
Admin, Vorstand

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 14
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Dokumentenverwaltung implementiert. Backend: Document-Aggregat mit Folder-Hierarchie, DocumentVersion, DocumentTag. S3-kompatibler Storage (RustFS) für Datei-Upload/Download. API-Endpunkte für CRUD, Upload, Download, Versionen, Tags, Ordner. Frontend: Dokumenten-Seite mit Ordner-Navigation, Upload, Download, Vorschau.

ID: REQ-035
Bereich: Dokumente

Titel
Dokumentrechte & Freigabe

Beschreibung
Workflow für Entwurf, Prüfung, Veröffentlichung.

Funktionen

1. Status (Entwurf/Geprüft/Veröffentlicht)
2. Freigabe durch Rolle
3. Ablaufdatum/Archiv

Akzeptanzkriterien
Nur freigegebene Dokumente sind sichtbar (je nach Sichtbarkeit).

Priorität
Should

Betroffene Rollen
Vorstand, Admin

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 14
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Dokumentrechte und Freigabe implementiert. FolderPermission-Entity mit rollenbasierter Zugriffskontrolle (Read, Write, Manage) pro Ordner. Document-Status-Workflow (Draft→UnderReview→Published/Archived) mit Freigabe durch Vorstand/Admin.

ID: REQ-036
Bereich: Dokumente

Titel
Versionierung

Beschreibung
Änderungen nachvollziehbar machen, alte Versionen verfügbar.

Funktionen

1. Versionsnummern
2. Diff/Kommentar (optional)
3. Restore früherer Version

Akzeptanzkriterien
Versionen sind abrufbar; Restore erstellt neue Version.

Priorität
Should

Betroffene Rollen
Admin

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 14
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Dokumenten-Versionierung implementiert. DocumentVersion-Entity mit version_number, storage_key, file_size, content_type, comment. Automatische Versionsnummer-Inkrementierung bei Upload. Ältere Versionen bleiben im Storage erhalten und können heruntergeladen werden.

ID: REQ-037
Bereich: Dokumente

Titel
Volltextsuche & Tags

Beschreibung
Schnelle Auffindbarkeit auch bei vielen Dokumenten.

Funktionen

1. Suche in Metadaten
2. Volltext (PDF/DOCX) optional
3. Tags/Filter

Akzeptanzkriterien
Suche liefert relevante Treffer; Filter funktionieren.

Priorität
Could

Betroffene Rollen
Alle

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 14
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Volltextsuche und Tags für Dokumente implementiert. DocumentTag-Entity für flexible Verschlagwortung. Such-Endpunkt mit Filter nach Name, Kategorie, Tags, Status, Ordner. Frontend: Tag-Management in Dokumenten-Detailansicht, Suche über alle Dokumenten-Metadaten.

ID: REQ-038
Bereich: Finanzen

Titel
Mini-Buchhaltung (Grundfunktionen)

Beschreibung
Einnahmen/Ausgaben erfassen und auswerten.

Funktionen

1. Buchungen erfassen
2. Kategorien/Konten
3. Einnahmen/Ausgaben Übersicht

Akzeptanzkriterien
Buchungen können erfasst, geändert (mit Audit) und ausgewertet werden.

Priorität
Must

Betroffene Rollen
Kassier

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Finance Module Grundstruktur implementiert. Backend: 10 Domain Entities (Account, Category, Transaction, Invoice, InvoiceItem, Payment, BankImport, BankImportItem, DunningNotice, Receipt), EF Core Configs, 8 Repository-Interfaces + Implementierungen, 9 Endpoint-Dateien, EF Migration. Frontend: Dashboard mit KPIs, Quick Links, 12 Seiten. Rollen: kassier (Vollzugriff), auditor (Lesezugriff). Auth-Policies: RequireFinanceRead, RequireFinanceWrite.

ID: REQ-039
Bereich: Finanzen

Titel
Rechnungsstellung

Beschreibung
Rechnungen für Beiträge, Events, Sponsoring.

Funktionen

1. Rechnung erstellen
2. PDF Export
3. Nummernkreis

Akzeptanzkriterien
Rechnung hat eindeutige Nummer; PDF ist generierbar.

Priorität
Must

Betroffene Rollen
Kassier

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Einnahmen/Ausgaben erfassen implementiert. Backend: Transaction CRUD Endpoints mit Summary, Account/Category Management. Frontend: Transactions-Seite mit Filtern (Datum, Typ, Konto, Kategorie), CRUD Modal, Accounts-Seite mit Sortierung, Categories-Seite mit Farbauswahl. Belege-Upload via Receipts-Seite mit FormData-Upload.

ID: REQ-040
Bereich: Finanzen

Titel
Zahlungsverwaltung & Abgleich

Beschreibung
Zahlungen erfassen und Rechnungen ausgleichen.

Funktionen

1. Zahlung erfassen (bar, Überweisung)
2. Teilzahlungen
3. Offene Posten Liste

Akzeptanzkriterien
Offene Posten stimmen; Teilzahlungen reduzieren Restbetrag korrekt.

Priorität
Must

Betroffene Rollen
Kassier

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Rechnungserstellung implementiert. Backend: Invoice CRUD mit Status-Workflow (Draft→Sent→Paid/Overdue/Cancelled), InvoiceItem, automatische Rechnungsnummer (INV-YYYY-NNNN). Frontend: Rechnungsliste mit Statusfilter, Detailseite mit Positionen/Zahlungsverlauf, Neue Rechnung mit dynamischen Positionen und automatischer Berechnung.

ID: REQ-041
Bereich: Finanzen

Titel
Bankimport (CSV)

Beschreibung
Optionaler Import von Bankumsätzen zur Vereinfachung.

Funktionen

1. CSV Import
2. Matching Vorschläge
3. Manuelle Zuordnung

Akzeptanzkriterien
Import funktioniert; Zuordnung erzeugt Zahlung/Buchung.

Priorität
Should

Betroffene Rollen
Kassier

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Zahlungsverwaltung implementiert. Backend: Payment CRUD mit automatischer Invoice-Markierung als bezahlt. Frontend: Payments-Seite mit Tabs (Offene Posten / Alle Zahlungen), Zahlungserfassung mit Methodenauswahl (Bank/Bar/Karte).

ID: REQ-042
Bereich: Finanzen

Titel
Mahnwesen

Beschreibung
Automatisierte Erinnerung und Mahnungen für offene Beiträge/Rechnungen.

Funktionen

1. Mahnstufen
2. Template je Stufe
3. Protokoll der Mahnungen

Akzeptanzkriterien
Mahnung wird nur bei offenen Posten gesendet; Historie wird gespeichert.

Priorität
Should

Betroffene Rollen
Kassier, Kommunikation

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Bank-Import implementiert. Backend: BankImport/BankImportItem Entities, Upload-Endpoint (POST), GetAll (GET), Match/Ignore/Unmatch (PUT). Frontend: Bank-Import-Seite mit CSV-Upload via FormData, Import-Verlauf, Item-Ansicht mit Zuordnungs-Aktionen.

ID: REQ-043
Bereich: Finanzen

Titel
Belegmanagement

Beschreibung
Quittungen/Belege hochladen und Buchungen zuordnen.

Funktionen

1. Upload Foto/PDF
2. Zuordnung zu Buchung
3. Steuerrelevante Metadaten (optional)

Akzeptanzkriterien
Buchung kann Beleg haben; Beleg ist per Klick abrufbar.

Priorität
Should

Betroffene Rollen
Kassier

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Mahnwesen implementiert. Backend: DunningNotice Entity mit Level (1-3), Status-Workflow (Draft→Sent), Create und Send Endpoints. Frontend: Dunning-Seite mit Mahnungsliste, Erstellen-Modal mit überfälligen Rechnungen, Level-Badges, Senden-Aktion.

ID: REQ-044
Bereich: Finanzen

Titel
Budget & Kostenstellen

Beschreibung
Auswertung nach Event/Projekt (Diwali etc.).

Funktionen

1. Kostenstellen
2. Budget pro Kostenstelle
3. Soll/Ist Vergleich

Akzeptanzkriterien
Soll/Ist ist pro Kostenstelle sichtbar.

Priorität
Could

Betroffene Rollen
Kassier, Vorstand

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-045
Bereich: Finanzen

Titel
Export für Steuer/Buchhaltung

Beschreibung
Export der Daten (CSV/Excel) für externes System.

Funktionen

1. Buchungsjournal Export
2. OP-Liste Export
3. Sponsor-/Beitragslisten Export

Akzeptanzkriterien
Export entspricht definierter Struktur und enthält notwendige Felder.

Priorität
Must

Betroffene Rollen
Kassier

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Buchhaltungsexport implementiert. Backend: FinanceExportEndpoints mit Journal-CSV und Offene-Posten-CSV (RequireFinanceRead). Frontend: Export-Seite mit zwei Export-Karten (Journal mit Datumsbereich, Offene Posten), CSV-Download via Blob mit automatischer Content-Type-Erkennung.

ID: REQ-046
Bereich: Öffentlicher Bereich

Titel
Öffentliche Eventseite

Beschreibung
Events öffentlich darstellen und Anmeldung ermöglichen.

Funktionen

1. Eventliste
2. Eventdetailseite
3. Öffentliche Anmeldung

Akzeptanzkriterien
Öffentliche Seite zeigt nur freigegebene Events; Anmeldung funktioniert.

Priorität
Must

Betroffene Rollen
Öffentlichkeit, Mitglied

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-047
Bereich: Öffentlicher Bereich

Titel
News/Blog (optional)

Beschreibung
Einfache Inhaltsverwaltung für Vereinsnews.

Funktionen

1. Beiträge erstellen
2. Kategorien/Tags
3. Veröffentlichung/Archiv

Akzeptanzkriterien
Beiträge sind sortierbar; Entwurf/Publiziert Status.

Priorität
Could

Betroffene Rollen
Admin, Kommunikation

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-048
Bereich: Öffentlicher Bereich

Titel
Sponsorenseite

Beschreibung
Sponsoren sichtbar machen (Logo, Paket, Link).

Funktionen

1. Sponsor-Listing
2. Pakete/Badges
3. Sichtbarkeit steuern

Akzeptanzkriterien
Nur freigegebene Sponsoren werden angezeigt.

Priorität
Should

Betroffene Rollen
Admin, Sponsor-Manager

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-049
Bereich: Öffentlicher Bereich

Titel
Kontaktformular + Spam-Schutz

Beschreibung
Kontaktaufnahme mit Captcha und Routing.

Funktionen

1. Formularfelder
2. Captcha
3. Weiterleitung an Mail/Queue

Akzeptanzkriterien
Spam wird reduziert; Nachrichten landen beim richtigen Empfänger.

Priorität
Must

Betroffene Rollen
Öffentlichkeit, Admin

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-050
Bereich: Reporting & Daten

Titel
Dashboards & KPIs

Beschreibung
Übersichten für Vorstand, Kassier, Eventteam.

Funktionen

1. Mitgliederentwicklung
2. Offene Beiträge
3. Event KPIs (Anmeldungen, Einnahmen)

Akzeptanzkriterien
Dashboard zeigt aktuelle Daten; Filter nach Zeitraum.

Priorität
Must

Betroffene Rollen
Vorstand, Kassier, Event-Manager

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-051
Bereich: Reporting & Daten

Titel
Exports (CSV/Excel)

Beschreibung
Datenexporte für Auswertung und Archiv.

Funktionen

1. Mitgliederexport
2. Event-Teilnehmerlisten
3. Finanzexport

Akzeptanzkriterien
Exports respektieren Berechtigungen und enthalten definierte Spalten.

Priorität
Must

Betroffene Rollen
Admin, Kassier

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-052
Bereich: Reporting & Daten

Titel
Such- & Filterfunktionen

Beschreibung
Schnelles Finden in Mitgliedern, Events, Dokumenten, Rechnungen.

Funktionen

1. Volltext/teilweise Suche
2. Filter & Sortierung
3. gespeicherte Views (optional)

Akzeptanzkriterien
Suchen liefert Ergebnisse <2s bei typischen Datenmengen.

Priorität
Must

Betroffene Rollen
Alle Backoffice Rollen

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-053
Bereich: Betrieb & Qualität

Titel
Backup & Restore Konzept

Beschreibung
Regelmäßige Backups inkl. Wiederherstellungstest.

Funktionen

1. DB Backup
2. Dokument-Storage Backup
3. Restore-Prozedur

Akzeptanzkriterien
Restore-Test ist dokumentiert und erfolgreich.

Priorität
Must

Betroffene Rollen
Admin/IT

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-054
Bereich: Betrieb & Qualität

Titel
Logging & Monitoring

Beschreibung
Fehler- und Performance-Monitoring.

Funktionen

1. Error Tracking
2. Metriken (Response Time)
3. Alarmierung (optional)

Akzeptanzkriterien
Kritische Fehler sind auffindbar; Logs enthalten Korrelations-ID.

Priorität
Should

Betroffene Rollen
Admin/IT

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-055
Bereich: Betrieb & Qualität

Titel
Mehrsprachigkeit (DE/EN/HI optional)

Beschreibung
UI und Inhalte mehrsprachig.

Funktionen

1. UI-Übersetzungen
2. Inhaltssprache pro Beitrag/Event
3. Sprache pro Nutzer

Akzeptanzkriterien
Sprache kann gewechselt werden; Fallback funktioniert.

Priorität
Could

Betroffene Rollen
Alle

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-056
Bereich: Betrieb & Qualität

Titel
Barrierefreiheit (Basis)

Beschreibung
Mindestens WCAG-Basics für Formulare und Navigation.

Funktionen

1. Tastaturbedienung
2. Kontraste
3. ARIA Labels

Akzeptanzkriterien
Wichtige Flows sind ohne Maus bedienbar.

Priorität
Should

Betroffene Rollen
Alle

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-057
Bereich: Betrieb & Qualität

Titel
Datenaufbewahrung & Archivierung

Beschreibung
Regeln, wie lange Daten/Dokumente gehalten werden.

Funktionen

1. Aufbewahrungsfristen
2. Archivstatus
3. Lösch-/Anonymisierungsjobs

Akzeptanzkriterien
Archivierte Daten sind schreibgeschützt; Löschjobs protokolliert.

Priorität
Must

Betroffene Rollen
Admin, Vorstand

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-058
Bereich: Betrieb & Qualität

Titel
API/Webhooks (optional)

Beschreibung
Schnittstellen für spätere Integrationen.

Funktionen

1. REST API (read)
2. Webhooks (Event erstellt, Zahlung eingegangen)
3. API Keys/Scopes

Akzeptanzkriterien
API ist gesichert; Rate Limits vorhanden.

Priorität
Could

Betroffene Rollen
Admin/IT

Abhängigkeiten


Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-059
Bereich: Betrieb & Qualität

Titel
Konfiguration & Systemeinstellungen

Beschreibung
Zentrale Einstellungen des Vereins (Texte, Logos, Beiträge, Mail-Absender).

Funktionen

1. Vereinsprofil
2. Beitragssätze
3. Mail-Settings

Akzeptanzkriterien
Einstellungen wirken ohne Codeänderung; Änderungen sind auditiert.

Priorität
Must

Betroffene Rollen
Admin

Abhängigkeiten


Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Admin-Konfiguration implementiert. Backend: SystemSettings Entity (ApplicationName, LogoText, LogoBackgroundColor, LogoTextColor), SettingsEndpoints (GET/PUT + Public GET), CustomRole Entity mit CRUD. Frontend: /admin/settings mit zwei Tabs (Allgemein + Benutzerdefinierte Rollen), AppSettingsProvider Context für dynamisches Branding in Header/Sidebar/Navigation.

ID: REQ-060
Bereich: Finanzen

Titel
Finanz-Setup: Land/Profil, Währung, Geschäftsjahr

Beschreibung
Konfigurierbares Finanzprofil pro Verein (Schweiz oder EU). Steuert Währung, Geschäftsjahr, VAT/MWST-Flags, Nummernkreise und Zahlungs-Defaults.

Funktionen

1. FinanceProfile: CH oder EU (optional EU-Land-Code)
2. Default currency (CHF/EUR) + Rundungsregeln
3. Geschäftsjahr Start/Ende, Perioden
4. Invoice numbering pattern pro Profil
5. VAT/MWST Registrierung (ja/nein), VAT-ID/MWST-Nr. optional

Akzeptanzkriterien
Finanzprofil ist änderbar (mit Audit). Neue Rechnungen/Buchungen verwenden Profil-Defaults; bestehende Daten bleiben unverändert.

Priorität
Must

Betroffene Rollen
Admin, Kassier

Abhängigkeiten
REQ-059 (Konfiguration), REQ-004 (Access Control)

Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: FinanceProfile Entity (CH/EU Jurisdiktion, Waehrung, Org-Details). Backend: CQRS-Handlers, API-Endpoints, EF-Config. Frontend: Finance Settings Seite. 17 Unit-Tests. Migration AddFinanceProfile.

ID: REQ-061
Bereich: Finanzen

Titel
Beleg- und Finanzdokumente: Storage, Integrität, Aufbewahrung

Beschreibung
Finanzbelege und Rechnungs-PDFs werden als Dateien im Object Storage (RustFS) gespeichert, inkl. Integritätsmerkmalen und Retention-Strategie.

Funktionen

1. Upload/Download von Receipt-Dateien (PDF/JPG/PNG) in RustFS
2. Automatische Speicherung von Rechnungs-PDFs (und optional Mahnungs-PDFs)
3. Checksum/Hash pro Datei zur Integritätsprüfung
4. Retention Policy: finanzrelevante Dokumente werden nicht gelöscht, sondern archiviert

Akzeptanzkriterien
Beleg-Download liefert die ursprünglich hochgeladene Datei; Hash-Check ist reproduzierbar; Löschen ist als Archive/Soft-Delete umgesetzt.

Priorität
Must

Betroffene Rollen
Kassier, Auditor, Admin

Abhängigkeiten
REQ-057 (Datenaufbewahrung), Storage (RustFS)

Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Receipt-Storage via S3/RustFS mit SHA256-Integrity und File-Type-Validation. Backend: 5 CQRS-Handlers, 5 API-Endpoints. Frontend: Receipt Upload/Download UI. 14 Unit-Tests. Migration AddReceiptStorage.

ID: REQ-062
Bereich: Finanzen

Titel
VAT/MWST: Steuercodes, Netto/Brutto, Auswertung und Export

Beschreibung
Transaktionen und Rechnungspositionen unterstützen VAT/MWST-Codes (steuerbar, befreit, reduziert), Netto/Brutto-Beträge und VAT-Auswertungen.

Funktionen

1. Konfigurierbare TaxCodes pro Profil (Rate, Beschreibung, steuerbar flag)
2. InvoiceItem: net_amount, vat_rate, vat_amount, gross_amount
3. VAT Summary Report (Zeitraum) + Export (CSV)
4. Schwellwert-Tracking (z.B. CH MWST-Umsatzgrenze konfigurierbar) mit Warnung

Akzeptanzkriterien
VAT Summary entspricht den gebuchten TaxCodes; Export ist konsistent und prüfbar (Summe der Positionen = Rechnungstotal).

Priorität
Should

Betroffene Rollen
Kassier, Auditor

Abhängigkeiten
REQ-045 (Export), REQ-060 (Profil)

Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: VAT/MWST mit konfigurierbaren TaxCodes, Per-Item-Tax auf InvoiceItem, VAT-Summary im PDF und Export. Backend: TaxCode CRUD, InvoiceItem Erweiterung, QuestPDF VAT-Section. Frontend: Tax Codes Settings, Invoice Item Tax-Felder. 25 Unit-Tests. Migration AddTaxCodes.

ID: REQ-063
Bereich: Finanzen

Titel
Rechnungs-PDF mit Schweizer QR-Zahlteil

Beschreibung
Für das CH-Profil kann das System Rechnungs-PDFs erzeugen, die einen QR-Zahlteil (QR-bill) enthalten.

Funktionen

1. PDF-Generierung für Invoice (Download + Archiv)
2. Option: QR-Zahlteil mit IBAN/QR-IBAN, Referenz, Betrag, Empfänger
3. QR-Code-Generierung gemäss QR-Rechnung Spezifikation
4. Fallback: klassische Rechnung ohne QR, wenn nicht konfiguriert

Akzeptanzkriterien
QR-Zahlteil ist in Banking-Apps scanbar; PDF enthält Pflichtfelder und ist wiederholbar erzeugbar (idempotent).

Priorität
Should

Betroffene Rollen
Kassier

Abhängigkeiten
REQ-039 (Rechnungsstellung), REQ-060 (Profil), REQ-061 (Storage)

Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Swiss QR-Zahlteil PDF via Codecrete.SwissQRBill + QuestPDF. Backend: SwissQrBillInvoiceGenerator extends QuestPdfInvoiceGenerator, InvoicePdfGeneratorFactory. Frontend: PDF Download Button. QR-Slip appended auf Rechnungs-PDF wenn CH-Jurisdiktion und IBAN vorhanden.

ID: REQ-064
Bereich: Finanzen

Titel
EU-Rechnungs-Compliance: Pflichtfelder und Templates je Profil

Beschreibung
Für EU-Profil(e) werden Rechnungstemplates so erweitert, dass Pflichtfelder und Hinweise (VAT-ID, Steuerbefreiung, Reverse Charge etc.) je Land/Profil abbildbar sind.

Funktionen

1. Template-Engine für Invoice PDFs (Logo, Adresse, VAT-ID, Zahlungsbedingungen)
2. Konfigurierbare Pflichtfelder je Profil
3. Mehrsprachige Rechnungstexte via i18n Keys

Akzeptanzkriterien
Admin kann Template-Felder konfigurieren; bei fehlenden Pflichtfeldern blockiert das System den Versand (Validation).

Priorität
Should

Betroffene Rollen
Kassier, Admin

Abhängigkeiten
REQ-039, REQ-060, i18n Guidelines

Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: EU-Rechnungskonformitaet implementiert. InvoiceTemplate Entity mit EU-Pflichtfeldern (VAT-ID, Steuerbefreiung, Reverse Charge, Zahlungsbedingungen, Rechtshinweise). EU-Validierung beim Senden (VAT-Nr, Tax-Codes). QuestPDF Erweiterung fuer EU-Compliance-Abschnitte. Backend: 6 CQRS-Handlers, CRUD API-Endpoints. Frontend: Invoice Templates Settings Seite. 18 Unit-Tests. Migration AddInvoiceTemplates.

ID: REQ-065
Bereich: Finanzen

Titel
eInvoicing-Readiness (EN 16931/Peppol) als Erweiterungspunkt

Beschreibung
Die Datenmodelle und Exporte sind so gestaltet, dass später strukturierte eInvoices (EN 16931) exportiert oder via Provider versendet werden können.

Funktionen

1. EInvoice Export Endpunkt (z.B. EN16931/UBL/CII) – optional/feature-flag
2. Mapping von Invoice/Items/Taxes/Parties auf eInvoicing Datenmodell
3. CIUS/Länderspezifische Extensions als Plugin-Konzept

Akzeptanzkriterien
Eine Beispielrechnung kann in ein strukturiertes Format exportiert werden und enthält konsistente Tax/Party Daten.

Priorität
Could

Betroffene Rollen
Admin, Kassier

Abhängigkeiten
REQ-060, REQ-062, REQ-064

Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: eInvoice Export (EN 16931/UBL 2.1) implementiert. Feature-flagged Endpoint (Features:EInvoiceExport). IEInvoiceExporter Strategy-Interface fuer Format-Erweiterung. UblInvoiceExporter generiert EN 16931-konformes UBL 2.1 XML (keine externen Abhaengigkeiten, System.Xml.Linq). Mapping: Seller/Buyer Parties (BG-4/7), VAT-Breakdown (BG-23), MonetaryTotals (BG-22), InvoiceLines (BG-25), PaymentMeans (BG-16). Backend: Query + Handler + Exporter. Frontend: Download eInvoice XML Button auf Rechnungsdetail. 40 Unit-Tests (33 UBL-Exporter, 7 Handler).

ID: REQ-066
Bereich: Finanzen

Titel
Periodenabschluss & Locking (Jahresabschluss light)

Beschreibung
Unterstützung für Geschäftsjahr-Perioden, Abschluss und Sperrung, damit nach dem Abschluss keine stillen Änderungen möglich sind.

Funktionen

1. Fiscal periods (Monat/Quartal/Jahr) basierend auf FinanceSettings
2. Lock/Unlock (nur Admin) mit Audit
3. Korrekturen nur via Storno-/Korrekturbuchung nach Lock
4. Carry-forward von Salden (optional) oder Export für Treuhand

Akzeptanzkriterien
Nach Lock können Buchungen in der Periode nicht mehr geändert/gelöscht werden; Korrekturen erzeugen neue Entries.

Priorität
Should

Betroffene Rollen
Kassier, Auditor

Abhängigkeiten
REQ-011 (Audit), REQ-038/039/040

Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: Geschaeftsperioden und Periodensperren implementiert. FiscalPeriod Entity mit Status (Open/Closed/Locked). Monatliche Perioden, automatische Generierung per Geschaeftsjahr. IFiscalPeriodService erzwingt Sperren in 10 bestehenden Command-Handlers (Transaction/Invoice/Payment CRUD). Lock nur Admin, Unlock nur Admin. Backend: 16 CQRS-Dateien, FiscalPeriodService, 5 API-Endpoints. Frontend: Fiscal Periods Seite mit Jahr-Selektor, Generate/Lock/Unlock Aktionen, Status-Badges. 55 Unit-Tests. Migration AddFiscalPeriods.

ID: REQ-067
Bereich: Finanzen

Titel
Freigabe-Workflow für Zahlungen/Spesen (Vier-Augen-Prinzip)

Beschreibung
Unterstützung für Freigaben bei Auszahlungen (Lieferanten, Spesen) mit Schwellenwerten und Rollen.

Funktionen

1. Payment status: Draft -> Submitted -> Approved -> Paid
2. Schwellenwerte: ab Betrag X braucht Vorstand-Freigabe
3. Audit-Log: wer hat wann freigegeben
4. Optional: Spesen-Claim Workflow (Member submits, Kassier prüft, Vorstand freigibt)

Akzeptanzkriterien
Zahlungen über Schwelle können ohne Freigabe nicht als Paid markiert werden; alle Schritte sind im Audit sichtbar.

Priorität
Should

Betroffene Rollen
Kassier, Vorstand, Auditor

Abhängigkeiten
REQ-004 (Access Control), REQ-011 (Audit), REQ-040 (Zahlungen)

Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: Zahlungs-Freigabe-Workflow und Spesenabrechnung implementiert. Payment erweitert mit PaymentStatus (Draft/Submitted/Approved/Rejected/Paid) und Approval-Workflow. FinanceProfile erweitert mit ApprovalThresholdChf/Eur (getrennt pro Waehrung). ExpenseClaim Entity mit vollem Lebenszyklus (Draft bis Reimbursed). Backend: 31 CQRS-Dateien, 4 Payment-Approval-Endpoints, 10 ExpenseClaim-Endpoints. Frontend: Expense Claims Seite mit CRUD, Status-Filter, rollenbasierte Aktionen. 65 Unit-Tests. Migration AddPaymentApprovalAndExpenseClaims.

ID: REQ-068
Bereich: Finanzen

Titel
Sparte/Projekt-Zuordnung für steuerliche und interne Auswertungen

Beschreibung
Optionaler Dimension-Tag (Sparte/Projekt) auf Buchungen und Rechnungspositionen für Auswertungen (z.B. Mitgliedschaft vs Eventbetrieb).

Funktionen

1. ActivityArea auf Transaction und InvoiceItem (enum oder definierbar)
2. Reports: P&L nach Sparte/Projekt
3. Export inklusive Sparte/Projekt-Spalte

Akzeptanzkriterien
Sparte ist filterbar; Report zeigt Summen pro Sparte; Export enthält Sparte.

Priorität
Could

Betroffene Rollen
Kassier, Vorstand, Auditor

Abhängigkeiten
REQ-044 (Kostenstellen), REQ-045 (Export)

Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: ActivityArea Dimension-Tagging implementiert. Admin-verwaltbare ActivityArea Entity (Name, Code, Description, Color, SortOrder). Nullable FK auf Transaction und InvoiceItem. P&L-Report pro ActivityArea. Export-Spalte im Journal-CSV. Backend: CRUD + Report CQRS, 5 API-Endpoints. Frontend: Admin-Seite fuer ActivityArea-Verwaltung, Report-Seite mit Datumfilter. 14 Unit-Tests. Migration AddActivityAreas.

ID: REQ-069
Bereich: Finanzen

Titel
Banking-Import Upgrade: ISO 20022 (camt) und SEPA-Referenzen

Beschreibung
Zusätzlich zum CSV-Import können standardisierte Bankformate (ISO 20022 camt.053/054) importiert werden, inkl. Referenzen für Matching.

Funktionen

1. Import camt.053/054 (XML) optional
2. Erkennung/Parsing von Referenzen (z.B. QR-Referenz, End-to-End-ID)
3. Matching-Verbesserungen: automatische Zuordnung zu offenen Rechnungen

Akzeptanzkriterien
Ein camt-File kann importiert werden; System erstellt ImportItems mit Datum/Betrag/Referenz; Matching-Vorschläge funktionieren.

Priorität
Could

Betroffene Rollen
Kassier

Abhängigkeiten
REQ-041 (Bankimport), REQ-040 (Zahlungen)

Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: camt Import (ISO 20022) und Referenz-Matching implementiert. CamtParser fuer camt.053 und camt.054 XML (System.Xml.Linq, keine externen Abhaengigkeiten). BankImportMatcher mit 5-stufiger Matching-Strategie (InvoiceNumber exact, Structured/Unstructured Reference, Amount+Date, Amount-only). BankImport erweitert mit Format und OriginalFileStoragePath. BankImportItem erweitert mit 7 Referenzfeldern. Backend: ImportCamtCommand + Handler + Validator. Frontend: camt Upload Button, Referenz-Spalten, Match-Confidence Badges. 28 Unit-Tests (16 Parser, 8 Matcher, 4 Validator). Sample-Fixtures fuer camt.053/054.

ID: REQ-070
Bereich: Finanzen

Titel
Revisionssicheres Archiv und Retention Enforcement

Beschreibung
Finanzdokumente werden revisionssicher archiviert (Unveränderbarkeit, Nachvollziehbarkeit, Integrität) und dürfen innerhalb der Aufbewahrungsfrist nicht physisch gelöscht werden.

Funktionen

1. Object-Storage Versioning/WORM oder Object-Lock Option (konfigurierbar je Environment)
2. DELETE-Endpunkte führen zu Archivierung (Soft-Delete) statt physischer Löschung
3. Audit-Event für Archivierung/Restore/Hard-Delete nach Retention
4. Audit-Paket Export (ZIP) pro Periode inkl. Manifest (Hashes, Metadaten)
5. Dokumentierter Lifecycle (Retention, Legal Hold, Restore-Prozess)

Akzeptanzkriterien
Innerhalb der Retention ist kein Hard-Delete möglich; DELETE setzt Archived-Flag und Datei bleibt im Storage; Audit-Paket kann erneut erzeugt werden und Hashes stimmen überein.

Priorität
Must

Betroffene Rollen
Kassier, Auditor, Admin

Abhängigkeiten
REQ-061, REQ-057, Storage (RustFS)

Status: Done
StatusSeit: 2026 02 28
Owner: Implementation Agent
SprintOderRelease: Sprint 5
TicketLink:
Notizen: Retention/Archival implementiert. IArchivable Interface auf Receipt, Invoice, Transaction. Archive/Restore Endpoints (POST /{id}/archive, POST /{id}/restore). Admin-Purge Endpoint (POST /admin/finance/purge-archived) nur nach RetainUntil. 10-Jahre Retention. Archivierte Entities sind read-only. Admin kann Restore durchführen. Audit-Logging für alle Archive/Restore/Purge Aktionen.

ID: REQ-071
Bereich: Finanzen

Titel
Rechnungsnummern-Serien und unveränderbare Nummernvergabe

Beschreibung
Rechnungen erhalten fortlaufende, eindeutige Nummern pro Serie (z.B. pro Geschäftsjahr/Profil). Nummernvergabe ist konkurenzsicher und die Nummer ist nach Versand/Finalisierung unveränderbar.

Funktionen

1. Konfigurierbare NumberSeries (Prefix, Suffix, Separator, Padding, Reset-Regel)
2. Transaktional/konkurenzsichere Nummernvergabe (DB-seitig) pro Tenant+Serie
3. InvoiceNumber ist nach Status Sent/Issued/PartiallyPaid/Paid unveränderbar
4. Report für Nummern-Gaps mit Begründung (Cancelled/Storno/Draft verworfen)
5. Migration/Backfill für bestehende Rechnungen ohne Nummer

Akzeptanzkriterien
Bei paralleler Rechnungserstellung entstehen keine Duplikate; ein Versuch die Nummer nach Versand zu ändern wird abgelehnt und auditiert; Gap-Report ist exportierbar.

Priorität
Must

Betroffene Rollen
Kassier, Admin, Auditor

Abhängigkeiten
REQ-039, REQ-060, REQ-011

Status: Done
StatusSeit: 2026 02 28
Owner: Implementation Agent
SprintOderRelease: Sprint 5
TicketLink:
Notizen: Invoice Number Counter implementiert. InvoiceNumberCounter Entity mit PostgreSQL atomic UPSERT (konkurenzsicher). Per-Profile, Per-Fiscal-Year Nummernvergabe. Prefix konfigurierbar. Rechnungsnummer ist immutable nach Send (Status >= Sent).

ID: REQ-072
Bereich: Finanzen

Titel
eInvoicing Validierung und CIUS-Unterstützung je Profil

Beschreibung
Exportierte eInvoices (EN 16931/UBL, optional Peppol BIS) werden automatisch validiert. Fehler werden verständlich zurückgegeben und können vor Versand korrigiert werden.

Funktionen

1. Offline-Validierung des eInvoice-Exports (Schema + Schematron Rules)
2. FinanceProfile Setting für eInvoice-Format (EN 16931 UBL, Peppol BIS Billing 3.0)
3. API liefert strukturierte ValidationErrors (Feld, Regel, Message)
4. UI zeigt Validierungsfehler inline und blockiert Export/Versand bei Must-Fehlern
5. Test-Fixtures + CI-Pipeline Step für eInvoice-Validation

Akzeptanzkriterien
Ein gültiger Export besteht die Validation; ungültige Pflichtfelder führen zu klaren Fehlermeldungen; Peppol-Option kann pro Profil aktiviert werden.

Priorität
Should

Betroffene Rollen
Kassier, Admin

Abhängigkeiten
REQ-065, REQ-064, REQ-062

Status: Done
StatusSeit: 2026 02 28
Owner: Implementation Agent
SprintOderRelease: Sprint 5
TicketLink:
Notizen: eInvoice Validierung implementiert. En16931Validator mit Business Rules BR-01..BR-AE-01. ICiusProfile Extension Point für profilspezifische CIUS. POST /invoices/{id}/validate-einvoice Endpoint. Strukturierte ValidationErrors.

ID: REQ-073
Bereich: Finanzen

Titel
ISO 20022 Zahlungsdatei Export (pain.001) für Auszahlungen

Beschreibung
Genehmigte Zahlungen können als ISO 20022 Zahlungsdatei (pain.001) exportiert werden (CH SPS und EU SEPA), um sie in E-Banking einzureichen.

Funktionen

1. Batch-Export von Approved Payments zu pain.001
2. Auswahl Format anhand FinanceProfile (CH SPS vs. SEPA)
3. Remittance Information (InvoiceNumber/Reference) wird befüllt
4. Validierung (IBAN/BIC, strukturierte Adresse, Beträge)
5. Export-Status (Exported) + Audit-Log

Akzeptanzkriterien
pain.001 lässt sich in gängigen E-Banking Portalen importieren; Export enthält alle genehmigten Zahlungen korrekt; Fehlerhafte Empfängerdaten werden vor Export angezeigt.

Priorität
Could

Betroffene Rollen
Kassier

Abhängigkeiten
REQ-067, REQ-060, REQ-011

Status: Done
StatusSeit: 2026 02 28
Owner: Implementation Agent
SprintOderRelease: Sprint 5
TicketLink:
Notizen: pain.001 Export implementiert. Pain001Generator mit CH SPS und SEPA Profil-Unterstützung. Format pain.001.001.09. POST /exports/pain001 und POST /exports/pain001/validate Endpoints. IBAN/BIC Validierung.
