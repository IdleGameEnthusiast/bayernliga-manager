// @ts-check
/**
 * The Spielplan, in two phases.
 *
 * The group stage is a double round robin inside each group, built with the
 * circle method — ten matchdays, drawn at the start of the season. The bracket
 * cannot be drawn with it: who plays the semi-final is only known once the
 * tenth matchday has been played, so those fixtures are appended later.
 *
 * Docs: docs/spec/02-core-loop.md
 */

import { shuffle } from './constants.js';
import { heimrecht } from './tabelle.js';

/** @typedef {'gruppe'|'halbfinale'|'finale'} Runde */

/**
 * @typedef {object} Partie
 * @property {number} spieltag  1-based, continuous across group stage and bracket
 * @property {Runde} runde
 * @property {string} heim      team id
 * @property {string} gast      team id
 * @property {import('./spiel.js').Ergebnis | null} ergebnis
 */

/**
 * A double round robin over one set of clubs.
 * @param {() => number} rng
 * @param {string[]} teamIds  must be an even count
 * @param {Runde} [runde]
 * @returns {Partie[]}
 */
export function macheSpielplan(rng, teamIds, runde = 'gruppe') {
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
  for (let r = 0; r < runden; r++) {
    const feld = [ids[0], ...rotation];
    for (let i = 0; i < n / 2; i++) {
      const a = feld[i];
      const b = feld[n - 1 - i];
      // Alternate who hosts, so nobody piles up home games in the Hinrunde.
      const heimZuerst = (r + i) % 2 === 0;
      partien.push({
        spieltag: r + 1,
        runde,
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
      runde,
      heim: p.gast,
      gast: p.heim,
      ergebnis: null,
    });
  }

  return partien;
}

/**
 * The whole group stage: both groups play their own double round robin, on the
 * same matchdays. Equal group sizes are what makes that line up, which is why
 * an uneven split is refused rather than quietly staggered.
 * @param {() => number} rng
 * @param {string[][]} gruppen  one array of team ids per group
 * @returns {Partie[]}
 */
export function macheGruppenplan(rng, gruppen) {
  const groesse = gruppen[0].length;
  for (const g of gruppen) {
    if (g.length !== groesse) {
      throw new Error('Alle Gruppen brauchen gleich viele Vereine');
    }
  }
  /** @type {Partie[]} */
  const partien = [];
  for (const g of gruppen) partien.push(...macheSpielplan(rng, g));
  return partien;
}

/**
 * The semi-finals: each group winner hosts the other group's runner-up.
 * @param {import('./tabelle.js').TabellenZeile[]} nord  final group table, sorted
 * @param {import('./tabelle.js').TabellenZeile[]} sued
 * @param {number} spieltag
 * @returns {Partie[]}
 */
export function macheHalbfinale(nord, sued, spieltag) {
  if (nord.length < 2 || sued.length < 2) {
    throw new Error('Für ein Halbfinale braucht jede Gruppe zwei Vereine');
  }
  return [
    { spieltag, runde: 'halbfinale', heim: sued[0].teamId, gast: nord[1].teamId, ergebnis: null },
    { spieltag, runde: 'halbfinale', heim: nord[0].teamId, gast: sued[1].teamId, ergebnis: null },
  ];
}

/**
 * The final. Home advantage goes to the better group-stage record, not to the
 * higher seed — a runner-up who won more games hosts a group winner.
 * @param {import('./tabelle.js').TabellenZeile} a  group-stage row of one finalist
 * @param {import('./tabelle.js').TabellenZeile} b
 * @param {number} spieltag
 * @returns {Partie}
 */
export function macheFinale(a, b, spieltag) {
  const zuhause = heimrecht(a, b);
  const auswaerts = zuhause === a ? b : a;
  return {
    spieltag,
    runde: 'finale',
    heim: zuhause.teamId,
    gast: auswaerts.teamId,
    ergebnis: null,
  };
}

/** Who won. Null while the match is unplayed. @param {Partie} p */
export function sieger(p) {
  if (!p.ergebnis) return null;
  return p.ergebnis.heimPunkte > p.ergebnis.gastPunkte ? p.heim : p.gast;
}

/** @param {Partie[]} plan */
export function anzahlSpieltage(plan) {
  return plan.reduce((max, p) => Math.max(max, p.spieltag), 0);
}

/** @param {Partie[]} plan @param {Runde} runde */
export function partienDerRunde(plan, runde) {
  return plan.filter((p) => p.runde === runde);
}

/** @param {Partie[]} plan @param {number} spieltag */
export function partienAmSpieltag(plan, spieltag) {
  return plan.filter((p) => p.spieltag === spieltag);
}

/** @param {Partie[]} plan @param {string} teamId */
export function partienVonTeam(plan, teamId) {
  return plan.filter((p) => p.heim === teamId || p.gast === teamId);
}
