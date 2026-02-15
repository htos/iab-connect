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
Bereich: Identity und Zugriff

Titel
Login und Zugriff Admin und Mitglieder

Beschreibung
Zugriff für administrative Nutzer sowie Bürger und Mitglieder mit getrennten Berechtigungen.

Funktionen

1. Login für Admin und Backoffice
2. Login für Mitgliederportal
3. Rollenbasierte Navigation und Menüs

Akzeptanzkriterien
Admin kann sich anmelden und Admin Funktionen sehen. Mitglied sieht nur Mitgliederfunktionen.

Priorität
Must have

Betroffene Rollen
Admin, Vorstand, Mitglied

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-002
Bereich: Identity und Zugriff

Titel
Benutzerverwaltung

Beschreibung
Benutzer anlegen, bearbeiten, deaktivieren und verwalten.

Funktionen

1. Benutzer anlegen, bearbeiten, löschen mit soft delete
2. Aktiv und Inaktiv setzen
3. Passwort zurücksetzen und Einladung per Mail

Akzeptanzkriterien
Admin kann Nutzer verwalten. Deaktivierte Nutzer können sich nicht anmelden.

Priorität
Must have

Betroffene Rollen
Admin

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-003
Bereich: Identity und Zugriff

Titel
Rollenverwaltung

Beschreibung
Rollen definieren und Benutzern zuweisen.

Funktionen

1. Rollen anlegen und ändern
2. Rollen zuweisen, mehrfach möglich
3. Standardrollen wie Admin, Kassier, Event Manager

Akzeptanzkriterien
Rolle steuert sichtbare Menüs und erlaubte Aktionen.

Priorität
Must have

Betroffene Rollen
Admin

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-004
Bereich: Identity und Zugriff

Titel
Feingranulare Zugriffskontrolle

Beschreibung
Berechtigungen pro Modul und Objekt, nicht nur global.

Funktionen

1. Rechte pro CRUD Aktion
2. Objektbasierte Rechte, zum Beispiel Event nur eigenes
3. Dokumentrechte pro Ordner und Datei

Akzeptanzkriterien
Unberechtigte Aktionen werden serverseitig blockiert und geloggt.

Priorität
Must have

Betroffene Rollen
Admin, Modulverantwortliche

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-005
Bereich: Identity und Zugriff

Titel
SSO Anbindung Keycloak OIDC SAML

Beschreibung
Integration eines zentralen Identity Providers wie Keycloak.

Funktionen

1. OIDC und SAML Login
2. Rollen und Claims Mapping
3. Single Logout falls möglich

Akzeptanzkriterien
Login über IdP funktioniert. Rollen werden korrekt zugeordnet.

Priorität
Must have

Betroffene Rollen
Admin, Mitglied

Abhängigkeiten
Keycloak, OIDC, SAML

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-006
Bereich: Identity und Zugriff

Titel
Social und Enterprise Logins Google Microsoft

Beschreibung
Optionaler Login über externe Provider zusätzlich zum Vereins Login.

Funktionen

1. Google Sign In
2. Microsoft Entra ID Azure AD
3. Konto Verknüpfung mit bestehendem Profil

Akzeptanzkriterien
Benutzer kann Provider verbinden und entkoppeln.

Priorität
Should have

Betroffene Rollen
Mitglied, Admin

Abhängigkeiten
Google und Microsoft OAuth

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-007
Bereich: Identity und Zugriff

Titel
Registrierung und Onboarding

Beschreibung
Selbstregistrierung oder Einladung inklusive Profilabschluss.

Funktionen

1. Registrierung falls gewünscht
2. Einladung per Mail Link
3. Onboarding Checkliste für Profil und Einwilligungen

Akzeptanzkriterien
Neues Mitglied kann Konto erstellen oder aktivieren und Profil abschliessen.

Priorität
Must have

Betroffene Rollen
Mitglied, Admin

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-008
Bereich: Identity und Zugriff

Titel
Passwort Reset und Account Recovery

Beschreibung
Sicherer Reset via E Mail oder IdP Flow.

Funktionen

1. Reset Link mit Ablauf
2. Rate Limiting
3. Support Reset durch Admin protokolliert

Akzeptanzkriterien
Reset funktioniert. Links sind einmalig und zeitlich begrenzt.

Priorität
Must have

Betroffene Rollen
Mitglied, Admin

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-009
Bereich: Identity und Zugriff

Titel
Mehrfaktor Authentifizierung MFA

Beschreibung
Erhöhte Sicherheit für Admin und Finanzrollen.

Funktionen

1. MFA optional oder erzwungen pro Rolle
2. TOTP Authenticator
3. Backup Codes

Akzeptanzkriterien
Für Kassierrolle ist MFA aktivierbar und erzwingbar.

Priorität
Should have

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
Bereich: Identity und Zugriff

Titel
Session und Geräteverwaltung

Beschreibung
Kontrolle über aktive Sitzungen und Logout.

Funktionen

1. Session Timeout
2. Logout überall
3. Geräte und Session Liste

Akzeptanzkriterien
User kann alle Sessions beenden. Timeouts greifen.

Priorität
Should have

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
Bereich: Identity und Zugriff

Titel
Audit Log Sicherheits und Datenänderungen

Beschreibung
Nachvollziehbarkeit von Änderungen und kritischen Aktionen.

Funktionen

1. Logins und Fehllogins
2. Änderungen an Mitglieds und Finanzdaten
3. Exportierbar als CSV

Akzeptanzkriterien
Änderungen sind mit User, Zeit, Objekt und Aktion nachvollziehbar.

Priorität
Must have

Betroffene Rollen
Admin, Vorstand, Kassier

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-012
Bereich: Identity und Zugriff

Titel
Datenschutz und Einwilligungen DSGVO

Beschreibung
Einwilligungen, Newsletter Opt in, Datenexport und Löschkonzept.

Funktionen

1. Consent Management
2. Datenexport zum Beispiel JSON oder ZIP
3. Lösch und Anonymisierungsworkflow

