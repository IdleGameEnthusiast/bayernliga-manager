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
  ist — der Zustand muss deshalb keine Phase kennen, und ~~`saisonVorbei()`
  bleibt „Spieltag größer als der letzte im Plan"~~. **Beides gilt seit dem
  Kalender nicht mehr**: der Zustand kennt Phasen, `saisonVorbei()` ist
  entfallen, und der `spieltag` ist vom Zähler zum Etikett geworden. Siehe
  Block 6.
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
  statt „Spieltag 11/12", und die Kopfzeile tut dasselbe. ~~Was fehlt, ist eine
  richtige Bracket-*Grafik*; im Moment sind es drei Zeilen.~~ **Auch das ist
  erledigt** — drei Spalten, Halbfinale, Finale, Meister, mit Verbindern aus
  CSS-Rahmen statt aus SVG. Zwei Entscheidungen dabei:

  Das Bracket steht **auch dann da, wenn nichts ausgelost ist**. Die vier
  Halbfinalplätze tragen dann ihre Setzung — „1. Nord", „2. Süd" — und, sobald
  ein Spieltag gespielt ist, das Kürzel des Vereins, der den Platz gerade hält.
  Damit beantwortet die Ansicht schon am fünften Spieltag die Frage, für die man
  vorher zwei Tabellen im Kopf kreuzen musste: auf wen liefe das gerade hinaus.
  Vor dem ersten Spieltag bleibt das Kürzel weg — die Tabelle steht dann nur in
  irgendeiner Reihenfolge da, und „Erster" wäre eine Auskunft über nichts.

  Im Finale stehen die beiden **in der Reihenfolge der Halbfinale**, nicht nach
  Heimrecht: das hängt an der Bilanz, und sobald es beim Sieger des unteren
  Halbfinales liegt, kreuzten sich die Linien. Wer zu Hause spielt, sagt
  stattdessen ein `H` am Verein.

  Damit die Ansicht die Setzung beschriften kann, ohne sie ein zweites Mal zu
  kennen, steht sie als `HALBFINAL_SETZUNG` in
  [`engine/spielplan.js`](../engine/spielplan.js) — dieselbe Liste, aus der
  `macheHalbfinale()` die Partien baut, und ein Test hält beide aneinander.
- ~~**Formation im Kaderscreen** — welches Personnel der Verein spielt, wer auf
  welchem Slot steht, wer umgestellt wurde.~~ **Erledigt** — die
  Aufstellungskarte steht im Roster, mit Marken für Umsteller und
  Doppeleinsatz, und ist seit dem Aufstellungsumbau bedienbar.
- ~~**Positionswerte anzeigen**, sobald 2c steht.~~ **Erledigt** — hinter jedem
  Namen in der Aufstellung steht, was er *auf diesem Platz* wert ist (gemischt
  nach dem Passanteil, Doppeleinsatz abgezogen). Damit hat die Marke
  „umgestellt" endlich eine Zahl.
- ~~**Zwei Ebenen statt einer.** Der Roster zeigt Offense und Defense als je eine
  Zahl (Lauf/Pass hälftig, ungeachtet der Taktik) plus Special Teams; die
  Aufschlüsselung nach Lauf und Pass steht ausschließlich im Taktikreiter, wo
  der Regler sie auch bewegt.~~ **Erledigt, aber der letzte Halbsatz war falsch.**
  Der Regler bewegt die vier Werte *nicht*: er erreicht `teamStaerken()` nur über
  die Platzvergabe in `stelleAuf()`, und in einem System mit festen Skill-Plätzen
  — Double Wing, `RB · FB · FB · TE · TE` — sind das Zehntel. Von 20 % auf 100 %
  gerechnet: `passAngriff` 43,1 → 44,4, gerundet also 43 → 44. Wer den Regler
  ganz herumzog und auf die Balken sah, sah nichts und hielt die Ausrichtung für
  nicht umgesetzt.

  Was er wirklich bewegt, ist `vorteil()` — im selben Fall +3,0 → −28,0
  Stärkepunkte, gut dreizehn Punkte im Endstand. Das stand nirgends. Der
  Taktikreiter zeigt es jetzt: `vorteilTeile()` schlüsselt die Zahl in ihre vier
  Summanden auf (Passduell, Laufduell, Einseitigkeit, Randband), gerechnet gegen
  den **nächsten Gegner** — oder gegen den Ligaschnitt, wenn keiner mehr ansteht.
  `bestesPassAnteil()` markiert dazu das rechnerische Optimum auf der Reglerskala.
  Die vier Balken bleiben stehen, aber unter der ehrlichen Überschrift „Angriff
  und Verteidigung" und mit dem Hinweis, dass sie sagen, was die Mannschaft *ist*.
