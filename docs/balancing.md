# Balancing — die Stellschrauben

Alles, was sich am Spielgefühl drehen lässt, ohne ein Modell zu ändern:
Konstanten, ihr Ort, was sie tun und in welche Richtung. Geordnet nach der
**Frage**, die man sich beim Spielen stellt („die Coaches merkt man nicht",
„die Spiele sind zu knapp"), nicht nach der Datei — die Datei steht daneben.

Das Dokument ist **lebend**. Wer eine Konstante anlegt oder eine Zahl ändert,
trägt sie hier ein, mit dem gemessenen Vorher/Nachher, wenn es eines gibt.
Was ein Modell ist und keine Schraube — die Formeln in `positionen.js`, die
Blockgewichte, die Entropie in `vorteil()` — steht in den `umbau-*.md`; hier
stehen nur Zahlen, die man verstellen darf, ohne dass ein Test lügt.

Messen vor und nach jeder Änderung: `node --test tests/` für die Invarianten,
`node scripts/baseline-staerken.js` für die Ligaverteilung, und für alles am
Spieltag acht Saisons mit festen Seeds (Punkte je Team, mittlere Differenz,
Siegverteilung). Die Zahlen aus dem letzten Umbau stehen jeweils dabei.

---

## 1 — Die Koordinatoren im Spiel

*„Man merkt die Coaches nicht"* oder *„der Stab entscheidet zu viel".*
Alle in `engine/constants.js`, Docs [`umbau-coaches.md`](umbau-coaches.md)
Abschnitt 8.

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `COACH_SCHEME_FAKTOR` | 0,1 | Stärkepunkte je Scheme-Punkt über oder unter der Mitte, für OC und DC | höher = das Scheme entscheidet mehr; bei 0,2 bringt ein 80er-OC +6 statt +3 |
| `COACH_SCHEME_MITTE` | 50 | ab wo ein Scheme hilft statt schadet | tiefer = die Liga zahlt weniger; bei 30 läge der Ligaschnitt (22–35) nahe null |
| `VERTRAUTHEIT_MALUS_JE_PUNKT` | 0,06 | Stärkepunkte je fehlendem Vertrautheitspunkt unter 99 | höher = ein Systemwechsel tut mehr weh; bei 0,06 kostet Vertrautheit 0 sechs Punkte |

Gemessen beim Einbau (acht Saisons, Seeds `a`–`h`): Punkte je Team **24,41 →
22,77**, mittlere Differenz 10,54 → 10,90. Die Liga zahlt, weil alle
Koordinatoren unter der Mitte liegen. Wer das Niveau zurück will, ohne die
Coaches zu entwerten: `BASE_POINTS` um 1,5 hoch (Abschnitt 5) oder
`COACH_SCHEME_MITTE` senken.

## 2 — Wie schnell ein Coach ein System lernt

*„Der Wechsel auf Empty dauert ewig"* oder *„nach drei Jahren kennt er alles".*
`engine/constants.js`, Docs [`umbau-coaches.md`](umbau-coaches.md)
Abschnitt 7 — dort auch die vier Laufbahnen als Messprotokoll.

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `VERTRAUTHEIT_LERNRATE` | 12 | Gewinn eines Jahres bei Vertrautheit 0; die Kurve wird zum Dach hin flach | die eine Schraube — alles andere skaliert mit. Bei 12: 80 nach 13 Jahren, 95 nach 25; bei 18 entsprechend 9 und 17 |
| `VERTRAUTHEIT_NACHBAR_ANTEIL` | 0,10 | was die Nachbarsysteme vom Gewinn mitbekommen | höher = ein Wechsel zum Nachbarn ist billiger. Über 0,25 kennt der Spezialist den Nachbarn besser als einer, der ihn spielt |
| `VERTRAUTHEIT_VERGESSEN_ANTEIL` | 0,30 | wie viel vom Gelernten die fernen Systeme verlieren | höher = der Wanderer bleibt flacher; die Summe steigt trotzdem, solange < 1 |
| `VERTRAUTHEIT_SPIELANTEIL` | 0,5 | Anteil der Spiele am Jahresgewinn, der Rest ist Zeit | höher = die Offseason zählt weniger |
| `VERTRAUTHEIT_TAGE_JE_JAHR` | 365 | Nenner der Zeithälfte | Kalender, nicht Balancing |
| `VERTRAUTHEIT_SPIELE_JE_SAISON` | 12 | Nenner der Spielhälfte | kleiner = Playoff-Teilnehmer lernen mehr als die anderen |
| `MAX_RATING` | 99 | das Dach | nicht anfassen — es ist die Skala |

Die Ziehung, nicht die Entwicklung: `PERSONNEL_ABSTAND_FAKTOR` 0,8 sagt, wie
weit die Nachbarn beim Start hinter dem Heimatsystem liegen.

## 3 — Wie stark die Coaches anfangen

*„Die Koordinatoren sind alle Anfänger".* `engine/constants.js`, Docs
[`umbau-coaches.md`](umbau-coaches.md) Abschnitt 5.

| Konstante | Wert | Wirkung |
| --- | --- | --- |
| `COACH_BASIS_ANTEIL` | 0,5 | Coachstärke als Anteil der Vereinsbasis; ein 45er-Verein bekommt 22er-Koordinatoren, der stärkste um 35 |
| `COACH_STREUUNG` | 3 | Streuung dieser Stärke |
| `COACH_ATTRIBUT_STREUUNG` | 3 | Streuung eines einzelnen Werts um die Stärke |
| `COACH_SEITENFAKTOR` | ⅔ | was ein Coach von der anderen Seite des Balls versteht — auch in der Ähnlichkeit |
| `COACH_ALTER_MIN` / `_MAX` | 50 / 65 | Alter bei der Ziehung; die Jüngeren kommen mit dem Markt |

Und was die Stärke aus den Blöcken macht (`engine/coach.js`): `STAERKE_GEWICHT`
30/45/25 beim Koordinator, 30/15/55 beim Positionscoach; `OC_SCHEME`
35/35/30, `DC_SCHEME` 50/50. Das ist eine Anzeige- und Marktgröße — am
Spieltag lesen die Formeln aus Abschnitt 1 die Rohwerte.

## 4 — Die Ausrichtung: was der Regler kostet

*„Der Regler macht nichts"* oder *„reines Passspiel ist zu billig".*
`engine/constants.js`, Docs [`umbau-positionsmodell.md`](umbau-positionsmodell.md)
Abschnitt 6.

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `AUSGEWOGENHEIT` | 10 | was Einseitigkeit höchstens kostet (`· ln 2` Stärkepunkte an den Enden); bestimmt, wo das Optimum liegt | höher = das Optimum rückt zur Mitte, die Systeme unterscheiden sich weniger |
| `SPREIZUNG` | 1,0 | wie weit Kader und Gegner das Systemoptimum verschieben | 0 = jedes System hat sein festes Optimum |
| `KLIPPE` | 16 | Einbruch in den letzten Prozent des Reglers | höher = 0 % und 100 % tun mehr weh |
| `RAND` | 0,03 | Breite des Randbands | breiter = die Klippe greift früher |

Die `neigung` je Gruppierung in `PERSONNEL` (`engine/aufstellung.js`) ist
**gemessen**, nicht gesetzt — ein Test rechnet sie nach. Wer sie verstellt,
verstellt den Passanteil, bei dem ein System sein Optimum hat.

## 5 — Der Spielausgang

*„Zu viele Punkte"*, *„zu wenig Überraschungen"*, *„Heimvorteil zu groß".*
`engine/constants.js`.

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `BASE_POINTS` | 20 | was ein ebenbürtiger Angriff erzielt | die Grundlinie; seit den Coaches liegt der Ligaschnitt bei 22,8 statt 24,4 |
| `RATING_TO_POINTS` | 0,42 | Punkte je Stärkepunkt Vorteil | höher = der Bessere gewinnt öfter, Überraschungen seltener. Rund 31 Stärkepunkte Reglerweg sind damit 13 Punkte |
| `HOME_ADVANTAGE` | 2,5 | Punkte für den Heimverein | |
| `MATCH_NOISE` | 6,5 | Streuung des erwarteten Ergebnisses | höher = mehr Überraschungen; jede Wirkung unter 2 Punkten verschwindet darin |
| `MIN_EXPECTED` / `MAX_EXPECTED` | 3 / 56 | Klammer um die Erwartung | |
| `WERTUNG_PUNKTE` | 36 | was ein Verein bekommt, gegen den nicht angetreten wurde | soll wehtun und als Wertung erkennbar sein |
| `OT_NOTBREMSE_RUNDEN` | 50 | nur gegen einen kaputten RNG — keine Schraube | |

Special Teams gehen mit `special · 0,02` in die Erwartung ein
(`engine/spiel.js`, hart kodiert) und mit 8 % in die Gesamtstärke
(`gesamtStaerke()` in `engine/team.js`, 46/46/8).

## 6 — Verletzungen und Doppeleinsatz

*„Ständig ist jemand verletzt"* — seit der Verkürzung auf 12 Spieltage
ausdrücklich **ungemessen** (offene Entscheidung 3 in
[`naechste-schritte.md`](naechste-schritte.md)).

| Konstante | Wert | Wirkung |
| --- | --- | --- |
| `INJURY_CHANCE_PER_GAME` | 0,055 | je Verein und Spiel; bei 12 Spielen rund zwei Drittel einer Verletzung je Verein und Saison |
| `INJURY_MIN_WEEKS` / `_MAX_WEEKS` | 1 / 6 | Dauer, gleichverteilt; Wochen mal sieben Tage |
| `DOPPEL_ABZUG` (`engine/aufstellung.js`) | 20 → 40 %, 50 → 28 %, 80 → 15 % | was der zweite Einsatz an Leistung kostet, nach `ausdauer` |
| `DOPPEL_RISIKO` (`engine/aufstellung.js`) | 20 → 4×, 50 → 3×, 80 → 2× | Verletzungsrisiko des Doppelspielers, nach `robustheit` |

## 7 — Umstellungen: was ein fremder Platz kostet

*„Jeder kann überall spielen"* oder *„der Tight End aus dem Guard ist
unbrauchbar".* `engine/positionen.js`, Docs
[`umbau-positionsmodell.md`](umbau-positionsmodell.md) Abschnitte 4 und 7.

| Konstante | Wert | Wirkung |
| --- | --- | --- |
| `TRANSFER_GRUPPE` / `_EINHEIT` / `_FREMD` | 0,70 / 0,45 / 0,25 | was von der Technik auf einem Nachbarplatz, in der Einheit, auf der anderen Seite bleibt |
| `KOERPERMALUS_JE_KILO` | 0,004 | je Kilo Abstand der Korridormitten |
| `KOERPERMALUS_JE_KILOQUADRAT` | 0,00024 | was der eigene Körper dazutut: 25 kg neben der Mitte verdoppeln den Malus |
| `KOERPERMALUS_GUTSCHRIFT_ANTEIL` | 0,5 | wie viel der Körper in Zielrichtung höchstens gutmacht — nie alles (ein Loch, das schon einmal zugeschnappt ist) |
| `KOERPERMALUS_DECKEL` | 0,20 | Obergrenze des Malus |
| `EINGESPIELT_KURVE` / `EINGESPIELT_VOLL` | 0 → 0, 5 → 0,35, 10 → 0,6, 20 → 0,85, 30 → 1 | wie viele Einsätze ein Platz braucht, bis er als eingespielt gilt: drei Saisons |
| `EINSATZ_VERFALL` | 0,93 | was ein Platz je Saison an Einsätzen verliert |
| `PROFIL_SPEZIALISIERUNG` (`constants.js`) | 0,40 | wie stark ein gezogener Spieler auf seinem Profil sitzt — bei 0 ist jeder ein Generalist und das Positionsmodell bedeutungslos |

Die Häufigkeit echter Umstellungen ist seit der Aufstellung von Hand
messbar und noch nicht gemessen — offener Punkt 2 in
[`umbau-aufstellung.md`](umbau-aufstellung.md).

## 8 — Spielerentwicklung durch Einsätze

*„Die Umschulung dauert zu lang".* `engine/constants.js`.

| Konstante | Wert | Wirkung |
| --- | --- | --- |
| `ATTRIBUT_DRIFT_JE_SPIEL` | 0,0147 | wie weit ein Einsatz die Attribute auf das Sollprofil zieht; elf Spiele ≈ 15 % |
| `LERNRATE` (je Attribut) | technik 1,5 … schnelligkeit 0,3 | Handwerk lernt man, Tempo nicht; Schnitt 1,0 |

Die Alterskurve (`engine/spieler.js`: `F_18` 0,68, `F_27` 1,0, `F_33` 0,9,
`F_40` 0,711, `ZERFALL` 0,94) und die Talentbewegung beim Saisonwechsel (35 %
Chance auf +1…3 bis `PEAK_AGE`) sind das heutige Entwicklungsmodell — und der
Platzhalter, bis das Konzept aus Block 5 kommt. Die Coaches wirken hier noch
nicht.

## 9 — Der Kader und die Liga

*„Mein Verein ist hoffnungslos"* oder *„die Liga ist zu gleich".*
`engine/constants.js`.

| Konstante | Wert | Wirkung |
| --- | --- | --- |
| `EIGENE_VEREINSBASIS` | 45 | die Basis des eigenen Vereins, egal welchen man wählt; die Leiter der anderen bleibt |
| `ZUSATZ_SPIELER` | 5 | was jeder andere Verein über die 30 hinaus bekommt — der eigene nicht, und ohne Rekrutierung bleibt das eine dauerhafte Strafe (offene Entscheidung 1) |
| `KADER_FORM` / `ZUSATZ_GEWICHTE` | je Position | woraus ein Kader besteht; `TE: 0` beim Grundkader ist Absicht |
| `TALENT_STREUUNG` | 6 | Streuung des Talents um die Vereinsbasis |
| `ATTRIBUT_STREUUNG` | 6 | Streuung eines Attributs vor der Skalierung |
| `LIGA_MAX_STAERKE` | 79 | Deckel auf Stärke **und** jedes Attribut — der Kategorienfehler aus offener Entscheidung 9 |
| `KOERPER_KOPPLUNG` | 0,35 | wie hart das Gewicht `kraft` hoch- und `schnelligkeit` herunterzieht |
| `KOERPER_ANTEIL_DANEBEN` | 0,20 | Anteil der Spieler außerhalb ihres Korridors |
| `MIN_AGE` / `MAX_AGE` / `PEAK_AGE` | 18 / 36 / 27 | Altersziehung gleichverteilt — nie eine junge Aufsteigermannschaft (offene Entscheidung 5) |
| `RUECKTRITT_ALTER` | 37 | Platzhalter bis zum Entwicklungskonzept |
| `VETERAN_*` | 1–2 je Verein, 45–65 Jahre, nur Linemen | die Bayernliga-Eigenheit |
| `KICK_*` | Basis 22, Fuß bei 7 % um 55 | wer kicken kann, ohne Spezialist zu sein |

Die Vereinsstärken selbst stehen im Katalog (`engine/content.js`), und
`scripts/baseline-staerken.js` misst, was daraus wird.

---

## Was nicht hier steht

Formeln (`FORMELN`, `PROFIL_BEITRAG`, `KOERPER_KORRIDOR`), die Blockgewichte
(`BLOCK_GEWICHT`, `PLATZ_ANTEIL`, `SKILL_LEITER`, `SKILL_ROLLE`), die
Ähnlichkeit der Coaching-Gruppen und die Struktur der Saison. Das sind
Modelle: wer daran dreht, ändert, *was* das Spiel beschreibt, nicht *wie
stark*. Sie haben eigene Dokumente und meist einen Test, der die
abgenommenen Zahlen festhält.
