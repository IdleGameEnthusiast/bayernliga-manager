// @ts-check
/**
 * Commitment und Lebenslage: was einen Menschen im Verein hält, und was ihn
 * irgendwann wegzieht.
 *
 * Die Währung dieser Liga ist nicht Geld. Wer in der Bayernliga aufhört, tut
 * das wegen Studium, Job, Familie, Bank oder weil ein Verein 80 km näher
 * liegt — nicht, weil ein Vertrag ausläuft. Deshalb gibt es hier keine
 * Verträge, sondern einen **Halt** (`commitment`, 0–99) und einen **Druck**
 * (die `Lebenslage`), und beides gilt für jeden Menschen im Verein: Spieler,
 * Coaches, später Orga. Die Stufenlogik liegt genau einmal hier und nicht in
 * `spieler.js` und `coach.js` doppelt — sobald Orga dazukommt, ist es dieselbe
 * Funktion.
 *
 * In diesem ersten Schritt **bewegt sich nichts**: der Wert wird gezogen und
 * angezeigt, sonst nichts. Drift ohne Hebel wäre eine unsichtbare Strafe —
 * fünf Textstufen, die leise fallen, und nichts, was der Manager dagegen tun
 * kann. Erst Anzeige, dann Bewegung, dann Hebel.
 *
 * Verworfen: das Commitment über das Alter zu ziehen („wer mit 30 noch
 * Bayernliga spielt, will es"). Jeder kann die Lust verlieren, wenn er auf der
 * Bank sitzt, und Mobilität erklärt mehr als Alter: der 23-jährige Student ohne
 * Auto fährt weniger weit als der 30-jährige Arbeiter. Das Alter steckt in der
 * Lebenslage — im Status —, nicht im Wert. Ebenfalls verworfen: den Wert aus
 * den Soft Skills eines Coaches abzuleiten. Commitment ist keine Fähigkeit.
 *
 * Docs: docs/naechste-schritte.md, Block 7
 */

import {
  COMMITMENT_STUFEN, COMMITMENT_BASIS, COMMITMENT_STREUUNG,
  COMMITMENT_JE_KM_AUTO, COMMITMENT_JE_KM_OHNE, COMMITMENT_STRECKE_MAX,
  COMMITMENT_JE_VEREINSJAHR, COMMITMENT_VEREINSJAHRE_MAX, COMMITMENT_JE_STATUS,
  clamp, randInt, randNormal, pickWeighted,
} from './constants.js';

/**
 * Die Lebenslage — aus Feldern gebaut, nie als Text gespeichert, sonst kann
 * die Engine nichts damit rechnen. Der Satz dazu kommt aus einer Vorlage in
 * `i18n.js`.
 *
 * Jahre stehen als **Jahreszahlen**, nicht als Zähler: `seit` ist das Jahr
 * des Eintritts, `horizont.jahr` das Jahr, in dem das Ereignis ansteht. So
 * muss der Saisonwechsel nichts hochzählen und nichts herunterzählen, und ein
 * Horizont, der erreicht ist, liest sich als „dieses Jahr" statt als „noch 0
 * Jahre".
 *
 * Was hier steht, ist, was der Spieler **erzählt**. Die Wahrheit daneben —
 * das Studium dauert fünf Jahre statt vier — kommt mit den Gesprächen in
 * Schritt 2; bis dahin ist der Plan die Wahrheit.
 * @typedef {object} Lebenslage
 * @property {Status} status
 * @property {number} entfernung   km bis zum Training — zum eigenen Verein, siehe offene Entscheidung 10
 * @property {boolean} auto        ob er selbst fahren kann
 * @property {boolean} familie     verändert später, was eine Verletzung oder eine lange Fahrt kostet
 * @property {Horizont | null} horizont  was als Nächstes ansteht — null: nichts Bestimmtes
 * @property {number} seit         Jahr des Eintritts in den Verein
 */

/** @typedef {'schueler'|'student'|'azubi'|'arbeiter'|'rentner'} Status */

/**
 * Das nächste Ereignis im Leben eines Spielers. `wegzug` trägt die Entfernung,
 * die anderen nicht. `bleibt` ist ein Ereignis, kein Nicht-Ereignis: die
 * Ausbildung endet, und er hat vor, danach hier zu bleiben — das ist eine
 * Auskunft, die der Manager haben will.
 * @typedef {object} Horizont
 * @property {number} jahr
 * @property {'wegzug'|'bleibt'|'schluss'} dann
 * @property {number} km   nur bei `wegzug`, sonst 0
 */