Akzeptanzkriterien
Einwilligungen werden gespeichert. Export und Löschung ist durchführbar.

Priorität
Must have

Betroffene Rollen
Admin

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-013
Bereich: Mitglieder und CRM

Titel
Mitgliederstammdaten CRM mini

Beschreibung
Zentrale Profile für Mitglieder und Bürger.

Funktionen

1. Kontakt und Adressdaten
2. Familien und Haushalt Verknüpfung optional
3. Tags und Segmente

Akzeptanzkriterien
Daten sind pflegbar. Suche findet Mitglieder nach Name und E Mail.

Priorität
Must have

Betroffene Rollen
Admin, Mitglied

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-014
Bereich: Mitglieder und CRM

Titel
Mitgliedschaftsarten und Status

Beschreibung
Abbildung verschiedener Mitgliedschaften inklusive Laufzeit.

Funktionen

1. Typen wie Einzel, Familie, Förder
2. Status wie aktiv, pausiert, gekündigt
3. Laufzeiten und Verlängerung

Akzeptanzkriterien
Statuswechsel ist nachvollziehbar. Verlängerung erzeugt neue Periode.

Priorität
Must have

Betroffene Rollen
Admin, Kassier

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-015
Bereich: Mitglieder und CRM

Titel
Beiträge und Beitragsverwaltung

Beschreibung
Mitgliedsbeiträge, Sollstellungen und Historie.

Funktionen

1. Beitragssätze pro Typ
2. Jahres und Monatsbeiträge
3. Soll und Ist Übersicht

Akzeptanzkriterien
Für alle aktiven Mitglieder werden Beiträge erzeugt und statusgeführt.

Priorität
Must have

Betroffene Rollen
Kassier, Admin

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-016
Bereich: Mitglieder und CRM

Titel
Mitglieder Self Service Portal

Beschreibung
Mitglieder können eigene Daten und Dokumente verwalten.

Funktionen

1. Profil bearbeiten
2. Rechnungen und Beiträge einsehen
3. Mitgliedsausweis und Bestätigungen downloaden

Akzeptanzkriterien
Mitglied kann nur eigene Daten sehen und ändern wo erlaubt.

Priorität
Must have

Betroffene Rollen
Mitglied

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-017
Bereich: Mitglieder und CRM

Titel
Segmentierung und Verteiler

Beschreibung
Mitgliedergruppen für Kommunikation und Auswertungen.

Funktionen

1. Filter nach Status, Typ, Interessen
2. Gespeicherte Segmente
3. Export nach Segment

Akzeptanzkriterien
Segment kann gespeichert und für Mailing verwendet werden.

Priorität
Should have

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
Bereich: Mitglieder und CRM

Titel
Dubletten Erkennung

Beschreibung
Verhindert doppelte Mitglieder und Accounts.

Funktionen

1. Warnung bei gleicher E Mail
2. Merge Prozess Admin
3. Protokollierte Zusammenführung

Akzeptanzkriterien
System warnt. Merge erstellt nachvollziehbare Historie.

Priorität
Should have

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
Eventverwaltung Kalender Details

Beschreibung
Events anlegen, pflegen und veröffentlichen.

Funktionen

1. Titel, Beschreibung, Ort
2. Datum und Uhrzeit, Serienevents
3. Sichtbarkeit öffentlich oder privat

Akzeptanzkriterien
Event kann erstellt, bearbeitet und publiziert werden.

Priorität
Must have

Betroffene Rollen
Event Manager, Admin

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-020
Bereich: Events

Titel
Event Anmeldung RSVP

Beschreibung
Teilnehmermanagement für Events.

Funktionen

1. Anmeldung für Mitglieder und öffentlich
2. Kapazitätslimit
3. Storno und No Show Kennzeichnung

Akzeptanzkriterien
Anmeldungen werden gezählt. Kapazitätsgrenzen greifen.

Priorität
Must have

Betroffene Rollen
Event Manager, Mitglied

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-021
Bereich: Events

Titel
Warteliste und Nachrücken

Beschreibung
Wenn Event voll ist, Warteliste und automatisches Nachrücken.

Funktionen

1. Wartelistenplatz
2. Benachrichtigung bei Platz
3. Nachrück Fristen

Akzeptanzkriterien
Bei freiem Platz wird Warteliste benachrichtigt. Status ändert sich.

Priorität
Should have

Betroffene Rollen
Event Manager, Mitglied

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
Ticketing und Gebühren optional

Beschreibung
Bezahlte Events inklusive Ticket und Beleg.

Funktionen

1. Preis pro Kategorie
2. Gutschein und Ermässigung optional
3. Ticket und Bestätigung per Mail

Akzeptanzkriterien
Bezahlte Anmeldung erzeugt Rechnung oder Beleg.

Priorität
Should have

Betroffene Rollen
Kassier, Event Manager

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
Check in vor Ort QR Code

Beschreibung
Schnelles Einchecken und Teilnehmerliste live.

Funktionen

1. QR Code pro Anmeldung
2. Check in Status
3. Offline Fallback Exportliste

Akzeptanzkriterien
Check in setzt Status in Echtzeit. Exportliste ist verfügbar.

Priorität
Could have

Betroffene Rollen
Event Manager

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
Helferplanung und Aufgaben

Beschreibung
Schichten, Aufgaben und To Dos rund um Events.

Funktionen

1. Aufgabenlisten
2. Helfer Schichten
3. Erinnerungen an Helfer

Akzeptanzkriterien
Helfer können sich eintragen. Schichtplan ist exportierbar.

Priorität
Should have

Betroffene Rollen
Event Manager, Admin

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
Kalender Integration iCal Google

Beschreibung
Events als Feed oder Export bereitstellen.

Funktionen

1. iCal Feed
2. Export ics
3. Einbettung auf Website

Akzeptanzkriterien
iCal Link importierbar. Änderungen aktualisieren sich.

Priorität
Could have

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
E Mail Verwaltung Automatisiertes Mailing

Beschreibung
E Mails an Mitglieder und Segmente, automatisiert und manuell.

