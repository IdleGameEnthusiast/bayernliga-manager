# Messband für den Positionsumbau

Die Gesamtstärken aller zwölf Vereine, gezogen mit `node scripts/baseline-staerken.js`
(Seed `baseline`, eigener Verein `heg`). Der Stand **vor Inkrement 1** aus
[`umbau-positionsmodell.md`](umbau-positionsmodell.md).

Nach jedem Inkrement das Skript erneut laufen lassen und die Tabelle hier
fortschreiben. Der Umbau darf die Liga verschieben — aber nicht unbemerkt.

## Vor Inkrement 1 (Commit 5ed84a6)

| Verein | Kader | Gesamt | angriff | verteidigung | special |
| --- | ---: | ---: | ---: | ---: | ---: |
| ASS Aschaffenburg Stallions | 35 | 59 | 54.8 | 62.8 | 66.4 |
| GC Gendorf Crusaders | 35 | 57 | 53.5 | 61.4 | 55.0 |
| KBA Königsbrunn Ants | 35 | 55 | 51.9 | 57.0 | 55.4 |
| ERS Erlangen Sharks | 35 | 53 | 56.5 | 53.1 | 31.7 |
| FEL Feldkirchen Lions | 35 | 51 | 49.3 | 55.9 | 32.6 |
| STA Starnberg Argonauts | 35 | 50 | 45.8 | 52.9 | 51.5 |
| HR Herzo Rhinos | 35 | 50 | 48.5 | 53.6 | 32.6 |
| FKK Franken Knights | 35 | 47 | 46.1 | 45.8 | 53.5 |
| PP Passau Pirates | 35 | 46 | 49.9 | 41.8 | 49.4 |
| MR München Rangers | 35 | 44 | 39.2 | 47.7 | 47.4 |
| BTC Bad Tölz Capricorns | 35 | 43 | 44.5 | 40.4 | 51.3 |
| HEG Hemhofen Gechers | 30 | 39 | 34.1 | 41.5 | 55.4 |

`angriff`, `verteidigung` und `special` sind die drei Werte, die `teamStaerken()`
in diesem Stand liefert. Ab Inkrement 4 werden daraus fünf — dann bekommt die
Tabelle andere Spalten, und vergleichbar bleibt nur noch `Gesamt`.

## Nach Inkrement 1 — Positionskatalog und Kader

| Verein | Kader | Gesamt | angriff | verteidigung | special |
| --- | ---: | ---: | ---: | ---: | ---: |
| ASS Aschaffenburg Stallions | 35 | 61 | 63.1 | 58.6 | 66.4 |
| FEL Feldkirchen Lions | 35 | 58 | 57.3 | 58.1 | 65.6 |
| GC Gendorf Crusaders | 35 | 56 | 56.3 | 54.1 | 64.8 |
| HR Herzo Rhinos | 35 | 55 | 53.0 | 54.2 | 67.6 |
| ERS Erlangen Sharks | 35 | 54 | 57.6 | 55.5 | 29.1 |
| KBA Königsbrunn Ants | 35 | 53 | 53.0 | 53.8 | 53.0 |
| STA Starnberg Argonauts | 35 | 51 | 46.3 | 54.4 | 53.4 |
| MR München Rangers | 35 | 48 | 45.0 | 50.1 | 47.4 |
| FKK Franken Knights | 35 | 47 | 47.4 | 48.8 | 35.0 |
| BTC Bad Tölz Capricorns | 35 | 43 | 44.2 | 40.1 | 56.8 |
| PP Passau Pirates | 35 | 41 | 42.1 | 42.0 | 29.4 |
| HEG Hemhofen Gechers | 30 | 38 | 34.7 | 42.2 | 35.2 |

Die Liga hat sich verschoben, wie erwartet: dieselben Vereinsbasen ziehen jetzt
andere Kader, weil achtzehn Positionen anders aus dem RNG fallen als acht. Die
Spanne bleibt in ihrem Rahmen (vorher 39–59, jetzt 38–61), der eigene Verein
steht weiter unten, und die Reihenfolge dazwischen ist neu gewürfelt statt
gekippt.

## Nach Inkrement 2 — Attribute und Körper

