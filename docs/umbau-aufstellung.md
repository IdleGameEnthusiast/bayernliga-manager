# Aufstellung von Hand

Die Aufstellung war bis hierher eine Rechnung: `stelleAuf()` hat aus Stärke und
Eignung zweiundzwanzig Plätze besetzt, und der Manager durfte zusehen. Er konnte
die Gruppierung wählen und den Regler schieben — *wer* spielt, hat er nie
entschieden.

Jetzt entscheidet er es. Was er nicht entscheidet, entscheidet weiter die
Automatik, und zwar mit denselben Regeln wie vorher.

Gehört zu Block 5 aus [`naechste-schritte.md`](naechste-schritte.md); das
Positionsmodell darunter steht in [`umbau-positionsmodell.md`](umbau-positionsmodell.md).

---

## 1 — Die Vorgabe

Der Speicherstand hält **eine dünne Karte**: Platz-Schlüssel auf Spieler-Id,
unter `stand.aufstellung`, und nur für den eigenen Verein.

```js
{ QB: 'p17', LT: 'p4', CB1: 'p22' }
```

Mehr steht nicht darin, und das ist Absicht. Sie hält die *Entscheidung* fest —
wer wo steht — und nichts, was daraus folgt: ob er dort umgestellt ist, ob er
doppelt spielt, was er auf dem Platz wert ist, rechnet `stelleAuf()` bei jedem
Aufruf neu. Eine Karte ohne abgeleitete Werte kann nicht veralten.

Sie darf **lückenhaft** sein und sie darf **zu weit** sein:

- Ein Platz ohne Eintrag wird von der Automatik gefüllt.
- Ein Eintrag auf einen Platz, den die aktuelle Gruppierung nicht hat, wird
  überlesen — und steht wieder, sobald der Manager das System zurückstellt.
- Eine Id ohne Spieler (verletzt, verkauft, zurückgetreten) wird überlesen, aber
  **nicht gelöscht**: der Mann kommt aus der Verletzung zurück auf seinen Platz.
  Erst der Saisonwechsel wirft die Zurückgetretenen aus der Karte, damit ein
  Stand nach zehn Jahren nicht mehr Vergangenheit als Aufstellung enthält.

### Warum Plätze Schlüssel brauchen

Der Platzname allein reicht nicht: 12 personnel stellt **zwei** Tight Ends auf,
00 personnel drei Slotreceiver. Der erste behält den nackten Namen, der zweite
heißt `TE#2`, der dritte `TE#3`. Damit heißt in 11 personnel jeder Platz genau
so, wie er auf dem Feld heißt, und eine Vorgabe verschiebt sich nicht, wenn der
Verein das System wechselt.

## 2 — Runde null

`stelleAuf()` hat drei Runden gehabt: eigene Position, Umsteller, Doppeleinsatz.
Davor steht jetzt **Runde null**, und sie fragt nichts nach: wer in der Vorgabe
steht, steht auf dem Platz.

Die drei alten Runden sind damit unverändert und zugleich etwas Neues — der
**Reparaturweg**. Sie füllen, was die Vorgabe offen lässt: den Verletzten, den
Abgang, den Platz, den es im neuen System vorher nicht gab. Es braucht dafür
keine zweite Regel; es ist dieselbe.

Ohne Vorgabe ist Runde null leer, und es bleibt bei den drei Runden von vorher.
Die Liga hat sich durch den Umbau um keinen Punkt bewegt: die
Automatik-Aufstellung, wieder als Vorgabe eingefroren, ergibt Platz für Platz
dieselbe Elf.

## 3 — Tauschen statt Verdrängen

Wer auf einen besetzten Platz gestellt wird, schickt den, der dort stand, auf
seinen eigenen alten. Sonst wäre jeder Zug zwei Züge, und der Manager müsste
nach jedem Handgriff den Verdrängten suchen.