Funktionen

1. Mailing an Segmente
2. Testversand
3. Zustellstatus gesendet oder bounce

Akzeptanzkriterien
Kampagne kann erstellt und an Segment gesendet werden.

Priorität
Must have

Betroffene Rollen
Kommunikation, Admin

Abhängigkeiten
Mail Provider wie SendGrid oder M365

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-027
Bereich: Kommunikation

Titel
Template Editor und Vorlagenpflege

Beschreibung
Wiederverwendbare E Mail Templates HTML und Text mit Variablen.

Funktionen

1. Vorlagen erstellen
2. Platzhalter für Name, Event, Betrag
3. Versionierung und Entwurf

Akzeptanzkriterien
Template speichert Variablen. Vorschau zeigt korrekt gerenderte Mail.

Priorität
Must have

Betroffene Rollen
Kommunikation

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-028
Bereich: Kommunikation

Titel
Automations und Journeys

Beschreibung
Automatische Mails für typische Prozesse.

Funktionen

1. Welcome Mail
2. Event Reminder
3. Beitrags und Mahnungsmails

Akzeptanzkriterien
Auslöser senden Mail mit korrektem Template und Empfängern.

Priorität
Should have

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
Newsletter Opt in Opt out und Bounces

Beschreibung
Rechtssicheres Newsletter Handling.

Funktionen

1. Double Opt in optional
2. Abmeldelink
3. Bounce und Complaint Handling

Akzeptanzkriterien
Abmeldung wirkt sofort. Einwilligung wird protokolliert.

Priorität
Must have

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
Mehrkanal Nachrichten optional

Beschreibung
SMS, WhatsApp oder Push für Reminder wenn gewünscht.

Funktionen

1. SMS Provider
2. WhatsApp Business optional
3. Kanalpräferenzen pro User

Akzeptanzkriterien
User kann Kanal wählen. Versand wird geloggt.

Priorität
Could have

Betroffene Rollen
Kommunikation

Abhängigkeiten
SMS oder WhatsApp Provider

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-031
Bereich: Sponsoren und Lieferanten

Titel
Sponsorenverwaltung

Beschreibung
Sponsorenkontakte, Pakete, Zusagen und Leistungen.

Funktionen

1. Sponsorprofile
2. Sponsoring Pakete
3. Benefits und Leistungen tracken

Akzeptanzkriterien
Sponsoren können gesucht, segmentiert und mit Verträgen verknüpft werden.

Priorität
Must have

Betroffene Rollen
Admin, Sponsor Manager

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-032
Bereich: Sponsoren und Lieferanten

Titel
Lieferantenverwaltung

Beschreibung
Lieferantenkontakte, Leistungen und Bestellungen oder Verträge.

Funktionen

1. Lieferantenprofile
2. Vertrags und Kontaktinfos
3. Historie der Zusammenarbeit

Akzeptanzkriterien
Lieferant kann angelegt und Dokumenten oder Belegen zugeordnet werden.

Priorität
Must have

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
Bereich: Sponsoren und Lieferanten

Titel
Vertrags und Dokumentenverknüpfung

Beschreibung
Sponsoren und Lieferanten mit Dokumenten, Rechnungen und Events verknüpfen.

Funktionen

1. Link zu Dokumenten
2. Link zu Rechnungen
3. Link zu Events

Akzeptanzkriterien
Jeder Vertrag oder Rechnung kann einem Sponsor oder Lieferanten zugeordnet werden.

Priorität
Should have

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

1. Upload und Download
2. Ordnerstruktur
3. Metadaten mit Tags und Kategorie

Akzeptanzkriterien
Dokument ist auffindbar. Zugriff je Rolle ist durchgesetzt.

Priorität
Must have

Betroffene Rollen
Admin, Vorstand

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-035
Bereich: Dokumente

Titel
Dokumentrechte und Freigabe

Beschreibung
Workflow für Entwurf, Prüfung und Veröffentlichung.

Funktionen

1. Status wie Entwurf, Geprüft, Veröffentlicht
2. Freigabe durch Rolle
3. Ablaufdatum und Archiv

Akzeptanzkriterien
Nur freigegebene Dokumente sind sichtbar je nach Sichtbarkeit.

Priorität
Should have

Betroffene Rollen
Vorstand, Admin

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-036
Bereich: Dokumente

Titel
Versionierung

Beschreibung
Änderungen nachvollziehbar machen und alte Versionen verfügbar halten.

Funktionen

1. Versionsnummern
2. Diff und Kommentar optional
3. Restore früherer Version

Akzeptanzkriterien
Versionen sind abrufbar. Restore erstellt neue Version.

Priorität
Should have

Betroffene Rollen
Admin

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-037
Bereich: Dokumente

Titel
Volltextsuche und Tags

Beschreibung
Schnelle Auffindbarkeit auch bei vielen Dokumenten.

Funktionen

1. Suche in Metadaten
2. Volltext für PDF und DOCX optional
3. Tags und Filter

Akzeptanzkriterien
Suche liefert relevante Treffer. Filter funktionieren.

Priorität
Could have

Betroffene Rollen
Alle

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-038
Bereich: Finanzen

Titel
Mini Buchhaltung Grundfunktionen

Beschreibung
Einnahmen und Ausgaben erfassen und auswerten.

Funktionen

1. Buchungen erfassen
2. Kategorien und Konten
3. Einnahmen und Ausgaben Übersicht

Akzeptanzkriterien
Buchungen können erfasst, geändert mit Audit und ausgewertet werden.

Priorität
Must have

Betroffene Rollen
Kassier

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-039
Bereich: Finanzen

Titel
Rechnungsstellung

Beschreibung
Rechnungen für Beiträge, Events und Sponsoring.

Funktionen

1. Rechnung erstellen
2. PDF Export
3. Nummernkreis

Akzeptanzkriterien
Rechnung hat eindeutige Nummer. PDF ist generierbar.

Priorität
Must have

Betroffene Rollen
Kassier

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-040
Bereich: Finanzen

