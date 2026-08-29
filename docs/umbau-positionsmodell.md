# Umbau: Positionsmodell, Attribute und Lauf/Pass

Das ist der vollständige Bauplan für Block 2 aus [`naechste-schritte.md`](naechste-schritte.md)
— Formationen, Positionswerte und die Trennung von Lauf- und Passspiel.

**Diese Datei ist die einzige Quelle für den Umbau.** Sie ist in sieben Inkremente
geschnitten, die einzeln umsetzbar sind: ein Inkrement pro Sitzung, ohne dass die
Diskussion dahinter noch einmal geführt werden muss. Jedes Inkrement lässt das Spiel
lauffähig und die Tests grün.

Die Leitplanken aus `naechste-schritte.md` gelten unverändert: kein Build, `engine/`
fasst kein DOM an, sichtbare Texte nur in `i18n.js`, Zufall wird injiziert, Tests mit
`node --test tests/*.test.js` vor und nach jeder Änderung.

---

## 1 — Der Positionskatalog

Aus fünf Offense- und drei Defense-Positionen werden **achtzehn**. Begründung: die
Trennung jetzt zu machen ist billiger, als sie später aus jeder Formel und jeder
Tabelle wieder herauszuoperieren.

| Offense | | Defense | |
| --- | --- | --- | --- |
| `QB` | Quarterback | `DE` | Defensive End |
| `RB` | Runningback | `DT` | Defensive Tackle |
| `FB` | Fullback | `NT` | Nose Tackle |
| `WR` | Receiver außen | `MLB` | Middle Linebacker |
| `SL` | Slot-Receiver | `SAM` | Outside Linebacker, starke Seite |
| `TE` | Tight End | `WILL` | Outside Linebacker, schwache Seite |
| `T` | Tackle | `CB` | Cornerback |
| `G` | Guard | `FS` | Free Safety |
| `C` | Center | `SS` | Strong Safety |

`K` und `P` entfallen ersatzlos aus dem Katalog — gekickt wird weiter aus dem ganzen
Kader über `kickStaerke` und `kickGenauigkeit`, wie in der Kick-Vorstufe entschieden.

### Die Seite ist ein Platz, keine Position

Links und rechts verdoppeln den Katalog **nicht**. Der Katalog kennt `T`, `G`, `DE`,
`CB`, `WR`; die Aufstellung kennt die Plätze `LT`, `RT`, `LG`, `RG`, `LDE`, `RDE`,
`LCB`, `RCB`. Ein Spieler ist auf einem Platz ausgebildet und verliert auf der anderen
Seite einen Teil seines Technikwerts — mehr dazu in Abschnitt 4.

---

## 2 — Attribute

Jeder Spieler trägt **fünfzehn Attribute** plus die beiden Kickwerte, die es schon gibt.
Alle auf derselben Skala wie `staerke` (1 … `LIGA_MAX_STAERKE`).

| Attribut | Was es misst |
| --- | --- |
| `schnelligkeit` | Tempo geradeaus |
| `beweglichkeit` | Richtungswechsel, Explosivität |
| `kraft` | Wucht, hängt an Größe und Gewicht |
| `ausdauer` | Wie lange er durchhält — trägt den Doppeleinsatz-Abzug |
| `robustheit` | Verletzungsanfälligkeit — trägt das Doppeleinsatz-Risiko |
| `fangen` | Den Ball fangen |
| `ballsicherheit` | Ihn behalten |
| `routeRunning` | Freilaufen |
| `werfen` | Weite und Genauigkeit des Wurfs |
| `blocken` | Blocken |
| `passrush` | Am Blocker vorbei zum Quarterback |
| `tacklen` | Den Ballträger stoppen |
| `coverage` | Deckung |
| `spielverstaendnis` | Lesen, Stellungsspiel — steigt später mit dem Alter |
| `technik` | Positionsgebundenes Handwerk, siehe Abschnitt 4 |
| `kickStaerke` · `kickGenauigkeit` | bestehen bereits, unverändert |

`staerke` **bleibt vorerst die Führungsgröße**: die Attribute werden um sie herum
gezogen, das Depth Chart sortiert weiter nach ihr, die Anzeige zeigt sie weiter. Der
Wechsel zur berechneten Stärke ist ausdrücklich ein späterer, eigener Schritt.

### Körper

Größe und Gewicht sind **echte Daten am Spieler**, keine Attribute — sie stehen im
Kaderscreen als „1,88 m · 96 kg" und `kraft` sowie `schnelligkeit` werden an sie
gebunden. Jede Position hat einen Korridor:

| Position | Größe | Gewicht | | Position | Größe | Gewicht |
| --- | --- | --- | --- | --- | --- | --- |
| `QB` | 1,78–1,95 m | 85–100 kg | | `DE` | 1,85–1,98 m | 100–120 kg |
| `RB` | 1,72–1,85 m | 82–98 kg | | `DT` | 1,83–1,95 m | 115–140 kg |
| `FB` | 1,75–1,88 m | 95–112 kg | | `NT` | 1,80–1,93 m | 125–150 kg |
| `WR` | 1,75–1,90 m | 78–92 kg | | `MLB` | 1,80–1,92 m | 100–118 kg |
| `SL` | 1,70–1,83 m | 75–88 kg | | `SAM` | 1,83–1,93 m | 100–118 kg |
| `TE` | 1,85–1,98 m | 95–115 kg | | `WILL` | 1,78–1,88 m | 90–105 kg |
| `T` | 1,85–2,00 m | 110–140 kg | | `CB` | 1,72–1,85 m | 75–90 kg |
| `G` | 1,80–1,95 m | 105–135 kg | | `FS` | 1,78–1,88 m | 82–95 kg |
| `C` | 1,80–1,92 m | 100–125 kg | | `SS` | 1,80–1,90 m | 88–102 kg |

