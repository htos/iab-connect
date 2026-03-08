Titel
API Contracts

API Prinzipien

1. REST Endpoints pro Modul
2. Konsistentes Fehlerformat
3. Pagination und Filter für Listen Endpoints
4. Auth via Bearer Token von Keycloak
5. Authorisierung im Backend über Policies, nicht nur im Frontend

Versionierung
Alle Endpoints verwenden /api/v1 als Basis-Pfad.

Fehlerformat
Response Felder
code
message
details
traceId

Pagination und Filter
Query Parameter
page
pageSize
sort
filter

Alle Listen-Endpunkte (GET collections) unterstützen diese Pagination Query-Parameter.
Response Format für paginierte Listen: PagedResult<T>
  items: Array der Ergebnisse
  page: Aktuelle Seite
  pageSize: Seitengrösse
  totalCount: Gesamtanzahl
  totalPages: Gesamtseiten

Auth und Authorisierung
Authorization Header mit Bearer Token
Backend validiert Issuer, Audience, Signature
Backend nutzt Policies für Rollen und Claims

Endpoints

Identity and Access
GET /api/v1/identity/me
GET /api/v1/identity/roles
GET /api/v1/identity/check-role/{role}
GET /api/v1/identity/admin-check
GET /api/v1/identity/vorstand-check
GET /api/v1/identity/member-check
GET /api/v1/users
GET /api/v1/users/count
GET /api/v1/users/{userId}
POST /api/v1/users
PUT /api/v1/users/{userId}
DELETE /api/v1/users/{userId}
PUT /api/v1/users/{userId}/enabled
POST /api/v1/users/{userId}/reset-password
GET /api/v1/users/{userId}/roles
PUT /api/v1/users/{userId}/roles
GET /api/v1/users/roles

Members
GET /api/v1/members/me
PUT /api/v1/members/me
GET /api/v1/members/me/profile-status
GET /api/v1/members
GET /api/v1/members/{id}
POST /api/v1/members
PUT /api/v1/members/{id}
DELETE /api/v1/members/{id}
PUT /api/v1/members/{id}/status
PUT /api/v1/members/{id}/type
GET /api/v1/members/statistics

Events
GET /api/v1/events/public
GET /api/v1/events/public/{id}
GET /api/v1/events
GET /api/v1/events/upcoming
GET /api/v1/events/{id}
POST /api/v1/events
PUT /api/v1/events/{id}
POST /api/v1/events/{id}/publish
POST /api/v1/events/{id}/unpublish
POST /api/v1/events/{id}/cancel
DELETE /api/v1/events/{id}

Event Registrations
POST /api/v1/events/{eventId}/registrations/public (Öffentlich, keine Auth)
GET /api/v1/events/{eventId}/registrations (Admin, Vorstand, Event-Manager)
GET /api/v1/events/{eventId}/registrations/{registrationId} (Admin, Vorstand, Event-Manager)
POST /api/v1/events/{eventId}/registrations (Member, angemeldete Mitglieder)
PUT /api/v1/events/{eventId}/registrations/{registrationId} (Admin, Vorstand, Event-Manager)
POST /api/v1/events/{eventId}/registrations/{registrationId}/cancel (Member)
POST /api/v1/events/{eventId}/registrations/{registrationId}/confirm (Admin, Vorstand, Event-Manager)
POST /api/v1/events/{eventId}/registrations/{registrationId}/check-in (Admin, Vorstand, Event-Manager)
POST /api/v1/events/{eventId}/registrations/{registrationId}/no-show (Admin, Vorstand, Event-Manager)
POST /api/v1/events/{eventId}/registrations/{registrationId}/revert-no-show (Admin, Vorstand, Event-Manager)
POST /api/v1/events/{eventId}/registrations/{registrationId}/revert-check-in (Admin, Vorstand, Event-Manager)
POST /api/v1/events/{eventId}/registrations/{registrationId}/revert-cancellation (Admin, Vorstand, Event-Manager)
GET /api/v1/events/{eventId}/registrations/statistics (Admin, Vorstand, Event-Manager)
GET /api/v1/events/{eventId}/registrations/export-pdf (Admin, Vorstand, Event-Manager)
GET /api/v1/events/{eventId}/registrations/waitlist (Admin, Vorstand, Event-Manager)
POST /api/v1/events/{eventId}/registrations/promote-from-waitlist (Admin, Vorstand, Event-Manager)
GET /api/v1/events/{eventId}/registrations/my-position (Authentifiziert)
POST /api/v1/registrations/check-in/{qrCodeToken} (Admin, Vorstand, Event-Manager)
GET /api/v1/my-registrations (Authentifiziert, eigene Anmeldungen)

