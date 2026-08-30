# Nächste Schritte

Der Fahrplan für den Umbau, der mit der Kadergenerierung angefangen hat. Diese
Datei hält die Entscheidungen fest, die im Gespräch gefallen sind und sonst
nirgends stehen — der Code sagt, *was* passiert, hier steht, *warum* und *was
als Nächstes*.

Reihenfolge: Block 1, Block 2 und Block 3 sind fertig, ebenso die Kick-Vorstufe
aus 2c. Block 4 setzt auf allen dreien auf; aus Block 5 ist die Aufstellung von
Hand vorgezogen und umgesetzt, weil die beiden offenen Balancefragen daran
hängen — siehe [`umbau-aufstellung.md`](umbau-aufstellung.md).

---

## Leitplanken

Gelten für jeden Block, ohne Ausnahme:

- **Kein Build.** Kein Bundler, kein npm, keine Abhängigkeit. Der Browser lädt
  die ES-Module direkt, ein `git push` ist das Deployment.
- **`engine/` fasst kein DOM an, `ui/` entscheidet keine Regel.** `app.js` ist
  der einzige Ort, an dem sich beide begegnen.
- **Sichtbare Texte nur in `i18n.js`**, deutsch, UTF-8 ohne BOM, echte Umlaute.
  Bezeichner im Code bleiben englisch. Die Sprache des Sports wird nicht
  übersetzt: Offense, Defense, Run, Pass, Roster und die Positionsnamen bleiben
  englisch.
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

- ~~Die Saison läuft weiter als doppelte Runde über alle 12 Vereine = 22
  Spieltage.~~ **Erledigt in Block 3:** 10 Gruppenspieltage + Bracket.
- ~~TE, K und P existieren in keinem Kader, werden von `teamStaerken()` aber
  noch abgefragt und mit `ERSATZ_STAERKE = 20` verrechnet.~~ **Für K und P
  erledigt** über die Kick-Vorstufe, siehe 2c. **TE steht noch offen** und ist
  dabei nicht neutral: Zusatzspieler ziehen nur die *fremden* Vereine, der
  eigene hat `TE: 0` in der Kaderform — er ist also der einzige Verein, der
  garantiert mit TE = 20 rechnet. Kostet rund einen Ratingpunkt, einseitig
  gegen den Spieler. Fällt mit dem Slot-Umbau in 2a.
- **Veteranen sterben aus.** Sie entstehen nur bei der Generierung; wer
  zurücktritt, wird durch einen 18- bis 21-Jährigen ersetzt. Nach einigen
  Saisons hat kein Verein mehr einen. Nachschub gehört ins
  Rekrutierungskonzept (Block 5).

---

## Block 2 — Formationen und Positionswerte ✅ fertig

> **Umgesetzt in sieben Inkrementen nach [`umbau-positionsmodell.md`](umbau-positionsmodell.md)**
> — 18 Positionen, 15 Attribute, Lauf/Pass, alle Gewichte. Dort steht auch, was
> beim Bauen entschieden wurde und was offen blieb. Der Text unten ist der Stand
> davor und beschreibt nur die Absicht.

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

**Vorstufe ✅ erledigt.** Statt `kick` und `punt` sind es zwei Werte geworden,
die eine Stufe tiefer liegen und deshalb beide Jobs bedienen:
`kickStaerke` (wie weit) und `kickGenauigkeit` (wie zuverlässig dorthin).
Bis es echte Formeln gibt, gilt:

| Job | Formel |
| --- | --- |
| Kicker | 50 % `kickStaerke` + 50 % `kickGenauigkeit` |
| Punter | 70 % `kickStaerke` + 30 % `kickGenauigkeit` |

Die beiden Werte werden **unabhängig voneinander** gezogen, nachdem eine Stufe
ausgelost ist (die meisten können es nicht, `KICK_FUSS_ANTEIL` = 7 % können es
wirklich, OL und DL nie). Genau diese Unabhängigkeit macht die zwei Formeln
sinnvoll: ein starkes Bein ohne Zielwasser ist ein Punter, kein Kicker.
`teamStaerken()` sucht beide Jobs im **ganzen Kader** — Doppeleinsatz ist hier
ausdrücklich erlaubt. Ergebnis: Special Teams liegen je nach Verein zwischen
etwa 28 (niemand da) und 69 (ein echter Kicker) statt bei konstant 20.

Nachzulesen in [`engine/team.js`](../engine/team.js) und `ziehKickWerte()` in
[`engine/spieler.js`](../engine/spieler.js).

**Was Block 2 nebenbei aufräumt:** `ERSATZ_STAERKE` als Notnagel verschwindet.
Statt „der Platz bleibt leer und zählt 20" gilt „der nächstbeste Spieler
springt mit Abschlag ein" — und der Abschlag kommt aus der Positions-Eignung.

---

## Block 3 — Nord/Süd und Playoffs ✅ fertig

Umgesetzt wie unten beschrieben. Was dabei entschieden wurde und im Text
darunter noch nicht stand:

