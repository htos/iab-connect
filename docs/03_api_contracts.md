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
POST /api/v1/events/{eventId}/registrations
GET /api/v1/events/{eventId}/registrations

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

Reporting
GET /api/v1/reports/members/statistics
GET /api/v1/reports/finance
GET /api/v1/reports/export/{type}

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
