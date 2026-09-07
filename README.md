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
| Layout-Fixture | `vis.html` — Saison bis Spieltag 8 vorgespielt, `?ende` spielt sie bis hinter das Finale; dazu `?v=kader`, `?v=taktik`, `?v=spielplan`, `?v=bericht` |
| Tests | `node --test tests/*.test.js` |
| Rauchtest im Browser | `node tests/smoke.js [filter]` — startet Server und Firefox selbst |
| Icons neu bauen | `node scripts/mach-icons.js` |
| Ligastärken messen | `node scripts/baseline-staerken.js` — das Messband für den Umbau |

Die IP des Macs findest du mit `ipconfig getifaddr en0`.

### Aufs iPad legen

Seite in Safari öffnen → Teilen → **Zum Home-Bildschirm**. Danach startet sie
im Vollbild, ohne Safari-Leiste, und funktioniert offline. Kein Entwicklerkonto,
keine Jahresgebühr, kein Ablaufdatum.

Für den dauerhaften Betrieb kommt das Ganze auf **GitHub Pages** — der Mac muss
dann nicht laufen.

Im Wurzelverzeichnis liegt dafür eine leere Datei `.nojekyll`. Ohne sie schiebt
GitHub Pages jeden Push durch Jekyll, und Jekyll liest **jede** `.md`-Datei im
Repo als Liquid-Vorlage — auch die Entwürfe unter `docs/`, die nie eine
Webseite werden sollten. Ein `{{` in einem Codeblock reicht dann, um den ganzen
Deploy scheitern zu lassen: Liquid läuft vor dem Markdown-Renderer und kennt
keine Codefences. Genau so stand die Seite hier sechs Tage auf einem alten
Stand, während jeder Push durchging. `.nojekyll` schaltet den Schritt ab — die
Dateien gehen unverändert online, und mehr braucht diese App nicht.

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
| `engine/save.js` | Speichern, Migration, Export und Import |
| `i18n.js` | Alle sichtbaren Texte. Nur Daten |
| `ui/*.js` | Jeder DOM-Aufruf |
| `app.js` | Zustand, Ansichten, Verdrahtung |
| `sw.js` | Service Worker: Netz zuerst, Cache als Rückfall. Seine `SHELL` muss jedes Modul nennen, sonst startet die App offline nicht — `tests/sw.test.js` prüft das gegen die Platte |
| `tests/smoke/` | Der Rauchtest: Seiten, die die echte App in einem Browser durchklicken. `tests/smoke.js` fährt sie |

**Bezeichner im Code sind englisch, sichtbare Texte deutsch** und stehen
ausschließlich in `i18n.js`. Die Datei ist UTF-8 ohne BOM und benutzt echte
Umlaute — bitte so lassen.

Ausgenommen ist die Sprache des Sports selbst: **Offense, Defense, Run, Pass,
Roster** und die Positionsnamen bleiben, wie sie auf dem Feld gesprochen
werden. Ein deutsches Wort dafür wäre nur ein zweiter Name für etwas, das der
Manager schon unter seinem ersten kennt.

Eine Ausnahme von der Richtung „engine kennt kein außen" gab es einmal:
`engine/saison.js` importierte `i18n.js`, um die fertigen Zeilen des Verlaufs zu
schreiben. Sie ist mit dem Postfach entfallen — eine Nachricht speichert einen
**Schlüssel und ihre Daten, nie einen Satz**, und der Satz dazu steht in
`T.post`. Damit lassen sich Texte ändern, ohne alte Speicherstände zu
verfälschen. Heute importiert kein Modul in `engine/` etwas von außerhalb.

## Der Rauchtest

`node --test` deckt `engine/` ab und rührt `ui/` nicht an — dort gibt es kein
DOM. Was dabei ungeprüft bleibt, ist die **Verdrahtung**: ob der erste
Bildschirm der Posteingang ist, ob ein Knopf die Uhr bewegt, ob ein alter
Speicherstand beim Laden ankommt. Genau das prüft `node tests/smoke.js`, indem
es die echte `app.js` in einem echten Firefox lädt und sich durchklickt.

