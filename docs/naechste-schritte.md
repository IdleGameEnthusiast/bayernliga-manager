# Nächste Schritte

Der Fahrplan für den Umbau, der mit der Kadergenerierung angefangen hat. Diese
Datei hält die Entscheidungen fest, die im Gespräch gefallen sind und sonst
nirgends stehen — der Code sagt, *was* passiert, hier steht, *warum* und *was
als Nächstes*.

Reihenfolge: Block 1 ist fertig, Block 2 und 3 sind unabhängig voneinander,
Block 4 setzt auf beiden auf.

---

## Leitplanken

Gelten für jeden Block, ohne Ausnahme:

- **Kein Build.** Kein Bundler, kein npm, keine Abhängigkeit. Der Browser lädt
  die ES-Module direkt, ein `git push` ist das Deployment.
- **`engine/` fasst kein DOM an, `ui/` entscheidet keine Regel.** `app.js` ist
  der einzige Ort, an dem sich beide begegnen.
- **Sichtbare Texte nur in `i18n.js`**, deutsch, UTF-8 ohne BOM, echte Umlaute.
  Bezeichner im Code bleiben englisch.
- **Zufall wird injiziert** (`makeRng(seed)`). In Tests nie auf eine Verteilung
  prüfen, ohne den Seed festzunageln.
- Tests: `node --test tests/*.test.js`. Vor und nach einer Änderung laufen
  lassen und die Zahlen vergleichen, nicht nur auf „grün" schauen.

---

## Block 1 — Kadergenerierung ✅ fertig

Zwölf Vereine in zwei Gruppen, 30er-Kader für den eigenen Verein und 35 für
alle anderen, Ligadeckel 79 auf der Stärke, neue Alterskurve, Veteranen über 45,
gewichtete Namen, neue Trikotnummern mit den einstelligen für die Besten,
Imports gestrichen.

Nachzulesen in [`engine/constants.js`](../engine/constants.js),
[`engine/content.js`](../engine/content.js) und
[`engine/spieler.js`](../engine/spieler.js).

**Was Block 1 bewusst offengelassen hat:**

- Die Saison läuft weiter als **doppelte Runde über alle 12 Vereine = 22
  Spieltage**. Block 3 macht daraus 10 + Playoffs.
- **TE, K und P existieren in keinem Kader**, werden von `teamStaerken()` aber
  noch abgefragt und mit `ERSATZ_STAERKE = 20` verrechnet. Das kostet jeden
  Verein gleichmäßig rund 14 % der angezeigten Gesamtstärke. Block 2 räumt das
  auf — bis dahin sind die Zahlen im Kaderscreen zu niedrig, aber nicht
  verzerrt.
- **Veteranen sterben aus.** Sie entstehen nur bei der Generierung; wer
  zurücktritt, wird durch einen 18- bis 21-Jährigen ersetzt. Nach einigen
  Saisons hat kein Verein mehr einen. Nachschub gehört ins
  Rekrutierungskonzept (Block 5).

---

## Block 2 — Formationen und Positionswerte

Der größte inhaltliche Umbau. Er zerfällt in drei Stufen, die einzeln
lauffähig sind.

### 2a — Offense-Personnel

Elf Mann in der Offense: **5 OL + QB + fünf Skill-Plätze**. Die fünf Plätze
verteilen sich nach Personnel-Gruppierung, erste Ziffer RB, zweite TE, Rest WR:

| Gruppierung | RB | TE | WR | |
| --- | --- | --- | --- | --- |
| 00 | 0 | 0 | 5 | Empty |
| 01 | 0 | 1 | 4 | Empty mit TE |
| 10 | 1 | 0 | 4 | Spread |
| 11 | 1 | 1 | 3 | Standard |
| 12 | 1 | 2 | 2 | |
| 20 | 2 | 0 | 3 | |
| 21 | 2 | 1 | 2 | |
| 32 | 3 | 2 | 0 | Double Wing |

