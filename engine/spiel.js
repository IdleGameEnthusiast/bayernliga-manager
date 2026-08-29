// @ts-check
/**
 * The match simulation.
 *
 * Season-manager depth: no play-by-play, but a plausible final score with a
 * quarter-by-quarter line and a box score built from the players who actually
 * took the field. Pure — it mutates nothing, and hands injuries back to the
 * caller to apply.
 *
 * Docs: docs/spec/04-economy-formulas.md
 */

import {
  BASE_POINTS, RATING_TO_POINTS, HOME_ADVANTAGE, MATCH_NOISE,
  MIN_EXPECTED, MAX_EXPECTED, INJURY_CHANCE_PER_GAME,
  INJURY_MIN_WEEKS, INJURY_MAX_WEEKS, OT_NOTBREMSE_RUNDEN,
  clamp, randInt, randNormal, pick,
} from './constants.js';
import { teamStaerken } from './team.js';
import { verfuegbar, kurzName } from './spieler.js';

/**
 * @typedef {object} SpielerStat
 * @property {string} spielerId
 * @property {string} name
 * @property {number} [comp]
 * @property {number} [att]
 * @property {number} yards
 * @property {number} td
 * @property {number} [int]
 * @property {number} [rec]
 */

/**
 * @typedef {object} TeamStats
 * @property {SpielerStat | null} passing
 * @property {SpielerStat | null} rushing
 * @property {SpielerStat | null} receiving
 * @property {number} yardsGesamt
 */

/**
 * @typedef {object} Verletzung
 * @property {string} teamId
 * @property {string} spielerId
 * @property {string} name
 * @property {string} position
 * @property {number} wochen
 */

/**
 * @typedef {object} Ergebnis
 * @property {number} heimPunkte
 * @property {number} gastPunkte
 * @property {number[]} heimViertel
 * @property {number[]} gastViertel
 * @property {boolean} verlaengerung
 * @property {TeamStats} heimStats
 * @property {TeamStats} gastStats
 * @property {Verletzung[]} verletzungen
 */

/** Scoring events, with the weight each carries. Sums to 1. */
const SCORE_EVENTS = [
  { punkte: 7, gewicht: 0.55, td: true },  // Touchdown + Extrapunkt
  { punkte: 3, gewicht: 0.30, td: false }, // Field Goal
  { punkte: 6, gewicht: 0.07, td: true },  // Touchdown, Extrapunkt vergeben
  { punkte: 8, gewicht: 0.06, td: true },  // Touchdown + 2-Punkte-Conversion
  { punkte: 2, gewicht: 0.02, td: false }, // Safety
];

/**
 * Turn an expected point total into concrete scoring plays spread over four
 * quarters. Returns the quarter line and how many were touchdowns.
 * @param {() => number} rng
 * @param {number} erwartet
 * @returns {{ viertel: number[], punkte: number, touchdowns: number, fieldGoals: number }}
 */
export function baueScore(rng, erwartet) {
  const viertel = [0, 0, 0, 0];
  let punkte = 0;
  let touchdowns = 0;
  let fieldGoals = 0;

  while (punkte < erwartet - 2) {
    const r = rng();
    let acc = 0;
    let ereignis = SCORE_EVENTS[0];
    for (const e of SCORE_EVENTS) {
      acc += e.gewicht;
      if (r <= acc) { ereignis = e; break; }
    }
    viertel[waehleViertel(rng)] += ereignis.punkte;
    punkte += ereignis.punkte;
    if (ereignis.td) touchdowns++;
    else if (ereignis.punkte === 3) fieldGoals++;
  }

  return { viertel, punkte, touchdowns, fieldGoals };
}

/**
 * In welchem Viertel ein Score fällt. Real steigt das Scoring leicht zum Ende
 * jeder Halbzeit hin an — die Zwei-Minuten-Drill vor der Pause und das
 * Aufholen im vierten Viertel. Die Gewichte summieren sich auf 1.
 * @param {() => number} rng
 */
function waehleViertel(rng) {
  const gewichte = [0.22, 0.28, 0.22, 0.28];
  const r = rng();
  let acc = 0;
  for (let q = 0; q < gewichte.length; q++) {
    acc += gewichte[q];
    if (r <= acc) return q;
  }
  return 3;
}

/**
 * Build the box score for one side from the players who were actually fit.
 * @param {() => number} rng
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @param {number} touchdowns
 * @param {import('./team.js').Staerken} staerken
 * @returns {TeamStats}
 */
