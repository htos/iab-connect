Titel
Security und Datenschutz

Auth
Token Validierung
1) Backend validiert Issuer, Audience, Signature des JWT
2) Backend prüft Ablauf und Not Before
3) Backend nutzt Claims für Rollen Mapping

Rollen und Policies
1) Zugriff wird serverseitig erzwungen
2) Jede sensible Aktion hat eine Policy
3) Finance Daten nur für Finance Rolle

Admin Zugriff
1) Admin Bereich ist nur mit Admin Rolle erreichbar
2) Kritische Aktionen benötigen zusätzlich Bestätigung im UI

Audit
Was wird geloggt
1) Änderungen an Mitgliedern
2) Änderungen an Rollen und Benutzern
3) Finanz Buchungen und Zahlungen
4) Dokument Upload und Rechte Änderungen
5) Versand von Mahnungen

Aufbewahrung
Audit Einträge mindestens 24 Monate, danach anonymisieren oder archivieren, abhängig von Vereins Vorgaben.

Datenschutz
Einwilligungen
1) Newsletter Opt in wird gespeichert
2) Einwilligungen haben Zeitstempel und Quelle

Datenexport
1) Export der eigenen Mitgliedsdaten ist möglich
2) Export enthält keine Daten anderer Mitglieder

Löschkonzept
1) Mitglieder können anonymisiert werden statt gelöscht
2) Finanzdaten werden gemäss Aufbewahrungspflichten nicht gelöscht
3) Dokumente werden nach Retention Regeln archiviert