/** Die Statusnamen, in der Reihenfolge eines Lebens. */
export const STATUS_REIHE = /** @type {const} */ (['schueler', 'student', 'azubi', 'arbeiter', 'rentner']);

// --- Die Stufen ------------------------------------------------------------

/**
 * Die Stufe zu einem Wert, 0 bis 4. Der Manager sieht nur sie.
 *
 * Fünf Stufen und nicht drei oder zehn, aus zwei Gründen: sie klingen wie ein
 * Trainer redet („dabei", „wackelt"), nicht wie eine Skala — und ein
 * Stufenwechsel ist später der einzige Auslöser für eine Nachricht. Bei zehn
 * Stufen wäre das Postfach mit 45 Spielern eine Spam-Quelle.
 * @param {number} wert 0..99
 * @returns {0|1|2|3|4}
 */
export function stufe(wert) {
  let s = 0;
  for (const grenze of COMMITMENT_STUFEN) if (wert >= grenze) s++;
  return /** @type {0|1|2|3|4} */ (s);
}

// --- Die Lebenslage --------------------------------------------------------

/**
 * Welcher Status in welchem Alter wie wahrscheinlich ist. Die Grenzen sind
 * inklusive Obergrenzen; die letzte Zeile fängt alles darüber.
 * @type {[number, (readonly [Status, number])[]][]}
 */
const STATUS_JE_ALTER = [
  [19, [['schueler', 60], ['azubi', 40]]],
  [25, [['student', 50], ['azubi', 25], ['arbeiter', 25]]],
  [30, [['student', 15], ['arbeiter', 85]]],
  [63, [['arbeiter', 100]]],
  [Infinity, [['rentner', 100]]],
];

/**
 * Wie weit einer fährt: drei Bänder, die meisten wohnen in der Nähe. Der
 * Zehntel, der von weit her kommt, ist der, um den es in Block 7 geht.
 * @type {(readonly [[number, number], number])[]}
 */
const ENTFERNUNG_BAENDER = [[[1, 15], 60], [[16, 50], 30], [[51, 120], 10]];

/** Wer ein Auto hat, je Status. */
const AUTO_JE_STATUS = /** @type {Record<Status, number>} */ ({
  schueler: 0.10, student: 0.45, azubi: 0.65, arbeiter: 0.90, rentner: 0.85,
});

/** Familie, je Alter — inklusive Obergrenzen wie oben. @type {[number, number][]} */
const FAMILIE_JE_ALTER = [[23, 0.03], [29, 0.25], [39, 0.60], [Infinity, 0.75]];

/** Wie lange einer schon da ist — drei Bänder, die meisten kurz. @type {(readonly [[number, number], number])[]} */
const VEREINSJAHRE_BAENDER = [[[0, 2], 50], [[3, 7], 35], [[8, 20], 15]];
/** Vor diesem Alter war niemand im Verein. */
const JUGEND_ALTER = 16;

/**
 * Was am Horizont steht, je Status: mit welcher Wahrscheinlichkeit welches
 * Ereignis, wie viele Jahre entfernt, und bei einem Wegzug wie weit. `null`
 * heißt: nichts Bestimmtes — fester Wohnsitz, kein Plan.
 *
 * Der Arbeiter ist zweigeteilt, weil bei ihm das Alter den Horizont bestimmt:
 * unter 30 hat er selten einen, ab 30 heißt er meistens „Körper".
 * @type {Record<string, (readonly [{ dann: 'wegzug'|'bleibt'|'schluss', jahre: [number, number], km: [number, number] } | null, number])[]>}
 */
const HORIZONT_JE_STATUS = {
  schueler: [
    [{ dann: 'wegzug', jahre: [1, 3], km: [30, 350] }, 45],
    [{ dann: 'bleibt', jahre: [1, 3], km: [0, 0] }, 55],
  ],
  student: [
    [{ dann: 'wegzug', jahre: [1, 5], km: [30, 400] }, 55],
    [{ dann: 'bleibt', jahre: [1, 5], km: [0, 0] }, 45],
  ],
  azubi: [
    [{ dann: 'wegzug', jahre: [1, 3], km: [20, 150] }, 15],
    [{ dann: 'bleibt', jahre: [1, 3], km: [0, 0] }, 85],
  ],
  arbeiterJung: [
    [null, 70],
    [{ dann: 'wegzug', jahre: [1, 4], km: [20, 250] }, 20],
    [{ dann: 'schluss', jahre: [2, 6], km: [0, 0] }, 10],
  ],
  arbeiterAlt: [
    [null, 40],
    [{ dann: 'schluss', jahre: [1, 4], km: [0, 0] }, 50],
    [{ dann: 'wegzug', jahre: [1, 4], km: [20, 250] }, 10],
  ],
  rentner: [
    [{ dann: 'schluss', jahre: [1, 3], km: [0, 0] }, 70],
    [null, 30],
  ],
};
/** Ab wann ein Arbeiter zur zweiten Tabelle gehört. */
const ARBEITER_ALT_AB = 30;

