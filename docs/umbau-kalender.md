# Umbau: Kalender und Postfach

Die Spezifikation für den Schritt, der aus dem Spieltag-Ticker ein Tagesspiel
macht: ein Posteingang als erster Bildschirm, eine Uhr, die in Tagen läuft, und
ein Weiterspielen, das von selbst dort anhält, wo eine Entscheidung fällig ist.
Vorbild ist der Fußball Manager 2013.

Diese Datei hält die Entscheidungen fest, die im Gespräch gefallen sind und
sonst nirgends stehen. Es gelten die Leitplanken aus
[`naechste-schritte.md`](naechste-schritte.md) — kein Build, `engine/` fasst
kein DOM an, sichtbare Texte nur in `i18n.js`, Zufall wird injiziert.

---

## 1. Warum das mehr ist als ein neuer Reiter

Zwei Dinge im heutigen Code sehen aus wie Kleinigkeiten und sind es nicht.

**`spieltag` ist gleichzeitig drei Dinge.** Er ist die Nummer der Runde, er ist
die Uhr (`verletztBis = spieltag + wochen`,
[`engine/spieler.js`](../engine/spieler.js)) und er ist der Zufallsschlüssel
(`seed|jahr|spieltag`, `spieltagRng` in [`engine/saison.js`](../engine/saison.js)).
Solange ein Spieltag die kleinste Zeiteinheit war, fiel das nicht auf. Ein
Kalender bricht die drei Rollen auseinander, und jede muss einzeln beantwortet
werden.

**`verlauf` ist der halbe Posteingang — nur falsch gespeichert.** Er hält
fertig gerenderte Sätze, und genau deshalb muss `engine/saison.js` heute
`i18n.js` importieren. Das ist die eine dokumentierte Ausnahme von „engine
kennt kein außen" im README. Das Postfach löst sie auf, statt sie zu
vergrößern: eine Nachricht speichert einen Schlüssel und ihre Daten, nie einen
Satz.

---

## 2. Die gefallenen Entscheidungen

| Frage | Entscheidung | Warum |
| --- | --- | --- |
| Zeiteinheit | **Der Tag ersetzt den Spieltag** als Uhr | Feiner, und Training, Transfers und Sperren später brauchen ohnehin einen Tag |
| Zufallsschlüssel | **`seed\|jahr\|tag`** | Konsequent; spätere Tagesereignisse hängen am selben Strom. Preis ist bekannt, siehe 8. |
| Saisongrenze | **Dritter Samstag im Oktober** | Saison 2027 beginnt am 17.10.2026 |
| Alterung, Rücktritte | **Am Tag 1 der neuen Saison** | Solange es keine Geburtstage gibt, ist der Saisonübergang der einzige ehrliche Zeitpunkt |
| Spielzeitraum | **Mitte April bis Ende Juli** | Wie die echte Bayernliga. Der Oktoberwechsel eröffnet ein halbes Jahr Vorbereitung |
| Kalenderumfang | **Volles Saisonjahr mit Phasen** | Die Offseason ist heute leer, aber sie ist der Haken für Transfers und Rekrutierung |
| Weiterspielen | **„Weiter" plus „Weiter bis …"**, mit Zwangsstopps | Ein Ziel darf nie über ein Spiel oder eine Antwortpflicht hinweglaufen |
| Fußleiste | **Fällt weg** | Der Sprung gehört in den Kalender, nicht unter jeden Bildschirm |
| Erster Reiter | **Kalender oben, Post darunter** | Ein Bildschirm; man sieht immer, wo man im Jahr steht |
| Reiter „Verlauf" | **Geht im Postfach auf** | Gelesene Nachrichten *sind* das Archiv. Fünf Reiter bleiben fünf |
| Nachrichtentexte | **Schlüssel + Daten, nie gerenderte Sätze** | Löst die `i18n`-Ausnahme in der Engine auf, hält den Speicherstand klein |

---

## 3. Das Zeitmodell

```js
jahr: 2027,   // Saisonlabel. Saison 2027 beginnt am 17.10.2026
tag: 183,     // Tag seit Saisonbeginn, 1-basiert
```

`spieltag` verschwindet aus dem Spielstand. Er bleibt als **Etikett** an der
Partie hängen — beim Auslosen vergeben, nie neu gerechnet —, weil „Spieltag 5"
ein Begriff des Sports ist und nicht nur eine Zählung.

