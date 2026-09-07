# Am Node-Rechner abzuarbeiten

**Diese Datei ist Wegwerfware.** Sie steht hier, weil der Kalenderumbau (Block 6,
nach [`docs/umbau-kalender.md`](docs/umbau-kalender.md)) auf einem Rechner ohne
Node entstanden ist: **kein Test ist gelaufen, die App wurde nie geöffnet.**
Geprüft ist nur statisch — Klammern und Zeichenketten, und ob jeder benannte
Import in seinem Ziel auch exportiert wird. Ist die Liste abgearbeitet, wird die
Datei gelöscht.

Die Reihenfolge ist Absicht: erst messen, dann anfassen.

---

## 1. Messen, ohne etwas zu ändern

```
node --test tests/*.test.js
```

**Erwartung:**

- `tests/saison.test.js` **lädt nicht.** Zeile 8 importiert `spieleSpieltag` und
  `saisonVorbei`; beide gibt es nicht mehr. Das ist bekannt und Punkt 3.
  (`anzahlSpieltage` gibt es weiterhin.)
- **Die anderen acht sollten grün sein.** Wenn nicht, ist das ein echter Fund und
  kein Umbaurest: in `spiel.test.js`, `spieler.test.js`, `team.test.js` und
  `aufstellung.test.js` wurde nur ein Parameter umbenannt (`spieltag` → `tag`,
  dieselbe Stelle, dieselbe Zahl), und `simuliereSpiel` hat den Spieltag nie in
  den Zufallsstrom gegeben. `verletztBis` steht in diesen Tests immer relativ
  (`= 5`, abgefragt bei 1) — die Einheit ist ihnen gleich.

Das Ergebnis dieses Laufs notieren, bevor irgendetwas geändert wird. Danach lässt
sich unterscheiden, was der Umbau kaputt gemacht hat und was die Umschrift.

---

## 2. Der Rauchtest im Browser — wichtiger als die Unit-Tests

Die Tests fangen die Rechnung. Sie fangen **nicht** die Verdrahtung, und genau
die ist neu: erster Reiter, Tageskarte, Monatsraster, `app.js` ohne Fußleiste.

ES-Module brauchen einen Server, `file://` genügt nicht:

```
python -m http.server 8080
```

**`http://localhost:8080/` — neue Karriere:**

| Schritt | Erwartet |
| --- | --- |
| Start | Posteingang ist die erste Ansicht, Raster zeigt **Oktober 2026**, Tag 1 ist **Sa 17.10.** |
| — | Eine Nachricht vom Vorstand mit Marke ●, Tageskarte trägt „Zur Nachricht ›" |
| Antworten | Tageskarte wird zu „Nächster Termin: Sa 17. Apr 2027, Spieltag 1 — [ bis dahin ]" |
| „bis dahin" | Uhr springt auf **Tag 183**, Raster auf April 2027, Tageskarte trägt **[ Anpfiff ]** |
| Anpfiff | Spielbericht öffnet sich; zurück im Postfach liegen Spielbericht und Rundenergebnisse |
| Einen späteren Tag antippen | „bis hierhin" — die Uhr läuft, hält aber am nächsten eigenen Spiel |
| Kopfzeile | Datum statt Spieltag |
| Reiter | Fünf: `Posteingang │ Tabelle │ Roster │ Taktik │ Spielplan`, keine Fußleiste |

**Und die Kanten:**

- `vis.html` und `vis.html?ende` (Bracket), dazu `?v=kader`, `?v=taktik`,
  `?v=spielplan`, `?v=bericht`.
- **Ein alter Speicherstand.** Der wichtigste Punkt der ganzen Liste, weil ihn
  sonst nie jemand macht: einen v4-Stand unter `bayernliga.save.v4` in den
  `localStorage` legen, laden, und prüfen, ob die Uhr auf einem plausiblen Tag
  steht, die Verletzten plausible Tage tragen und die alten Verlaufszeilen unter
  dem Archiv auftauchen. Ein v4-Stand hat weder `tag` noch `post` — das ist der
  Fall, den die Migration ganz allein trägt.
