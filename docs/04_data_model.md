Titel
Datenmodell

Konventionen
Namensregeln
Tabellen im Plural. Spalten in snake_case oder camelCase, konsistent in allen Tabellen. EF Core Mapping definiert das Schema eindeutig.

IDs und Keys
Primärschlüssel sind UUID. Externe IDs für Keycloak werden separat gespeichert.

Timestamps
created_at und updated_at auf allen relevanten Tabellen. Optional deleted_at für Soft Delete.

Soft delete oder hard delete Regeln
Mitglieder und Finanzdaten werden nicht hard gelöscht. Dokumente werden versioniert. Hard Delete nur für technische Logs mit Retention.

Entities

Name
User

Beschreibung
Applikations Benutzer, verknüpft mit Keycloak Identität.

Wichtige Felder
id
keycloak_subject
email
is_active
last_login_at

Beziehungen
User zu Role über UserRole

Indizes
keycloak_subject unique
email unique

Validierungen
email muss gültig sein

Name
Role

Beschreibung
Rolle zur Autorisierung.

Wichtige Felder
id
name
description

Beziehungen
Role zu User über UserRole

Indizes
name unique

Validierungen
name ist nicht leer

Name
AuditEntry

Beschreibung
Protokoll für Admin Änderungen und sensitive Aktionen.

Wichtige Felder
id
actor_user_id
action
entity_type
entity_id
timestamp
metadata_json

Beziehungen
AuditEntry zu User

Indizes
timestamp

Name
Member

Beschreibung
Vereinsmitglied oder Kontakt im CRM Mini.

Wichtige Felder
id
first_name
last_name
email
phone
address
segment
status

Beziehungen
Member zu Membership
Member zu User optional

Indizes
email
last_name

Validierungen
email optional aber falls vorhanden gültig

Name
Membership

Beschreibung
Mitgliedschaft und Laufzeit.

Wichtige Felder
id
member_id
start_date
end_date
status
membership_type

Beziehungen
Membership zu Member

Indizes
member_id

Name
Event

Beschreibung
Vereins Event.

Wichtige Felder
id
title
description
location
start_at
end_at
capacity
visibility

Beziehungen
Event zu Registration

Indizes
start_at

Name
EventRegistration

Beschreibung
Anmeldung zu einem Event mit vollständigem Status-Workflow.

Wichtige Felder
id
event_id
user_id (nullable)
member_id (nullable)
participant_name
participant_email
participant_phone
number_of_guests
status (Pending, Confirmed, Cancelled, Waitlisted, CheckedIn, NoShow)
is_waitlisted
waitlist_position
registered_at
confirmed_at (nullable)
cancelled_at (nullable)
cancellation_reason (nullable)
cancelled_by_participant
checked_in_at (nullable)
checked_in_by (nullable)
is_no_show

Beziehungen
EventRegistration zu Event
EventRegistration zu Member (optional)

Indizes
event_id
member_id
user_id

Name
EmailTemplate

Beschreibung
Vorlage für Mails mit Variablen und Versionierung.

Wichtige Felder
id
name
subject
html_content
text_content
category
description
version
is_active
created_at
updated_at
created_by
updated_by
is_deleted
variables (Liste von EmailTemplateVariable)

Indizes
name unique

Name
EmailTemplateVariable

Beschreibung
Variable in einer E-Mail-Vorlage.

Wichtige Felder
id
email_template_id
name
description
default_value
is_required

Beziehungen
EmailTemplateVariable zu EmailTemplate

Name
EmailCampaign

Beschreibung
E-Mail-Kampagne mit Empfänger-Segmentierung und Tracking.

Wichtige Felder
id
name
subject
html_content
plain_text_content
from_name
from_email
reply_to_email
segment_type (AllActiveMembers, Custom, Manual, EventParticipants, NewsletterSubscribers)
segment_filter
event_id (nullable)
status (Draft, Scheduled, Sending, Sent, Cancelled, Failed)
scheduled_at (nullable)
sent_at (nullable)
completed_at (nullable)
total_recipients
sent_count
delivered_count
opened_count
clicked_count
bounced_count
failed_count
created_by_id
created_by_name

Beziehungen
EmailCampaign zu EmailRecipient (one-to-many)

Indizes
status
scheduled_at

Name
EmailRecipient

Beschreibung
Empfänger einer E-Mail-Kampagne mit Zustellungs-Tracking.

