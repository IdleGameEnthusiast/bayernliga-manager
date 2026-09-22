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
`F_40` 0,711, `ZERFALL` 0,94) **ist** das heutige Entwicklungsmodell — und der
Platzhalter, bis das Konzept aus Block 5 kommt. Die Coaches wirken hier noch
nicht.

Der Saisonwechsel schiebt die Stärke seit dem Talentumbau mit
`staerkeImAlter()` einen Schritt weiter auf dieser Kurve, statt sie aus einem
gespeicherten Deckel neu fallen zu lassen. Ersatzlos gestrichen ist dabei die
alte Talentbewegung (35 % Chance auf +1…3 bis `PEAK_AGE`): sie hob einen
Deckel, den es nicht mehr gibt. **Vorher** wuchs ein Zwanzigjähriger dadurch
über die Kurve hinaus, **nachher** wächst niemand mehr über sie hinaus — bis
der Umbau der Entwicklung sagt, was das Talent in Wachstum übersetzt. Das ist
bewusst zu wenig statt falsch; wer daran dreht, bevor das Konzept steht, dreht
an der falschen Stelle.

## 9 — Der Kader und die Liga

*„Mein Verein ist hoffnungslos"* oder *„die Liga ist zu gleich".*
`engine/constants.js`.

| Konstante | Wert | Wirkung |
| --- | --- | --- |
| `EIGENE_VEREINSBASIS` | 45 | die Basis des eigenen Vereins, egal welchen man wählt; die Leiter der anderen bleibt |
| `ZUSATZ_SPIELER` | 5 | was jeder andere Verein über die 30 hinaus bekommt — der eigene nicht, und ohne Rekrutierung bleibt das eine dauerhafte Strafe (offene Entscheidung 1) |
| `KADER_FORM` / `ZUSATZ_GEWICHTE` | je Position | woraus ein Kader besteht; `TE: 0` beim Grundkader ist Absicht |
| `STAERKE_STREUUNG` | 6 | Streuung des Höhepunkts um die Vereinsbasis — hieß bis zum Talentumbau `TALENT_STREUUNG`, der Wert ist derselbe |
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

### Talent — halbe Sterne, 1 bis 10

*„Im Roster haben alle zweieinhalb Sterne"* oder *„jeder Achtzehnjährige ist
ein Versprechen".* `engine/constants.js`, gezogen in `ziehTalent()`.

| Konstante | Wert | Wirkung |
| --- | --- | --- |
| `TALENT_MIN` / `TALENT_MAX` | 1 / 10 | die Skala: 1 ist ein halber Stern, 10 sind fünf |
| `TALENT_JE_STAERKE` | 0,1 | wie stark die Vereinsbasis den Schnitt hebt — ein Zehner Basis ist ein halber Stern |
| `TALENT_ACHSE` | 0,5 | der Achsenabschnitt; Basis 45 landet auf 5 halben Sternen, Basis 65 auf 7 |
| `TALENT_STREUUNG` | 1,6 | Streuung in halben Sternen |

**Vorher/Nachher.** Bis zum Talentumbau war `talent` eine Zahl von 0 bis 99 und
zugleich der Deckel, aus dem die Stärke fiel; die Sterne waren nur eine Ansicht
darauf, eine Zehnerstufe je halber Stern. Damit lag die Streuung im Roster bei
`STAERKE_STREUUNG / 10` = 0,6 halbe Sterne — **ein Kader zeigte dreißigmal
dieselbe Stufe**, und die Spalte sagte nichts. Jetzt streut sie 1,6, ein Kader
reicht vom halben Stern in die vier, und das Talent hängt nicht mehr an der
heutigen Stärke: ein Achtzehnjähriger mit 35 darf vier Sterne haben, ein
Dreißigjähriger mit 70 einen. Der Schnitt je Verein blieb, wo er war — deshalb
`0,1` und `0,5`, die genau die alte Zehnerleiter treffen.

Wer an `TALENT_STREUUNG` dreht, dreht am Gefühl des Rosters, noch **nicht** an
der Stärke: was Talent in Entwicklung übersetzt, entscheidet der Umbau der
Entwicklung. Bis dahin ist es eine Zahl, die nur angesehen wird.

## 10 — Commitment: wie fest die Leute am Verein hängen

*„Alle sind ‚moderat'"* oder *„die halbe Liga hängt nur ‚niedrig' dran".*
`engine/constants.js`, Docs [`naechste-schritte.md`](naechste-schritte.md)
Block 7. Der Wert bewegt sich noch nicht — das hier ist nur die Ziehung. Der
Manager sieht nie die Zahl, nur die Stufe.

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `COMMITMENT_STUFEN` | 20 / 40 / 60 / 80 | die unteren Grenzen der Stufen 1–4; darunter Stufe 0 | Bänder verschieben heißt Texte verschieben, nicht Werte — wer mehr „sehr hoch" will, senkt die 80 |
| `COMMITMENT_BASIS` | 52 | wo die Ziehung anfängt | die eine Schraube, wenn die ganze Liga zu locker oder zu fest hängt |
| `COMMITMENT_STREUUNG` | 14 | Streuung um das Ergebnis | höher = die Ränder füllen sich; bei 12 standen von 415 nur 5 ganz unten und 8 ganz oben, bei 14 sind es 4–9 und 17–30 |
| `COMMITMENT_JE_STATUS` | Schüler +4, Student −6, Azubi +4, Arbeiter +2, Rentner +10 | was der Status mitbringt | der Student ist der Einzige mit Abzug — er ist gekommen, um zu gehen |
| `COMMITMENT_JE_VEREINSJAHR` / `_MAX` | 1,2 / 10 | was ein Jahr im Verein bringt, und ab wann nichts mehr dazukommt | höher = die Alteingesessenen sind unkündbar |

