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
 * Hier stehen die **Ziehungen**: der Wert und die Lebenslage, wie ein Mensch
 * ins Spiel kommt. Was danach mit ihm geschieht — der Horizont, der erreicht
 * wird, der Statuswechsel, die Waage Druck gegen Halt — steht in
 * `lebenslauf.js`. Der Wert selbst **bewegt sich noch nicht**: Drift ohne
 * Hebel wäre eine unsichtbare Strafe — fünf Textstufen, die leise fallen, und
 * nichts, was der Manager dagegen tun kann. Erst Anzeige, dann Bewegung, dann
 * Hebel.
 *
 * Verworfen: das Commitment über das Alter zu ziehen („wer mit 30 noch
 * Bayernliga spielt, will es"). Jeder kann die Lust verlieren, wenn er auf der
 * Bank sitzt. Das Alter steckt in der Lebenslage — im Status —, nicht im Wert.
 * Ebenfalls verworfen: den Wert aus den Soft Skills eines Coaches abzuleiten.
 * Commitment ist keine Fähigkeit. Und seit der Waage auch nicht mehr aus der
 * **Strecke**: die Mobilität ist Druck, und Druck steht auf der anderen Seite
 * — im Wert stünde sie doppelt.
 *
 * Docs: docs/naechste-schritte.md, Block 7
 */

import {
  COMMITMENT_STUFEN, COMMITMENT_BASIS, COMMITMENT_STREUUNG,
  COMMITMENT_JE_VEREINSJAHR, COMMITMENT_VEREINSJAHRE_MAX, COMMITMENT_JE_STATUS,
  SCHLUSS_JE_STUFE,
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
 * @property {boolean} familie     die eigene — beim Arbeiter legt sie sich auf die Strecke
 * @property {Horizont | null} horizont  was als Nächstes ansteht — null: nichts Bestimmtes
 * @property {number} seit         Jahr des Eintritts in den Verein
 * @property {number} [druckJahre] Saisons in Folge, in denen der Druck über dem Halt lag —
 *   der Zähler der Waage, siehe `lebenslauf.js`. Fehlt in einem Stand vor Version 12: null
 * @property {boolean} [verlaengert] ob er schon einmal einen Abschnitt angehängt hat (Master,
 *   zweite Ausbildung) — das geht nur einmal, sonst studiert einer ewig
 */

/** @typedef {'schueler'|'student'|'azubi'|'arbeiter'|'rentner'} Status */

/** Warum einer aufhört. Wird mit dem Plan gezogen, altersabhängig. */
/** @typedef {'koerper'|'lust'|'beruf'|'familie'} Grund */

/**
 * Das nächste Ereignis im Leben eines Spielers — der **Plan**, den er erzählt.
 * `wegzug` trägt die Entfernung, die anderen nicht. `bleibt` ist ein Ereignis,
 * kein Nicht-Ereignis: die Ausbildung endet, und er hat vor, danach hier zu
 * bleiben — das ist eine Auskunft, die der Manager haben will. `familie` gibt
 * es nur beim Arbeiter: er gründet eine, und die Strecke wird ihm teurer.
 * `schluss` trägt seinen Grund, damit der Satz nicht jedem Schluss „körperlich"
 * zuschreibt.
 * @typedef {object} Horizont
 * @property {number} jahr
 * @property {'wegzug'|'bleibt'|'schluss'|'familie'} dann
 * @property {number} km   nur bei `wegzug`, sonst 0
 * @property {Grund} [grund]  nur bei `schluss`; fehlt in einem Stand vor Version 12 und heißt dann Körper
 */

/** Die Statusnamen, in der Reihenfolge eines Lebens. */
export const STATUS_REIHE = /** @type {const} */ (['schueler', 'student', 'azubi', 'arbeiter', 'rentner']);

// --- Die Stufen ------------------------------------------------------------

/**
 * Die Stufe zu einem Wert, 0 bis 4. Der Manager sieht nur sie.
 *
 * Fünf Stufen und nicht drei oder zehn: ein Stufenwechsel ist später der
 * einzige Auslöser für eine Nachricht, und bei zehn Stufen wäre das Postfach
 * mit 45 Spielern eine Spam-Quelle. Die Namen dazu (`i18n.js`) benennen die
 * Höhe des Werts und sagen nichts über den Ausgang — das entscheidet die
 * Waage in `lebenslauf.js`, nicht die Stufe.
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

/**
 * Wer ein Auto hat, je Status. Gilt bei der Ziehung — und noch einmal beim
 * Statuswechsel in `lebenslauf.js`: wer Arbeiter wird, kauft sich meistens
 * eins, und ein Schüler ohne Auto soll nicht als Arbeiter ohne Auto enden.
 */
export const AUTO_JE_STATUS = /** @type {Record<Status, number>} */ ({
  schueler: 0.10, student: 0.45, azubi: 0.65, arbeiter: 0.90, rentner: 0.85,
});

/** Familie, je Alter — inklusive Obergrenzen wie oben. @type {[number, number][]} */
const FAMILIE_JE_ALTER = [[23, 0.03], [29, 0.25], [39, 0.60], [Infinity, 0.75]];

/** Wie lange einer schon da ist — drei Bänder, die meisten kurz. @type {(readonly [[number, number], number])[]} */
const VEREINSJAHRE_BAENDER = [[[0, 2], 50], [[3, 7], 35], [[8, 20], 15]];
/** Vor diesem Alter war niemand im Verein. */
const JUGEND_ALTER = 16;

/**
 * Der erste Eintrag, dessen Obergrenze das Alter noch fasst.
 * @template T
 * @param {(readonly [number, T])[]} tabelle
 * @param {number} alter
 */
function nachAlter(tabelle, alter) {
  for (const [bis, wert] of tabelle) if (alter <= bis) return wert;
  return tabelle[tabelle.length - 1][1];
}

// --- Der Horizont ----------------------------------------------------------

/**
 * Das Abschlussalter statt einer Schulart. Die Schulart wird nirgends
 * gespeichert; gezogen wird einmal, mit welchem Alter einer die Schule
 * verlässt, und die Verteilung dahinter bildet die drei bayerischen Schularten
 * nach — 40 % Gymnasium, je 30 % Real- und Mittelschule. Die Zahl codiert
 * schon alles, was die Engine braucht: wer mit 16 fertig ist, wird beim
 * Abschluss kaum Student, wer mit 18 fertig ist, schon.
 * @type {(readonly [(readonly [number, number])[], number])[]}
 */
const ABSCHLUSSALTER = [
  [[[17, 15], [18, 55], [19, 30]], 40], // Gymnasium
  [[[16, 85], [17, 15]], 30],           // Realschule
  [[[15, 60], [16, 40]], 30],           // Mittelschule
];

/**
 * Mit welchem Alter ein Schüler die Schule verlässt. Wer schon älter ist als
 * das Gezogene, ist im nächsten Jahr fertig — ein 18-jähriger Schüler ist per
 * Definition Gymnasiast in der letzten oder vorletzten Klasse.
 * @param {() => number} rng
 * @param {number} alter
 */
export function ziehAbschlussalter(rng, alter) {
  const schulart = pickWeighted(rng, ABSCHLUSSALTER);
  return Math.max(pickWeighted(rng, schulart), alter + 1);
}

/**
 * Wie weit ein Wegzug führt: der **Median** je Status. Der Schüler zieht am
 * weitesten — in die Uni-Stadt —, der Azubi kaum.
 *
 * Gezogen wird log-normal, nicht gleichverteilt. Bis Schritt 1 war es
 * gleichverteilt 30–400 km, und das war als Plan-Anzeige egal; mit der Waage
 * nicht mehr: ab rund 150 km ohne Auto ist der Druck 99, und die Waage wäre
 * kein Abwägen, sondern ein Urteil. Log-normal mit Median 60 legt die meisten
 * Wegzüge zwischen 30 und 130 km — dort, wo Auto und Commitment entscheiden —
 * und lässt die 300 km trotzdem vorkommen.
 */
const WEGZUG_MEDIAN_KM = /** @type {Record<Status, number>} */ ({
  schueler: 80, student: 60, azubi: 40, arbeiter: 60, rentner: 40,
});
/** Die Streuung des Logarithmus: 0,8 heißt, ein Sechstel zieht über das 2,2-Fache des Medians. */
const WEGZUG_STREUUNG = 0.8;
/** Näher als 10 km ist kein Wegzug, weiter als 400 fährt keiner zum Training. */
const WEGZUG_KM_MIN = 10;
const WEGZUG_KM_MAX = 400;

/**
 * Die Kilometer zu einem Wegzug.
 * @param {() => number} rng @param {Status} status
 */
export function wegzugKm(rng, status) {
  const km = WEGZUG_MEDIAN_KM[status] * Math.exp(randNormal(rng) * WEGZUG_STREUUNG);
  return clamp(Math.round(km), WEGZUG_KM_MIN, WEGZUG_KM_MAX);
}

/**
 * Der Plan am Ende von Schule, Studium und Ausbildung: Wegzug oder Bleiben.
 * Der Azubi bleibt fast immer — der Betrieb ist vor Ort.
 * @type {Record<string, (readonly ['wegzug'|'bleibt', number])[]>}
 */
const PLAN_JE_ABSCHNITT = {
  schueler: [['wegzug', 45], ['bleibt', 55]],
  student: [['wegzug', 55], ['bleibt', 45]],
  azubi: [['wegzug', 15], ['bleibt', 85]],
};

/**
 * Wie lange ein Abschnitt dauert: frisch begonnen, oder mitten drin (bei der
 * Generierung — da kann einer im ersten wie im letzten Jahr stehen).
 * Der Azubi hat drei Jahre, je zu einem Zehntel verkürzt oder verlängert.
 * @type {Record<string, { frisch: (readonly [number, number])[], drin: [number, number] }>}
 */
const DAUER_JE_ABSCHNITT = {
  student: { frisch: [[3, 1], [4, 1], [5, 1]], drin: [1, 5] },
  azubi: { frisch: [[2, 10], [3, 80], [4, 10]], drin: [1, 3] },
  arbeiter: { frisch: [[2, 1], [3, 1], [4, 1]], drin: [1, 4] },
};

/**
 * Der Arbeiter-Zyklus: was am Ende von zwei bis vier Jahren steht, je
 * Altersband. „Familie" gibt es nur, solange er keine hat. Das Gewicht des
 * Schlusses wird mit der Commitment-Stufe skaliert — sonst hinge, ob ein
 * 28-Jähriger weiterspielt, allein am Alter.
 * @type {(readonly [number, { bleibt: number, familie: number, wegzug: number, schluss: number }])[]}
 */
const ZYKLUS_JE_ALTER = [
  [31, { bleibt: 45, familie: 20, wegzug: 25, schluss: 10 }],
  [37, { bleibt: 40, familie: 15, wegzug: 25, schluss: 20 }],
  [Infinity, { bleibt: 35, familie: 5, wegzug: 15, schluss: 45 }],
];

/**
 * Warum ein Arbeiter aufhört, je Altersband: der Junge aus Lust oder wegen
 * des Berufs, der Alte wegen des Körpers.
 * @type {(readonly [number, (readonly [Grund, number])[]])[]}
 */
const GRUND_JE_ALTER = [
  [29, [['koerper', 10], ['lust', 40], ['beruf', 30], ['familie', 20]]],
  [37, [['koerper', 25], ['lust', 20], ['beruf', 25], ['familie', 30]]],
  [Infinity, [['koerper', 55], ['lust', 10], ['beruf', 10], ['familie', 25]]],
];
/** Der Rentner hört fast nur aus einem Grund auf. @type {(readonly [Grund, number])[]} */
const GRUND_RENTNER = [['koerper', 75], ['familie', 25]];

/**
 * Warum einer aufhört — mit dem Plan gezogen, damit der Satz es sagen kann.
 * @param {() => number} rng
 * @param {number} alter
 * @returns {Grund}
 */
export function ziehGrund(rng, alter) {
  return pickWeighted(rng, nachAlter(GRUND_JE_ALTER, alter));
}

/**
 * Ein Horizont für diesen Status — der Plan, den er erzählt.
 *
 * `frisch` heißt: der Abschnitt beginnt gerade, nach einem Übergang. Sonst
 * steht einer mitten drin, wie bei der Generierung, und die Jahre werden über
 * den ganzen Abschnitt gestreut. `stufe` ist die Commitment-Stufe für das
 * Schluss-Gewicht des Arbeiters; bei der Generierung ist der Wert noch nicht
 * gezogen, und die Mitte (× 1) ist das Ehrlichste.
 * @param {() => number} rng
 * @param {Status} status
 * @param {number} alter
 * @param {number} jahr
 * @param {boolean} familie
 * @param {{ frisch?: boolean, stufe?: number }} [optionen]
 * @returns {Horizont | null}
 */
export function ziehHorizont(rng, status, alter, jahr, familie, { frisch = false, stufe = 2 } = {}) {
  const km = (/** @type {'wegzug'|'bleibt'|'schluss'|'familie'} */ dann) =>
    (dann === 'wegzug' ? wegzugKm(rng, status) : 0);

  if (status === 'schueler') {
    const dann = pickWeighted(rng, PLAN_JE_ABSCHNITT.schueler);
    return { jahr: jahr + ziehAbschlussalter(rng, alter) - alter, dann, km: km(dann) };
  }
  if (status === 'student' || status === 'azubi') {
    const dauer = DAUER_JE_ABSCHNITT[status];
    const jahre = frisch ? pickWeighted(rng, dauer.frisch) : randInt(rng, dauer.drin[0], dauer.drin[1]);
    const dann = pickWeighted(rng, PLAN_JE_ABSCHNITT[status]);
    return { jahr: jahr + jahre, dann, km: km(dann) };
  }
  if (status === 'arbeiter') {
    const dauer = DAUER_JE_ABSCHNITT.arbeiter;
    const jahre = frisch ? pickWeighted(rng, dauer.frisch) : randInt(rng, dauer.drin[0], dauer.drin[1]);
    const band = nachAlter(ZYKLUS_JE_ALTER, alter);
    /** @type {(readonly ['bleibt'|'familie'|'wegzug'|'schluss', number])[]} */
    const gewichte = [
      ['bleibt', band.bleibt + (familie ? band.familie : 0)],
      ['familie', familie ? 0 : band.familie],
      ['wegzug', band.wegzug],
      ['schluss', band.schluss * SCHLUSS_JE_STUFE[stufe]],
    ];
    const dann = pickWeighted(rng, gewichte.filter(([, g]) => g > 0));
    /** @type {Horizont} */
    const h = { jahr: jahr + jahre, dann, km: km(dann) };
    if (dann === 'schluss') h.grund = ziehGrund(rng, alter);
    return h;
  }
  // Rentner: meistens der Schluss in ein bis drei Jahren, sonst nichts Bestimmtes.
  if (rng() < 0.7) {
    return { jahr: jahr + randInt(rng, 1, 3), dann: 'schluss', km: 0, grund: pickWeighted(rng, GRUND_RENTNER) };
  }
  return null;
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
  const horizont = ziehHorizont(rng, status, alter, jahr, familie);

  const jahreBand = pickWeighted(rng, VEREINSJAHRE_BAENDER);
  const vereinsjahre = Math.min(randInt(rng, jahreBand[0], jahreBand[1]),
    Math.max(0, alter - JUGEND_ALTER));

  return { status, entfernung, auto, familie, horizont, seit: jahr - vereinsjahre };
}

// --- Der Wert --------------------------------------------------------------

/**
 * Das Commitment zu einer Lebenslage: Basis, plus der Status, plus die Jahre
 * im Verein, plus Streuung. Entfernung, Auto, Familie und Horizont fehlen mit
 * Absicht — sie sind **Druck**, und Druck steht auf der anderen Seite der
 * Waage (`lebenslauf.js`). Ein hochcommitteter Student geht trotzdem, wenn das
 * Studium endet; das kann nur die Waage aus zwei Seiten abbilden, nicht ein
 * Wert, von dem beides abgezogen wird.
 *
 * Bis Schritt 1 zog die Strecke hier bis zu 22 Punkte ab. Das ist heraus:
 * mit der Waage stünde sie sonst zweimal da, einmal als niedrigerer Halt und
 * einmal als Druck.
 * @param {() => number} rng
 * @param {Lebenslage} lebenslage
 * @param {number} jahr
 */
export function ziehCommitment(rng, lebenslage, jahr) {
  const vereinsjahre = Math.min(jahr - lebenslage.seit, COMMITMENT_VEREINSJAHRE_MAX);

  const wert = COMMITMENT_BASIS
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
