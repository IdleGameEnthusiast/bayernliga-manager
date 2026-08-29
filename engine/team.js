// @ts-check
/**
 * Team strength: how a Kader turns into the numbers the match sim uses.
 * Docs: docs/spec/04-economy-formulas.md
 */

import { ERSATZ_STAERKE, POSITION_GRUPPEN } from './constants.js';
import { istFit } from './spieler.js';

/**
 * @typedef {object} Team
 * @property {string} id
 * @property {import('./spieler.js').Spieler[]} kader
 */

/**
 * @typedef {object} Staerken
 * @property {number} angriff
 * @property {number} verteidigung
 * @property {number} special
 */

/**
 * Mean strength of the best `n` fit players from a set of positions.
 * A slot nobody can fill counts as ERSATZ_STAERKE, which is what makes a thin
 * Kader and a long injury list actually hurt.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {readonly import('./constants.js').Position[]} positionen
 * @param {number} n
 * @param {number} spieltag
 */
export function einheit(kader, positionen, n, spieltag) {
  const frei = kader
    .filter((s) => positionen.includes(s.position) && istFit(s, spieltag))
    .sort((a, b) => b.staerke - a.staerke)
    .slice(0, n);
  let summe = 0;
  for (let i = 0; i < n; i++) {
    summe += frei[i] ? frei[i].staerke : ERSATZ_STAERKE;
  }
  return summe / n;
}

/**
 * What a man is worth kicking off the tee: distance and aim in equal parts,
 * because a field goal needs both.
 * @param {import('./spieler.js').Spieler} s
 */
export function kickerWert(s) {
  return s.kickStaerke * 0.5 + s.kickGenauigkeit * 0.5;
}

/**
 * What he is worth punting: mostly leg. A punt that lands five yards off the
 * sideline still did its job, a short one never does.
 * @param {import('./spieler.js').Spieler} s
 */
export function punterWert(s) {
  return s.kickStaerke * 0.7 + s.kickGenauigkeit * 0.3;
}

/**
 * The best foot in the squad for one of the two jobs.
 *
 * Searched across the *whole* Kader, not a K or P slot: no Bayernliga club
 * carries a specialist, so the kicker is whichever receiver or linebacker can
 * do it. One man may well hold both jobs — that is the one double duty the
 * rules allow without asking.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @param {(s: import('./spieler.js').Spieler) => number} wert
 */
export function besterFuss(kader, spieltag, wert) {
  let bester = ERSATZ_STAERKE;
  for (const s of kader) {
    if (!istFit(s, spieltag)) continue;
    const w = wert(s);
    if (w > bester) bester = w;
  }
  return bester;
}

/**
 * Unit ratings for one side, at one point in the season.
 *
 * Provisional: this still rolls the eighteen positions up into their groups
 * and mixes one attack and one defence number, the way it did when there were
 * eight positions. The five values the position model wants — running and
 * passing on both sides — arrive with the Aufstellung in Inkrement 4. Until
 * then the shape stays as it is so the simulation keeps running.
 *
 * The weights are the model: the quarterback carries the offence, the line
 * decides the rest, and special teams only ever nudge.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 11
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @returns {Staerken}
 */
export function teamStaerken(kader, spieltag) {
  const qb = einheit(kader, POSITION_GRUPPEN.quarterback, 1, spieltag);
  const ol = einheit(kader, POSITION_GRUPPEN.lineOffense, 5, spieltag);
  // Die fünf Skill-Plätze in einem Topf: Backfield und Empfänger zusammen.
  const skill = einheit(
    kader, [...POSITION_GRUPPEN.backfield, ...POSITION_GRUPPEN.empfaenger], 5, spieltag,
  );

  const dl = einheit(kader, POSITION_GRUPPEN.lineDefense, 4, spieltag);
  const lb = einheit(kader, POSITION_GRUPPEN.linebacker, 3, spieltag);
  const db = einheit(kader, POSITION_GRUPPEN.secondary, 4, spieltag);

  const k = besterFuss(kader, spieltag, kickerWert);
  const p = besterFuss(kader, spieltag, punterWert);

  return {
    angriff: qb * 0.40 + ol * 0.25 + skill * 0.35,
    verteidigung: dl * 0.36 + lb * 0.29 + db * 0.35,
    special: k * 0.7 + p * 0.3,
  };
}

/**
 * One number for the table and for scouting screens.
 * @param {Staerken} s
 */
export function gesamtStaerke(s) {
  return Math.round(s.angriff * 0.46 + s.verteidigung * 0.46 + s.special * 0.08);
}

/**
 * How many players are currently unavailable.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 */
export function verletzte(kader, spieltag) {
  return kader.filter((s) => s.verletztBis > spieltag);
}