- Der Spielplan behält **einen durchlaufenden `spieltag`-Zähler**: 1–10
  Gruppenrunde, 11 Halbfinale, 12 Finale. Jede Partie trägt zusätzlich ihre
  `runde` (`gruppe` | `halbfinale` | `finale`). Das Bracket wird von
  `ergaenzePlayoffs()` angehängt, sobald die Runde davor vollständig gespielt
  ist — der Zustand muss deshalb keine Phase kennen, und `saisonVorbei()`
  bleibt „Spieltag größer als der letzte im Plan".
- **Die Verlängerung hat kein Rundenlimit mehr.** Sie terminiert von selbst,
  weil jeder Besitz je Seite mit mindestens 9 % einen Touchdown bringt. Die
  `OT_NOTBREMSE_RUNDEN` = 50 existiert nur, damit ein kaputter Zufall das Spiel
  nicht aufhängen kann — und sie *entscheidet* die Partie, sie gleicht sie
  nicht aus.
- **Speicherstände vor v3 werden abgelehnt.** Ein v2-Stand beschreibt eine Liga
  ohne Gruppen und ohne `runde` an der Partie; daraus lässt sich kein gültiger
  Spielplan bauen. Der `STORAGE_KEY` heißt jetzt `bayernliga.save.v3`, ein
  alter Stand im Browser wird also schlicht nicht mehr gefunden.
- **Es gibt keine Absteiger**, also auch keine Abstiegsmarkierung mehr in der
  Tabelle. Markiert sind die zwei Plätze, die ins Halbfinale führen.

Beschreibung des Umbaus, so wie er beschlossen wurde:

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

**Bewusst offen gelassen.** Beim Umbau wurde entschieden, die Verletzungsrate
vorerst nicht anzufassen; sie bleibt bei 0,055. Das heißt: Verletzungen sind
im Moment kein spürbarer Faktor mehr. Siehe offene Entscheidung 3.

---

## Block 4 — UI

Setzt auf 2 und 3 auf:

- ~~**Zwei Gruppentabellen** statt einer, plus Playoff-Ansicht mit Bracket.~~
  **Erledigt mit Block 3** — die Tabellenansicht zeigt beide Gruppen und
  darunter eine Playoff-Karte, der Spielplan benennt Halbfinale und Finale
  statt „Spieltag 11/12", und die Kopfzeile tut dasselbe. Was fehlt, ist eine
  richtige Bracket-*Grafik*; im Moment sind es drei Zeilen.
- ~~**Formation im Kaderscreen** — welches Personnel der Verein spielt, wer auf
  welchem Slot steht, wer umgestellt wurde.~~ **Erledigt** — die
  Aufstellungskarte steht im Roster, mit Marken für Umsteller und
  Doppeleinsatz, und ist seit dem Aufstellungsumbau bedienbar.
- ~~**Positionswerte anzeigen**, sobald 2c steht.~~ **Erledigt** — hinter jedem
  Namen in der Aufstellung steht, was er *auf diesem Platz* wert ist (gemischt
  nach dem Passanteil, Doppeleinsatz abgezogen). Damit hat die Marke
  „umgestellt" endlich eine Zahl.
- **Zwei Ebenen statt einer.** Der Roster zeigt Offense und Defense als je eine
  Zahl (Lauf/Pass hälftig, ungeachtet der Taktik) plus Special Teams; die
  Aufschlüsselung nach Lauf und Pass steht ausschließlich im Taktikreiter, wo
  der Regler sie auch bewegt.
- **Talent als Sterne** im Roster: eine Zehnerstufe ist ein halber Stern, unter
  10 bleibt es bei einem halben, ab 90 sind es fünf. Die rohe Zahl steht noch im
  Tooltip, und sortiert wird weiter numerisch.
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
- ~~**Aufstellung selbst bestimmen** statt Depth Chart nach Stärke.~~
  **Erledigt**, dokumentiert in [`umbau-aufstellung.md`](umbau-aufstellung.md).
  Umgesetzt wie geplant — Runde null, die Runden 1–3 als Reparaturweg, keine
  Vorgabe für die KI, die besten fünf **für diesen Platz** unter dem angetippten
  Platz. Zwei Abweichungen: die Vorgabe ist eine flache Karte Platz → Spieler-Id
  ohne `personnel` (das hat schon einen Ort), und **gezogen wird nichts** —
  statt Drag-and-drop geht es über zwei Tipps, in beide Richtungen: Platz und
  dann Mann, oder Mann und dann Platz, wobei jeder der zweiundzwanzig Plätze
  zeigt, was der Gewählte dort brächte. Das Spiel läuft auf einem iPad.
- **Auf- und Abstieg**, zweite Liga darüber. `MAX_RATING` steht deshalb noch
  auf 99, obwohl die Bayernliga bei 79 gedeckelt ist.
- Transfers und Verträge, Play-by-Play, Finanzen.

---

## Offene Entscheidungen

Nichts davon blockiert Block 2 oder 3, aber irgendwann muss es fallen:

1. **Bleibt der eigene Verein dauerhaft bei 30 Mann?** Sinnvoll erst
   beantwortbar, wenn Rekrutierung existiert.
2. **Kostet ein Doppeleinsatz etwas?** (Kondition, Verletzungsrisiko)
3. **Verletzungsrate** nach der Verkürzung auf 12 Spieltage. Steht seit dem
   Umbau ausdrücklich offen — die Rate wurde nicht mit verkürzt.
4. ~~**Verletzungsrate und Deckel auf die Umstellungskosten.**~~ Beide hingen
   daran, dass niemand von Hand umstellt. Seit die Aufstellung bedienbar ist,
   sind sie messbar — und damit die nächste Aufgabe, nicht mehr eine offene
   Frage. Siehe Punkt 2 in `umbau-aufstellung.md`.
5. **Altersverteilung.** Der Zug ist gleichverteilt 18–36, für jeden Verein
   gleich — es gibt also nie eine junge Aufsteigermannschaft oder einen
   überalterten Absteiger. Bewusst so entschieden, aber es bleibt ein Hebel.
6. **Veteranen-Nachschub**, siehe oben.
7. ~~**Körpermalus am tatsächlichen Körper.**~~ **Erledigt.** Der Malus hat
   jetzt einen zweiten Summanden, `Abstand x Übergewicht x 0,024 %`, der bei
   Ausbildung = Ziel für jeden Körper null bleibt. Der 147-Kilo-Guard zahlt für
   den Weg zum Linebacker 11,5 %, der 105-Kilo-Guard 0,4 % — vorher waren es
   für beide 4,4 %. Der rein quadratische Term, den dieser Punkt vorgeschlagen
   hatte, wurde gemessen und verworfen: er macht kurze Wechsel so billig, dass
   `DT → NT` negative Umstellungskosten bekommt und das Sollwert-Band aus dem
   Bauplan fällt.

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
| Eigene Basis | der gewählte Verein generiert mit `EIGENE_VEREINSBASIS = 45`; die schwächeren Vereine rücken je eine Stufe nach oben, die Werteleiter bleibt dieselbe |
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
| Unentschieden | gibt es nirgends, Verlängerung ohne Limit (nur eine Notbremse, die entscheidet statt auszugleichen) |
| Kickwerte | `kickStaerke` und `kickGenauigkeit` je Spieler; Kicker 50/50, Punter 70/30; unabhängig gezogen, OL und DL nie mit gutem Fuß |
| Kicker-Auswahl | der beste Fuß des **ganzen** Kaders, Doppeleinsatz K/P erlaubt |
| Speicherstände | vor v3 abgelehnt statt migriert — die alte Ligaform lässt sich nicht retten |
| Vereinsfarben | drei je Verein, in `farben: { primaer, sekundaer, tertiaer }` |
| Kürzel | zwei- oder dreistellig, gemischt ist in Ordnung |
| Eingespieltheit | `spieler.einsaetze` je Platz-Kürzel; die Stufenleiter ist der Startpunkt, die Einsätze schließen die Lücke; voll nach 30 Spielen; sie wirkt allein über den Technikanteil und ist damit auf rund drei Stärkepunkte gedeckelt |
| Ausbildung | `position`/`seite` ändern sich **nie** — der Hauptplatz wird aus den Einsätzen abgeleitet, nicht gespeichert |
| Hauptplatz | kippt nur, wenn **beides** stimmt: mehr Einsätze als `EINGESPIELT_VOLL` **und** dort mindestens so stark wie daheim, gemessen bei Passanteil 0,5 |
| Attributdrift | 15 % je Saison auf das Sollprofil des gespielten Platzes, gerechnet je Spiel; der Körper geht ins Sollprofil ein und bremst |
| Lernraten | je Attribut ein Faktor auf die Drift (`LERNRATE`): Technik 1,5 · Hände 1,4 · Kraft 0,4 · Tempo 0,3, im Schnitt 1,0 — Handwerk lernt man, Tempo nicht |
| Einsatzverfall | 7 % je Saison auf **jedem** Platz, auch dem gespielten |
| Umschulung | soll den geborenen Spieler nie einholen — 15 % ist die Rate, bei der Skill→Skill nach fünf Jahren trägt und Line→Linebacker erst am Karriereende |
| Aufstellung von Hand | flache Karte Platz-Schlüssel → Spieler-Id in `stand.aufstellung`, nur der eigene Verein; alles Abgeleitete rechnet `stelleAuf()` neu |
| Doppelte Plätze | laufende Nummer ab dem zweiten: `TE`, `TE#2` — sonst könnte eine Vorgabe die beiden Tight Ends von 12 personnel nicht unterscheiden |
| Reparatur | eine Vorgabe darf lückenhaft und zu weit sein; Verletzte und fremde Plätze werden überlesen, nicht gelöscht |
| Einsetzen | Tausch statt Verdrängung |
| Bedienung | zwei Tipps statt Ziehen, weil das Spiel auf einem iPad läuft |
