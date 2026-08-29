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
