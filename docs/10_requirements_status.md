Titel
Requirements Status

Regeln

1. Quelle der Requirements Inhalte ist docs/Anforderungen_WebApp_Indischer_Kulturverein.csv
2. Quelle des Status ist dieses Dokument
3. Matching erfolgt über die Spalte ID aus der CSV
4. Erlaubte Status Werte sind Backlog, Ready, InProgress, Blocked, Done, Dropped
5. Wenn ein Status fehlt, gilt Backlog

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
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 5
TicketLink:
Notizen: Sponsorenverwaltung implementiert. Backend: Sponsor-Aggregat mit Packages, ContractLinks, Status-Workflow, CRUD-Endpoints. Frontend: Sponsoren-Liste, Erstellen/Bearbeiten, Sidebar-Navigation, i18n (de/en).

ID: REQ-032
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 5
TicketLink:
Notizen: Lieferantenverwaltung implementiert. Backend: Supplier-Aggregat mit Category, ContractLinks, Status-Workflow, CRUD-Endpoints. Frontend: Lieferanten-Liste, Erstellen/Bearbeiten, Sidebar-Navigation, i18n (de/en).

ID: REQ-033
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 5
TicketLink:
Notizen: Vertragsverknüpfung implementiert. ContractLink-Entity verknüpft Sponsoren/Lieferanten mit Dokumenten, Rechnungen und Events. API-Endpoints für CRUD von ContractLinks auf beiden Entitäten.

ID: REQ-034
Status: Done
StatusSeit: 2026 02 14
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Dokumentenverwaltung implementiert. Backend: Document-Aggregat mit Folder-Hierarchie, DocumentVersion, DocumentTag. S3-kompatibler Storage (RustFS) für Datei-Upload/Download. API-Endpunkte für CRUD, Upload, Download, Versionen, Tags, Ordner. Frontend: Dokumenten-Seite mit Ordner-Navigation, Upload, Download, Vorschau.

ID: REQ-035
Status: Done
StatusSeit: 2026 02 14
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Dokumentrechte und Freigabe implementiert. FolderPermission-Entity mit rollenbasierter Zugriffskontrolle (Read, Write, Manage) pro Ordner. Document-Status-Workflow (Draft→UnderReview→Published/Archived) mit Freigabe durch Vorstand/Admin.

ID: REQ-036
Status: Done
StatusSeit: 2026 02 14
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Dokumenten-Versionierung implementiert. DocumentVersion-Entity mit version_number, storage_key, file_size, content_type, comment. Automatische Versionsnummer-Inkrementierung bei Upload. Ältere Versionen bleiben im Storage erhalten und können heruntergeladen werden.

ID: REQ-037
Status: Done
StatusSeit: 2026 02 14
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Volltextsuche und Tags für Dokumente implementiert. DocumentTag-Entity für flexible Verschlagwortung. Such-Endpunkt mit Filter nach Name, Kategorie, Tags, Status, Ordner. Frontend: Tag-Management in Dokumenten-Detailansicht, Suche über alle Dokumenten-Metadaten.

ID: REQ-038
Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Finance Module Grundstruktur implementiert. Backend: 10 Domain Entities (Account, Category, Transaction, Invoice, InvoiceItem, Payment, BankImport, BankImportItem, DunningNotice, Receipt), EF Core Configs, 8 Repository-Interfaces + Implementierungen, 9 Endpoint-Dateien, EF Migration. Frontend: Dashboard mit KPIs, Quick Links, 12 Seiten. Rollen: kassier (Vollzugriff), auditor (Lesezugriff). Auth-Policies: RequireFinanceRead, RequireFinanceWrite.

ID: REQ-039
Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Einnahmen/Ausgaben erfassen implementiert. Backend: Transaction CRUD Endpoints mit Summary, Account/Category Management. Frontend: Transactions-Seite mit Filtern (Datum, Typ, Konto, Kategorie), CRUD Modal, Accounts-Seite mit Sortierung, Categories-Seite mit Farbauswahl. Belege-Upload via Receipts-Seite mit FormData-Upload.

ID: REQ-040
Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Rechnungserstellung implementiert. Backend: Invoice CRUD mit Status-Workflow (Draft→Sent→Paid/Overdue/Cancelled), InvoiceItem, automatische Rechnungsnummer (INV-YYYY-NNNN). Frontend: Rechnungsliste mit Statusfilter, Detailseite mit Positionen/Zahlungsverlauf, Neue Rechnung mit dynamischen Positionen und automatischer Berechnung.