Kommt der Neue von der Bank, geht der Alte auch nirgendwohin: sein Platz fällt
an die Automatik zurück. Und stand der Neue doppelt, erbt nur seine *erste*
Stelle den Verdrängten — ein Doppeleinsatz ist ein Notnagel und soll sich nicht
durch die Aufstellung weitervererben.

## 4 — Zwei Tipps, kein Ziehen

Die Ansicht ist für den Daumen gebaut. Gezogen wird nichts, und der Weg geht in
**beide Richtungen** — je nachdem, ob der Manager einen Platz vor sich hat oder
einen Mann.

**Platz zuerst.** Der Platz wird angetippt und markiert, darunter klappen die
**fünf Besten für ihn** auf, jeder mit dem Wert, den er *dort* hätte, und mit
der Marke, mit wem der Wechsel ein Tausch wäre. Einer davon angetippt — fertig.
Wer jemand anderen will, wählt ihn im Roster und bestätigt oben in der
**Wechselleiste**, die am Bildschirmrand klebt; der zweite Tipp passiert weit
unten, und ohne sie müsste man für jeden Wechsel zweimal scrollen.

Die fünf Besten beantworten „wer ist hier der Beste", nicht „was ist fürs Ganze
am besten". Das zweite ist die Frage von `verteile()` und hat eine andere
Antwort; unter einem angetippten Platz will darüber niemand nachdenken müssen.

Über der Liste steht ein Schalter **Starter**, standardmäßig an. Abgeschaltet
nimmt er die Elf aus der Liste, und die Überschrift sagt es auch: „Die Besten,
die noch nicht stehen". Der Grund ist gemessen und nicht theoretisch — auf einem
Receiverplatz waren vier der fünf Besten Leute, die ohnehin schon spielen, jeder
mit der Marke „tauscht mit …". Wer nach einem Ausfall einen Ersatz sucht, sucht
aber genau die anderen, und die standen unter der Kante. Gefiltert wird in der
Ansicht, nicht in der Engine: `bestenFuer()` bekommt schlicht einen kürzeren
Kader.

**Mann zuerst**, und das ist die häufigere Frage: ein Tipp auf die Rosterzeile,
und **jeder** der zweiundzwanzig Plätze wird zum Knopf. Rechts stehen dann zwei
Zahlen — was der bringt, der dort steht, und was der Gewählte dort brächte,
grün, wo er den Platz verbessert. Damit steht die ganze Entscheidung
zweiundzwanzigmal nebeneinander, statt Platz für Platz erfragt werden zu
müssen. Der zweite Tipp setzt ein.

Dafür muss kein Platz frei sein und keiner vorgemerkt: „wohin mit ihm" ist eine
Frage an die Elf, nicht an eine Lücke.

**Der Roster markiert seine Starter** — grüner Balken an der Zeile, dahinter der
Platz, den der Mann hält. Die Marke beantwortet die Frage rückwärts, wie sie
gestellt wird: nicht „wer steht", sondern *wer steht nicht*. Und weil eine
Rosterzeile jetzt auswählt, hat das Aufklappen der fünfzehn Werte einen eigenen
Knopf am Zeilenende bekommen. Zwei Bedeutungen auf derselben Fläche gehen nicht
auf; Aufstellen ist die Handlung dieser Ansicht, Werte nachsehen die
Nebensache.

Ein Knopf **Automatisch** wirft die Vorgabe weg. Er steht nur da, wenn es eine
gibt — er *ist* das Vergessen, keine zweite Aufstellungslogik.

## 4a — Entwurf, Speichern, Rückfrage

Bearbeitet wird nicht mehr im Spielstand. Jeder Handgriff wächst in einem
**Entwurf**, den nur die Ansicht kennt; erst der Knopf **Speichern** schreibt
ihn in `stand.aufstellung` und in den `localStorage`.

