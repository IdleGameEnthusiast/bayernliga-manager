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

import { ERSATZ_STAERKE, clamp, interpoliere } from './constants.js';
import { istFit } from './spieler.js';
import { eignung, eignungGemischt, PLAETZE, hauptPosition } from './positionen.js';

// --- Formationen -----------------------------------------------------------

/** Die feste Linie und der Mann dahinter. */
export const OL_PLAETZE = /** @type {const} */ (['LT', 'LG', 'C', 'RG', 'RT']);
export const QB_PLATZ = 'QB';

/**
 * Die acht Personnel-Gruppierungen. Jede listet ihre fünf Skill-Plätze
 * ausdrücklich, damit sich eine Formation einzeln nachjustieren lässt, statt
 * aus den beiden Ziffern gerechnet zu werden.
 *
 * Der Passanteil ist der Vorschlag der Gruppierung, keine Schranke: der
 * Manager darf frei zwischen 0 und 1 stellen. Was eine Gruppierung nicht kann,
 * sagt ihr Rollenwert, nicht ein verbotener Reglerbereich.
 *
 * Seit der Ausrichtung ist der Passanteil zugleich das **rechnerische Optimum**:
 * `neigung` ist genau so kalibriert, dass `vorteil()` beim Durchschnittskader
 * gegen die Durchschnittsverteidigung dort sein Maximum hat. Der Vorschlag ist
 * damit keine Meinung mehr, sondern eine nachprüfbare Vorhersage — die Zahlen
 * stehen in `tests/spiel.test.js` unter derselben Überschrift.
 *
 * `neigung` ist ein Kipp in Stärkepunkten, den `spreize()` auf Pass- und
 * Laufangriff verteilt. Dass fast alle Werte negativ sind, ist kein Fehler: das
 * Stärkemodell ist insgesamt passlastig, jedes System außer Double Wing steht
 * roh über null. Nur die Abstände zwischen den Zahlen tragen die Identität.
 *
 * Die Werte hängen an den gemessenen Rohneigungen und driften, sobald sich
 * Skill-Listen, Rollenwerte oder die Kadererzeugung ändern. Der Test rechnet
 * sie nach und schlägt an, statt sie still veralten zu lassen.
 * @type {Record<string, { name: string, skill: string[], passAnteil: number, neigung: number }>}
 */
export const PERSONNEL = {
  '00': { name: 'Empty', skill: ['SL', 'SL', 'SL', 'WR', 'WR'], passAnteil: 0.90, neigung: 16.4 },
  '01': { name: 'Empty mit TE', skill: ['TE', 'SL', 'SL', 'WR', 'WR'], passAnteil: 0.85, neigung: 12.8 },
  '10': { name: 'Spread', skill: ['RB', 'SL', 'WR', 'WR', 'SL'], passAnteil: 0.60, neigung: 0.5 },
  '11': { name: 'Standard', skill: ['RB', 'TE', 'WR', 'WR', 'SL'], passAnteil: 0.50, neigung: -2.3 },
  '12': { name: 'Double Tight', skill: ['RB', 'TE', 'TE', 'WR', 'WR'], passAnteil: 0.45, neigung: -3.1 },
  '20': { name: 'Two Back', skill: ['RB', 'FB', 'WR', 'WR', 'SL'], passAnteil: 0.45, neigung: -3.1 },
  '21': { name: 'Pro', skill: ['RB', 'FB', 'TE', 'WR', 'WR'], passAnteil: 0.40, neigung: -4.0 },
  '32': { name: 'Double Wing', skill: ['RB', 'FB', 'FB', 'TE', 'TE'], passAnteil: 0.20, neigung: -7.6 },
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


/**
 * Die Verteidigung steht als 4-3. Weitere Formationen kommen später und
 * benutzen denselben Platz-Apparat.
 */
export const DEFENSE_PLAETZE = /** @type {const} */ ([
  'LE', 'DT', 'NT', 'RE',
  'MIKE', 'SAM', 'WILL',
  'CB1', 'CB2', 'FS', 'SS',
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
    pass: { LE: 0.32, RE: 0.32, DT: 0.20, NT: 0.16 },
    lauf: { LE: 0.23, RE: 0.23, DT: 0.26, NT: 0.28 },
  },
  lb: {
    pass: { MIKE: 0.32, SAM: 0.23, WILL: 0.45 },
    lauf: { MIKE: 0.40, SAM: 0.35, WILL: 0.25 },
  },
  db: {
    pass: { CB1: 0.30, CB2: 0.30, FS: 0.25, SS: 0.15 },
    lauf: { CB1: 0.17, CB2: 0.17, FS: 0.26, SS: 0.40 },
  },
};

/**
 * Die Skill-Leiter: was ein Rang im Skill-Block trägt. Zwei Leitern, weil die
 * beiden Spielarten verschieden verteilen — im Passspiel trägt der erste
 * Empfänger den Spielzug, im Laufspiel blocken alle mit.
 *
 * Beide summieren auf 1.
 */
export const SKILL_LEITER = {
  pass: [0.38, 0.27, 0.18, 0.11, 0.06],   // steil
  lauf: [0.26, 0.23, 0.20, 0.17, 0.14],   // flach
};

/**
 * Der Rollenwert: was eine Position auf ihrem Rang überhaupt darstellen kann.
 *
 * Das ist der Grund, warum die Wahl der Gruppierung etwas kostet. Ohne ihn
 * füllen fünf beliebige Männer die Leiter immer voll auf 1 auf, und dann ist
 * es einerlei, ob als dritter Empfänger ein Slotreceiver oder ein zweiter
 * Fullback draußen steht. Der Fullback wird nach seiner eigenen Passformel
 * bewertet, und die belohnt Blocken — er stünde also gut da.
 *
 * Absteigend sortiert ergeben die Zahlen genau die Reihenfolge, nach der der
 * Block früher verteilt wurde: WR · SL · TE · RB · FB im Passspiel,
 * RB · FB · TE · SL · WR im Laufspiel. Neu ist nur, dass der Abstand eine
 * Größe hat.
 * @type {Record<'pass'|'lauf', Record<string, number>>}
 */
export const SKILL_ROLLE = {
  pass: { WR: 1.00, SL: 1.00, TE: 0.82, RB: 0.62, FB: 0.45 },
  lauf: { RB: 1.00, FB: 1.00, TE: 0.92, SL: 0.72, WR: 0.62 },
};

// --- Der Preis des Doppeleinsatzes -----------------------------------------
// Docs: docs/umbau-positionsmodell.md, Abschnitt 7

/** Stützstellen: [Wert, Ergebnis], aufsteigend. */
const DOPPEL_ABZUG = [[20, 0.40], [50, 0.28], [80, 0.15]];
const DOPPEL_RISIKO = [[20, 4.0], [50, 3.0], [80, 2.0]];

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
 * @property {string} schluessel   Eindeutig in dieser Aufstellung, siehe `plaetzeMit()`
 * @property {string} position     Die Position, die dort eigentlich steht
 * @property {import('./spieler.js').Spieler | null} spieler
 * @property {boolean} umgestellt  Er ist woanders ausgebildet
 * @property {boolean} doppel      Er steht schon in der anderen Einheit
 * @property {boolean} frei        Der Manager lässt ihn ausdrücklich unbesetzt
 * @property {number} staerke      Was er auf **diesem** Platz wert ist
 */

/**
 * @typedef {object} Aufstellung
 * @property {Platz[]} offense
 * @property {Platz[]} defense
 * @property {import('./spieler.js').Spieler | null} k
 * @property {import('./spieler.js').Spieler | null} p
 */

/**
 * Was der Manager vorgegeben hat: Platz-Schlüssel auf Spieler-Id.
 *
 * Absichtlich eine dünne Karte und keine zweite Aufstellung. Sie hält nur die
 * Entscheidung fest — wer wo steht —, und alles andere daran (Umsteller,
 * Doppeleinsatz, Stärke auf dem Platz) rechnet `stelleAuf()` daraus neu. So
 * kann eine Vorgabe nicht veralten: sie kennt keinen Wert, der veralten könnte.
 *
 * Sie darf lückenhaft und sie darf zu weit sein. Ein Platz ohne Eintrag wird
 * von den Runden darunter gefüllt, ein Eintrag auf einen Platz, den die
 * Gruppierung gerade nicht hat, wird stumm überlesen — und steht wieder da,
 * sobald der Manager das System zurückstellt.
 *
 * Ein Eintrag mit dem Wert `null` ist etwas anderes als kein Eintrag: er heißt
 * „hier soll **niemand** stehen". Nur so lässt sich eine Aufstellung von Grund
 * auf bauen — ohne ihn füllte die Automatik jeden Platz sofort wieder, den der
 * Manager gerade geräumt hat.
 * @typedef {Record<string, string | null>} Vorgabe
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
 * Die rohen Anteile einer Gruppierung in einer Spielart: jeder Platz bekommt
 * die Sprosse seines Rangs, mal dem Rollenwert seiner Position. Sortiert wird
 * nach dem Rollenwert; bei gleichem entscheidet die Reihenfolge in der
 * Gruppierung.
 * @param {string[]} skillPlaetze
 * @param {'pass'|'lauf'} art
 * @returns {number[]}
 */
function rohAnteile(skillPlaetze, art) {
  const rolle = SKILL_ROLLE[art];
  const rang = skillPlaetze
    .map((platz, index) => ({ index, wert: rolle[PLAETZE[platz].position] || 0 }))
    .sort((a, b) => b.wert - a.wert || a.index - b.index);
  const anteile = new Array(skillPlaetze.length).fill(0);
  rang.forEach((eintrag, i) => {
    anteile[eintrag.index] = eintrag.wert * (SKILL_LEITER[art][i] || 0);
  });
  return anteile;
}

/** @param {number[]} zahlen */
const summe = (zahlen) => zahlen.reduce((a, b) => a + b, 0);

/**
 * Die Normale: was das Standard-Personnel roh zusammenbringt.
 *
 * Ohne sie zöge der Rollenwert die ganze Liga nach unten, denn keine
 * Gruppierung erreicht in beiden Spielarten die volle Leiter. Geteilt durch
 * die Normale steht 11 personnel bei genau 1 und alles andere daneben — nach
 * oben in seiner Spielart, nach unten in der anderen.
 */
export const SKILL_NORM = {
  pass: summe(rohAnteile(PERSONNEL[STANDARD_PERSONNEL].skill, 'pass')),
  lauf: summe(rohAnteile(PERSONNEL[STANDARD_PERSONNEL].skill, 'lauf')),
};

/**
 * Die Anteile der fünf Skill-Plätze, einmal für jede Spielart.
 *
 * Sie summieren bewusst **nicht** auf 1: ihre Summe ist der Blockfaktor der
 * Gruppierung. 32 personnel bringt im Passspiel 0,77 zusammen und im
 * Laufspiel 1,21 — daher kommt der Preis dafür, aus schwerem Personal zu
 * werfen, und er braucht keine eigene Regel.
 * @param {string[]} skillPlaetze
 * @returns {{ pass: number[], lauf: number[] }}
 */
export function skillAnteile(skillPlaetze) {
  /** @param {'pass'|'lauf'} art */
  const fuer = (art) => rohAnteile(skillPlaetze, art).map((a) => a / SKILL_NORM[art]);
  return { pass: fuer('pass'), lauf: fuer('lauf') };
}

/**
 * Die Plätze nach ihrer Position gruppiert, in der Reihenfolge ihres ersten
 * Auftretens.
 *
 * Zwei Plätze derselben Position werden zusammen besetzt. Einzeln gefüllt
 * greift der vordere zuerst zu, und weil `LG` in der Liste vor `RG` steht,
 * bekäme links immer den stärkeren Guard — gleichgültig, auf welcher Seite er
 * ausgebildet ist.
 * @param {Platz[]} alle
 * @returns {Map<string, Platz[]>}
 */
function nachPosition(alle) {
  /** @type {Map<string, Platz[]>} */
  const gruppen = new Map();
  for (const platz of alle) {
    const liste = gruppen.get(platz.position);
    if (liste) liste.push(platz);
    else gruppen.set(platz.position, [platz]);
  }
  return gruppen;
}

/**
 * Wer von den Ausgewählten welchen Platz nimmt.
 *
 * Nur nach Eignung Platz für Platz zu füllen reicht dafür nicht: ein starker
 * rechter Guard schlägt einen schwachen linken auch nach dem Seitenabzug noch
 * und nähme ihm den linken Platz weg — dann stünden beide falsch statt einer.
 * Entschieden wird deshalb über das Paar: die beste noch offene Verbindung
 * zuerst, bis nichts mehr frei ist.
 *
 * Das gilt auch, wo keine Seite im Spiel ist. Zwei Receiverplätze wiegen
 * verschieden schwer — der vordere trägt die höhere Sprosse der Skill-Leiter —,
 * also gehört der mit der besseren Eignung dorthin.
 * @param {import('./spieler.js').Spieler[]} kandidaten
 * @param {Platz[]} plaetze
 * @param {number} passAnteil
 * @returns {[Platz, import('./spieler.js').Spieler][]}
 */
function verteile(kandidaten, plaetze, passAnteil) {
  /** @type {{ platz: Platz, spieler: import('./spieler.js').Spieler, wert: number }[]} */
  const paare = [];
  for (const platz of plaetze) {
    for (const spieler of kandidaten) {
      paare.push({
        platz,
        spieler,
        wert: eignungGemischt(spieler, platz.platz, bewertungsAnteil(platz.platz, passAnteil)),
      });
    }
  }
  paare.sort((a, b) => b.wert - a.wert);

  /** @type {Set<Platz>} */
  const belegt = new Set();
  /** @type {Set<string>} */
  const vergeben = new Set();
  /** @type {[Platz, import('./spieler.js').Spieler][]} */
  const ergebnis = [];
  for (const paar of paare) {
    if (belegt.has(paar.platz) || vergeben.has(paar.spieler.id)) continue;
    belegt.add(paar.platz);
    vergeben.add(paar.spieler.id);
    ergebnis.push([paar.platz, paar.spieler]);
  }
  return ergebnis;
}

/** @param {string} platz @param {string} schluessel */
function leererPlatz(platz, schluessel) {
  return /** @type {Platz} */ ({
    platz, schluessel, position: PLAETZE[platz].position, spieler: null,
    umgestellt: false, doppel: false, frei: false, staerke: ERSATZ_STAERKE,
  });
}

/**
 * Plätze aus ihren Namen, jeder mit einem eindeutigen Schlüssel.
 *
 * Der Name allein reicht dafür nicht: 12 personnel stellt **zwei** Tight Ends
 * auf und 00 personnel drei Slotreceiver. Eine Vorgabe muss sagen können,
 * welchen von beiden sie meint, also bekommt der zweite `TE#2`, der dritte
 * `TE#3`. Der erste behält den nackten Namen — damit heißt in 11 personnel
 * jeder Platz genau so, wie er auf dem Feld heißt, und eine Vorgabe überlebt
 * den Wechsel zwischen den Gruppierungen, statt sich zu verschieben.
 * @param {readonly string[]} namen
 * @param {Map<string, number>} zaehler über beide Einheiten hinweg geführt
 */
function plaetzeMit(namen, zaehler) {
  return namen.map((platz) => {
    const n = (zaehler.get(platz) || 0) + 1;
    zaehler.set(platz, n);
    return leererPlatz(platz, n === 1 ? platz : `${platz}#${n}`);
  });
}

/**
 * Beide Einheiten in einem Durchgang besetzen.
 *
 * Vier Runden. Zuerst steht, was der Manager vorgegeben hat — Runde null, und
 * sie fragt nichts nach: wer dort steht, steht dort. Dann bekommt jeder noch
 * freie Platz den stärksten fitten Spieler seiner eigenen Position: die Stärke
 * sagt, **wer** von ihnen spielt, die Eignung danach nur noch, **wo** — sonst
 * stünde die Seite nach der Reihenfolge der Liste statt nach der Ausbildung.
 * Dann rücken auf die noch leeren Plätze die besten Umsteller nach, angefangen
 * beim teuersten Platz. Bleibt danach noch etwas leer, greift der
 * Doppeleinsatz — teuer, und deshalb zuletzt.
 *
 * Ohne Vorgabe ist Runde null leer und es bleibt bei den drei alten Runden.
 * Mit Vorgabe sind sie der **Reparaturweg**: sie füllen die Verletzten, die
 * Zurückgetretenen und die Plätze, die es nach einem Systemwechsel vorher
 * nicht gab. Es braucht dafür keine zweite Regel — es ist dieselbe.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @param {string} [personnel]
 * @param {number} [passAnteil]
 * @param {Vorgabe | null} [vorgabe]
 * @returns {Aufstellung}
 */
export function stelleAuf(kader, spieltag, personnel = STANDARD_PERSONNEL, passAnteil, vorgabe) {
  const gruppierung = PERSONNEL[personnel] || PERSONNEL[STANDARD_PERSONNEL];
  const anteil = passAnteil == null ? gruppierung.passAnteil : clamp(passAnteil, 0, 1);

  // Der Quarterback zuerst, dann die Skill-Plätze der Gruppierung, die Linie
  // zuletzt: der Bogen liest sich von dem, der den Ball hat, nach außen.
  // Die Anzeige hängt daran, die Rechnung nicht — `teamStaerken()` sucht seine
  // Blöcke über die Platzschlüssel.
  /** @type {Map<string, number>} */
  const zaehler = new Map();
  const offense = plaetzeMit([QB_PLATZ, ...gruppierung.skill, ...OL_PLAETZE], zaehler);
  const defense = plaetzeMit(DEFENSE_PLAETZE, zaehler);
  const alle = [...offense, ...defense];

  const fit = kader.filter((s) => istFit(s, spieltag));
  /** @type {Set<string>} */
  const benutzt = new Set();

  // Runde null: die Vorgabe des Managers. Wer verletzt, verkauft oder
  // zurückgetreten ist, steht nicht mehr im fitten Kader und wird überlesen —
  // sein Platz fällt damit an die Runden darunter und ist danach wieder seiner,
  // sobald er zurück ist. Die Vorgabe wird dafür nicht angefasst.
  if (vorgabe) {
    const jeId = new Map(fit.map((s) => [s.id, s]));
    for (const platz of alle) {
      if (!Object.prototype.hasOwnProperty.call(vorgabe, platz.schluessel)) continue;
      const gewuenscht = vorgabe[platz.schluessel];

      // Ausdrücklich niemand. Der Platz ist damit vergeben — an keinen —, und
      // die Reparaturrunden gehen an ihm vorbei.
      if (gewuenscht === null) { platz.frei = true; continue; }

      const spieler = jeId.get(gewuenscht);
      if (!spieler) continue;
      platz.spieler = spieler;
      platz.umgestellt = hauptPosition(spieler) !== platz.position;
      platz.doppel = benutzt.has(spieler.id);
      benutzt.add(spieler.id);
    }
  }

  // Runde eins: der stärkste fitte Mann seiner Position — und wo eine Position
  // mehrere Plätze hat, entscheidet danach die Eignung, wer davon welchen nimmt.
  // „Seine Position" ist sein Hauptplatz, nicht seine Ausbildung: wer drei
  // Saisons als MIKE gespielt hat, ist einer und kein Umsteller mehr.
  for (const [position, plaetze] of nachPosition(alle)) {
    const freie = plaetze.filter((p) => !p.spieler && !p.frei);
    if (freie.length === 0) continue;
    const eigene = fit
      .filter((s) => !benutzt.has(s.id) && hauptPosition(s) === position)
      .sort((a, b) => b.staerke - a.staerke)
      .slice(0, freie.length);
    for (const [platz, spieler] of verteile(eigene, freie, anteil)) {
      platz.spieler = spieler;
      benutzt.add(spieler.id);
    }
  }

  // Runde zwei: umstellen, teuerste Plätze zuerst.
  const offen = alle
    .filter((p) => !p.spieler && !p.frei)
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
    if (platz.spieler || platz.frei) continue;
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
    platz.umgestellt = hauptPosition(bester) !== platz.position;
  }

  for (const platz of alle) platz.staerke = platzStaerke(platz, anteil);

  return { offense, defense, ...besteFuesse(fit) };
}

/**
 * Nach welchem Passanteil ein Platz bewertet wird: der Angriff nach dem
 * eigenen, die Verteidigung hälftig. Dieselbe Unterscheidung wie in
 * `platzGewicht()` — die Verteidigung steht nicht gegen sich selbst.
 * @param {string} platz
 * @param {number} passAnteil
 */
function bewertungsAnteil(platz, passAnteil) {
  return DEFENSE_PLAETZE.includes(/** @type {any} */ (platz)) ? 0.5 : passAnteil;
}

/**
 * Was ein Spieler auf dem Platz wert ist, auf dem er wirklich steht — beide
 * Spielarten nach dem Passanteil gemischt, der Doppeleinsatz abgezogen.
 *
 * Das ist die Zahl, die die Aufstellung anzeigt. Sie ist nicht `spieler.staerke`:
 * die ist gezogen und positionsfrei, diese hier sagt, was aus ihm **hier**
 * herauskommt, und fällt bei einem Umsteller entsprechend ab.
 * @param {Platz} platz
 * @param {number} passAnteil
 */
export function platzStaerke(platz, passAnteil) {
  if (!platz.spieler) return ERSATZ_STAERKE;
  const roh = eignungGemischt(platz.spieler, platz.platz, bewertungsAnteil(platz.platz, passAnteil));
  return platz.doppel ? roh * (1 - doppelAbzug(platz.spieler.attribute.ausdauer)) : roh;
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

/**
 * Ob die Elf vollständig ist — jeder der zweiundzwanzig Plätze besetzt.
 *
 * Von selbst ist sie das immer: die drei Runden lassen keinen Platz leer,
 * notfalls über den Doppeleinsatz. Die Frage hat erst einen Sinn, seit der
 * Manager Plätze absichtlich frei lassen kann, und sie ist die Bedingung fürs
 * Speichern: eine halbe Aufstellung ist keine, mit der man antritt.
 * @param {Aufstellung} a
 */
export function vollstaendig(a) {
  return [...a.offense, ...a.defense].every((p) => !!p.spieler);
}

/** Wie viele Plätze mit einem Umsteller besetzt sind. @param {Aufstellung} a */
export function umstellungen(a) {
  return [...a.offense, ...a.defense].filter((p) => p.umgestellt).length;
}

// --- Die Vorgabe des Managers ----------------------------------------------
// Docs: docs/umbau-aufstellung.md

/**
 * Eine fertige Aufstellung als Vorgabe einfrieren.
 *
 * Das ist der erste Schritt jeder Änderung von Hand: der Manager verschiebt nie
 * einen Platz in einer leeren Aufstellung, sondern immer einen in der, die er
 * gerade vor sich sieht. Was er nicht anfasst, bleibt damit genau so stehen,
 * wie die Automatik es gestellt hatte — bis ein Spieler ausfällt.
 * @param {Aufstellung} a
 * @returns {Vorgabe}
 */
export function alsVorgabe(a) {
  /** @type {Vorgabe} */
  const vorgabe = {};
  for (const platz of [...a.offense, ...a.defense]) {
    if (platz.spieler) vorgabe[platz.schluessel] = platz.spieler.id;
    else if (platz.frei) vorgabe[platz.schluessel] = null;
  }
  return vorgabe;
}

/**
 * Eine Aufstellung, auf der niemand steht: jeder Platz ausdrücklich frei.
 *
 * Der Anfang für den Manager, der seine Elf von Grund auf bauen will. Was
 * dabei herauskommt, ist so lange nicht speicherbar, bis jeder Platz wieder
 * besetzt ist — siehe `vollstaendig()`.
 * @param {Aufstellung} a
 * @returns {Vorgabe}
 */
export function leereVorgabe(a) {
  /** @type {Vorgabe} */
  const vorgabe = {};
  for (const platz of [...a.offense, ...a.defense]) vorgabe[platz.schluessel] = null;
  return vorgabe;
}

/**
 * Einen Spieler auf einen Platz setzen — und den, der dort stand, auf dessen
 * alten.
 *
 * Getauscht wird, nicht verdrängt: sonst müsste der Manager nach jedem Zug den
 * Verdrängten suchen, und ein Zug wäre nie ein Zug, sondern immer zwei. Kam der
 * Neue von nirgendwo, wird der Alte auch nirgendwohin gesetzt; sein Platz fällt
 * an die Automatik zurück.
 *
 * Steht der Neue doppelt (in beiden Einheiten), erbt nur seine **erste** Stelle
 * den Verdrängten. Die zweite wird frei und neu besetzt — ein Doppeleinsatz ist
 * ein Notnagel und soll sich nicht durch die Aufstellung weitervererben.
 * @param {Vorgabe} vorgabe
 * @param {string} schluessel Platz-Schlüssel, wie ihn `Platz.schluessel` trägt
 * @param {string} spielerId
 * @returns {Vorgabe} eine neue Karte; die übergebene bleibt unberührt
 */
export function setzePlatz(vorgabe, schluessel, spielerId) {
  const neu = { ...vorgabe };
  const kanntePlatz = Object.prototype.hasOwnProperty.call(vorgabe, schluessel);
  const verdraengt = neu[schluessel];
  const bisher = Object.keys(neu).filter((k) => neu[k] === spielerId && k !== schluessel);

  neu[schluessel] = spielerId;
  bisher.forEach((k, i) => {
    // Der alte Platz erbt, was am Ziel stand — auch ein `null`. Wer aus einer
    // leergeräumten Aufstellung heraus umzieht, lässt seinen Platz frei zurück
    // und nicht der Automatik.
    if (i === 0 && kanntePlatz) neu[k] = verdraengt;
    else delete neu[k];
  });
  return neu;
}

/**
 * Was ein Spieler auf einem Platz wert wäre — dieselbe Zahl, die die
 * Aufstellung hinter seinem Namen zeigt, nur für einen Platz, auf dem er (noch)
 * nicht steht. Der Doppeleinsatz steckt nicht darin: wer irgendwohin gestellt
 * wird, zieht dorthin um, statt zweimal zu spielen.
 * @param {import('./spieler.js').Spieler} spieler
 * @param {string} platz
 * @param {number} passAnteil
 */
export function wertAuf(spieler, platz, passAnteil) {
  return eignungGemischt(spieler, platz, bewertungsAnteil(platz, passAnteil));
}

/**
 * Einen Mann aus der Aufstellung nehmen. Seine Plätze werden **frei**, nicht
 * nachbesetzt.
 *
 * Nachbesetzen wäre hier wirkungslos: die Automatik stellt auf jeden Platz den
 * Stärksten seiner Position, und das ist in aller Regel genau der, den der
 * Manager gerade heruntergenommen hat. Der Knopf sähe aus, als täte er nichts.
 * Frei bleibt der Platz sichtbar offen — und die Elf so lange nicht speicherbar.
 *
 * Steht er doppelt, geht er von beiden Plätzen.
 * @param {Vorgabe} vorgabe
 * @param {string} spielerId
 * @returns {Vorgabe} eine neue Karte
 */
export function entferneSpieler(vorgabe, spielerId) {
  const neu = { ...vorgabe };
  for (const [platz, id] of Object.entries(neu)) if (id === spielerId) neu[platz] = null;
  return neu;
}

/**
 * Die besten Männer für **diesen** Platz, absteigend.
 *
 * Beantwortet „wer ist hier der Beste", nicht „was ist fürs Paar am besten" —
 * das zweite ist die Frage von `verteile()` und hat eine andere Antwort. Für
 * die Ansicht ist die erste die richtige: sie steht unter einem angetippten
 * Platz, und dort will niemand über die Nebenplätze nachdenken müssen.
 * @param {import('./spieler.js').Spieler[]} kader
 * @param {number} spieltag
 * @param {string} platz Platzname, nicht Schlüssel — `TE#2` wird wie `TE` bewertet
 * @param {number} passAnteil
 * @param {number} [anzahl]
 * @returns {{ spieler: import('./spieler.js').Spieler, wert: number }[]}
 */
export function bestenFuer(kader, spieltag, platz, passAnteil, anzahl = 5) {
  return kader
    .filter((s) => istFit(s, spieltag))
    .map((s) => ({ spieler: s, wert: wertAuf(s, platz, passAnteil) }))
    .sort((a, b) => b.wert - a.wert)
    .slice(0, anzahl);
}
