# Coaches

Bis hierher hatte ein Verein Spieler und sonst niemanden. Die Taktik kam aus
dem Taktikreiter, die Entwicklung aus der Alterskurve, und wer beides
verantwortet, stand nirgends. Jetzt steht er da: jeder Verein hat einen
Offense Coordinator und einen Defense Coordinator, beide mit Werten, beide mit
einer Stärke. Die Abschnitte 1 bis 6 beschreiben, was ein Coach *ist*;
Abschnitt 7 sagt, wie seine Vertrautheit mit den Systemen wächst, Abschnitt 8,
was er am Spieltag *bewirkt*. Was er mit der Entwicklung seiner Spieler
macht, ist noch offen — Abschnitt 9.

Gehört zu Block 5 aus [`naechste-schritte.md`](naechste-schritte.md); das
Positionsmodell, aus dem die Ähnlichkeit kommt, steht in
[`umbau-positionsmodell.md`](umbau-positionsmodell.md).

---

## 1 — Die Gruppen

Ein Coach ist auf eine **Coaching-Gruppe** ausgebildet. Es sind zehn, und sie
schneiden anders als die sieben `POSITION_GRUPPEN` des Spielermodells — dort
geht es darum, was ein Spieler beim Wechsel mitnimmt; hier darum, wo im Sport
ein eigener Trainer steht:

| Gruppe | Positionen | Unit |
| --- | --- | --- |
| QB | QB | 3 |
| RB | RB, FB | 2 |
| WR | WR, SL | 3 |
| TE | TE | 1,5 |
| OL | T, G, C | 1 |
| DL | DE, DT, NT | 1 |
| ILB | SAM, MIKE | 2 |
| OLB | WILL | 2 |
| CB | CB | 3 |
| S | FS, SS | 3 |

Die Unit ist eine Zahl für die Ähnlichkeit (Abschnitt 3): 1 ist die Line, 3
sind die Skill-Positionen, 2 das Dazwischen. Der TE steht auf 1,5, weil er im
Modell ein halber Lineman ist — TE–OL liegt bei 80 %, TE–RB bei 89 %.

Der FB gehört zum RB-Coach, nicht zum TE-Coach, obwohl er im Modell zu 83 %
ein Tackle ist. Das ist die Zuordnung des Sports. Die Folge ist ein RB-Coach,
der auch ein halber Blockcoach ist — und das ist sachlich richtig, denn die
Passformel des Running Backs selbst ist `blocken 30`.

`COACHING_GRUPPEN` in [`engine/coach.js`](../engine/coach.js).

## 2 — Die drei Blöcke

Jeder Coach trägt drei Blöcke, alle auf der Spielerskala 1–99, alle für jeden
gezogen — auch die, die seine Rolle kaum liest.

**Soft Skills** — fünf Werte, jeder gleich schwer: `kommunikation`,
`empathie`, `fuehrung`, `motivation`, `konfliktloesung`. Keiner hat heute einen
eigenen Zweck. Das ist Absicht: die Coaches definieren nicht, wofür ein Wert
gut ist — die Rechnung, die ihn liest, tut das. Wo später etwas an einem Coach
hängt, rechnen alle fünf mit.

**Scheme** — sechs Werte und eine Karte:

- `offenseLauf`, `offensePass`, `defenseLauf`, `defensePass`
- `kicks` (FG, PAT, Punt) und `returns` (Blocks, Returns) — für den Special
  Teams Coordinator, den es noch nicht gibt. Angelegt sind sie jetzt, damit er
  keinen Migrationsschritt mitbringen muss.
- `personnel`: die **Vertrautheit** mit jeder der acht Gruppierungen, je eine
  Zahl. Ein OC hat ein Heimatsystem — das, was sein Verein spielt — und die
  Nachbarn auf `PERSONNEL_REIHE` fallen mit dem Abstand ab, mal 0,8 je Schritt.
  Sieben Schritte sind noch 21 %. Das ist die **Ziehung** — danach wächst jeder
  der acht Werte für sich, siehe Abschnitt 7.