Der Grund ist die halb gebaute Elf. Wer seine Aufstellung von Grund auf stellt,
hat zwischendurch elf Löcher — und die dürfen nicht schon gelten, nur weil er
noch nicht fertig ist. Nebenbei wird die Ansicht dadurch ehrlich: sie rechnet
den Entwurf durch, Mannschaftsteile eingerechnet, und zeigt, was gälte.

- **Gespeichert wird nur eine vollständige Elf.** `setzeAufstellung()` lehnt
  alles andere ab, und der Knopf ist so lange gesperrt. Daraus folgt eine
  Eigenschaft, auf die sich alles Übrige verlassen kann: **eine gespeicherte
  Vorgabe enthält nie ein `null`.** Der freie Platz existiert nur im Entwurf.
  Die Migration streicht ein `null` deshalb beim Laden weg — im Spiel entsteht
  es nie, nur in einer von Hand bearbeiteten Datei.
- **Verwerfen** wirft den Entwurf weg. Es stand nie etwas davon im
  Speicherstand, also ist das nichts weiter als Vergessen.
- **Wer die Ansicht verlässt, wird gefragt.** Reitertipp, Spieltag simulieren,
  nächste Saison — alles, was von der Aufstellung wegführt, geht durch einen
  Wächter. Ist der Entwurf vollständig, heißen die Antworten *Speichern* und
  *Verwerfen*; ist er es nicht, kann er gar nicht gespeichert werden, und dann
  heißt die erste *Weiter bearbeiten*, weil sonst nur die Wahl zwischen Verlust
  und Verlust bliebe.

Kein `confirm()` dafür: das kennt zwei Antworten, und die heißen OK und
Abbrechen. „Speichern" und „Verwerfen" sind aber beide ein Ja. Die Rückfrage
steht deshalb als eigenes Blatt in `ui/frage.js`, mit einem Knopf je Antwort.

### Der ausdrücklich freie Platz

**Aufstellung löschen** räumt alle zweiundzwanzig Plätze. Dafür kann eine
Vorgabe seit diesem Schritt mehr als „hier steht der und der" sagen: ein
Eintrag mit dem Wert `null` heißt **hier soll niemand stehen**, und daran gehen
die Reparaturrunden vorbei. Ohne diesen Unterschied wäre das Leeren wirkungslos
— die Automatik füllte jeden geräumten Platz sofort wieder auf.

Das ist die eine Stelle, an der die alte Regel „kein Platz bleibt je leer"
nicht mehr gilt. Sie gilt weiter für alles, was gespeichert werden kann; sie
gilt nicht mehr für das, was gerade gebaut wird.

Wer aus einer geräumten Aufstellung heraus umzieht, lässt seinen Platz **frei**
zurück statt der Automatik: `setzePlatz()` vererbt, was am Ziel stand, und das
ist dort eben ein `null`.

## 5 — Was das im Code angefasst hat

| Datei | Was |
| --- | --- |
| `engine/aufstellung.js` | `schluessel` am Platz, Runde null, `alsVorgabe()`, `setzePlatz()`, `bestenFuer()` |
| `engine/team.js`, `engine/spiel.js` | die Vorgabe durchgereicht; ein `Antritt` hat jetzt eine |
| `engine/saison.js` | `stand.aufstellung`, `eigeneAufstellung()`, `setzeAufstellung()`, `automatischAufstellen()`, `aufstellungVon()` |
| `engine/save.js` | das Feld nachgetragen — additiv, ohne Versionssprung |
| `ui/aufstellung.js` | neu: die Karte, die Kandidaten, die Wechselleiste (aus `ui/taktik.js` ausgezogen) |
| `ui/kader.js` | die Auswahl, der Roster im Auswahlmodus, der Entwurf statt des Stands |
| `ui/frage.js` | neu: die Rückfrage, ein Knopf je Antwort |
| `app.js` | der Entwurf, die Handler, der Wächter vor jedem Weg aus der Ansicht |

**Kein Versionssprung.** Ein Stand ohne das Feld ist ein Stand ohne Vorgabe —
kein Mangel, sondern ein Manager, der nie eingegriffen hat. Es gibt nichts zu
retten, nur etwas nachzutragen, und dafür ist die Migration da.

