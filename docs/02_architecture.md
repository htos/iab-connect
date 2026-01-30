Titel
Architektur

System Übersicht
IAB Connect besteht aus einem Next.js Frontend und einem ASP.NET Core Backend als modularer Monolith. Externe Systeme sind Keycloak für Auth, PostgreSQL als Datenbank, ein Mail Provider für Versand, und ein Storage für Dokumente. Background Jobs laufen im selben Deployment oder als separater Worker Prozess, je nach Hosting.

Komponenten
1) Frontend Next.js TypeScript
2) Backend ASP.NET Core C# als modularer Monolith
3) Datenbank PostgreSQL
4) Auth Keycloak OIDC
5) Background Jobs Hangfire oder Quartz
6) Dokumente Storage S3 kompatibel wie MinIO oder File Storage
7) Mail Provider SMTP oder API Provider

Module im Monolith
Identity and Access
Verantwortlichkeit Auth Integration, Rollen, Policies, Benutzer Zuordnung, Audit
Haupt Entities User, Role, Permission, AuditEntry
API Bereiche auth, users, roles, audit

Members
Verantwortlichkeit Mitglieder, Mitgliedschaft, Beiträge Bezug
Haupt Entities Member, Membership, MemberSegment
API Bereiche members, memberships

Events
Verantwortlichkeit Events, Anmeldung, Teilnehmer, Check in, Helfer
Haupt Entities Event, Registration, Attendance, Shift
API Bereiche events, registrations, checkin, shifts

Communication
Verantwortlichkeit Mailing, Templates, Automationen
Haupt Entities EmailTemplate, EmailCampaign, EmailLog, AutomationRule
API Bereiche emails, templates, campaigns, automations

Documents
Verantwortlichkeit Upload, Rechte, Tags, Versionen
Haupt Entities Document, DocumentVersion, DocumentTag, DocumentPermission
API Bereiche documents

Sponsors and Vendors
Verantwortlichkeit Sponsoren, Lieferanten, Verträge, Historie
Haupt Entities Sponsor, Vendor, ContactInteraction
API Bereiche sponsors, vendors

Finance
Verantwortlichkeit Buchungen, Rechnungen, Zahlungen, Mahnungen, Kostenstellen
Haupt Entities LedgerEntry, Invoice, Payment, CostCenter, Receipt
API Bereiche finance, invoices, payments

Reporting
Verantwortlichkeit Dashboards und Exporte
Haupt Entities hauptsächlich Views und Query Modelle
API Bereiche reports, exports

Deployment
Lokale Entwicklung
1) Frontend läuft lokal auf Node
2) Backend läuft lokal auf Kestrel
3) PostgreSQL, Keycloak, MinIO laufen via Docker Compose

Staging
1) Gleiche Container Zusammensetzung wie Produktion
2) Separate Secrets
3) Regelmässige Restore Tests mit Backup Daten

Produktion
1) Reverse Proxy optional für TLS Termination
2) Monitoring für Logs und Fehler
3) Backups für DB und Storage

CI CD Grundidee
1) Build und Test für Backend und Frontend bei jedem Pull Request
2) Docker Build und Push bei Merge nach main
3) Deploy via SSH oder über Container Registry Pull auf Server
4) Migrationen laufen kontrolliert beim Deployment

Internationalisierung (i18n)
Sprache
Die Anwendung wird in Englisch entwickelt. Die Primärsprache ist Englisch.

Übersetzungsstrategie
1) Frontend nutzt next-intl für Übersetzungen
2) Alle UI-Texte werden über Translation Keys referenziert
3) Übersetzungsdateien liegen in frontend/messages/ als JSON (en.json, de.json)
4) Unterstützte Sprachen: en (default), de
5) Backend API-Fehler und Validierungsmeldungen in Englisch
6) Locale Detection basiert auf Cookie (NEXT_LOCALE) oder default 'en'
7) Language Switcher im Header ermöglicht Sprachwechsel

UI/UX Design
Navigation
1) Collapsible Sidebar Navigation für Desktop und Mobile
2) Header enthält: Logo, User Info, Role Badge, Sign Out, Language Switcher
3) Sidebar enthält: Alle Navigations-Items basierend auf Benutzerrollen
4) Sidebar kann auf/zugeklappt werden (Toggle Button im Header)
5) Auf Mobile: Sidebar als Overlay mit Backdrop

Responsive Design
1) Mobile-first Ansatz mit Tailwind CSS
2) Breakpoints: sm (640px), md (768px), lg (1024px), xl (1280px)
3) Sidebar: Auf Mobile als Overlay, auf Desktop als fixierte Seitenleiste
4) Header: Angepasste Darstellung für Mobile (weniger Text, kompaktere Elemente)
5) Formulare: Einspaltiges Layout auf Mobile, mehrspaltiges auf Desktop
6) Touch-freundliche Schaltflächen (min 44px Höhe/Breite)
7) Lesbare Schriftgrössen (min 16px für Fliesstext)