Gemessen beim Einbau (drei Seeds, je 415 Spieler): Stufen 0–4 im Schnitt
**7 / 67 / 182 / 137 / 22**, Mittel 53–55. Die Lebenslage-Tabellen — welcher
Status in welchem Alter, wie weit einer fährt, was am Horizont steht — sind
Modell und stehen in `commitment.js`, nicht hier.

**Gestrichen mit Schritt 2a:** `COMMITMENT_JE_KM_AUTO` / `_OHNE` (0,08 / 0,35)
und `COMMITMENT_STRECKE_MAX` (22). Die Strecke zog bis zu 22 Punkte vom Wert
ab; mit der Waage (Abschnitt 11) stünde sie zweimal da — einmal als
niedrigerer Halt, einmal als Druck. Ohne den Abzug: Stufen 0–4 **2 / 51 / 181
/ 151 / 29**, Mittel 56–58 (vorher 7 / 67 / 182 / 137 / 22, Mittel 53–55) —
die Stufe 0 ist fast leer, weil sie vorher aus den Weitfahrern ohne Auto
bestand, und die stehen jetzt auf der Druck-Seite. Wer die alte Verteilung
zurückwill, senkt `COMMITMENT_BASIS` um etwa 3.

## 11 — Die Waage: wer die Strecke aushält und wer geht

*„Jedes Jahr ist der halbe Kader neu"* oder *„es geht nie einer".*
`engine/constants.js`, Modell in `engine/lebenslauf.js`, Docs
[`naechste-schritte.md`](naechste-schritte.md) Block 7, „Statusübergänge —
die Verteilungen". Druck und Halt liegen auf der Skala des Commitments; nur
der Playtester sieht sie.

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `DRUCK_FAKTOR_AUTO` | 0,4 | womit die Strecke multipliziert wird, wenn einer ein Auto hat | tiefer = das Auto entscheidet mehr; bei 0,4 drücken 80 km mit Auto wie 32 ohne |
| `DRUCK_FAKTOR_FAMILIE` | 1,3 | was die **eigene** Familie (Arbeiter, Rentner) auf die Strecke legt | höher = Familienväter mit langem Weg gehen; für Schüler, Studenten, Azubis gilt er nicht — ihre Entfernung ist schon die zu den Eltern |
| `DRUCK_MAX` | 99 | Deckel des Drucks | nicht drehen — die Skala ist die des Commitments |
| `HALT_JE_VEREINSJAHR` | 2 | was ein Jahr im Verein an Halt bringt, ungedeckelt | höher = die Alteingesessenen halten jede Strecke aus; zehn Jahre sind schon eine ganze Stufe |
| `HALT_FAMILIENBONUS_JUNG` | 15 | was die Eltern einem Schüler, Studenten oder Azubi an Halt geben | höher = die Jungen pendeln länger; auf der Halt-Seite und nicht als Faktor unter 1 auf den Druck, das wäre eine Doppelzählung |
| `DRUCK_JAHRE_BIS_ABGANG` | 2 | so viele Saisons in Folge muss der Druck über dem Halt liegen | 1 wäre „sofort", und dann kippt jeder an einem schlechten Wochenende; 3 heißt, ein Gespräch hat zwei Jahre Zeit |
| `SCHLUSS_JE_STUFE` | × 2,0 / 1,4 / 1,0 / 0,75 / 0,5 | Multiplikator auf das Schluss-Gewicht im Arbeiter-Zyklus, je Stufe 0–4 | flacher = das Alter entscheidet allein, ob ein 28-Jähriger weiterspielt |
| `KIPPEN_JE_STUFE` | 60 / 30 / 0 / 30 / 60 % | wie oft das Commitment am Horizont den Plan kippt (unten Bleiben → Wegzug, oben Wegzug oder Schluss → Bleiben) | höher = der Plan im Satz ist öfter falsch; bei 0 ist er die Wahrheit, und das Commitment hat am Horizont nichts zu sagen |

Gemessen beim Einbau (drei Seeds, acht Saisons, 415 Spieler): über den
Lebenslauf gehen **1,3–1,5 je Verein und Saison**, übers Alter weitere ~1,2 —
also rund 7 % des Kaders im Jahr. Mit den alten gleichverteilten
Wegzug-Kilometern (30–400) waren es 2,1–2,2: ab etwa 150 km ohne Auto ist der
Druck 99, und die Waage urteilt statt zu wägen. Deshalb ist der Wegzug jetzt
log-normal (Median 60 km beim Studenten, 80 beim Schüler, 40 beim Azubi,
Streuung 0,8 im Logarithmus) — die Mediane stehen als Modell in
`commitment.js`. Beim Start liegen 8–12 von 415 über dem Druck; sie sind nach
zwei Saisons weg.

**Nebenwirkung, gemessen und offen gelassen:** der Anteil der Studenten sinkt
über acht Saisons von ~19 % auf ~13 %, der der Arbeiter steigt von 62 % auf
~76 %. Der Rookie kommt mit 18–21 und ist damit selten Student; wer studiert,
wird nach drei bis fünf Jahren Arbeiter. Wer mehr Studenten will, dreht am
Rookie-Alter oder an der Student-Zeile nach dem Schulabschluss (55 %).

## 12 — Die Rolle: was der Manager zusagt und was die Bank kostet