### Die Eigenschaft, die alles billig macht

Von drittem Oktobersamstag zu drittem Oktobersamstag sind es **immer volle
Wochen**: 364 Tage, alle paar Jahre 371.

```
Saison 2026  Sa 18.10.2025      Saison 2030  Sa 20.10.2029
Saison 2027  Sa 17.10.2026      Saison 2031  Sa 19.10.2030
Saison 2028  Sa 16.10.2027      Saison 2032  Sa 18.10.2031
Saison 2029  Sa 21.10.2028  ←   371 Tage
```

Daraus folgt dreierlei:

- **Tag 1 ist immer ein Samstag.** Der Wochentag ist `(tag - 1) % 7` — eine
  Modulorechnung, kein Kalender.
- **Jeder Spieltag liegt auf `tag ≡ 1 (mod 7)`.** Die Terminplanung braucht
  überhaupt kein `Date`.
- Die 53-Wochen-Saison ist eine zusätzliche Woche Sommerpause und sonst nichts
  — **sofern der Spielplan vom Saisonanfang aus gerechnet wird und nie
  rückwärts vom Ende.** Wer rückwärts rechnet, verschiebt in diesen Jahren die
  ganze Saison um eine Woche und merkt es erst 2029.

### `engine/kalender.js`

Neu, rein, ohne Zustand. Der einzige Ort im Projekt, an dem `Date` vorkommt —
ausschließlich `Date.UTC`, ausschließlich zum Anzeigen eines Datums. Im
Speicherstand steht nie ein `Date`.

```js
saisonStart(jahr)          // → { j, m, t } — dritter Samstag im Oktober (jahr-1)
saisonLaenge(jahr)         // → 364 | 371
datum(jahr, tag)           // → { j, m, t, wochentag }
wochentag(tag)             // → 0..6, 0 = Samstag. Reine Modulorechnung
SPIELTAG_TAGE              // [183, 190, …] — die Saisonform als Daten
tagVonSpieltag(nr)         // Etikett → Tag
spieltagAmTag(tag)         // Tag → Etikett | null
phaseAmTag(tag)            // 'vorbereitung'|'gruppe'|'playoffs'|'sommerpause'
```

`SPIELTAG_TAGE` als Konstantenliste ist zugleich die Antwort auf „welche
Saisonform" beim nächsten Formatwechsel — sie steht an einer Stelle, nicht
verteilt über drei Rechnungen.

---

## 4. Das Saisonjahr

Saison 2027, Tag 1 = Sa 17.10.2026:

| Tag | Datum | Phase |
| --- | --- | --- |
| 1 | Sa 17.10.2026 | **Saisonwechsel**: Alterung, Rücktritte, Nachwuchs, Auslosung |
| 2–182 | Okt – Apr | Vorbereitung — heute leer, später Transfers und Training |
| 183 | Sa 17.04.2027 | Spieltag 1 |
| 190, 197, 204, 211 | wöchentlich | Spieltage 2–5 |
| 218 | Sa 22.05.2027 | spielfrei |
| 225, 232, 239, 246, 253 | wöchentlich | Spieltage 6–10 |
| 267 | Sa 10.07.2027 | Halbfinale |
| 281 | Sa 24.07.2027 | Finale |
| 282–364 | Jul – Okt | Sommerpause |

Die spielfreie Woche nach Spieltag 5 ist neu. Sie kostet nichts und ist der
Grund, warum das Bracket zwei Wochen Abstand bekommt statt einer: der Spielplan
darf atmen, sobald ein Kalender darunter liegt.

---

## 5. Zustandsform, Version 5

```js
/**
 * @typedef {object} SpielStand
 * @property {number} version        5
 * @property {string} seed
 * @property {number} jahr           Saisonlabel
 * @property {number} tag            Tag seit Saisonbeginn, 1-basiert    ← neu
 * @property {string} meinTeam
 * @property {Record<string, Spieler[]>} kader
 * @property {Partie[]} spielplan
 * @property {Record<string, string>} personnel
 * @property {Record<string, number>} passAnteil
 * @property {Vorgabe | null} aufstellung
 * @property {Nachricht[]} post                                          ← neu
 * @property {{ jahr, meister, meinPlatz }[]} historie
 */
```