Titel
Zahlungsverwaltung und Abgleich

Beschreibung
Zahlungen erfassen und Rechnungen ausgleichen.

Funktionen

1. Zahlung erfassen bar oder Überweisung
2. Teilzahlungen
3. Offene Posten Liste

Akzeptanzkriterien
Offene Posten stimmen. Teilzahlungen reduzieren Restbetrag korrekt.

Priorität
Must have

Betroffene Rollen
Kassier

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-041
Bereich: Finanzen

Titel
Bankimport CSV

Beschreibung
Optionaler Import von Bankumsätzen zur Vereinfachung.

Funktionen

1. CSV Import
2. Matching Vorschläge
3. Manuelle Zuordnung

Akzeptanzkriterien
Import funktioniert. Zuordnung erzeugt Zahlung oder Buchung.

Priorität
Should have

Betroffene Rollen
Kassier

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-042
Bereich: Finanzen

Titel
Mahnwesen

Beschreibung
Automatisierte Erinnerung und Mahnungen für offene Beiträge und Rechnungen.

Funktionen

1. Mahnstufen
2. Template je Stufe
3. Protokoll der Mahnungen

Akzeptanzkriterien
Mahnung wird nur bei offenen Posten gesendet. Historie wird gespeichert.

Priorität
Should have

Betroffene Rollen
Kassier, Kommunikation

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-043
Bereich: Finanzen

Titel
Belegmanagement

Beschreibung
Quittungen und Belege hochladen und Buchungen zuordnen.

Funktionen

1. Upload Foto oder PDF
2. Zuordnung zu Buchung
3. Steuerrelevante Metadaten optional

Akzeptanzkriterien
Buchung kann Beleg haben. Beleg ist per Klick abrufbar.

Priorität
Should have

Betroffene Rollen
Kassier

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-044
Bereich: Finanzen

Titel
Budget und Kostenstellen

Beschreibung
Auswertung nach Event oder Projekt wie Diwali.

Funktionen

1. Kostenstellen
2. Budget pro Kostenstelle
3. Soll und Ist Vergleich

Akzeptanzkriterien
Soll und Ist ist pro Kostenstelle sichtbar.

Priorität
Could have

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
Export für Steuer und Buchhaltung

Beschreibung
Export der Daten als CSV oder Excel für externes System.

Funktionen

1. Buchungsjournal Export
2. OP Liste Export
3. Sponsor und Beitragslisten Export

Akzeptanzkriterien
Export entspricht definierter Struktur und enthält notwendige Felder.

Priorität
Must have

Betroffene Rollen
Kassier

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

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
Öffentliche Seite zeigt nur freigegebene Events. Anmeldung funktioniert.

Priorität
Must have

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
News und Blog optional

Beschreibung
Einfache Inhaltsverwaltung für Vereinsnews.

Funktionen

1. Beiträge erstellen
2. Kategorien und Tags
3. Veröffentlichung und Archiv

Akzeptanzkriterien
Beiträge sind sortierbar. Entwurf und Publiziert Status.

Priorität
Could have

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
Sponsoren sichtbar machen mit Logo, Paket und Link.

Funktionen

1. Sponsor Listing
2. Pakete und Badges
3. Sichtbarkeit steuern

Akzeptanzkriterien
Nur freigegebene Sponsoren werden angezeigt.

Priorität
Should have

Betroffene Rollen
Admin, Sponsor Manager

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
Kontaktformular und Spam Schutz

Beschreibung
Kontaktaufnahme mit Captcha und Routing.

Funktionen

1. Formularfelder
2. Captcha
3. Weiterleitung an Mail oder Queue

Akzeptanzkriterien
Spam wird reduziert. Nachrichten landen beim richtigen Empfänger.

Priorität
Must have

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
Bereich: Reporting und Daten

Titel
Dashboards und KPIs

Beschreibung
Übersichten für Vorstand, Kassier und Eventteam.

Funktionen

1. Mitgliederentwicklung
2. Offene Beiträge
3. Event KPIs wie Anmeldungen und Einnahmen

Akzeptanzkriterien
Dashboard zeigt aktuelle Daten. Filter nach Zeitraum.

Priorität
Must have

Betroffene Rollen
Vorstand, Kassier, Event Manager

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-051
Bereich: Reporting und Daten

Titel
Exports CSV und Excel

Beschreibung
Datenexporte für Auswertung und Archiv.

Funktionen

1. Mitgliederexport
2. Event Teilnehmerlisten
3. Finanzexport

Akzeptanzkriterien
Exports respektieren Berechtigungen und enthalten definierte Spalten.

Priorität
Must have

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
Bereich: Reporting und Daten

Titel
Such und Filterfunktionen

Beschreibung
Schnelles Finden in Mitgliedern, Events, Dokumenten und Rechnungen.

Funktionen

1. Volltext und teilweise Suche
2. Filter und Sortierung
3. Gespeicherte Views optional

Akzeptanzkriterien
Suchen liefert Ergebnisse unter 2 Sekunden bei typischen Datenmengen.

Priorität
Must have

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
Bereich: Betrieb und Qualität

Titel
Backup und Restore Konzept

Beschreibung
Regelmässige Backups inklusive Wiederherstellungstest.

Funktionen

1. DB Backup
2. Dokument Storage Backup
3. Restore Prozedur

Akzeptanzkriterien
Restore Test ist dokumentiert und erfolgreich.

Priorität
Must have

Betroffene Rollen
Admin und IT

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-054
Bereich: Betrieb und Qualität

Titel
Logging und Monitoring

Beschreibung
Fehler und Performance Monitoring.

Funktionen

1. Error Tracking
2. Metriken wie Response Time
3. Alarmierung optional

Akzeptanzkriterien
Kritische Fehler sind auffindbar. Logs enthalten Korrelations ID.

Priorität
Should have

Betroffene Rollen
Admin und IT

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-055
Bereich: Betrieb und Qualität

Titel
Mehrsprachigkeit DE EN HI optional