```
node tests/smoke.js            # alle Seiten
node tests/smoke.js saison     # nur die, deren Dateiname passt
```

Das Skript bringt alles mit, was es braucht: es serviert das Projekt auf einem
freien Port, startet Firefox headless mit einem eigenen Wegwerfprofil und nimmt
den Bericht der Seite per POST wieder entgegen. **Der Rückweg ist der Grund für
den eigenen Server** — ein headless Firefox kann kein DOM ausgeben, nur
fotografieren, und ein Foto ist kein Urteil. So endet der Lauf mit einer Zahl
wie jeder andere Test: `0` alles grün, `1` etwas rot, `2` kein Firefox da.

Ausgegeben wird nur das Rote. Ein grüner Lauf sind fünf Zeilen.

Die Seiten liegen in `tests/smoke/` und lassen sich auch von Hand aufmachen —
sie schreiben ihren Bericht zusätzlich sichtbar auf die Seite. Zwei Regeln
halten sie am Leben:

- **Nur statische Importe.** Ein `await import()` im Modul geht am
  `load`-Ereignis vorbei; der Runner räumt dann ab, während die Seite noch
  arbeitet. Deshalb steht das Herrichten in einem `<script type="module">` und
  `import '../../app.js'` samt Prüfungen im nächsten — Modulskripte laufen in
  Dokumentreihenfolge, und `load` wartet auf beide.
- **`melder.js` ist ein klassisches Skript.** Es läuft auch dann, wenn der
  Modulgraph gar nicht erst lädt, und meldet nach zwei Sekunden von selbst, was
  es hat. Ein Rauchtest, der schweigend nichts tut, sähe sonst aus wie einer,
  der nichts gefunden hat.

Sie prüfen die Verdrahtung, nie das Layout: welcher Text in welchem Element
steht und welcher Klick was auslöst. Wie breit etwas ist, steht nirgends drin.

## Zufall und Tests

Die Engine bekommt ihren Zufall injiziert (`makeRng(seed)`). Derselbe Seed ergibt
dieselbe Saison, deshalb sind die Tests reproduzierbar. In Tests nie auf eine
Verteilung prüfen, ohne den Seed festzunageln.

Der Tages-Zufall leitet sich aus `seed | jahr | tag` ab: ein Speicherstand
liefert beim erneuten Spielen dasselbe Ergebnis. Weil der Tag innerhalb einer
Saison eindeutig ist, kann der Schlüssel nicht kollidieren, obwohl eine Saison
über den Jahreswechsel läuft.

## Speicherstände

Der laufende Stand liegt im `localStorage` (rund 150 KB). Das ist für eine
installierte Web-App haltbar, aber nicht unantastbar — der **Export** unter
*Posteingang → Speicherstand* ist die eigentliche Sicherung und zugleich der
Weg, eine Karriere zwischen PC und iPad zu tragen.

Der Schlüssel heißt `bayernliga.save.v5`. Ein Stand von vor dem Kalender
(`…v4`) wird beim Laden auf Tage umgerechnet und unter dem neuen Schlüssel
abgelegt; der alte bleibt liegen, damit eine misslungene Migration nicht die
einzige Kopie der Karriere ist.

## Stand und was als Nächstes käme

Der Fahrplan mit allen gefallenen Entscheidungen steht in
[`docs/naechste-schritte.md`](docs/naechste-schritte.md).

Gespielt werden kann: Verein wählen, den **Posteingang** als ersten Bildschirm
— Monatsraster, Tageskarte und die Post des Vereins, in dem auch die Ansprache
zum Amtsantritt als erste Nachricht liegt —, mit „Weiter" und „bis hierhin"
durch den Kalender laufen, der von selbst vor jedem eigenen Spiel, vor jeder
Antwortpflicht und an jedem Phasenwechsel anhält, zwei Gruppentabellen, Kader mit Depth Chart, sortierbaren Spalten
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