Wichtige Felder
id
campaign_id
member_id (nullable)
email
first_name
last_name
status (Pending, Sent, Delivered, Opened, Clicked, Bounced, Complained, Unsubscribed, Failed, Skipped)
sent_at, delivered_at, opened_at, clicked_at, bounced_at, unsubscribed_at (nullable)
bounce_type (None, Soft, Hard)
bounce_message
error_message
external_message_id

Beziehungen
EmailRecipient zu EmailCampaign
EmailRecipient zu Member (optional)

Name
NewsletterSubscriber

Beschreibung
Newsletter-Abonnent (öffentlich, ohne Mitgliedschaft).

Wichtige Felder
id
email
first_name
last_name
is_active
subscribed_at
unsubscribed_at (nullable)
confirmed_at (nullable)
ip_address

Indizes
email unique

Name
Document

Beschreibung
Dokument Container mit Metadaten.

Wichtige Felder
id
name
category
owner_role
created_at

Beziehungen
Document zu DocumentVersion

Indizes
category

Name
DocumentVersion

Beschreibung
Version eines Dokuments mit Storage Pointer.

Wichtige Felder
id
document_id
version_number
storage_key
content_type
uploaded_at

Indizes
document_id
version_number unique pro document

Name
Sponsor

Beschreibung
Sponsor Kontakt und Sponsoring Daten.

Wichtige Felder
id
name
contact_email
status
amount

Indizes
name

Name
Vendor

Beschreibung
Lieferant oder Dienstleister.

Wichtige Felder
id
name
contact_email
service_type

Indizes
name

Name
Account

Beschreibung
Finanzkonto zur Kategorisierung von Buchungen (Kasse, Bank, Sonstige).

Wichtige Felder
id
name
number
type (Cash, Bank, Other)
description
is_active
sort_order
created_at
created_by
updated_at
updated_by
is_deleted (ISoftDeletable)
deleted_at (ISoftDeletable)
deleted_by

Beziehungen
Account zu Transaction

Indizes
number unique
name

Validierungen
name ist nicht leer
number ist nicht leer

Name
Category

Beschreibung
Kategorie für Einnahmen- oder Ausgabenbuchungen.

Wichtige Felder
id
name
type (Income, Expense)
color
is_active
created_at
created_by
is_deleted (ISoftDeletable)
deleted_at (ISoftDeletable)
deleted_by

Indizes
name

Validierungen
name ist nicht leer

Name
Transaction

Beschreibung
Buchung in der Mini Buchhaltung (Einnahme oder Ausgabe).

Wichtige Felder
id
date
description
amount
type (Income, Expense)
account_id
category_id optional
reference
notes
receipt_id optional
tax_code_id optional (REQ-062)
tax_rate optional (REQ-062)
tax_amount optional (REQ-062)
net_amount optional (REQ-062)
is_archived (IArchivable, REQ-070)
archived_at (IArchivable, REQ-070)
archived_by (IArchivable, REQ-070)
archive_reason (IArchivable, REQ-070)
retain_until (IArchivable, REQ-070)
created_at
created_by
updated_at
updated_by
is_deleted (ISoftDeletable)
deleted_at (ISoftDeletable)
deleted_by

Beziehungen
Transaction zu Account
Transaction zu Category optional
Transaction zu Receipt optional
Transaction zu TaxCode optional

Indizes
date
account_id
category_id

Validierungen
description ist nicht leer
amount ungleich 0

Name
Invoice

Beschreibung
Rechnung für Mitgliedsbeiträge, Sponsoring oder andere Leistungen. Unterstützt Storno mit Reversal Transaction.

Wichtige Felder
id
invoice_number
date
due_date
status (Draft, Sent, Paid, Overdue, Cancelled)
recipient_type (Member, Sponsor, Vendor, Other)
recipient_id optional
recipient_name
recipient_address
sub_total
tax_rate
tax_amount
total
notes
cancellation_reason (Storno)
cancelled_at (Storno)
subtotal_net (REQ-062 VAT Aggregat)
total_tax (REQ-062 VAT Aggregat)
total_gross (REQ-062 VAT Aggregat)
is_archived (IArchivable, REQ-070)
archived_at (IArchivable, REQ-070)
archived_by (IArchivable, REQ-070)
archive_reason (IArchivable, REQ-070)
retain_until (IArchivable, REQ-070)
created_at
created_by
updated_at
updated_by
is_deleted (ISoftDeletable)
deleted_at (ISoftDeletable)
deleted_by