- Das System wird pro Verein **ausgelost**.
- Spieler sind **zwischen den Systemen konvertierbar** — ein Kader ohne TE kann
  trotzdem 11 Personnel spielen, indem jemand umgestellt wird. Wie gut das
  klappt, sagen die Positionswerte aus 2c.
- **`teamStaerken()` muss von Position auf Slot umgebaut werden.** Heute hängt
  das Gewicht an der Position (WR 0,18, RB 0,11, TE 0,06); nötig ist: QB 0,40
  und OL 0,25 fest, die restlichen 0,35 auf die fünf Skill-Plätze. Sonst wird
  ein Systemwechsel automatisch zur Stärkeänderung, obwohl dieselben elf Leute
  auf dem Feld stehen.
- Nebenbei repariert: die jetzige Offense fragt **zwölf** Spieler ab
  (QB 1 + OL 5 + WR 3 + RB 2 + TE 1).

### 2b — Defense

Vorerst reicht **4-3** (DL 4, LB 3, DB 4 — das ist der aktuelle Stand, hier ist
nichts zu tun). Später dazu: **4-4, 3-3, 3-4**. Das braucht denselben
Slot-Umbau wie die Offense und wird als eigener Schritt gemacht.

### 2c — Positionswerte (das Datenmodell)

Das eigentliche Ziel. Heute hat ein Spieler nur `staerke` und `talent`.

- **Nicht zehn unabhängige Eignungen pro Spieler.** Sonst entstehen
  Unsinnsspieler — der 120-kg-Lineman, der zufällig ein guter DB ist.
- Stattdessen **wenige Grundattribute** (Athletik, Kraft/Masse, Hände,
  Wurfarm, Kickfuß, Spielverständnis), aus denen die Positions-Eignung
  *abgeleitet* wird. Dann ist ein Positionswechsel automatisch plausibel:
  TE→OL geht, WR→DL nicht.
- **K und P kommen daher.** In den unteren Ligen hat fast kein Verein einen
  Spezialisten; gekickt wird von dem mit dem besten Fuß. Deshalb stehen K und P
  in keiner Kaderform. `teamStaerken()` sucht sich den besten Kicker aus dem
  **ganzen Kader**, nicht aus einem K-Slot.
- **Doppeleinsatz** ist die Ausnahme: ein Spieler steht in genau einer Depth
  Chart, außer bei K/P (immer erlaubt) und wenn der Kader eine Position sonst
  nicht besetzen kann. Ob Doppeleinsatz etwas kostet (Kondition, höheres
  Verletzungsrisiko), ist noch nicht entschieden — ohne Preis stellt der
  Manager überall seinen besten Athleten hin.

**Kleinste sinnvolle Vorstufe**, falls 2c zu groß wird: nur `kick` und `punt`
als zwei neue Werte einführen, bei den meisten niedrig, bei wenigen echt, und
`teamStaerken()` den besten Kicker des Kaders nehmen lassen. Das erfüllt das
K/P-Ziel sofort und wird vom vollen Attributmodell später nicht weggeworfen.

**Was Block 2 nebenbei aufräumt:** `ERSATZ_STAERKE` als Notnagel verschwindet.
Statt „der Platz bleibt leer und zählt 20" gilt „der nächstbeste Spieler
springt mit Abschlag ein" — und der Abschlag kommt aus der Positions-Eignung.

---

## Block 3 — Nord/Süd und Playoffs

Unabhängig von Block 2 und der zweitgrößte Brocken.

### Gruppen

Stehen schon als Feld `gruppe` in [`engine/content.js`](../engine/content.js):

- **Nord** — Hemhofen, Aschaffenburg, Erlangen, Herzo, Franken, Passau
- **Süd** — Gendorf, Königsbrunn, Feldkirchen, Starnberg, München, Bad Tölz

Doppelte Runde **innerhalb** der Gruppe: 10 Spieltage.

### Playoffs

- **Halbfinale:** 1. Süd gegen 2. Nord, 1. Nord gegen 2. Süd. **Heimrecht beim
  Gruppensieger.**
- **Finale:** die beiden Sieger. Heimrecht beim besser platzierten Team,
  gemessen an **Win Percentage**, bei Gleichstand an der **Punktdifferenz**
  (erzielt − kassiert).
