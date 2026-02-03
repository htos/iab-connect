Titel
Requirements Status

Regeln
1) Quelle der Requirements Inhalte ist docs/Anforderungen_WebApp_Indischer_Kulturverein.csv
2) Quelle des Status ist dieses Dokument
3) Matching erfolgt über die Spalte ID aus der CSV
4) Erlaubte Status Werte sind Backlog, Ready, InProgress, Blocked, Done, Dropped
5) Wenn ein Status fehlt, gilt Backlog

Status Einträge

ID: REQ-001
Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Login via Keycloak implementiert. Backend: JWT-Authentifizierung mit Rollenmapping. Frontend: NextAuth.js mit Keycloak-Provider, Login-Seite, rollenbasierte Navigation. Manuelle Tests in docs/06_dev_workflow.md dokumentiert.

ID: REQ-002
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Benutzerverwaltung über Keycloak Admin API. Backend: KeycloakAdminService mit Service Account, User-Endpoints für CRUD, Rollen-Management, Passwort-Reset. Frontend: User-Liste mit Suche/Pagination, Create/Edit-Seiten mit Rollenzuweisung, Enable/Disable-Funktion. Setup: iabconnect-admin Client in Keycloak erforderlich mit realm-management Rollen.

ID: REQ-003
Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Implementiert als Teil von REQ-001. Drei Rollen (admin, vorstand, member) mit entsprechenden Authorization Policies im Backend und rollenbasierter UI im Frontend.

ID: REQ-004
Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Feingranulare Zugriffskontrolle implementiert. Permission-System mit 40+ Berechtigungen (CRUD pro Resource). Rollenbasiertes Permission-Mapping (admin, vorstand, kassier, event-manager, member). Resource-basierte Autorisierung mit Ownership-Checks (User kann nur eigene Daten bearbeiten). Security Audit Logger für alle Zugriffsentscheidungen. IAuthorizationService und ISecurityAuditLogger in Application Layer.

ID: REQ-005
Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: SSO via Keycloak OIDC implementiert als Teil von REQ-001 (Login). iabconnect-frontend Client für Browser-Flow, iabconnect-backend Client für Backend-Validierung. Realm-Export in infra/keycloak/realms/ verfügbar.

ID: REQ-006
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-007
Status: Done
StatusSeit: 2026 01 30
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Registrierung und Onboarding implementiert. (1) Selbstregistrierung mit Admin-Freischaltung via Keycloak disable-new-users Event Listener. (2) Einladung per Mail-Link via SendInvitation-Option bei User-Erstellung. (3) Onboarding-Checkliste: Profile-Status Endpoint prüft Profilabschluss (Adresse, Telefon). OnboardingBanner-Komponente zeigt Fortschritt auf Dashboard an.

ID: REQ-008
Status: Done
StatusSeit: 2026 01 30
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Passwort Reset und Account Recovery implementiert. (1) Self-Service Reset: "Passwort vergessen?" Link auf Login-Seite leitet zu Keycloak's Reset-Flow weiter. Keycloak sendet Reset-Link per E-Mail (via Mailhog in dev). Link ist einmalig und zeitlich begrenzt (Keycloak Standard: 12h). (2) Admin-Reset: Admins können über Benutzerverwaltung Passwort-Reset-E-Mails versenden. (3) Rate Limiting: Keycloak Brute Force Protection ist aktiviert (bruteForceProtected: true im Realm).

ID: REQ-009
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-010
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-011
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Audit Log für Sicherheits- und Datenänderungen implementiert. Backend: (1) AuditEvent Entity mit EventType, Category, Severity, User/IP-Tracking. (2) IAuditService für Logging mit automatischer IP/UserAgent-Erfassung. (3) AuditEndpoints mit GET /api/v1/audit (paginiert + Filter), /export (CSV), /entity/{type}/{id}, /user/{userId}. (4) Integration in SecurityAuditLogger - alle Access-Events werden persistiert. Frontend: Audit-Log Seite unter /audit mit Tabelle, Filtern, und CSV-Export. Admin-only Zugriff via /admin Dashboard. BEKANNTE EINSCHRÄNKUNG: Login-Tracking über Frontend (LoginTracker) funktioniert noch nicht zuverlässig - muss später überarbeitet werden. Auditierte Aktionen: Member Create/Update/Delete/StatusChange/TypeChange, Access Granted/Denied Events.