`spieltag` fällt weg. `verlauf` fällt weg — es geht in `post` auf.

### Die Nachricht

```js
/**
 * @typedef {object} Nachricht
 * @property {string} id       `${jahr}-${tag}-${lfd}` — deterministisch, nie Date.now()
 * @property {number} jahr
 * @property {number} tag
 * @property {string} art      Schlüssel in T.post
 * @property {Record<string, any>} daten   spielerId, spieltagNr, gegner, wochen …
 * @property {boolean} gelesen
 * @property {string | null} antwort  null = offen; nur bei Arten mit Antwortpflicht
 */
```

**Kein Text im Speicherstand.** `i18n.js` bekommt `T.post[art]` mit
`von`, `betreff(daten)` und `text(daten)`. Damit lassen sich Texte ändern, ohne
alte Speicherstände zu verfälschen, eine Nachricht wiegt rund 120 statt 400
Bytes — und `engine/` muss `i18n.js` nicht mehr importieren.

Die `id` wird aus `jahr`, `tag` und einer laufenden Nummer gebaut, nie aus
`Date.now()` oder dem Zufall: derselbe Speicherstand muss beim erneuten Spielen
dieselben Nachrichten mit denselben Kennungen ergeben.

### Die Partie

`tag` kommt dazu und ist ab jetzt das Autoritative. `spieltag` bleibt als
Etikett, `runde` bleibt.

---

## 6. Migration v4 → v5

Additiv, nichts wird erfunden — anders als beim abgelehnten v3-Stand gibt es
hier für jedes Feld eine ehrliche Umrechnung:

```js
stand.tag           = tagVonSpieltag(stand.spieltag);
partie.tag          = tagVonSpieltag(partie.spieltag);
spieler.verletztBis = verletztBis <= 0 ? 0 : tagVonSpieltag(verletztBis);
stand.post          = [];   // alte verlauf-Zeilen bleiben Zeilen, siehe unten
```

Der `verlauf` eines alten Standes wird **nicht** in Nachrichten übersetzt — aus
einem fertigen Satz ließe sich `art` und `daten` nur durch Raten
zurückgewinnen. Er wandert als Liste alter Zeilen unter das Archiv im Postfach
und stirbt mit der Zeit aus.

`STORAGE_KEY` wird `bayernliga.save.v5`; `lade()` liest zuerst den v5-Schlüssel
und fällt auf den v4-Schlüssel zurück, migriert und schreibt unter dem neuen.

### Die Verletzungen kosten nichts

`verletztBis = spieltag + wochen` wird zu `verletztBis = tag + wochen * 7`. Bei
wöchentlichen Spieltagen ist das **exakt dieselbe Zahl verpasster Spiele** —
`INJURY_MIN_WEEKS` und `INJURY_MAX_WEEKS` bleiben unangetastet, es gibt nichts
neu zu eichen. Der einzige Unterschied entsteht an der spielfreien Woche: eine
Verletzung, die darüber liegt, kostet ein Spiel weniger. Das ist richtiger, nicht
kaputt.

`istFit(s, spieltag)` wird zu `istFit(s, tag)` — dieselbe Funktion, andere
Einheit.

---

## 7. Der Tick

`spieleSpieltag()` wird intern. Nach außen steht eine Funktion:

```js
weiter(stand, zielTag = null)
  → { bisTag, grund: 'spiel'|'antwort'|'phase'|'ziel', nachrichten, partien }
```

Die Schleife: Tag hochzählen, an jedem Tag die fälligen Nachrichten erzeugen,
bei einem Spieltag anhalten **bevor** simuliert wird. Ohne `zielTag` läuft sie
bis zum nächsten Stopp; mit `zielTag` bis dorthin oder bis zum ersten
Zwangsstopp davor — je nachdem, was zuerst kommt.

Darunter zwei reine Funktionen, einzeln testbar:

```js
naechsterStopp(stand)        // → { tag, grund } — ohne den Stand zu ändern
ereignisseAmTag(stand, tag)  // → Nachricht[]
```

### Zwangsstopps

Kein Ziel läuft über diese hinweg:

1. **Spieltag des eigenen Vereins.** Angehalten wird am Morgen, *vor* dem
   Anpfiff — nicht am Vortag. Aufstellung, Taktik und später Ansprache und
   Gameplan gehören in diesen Moment.
