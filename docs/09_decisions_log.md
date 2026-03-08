Titel
Decisions Log

Einträge

Datum
2026 01 30

Entscheidung
Modularer Monolith als Backend Architektur.

Begründung
Schneller Aufbau, weniger Infrastruktur, bessere Wartbarkeit im MVP. Module können später ausgelagert werden.

Alternativen
Microservices Architektur von Beginn weg.

Auswirkung
Ein Deployment für Backend, klare Modul Trennung im Code, Gateway erst später nötig.

Datum
2026 01 30

Entscheidung
Backend Technologie ASP.NET Core C# mit Entity Framework Core und PostgreSQL.

Begründung
C# ist die stärkste Sprache des Teams. EF Core beschleunigt Entwicklung und Migrationen.

Alternativen
Java Spring Boot, Node mit NestJS, Python FastAPI.

Auswirkung
Standardisierte Patterns für Auth, Policies, Background Jobs, migrations und Testing.

Datum
2026 01 30

Entscheidung
Auth via Keycloak OIDC.

Begründung
Self hosted, flexibel, unterstützt Rollen, Social Login Provider, OIDC Standards.

Alternativen
Auth0, Microsoft Entra ID, direkte Provider Integration ohne Keycloak.

Auswirkung
Konfiguration im Identity Provider, Backend prüft JWT und mapped Rollen über Claims.

Datum
2026 01 30

Entscheidung
Requirements Quelle ist CSV Datei, Status wird in separatem Markdown Dokument geführt.

Begründung
Klare Trennung zwischen Anforderungsinhalten und Bearbeitungsstatus. CSV wird nicht versehentlich verändert. Status Tracking bleibt flexibel.

Alternativen
Alles in einer Datei, Datenbank für Requirements.

Auswirkung
Agent liest immer CSV für Inhalte und Status Dokument für Bearbeitungsstand. Matching erfolgt über ID.

Datum
2026 01 30

Entscheidung
ID Format in Status Datei ist REQ-NNN passend zur CSV Spalte ID.

Begründung
Konsistenz mit der Quelldatei. Eindeutige Zuordnung ohne Interpretationsspielraum.

Alternativen
Eigenes ID Schema, numerische IDs ohne Präfix.

Auswirkung
Requirements aus der CSV werden mit REQ-001 ff. referenziert (aktuell 85 Requirements inkl. Finance Addon).

Datum
2026 01 30

Entscheidung
MVP umfasst 32 Must have Requirements gemäss CSV Priorität.

Begründung
CSV definiert Prioritäten. Must have deckt Kernfunktionen ab. Fokus auf schnelle Lieferung.

Alternativen
Eigene Priorisierung unabhängig von CSV.

Auswirkung
Backlog und Planung orientieren sich an den CSV Prioritäten. Änderungen erfordern expliziten Auftrag.

Datum
2026 01 30

Entscheidung
Dokumentation folgt strikt den definierten Templates ohne Formatierungshilfen.

Begründung
Konsistenz über Sessions hinweg. Keine Interpretation nötig. Einfaches Parsen und Vergleichen.

Alternativen
Freiere Formatierung mit Markdown Tabellen und Listen.

Auswirkung
Kein Fettdruck, keine verschachtelten Listen, keine Bindestriche ausser wo unumgänglich.

Datum
2026 02 01

Entscheidung
Benutzerverwaltung über Keycloak Admin REST API statt eigener User Tabelle.

Begründung
Keycloak ist Single Source of Truth für Identitäten. Vermeidung von Datenduplizierung. Einheitliches Rollen Management. Passwort Reset und E Mail Verification via Keycloak.

Alternativen
Lokale User Tabelle mit Synchronisation zu Keycloak. Komplett eigene User Verwaltung ohne Keycloak.

Auswirkung
Backend benötigt Service Account Client mit Admin API Rechten. User CRUD erfolgt direkt über Keycloak. Kein separates User Entity im Domain Model. Abhängigkeit von Keycloak für alle User Operationen.

Datum
2026 02 14

Entscheidung
MinIO durch RustFS als S3-kompatiblen Document Storage ersetzt.

Begründung
Benutzer fordert RustFS statt MinIO. RustFS ist S3-kompatibel und unterstützt Versionierung über SNMD mit mehreren Datendirectories. AWSSDK.S3 wird als Client-Bibliothek verwendet, da es mit jedem S3-kompatiblen Storage funktioniert.

Alternativen
MinIO beibehalten, Azure Blob Storage, lokales Filesystem.

