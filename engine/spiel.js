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
  AUSGEWOGENHEIT, KLIPPE, RAND,
  clamp, randInt, randNormal, pickWeighted,
} from './constants.js';
import { teamStaerken } from './team.js';
import { doppelEinsaetze, doppelRisiko, PERSONNEL, STANDARD_PERSONNEL } from './aufstellung.js';
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
 * @property {{ heim: import('./aufstellung.js').Aufstellung, gast: import('./aufstellung.js').Aufstellung }} aufstellungen
 *   Wer tatsächlich auf dem Feld stand. Flüchtig: `spieleSpieltag()` bucht daraus
 *   die Einsätze und streift das Feld ab, bevor das Ergebnis im Spielplan landet.
 *   Es hier zurückzugeben und nicht später neu zu rechnen ist wichtig — nach dem
 *   Spiel stehen die Verletzungen schon im Kader, und `stelleAuf()` käme dann auf
 *   eine andere Elf als die, die gespielt hat.
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
 * Der Passanteil eines Vereins: der Vorschlag seiner Gruppierung, sofern der
 * Manager ihn nicht verschoben hat.
 * @param {{ personnel?: string, passAnteil?: number }} verein
 */
export function passAnteilVon(verein) {
  if (typeof verein.passAnteil === 'number') return clamp(verein.passAnteil, 0, 1);
  const gruppierung = PERSONNEL[verein.personnel || ''] || PERSONNEL[STANDARD_PERSONNEL];
  return gruppierung.passAnteil;
}

/** x·ln x, mit dem Grenzwert 0 an der Null. */
function xlnx(x) {
  return x <= 0 ? 0 : x * Math.log(x);
}

/**
 * Die Strafe für Einseitigkeit: null bei 50/50, an den Enden `-AUSGEWOGENHEIT · ln2`.
 *
 * Es ist die binäre Entropie, und die ist hier keine Koketterie. Ihre Ableitung
 * geht an den Rändern gegen unendlich, weshalb `vorteil()` sein Maximum immer
 * echt innen hat — für jeden noch so schiefen Kader, ohne Klammerung und ohne
 * Sonderfall. Eine Parabel kippt bei genügend schiefem d wieder in die Ecke.
 * @param {number} passAnteil
 */
function einseitig(passAnteil) {
  return -AUSGEWOGENHEIT * (Math.LN2 + xlnx(passAnteil) + xlnx(1 - passAnteil));
}

/**
 * Quadratisches Scharnier: null ab RAND, und dort mit waagerechter Ableitung.
 * Der Anschluss ist damit knickfrei — beim Schieben merkt man nichts, bis man
 * im Band ist.
 * @param {number} abstand zum jeweiligen Ende
 */
function saum(abstand) {
  const v = 1 - abstand / RAND;
  return v > 0 ? v * v : 0;
}

/**
 * Ohne Laufandrohung kein Passspiel: die letzten Prozent brechen weg.
 *
 * Die Entropie allein reicht dafür nicht. Sie hat zwar unendliche Steigung am
 * Rand, aber ihr *Betrag* dort verschwindet mit `(1 - a)`: reines Passspiel aus
 * Empty heraus kostete 0,4 Punkte gegen ein Rauschen von 6,5, war also nicht zu
 * bemerken. Mit der Klippe kostet es 7.
 *
 * Der Term ist auf `[RAND, 1 - RAND]` identisch null und kann das Optimum
 * deshalb nicht verschieben — er senkt nur, was ohnehin daneben liegt.
 * @param {number} passAnteil
 */
function klippe(passAnteil) {
  return -KLIPPE * (saum(passAnteil) + saum(1 - passAnteil));
}

