Titel
API Contracts

API Prinzipien
1) REST Endpoints pro Modul
2) Konsistentes Fehlerformat
3) Pagination und Filter für Listen Endpoints
4) Auth via Bearer Token von Keycloak
5) Authorisierung im Backend über Policies, nicht nur im Frontend

Versionierung
Für MVP keine Versionierung im Pfad. Später kann /api/v1 eingeführt werden.

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

Auth und Authorisierung
Authorization Header mit Bearer Token
Backend validiert Issuer, Audience, Signature
Backend nutzt Policies für Rollen und Claims

Endpoints

Identity and Access
GET /api/me
GET /api/users
POST /api/users
PATCH /api/users/{id}
GET /api/roles
POST /api/roles
POST /api/users/{id}/roles

Members
GET /api/members
GET /api/members/{id}
POST /api/members
PATCH /api/members/{id}
GET /api/members/{id}/membership
POST /api/members/{id}/membership

Events
GET /api/events
GET /api/events/{id}
POST /api/events
PATCH /api/events/{id}
POST /api/events/{id}/registrations
GET /api/events/{id}/registrations
POST /api/events/{id}/checkin

Communication
GET /api/email/templates
POST /api/email/templates
POST /api/email/campaigns
GET /api/email/logs
POST /api/email/automations

Documents
POST /api/documents
GET /api/documents
GET /api/documents/{id}
GET /api/documents/{id}/versions
POST /api/documents/{id}/permissions

Sponsors and Vendors
GET /api/sponsors
POST /api/sponsors
GET /api/vendors
POST /api/vendors

Finance
GET /api/finance/ledger
POST /api/finance/ledger
GET /api/invoices
POST /api/invoices
POST /api/payments
POST /api/invoices/{id}/reminders

Reporting
GET /api/reports/dashboard
GET /api/exports/members
GET /api/exports/finance