Beschreibung
UI und Inhalte mehrsprachig.

Funktionen

1. UI Übersetzungen
2. Inhaltssprache pro Beitrag oder Event
3. Sprache pro Nutzer

Akzeptanzkriterien
Sprache kann gewechselt werden. Fallback funktioniert.

Priorität
Could have

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
Bereich: Betrieb und Qualität

Titel
Barrierefreiheit Basis

Beschreibung
Mindestens WCAG Basics für Formulare und Navigation.

Funktionen

1. Tastaturbedienung
2. Kontraste
3. ARIA Labels

Akzeptanzkriterien
Wichtige Flows sind ohne Maus bedienbar.

Priorität
Should have

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
Bereich: Betrieb und Qualität

Titel
Datenaufbewahrung und Archivierung

Beschreibung
Regeln wie lange Daten und Dokumente gehalten werden.

Funktionen

1. Aufbewahrungsfristen
2. Archivstatus
3. Lösch und Anonymisierungsjobs

Akzeptanzkriterien
Archivierte Daten sind schreibgeschützt. Löschjobs protokolliert.

Priorität
Must have

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
Bereich: Betrieb und Qualität

Titel
API und Webhooks optional

Beschreibung
Schnittstellen für spätere Integrationen.

Funktionen

1. REST API read
2. Webhooks für Event erstellt und Zahlung eingegangen
3. API Keys und Scopes

Akzeptanzkriterien
API ist gesichert. Rate Limits vorhanden.

Priorität
Could have

Betroffene Rollen
Admin und IT

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-059
Bereich: Betrieb und Qualität

Titel
Konfiguration und Systemeinstellungen

Beschreibung
Zentrale Einstellungen des Vereins wie Texte, Logos, Beiträge und Mail Absender.

Funktionen

1. Vereinsprofil
2. Beitragssätze
3. Mail Settings

Akzeptanzkriterien
Einstellungen wirken ohne Codeänderung. Änderungen sind auditiert.

Priorität
Must have

Betroffene Rollen
Admin

Abhängigkeiten

Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-060
Bereich: Finanzen

Titel
Finanz-Setup Land/Profil, Währung, Geschäftsjahr

Beschreibung
Konfigurierbares Finanzprofil pro Verein (Schweiz oder EU). Steuert Währung, Geschäftsjahr, VAT/MWST-Flags, Nummernkreise und Zahlungs-Defaults.

Funktionen

1. FinanceProfile CH oder EU mit optionalem EU-Land-Code
2. Default currency CHF oder EUR mit Rundungsregeln
3. Geschäftsjahr Start/Ende und Perioden
4. Invoice numbering pattern pro Profil
5. VAT/MWST Registrierung ja oder nein, VAT-ID/MWST-Nr. optional

Akzeptanzkriterien
Finanzprofil ist änderbar mit Audit. Neue Rechnungen und Buchungen verwenden Profil-Defaults. Bestehende Daten bleiben unverändert.

Priorität
Must have

Betroffene Rollen
Admin, Kassier

Abhängigkeiten
REQ-059, REQ-004

Status: InProgress
StatusSeit: 2026 02 15
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: FinanceProfile Entity (CH/EU Jurisdiktion, Waehrung, Org-Details). Backend + Frontend implemented, pending integration test.

ID: REQ-061
Bereich: Finanzen

Titel
Beleg- und Finanzdokumente Storage, Integrität, Aufbewahrung

Beschreibung
Finanzbelege und Rechnungs-PDFs werden als Dateien im Object Storage (RustFS) gespeichert, inkl. Integritätsmerkmalen und Retention-Strategie.

Funktionen

1. Upload und Download von Receipt-Dateien (PDF/JPG/PNG) in RustFS
2. Automatische Speicherung von Rechnungs-PDFs und optional Mahnungs-PDFs
3. Checksum/Hash pro Datei zur Integritätsprüfung
4. Retention Policy finanzrelevante Dokumente werden nicht gelöscht, sondern archiviert

Akzeptanzkriterien
Beleg-Download liefert die ursprünglich hochgeladene Datei. Hash-Check ist reproduzierbar. Löschen ist als Archive/Soft-Delete umgesetzt.

Priorität
Must have

Betroffene Rollen
Kassier, Auditor, Admin

Abhängigkeiten
REQ-057, Storage RustFS

Status: InProgress
StatusSeit: 2026 02 15
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Receipt-Storage via S3/RustFS mit SHA256-Integrity und File-Type-Validation. Backend + Frontend implemented, pending integration test.

ID: REQ-062
Bereich: Finanzen

Titel
VAT/MWST Steuercodes, Netto/Brutto, Auswertung und Export

Beschreibung
Transaktionen und Rechnungspositionen unterstützen VAT/MWST-Codes (steuerbar, befreit, reduziert), Netto/Brutto-Beträge und VAT-Auswertungen.

Funktionen

1. Konfigurierbare TaxCodes pro Profil (Rate, Beschreibung, steuerbar flag)
2. InvoiceItem net_amount, vat_rate, vat_amount, gross_amount
3. VAT Summary Report (Zeitraum) mit Export CSV
4. Schwellwert-Tracking (z.B. CH MWST-Umsatzgrenze konfigurierbar) mit Warnung

Akzeptanzkriterien
VAT Summary entspricht den gebuchten TaxCodes. Export ist konsistent und prüfbar (Summe der Positionen = Rechnungstotal).

Priorität
Should have

Betroffene Rollen
Kassier, Auditor

Abhängigkeiten
REQ-045, REQ-060

Status: InProgress
StatusSeit: 2026 02 15
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: VAT/MWST mit konfigurierbaren TaxCodes, Per-Item-Tax, VAT-Export. Backend + Frontend implemented, pending integration test.

ID: REQ-063
Bereich: Finanzen

Titel
Rechnungs-PDF mit Schweizer QR-Zahlteil

Beschreibung
Für das CH-Profil kann das System Rechnungs-PDFs erzeugen, die einen QR-Zahlteil (QR-bill) enthalten.