ID: REQ-041
Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Zahlungsverwaltung implementiert. Backend: Payment CRUD mit automatischer Invoice-Markierung als bezahlt. Frontend: Payments-Seite mit Tabs (Offene Posten / Alle Zahlungen), Zahlungserfassung mit Methodenauswahl (Bank/Bar/Karte).

ID: REQ-042
Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Bank-Import implementiert. Backend: BankImport/BankImportItem Entities, Upload-Endpoint (POST), GetAll (GET), Match/Ignore/Unmatch (PUT). Frontend: Bank-Import-Seite mit CSV-Upload via FormData, Import-Verlauf, Item-Ansicht mit Zuordnungs-Aktionen.

ID: REQ-043
Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Mahnwesen implementiert. Backend: DunningNotice Entity mit Level (1-3), Status-Workflow (Draft→Sent), Create und Send Endpoints. Frontend: Dunning-Seite mit Mahnungsliste, Erstellen-Modal mit überfälligen Rechnungen, Level-Badges, Senden-Aktion.

ID: REQ-044
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-045
Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Buchhaltungsexport implementiert. Backend: FinanceExportEndpoints mit Journal-CSV und Offene-Posten-CSV (RequireFinanceRead). Frontend: Export-Seite mit zwei Export-Karten (Journal mit Datumsbereich, Offene Posten), CSV-Download via Blob mit automatischer Content-Type-Erkennung.

ID: REQ-046
Status: Done
StatusSeit: 2026 03 03
Owner: Implementation Agent
SprintOderRelease: Sprint 7
TicketLink:
Notizen: Öffentliche Eventseite implementiert. Frontend: /public/events Listenansicht mit Suchfeld und Kategoriefilter, /public/events/[id] Detailseite mit Registrierungsformular (Name, Email, Telefon, Gästeanzahl, Anforderungen). Backend: nutzt bestehende /api/v1/events/public Endpoints. Responsive Design mit PublicHeader und PublicFooter. i18n (de/en).

ID: REQ-047
Status: Done
StatusSeit: 2026 03 03
Owner: Implementation Agent
SprintOderRelease: Sprint 7
TicketLink:
Notizen: Blog/News System implementiert. Backend: BlogPost Domain-Entity (AggregateRoot) mit Title, Slug (auto-generiert mit deutscher Umlaute-Transliteration), Content, Excerpt, Author, Category, Tags, Status (Draft/Published/Archived). BlogPostRepository, EF-Config (Tags als comma-separated string), Admin CRUD + Publish/Unpublish/Archive Endpoints. Public Endpoints: GET /api/v1/blog/public (nur published), GET /api/v1/blog/public/{id}. Frontend: /public/blog Listenansicht, /public/blog/[id] Detailseite. 14 Unit-Tests + 14 Repository-Integration-Tests.

ID: REQ-048
Status: Done
StatusSeit: 2026 03 03
Owner: Implementation Agent
SprintOderRelease: Sprint 7
TicketLink:
Notizen: Öffentliche Sponsorenseite implementiert. Frontend: /public/sponsors zeigt aktive Sponsoren gruppiert nach Tier (Platinum/Gold/Silver/Bronze/Basic) mit Firmenname, Beschreibung, Logo, Website-Link und Packages. CTA-Section für Sponsoring-Anfragen mit Link zum Kontaktformular. Backend: Neuer Public-Endpoint GET /api/v1/sponsors/public mit PublicSponsorDto und PublicSponsorPackageDto (nur aktive Sponsoren, kein Auth erforderlich). i18n (de/en).