Auswirkung
Docker Compose verwendet RustFS-Image statt MinIO. Backend nutzt AWSSDK.S3 statt Minio .NET SDK. Konfiguration unter DocumentStorage Section statt Minio Section. IDocumentStorage Abstraktion ermöglicht späteren Storage-Wechsel ohne Code-Änderung.

Datum
2026 02 15

Entscheidung
Finance Modul auf CQRS/MediatR Pattern refaktorisiert. War das einzige Modul, das von der Standard-Architektur abwich.

Begründung
Konsistenz aller Module im Application Layer. CQRS mit MediatR und FluentValidation ermöglicht klare Trennung von Commands/Queries, automatische Validierung und Pipeline Behaviors. 126 Dateien wurden refaktorisiert.

Alternativen
Finance weiterhin als Ausnahme mit direkten Service-Klassen belassen.

Auswirkung
Alle Module verwenden nun denselben Application Layer Aufbau mit Commands, Queries, Handlers und Validators. Thin Endpoints delegieren an MediatR. 210 Finance Unit Tests sichern die Funktionalität.

Datum
2026 02 15

Entscheidung
QuestPDF für Invoice PDF-Generierung gewählt (MIT Lizenz, Community Edition, .NET native).

Begründung
Fluent C# API, kein externer Prozess nötig, aktive Community, gute Dokumentation. Community Edition ist kostenlos für Organisationen unter 1M USD Umsatz.

Alternativen
iTextSharp (AGPL/kommerziell), PdfSharp (weniger Features), wkhtmltopdf (externer Prozess).

Auswirkung
Invoice PDFs werden serverseitig generiert. Template-Pattern ermöglicht erweiterbare PDF-Layouts. NuGet-Paket QuestPDF 2025.1.1 hinzugefügt.

Datum
2026 02 15

Entscheidung
Codecrete.SwissQRBill.Generator für Swiss QR-bill PDF (SIX Group Spezifikation).

Begründung
.NET Bibliothek, die den Swiss QR-bill Standard der SIX Group vollständig implementiert. Generiert QR-Code und Zahlteil gemäss Spezifikation.

Alternativen
Eigene QR-Code Generierung, Net.Codecrete.QrCodeGenerator direkt.

Auswirkung
CH-Profil Rechnungen enthalten einen scanbaren QR-Zahlteil. NuGet-Paket Codecrete.SwissQRBill.Generator 3.3.0 hinzugefügt.

Datum
2026 02 15

Entscheidung
Soft-Delete mit ISoftDeletable Interface für alle Finance Entities (Compliance-Anforderung).

Begründung
Finanzdaten dürfen gemäss Aufbewahrungspflichten nicht physisch gelöscht werden. ISoftDeletable (IsDeleted, DeletedAt) als gemeinsames Interface. Global Query Filter in EF Core filtert gelöschte Einträge automatisch.

Alternativen
Hard Delete mit Archivtabellen, nur logisches Flag ohne Interface.

Auswirkung
Alle 9 Finance Entities (Account, Category, Transaction, Invoice, Payment, BankImport, DunningNotice, Receipt, TaxCode) implementieren ISoftDeletable. DELETE Endpoints führen Soft-Delete aus.

Datum
2026 02 15

Entscheidung
Invoice Cancellation (Storno) mit Reversal Transaction statt Delete für Sent/Overdue Rechnungen.

Begründung
Versandte oder überfällige Rechnungen dürfen nicht gelöscht werden. Stattdessen wird eine Storno-Buchung erzeugt, die den ursprünglichen Betrag ausgleicht. Audit-Trail bleibt vollständig.

Alternativen
Rechnung auf Status Cancelled setzen ohne Gegenbuchung.

Auswirkung
Invoice.Cancel() setzt CancellationReason und CancelledAt. Eine automatische Reversal-Transaction wird im selben Vorgang erzeugt. Nur Draft-Rechnungen können direkt gelöscht werden.

Datum
2026 02 15

Entscheidung
Factory Pattern für jurisdiktionsbasierte PDF-Generator Auswahl (IInvoicePdfGeneratorFactory).

Begründung
CH-Profil benötigt QR-bill Zahlteil, EU-Profil benötigt andere Pflichtfelder. Factory wählt zur Laufzeit den passenden Generator basierend auf dem FinanceProfile.

Alternativen
If/Switch im Generator, Strategy Pattern ohne Factory.

