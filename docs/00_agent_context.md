Titel
IAB Connect Agent Context

Ziel
IAB Connect ist eine WebApplikation für Indian Association Bern. Fokus ist schneller Aufbau als modularer Monolith und spätere Skalierung. Browser zuerst, später Android und iOS. Frontend ist Next.js mit TypeScript. Backend ist ASP.NET Core in C#. Datenbank ist PostgreSQL mit Entity Framework Core. Auth erfolgt über Keycloak via OpenID Connect. Background Jobs werden für Mail, Reminder und Rechnungen genutzt. Dokumente werden in S3 kompatiblem Storage wie MinIO gespeichert oder alternativ in File Storage mit sauberem Rechtemodell.

Grundprinzipien
1) Schnell lieferbar, klare Module, wenig Infrastruktur
2) Modularer Monolith, keine Microservices im MVP
3) Sicherheit und Rollenmodell von Anfang an
4) Daten und Dokumente müssen gesichert und wiederherstellbar sein
5) Dokumentation ist verbindlich und folgt den Templates in docs

Regeln für Requirements
Format pro Requirement ist immer
Titel
Beschreibung
Funktionen
Akzeptanzkriterien
Keine verschachtelten Listen. Kein Fettdruck. Klartext.

Arbeitsweise
1) Immer zuerst diese Datei lesen
2) Danach prüfen, welche docs Dateien existieren
3) Fehlende Dateien erstellen, bestehende konsistent aktualisieren
4) Änderungen immer als aktualisierte Markdown Inhalte liefern
5) Unklarheiten als Annahmen dokumentieren im Decisions Log

Requirements und Status
1) Requirements Inhalte kommen aus docs/Anforderungen_WebApp_Indischer_Kulturverein.csv
2) Status kommt aus docs/10_requirements_status.md
3) Der Agent muss vor jeder Arbeit zuerst die CSV lesen, dann das Status Dokument lesen
4) Der Agent erstellt fehlende Status Einträge automatisch für neue Requirements IDs
5) Der Agent ändert niemals die Requirement Inhalte in der CSV, ausser der User verlangt es explizit
6) docs/01_requirements.md ist eine lesbare Sicht auf die CSV und enthält zusätzlich den Status aus docs/10_requirements_status.md