| Verein | Kader | Gesamt | angriff | verteidigung | special |
| --- | ---: | ---: | ---: | ---: | ---: |
| ASS Aschaffenburg Stallions | 35 | 61 | 61.9 | 62.7 | 46.4 |
| GC Gendorf Crusaders | 35 | 57 | 59.5 | 55.4 | 54.2 |
| STA Starnberg Argonauts | 35 | 55 | 55.1 | 53.5 | 61.3 |
| ERS Erlangen Sharks | 35 | 54 | 55.8 | 52.5 | 52.4 |
| FEL Feldkirchen Lions | 35 | 53 | 53.8 | 52.8 | 53.2 |
| KBA Königsbrunn Ants | 35 | 52 | 54.0 | 53.9 | 32.5 |
| HR Herzo Rhinos | 35 | 50 | 49.7 | 53.5 | 33.0 |
| MR München Rangers | 35 | 49 | 47.7 | 45.1 | 76.4 |
| FKK Franken Knights | 35 | 47 | 44.4 | 46.7 | 62.0 |
| PP Passau Pirates | 35 | 46 | 44.3 | 42.8 | 69.1 |
| HEG Hemhofen Gechers | 30 | 45 | 45.5 | 43.5 | 51.5 |
| BTC Bad Tölz Capricorns | 35 | 42 | 42.0 | 44.1 | 33.0 |

Wieder eine andere Liga, aus demselben Grund: Körper und Attribute ziehen aus
demselben Strom wie alles andere, also fällt hinter ihnen jede Zufallszahl an
einer anderen Stelle. Auf die Simulation wirken die Attribute in diesem Stand
noch nicht — `teamStaerken()` liest weiter nur `staerke`.

Was zählt, ist die Form: die Spanne bleibt bei rund zwanzig Punkten, und kein
Verein kippt aus dem Rahmen. Der eigene Verein steht diesmal im Mittelfeld
statt am Ende — das ist der Zufall der Ziehung, nicht der Umbau: seine Basis
ist unverändert die niedrigste, er hat nur fünf Mann weniger und diesmal
brauchbare Ziehungen.

## Nach Inkrement 3 — Positionsformeln

| Verein | Kader | Gesamt | angriff | verteidigung | special |
| --- | ---: | ---: | ---: | ---: | ---: |
| ASS Aschaffenburg Stallions | 35 | 61 | 63.1 | 60.6 | 46.4 |
| GC Gendorf Crusaders | 35 | 55 | 52.5 | 56.6 | 61.2 |
| KBA Königsbrunn Ants | 35 | 55 | 57.8 | 56.8 | 32.9 |
| ERS Erlangen Sharks | 35 | 54 | 58.9 | 54.3 | 28.8 |
| STA Starnberg Argonauts | 35 | 54 | 56.1 | 52.5 | 55.5 |
| HR Herzo Rhinos | 35 | 52 | 50.9 | 51.7 | 58.7 |
| FEL Feldkirchen Lions | 35 | 50 | 50.6 | 52.9 | 31.4 |
| BTC Bad Tölz Capricorns | 35 | 48 | 49.0 | 43.7 | 63.7 |
| MR München Rangers | 35 | 47 | 45.7 | 46.4 | 63.2 |
| HEG Hemhofen Gechers | 30 | 45 | 45.5 | 43.5 | 51.5 |
| PP Passau Pirates | 35 | 45 | 45.7 | 41.2 | 58.7 |
| FKK Franken Knights | 35 | 44 | 44.9 | 42.7 | 52.4 |

Die Eignung wirkt auf die Simulation noch nicht — `teamStaerken()` liest weiter
nur `staerke`. Verschoben hat sich die Liga trotzdem, weil die ausgebildete
Seite eine Zufallszahl je Spieler kostet und alles dahinter mitwandert. Ab
Inkrement 4 hört das auf: dann rechnet die Aufstellung, und ein Unterschied in
dieser Tabelle bedeutet endlich etwas.

## Nach Inkrement 4 — Aufstellung

