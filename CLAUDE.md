# Arbeitsanweisung für Claude

Bayernliga Football Manager — ein Managerspiel als reine Browser-App. Was das
Spiel ist und wie es sich spielt, steht im [README](README.md). Hier steht, was
beim Arbeiten daran gilt.

## Die vier Regeln

1. **Kein Build.** Kein Bundler, kein npm, keine Abhängigkeit, keine
   `package.json`. Der Browser lädt die ES-Module direkt, ein `git push` ist das
   Deployment. Typen kommen aus JSDoc und `// @ts-check`. Wer eine Bibliothek
   braucht, braucht in Wahrheit eine kürzere Lösung.
2. **`engine/` fasst kein DOM an, `ui/` entscheidet keine Regel.** `app.js` ist
   der einzige Ort, an dem sich beide begegnen. `engine/` importiert nichts von
   außerhalb `engine/` — auch nicht `i18n.js`. Deshalb spielen die Tests ganze
   Saisons in Millisekunden durch.
3. **Sichtbare Texte stehen ausschließlich in `i18n.js`**, auf Deutsch, mit
   echten Umlauten, UTF-8 ohne BOM. Bezeichner im Code sind englisch. Die
   Sprache des Sports bleibt, wie sie auf dem Feld gesprochen wird: Offense,
   Defense, Run, Pass, Roster, QB, MIKE.
4. **Wer die Form von `SpielStand` ändert, schreibt den Migrationsschritt
   dazu** — siehe unten. Das ist der Teil, der am ehesten vergessen wird, und
   sein Fehlen merkt man erst an einem Speicherstand, den es nicht mehr gibt.

## Speicherstände wandern mit

Jeder Stand trägt eine `SAVE_VERSION`. Ändert sich die Form von `SpielStand`,
sind es **zwei** Handgriffe, nie einer:

- **`SAVE_VERSION` in [`engine/saison.js`](engine/saison.js) hochzählen.**
- **Einen Schritt in `MIGRATIONEN` in [`engine/save.js`](engine/save.js)
  eintragen**, der einen Stand der vorigen Nummer auf die neue hebt. Der
  Schlüssel ist die Nummer, von der aus gehoben wird.

`migriere()` hängt die Schritte aneinander: ein Stand aus Version 4 läuft durch
4→5, 5→6, 6→7. Deshalb kennt **ein Schritt nur die beiden Formen an seinen
Enden**, nie den heutigen `SpielStand` — sonst müsste jeder alte Schritt
mitwachsen, sobald die Form sich wieder ändert, und genau daran gehen
Migrationspfade ein. Aus demselben Grund wird nie ein Direktweg von 4 nach 7
eingetragen: die Tabelle wüchse quadratisch.

Was der Pfad nicht erreicht, wird abgelehnt statt halb gerettet: eine Nummer
ohne Schritt, eine Nummer aus der Zukunft, kein Objekt. `lade()` wirft einen
solchen Stand weg, `importiere()` lässt den Fehler laut werden.

Ein gehobener Stand wird beim Laden **nicht** zurückgeschrieben — das erledigt
der nächste `speichere()`. Bis dahin liegt die alte Fassung noch auf der Platte,
und ein Export kann sie retten, falls ein Schritt danebengreift.

## Fallen, die schon zugeschnappt sind

- **`sw.js` muss jedes Modul in `SHELL` nennen.** Wer eine Datei unter `engine/`
  oder `ui/` anlegt und die Liste vergisst, merkt online nichts — offline
  startet die App dann gar nicht. `tests/sw.test.js` prüft es gegen die Platte.
- **`.nojekyll` im Wurzelverzeichnis nicht löschen.** Ohne sie schiebt GitHub
  Pages jeden Push durch Jekyll, das jede `.md` als Liquid-Vorlage liest; ein
  `{{` in einem Codeblock unter `docs/` lässt dann den ganzen Deploy fallen.
  Genau so stand die Seite sechs Tage auf einem alten Stand.
- **Der Kalender ist der einzige Ort mit `Date`.** Rechne Tage, keine Daten.
- **Nie auf eine Verteilung prüfen, ohne den Seed festzunageln.** Die Engine
  bekommt ihren Zufall injiziert (`makeRng(seed)`); der Tages-Zufall leitet sich
  aus `seed | jahr | tag` ab.

## Befehle

| Was | Wie |
| --- | --- |
| Tests | `node --test tests/` |
| Ein einzelner Test | `node --test tests/saison.test.js` |
| Rauchtest im Browser | `node tests/smoke.js [filter]` — startet Server und Firefox selbst |
| Lokal spielen | `python3 -m http.server 8000` |
| Icons neu bauen | `node scripts/mach-icons.js` |
| Ligastärken messen | `node scripts/baseline-staerken.js` |

**Node ist nicht auf jedem Rechner da, an dem hier gearbeitet wird.** Erst
prüfen (`node --version`), und wenn es fehlt: statisch arbeiten und **im
Abschlussbericht sagen, dass nichts gelaufen ist.** Kein ungeprüftes „läuft".

## Wo was steht

`engine/` die Regeln, `ui/` das DOM, `app.js` die Verdrahtung, `i18n.js` die
Texte. Die Tabelle Datei für Datei steht im [README](README.md#aufbau) — sie
wird dort gepflegt und hier nicht verdoppelt.

Unter `docs/` liegen lange Entwürfe. **Nicht ungefragt komplett lesen** — die
Code-Kommentare verweisen mit Abschnittsnummer dorthin, das reicht als Einstieg:

| Datei | Zustand |
| --- | --- |
| `naechste-schritte.md` | **lebend** — der Fahrplan und die gefallenen Entscheidungen. Hier zuerst nachsehen, was als Nächstes ansteht |
| `umbau-kalender.md` | abgeschlossen — Uhr, Postfach, Phasen. Nachschlagewerk |
| `umbau-positionsmodell.md` | abgeschlossen, 56 KB — Attribute, Positionen, Lauf/Pass. Nur abschnittsweise lesen |
| `umbau-aufstellung.md` | abgeschlossen — die Aufstellung von Hand |
| `umbau-coaches.md` | abgeschlossen, was den **Datensatz** angeht — Gruppen, Ähnlichkeit, Stärke, Ziehung. Die Wirkung (Taktik, Entwicklung) ist offen, Abschnitt 7 |
| `baseline-staerken.md` | Messprotokoll zum Positionsumbau. Historie |

## Ton und Commits

Das Projekt ist vibe-coded und darf für Claude optimiert sein: **Kommentare
erklären das Warum**, nicht das Was, in ganzen deutschen Sätzen, und dürfen
lang sein, wenn die Entscheidung dahinter nicht offensichtlich ist. Wo ein
Kommentar eine verworfene Alternative nennt, bleibt er stehen — er verhindert,
dass sie noch einmal gebaut wird.

Commits im Stil des Repos: eine deutsche Kopfzeile, die den Fund benennt statt
die Änderung aufzuzählen („Offline fehlte die halbe App, und niemand konnte es
merken"), darunter ein Fließtext, der sagt, was war, was daran falsch war und
warum die Lösung so aussieht. Am Ende:

```
Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

## Was hier nichts zu suchen hat

TypeScript-Dateien, JSX, ein Bundler, `package.json`, eine Abhängigkeit, ein
Framework, ein CSS-Präprozessor, eine `.github/`-Pipeline für den Deploy — und
ein Migrationsschritt, der den heutigen `SpielStand` kennt.