- ~~**Talent als Sterne** im Roster: eine Zehnerstufe ist ein halber Stern, unter
  10 bleibt es bei einem halben, ab 90 sind es fünf. Die rohe Zahl steht noch im
  Tooltip, und sortiert wird weiter numerisch.~~ **Erledigt** — `talentSterne()`
  in [`engine/spieler.js`](../engine/spieler.js), gezeichnet von `sterne()` in
  [`ui/dom.js`](../ui/dom.js): zwei Reihen übereinander, die gefüllte auf die
  halbe Breite beschnitten, weil das Halbstern-Zeichen in zu vielen Schriften
  als Kasten ankommt.
- Der zweifarbige Vereinstupfer ist schon da (`farbtupfer()` in
  [`ui/dom.js`](../ui/dom.js)); die Wappen holen ihre Textfarbe über
  `kontrastFarbe()`.

---

## Block 6 — Kalender und Postfach ✅ fertig

> **Umgesetzt nach [`umbau-kalender.md`](umbau-kalender.md)** — dort stehen die
> Entscheidungen, die Zustandsform v5, die Migration und die Nachrichtenarten.
> Was hier steht, ist nur der Umriss.

Aus dem Spieltag-Ticker ist ein Tagesspiel geworden. Drei Dinge, die vorher
`spieltag` in einer Zahl vermischt hatte, sind auseinandergebrochen:

- **Die Uhr** ist der `tag` seit Saisonbeginn. Eine Saison läuft von einem
  dritten Oktobersamstag zum nächsten und dauert deshalb immer volle Wochen;
  Tag 1 ist immer ein Samstag, und der Wochentag ist eine Modulorechnung.
  [`engine/kalender.js`](../engine/kalender.js) ist der einzige Ort mit `Date`.
- **Der Zufallsschlüssel** heißt jetzt `seed | jahr | tag`. Der Preis stand
  fest und war gewollt: jede seed-festgenagelte Zahl in den Tests wird neu.
- **Der Spieltag** ist nur noch das Etikett an der Partie — beim Auslosen
  vergeben, nie neu gerechnet.

Nach außen bewegt eine einzige Funktion die Uhr: `weiter(stand, zielTag)`. Sie
hält von selbst dort an, wo eine Entscheidung fällig ist — vor dem eigenen
Spiel, vor einer offenen Antwort, an jedem Phasenwechsel. Fremde Spieltage
halten nicht an, sie werden im Vorbeigehen simuliert.

Der `verlauf` ist im **Postfach** aufgegangen. Eine Nachricht speichert einen
Schlüssel und ihre Daten, nie einen fertigen Satz — damit ist die einzige
dokumentierte Ausnahme von „engine kennt kein außen" (der `i18n`-Import in
`engine/saison.js`) aufgelöst. Der Posteingang ist der erste Reiter und die
Startansicht, mit Monatsraster und Tageskarte; die Ansprache zum Amtsantritt
ist die erste E-Mail statt eines eigenen Bildschirms, und die Fußleiste ist
weggefallen.

**Nachtrag — der Posteingang im Schnitt eines Mailprogramms.** Vier Sachen an
Block 6 haben sich beim Spielen nicht gehalten und sind nachgezogen worden:

- **Ein Tipp im Raster wählt nur noch aus**; simuliert wird über den Knopf
  „Bis zu diesem Datum simulieren" darunter. Ein Fehlgriff kostete vorher
  Wochen an Spielzeit und war nicht zurückzunehmen.
- **Der Kalender zeigt Termine, keine Post.** Die Briefmarken an den Tagen
  sind weg; im Raster steht nur, was ansteht — heute das eigene Spiel, später
  mehr. Das Zeichen dafür ist ein Football, kein Fußball.
- **Ordner statt Aufklappen.** Links Posteingang und Gelöscht, rechts die
  Nachricht. **Keine automatische Archivierung mehr:** gelesen heißt gelesen,
  und was aus dem Eingang verschwindet, hat der Manager über „Löschen"
  weggeworfen. `stutzePost()` leert beim Saisonwechsel nur noch den
  Papierkorb.
- **Das Wort des Vorstands verlangt keine Antwort mehr.** Es war die einzige
  Antwortpflicht ohne Entscheidung dahinter. `ANTWORTEN` enthält damit nur
  noch `aufstellungUngueltig`.

`SAVE_VERSION` steht dafür auf 7, und der Schritt 6→7 in
[`engine/save.js`](../engine/save.js) ist der erste des wieder eingeführten
Migrationspfads.

**Offen geblieben:** die Vorbereitung (Tag 2–182) und die Sommerpause sind
noch leer. Sie sind der Haken, an dem Transfers, Training und Rekrutierung
hängen — das ist der nächste Block, nicht mehr dieser.

---

## Block 5 und später — was im Gespräch fiel, aber noch keinen Platz hat

- **Rekrutierung.** Neue Spieler zwischen den Saisons. Solange es die nicht
  gibt, ist der 30er-Kader des eigenen Vereins eine **dauerhafte** Strafe und
  nicht bloß eine schwere Startsituation — das war so nicht gemeint.
- **Spielerentwicklung als Gesamtkonzept.** Performance fließt in die
  Entwicklung ein. Hier gehört auch der Ligadeckel hin: `talent` darf über 79
  liegen, aber die **Entwicklungskurve** rechnet die Liga ein, sodass die
  Stärke nie darüber steigt. Der Deckel greift bei der Generierung heute
  praktisch nie — er ist für diese Kurve gedacht. **Nachgemessen:** über 4320
  Spieler aus zwölf Ligadurchläufen ist die höchste erzeugte Stärke **76**, und
  genau ein Spieler erreicht sie; auch ohne Deckel gerechnet ändert sich daran
  nichts. Auf der 79 steht bei der Stärke niemand. Was den Deckel wirklich
  berührt, sind die **Attribute** — siehe offene Entscheidung 9.
- **Rücktritt als berechneter Wert.** `ruecktrittAlter` steht schon am Spieler,
  wird aber nur gesetzt (37 für normale Spieler, individuell für Veteranen) und
  nicht berechnet. Gehört ins Entwicklungskonzept.
- **Nummernwunsch.** Nummern bleiben am Spieler. Das Einzige, was sich ändern
  darf: ein guter Spieler will beim Jahreswechsel auf eine frei gewordene
  einstellige Nummer wechseln. Das kommt als **Anfrage an den Manager** und
  muss genehmigt werden. ~~Braucht ein Postfach/Genehmigungs-Konzept, das es
  noch nicht gibt.~~ **Das Postfach steht seit Block 6** — eine Nummernanfrage
  wäre eine weitere Art mit Antwortpflicht in `ANTWORTEN`. Datenfeld wäre
  `nummerWunsch` neben `nummer`.