*„Die Rollen-Kampagne nervt"* oder *„ich kann jedem alles versprechen".*
`engine/constants.js`, Modell in `engine/rolle.js`, Docs
[`naechste-schritte.md`](naechste-schritte.md) Block 7, Abschnitte
„Gespräche" und „Rolle". Der Manager sieht nie eine Zahl — nur die Rolle, die
Reaktion in Worten und, wenn es nicht mehr passt, eine Nachricht.

**Die Kampagne und das Kontingent**

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `GESPRAECHE_JE_WOCHE` | 3 | wie viele Gespräche eine Woche hergibt | die Knappheit ist der ganze Punkt; bei 5 ist ein Gespräch ein Knopf, bei 1 kommt die Kampagne nicht durch |
| `ROLLEN_FRIST_WOCHEN` | 2 | wie lange vor dem ersten Spieltag die Kampagne fertig sein muss | die letzten Preseason-Wochen gehören der Aufstellung, nicht dem Personal |
| `ROLLE_ANFRAGEN_MAX` | 4 | Deckel auf die Anfragen einer Woche | ohne ihn stand vor der Frist der ganze Rest an einem Tag — gemessen dreißig blockierende Nachrichten bei einem Manager, der nie antwortet. Über zwanzig Wochen wird trotzdem jeder mehrfach gefragt |
| `ROLLE_COOLDOWN_TAGE` | 21 | wie lange eine gesetzte Rolle steht | tiefer = die Rolle wird ein Regler an der Aufstellung statt einer Zusage; der Saisonwechsel setzt ihn ohnehin zurück |

**Die Reaktion beim Setzen**

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `ROLLE_JE_STUFE_ABSTAND` | 6 | Punkte je Stufe zwischen zugesagter und erwarteter Rolle | höher = Schmeicheln wirkt stärker, und der Rausch vor dem Kater wird größer |
| `ROLLE_DOWNGRADE_ZUSATZ` | 5 | Zuschlag je Stufe, die er **verliert** — Verlustaversion | 0 hieße: eine Vorgeschichte zählt nicht, und ein Abstieg fühlt sich an wie ein Neuanfang |
| `ROLLE_AENDERUNG_ABZUG` | 2 | was das Zurücknehmen einer Zusage an sich kostet | klein halten — er muss billiger bleiben als der laufende Mismatch |
| `ROLLE_ALTER_PERSPEKTIVE_MAX` / `_ERGAENZUNG_MIN` | 25 / 28 | bis wann „Perspektive" passt, ab wann „Ergänzung" | das Fenster dazwischen trägt beides ohne Bonus und ohne Abzug |
| `ROLLE_ALTER_JE_JAHR` / `_MAX_ABZUG` / `_BONUS` | 1,5 / 12 / 3 | was das unpassende bzw. passende Etikett kostet und bringt | höher = das Wort zählt mehr als die Einsatzzeit dahinter |
| `ROLLE_PERZENTIL_GRENZEN` | 0,90 / 0,70 / 0,45 | ab welchem Perzentil der Stab welche Rolle erwartet | höher = der Stab ist strenger, und jede Zusage darüber wirkt großzügiger |
| `ROLLE_PERZENTIL_POSITION_ANTEIL` | 0,75 | wie viel davon an der eigenen Position gemessen wird | 1,0 machte den Besten von drei schlechten Kickern zum unangefochtenen Stammspieler; 0 machte den zweiten QB zum Ergänzungsspieler |

**Der Bank-Drift**

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `ROLLE_ERWARTUNG` | 1,0 / 0,85 / 0,5 / 0,15 / 0,15 | welchen Anteil der Spiele eine Rolle verspricht | Perspektive und Ergänzung stehen mit Absicht gleich — ihr Unterschied ist das Alter, nicht die Zahl |
| `ROLLE_FENSTER` / `_MIN` | 4 / 3 | wie viele Spiele das rollierende Fenster fasst und ab wann gerechnet wird | 3 im Fenster ließe einen Rotationsspieler seine 0,5 nie treffen; größer = träger, vergibt aber auch langsamer |
| `ROLLE_TOLERANZ` | 0,15 | Grundmaß, das geschluckt wird, bevor das Commitment reagiert | höher = eine Rolle ist eine Richtung und keine Zusage |
| `ROLLE_TOLERANZ_JE_GRUPPE` | QB/OL 0 … DL 0,20 | Zuschlag je Coaching-Gruppe | ein Starter-QB erwartet fast jeden Snap, eine DL-Rotation ist im Sport normal |
| `ROLLE_MISMATCH_JE_ANTEIL` | 8 | Punkte je Anteilspunkt jenseits der Toleranz, **je Spiel** | die schärfste Schraube hier — siehe die Messung unten |
| `ROLLE_ERFUELLT_BONUS` | 0,8 | was ein Spiel bringt, in dem die Rolle gehalten wird | höher = ein Stammspieler läuft über eine Saison auf 99 |
| `ROLLE_OHNE_JE_SPIEL` | 1,2 | Abzug je Spiel für einen **ohne** Rolle, mal dem Anteil der Spiele, die er nicht bestritten hat | die Schraube dafür, wie teuer Ignorieren ist. Bei 1,2 kostet eine abgesessene Saison rund −9,6, während ein Vielspieler ohne Rolle bei −0,05 landet — das Feld ist seine Ansage |
| `ROLLE_BESCHWERDE_SCHWELLE` / `_COOLDOWN` | 0,3 / 28 Tage | ab wann er selbst nachfragt und wie lange er danach schweigt | tiefer/kürzer = das Postfach wird zur Spam-Quelle; die Nachricht läuft **ohne** das Empathie-Gate der Trend-Nachrichten |

