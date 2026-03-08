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
REQ-029 Newsletter Opt in Opt out und Bounces — **Done (2026-03-08)**: Consent-Filterung, HMAC-Unsubscribe-Token, öffentlicher Endpoint, Consent-UI im Profil, Unsubscribe-Seite, Public Newsletter Subscribe/Unsubscribe (ohne Account, nur E-Mail), NewsletterSubscriber-Entity für externe Abonnenten, Kampagnenversand inkl. externer Abonnenten

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
REQ-074 Accounting Mode im Finance Setup SimpleCash oder DoubleEntry
REQ-075 Kontenplan für Hauptbuch Chart of Accounts
REQ-076 Journal Entry mit Soll und Haben Zeilen
REQ-077 Posting Service für automatische Journal Entries
REQ-078 Storno statt Edit für gepostete Journal Entries
REQ-079 Periodensperre gilt auch für Hauptbuch
REQ-080 Probe Bilanz Bericht Trial Balance
REQ-081 Bilanz und Erfolgsrechnung aus Hauptbuch
REQ-082 Mapping UI für Kategorien Konten und Steuercodes
REQ-083 Verknüpfung Subledger zu Hauptbuch
REQ-084 ✅ Backfill für bestehende Daten bei DoubleEntry Aktivierung (Done Sprint 8)
REQ-085 Tests für Posting und Balance Regeln

Öffentlicher Bereich
REQ-046 Öffentliche Eventseite
REQ-049 Kontaktformular und Spam Schutz

Reporting und Daten
REQ-050 ✅ Dashboards und KPIs (Done Sprint 9)
REQ-051 ✅ Exports CSV und Excel (Done Sprint 9)
REQ-052 ✅ Such und Filterfunktionen (Done Sprint 10)

Betrieb und Qualität
REQ-053 ✅ Backup und Restore Konzept (Done Sprint 10)
REQ-057 ✅ Datenaufbewahrung und Archivierung (Done Sprint 10)
REQ-059 ✅ Konfiguration und Systemeinstellungen (Done Sprint 2)

Später Should have

Identity und Zugriff
REQ-006 Social und Enterprise Logins Google Microsoft
REQ-009 Mehrfaktor Authentifizierung MFA
REQ-010 Session und Geräteverwaltung

Mitglieder und CRM
REQ-017 Segmentierung und Verteiler
REQ-018 Dubletten Erkennung

Events
REQ-021 Warteliste und Nachrücken ✅ Done (Sprint 8)
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

Doppelte Buchhaltung Sprint 6
REQ-074 Accounting Mode im Finance Setup
REQ-075 Kontenplan für Hauptbuch
REQ-076 Journal Entry mit Soll und Haben Zeilen
REQ-077 Posting Service für automatische Journal Entries
REQ-078 Storno statt Edit für gepostete Journal Entries
REQ-079 Periodensperre gilt auch für Hauptbuch
REQ-080 Probe Bilanz Bericht
REQ-081 Bilanz und Erfolgsrechnung
REQ-082 Mapping UI für Kategorien Konten Steuercodes
REQ-083 Verknüpfung Subledger zu Hauptbuch
REQ-084 ✅ Backfill für bestehende Daten (Done Sprint 8)
REQ-085 Tests für Posting und Balance Regeln

Öffentlicher Bereich
REQ-048 Sponsorenseite

Betrieb und Qualität
REQ-054 ✅ Logging und Monitoring (Done Sprint 10)
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
Lösung: PostgreSQL UPSERT (INSERT ON CONFLICT DO UPDATE) mit Row-Level Locking in GetNextInvoiceNumberAsync. Unique constraint auf (finance_profile_id, fiscal_year). Concurrency-Tests mit 20 parallelen Requests bestätigen Korrektheit.
Status: Done (2026-02-28)
Priorität: Medium
Abhängigkeit: REQ-039

TECH-003 Dunning Email Sending
Beschreibung: Mahnungen werden erstellt und als Sent markiert, aber der tatsächliche E-Mail-Versand ist noch nicht implementiert.
Lösung: IDunningEmailService Interface in Application Layer, DunningEmailService Implementation in Infrastructure mit IEmailSender Integration. Löst Empfänger-Email aus Member/Sponsor/Supplier auf. Level-basierte HTML Email Templates (Zahlungserinnerung, 2. Mahnung, letzte Mahnung). SendDunningNoticeCommandHandler sendet Email vor MarkAsSent. 4 Unit Tests.
Status: Done (2026-03-07)
Priorität: Medium
Abhängigkeit: REQ-042 REQ-026

TECH-004 Pagination auf Finance List Endpoints
Beschreibung: Finance List Endpoints (Transactions, Invoices, Payments, Receipts) geben aktuell alle Einträge zurück ohne Pagination.
Lösung: Alle 32+ Finance Query Handler verwenden PagedResult<T> mit PaginationHelper (Sort, Filter, Page, PageSize). Dynamisches Sorting und Filtering über Query Parameter.
Status: Done (2026-02-16)
Priorität: Medium
Abhängigkeit: REQ-038 REQ-039 REQ-040

TECH-005 Overdue Invoice Scheduler
Beschreibung: Rechnungen werden aktuell nicht automatisch auf Overdue gesetzt wenn das Fälligkeitsdatum überschritten ist.
Lösung: MarkInvoicesOverdueJob als Hangfire Recurring Job (Cron.Daily). Prüft alle Sent-Invoices mit DueDate < heute, ruft Invoice.MarkAsOverdue auf. AutomaticRetry(3). DunningScheduleGenerationJob läuft wöchentlich für automatische Mahnungserstellung.
Status: Done (2026-02-28)
Priorität: Medium
Abhängigkeit: REQ-039 REQ-042