Beziehungen
Invoice zu InvoiceItem (1:n)
Invoice zu Payment (1:n)
Invoice zu DunningNotice (1:n)

Indizes
invoice_number unique
due_date
status
recipient_id

Validierungen
invoice_number ist nicht leer
recipient_name ist nicht leer

Name
InvoiceItem

Beschreibung
Rechnungsposition mit optionaler Steuerberechnung (Netto/Brutto).

Wichtige Felder
id
invoice_id
description
quantity
unit_price
amount
tax_code_id optional (REQ-062)
tax_rate optional (REQ-062)
tax_amount optional (REQ-062)
net_amount optional (REQ-062)
gross_amount optional (REQ-062)
is_gross_entry (REQ-062)

Beziehungen
InvoiceItem zu Invoice
InvoiceItem zu TaxCode optional

Indizes
invoice_id

Validierungen
description ist nicht leer
quantity > 0

Name
Payment

Beschreibung
Zahlung zu einer Rechnung oder freistehend.

Wichtige Felder
id
date
amount
method (Cash, Transfer, Online)
reference
invoice_id optional
transaction_id optional
notes
created_at
created_by
updated_at
updated_by
is_deleted (ISoftDeletable)
deleted_at (ISoftDeletable)
deleted_by

Beziehungen
Payment zu Invoice optional
Payment zu Transaction optional

Indizes
invoice_id
date

Validierungen
amount > 0

Name
BankImport

Beschreibung
CSV-Import Batch aus Bankkontoauszügen.

Wichtige Felder
id
import_date
file_name
status (Pending, Processed)
imported_by
is_deleted (ISoftDeletable)
deleted_at (ISoftDeletable)
deleted_by

Beziehungen
BankImport zu BankImportItem (1:n)

Indizes
import_date

Validierungen
file_name ist nicht leer

Name
BankImportItem

Beschreibung
Einzelne Zeile aus einem Bank-CSV-Import.

Wichtige Felder
id
bank_import_id
transaction_date
description
amount
iban optional
reference optional
status (Unmatched, Matched, Ignored)
matched_payment_id optional

Beziehungen
BankImportItem zu BankImport
BankImportItem zu Payment optional (matched)

Indizes
bank_import_id

Name
DunningNotice

Beschreibung
Mahnung für überfällige Rechnungen (Stufe 1 bis 3).

Wichtige Felder
id
invoice_id
level (1 bis 3)
date
due_date
status (Created, Sent)
sent_at
notes
created_by
is_deleted (ISoftDeletable)
deleted_at (ISoftDeletable)
deleted_by

Beziehungen
DunningNotice zu Invoice

Indizes
invoice_id
date

Validierungen
level zwischen 1 und 3

Name
Receipt

Beschreibung
Beleg-Datei in S3-kompatiblem Storage (RustFS) mit Integritätsprüfung via SHA256.

Wichtige Felder
id
file_name
file_path (Storage Key in RustFS)
content_type
file_size
file_hash (SHA256)
uploaded_at
uploaded_by
notes
is_archived (IArchivable, REQ-070)
archived_at (IArchivable, REQ-070)
archived_by (IArchivable, REQ-070)
archive_reason (IArchivable, REQ-070)
retain_until (IArchivable, REQ-070)
is_deleted (ISoftDeletable)
deleted_at (ISoftDeletable)
deleted_by

Beziehungen
Receipt zu Transaction (über transaction.receipt_id)

Indizes
file_hash

Validierungen
file_name ist nicht leer
file_path ist nicht leer

Name
TaxCode

Beschreibung
Konfigurierbarer Steuercode (MWST/VAT) für Buchungen und Rechnungspositionen.

Wichtige Felder
id
code (z.B. NORMAL, REDUCED, EXEMPT)
label
rate (0 bis 1, z.B. 0.081 für 8.1%)
is_default
is_active
created_at
updated_at
is_deleted (ISoftDeletable)
deleted_at (ISoftDeletable)

Indizes
code unique

Validierungen
code ist nicht leer
label ist nicht leer
rate zwischen 0 und 1

Name
FinanceProfile

Beschreibung
Finanzprofil pro Verein (CH oder EU). Steuert Jurisdiktion, Währung, Geschäftsjahr, Organisationsdaten und Bankverbindung. Nur ein aktives Profil erlaubt.

