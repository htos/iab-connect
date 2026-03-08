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
16) **IMMER das Standard-Layout für alle Admin-/Feature-Seiten verwenden** (siehe Design-Standards unten)
17) **Immer Orange (#EA580C / orange-600) als Primärfarbe** für Buttons und Links, nicht Blau
18) **Enum-Werte im Frontend müssen exakt mit Backend-Enums übereinstimmen** (PascalCase)

## Design-Standards für Frontend-Seiten

### Standard Page Layout (PFLICHT für alle authentifizierten Seiten)

```tsx
// Loading State
<div className="flex min-h-[calc(100vh-4rem)] items-center justify-center">
  <div className="text-center">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
    <p className="mt-4 text-gray-600">{t("common.loading")}</p>
  </div>
</div>

// Main Layout
<main className="min-h-[calc(100vh-4rem)] p-4 md:p-8 bg-gray-50">
  <div className="max-w-7xl mx-auto">  {/* oder max-w-4xl für Formulare */}
    {/* Header */}
    <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
        <p className="text-gray-600 mt-1">{subtitle}</p>
      </div>
      {/* Primary Action Button */}
      <Link
        href="/..."
        className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-700 transition-colors"
      >
        <PlusIcon /> Neu erstellen
      </Link>
    </div>
    {/* Content */}
  </div>
</main>
```

### Button-Styles (PFLICHT)

```tsx
// Primary Button (Hauptaktion)
className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg transition-colors"

// Secondary Button (Abbrechen etc.)
className="px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50"

// Danger Button (Löschen)
className="text-red-600 hover:text-red-800"

// Link Style
className="text-orange-600 hover:underline"
```

### Card/Panel Style

```tsx
<div className="bg-white rounded-lg shadow p-6">
  {/* Content */}
</div>
```

### Tabellen

```tsx
<div className="bg-white rounded-lg shadow overflow-hidden">
  <table className="min-w-full divide-y divide-gray-200">
    <thead className="bg-gray-50">
      <tr>
        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          {header}
        </th>
      </tr>
    </thead>
    <tbody className="bg-white divide-y divide-gray-200">
      {/* rows */}
    </tbody>
  </table>
</div>
```

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
10) **KEINE blauen Buttons** (bg-blue-*) - immer orange-600 verwenden!
11) **KEINE abweichenden Layouts** - immer das Standard-Layout verwenden
12) **KEINE container mx-auto px-4 py-8** - immer `<main>` mit Standard-Klassen
13) **KEINE inline `api.get/post` Aufrufe in Event-Handlern** für Daten-Refresh nach Mutationen. Stattdessen: `refreshKey` State-Variable + `useEffect` mit `cancelled`-Flag für den Datenabruf. Handler machen nur die Mutation und setzen `setRefreshKey(k => k + 1)`. Inline-Fetches in onClick/onSubmit-Handlern führen zu permanentem Loading wegen Closure- und Race-Condition-Problemen.
14) **KEINE private Backing-Field Manipulationen für EF-tracked Collections** zum Speichern neuer Child-Entities. Statt `aggregate.AddChild()` + `dbContext.SaveChangesAsync()` → immer `dbContext.Set<ChildEntity>().Add(child)` direkt nutzen, da EF Core Change-Tracking über private Backing-Fields bei Aggregate-Patterns zu `DbUpdateConcurrencyException` führen kann.
