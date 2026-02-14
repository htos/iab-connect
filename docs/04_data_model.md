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
Registration

Beschreibung
Anmeldung zu einem Event.

Wichtige Felder
id
event_id
member_id
status
registered_at

Beziehungen
Registration zu Event
Registration zu Member

Indizes
event_id
member_id

Name
EmailTemplate

Beschreibung
Vorlage für Mails.

Wichtige Felder
id
name
subject
body
is_active

Indizes
name unique

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
Invoice

Beschreibung
Rechnung für Beiträge oder Events.

Wichtige Felder
id
invoice_number
member_id
amount
due_date
status
reference_type
reference_id

Indizes
invoice_number unique
due_date

Name
Payment

Beschreibung
Zahlung zu einer Rechnung.

Wichtige Felder
id
invoice_id
amount
paid_at
method
note

Indizes
invoice_id

Name
LedgerEntry

Beschreibung
Buchung in der Mini Buchhaltung.

Wichtige Felder
id
type
amount
date
category
cost_center
invoice_id optional
vendor_id optional

Indizes
date
category

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
