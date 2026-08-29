// @ts-check
/**
 * Players: generation, ratings, ageing, injuries.
 * Pure — data in, data out. No DOM.
 */

import {
  MIN_RATING, MAX_RATING, MIN_AGE, MAX_AGE, PEAK_AGE,
  ROSTER_SHAPE, POSITIONS, clamp, randInt, pick, randNormal,
} from './constants.js';
import {
  VORNAMEN, NACHNAMEN, IMPORT_VORNAMEN, IMPORT_NACHNAMEN, IMPORT_ANTEIL,
} from './content.js';

/**
 * @typedef {object} Spieler
 * @property {string} id
 * @property {string} vorname
 * @property {string} nachname
 * @property {import('./constants.js').Position} position
 * @property {number} nummer      Trikotnummer
 * @property {number} alter
 * @property {number} staerke     Current overall, 40..99
 * @property {number} talent      Ceiling this player can still grow towards
 * @property {boolean} importSpieler
 * @property {number} verletztBis Matchday index the player is fit again; 0 = fit
 */

let idCounter = 0;

/** Reset between generated games so ids stay stable for a given seed. */
export function resetSpielerIds() {
  idCounter = 0;
}

/**
 * Jersey numbers are loosely position-banded, the way a real roster reads.
 * @type {Record<string, [number, number]>}
 */
const NUMMERN_BAND = {
  QB: [1, 19], RB: [20, 49], WR: [80, 89], TE: [40, 49], OL: [50, 79],
  DL: [90, 99], LB: [50, 59], DB: [20, 39], K: [1, 19], P: [1, 19],
};

/**
 * Age curve: a player is at their own ceiling around PEAK_AGE and falls away
 * on either side. Returns a multiplier on `talent`.
 * @param {number} alter
 */
export function alterFaktor(alter) {
  if (alter >= PEAK_AGE) {
    // Decline is gentler than the climb.
    return clamp(1 - (alter - PEAK_AGE) * 0.022, 0.7, 1);
  }
  return clamp(0.72 + (alter - MIN_AGE) * (0.28 / (PEAK_AGE - MIN_AGE)), 0.6, 1);
}

/**
 * @param {() => number} rng
 * @param {import('./constants.js').Position} position
 * @param {number} teamStaerke 0..100 baseline of the club
 * @returns {Spieler}
 */
export function macheSpieler(rng, position, teamStaerke) {
  const importSpieler = rng() < IMPORT_ANTEIL;
  const vorname = importSpieler ? pick(rng, IMPORT_VORNAMEN) : pick(rng, VORNAMEN);
  const nachname = importSpieler ? pick(rng, IMPORT_NACHNAMEN) : pick(rng, NACHNAMEN);
  const alter = randInt(rng, MIN_AGE, MAX_AGE);

  // Talent orbits the club's baseline; imports arrive a cut above.
  const bonus = importSpieler ? 8 : 0;
  const talent = clamp(
    Math.round(teamStaerke + bonus + randNormal(rng) * 9),
    MIN_RATING, MAX_RATING,
  );
  const staerke = clamp(Math.round(talent * alterFaktor(alter)), MIN_RATING, MAX_RATING);

  const band = NUMMERN_BAND[position] || [1, 99];
  return {
    id: 'p' + (++idCounter),
    vorname,
    nachname,
    position,
    nummer: randInt(rng, band[0], band[1]),
    alter,
    staerke,
    talent,
    importSpieler,
    verletztBis: 0,
  };
}

/**
 * A full Kader, sorted so the depth chart reads top-down per position.
 * @param {() => number} rng
 * @param {number} teamStaerke
 * @returns {Spieler[]}
 */
export function macheKader(rng, teamStaerke) {
  /** @type {Spieler[]} */
  const kader = [];
  for (const position of POSITIONS) {
    const anzahl = ROSTER_SHAPE[position];
    for (let i = 0; i < anzahl; i++) {
      kader.push(macheSpieler(rng, position, teamStaerke));
    }
  }
  return vergebeNummern(rng, sortiereKader(kader));
}

