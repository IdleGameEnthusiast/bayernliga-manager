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
  const skill = aufstellung.offense.slice(1, 1 + gruppierung.skill.length);
  const anteile = skillAnteile(gruppierung.skill);

  const dl = block(aufstellung.defense, ['LE', 'RE', 'DT', 'NT']);
  const lb = block(aufstellung.defense, ['MIKE', 'SAM', 'WILL']);
  const db = block(aufstellung.defense, ['CB1', 'CB2', 'FS', 'SS']);

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
    return blockWert(dl, ['LE', 'RE', 'DT', 'NT'].map((p) => PLATZ_ANTEIL.dl[art][p]), art) * g.dl
      + blockWert(lb, ['MIKE', 'SAM', 'WILL'].map((p) => PLATZ_ANTEIL.lb[art][p]), art) * g.lb
      + blockWert(db, ['CB1', 'CB2', 'FS', 'SS'].map((p) => PLATZ_ANTEIL.db[art][p]), art) * g.db;
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
    aufstellung,
  };
}

/**
 * Die Offense als **eine** Zahl: Lauf und Pass zu gleichen Teilen.
 *
 * Bewusst hälftig und nicht nach dem Passanteil des Vereins. Diese Zahl sagt,
 * was die Mannschaft ist, nicht was der Manager gerade mit ihr vorhat — sonst
 * hübschte der Regler den Roster auf, ohne dass ein Spieler besser würde. Was
 * die Ausrichtung ausmacht, steht im Taktikreiter, und zwar aufgeschlüsselt.
 * @param {Staerken} s
 */
export function angriffStaerke(s) {
  return (s.passAngriff + s.laufAngriff) / 2;
}

/** Dasselbe für die Defense. @param {Staerken} s */
export function verteidigungStaerke(s) {
  return (s.passVerteidigung + s.laufVerteidigung) / 2;
}

/**
 * Eine Zahl für die Tabelle und die Scoutingansicht. Lauf und Pass zählen
 * dafür gleich viel — sie steht für keine Partie, sondern für die Mannschaft.
 * @param {Staerken} s
 */
export function gesamtStaerke(s) {
  return Math.round(
    angriffStaerke(s) * 0.46 + verteidigungStaerke(s) * 0.46 + s.special * 0.08);
}

/**
 * Wie viele Spieler gerade nicht zur Verfügung stehen.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 */
export function verletzte(kader, spieltag) {
  return kader.filter((s) => s.verletztBis > spieltag);
}
