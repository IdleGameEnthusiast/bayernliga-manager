// @ts-check
/**
 * Balance numbers and the injectable RNG.
 * Docs: docs/spec/04-economy-formulas.md
 * This module touches no DOM and imports nothing from ui/.
 */

/** Roster positions, in depth-chart order. */
export const POSITIONS = /** @type {const} */ ([
  'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P',
]);

/** @typedef {typeof POSITIONS[number]} Position */

/** How many players of each position a full Kader carries. */
export const ROSTER_SHAPE = /** @type {Record<Position, number>} */ ({
  QB: 3, RB: 4, WR: 6, TE: 3, OL: 8, DL: 7, LB: 6, DB: 8, K: 1, P: 1,
});

export const ROSTER_SIZE = Object.values(ROSTER_SHAPE).reduce((a, b) => a + b, 0);

/** Rating bounds. Everything player-facing lives on this scale. */
export const MIN_RATING = 40;
export const MAX_RATING = 99;

/** Age bounds for generated players, and where decline starts. */
export const MIN_AGE = 18;
export const MAX_AGE = 36;
export const PEAK_AGE = 27;

/** Match simulation. */
export const BASE_POINTS = 20;        // what an evenly matched offence scores
export const RATING_TO_POINTS = 0.42; // points gained per point of unit advantage
export const HOME_ADVANTAGE = 2.5;    // points, applied to the home side
export const MATCH_NOISE = 6.5;       // std-dev-ish spread on the expected score
export const MIN_EXPECTED = 3;
export const MAX_EXPECTED = 56;

/** Standings: German American football scores 2:0 for a win. */
export const POINTS_WIN = 2;
export const POINTS_TIE = 1;
export const POINTS_LOSS = 0;

/** Injuries. */
export const INJURY_CHANCE_PER_GAME = 0.055; // per team, per match
export const INJURY_MIN_WEEKS = 1;
export const INJURY_MAX_WEEKS = 6;

/** Season structure. */
export const SEASON_START_YEAR = 2026;

/** @param {number} v @param {number} lo @param {number} hi */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// --- RNG -------------------------------------------------------------------
// Seeded so a season replays identically and tests never assert on a
// distribution. Mirrors the injectable-RNG habit from Spirit Idland.

/** @param {string} str */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

/**
 * mulberry32 — small, fast, good enough for a manager game.
 * @param {number|string} seed
 * @returns {() => number} uniform in [0, 1)
 */
export function makeRng(seed) {
  let a = typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {() => number} rng @param {number} lo @param {number} hi inclusive */
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** @template T @param {() => number} rng @param {readonly T[]} arr */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/** Roughly normal, via the mean of four uniforms. @param {() => number} rng */
export function randNormal(rng) {
  return ((rng() + rng() + rng() + rng()) / 4 - 0.5) * 3.4641;
}

/** Fisher-Yates, in place. @template T @param {() => number} rng @param {T[]} arr */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