Funktionen

1. PDF-Generierung für Invoice (Download und Archiv)
2. Option QR-Zahlteil mit IBAN/QR-IBAN, Referenz, Betrag, Empfänger
3. QR-Code-Generierung gemäss QR-Rechnung Spezifikation
4. Fallback klassische Rechnung ohne QR, wenn nicht konfiguriert

Akzeptanzkriterien
QR-Zahlteil ist in Banking-Apps scanbar. PDF enthält Pflichtfelder und ist wiederholbar erzeugbar (idempotent).

Priorität
Should have

Betroffene Rollen
Kassier

Abhängigkeiten
REQ-039, REQ-060, REQ-061

Status: InProgress
StatusSeit: 2026 02 15
Owner: Implementation Agent
SprintOderRelease: Sprint 3
TicketLink:
Notizen: Swiss QR-Zahlteil PDF-Generator via Codecrete.SwissQRBill. Backend + Frontend implemented, pending integration test with real IBAN.

ID: REQ-064
Bereich: Finanzen

Titel
EU-Rechnungs-Compliance Pflichtfelder und Templates je Profil

Beschreibung
Für EU-Profile werden Rechnungstemplates so erweitert, dass Pflichtfelder und Hinweise (VAT-ID, Steuerbefreiung, Reverse Charge etc.) je Land/Profil abbildbar sind.

Funktionen

1. Template-Engine für Invoice PDFs (Logo, Adresse, VAT-ID, Zahlungsbedingungen)
2. Konfigurierbare Pflichtfelder je Profil
3. Mehrsprachige Rechnungstexte via i18n Keys

Akzeptanzkriterien
Admin kann Template-Felder konfigurieren. Bei fehlenden Pflichtfeldern blockiert das System den Versand (Validation).

Priorität
Should have

Betroffene Rollen
Kassier, Admin

Abhängigkeiten
REQ-039, REQ-060, i18n Guidelines

Status: Backlog
StatusSeit: 2026 02 15
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-065
Bereich: Finanzen

Titel
eInvoicing-Readiness EN 16931/Peppol als Erweiterungspunkt

Beschreibung
Die Datenmodelle und Exporte sind so gestaltet, dass später strukturierte eInvoices (EN 16931) exportiert oder via Provider versendet werden können.

Funktionen

1. EInvoice Export Endpunkt (z.B. EN16931/UBL/CII) optional/feature-flag
2. Mapping von Invoice/Items/Taxes/Parties auf eInvoicing Datenmodell
3. CIUS/Länderspezifische Extensions als Plugin-Konzept

Akzeptanzkriterien
Eine Beispielrechnung kann in ein strukturiertes Format exportiert werden und enthält konsistente Tax/Party Daten.

Priorität
Could have

Betroffene Rollen
Admin, Kassier

Abhängigkeiten
REQ-060, REQ-062, REQ-064

Status: Backlog
StatusSeit: 2026 02 15
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-066
Bereich: Finanzen

Titel
Periodenabschluss und Locking (Jahresabschluss light)

Beschreibung
Unterstützung für Geschäftsjahr-Perioden, Abschluss und Sperrung, damit nach dem Abschluss keine stillen Änderungen möglich sind.

Funktionen

1. Fiscal periods (Monat/Quartal/Jahr) basierend auf FinanceSettings
2. Lock/Unlock nur Admin mit Audit
3. Korrekturen nur via Storno- oder Korrekturbuchung nach Lock
4. Carry-forward von Salden optional oder Export für Treuhand

Akzeptanzkriterien
Nach Lock können Buchungen in der Periode nicht mehr geändert oder gelöscht werden. Korrekturen erzeugen neue Entries.

Priorität
Should have

Betroffene Rollen
Kassier, Auditor

Abhängigkeiten
REQ-011, REQ-038, REQ-039, REQ-040

Status: Backlog
StatusSeit: 2026 02 15
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-067
Bereich: Finanzen

Titel
Freigabe-Workflow für Zahlungen/Spesen (Vier-Augen-Prinzip)

Beschreibung
Unterstützung für Freigaben bei Auszahlungen (Lieferanten, Spesen) mit Schwellenwerten und Rollen.

Funktionen

1. Payment status Draft, Submitted, Approved, Paid
2. Schwellenwerte ab Betrag X braucht Vorstand-Freigabe
3. Audit-Log wer hat wann freigegeben
4. Optional Spesen-Claim Workflow (Member submits, Kassier prüft, Vorstand freigibt)

Akzeptanzkriterien
Zahlungen über Schwelle können ohne Freigabe nicht als Paid markiert werden. Alle Schritte sind im Audit sichtbar.

Priorität
Should have

Betroffene Rollen
Kassier, Vorstand, Auditor

Abhängigkeiten
REQ-004, REQ-011, REQ-040

Status: Backlog
StatusSeit: 2026 02 15
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-068
Bereich: Finanzen

Titel
Sparte/Projekt-Zuordnung für steuerliche und interne Auswertungen

Beschreibung
Optionaler Dimension-Tag (Sparte/Projekt) auf Buchungen und Rechnungspositionen für Auswertungen (z.B. Mitgliedschaft vs Eventbetrieb).

Funktionen

1. ActivityArea auf Transaction und InvoiceItem (enum oder definierbar)
2. Reports P und L nach Sparte/Projekt
3. Export inklusive Sparte/Projekt-Spalte

Akzeptanzkriterien
Sparte ist filterbar. Report zeigt Summen pro Sparte. Export enthält Sparte.

Priorität
Could have

Betroffene Rollen
Kassier, Vorstand, Auditor

Abhängigkeiten
REQ-044, REQ-045

Status: Backlog
StatusSeit: 2026 02 15
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-069
Bereich: Finanzen

Titel
Banking-Import Upgrade ISO 20022 (camt) und SEPA-Referenzen

Beschreibung
Zusätzlich zum CSV-Import können standardisierte Bankformate (ISO 20022 camt.053/054) importiert werden, inkl. Referenzen für Matching.

Funktionen