/**
 * Position order first, strength second — that is the depth chart.
 * @param {Spieler[]} kader
 */
export function sortiereKader(kader) {
  const rang = /** @type {Record<string, number>} */ (
    Object.fromEntries(POSITIONS.map((p, i) => [p, i]))
  );
  return kader.slice().sort((a, b) =>
    rang[a.position] - rang[b.position] || b.staerke - a.staerke);
}

/**
 * Trikotnummern innerhalb eines Kaders eindeutig vergeben — im Positionsband,
 * wo noch etwas frei ist, sonst irgendwo. Ohne das doppeln sich Nummern, weil
 * `macheSpieler` seine Nummer ohne Blick auf den Rest des Kaders zieht.
 * @param {() => number} rng
 * @param {Spieler[]} kader
 */
export function vergebeNummern(rng, kader) {
  /** @type {Set<number>} */
  const belegt = new Set();

  for (const s of kader) {
    const band = NUMMERN_BAND[s.position] || [1, 99];
    /** @type {number[]} */
    const imBand = [];
    for (let n = band[0]; n <= band[1]; n++) if (!belegt.has(n)) imBand.push(n);

    let frei = imBand;
    if (frei.length === 0) {
      frei = [];
      for (let n = 1; n <= 99; n++) if (!belegt.has(n)) frei.push(n);
    }

    s.nummer = frei.length > 0 ? pick(rng, frei) : 0;
    belegt.add(s.nummer);
  }
  return kader;
}

/** @param {Spieler} s @param {number} spieltag */
export function istFit(s, spieltag) {
  return s.verletztBis <= spieltag;
}

/**
 * The fit players at a position, best first.
 * @param {Spieler[]} kader
 * @param {import('./constants.js').Position} position
 * @param {number} spieltag
 */
export function verfuegbar(kader, position, spieltag) {
  return kader
    .filter((s) => s.position === position && istFit(s, spieltag))
    .sort((a, b) => b.staerke - a.staerke);
}

/** @param {Spieler} s */
export function name(s) {
  return s.vorname + ' ' + s.nachname;
}

/** Short form for box scores: "M. Weber". @param {Spieler} s */
export function kurzName(s) {
  return s.vorname.charAt(0) + '. ' + s.nachname;
}

/**
 * One year on: everyone ages, and strength re-derives from talent.
 * Players past MAX_AGE retire and are replaced by a rookie.
 * @param {() => number} rng
 * @param {Spieler[]} kader
 * @param {number} teamStaerke
 * @returns {{ kader: Spieler[], ruecktritte: Spieler[] }}
 */
export function saisonWechsel(rng, kader, teamStaerke) {
  /** @type {Spieler[]} */
  const neu = [];
  /** @type {Spieler[]} */
  const ruecktritte = [];

  for (const s of kader) {
    const alter = s.alter + 1;
    if (alter > MAX_AGE) {
      ruecktritte.push(s);
      const rookie = macheSpieler(rng, s.position, teamStaerke);
      rookie.alter = randInt(rng, MIN_AGE, 21);
      rookie.staerke = clamp(
        Math.round(rookie.talent * alterFaktor(rookie.alter)),
        MIN_RATING, MAX_RATING,
      );
      neu.push(rookie);
      continue;
    }
    // Young players nudge their ceiling upwards; veterans do not.
    const talent = alter <= PEAK_AGE
      ? clamp(s.talent + (rng() < 0.35 ? randInt(rng, 1, 3) : 0), MIN_RATING, MAX_RATING)
      : s.talent;
    neu.push({
      ...s,
      alter,
      talent,
      staerke: clamp(Math.round(talent * alterFaktor(alter)), MIN_RATING, MAX_RATING),
      verletztBis: 0,
    });
  }

  return { kader: vergebeNummern(rng, sortiereKader(neu)), ruecktritte };
}