export function baueStats(rng, kader, spieltag, touchdowns, staerken) {
  const qb = verfuegbar(kader, 'QB', spieltag)[0] || null;
  const rb = verfuegbar(kader, 'RB', spieltag)[0] || null;
  const wr = verfuegbar(kader, 'WR', spieltag)[0] || null;

  const off = staerken.angriff;

  // Split the touchdowns between the pass and the run.
  const passAnteil = 0.45 + rng() * 0.3;
  const passTd = Math.round(touchdowns * passAnteil);
  const laufTd = Math.max(0, touchdowns - passTd);

  const versuche = randInt(rng, 21, 39);
  const quote = clamp(0.42 + (off - 50) * 0.0055 + randNormal(rng) * 0.05, 0.3, 0.78);
  const komplett = Math.round(versuche * quote);
  const passYards = Math.round(clamp(
    komplett * (9.5 + (off - 50) * 0.09) + randNormal(rng) * 28,
    40, 460,
  ));
  const interceptions = Math.max(0, Math.round(randNormal(rng) * 0.9 + 0.9));

  const laufVersuche = randInt(rng, 14, 32);
  const laufYards = Math.round(clamp(
    laufVersuche * (3.6 + (off - 50) * 0.045) + randNormal(rng) * 22,
    -10, 320,
  ));

  // The top receiver takes a slice of the passing game, not all of it.
  const recAnteil = 0.32 + rng() * 0.24;
  const recYards = Math.round(passYards * recAnteil);
  const recCatches = Math.max(1, Math.round(komplett * recAnteil));

  return {
    passing: qb ? {
      spielerId: qb.id, name: kurzName(qb),
      comp: komplett, att: versuche, yards: passYards, td: passTd, int: interceptions,
    } : null,
    rushing: rb ? {
      spielerId: rb.id, name: kurzName(rb),
      att: laufVersuche, yards: laufYards, td: laufTd,
    } : null,
    receiving: wr ? {
      spielerId: wr.id, name: kurzName(wr),
      rec: recCatches, yards: recYards, td: Math.min(passTd, rng() < 0.6 ? 1 : 0),
    } : null,
    yardsGesamt: passYards + laufYards,
  };
}

/**
 * Roll for an injury on one side.
 * @param {() => number} rng
 * @param {string} teamId
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @returns {Verletzung | null}
 */
export function wuerfelVerletzung(rng, teamId, kader, spieltag) {
  if (rng() >= INJURY_CHANCE_PER_GAME) return null;
  const fit = kader.filter((s) => s.verletztBis <= spieltag);
  if (fit.length === 0) return null;
  const opfer = pick(rng, fit);
  return {
    teamId,
    spielerId: opfer.id,
    name: opfer.vorname + ' ' + opfer.nachname,
    position: opfer.position,
    wochen: randInt(rng, INJURY_MIN_WEEKS, INJURY_MAX_WEEKS),
  };
}

/**
 * Play one match.
 * @param {() => number} rng
 * @param {{ id: string, kader: import('./spieler.js').Spieler[] }} heim
 * @param {{ id: string, kader: import('./spieler.js').Spieler[] }} gast
 * @param {number} spieltag
 * @returns {Ergebnis}
 */
export function simuliereSpiel(rng, heim, gast, spieltag) {
  const heimStaerken = teamStaerken(heim.kader, spieltag);
  const gastStaerken = teamStaerken(gast.kader, spieltag);

  const heimErwartet = clamp(
    BASE_POINTS
      + (heimStaerken.angriff - gastStaerken.verteidigung) * RATING_TO_POINTS
      + heimStaerken.special * 0.02
      + HOME_ADVANTAGE
      + randNormal(rng) * MATCH_NOISE,
    MIN_EXPECTED, MAX_EXPECTED,
  );
  const gastErwartet = clamp(
    BASE_POINTS
      + (gastStaerken.angriff - heimStaerken.verteidigung) * RATING_TO_POINTS
      + gastStaerken.special * 0.02
      + randNormal(rng) * MATCH_NOISE,
    MIN_EXPECTED, MAX_EXPECTED,
  );

  const h = baueScore(rng, heimErwartet);
  const g = baueScore(rng, gastErwartet);

  let heimPunkte = h.punkte;
  let gastPunkte = g.punkte;
  let heimTds = h.touchdowns;
  let gastTds = g.touchdowns;
  let verlaengerung = false;

  // Overtime: each side gets a possession, and it repeats until one of them is
  // ahead. There is no round limit — the league knows no draw, not in the
  // group stage either. The loop ends on its own because each possession
  // scores a touchdown with at least 9 % probability per side, so the two
  // separate almost surely; OT_NOTBREMSE_RUNDEN is only there so a broken RNG
  // cannot hang the game, and it decides the match rather than levelling it.
  let runden = 0;
  while (heimPunkte === gastPunkte) {
    verlaengerung = true;
    runden++;
    if (runden > OT_NOTBREMSE_RUNDEN) {
      if (rng() < 0.5) heimPunkte += 3; else gastPunkte += 3;
      break;
    }
    const hOt = otBesitz(rng, heimStaerken.angriff - gastStaerken.verteidigung);
    const gOt = otBesitz(rng, gastStaerken.angriff - heimStaerken.verteidigung);
    heimPunkte += hOt.punkte;
    gastPunkte += gOt.punkte;
    heimTds += hOt.td;
    gastTds += gOt.td;
  }

  /** @type {Verletzung[]} */
  const verletzungen = [];
  const vH = wuerfelVerletzung(rng, heim.id, heim.kader, spieltag);
  if (vH) verletzungen.push(vH);
  const vG = wuerfelVerletzung(rng, gast.id, gast.kader, spieltag);
  if (vG) verletzungen.push(vG);

  return {
    heimPunkte,
    gastPunkte,
    heimViertel: h.viertel,
    gastViertel: g.viertel,
    verlaengerung,
    heimStats: baueStats(rng, heim.kader, spieltag, heimTds, heimStaerken),
    gastStats: baueStats(rng, gast.kader, spieltag, gastTds, gastStaerken),
    verletzungen,
  };
}

/**
 * One overtime possession.
 * @param {() => number} rng
 * @param {number} vorteil
 */
function otBesitz(rng, vorteil) {
  const p = clamp(0.5 + vorteil * 0.012, 0.2, 0.8);
  const r = rng();
  if (r < p * 0.45) return { punkte: 7, td: 1 };
  if (r < p * 0.45 + 0.35) return { punkte: 3, td: 0 };
  return { punkte: 0, td: 0 };
}