**Technik** — zehn Werte, einer je Coaching-Gruppe. Das Positionscoaching.

Die fremde Seite des Balls ist nicht null: ein DC hat einen `offensePass`, ein
OC einen Wert für Safeties. Beide sind niedrig (Abschnitt 5), aber da — ein
Coach kann später den Job wechseln, und die Zahl soll dann nicht aus dem
Nichts kommen.

## 3 — Die Ähnlichkeit

Was ein Coach der Gruppe A über die Gruppe B weiß, als Anteil seines
Hauptskills. Sie wird **gerechnet, nicht gepflegt**: ändert sich eine Formel in
`positionen.js`, wandert die Tabelle mit, und `tests/coach.test.js` sagt es.

Drei Schritte, in dieser Reihenfolge:

1. **Überlappung der Profile.** Für jede Gruppe das Ziehungsprofil ihrer
   Positionen (`generierungsProfil()`), gewichtet mit `PROFIL_BEITRAG`,
   **ohne `technik`**, auf 1 normiert. Überlappung = Σ min(aᵢ, bᵢ). Die
   Technik fliegt raus, weil sie beim Spieler positionseigen ist: sie steckt in
   jeder Formel und sagte über die Nähe nichts, nur dass beide ein Handwerk
   haben. Mit ihr lag der Boden bei 10–15 %, ohne sie liegt OL–S bei 6.
2. **Unit-Nähe** schließt einen Teil der Lücke: `x + (1 − x) · a/3` mit
   `a = 2 − |Δunit|`, nie unter null. Gleiche Unit schließt zwei Drittel, eine
   Unit Abstand ein Drittel, ab zwei nichts mehr. Ohne den Schritt lagen QB und
   WR bei 38 % — zwei Coaches derselben Skill-Gruppe, die einander kaum
   vertreten könnten.
3. **Seite**: Offense gegen Defense mal ⅔ (`COACH_SEITENFAKTOR`). Zuletzt,
   damit sie auch da gilt, wo die Units einander nah sind — OL–DL liegt bei 56,
   nicht bei 84.

Die freigegebene Tabelle, Prozent:

```
X    |   QB|   RB|   WR|   TE|   OL|   DL|  ILB|  OLB|   CB|    S
QB   |  ---|  63%|  79%|  37%|  16%|  18%|  42%|  44%|  54%|  53%
RB   |  63%|  ---|  77%|  89%|  72%|  38%|  52%|  51%|  39%|  33%
WR   |  79%|  77%|  ---|  74%|  29%|  10%|  30%|  38%|  54%|  51%
TE   |  37%|  89%|  74%|  ---|  80%|  45%|  43%|  38%|  26%|  18%
OL   |  16%|  72%|  29%|  80%|  ---|  56%|  36%|  28%|  11%|   6%
DL   |  18%|  38%|  10%|  45%|  56%|  ---|  76%|  58%|  35%|  34%
ILB  |  42%|  52%|  30%|  43%|  36%|  76%|  ---|  85%|  64%|  77%
OLB  |  44%|  51%|  38%|  38%|  28%|  58%|  85%|  ---|  88%|  80%
CB   |  54%|  39%|  54%|  26%|  11%|  35%|  64%|  88%|  ---|  89%
S    |  53%|  33%|  51%|  18%|   6%|  34%|  77%|  80%|  89%|  ---
```

Was sie sagt: der QB-Coach hat keinen Nachbarn über 79 % und ist damit der
einzige, den man nirgends ersetzt. Der OLB-Coach ist ein halber DB-Coach
(OLB–CB 88) — das ist die Konsequenz aus dem Sam-Umbau, in dem der WILL
bewusst die Brücke zur Secondary wurde. Der ILB ist die Mitte der Defense, mit
drei Nachbarn um 76–85.