**Etwa ein Fünftel der Spieler steht neben seinem Korridor** — der 95-Kilo-Tackle, der
schwere Receiver. Wer daneben liegt, hat die Werte dazu: der leichte Tackle ist
beweglich, aber schwach. Die Korridore sind das Ideal, nicht die Regel.

### Reihenfolge bei der Generierung

1. Position steht fest (aus der Kaderform).
2. Körper ziehen: mit 80 % aus dem Korridor, mit 20 % deutlich daneben.
3. Attribute ziehen: das **Generierungsprofil** der Position (siehe unten) gibt die
   Schwerpunkte vor, der Körper begrenzt `kraft` und `schnelligkeit` gegenläufig, die
   Streuung liegt darum herum.
4. Skalieren, bis die Positionsformel wieder ungefähr `staerke` ergibt.

### Das Generierungsprofil ist nicht das Mittel der beiden Formeln

Eine Position hat zwei Formeln (Abschnitt 3), aber **nur ein** Profil, nach dem ihre
Spieler gezogen werden. Dieses Profil ist der nach Spielart gewichtete Mittelwert der
beiden Formeln — gewichtet danach, **wo die Position ihren Wert verdient**:
Blockgewicht × Platzanteil aus Abschnitt 6.

Der einfache Mittelwert wäre falsch: die Laufformel eines Receivers ist `blocken 50`,
weil er im Laufspiel blockt. Gemittelt wäre Blocken sein größtes Attribut und jeder
Receiver würde als Top-Blocker generiert.

| Position | Beitrag Pass | Beitrag Lauf | Profil zieht |
| --- | --- | --- | --- |
| `QB` | 0,400 | 0,200 | 67 % Pass |
| `RB` | 0,053 | 0,120 | 69 % Lauf |
| `FB` | 0,035 | 0,100 | 74 % Lauf |
| `WR` | 0,105 | 0,040 | 72 % Pass |
| `SL` | 0,088 | 0,060 | 59 % Pass |
| `TE` | 0,070 | 0,080 | 53 % Lauf |
| `T` | 0,063 | 0,076 | 55 % Lauf |
| `G` | 0,045 | 0,096 | 68 % Lauf |
| `C` | 0,035 | 0,056 | 62 % Lauf |
| `DE` | 0,112 | 0,092 | 55 % Pass |
| `DT` | 0,070 | 0,104 | 60 % Lauf |
| `NT` | 0,056 | 0,112 | 67 % Lauf |
| `MLB` | 0,080 | 0,160 | 67 % Lauf |
| `SAM` | 0,058 | 0,140 | 71 % Lauf |
| `WILL` | 0,113 | 0,100 | 53 % Pass |
| `CB` | 0,120 | 0,034 | 78 % Pass |
| `FS` | 0,100 | 0,052 | 66 % Pass |
| `SS` | 0,060 | 0,080 | 57 % Lauf |

Die Skill-Beiträge nehmen den mittleren Platz der Leiter an, den die Position typisch
belegt (Pass `WR > SL > TE > RB > FB`, Lauf `RB > FB > TE > SL > WR`).

---

## 3 — Positionsformeln

Jede Position hat **zwei** Formeln: einen Laufwert und einen Passwert. Alle Anteile in
Prozent, jede Spalte summiert auf 100.

### Offense

| Position | Passspiel | Laufspiel |
| --- | --- | --- |
| `QB` | werfen 40 · spielverstaendnis 25 · technik 15 · beweglichkeit 10 · ballsicherheit 10 | schnelligkeit 30 · beweglichkeit 25 · spielverstaendnis 15 · ballsicherheit 10 · technik 10 · kraft 10 |
| `RB` | blocken 30 · fangen 25 · technik 15 · routeRunning 10 · beweglichkeit 10 · ballsicherheit 10 | schnelligkeit 25 · beweglichkeit 25 · kraft 20 · ballsicherheit 15 · technik 15 |
| `FB` | blocken 45 · kraft 20 · fangen 20 · technik 15 | blocken 35 · kraft 30 · technik 15 · ballsicherheit 10 · beweglichkeit 10 |
| `WR` | fangen 28 · routeRunning 22 · schnelligkeit 18 · beweglichkeit 12 · technik 10 · ballsicherheit 10 | blocken 50 · schnelligkeit 20 · kraft 15 · technik 15 |
| `SL` | routeRunning 28 · fangen 22 · beweglichkeit 22 · technik 10 · schnelligkeit 9 · ballsicherheit 9 | blocken 40 · beweglichkeit 20 · technik 20 · schnelligkeit 20 |
| `TE` | fangen 30 · routeRunning 20 · beweglichkeit 15 · technik 15 · kraft 10 · ballsicherheit 10 | blocken 45 · kraft 25 · technik 20 · beweglichkeit 10 |
| `T` | blocken 45 · beweglichkeit 20 · technik 20 · kraft 15 | blocken 45 · kraft 30 · technik 15 · beweglichkeit 10 |
| `G` | blocken 40 · kraft 35 · technik 20 · beweglichkeit 5 | kraft 40 · blocken 35 · technik 20 · beweglichkeit 5 |
| `C` | blocken 40 · kraft 30 · spielverstaendnis 15 · technik 15 | kraft 35 · blocken 35 · technik 20 · spielverstaendnis 10 |