- ~~**Aufstellung selbst bestimmen** statt Depth Chart nach Stärke.~~
  **Erledigt**, dokumentiert in [`umbau-aufstellung.md`](umbau-aufstellung.md).
  Umgesetzt wie geplant — Runde null, die Runden 1–3 als Reparaturweg, keine
  Vorgabe für die KI, die besten fünf **für diesen Platz** unter dem angetippten
  Platz. Zwei Abweichungen: die Vorgabe ist eine flache Karte Platz → Spieler-Id
  ohne `personnel` (das hat schon einen Ort), und **gezogen wird nichts** —
  statt Drag-and-drop geht es über zwei Tipps, in beide Richtungen: Platz und
  dann Mann, oder Mann und dann Platz, wobei jeder der zweiundzwanzig Plätze
  zeigt, was der Gewählte dort brächte. Das Spiel läuft auf einem iPad.
  **Nachgezogen:** der Entwurf ist wieder weg — es wird sofort gespeichert, ein
  Papierkorb räumt einen einzelnen Platz, ein Platz darf leer bleiben, und wer
  so antritt, verliert 0:36 am grünen Tisch. ~~**Offen:** Ziehen als *Zugabe*
  neben den zwei Tipps, über Pointer Events, damit Maus und Finger denselben
  Weg gehen.~~ **Auch das steht** — [`ui/ziehen.js`](../ui/ziehen.js), eine
  Zustandsmaschine für Maus, Finger und Stift. Gezogen wird von einer Zeile mit
  einem Mann auf jeden Platz (`data-ziel`), und der Zug endet auf derselben
  Regel wie der zweite Tipp. Unterschiedlich ist nur der **Anfang**: die Maus
  zieht ab sechs Pixeln, der Finger erst, nachdem er 350 ms gelegen hat — ohne
  das wäre jedes Wischen über der Kandidatenliste ein angefangener Zug und die
  Liste auf dem iPad nicht mehr scrollbar. Geprüft in
  [`tests/smoke/ziehen.html`](../tests/smoke/ziehen.html), der einzigen Stelle,
  die ohne echtes Layout nicht zu prüfen ist.
- **Auf- und Abstieg**, zweite Liga darüber. `MAX_RATING` steht deshalb noch
  auf 99, obwohl die Bayernliga bei 79 gedeckelt ist.
- **Coaches.** ~~Gibt es nicht.~~ **Der Stab steht** — jeder Verein hat einen
  OC und einen DC mit Soft Skills, Scheme und Positionstechnik, einer Stärke
  je Rolle und einer Ähnlichkeit der Coaching-Gruppen, die aus dem
  Positionsmodell gerechnet wird. Dokumentiert in
  [`umbau-coaches.md`](umbau-coaches.md). **Was noch fehlt, in dieser
  Reihenfolge:** die Wirkung am Spieltag samt Umbau des Taktikreiters (OC- und
  DC-Karte, Vertrautheit an jeder Gruppierung), die Wirkung auf die
  Spielerentwicklung (gehört zum Entwicklungskonzept oben), und der Markt —
  Einstellen, Entlassen, Rekrutierung der Jüngeren. Bis dahin ist der
  Coaches-Reiter unter Personal reine Auskunft.
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
   Ausbildung = Ziel für jeden Körper null bleibt. Der 146-Kilo-Guard zahlt für
   den Weg zum Linebacker 17,6 %, der 106-Kilo-Guard 4,0 % — ohne den Summanden
   wären es für beide 8 %. Der rein quadratische Term, den dieser Punkt
   vorgeschlagen hatte, wurde gemessen und verworfen: er macht kurze Wechsel so
   billig, dass `DT → NT` negative Umstellungskosten bekommt und das
   Sollwert-Band aus dem Bauplan fällt.

   **Nachtrag — die Gutschrift war unbeschränkt, und das war ein Loch.** Der
   zweite Summand ist negativ, wenn ein Mann in die Zielrichtung gebaut ist,
   und nichts hielt ihn auf. Weil **beide** Summanden linear im Abstand sind,
   hängt ihr Verhältnis gar nicht am Abstand: ab
   `KOERPERMALUS_JE_KILO / KOERPERMALUS_JE_KILOQUADRAT` = 16,7 kg über der
   eigenen Korridormitte fraß die Gutschrift den ganzen Malus, egal wie weit
   die Positionen auseinanderliegen. Der schwerste Linebacker der Liga
   wechselte damit gratis in die Mitte der Line. Breitere Korridore heilen das
   nicht, sie schieben nur mehr Männer über die Schwelle — beim Umbau der
   Korridore lagen fünf Positionen darüber (NT 22,5 · T 21 · G 20 · DT 20 ·
   DE 17,5 halbe Breite). `KOERPERMALUS_GUTSCHRIFT_ANTEIL` = 0,5 begrenzt sie
   jetzt auf die Hälfte des linearen Terms: Richtungskorrektur, keine
   Umkehrung. Der Weg bleibt ein Weg.

