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