| Verein | Kader | Gesamt | passAngriff | laufAngriff | passVerteidigung | laufVerteidigung | special | angriff | verteidigung |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ASS Aschaffenburg Stallions | 35 | 57 | 63.7 | 58.7 | 55.0 | 55.2 | 46.4 | 61.2 | 55.1 |
| GC Gendorf Crusaders | 35 | 54 | 51.9 | 51.5 | 54.9 | 55.5 | 61.2 | 51.7 | 55.2 |
| KBA Königsbrunn Ants | 35 | 54 | 58.2 | 53.0 | 55.6 | 56.2 | 32.9 | 55.6 | 55.9 |
| ERS Erlangen Sharks | 35 | 53 | 59.3 | 54.8 | 53.5 | 54.6 | 28.8 | 57.0 | 54.1 |
| STA Starnberg Argonauts | 35 | 53 | 55.4 | 55.5 | 50.4 | 51.8 | 55.5 | 55.5 | 51.1 |
| HR Herzo Rhinos | 35 | 51 | 50.5 | 48.5 | 52.7 | 49.2 | 58.7 | 49.5 | 51.0 |
| FEL Feldkirchen Lions | 35 | 48 | 49.6 | 46.8 | 53.6 | 49.7 | 31.4 | 48.2 | 51.6 |
| BTC Bad Tölz Capricorns | 35 | 46 | 48.9 | 46.2 | 41.6 | 42.7 | 63.7 | 47.5 | 42.1 |
| MR München Rangers | 35 | 45 | 46.1 | 44.3 | 41.5 | 42.5 | 63.2 | 45.2 | 42.0 |
| HEG Hemhofen Gechers | 30 | 44 | 44.7 | 44.0 | 42.1 | 43.4 | 51.5 | 44.4 | 42.7 |
| FKK Franken Knights | 35 | 44 | 43.5 | 45.9 | 41.7 | 40.5 | 52.4 | 44.7 | 41.1 |
| PP Passau Pirates | 35 | 43 | 45.8 | 42.2 | 40.5 | 39.9 | 58.7 | 44.0 | 40.2 |

Ab hier misst die Tabelle etwas. Zwischen Kader und Zahl steht jetzt die
Aufstellung: zweiundzwanzig Plätze, jeder mit dem besten Mann besetzt, jeder
Umsteller mit seinem Abschlag. `angriff` und `verteidigung` sind nur noch das
Mittel ihrer beiden Hälften und fallen mit Inkrement 5 weg.

Das Niveau liegt tiefer als vorher — die alte Rechnung mittelte Rohstärken,
die neue wertet jeden Mann auf dem Platz, auf dem er wirklich steht, und zieht
ab, was ihm dort fehlt. Was zählt, ist der Abstand: 43 bis 57 statt 38 bis 61,
also eine engere Liga. Der eigene Verein steht mit fünf Mann weniger auf 44 und
damit dort, wo er stehen soll — im unteren Drittel, aber nicht chancenlos.

## Nach Inkrement 5 — Lauf und Pass in der Simulation

| Verein | Kader | Gesamt | passAngriff | laufAngriff | passVerteidigung | laufVerteidigung | special | angriff | verteidigung |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ASS Aschaffenburg Stallions | 35 | 57 | 63.7 | 58.7 | 55.0 | 55.2 | 46.4 | 61.2 | 55.1 |
| GC Gendorf Crusaders | 35 | 54 | 51.9 | 51.5 | 54.9 | 55.5 | 61.2 | 51.7 | 55.2 |
| KBA Königsbrunn Ants | 35 | 54 | 58.2 | 53.0 | 55.6 | 56.2 | 32.9 | 55.6 | 55.9 |
| ERS Erlangen Sharks | 35 | 53 | 59.3 | 54.8 | 53.5 | 54.6 | 28.8 | 57.0 | 54.1 |
| STA Starnberg Argonauts | 35 | 53 | 55.4 | 55.5 | 50.4 | 51.8 | 55.5 | 55.5 | 51.1 |
| HR Herzo Rhinos | 35 | 51 | 50.5 | 48.5 | 52.7 | 49.2 | 58.7 | 49.5 | 51.0 |
| FEL Feldkirchen Lions | 35 | 48 | 49.6 | 46.8 | 53.6 | 49.7 | 31.4 | 48.2 | 51.6 |
| BTC Bad Tölz Capricorns | 35 | 46 | 48.9 | 46.2 | 41.6 | 42.7 | 63.7 | 47.5 | 42.1 |
| MR München Rangers | 35 | 45 | 46.1 | 44.3 | 41.5 | 42.5 | 63.2 | 45.2 | 42.0 |
| HEG Hemhofen Gechers | 30 | 44 | 44.7 | 44.0 | 42.1 | 43.4 | 51.5 | 44.4 | 42.7 |
| FKK Franken Knights | 35 | 44 | 43.5 | 45.9 | 41.7 | 40.5 | 52.4 | 44.7 | 41.1 |
| PP Passau Pirates | 35 | 43 | 45.8 | 42.2 | 40.5 | 39.9 | 58.7 | 44.0 | 40.2 |

