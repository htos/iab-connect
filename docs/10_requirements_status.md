Titel
Requirements Status

Regeln
1) Quelle der Requirements Inhalte ist docs/Anforderungen_WebApp_Indischer_Kulturverein.csv
2) Quelle des Status ist dieses Dokument
3) Matching erfolgt über die Spalte ID aus der CSV
4) Erlaubte Status Werte sind Backlog, Ready, InProgress, Blocked, Done, Dropped
5) Wenn ein Status fehlt, gilt Backlog

Status Einträge

ID: REQ-001
Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Login via Keycloak implementiert. Backend: JWT-Authentifizierung mit Rollenmapping. Frontend: NextAuth.js mit Keycloak-Provider, Login-Seite, rollenbasierte Navigation. Manuelle Tests in docs/06_dev_workflow.md dokumentiert.

ID: REQ-002
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-003
Status: Done
StatusSeit: 2026 01 31
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Implementiert als Teil von REQ-001. Drei Rollen (admin, vorstand, member) mit entsprechenden Authorization Policies im Backend und rollenbasierter UI im Frontend.

ID: REQ-004
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-005
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-006
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-007
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-008
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-009
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-010
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-011
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-012
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-013
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Mitgliederstammdaten implementiert. Domain: Member-Aggregat mit Address-Value-Object. API: 10 Endpunkte (CRUD, Status, Type, Statistics). Frontend: Mitgliederliste, Detail-, Bearbeitungs- und Erstellungsseiten.

ID: REQ-014
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: MembershipType (Regular, Student, Family, Honorary) und MembershipStatus (Pending, Active, Inactive, Suspended) als Enums implementiert. UI zeigt farbcodierte Badges.

ID: REQ-015
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Implementiert als Teil von REQ-013. Neues Mitglied kann über /members/new erstellt werden. Status wird auf Pending gesetzt, kann vom Vorstand über Detailseite geändert werden.

ID: REQ-016
Status: Done
StatusSeit: 2026 02 01
Owner: Implementation Agent
SprintOderRelease: Sprint 1
TicketLink:
Notizen: Mitgliederliste: /members mit Suche, Filter nach Status/Typ, Paginierung. Detailansicht: /members/[id]. Self-Service Profil: /profile (für Mitglieder-Rolle).

ID: REQ-017
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-018
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-019
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-020
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-021
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-022
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-023
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-024
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-025
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-026
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-027
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-028
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-029
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-030
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-031
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-032
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-033
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-034
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-035
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-036
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-037
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-038
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-039
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-040
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-041
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-042
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-043
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-044
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-045
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-046
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-047
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-048
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-049
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-050
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-051
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-052
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-053
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-054
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-055
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-056
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-057
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-058
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:

ID: REQ-059
Status: Backlog
StatusSeit: 2026 01 30
Owner:
SprintOderRelease:
TicketLink:
Notizen:
