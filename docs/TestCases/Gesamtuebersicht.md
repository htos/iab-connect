# Gesamtübersicht — Manuelle Testfälle IAB Connect

> **Version:** 1.1 — Code-verifiziert  
> **Erstellt:** 2025-01-XX  
> **Anwendung:** IAB Connect — Indischer Kulturverein Webapplikation  
> **Testumgebung:** http://localhost:5000 (API), http://localhost:3000 (Frontend)  
> **Keycloak:** http://localhost:8080 (Realm: iabconnect)

### Verifizierungsstatus
> Alle 7 Module wurden gegen den Quellcode verifiziert und korrigiert (v1.1).  
> Korrekturen umfassen: HTTP-Statuscodes, Endpoint-Pfade, Request/Response-Felder, Fehlermeldungen, Enum-Werte.  
> Bekannte Code-Lücken und Sicherheitsprobleme sind in den einzelnen Testfällen mit ⚠️ markiert.

---

## 1. Modulübersicht

| # | Modul | Testfälle-Datei | Ergebnis-Template | Testfälle | Bereiche |
|---|-------|----------------|-------------------|-----------|----------|
| 1 | **Finanzen** | [TestFaelle_Finanzen.md](Finanzen/TestFaelle_Finanzen.md) | [Testergebnisse](Finanzen/Testergebnisse_Template.md) | 228 | 26 |
| 2 | **Mitglieder** | [TestFaelle_Mitglieder.md](Mitglieder/TestFaelle_Mitglieder.md) | [Testergebnisse](Mitglieder/Testergebnisse_Template.md) | 99 | 12 |
| 3 | **Events** | [TestFaelle_Events.md](Events/TestFaelle_Events.md) | [Testergebnisse](Events/Testergebnisse_Template.md) | 120 | 15 |
| 4 | **Kommunikation** | [TestFaelle_Kommunikation.md](Kommunikation/TestFaelle_Kommunikation.md) | [Testergebnisse](Kommunikation/Testergebnisse_Template.md) | 87 | 14 |
| 5 | **Dokumente** | [TestFaelle_Dokumente.md](Dokumente/TestFaelle_Dokumente.md) | [Testergebnisse](Dokumente/Testergebnisse_Template.md) | 98 | 14 |
| 6 | **Auth & Identity** | [TestFaelle_Auth.md](Auth/TestFaelle_Auth.md) | [Testergebnisse](Auth/Testergebnisse_Template.md) | 86 | 11 |
| 7 | **Audit & DSGVO** | [TestFaelle_AuditDSGVO.md](AuditDSGVO/TestFaelle_AuditDSGVO.md) | [Testergebnisse](AuditDSGVO/Testergebnisse_Template.md) | 70 | 11 |
| | **GESAMT** | | | **788** | **103** |

---

## 2. Gesamtstatistik

| Kennzahl | Wert |
|----------|------|
| **Gesamtanzahl Testfälle** | 788 |
| **Anzahl Module** | 7 |
| **Anzahl Testbereiche** | 103 |
| **Anzahl Testfälle-Dateien** | 7 |
| **Anzahl Ergebnis-Templates** | 7 |

---

## 3. Testfälle nach Modul (Detailierte Aufschlüsselung)

### 3.1 Finanzen (228 Testfälle)

| Bereich | Prefix | Anzahl |
|---------|--------|--------|
| Finanzprofil | TC-FP | 9 |
| Konten | TC-KO | 10 |
| Kategorien | TC-KA | 5 |
| Steuercodes | TC-ST | 8 |
| Buchungen | TC-BU | 15 |
| Rechnungen | TC-RE | 31 |
| Zahlungen | TC-ZA | 19 |
| Spesenabrechnungen | TC-SP | 12 |
| Bankimport | TC-BI | 7 |
| Mahnwesen | TC-MA | 5 |
| Belege | TC-BE | 9 |
| Geschäftsperioden | TC-GP | 14 |
| Rechnungsvorlagen | TC-RV | 4 |
| Tätigkeitsbereiche | TC-TB | 3 |
| Dashboard | TC-DB | 2 |
| Exporte | TC-EX | 3 |
| Archivierung | TC-AR | 9 |
| Rechnungsnummern | TC-RN | 7 |
| eInvoice | TC-EI | 8 |
| pain.001 | TC-PA | 11 |
| PDF / QR-Bill | TC-PDF | 5 |
| Background Jobs | TC-BJ | 3 |
| Berechtigungen (Finanzen) | TC-AU | 7 |
| Paginierung | TC-PG | 5 |
| Soft-Delete | TC-SD | 2 |
| Frontend | TC-FE | 7 |
| Edge Cases | TC-EC | 71 |

