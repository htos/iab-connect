Titel
Do und Dont

Do
1) Baue zuerst Must have Features fertig, dann erweitern
2) Halte Module im Monolith klar getrennt
3) Authorisierung immer im Backend prüfen
4) Schreibe Audit Einträge bei sensiblen Aktionen
5) Nutze Migrationen, keine manuellen DB Änderungen
6) Halte Dokumentation aktuell bei jeder Änderung
7) Schreibe alle UI-Texte auf Englisch
8) Nutze i18n Keys für übersetzbare Texte (useTranslations Hook von next-intl)
9) Design Mobile-First mit Tailwind responsive Klassen
10) Verwende die Sidebar-Navigation für alle authentifizierten Seiten
11) Datumsformat immer dd/mm/yyyy verwenden (de-CH Locale): `toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" })`
12) UI-Elemente basierend auf Berechtigungen ein-/ausblenden: Wenn ein User eine Aktion nicht ausführen darf (z.B. Löschen nur für Admin), dann darf diese Aktion auch nicht in der UI sichtbar sein
13) Schreibe Unit Tests für alle neuen Domain-Entities und Use Cases (xunit.v3 + FluentAssertions)
14) Schreibe Integration Tests für alle Repositories mit Testcontainers (echte PostgreSQL DB)
15) Tests müssen vor jedem Merge grün sein: `dotnet test` im Backend

Dont
1) Keine Microservices im MVP
2) Keine Business Logik in EF Entities
3) Keine direkten DB Queries im Controller
4) Keine Secrets in Git
5) Keine ungeschützten Admin Endpoints
6) Keine willkürlichen Dokumentations Formate ausserhalb der Templates
7) Keine hardcoded deutschen Texte in der UI
8) Keine fixed pixel Werte für responsive Layouts (nutze Tailwind Breakpoints)
9) Keine anderen Datumsformate als dd/mm/yyyy im Frontend
