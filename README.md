# Bayernliga Football Manager

Ein Managerspiel für American Football in der bayerischen Bayernliga.
Deutsch, läuft auf PC und iPad, kostet nichts und braucht keinen Store.

> Wer hier mit Claude Code arbeitet: die Arbeitsregeln stehen in
> [`CLAUDE.md`](CLAUDE.md) — kein Build, wie Speicherstände wandern, wo die
> Fallen liegen.

## Die eine Regel: kein Build

Kein Bundler, kein npm, keine Abhängigkeiten. Der Browser lädt die ES-Module
direkt. Ein `git push` ist das Deployment. Die Typen kommen aus JSDoc und
`// @ts-check` — VS Code prüft sie ohne jedes Werkzeug.

## Starten

Weil die App ES-Module benutzt, reicht ein Doppelklick auf `index.html` **nicht**
(`file://` blockiert Modul-Importe). Es braucht immer einen Server:

| Was | Wie |
| --- | --- |
| Lokal spielen | `python3 -m http.server 8000`, dann `http://localhost:8000` |
| Auf dem iPad | gleicher Befehl, dann `http://<IP-des-Macs>:8000` im selben WLAN |
| Layout-Fixture | `vis.html` — Saison bis Spieltag 8 vorgespielt, `?ende` spielt sie bis hinter das Finale; dazu `?v=kader`, `?v=taktik`, `?v=spielplan`, `?v=bericht` |
| Tests | `node --test tests/` |
| Rauchtest im Browser | `node tests/smoke.js [filter]` — startet Server und Firefox selbst |
| Icons neu bauen | `node scripts/mach-icons.js` |
| Ligastärken messen | `node scripts/baseline-staerken.js` — das Messband für den Umbau |

Die IP des Macs findest du mit `ipconfig getifaddr en0`.

### Aufs iPad legen

Seite in Safari öffnen → Teilen → **Zum Home-Bildschirm**. Danach startet sie
im Vollbild, ohne Safari-Leiste, und funktioniert offline. Kein Entwicklerkonto,
keine Jahresgebühr, kein Ablaufdatum.

Für den dauerhaften Betrieb kommt das Ganze auf **GitHub Pages** — der Mac muss
dann nicht laufen. Die leere `.nojekyll` im Wurzelverzeichnis gehört dazu und
darf nicht verschwinden; warum, steht in [`CLAUDE.md`](CLAUDE.md).
## Aufbau

`engine/` enthält jede Regel und **fasst kein DOM an**. `ui/` enthält jeden
DOM-Aufruf und **entscheidet keine Regel**. `app.js` ist der einzige Ort, an dem
sich beide begegnen. Diese Trennung ist der Grund, warum die Tests ganze Saisons
in Millisekunden durchspielen können.

| Datei | Was drin ist |
| --- | --- |
| `engine/constants.js` | Balance-Zahlen, Positionen, gesäter Zufall, `clamp` |
| `engine/content.js` | Die Kataloge: Vereine, Vor- und Nachnamen |
| `engine/kalender.js` | Die Uhr: Saisonstart, Tagesnummern, Spieltagstermine, Phasen. Der einzige Ort mit `Date` |
| `engine/positionen.js` | Körperkorridore, Positionsformeln, Plätze, die Eignung |
| `engine/spieler.js` | Spieler erzeugen, Attribute, Alterskurve, Verletzungen, Saisonwechsel |
| `engine/aufstellung.js` | Personnel, die zweiundzwanzig Plätze, der Doppeleinsatz, die Vorgabe des Managers |
| `engine/team.js` | Aus einer Aufstellung werden Lauf- und Passwerte je Einheit |
| `engine/spielplan.js` | Gruppenrunde nach dem Kreisverfahren, dazu das Bracket |
| `engine/spiel.js` | Die Spielsimulation: Endstand, Viertel, Box Score |
| `engine/tabelle.js` | Die Gruppentabellen — immer neu berechnet, nie gespeichert |
| `engine/postfach.js` | Nachrichten: Schlüssel und Daten, Antwortpflicht, das Stutzen |
| `engine/saison.js` | Zustandsform, der Tages-Tick `weiter()`, das Bracket, der Sprung ins nächste Jahr |
| `engine/save.js` | Speichern, Laden, Export, Import — und der Migrationspfad |
| `i18n.js` | Alle sichtbaren Texte. Nur Daten |
| `ui/*.js` | Jeder DOM-Aufruf |
| `app.js` | Zustand, Ansichten, Verdrahtung |
| `sw.js` | Service Worker: Netz zuerst, Cache als Rückfall. Seine `SHELL` muss jedes Modul nennen, sonst startet die App offline nicht — `tests/sw.test.js` prüft das gegen die Platte |
| `tests/smoke/` | Der Rauchtest: Seiten, die die echte App in einem Browser durchklicken. `tests/smoke.js` fährt sie |
| `CLAUDE.md` | Die Arbeitsregeln: kein Build, die Migration, die Fallen |