Communication
POST /api/v1/communication/newsletter
POST /api/v1/communication/notify

Documents
GET /api/v1/document-folders
GET /api/v1/document-folders/{id}
POST /api/v1/document-folders
PUT /api/v1/document-folders/{id}
DELETE /api/v1/document-folders/{id}
PUT /api/v1/document-folders/{id}/permissions
GET /api/v1/documents
GET /api/v1/documents/{id}
POST /api/v1/documents
PUT /api/v1/documents/{id}
DELETE /api/v1/documents/{id}
GET /api/v1/documents/{id}/download
POST /api/v1/documents/{id}/upload-version
GET /api/v1/documents/{id}/versions
GET /api/v1/documents/{id}/versions/{versionNumber}/download
POST /api/v1/documents/{id}/versions/{versionNumber}/restore
POST /api/v1/documents/{id}/review
POST /api/v1/documents/{id}/publish
POST /api/v1/documents/{id}/archive
GET /api/v1/documents/tags
PUT /api/v1/documents/{id}/tags

Sponsors and Vendors
GET /api/sponsors
POST /api/sponsors
GET /api/vendors
POST /api/vendors

Settings
GET /api/v1/settings/public
GET /api/v1/settings
PUT /api/v1/settings

Custom Roles
GET /api/v1/custom-roles/active
GET /api/v1/custom-roles
GET /api/v1/custom-roles/{id}
POST /api/v1/custom-roles
PUT /api/v1/custom-roles/{id}
DELETE /api/v1/custom-roles/{id}

Audit
GET /api/v1/audit
GET /api/v1/audit/export
GET /api/v1/audit/entity/{entityType}/{entityId}
GET /api/v1/audit/user/{userId}
GET /api/v1/audit/categories
GET /api/v1/audit/event-types
POST /api/v1/audit/login

Registration
POST /api/v1/registration

Email Templates
Siehe Email Template Endpoints

Email Campaigns
Siehe Email Campaign Endpoints

Finance
GET /api/v1/finance/accounts
POST /api/v1/finance/accounts
PUT /api/v1/finance/accounts/{id}
DELETE /api/v1/finance/accounts/{id}
POST /api/v1/finance/accounts/{id}/activate
POST /api/v1/finance/accounts/{id}/deactivate

GET /api/v1/finance/categories
POST /api/v1/finance/categories
PUT /api/v1/finance/categories/{id}
DELETE /api/v1/finance/categories/{id}
POST /api/v1/finance/categories/{id}/activate
POST /api/v1/finance/categories/{id}/deactivate

GET /api/v1/finance/transactions
GET /api/v1/finance/transactions/summary
GET /api/v1/finance/transactions/{id}
POST /api/v1/finance/transactions
PUT /api/v1/finance/transactions/{id}
DELETE /api/v1/finance/transactions/{id}
POST /api/v1/finance/transactions/{id}/receipt
DELETE /api/v1/finance/transactions/{id}/receipt

GET /api/v1/finance/invoices
GET /api/v1/finance/invoices/open
GET /api/v1/finance/invoices/{id}
POST /api/v1/finance/invoices
PUT /api/v1/finance/invoices/{id}
DELETE /api/v1/finance/invoices/{id}
POST /api/v1/finance/invoices/{id}/send
POST /api/v1/finance/invoices/{id}/cancel
POST /api/v1/finance/invoices/{id}/mark-overdue
POST /api/v1/finance/invoices/{id}/archive
POST /api/v1/finance/invoices/{id}/restore
POST /api/v1/finance/invoices/{id}/validate-einvoice
GET /api/v1/finance/invoices/{id}/pdf