**Verworfen:** Cosinus-Ähnlichkeit (gleiche Rangfolge, aber 10–20 Punkte
höher, OL–FB bei 97 %); die Gewichtung innerhalb der RB-Gruppe von Hand (⅔ RB,
⅓ FB — bewegt RB–TE von 89 auf 87, der Hebel liegt in der RB-Formel selbst,
nicht in den Coaches); OLB auf Unit 2,5 (schob ihn nur weiter zur Secondary,
ohne die ILB-Nähe zu lösen).

Die Tabelle wird **nicht zur Laufzeit** gebraucht. Sie fächert bei der Ziehung
die Technik von der Hauptgruppe aus, und später bei der Entwicklung des
Coaches. Wer im Spiel eine Gruppe coacht, hat den Wert dann schon in der Hand —
wie beim Spieler: Profil bei der Ziehung, Formel bei der Bewertung.

## 4 — Der Stärkewert

Abgeleitet, nie gespeichert — wie `hauptPlatz()` beim Spieler. Er hängt an der
**Rolle**: derselbe Mann ist als OC eine andere Zahl als als Positionscoach,
und die Lücke sagt „falscher Job", ohne dass eine Regel es sagen muss.

| Block | Koordinator | Positionscoach |
| --- | --- | --- |
| Soft | 30 % | 30 % |
| Scheme | 45 % | 15 % |
| Technik | 25 % | 55 % |

Innerhalb der Blöcke:

- **Soft**: das Mittel der fünf.
- **Scheme, OC**: `offenseLauf` 35, `offensePass` 35, Vertrautheit 30 — wobei
  die Vertrautheit ½ Heimatsystem (Maximum) + ½ Mittel der übrigen sieben ist.
  Das reine Mittel bestrafte den Spezialisten, das reine Maximum übersähe, dass
  er außerhalb seines Systems nichts kann.
- **Scheme, DC**: `defenseLauf` 50, `defensePass` 50 — bis es Defense-Schemes
  gibt.
- **Scheme, Positionscoach**: die zwei Schemewerte seiner Seite, gewichtet mit
  dem **Passanteil seiner Gruppe** aus `PROFIL_BEITRAG` — nicht hälftig. Ein
  CB-Coach ist zu 78 % ein Passcoach, ein RB-Coach zu 29 %:

  | QB | RB | WR | TE | OL | DL | ILB | OLB | CB | S |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | 67 % | 29 % | 66 % | 47 % | 39 % | 44 % | 32 % | 53 % | 78 % | 55 % |

- **Technik, Koordinator**: drei Drittel, innen gemittelt. OC: OL · (QB+WR)/2
  · (RB+TE)/2 — Line, Passspiel, Laufspiel. DC: DL · (ILB+OLB)/2 · (CB+S)/2.
- **Technik, Positionscoach**: der Wert seiner Gruppe.

`staerke()`, `STAERKE_GEWICHT`, `OC_SCHEME`, `DC_SCHEME`, `KOORDINATOR_TECHNIK`
in `engine/coach.js`.

## 5 — Die Ziehung

Coaches fangen **niedrig** an: die Stärke liegt um die **halbe Vereinsbasis**
(`COACH_BASIS_ANTEIL`), mit **halber Spielerstreuung** (`COACH_STREUUNG` 3).
Ein 45er-Verein bekommt Koordinatoren um 22, der stärkste der Liga um 35. Der
Stab ist etwas, das man aufbaut.

Wer generiert wird, ist **50 bis 65** Jahre alt. Die Jüngeren kommen später
über die Rekrutierung.

Kein Rollenprofil wie beim Spieler, sondern ein **Niveau**, von dem alles
abgeleitet wird:

- Soft und Scheme der eigenen Seite: Niveau plus Rauschen (`COACH_ATTRIBUT_STREUUNG` 3).
- Scheme der fremden Seite und Special Teams: mal ⅔.
- Technik: **ein** Kopfwert für die Hauptgruppe, die anderen neun daraus über
  die Ähnlichkeit — ohne eigenes Rauschen.