**Bezeichner im Code sind englisch, sichtbare Texte deutsch** und stehen
ausschließlich in `i18n.js`. Ausgenommen ist die Sprache des Sports selbst:
Offense, Defense, Run, Pass, Roster und die Positionsnamen bleiben, wie sie auf
dem Feld gesprochen werden.

Kein Modul in `engine/` importiert etwas von außerhalb `engine/` — auch nicht
`i18n.js`. Eine Nachricht speichert deshalb einen **Schlüssel und ihre Daten,
nie einen Satz**; der Satz dazu steht in `T.post`. So lassen sich Texte ändern,
ohne einen laufenden Speicherstand zu verfälschen.

## Der Rauchtest

`node --test` deckt `engine/` ab und rührt `ui/` nicht an — dort gibt es kein
DOM. Was dabei ungeprüft bleibt, ist die **Verdrahtung**: ob der erste
Bildschirm der Posteingang ist, ob ein Knopf die Uhr bewegt, ob ein
Speicherstand beim Laden ankommt. Genau das prüft `node tests/smoke.js`, indem
es die echte `app.js` in einem echten Firefox lädt und sich durchklickt.

```
node tests/smoke.js            # alle Seiten
node tests/smoke.js saison     # nur die, deren Dateiname passt
```

Das Skript bringt alles mit: es serviert das Projekt auf einem freien Port,
startet Firefox headless mit einem Wegwerfprofil und nimmt den Bericht der Seite
per POST wieder entgegen. So endet der Lauf mit einer Zahl wie jeder andere
Test: `0` alles grün, `1` etwas rot, `2` kein Firefox da. Ausgegeben wird nur
das Rote; ein grüner Lauf sind fünf Zeilen.

Die Seiten liegen in `tests/smoke/` und lassen sich auch von Hand aufmachen —
sie schreiben ihren Bericht zusätzlich sichtbar auf die Seite. Was beim Anlegen
einer neuen Seite zu beachten ist, steht im Kopf von `tests/smoke.js`.

## Zufall

Die Engine bekommt ihren Zufall injiziert (`makeRng(seed)`). Derselbe Seed ergibt
dieselbe Saison, deshalb sind die Tests reproduzierbar.

Der Tages-Zufall leitet sich aus `seed | jahr | tag` ab: ein Speicherstand
liefert beim erneuten Spielen dasselbe Ergebnis. Weil der Tag innerhalb einer
Saison eindeutig ist, kann der Schlüssel nicht kollidieren, obwohl eine Saison
über den Jahreswechsel läuft.

## Speicherstände

Der laufende Stand liegt im `localStorage` unter `bayernliga.save` (rund
150 KB). Das ist für eine installierte Web-App haltbar, aber nicht unantastbar —
der **Export** unter *Posteingang → Speicherstand* ist die eigentliche Sicherung
und zugleich der Weg, eine Karriere zwischen PC und iPad zu tragen.

