// @ts-check
/**
 * Teamstärke: wie aus einem Kader die Zahlen werden, mit denen die Simulation
 * rechnet.
 *
 * Seit dem Positionsumbau steht dazwischen die Aufstellung. Es gibt nicht mehr
 * eine Angriffs- und eine Verteidigungszahl, sondern je eine fürs Laufspiel
 * und eine fürs Passspiel — dieselben elf Leute sind in verschiedenen Systemen
 * verschieden viel wert.
 *
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 6
 */

import { ERSATZ_STAERKE } from './constants.js';
import { istFit } from './spieler.js';
import {
  PERSONNEL, STANDARD_PERSONNEL, OL_PLAETZE, QB_PLATZ, DEFENSE_PLAETZE,
  BLOCK_GEWICHT, PLATZ_ANTEIL, stelleAuf, skillAnteile, blockWert,
  kickerWert, punterWert,
} from './aufstellung.js';

export { kickerWert, punterWert };

/**
 * @typedef {object} Staerken
 * @property {number} passAngriff
 * @property {number} laufAngriff
 * @property {number} passVerteidigung
 * @property {number} laufVerteidigung
 * @property {number} special
 * @property {number} angriff        Übergang: das Mittel beider Angriffswerte
 * @property {number} verteidigung   Übergang: das Mittel beider Verteidigungswerte
 * @property {import('./aufstellung.js').Aufstellung} aufstellung
 */

/**
 * Die Plätze eines Blocks in der Reihenfolge ihrer Anteile.
 * @param {import('./aufstellung.js').Platz[]} plaetze
 * @param {readonly string[]} schluessel
 */
function block(plaetze, schluessel) {
  return schluessel.map((k) => {
    const treffer = plaetze.find((p) => p.platz === k);
    if (!treffer) throw new Error(`Der Platz ${k} fehlt in der Aufstellung`);
    return treffer;
  });
}

/**
 * Der beste Fuß im Kader für eine der beiden Aufgaben.
 *
 * Gesucht wird im *ganzen* Kader, nicht auf einem K- oder P-Platz: kein
 * Bayernligaverein hält einen Spezialisten. Ein Mann darf beide Aufgaben
 * haben — das ist der eine Doppeleinsatz, den die Regeln ungefragt erlauben.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @param {(s: import('./spieler.js').Spieler) => number} wert
 */
export function besterFuss(kader, spieltag, wert) {
  let bester = ERSATZ_STAERKE;
  for (const s of kader) {
    if (!istFit(s, spieltag)) continue;
    const w = wert(s);
    if (w > bester) bester = w;
  }
  return bester;
}

/**
 * Die Werte einer Mannschaft zu einem Zeitpunkt der Saison.
 *
 * Die Blockgewichte sind das Modell: im Passspiel trägt der Quarterback, im
 * Laufspiel die Linie und die fünf Skill-Plätze zu gleichen Teilen. In der
 * Verteidigung ist es spiegelbildlich — gegen den Lauf stehen Line und
 * Linebacker, gegen den Pass die Secondary.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @param {string} [personnel]
 * @param {number} [passAnteil]
 * @returns {Staerken}
 */
export function teamStaerken(kader, spieltag, personnel = STANDARD_PERSONNEL, passAnteil) {
  const gruppierung = PERSONNEL[personnel] || PERSONNEL[STANDARD_PERSONNEL];
  const aufstellung = stelleAuf(kader, spieltag, personnel, passAnteil);

  const qb = block(aufstellung.offense, [QB_PLATZ]);
  const ol = block(aufstellung.offense, OL_PLAETZE);
  const skill = aufstellung.offense.slice(1 + OL_PLAETZE.length);
  const anteile = skillAnteile(gruppierung.skill);

  const dl = block(aufstellung.defense, ['LDE', 'RDE', 'DT', 'NT']);
  const lb = block(aufstellung.defense, ['MLB', 'SAM', 'WILL']);
  const db = block(aufstellung.defense, ['LCB', 'RCB', 'FS', 'SS']);

  /** @param {'pass'|'lauf'} art */
  const angriff = (art) => {
    const g = BLOCK_GEWICHT.angriff[art];
    return blockWert(qb, [1], art) * g.qb
      + blockWert(ol, OL_PLAETZE.map((p) => PLATZ_ANTEIL.ol[art][p]), art) * g.ol
      + blockWert(skill, anteile[art], art) * g.skill;
  };
  /** @param {'pass'|'lauf'} art */
  const verteidigung = (art) => {
    const g = BLOCK_GEWICHT.verteidigung[art];
    return blockWert(dl, ['LDE', 'RDE', 'DT', 'NT'].map((p) => PLATZ_ANTEIL.dl[art][p]), art) * g.dl
      + blockWert(lb, ['MLB', 'SAM', 'WILL'].map((p) => PLATZ_ANTEIL.lb[art][p]), art) * g.lb
      + blockWert(db, ['LCB', 'RCB', 'FS', 'SS'].map((p) => PLATZ_ANTEIL.db[art][p]), art) * g.db;
  };

  const passAngriff = angriff('pass');
  const laufAngriff = angriff('lauf');
  const passVerteidigung = verteidigung('pass');
  const laufVerteidigung = verteidigung('lauf');

  const k = aufstellung.k ? kickerWert(aufstellung.k) : ERSATZ_STAERKE;
  const p = aufstellung.p ? punterWert(aufstellung.p) : ERSATZ_STAERKE;

  return {
    passAngriff,
    laufAngriff,
    passVerteidigung,
    laufVerteidigung,
    special: k * 0.7 + p * 0.3,
    // Übergangsfelder, bis die Simulation in Inkrement 5 beide Duelle selbst
    // ausspielt. Danach fallen sie weg.
    angriff: (passAngriff + laufAngriff) / 2,
    verteidigung: (passVerteidigung + laufVerteidigung) / 2,
    aufstellung,
  };
}

/**
 * Eine Zahl für die Tabelle und die Scoutingansicht.
 * @param {Staerken} s
 */
export function gesamtStaerke(s) {
  return Math.round(s.angriff * 0.46 + s.verteidigung * 0.46 + s.special * 0.08);
}

/**
 * Wie viele Spieler gerade nicht zur Verfügung stehen.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 */
export function verletzte(kader, spieltag) {
  return kader.filter((s) => s.verletztBis > spieltag);
}