Wichtige Felder
id
jurisdiction (CH, EU)
country_code optional (für EU)
currency (CHF, EUR)
fiscal_year_start_month
organization_name
organization_address
organization_city
organization_postal_code
organization_country
organization_email optional
organization_phone optional
organization_website optional
organization_uid optional (UID/Handelsregister)
vat_status (NotRegistered, Registered, SmallBusiness) (REQ-062)
vat_number optional (REQ-062)
bank_name optional
bank_iban optional
bank_bic optional
accounting_mode (SimpleCash, DoubleEntry) default SimpleCash (REQ-074)
is_active
created_at
updated_at

Indizes
is_active

Validierungen
organization_name ist nicht leer
organization_address ist nicht leer
fiscal_year_start_month zwischen 1 und 12

Name
LedgerAccount

Beschreibung
Hauptbuchkonto (Kontenplan) für doppelte Buchhaltung. Wird nur bei AccountingMode=DoubleEntry verwendet. Unterstützt hierarchische Kontenstruktur über parent_account_id. (REQ-075)

Wichtige Felder
id
number (Kontonummer, z.B. "1000")
name (Kontobezeichnung, z.B. "Bank")
account_class (Asset, Liability, Equity, Revenue, Expense)
normal_balance (Debit, Credit)
description optional
is_active default true
parent_account_id optional (FK zu LedgerAccount)
finance_profile_id (FK zu FinanceProfile)
sort_order
created_at
created_by
updated_at
updated_by
is_deleted (ISoftDeletable)
deleted_at
deleted_by

Beziehungen
LedgerAccount zu FinanceProfile
LedgerAccount zu LedgerAccount (self-referencing über parent_account_id)
LedgerAccount zu JournalEntryLine

Indizes
finance_profile_id + number unique (mit soft-delete Filter)

Validierungen
number ist nicht leer
name ist nicht leer

Name
JournalEntry

Beschreibung
Buchungssatz (Journal Entry Header) für doppelte Buchhaltung. Jeder Eintrag hat mindestens 2 Zeilen, wobei Soll gleich Haben sein muss. Unterstützt Storno über reversal_of_entry_id. (REQ-076, REQ-078)

Wichtige Felder
id
date
description
reference optional
status (Draft, Posted, Reversed)
source_type optional (z.B. "Transaction", "Payment")
source_id optional (FK zur Quell-Entität)
fiscal_period_id optional (FK zu FiscalPeriod)
finance_profile_id (FK zu FinanceProfile)
reversal_of_entry_id optional (FK zu JournalEntry für Storno)
created_at
created_by
posted_at
posted_by

Beziehungen
JournalEntry zu FinanceProfile
JournalEntry zu FiscalPeriod
JournalEntry zu JournalEntry (self-referencing für Storno)
JournalEntry zu JournalEntryLine (1:n)

Indizes
finance_profile_id
status
source_type + source_id
fiscal_period_id

Validierungen
description ist nicht leer
Post: Status muss Draft sein, mindestens 2 Zeilen, Soll == Haben
CreateReversal: Status muss Posted sein

Name
JournalEntryLine

Beschreibung
Einzelne Soll- oder Haben-Zeile eines Buchungssatzes. Referenziert ein Hauptbuchkonto und trägt entweder einen Soll- oder Haben-Betrag (nie beides). (REQ-076)

Wichtige Felder
id
journal_entry_id (FK zu JournalEntry)
ledger_account_id (FK zu LedgerAccount)
debit_amount decimal(18,2)
credit_amount decimal(18,2)
tax_code_id optional (FK zu TaxCode)
net_amount optional decimal(18,2)
tax_amount optional decimal(18,2)
activity_area_id optional (FK zu ActivityArea)

Beziehungen
JournalEntryLine zu JournalEntry
JournalEntryLine zu LedgerAccount
JournalEntryLine zu TaxCode
JournalEntryLine zu ActivityArea

Indizes
journal_entry_id
ledger_account_id

Validierungen
debit_amount >= 0
credit_amount >= 0
Entweder debit oder credit > 0 (nicht beides gleichzeitig)

Name
PostingMapping

Beschreibung
Zuordnung zwischen Nebenbuch-Entitäten (Kategorie, Konto, Steuercode) und Hauptbuchkonten für automatische Buchungssatz-Erstellung. (REQ-077, REQ-082)