### 3.2 Mitglieder (99 Testfälle)

| Bereich | Prefix | Anzahl |
|---------|--------|--------|
| Mitglied erstellen | TC-MG-001–012 | 12 |
| Mitglied aktualisieren | TC-MG-013–022 | 10 |
| Mitglied löschen | TC-MG-023–027 | 5 |
| Mitgliederliste | TC-MG-028–035 | 8 |
| Mitglied Detail | TC-MG-036–040 | 5 |
| Eigenes Profil | TC-MG-041–050 | 10 |
| Profil-Status/Onboarding | TC-MG-051–057 | 7 |
| Status ändern | TC-MG-058–067 | 10 |
| Mitgliedschaftstyp ändern | TC-MG-068–073 | 6 |
| Statistiken | TC-MG-074–077 | 4 |
| Autorisierung & Rollen | TC-MG-078–089 | 12 |
| Validierung & Grenzwerte | TC-MG-090–099 | 10 |

### 3.3 Events (120 Testfälle)

| Bereich | Prefix | Anzahl |
|---------|--------|--------|
| Event erstellen | TC-EV-001–008 | 8 |
| Event aktualisieren | TC-EV-009–014 | 6 |
| Event Status-Übergänge | TC-EV-015–028 | 14 |
| Event löschen | TC-EV-029–032 | 4 |
| Event-Liste & Filter | TC-EV-033–042 | 10 |
| Öffentliche Events | TC-EV-043–048 | 6 |
| Mitglieder-Registrierung | TC-EV-049–058 | 10 |
| Öffentliche Registrierung | TC-EV-059–068 | 10 |
| Kapazität & Warteliste | TC-EV-069–080 | 12 |
| Registrierung stornieren | TC-EV-081–086 | 6 |
| Check-In & QR-Code | TC-EV-087–096 | 10 |
| No-Show & Warteliste verwalten | TC-EV-097–102 | 6 |
| Meine Registrierungen | TC-EV-103–105 | 3 |
| Statistiken | TC-EV-106–108 | 3 |
| Autorisierung & Rollen | TC-EV-109–120 | 12 |

### 3.4 Kommunikation (87 Testfälle)

| Bereich | Prefix | Anzahl |
|---------|--------|--------|
| Kampagne erstellen | TC-KO-001–007 | 7 |
| Kampagne aktualisieren | TC-KO-008–012 | 5 |
| Kampagne löschen | TC-KO-013–016 | 4 |
| Kampagne senden | TC-KO-017–023 | 7 |
| Kampagne planen | TC-KO-024–028 | 5 |
| Kampagne abbrechen | TC-KO-029–033 | 5 |
| Kampagne erneut senden | TC-KO-034–039 | 6 |
| Test-E-Mail | TC-KO-040–043 | 4 |
| Empfänger & Segmente | TC-KO-044–049 | 6 |
| Statistiken | TC-KO-050–052 | 3 |
| E-Mail-Templates | TC-KO-053–064 | 12 |
| Personalisierung & Platzhalter | TC-KO-065–069 | 5 |
| Autorisierung & Rollen | TC-KO-070–077 | 8 |
| Status-Übergänge | TC-KO-078–087 | 10 |

### 3.5 Dokumente (98 Testfälle)