Unverändert gegenüber Inkrement 4, und das ist der Punkt: `teamStaerken()` hat
sich nicht angefasst, nur die Simulation liest jetzt beide Duelle statt eines
gemittelten. Wer läuft, trifft auf die Laufverteidigung des Gegners.

Was die Tabelle nicht zeigt: die Vereine spielen hier alle noch das
Standardsystem. Wie viel die Ausrichtung wirklich ausmacht, steht erst mit
Inkrement 6 im Speicherstand.

## Nach Inkrement 7 — UI

| Verein | Kader | Gesamt | passAngriff | laufAngriff | passVerteidigung | laufVerteidigung | special | angriff | verteidigung |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ASS Aschaffenburg Stallions | 35 | 57 | 63.7 | 58.7 | 55.0 | 55.2 | 46.4 | 61.2 | 55.1 |
| GC Gendorf Crusaders | 35 | 54 | 51.9 | 51.5 | 54.9 | 55.5 | 61.2 | 51.7 | 55.2 |
| KBA Königsbrunn Ants | 35 | 54 | 58.2 | 53.0 | 55.6 | 56.2 | 32.9 | 55.6 | 55.9 |
| ERS Erlangen Sharks | 35 | 53 | 59.3 | 54.8 | 53.5 | 54.6 | 28.8 | 57.0 | 54.1 |
| STA Starnberg Argonauts | 35 | 53 | 55.4 | 55.5 | 50.4 | 51.8 | 55.5 | 55.5 | 51.1 |
| HR Herzo Rhinos | 35 | 51 | 50.5 | 48.5 | 52.7 | 49.2 | 58.7 | 49.5 | 51.0 |
| FEL Feldkirchen Lions | 35 | 48 | 49.6 | 46.8 | 53.6 | 49.7 | 31.4 | 48.2 | 51.6 |
| BTC Bad Tölz Capricorns | 35 | 46 | 48.9 | 46.2 | 41.6 | 42.7 | 63.7 | 47.5 | 42.1 |
| MR München Rangers | 35 | 45 | 46.1 | 44.3 | 41.5 | 42.5 | 63.2 | 45.2 | 42.0 |
| HEG Hemhofen Gechers | 30 | 44 | 44.7 | 44.0 | 42.1 | 43.4 | 51.5 | 44.4 | 42.7 |
| FKK Franken Knights | 35 | 44 | 43.5 | 45.9 | 41.7 | 40.5 | 52.4 | 44.7 | 41.1 |
| PP Passau Pirates | 35 | 43 | 45.8 | 42.2 | 40.5 | 39.9 | 58.7 | 44.0 | 40.2 |

Unverändert. Die Ansichten rechnen nichts, sie zeigen nur — was sich geändert
hat, ist, dass die Zahlen dieser Tabelle jetzt im Spiel zu sehen sind: die vier
Werte in den Mannschaftsteilen, die zweiundzwanzig Plätze mit ihren
Umstellungen, und unter jeder Kaderzeile die fünfzehn Werte des Spielers.

Damit ist der Umbau durch. Was offen blieb, steht in Abschnitt 12 des Bauplans —
der Tight End als Blocker, das Kostenniveau von 33 statt 30 Prozent, die
Verletzungsrate, und die berechnete Stärke als eigener nächster Schritt.

## Nach dem Rollenwert im Skill-Block

