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
Alle 59 Requirements aus der CSV werden mit REQ-001 bis REQ-059 referenziert.

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