Auswirkung
IInvoicePdfGeneratorFactory und IInvoicePdfGenerator Interfaces. ChInvoicePdfGenerator nutzt QuestPDF und SwissQRBill. Neue Generatoren können per DI registriert werden.

Datum
2026 02 15

Entscheidung
Konfigurierbares TaxCode Entity statt hardcodierte VAT-Sätze.

Begründung
CH und EU haben unterschiedliche Steuersätze, die sich ändern können. TaxCode Entity ermöglicht Verwaltung über Admin UI ohne Code-Änderungen. Jeder TaxCode hat Code, Label, Rate und IsDefault.

Alternativen
Enum für Steuersätze, hardcodierte Werte im Code.

Auswirkung
TaxCode CRUD Endpoints. InvoiceItem und Transaction referenzieren optional einen TaxCode. VAT Summary Export aggregiert nach TaxCode.

Datum
2026 02 28

Entscheidung
Doppelte Buchhaltung als optionale Hauptbuch-Ebene (Subledger plus General Ledger) mit AccountingMode Schalter auf FinanceProfile.

Begründung
Option B aus Analyse_Finanzen.md: Bestehendes Subledger (Transaktionen, Rechnungen, Zahlungen, Bankimport) bleibt primäre Eingabe-Ebene. Bei DoubleEntry Mode erzeugt ein PostingService automatisch JournalEntries im Hauptbuch. Anwender arbeiten wie bisher, erhalten aber korrekte doppelte Buchführung und Hauptbuch-Reports. Option A (Entweder-Oder) wurde verworfen, da bestehende Subledger-Screens wertvoll bleiben.

Alternativen
Option A: Modus-Umschalter ohne gleichzeitige Nutzung. Komplett eigene Transaction-Erfassung im Hauptbuch ohne Subledger.

Auswirkung
FinanceProfile bekommt AccountingMode Feld (SimpleCash default, DoubleEntry). 12 neue Requirements REQ-074 bis REQ-085. Neue Entities: LedgerAccount, JournalEntry, JournalEntryLine, PostingMapping. Bestehende Entities und Endpoints bleiben unverändert. Neue API Endpoints für Hauptbuch. PostingService integriert sich in bestehende Command Handlers.

Datum
2026 02 28

Entscheidung
Separater LedgerAccount Kontenplan statt Erweiterung der bestehenden Account Tabelle.

Begründung
Bestehende Account Entity (Kasse, Bank, Sonstige) hat eine andere Semantik als Hauptbuchkonten (Aktiven, Passiven, Eigenkapital, Ertrag, Aufwand). Zusammenlegung würde bestehendes UI und Logik brechen. Mapping zwischen Finance Account und LedgerAccount über PostingMapping.

Alternativen
Bestehende Account Tabelle um Kontenklassen erweitern und für beide Zwecke nutzen.

Auswirkung
Neue LedgerAccount Entity mit Kontenklasse, Normal-Saldo und Hierarchie. Finance Account bleibt unverändert. PostingMapping verbindet beide Ebenen.

Datum
2026 02 28

Entscheidung
PostingMapping Entity für konfigurierbare Zuordnung zwischen Subledger und Hauptbuch statt hardcodierter Regeln.

Begründung
Verschiedene Vereine haben unterschiedliche Kontenpläne. Admin muss selbst konfigurieren können welche Kategorie zu welchem Hauptbuchkonto mappt. Ohne Mapping blockiert das System das Posting mit klarer Fehlermeldung.

Alternativen
Hardcodierte Posting-Regeln basierend auf Konventionen. Automatische Kontenplan-Generierung ohne Konfiguration.

Auswirkung
PostingMapping Entity mit MappingType (Category, Account, TaxCode). CRUD Endpoints und Mapping UI. Vollständigkeits-Check vor erstem Posting. Standard-Mappings als Seed-Daten.

Datum
2026 02 28

Entscheidung
Alle Double Entry Requirements als Should-Priorität eingestuft und Sprint 6 zugeordnet.

Begründung
Doppelte Buchhaltung ist eine Erweiterung der bestehenden Einnahmen-Ausgaben-Rechnung. Kein Must-Have für MVP. Bestehende Finance-Funktionalität ist vollständig. Double Entry ist für Vereine relevant die gesetzlich zur doppelten Buchführung verpflichtet sind.

Alternativen
Als Must-Have einstufen und in Sprint 5 einplanen. Als Could-Have einstufen und auf unbestimmte Zeit verschieben.

Auswirkung
12 neue Requirements REQ-074 bis REQ-085 im Backlog als Sprint 6. Bestehende Sprints 1 bis 5 sind nicht betroffen.

