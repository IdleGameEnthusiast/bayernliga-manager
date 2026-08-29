// @ts-check
/**
 * Was eine Position ausmacht: der Körper, in dem sie steckt, und die beiden
 * Formeln, nach denen sie bewertet wird.
 *
 * Reine Daten plus die Ableitungen daraus. Kein DOM, keine Zufallsquelle — wer
 * hier etwas liest, bekommt für dieselbe Position immer dasselbe zurück.
 *
 * Docs: docs/umbau-positionsmodell.md, Abschnitte 2 und 3
 */

import { ATTRIBUTE } from './constants.js';

/**
 * Größe (cm) und Gewicht (kg), in denen eine Position normalerweise steckt.
 * Das ist das Ideal, nicht die Regel: etwa ein Fünftel der Spieler steht
 * daneben, und wer daneben steht, hat die Werte dazu.
 * @type {Record<string, { groesse: [number, number], gewicht: [number, number] }>}
 */
export const KOERPER_KORRIDOR = {
  QB:   { groesse: [178, 195], gewicht: [85, 100] },
  RB:   { groesse: [172, 185], gewicht: [82, 98] },
  FB:   { groesse: [175, 188], gewicht: [95, 112] },
  WR:   { groesse: [175, 190], gewicht: [78, 92] },
  SL:   { groesse: [170, 183], gewicht: [75, 88] },
  TE:   { groesse: [185, 198], gewicht: [95, 115] },
  T:    { groesse: [185, 200], gewicht: [110, 140] },
  G:    { groesse: [180, 195], gewicht: [105, 135] },
  C:    { groesse: [180, 192], gewicht: [100, 125] },
  DE:   { groesse: [185, 198], gewicht: [100, 120] },
  DT:   { groesse: [183, 195], gewicht: [115, 140] },
  NT:   { groesse: [180, 193], gewicht: [125, 150] },
  MLB:  { groesse: [180, 192], gewicht: [100, 118] },
  SAM:  { groesse: [183, 193], gewicht: [100, 118] },
  WILL: { groesse: [178, 188], gewicht: [90, 105] },
  CB:   { groesse: [172, 185], gewicht: [75, 90] },
  FS:   { groesse: [178, 188], gewicht: [82, 95] },
  SS:   { groesse: [180, 190], gewicht: [88, 102] },
};

/**
 * Die Mitte des Gewichtskorridors. Der Abstand zweier Mitten ist später der
 * Körpermalus einer Umstellung — ein 137-Kilo-Mann spielt keinen Cornerback,
 * auch wenn sein Tackling stimmt.
 * @param {string} position
 */
export function korridorMitte(position) {
  const [von, bis] = KOERPER_KORRIDOR[position].gewicht;
  return (von + bis) / 2;
}

/**
 * Jede Position hat zwei Formeln: einen Passwert und einen Laufwert. Alle
 * Anteile in Prozent, jede Spalte summiert auf 100.
 *
 * `technik` steht in jeder einzelnen davon. Der Anteil ist der Träger des
 * Umstellungsabschlags — ohne ihn kostet ein Positionswechsel nichts.
 *
 * MLB und SAM sind bewusst physisch geschnitten, WILL bewusst athletisch: die
 * drei Linebacker sollen auseinanderliegen, MLB und SAM als Brücke zur Line,
 * WILL als Brücke zur Secondary. Ständen alle drei in der Mitte, landete jeder
 * von ihnen bei den Safeties.
 * @type {Record<string, { pass: Record<string, number>, lauf: Record<string, number> }>}
 */
