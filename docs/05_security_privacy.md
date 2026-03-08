Titel
Security und Datenschutz

Auth
Token Validierung
1) Backend validiert Issuer, Audience, Signature des JWT
2) Backend prüft Ablauf und Not Before
3) Backend nutzt Claims für Rollen Mapping

Rollen und Policies
1) Zugriff wird serverseitig erzwungen
2) Jede sensible Aktion hat eine Policy
3) Finance Daten nur für Finance Rolle

Definierte Authorization Policies
RequireAdmin: admin
RequireVorstand: admin, vorstand
RequireMember: admin, vorstand, member
RequireFinanceRead: admin, kassier, auditor
RequireFinanceWrite: admin, kassier
RequireSearch: admin, vorstand, kassier

Admin Zugriff
1) Admin Bereich ist nur mit Admin Rolle erreichbar
2) Kritische Aktionen benötigen zusätzlich Bestätigung im UI

Audit
Was wird geloggt
1) Änderungen an Mitgliedern
2) Änderungen an Rollen und Benutzern
3) Finanz Buchungen und Zahlungen
4) Dokument Upload und Rechte Änderungen
5) Versand von Mahnungen
6) Login Erfolg und Fehlschlag
7) Backup Erstellung, Wiederherstellung und Löschung

Audit Event Typen
20+ Event Typen in 5 Kategorien: Authentication, UserManagement, MemberManagement, DataAccess, System
3 Schweregrade pro Event
Jeder Eintrag enthält Benutzer, IP, Entitätsreferenz, Beschreibung und JSON-Details

Aufbewahrung
Audit Einträge mindestens 24 Monate, danach anonymisieren oder archivieren, abhängig von Vereins Vorgaben.

Logging
Serilog mit Console und File Sink
Tägliche Log-Rotation mit 30 Tagen Aufbewahrung
CorrelationId Middleware für Request-Tracing über X-Correlation-Id Header
Log Format: Timestamp, Level, CorrelationId, SourceContext, Message, Exception

Backup Sicherheit
1) Backup Endpoints nur mit Admin-Rolle erreichbar
2) pg_dump und pg_restore laufen via Docker exec im PostgreSQL Container
3) Backup-Dateien werden lokal im Backend gespeichert
4) Upload begrenzt auf 500MB
5) Automatische Bereinigung von hängengebliebenen Backups nach 10 Minuten
6) Wiederherstellung erfordert 2-Schritt-Bestätigung im UI

Aufbewahrungsrichtlinien (Retention)
1) 6 Datenkategorien mit konfigurierbarer Aufbewahrungsdauer: AuditLogs, MemberData, FinanceData, Documents, Backups, Events
2) 3 Aktionen: Anonymize (DSGVO Art. 17), Archive (OR Art. 958f), Delete
3) Standard-Richtlinien werden automatisch beim Start initialisiert
4) Manuell durchsetzbar über Admin-Endpoint
5) Automatische Durchsetzung via wöchentlichem Hangfire Job (RetentionEnforcementJob)
6) Audit Logs werden anonymisiert (user_name zu ***, ip_address zu 0.0.0.0)
7) Abgelaufene Backups werden automatisch gelöscht

Datenschutz
Einwilligungen
1) Newsletter Opt in wird gespeichert
2) Einwilligungen haben Zeitstempel und Quelle
3) Consent Entity speichert: ConsentType, GrantedAt, RevokedAt, Source, MemberId
4) Widerruf jederzeit möglich

Datenexport
1) Export der eigenen Mitgliedsdaten ist möglich
2) Export enthält keine Daten anderer Mitglieder
3) API Endpoint: GET /api/v1/privacy/data-export

Löschkonzept
1) Mitglieder können anonymisiert werden statt gelöscht
2) Finanzdaten werden gemäss Aufbewahrungspflichten nicht gelöscht
3) Dokumente werden nach Retention Regeln archiviert
4) DeletionRequest Entity speichert: Antragsteller, Status (Pending, Approved, Rejected, Completed), Bearbeitungsdatum
5) Löschanträge via API: POST /api/v1/privacy/deletion-requests