**Gemessen beim Einbau** (acht Seeds `a`–`h`, drei Saisons, eigener Kader,
mittlere Commitment-Änderung gegen den Startwert und Zahl der Spieler auf
Stufe 0 „niedrig"):

| Strategie | Saison 1 | Saison 2 | Saison 3 |
| --- | --- | --- | --- |
| **passend** (Perzentil für die Stufe, Alter für Perspektive/Ergänzung) | +6,3 / 0,8 auf Stufe 0 | +12,0 / 0,4 | +17,7 / 0,6 |
| **alles versprechen** (jedem „unangefochten") | +1,1 / 2,6 | +1,5 / 5,6 | +6,6 / 5,4 |
| **keine Rolle** (jede Anfrage vertagen) | −2,4 / 0,5 | −3,9 / 1,1 | −5,7 / 2,1 |

Die drei Zeilen sind die Aussage des Bausteins: Pflege zahlt sich kumulativ
aus, Schmeicheln fühlt sich ein Jahr lang gut an und hinterlegt dauerhaft ein
Fünftel des Kaders auf der untersten Stufe, und wer gar nichts sagt, verliert
langsam, aber stetig — zwei Mann auf Stufe 0 nach drei Saisons.

**Vorsicht bei der ersten Zeile:** „passend" heißt *nicht*
`erwarteteRolle()` allein. Die Funktion kennt das Alter nicht und liefert für
jeden auf der Bank „Perspektivspieler" — auch für den 33-Jährigen, den das
kränkt. Wer so misst, bekommt +4,1 / +10,6 / +16,7 statt der Zahlen oben und
schreibt den Unterschied fälschlich dem Drift zu. Die Differenz von gut zwei
Punkten je Saison **ist** die Altersrechnung, und sie steckt allein im
Etikett.

**Je Spieler, nach Einsatzzeit getrennt** (acht Seeds, eine Saison, derselbe
Kader unter jeder Strategie; „viel" heißt ≥ 75 % der Spiele, „Bank" ≤ 25 %):

| Gruppe | keine Rolle | passend | oberste Rolle | unterste Rolle |
| --- | --- | --- | --- | --- |
| spielt viel (n=172) | −0,05 | **+6,89** | +12,32 | −6,62 |
| Bank (n=62) | −9,56 | **+4,61** | −31,00 | +0,75 |

Die Reihenfolge auf der Bank ist die Aussage: **passende Rolle (+4,6) vor
keiner Rolle (−9,6) vor der absurden Zusage (−31,0)**. Eine Rolle zu vergeben
lohnt sich, solange sie nicht völlig neben der Sache liegt — und Schweigen
ist kein Nullzustand mehr. Wer viel spielt, trägt daran fast nichts (−0,05):
das Feld ist seine Ansage. Am falschen Etikett trägt er ebenfalls ungleich
weniger als die Bank (−6,6 gegen −31,0). Eine Eigenschaft ist **nicht**
gewollt: für den
Vielspieler schlägt die oberste Rolle die passende um rund +6. Das ist genau
`ROLLE_JE_STUFE_ABSTAND` — einmalig dafür, dass er mehr hört, als sein
Perzentil hergibt — und es bleibt folgenlos, weil „Unangefochten" (1,0) und
„Starter" (0,85) bei einer Aufstellung fürs ganze Spiel dieselbe Forderung
sind: er spielt, oder er spielt nicht. Siehe den offenen Punkt unten.

**Offen, bis die Einsatzzeit ein Bruchteil ist:**

- **Erwartungswerte je Position gibt es nicht.** `ROLLE_ERWARTUNG` hängt allein
  an der Rolle; positionsabhängig ist nur die Toleranz. Dass eine DL-Rotation
  tatsächlich die Hälfte der Snaps sieht und ein zweiter Quarterback keinen,
  lässt sich heute nicht abbilden — der beobachtete Anteil ist 1,0 oder 0,0,
  ein erwarteter Wert dazwischen also gar nicht messbar. Gehört in den
  Depth-Chart-/Rotations-Umbau: dort ersetzt ein Bruchteil das Ja/Nein, und
  `ROLLE_ERWARTUNG` wird zu einer Tabelle Rolle × Coaching-Gruppe.
- **Die fünf Rollen trennen sich dadurch erst dann wirklich.** Heute sind es
  praktisch zwei Verhaltensweisen — „muss spielen" (Unangefochten, Starter,
  Rotation) und „muss nicht" (Perspektive, Ergänzung). Die Unterscheidung
  innerhalb der Gruppen liegt allein im Einmal-Effekt beim Setzen.

`ROLLE_MISMATCH_JE_ANTEIL` stand beim ersten Bau auf **12**. Damit landete
unter „alles versprechen" schon nach einer Saison ein **Viertel** des Kaders
auf Stufe 0 (7,3 von 30) — kein Lehrgeld, sondern ein Totalschaden ohne Weg
zurück. Mit 8 sind es 2,6 nach der ersten und 5,4 nach der dritten Saison.
Wer den Druck zurückwill, dreht hier und nirgendwo sonst.

Der Deckel `ROLLE_ANFRAGEN_MAX` kam aus derselben Messung: ohne ihn stellte
„nie reden" über eine Offseason **122** blockierende Anfragen, davon dreißig
am letzten Tag vor der Frist. Mit Deckel sind es 71, verteilt über die Wochen.

---

## 13 — Über persönliche Themen sprechen

*„Reden bringt nichts"* oder *„ich rede mir den Kader auf 99".*
`engine/constants.js`, Modell in `engine/gespraech.js`, Docs
[`naechste-schritte.md`](naechste-schritte.md) Block 7, Abschnitt „Gespräche".
Die Kategorie ohne Informationsertrag und ohne Risiko: ein Termin, eine
Viertelstunde, ein bisschen Nähe.

`GESPRAECHE_JE_WOCHE` steht in Abschnitt 12 und gilt seit dieser Kategorie für
**alle** gemeinsam — das Kontingent zählt Termine, nicht Rollen.

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `PERSOENLICH_GEWINN` | 1,6 | was ein Gespräch hebt, wenn es lange genug her ist | höher = die Grundpflege schlägt die Rolle; siehe die Messung unten |
| `NAEHE_SAETTIGUNG_TAGE` | 28 | nach wie vielen Tagen wieder der volle Satz anfällt, linear davor | ohne die Dämpfung wäre es rechnerisch immer richtig, dreimal die Woche mit demselben Mann zu reden |

**Warum überhaupt gedämpft wird.** Das Wochenkontingent begrenzt die **Rate**,
nicht das **Ziel**. Ohne Sättigung ist die beste Strategie, den
Schlüsselspieler dreimal pro Woche anzusprechen, bis er auf 99 steht — ein
Knopf mit Wartezeit statt eines Gesprächs. Mit ihr verteilt sich die Kategorie
über den Kader, und das ist auch das, was sie darstellen soll. Gezählt wird ab
dem **letzten Gespräch überhaupt**, nicht ab dem letzten persönlichen: wer
vorgestern über seine Rolle geredet hat, hat vorgestern geredet.

Kein harter Cooldown wie bei der Rolle. Die Rolle ist eine Zusage, die eine
Weile stehen muss, damit sie eine ist; reden kann man dagegen immer, es bringt
nur wenig kurz danach. Ein gesperrter Knopf hätte das Gegenteil erzählt.

**Gemessen beim Einbau** (acht Seeds `a`–`h`, drei Saisons, eigener Kader,
mittlere Commitment-Änderung gegen den Startwert / Spieler auf Stufe 0 —
dieselbe Harness wie in Abschnitt 12, die deren Zahlen reproduziert):

| Strategie | Saison 1 | Saison 2 | Saison 3 |
| --- | --- | --- | --- |
| nichts tun | −2,5 / 0,5 | −5,8 / 1,5 | −8,3 / 2,6 |
| nur Rolle (passend) | +6,1 / 0,8 | +12,8 / 0,9 | +19,8 / 0,9 |
| nur reden (keine Rolle gesetzt) | +3,1 / 0,3 | +5,1 / 0,5 | +7,5 / 0,9 |
| **Rolle + reden** | **+7,8 / 0,5** | **+15,9 / 0,8** | **+23,4 / 0,9** |

Die Reihenfolge ist die Aussage: **beides (+23,4) vor nur Rolle (+19,8) vor
nur reden (+7,5) vor nichts (−8,3)**. Reden allein rettet einen Kader, dem
niemand seine Rolle gesagt hat, aus dem Minus — aber es ersetzt die Rolle
nicht, es kostet nur die Termine, die sonst dafür da wären.

**Am Rand gerechnet, wo die Entscheidung wirklich fällt:** ein einzelnes
Rollengespräch mit einem Reservisten ist eine Saison lang rund **14 Punkte**
wert (+4,6 passend gegen −9,6 ohne Rolle, Abschnitt 12) und läuft danach in
den Cooldown. Ein persönliches Gespräch bringt 1,6. Es braucht also neun
davon, um eine einzige gesetzte Rolle aufzuwiegen — der Manager, der einen
freien Termin hat, redet; der, der die Wahl hat, setzt die Rolle. Genau diese
Reihenfolge war das Ziel.

Der Hebel für **einen** Mann ist trotzdem da: wer einen Wackelkandidaten
halten will, kann ihn alle vier Wochen ansprechen und kommt so auf rund +21
über eine Saison — für dreizehn Termine. Das ist teuer und deshalb eine echte
Entscheidung.

---

## 14 — Wunsch anhören

*„Der fragt doch nie jemand"* oder *„fragen ist der beste Zug im Spiel".*
`engine/constants.js`, Modell in `engine/wunsch.js`, Docs
[`naechste-schritte.md`](naechste-schritte.md) Block 7, Abschnitt „Wunsch
anhören". Die Kategorie, die **informiert** statt zu wirken: das Commitment
bewegt sich erst danach, auf dem Feld.

Zwei Wunscharten, beide mit einem **gerechneten Anlass** und nie aus einem
Würfelwurf: zurück auf den Ausbildungsplatz, und eine freie einstellige
Nummer. Ein Wunsch besteht auch ungefragt; was das Gespräch bringt, ist das
**Wissen** davon — und erst ab da zieht er. Wer nie fragt, zahlt nie, erfährt
aber auch nie, warum sein bester Mann leiser wird.

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `WUNSCH_LEER_GEWINN` | 0,8 | was das Fragen bringt, wenn nichts anliegt — gedämpft mit `NAEHE_SAETTIGUNG_TAGE` wie das Reden | höher = ein zweiter Knopf fürs persönliche Gespräch, nur anders beschriftet |
| `WUNSCH_EINSAETZE_MIN` | 6 | ab wie vielen Einsätzen auf einem fremden Platz „über längere Zeit" gilt | niedriger = jede Aushilfe wird zum Anlass |
| `WUNSCH_EIGNUNG_ABSTAND` | 4 | wie viel schlechter er dort sein muss, damit „deutlich schwächer" gilt | niedriger = Umschulen wird überall teuer, gegen die Grundregel |
| `WUNSCH_UEBERGANGEN_JE_SPIEL` | 1,2 | was ein Spiel kostet, das er nach dem Gespräch wieder woanders bestreitet | höher = Fragen wird zur Falle statt zur Auskunft |
| `WUNSCH_ERFUELLT_JE_SPIEL` | 0,8 | was ein Spiel auf dem gewünschten Platz bringt | siehe unten — hier stand zuerst eine einmalige 6 |
| `WUNSCH_NUMMER_BONUS` | 4 | was die einstellige Nummer bringt, wenn der Manager sie hergibt | höher = Nummern jagen schlägt alles andere |

**Der einmalige Bonus ist gemessen gescheitert.** Erst stand hier
`WUNSCH_ERFUELLT_BONUS = 6`, einmalig, und der Wunsch war danach erledigt. In
der Messung wurde **kein einziger** Wunsch dauerhaft erledigt: der Anlass
steckt in den Einsätzen, und die drehen sich durch ein einzelnes richtig
besetztes Spiel nicht um — beim nächsten Nachfragen stand derselbe Wunsch
wieder da. Fragen, richtig aufstellen, kassieren, von vorn: mit sechs Punkten
je Runde der mit Abstand beste Zug im ganzen Spiel, und niemand hätte es
gemerkt, weil er sich wie richtiges Spielen anfühlt.

Repariert an **zwei** Stellen statt mit einem Zähler am Spieler:

1. Der Anlass verlangt jetzt, dass der fremde Platz **mehr** Einsätze trägt als
   der eigene. Damit endet der Wunsch dort, wo sein Grund endet — wer
   zurückgestellt wird, holt Spiel für Spiel auf.
2. Der Lohn ist laufend und klein statt einmalig und groß, dieselbe
   Größenordnung wie `ROLLE_ERFUELLT_BONUS`. Der eigentliche Lohn fürs
   Erfüllen ist ohnehin, dass der Abzug aufhört.

**Gemessen** (sechzehn Seeds, drei Saisons, jeder Anlass sofort erfragt —
Positionswünsche sind zu selten für das Kader-Aggregat und werden einzeln
gezählt):

| Manager | Wünsche | erledigt | bis Saisonende offen |
| --- | --- | --- | --- |
| passiv, stellt nicht um | 23 | — | 23 Fälle, −3,6 Commitment, 43 Tage |
| stellt den Mann zurück | 77 | 48 Fälle, +0,8 nach 7 Tagen | 29 Fälle, −1,8, 40 Tage |

Dass der handelnde Manager **mehr** Wünsche auslöst, ist kein Fehler: wer
einen Mann auf seinen Platz stellt, verdrängt dort einen anderen. Der Kader
hat zweiundzwanzig Plätze, und die Kategorie macht sichtbar, dass jede
Korrektur woanders eine Ecke aufreißt.

**Und im Kader-Aggregat** (acht Seeds, dieselbe Harness wie Abschnitt 12 und
13, mittlere Commitment-Änderung / Spieler auf Stufe 0):

| Strategie | Saison 1 | Saison 2 | Saison 3 |
| --- | --- | --- | --- |
| nichts tun | −2,5 / 0,3 | −5,7 / 1,3 | −8,0 / 2,6 |
| nur Wünsche | −1,4 / 0,3 | −4,2 / 1,1 | −6,0 / 2,0 |
| nur reden | +3,0 / 0,3 | +5,2 / 0,6 | +7,6 / 1,1 |
| nur Rolle (passend) | +6,2 / 0,4 | +13,0 / 0,9 | +20,2 / 0,8 |
| Rolle + Wünsche | +7,3 / 0,4 | +14,4 / 0,8 | +21,9 / 0,8 |
| **Rolle + reden** | **+8,0 / 0,3** | **+16,2 / 0,9** | **+24,1 / 0,8** |

Die Aussage ist, dass **„nur Wünsche" mit −6,0 fast so schlecht dasteht wie
nichts zu tun** — und das ist richtig so. Die Kategorie ist ein Rundgang, kein
Hebel: wer einmal jeden gefragt hat, hat nichts mehr zu fragen, und die Termine
liegen brach. Wer dagegen reden könnte und stattdessen fragt, verliert (+5,8
gegen +7,6). Bezahlt wird das mit Information, nicht mit Bindung.

Rund **fünf Nummernwünsche je Kader und Saison** entstehen ungefragt; wer
regelmäßig fragt, hält den Vorrat bei etwa zwei. Positionswünsche sind mit
**einem halben je Kader und Saison** der seltene Ausnahmefall, den der
Fahrplan verlangt — Positionsverweigerung soll nie eine Mechanik sein, die bei
jeder Umstellung zieht.

---

## 15 — Überzeugen

*„Das passiert doch nie"* oder *„jede Umschulung geht schief".*
`engine/constants.js`, Modell in `engine/ueberzeugen.js`, Docs
[`naechste-schritte.md`](naechste-schritte.md) Block 7, Abschnitt
„Überzeugen". Die Gegenseite von Abschnitt 14: nicht der Spieler will etwas
vom Manager, sondern der Manager etwas vom Spieler.

Eine Ablehnung entsteht, wenn **drei** Dinge zusammenkommen — und genau daran
hängt, dass sie der Ausnahmefall bleibt, den die Grundregel verlangt: ein
Spieler, der sich weigert, raubt den Spaß am Umschulen, und Umschulen ist ein
Kern dieses Spiels.

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `UEBERZEUGEN_HEIMAT_MIN` | 25 | ab wie vielen Einsätzen auf seinem Hauptplatz er überhaupt jemand ist | niedriger = auch Ergänzungsspieler sperren sich, und die werden am häufigsten verschoben |
| `UEBERZEUGEN_HALT_GRENZE` | 40 | unter welchem Commitment er sich sperrt — die untere Hälfte, sichtbar im Personalreiter | höher = aus der Quittung für Vernachlässigung wird eine Eigenschaft |
| `UEBERZEUGEN_ABGELEHNT_JE_SPIEL` | 1,5 | was ein Spiel auf der abgelehnten Position kostet | etwas über `WUNSCH_UEBERGANGEN_JE_SPIEL`: einen Wunsch zu überhören ist Nachlässigkeit, ein Nein zu übergehen eine Ansage |
| `UEBERZEUGEN_SCHRITT` | 0,5 | wie weit ein Gespräch ihn auf der Strecke 0…1 bringt, mal Halt mal Nähe | höher = „Investment von Gesprächen" wird ein Klick |
| `UEBERZEUGEN_KOSTEN` | 0,8 | was jedes Drängen kostet, ob es zieht oder nicht | höher = es lohnt nie, niedriger = der Knopf ist gratis |
| `UEBERZEUGEN_HALT_MIN` / `_MAX` | 0,5 / 1,5 | wie stark der Halt das Tempo streckt | enger = Reden und Rolle zahlen nicht mehr aufs Überzeugen ein |

Die **Nähe** der Positionen ist keine eigene Tabelle, sondern dieselbe
Stufenleiter, mit der die Engine den Technikverlust rechnet
(`positionsNaehe()` in `positionen.js`, herausgezogen aus `leiterTransfer()`).
Die Frage ist beide Male dieselbe: wie weit ist der Weg von hier nach dort?
Zwei Landkarten desselben Geländes hätten sich irgendwann widersprochen.

**Gemessen, erstens: der normale Kader merkt nichts davon.** Acht Seeds, drei
Saisons, dieselbe Harness wie Abschnitt 14 — **null** Ablehnungen, und die
Strategietabelle aus Abschnitt 14 kommt Zahl für Zahl unverändert heraus. Das
ist kein totes Feature, sondern die Zielgröße: die automatische Aufstellung
verschiebt in 19 008 Platzbesetzungen 334-mal jemanden weit genug weg, aber
nie einen mit 25 Einsätzen auf dem eigenen Platz. Wer Stammspieler ist, bleibt
stehen; verschoben wird, wer übrig ist.

**Zweitens: den unzufriedenen Stammspieler gibt es, und er ist gemacht.** Acht
Seeds, fünf Saisons, Spieler am Saisonende nach Einsätzen daheim × Commitment:

| Führung | zufriedener Veteran | **unzufriedener Veteran** | zufrieden, wenig Einsätze | unzufrieden, wenig Einsätze |
| --- | --- | --- | --- | --- |
| nichts tun | 117 | **19** | 45 | 59 |
| Rolle + reden | 140 | **0** | 90 | 10 |

Unter guter Führung existiert die Voraussetzung **kein einziges Mal**. Damit
ist die Ablehnung keine Eigenschaft, die ein Spieler gezogen bekommt, sondern
die Rechnung für einen Mann, den man erst hat schlecht werden lassen und dann
quer über das Feld geschickt hat.

**Drittens: was sie kostet, wenn sie da ist.** Acht Seeds, fünf Saisons,
vernachlässigter Kader, ab Saison 3 je ein unzufriedener Stammspieler von Hand
quer über die Einheiten aufgestellt:

| Manager | Ausgang |
| --- | --- |
| stellt ihn dort auf und redet nicht | 8 Fälle, nach 460 Tagen alle noch offen, −24,6 Commitment |
| redet | 7 von 8 erledigt nach **6,7 Gesprächen** in 63 Tagen, −8,9 Commitment |

Sechseinhalb Gespräche sind gut zwei Wochen des ganzen Kontingents für einen
einzigen Mann — „Investment von Gesprächen" wörtlich, und teuer genug, dass
die Frage „brauche ich ihn dort wirklich?" eine echte bleibt. Der Weg über die
Einheiten hinweg kostet dabei rund doppelt so viele Gespräche wie der
innerhalb einer, weil die Nähe direkt im Schritt steht.

**Der zweite Weg ist Durchziehen.** Kippt sein Hauptplatz irgendwann auf die
abgelehnte Position — drei Saisons Einsätze **und** dort mindestens so stark
wie daheim —, erledigt sich der Eintrag von selbst: wer dort zu Hause
angekommen ist, sperrt sich nicht mehr. Das ist der teure Weg, weil er jedes
Spiel bis dahin 1,5 kostet, und bei einer wirklich absurden Umschulung endet
er nie, weil die Eignung nicht nachkommt. Dann bleibt nur das Reden.

**Ein erledigter Eintrag bleibt stehen** (Fortschritt genau 1). Ohne ihn
entstünde die Ablehnung im nächsten Spiel aus denselben drei Bedingungen
sofort neu — derselbe Fehler, der in Abschnitt 14 den einmaligen Bonus
zerlegt hat, nur mit umgekehrtem Vorzeichen.

---

## 16 — Nach der Lebenslage fragen: der Zeitpunkt einer Enthüllung

*„Der Plan in der Akte stimmt doch immer"* oder *„man erfährt es sowieso zu
spät".* `engine/constants.js`, Ziehung in `engine/commitment.js`, Gespräch in
`engine/auskunft.js`, Docs [`naechste-schritte.md`](naechste-schritte.md)
Block 7, Abschnitt „Nach Lebenslage fragen".

Die einzige der fünf Kategorien, die einen **neuen Zustand** einführt statt
einen vorhandenen zu verdrahten: neben dem Plan, den der Spieler erzählt,
steht die Wahrheit, und der einzige Weg dorthin führt über das Fragen — oder
über den Kalender, der sie irgendwann selbst aufdeckt.

| Konstante | Wert | Wirkung | Richtung |
| --- | --- | --- | --- |
| `WAHRHEIT_CHANCE` | 0,30 | wie oft ein frisch gezogener Plan nicht hält | niedriger = der Manager fragt neunzehnmal umsonst und hört auf, bevor der eine Fall kommt; höher = die Akte ist wertlos, und mit ihr der Personalreiter |
| `WAHRHEIT_ARTEN` | 50 / 50 | Abweichung im Zeitpunkt oder im Ausgang | mehr Zeitpunkt = lauter Verschiebungen, über die niemand handeln muss; mehr Ausgang = jede Enthüllung ist ein Schock |
| `WAHRHEIT_VERSCHIEBUNG` | +1: 45, +2: 25, −1: 30 | um wie viele Jahre der Zeitpunkt rutscht | Abschnitte im Leben ziehen sich, sie verkürzen sich selten |
| `WISSBAR_ANTEIL` | 0,30 … 0,90 | ab welchem Anteil der geplanten Strecke er es selbst weiß | Untergrenze höher = die Wahrheit kommt immer zu spät, um noch zu wirken; Obergrenze niedriger = das Gespräch wird ein Orakel |

Die Untergrenze ist **nicht** 0: ein Student mit Vier-Jahres-Plan weiß am Tag
der Einschreibung nicht, dass er in Jahr zwei abbricht. Bis dahin bestätigt er
im Gespräch ehrlich den alten Plan, und das ist keine Lüge, sondern eine
Auskunft über den Stand von heute. Eine Wurfchance auf „er verschweigt es"
wurde verworfen — sie machte aus einer Frage nach dem Leben ein Verhör mit
Trefferwahrscheinlichkeit.

**Gemessen, erstens: wie oft der Plan nicht hält.** Acht Seeds, sechs
Saisons, 2 880 gezählte Pläne im eigenen Kader:

| | Anteil |
| --- | --- |
| Pläne mit zweiter Wahrheit | 26,2 % |
| davon Abweichung im Zeitpunkt | 48,8 % |
| davon Abweichung im Ausgang | 51,2 % |

26 statt 30 %, weil die Zählung jeden Mann jede Saison mitnimmt: ein
aufgedeckter oder eingetretener Plan läuft eine Weile ohne Wahrheit weiter.
Die häufigste Verschiebung ist `bleibt → wegzug` (148 Fälle), gefolgt von
`wegzug → bleibt` (78) und `bleibt → schluss` (58) — also überwiegend
schlechte Nachrichten, und das ist richtig so: an einer guten muss niemand
arbeiten.

**Zweitens: wie viel Vorlauf das Fragen bringt.** Jahre zwischen dem Jahr, ab
dem er es selbst weiß, und dem Eintreten:

| Vorlauf | 0 | 1 | 2 | 3 | 4 | 5 |
| --- | --- | --- | --- | --- | --- | --- |
| Anteil | 15,1 % | 25,7 % | 31,6 % | 20,2 % | 6,6 % | 0,8 % |

Mittel **1,8 Jahre**. Das ist die Zahl, an der die Kategorie hängt: bei zwei
Jahren Vorlauf kann der Manager noch etwas tun, denn am Horizont dreht
`gekippt()` einen Wegzug bei hoher Commitment-Stufe mit 60 % in ein Bleiben
(Abschnitt 11). Die Kette ist also **fragen, erfahren, handeln** — und die
15 % ohne Vorlauf sind der Preis dafür, dass sie nicht garantiert ist.

**Drittens: was systematisches Fragen einbringt.** Derselbe Lauf, einmal mit
einem Manager, der jeden fragt, sobald er es wissen könnte, und einmal mit
einem, der nie fragt. Von 109 eingetretenen Wahrheiten:

| | Fälle | Anteil |
| --- | --- | --- |
| vorher erfahrbar gewesen | 66 | 60,6 % |
| erst mit dem Ereignis | 43 | 39,4 % |

Drei von fünf Abgängen und Wegzügen kündigen sich also an, wenn man fragt —
und zwei von fünf eben nicht. Der Rest kommt über den Kalender: **läuft das
geplante Jahr ab, ohne dass etwas geschieht, übernimmt die Akte die Wahrheit
von selbst.** Sonst stünde dort drei Jahre lang „noch dieses Jahr Studium",
und ein Manager hielte das für einen Fehler im Spiel. Wer fragt, erfährt es
früher — er erfährt es nicht als Einziger, und das ist der Unterschied
zwischen einem Vorsprung und einem Geheimnis.

**Die Strategietabelle aus Abschnitt 14 bleibt stehen.** Acht Seeds, drei
Saisons: nichts tun −8,3 / 3,0, „Rolle + reden" +23,5 / 0,9 (vorher −8,0 / 2,6
und +24,1 / 0,8). Die Abweichung im Zehntel kommt daher, dass die Ziehung der
Wahrheit einen Wurf je Mensch und Jahr in den Strom des Saisonwechsels legt;
Reihenfolge und Größenordnung der Strategien sind unverändert.

---

## Was nicht hier steht

Formeln (`FORMELN`, `PROFIL_BEITRAG`, `KOERPER_KORRIDOR`), die Blockgewichte
(`BLOCK_GEWICHT`, `PLATZ_ANTEIL`, `SKILL_LEITER`, `SKILL_ROLLE`), die
Ähnlichkeit der Coaching-Gruppen und die Struktur der Saison. Das sind
Modelle: wer daran dreht, ändert, *was* das Spiel beschreibt, nicht *wie
stark*. Sie haben eigene Dokumente und meist einen Test, der die
abgenommenen Zahlen festhält.
