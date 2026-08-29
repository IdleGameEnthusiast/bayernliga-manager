// @ts-check
/**
 * Team strength: how a Kader turns into the numbers the match sim uses.
 * Docs: docs/spec/04-economy-formulas.md
 */

import { ERSATZ_STAERKE } from './constants.js';
import { verfuegbar } from './spieler.js';

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
 * Mean strength of the best `n` fit players at a position.
 * A slot nobody can fill counts as ERSATZ_STAERKE, which is what makes a thin
 * Kader and a long injury list actually hurt.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {import('./constants.js').Position} position
 * @param {number} n
 * @param {number} spieltag
 */
export function einheit(kader, position, n, spieltag) {
  const frei = verfuegbar(kader, position, spieltag).slice(0, n);
  let summe = 0;
  for (let i = 0; i < n; i++) {
    summe += frei[i] ? frei[i].staerke : ERSATZ_STAERKE;
  }
  return summe / n;
}

/**
 * Unit ratings for one side, at one point in the season.
 * The weights are the model: the quarterback carries the offence, the line
 * decides the rest, and special teams only ever nudge.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @returns {Staerken}
 */
export function teamStaerken(kader, spieltag) {
  const qb = einheit(kader, 'QB', 1, spieltag);
  const ol = einheit(kader, 'OL', 5, spieltag);
  const rb = einheit(kader, 'RB', 2, spieltag);
  const wr = einheit(kader, 'WR', 3, spieltag);
  const te = einheit(kader, 'TE', 1, spieltag);

  const dl = einheit(kader, 'DL', 4, spieltag);
  const lb = einheit(kader, 'LB', 3, spieltag);
  const db = einheit(kader, 'DB', 4, spieltag);

  const k = einheit(kader, 'K', 1, spieltag);
  const p = einheit(kader, 'P', 1, spieltag);

  return {
    angriff: qb * 0.40 + ol * 0.25 + wr * 0.18 + rb * 0.11 + te * 0.06,
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
