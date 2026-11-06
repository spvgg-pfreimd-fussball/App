# SpVgg Pfreimd App

Die App der SpVgg Pfreimd, Abteilung Fußball: News, Spielpläne und Tabellen, Teams, Fanshop und Vereinsinfos.
Sie läuft im Browser und lässt sich auf jedem Handy wie eine App auf den Startbildschirm legen.

## Aufbau

| Datei / Ordner | Inhalt |
| --- | --- |
| `index.html` | Grundgerüst der App: Kopfleiste, Inhaltsbereich, Leiste unten |
| `style.css` | Gestaltung. Ganz oben stehen die Farben (`--red` ist das Vereinsrot) |
| `app.js` | Programmlogik: Daten laden und die fünf Bereiche anzeigen |
| `daten/inhalte.json` | **Alle Texte und Inhalte**: News, Ankündigungen (intern `events`), Teams, Stadionzeitungen, Spartenbesetzung, Historie |
| `img/` | Wappen und App-Symbole |
| `manifest.webmanifest`, `sw.js` | Sorgen dafür, dass die App installierbar ist und offline startet |

**Was automatisch kommt:** Das Leitbild (Mehr → Verein) wird live von der Homepage-Seite „Leitbild“ übernommen – Änderungen dort erscheinen automatisch in der App. Außerdem: Spielpläne, Ergebnisse und Tabellen holt die App live von FuPa.
Die Shop-Artikel kommen live aus dem WooCommerce-Shop der Homepage.
Klappt das einmal nicht, zeigt die App den letzten Datenstand aus `daten/inhalte.json`.
Die App lädt alles beim Öffnen neu, beim Zurückkehren nach mehr als 5 Minuten, und solange sie offen ist alle 15 Minuten (am Spieltag alle 2 Minuten).

## Besucherzahlen

Die App zählt mit [GoatCounter](https://www.goatcounter.com), ohne Cookies und ohne persönliche Daten.
Die Zahlen stehen unter **https://spvgg-pfreimd.goatcounter.com** (Anmeldung mit dem GoatCounter-Konto).
Gezählt wird:

- welcher Bereich aufgerufen wird, z. B. `/news`, `/spiele`, `/teams/b`, `/mehr/leitbild`
- `app-installiert-android`: die App wurde auf einem Android-Handy installiert (iPhones melden das nicht)
- `start-vom-startbildschirm`: die App wurde über das Symbol auf dem Startbildschirm geöffnet (Android und iPhone)

Gezählt wird nur auf der echten App-Adresse, nicht bei Tests, und nicht, wenn im Browser „Nicht verfolgen“ eingeschaltet ist.
In der App selbst werden keine Zahlen angezeigt.

## Redaktion in der App (am bequemsten)

News, Ankündigungen und die Stadionzeitung lassen sich direkt in der App bearbeiten: **Mehr → Redaktion**.
Die App speichert dabei in dieses Repository – jede Änderung erscheint unter **Commits** mit dem Zusatz
„(über die App)“ und lässt sich dort zurücknehmen. Fotos landen in `img/news/` bzw. `img/ankuendigungen/`, hochgeladene Stadionzeitungen in `zeitung/`.

Zum Anmelden braucht die App einen persönlichen GitHub-Zugangsschlüssel (Fine-grained token), der nur
dieses Repository ändern darf: [neuen Schlüssel anlegen](https://github.com/settings/personal-access-tokens/new),
bei „Repository access“ nur `App` auswählen und unter „Repository permissions“ bei **Contents** „Read and write“ wählen.
Der Schlüssel bleibt nur auf dem eigenen Handy gespeichert. Läuft er ab oder geht ein Handy verloren:
Schlüssel bei GitHub löschen und einen neuen anlegen.

## Häufige Handgriffe (direkt auf github.com)

Alle Änderungen gehen direkt auf github.com: Datei anklicken, oben rechts auf den **Stift** tippen,
ändern und unten auf **Commit changes** tippen. Nach etwa einer Minute ist die Änderung in der App sichtbar.

**Neue News eintragen:** In `daten/inhalte.json` im Abschnitt `"news"` ganz oben einen Eintrag ergänzen:

```json
    {"d": "4. November 2026", "t": "Überschrift", "img": "https://…/bild.jpg",
      "p": [
        "Erster Absatz.",
        "Zweiter Absatz."
      ]},
```

`d` ist das Datum, `t` die Überschrift, `img` ein Bild (optional) und `p` die Absätze.
Wichtig: Nach jedem Eintrag außer dem letzten steht ein Komma.

**Neue Ankündigung eintragen:** Im Abschnitt `"events"` ein Eintrag wie `{"d": "2026-12-27", "t": "Christbaumversteigerung"}`,
optional mit `"img"` (Flyer) und `"p"` (Absätze wie bei News).
Das Datum steht als Jahr-Monat-Tag. Vergangene Ankündigungen blendet die App automatisch aus.

**Neue Stadionzeitung:** Das PDF wie gewohnt in WordPress hochladen und im Abschnitt `"zeitung"` ganz oben eintragen:
`["31.10.2026", "Hahnbach", "https://…/Stadionzeitung.pdf"]`. Die oberste Ausgabe erscheint auf der Startseite.

**Trainer oder Liga ändern:** Abschnitt `"teams"` (Herren) bzw. `"jugend"` (Jugend).

**Jugend:** Spiele und Tabellen kommen live vom BFV. Dafür braucht jede Mannschaft im Abschnitt `"jugend"`
zwei BFV-Kennungen: `bfvTeam` (die Mannschaft) und `bfvLiga` (der Wettbewerb). Die Wettbewerbs-Kennung steht im
Widget-Code auf der Homepage, z. B. `BFVWidget.HTML5.zeigeWettbewerb("031K6B6R…-G", …)`.
Zur neuen Saison ändern sich diese Kennungen – dann einfach Claude Bescheid geben.
Mannschaften ohne Kennungen (F- und G-Junioren) erscheinen ohne Spiele und Tabelle.
Das Mannschaftsfoto holt sich die App automatisch von der jeweiligen Seite der Homepage (Feld `page`).
Die App-Adresse ist beim BFV als Webseite registriert; ohne diese Registrierung liefert der BFV keine Daten.

**Vereinsfarbe ändern:** In `style.css` ganz oben die Zeile `--red:#DB0000;`.

## Wenn etwas schiefgeht

Unter **Commits** (die Uhr oben in der Dateiliste) steht jede Änderung mit Datum.
Jede frühere Version lässt sich dort ansehen und wiederherstellen.
Ein vergessenes Komma in `inhalte.json` ist der häufigste Fehler: Dann zeigt die App einen Hinweis statt der Inhalte.
Einfach das Komma ergänzen oder die letzte Änderung zurücknehmen.