## 6 — Offene Punkte

1. **Die KI stellt weiter automatisch auf.** Ein fremder Verein *kann* keine
   Vorgabe haben — niemand stellt ihn auf. Das ist entschieden, aber es heißt
   auch: der Manager spielt gegen elf Mannschaften, die immer optimal stehen.
2. **Umstellungshäufigkeit neu messen.** Bisher waren 11 von 264 Plätzen
   Umstellungen, und alle elf derselbe fehlende Tight End. Sobald von Hand
   gestellt wird, entstehen echte. Erst danach lassen sich der Deckel auf die
   Umstellungskosten (Punkt 2 in `umbau-positionsmodell.md`) und die
   Verletzungsrate (Punkt 4 dort) entscheiden — sie hängen beide daran.
3. **Der Doppeleinsatz beim Einfrieren.** Steht ein Mann in beiden Einheiten,
   trägt den Abzug der Platz, der zuletzt besetzt wurde. Friert man dieselbe
   Elf als Vorgabe ein, kann das der andere der beiden Plätze sein. Dieselben
   Leute, dieselbe Elf, ein paar Zehntel anders verteilt. Auffällig wird das
   erst bei vielen Verletzten — und dann ist die Verletzungsrate die Frage,
   nicht dies.
4. **Keine Bank, keine Rotation.** Wer nicht in der Elf steht, steht nirgends.
   Ersatzleute, Wechsel im Spiel und Belastungssteuerung gehören zusammen und
   gehören nicht hierher.

## 7 — Entscheidungslog

| Thema | Entscheidung |
| --- | --- |
| Form der Vorgabe | flache Karte Platz-Schlüssel → Spieler-Id, keine zweite Aufstellung |
| Ort | `stand.aufstellung`, nur der eigene Verein; KI-Vereine bekommen nie eine |
| Doppelte Plätze | laufende Nummer ab dem zweiten: `TE`, `TE#2`, `TE#3` |
| Reihenfolge | Runde null vor allem anderen; die drei alten Runden reparieren |
| Fehlender Spieler | überlesen, nicht gelöscht — er kommt zurück |
| Fremder Platz | überlesen, nicht gelöscht — das System kann zurückgestellt werden |
| Saisonwechsel | Zurückgetretene fallen aus der Karte |
| Einsetzen | Tausch, nicht Verdrängung; von der Bank fällt der Alte an die Automatik |
| Bedienung | zwei Tipps, kein Ziehen — Tablet zuerst |
| Richtung | beide: Platz zuerst *und* Mann zuerst; kein Platz muss frei oder vorgemerkt sein |
| Kandidatenliste | die fünf Besten **für diesen Platz**, nicht global optimiert |
| Schalter Starter | an als Standard; aus zeigt die fünf Besten, die noch nicht stehen — gefiltert wird der Kader, nicht die Regel |
| Vorschau | im Zielmodus steht an jedem Platz die Zahl des Gewählten neben der des Manns, der dort steht |
| Rosterzeile | wählt aus; die fünfzehn Werte bekommen einen eigenen Knopf am Zeilenende |
| Startermarke | grüner Balken plus Platzkürzel — die Frage ist, wer *nicht* steht |
| Speicherstand | additiv, kein Versionssprung |
| Bearbeiten | im Entwurf, nicht im Stand; erst „Speichern" schreibt |
| Speicherbedingung | nur eine vollständige Elf — also enthält eine gespeicherte Vorgabe nie ein `null` |
| Freier Platz | `null` als Wert, nur im Entwurf; die Reparaturrunden gehen daran vorbei |
| Verlassen der Ansicht | Rückfrage; unvollständig heißt „Weiter bearbeiten" statt „Speichern" |
| Rückfrage | eigenes Blatt statt `confirm()` — beide Antworten sind ein Ja |