Wichtige Felder
id
finance_profile_id (FK zu FinanceProfile)
mapping_type (Category, Account, TaxCode)
source_id (ID der Quell-Entität)
ledger_account_id (FK zu LedgerAccount, Ziel-Hauptbuchkonto)
tax_ledger_account_id optional (FK zu LedgerAccount, für Steuer-Buchungen)
created_at
created_by
updated_at
updated_by

Beziehungen
PostingMapping zu FinanceProfile
PostingMapping zu LedgerAccount (Hauptkonto)
PostingMapping zu LedgerAccount (Steuerkonto, optional)

Indizes
finance_profile_id + mapping_type + source_id unique

Validierungen
source_id darf nicht leer sein
ledger_account_id darf nicht leer sein

Name
InvoiceNumberCounter

Beschreibung
Atomarer Zähler für Rechnungsnummern pro Finanzprofil und Geschäftsjahr. Verwendet PostgreSQL UPSERT für konkurenzsichere Nummernvergabe (REQ-071).

Wichtige Felder
id
finance_profile_id (FK zu FinanceProfile)
fiscal_year (int, z.B. 2026)
prefix (string, z.B. "INV-2026-")
current_value (int, aktueller Zählerstand)
updated_at

Beziehungen
InvoiceNumberCounter zu FinanceProfile

Indizes
finance_profile_id + fiscal_year unique

Validierungen
fiscal_year > 0
current_value >= 0

Name
InvoiceTemplate

Beschreibung
Konfigurierbare Rechnungsvorlage für EU-Konformitätsfelder. Unterstützt Soft-Delete (ISoftDeletable).

Wichtige Felder
id
name
jurisdiction (CH, EU)
country_code optional
is_default
show_vat_id
show_tax_exemption_note
tax_exemption_note optional
show_reverse_charge_note
reverse_charge_note optional
show_payment_terms
default_payment_terms optional
show_bank_details
logo_url optional
header_text optional
footer_text optional
legal_notice optional
language
is_deleted (ISoftDeletable)
deleted_at (ISoftDeletable)

Indizes
jurisdiction
is_default

Validierungen
name ist nicht leer

Name
ActivityArea

Beschreibung
Aktivitätsbereich für die Zuordnung von Transaktionen und Buchungen zu Sparten/Projekten (REQ-068).

Wichtige Felder
id
name
code
description
color
is_active
sort_order
created_at
updated_at
is_deleted
deleted_at
deleted_by

Beziehungen
ActivityArea zu Transaction (optional)
ActivityArea zu InvoiceItem (optional)
ActivityArea zu JournalEntryLine (optional)

Indizes
code unique
is_active

Validierungen
name ist nicht leer
code ist nicht leer

Name
FiscalPeriod

Beschreibung
Fiskalperiode (Monat) mit Status-Workflow für Periodensperre (REQ-066).

Wichtige Felder
id
name
year
month
start_date
end_date
status (Open, Closed, Locked)
locked_at (nullable)
locked_by (nullable)
unlocked_at (nullable)
unlocked_by (nullable)
lock_notes
total_income
total_expense
closing_balance
created_at
updated_at

Beziehungen
FiscalPeriod zu JournalEntry

Indizes
year, month unique
status

Validierungen
end_date > start_date
Lock nur im Status Open möglich

Name
ExpenseClaim

Beschreibung
Spesenabrechnung mit Genehmigungs-Workflow: Draft, Submitted, UnderReview, Approved, Rejected, Reimbursed (REQ-067).

Wichtige Felder
id
title
description
amount
currency (CHF, EUR)
date
status (Draft, Submitted, UnderReview, Approved, Rejected, Reimbursed)
claimant_id
claimant_name
receipt_id (nullable)
reviewed_by (nullable)
reviewed_at (nullable)
review_comment
approved_by (nullable)
approved_at (nullable)
approval_comment
rejected_by (nullable)
rejected_at (nullable)
rejection_reason
payment_id (nullable)
reimbursed_at (nullable)
reimbursed_by (nullable)
created_at
created_by
updated_at
updated_by
is_deleted

Beziehungen
ExpenseClaim zu Receipt (optional)
ExpenseClaim zu Payment (optional)

Indizes
status
claimant_id
date

Validierungen
amount > 0
title ist nicht leer