8. ~~**Der Sam fiel billiger in die Mitte der Line als auf die eigene
   Kante.**~~ **Erledigt**, aber nicht restlos — siehe unten. Ein schwerer
   Sam-Linebacker kostete auf Nose Tackle −7,7 % und auf Defensive End
   −15,7 %; der Platz nebenan, an dem er beinahe schon stand, war doppelt so
   teuer wie der Graben.

   Der Körper war **nicht** die Ursache. Zerlegt man die Eignung in ihre drei
   Faktoren, bestraft der Körpermalus den Weg nach innen völlig richtig, mit
   4,8 Punkten gegen 1,4 nach außen. Er wird nur überstimmt: roh, vor jedem
   Abschlag, las derselbe Mann sich auf der NT-Formel als 71,3 und auf der
   DE-Formel als 64,0. Sieben Punkte Vorsprung, die drei Punkte Körper nicht
   einholen können.

   Der Grund stand in den Formeln. Die Laufformel des Sam bestand aus
   `tacklen`, `kraft`, `technik` und `spielverstaendnis` — **denselben vier
   Attributen** wie die des Nose Tackle, nur anders gewichtet. Ein Sam war
   damit als kleiner, kluger Nose Tackle beschrieben und konnte dort gar nicht
   durchfallen; die DE-Formel dagegen verlangt `beweglichkeit` mit 18 %, und
   das kam im ganzen Sam-Profil kein einziges Mal vor, lag also auf der
   Bodenplatte aus `PROFIL_SPEZIALISIERUNG`. Weder Mike noch Sam hatten im
   Laufspiel Tempo oder Wendigkeit. Was einen Linebacker vom Lineman trennt,
   ist aber nicht Kraft, sondern dass er läuft.

   Beide haben deshalb Bewegung im Raum bekommen, Sam in voller, Mike in halber
   Dosis. Das wirkt zweimal, und darauf beruht die Wirkung: `generierungsProfil()`
   kommt aus den Formeln, die Änderung entscheidet also über die Bewertung
   **und** über die Ziehung. Der Sam bekommt echte Beweglichkeit statt der
   Bodenplatte — was ihn auf der Kante besser macht — und weniger Kraft — was
   ihn in der Mitte schlechter macht.

   **Offen geblieben:** der Kipppunkt liegt bei 106 kg. Darunter ist die Kante
   billiger als die Mitte, darüber bleibt NT vorn — mit 0,6 bis 1,4 Punkten
   statt der 8,0 von vorher. Ein 110-Kilo-Sam, der im Inneren aushilft, ist in
   einer Amateurliga vertretbar; wer die letzten anderthalb Punkte will, dreht
   an der Sam-Dosis oder gibt der NT-Formel etwas, das ein Linebacker
   strukturell nicht haben kann. **Nicht** am Körper — der arbeitet.

