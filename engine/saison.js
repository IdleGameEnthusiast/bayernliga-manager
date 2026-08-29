// @ts-check
/**
 * The season: state shape, the matchday tick, and the roll into the next year.
 *
 * A season is ten group matchdays plus a bracket — two semi-finals on matchday
 * eleven, the final on twelve. The bracket is appended to the Spielplan the
 * moment the round before it is complete, so `spieltag` stays one continuous
 * counter and the save never has to describe a phase separately.
 *
 * Docs: docs/spec/02-core-loop.md, docs/spec/03-state-contract.md
 */

import { SEASON_START_YEAR, ZUSATZ_SPIELER, EIGENE_VEREINSBASIS, makeRng } from './constants.js';
import { TEAMS, GRUPPEN, teamById, teamsDerGruppe } from './content.js';
import { T } from '../i18n.js';
import { macheKader, saisonWechsel, resetSpielerIds } from './spieler.js';
import {
  macheGruppenplan, macheHalbfinale, macheFinale, sieger,
  anzahlSpieltage, partienAmSpieltag, partienDerRunde,
} from './spielplan.js';
import { simuliereSpiel } from './spiel.js';
import { berechneTabelle } from './tabelle.js';

export const SAVE_VERSION = 3;

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
 * The baseline every club's Kader is drawn around, once a club has been picked.
 * The player's own club falls to EIGENE_VEREINSBASIS; the ladder of strengths
 * stays exactly as the catalogue has it, so every club that stood below the
 * pick moves up one rung. Only the generator reads this — a match is decided by
 * the players on the field, never by the club's number.
 * @param {string} meinTeam
 * @returns {Record<string, number>} club id -> baseline
 */
export function vereinsBasen(meinTeam) {
  const leiter = TEAMS.map((t) => t.staerke).sort((a, b) => b - a);
  const andere = TEAMS.filter((t) => t.id !== meinTeam).sort((a, b) => b.staerke - a.staerke);

  /** @type {Record<string, number>} */
  const basen = {};
  andere.forEach((t, i) => { basen[t.id] = leiter[i]; });
  basen[meinTeam] = EIGENE_VEREINSBASIS;
  return basen;
}