ID: REQ-012
Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: DSGVO/Datenschutz-Compliance implementiert. (1) Einwilligungsverwaltung: Consent Entity mit 5 Typen (DataProcessing erforderlich, Newsletter, Marketing, EventNotifications, PhotoUsage). API-Endpunkte: GET/PUT /privacy/consents (Übersicht + Bulk-Update), POST/DELETE /privacy/consents/{type}. (2) Datenexport (Art. 20): GET /privacy/export liefert alle Benutzerdaten (Profil, Einwilligungen, Audit-Log) als JSON. (3) Recht auf Löschung (Art. 17): DeletionRequest Entity mit Workflow (Pending→Confirmed→UnderReview→Completed/Cancelled/Rejected). Bestätigungs-Token per E-Mail. Admin-Endpunkte zur Bearbeitung. Anonymisierung statt Löschung für Audit-Compliance. (4) Tests: 20 Unit-Tests (Consent, DeletionRequest), 15 Integrationstests (ConsentRepository, DeletionRequestRepository mit Testcontainers).

ID: REQ-013
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Mitgliederstammdaten implementiert. Domain: Member-Aggregat mit Address-Value-Object. API: 10 Endpunkte (CRUD, Status, Type, Statistics). Frontend: Mitgliederliste, Detail-, Bearbeitungs- und Erstellungsseiten.

ID: REQ-014
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: MembershipType (Regular, Student, Family, Honorary) und MembershipStatus (Pending, Active, Inactive, Suspended) als Enums implementiert. UI zeigt farbcodierte Badges.

ID: REQ-015
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Implementiert als Teil von REQ-013. Neues Mitglied kann über /members/new erstellt werden. Status wird auf Pending gesetzt, kann vom Vorstand über Detailseite geändert werden.

ID: REQ-016
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Mitgliederliste: /members mit Suche, Filter nach Status/Typ, Paginierung. Detailansicht: /members/[id]. Self-Service Profil: /profile (für Mitglieder-Rolle).

ID: REQ-017
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-018
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-019
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Eventverwaltung vollständig implementiert. Backend: (1) Event-Entity mit umfassenden Properties (Titel, Beschreibung, Ort, Datum/Zeit, Kategorie, Sichtbarkeit, Status, Anmeldung, Kosten, Kontakt). (2) EventEnums: EventVisibility (MembersOnly/Public/InviteOnly/Hidden), EventStatus (Draft/Published/Cancelled/Completed), EventCategory (11 Typen), RecurrencePattern. (3) IEventRepository mit EventFilterOptions für flexible Abfragen. (4) EventEndpoints: 12 Endpunkte (Public: GET /events/public, /events/public/{id}; Protected: CRUD, /upcoming, /statistics, /publish, /unpublish, /cancel). Frontend: (1) /events - Event-Liste mit Listen- und Kalenderansicht, Filter nach Status/Kategorie, Paginierung. (2) /events/[id] - Detailseite mit Aktionen (Publish/Unpublish/Cancel/Delete). (3) /events/new und /events/[id]/edit - Formulare für Event-Erstellung und -Bearbeitung. (4) events.ts Service mit 13 API-Funktionen und Utility-Helpers. Tests: 58 Unit-Tests für Event-Entity (Creation, Updates, State Transitions, Validations).

