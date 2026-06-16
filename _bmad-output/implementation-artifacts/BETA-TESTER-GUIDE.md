<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# IAB Connect Beta — Leitfaden für Testerinnen und Tester

Willkommen und danke, dass du die **IAB Connect Beta** testest! Dieser Leitfaden erklärt in Kürze, wie du dich
anmeldest, was die Beta umfasst, wie du die vom System verschickten E-Mails siehst, wie du Feedback gibst und welche
Einschränkungen aktuell gelten. Lesedauer: ca. 5 Minuten.

> **Das Wichtigste vorab:** Die Beta ist eine **Testumgebung**. Daten können jederzeit zurückgesetzt werden, und
> E-Mails werden **nicht** an dein echtes Postfach zugestellt, sondern in einem Test-Postfach gesammelt (Details unten).

---

## 1. Anmeldung / Registrierung

1. Öffne die Beta-URL, die dir die Betreuung mitgeteilt hat (`https://…`).
2. Klicke auf der Anmeldeseite auf **„Registrieren"**. Deine **E-Mail-Adresse ist gleichzeitig dein Benutzername**.
3. Fülle das Formular aus und sende es ab.

**Wichtiger Hinweis zur E-Mail-Bestätigung:** Die Beta verschickt die Bestätigungs-E-Mail in ein **Test-Postfach
(Mailtrap)** — sie landet **nicht** in deinem echten Posteingang. Du kannst die Bestätigung daher nicht allein
abschliessen. **Bitte gib der Betreuung kurz Bescheid, sobald du dich registriert hast** — sie schaltet dein Konto frei
(bzw. leitet dir die Bestätigungs-E-Mail weiter). Danach kannst du dich normal anmelden.

> Du brauchst einen Rollen-/Berechtigungsumfang (z. B. Mitglied, Kassier, Event-Manager)? Auch das vergibt die
> Betreuung nach der Freischaltung.

---

## 2. Was ist die Beta?

Die Beta ist eine voll funktionsfähige Vorabversion, in der du echte Abläufe ausprobieren kannst:

- **Mitglieder** verwalten,
- **Finanzen** (z. B. Rechnungen) bearbeiten,
- **Events** anlegen und verwalten.

Bitte beachte:

- Es ist **keine Produktivumgebung**. Verwende **keine** echten, sensiblen Daten, die nicht verloren gehen dürfen.
- **Daten können jederzeit zurückgesetzt werden** — genau wie es das orange Banner oben sagt:
  *„Beta — Daten können jederzeit zurückgesetzt werden."*
- Es kann zu kurzen Ausfällen oder Fehlern kommen. Genau dafür ist die Beta da — bitte melde, was dir auffällt
  (siehe Abschnitt 4).

---

## 3. E-Mails ansehen (Mailtrap)

Die App verschickt bei verschiedenen Aktionen E-Mails — etwa bei der **Konto-Bestätigung**, beim **Passwort-Zurücksetzen**,
beim **Versand von Rechnungen** und bei **Event-Benachrichtigungen** (Anmeldebestätigung, Warteliste, Erinnerungen).

In der Beta werden diese E-Mails in einem **Test-Postfach (Mailtrap-Sandbox)** abgefangen und **nicht** an echte
Empfänger zugestellt. So siehst du sie:

- Die Betreuung teilt dir einen **Mailtrap-Inbox-Link** oder leitet dir einzelne E-Mails weiter.

Erwarte also **keine** E-Mails in deinem normalen Posteingang — das ist beabsichtigt und schützt vor versehentlichem
Versand an echte Adressen.

---

## 4. Feedback geben

Oben auf jeder Seite siehst du das orange **Beta-Banner** mit dem Link **„Feedback geben"**.

1. Klick auf **„Feedback geben"** — es öffnet sich (in einem neuen Tab) eine vorbereitete **GitHub-Issue-Vorlage**
   („Beta-Feedback").
2. Fülle die Felder aus: Was hast du getan, was hast du erwartet, was ist passiert? Screenshots helfen sehr.
3. Wenn in einer Fehlermeldung eine **Correlation-ID** angezeigt wird, gib sie bitte an — damit lässt sich der Vorgang
   in den Logs schnell finden.
4. Absenden — fertig. Die Betreuung sieht das Feedback direkt.

> Du brauchst dafür ein (kostenloses) GitHub-Konto. Falls du keines hast oder nicht möchtest, gib dein Feedback einfach
> direkt an die Betreuung weiter.

---

## 5. Bekannte Einschränkungen

- **E-Mails** werden nur ins Test-Postfach (Mailtrap) zugestellt, nicht an echte Adressen (siehe Abschnitt 3).
- **Daten können jederzeit zurückgesetzt werden** — lege nichts an, das dauerhaft erhalten bleiben muss.
- Es gibt **noch keine eigene Domain**; die Beta läuft unter einer Railway-Standardadresse.
- Die **Verfügbarkeit ist „best effort"** — gelegentliche kurze Ausfälle oder neue Deployments sind normal.

---

Danke für deine Hilfe! Jede Rückmeldung — auch kleine — macht IAB Connect besser. 🧡