- **Offline.** Netzwerk aus, neu laden. Der Service Worker muss
  `engine/kalender.js`, `engine/postfach.js` und `ui/postfach.js` mitgebracht
  haben. `tests/sw.test.js` prüft das gegen das Verzeichnis, aber der Beweis ist
  der Flugmodus.
- Eine ganze Saison durchklicken bis zum Saisonwechsel: an Tag 364 rollt
  `weiter()` von selbst in die neue Saison, und danach muss der Kalender auf
  Tag 1 des Folgejahres stehen — mit Rücktritten und neuem Vorstandsziel im
  Postfach.

---

## 3. `tests/saison.test.js` umschreiben

Der Rest der Suite ist heil; hier steckt die ganze Arbeit.

**Der Import (Zeile 8):** `spieleSpieltag` und `saisonVorbei` streichen, dafür
`weiter`, `letzterTag` und `beantworteNachricht` aufnehmen; dazu aus
`../engine/postfach.js` `offeneAntworten` und `antwortenZu`, aus
`../engine/kalender.js` `tagVonSpieltag`.

**Eine Hilfsfunktion ersetzt alle `while (!saisonVorbei(s))`-Schleifen:**

```js
/**
 * Spielt bis zum entschiedenen Finale. Der Kalender hält bei jedem eigenen
 * Spiel und bei jeder Antwortpflicht an — beides wird hier abgeräumt, sonst
 * kommt die Schleife nicht vom Fleck.
 */
function bisSaisonende(s) {
  for (let i = 0; i < 400 && !meister(s); i++) {
    for (const n of offeneAntworten(s)) beantworteNachricht(s, n.id, antwortenZu(n.art)[0]);
    weiter(s);
  }
  assert.ok(meister(s), 'die Saison terminiert');
}
```

`meister(s) !== null` ist das neue `saisonVorbei(s)` — es tritt am Tag des
Finales ein (Tag 281), nicht erst am Saisonende (Tag 364). Der Unterschied ist
wichtig: `weiter()` rollt am letzten Tag **von selbst** in die nächste Saison.
Wer bis 364 durchspielt, hat `naechsteSaison()` schon hinter sich, ohne sie
gerufen zu haben, und die Tests, die sie danach selbst rufen, laufen ins Leere.

**Die Stellen im Einzelnen:**

| Zeile | Alt | Neu |
| --- | --- | --- |
| 52, 179 | `s.spieltag === 1` | `s.tag === 1` |
| 59 | `!saisonVorbei(s)` | `meister(s) === null` |
| 68–77 | Schleife mit Spieltagszählung | `bisSaisonende(s)`, dann `anzahlSpieltage === 12` und keine offene Partie mehr. `spieleSpieltag(s) === null` fällt ersatzlos weg — „nach dem Ende passiert nichts mehr" gibt es nicht mehr, nach dem Ende kommt die Sommerpause |
| 82–116 | Bracket, Spieltag für Spieltag | eine zweite Hilfe `bisSpieltag(s, nr)`, die mit derselben Antwort-Schleife auf `weiter(s, tagVonSpieltag(nr))` zielt |
| 217 | `spieltag: 1` im Rohstand, `m.verlauf` | `m.tag === tagVonSpieltag(1)` (= 183) und `m.post` ist `[]`. Der Rohstand **behält** `spieltag: 1` — das ist ja gerade der v4-Fall |
| 259, 280, 381–392 | einzelnes `spieleSpieltag(stand)` | zweimal: `weiter(stand, tagVonSpieltag(1))` fährt bis zum Morgen des Spieltags, das zweite `weiter(stand)` ist der Anpfiff |
| 411–421 | `naechstePartie` nach einem Spieltag | dasselbe Muster; die Partie trägt weiterhin ihr `spieltag`-Etikett, die Erwartungen 1 und 2 bleiben stehen |

**Neu dazu, weil es das vorher nicht geben konnte:**

- Ein Zwangsstopp hält ein Ziel auf: nach der ersten Antwort landet
  `weiter(s, 300)` **nicht** auf 300, sondern auf 183, mit `grund === 'spiel'`.