ID: REQ-020
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Event-Anmeldung (RSVP) vollständig implementiert. Backend: (1) EventRegistration-Entity mit Factory-Methods (CreateForMember, CreateForGuest, CreateWaitlisted), State-Transitions (Confirm, Cancel, CheckIn, MarkAsNoShow, MoveToWaitlist, PromoteFromWaitlist), QR-Code-Token-Generierung. (2) RegistrationStatus-Enum (Pending, Confirmed, Cancelled, Waitlisted, CheckedIn, NoShow). (3) IEventRegistrationRepository mit Filter- und Statistik-Funktionen. (4) EventRegistrationEndpoints: 15+ Endpunkte (Public: POST /public; Protected: CRUD, /cancel, /confirm, /check-in, /no-show, /statistics, /waitlist, /promote-from-waitlist, /check-in/{qrCodeToken}, /my-registrations). Frontend: (1) EventRegistration-Komponente für Anmeldeformular. (2) EventParticipantsList-Komponente für Admin-Verwaltung mit Filter, Export. (3) MyRegistrations-Komponente für persönliche Anmeldungen. (4) EventCheckIn-Komponente für QR-Code-Scan. (5) EventTicket-Komponente für Ticket-Anzeige. (6) events.ts Service erweitert mit 15+ Registration-Funktionen. Tests: 41 Unit-Tests für EventRegistration-Entity, alle bestanden.

ID: REQ-021
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-022
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-023
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-024
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-025
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-026
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: E-Mail Verwaltung / Automatisiertes Mailing vollständig implementiert. Backend: (1) EmailCampaign-Entity mit Factory-Method, State-Transitions (Draft→Scheduled→Sending→Sent/Cancelled/Failed), Statistiken (TotalRecipients, SentCount, DeliveredCount, OpenedCount, ClickedCount, BouncedCount, FailedCount). (2) EmailRecipient-Entity mit Status-Tracking (Pending→Sent→Delivered→Opened→Clicked/Bounced/Failed), Bounce-Typen. (3) Enums: EmailCampaignStatus, EmailRecipientStatus, BounceType, RecipientSegmentType. (4) IEmailCampaignRepository mit Filter, Paginierung, Statistik-Abfragen. (5) IEmailSender Interface mit SmtpEmailSender-Implementation für Mailhog (dev). (6) EmailCampaignEndpoints: 13 API-Endpunkte (CRUD, /send, /test, /schedule, /cancel, /recipients, /recipients/preview, /statistics). (7) EF Core Configurations mit Indizes auf Status, CreatedAt, ScheduledAt. Migration AddEmailCampaigns erstellt und angewendet. Frontend: (1) /email-campaigns - Kampagnenliste mit Status-Filter, Paginierung, Statistik-Anzeige. (2) /email-campaigns/new - Kampagnen-Erstellung mit Absender, Empfängergruppe, HTML-Editor. (3) /email-campaigns/[id] - Detailseite mit Test-E-Mail, Planen, Jetzt-Senden Aktionen, Empfängerliste, Statistiken. (4) email-campaigns.ts Types und Helpers. (5) Navigation-Link in Sidebar unter "Kommunikation". Tests: 12 Unit-Tests für EmailCampaign-Entity (Create, Update, Schedule, StartSending, CompleteSending, Cancel, AddRecipient, UpdateStatistics), alle bestanden.

ID: REQ-027
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Email Template Editor komplett implementiert. Backend: (1) EmailTemplate-Entity mit int ID, CRUD-Repository, 7 API-Endpoints (GET all/by-id/by-category, POST create, PUT update, DELETE, POST preview, POST deactivate). (2) Support für Variablen mit {{variable}} Syntax, Auto-Rendering für HTML und Subject. (3) Migration für PostgreSQL Datenbank erstellt. Frontend: (1) TypeScript Types und API-Service für Vorlagen. (2) Admin-Seite /email-templates mit Suche, Paginierung, Filter. (3) Create/Edit Formular mit HTML-Editor und Variablen-Management. (4) Live-Vorschau mit Variable-Rendering. Tests: 6 Unit-Tests für EmailTemplate-Entity (Create, Update, Rendering, Variables).

ID: REQ-028
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-029
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-030
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-031
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-032
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-033
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-034
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-035
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-036
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-037
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-038
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-039
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-040
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-041
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-042
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-043
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-044
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-045
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-046
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-047
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-048
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-049
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-050
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-051
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-052
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-053
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-054
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-055
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-056
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-057
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-058
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-059
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:
