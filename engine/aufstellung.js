// @ts-check
/**
 * Die Aufstellung: aus einem Kader werden zweiundzwanzig besetzte Plätze.
 *
 * Das ist die Kernfunktion des Umbaus. Sie füllt beide Einheiten in einem
 * Durchgang und führt dabei ein `benutzt`-Set, damit ein Doppeleinsatz eine
 * bewusste Ausnahme bleibt und nicht nebenbei passiert.
 *
 * Kein Platz bleibt je leer. Wo niemand mit der richtigen Ausbildung steht,
 * rückt der mit der besten berechneten Eignung nach — quer durch den Kader,
 * und die fehlende Technik ist der Abschlag. Eine zweite Regel dafür braucht
 * es nicht.
 *
 * Docs: docs/umbau-positionsmodell.md, Abschnitte 5, 6 und 7
 */

import { ERSATZ_STAERKE, clamp } from './constants.js';
import { istFit } from './spieler.js';
import { eignung, eignungGemischt, PLAETZE } from './positionen.js';

// --- Formationen -----------------------------------------------------------

/** Die feste Linie und der Mann dahinter. */
export const OL_PLAETZE = /** @type {const} */ (['LT', 'LG', 'C', 'RG', 'RT']);
export const QB_PLATZ = 'QB';

/**
 * Die acht Personnel-Gruppierungen. Jede listet ihre fünf Skill-Plätze
 * ausdrücklich, damit sich eine Formation einzeln nachjustieren lässt, statt
 * aus den beiden Ziffern gerechnet zu werden.
 *
 * Der Passanteil ist der Vorschlag der Gruppierung; der Manager verschiebt ihn
 * um bis zu PASSANTEIL_SPIELRAUM.
 * @type {Record<string, { name: string, skill: string[], passAnteil: number }>}
 */
export const PERSONNEL = {
  '00': { name: 'Empty', skill: ['SL', 'SL', 'SL', 'WR', 'WR'], passAnteil: 0.85 },
  '01': { name: 'Empty mit TE', skill: ['TE', 'SL', 'SL', 'WR', 'WR'], passAnteil: 0.80 },
  '10': { name: 'Spread', skill: ['RB', 'SL', 'WR', 'WR', 'SL'], passAnteil: 0.70 },
  '11': { name: 'Standard', skill: ['RB', 'TE', 'WR', 'WR', 'SL'], passAnteil: 0.60 },
  '12': { name: '', skill: ['RB', 'TE', 'TE', 'WR', 'WR'], passAnteil: 0.45 },
  '20': { name: '', skill: ['RB', 'FB', 'WR', 'WR', 'SL'], passAnteil: 0.50 },
  '21': { name: '', skill: ['RB', 'FB', 'TE', 'WR', 'WR'], passAnteil: 0.40 },
  '32': { name: 'Double Wing', skill: ['RB', 'FB', 'FB', 'TE', 'TE'], passAnteil: 0.20 },
};

/**
 * Die Gruppierungen in der Reihenfolge, in der sie gelesen werden wollen: von
 * der luftigsten zur schwersten. `Object.keys(PERSONNEL)` gibt sie nicht so
 * heraus — `'10'` ist für JavaScript ein Zahlenschlüssel und `'00'` nicht,
 * also stünde Empty am Ende statt am Anfang.
 */
export const PERSONNEL_REIHE = /** @type {const} */ ([
  '00', '01', '10', '11', '12', '20', '21', '32',
]);

/** Was ein Verein spielt, wenn nichts anderes gesagt ist. */
export const STANDARD_PERSONNEL = '11';

/** Wie weit der Manager den Passanteil seiner Gruppierung verschieben darf. */
export const PASSANTEIL_SPIELRAUM = 0.20;

/**
 * Die Verteidigung steht als 4-3. Weitere Formationen kommen später und
 * benutzen denselben Platz-Apparat.
 */
export const DEFENSE_PLAETZE = /** @type {const} */ ([
  'LDE', 'DT', 'NT', 'RDE',
  'MLB', 'SAM', 'WILL',
  'LCB', 'RCB', 'FS', 'SS',
]);

// --- Gewichte --------------------------------------------------------------
// Docs: docs/umbau-positionsmodell.md, Abschnitt 6

/** Was ein Block am Ergebnis seiner Einheit trägt. */
export const BLOCK_GEWICHT = {
  angriff: {
    pass: { qb: 0.40, ol: 0.25, skill: 0.35 },
    lauf: { qb: 0.20, ol: 0.40, skill: 0.40 },
  },
  verteidigung: {
    pass: { dl: 0.35, lb: 0.25, db: 0.40 },
    lauf: { dl: 0.40, lb: 0.40, db: 0.20 },
  },
};

/** Anteile innerhalb der Blöcke. Jede Zeile summiert auf 1. */
export const PLATZ_ANTEIL = {
  ol: {
    pass: { LT: 0.25, RT: 0.25, LG: 0.18, RG: 0.18, C: 0.14 },
    lauf: { LT: 0.19, RT: 0.19, LG: 0.24, RG: 0.24, C: 0.14 },
  },
  dl: {
    pass: { LDE: 0.32, RDE: 0.32, DT: 0.20, NT: 0.16 },
    lauf: { LDE: 0.23, RDE: 0.23, DT: 0.26, NT: 0.28 },
  },
  lb: {
    pass: { MLB: 0.32, SAM: 0.23, WILL: 0.45 },
    lauf: { MLB: 0.40, SAM: 0.35, WILL: 0.25 },
  },
  db: {
    pass: { LCB: 0.30, RCB: 0.30, FS: 0.25, SS: 0.15 },
    lauf: { LCB: 0.17, RCB: 0.17, FS: 0.26, SS: 0.40 },
  },
};

/**
 * Die Skill-Leiter: Anteile am Skill-Block, nach dem Rang des Platzes. Wer der
 * erste ist, hängt an der Spielart — im Passspiel steht der Receiver vorn, im
 * Laufspiel der Runningback.
 */
export const SKILL_LEITER = [0.30, 0.25, 0.20, 0.15, 0.10];
export const SKILL_REIHE = {
  pass: ['WR', 'SL', 'TE', 'RB', 'FB'],
  lauf: ['RB', 'FB', 'TE', 'SL', 'WR'],
};

// --- Der Preis des Doppeleinsatzes -----------------------------------------
// Docs: docs/umbau-positionsmodell.md, Abschnitt 7

/** Stützstellen: [Wert, Ergebnis], aufsteigend. */
const DOPPEL_ABZUG = [[20, 0.40], [50, 0.28], [80, 0.15]];
const DOPPEL_RISIKO = [[20, 4.0], [50, 3.0], [80, 2.0]];

/**
 * Linear zwischen den Stützstellen, außerhalb flach.
 * @param {[number, number][]} kurve
 * @param {number} wert
 */
function interpoliere(kurve, wert) {
  if (wert <= kurve[0][0]) return kurve[0][1];
  const letzte = kurve[kurve.length - 1];
  if (wert >= letzte[0]) return letzte[1];
  for (let i = 1; i < kurve.length; i++) {
    const [x0, y0] = kurve[i - 1];
    const [x1, y1] = kurve[i];
    if (wert <= x1) return y0 + ((wert - x0) / (x1 - x0)) * (y1 - y0);
  }
  return letzte[1];
}

/**
 * Was der zweite Einsatz an Leistung kostet. Ausdauer trägt ihn: ein Mann mit
 * 80 verliert 15 %, einer mit 20 verliert 40 %.
 * @param {number} ausdauer
 */
export function doppelAbzug(ausdauer) {
  return interpoliere(DOPPEL_ABZUG, ausdauer);
}

/**
 * Um wie viel wahrscheinlicher sich ein Doppeleinsatz verletzt. Robustheit
 * trägt das: zwischen doppelt und vierfach.
 * @param {number} robustheit
 */
export function doppelRisiko(robustheit) {
  return interpoliere(DOPPEL_RISIKO, robustheit);
}

// --- Aufstellen ------------------------------------------------------------

/**
 * @typedef {object} Platz
 * @property {string} platz        Schlüssel aus PLAETZE
 * @property {string} position     Die Position, die dort eigentlich steht
 * @property {import('./spieler.js').Spieler | null} spieler
 * @property {boolean} umgestellt  Er ist woanders ausgebildet
 * @property {boolean} doppel      Er steht schon in der anderen Einheit
 */

/**
 * @typedef {object} Aufstellung
 * @property {Platz[]} offense
 * @property {Platz[]} defense
 * @property {import('./spieler.js').Spieler | null} k
 * @property {import('./spieler.js').Spieler | null} p
 */

/**
 * Wie schwer ein Platz wiegt. Nur die Reihenfolge des Nachrückens hängt daran:
 * ist ein Spieler knapp, soll er auf dem teuersten freien Platz landen.
 *
 * Der Angriff wird nach dem eigenen Passanteil gemischt, die Verteidigung
 * hälftig — sie steht nicht gegen sich selbst, sondern gegen die Liga.
 * @param {string} platz
 * @param {string[]} skillPlaetze Die fünf der Gruppierung, in ihrer Reihenfolge
 * @param {number} passAnteil
 */
export function platzGewicht(platz, skillPlaetze, passAnteil) {
  const mische = (pass, lauf, anteil) => pass * anteil + lauf * (1 - anteil);

  if (platz === QB_PLATZ) {
    return mische(BLOCK_GEWICHT.angriff.pass.qb, BLOCK_GEWICHT.angriff.lauf.qb, passAnteil);
  }
  if (PLATZ_ANTEIL.ol.pass[platz] != null && OL_PLAETZE.includes(/** @type {any} */ (platz))) {
    return mische(
      BLOCK_GEWICHT.angriff.pass.ol * PLATZ_ANTEIL.ol.pass[platz],
      BLOCK_GEWICHT.angriff.lauf.ol * PLATZ_ANTEIL.ol.lauf[platz],
      passAnteil,
    );
  }
  for (const block of /** @type {const} */ (['dl', 'lb', 'db'])) {
    if (PLATZ_ANTEIL[block].pass[platz] != null) {
      return mische(
        BLOCK_GEWICHT.verteidigung.pass[block] * PLATZ_ANTEIL[block].pass[platz],
        BLOCK_GEWICHT.verteidigung.lauf[block] * PLATZ_ANTEIL[block].lauf[platz],
        0.5,
      );
    }
  }
  // Ein Skill-Platz: sein Anteil hängt am Rang, den er in der Leiter hat.
  const anteile = skillAnteile(skillPlaetze);
  const index = skillPlaetze.indexOf(platz);
  return mische(
    BLOCK_GEWICHT.angriff.pass.skill * anteile.pass[index],
    BLOCK_GEWICHT.angriff.lauf.skill * anteile.lauf[index],
    passAnteil,
  );
}

/**
 * Die Leiter auf die fünf Skill-Plätze einer Gruppierung verteilt, einmal für
 * jede Spielart. Sortiert wird nach der Reihe der Spielart; bei gleicher
 * Position entscheidet die Reihenfolge in der Gruppierung.
 * @param {string[]} skillPlaetze
 * @returns {{ pass: number[], lauf: number[] }}
 */
export function skillAnteile(skillPlaetze) {
  /** @param {'pass'|'lauf'} art */
  const fuer = (art) => {
    const reihe = SKILL_REIHE[art];
    const rang = skillPlaetze
      .map((platz, index) => ({ platz, index }))
      .sort((a, b) => reihe.indexOf(a.platz) - reihe.indexOf(b.platz) || a.index - b.index);
    const anteile = new Array(skillPlaetze.length).fill(0);
    rang.forEach((eintrag, i) => { anteile[eintrag.index] = SKILL_LEITER[i]; });
    return anteile;
  };
  return { pass: fuer('pass'), lauf: fuer('lauf') };
}

/** @param {string} platz */
function leererPlatz(platz) {
  return /** @type {Platz} */ ({
    platz, position: PLAETZE[platz].position, spieler: null, umgestellt: false, doppel: false,
  });
}

/**
 * Beide Einheiten in einem Durchgang besetzen.
 *
 * Drei Runden. Erst bekommt jeder Platz den stärksten fitten Spieler seiner
 * eigenen Position — innerhalb einer Position entscheidet `staerke`, wie
 * bisher. Dann rücken auf die noch leeren Plätze die besten Umsteller nach,
 * angefangen beim teuersten Platz. Bleibt danach noch etwas leer, greift der
 * Doppeleinsatz — teuer, und deshalb zuletzt.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @param {string} [personnel]
 * @param {number} [passAnteil]
 * @returns {Aufstellung}
 */
export function stelleAuf(kader, spieltag, personnel = STANDARD_PERSONNEL, passAnteil) {
  const gruppierung = PERSONNEL[personnel] || PERSONNEL[STANDARD_PERSONNEL];
  const anteil = passAnteil == null ? gruppierung.passAnteil : clamp(passAnteil, 0, 1);

  const offense = [QB_PLATZ, ...OL_PLAETZE, ...gruppierung.skill].map(leererPlatz);
  const defense = DEFENSE_PLAETZE.map(leererPlatz);
  const alle = [...offense, ...defense];

  const fit = kader.filter((s) => istFit(s, spieltag));
  /** @type {Set<string>} */
  const benutzt = new Set();

  // Runde eins: der stärkste fitte Mann seiner Position.
  for (const platz of alle) {
    const eigene = fit
      .filter((s) => s.position === platz.position && !benutzt.has(s.id))
      .sort((a, b) => b.staerke - a.staerke);
    if (eigene.length === 0) continue;
    platz.spieler = eigene[0];
    benutzt.add(eigene[0].id);
  }

  // Runde zwei: umstellen, teuerste Plätze zuerst.
  const offen = alle
    .filter((p) => !p.spieler)
    .sort((a, b) =>
      platzGewicht(b.platz, gruppierung.skill, anteil)
      - platzGewicht(a.platz, gruppierung.skill, anteil));

  for (const platz of offen) {
    let bester = null;
    let bestwert = -Infinity;
    for (const s of fit) {
      if (benutzt.has(s.id)) continue;
      const wert = eignungGemischt(s, platz.platz, anteil);
      if (wert > bestwert) { bestwert = wert; bester = s; }
    }
    if (!bester) continue;
    platz.spieler = bester;
    platz.umgestellt = true;
    benutzt.add(bester.id);
  }

  // Runde drei: der Doppeleinsatz. Ein Notnagel, kein Werkzeug.
  for (const platz of alle) {
    if (platz.spieler) continue;
    let bester = null;
    let bestwert = -Infinity;
    for (const s of fit) {
      const wert = eignungGemischt(s, platz.platz, anteil)
        * (1 - doppelAbzug(s.attribute.ausdauer));
      if (wert > bestwert) { bestwert = wert; bester = s; }
    }
    if (!bester) continue;
    platz.spieler = bester;
    platz.doppel = true;
    platz.umgestellt = bester.position !== platz.position;
  }

  return { offense, defense, ...besteFuesse(fit) };
}

/**
 * Was ein Mann auf dem Tee wert ist: Weite und Zielwasser zu gleichen Teilen,
 * weil ein Field Goal beides braucht.
 * @param {import('./spieler.js').Spieler} s
 */
export function kickerWert(s) {
  return s.kickStaerke * 0.5 + s.kickGenauigkeit * 0.5;
}

/**
 * Was er beim Punt wert ist: überwiegend Bein. Ein Punt, der fünf Yards neben
 * der Seitenlinie landet, hat seine Arbeit getan, ein kurzer nie.
 * @param {import('./spieler.js').Spieler} s
 */
export function punterWert(s) {
  return s.kickStaerke * 0.7 + s.kickGenauigkeit * 0.3;
}

/**
 * Die beiden besten Füße im Kader. Sie laufen außerhalb der Aufstellung: kein
 * Bayernligaverein hält Spezialisten, also kickt, wer den Fuß dafür hat, und
 * derselbe Mann darf beide Aufgaben haben.
 * @param {import('./spieler.js').Spieler[]} fit
 */
function besteFuesse(fit) {
  /** @param {(s: import('./spieler.js').Spieler) => number} wert */
  const bester = (wert) => fit.reduce(
    (a, b) => (a === null || wert(b) > wert(a) ? b : a),
    /** @type {import('./spieler.js').Spieler | null} */ (null),
  );
  return { k: bester(kickerWert), p: bester(punterWert) };
}

/**
 * Was ein besetzter Platz in einer Spielart wert ist. Ein Platz ohne Spieler
 * zählt ERSATZ_STAERKE — den gibt es nur noch für den buchstäblich leeren
 * Kader, damit `teamStaerken([])` eine Zahl bleibt.
 * @param {Platz} platz
 * @param {'pass'|'lauf'} art
 */
export function platzWert(platz, art) {
  if (!platz.spieler) return ERSATZ_STAERKE;
  const roh = eignung(platz.spieler, platz.platz, art);
  return platz.doppel ? roh * (1 - doppelAbzug(platz.spieler.attribute.ausdauer)) : roh;
}

/**
 * Ein Block als eine Zahl: die Plätze nach ihren Anteilen gemittelt.
 * @param {Platz[]} plaetze
 * @param {number[]} anteile gleich lang wie plaetze
 * @param {'pass'|'lauf'} art
 */
export function blockWert(plaetze, anteile, art) {
  let summe = 0;
  for (let i = 0; i < plaetze.length; i++) summe += platzWert(plaetze[i], art) * anteile[i];
  return summe;
}

/** Die Ids der Spieler, die in beiden Einheiten stehen. @param {Aufstellung} a */
export function doppelEinsaetze(a) {
  return [...a.offense, ...a.defense]
    .filter((p) => p.doppel && p.spieler)
    .map((p) => /** @type {import('./spieler.js').Spieler} */ (p.spieler).id);
}

/** Wie viele Plätze mit einem Umsteller besetzt sind. @param {Aufstellung} a */
export function umstellungen(a) {
  return [...a.offense, ...a.defense].filter((p) => p.umgestellt).length;
}