### Defense

| Position | Passspiel | Laufspiel |
| --- | --- | --- |
| `DE` | passrush 45 · beweglichkeit 25 · technik 20 · kraft 10 | tacklen 30 · kraft 25 · technik 20 · spielverstaendnis 15 · beweglichkeit 10 |
| `DT` | passrush 35 · kraft 30 · technik 20 · beweglichkeit 15 | kraft 35 · tacklen 25 · technik 20 · spielverstaendnis 20 |
| `NT` | kraft 45 · passrush 25 · technik 20 · beweglichkeit 10 | kraft 50 · tacklen 20 · technik 15 · spielverstaendnis 15 |
| `MLB` | spielverstaendnis 28 · coverage 20 · passrush 14 · technik 15 · kraft 13 · schnelligkeit 10 | tacklen 32 · kraft 28 · spielverstaendnis 25 · technik 15 |
| `SAM` | passrush 28 · coverage 22 · spielverstaendnis 20 · technik 15 · schnelligkeit 15 | tacklen 33 · kraft 27 · technik 20 · spielverstaendnis 20 |
| `WILL` | coverage 36 · schnelligkeit 22 · spielverstaendnis 18 · beweglichkeit 14 · technik 10 | tacklen 26 · schnelligkeit 26 · spielverstaendnis 17 · beweglichkeit 16 · technik 15 |
| `CB` | coverage 32 · schnelligkeit 22 · beweglichkeit 18 · technik 10 · spielverstaendnis 9 · fangen 9 | tacklen 34 · schnelligkeit 21 · spielverstaendnis 17 · technik 15 · kraft 13 |
| `FS` | coverage 27 · spielverstaendnis 27 · schnelligkeit 18 · fangen 18 · technik 10 | spielverstaendnis 34 · tacklen 30 · schnelligkeit 21 · technik 15 |
| `SS` | spielverstaendnis 27 · coverage 27 · tacklen 18 · schnelligkeit 18 · technik 10 | tacklen 34 · spielverstaendnis 21 · kraft 17 · technik 15 · schnelligkeit 13 |

**`technik` steht in jeder Formel** — 15 % im Laufspiel, 10 % im Passspiel dort, wo es
sonst fehlen würde, bei den Linemen 20 %. Der Anteil ist der Träger des
Umstellungsabschlags: ohne ihn kostet eine Umstellung nichts.

**`MLB` und `SAM` sind bewusst physisch geschnitten**, `WILL` bewusst athletisch. Die
drei Linebacker sollen auseinanderliegen — MLB und SAM als Brücke zur Line, WILL als
Brücke zur Secondary. Standen alle drei in der Mitte, landete jeder von ihnen bei den
Safeties, und der Quarterback fand seine beste Alternative als Middle Linebacker. Der
`passrush 14` beim MLB ist dabei kein Beiwerk: ohne ihn bleibt die DE-Passformel
(45 % Rush) für einen Mike unerreichbar.

---

## 4 — Was eine Umstellung kostet

`technik` ist an den **Platz** gebunden, auf dem der Spieler ausgebildet wurde. Wer
woanders spielt, behält nur einen Teil davon. Damit entsteht der Umstellungsabschlag
aus dem Modell selbst — es braucht keine Strafe von außen.

### Die Stufenleiter (moderat)

| Fall | Technik bleibt |
| --- | --- |
| Derselbe Platz | 100 % |
| Andere Seite derselben Position | je Position, siehe unten |
| Nachbarposition derselben Gruppe | 70 % |
| Andere Gruppe derselben Einheit | 45 % |
| Andere Einheit (Offense ↔ Defense) | 25 % |

### Seitenwechsel je Position

Nur Positionen mit zwei Seiten. Der Wert ist bewusst positionsabhängig: außen in der
Line ist die Seite Gewöhnungssache, in der Secondary nicht.

| Position | Seitenwechsel kostet |
| --- | --- |
| `CB` | 100 % — nichts, die beiden Seiten sind gleich |
| `WR` | 100 % |
| `DE` | 98 % |
| `G` | 92 % |
| `T` | 90 % |

### Gruppen

| Gruppe | Positionen |
| --- | --- |
| Line Offense | `T` `G` `C` |
| Backfield | `RB` `FB` |
| Empfänger | `WR` `SL` `TE` |
| Quarterback | `QB` (allein) |
| Line Defense | `DE` `DT` `NT` |
| Linebacker | `MLB` `SAM` `WILL` |
| Secondary | `CB` `FS` `SS` |

Beispiel: ein auf `LT` ausgebildeter Spieler behält auf `RT` 90 % seiner Technik, auf
`LG` 70 %, auf `TE` 45 % und auf `DE` 25 %.

**Es zählt der Technikanteil der Zielposition, nicht der Ausgangsposition** — dem
Spieler fehlt das Handwerk des Platzes, auf dem er steht. Ein Wechsel auf eine
technikarme Position (Secondary, 13 %) ist deshalb strukturell billiger als einer auf
die Line (20 %).