GET /api/v1/finance/payments
POST /api/v1/finance/payments
PUT /api/v1/finance/payments/{id}
DELETE /api/v1/finance/payments/{id}
POST /api/v1/finance/payments/{id}/submit (RequireFinanceWrite, Zur Genehmigung einreichen REQ-067)
POST /api/v1/finance/payments/{id}/approve (RequireVorstand, Zahlung genehmigen REQ-067)
POST /api/v1/finance/payments/{id}/reject (RequireVorstand, Zahlung ablehnen REQ-067)
POST /api/v1/finance/payments/{id}/mark-paid (RequireFinanceWrite)
POST /api/v1/finance/payments/{id}/receipt (RequireFinanceWrite, Beleg anhängen REQ-061)
DELETE /api/v1/finance/payments/{id}/receipt (RequireFinanceWrite, Beleg trennen REQ-061)

GET /api/v1/finance/bank-imports
POST /api/v1/finance/bank-imports
GET /api/v1/finance/bank-imports/{id}
PUT /api/v1/finance/bank-imports/{id}/items/{itemId}/match
PUT /api/v1/finance/bank-imports/{id}/items/{itemId}/ignore
PUT /api/v1/finance/bank-imports/{id}/items/{itemId}/unmatch

GET /api/v1/finance/dunning
POST /api/v1/finance/dunning
POST /api/v1/finance/dunning/{id}/send

GET /api/v1/finance/receipts
POST /api/v1/finance/receipts
GET /api/v1/finance/receipts/{id}
GET /api/v1/finance/receipts/{id}/download
DELETE /api/v1/finance/receipts/{id}
POST /api/v1/finance/receipts/{id}/archive
POST /api/v1/finance/receipts/{id}/restore

GET /api/v1/finance/exports/journal
GET /api/v1/finance/exports/open-items
GET /api/v1/finance/exports/vat-summary
POST /api/v1/finance/exports/pain001
POST /api/v1/finance/exports/pain001/validate

POST /api/v1/admin/finance/purge-archived

GET /api/v1/finance/profile
POST /api/v1/finance/profile
PUT /api/v1/finance/profile/{id}

GET /api/v1/finance/tax-codes
POST /api/v1/finance/tax-codes
PUT /api/v1/finance/tax-codes/{id}
DELETE /api/v1/finance/tax-codes/{id}

Finance Dashboard
GET /api/v1/finance/dashboard (RequireFinanceRead, Finanz-Übersicht mit Transaktionssummen, Rechnungs-, Zahlungs- und Spesenstatistiken)

Aktivitätsbereiche (REQ-068)
GET /api/v1/finance/activity-areas (RequireFinanceRead, Liste aktiver Aktivitätsbereiche)
GET /api/v1/finance/activity-areas/report (RequireFinanceRead, Erfolgsrechnung nach Aktivitätsbereich)
POST /api/v1/finance/activity-areas (RequireFinanceWrite)
PUT /api/v1/finance/activity-areas/{id} (RequireFinanceWrite)
DELETE /api/v1/finance/activity-areas/{id} (RequireFinanceWrite, Soft-Delete)

Fiskalperioden (REQ-066)
GET /api/v1/finance/fiscal-periods (RequireFinanceRead)
GET /api/v1/finance/fiscal-periods/{id} (RequireFinanceRead)
POST /api/v1/finance/fiscal-periods/generate (RequireFinanceWrite, Perioden für ein Jahr generieren)
POST /api/v1/finance/fiscal-periods/{id}/lock (RequireFinanceWrite)
POST /api/v1/finance/fiscal-periods/{id}/unlock (RequireAdmin)
POST /api/v1/finance/fiscal-periods/{id}/close (RequireFinanceWrite)
POST /api/v1/finance/fiscal-periods/{id}/reopen (RequireAdmin)