/**
 * Der Vorteil einer Mannschaft über die andere.
 *
 * Aus einem Angriffswert sind zwei geworden und aus einem Verteidigungswert
 * auch. Ausgespielt werden beide Duelle und nach dem Passanteil des
 * angreifenden Vereins gemischt: wer läuft, trifft auf die Laufverteidigung
 * des Gegners, und ein Laufteam gegen eine löchrige Front punktet, auch wenn
 * dieselbe Front den Pass gut verteidigt.
 *
 * Gemischt wird **nicht linear**, denn eine Gerade hat ihr Optimum immer an
 * einem Ende. Mit `einseitig()` liegt es bei
 * `sigmoid(((passAngriff - laufAngriff) - (passVert - laufVert)) / AUSGEWOGENHEIT)`,
 * und wo genau, sagt die `neigung` der Gruppierung: sie ist so kalibriert, dass
 * dort deren `passAnteil` herauskommt. Ein Empty-System will werfen, ein Double
 * Wing laufen, und beide zahlen für das Gegenteil.
 * @param {import('./team.js').Staerken} angriff
 * @param {import('./team.js').Staerken} verteidigung des Gegners
 * @param {number} passAnteil des angreifenden Vereins
 */
export function vorteil(angriff, verteidigung, passAnteil) {
  return passAnteil * (angriff.passAngriff - verteidigung.passVerteidigung)
    + (1 - passAnteil) * (angriff.laufAngriff - verteidigung.laufVerteidigung)
    + einseitig(passAnteil) + klippe(passAnteil);
}

/**
 * Der Angriffswert einer Mannschaft als eine Zahl, nach ihrem eigenen
 * Passanteil gemischt. Nur der Box Score liest ihn — die Punkte kommen aus
 * den beiden Duellen.
 * @param {import('./team.js').Staerken} s
 * @param {number} passAnteil
 */
export function angriffGemischt(s, passAnteil) {
  return s.passAngriff * passAnteil + s.laufAngriff * (1 - passAnteil);
}

/**
 * Build the box score for one side from the players who were actually fit.
 * @param {() => number} rng
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @param {number} touchdowns
 * @param {import('./team.js').Staerken} staerken
 * @param {number} [passAnteil] Ausrichtung des Vereins; teilt die Touchdowns auf
 * @returns {TeamStats}
 */