```
Technikkosten = Technikanteil der ZIELformel  x  (1 - Transferfaktor)
```

| Stufe | Verlust | bei Technikanteil 10–20 % |
| --- | --- | --- |
| Andere Seite | 0–10 % | 0 – 2 % |
| Gleiche Gruppe | 30 % | 3 – 6 % |
| Andere Gruppe, gleiche Einheit | 55 % | 5,5 – 11 % |
| Andere Einheit | 75 % | 7,5 – 15 % |

### Der Körpermalus

Die Technik allein reicht nicht: ein 137-Kilo-Mann kann keinen Cornerback spielen, auch
wenn sein Tackling stimmt. Deshalb kommt ein zweiter Abschlag dazu, aus dem
Gewichtsabstand der Korridormitten aus Abschnitt 2:

```
Körpermalus = min(20 %, |kg(A) - kg(B)| x 0,4 %)
```

| | | | | | | |
| --- | --- | --- | --- | --- | --- | --- |
| `SL` 81,5 | `CB` 82,5 | `WR` 85 | `FS` 88,5 | `RB` 90 | `QB` 92,5 | `SS` 95 |
| `WILL` 97,5 | `FB` 103,5 | `TE` 105 | `MLB` 109 | `SAM` 109 | `DE` 110 | `C` 112,5 |
| `G` 120 | `T` 125 | `DT` 127,5 | `NT` 137,5 | | | |

Damit entstehen die groben Körperbänder von selbst — die Leichten bis 97, die Mitte
103–113, die Schweren ab 120 — ohne dass sie eigens gepflegt werden müssten. Der Satz
von 0,4 % je Kilo ist die tragende Stellschraube: bei 0,3 % ist ein Middle Linebacker
wieder eher Safety als Defensive End. Wer den Umbau milder will, senkt den **Deckel**,
nicht den Satz.

### Was das ergibt

Die Kosten setzen sich aus drei Teilen zusammen: **Profil-Mismatch** (die Attribute des
Spielers gegen die Formel der Zielposition), **Technikverlust** und **Körpermalus**.
Die folgenden Werte sind das Mittel aus Lauf- und Passverlust und dienen dem Balancing
als Sollwert — weicht die Implementierung deutlich ab, stimmt etwas nicht.

| Stufe | Wechsel | Schnitt | Spanne |
| --- | --- | --- | --- |
| Innerhalb der Gruppe | 32 | 13,5 % | 2 – 26 % |
| Andere Gruppe, gleiche Einheit | 112 | 26,5 % | 4 – 44 % |
| Über die Einheiten hinweg | 162 | 35,6 % | 21 – 51 % |
| **Alle 306 Wechsel** | | **29,9 %** | |

Je Position die fünf billigsten Nebenpositionen:

| Position | Schnitt | 1. | 2. | 3. | 4. | 5. | teuerste |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `QB` | 31,3 % | FS 21,4 | WILL 21,9 | SS 23,6 | RB 24,7 | CB 26,8 | NT 43,1 |
| `RB` | 24,8 % | WR 12,8 | SL 13,4 | FB 13,5 | QB 15,7 | TE 19,1 | DT 36,8 |
| `FB` | 29,1 % | C 11,4 | G 12,9 | T 14,7 | TE 18,0 | RB 22,9 | FS 40,2 |
| `WR` | 29,9 % | SL 6,5 | RB 13,8 | TE 17,2 | FB 21,0 | CB 24,8 | NT 47,4 |
| `SL` | 32,6 % | WR 9,5 | RB 16,6 | TE 19,9 | FB 24,7 | QB 26,3 | NT 50,7 |
| `TE` | 25,5 % | FB 4,2 | C 9,8 | G 10,4 | T 11,2 | WR 16,7 | FS 38,7 |
| `T` | 33,3 % | G 8,0 | C 12,4 | FB 18,4 | TE 26,6 | NT 31,1 | FS 46,3 |
| `G` | 34,4 % | T 9,7 | C 10,3 | FB 18,3 | TE 27,7 | NT 28,3 | FS 48,7 |
| `C` | 31,3 % | G 7,3 | T 11,6 | FB 14,5 | TE 24,8 | NT 30,3 | CB 43,4 |
| `DE` | 29,6 % | DT 14,0 | NT 17,3 | MLB 19,9 | SAM 20,0 | SS 28,2 | WR 40,5 |
| `DT` | 30,2 % | NT 5,0 | DE 17,2 | MLB 20,8 | G 23,0 | SAM 24,0 | SL 46,6 |
| `NT` | 35,0 % | DT 14,5 | G 26,1 | DE 26,3 | MLB 27,7 | C 28,6 | SL 48,3 |
| `MLB` | 26,7 % | SAM 9,0 | SS 14,0 | DE 19,7 | NT 19,7 | WILL 20,0 | SL 44,7 |
| `SAM` | 24,9 % | MLB 2,2 | SS 11,5 | DE 15,8 | WILL 17,4 | DT 17,4 | SL 43,3 |
| `WILL` | 30,4 % | SS 11,6 | FS 12,6 | CB 15,7 | MLB 19,3 | SAM 19,9 | G 45,8 |
| `CB` | 28,5 % | FS 6,7 | WILL 9,2 | SS 11,2 | QB 21,8 | SL 22,3 | G 44,1 |
| `FS` | 31,6 % | SS 9,8 | CB 12,8 | WILL 14,7 | MLB 22,5 | QB 23,7 | T 47,6 |
| `SS` | 29,5 % | FS 8,6 | WILL 13,9 | CB 14,6 | MLB 16,7 | SAM 19,9 | T 43,9 |

