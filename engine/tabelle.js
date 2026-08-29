// @ts-check
/**
 * The Tabelle: standings derived from the played fixtures.
 * Derived state — never stored, always recomputed, so a save can never carry
 * a table that disagrees with its own results.
 *
 * One table per group. The two groups never meet before the playoffs, so a
 * combined table of all twelve would compare clubs that share no opponent.
 */

import { POINTS_WIN, POINTS_LOSS } from './constants.js';

/**
 * @typedef {object} TabellenZeile
 * @property {string} teamId
 * @property {number} platz
 * @property {number} spiele
 * @property {number} siege
 * @property {number} niederlagen
 * @property {number} punkte        League points (2:0 system)
 * @property {number} erzielt       Points scored
 * @property {number} kassiert      Points allowed
 * @property {number} differenz
 */

/**
 * @param {string[]} teamIds
 * @param {import('./spielplan.js').Partie[]} plan
 * @returns {TabellenZeile[]}
 */
export function berechneTabelle(teamIds, plan) {
  /** @type {Map<string, TabellenZeile>} */
  const zeilen = new Map();
  for (const id of teamIds) {
    zeilen.set(id, {
      teamId: id, platz: 0, spiele: 0, siege: 0, niederlagen: 0,
      punkte: 0, erzielt: 0, kassiert: 0, differenz: 0,
    });
  }

  for (const p of plan) {
    if (!p.ergebnis) continue;
    const heim = zeilen.get(p.heim);
    const gast = zeilen.get(p.gast);
    if (!heim || !gast) continue;

    const hp = p.ergebnis.heimPunkte;
    const gp = p.ergebnis.gastPunkte;

    heim.spiele++; gast.spiele++;
    heim.erzielt += hp; heim.kassiert += gp;
    gast.erzielt += gp; gast.kassiert += hp;

    // A match always has a winner — overtime runs until it does.
    if (hp > gp) {
      heim.siege++; heim.punkte += POINTS_WIN;
      gast.niederlagen++; gast.punkte += POINTS_LOSS;
    } else {
      gast.siege++; gast.punkte += POINTS_WIN;
      heim.niederlagen++; heim.punkte += POINTS_LOSS;
    }
  }

  const sortiert = [...zeilen.values()];
  for (const z of sortiert) z.differenz = z.erzielt - z.kassiert;

  // League points, then point differential, then points scored, then name.
  sortiert.sort((a, b) =>
    b.punkte - a.punkte
    || b.differenz - a.differenz
    || b.erzielt - a.erzielt
    || a.teamId.localeCompare(b.teamId));

  sortiert.forEach((z, i) => { z.platz = i + 1; });
  return sortiert;
}

/** @param {import('./tabelle.js').TabellenZeile[]} tabelle @param {string} teamId */
export function platzVon(tabelle, teamId) {
  const z = tabelle.find((x) => x.teamId === teamId);
  return z ? z.platz : 0;
}

/** Bilanz as the UI writes it: "5-2". There is no third number. @param {TabellenZeile} z */
export function bilanz(z) {
  return `${z.siege}-${z.niederlagen}`;
}

/**
 * Win percentage. Draws are impossible, but the formula keeps its half-credit
 * term: it is the form the league writes, and it stays correct if a future
 * competition ever does end level.
 * @param {TabellenZeile} z
 */
export function winProzent(z) {
  if (z.spiele === 0) return 0;
  const unentschieden = z.spiele - z.siege - z.niederlagen;
  return (z.siege + 0.5 * unentschieden) / z.spiele;
}

/**
 * Who hosts when two clubs from different groups meet: the better record by
 * win percentage, then by point differential. The teamId only breaks a tie
 * that is otherwise perfect, and only so the bracket stays reproducible.
 * @param {TabellenZeile} a
 * @param {TabellenZeile} b
 * @returns {TabellenZeile} the side with home advantage
 */
export function heimrecht(a, b) {
  const wp = winProzent(b) - winProzent(a);
  if (wp !== 0) return wp > 0 ? b : a;
  if (b.differenz !== a.differenz) return b.differenz > a.differenz ? b : a;
  return a.teamId.localeCompare(b.teamId) <= 0 ? a : b;
}