| Verein | Kader | Gesamt | passAngriff | laufAngriff | passVerteidigung | laufVerteidigung | special | angriff | verteidigung |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ASS Aschaffenburg Stallions | 35 | 57 | 64.3 | 58.5 | 55.0 | 55.2 | 46.4 | 61.4 | 55.1 |
| GC Gendorf Crusaders | 35 | 54 | 52.9 | 51.5 | 54.9 | 55.5 | 61.2 | 52.2 | 55.2 |
| KBA Königsbrunn Ants | 35 | 54 | 58.3 | 52.9 | 55.6 | 56.2 | 32.9 | 55.6 | 55.9 |
| STA Starnberg Argonauts | 35 | 54 | 55.7 | 55.5 | 50.4 | 51.8 | 55.5 | 55.6 | 51.1 |
| ERS Erlangen Sharks | 35 | 53 | 59.9 | 54.6 | 53.5 | 54.6 | 28.8 | 57.2 | 54.1 |
| HR Herzo Rhinos | 35 | 51 | 51.1 | 48.3 | 52.7 | 49.2 | 58.7 | 49.7 | 51.0 |
| FEL Feldkirchen Lions | 35 | 49 | 50.1 | 46.7 | 53.6 | 49.7 | 31.4 | 48.4 | 51.6 |
| BTC Bad Tölz Capricorns | 35 | 46 | 49.1 | 46.3 | 41.6 | 42.7 | 63.7 | 47.7 | 42.1 |
| MR München Rangers | 35 | 45 | 46.4 | 44.3 | 41.5 | 42.5 | 63.2 | 45.4 | 42.0 |
| HEG Hemhofen Gechers | 30 | 44 | 45.1 | 44.1 | 42.1 | 43.4 | 51.5 | 44.6 | 42.7 |
| FKK Franken Knights | 35 | 44 | 43.6 | 45.9 | 41.7 | 40.5 | 52.4 | 44.7 | 41.1 |
| PP Passau Pirates | 35 | 44 | 46.3 | 42.1 | 40.5 | 39.9 | 58.7 | 44.2 | 40.2 |

Fast unverändert, und das ist der Zweck der Normale: die Tabelle rechnet alle
Vereine auf 11 personnel, und 11 personnel steht in beiden Spielarten bei genau
1,000. Die Ausschläge von höchstens einem Punkt kommen aus der neuen Leiter —
sie ist im Passspiel steiler, also zieht der beste Receiver eines Kaders mehr,
und wer hinten dünn besetzt ist, verliert weniger. STA und ERS tauschen dadurch
die Plätze, FEL und PP steigen um einen Punkt.

Interessant ist die Tabelle, die hier **nicht** steht: derselbe Kader über alle
acht Gruppierungen. Vorher lag er zwischen 40,0 und 41,5 — eine Spanne von
anderthalb Punkten, also nichts. Jetzt reicht er von 36,8 (Double Wing, voll
auf Pass) bis 44,0 (Double Wing, voll auf Lauf). Über 200 gepaarte Saisons
schlägt das mit rund einem halben Sieg durch.

## Nach Körpermalus, Hauptplatz-Bedingung und Lernraten

Drei Änderungen in einem Schritt: der Körpermalus rechnet mit dem tatsächlichen
Gewicht, der Hauptplatz kippt nur noch, wenn der Mann dort auch stärker ist,
und die Attribute folgen je nach Lernrate verschieden schnell. `teamStaerken()`
liefert in diesem Stand fünf Zahlen, nicht mehr sieben — die Spalten `angriff`
und `verteidigung` der Abschnitte darüber gibt es nicht mehr.

**Vorher** (Commit 8c39304):