Drei Eigenschaften, die das Modell haben soll und hier nachweisbar hat:

- **Die Umstellung ist unsymmetrisch.** `TE → T` kostet 11,2 %, `T → TE` 26,6 %. Ein
  Tight End kann Tackle spielen, ein Tackle keinen Tight End.
- **Der Quarterback ist eine Insel.** Seine billigste Alternative kostet 21,4 %, und
  niemand kommt billig zu ihm. Ein verletzter Quarterback ist ein echtes Problem.
- **Innerhalb einer Gruppe trägt die Technik fast den ganzen Preis** — bei `T → G` sind
  5,2 von 8,0 Punkten Technik. Profil und Körper wirken erst über größere Distanzen.

*(Die Werte stammen aus einem Modell, das den Spieler zu 40 % auf sein Profil
spezialisiert annimmt und Lauf- und Passverlust 50/50 mittelt. Deshalb sieht `RB → QB`
mit 15,7 % zu billig aus — die Laufhälfte des Quarterbacks kann ein Runningback ja. Im
Spiel selbst gewichtet die Simulation nach dem Passanteil des Vereins, dort passiert das
Richtige.)*

---

## 5 — Formationen

### Offense: elf Plätze

Fünf Linemen, ein Quarterback, fünf Skill-Plätze. Die fünf Skill-Plätze kommen aus der
Personnel-Gruppierung; **jede Gruppierung listet ihre Plätze ausdrücklich**, damit sich
eine Formation einzeln nachjustieren lässt.

| Gruppierung | Name | Die fünf Skill-Plätze |
| --- | --- | --- |
| `00` | Empty | `SL` `SL` `SL` `WR` `WR` |
| `01` | Empty mit TE | `TE` `SL` `SL` `WR` `WR` |
| `10` | Spread | `RB` `SL` `WR` `WR` `SL` |
| `11` | Standard | `RB` `TE` `WR` `WR` `SL` |
| `12` | | `RB` `TE` `TE` `WR` `WR` |
| `20` | | `RB` `FB` `WR` `WR` `SL` |
| `21` | | `RB` `FB` `TE` `WR` `WR` |
| `32` | Double Wing | `RB` `FB` `FB` `TE` `TE` |

Die feste Linie dazu: `LT` `LG` `C` `RG` `RT` und `QB`.

### Defense: 4-3 als Grundformation

`LDE` `DT` `NT` `RDE` · `MLB` `SAM` `WILL` · `LCB` `RCB` `FS` `SS`

4-4, 3-3 und 3-4 kommen später und benutzen denselben Platz-Apparat.

### Wer welches System spielt

- Jeder Verein bekommt seine Gruppierung bei der Kadergenerierung **ausgelost**, aus
  `makeRng(seed + '|personnel')`. Damit lässt sich ein fehlendes Feld deterministisch
  nachziehen, ohne Versionssprung.
- Das System bleibt über die Saisons hinweg — ein Verein hat eine Spielphilosophie.
- **Der Manager wählt seines jederzeit** in der Taktik-Ansicht; die Änderung gilt ab
  dem nächsten Spieltag.

---

## 6 — Lauf und Pass

### Ausrichtung

Jeder Verein hat einen **Passanteil**. Die Personnel-Gruppierung schlägt ihn vor, der
Manager verschiebt ihn um bis zu ±0,20:

| Gruppierung | `00` | `01` | `10` | `11` | `12` | `20` | `21` | `32` |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Passanteil | 0,85 | 0,80 | 0,70 | 0,60 | 0,45 | 0,50 | 0,40 | 0,20 |

*(Diese Zahlen sind ein Vorschlag und stehen unter Abschnitt 12, Nr. 3.)*

### Blockgewichte

| Angriff | Pass | Lauf |
| --- | --- | --- |
| Quarterback | 0,40 | 0,20 |
| Offensive Line | 0,25 | 0,40 |
| Die fünf Skill-Plätze | 0,35 | 0,40 |

| Verteidigung | Pass | Lauf |
| --- | --- | --- |
| Defensive Line | 0,35 | 0,40 |
| Linebacker | 0,25 | 0,40 |
| Secondary | 0,40 | 0,20 |

### Anteile innerhalb der Blöcke

**Skill-Leiter** — Anteile am Skill-Block, nach der Platzreihenfolge der Gruppierung.
Im Passspiel wird die Liste nach `WR > SL > TE > RB > FB` sortiert, im Laufspiel nach
`RB > FB > TE > SL > WR`; dann greift die Leiter:

| Platz | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- |
| Anteil | 30 % | 25 % | 20 % | 15 % | 10 % |

**Offensive Line**

| | `LT` | `RT` | `LG` | `RG` | `C` |
| --- | --- | --- | --- | --- | --- |
| Pass | 25 % | 25 % | 18 % | 18 % | 14 % |
| Lauf | 19 % | 19 % | 24 % | 24 % | 14 % |

**Defensive Line**