2. **Nachricht mit Antwortpflicht.** Solange `antwort === null` ist, geht kein
   Tag weiter.
3. **Phasenwechsel.** Saisonwechsel, Beginn der Gruppenrunde, Saisonende.

Fremde Spieltage halten nicht an: sie werden im Vorbeigehen simuliert und
landen als Ergebnismeldung im Postfach.

**Eine unvollständige oder verletzungsbedingt ungültige Aufstellung ist ein
Stopp, kein stiller Auto-Fix.** Heute füllt `automatischAufstellen` das
kommentarlos auf; im Kalender wird daraus eine Nachricht mit Antwortpflicht
(„Aufstellen lassen" oder „Ich stelle selbst um"). Das ist die Regel, die man
später bereut, wenn sie fehlt.

Damit fällt `saisonVorbei()` als Steuergröße weg. Die Saison ist nicht mehr
„vorbei", sie geht in die nächste Phase über — und die nächste Saison beginnt
nicht auf Knopfdruck, sondern an Tag 1.

---

## 8. Der Preis des Tages-Zufalls

`seed|jahr|spieltag` wird `seed|jahr|tag`. Weil `tag` innerhalb einer Saison
eindeutig ist, kann der Schlüssel nicht kollidieren, obwohl eine Saison über
den Jahreswechsel läuft.

Der Preis, damit er nicht später unbemerkt auftaucht: **jede seed-festgenagelte
Zahl in `tests/saison.test.js`, `tests/spiel.test.js` und
`tests/spielplan.test.js` wird neu**, und laufende Karrieren spielen ab dem
Umstieg anders weiter. Das ist die Entscheidung, kein Fehler.

> **Die Neuaufnahme der Testzahlen gehört in einen eigenen Commit, der sonst
> nichts anfasst.** Sonst steckt beim nächsten Balance-Umbau eine echte
> Verschiebung zwischen zweihundert neu aufgenommenen Zahlen, und niemand sieht
> sie.

---

## 9. Die Nachrichtenarten für v1

Nur, was die Engine heute schon weiß. Nichts davon braucht eine neue Regel.

| `art` | Wann | Antwortpflicht |
| --- | --- | --- |
| `vorstandsziel` | Tag 1 einer Saison, beim Amtsantritt | **ja** |
| `aufstellungUngueltig` | Wenn ein Stammspieler vor dem Spieltag ausfällt | **ja** |
| `spielvorschau` | Am Vortag des eigenen Spiels | nein |
| `spielbericht` | Nach dem eigenen Spiel, verlinkt den Box Score | nein |
| `rundenergebnisse` | Nach jedem Spieltag, mit Tabellenstand | nein |
| `verletzung` | Wenn sich ein eigener Spieler verletzt | nein |
| `auslosung` | Wenn das Halbfinale feststeht | nein |
| `meister` | Nach dem Finale | nein |
| `ruecktritte` | Tag 1, mit den Namen | nein |

Die Ansprache aus [`ui/intro.js`](../ui/intro.js) wird damit die **erste
E-Mail** statt eines Sonderbildschirms. Das ist genau der Griff, der das
Postfach im FM13 zum Zuhause macht: alles, was der Verein von dir will, kommt
über denselben Kanal.

### Wachstum

Der Speicherstand liegt bei rund 150 KB. Nachrichten müssen deshalb endlich
gehalten werden: beim Saisonwechsel fällt alles Gelesene ohne Antwortpflicht
weg, dazu eine harte Obergrenze von 300. Ohne das frisst eine Karriere über
zwanzig Saisons den `localStorage` auf, und zwar erst nach Monaten Spielzeit.

---

## 10. Die Ansichten

Fünf Reiter, der erste ist neu und die Startansicht:

```
Posteingang │ Tabelle │ Roster │ Taktik │ Spielplan
```

`verlauf` fällt als Reiter weg. `intro` fällt als Ansicht weg. Die Fußleiste
fällt weg.

### Der erste Reiter

