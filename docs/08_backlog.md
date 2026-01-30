Titel
Backlog

Quelle
Requirements aus docs/Anforderungen_WebApp_Indischer_Kulturverein.csv
Status aus docs/10_requirements_status.md

MVP Must have

Identity und Zugriff
REQ-001 Login und Zugriff Admin und Mitglieder
REQ-002 Benutzerverwaltung
REQ-003 Rollenverwaltung
REQ-004 Feingranulare Zugriffskontrolle
REQ-005 SSO Anbindung Keycloak OIDC SAML
REQ-007 Registrierung und Onboarding
REQ-008 Passwort Reset und Account Recovery
REQ-011 Audit Log Sicherheits und Datenänderungen
REQ-012 Datenschutz und Einwilligungen DSGVO

Mitglieder und CRM
REQ-013 Mitgliederstammdaten CRM mini
REQ-014 Mitgliedschaftsarten und Status
REQ-015 Beiträge und Beitragsverwaltung
REQ-016 Mitglieder Self Service Portal

Events
REQ-019 Eventverwaltung Kalender Details
REQ-020 Event Anmeldung RSVP

Kommunikation
REQ-026 E Mail Verwaltung Automatisiertes Mailing
REQ-027 Template Editor und Vorlagenpflege
REQ-029 Newsletter Opt in Opt out und Bounces

Sponsoren und Lieferanten
REQ-031 Sponsorenverwaltung
REQ-032 Lieferantenverwaltung

Dokumente
REQ-034 Dokumentenverwaltung

Finanzen
REQ-038 Mini Buchhaltung Grundfunktionen
REQ-039 Rechnungsstellung
REQ-040 Zahlungsverwaltung und Abgleich
REQ-045 Export für Steuer und Buchhaltung

Öffentlicher Bereich
REQ-046 Öffentliche Eventseite
REQ-049 Kontaktformular und Spam Schutz

Reporting und Daten
REQ-050 Dashboards und KPIs
REQ-051 Exports CSV und Excel
REQ-052 Such und Filterfunktionen

Betrieb und Qualität
REQ-053 Backup und Restore Konzept
REQ-057 Datenaufbewahrung und Archivierung
REQ-059 Konfiguration und Systemeinstellungen


Später Should have

Identity und Zugriff
REQ-006 Social und Enterprise Logins Google Microsoft
REQ-009 Mehrfaktor Authentifizierung MFA
REQ-010 Session und Geräteverwaltung

Mitglieder und CRM
REQ-017 Segmentierung und Verteiler
REQ-018 Dubletten Erkennung

Events
REQ-021 Warteliste und Nachrücken
REQ-022 Ticketing und Gebühren optional
REQ-024 Helferplanung und Aufgaben

Kommunikation
REQ-028 Automations und Journeys

Sponsoren und Lieferanten
REQ-033 Vertrags und Dokumentenverknüpfung

Dokumente
REQ-035 Dokumentrechte und Freigabe
REQ-036 Versionierung

Finanzen
REQ-041 Bankimport CSV
REQ-042 Mahnwesen
REQ-043 Belegmanagement

Öffentlicher Bereich
REQ-048 Sponsorenseite

Betrieb und Qualität
REQ-054 Logging und Monitoring
REQ-056 Barrierefreiheit Basis


Später Could have

Events
REQ-023 Check in vor Ort QR Code
REQ-025 Kalender Integration iCal Google

Kommunikation
REQ-030 Mehrkanal Nachrichten optional

Dokumente
REQ-037 Volltextsuche und Tags

Finanzen
REQ-044 Budget und Kostenstellen

Öffentlicher Bereich
REQ-047 News und Blog optional

Betrieb und Qualität
REQ-055 Mehrsprachigkeit DE EN HI optional
REQ-058 API und Webhooks optional


Technische Verbesserungen (Technical Debt)

TECH-001 JWT Token Refresh bei Rollenänderung
Beschreibung: Nach einer Rollenänderung über die Benutzerverwaltung muss der betroffene User sich ausloggen und wieder einloggen, damit das neue JWT Token die aktualisierten Rollen enthält.
Lösung: Keycloak Session invalidieren nach Rollenänderung über Admin API oder Refresh Token Rotation erzwingen.
Priorität: Low
Abhängigkeit: REQ-002 REQ-003