1. Import camt.053/054 (XML) optional
2. Erkennung/Parsing von Referenzen (z.B. QR-Referenz, End-to-End-ID)
3. Matching-Verbesserungen automatische Zuordnung zu offenen Rechnungen

Akzeptanzkriterien
Ein camt-File kann importiert werden. System erstellt ImportItems mit Datum/Betrag/Referenz. Matching-Vorschläge funktionieren.

Priorität
Could have

Betroffene Rollen
Kassier

Abhängigkeiten
REQ-041, REQ-040

Status: Backlog
StatusSeit: 2026 02 15
Owner:
SprintOderRelease:
TicketLink:
Notizen:

2. Mapping von Claims zu Rollen

Akzeptanzkriterien

1. Login über Provider funktioniert ohne lokalen Passwort Flow
2. Rollen können korrekt gemappt werden

Priorität
Should have

Betroffene Rollen
Admin, Mitglied

Abhängigkeiten
Keycloak

Titel
Mitgliederverwaltung

Beschreibung
Der Verein verwaltet Mitglieder als CRM Mini. Mitglieder haben Status, Kontaktinformationen und Mitgliedschaftsdaten.

Funktionen

1. Mitglied anlegen und bearbeiten
2. Mitgliedschaft Status und Laufzeit
3. Segmentierung wie Mitglieder, Freunde, Jugend, Helfer
4. Suche und Filter

Akzeptanzkriterien

1. Admin kann Mitglieder erfassen und finden
2. Mitgliedschaft Status ist nachvollziehbar
3. Segmentierung ist im Mailing und Reporting nutzbar

Priorität
Must have

Betroffene Rollen
Admin, Mitglied

Abhängigkeiten
Rollen und Berechtigungen

Titel
Mitgliedsbeiträge und Mitgliedschaft

Beschreibung
Beiträge werden verwaltet, inklusive Rechnungen, Zahlungseingang und offene Beträge.

Funktionen

1. Beitrag pro Periode definieren
2. Rechnung erzeugen
3. Zahlung erfassen
4. Status offen, bezahlt, überfällig

Akzeptanzkriterien

1. Offene Beiträge sind pro Mitglied sichtbar
2. Zahlungen ändern den Status der Rechnung
3. Export der offenen Beiträge ist möglich

Priorität
Must have

Betroffene Rollen
Admin, Finance, Mitglied

Abhängigkeiten
Mitgliederverwaltung, Mini Buchhaltung

Titel
Eventverwaltung

Beschreibung
Events werden erstellt, publiziert und verwaltet. Optional mit Kapazität und Anmeldung.

Funktionen

1. Event erstellen und bearbeiten
2. Event Termine, Ort, Beschreibung, Kapazität
3. Sichtbarkeit öffentlich oder intern
4. Teilnehmerliste

Akzeptanzkriterien

1. Ein Event ist im öffentlichen Bereich oder im Mitgliederbereich sichtbar gemäss Konfiguration
2. Admin kann Teilnehmerliste sehen
3. Kapazität wird nicht überschritten

Priorität
Must have

Betroffene Rollen
Admin, Event Manager, Mitglied

Abhängigkeiten
Rollen und Berechtigungen

Titel
Event Anmeldung und Check in

Beschreibung
Teilnehmer können sich anmelden. Vor Ort kann ein Check in erfolgen.

Funktionen

1. Anmeldung und Abmeldung
2. Warteliste bei Kapazität
3. QR Code oder Check in Liste
4. No show Markierung

Akzeptanzkriterien

1. Anmeldung bestätigt den Teilnehmerstatus
2. Bei voller Kapazität landet der Benutzer auf Warteliste
3. Check in kann am Event Tag durchgeführt werden

Priorität
Should have

Betroffene Rollen
Event Manager, Helfer, Mitglied

Abhängigkeiten
Eventverwaltung

Titel
Helfer Planung für Events

Beschreibung
Events können Helfer Rollen und Schichten abbilden.

Funktionen

1. Helfer Rollen definieren
2. Schichten erstellen
3. Helfer zuweisen oder Self Signup

Akzeptanzkriterien

1. Event Manager sieht offene Helfer Slots
2. Helfer kann sich für eine Schicht anmelden falls erlaubt

Priorität
Could have

Betroffene Rollen
Event Manager, Helfer

Abhängigkeiten
Eventverwaltung

Titel
Mailing und Newsletter

Beschreibung
Der Verein sendet Mails an Segmente und verwaltet Vorlagen.

Funktionen

1. Verteiler nach Segmenten
2. Mail Versand via Provider
3. Template Verwaltung
4. Versand Historie

Akzeptanzkriterien

1. Mail kann an Segment Mitglieder gesendet werden
2. Template kann erstellt und wiederverwendet werden
3. Versand wird protokolliert

Priorität
Must have

Betroffene Rollen
Admin, Content Editor

Abhängigkeiten
Mitgliederverwaltung

Titel
Automatisierte Mails und Reminder

Beschreibung
Es gibt automatisierte Kommunikations Flows für Beiträge und Events.

Funktionen

1. Willkommensmail nach neuer Mitgliedschaft
2. Zahlungserinnerung bei offenen Beiträgen
3. Event Reminder vor dem Event
4. Danke Mail nach dem Event

Akzeptanzkriterien

1. Reminder laufen als Background Job
2. Jede Automatisierung kann aktiviert oder deaktiviert werden
3. Versand wird protokolliert

Priorität
Should have

Betroffene Rollen
Admin, Finance, Content Editor

Abhängigkeiten
Mailing und Newsletter, Background Jobs

Titel
Sponsorenverwaltung

Beschreibung
Sponsoren werden als Kontakte mit Leistungen, Verträgen und Historie verwaltet.

Funktionen

1. Sponsor anlegen und bearbeiten
2. Sponsoring Pakete und Betrag
3. Vertrag Dokument verknüpfen
4. Historie der Kommunikation

Akzeptanzkriterien