Datum
2026 03 02

Entscheidung
Sponsoren mit Tier-System (Platinum, Gold, Silver, Bronze, Basic) und Status-Lifecycle (Prospect, Active, Inactive, Former) modelliert.

Begründung
Tier ermöglicht differenzierte Darstellung auf der öffentlichen Sponsorenseite. Status-Lifecycle bildet den typischen Sponsoring-Prozess ab. Packages als separate Entity ermöglichen mehrere Sponsoring-Pakete pro Sponsor.

Alternativen
Einfache Sponsor-Entity ohne Tier oder Status. Freie Tags statt vordefinierter Tiers.

Auswirkung
Sponsor AggregateRoot mit SponsorPackage und ContractLink als Child Entities. Öffentliche Sponsorenseite gruppiert nach Tier. REQ-031 und REQ-032 abgeschlossen.

Datum
2026 03 02

Entscheidung
ContractLink als polymorphe Verknüpfungs-Entity zwischen Sponsor/Supplier und externen Referenzen.

Begründung
Sponsoren und Lieferanten benötigen Verknüpfungen zu Dokumenten, Rechnungen und Events. ContractLink mit nullable sponsor_id und supplier_id ermöglicht flexible Zuordnung. LinkType Enum (Document, Invoice, Event, Other) kategorisiert die Verknüpfung.

Alternativen
Separate Verknüpfungstabellen je Entitätstyp. M:N Tabelle mit generischem Fremdschlüssel.

Auswirkung
Eine ContractLink-Tabelle für beide Entitätstypen. Validierung stellt sicher dass entweder sponsor_id oder supplier_id gesetzt ist.

Datum
2026 03 03

Entscheidung
Öffentliche Seiten unter /public/ Pfad-Präfix mit separatem Layout (PublicHeader/PublicFooter) ohne Authentifizierung.

Begründung
Klare Trennung zwischen öffentlichem und geschütztem Bereich. MainLayout (Sidebar, TopBar) wird für /public/ Pfade ausgeblendet. PublicHeader enthält Navigation, Login-Link und LanguageSwitcher. PublicFooter mit 3-Spalten Layout.

Alternativen
Separate Next.js App für öffentlichen Bereich. Gleiche Layout-Struktur mit konditionaler Auth.

Auswirkung
MainLayout prüft pathname.startsWith("/public/") und rendert isFullPageLayout. 6 öffentliche Seiten (Events, Blog, Kontakt, Sponsoren) mit eigenem Design. REQ-046, REQ-047, REQ-048, REQ-049 abgeschlossen.

Datum
2026 03 03

Entscheidung
Blog-Slug wird automatisch aus dem Titel generiert mit deutscher Umlaut-Transliteration (ä→ae, ö→oe, ü→ue, ß→ss).

Begründung
SEO-freundliche URLs für Blog-Posts. Deutsche Umlaute müssen korrekt in ASCII-kompatible Zeichen übersetzt werden da URLs keine Umlaute enthalten sollten.

Alternativen
URL-Encoding der Umlaute. Manuelle Slug-Eingabe durch den Admin.

Auswirkung
BlogPost.GenerateSlug() Methode mit Regex-basierter Transliteration. Slug ist unique Index. Bei Aktualisierung des Titels wird Slug automatisch regeneriert.

Datum
2026 03 03

Entscheidung
Honeypot-Feld als Spam-Schutz für das öffentliche Kontaktformular statt CAPTCHA.

Begründung
Honeypot ist benutzerfreundlicher als CAPTCHA. Verstecktes Feld wird von Bots ausgefüllt, vom Browser aber nicht angezeigt. Einfache Implementierung ohne externe Services.

Alternativen
Google reCAPTCHA, hCaptcha, Rate Limiting allein.

Auswirkung
ContactEndpoints POST /api/v1/public/contact prüft honeypot-Feld. Wenn ausgefüllt wird Request mit 200 OK beantwortet (Bot bemerkt nichts), aber nicht gespeichert.

Datum
2026 03 03

Entscheidung
BlogPost Tags als comma-separated String in einer Spalte statt separate Tag-Entity.

Begründung
Tags werden nur zur Anzeige und einfachen Filterung verwendet. Keine Tag-übergreifende Auswertung oder Taxonomie nötig. Einfachere Implementierung ohne zusätzliche Tabelle und Join.

Alternativen
Separate BlogTag Entity mit M:N Beziehung. JSON Array in PostgreSQL.