- Eine offene Antwort blockiert: zweimal `weiter(s)` am Tag 1 einer neuen
  Karriere bewegt die Uhr kein Stück, `grund === 'antwort'`.
- Ids sind deterministisch: zwei Stände mit demselben Seed haben nach demselben
  Weg dieselben `post`-Ids.
- `naechsterStopp(s)` ändert den Stand nicht — `JSON.stringify` davor und danach.
- Der Saisonwechsel stutzt: Gelesenes ohne Antwortpflicht ist danach weg,
  Unbeantwortetes steht noch da.

---

## 4. Tests für die zwei neuen Module

`engine/kalender.js` und `engine/postfach.js` haben noch keine; Schritt 1 der
Spezifikation verlangte sie ausdrücklich („mit Tests").

**Gegen die Spezifikation schreiben, nicht gegen den Code.** Die Zahlen stehen in
`docs/umbau-kalender.md` §3 und §4, und der Code wurde von Hand gegen dieselbe
Tabelle gerechnet — er beweist also nichts. Prüfwerte:

| Prüfung | Soll |
| --- | --- |
| `saisonStart(2026)` | 18.10.2025 |
| `saisonStart(2027)` | 17.10.2026 |
| `saisonStart(2028)` | 16.10.2027 |
| `saisonStart(2029)` | 21.10.2028 |
| `saisonLaenge(jahr)`, 2026–2040 | immer 364 oder 371, nie etwas anderes, immer `% 7 === 0` |
| `saisonLaenge(2028)` | 371 |
| `wochentag(1)` | 0 (Samstag) |
| `datum(2027, 183)` | Sa 17.04.2027 |
| `datum(2027, 281)` | Sa 24.07.2027 |
| `SPIELTAG_TAGE` | 12 Einträge, streng steigend, alle `% 7 === 1`, mit der Lücke von 14 nach Spieltag 5 und vor Halbfinale und Finale |
| `spieltagAmTag(tagVonSpieltag(n))` | `n`, für alle zwölf |
| `tagVonDatum` gegen `datum` | hin und zurück für alle 364 Tage der Saison 2027 |
| `phaseAmTag` | 1 vorbereitung · 183 gruppe · 254 playoffs · 282 sommerpause |

Fürs Postfach reichen wenige: `laufendeNummer` zählt pro Tag hoch, `stutzePost`
wirft Gelesenes ohne Antwortpflicht weg und lässt Unbeantwortetes stehen,
`POST_MAX` greift, `beantworte` auf eine unbekannte Id gibt `null`.

---

## 5. Die Commits

`docs/umbau-kalender.md` §8 verlangt eine Trennung, und die gilt:

1. **Der Umbau selbst** — 18 geänderte Dateien, `ui/intro.js` gelöscht, drei neue
   Module, plus die strukturell umgeschriebenen Tests aus Punkt 3 und die neuen
   aus Punkt 4. `docs/umbau-kalender.md` gehört in denselben Commit.
2. **Nur die neu aufgenommenen Zahlen**, und sonst nichts.

Nach der Durchsicht ist Punkt 2 vermutlich klein: `saison.test.js` prüft fast nur
Invarianten (Summen, Vollzähligkeit, gleicher Seed gleiches Ergebnis) und kaum
festgenagelte Endstände, und `spiel.test.js` wie `spielplan.test.js` bauen ihren
Zufall selbst und sehen den Tag nie. Die Warnung in §8 war fürs Schlimmste
geschrieben. **Bleibt Punkt 2 leer, ist das das Ergebnis und kein Versäumnis** —
dann gehört in die Commit-Nachricht von 1, dass nachgemessen wurde.

3. Diese Datei löschen.

---

## 6. Was ausdrücklich nicht dringend ist

Damit es nicht in denselben Rutsch gerät: Vorbereitung (Tag 2–182) und
Sommerpause (282–364) sind leer, und das ist beabsichtigt — §11.6 nennt es
„schon der nächste Block". Dort geht es erst weiter, wenn die Liste oben
abgehakt ist.
