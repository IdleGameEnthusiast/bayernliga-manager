# Coaches

Bis hierher hatte ein Verein Spieler und sonst niemanden. Die Taktik kam aus
dem Taktikreiter, die Entwicklung aus der Alterskurve, und wer beides
verantwortet, stand nirgends. Jetzt steht er da: jeder Verein hat einen
Offense Coordinator und einen Defense Coordinator, beide mit Werten, beide mit
einer Stärke — und beide tun **noch nichts**. Dieses Dokument beschreibt, was
ein Coach *ist*. Was er *bewirkt*, sind zwei eigene Umbauten, siehe
Abschnitt 7.

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
  Sieben Schritte sind noch 21 %.

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

## 7 — Was noch nicht ist

Dieses Dokument hört da auf, wo ein Coach etwas **bewirkt**. Drei Dinge sind
bewusst ausgeklammert und kommen als eigene Schritte:

- **Taktik.** Was die Schemewerte am Spieltag tun, was die Vertrautheit mit
  einer Gruppierung kostet, und der Umbau des Taktikreiters mit OC- und
  DC-Karte. Ein Vorschlag lag auf dem Tisch — `(skill − 50) · 0,1` auf die
  Einheitsstärke, `(100 − vertrautheit) · 0,06` als Malus — und ist **nicht
  entschieden**.
- **Spielerentwicklung.** Was die Technik eines Coaches mit der Drift und dem
  Talentwachstum seiner Gruppe macht, und wer eine Gruppe coacht, wenn kein
  Positionscoach da ist. Gehört ins Entwicklungskonzept aus Block 5.
- **Markt.** Einstellen, Entlassen, Rekrutierung der Jüngeren, Verträge — es
  gibt keine Finanzen, also gibt es das noch nicht.

Bis dahin ist der Coaches-Reiter unter Personal reine Auskunft.

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
| Wirkung | Taktik und Entwicklung: **offen**, eigene Umbauten |