export function baueStats(rng, kader, spieltag, touchdowns, staerken, passAnteil = 0.6) {
  const qb = verfuegbar(kader, 'QB', spieltag)[0] || null;
  const rb = verfuegbar(kader, 'RB', spieltag)[0] || null;
  const wr = verfuegbar(kader, 'WR', spieltag)[0] || null;

  const off = angriffGemischt(staerken, passAnteil);

  // Die Touchdowns teilen sich nach der Ausrichtung des Vereins auf, nicht
  // nach einem Wurf: ein Double Wing läuft sie ins Feld, ein Empty wirft sie.
  const anteilHeute = clamp(passAnteil + randNormal(rng) * 0.08, 0.1, 0.92);
  const passTd = Math.round(touchdowns * anteilHeute);
  const laufTd = Math.max(0, touchdowns - passTd);

  const versuche = randInt(rng, 21, 39);
  const quote = clamp(0.42 + (off - 50) * 0.0055 + randNormal(rng) * 0.05, 0.3, 0.78);
  const komplett = Math.round(versuche * quote);
  const passYards = Math.round(clamp(
    komplett * (9.5 + (off - 50) * 0.09) + randNormal(rng) * 28,
    40, 460,
  ));
  const interceptions = Math.max(0, Math.round(randNormal(rng) * 0.9 + 0.9));

  // Wer läuft, läuft öfter: von zwanzig Versuchen im Empty bis über dreißig
  // im Double Wing.
  const laufVersuche = randInt(rng, 14, 32) + Math.round((0.6 - anteilHeute) * 16);
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
      att: Math.max(6, laufVersuche), yards: laufYards, td: laufTd,
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
 *
 * Whom it hits is drawn from the fit players, but not evenly: a man who spent
 * the afternoon in both units is two to four times as likely to be the one
 * carried off, and how much of that he carries is his own Robustheit. That is
 * the second half of the double-duty price — the first is the deduction on
 * what he is worth out there.
 * @param {() => number} rng
 * @param {string} teamId
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @param {string[]} [doppelt] ids of the men who played both ways
 * @returns {Verletzung | null}
 */
export function wuerfelVerletzung(rng, teamId, kader, spieltag, doppelt = []) {
  if (rng() >= INJURY_CHANCE_PER_GAME) return null;
  const fit = kader.filter((s) => s.verletztBis <= spieltag);
  if (fit.length === 0) return null;
  const doppelSet = new Set(doppelt);
  const opfer = pickWeighted(rng, fit.map((s) => /** @type {[typeof s, number]} */ ([
    s, doppelSet.has(s.id) ? doppelRisiko(s.attribute.robustheit) : 1,
  ])));
  return {
    teamId,
    spielerId: opfer.id,
    name: opfer.vorname + ' ' + opfer.nachname,
    position: opfer.position,
    wochen: randInt(rng, INJURY_MIN_WEEKS, INJURY_MAX_WEEKS),
  };
}

/**
 * Ein Verein, wie die Simulation ihn braucht. Die Aufstellung von Hand hat nur
 * der eigene — ein KI-Verein bekommt keine mit und stellt darum immer
 * automatisch auf.
 * @typedef {object} Antritt
 * @property {string} id
 * @property {import('./spieler.js').Spieler[]} kader
 * @property {string} [personnel]
 * @property {number} [passAnteil]
 * @property {import('./aufstellung.js').Vorgabe | null} [aufstellung]
 */

/**
 * Play one match.
 * @param {() => number} rng
 * @param {Antritt} heim
 * @param {Antritt} gast
 * @param {number} spieltag
 * @returns {Ergebnis}
 */
export function simuliereSpiel(rng, heim, gast, spieltag) {
  const heimAnteil = passAnteilVon(heim);
  const gastAnteil = passAnteilVon(gast);
  const heimStaerken = teamStaerken(
    heim.kader, spieltag, heim.personnel, heim.passAnteil, heim.aufstellung);
  const gastStaerken = teamStaerken(
    gast.kader, spieltag, gast.personnel, gast.passAnteil, gast.aufstellung);

  const heimErwartet = clamp(
    BASE_POINTS
      + vorteil(heimStaerken, gastStaerken, heimAnteil) * RATING_TO_POINTS
      + heimStaerken.special * 0.02
      + HOME_ADVANTAGE
      + randNormal(rng) * MATCH_NOISE,
    MIN_EXPECTED, MAX_EXPECTED,
  );
  const gastErwartet = clamp(
    BASE_POINTS
      + vorteil(gastStaerken, heimStaerken, gastAnteil) * RATING_TO_POINTS
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
    const hOt = otBesitz(rng, vorteil(heimStaerken, gastStaerken, heimAnteil));
    const gOt = otBesitz(rng, vorteil(gastStaerken, heimStaerken, gastAnteil));
    heimPunkte += hOt.punkte;
    gastPunkte += gOt.punkte;
    heimTds += hOt.td;
    gastTds += gOt.td;
  }

  /** @type {Verletzung[]} */
  const verletzungen = [];
  const vH = wuerfelVerletzung(rng, heim.id, heim.kader, spieltag,
    doppelEinsaetze(heimStaerken.aufstellung));
  if (vH) verletzungen.push(vH);
  const vG = wuerfelVerletzung(rng, gast.id, gast.kader, spieltag,
    doppelEinsaetze(gastStaerken.aufstellung));
  if (vG) verletzungen.push(vG);

  return {
    heimPunkte,
    gastPunkte,
    heimViertel: h.viertel,
    gastViertel: g.viertel,
    verlaengerung,
    heimStats: baueStats(rng, heim.kader, spieltag, heimTds, heimStaerken, heimAnteil),
    gastStats: baueStats(rng, gast.kader, spieltag, gastTds, gastStaerken, gastAnteil),
    verletzungen,
    aufstellungen: { heim: heimStaerken.aufstellung, gast: gastStaerken.aufstellung },
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