9. **Soft Cap auf die Attribute statt der harten 79.** Vorgeschlagen,
   durchgerechnet, bewusst nicht gebaut.

   Die Lage: `LIGA_MAX_STAERKE` = 79 klemmt an vier Stellen nicht nur die
   Stärke, sondern **jedes einzelne Attribut** — in `baueAttribute()`, in
   `skaliereAufStaerke()`, in `spieleEinsatz()` und in `setzeStaerke()`. Das
   ist ein Kategorienfehler: `staerke` ist der gewichtete **Mittelwert** der
   Attribute unter dem Positionsprofil, die Attribute sind seine **Summanden**.
   Beide auf dieselbe Zahl zu deckeln heißt, dass den Mittelwert nur erreicht,
   wer ihn überall erreicht — der Deckel erzwingt die Gleichverteilung
   ausgerechnet bei den Besten.

   Gemessen an 4320 Spielern aus zwölf Ligadurchläufen ist der Stapel klein,
   aber schlecht platziert: 187 von 64 800 Attributwerten (0,29 %), davon 9,7 %
   der Nose Tackles und 9,4 % der Defensive Tackles, fast ausschließlich
   `kraft` (64) und `schnelligkeit` (65) — also je das eine Attribut, das die
   Position ausmacht, bei ihren besten Spielern (Median-Stärke 64 gegen
   Ligamedian 47).

   Der Vorschlag: **Knie bei `LIGA_MAX_STAERKE` 79, Asymptote bei `MAX_RATING`
   99**, `knie + (dach - knie) * (1 - exp(-(wert - knie) / (dach - knie)))`.
   Stetig, Steigung 1 am Knie, reihenfolgeerhaltend: 85 → 84,2 · 90 → 87,5 ·
   104 → 93,3. Keine neue Konstante, und beide Kommentare bleiben wahr — über
   79 kommt man nur noch mühsam, über 99 nie. Es holt die Attribute in dasselbe
   Band 79–99, in dem `talent` als einzige Größe des Modells ohnehin schon
   wohnt.

   **Zwei Fallen, die vor dem Bauen zu klären sind.** Erstens: die Kurve darf
   **nicht** in `skaliereAufStaerke()`. Die Schleife dort multipliziert und
   klemmt sechsmal hintereinander; eine Stauchung darin staucht bei jedem
   Durchlauf erneut. Sie gehört einmal ans Ende von `baueAttribute()` — der
   Preis ist, dass der Gesamtwert eines gestauchten Spielers danach ein Stück
   unter seiner Stärke liegt, und wie weit, ist ungemessen. Zweitens: die
   abgeleiteten Werte (`eignung`, `platzStaerke`, die vier Blockwerte) haben
   keine eigene Klammer und wandern mit. Auf dem Hauptplatz bindet die
   Normierung den Mann an seine Stärke; was auf **fremden** Plätzen und bei
   extremem Taktikregler passiert, ist ebenfalls ungemessen. Dazu kommen die
   Balken in [`ui/personal.js`](../ui/personal.js) und
   [`ui/taktik.js`](../ui/taktik.js), die `LIGA_MAX_STAERKE` als Vollausschlag
   nehmen und eine eigene Anzeigekonstante brauchen.

   Verworfen wurde dabei die Variante „nur bei der Generierung deckeln":
   `spieleEinsatz()` ist eine echte Konvexkombination (höchster Faktor
   0,0147 × 1,5 = 0,0221) und kann `soll` nie überschreiten, und `soll` kommt
   aus dem Generierungspfad — die Unterscheidung existiert also fast nicht. Die
   einzige Stelle, die wirklich anders wirkt, ist `setzeStaerke()`, und sie
   dort auszulassen erzeugte zwei Spielersorten gleicher Stärke, je nachdem ob
   einer so gezogen wurde oder sich dorthin entwickelt hat. Das läuft auf
   „Eigengewächse sind besser als Zugänge" hinaus, ohne dass es jemand sehen
   kann.

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
| Speicherstände | **Migrationspfad in `engine/save.js`** — `MIGRATIONEN` hebt einen Stand Schritt für Schritt auf die heutige `SAVE_VERSION`; nur was der Pfad nicht erreicht, wird weggeworfen, siehe [`CLAUDE.md`](../CLAUDE.md) |
| Vereinsfarben | drei je Verein, in `farben: { primaer, sekundaer, tertiaer }` |
| Bracket | drei Spalten mit Verbindern aus CSS-Rahmen; unter 720px gestapelt und ohne Linien, weil eine Klammer um die Ecke schlimmer wäre als keine |
| Leeres Bracket | steht trotzdem da, mit der Setzung auf den Plätzen und dem, der sie gerade hält — aber erst ab dem ersten gespielten Spieltag |
| Setzung | als Daten in `HALBFINAL_SETZUNG`, damit die Ansicht sie beschriften kann, ohne die Regel zu kennen |
| Finalseiten | in der Reihenfolge der Halbfinale, nicht nach Heimrecht — sonst kreuzen sich die Linien; das Heimrecht sagt ein `H` am Verein |
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
| Speichern | gar nicht — jeder Handgriff steht sofort im Stand. Es gibt keinen Entwurf, keinen Knopf und keinen Wächter beim Reiterwechsel mehr |
| Leerer Platz | erlaubt, zählt null und wird von den Reparaturrunden nicht angefasst. „Automatisch aufstellen" ist der Weg zurück |
| Nicht angetreten | eine Elf mit Loch wird `WERTUNG_PUNKTE` = 0:36 gegen sich gewertet; kein Einsatz, keine Verletzung, keine Box — für beide Vereine. Der Kalender fragt vorher |
| Coaches | OC + DC je Verein, Stärke um Vereinsbasis/2, Alter 50–65; zehn Coaching-Gruppen mit gerechneter Ähnlichkeit; drei Blöcke 30/45/25 (Koordinator) bzw. 30/15/55 (Positionscoach). Wirkung noch offen — siehe [`umbau-coaches.md`](umbau-coaches.md) |
| Rosterzahl | nach dem Profilanteil der **Zielposition**, nie nach der Ausrichtung des Vereins. Damit liest ein Mann auf seinem Hauptplatz wieder genau seine Stärke, und der Taktikregler bewertet keine Spieler um |
| Körperkorridore | breit, weil das keine Profiliga ist: Line 40–45 kg, Skill 18–28. Die **Reihenfolge der Mitten** ist das Modell, nicht die Breite — NT 137,5 · T 131 · G 126 · DT 125 · C 124 · DE 112,5 · FB/MIKE 106 · TE 105 · SAM 100 · WILL/QB 92 · SS 89 · RB 88 · FS 84 · WR 83 · CB 80 · SL 77 |
| Drei Abstände mit Absicht | MIKE über SAM (sie trugen einmal denselben Korridor) · DE klar über beiden Linebackern (er lag einmal ein Kilo darüber, „Edge" war körperlich kein Begriff) · DT über C (er lag einmal unter der ganzen O-Line). Ein Test in `positionen.test.js` hält alle drei fest |
| NT-Größe | der **kürzeste** der großen Männer, Mitte 185 cm unter SAM, G und DT. Hebel kommt von unten; ein langer Nose Tackle ist ein schlechter |
| Körpergrenzen | `GEWICHT_MIN` 58 und `GEWICHT_MAX` 185 sind **aus den Korridoren gerechnet**, nicht rund gewählt: ein Fünftel der Spieler wird absichtlich außerhalb gezogen, und ein Rand auf einer Grenze erzeugt dort keinen Ausläufer, sondern einen Stapel. Wer die Korridore ändert, rechnet beide neu — ein Test tut es mit |
| Gutschriftschranke | `KOERPERMALUS_GUTSCHRIFT_ANTEIL` = 0,5: die Körper-Gutschrift nimmt höchstens die Hälfte des linearen Malus weg. Unbeschränkt hob sie ihn ab 16,7 kg Übergewicht ganz auf, abstandsunabhängig, weil beide Summanden linear im Abstand sind |
| Linebacker im Laufspiel | MIKE und SAM haben `beweglichkeit` (und SAM `schnelligkeit`) in der Laufformel. Ohne sie bestand ihre Formel aus denselben vier Attributen wie die des Nose Tackle, und ein Sam war ein kleiner Nose Tackle. Was den Linebacker vom Lineman trennt, ist nicht Kraft, sondern dass er läuft |
| Formeln wirken zweimal | eine Änderung an `FORMELN` ändert die Bewertung **und** die Ziehung, weil `generierungsProfil()` daraus kommt. Das ist der Hebel, nicht der Nebeneffekt: der Sam bekommt echte Beweglichkeit statt der Bodenplatte und zugleich weniger Kraft |