Auswirkung
Tags Feld in blog_posts Tabelle als String. EF Core ValueConverter für List zu comma-separated String Konvertierung. Filterung über LIKE Query.

Datum
2026 02 08

Entscheidung
Event-Benachrichtigungen als synchrone in-process E-Mails mit Silent-Fail statt Hangfire-Queue.

Begründung
Wartelisten-Benachrichtigungen sind zeitkritisch (sofortiges Feedback), aber nicht geschäftskritisch. Silent-Fail (try/catch ohne rethrow) verhindert, dass E-Mail-Fehler den Registrierungsfluss brechen. Einfacher als Hangfire-Queue für diesen Use-Case, da kein Retry nötig.

Alternativen
Hangfire-Queue (wie EmailCampaignJobService), Domain Events mit MediatR Notifications.

Auswirkung
EventNotificationService wird direkt in EventRegistrationEndpoints injiziert und synchron aufgerufen. E-Mail-Versand-Fehler werden geloggt, aber nicht propagiert. Bei Bedarf kann später auf Hangfire-Queue umgestellt werden.

---

Bereich
Finanzen / Buchhaltung

Datum
2026 07 14

Entscheidung
REQ-084: Backfill als MediatR Command mit Idempotenz-Prüfung über JournalEntry.GetBySourceAsync.

Begründung
Backfill muss sicher mehrfach ausführbar sein (idempotent). Pro Transaction/Payment wird geprüft, ob bereits ein JournalEntry mit SourceType+SourceId existiert. Fehler werden gesammelt statt abzubrechen — ein einzelner fehlerhafter Eintrag blockiert nicht die gesamte Migration. Audit-Logging dokumentiert jeden Backfill-Lauf.

Alternativen
Datenbank-Migration (zu riskant, nicht wiederholbar), Hangfire-Background-Job (unnötig komplex für einmalige Admin-Aktion).

Auswirkung
Admin-Panel in Finance Settings zeigt Backfill-Panel nur bei aktivierter doppelter Buchhaltung. Endpoint POST /api/v1/finance/backfill-double-entry mit FinanceWrite-Berechtigung. 8 Unit Tests verifizieren Idempotenz, Filterung, Fehlerbehandlung.

Datum
2025 07 19

Entscheidung
REQ-050/REQ-051 (Sprint 9): Dashboard KPIs als Cards im Haupt-Dashboard statt separater Seite, CSV-Exporte mit Semikolon-Trennung.

Begründung
KPI-Übersicht direkt im Dashboard vermeidet unnötige Navigation. Semikolon-getrennte CSV ist Standard in DACH-Region (Excel-Kompatibilität). Audit-Logging für alle Datenexporte (DSGVO-Compliance). ReportEndpoints gruppiert Dashboard und Export-Endpunkte unter /api/v1/reports/.

Alternativen
Separate Dashboard-Seite mit eigener Navigation (verworfen: User-Feedback bevorzugt integrierte Ansicht). Excel-Export mit ClosedXML (verworfen: CSV reicht für MVP, weniger Dependencies).

Auswirkung
Backend: GetDashboardOverviewQuery/Handler aggregiert Daten aus 8 Repositories. ExportMembers/ExportEventRegistrations-Handler generieren CSV mit EscapeCsv-Helper. 3 neue API-Endpunkte unter /api/v1/reports/. Frontend: KPI-Cards im Haupt-Dashboard (page.tsx) für Vorstand/Admin. CSV-Export-Buttons auf Mitgliederliste (Admin only) und Event-Registrierungen. 19 Unit-Tests.

Datum
2025 07 19

Entscheidung
Bugfix REQ-019/REQ-021: Fehlende Member-Event-Registrierung im Dashboard hinzugefügt.

Begründung
Backend-Endpoint POST /api/v1/events/{eventId}/registrations und Frontend-Service registerForEvent() waren implementiert, aber die Event-Detail-Seite (Dashboard) hatte keinen Registrierungs-Button. Nur die öffentliche Seite (/public/events/{id}) hatte ein Registrierungsformular.

Alternativen
Keine — war ein Bug (fehlende UI-Integration).

Auswirkung
Event-Detail-Seite zeigt nun: Registrierungs-Button wenn offen, Formular (Gäste, spezielle Anforderungen), Status-Anzeige wenn bereits registriert, Stornierungsoption mit Dialog. Nutzt bestehende i18n-Keys und Service-Funktionen.

Datum
2026 03 08

Entscheidung
REQ-052 (Sprint 10): Globale Suche mit ILIKE-Pattern über 6 Entitäten und RequireSearch Policy.