Spesenabrechnungen (REQ-067)
GET /api/v1/finance/expense-claims (RequireFinanceRead)
GET /api/v1/finance/expense-claims/{id} (RequireFinanceRead)
POST /api/v1/finance/expense-claims (RequireMember, erstellen)
PUT /api/v1/finance/expense-claims/{id} (RequireMember)
DELETE /api/v1/finance/expense-claims/{id} (RequireMember)
POST /api/v1/finance/expense-claims/{id}/submit (RequireMember, Zur Prüfung einreichen)
POST /api/v1/finance/expense-claims/{id}/review (RequireFinanceWrite, Prüfen)
POST /api/v1/finance/expense-claims/{id}/approve (RequireVorstand, Genehmigen)
POST /api/v1/finance/expense-claims/{id}/reject (RequireFinanceWrite, Ablehnen)
POST /api/v1/finance/expense-claims/{id}/reimburse (RequireFinanceWrite, Erstatten)

Rechnungsvorlagen (REQ-064)
GET /api/v1/finance/invoice-templates (RequireFinanceRead)
GET /api/v1/finance/invoice-templates/{id} (RequireFinanceRead)
POST /api/v1/finance/invoice-templates (RequireFinanceWrite, EU-Compliance-Felder)
PUT /api/v1/finance/invoice-templates/{id} (RequireFinanceWrite)
DELETE /api/v1/finance/invoice-templates/{id} (RequireFinanceWrite)

Archivierung (REQ-070)
POST /api/v1/finance/receipts/{id}/archive (RequireFinanceWrite, Beleg archivieren)
POST /api/v1/finance/receipts/{id}/restore (RequireAdmin, Beleg aus Archiv wiederherstellen)
POST /api/v1/finance/invoices/{id}/archive (RequireFinanceWrite, Rechnung archivieren)
POST /api/v1/finance/invoices/{id}/restore (RequireAdmin, Rechnung aus Archiv wiederherstellen)
POST /api/v1/admin/finance/purge-archived (RequireAdmin, Abgelaufene archivierte Belege löschen)
GET /api/v1/admin/finance/archived (RequireFinanceRead, Alle archivierten Elemente auflisten)

Doppelte Buchhaltung (REQ-074 bis REQ-085)
GET /api/v1/finance/ledger-accounts
POST /api/v1/finance/ledger-accounts
PUT /api/v1/finance/ledger-accounts/{id}
DELETE /api/v1/finance/ledger-accounts/{id}

GET /api/v1/finance/journal-entries
GET /api/v1/finance/journal-entries/{id}
GET /api/v1/finance/journal-entries/by-source
POST /api/v1/finance/journal-entries
POST /api/v1/finance/journal-entries/{id}/post
POST /api/v1/finance/journal-entries/{id}/reverse

GET /api/v1/finance/posting-mappings
POST /api/v1/finance/posting-mappings
PUT /api/v1/finance/posting-mappings/{id}
DELETE /api/v1/finance/posting-mappings/{id}

GET /api/v1/finance/accounting-reports/trial-balance
GET /api/v1/finance/accounting-reports/balance-sheet
GET /api/v1/finance/accounting-reports/profit-and-loss

Reporting
GET /api/v1/reports/members/statistics
GET /api/v1/reports/finance
GET /api/v1/reports/export/{type}
GET /api/v1/reports/dashboard — Dashboard KPIs (Mitglieder, Events, Finanzen) mit optionalem Zeitraumfilter (RequireVorstand) [REQ-050, Sprint 9]
GET /api/v1/reports/export/members — CSV-Export aller Mitglieder (RequireAdmin) [REQ-051, Sprint 9]
GET /api/v1/reports/export/events/{eventId}/registrations — CSV-Export der Event-Anmeldungen (RequireVorstand) [REQ-051, Sprint 9]

Privacy and DSGVO (REQ-012)
GET /api/v1/privacy/consents
PUT /api/v1/privacy/consents
POST /api/v1/privacy/consents/{type}
DELETE /api/v1/privacy/consents/{type}
GET /api/v1/privacy/export
POST /api/v1/privacy/delete-request
GET /api/v1/privacy/delete-request
POST /api/v1/privacy/delete-request/confirm
DELETE /api/v1/privacy/delete-request
GET /api/v1/privacy/delete-requests (Admin)
PUT /api/v1/privacy/delete-requests/{id} (Admin)