- Win Percentage = `(Siege + 0,5 × Unentschieden) / Spiele`. Unentschieden
  kommen zwar nicht mehr vor, die Formel bleibt trotzdem so.

### Kein Unentschieden, nirgends

Auch nicht in der regulären Saison. Die Verlängerung in
[`engine/spiel.js`](../engine/spiel.js) gibt heute nach 8 Runden auf
(`while (heimPunkte === gastPunkte && runden < 8)`) — das Limit fällt weg.
**Achtung:** ohne Limit muss sichergestellt sein, dass die Verlängerungsrunde
nicht dauerhaft 0:0 liefern kann, sonst hängt die Schleife.

Was dadurch tot wird: `POINTS_TIE`, die `unentschieden`-Spalte, die Form
`5-2-1` in `bilanz()`, der Unentschieden-Zweig im Verlaufslog.

### Was das im Code anfasst

Der Spielplan lässt sich **nicht mehr am Saisonanfang vollständig würfeln** —
wer im Halbfinale steht, weiß man erst nach Spieltag 10. Damit zerfällt er in
zwei Phasen, und das zieht sich durch:

- `engine/spielplan.js` — Gruppenrunde erzeugen, Bracket nachträglich anhängen
- `engine/saison.js` — Zustandsform, `saisonVorbei`, `spieleSpieltag`,
  `naechsteSaison` (Meister ist der **Finalsieger**, nicht `abschluss[0]`)
- `engine/tabelle.js` — zwei Gruppentabellen statt einer
- `engine/save.js` — Migration, Versionssprung
- `ui/spielplan.js`, `ui/tabelle.js`

### Nebenwirkung, die mitgedacht werden muss

Die Saison schrumpft von 22 auf **12 Spieltage**. Bei
`INJURY_CHANCE_PER_GAME = 0.055` sind das ~0,66 Verletzungen pro Verein und
Saison — praktisch kein Gegenspieler. Wenn der dünne 30er-Kader spürbar sein
soll, muss die Verletzungsrate mit.

---

## Block 4 — UI

Setzt auf 2 und 3 auf:

- **Zwei Gruppentabellen** statt einer, plus Playoff-Ansicht mit Bracket.
- **Formation im Kaderscreen** — welches Personnel der Verein spielt, wer auf
  welchem Slot steht, wer umgestellt wurde.
- **Positionswerte anzeigen**, sobald 2c steht.
- Der zweifarbige Vereinstupfer ist schon da (`farbtupfer()` in
  [`ui/dom.js`](../ui/dom.js)); die Wappen holen ihre Textfarbe über
  `kontrastFarbe()`.

---

## Block 5 und später — was im Gespräch fiel, aber noch keinen Platz hat

- **Rekrutierung.** Neue Spieler zwischen den Saisons. Solange es die nicht
  gibt, ist der 30er-Kader des eigenen Vereins eine **dauerhafte** Strafe und
  nicht bloß eine schwere Startsituation — das war so nicht gemeint.
- **Spielerentwicklung als Gesamtkonzept.** Performance fließt in die
  Entwicklung ein. Hier gehört auch der Ligadeckel hin: `talent` darf über 79
  liegen, aber die **Entwicklungskurve** rechnet die Liga ein, sodass die
  Stärke nie darüber steigt. Der Deckel greift bei der Generierung heute
  praktisch nie (stärkster erzeugter Spieler ~75) — er ist für diese Kurve
  gedacht.
- **Rücktritt als berechneter Wert.** `ruecktrittAlter` steht schon am Spieler,
  wird aber nur gesetzt (37 für normale Spieler, individuell für Veteranen) und
  nicht berechnet. Gehört ins Entwicklungskonzept.
- **Nummernwunsch.** Nummern bleiben am Spieler. Das Einzige, was sich ändern
  darf: ein guter Spieler will beim Jahreswechsel auf eine frei gewordene
  einstellige Nummer wechseln. Das kommt als **Anfrage an den Manager** und
  muss genehmigt werden. Braucht ein Postfach/Genehmigungs-Konzept, das es noch
  nicht gibt. Datenfeld wäre `nummerWunsch` neben `nummer`.
