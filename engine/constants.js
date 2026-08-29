// @ts-check
/**
 * Balance numbers and the injectable RNG.
 * This module touches no DOM and imports nothing from ui/.
 */

/** Roster positions, in depth-chart order. */
export const POSITIONS = /** @type {const} */ ([
  'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P',
]);

/** @typedef {typeof POSITIONS[number]} Position */

/**
 * The Kader every club starts from: eleven for the offence (5 OL + QB + five
 * skill players) and eleven for a 4-3 defence, plus a handful of bodies behind
 * them. Nothing more — a Bayernliga club does not carry a bench.
 *
 * K and P are absent on purpose. Below the GFL almost nobody keeps a
 * specialist; the kicking is done by whoever has the foot for it. That is a
 * job for the position-value model, not for two roster slots.
 */
export const KADER_FORM = /** @type {Record<Position, number>} */ ({
  QB: 1, RB: 2, WR: 5, TE: 0, OL: 6, DL: 6, LB: 4, DB: 6, K: 0, P: 0,
});

/** The club the player manages starts thin. */
export const KADER_GROESSE_EIGEN = Object.values(KADER_FORM).reduce((a, b) => a + b, 0);

/** Every other club draws this many extra players on top of KADER_FORM. */
export const ZUSATZ_SPIELER = 5;
export const KADER_GROESSE_FREMD = KADER_GROESSE_EIGEN + ZUSATZ_SPIELER;

/**
 * How the extra players are drawn. Weighted by where a club actually wants
 * depth — an even draw would hand somebody a fourth quarterback.
 */
export const ZUSATZ_GEWICHTE = /** @type {Record<Position, number>} */ ({
  QB: 1, RB: 3, WR: 5, TE: 3, OL: 5, DL: 5, LB: 4, DB: 5, K: 0, P: 0,
});

/** No club may stack more than this many extras on one position. */
export const ZUSATZ_MAX_JE_POSITION = 2;

/**
 * The club the player picks starts at the bottom: its Kader baseline drops to
 * this value, however strong the club stands in the catalogue. The league's
 * ladder of strengths is untouched — every weaker club moves up one rung. The
 * promotion is meant to be played for, not chosen.
 */
export const EIGENE_VEREINSBASIS = 45;

/** Rating bounds. */
export const MAX_RATING = 99;          // the scale's ceiling, kept for higher leagues
export const LIGA_MAX_STAERKE = 79;    // no Bayernliga strength is ever computed above this
export const RATING_UNTERGRENZE = 1;   // not a skill floor — only keeps a rating positive
export const TALENT_STREUUNG = 6;      // standard deviation of talent around the club baseline

/** What an empty slot in a unit is worth. A body, not a player. */
export const ERSATZ_STAERKE = 20;

/**
 * Kicking. Every player carries two values instead of a K or P slot, because
 * below the GFL almost nobody keeps a specialist — the club kicks with whoever
 * has the foot for it, and that man plays a position the rest of the game.
 *
 * `kickStaerke` is how far the ball goes, `kickGenauigkeit` how reliably it
 * goes where it should. Most men have neither. A few have a real foot, and the
 * two values are drawn apart from each other on purpose: a cannon leg with no
 * aim is a punter, not a kicker.
 */
export const KICK_BASIS = 22;            // mean for a man who does not kick
export const KICK_STREUUNG = 6;
export const KICK_FUSS_ANTEIL = 0.07;    // share of the squad who actually can
export const KICK_FUSS_BASIS = 55;       // mean for those who can
export const KICK_FUSS_STREUUNG = 9;
/** Where a kicker never comes from: the men in the trenches. */
export const KICK_FUSS_AUSSCHLUSS = /** @type {Position[]} */ (['OL', 'DL']);

/** Age bounds for the normal draw, and where the curve peaks. */
export const MIN_AGE = 18;
export const MAX_AGE = 36;
export const PEAK_AGE = 27;

/** Placeholder until the development model lands: when an ordinary player stops. */
export const RUECKTRITT_ALTER = 37;

/**
 * The Bayernliga special: every club carries one or two men who should have
 * stopped a decade ago and did not.
 */
export const VETERAN_MIN = 1;
export const VETERAN_MAX = 2;
export const VETERAN_ANTEIL_JUNG = 0.75;
export const VETERAN_JUNG = /** @type {[number, number]} */ ([45, 55]);
export const VETERAN_ALT = /** @type {[number, number]} */ ([56, 65]);
export const VETERAN_RUECKTRITT_MAX = 66;
/** Where a fifty-year-old still plausibly lines up. */
export const VETERAN_POSITIONEN = /** @type {Position[]} */ (['OL', 'DL']);

/** Match simulation. */
export const BASE_POINTS = 20;        // what an evenly matched offence scores
export const RATING_TO_POINTS = 0.42; // points gained per point of unit advantage
export const HOME_ADVANTAGE = 2.5;    // points, applied to the home side
export const MATCH_NOISE = 6.5;       // std-dev-ish spread on the expected score
export const MIN_EXPECTED = 3;
export const MAX_EXPECTED = 56;

/**
 * Standings: German American football scores 2:0 for a win. There is no third
 * outcome — overtime runs until somebody is ahead, in the group stage as well
 * as in the playoffs, so no draw ever reaches the table.
 */
export const POINTS_WIN = 2;
export const POINTS_LOSS = 0;

/** Injuries. */
export const INJURY_CHANCE_PER_GAME = 0.055; // per team, per match
export const INJURY_MIN_WEEKS = 1;
export const INJURY_MAX_WEEKS = 6;

/**
 * Overtime never ends level, so the loop has no round limit. It terminates on
 * its own — each possession scores a touchdown with at least 9 % probability
 * per side, so the two sides separate almost surely. The brake exists only so
 * that a broken RNG can never hang the game, and it decides rather than ties.
 */
export const OT_NOTBREMSE_RUNDEN = 50;

/** Season structure: two groups of six, then a bracket across them. */
export const SEASON_START_YEAR = 2026;
/** Playoff berths per group. Two of six, which is the bracket the league uses. */
export const PLAYOFF_PLAETZE = 2;

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

/**
 * Draw from a pool of [value, weight] pairs. Weights are plain integers so a
 * single name can be nudged by hand without recomputing a distribution.
 * @template T @param {() => number} rng @param {readonly (readonly [T, number])[]} pool
 * @returns {T}
 */
export function pickWeighted(rng, pool) {
  let summe = 0;
  for (const eintrag of pool) summe += eintrag[1];
  let wurf = rng() * summe;
  for (const eintrag of pool) {
    wurf -= eintrag[1];
    if (wurf < 0) return eintrag[0];
  }
  return pool[pool.length - 1][0];
}

/**
 * Four uniforms averaged have a standard deviation of 1/sqrt(48), so this is
 * the factor that makes the result a unit normal. Getting it wrong halves
 * every spread that goes through here, silently.
 */
const NORMAL_SKALIERUNG = Math.sqrt(48);

/** Roughly normal, mean 0, standard deviation 1. @param {() => number} rng */
export function randNormal(rng) {
  return ((rng() + rng() + rng() + rng()) / 4 - 0.5) * NORMAL_SKALIERUNG;
}

/** Fisher-Yates, in place. @template T @param {() => number} rng @param {T[]} arr */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