| | `LDE` | `RDE` | `DT` | `NT` |
| --- | --- | --- | --- | --- |
| Pass | 32 % | 32 % | 20 % | 16 % |
| Lauf | 23 % | 23 % | 26 % | 28 % |

**Linebacker**

| | `MLB` | `SAM` | `WILL` |
| --- | --- | --- | --- |
| Pass | 32 % | 23 % | 45 % |
| Lauf | 40 % | 35 % | 25 % |

**Secondary**

| | `LCB` | `RCB` | `FS` | `SS` |
| --- | --- | --- | --- | --- |
| Pass | 30 % | 30 % | 25 % | 15 % |
| Lauf | 17 % | 17 % | 26 % | 40 % |

### In der Simulation

Aus einem Angriffswert werden zwei, aus einem Verteidigungswert werden zwei. Die
erwarteten Punkte mischen beide Duelle nach dem Passanteil des angreifenden Vereins:

```
vorteil = passAnteil        * (passAngriff - passVerteidigungGegner)
        + (1 - passAnteil)  * (laufAngriff - laufVerteidigungGegner)

erwartet = BASE_POINTS + RATING_TO_POINTS * vorteil   (+ HOME_ADVANTAGE)
```

Alles Übrige in `engine/spiel.js` — Rauschen, Grenzen, Verlängerung — bleibt
unverändert. Special Teams bleiben eine Zahl aus `kickStaerke` und `kickGenauigkeit`.

---

## 7 — Aufstellung

Die Kernfunktion des Umbaus. Sie füllt **beide Einheiten in einem Durchgang** und
führt dabei ein `benutzt`-Set, damit ein Doppeleinsatz eine bewusste Ausnahme bleibt.

```
stelleAuf(kader, personnel, passAnteil, spieltag)
  -> { offense: Platz[], defense: Platz[], k, p }

Platz = { platz: 'LT', position: 'T', spieler, umgestellt: boolean, doppel: boolean }
```

Regeln:

1. **Innerhalb einer Position entscheidet `staerke`**, wie heute — der stärkste fitte
   Tackle steht auf `LT`. (Dass der Manager später selbst aufstellt, ist ein eigener
   Schritt.)
2. **Ist eine Position leer, rückt der mit der besten berechneten Eignung** für diesen
   Platz nach — über alle freien Spieler, quer durch den Kader. Die fehlende Technik
   ist der Abschlag; eine zweite Regel braucht es nicht.
3. **Ein Platz bleibt nie leer.** `ERSATZ_STAERKE` entfällt als Notnagel. Nur der
   buchstäblich leere Kader behält einen Notwert, damit `teamStaerken([])` definiert
   bleibt.
4. **Doppeleinsatz** (derselbe Mann in Offense und Defense) ist erlaubt, aber teuer —
   siehe unten. K und P laufen außerhalb dieser Rechnung und dürfen immer doppelt.

### Der Preis des Doppeleinsatzes — hart

| `ausdauer` | Abzug in der zweiten Einheit |
| --- | --- |
| 80 und mehr | −15 % |
| 50 | −28 % |
| 20 | −40 % |

| `robustheit` | Verletzungsrisiko |
| --- | --- |
| 80 und mehr | ×2,0 |
| 50 | ×3,0 |
| 20 | ×4,0 |

Dazwischen wird linear interpoliert. Doppeleinsatz ist damit ein Notnagel, kein
Werkzeug — und Kadertiefe wird zum wichtigsten Gut.

---

## 8 — Kaderform und Nummern

### Kaderform des eigenen Vereins: 30 Mann

| Offense | | Defense | |
| --- | --- | --- | --- |
| `QB` | 2 | `DE` | 2 |
| `RB` | 2 | `DT` | 2 |
| `FB` | 1 | `NT` | 1 |
| `WR` | 4 | `MLB` | 2 |
| `SL` | 2 | `SAM` | 1 |
| `TE` | **0** | `WILL` | 1 |
| `T` | 2 | `CB` | 3 |
| `G` | 2 | `FS` | 1 |
| `C` | 1 | `SS` | 1 |
| **16** | | **14** | |

**Tight End bleibt bei null.** Der eigene Verein hat keinen ausgebildeten Tight End und
muss umstellen, wenn sein System einen verlangt — das ist Teil der Ausgangslage „der
Verein fängt unten an".

### Zusatzspieler der fremden Vereine

`ZUSATZ_SPIELER` = 5, gewichtet gezogen, höchstens zwei je Position
(`ZUSATZ_MAX_JE_POSITION`). Tiefe dort, wo viele Snaps und viele Verletzungen
zusammenkommen — Line, Receiver, Secondary:

| | | | | | |
| --- | --- | --- | --- | --- | --- |
| `QB` 1 | `RB` 3 | `FB` 2 | `WR` 5 | `SL` 3 | `TE` 4 |
| `T` 5 | `G` 4 | `C` 2 | `DE` 5 | `DT` 4 | `NT` 2 |
| `MLB` 3 | `SAM` 3 | `WILL` 3 | `CB` 5 | `FS` 2 | `SS` 2 |

Die `TE` 4 ist Absicht: der eigene Verein hat keinen, die anderen sollen regelmäßig
einen haben. Der Nachteil ist bezifferbar — ein umgestellter Receiver auf dem TE-Platz
kostet 17 % (Abschnitt 4) auf einem von fünf Skill-Plätzen, in der Größenordnung ein
Prozent Angriffsstärke.