- **Aufstellung selbst bestimmen** statt Depth Chart nach Stärke.
- **Auf- und Abstieg**, zweite Liga darüber. `MAX_RATING` steht deshalb noch
  auf 99, obwohl die Bayernliga bei 79 gedeckelt ist.
- Transfers und Verträge, Play-by-Play, Finanzen.

---

## Offene Entscheidungen

Nichts davon blockiert Block 2 oder 3, aber irgendwann muss es fallen:

1. **Bleibt der eigene Verein dauerhaft bei 30 Mann?** Sinnvoll erst
   beantwortbar, wenn Rekrutierung existiert.
2. **Kostet ein Doppeleinsatz etwas?** (Kondition, Verletzungsrisiko)
3. **Verletzungsrate** nach der Verkürzung auf 12 Spieltage.
4. **Altersverteilung.** Der Zug ist gleichverteilt 18–36, für jeden Verein
   gleich — es gibt also nie eine junge Aufsteigermannschaft oder einen
   überalterten Absteiger. Bewusst so entschieden, aber es bleibt ein Hebel.
5. **Veteranen-Nachschub**, siehe oben.

---

## Entscheidungslog — damit nichts zweimal verhandelt wird

Das ist der Stand, auf den sich alles Obige stützt.

| Thema | Entscheidung |
| --- | --- |
| Positionen | Die zehn bleiben wie sie sind |
| Kaderform | eigener Verein 30 (`QB 1, RB 2, WR 5, OL 6, DL 6, LB 4, DB 6`), andere 35 |
| Zusatzspieler | 5, gewichtet gezogen, max. 2 je Position, TE möglich |
| Ersatzbank | gibt es nicht — zu wenige Spieler heißt, jemand springt ein |
| Imports | komplett gestrichen; wenn, dann später als Gesamtkonzept |
| Talent | wird ohne Ligadeckel generiert, bis `MAX_RATING` 99 |
| Stärke | wird **nie** über `LIGA_MAX_STAERKE` 79 berechnet |
| Streuung | `TALENT_STREUUNG = 6` um die Vereinsbasis; `randNormal` liefert echte sd 1 |
| Mindestrating | gibt es nicht (nur die 1 als technische Untergrenze) |
| Alterskurve | 0,68 (18) → 1,00 (27) → 0,90 (33) → 0,711 (40) → Zerfall ×0,94/Jahr, kein Boden |
| Veteranen | 1–2 je Verein, 75 % 45–55, 25 % 56–65, auf OL/DL, mit eigenem `ruecktrittAlter` |
| Altersprofil | keins — alle Vereine ziehen gleich |
| Namen | Pool bleibt, aber gewichtet; Eindeutigkeit nur innerhalb eines Vereins |
| Nummernbänder | QB 1–19 · RB 20–49 · WR 10–19 + 80–89 · TE 40–49 + 80–89 · OL 50–79 · DL 50–79 + 90–99 · LB 40–59 + 90–99 · DB 20–49 |
| Einstellige | 0–9 sind echte Nummern; 5–9 davon gehen an die 12 besten Nicht-OL |
| OL-Nummern | **nie** außerhalb 50–79, also auch nie einstellig |
| Nummernbestand | bleibt über den Jahreswechsel am Spieler |
| Fehlerfall Nummer | `throw`, nicht mehr die 0 |
| Ligaformat | 12 Vereine, Nord/Süd zu je 6, 10 Spieltage Gruppenrunde |
| Playoffs | HF 1. Süd–2. Nord und 1. Nord–2. Süd, Heimrecht Gruppensieger |
| Finale | Heimrecht nach Win Percentage, dann Punktdifferenz |
| Unentschieden | gibt es nirgends, Verlängerung ohne Limit |
| Vereinsfarben | drei je Verein, in `farben: { primaer, sekundaer, tertiaer }` |
| Kürzel | zwei- oder dreistellig, gemischt ist in Ordnung |
