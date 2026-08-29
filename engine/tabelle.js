// @ts-check
/**
 * The Tabelle: standings derived from the played fixtures.
 * Derived state — never stored, always recomputed, so a save can never carry
 * a table that disagrees with its own results.
 */

import { POINTS_WIN, POINTS_TIE, POINTS_LOSS } from './constants.js';

/**
 * @typedef {object} TabellenZeile
 * @property {string} teamId
 * @property {number} platz
 * @property {number} spiele
 * @property {number} siege
 * @property {number} niederlagen
 * @property {number} unentschieden
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
      unentschieden: 0, punkte: 0, erzielt: 0, kassiert: 0, differenz: 0,
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

    if (hp > gp) {
      heim.siege++; heim.punkte += POINTS_WIN;
      gast.niederlagen++; gast.punkte += POINTS_LOSS;
    } else if (gp > hp) {
      gast.siege++; gast.punkte += POINTS_WIN;
      heim.niederlagen++; heim.punkte += POINTS_LOSS;
    } else {
      heim.unentschieden++; heim.punkte += POINTS_TIE;
      gast.unentschieden++; gast.punkte += POINTS_TIE;
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

/** Bilanz as the UI writes it: "5-2" or "5-2-1". @param {TabellenZeile} z */
export function bilanz(z) {
  return z.unentschieden > 0
    ? `${z.siege}-${z.niederlagen}-${z.unentschieden}`
    : `${z.siege}-${z.niederlagen}`;
}