Begründung
PostgreSQL ILIKE bietet einfache Volltextsuche ohne zusätzliche Infrastruktur (Elasticsearch etc.). Relevanz-Scoring ermöglicht sinnvolle Sortierung. Zugriff auf admin, vorstand und kassier beschränkt (RequireSearch Policy) da Suchergebnisse sensible Daten enthalten können.

Alternativen
PostgreSQL Full-Text Search mit tsvector (verworfen: zu komplex für MVP). Elasticsearch (verworfen: zusätzliche Infrastruktur).

Auswirkung
Backend: PostgresGlobalSearchService sucht sequentiell über Members, Events, Documents, Invoices, Sponsors, Blog. Max 50 Ergebnisse pro Scope. Frontend: Suchleiste im Header mit Scope-Filter und Ergebnisliste.

Datum
2026 03 08

Entscheidung
REQ-053 (Sprint 10): Backup via Docker exec statt direktem pg_dump auf Host.

Begründung
PostgreSQL läuft im Docker Container. Der Host hat kein pg_dump installiert. Docker exec im Container ist die zuverlässigste Methode. Backup-Dateien werden via docker cp zwischen Container und Host transferiert.

Alternativen
pg_dump auf Host installieren (verworfen: zusätzliche Abhängigkeit, Versions-Mismatch-Risiko). pg_dump über TCP-Verbindung (verworfen: Container-Netzwerk-Konfiguration nötig).

Auswirkung
Backend: PostgresBackupService nutzt docker exec, docker cp für alle DB-Operationen. Konfigurierbar über Backup:DockerContainer Setting (default: iabconnect-postgres). 10 REST Endpoints für CRUD, Download, Restore, Upload, Schedule. Automatische Backups via Hangfire mit konfigurierbarem Cron-Zeitplan über Admin UI. Hangfire Storage wird für Persistenz des Zeitplans genutzt.

Datum
2026 03 08

Entscheidung
REQ-054 (Sprint 10): Serilog mit Console und File Sink, CorrelationId Middleware.

Begründung
Serilog ist Standard für strukturiertes Logging in ASP.NET Core. File Sink mit täglicher Rotation und 30 Tagen Aufbewahrung ist für MVP ausreichend. CorrelationId ermöglicht Request-Tracing.

Alternativen
Application Insights (verworfen: Cloud-Abhängigkeit). Seq (verworfen: zusätzliche Infrastruktur für MVP).

Auswirkung
Logs in logs/ Verzeichnis. CorrelationId in jedem Log-Eintrag. X-Correlation-Id Header für distributed tracing.

Datum
2026 03 08

Entscheidung
REQ-057 (Sprint 10): Aufbewahrungsrichtlinien mit 6 Datenkategorien und 3 Aktionen.

Begründung
DSGVO Art. 17 verlangt Löschkonzept. OR Art. 958f verlangt Aufbewahrungspflichten für Finanzdaten. Konfigurierbare Policies pro Kategorie bieten Flexibilität. Standard-Werte werden automatisch initialisiert.

Alternativen
Hardcodierte Retention Rules (verworfen: fehlende Flexibilität für verschiedene Rechtslagen).

Auswirkung
Backend: RetentionPolicy Entity mit EF Core. AnonymizeAuditLogsAsync (Raw SQL für Performance), DeleteOldBackupsAsync. Wöchentlicher Hangfire Job. Admin UI für Konfiguration.

Datum
2026 03 10

Entscheidung
REQ-017 (Sprint 11): Mitglieder-Segmentierung mit Static und Dynamic Segmenten.

Begründung
Statische Segmente erlauben manuelle Zuweisung von Mitgliedern. Dynamische Segmente definieren Kriterien (Status, Mitgliedstyp, MemberSince, Stadt, Land) als JSON, die zur Laufzeit ausgewertet werden. CriteriaJson als PostgreSQL jsonb für flexible Erweiterbarkeit. CSV-Export mit BOM und Semikolon-Trennung für DACH-Standard.

Alternativen
Nur statische Gruppen (verworfen: zu unflexibel für wiederkehrende Abfragen). Separate Filter-Engine (verworfen: YAGNI, IQueryable reicht für aktuelle Kriterien).

Auswirkung
Backend: MemberSegment AggregateRoot, MemberSegmentAssignment Entity, 10 API Endpoints, EF Migration. Frontend: 4 Seiten mit Criteria Builder. 37 Tests (22 Unit, 15 Integration).