- Vertrautheit: **ein** Kopfwert fürs Heimatsystem, die anderen sieben daraus
  über 0,8 je Schritt — ohne eigenes Rauschen.
- Zum Schluss wird der ganze Satz skaliert, bis `staerke()` in seiner Rolle die
  Zielzahl liest. Die Stärke ist in jedem Wert linear, also reicht ein Faktor.

Dass die abgeleiteten Werte **nicht** streuen, ist eine Entscheidung: mit
eigenem Rauschen überholte das Nachbarsystem das Heimatsystem in jedem zehnten
Fall, und ein OC, dessen bestes System nicht das seines Vereins ist, sagt
etwas, das nicht gemeint war.

Jeder Koordinator hat eine **Hauptgruppe** — er war einmal Positionscoach. Sie
wird auf seiner Seite gelost, und daraus fächert die Technik: ein OC aus der
Line spielt sich anders als einer vom Quarterback. Das Heimatsystem des OC ist
das System des Vereins; er hat es ja eingeführt.

Namen aus demselben Pool wie die Spieler, eindeutig gegen den Kader des
eigenen Vereins.

## 6 — Der Speicherstand

`SpielStand.coaches: Record<teamId, Coach[]>`, `SAVE_VERSION` 8 → 9.

Der Migrationsschritt legt **nur die leere Karte** an. Die Coaches zieht
`coachesVon(stand, teamId)` beim ersten Blick nach, aus einem eigenen Strom
`seed | coaches | teamId` — derselbe Weg wie `losePersonnel()`. Zöge der
Schritt selbst, kennte er den heutigen Generator, und genau das darf ein
Schritt nicht. Deterministisch ist es trotzdem: ein Stand aus Version 8 trägt
nach dem Nachziehen dieselben Koordinatoren wie ein frischer Stand mit
demselben Saatgut.

Ein frischer Stand zieht den Stab sofort, nicht erst beim ersten Blick — ein
Export soll dieselben Coaches tragen wie der Bildschirm.

## 7 — Die Vertrautheit wächst

Der Fächer aus Abschnitt 2 — Heimatsystem mal `0,8` je Schritt — gilt **nur
für die Ziehung**. Danach werden die acht Werte einzeln geführt und hängen an
nichts mehr als an sich selbst: das gespielte System wird dem OC vertrauter,
die Nachbarn ein wenig, die fernen Systeme verlieren — und die Summe der acht
steigt trotzdem. Ein erfahrener Coach hat am Ende seiner Laufbahn hohe Werte,
egal ob er dreißig Jahre dasselbe gespielt hat oder jedes Jahr etwas anderes.
Der Unterschied ist die Form: Tiefe gegen Breite.

### Die Formel

Gerechnet wird in **Ticks**, nicht je Saison. Sei `p` das gespielte System,
`d(i)` der Abstand eines Systems auf `PERSONNEL_REIHE`, `DACH = MAX_RATING`.
Ein Tick mit dem Jahresanteil `a` bewegt drei Dinge, in dieser Reihenfolge:

1. **Lernen.** Das gespielte System gewinnt
   `a · LERNRATE · (DACH − V_p) / DACH` — eine Lernkurve, die am Dach von
   selbst flach wird und es nie überschreitet.
2. **Die Nachbarn** (`d = 1`) bekommen `NACHBAR_ANTEIL` **dieses Gewinns**,
   mit ihrem eigenen Abstand zum Dach gestaucht. Nicht ein Anteil der Rate —
   siehe unten, warum.
3. **Vergessen.** Die fernen Systeme (`d ≥ 2`) verlieren zusammen
   `VERGESSEN_ANTEIL` dessen, was in 1 und 2 gelernt wurde, verteilt im
   Verhältnis ihrer Werte. So fällt keiner unter null, und ohne Nebenbedingung
   folgt: `ΔSumme = (1 − VERGESSEN_ANTEIL) · Gelernt ≥ 0` in jedem Tick.

