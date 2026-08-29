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
| Layout-Fixture | `vis.html` — Saison bis Spieltag 8 vorgespielt, `?v=kader`, `?v=spielplan`, `?v=bericht` |
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
| `engine/spielplan.js` | Doppelte Runde nach dem Kreisverfahren |
| `engine/spiel.js` | Die Spielsimulation: Endstand, Viertel, Box Score |
| `engine/tabelle.js` | Die Tabelle — immer neu berechnet, nie gespeichert |
| `engine/saison.js` | Zustandsform, der Spieltag-Tick, der Sprung ins nächste Jahr |
| `engine/save.js` | Speichern, Migration, Export und Import |
| `i18n.js` | Alle sichtbaren Texte. Nur Daten |
| `ui/*.js` | Jeder DOM-Aufruf |
| `app.js` | Zustand, Ansichten, Verdrahtung |

**Bezeichner im Code sind englisch, sichtbare Texte deutsch** und stehen
ausschließlich in `i18n.js`. Die Datei ist UTF-8 ohne BOM und benutzt echte
Umlaute — bitte so lassen.

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

Gespielt werden kann: Verein wählen, Spieltage simulieren, Tabelle, Kader mit
Depth Chart und Verletzungen, Spielplan, Spielbericht mit Box Score, Saisonwechsel
mit Alterung und Rücktritten, Export und Import.

Ideen für später:
- Aufstellung selbst bestimmen statt Depth Chart nach Stärke
- Transfers und Verträge zwischen den Saisons
- Auf- und Abstieg mit einer zweiten Liga darüber
- Play-by-Play statt nur Endstand
- Finanzen, Zuschauer, Sponsoren