ID: REQ-049
Status: Done
StatusSeit: 2026 03 03
Owner: Implementation Agent
SprintOderRelease: Sprint 7
TicketLink:
Notizen: Kontaktformular mit Spam-Schutz implementiert. Backend: ContactMessage Domain-Entity (AggregateRoot) mit Name, Email, Subject, Message, Status (New/Read/Responded/Archived), MarkAsRead/MarkAsResponded/Archive. ContactMessageRepository, EF-Config. Public Endpoint: POST /api/v1/public/contact mit Honeypot-Spam-Schutz (verstecktes "website" Feld). Admin Endpoints: GET/POST-read/POST-respond/POST-archive/DELETE unter /api/v1/contact-messages (RequireVorstand). Frontend: /public/contact Zwei-Spalten-Layout (Formular + Kontakt-Info Sidebar mit Email, Telefon, Adresse, Öffnungszeiten). 9 Unit-Tests + 11 Repository-Integration-Tests.

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
Status: Done
StatusSeit: 2026 02 03
Owner: Implementation Agent
SprintOderRelease: Sprint 2
TicketLink:
Notizen: Admin-Konfiguration implementiert. Backend: SystemSettings Entity (ApplicationName, LogoText, LogoBackgroundColor, LogoTextColor), SettingsEndpoints (GET/PUT + Public GET), CustomRole Entity mit CRUD. Frontend: /admin/settings mit zwei Tabs (Allgemein + Benutzerdefinierte Rollen), AppSettingsProvider Context für dynamisches Branding in Header/Sidebar/Navigation.

ID: REQ-060
Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: FinanceProfile Entity (CH/EU Jurisdiktion, Waehrung, Org-Details). Backend: CQRS-Handlers, API-Endpoints, EF-Config. Frontend: Finance Settings Seite. 17 Unit-Tests. Migration AddFinanceProfile.

ID: REQ-061
Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Receipt-Storage via S3/RustFS mit SHA256-Integrity und File-Type-Validation. Backend: 5 CQRS-Handlers, 5 API-Endpoints. Frontend: Receipt Upload/Download UI. 14 Unit-Tests. Migration AddReceiptStorage.

ID: REQ-062
Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: VAT/MWST mit konfigurierbaren TaxCodes, Per-Item-Tax auf InvoiceItem, VAT-Summary im PDF und Export. Backend: TaxCode CRUD, InvoiceItem Erweiterung, QuestPDF VAT-Section. Frontend: Tax Codes Settings, Invoice Item Tax-Felder. 25 Unit-Tests. Migration AddTaxCodes.

ID: REQ-063
Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Swiss QR-Zahlteil PDF via Codecrete.SwissQRBill + QuestPDF. Backend: SwissQrBillInvoiceGenerator extends QuestPdfInvoiceGenerator, InvoicePdfGeneratorFactory. Frontend: PDF Download Button. QR-Slip appended auf Rechnungs-PDF wenn CH-Jurisdiktion und IBAN vorhanden.

ID: REQ-064
Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: EU-Rechnungskonformitaet implementiert. InvoiceTemplate Entity mit EU-Pflichtfeldern (VAT-ID, Steuerbefreiung, Reverse Charge, Zahlungsbedingungen, Rechtshinweise). EU-Validierung beim Senden (VAT-Nr, Tax-Codes). QuestPDF Erweiterung fuer EU-Compliance-Abschnitte. Backend: 6 CQRS-Handlers, CRUD API-Endpoints. Frontend: Invoice Templates Settings Seite. 18 Unit-Tests. Migration AddInvoiceTemplates.

ID: REQ-065
Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: eInvoice Export (EN 16931/UBL 2.1) implementiert. Feature-flagged Endpoint (Features:EInvoiceExport). IEInvoiceExporter Strategy-Interface fuer Format-Erweiterung. UblInvoiceExporter generiert EN 16931-konformes UBL 2.1 XML (keine externen Abhaengigkeiten, System.Xml.Linq). Mapping: Seller/Buyer Parties (BG-4/7), VAT-Breakdown (BG-23), MonetaryTotals (BG-22), InvoiceLines (BG-25), PaymentMeans (BG-16). Backend: Query + Handler + Exporter. Frontend: Download eInvoice XML Button auf Rechnungsdetail. 40 Unit-Tests (33 UBL-Exporter, 7 Handler).

ID: REQ-066
Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: Geschaeftsperioden und Periodensperren implementiert. FiscalPeriod Entity mit Status (Open/Closed/Locked). Monatliche Perioden, automatische Generierung per Geschaeftsjahr. IFiscalPeriodService erzwingt Sperren in 10 bestehenden Command-Handlers (Transaction/Invoice/Payment CRUD). Lock nur Admin, Unlock nur Admin. Backend: 16 CQRS-Dateien, FiscalPeriodService, 5 API-Endpoints. Frontend: Fiscal Periods Seite mit Jahr-Selektor, Generate/Lock/Unlock Aktionen, Status-Badges. 55 Unit-Tests. Migration AddFiscalPeriods.