Wer nichts Neues lernt, vergisst auch nichts. Ein Spezialist am Dach steht
still, und was er vom Rest noch weiß, bleibt, wo es ist.

### Zeit und Spiele

Die Hälfte des Jahresgewinns kommt über die **Spiele**, die andere über die
**Zeit** im System — auch in der Offseason wird trainiert:

| Tick | Jahresanteil `a` | wer ruft |
| --- | --- | --- |
| ein Kalendertag | `(1 − SPIELANTEIL) / 365` | `weiter()`, mit jedem `tag++` |
| eine gespielte Partie | `SPIELANTEIL / 12` | `spieleTag()`, nach jedem Spiel, das stattfand |

Damit braucht niemand Buch zu führen, welches System ein Verein in welcher
Woche gespielt hat: der Kalender fragt `personnelVon()` am Tag, die Partie am
Spieltag, und ein Wechsel mitten in der Saison rechnet sich von allein
anteilig. Wer nach einem halben Jahr ohne Spiel wechselt, schreibt dem alten
System ein Viertel des Jahres gut und dem neuen drei — in den **Raten**; die
realisierten Punkte weichen leicht ab, weil das ältere System meist weniger
Luft zum Dach hat und in der zweiten Hälfte als fernes System ein wenig
verliert (bei einem Double-Wing-Coach 20, ein halbes Jahr Empty: 4,2 → 7,0 →
6,7 am Saisonende).

Nur der **OC** lernt. Die Defense kennt kein Personnel, also lernt der DC
keins — seine Vertrautheitswerte bleiben stehen, wie gezogen. Für alle zwölf
Vereine, nicht nur den eigenen: sonst wären die KI-Stäbe nach zehn Jahren noch
Anfänger.

### Konstanten

Alle in `engine/constants.js`, alle im Balancing-Katalog
([`balancing.md`](balancing.md)):

| Konstante | Wert | was sie tut |
| --- | --- | --- |
| `VERTRAUTHEIT_LERNRATE` | 12 | Gewinn eines vollen Jahres bei Vertrautheit 0; bei 20 sind es 9,6, bei 60 noch 4,7 |
| `VERTRAUTHEIT_NACHBAR_ANTEIL` | 0,10 | was die Nachbarn vom Gewinn bekommen |
| `VERTRAUTHEIT_VERGESSEN_ANTEIL` | 0,30 | was vom Gelernten den fernen Systemen verloren geht |
| `VERTRAUTHEIT_SPIELANTEIL` | 0,5 | Anteil der Spiele am Jahresgewinn |
| `VERTRAUTHEIT_TAGE_JE_JAHR` / `_SPIELE_JE_SAISON` | 365 / 12 | die Nenner |
| `MAX_RATING` | 99 | das Dach — **nicht** der Ligadeckel 79, siehe Entscheidungslog |

### Messprotokoll

Vier Laufbahnen, jeweils vom 35. bis zum 60. Lebensjahr, Heimatwert 20 bei
der Ziehung, gerundet angezeigt. Mit den Konstanten oben.

**Der Spezialist** — Double-Wing-Coach, spielt 25 Jahre Double Wing:

| Alter | 00 | 01 | 10 | 11 | 12 | 20 | 21 | 32 | Summe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 35 | 4 | 5 | 7 | 8 | 10 | 13 | 16 | 20 | 83 |
| 40 | 3 | 4 | 5 | 6 | 8 | 10 | 19 | 56 | 110 |
| 45 | 3 | 3 | 4 | 5 | 6 | 8 | 21 | 76 | 125 |
| 50 | 2 | 3 | 4 | 4 | 6 | 7 | 21 | 86 | 133 |
| 55 | 2 | 3 | 3 | 4 | 5 | 6 | 22 | 92 | 138 |
| 60 | 2 | 3 | 3 | 4 | 5 | 6 | 22 | 95 | 140 |

