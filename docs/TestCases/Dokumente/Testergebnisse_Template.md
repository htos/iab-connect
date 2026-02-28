# Testergebnisse — Dokumente-Modul IAB Connect

> **Tester:** ________________________  
> **Testdatum:** ________________________  
> **Umgebung:** ☐ Lokal (localhost) · ☐ Staging · ☐ Produktion  
> **Version/Commit:** ________________________  
> **Browser:** ________________________  
> **Betriebssystem:** ________________________

---

## Legende

| Symbol | Status | Bedeutung |
|--------|--------|-----------|
| ✅ | **Bestanden** | Erwartetes Ergebnis stimmt überein |
| ❌ | **Fehlgeschlagen** | Erwartetes Ergebnis stimmt NICHT überein |
| ⚠️ | **Teilweise** | Grundfunktion ok, aber Abweichungen vorhanden |
| ⏭️ | **Übersprungen** | Test nicht durchgeführt (Grund angeben) |
| 🔄 | **Blockiert** | Abhängigkeit nicht erfüllt |

---

## Zusammenfassung

| Bereich | Total | ✅ | ❌ | ⚠️ | ⏭️ | 🔄 |
|---------|-------|-----|-----|------|------|------|
| 1. Ordner erstellen | 6 | | | | | |
| 2. Ordner aktualisieren & löschen | 8 | | | | | |
| 3. Ordner-Hierarchie | 5 | | | | | |
| 4. Dokument hochladen | 8 | | | | | |
| 5. Dokument aktualisieren | 6 | | | | | |
| 6. Dokument löschen | 4 | | | | | |
| 7. Dokument-Status (State Machine) | 10 | | | | | |
| 8. Versionen | 8 | | | | | |
| 9. Tags | 6 | | | | | |
| 10. Suche & Filter | 6 | | | | | |
| 11. Ordner-Berechtigungen | 8 | | | | | |
| 12. Autorisierung & Rollen | 10 | | | | | |
| 13. Sichtbarkeit & Ablaufdatum | 6 | | | | | |
| 14. Validierung & Grenzwerte | 7 | | | | | |
| **TOTAL** | **98** | | | | | |

**Bestanden-Quote:** ______ / 98 = ______%

---

## Detaillierte Testergebnisse

### 1. Ordner erstellen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-001 | Root-Ordner erstellen | | |
| TC-DO-002 | Unterordner erstellen | | |
| TC-DO-003 | Name leer | | |
| TC-DO-004 | Nicht existierender Parent | | |
| TC-DO-005 | Name max 255 | | |
| TC-DO-006 | Name > 255 | | |

### 2. Ordner aktualisieren & löschen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-007 | Ordner aktualisieren | | |
| TC-DO-008 | Nicht existierend | | |
| TC-DO-009 | Leeren Ordner löschen | | |
| TC-DO-010 | Ordner mit Dokumenten (UNGÜLTIG) | | |
| TC-DO-011 | Löschen — Nicht existierend | | |
| TC-DO-012 | Ordner mit Unterordnern | | |
| TC-DO-013 | Beschreibung max 1000 | | |
| TC-DO-014 | Beschreibung > 1000 | | |

### 3. Ordner-Hierarchie

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-015 | Eigener Parent (UNGÜLTIG) | | |
| TC-DO-016 | Mehrstufige Hierarchie | | |
| TC-DO-017 | Ordner-Baum auflisten | | |
| TC-DO-018 | Ordner-Details | | |
| TC-DO-019 | Ordner verschieben | | |

### 4. Dokument hochladen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-020 | PDF hochladen | | |
| TC-DO-021 | Ohne FolderId (UNGÜLTIG) | | |
| TC-DO-022 | Ohne Datei (UNGÜLTIG) | | |
| TC-DO-023 | Ohne Name | | |
| TC-DO-024 | Nicht-Multipart Request | | |
| TC-DO-025 | Alle 10 Kategorien | | |
| TC-DO-026 | Nicht existierender Ordner | | |
| TC-DO-027 | Name max 500 Zeichen | | |

### 5. Dokument aktualisieren

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-028 | Metadaten aktualisieren | | |
| TC-DO-029 | Neue Datei (Version) | | |
| TC-DO-030 | Ordner wechseln | | |
| TC-DO-031 | Nicht existierend | | |
| TC-DO-032 | Description max 2000 | | |
| TC-DO-033 | Dokument herunterladen | | |

### 6. Dokument löschen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-034 | Dokument löschen | | |
| TC-DO-035 | Nicht existierend | | |
| TC-DO-036 | Archiviertes Dokument | | |
| TC-DO-037 | Published Dokument | | |