ID: REQ-067
Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: Zahlungs-Freigabe-Workflow und Spesenabrechnung implementiert. Payment erweitert mit PaymentStatus (Draft/Submitted/Approved/Rejected/Paid) und Approval-Workflow. FinanceProfile erweitert mit ApprovalThresholdChf/Eur (getrennt pro Waehrung). ExpenseClaim Entity mit vollem Lebenszyklus (Draft bis Reimbursed). Backend: 31 CQRS-Dateien, 4 Payment-Approval-Endpoints, 10 ExpenseClaim-Endpoints. Frontend: Expense Claims Seite mit CRUD, Status-Filter, rollenbasierte Aktionen. 65 Unit-Tests. Migration AddPaymentApprovalAndExpenseClaims.

ID: REQ-068
Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: ActivityArea Dimension-Tagging implementiert. Admin-verwaltbare ActivityArea Entity (Name, Code, Description, Color, SortOrder). Nullable FK auf Transaction und InvoiceItem. P&L-Report pro ActivityArea. Export-Spalte im Journal-CSV. Backend: CRUD + Report CQRS, 5 API-Endpoints. Frontend: Admin-Seite fuer ActivityArea-Verwaltung, Report-Seite mit Datumfilter. 14 Unit-Tests. Migration AddActivityAreas.

ID: REQ-069
Status: Done
StatusSeit: 2026 02 16
Owner: Implementation Agent
SprintOderRelease: Sprint 4
TicketLink:
Notizen: camt Import (ISO 20022) und Referenz-Matching implementiert. CamtParser fuer camt.053 und camt.054 XML (System.Xml.Linq, keine externen Abhaengigkeiten). BankImportMatcher mit 5-stufiger Matching-Strategie (InvoiceNumber exact, Structured/Unstructured Reference, Amount+Date, Amount-only). BankImport erweitert mit Format und OriginalFileStoragePath. BankImportItem erweitert mit 7 Referenzfeldern. Backend: ImportCamtCommand + Handler + Validator. Frontend: camt Upload Button, Referenz-Spalten, Match-Confidence Badges. 28 Unit-Tests (16 Parser, 8 Matcher, 4 Validator). Sample-Fixtures fuer camt.053/054.

ID: REQ-070
Status: Done
StatusSeit: 2026 02 28
Owner: Implementation Agent
SprintOderRelease: Sprint 5
TicketLink:
Notizen: Retention/Archival implementiert. IArchivable Interface auf Receipt, Invoice, Transaction. Archive/Restore Endpoints (POST /{id}/archive, POST /{id}/restore). Admin-Purge Endpoint (POST /admin/finance/purge-archived) nur nach RetainUntil. 10-Jahre Retention. Archivierte Entities sind read-only. Admin kann Restore durchführen. Audit-Logging für alle Archive/Restore/Purge Aktionen.

ID: REQ-071
Status: Done
StatusSeit: 2026 02 28
Owner: Implementation Agent
SprintOderRelease: Sprint 5
TicketLink:
Notizen: Invoice Number Counter implementiert. InvoiceNumberCounter Entity mit PostgreSQL atomic UPSERT (konkurenzsicher). Per-Profile, Per-Fiscal-Year Nummernvergabe. Prefix konfigurierbar. Rechnungsnummer ist immutable nach Send (Status >= Sent).

ID: REQ-072
Status: Done
StatusSeit: 2026 02 28
Owner: Implementation Agent
SprintOderRelease: Sprint 5
TicketLink:
Notizen: eInvoice Validierung implementiert. En16931Validator mit Business Rules BR-01..BR-AE-01. ICiusProfile Extension Point für profilspezifische CIUS. POST /invoices/{id}/validate-einvoice Endpoint mit strukturierten ValidationErrors. Validierung prüft Pflichtfelder, VAT-Breakdown, MonetaryTotals.

ID: REQ-073
Status: Done
StatusSeit: 2026 02 28
Owner: Implementation Agent
SprintOderRelease: Sprint 5
TicketLink:
Notizen: pain.001 Export implementiert. Pain001Generator mit CH SPS und SEPA Profil-Unterstützung. Format pain.001.001.09. POST /exports/pain001 (Export) und POST /exports/pain001/validate (Validierung) Endpoints. Remittance Information (InvoiceNumber/Reference) wird befüllt. IBAN/BIC Validierung.