Document Management Entities

Name
DocumentFolder

Beschreibung
Hierarchischer Ordner zur Organisation von Dokumenten. Unterstützt verschachtelte Ordnerstruktur über parent_folder_id.

Wichtige Felder
id
name
description
parent_folder_id
sort_order
created_at
updated_at
deleted_at

Beziehungen
DocumentFolder zu DocumentFolder self-referencing über parent_folder_id
DocumentFolder zu Document
DocumentFolder zu FolderPermission

Indizes
parent_folder_id
name unique pro parent_folder_id

Validierungen
name ist nicht leer
sort_order >= 0

Name
FolderPermission

Beschreibung
Rollenbasierte Zugriffsberechtigung pro Ordner.

Wichtige Felder
id
folder_id
role
permission_type

Beziehungen
FolderPermission zu DocumentFolder

Indizes
folder_id
folder_id + role unique

Validierungen
role ist nicht leer
permission_type ist Read, Write oder Manage

Name
Document

Beschreibung
Dokument mit Metadaten, Kategorie, Status und Ordnerzuordnung. Unterstützt Freigabe-Workflow und Soft Delete.

Wichtige Felder
id
name
description
category
status
folder_id
content_type
file_size
expires_at
reviewed_by
reviewed_at
published_by
published_at
created_at
updated_at
deleted_at

Beziehungen
Document zu DocumentFolder
Document zu DocumentVersion
Document zu DocumentTag

Indizes
folder_id
category
status
name

Validierungen
name ist nicht leer
status ist Draft, UnderReview, Published oder Archived

Name
DocumentVersion

Beschreibung
Version eines Dokuments mit Storage-Referenz. Jeder Upload erzeugt eine neue Version.

Wichtige Felder
id
document_id
version_number
storage_key
file_size
content_type
comment
uploaded_at
uploaded_by

Beziehungen
DocumentVersion zu Document

Indizes
document_id
document_id + version_number unique

Validierungen
version_number > 0
storage_key ist nicht leer

Name
DocumentTag

Beschreibung
Schlagwort zur flexiblen Kategorisierung eines Dokuments.

Wichtige Felder
id
document_id
name

Beziehungen
DocumentTag zu Document

Indizes
document_id
document_id + name unique

Validierungen
name ist nicht leer
---

Name
Sponsor

Beschreibung
Sponsor des Vereins mit Firmendaten, Kontaktperson und Sponsoring-Tier.

Wichtige Felder
id
company_name
contact_person
email
phone
website
street
city
postal_code
country
tier (Platinum, Gold, Silver, Bronze, Basic)
status (Prospect, Active, Inactive, Former)
notes
contract_start
contract_end

Beziehungen
Sponsor zu SponsorPackage (1:n)
Sponsor zu ContractLink (1:n)

Indizes
company_name

Validierungen
company_name ist nicht leer

---

Name
SponsorPackage

Beschreibung
Sponsoring-Paket eines Sponsors (z.B. Gold-Paket).

Wichtige Felder
id
sponsor_id
name
description
amount
currency
benefits
valid_from
valid_until

Beziehungen
SponsorPackage zu Sponsor

Indizes
sponsor_id

Validierungen
name ist nicht leer
amount >= 0

---

Name
Supplier

Beschreibung
Lieferant des Vereins mit Firmendaten und Kategorie.

Wichtige Felder
id
company_name
contact_person
email
phone
website
street
city
postal_code
country
category
status (Active, Inactive, Blocked)
notes
rating

Beziehungen
Supplier zu ContractLink (1:n)

Indizes
company_name

Validierungen
company_name ist nicht leer

---

Name
ContractLink

Beschreibung
Verknüpfung zwischen Sponsor/Lieferant und Dokumenten, Rechnungen oder Events.

Wichtige Felder
id
sponsor_id (nullable)
supplier_id (nullable)
link_type (Document, Invoice, Event, Other)
reference_id
description
valid_from
valid_until

Beziehungen
ContractLink zu Sponsor (optional)
ContractLink zu Supplier (optional)

Indizes
sponsor_id
supplier_id
reference_id

Validierungen
Entweder sponsor_id oder supplier_id muss gesetzt sein

---

Name
BlogPost

Beschreibung
Blog- oder Newsbeitrag für die öffentliche Website.