### Nummernbänder — grob nach Gruppen wie heute

| Positionen | Band |
| --- | --- |
| `QB` | 1–19 |
| `RB` `FB` | 20–49 |
| `WR` `SL` | 10–19, 80–89 |
| `TE` | 40–49, 80–89 |
| `T` `G` `C` | 50–79, **nie einstellig** |
| `DE` `DT` `NT` | 50–79, 90–99 |
| `MLB` `SAM` `WILL` | 40–59, 90–99 |
| `CB` `FS` `SS` | 20–49 |

Die Regeln „0–9 sind echte Nummern", „5–9 gehen an die zwölf besten Nicht-Linemen" und
„Fehlerfall wirft" bleiben unverändert.

---

## 9 — Speicherstand

**`SAVE_VERSION` 4, Stände vor v4 werden abgelehnt.** Ein v3-Stand kennt fünf
Offense-Positionen und keine Attribute; ein gültiger Kader ließe sich daraus nur durch
Erfinden gewinnen. Das ist dieselbe Begründung, mit der v2 beim Ligaumbau abgelehnt
wurde. `STORAGE_KEY` wird `bayernliga.save.v4`.

Neu im Zustand:

```
personnel:  Record<teamId, '00'|'01'|'10'|'11'|'12'|'20'|'21'|'32'>
passAnteil: Record<teamId, number>     // 0..1, Vorschlag aus personnel, vom Manager verschiebbar
```

---

## 10 — UI

- **Neue Ansicht „Taktik"** neben Kader, Spielplan und Tabelle: Auswahl der
  Personnel-Gruppierung, Regler für den Passanteil, daneben die Auswirkung auf Lauf-
  und Passstärke. Später kommt hier die Defense-Formation dazu.
- **Kaderscreen**: Lauf- und Passstärke statt einer Angriffszahl; die Aufstellung mit
  Platz, Spieler und Umstellungsmarkierung; Größe und Gewicht in der Kaderliste.
- **Attribute**: beim eigenen Kader offen, bei fremden Vereinen nur die Gesamtstärke.
- Alle Texte nach `i18n.js`, deutsch, UTF-8 ohne BOM.
- `vis.html` bekommt `?v=taktik`.

---

## 11 — Die Inkremente

Jedes Inkrement ist eine Sitzung wert und lässt das Spiel lauffähig. Erledigte
sind hier abgehakt; die Ligastärken nach jedem Schritt stehen in
[`baseline-staerken.md`](baseline-staerken.md).

### Inkrement 1 — Positionskatalog und Kader ✅ fertig
`engine/constants.js`, `engine/spieler.js`, `engine/save.js`, `engine/team.js`, Tests.

18 Positionen, neue Kaderform, neue Zusatzgewichte, neue Nummernbänder, Generierung,
`SAVE_VERSION` 4. `teamStaerken()` rechnet in diesem Schritt **provisorisch über
Positionsgruppen** (alle `T`/`G`/`C` als Line, alle `CB`/`FS`/`SS` als Secondary), damit
Simulation und Tests grün bleiben. Fertig, wenn ein Kader gezogen wird, jede Position
besetzt ist und die Nummern kollisionsfrei sind.

### Inkrement 2 — Attribute und Körper
`engine/constants.js`, `engine/spieler.js`, Tests.

15 Attribute, Körperkorridore, das Fünftel daneben, die Ziehreihenfolge aus Abschnitt 2.
Noch keine Wirkung auf die Simulation. Fertig, wenn jeder Spieler alle Werte trägt,
reproduzierbar beim selben Seed, und ein Lineman nie schnell und leicht ist.

### Inkrement 3 — Positionsformeln
Neu: `engine/positionen.js`. Tests.

Die Tabellen aus Abschnitt 3 als Daten, dazu `eignung(spieler, platz, art)` mit dem
Technik-Transfer **und** dem Körpermalus aus Abschnitt 4. Fertig, wenn ein TE auf `T`
messbar besser ist als ein WR auf `T`, ein CB die Seite kostenlos wechselt und die
Kosten der Umstellung ungefähr die Tabelle aus Abschnitt 4 treffen — die ist der
Sollwert.

### Inkrement 4 — Aufstellung
Neu: `engine/aufstellung.js`. `engine/team.js` wird umgebaut. Tests.

Personnel-Katalog, Plätze, `stelleAuf()`, Doppeleinsatz, `ERSATZ_STAERKE` entfällt.
`teamStaerken()` liefert ab hier `laufAngriff`, `passAngriff`, `laufVerteidigung`,
`passVerteidigung`, `special`. Fertig, wenn kein Platz je leer ist und dieselben elf
Leute in verschiedenen Systemen unterschiedliche, aber plausible Werte ergeben.

### Inkrement 5 — Lauf und Pass in der Simulation
`engine/spiel.js`, Tests.

Die Formel aus Abschnitt 6. Fertig, wenn ein Laufteam gegen eine schwache
Laufverteidigung messbar mehr punktet als gegen eine starke.

### Inkrement 6 — Zustand und Taktik
`engine/saison.js`, `engine/save.js`, Tests.

`personnel` und `passAnteil` im Zustand, Auslosung, deterministisches Nachziehen,
Wechsel gilt ab dem nächsten Spieltag. Fertig, wenn ein Export/Import die Taktik
mitnimmt.

