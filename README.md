# Bayernliga Football Manager

Ein Managerspiel für American Football in der bayerischen Bayernliga.
Deutsch, läuft auf PC und iPad, kostet nichts und braucht keinen Store.

## Die eine Regel: kein Build

Kein Bundler, kein npm, keine Abhängigkeiten. Der Browser lädt die ES-Module
direkt. Ein `git push` ist das Deployment.

Was es **nicht** gibt und nicht geben soll: TypeScript-Dateien, JSX, einen
Bundler, eine `package.json` mit Abhängigkeiten. Die Typen kommen aus JSDoc und
`// @ts-check` — VS Code prüft sie ohne jedes Werkzeug.

## Starten

Weil die App ES-Module benutzt, reicht ein Doppelklick auf `index.html` **nicht**
(`file://` blockiert Modul-Importe). Es braucht immer einen Server:

| Was | Wie |
| --- | --- |
| Lokal spielen | `python3 -m http.server 8000`, dann `http://localhost:8000` |
| Auf dem iPad | gleicher Befehl, dann `http://<IP-des-Macs>:8000` im selben WLAN |
| Layout-Fixture | `vis.html` — Saison bis Spieltag 8 vorgespielt, `?ende` spielt sie bis hinter das Finale; dazu `?v=kader`, `?v=spielplan`, `?v=bericht` |
| Tests | `node --test tests/*.test.js` |
| Icons neu bauen | `node scripts/mach-icons.js` |

Die IP des Macs findest du mit `ipconfig getifaddr en0`.

### Aufs iPad legen

Seite in Safari öffnen → Teilen → **Zum Home-Bildschirm**. Danach startet sie
im Vollbild, ohne Safari-Leiste, und funktioniert offline. Kein Entwicklerkonto,
keine Jahresgebühr, kein Ablaufdatum.

Für den dauerhaften Betrieb kommt das Ganze auf **GitHub Pages** — der Mac muss
dann nicht laufen.

## Aufbau

`engine/` enthält jede Regel und **fasst kein DOM an**. `ui/` enthält jeden
DOM-Aufruf und **entscheidet keine Regel**. `app.js` ist der einzige Ort, an dem
sich beide begegnen. Diese Trennung ist der Grund, warum die Tests ganze Saisons
in Millisekunden durchspielen können.

| Datei | Was drin ist |
| --- | --- |
| `engine/constants.js` | Balance-Zahlen, Positionen, gesäter Zufall, `clamp` |
| `engine/content.js` | Die Kataloge: Vereine, Vor- und Nachnamen |
| `engine/spieler.js` | Spieler erzeugen, Alterskurve, Verletzungen, Saisonwechsel |
| `engine/team.js` | Aus einem Kader werden Mannschaftsteile: Angriff, Verteidigung, Special |
| `engine/spielplan.js` | Gruppenrunde nach dem Kreisverfahren, dazu das Bracket |
| `engine/spiel.js` | Die Spielsimulation: Endstand, Viertel, Box Score |
| `engine/tabelle.js` | Die Gruppentabellen — immer neu berechnet, nie gespeichert |
| `engine/saison.js` | Zustandsform, der Spieltag-Tick, das Bracket, der Sprung ins nächste Jahr |
| `engine/save.js` | Speichern, Migration, Export und Import |
| `i18n.js` | Alle sichtbaren Texte. Nur Daten |
| `ui/*.js` | Jeder DOM-Aufruf |
| `app.js` | Zustand, Ansichten, Verdrahtung |

**Bezeichner im Code sind englisch, sichtbare Texte deutsch** und stehen
ausschließlich in `i18n.js`. Die Datei ist UTF-8 ohne BOM und benutzt echte
Umlaute — bitte so lassen.

Ausnahme von der Richtung „engine kennt kein außen": `engine/saison.js`
importiert `i18n.js`, weil es die Zeilen für den Verlauf schreibt. Das ist
zulässig — `i18n.js` sind reine Daten, kein DOM —, und die Alternative wäre,
dieselben Wörter ein zweites Mal in der Engine zu halten.

## Zufall und Tests

Die Engine bekommt ihren Zufall injiziert (`makeRng(seed)`). Derselbe Seed ergibt
dieselbe Saison, deshalb sind die Tests reproduzierbar. In Tests nie auf eine
Verteilung prüfen, ohne den Seed festzunageln.

Der Spieltag-Zufall leitet sich aus `seed | jahr | spieltag` ab: ein Speicherstand
liefert beim erneuten Spielen dasselbe Ergebnis.

## Speicherstände

Der laufende Stand liegt im `localStorage` (rund 150 KB). Das ist für eine
installierte Web-App haltbar, aber nicht unantastbar — der **Export** unter
*Verlauf → Speicherstand* ist die eigentliche Sicherung und zugleich der Weg,
eine Karriere zwischen PC und iPad zu tragen.

## Stand und was als Nächstes käme

Der Fahrplan mit allen gefallenen Entscheidungen steht in
[`docs/naechste-schritte.md`](docs/naechste-schritte.md).

Gespielt werden kann: Verein wählen, die Ansprache zum Amtsantritt, Spieltage
simulieren, zwei Gruppentabellen, Kader mit Depth Chart und Verletzungen,
Spielplan, Spielbericht mit Box Score, Halbfinale und Finale, Saisonwechsel mit
Alterung und Rücktritten, Export und Import.

## Wie eine Saison aussieht

Zwölf Vereine in zwei Gruppen zu sechs. **Zehn Spieltage** doppelte Runde
*innerhalb* der Gruppe, dann das Bracket:

- **Halbfinale** (Spieltag 11): 1. Süd gegen 2. Nord, 1. Nord gegen 2. Süd.
  Heimrecht beim Gruppensieger.
- **Finale** (Spieltag 12): Heimrecht bei der besseren Bilanz — Win Percentage,
  bei Gleichstand die Punktdifferenz. Ein Gruppenzweiter mit mehr Siegen
  bekommt es also gegen einen Gruppensieger.

Meister ist der **Finalsieger**, nie der Erste einer Gruppentabelle. Die
Halbfinal-Paarungen stehen erst fest, wenn Spieltag 10 gespielt ist — deshalb
wächst der Spielplan während der Saison, statt am Anfang komplett gewürfelt zu
werden.

**Unentschieden gibt es nicht**, auch nicht in der Gruppenrunde: die
Verlängerung läuft, bis einer vorn liegt. Absteiger gibt es ebenfalls keine.

Ideen für später:
- Formationen und Positionswerte (Block 2 im Fahrplan)
- Aufstellung selbst bestimmen statt Depth Chart nach Stärke
- Transfers und Verträge zwischen den Saisons
- Auf- und Abstieg mit einer zweiten Liga darüber
- Play-by-Play statt nur Endstand
- Finanzen, Zuschauer, Sponsoren