1. Sponsoren sind filterbar nach Status und Betrag
2. Verträge können verknüpft werden
3. Export für Reporting ist möglich

Priorität
Should have

Betroffene Rollen
Admin, Finance

Abhängigkeiten
Dokumentenverwaltung

Titel
Lieferantenverwaltung

Beschreibung
Lieferanten und Dienstleister werden verwaltet für Event Planung und Buchhaltung.

Funktionen

1. Lieferant anlegen und bearbeiten
2. Leistungen und Kontaktdaten
3. Belege und Rechnungen verknüpfen

Akzeptanzkriterien

1. Lieferant kann zu Ausgaben zugeordnet werden
2. Belege sind auffindbar

Priorität
Should have

Betroffene Rollen
Admin, Finance

Abhängigkeiten
Mini Buchhaltung, Dokumentenverwaltung

Titel
Dokumentenverwaltung

Beschreibung
Vereinsdokumente werden gespeichert, versioniert und nach Rechten geschützt.

Funktionen

1. Upload und Download
2. Ordner und Tags
3. Versionierung
4. Zugriff nach Rollen und optional nach Event Kontext

Akzeptanzkriterien

1. Unberechtigte Benutzer können Dokumente nicht sehen
2. Dokumente sind durchsuchbar über Metadaten
3. Versionen bleiben erhalten

Priorität
Must have

Betroffene Rollen
Admin, Content Editor, Finance

Abhängigkeiten
Rollen und Berechtigungen

Titel
Mini Buchhaltung Grundfunktionen

Beschreibung
Einnahmen und Ausgaben können erfasst und ausgewertet werden.

Funktionen

1. Buchung erfassen mit Betrag, Datum, Kategorie
2. Beleg Upload und Verknüpfung
3. Einnahmen aus Mitgliedsbeiträgen und Events
4. Export als CSV

Akzeptanzkriterien

1. Finance kann Buchungen erfassen und filtern
2. Buchung hat eine Kategorie und optional eine Kostenstelle
3. Export enthält alle notwendigen Felder

Priorität
Must have

Betroffene Rollen
Finance, Admin

Abhängigkeiten
Dokumentenverwaltung

Titel
Rechnungen und Mahnwesen

Beschreibung
Rechnungen werden erzeugt und können gemahnt werden.

Funktionen

1. Rechnung erzeugen für Beitrag oder Event
2. Status offen, bezahlt, überfällig
3. Mahnung Stufe 1 und Stufe 2
4. Versand der Mahnungen per Mail

Akzeptanzkriterien

1. Überfällige Rechnungen sind sichtbar
2. Mahnung wird protokolliert
3. Mahnung enthält korrekte Beträge und Referenzen

Priorität
Should have

Betroffene Rollen
Finance, Admin, Mitglied

Abhängigkeiten
Mini Buchhaltung, Mailing und Newsletter

Titel
Öffentlicher Bereich

Beschreibung
Die Applikation hat einen öffentlichen Teil für Vereinsinfos und Events.

Funktionen

1. Öffentliche Seiten wie Über uns, Kontakt
2. Öffentliche Event Liste
3. Kontaktformular mit Spam Schutz

Akzeptanzkriterien

1. Inhalte sind ohne Login erreichbar
2. Formular schützt gegen Spam und speichert keine sensiblen Daten ungeschützt

Priorität
Must have

Betroffene Rollen
Bürger, Mitglied, Admin

Abhängigkeiten
Keine

Titel
Self Service Portal für Mitglieder

Beschreibung
Mitglieder können eigene Daten und Status einsehen.

Funktionen

1. Profil bearbeiten
2. Mitgliedschaft Status anzeigen
3. Offene Beiträge und Rechnungen anzeigen
4. Event Anmeldungen anzeigen

Akzeptanzkriterien

1. Mitglied sieht nur eigene Daten
2. Profiländerungen sind im Admin Bereich sichtbar

Priorität
Should have

Betroffene Rollen
Mitglied

Abhängigkeiten
Mitgliederverwaltung, Rollen und Berechtigungen

Titel
Audit Log

Beschreibung
Änderungen an sensiblen Daten werden protokolliert.

Funktionen

1. Log für Änderungen an Mitgliedern, Finanzen, Rollen, Dokumenten
2. Anzeige und Filter im Admin Bereich

Akzeptanzkriterien

1. Jede Admin Änderung erzeugt einen Audit Eintrag
2. Audit Einträge können nicht durch normale Admins gelöscht werden

Priorität
Must have

Betroffene Rollen
Admin, Finance

Abhängigkeiten
Rollen und Berechtigungen

Titel
Backup und Restore

Beschreibung
Es gibt regelmässige Backups für Datenbank und Dokumente und einen Restore Prozess.

Funktionen

1. Backup Plan für DB
2. Backup Plan für Dokumente Storage
3. Restore Test Prozess

Akzeptanzkriterien

1. Backups laufen automatisiert
2. Restore kann in Staging getestet werden

Priorität
Must have

Betroffene Rollen
Admin

Abhängigkeiten
Infrastructure und Deployment

Titel
Reporting und Dashboard

Beschreibung
Wichtige Kennzahlen sind sichtbar.

Funktionen

1. Mitglieder Entwicklung
2. Offene Beiträge
3. Event Kennzahlen wie Anmeldungen, Einnahmen, Kosten
4. Sponsoring Übersicht

Akzeptanzkriterien

1. Dashboard lädt performant
2. Export ist möglich

Priorität
Should have

Betroffene Rollen
Admin, Finance, Event Manager

Abhängigkeiten
Mitgliederverwaltung, Eventverwaltung, Mini Buchhaltung

Titel
Mehrsprachigkeit

Beschreibung
UI soll später mehrsprachig sein.

Funktionen

1. Übersetzungsdateien für UI Texte
2. Sprache pro Benutzer oder Browser

Akzeptanzkriterien

1. Neue Sprache kann ohne Code Änderungen an Business Logik ergänzt werden

Priorität
Could have

Betroffene Rollen
Alle

Abhängigkeiten
Frontend Architektur