### Inkrement 7 — UI
`ui/taktik.js` (neu), `ui/kader.js`, `app.js`, `i18n.js`, `app.css`, `vis.html`.

Abschnitt 10. Fertig, wenn die Taktik-Ansicht schaltet und der Kaderscreen Aufstellung,
Umstellungen und Körperdaten zeigt.

### Vor und nach dem Umbau

Vor Inkrement 1 die Gesamtstärken aller zwölf Vereine mit gepinntem Seed protokollieren
und nach jedem Inkrement vergleichen. Der Umbau darf die Liga verschieben — aber nicht
unbemerkt.

---

## 12 — Offene Punkte

1. **Der Tight End generiert sich als Blocker.** Mit `blocken 45` im Lauf ist Blocken
   sein größtes Attribut im ganzen Profil — nach reinem Profil wäre er als Tackle sogar
   besser als als Tight End, nur Technik und Körper machen daraus Kosten. Wenn er ein
   echter Doppelspieler sein soll, müsste entweder sein Laufblock sinken oder sein
   Passanteil im Generierungsprofil steigen. Nicht blockierend, aber vor Inkrement 2
   anzusehen.
2. **Der Umbau wird spürbar härter.** Der Körpermalus hebt die durchschnittlichen
   Umstellungskosten von 24 auf 30 %, innerhalb einer Gruppe von 9 auf 13 %. Zusammen
   mit dem harten Doppeleinsatz-Preis wird ein 30-Mann-Kader sehr spröde. Der Deckel von
   20 % ist der schonendere Hebel, falls es zu viel ist — nach Inkrement 4 messbar.
3. **Passanteile je Gruppierung** (Abschnitt 6) sind ein Vorschlag, keine Entscheidung.
4. **Verletzungsrate.** `INJURY_CHANCE_PER_GAME` = 0,055 steht seit der Verkürzung auf
   12 Spieltage offen. Der harte Doppeleinsatz-Multiplikator macht die Frage dringender.
5. **Alterskurven je Attribut** — bewusst auf das Entwicklungskonzept verschoben.
   Bis dahin altern alle Werte gleichmäßig.
6. **Berechnete `staerke`** statt gezogener — der zweite Schritt, ausdrücklich später.

---

## 13 — Entscheidungslog

Damit nichts zweimal verhandelt wird. Alles darüber stützt sich hierauf.

| Thema | Entscheidung |
| --- | --- |
| Reihenfolge | Datenmodell zuerst, Offense-Umbau darauf |
| Positionen | 18, `K`/`P` entfallen aus dem Katalog |
| Seiten | Platz, nicht Position; Kosten je Position (CB 100 %, WR 100 %, DE 98 %, G 92 %, T 90 %) |
| Attribute | 15 plus die zwei Kickwerte |
| `staerke` | bleibt vorerst Führungsgröße, berechnete Stärke später |
| Körper | Größe und Gewicht als echte Daten, Korridor je Position, ~20 % daneben |
| Technik | positionsgebunden, trägt den Umstellungsabschlag; Leiter 100/Seite/70/45/25; es zählt der Anteil der Zielposition |
| Körpermalus | 0,4 % je Kilo Abstand der Korridormitten, gedeckelt bei 20 % — die groben Körperbänder fallen daraus von selbst |
| Generierungsprofil | nicht das Mittel der beiden Formeln, sondern nach Blockgewicht × Platzanteil gewichtet |
| Linebacker | MLB und SAM physisch (Brücke zur Line), WILL athletisch (Brücke zur Secondary); MLB mit `passrush` |
| Umstellungskosten | Sollwerte in Abschnitt 4: Gruppe 13 %, Einheit 27 %, quer 36 % |
| Skill-Leiter | 30/25/20/15/10 als Anteile am Skill-Block |
| Angriff Pass | QB 0,40 · OL 0,25 · Skill 0,35 |
| Angriff Lauf | OL 0,40 · Skill 0,40 · QB 0,20 |
| Defense Lauf | DL 0,40 · LB 0,40 · DB 0,20 |
| Defense Pass | DL 0,35 · DB 0,40 · LB 0,25 |
| Lauf/Pass | wird bis in die Simulation ausgespielt |
| Ausrichtung | Personnel schlägt vor, Manager verschiebt (±0,20) |
| Personnel | acht Gruppierungen, jede listet ihre Plätze; ausgelost, vom Manager jederzeit wählbar |
| Defense-Formation | 4-3 zum Start, weitere später über denselben Platz-Apparat |
| Aufstellung | innerhalb der Position nach `staerke`, von außen nach berechneter Eignung |
| Einspringen | aus dem ganzen Kader, Abschlag über die fehlende Technik |
| Doppeleinsatz | erlaubt, hart bepreist: Abzug über `ausdauer`, Risiko über `robustheit` |
| `ERSATZ_STAERKE` | entfällt — ein Platz bleibt nie leer |
| Kaderform eigen | 30 Mann, `TE` 0, Aufteilung nach Abschnitt 8 |
| Nummern | grob nach Gruppen wie bisher |
| Speicherstände | v4, ältere abgelehnt |
| Sichtbarkeit | eigener Kader offen, fremde nur Gesamtstärke |
| Taktik-UI | eigene Ansicht neben Kader, Spielplan und Tabelle |
