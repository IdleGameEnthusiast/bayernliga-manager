// @ts-check
/**
 * The season: state shape, the matchday tick, and the roll into the next year.
 * Docs: docs/spec/02-core-loop.md, docs/spec/03-state-contract.md
 */

import { SEASON_START_YEAR, makeRng } from './constants.js';
import { TEAMS } from './content.js';
import { macheKader, saisonWechsel, resetSpielerIds } from './spieler.js';
import { macheSpielplan, anzahlSpieltage, partienAmSpieltag } from './spielplan.js';
import { simuliereSpiel } from './spiel.js';
import { berechneTabelle } from './tabelle.js';

export const SAVE_VERSION = 1;

/**
 * @typedef {object} SpielStand
 * @property {number} version
 * @property {string} seed
 * @property {number} jahr
 * @property {number} spieltag        Next matchday to play; > anzahlSpieltage means the season is over
 * @property {string} meinTeam
 * @property {Record<string, import('./spieler.js').Spieler[]>} kader  by team id
 * @property {import('./spielplan.js').Partie[]} spielplan
 * @property {string[]} verlauf       Log lines, newest last
 * @property {{ jahr: number, meister: string, meinPlatz: number }[]} historie
 */

/**
 * A fresh career.
 * @param {string} meinTeam
 * @param {string} [seed]
 * @returns {SpielStand}
 */
export function neuesSpiel(meinTeam, seed) {
  const wirklicherSeed = seed || String(Date.now());
  const rng = makeRng(wirklicherSeed);
  resetSpielerIds();

  /** @type {Record<string, import('./spieler.js').Spieler[]>} */
  const kader = {};
  for (const t of TEAMS) {
    kader[t.id] = macheKader(rng, t.staerke);
  }

  return {
    version: SAVE_VERSION,
    seed: wirklicherSeed,
    jahr: SEASON_START_YEAR,
    spieltag: 1,
    meinTeam,
    kader,
    spielplan: macheSpielplan(rng, TEAMS.map((t) => t.id)),
    verlauf: [],
    historie: [],
  };
}

/**
 * The RNG for one matchday. Derived from the save seed so replaying a season
 * from the same save produces the same results.
 * @param {SpielStand} stand
 */
function spieltagRng(stand) {
  return makeRng(`${stand.seed}|${stand.jahr}|${stand.spieltag}`);
}

/** @param {SpielStand} stand */
export function saisonVorbei(stand) {
  return stand.spieltag > anzahlSpieltage(stand.spielplan);
}

/** @param {SpielStand} stand */
export function tabelle(stand) {
  return berechneTabelle(TEAMS.map((t) => t.id), stand.spielplan);
}

/**
 * Play the current matchday. Mutates `stand` and returns what happened, so the
 * UI can show a report without recomputing it.
 * @param {SpielStand} stand
 * @returns {{ partien: import('./spielplan.js').Partie[], verletzungen: import('./spiel.js').Verletzung[] } | null}
 */
export function spieleSpieltag(stand) {
  if (saisonVorbei(stand)) return null;

  const rng = spieltagRng(stand);
  const spieltag = stand.spieltag;
  const partien = partienAmSpieltag(stand.spielplan, spieltag);
  /** @type {import('./spiel.js').Verletzung[]} */
  const alleVerletzungen = [];

  for (const p of partien) {
    const ergebnis = simuliereSpiel(
      rng,
      { id: p.heim, kader: stand.kader[p.heim] },
      { id: p.gast, kader: stand.kader[p.gast] },
      spieltag,
    );
    p.ergebnis = ergebnis;

    for (const v of ergebnis.verletzungen) {
      const spieler = stand.kader[v.teamId].find((s) => s.id === v.spielerId);
      if (spieler) spieler.verletztBis = spieltag + v.wochen;
      alleVerletzungen.push(v);
    }
  }

  // Log only what concerns the club the player manages.
  const meins = partien.find((p) => p.heim === stand.meinTeam || p.gast === stand.meinTeam);
  if (meins && meins.ergebnis) {
    const heimIstMeins = meins.heim === stand.meinTeam;
    const eigene = heimIstMeins ? meins.ergebnis.heimPunkte : meins.ergebnis.gastPunkte;
    const fremde = heimIstMeins ? meins.ergebnis.gastPunkte : meins.ergebnis.heimPunkte;
    const ausgang = eigene > fremde ? 'Sieg' : eigene < fremde ? 'Niederlage' : 'Unentschieden';
    stand.verlauf.push(`Spieltag ${spieltag}: ${ausgang} ${eigene}:${fremde}`);
  }

  stand.spieltag++;
  return { partien, verletzungen: alleVerletzungen };
}

/**
 * Close the season out and start the next one: everyone ages, retirees are
 * replaced, and a new Spielplan is drawn.
 * @param {SpielStand} stand
 * @returns {{ meister: string, ruecktritte: import('./spieler.js').Spieler[] }}
 */
export function naechsteSaison(stand) {
  const abschluss = tabelle(stand);
  const meister = abschluss[0].teamId;
  const meinPlatz = abschluss.findIndex((z) => z.teamId === stand.meinTeam) + 1;

  stand.historie.push({ jahr: stand.jahr, meister, meinPlatz });

  const rng = makeRng(`${stand.seed}|offseason|${stand.jahr}`);
  /** @type {import('./spieler.js').Spieler[]} */
  const alleRuecktritte = [];

  for (const t of TEAMS) {
    const { kader, ruecktritte } = saisonWechsel(rng, stand.kader[t.id], t.staerke);
    stand.kader[t.id] = kader;
    if (t.id === stand.meinTeam) alleRuecktritte.push(...ruecktritte);
  }

  stand.jahr++;
  stand.spieltag = 1;
  stand.spielplan = macheSpielplan(rng, TEAMS.map((t) => t.id));
  stand.verlauf.push(`Saison ${stand.jahr - 1} beendet — Meister: ${meister}`);

  return { meister, ruecktritte: alleRuecktritte };
}

export { anzahlSpieltage };