```
┌─────────────────────────────────────────┐
│ SCU    Sa 17. Apr 2027         3. Nord  │  Kopfzeile: Datum statt Spieltag
├─────────────────────────────────────────┤
│ Posteingang│Tabelle│Roster│Taktik│Spielplan│
├─────────────────────────────────────────┤
│  ◀    April 2027    ▶                   │
│  Mo Di Mi Do Fr Sa So                   │
│              1  2  3  4                 │
│   5  6  7✉ 8  9 10 11                   │  ⚽ Spiel
│  12 13 14 15 16 17⚽18                   │  ✉ Post
│  19 20 21 22 23 24⚽25                   │  ● Antwort nötig
├─────────────────────────────────────────┤
│  HEUTE · Spieltag 1                     │
│  gegen TSV Grafing (H)      [ Anpfiff ] │
├─────────────────────────────────────────┤
│  ● Der Vorstand — Ihre Ziele für 2027   │
│  ✉ Trainerstab — Kaderbericht           │
└─────────────────────────────────────────┘
```

Das Monatsraster beginnt montags, wie ein deutscher Kalender. Dass Tag 1 ein
Samstag ist, ist eine Eigenschaft der Rechnung, keine der Anzeige.

**Die Tageskarte ist die Handlung.** Ohne Fußleiste braucht der Zwangsstopp
eine sichtbare Oberfläche, sonst sitzt man fest:

| Lage | Tageskarte trägt |
| --- | --- |
| Spieltag | `[ Anpfiff ]` |
| Antwort offen | `[ Zur Nachricht › ]` |
| stiller Tag | „Nächster Termin: Sa 24. Apr, Spieltag 2 — `[ bis dahin ]`" |
| Phasenwechsel | „Die Saison ist gespielt. — `[ In die Sommerpause ]`" |

Einen beliebigen Tag im Raster antippen heißt „bis hierhin". Damit ist der
häufigste Fall ein Griff, und der seltene zwei.

### Was in `ui/` entsteht und verschwindet

| Datei | |
| --- | --- |
| `ui/postfach.js` | neu — Raster, Tageskarte, Nachrichtenliste, Archiv |
| `ui/intro.js` | fällt weg, wird `vorstandsziel` |
| `app.js` | `fussleiste()` fällt weg, `verlaufAnsicht()` wandert ins Postfach |

**`sw.js` `SHELL` muss `engine/kalender.js`, `engine/postfach.js` und
`ui/postfach.js` nennen**, sonst startet die App offline nicht.
`tests/sw.test.js` fängt das gegen die Platte ab.

---

## 11. Reihenfolge

Jeder Schritt für sich lauffähig und testbar:

1. **`engine/kalender.js`** mit Tests. Ändert an der App nichts — nur die
   Rechnung steht.
2. **`tag` im Spielstand**, Migration v5, `verletztBis` in Tagen,
   `spieltagRng` auf den Tag. Die App spielt weiter wie bisher, die Testzahlen
   werden neu aufgenommen (eigener Commit).
3. **`weiter()` und die Zwangsstopps** in `engine/saison.js`, `spieleSpieltag`
   wird intern. Fußleiste ruft vorläufig `weiter()` ohne Ziel.
4. **`engine/postfach.js`** und `T.post`, `verlauf` → `post`. Die
   Verlaufsansicht zeigt Nachrichten statt Zeilen.
5. **`ui/postfach.js`**: Raster, Tageskarte, erster Reiter, Fußleiste weg,
   `ui/intro.js` weg.
6. **Vorbereitung und Sommerpause** mit Leben füllen — das ist schon der
   nächste Block, nicht mehr dieser.

---

## 12. Bewusst nicht in v1

- **Keine Einstellung, welche Ereignisse anhalten.** Die Stoppregeln stehen
  fest. Ein Einstellungsbildschirm lohnt erst, wenn es mehr als drei gibt.
- **Keine Geburtstage.** Alle altern am Tag 1. Sobald es Geburtstage gibt, ist
  das der Punkt, an dem die Alterung aus `naechsteSaison()` herauswandert.
- **Keine Antworten, die den Spielstand verändern**, außer den zweien in der
  Tabelle oben. Der Mechanismus steht, die Verwendung wächst später.
- **Ein Spieltag bleibt ein Tag.** Beide Gruppen spielen samstags, kein
  Sonntagsspiel. Das ginge, sobald `Partie.tag` autoritativ ist — es ist nur
  nichts wert, solange man ohnehin nur das eigene Spiel sieht.