Wichtige Felder
id
title
slug (auto-generiert aus Titel, unique)
content
excerpt (optional)
author
category
tags (Liste als comma-separated string)
image_url (optional)
status (Draft, Published, Archived)
published_at (nullable)
created_at
updated_at

Beziehungen
Keine direkten FK-Beziehungen

Indizes
slug unique
status
published_at

Validierungen
title ist nicht leer
content ist nicht leer
author ist nicht leer
slug wird automatisch generiert (inkl. deutsche Umlaute ä→ae, ö→oe, ü→ue, ß→ss)

---

Name
ContactMessage

Beschreibung
Kontaktformular-Nachricht von der öffentlichen Website.

Wichtige Felder
id
name
email
subject
message
status (New, Read, Responded, Archived)
response_notes (optional)
responded_at (nullable)
responded_by (nullable)
created_at
updated_at

Beziehungen
Keine direkten FK-Beziehungen

Indizes
status
created_at

Validierungen
name ist nicht leer
email ist nicht leer
subject ist nicht leer
message ist nicht leer

---

Name
BackupRecord

Beschreibung
Datensatz für Datenbank-Backups mit Status-Tracking und Wiederherstellungs-Info.

Wichtige Felder
id (UUID)
file_name
file_size_bytes (long)
type (Manual, Scheduled, Upload)
status (InProgress, Completed, Failed)
notes (optional)
error_message (optional)
created_by
created_at
completed_at (nullable)
restored_at (nullable)
restored_by (nullable)

Beziehungen
Keine direkten FK-Beziehungen

Indizes
status
created_at

Validierungen
file_name ist nicht leer
created_by ist nicht leer
Automatische Stuck-Erkennung nach 10 Minuten InProgress

---

Name
RetentionPolicy

Beschreibung
Aufbewahrungsrichtlinie für verschiedene Datenkategorien gemäss DSGVO und OR.

Wichtige Felder
id (UUID)
data_category (AuditLogs, MemberData, FinanceData, Documents, Backups, Events)
retention_months (int, mindestens 1)
action (Anonymize, Archive, Delete)
is_active (bool)
description
legal_basis (optional)
created_at
updated_at

Beziehungen
Keine direkten FK-Beziehungen

Indizes
data_category unique

Validierungen
retention_months >= 1
data_category und action sind gültige Enum-Werte
6 Standard-Richtlinien werden beim Start automatisch initialisiert

Privacy und Datenschutz Entities

Name
Consent

Beschreibung
Einwilligung eines Benutzers für verschiedene Zwecke (DSGVO-konform).

Wichtige Felder
id
user_id
type (DataProcessing, Newsletter, Marketing, EventNotifications, PhotoUsage)
is_granted
granted_at
revoked_at (nullable)
policy_version
ip_address
user_agent
updated_at

Beziehungen
Consent zu User

Indizes
user_id, type unique

Name
DeletionRequest

Beschreibung
Löschantrag eines Benutzers mit Bestätigungs-Workflow (DSGVO Art. 17).

Wichtige Felder
id
user_id
email
status (Pending, Confirmed, UnderReview, Completed, Cancelled, Rejected)
requested_at
confirmed_at (nullable)
completed_at (nullable)
confirmation_token
token_expires_at
reason
admin_notes
ip_address

Beziehungen
DeletionRequest zu User

Indizes
user_id
status

Authorization Entities

Name
CustomRole

Beschreibung
Benutzerdefinierte Rolle für flexible Rollenverwaltung.

Wichtige Felder
id
name
description
linked_role
is_active
color
sort_order
created_at
created_by
updated_at
updated_by

Indizes
name unique

Name
SystemSettings

Beschreibung
Globale Anwendungseinstellungen.

Wichtige Felder
id
application_name
logo_text
logo_background_color
logo_text_color
updated_at
updated_by

Audit Entity

Name
AuditEvent

Beschreibung
Revisionssicherer Protokolleintrag für alle sicherheitsrelevanten Aktionen.

Wichtige Felder
id
timestamp
event_type (30+ Typen: LoginSuccess, LoginFailure, MemberCreated, FinanceCreated etc.)
category (Authentication, UserManagement, MemberManagement, Finance, DataAccess, System)
severity (Info, Warning, Critical)
user_id
user_name
ip_address
user_agent
entity_type
entity_id
action
details (JSON)
success
error_message

Indizes
timestamp
event_type
category
user_id
entity_type, entity_id