export const FORMELN = {
  QB: {
    pass: { werfen: 40, spielverstaendnis: 25, technik: 15, beweglichkeit: 10, ballsicherheit: 10 },
    lauf: { schnelligkeit: 30, beweglichkeit: 25, spielverstaendnis: 15, ballsicherheit: 10, technik: 10, kraft: 10 },
  },
  RB: {
    pass: { blocken: 30, fangen: 25, technik: 15, routeRunning: 10, beweglichkeit: 10, ballsicherheit: 10 },
    lauf: { schnelligkeit: 25, beweglichkeit: 25, kraft: 20, ballsicherheit: 15, technik: 15 },
  },
  FB: {
    pass: { blocken: 45, kraft: 20, fangen: 20, technik: 15 },
    lauf: { blocken: 35, kraft: 30, technik: 15, ballsicherheit: 10, beweglichkeit: 10 },
  },
  WR: {
    pass: { fangen: 28, routeRunning: 22, schnelligkeit: 18, beweglichkeit: 12, technik: 10, ballsicherheit: 10 },
    lauf: { blocken: 50, schnelligkeit: 20, kraft: 15, technik: 15 },
  },
  SL: {
    pass: { routeRunning: 28, fangen: 22, beweglichkeit: 22, technik: 10, schnelligkeit: 9, ballsicherheit: 9 },
    lauf: { blocken: 40, beweglichkeit: 20, technik: 20, schnelligkeit: 20 },
  },
  TE: {
    pass: { fangen: 30, routeRunning: 20, beweglichkeit: 15, technik: 15, kraft: 10, ballsicherheit: 10 },
    lauf: { blocken: 45, kraft: 25, technik: 20, beweglichkeit: 10 },
  },
  T: {
    pass: { blocken: 45, beweglichkeit: 20, technik: 20, kraft: 15 },
    lauf: { blocken: 45, kraft: 30, technik: 15, beweglichkeit: 10 },
  },
  G: {
    pass: { blocken: 40, kraft: 35, technik: 20, beweglichkeit: 5 },
    lauf: { kraft: 40, blocken: 35, technik: 20, beweglichkeit: 5 },
  },
  C: {
    pass: { blocken: 40, kraft: 30, spielverstaendnis: 15, technik: 15 },
    lauf: { kraft: 35, blocken: 35, technik: 20, spielverstaendnis: 10 },
  },
  DE: {
    pass: { passrush: 45, beweglichkeit: 25, technik: 20, kraft: 10 },
    lauf: { tacklen: 30, kraft: 25, technik: 20, spielverstaendnis: 15, beweglichkeit: 10 },
  },
  DT: {
    pass: { passrush: 35, kraft: 30, technik: 20, beweglichkeit: 15 },
    lauf: { kraft: 35, tacklen: 25, technik: 20, spielverstaendnis: 20 },
  },
  NT: {
    pass: { kraft: 45, passrush: 25, technik: 20, beweglichkeit: 10 },
    lauf: { kraft: 50, tacklen: 20, technik: 15, spielverstaendnis: 15 },
  },
  MLB: {
    pass: { spielverstaendnis: 28, coverage: 20, passrush: 14, technik: 15, kraft: 13, schnelligkeit: 10 },
    lauf: { tacklen: 32, kraft: 28, spielverstaendnis: 25, technik: 15 },
  },
  SAM: {
    pass: { passrush: 28, coverage: 22, spielverstaendnis: 20, technik: 15, schnelligkeit: 15 },
    lauf: { tacklen: 33, kraft: 27, technik: 20, spielverstaendnis: 20 },
  },
  WILL: {
    pass: { coverage: 36, schnelligkeit: 22, spielverstaendnis: 18, beweglichkeit: 14, technik: 10 },
    lauf: { tacklen: 26, schnelligkeit: 26, spielverstaendnis: 17, beweglichkeit: 16, technik: 15 },
  },
  CB: {
    pass: { coverage: 32, schnelligkeit: 22, beweglichkeit: 18, technik: 10, spielverstaendnis: 9, fangen: 9 },
    lauf: { tacklen: 34, schnelligkeit: 21, spielverstaendnis: 17, technik: 15, kraft: 13 },
  },
  FS: {
    pass: { coverage: 27, spielverstaendnis: 27, schnelligkeit: 18, fangen: 18, technik: 10 },
    lauf: { spielverstaendnis: 34, tacklen: 30, schnelligkeit: 21, technik: 15 },
  },
  SS: {
    pass: { spielverstaendnis: 27, coverage: 27, tacklen: 18, schnelligkeit: 18, technik: 10 },
    lauf: { tacklen: 34, spielverstaendnis: 21, kraft: 17, technik: 15, schnelligkeit: 13 },
  },
};

