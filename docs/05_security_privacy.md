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

MFA fuer Hochrisiko Rollen
1) Keycloak bleibt die Identity Authority fuer MFA Enrollment und MFA Pruefung.
2) Die Rollen admin und kassier enthalten die Composite Marker Rolle mfa-required.
3) Der Keycloak Browser Flow iabconnect browser role mfa erzwingt OTP fuer mfa-required und ueberspringt OTP fuer Rollen ohne diesen Marker.
4) TOTP wird ueber Keycloak Configure OTP aktiviert; Recovery Authentication Codes sind als Backup Code Pfad aktiviert.
5) MFA Secrets und Recovery Codes werden nicht in IAB Connect gespeichert.
6) Manuelle Validierung nach Realm Import: admin@iabconnect.ch und kassier@iabconnect.ch muessen OTP einrichten oder bestaetigen; member@iabconnect.ch darf durch diese Policy nicht zu OTP gezwungen werden.
7) Login, Credential Update und Required Action Events werden in Keycloak Events erfasst. App-seitige MFA Reset oder Support Aktionen sind separater Scope und muessen in den jeweiligen Backend Endpoints auditiert werden.

Admin MFA Support Flow
1) Admins koennen fuer einen Benutzer ueber `/api/v1/users/{userId}/reset-mfa` einen kontrollierten MFA Reset starten.
2) Der Endpoint ist durch `RequireAdmin` geschuetzt; UI Rollenchecks ersetzen diese Backend Authorisierung nicht.
3) Der Reset entfernt in Keycloak nur MFA Credentials vom Typ `otp` und `recovery-authn-codes`; Passwort Credentials bleiben unveraendert.
4) Nach dem Entfernen sendet Keycloak eine Execute Actions Email fuer `CONFIGURE_TOTP` und `CONFIGURE_RECOVERY_AUTHN_CODES`, damit der Benutzer MFA neu einrichtet.
5) Erfolgreiche und fehlgeschlagene Reset-Versuche werden ueber den Security Audit Logger protokolliert. Fehlermeldungen an die UI bleiben generisch und geben keine Keycloak Interna preis.

Session- und Geraetesichtbarkeit (REQ-010)
1) Authentifizierte Benutzer koennen ihre aktiven Keycloak Sessions ueber `GET /api/v1/identity/sessions` abfragen. Endpoint erfordert nur Anmeldung, kein zusaetzliches Recht.
2) Administratoren koennen die aktiven Sessions eines Benutzers ueber `GET /api/v1/users/{userId}/sessions` abfragen. Endpoint ist durch `RequireAdmin` geschuetzt.
3) Beide Endpoints rufen die Keycloak Admin API `GET /admin/realms/{realm}/users/{userId}/sessions` auf und liefern eine Liste mit id, ipAddress, start, lastAccess und beteiligten Clients.
4) Datenqualitaet ist best effort. Keycloak kann ipAddress oder Zeitstempel weglassen, abhaengig von Provider- und Event-Konfiguration; die DTO erlaubt nullbare Werte und die UI degradiert anstatt zu raten.
5) Admin Sessionsabrufe werden ueber den Security Audit Logger protokolliert (LogAccessGranted mit SessionCount; LogAccessDenied wenn der Zielbenutzer nicht existiert).

Session Revocation (REQ-010)
1) Authentifizierte Benutzer koennen eigene Sessions ueber `DELETE /api/v1/identity/sessions/{sessionId}` beenden. Der Endpoint prueft serverseitig, dass die angegebene Session zum aufrufenden Benutzer gehoert (Ownership Gate), bevor er an Keycloak weiterleitet. Fremde Session-IDs ergeben 404.
2) Administratoren koennen eine Session eines anderen Benutzers ueber `DELETE /api/v1/users/{userId}/sessions/{sessionId}` beenden. Endpoint ist durch `RequireAdmin` geschuetzt.
3) Beide Endpoints rufen Keycloak Admin API `DELETE /admin/realms/{realm}/sessions/{sessionId}` auf. Lokale Session-Authority oder gespiegelter Session-State existiert in IAB Connect nicht.
4) Wirkung: Nach erfolgreicher Revocation wird das Access Token bei der naechsten geschuetzten Interaktion (`RequireAuthorization`) von der Token-Validierung abgelehnt, weil die Keycloak Session nicht mehr existiert. Browser-clientseitig wird beim naechsten Refresh-Token-Versuch ein 4xx zurueckkommen und der Login-Flow neu gestartet.
5) Audit: Eigene Revocation wird ueber `SecurityAuditLogger.LogAccessGranted` (Resource Session, Action RevokeOwn) protokolliert. Admin Revocation laeuft ueber `LogAccessGranted` (Action RevokeForUser) mit TargetUserId und TargetEmail. Fehlversuche (nicht zugehoerige Session, fehlender Zielbenutzer) ergeben `LogAccessDenied`.
6) Timeouts: Zusaetzlich zur expliziten Revocation enden Sessions automatisch bei Erreichen des Keycloak SSO Session Idle Timeout (Standard 30 Minuten) oder des SSO Session Max Lifetime (Standard 10 Stunden). Diese Werte werden in der Realm-Konfiguration `infra/keycloak/realms/iabconnect-realm.json` gepflegt und sind nicht app-seitig konfigurierbar.

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
