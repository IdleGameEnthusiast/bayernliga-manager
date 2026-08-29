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