Sponsors und Suppliers (REQ-031 bis REQ-033)
GET /api/v1/sponsors
GET /api/v1/sponsors/{id}
POST /api/v1/sponsors
PUT /api/v1/sponsors/{id}
DELETE /api/v1/sponsors/{id}
POST /api/v1/sponsors/{id}/activate
POST /api/v1/sponsors/{id}/deactivate
GET /api/v1/sponsors/{id}/packages
POST /api/v1/sponsors/{id}/packages
POST /api/v1/sponsors/{id}/contract-links
GET /api/v1/sponsors/public (Öffentlich, kein Auth)

GET /api/v1/suppliers
GET /api/v1/suppliers/{id}
POST /api/v1/suppliers
PUT /api/v1/suppliers/{id}
DELETE /api/v1/suppliers/{id}
POST /api/v1/suppliers/{id}/activate
POST /api/v1/suppliers/{id}/deactivate
POST /api/v1/suppliers/{id}/contract-links

Blog (REQ-047)
GET /api/v1/blog (Admin, alle Posts)
GET /api/v1/blog/{id} (Admin)
POST /api/v1/blog (Admin, erstellen)
PUT /api/v1/blog/{id} (Admin, bearbeiten)
DELETE /api/v1/blog/{id} (Admin, löschen)
POST /api/v1/blog/{id}/publish (Admin)
POST /api/v1/blog/{id}/unpublish (Admin)
POST /api/v1/blog/{id}/archive (Admin)
GET /api/v1/blog/public (Öffentlich, nur published)
GET /api/v1/blog/public/{id} (Öffentlich, nur published)

Kontaktformular (REQ-049)
POST /api/v1/public/contact (Öffentlich, mit Honeypot Spam-Schutz)
GET /api/v1/contact-messages (Admin)
GET /api/v1/contact-messages/{id} (Admin)
POST /api/v1/contact-messages/{id}/read (Admin)
POST /api/v1/contact-messages/{id}/respond (Admin)
POST /api/v1/contact-messages/{id}/archive (Admin)
DELETE /api/v1/contact-messages/{id} (Admin)

Newsletter Public (REQ-029)
POST /api/v1/public/newsletter/subscribe (Öffentlich, Newsletter abonnieren mit E-Mail)
POST /api/v1/public/newsletter/unsubscribe (Öffentlich, Newsletter abmelden mit E-Mail)
GET /api/v1/public/newsletter/unsubscribe/{token} (Öffentlich, Token-basierte Abmeldung verifizieren)
POST /api/v1/public/newsletter/unsubscribe/{token} (Öffentlich, Token-basierte Abmeldung bestätigen)

Globale Suche (REQ-052)
GET /api/v1/search?query={text}&scope={scope}&page={page}&pageSize={pageSize} (RequireSearch: admin, vorstand, kassier)
Scope Werte: all, members, events, documents, invoices, sponsors, blog
Mindestens 2 Zeichen erforderlich. Max 50 Ergebnisse pro Scope.
Response: items (Scope, Id, Title, Subtitle, Relevance), totalCount, countsByScope

Backup und Restore (REQ-053)
GET /api/v1/admin/backups (Admin, Liste aller Backups)
POST /api/v1/admin/backups (Admin, neues Backup erstellen)
GET /api/v1/admin/backups/{id} (Admin, Backup Details)
GET /api/v1/admin/backups/{id}/download (Admin, Backup-Datei herunterladen)
POST /api/v1/admin/backups/{id}/restore (Admin, Datenbank aus Backup wiederherstellen)
POST /api/v1/admin/backups/upload (Admin, Backup-Datei hochladen, Multipart, max 500MB)
DELETE /api/v1/admin/backups/{id} (Admin, Backup löschen)
GET /api/v1/admin/backups/schedule (Admin, aktuellen Backup-Zeitplan abrufen)
PUT /api/v1/admin/backups/schedule (Admin, automatischen Backup-Zeitplan konfigurieren via Cron)
DELETE /api/v1/admin/backups/schedule (Admin, automatische Backups deaktivieren)

Aufbewahrungsrichtlinien (REQ-057)
GET /api/v1/admin/retention (Admin, alle Richtlinien)
GET /api/v1/admin/retention/{id} (Admin, einzelne Richtlinie)
PUT /api/v1/admin/retention/{id} (Admin, Richtlinie aktualisieren)
POST /api/v1/admin/retention/enforce (Admin, Aufbewahrung manuell durchsetzen)