**Der Umsteiger** — Double-Wing-Coach, spielt ab der ersten Saison Empty:

| Alter | 00 | 01 | 10 | 11 | 12 | 20 | 21 | 32 | Summe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 35 | 4 | 5 | 7 | 8 | 10 | 13 | 16 | 20 | 83 |
| 40 | 47 | 9 | 5 | 7 | 8 | 10 | 13 | 16 | 116 |
| 45 | 71 | 11 | 5 | 6 | 7 | 9 | 11 | 14 | 134 |
| 50 | 84 | 12 | 4 | 5 | 7 | 8 | 10 | 13 | 144 |
| 55 | 91 | 13 | 4 | 5 | 6 | 8 | 10 | 12 | 149 |
| 60 | 94 | 13 | 4 | 5 | 6 | 8 | 10 | 12 | 152 |

**Der Wanderer** — Spread-Coach, jede Saison ein zufälliges System (Seed
2026; im Mittel über 500 Seeds steht er mit 60 bei `31 · 36 · 39 · 36 · 35 ·
34 · 33 · 29`):

| Alter | 00 | 01 | 10 | 11 | 12 | 20 | 21 | 32 | Summe |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 35 | 13 | 16 | 20 | 16 | 13 | 10 | 8 | 7 | 103 |
| 40 | 11 | 24 | 28 | 25 | 22 | 19 | 7 | 5 | 142 |
| 45 | 21 | 32 | 34 | 22 | 20 | 27 | 17 | 5 | 179 |
| 50 | 37 | 39 | 33 | 30 | 28 | 25 | 15 | 5 | 212 |
| 55 | 41 | 38 | 39 | 38 | 35 | 24 | 15 | 15 | 244 |
| 60 | 39 | 43 | 44 | 36 | 33 | 23 | 26 | 33 | 277 |

**Der Umsteiger auf Standard** — Double-Wing-Coach, wechselt sofort auf 11:
mit 60 bei `2 · 2 · 14 · 95 · 17 · 6 · 8 · 10`, Summe 154.

Was die Läufe sagen: ein Spezialist steht mit 60 bei 95, egal ob er dort
angefangen hat oder mit 35 gewechselt ist — der Umstieg kostet nur die ersten
Jahre. Die 80 erreicht er nach etwa dreizehn. Die Nachbarn bleiben bescheiden
(22 neben Double Wing, 13 neben Empty). Der Wanderer hat die doppelte Summe
und nirgends über 46.

### Was verworfen wurde

- **Die Nachbarn als Anteil der Rate** statt des Gewinns. Damit bekam der
  Nachbar 25 Jahre lang ein Viertel der vollen Rate, ohne dass es je aufhörte,
  und der Spezialist wusste über 21 mehr (55) als der Wanderer, der es drei
  Saisons wirklich gespielt hatte (31). Als Anteil des Gewinns hört das
  Zuschauen auf, sobald der Spezialist ausgelernt hat: 22 gegen 33.