ID: REQ-074
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Accounting Mode im Finance Setup. AccountingMode Enum (SimpleCash/DoubleEntry) auf FinanceProfile. Steuerung ob doppelte Buchhaltung aktiv ist. Voraussetzung für alle weiteren Double Entry Requirements. Code-Review bestätigt: Enum in FinanceEnums.cs, EF-Config mit Default SimpleCash, Frontend-Toggle in Sidebar.

ID: REQ-075
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Kontenplan für Hauptbuch. LedgerAccount Entity mit Nummer, Name, Kontenklasse, Normal-Saldo, Hierarchie. Separiert von bestehenden Finance Accounts. CRUD Endpoints und UI. Code-Review bestätigt: Entity, Repository, CQRS Commands/Queries, Endpoints, Frontend-Seite.

ID: REQ-076
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Journal Entry mit Soll/Haben Zeilen. JournalEntry und JournalEntryLine Entities. Balance-Regel Enforcement. Status-Workflow Draft/Posted/Reversed. Code-Review bestätigt: Entities, EF-Config, Repository, CRUD+Post+Reverse Endpoints, Frontend-Seite.

ID: REQ-077
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Posting Service für automatische Journal Entries aus Subledger-Ereignissen. PostingMapping Entity für Kategorie/Account/TaxCode zu Hauptbuchkonto Zuordnung. Code-Review bestätigt: IAccountingPostingService, AccountingPostingService, DI-Registration, Integration in Transaction-Handlers.

ID: REQ-078
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Storno statt Edit für gepostete Journal Entries. Reversal Entry Pattern. Audit Trail für Stornierungen. Code-Review bestätigt: ReverseJournalEntryCommand, POST /{id}/reverse Endpoint, ReversePostingAsync, Tests vorhanden.

ID: REQ-079
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Periodensperre gilt auch für Hauptbuch. Integration mit bestehendem FiscalPeriod Locking. Code-Review bestätigt: FiscalPeriodId FK auf JournalEntry, GetByFiscalPeriodAsync im Repository.

ID: REQ-080
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Trial Balance Report. SQL-Aggregation über JournalEntryLines pro LedgerAccount. CSV Export. Balanced-Check. Code-Review bestätigt: GetTrialBalanceQuery, GET /accounting-reports/trial-balance Endpoint, Frontend-Seite.

ID: REQ-081
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Bilanz und Erfolgsrechnung aus Hauptbuch. P&L (Revenue/Expense Konten) und Balance Sheet (Asset/Liability/Equity). CSV Export. Code-Review bestätigt: balance-sheet und profit-and-loss Endpoints, Frontend API-Aufrufe, Types BalanceSheetLine/ProfitAndLossLine.

ID: REQ-082
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Mapping UI für Posting-Zuordnungen. Kategorie zu Hauptbuchkonto, Finance Account zu Hauptbuchkonto, TaxCode zu Steuerkonten. Vollständigkeits-Validierung. Code-Review bestätigt: PostingMappingEndpoints CRUD, PostingMappingCommands, Frontend posting-mappings/page.tsx.

ID: REQ-083
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Verknüpfung Subledger zu Hauptbuch. SourceType/SourceId auf JournalEntry. Bidirektionale Navigation im UI. Code-Review bestätigt: SourceType/SourceId auf JournalEntry, GetBySourceAsync im Repository.

ID: REQ-084
Status: Ready
StatusSeit: 2026 02 28
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Backfill für bestehende Daten bei DoubleEntry-Aktivierung. Admin-Aktion mit Stichtag. Idempotent. Fehler-Protokoll.

ID: REQ-085
Status: Done
StatusSeit: 2026 03 02
Owner: Implementation Agent
SprintOderRelease: Sprint 6
TicketLink:
Notizen: Automatisierte Tests für Posting und Balance Regeln. Unit Tests und Integration Tests für alle Posting-Varianten. Code-Review bestätigt: AccountingPostingServiceTests.cs mit 15+ Tests (PostTransaction, ReversePosting, Balance-Validierung, Tax-Handling).