/**
 * Der erste Eintrag, dessen Obergrenze das Alter noch fasst.
 * @template T
 * @param {[number, T][]} tabelle
 * @param {number} alter
 */
function nachAlter(tabelle, alter) {
  for (const [bis, wert] of tabelle) if (alter <= bis) return wert;
  return tabelle[tabelle.length - 1][1];
}

/**
 * Eine Lebenslage für einen Menschen dieses Alters, im Jahr `jahr`.
 *
 * Das Alter bestimmt den Status, der Status fast alles Weitere. Die
 * Reihenfolge der Ziehungen ist fest — wer sie ändert, ändert jede
 * Lebenslage jedes gespeicherten Standes, denn die werden aus dem Saatgut
 * nachgezogen.
 * @param {() => number} rng
 * @param {number} alter
 * @param {number} jahr
 * @returns {Lebenslage}
 */
export function ziehLebenslage(rng, alter, jahr) {
  const status = pickWeighted(rng, nachAlter(STATUS_JE_ALTER, alter));
  const band = pickWeighted(rng, ENTFERNUNG_BAENDER);
  const entfernung = randInt(rng, band[0], band[1]);
  const auto = rng() < AUTO_JE_STATUS[status];
  const familie = rng() < nachAlter(FAMILIE_JE_ALTER, alter);

  const tabelle = status === 'arbeiter'
    ? (alter >= ARBEITER_ALT_AB ? 'arbeiterAlt' : 'arbeiterJung')
    : status;
  const plan = pickWeighted(rng, HORIZONT_JE_STATUS[tabelle]);
  const horizont = plan
    ? {
      jahr: jahr + randInt(rng, plan.jahre[0], plan.jahre[1]),
      dann: plan.dann,
      km: plan.dann === 'wegzug' ? randInt(rng, plan.km[0], plan.km[1]) : 0,
    }
    : null;

  const jahreBand = pickWeighted(rng, VEREINSJAHRE_BAENDER);
  const vereinsjahre = Math.min(randInt(rng, jahreBand[0], jahreBand[1]),
    Math.max(0, alter - JUGEND_ALTER));

  return { status, entfernung, auto, familie, horizont, seit: jahr - vereinsjahre };
}

// --- Der Wert --------------------------------------------------------------

/**
 * Das Commitment zu einer Lebenslage: Basis, minus die Strecke, plus der
 * Status, plus die Jahre im Verein, plus Streuung. Familie und Horizont
 * fehlen mit Absicht — sie sind **Druck**, und Druck steht auf der anderen
 * Seite der Waage. Ein hochcommitteter Student geht trotzdem, wenn das
 * Studium endet; das kann nur die Waage aus zwei Seiten abbilden, nicht ein
 * Wert, von dem beides abgezogen wird.
 * @param {() => number} rng
 * @param {Lebenslage} lebenslage
 * @param {number} jahr
 */
export function ziehCommitment(rng, lebenslage, jahr) {
  const jeKm = lebenslage.auto ? COMMITMENT_JE_KM_AUTO : COMMITMENT_JE_KM_OHNE;
  const strecke = Math.min(lebenslage.entfernung * jeKm, COMMITMENT_STRECKE_MAX);
  const vereinsjahre = Math.min(jahr - lebenslage.seit, COMMITMENT_VEREINSJAHRE_MAX);

  const wert = COMMITMENT_BASIS
    - strecke
    + COMMITMENT_JE_STATUS[lebenslage.status]
    + vereinsjahre * COMMITMENT_JE_VEREINSJAHR
    + randNormal(rng) * COMMITMENT_STREUUNG;
  return clamp(Math.round(wert), 0, 99);
}

/**
 * Beides zusammen, in der Reihenfolge, in der eins vom anderen abhängt.
 * @param {() => number} rng
 * @param {number} alter
 * @param {number} jahr
 * @returns {{ commitment: number, lebenslage: Lebenslage }}
 */
export function ziehBindung(rng, alter, jahr) {
  const lebenslage = ziehLebenslage(rng, alter, jahr);
  return { commitment: ziehCommitment(rng, lebenslage, jahr), lebenslage };
}