| Verein | Kader | Gesamt | passAngriff | laufAngriff | passVerteidigung | laufVerteidigung | special |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ASS Aschaffenburg Stallions | 35 | 59 | 60.8 | 57.7 | 60.9 | 59.6 | 46.4 |
| GC Gendorf Crusaders | 35 | 56 | 56.1 | 57.9 | 54.2 | 55.3 | 61.2 |
| ERS Erlangen Sharks | 35 | 54 | 58.9 | 56.0 | 53.5 | 54.6 | 28.8 |
| KBA Königsbrunn Ants | 35 | 53 | 55.9 | 51.4 | 56.3 | 57.2 | 32.9 |
| FEL Feldkirchen Lions | 35 | 50 | 48.5 | 49.5 | 50.0 | 47.5 | 57.8 |
| HR Herzo Rhinos | 35 | 50 | 49.7 | 50.3 | 47.0 | 49.4 | 65.0 |
| STA Starnberg Argonauts | 35 | 49 | 53.2 | 48.7 | 48.0 | 44.2 | 56.0 |
| MR München Rangers | 35 | 46 | 44.2 | 44.3 | 45.9 | 46.9 | 58.3 |
| HEG Hemhofen Gechers | 30 | 44 | 44.0 | 45.4 | 42.1 | 43.4 | 51.5 |
| FKK Franken Knights | 35 | 44 | 48.6 | 49.0 | 43.5 | 42.3 | 27.6 |
| BTC Bad Tölz Capricorns | 35 | 44 | 44.0 | 44.9 | 41.6 | 41.7 | 60.0 |
| PP Passau Pirates | 35 | 42 | 40.8 | 43.0 | 40.0 | 38.6 | 59.0 |

**Nachher:**

| Verein | Kader | Gesamt | passAngriff | laufAngriff | passVerteidigung | laufVerteidigung | special |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ASS Aschaffenburg Stallions | 35 | 59 | 61.2 | 56.8 | 60.9 | 59.6 | 46.4 |
| GC Gendorf Crusaders | 35 | 56 | 56.1 | 58.0 | 54.2 | 55.3 | 61.2 |
| ERS Erlangen Sharks | 35 | 54 | 59.0 | 56.3 | 53.5 | 54.6 | 28.8 |
| KBA Königsbrunn Ants | 35 | 53 | 55.9 | 51.5 | 56.3 | 57.2 | 32.9 |
| FEL Feldkirchen Lions | 35 | 50 | 48.5 | 49.5 | 50.0 | 47.5 | 57.8 |
| HR Herzo Rhinos | 35 | 50 | 49.7 | 50.3 | 47.0 | 49.4 | 65.0 |
| STA Starnberg Argonauts | 35 | 49 | 53.2 | 48.7 | 48.0 | 44.2 | 56.0 |
| MR München Rangers | 35 | 46 | 44.2 | 44.2 | 45.9 | 46.9 | 58.3 |
| HEG Hemhofen Gechers | 30 | 44 | 44.0 | 45.4 | 42.1 | 43.4 | 51.5 |
| FKK Franken Knights | 35 | 44 | 48.6 | 49.0 | 43.5 | 42.3 | 27.6 |
| BTC Bad Tölz Capricorns | 35 | 44 | 44.0 | 44.9 | 41.6 | 41.7 | 60.0 |
| PP Passau Pirates | 35 | 42 | 40.8 | 43.0 | 40.0 | 38.6 | 59.0 |

**Keine einzige Gesamtstärke bewegt sich**, sieben von zwölf Vereinen stehen
auch in den Teilwerten still, die übrigen fünf um höchstens 0,3. Das ist
erwartet: nur 11 von 264 besetzten Plätzen sind überhaupt Umstellungen, und alle
elf sind der Tight End, den kein Kader hat. Bei GC, ERS, KBA und MR ändert sich
nur der Preis — ERS' 92-Kilo-Slot zahlt für den Tight End jetzt 3,5 % statt 9,4 %,
GCs 116-Kilo-Fullback 0,1 % statt 0,6 %.

Die einzige Aufstellung, die kippt, ist ASS: dort gibt nach dem neuen Malus ein
88-Kilo-Slot den Tight End besser als ein 96-Kilo-Fullback. Das hebt den
Passangriff um 0,4 und senkt den Laufangriff um 0,9 — genau das, was der Umbau
tun soll, und an genau einer Stelle von 264.

Die Lernraten sind hier noch gar nicht zu sehen: sie wirken erst über Saisons.
Gemessen an einem Musterspieler — 109-Kilo-`SAM`, zehn Jahre ausschließlich auf
`CB` — gewinnt er jetzt +7,4 Schnelligkeit statt +15,0 und +11,0 Fangen statt
+10,0; sein Wert auf `CB` landet nach zehn Jahren bei 41,1 statt 42,5.
