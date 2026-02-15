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
REQ-060 Finanz-Setup Land/Profil, Währung, Geschäftsjahr
REQ-061 Beleg- und Finanzdokumente Storage, Integrität, Aufbewahrung
REQ-062 VAT/MWST Steuercodes, Netto/Brutto, Auswertung und Export
REQ-063 Rechnungs-PDF mit Schweizer QR-Zahlteil

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
REQ-064 EU-Rechnungs-Compliance Pflichtfelder und Templates je Profil
REQ-066 Periodenabschluss und Locking Jahresabschluss light
REQ-067 Freigabe-Workflow für Zahlungen/Spesen Vier-Augen-Prinzip

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
REQ-065 eInvoicing-Readiness EN 16931/Peppol als Erweiterungspunkt
REQ-068 Sparte/Projekt-Zuordnung für steuerliche und interne Auswertungen
REQ-069 Banking-Import Upgrade ISO 20022 camt und SEPA-Referenzen

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

TECH-002 Invoice Number Race Condition
Beschreibung: Bei gleichzeitiger Erstellung mehrerer Rechnungen kann es zu doppelten Rechnungsnummern kommen, da die Nummernvergabe nicht atomar ist.
Lösung: Datenbank-Sequenz oder Advisory Lock für Rechnungsnummern-Generierung.
Priorität: Medium
Abhängigkeit: REQ-039

TECH-003 Dunning Email Sending
Beschreibung: Mahnungen werden erstellt und als Sent markiert, aber der tatsächliche E-Mail-Versand ist noch nicht implementiert.
Lösung: Integration mit Communication Modul (EmailTemplate + EmailCampaign) für automatisierten Mahnungsversand.
Priorität: Medium
Abhängigkeit: REQ-042 REQ-026

TECH-004 Pagination auf Finance List Endpoints
Beschreibung: Finance List Endpoints (Transactions, Invoices, Payments, Receipts) geben aktuell alle Einträge zurück ohne Pagination.
Lösung: Standard Pagination Query Parameter (page, pageSize, sort) auf allen Finance List Endpoints implementieren.
Priorität: Medium
Abhängigkeit: REQ-038 REQ-039 REQ-040

TECH-005 Overdue Invoice Scheduler
Beschreibung: Rechnungen werden aktuell nicht automatisch auf Overdue gesetzt wenn das Fälligkeitsdatum überschritten ist.
Lösung: Background Job (Hangfire) der täglich offene Rechnungen prüft und überfällige auf Status Overdue setzt.
Priorität: Medium
Abhängigkeit: REQ-039 REQ-042