### 7. Dokument-Status (State Machine)

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-038 | Draft → Reviewed | | |
| TC-DO-039 | Reviewed → Published | | |
| TC-DO-040 | Draft → Published (direkt) | | |
| TC-DO-041 | Published → Archived | | |
| TC-DO-042 | Draft → Archived | | |
| TC-DO-043 | Archived → Archived (idempotent) | | |
| TC-DO-044 | Review von Published (UNGÜLTIG) | | |
| TC-DO-045 | Review von Archived (UNGÜLTIG) | | |
| TC-DO-046 | Publish von Archived (UNGÜLTIG) | | |
| TC-DO-047 | Review von Reviewed (UNGÜLTIG) | | |

### 8. Versionen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-048 | Neue Version beim Upload | | |
| TC-DO-049 | Version History | | |
| TC-DO-050 | Spezifische Version download | | |
| TC-DO-051 | Alte Version wiederherstellen | | |
| TC-DO-052 | Nicht exist. Version restore | | |
| TC-DO-053 | Auto-Increment Reihenfolge | | |
| TC-DO-054 | Unique Constraint | | |
| TC-DO-055 | Eigene S3-Datei pro Version | | |

### 9. Tags

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-056 | Tags hinzufügen | | |
| TC-DO-057 | Lowercase Normalisierung | | |
| TC-DO-058 | Duplikat-Tags (Silent Dedup) | | |
| TC-DO-059 | Tag max 100 | | |
| TC-DO-060 | Unique Constraint | | |
| TC-DO-061 | Tags in Suche | | |

### 10. Suche & Filter

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-062 | Nach Ordner filtern | | |
| TC-DO-063 | Nach Status filtern | | |
| TC-DO-064 | Nach Kategorie filtern | | |
| TC-DO-065 | Volltextsuche | | |
| TC-DO-066 | Paginierung | | |
| TC-DO-067 | PageSize max 100 | | |

### 11. Ordner-Berechtigungen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-068 | Berechtigung setzen | | |
| TC-DO-069 | 3 Access-Rollen | | |
| TC-DO-070 | 3 Permission-Typen | | |
| TC-DO-071 | Hierarchie (>=) | | |
| TC-DO-072 | Member sieht nur berechtigte | | |
| TC-DO-073 | Berechtigung ändern | | |
| TC-DO-074 | Berechtigung entfernen | | |
| TC-DO-075 | Admin sieht alles | | |

### 12. Autorisierung & Rollen

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-076 | Kein Token → 401 | | |
| TC-DO-077 | Member kann lesen | | |
| TC-DO-078 | Member kann NICHT hochladen | | |
| TC-DO-079 | Member kann KEINE Ordner erstellen | | |
| TC-DO-080 | Vorstand kann hochladen | | |
| TC-DO-081 | Vorstand kann KEINE Ordner erstellen | | |
| TC-DO-082 | Admin hat Ordner-Vollzugriff | | |
| TC-DO-083 | Kassier: lesen ja, schreiben nein | | |
| TC-DO-084 | Status nur RequireVorstand | | |
| TC-DO-085 | Admin kann Status ändern | | |

### 13. Sichtbarkeit & Ablaufdatum

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-086 | Member sieht nur Published | | |
| TC-DO-087 | Admin/Vorstand sieht alles | | |
| TC-DO-088 | Ablaufdatum setzen | | |
| TC-DO-089 | Abgelaufen → Member unsichtbar | | |
| TC-DO-090 | Abgelaufen → Admin sichtbar | | |
| TC-DO-091 | Ohne Ablaufdatum = unbegrenzt | | |

### 14. Validierung & Grenzwerte

| TC-ID | Testfall | Status | Bemerkung |
|-------|----------|--------|-----------|
| TC-DO-092 | FileSize positiv | | |
| TC-DO-093 | Sehr grosse Datei | | |
| TC-DO-094 | Name mit Sonderzeichen | | |
| TC-DO-095 | S3 Key Format | | |
| TC-DO-096 | Verschiedene Dateitypen | | |
| TC-DO-097 | Concurrent Uploads | | |
| TC-DO-098 | Dokument nicht gefunden | | |

---

## Bug-Log

| Bug-Nr | TC-ID | Beschreibung | Schwere | Status |
|--------|-------|-------------|---------|--------|
| | | | | |

---

## Freigabe / Sign-Off

| Rolle | Name | Datum | Unterschrift |
|-------|------|-------|-------------|
| Tester | | | |
| Entwickler | | | |
| Product Owner | | | |