Jeder Stand trägt eine `SAVE_VERSION`. Ist sie älter als der laufende Build,
**wird der Stand gehoben statt weggeworfen**: `migriere()` in
[`engine/save.js`](engine/save.js) hängt die Schritte aneinander, bis er auf der
heutigen Nummer steht. Nur was der Pfad nicht erreicht — eine Nummer ohne
Schritt oder eine aus der Zukunft — wird abgelehnt. Was beim Ändern der
Zustandsform zu tun ist, steht in [`CLAUDE.md`](CLAUDE.md).

## Stand und was als Nächstes käme

Der Fahrplan mit allen gefallenen Entscheidungen steht in
[`docs/naechste-schritte.md`](docs/naechste-schritte.md).

Gespielt werden kann: Verein wählen, den **Posteingang** als ersten Bildschirm
— Monatsraster mit den Terminen, Tageskarte und die Post des Vereins im Schnitt
eines Mailprogramms (Ordner links, Nachricht rechts, Löschen und ein Ordner
„Gelöscht"), in dem auch die Ansprache zum Amtsantritt als erste Nachricht
liegt —, mit „Weiter" und einem gewählten Datum durch den Kalender laufen, der
von selbst vor jedem eigenen Spiel, vor jeder Antwortpflicht und an jedem
Phasenwechsel anhält, zwei Gruppentabellen, Kader mit Depth Chart, sortierbaren Spalten
und Verletzungen — aufgeklappt zeigt eine Zeile die fünfzehn Attribute und die
fünf Plätze, auf denen der Mann gerade am meisten wert wäre —, Taktik mit Personnel und Ausrichtung, **die Aufstellung von
Hand** — Platz antippen und aus den fünf Besten wählen, oder einen Spieler
antippen und sehen, was er auf jedem der zweiundzwanzig Plätze brächte; die
Elf lässt sich auch ganz leeren und von Grund auf bauen, gespeichert wird sie
erst, wenn jeder Platz besetzt ist (siehe
[`docs/umbau-aufstellung.md`](docs/umbau-aufstellung.md)), Spielplan,
Spielbericht mit Box Score, Halbfinale und Finale als Bracket — das seine vier
Plätze schon während der Gruppenrunde benennt und sagt, wer sie gerade hält —,
Saisonwechsel mit Alterung und Rücktritten, Export und Import.

## Wie eine Saison aussieht

Eine Saison läuft von einem **dritten Oktobersamstag zum nächsten** — die Saison
2027 beginnt am 17.10.2026 — und dauert deshalb immer volle Wochen: 364 Tage,
alle paar Jahre 371. Tag 1 ist immer ein Samstag, und jeder Spieltag liegt auf
`tag ≡ 1 (mod 7)`; der Wochentag ist eine Modulorechnung und kein Kalender.
Gespielt wird von Mitte April bis Ende Juli, davor liegt die Vorbereitung und
dahinter die Sommerpause. Die Termine stehen als Liste in
[`engine/kalender.js`](engine/kalender.js) — beim nächsten Formatwechsel ist das
die eine Stelle, an der die Antwort steht. Alles Weitere in
[`docs/umbau-kalender.md`](docs/umbau-kalender.md).

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
- Verletzungsrate und Umstellungskosten neu eichen, jetzt wo von Hand
  aufgestellt wird
- Weitere Defense-Formationen: 4-4, 3-3, 3-4 über denselben Platz-Apparat
- Berechnete Stärke aus den Attributen statt gezogener
- Alterskurven je Attribut
- Transfers und Verträge zwischen den Saisons
- Auf- und Abstieg mit einer zweiten Liga darüber
- Play-by-Play statt nur Endstand
- Finanzen, Zuschauer, Sponsoren
