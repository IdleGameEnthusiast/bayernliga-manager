// @ts-check
/**
 * The Spielplan: a double round robin built with the circle method, so every
 * club meets every other one home and away.
 * Docs: docs/spec/02-core-loop.md
 */

import { shuffle } from './constants.js';

/**
 * @typedef {object} Partie
 * @property {number} spieltag  1-based
 * @property {string} heim      team id
 * @property {string} gast      team id
 * @property {import('./spiel.js').Ergebnis | null} ergebnis
 */

/**
 * @param {() => number} rng
 * @param {string[]} teamIds  must be an even count
 * @returns {Partie[]}
 */
export function macheSpielplan(rng, teamIds) {
  if (teamIds.length % 2 !== 0) {
    throw new Error('Spielplan braucht eine gerade Anzahl Teams');
  }
  const ids = shuffle(rng, teamIds.slice());
  const n = ids.length;
  const runden = n - 1;
  /** @type {Partie[]} */
  const partien = [];

  // Circle method: one club is pinned, the rest rotate around it.
  const rotation = ids.slice(1);
  for (let runde = 0; runde < runden; runde++) {
    const feld = [ids[0], ...rotation];
    for (let i = 0; i < n / 2; i++) {
      const a = feld[i];
      const b = feld[n - 1 - i];
      // Alternate who hosts, so nobody piles up home games in the Hinrunde.
      const heimZuerst = (runde + i) % 2 === 0;
      partien.push({
        spieltag: runde + 1,
        heim: heimZuerst ? a : b,
        gast: heimZuerst ? b : a,
        ergebnis: null,
      });
    }
    rotation.unshift(/** @type {string} */ (rotation.pop()));
  }

  // Rückrunde: the same fixtures with the venue swapped.
  const hinrunde = partien.slice();
  for (const p of hinrunde) {
    partien.push({
      spieltag: p.spieltag + runden,
      heim: p.gast,
      gast: p.heim,
      ergebnis: null,
    });
  }

  return partien;
}

/** @param {Partie[]} plan */
export function anzahlSpieltage(plan) {
  return plan.reduce((max, p) => Math.max(max, p.spieltag), 0);
}

/** @param {Partie[]} plan @param {number} spieltag */
export function partienAmSpieltag(plan, spieltag) {
  return plan.filter((p) => p.spieltag === spieltag);
}

/** @param {Partie[]} plan @param {string} teamId */
export function partienVonTeam(plan, teamId) {
  return plan.filter((p) => p.heim === teamId || p.gast === teamId);
}