- **Ein Deckel für die Nachbarn** („höchstens 40 % des gespielten Systems").
  Repariert dasselbe, aber mit einer Konstante mehr und einem Knick.
- **Das Vergessen als Prozentsatz der fernen Werte.** Bei einem Wanderer, der
  überall um die 60 steht, überholte der Verlust irgendwann den schrumpfenden
  Gewinn, und die Summe fiel. Ans Gelernte gekoppelt ist das ausgeschlossen.
- **Das Dach bei 79.** Der Ligadeckel gilt für Spieler**stärken**; die
  Vertrautheit ist Wissen und darf bis 99. Mit 79 stünde der Spezialist nach
  25 Jahren bei 78 und der Balken im Personal-Reiter wäre voll — er zeigt die
  Vertrautheit deshalb auf der 99er-Skala, als einzigen Block.
- **Ganzzahlig speichern.** Die Ziehung rundet, die Entwicklung nicht: die
  Nachbargewinne liegen bei Zehnteln je Tick, gerundet wären sie null. Die
  Form von `SpielStand` ändert das nicht — Zahl bleibt Zahl —, also kein
  Migrationsschritt; gezogene Ganzzahlen sind gültige Startwerte.

## 8 — Die Wirkung am Spieltag

Zwei Summanden in `vorteilTeile()`, beide klein gegen die Duelle, beide im
Taktikreiter aufgeführt:

| Summand | Formel | liest |
| --- | --- | --- |
| **Eigener OC** | `schemeBonus(oc, 'offense', a) − vertrautheitMalus(oc, personnel)` | `offenseLauf`/`offensePass`, `personnel[gespielt]` |
| **DC des Gegners** | `− schemeBonus(dc, 'defense', a)` | `defenseLauf`/`defensePass` |

mit

```
schemeBonus(coach, seite, a) = ((Pass − 50) · a + (Lauf − 50) · (1 − a)) · COACH_SCHEME_FAKTOR
vertrautheitMalus(coach, p)  = (MAX_RATING − V_p) · VERTRAUTHEIT_MALUS_JE_PUNKT
```

`a` ist der Passanteil des **angreifenden** Vereins, auch beim DC: gegen einen
Werfer zählt seine Passverteidigung, nicht was er selbst lieber verteidigt.
Weil beide Summanden an `a` hängen, bewegt der Regler auch sie, und ein
Werfer-OC schiebt das rechnerische Optimum ein Stück Richtung Pass.

**Warum ein Malus auch im eigenen System.** Die Formel rechnet gegen das Dach,
nicht gegen den besten Wert des Coaches. Sie misst Wissen, nicht „bin ich im
falschen System" — und seit die Vertrautheit wächst, ist das richtig: ein
Anfänger zahlt zu Hause (20 → 4,7), nach zehn Jahren nicht mehr (78 → 1,3),
und der Meister, der wechselt, zahlt wieder. Aus den Läufen oben, mit 0,06:

| | mit 36 | mit 40 | mit 45 | mit 60 |
| --- | --- | --- | --- | --- |
| Spezialist | 4,3 | 2,6 | 1,4 | 0,2 |
| Umsteiger auf Empty | 5,1 | 3,2 | 1,7 | 0,4 |
| Wanderer (gespieltes System) | 4,4 | 4,6 | 4,7 | 4,0 |

Relativ zum Bestwert gerechnet — immer null zu Hause — stünde ein Coach, der
nirgends etwas kennt, malusfrei da, und der Meister zahlte für den Wechsel
mehr, als ein Anfänger je zahlen kann. Verworfen.

**Was es ausmacht.** Bei der Ziehung liegen die Koordinatoren um 22 bis 35,
also alle unter der 50er-Mitte: der eigene OC kostet anfangs rund 2 bis 3
(Scheme) plus 4 bis 5 (Vertrautheit), der fremde DC gibt 2 bis 3 zurück. Netto
etwa −4,5 Stärkepunkte je Verein, das sind bei `RATING_TO_POINTS` 0,42 rund
1,9 Punkte. Gemessen über acht Saisons mit festen Seeds: **24,41 → 22,77
Punkte je Team**, mittlere Differenz 10,54 → 10,90. Wer die alten Zahlen
zurückhaben will, dreht an `BASE_POINTS` — das ist Balancing, kein Modell.

**Ohne Stab** rechnet `vorteil()` wie vorher. Das ist die Form, kein
Übergang: der Ligaschnitt im Taktikreiter hat keinen DC, und ein Test, der das
Duell zweier Kader prüft, muss keinen erfinden. `Antritt` trägt `coaches`
optional; `alsGegner()` gibt sie mit.

**Im Taktikreiter** steht seitdem eine Karte „Koordinatoren" — Name, die zwei
Scheme-Werte der Seite, beim OC die Vertrautheit mit dem gewählten System und
ihr Malus —, jede Systemschaltfläche nennt die Vertrautheit des OC mit diesem
System (der Preis eines Wechsels gehört dorthin, wo gewechselt wird), und das
Duell hat zwei Zeilen mehr: „Eigener OC" und „DC des Gegners".

## 9 — Was noch nicht ist

- **Spielerentwicklung.** Was die Technik eines Coaches mit der Drift und dem
  Talentwachstum seiner Gruppe macht, und wer eine Gruppe coacht, wenn kein
  Positionscoach da ist. Gehört ins Entwicklungskonzept aus Block 5.
- **Alter und Rücktritt.** Coaches altern nicht; `alter` ist eine Zahl aus der
  Ziehung. Gehört zum Markt.
- **Markt.** Einstellen, Entlassen, Rekrutierung der Jüngeren, Verträge — es
  gibt keine Finanzen, also gibt es das noch nicht. Bis dahin hat der Manager
  keinen Hebel am Stab außer dem System, das er spielen lässt.
- **Schulungen** und andere äußere Einflüsse auf die Vertrautheit. Das Modell
  aus Abschnitt 7 ist die Grundlinie ohne sie.
- **Defense-Schemes.** Der DC hat Lauf und Pass, aber kein Gegenstück zum
  Personnel und deshalb nichts zu lernen.

---

## Entscheidungslog

| Thema | Entscheidung |
| --- | --- |
| Start | jeder Verein OC + DC, sonst niemand |
| Gruppen | die zehn aus Abschnitt 1; FB beim RB, SL beim WR, FS+SS als S |
| Units | OL 1, DL 1, TE 1,5, RB 2, ILB 2, OLB 2, QB 3, WR 3, CB 3, S 3 |
| Ähnlichkeit | Überlappung ohne Technik, dann Unit-Nähe (a/3), dann Seite (⅔) — in dieser Reihenfolge |
| RB-Gruppe | Gewichtung aus `PROFIL_BEITRAG` (56/44), nichts von Hand |
| Soft Skills | fünf, je 20 % des Blocks, kein Wert hat einen eigenen Zweck |
| Blöcke | Koordinator 30/45/25, Positionscoach 30/15/55 |
| Scheme OC | Lauf 35 / Pass 35 / Vertrautheit 30; Vertrautheit = ½ max + ½ Rest |
| Scheme DC | Lauf 50 / Pass 50 |
| Scheme Positionscoach | die zwei Werte seiner Seite, nach Passanteil der Gruppe |
| Technik Koordinator | OC ⅓ OL, ⅓ (QB+WR)/2, ⅓ (RB+TE)/2; DC ⅓ DL, ⅓ (ILB+OLB)/2, ⅓ (CB+S)/2 |
| Hauptgruppe | jeder Coach hat eine, auch der Koordinator |
| Ziehung | Stärke um Vereinsbasis/2, Streuung 3, Alter 50–65 |
| Fremde Seite | vorhanden, mal ⅔ — auch Special Teams |
| Special Teams | `kicks` und `returns` schon jetzt am Coach |
| Stärke | abgeleitet je Rolle, nie gespeichert |
| Migration | Schritt legt `coaches: {}` an, `coachesVon()` zieht nach |
| Vertrautheit wächst | je Tick: Lernen am Dach 99, Nachbarn 10 % des Gewinns, ferne verlieren 30 % des Gelernten — Summe steigt immer |
| Tick | halb Zeit (je Tag, /365), halb Spiele (je Partie, /12); nur der OC, alle zwölf Vereine |
| Speicherform | Nachkommastellen, kein Migrationsschritt |
| Wirkung Spieltag | OC: `(Scheme − 50) · 0,1 − (99 − V) · 0,06`; DC des Gegners: `−(Scheme − 50) · 0,1`; nach Passanteil des Angriffs |
| Malus | absolut gegen das Dach, nicht relativ zum Bestwert — der Anfänger zahlt auch zu Hause |
| Wirkung Entwicklung | **offen**, eigener Umbau |