| Bereich | Prefix | Anzahl |
|---------|--------|--------|
| Ordner erstellen | TC-DO-001–006 | 6 |
| Ordner aktualisieren & löschen | TC-DO-007–014 | 8 |
| Ordner-Hierarchie | TC-DO-015–019 | 5 |
| Dokument hochladen | TC-DO-020–027 | 8 |
| Dokument aktualisieren | TC-DO-028–033 | 6 |
| Dokument löschen | TC-DO-034–037 | 4 |
| Dokument-Status (State Machine) | TC-DO-038–047 | 10 |
| Versionen | TC-DO-048–055 | 8 |
| Tags | TC-DO-056–061 | 6 |
| Suche & Filter | TC-DO-062–067 | 6 |
| Ordner-Berechtigungen | TC-DO-068–075 | 8 |
| Autorisierung & Rollen | TC-DO-076–085 | 10 |
| Sichtbarkeit & Ablaufdatum | TC-DO-086–091 | 6 |
| Validierung & Grenzwerte | TC-DO-092–098 | 7 |

### 3.6 Auth & Identity (86 Testfälle)

| Bereich | Prefix | Anzahl |
|---------|--------|--------|
| Eigene Identität | TC-AU-001–008 | 8 |
| Benutzerverwaltung (CRUD) | TC-AU-009–018 | 10 |
| Benutzer aktivieren/deaktivieren | TC-AU-019–026 | 8 |
| Passwort zurücksetzen | TC-AU-027–030 | 4 |
| Rollenzuweisung | TC-AU-031–036 | 6 |
| Custom Roles | TC-AU-037–046 | 10 |
| Registrierung | TC-AU-047–054 | 8 |
| Anwendungseinstellungen | TC-AU-055–060 | 6 |
| Berechtigungen (36 Permissions) | TC-AU-061–068 | 8 |
| Keycloak-Synchronisation | TC-AU-069–074 | 6 |
| Autorisierung & Zugriffskontrolle | TC-AU-075–086 | 12 |

### 3.7 Audit & DSGVO (70 Testfälle)

| Bereich | Prefix | Anzahl |
|---------|--------|--------|
| Audit-Events abfragen | TC-AD-001–008 | 8 |
| Audit CSV-Export | TC-AD-009–013 | 5 |
| Audit Entity/User History | TC-AD-014–017 | 4 |
| Audit Kategorien & Event-Types | TC-AD-018–021 | 4 |
| Einwilligung (Consent) | TC-AD-022–033 | 12 |
| Datenexport (DSGVO Art. 20) | TC-AD-034–037 | 4 |
| Löschantrag erstellen | TC-AD-038–043 | 6 |
| Löschantrag bestätigen | TC-AD-044–048 | 5 |
| Löschantrag Admin-Verarbeitung | TC-AD-049–056 | 8 |
| Löschantrag stornieren | TC-AD-057–060 | 4 |
| Autorisierung & Rollen | TC-AD-061–070 | 10 |

---

## 4. Testbenutzer (Alle Module)

| Rolle | E-Mail | Passwort | Module |
|-------|--------|----------|--------|
| **Admin** | admin@iabconnect.ch | Admin-Dev-2026! | Alle Module — Vollzugriff |
| **Vorstand** | vorstand@iabconnect.ch | Vorstand-Dev-2026! | Mitglieder, Events, Kommunikation, Dokumente (Upload/Status) |
| **Kassier** | kassier@iabconnect.ch | Kassier-Dev-2026! | Finanzen (Lesen + Schreiben) |
| **Auditor** | auditor@iabconnect.ch | Auditor-Dev-2026! | Audit (Lesen + Export), Finanzen (nur Lesen) |
| **Member** | member@iabconnect.ch | Member-Dev-2026! | Eigenes Profil, Event-Registrierung, Dokumente (Lesen), Consent/DSGVO |
| **Event-Manager** | *(via Rollenzuweisung)* | — | Events (Vollzugriff) |

---

## 5. Bekannte Einschränkungen & Warnungen

Die folgenden Punkte sind in den Testfällen dokumentiert und sollten beachtet werden:

### Auth-Modul
| TC-ID | Warnung |
|-------|---------|
| TC-AU-022 | ⚠️ `SetUserEnabled(false)` deaktiviert das Member NICHT (asymmetrisches Verhalten) |
| TC-AU-072 | ⚠️ Nur `UpdateUser(enabled=false)` deaktiviert Member, NICHT der disable-Endpoint |
| TC-AU-086 | ⚠️ Kassier/Event-Manager/Auditor sind nicht im BaseRole-Enum (nur Admin/Vorstand/Member) |

