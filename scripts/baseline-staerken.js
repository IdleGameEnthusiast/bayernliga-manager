// @ts-check
/**
 * Die Gesamtstärken aller zwölf Vereine, mit gepinntem Seed. Aufruf:
 *   node scripts/baseline-staerken.js [seed] [meinTeam]
 *
 * Das ist das Messband für den Positionsumbau (docs/umbau-positionsmodell.md,
 * Abschnitt 11): einmal vor Inkrement 1 protokollieren, nach jedem Inkrement
 * dagegen halten. Der Umbau darf die Liga verschieben — aber nicht unbemerkt.
 */

import { neuesSpiel } from '../engine/saison.js';
import { TEAMS, teamById } from '../engine/content.js';
import { teamStaerken, gesamtStaerke } from '../engine/team.js';

const seed = process.argv[2] || 'baseline';
const meinTeam = process.argv[3] || 'heg';

const stand = neuesSpiel(meinTeam, seed);

const zeilen = TEAMS.map((t) => {
  const s = teamStaerken(stand.kader[t.id], 1);
  /** @type {Record<string, number>} */
  const werte = {};
  for (const [feld, wert] of Object.entries(s)) {
    if (typeof wert === 'number') werte[feld] = wert;
  }
  return {
    kurz: t.kurz,
    name: teamById(t.id).name,
    kader: stand.kader[t.id].length,
    gesamt: gesamtStaerke(s),
    werte,
  };
}).sort((a, b) => b.gesamt - a.gesamt);

const z1 = (n) => n.toFixed(1);
console.log(`Seed ${seed} · eigener Verein ${meinTeam}`);
console.log('| Verein | Kader | Gesamt | ' + Object.keys(zeilen[0].werte).join(' | ') + ' |');
console.log('| --- | ---: | ---: | ' + Object.keys(zeilen[0].werte).map(() => '---: ').join('| ') + '|');
for (const r of zeilen) {
  console.log(`| ${r.kurz} ${r.name} | ${r.kader} | ${r.gesamt} | `
    + Object.values(r.werte).map(z1).join(' | ') + ' |');
}