/** The group stage, as the Spielplan is drawn at the start of a season. */
function frischerGruppenplan(rng) {
  return macheGruppenplan(rng, GRUPPEN.map((g) => teamsDerGruppe(g).map((t) => t.id)));
}

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
  const basen = vereinsBasen(meinTeam);
  // Der eigene Verein startet mit dem nackten Kader, alle anderen mit Reserve.
  for (const t of TEAMS) {
    kader[t.id] = macheKader(rng, basen[t.id], t.id === meinTeam ? 0 : ZUSATZ_SPIELER);
  }

  return {
    version: SAVE_VERSION,
    seed: wirklicherSeed,
    jahr: SEASON_START_YEAR,
    spieltag: 1,
    meinTeam,
    kader,
    spielplan: frischerGruppenplan(rng),
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

/** The last matchday of the group stage. @param {import('./spielplan.js').Partie[]} plan */
export function gruppenSpieltage(plan) {
  return partienDerRunde(plan, 'gruppe').reduce((max, p) => Math.max(max, p.spieltag), 0);
}

/**
 * One group's table, from that group's fixtures only. Playoff results never
 * enter it — the bracket decides the title, not the standings.
 * @param {SpielStand} stand
 * @param {'nord'|'sued'} gruppe
 */
export function gruppenTabelle(stand, gruppe) {
  const ids = teamsDerGruppe(gruppe).map((t) => t.id);
  const partien = partienDerRunde(stand.spielplan, 'gruppe')
    .filter((p) => ids.includes(p.heim) && ids.includes(p.gast));
  return berechneTabelle(ids, partien);
}

/** Both tables, in group order. @param {SpielStand} stand */
export function gruppenTabellen(stand) {
  return GRUPPEN.map((gruppe) => ({ gruppe, zeilen: gruppenTabelle(stand, gruppe) }));
}

/** The table the managed club stands in. @param {SpielStand} stand */
export function meineTabelle(stand) {
  return gruppenTabelle(stand, teamById(stand.meinTeam).gruppe);
}

/** A club's group-stage row. @param {SpielStand} stand @param {string} teamId */
function zeileVon(stand, teamId) {
  const zeile = gruppenTabelle(stand, teamById(teamId).gruppe)
    .find((z) => z.teamId === teamId);
  if (!zeile) throw new Error('Kein Tabellenplatz für ' + teamId);
  return zeile;
}

/**
 * Draw whatever round has just become knowable. Called after every matchday:
 * the semi-finals the moment the group stage is complete, the final the moment
 * both semi-finals are. Doing nothing is the normal case.
 * @param {SpielStand} stand
 */
export function ergaenzePlayoffs(stand) {
  const plan = stand.spielplan;
  const ende = gruppenSpieltage(plan);
  const gruppenspiele = partienDerRunde(plan, 'gruppe');
  if (gruppenspiele.length === 0 || !gruppenspiele.every((p) => p.ergebnis)) return;

  const halbfinale = partienDerRunde(plan, 'halbfinale');
  if (halbfinale.length === 0) {
    plan.push(...macheHalbfinale(
      gruppenTabelle(stand, 'nord'), gruppenTabelle(stand, 'sued'), ende + 1,
    ));
    return;
  }

  if (partienDerRunde(plan, 'finale').length > 0) return;
  if (!halbfinale.every((p) => p.ergebnis)) return;

  const [a, b] = halbfinale.map((p) => /** @type {string} */ (sieger(p)));
  plan.push(macheFinale(zeileVon(stand, a), zeileVon(stand, b), ende + 2));
}

/** The champion, once the final has been played. @param {SpielStand} stand */
export function meister(stand) {
  const finale = partienDerRunde(stand.spielplan, 'finale')[0];
  return finale ? sieger(finale) : null;
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
    stand.verlauf.push(T.log.partie(
      meins.runde === 'gruppe' ? `${T.spielplan.spieltag} ${spieltag}` : T.runde[meins.runde],
      eigene > fremde ? T.log.sieg : T.log.niederlage,
      eigene, fremde,
    ));
  }

  stand.spieltag++;
  ergaenzePlayoffs(stand);
  return { partien, verletzungen: alleVerletzungen };
}

/**
 * Close the season out and start the next one: everyone ages, retirees are
 * replaced, and a new group stage is drawn. The champion is whoever won the
 * final — never the club that topped a group table.
 * @param {SpielStand} stand
 * @returns {{ meister: string, ruecktritte: import('./spieler.js').Spieler[] }}
 */
export function naechsteSaison(stand) {
  const champion = meister(stand);
  if (!champion) throw new Error('Die Saison ist noch nicht entschieden');
  const meinPlatz = meineTabelle(stand).findIndex((z) => z.teamId === stand.meinTeam) + 1;

  stand.historie.push({ jahr: stand.jahr, meister: champion, meinPlatz });

  const rng = makeRng(`${stand.seed}|offseason|${stand.jahr}`);
  /** @type {import('./spieler.js').Spieler[]} */
  const alleRuecktritte = [];

  const basen = vereinsBasen(stand.meinTeam);
  for (const t of TEAMS) {
    const { kader, ruecktritte } = saisonWechsel(rng, stand.kader[t.id], basen[t.id]);
    stand.kader[t.id] = kader;
    if (t.id === stand.meinTeam) alleRuecktritte.push(...ruecktritte);
  }

  stand.jahr++;
  stand.spieltag = 1;
  stand.spielplan = frischerGruppenplan(rng);
  stand.verlauf.push(T.log.saisonEnde(stand.jahr - 1, teamById(champion).name));

  return { meister: champion, ruecktritte: alleRuecktritte };
}

export { anzahlSpieltage };