/**
 * Wo eine Position ihren Wert verdient: Blockgewicht mal Platzanteil, einmal
 * fürs Passspiel und einmal fürs Laufspiel. Daraus kommt allein, wie schwer
 * die beiden Formeln beim Ziehen eines Spielers wiegen.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 2 und 6
 * @type {Record<string, { pass: number, lauf: number }>}
 */
export const PROFIL_BEITRAG = {
  QB:   { pass: 0.400, lauf: 0.200 },
  RB:   { pass: 0.053, lauf: 0.120 },
  FB:   { pass: 0.035, lauf: 0.100 },
  WR:   { pass: 0.105, lauf: 0.040 },
  SL:   { pass: 0.088, lauf: 0.060 },
  TE:   { pass: 0.070, lauf: 0.080 },
  T:    { pass: 0.063, lauf: 0.076 },
  G:    { pass: 0.045, lauf: 0.096 },
  C:    { pass: 0.035, lauf: 0.056 },
  DE:   { pass: 0.112, lauf: 0.092 },
  DT:   { pass: 0.070, lauf: 0.104 },
  NT:   { pass: 0.056, lauf: 0.112 },
  MLB:  { pass: 0.080, lauf: 0.160 },
  SAM:  { pass: 0.058, lauf: 0.140 },
  WILL: { pass: 0.113, lauf: 0.100 },
  CB:   { pass: 0.120, lauf: 0.034 },
  FS:   { pass: 0.100, lauf: 0.052 },
  SS:   { pass: 0.060, lauf: 0.080 },
};

/**
 * Wie stark das Passspiel beim Ziehen der Attribute wiegt.
 *
 * Nicht der einfache Mittelwert der beiden Formeln: die Laufformel eines
 * Receivers ist `blocken 50`, weil er im Laufspiel blockt. Gemittelt wäre
 * Blocken sein größtes Attribut und jeder Receiver käme als Top-Blocker aus
 * der Ziehung. Gewichtet wird deshalb danach, wo die Position ihren Wert
 * verdient.
 * @param {string} position
 */
export function profilPassAnteil(position) {
  const b = PROFIL_BEITRAG[position];
  return b.pass / (b.pass + b.lauf);
}

/**
 * Zwei Formeln zu einer mischen. `passAnteil` 1 ist reines Passspiel, 0 reines
 * Laufspiel. Das Ergebnis sind Anteile, die auf 1 summieren — nicht auf 100,
 * damit ein Wert daraus direkt auf der Stärkeskala liegt.
 * @param {string} position
 * @param {number} passAnteil 0..1
 * @returns {Record<string, number>}
 */
export function gemischteFormel(position, passAnteil) {
  const { pass, lauf } = FORMELN[position];
  /** @type {Record<string, number>} */
  const anteile = {};
  for (const attribut of ATTRIBUTE) {
    const anteil = (pass[attribut] || 0) * passAnteil + (lauf[attribut] || 0) * (1 - passAnteil);
    if (anteil > 0) anteile[attribut] = anteil / 100;
  }
  return anteile;
}

/**
 * Das Profil, nach dem die Spieler einer Position gezogen werden. Eine Position
 * hat zwei Formeln, aber nur ein Profil.
 * @param {string} position
 */
export function generierungsProfil(position) {
  return gemischteFormel(position, profilPassAnteil(position));
}

/**
 * Was ein Satz Attribute nach einer Formel wert ist.
 * @param {Record<string, number>} werte
 * @param {Record<string, number>} anteile Anteile, die auf 1 summieren
 */
export function bewerte(werte, anteile) {
  let summe = 0;
  for (const attribut in anteile) summe += (werte[attribut] || 0) * anteile[attribut];
  return summe;
}