### DSGVO-Modul
| TC-ID | Warnung |
|-------|---------|
| TC-AD-056 | ⚠️ E-Mail-Bestätigung bei Löschantrag wird NICHT gesendet (TODO) |
| TC-AD-056 | ⚠️ Keycloak-User wird nach Genehmigung NICHT gelöscht/deaktiviert (TODO) |

### Finanzen-Modul
| TC-ID | Warnung |
|-------|---------|
| TC-AU-005 | ⚠️ Vorstand hat eingeschränkten Finanzzugriff (kann Zahlungen genehmigen/ablehnen via RequireVorstand) |
| — | ⚠️ `RolePermissions` gibt Vorstand `FinanceRead`, aber `RequireFinanceRead`-Policy schliesst Vorstand aus |

---

## 6. Testdurchführungsplan (Empfehlung)

### Reihenfolge

| Phase | Module | Begründung |
|-------|--------|------------|
| **1** | Auth & Identity (86 TCs) | Basis: Benutzer, Rollen, Login müssen zuerst funktionieren |
| **2** | Mitglieder (99 TCs) | Member-Entity ist Grundlage für viele andere Module |
| **3** | Audit & DSGVO (70 TCs) | Querschnitt: Audit-Logging wird von allen Modulen genutzt |
| **4** | Events (120 TCs) | Unabhängiges Modul, komplex (State Machine, Warteliste) |
| **5** | Dokumente (98 TCs) | Unabhängig, aber mit S3-Abhängigkeit |
| **6** | Kommunikation (87 TCs) | Benötigt SMTP (MailHog), Hangfire |
| **7** | Finanzen (228 TCs) | Komplexestes Modul, als letztes testen |

### Geschätzter Zeitaufwand

| Modul | Geschätzte Dauer |
|-------|-----------------|
| Auth & Identity | 3–4 Stunden |
| Mitglieder | 3–4 Stunden |
| Audit & DSGVO | 2–3 Stunden |
| Events | 4–5 Stunden |
| Dokumente | 3–4 Stunden |
| Kommunikation | 3–4 Stunden |
| Finanzen | 6–8 Stunden |
| **GESAMT** | **24–32 Stunden** |

---

## 7. Infrastruktur-Anforderungen

| Dienst | URL | Zweck |
|--------|-----|-------|
| **API** | http://localhost:5000 | Backend (.NET 10.0) |
| **Frontend** | http://localhost:3000 | Next.js 16.1.6 |
| **Keycloak** | http://localhost:8080 | Authentifizierung (Realm: iabconnect) |
| **PostgreSQL** | localhost:5433 | Datenbank |
| **MailHog** | http://localhost:8025 | E-Mail-Test (SMTP: localhost:1025) |
| **RustFS (S3)** | localhost:9000 | Dokumenten-Storage (Bucket: iabconnect-documents) |
| **Hangfire** | http://localhost:5000/hangfire | Background Jobs Dashboard |

### Startbefehle

```bash
# Alle Dienste starten (Docker)
cd infra && docker-compose up -d

# Backend starten
cd backend/src/IabConnect.Api && dotnet run

# Frontend starten
cd frontend && npm run dev
```

---

## 8. Verzeichnisstruktur

```
docs/TestCases/
├── Gesamtuebersicht.md          ← Diese Datei
├── Finanzen/
│   ├── TestFaelle_Finanzen.md   (228 Testfälle)
│   └── Testergebnisse_Template.md
├── Mitglieder/
│   ├── TestFaelle_Mitglieder.md (99 Testfälle)
│   └── Testergebnisse_Template.md
├── Events/
│   ├── TestFaelle_Events.md     (120 Testfälle)
│   └── Testergebnisse_Template.md
├── Kommunikation/
│   ├── TestFaelle_Kommunikation.md (87 Testfälle)
│   └── Testergebnisse_Template.md
├── Dokumente/
│   ├── TestFaelle_Dokumente.md  (98 Testfälle)
│   └── Testergebnisse_Template.md
├── Auth/
│   ├── TestFaelle_Auth.md       (86 Testfälle)
│   └── Testergebnisse_Template.md
└── AuditDSGVO/
    ├── TestFaelle_AuditDSGVO.md (70 Testfälle)
    └── Testergebnisse_Template.md
```
