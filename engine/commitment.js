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
  WAHRHEIT_CHANCE, WAHRHEIT_ARTEN, WAHRHEIT_VERSCHIEBUNG, WISSBAR_ANTEIL,
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
 * das Studium dauert fünf Jahre statt vier — steht in `horizontWahrheit`, und
 * der einzige Weg dorthin ist das Gespräch.
 * @typedef {object} Lebenslage
 * @property {Status} status
 * @property {number} entfernung   km bis zum Training — zum eigenen Verein, siehe offene Entscheidung 10
 * @property {boolean} auto        ob er selbst fahren kann
 * @property {boolean} familie     die eigene — beim Arbeiter legt sie sich auf die Strecke
 * @property {Horizont | null} horizont  was als Nächstes ansteht — null: nichts Bestimmtes
 * @property {Horizont | null} [horizontWahrheit]  was **wirklich** kommt, wenn es vom Plan
 *   abweicht. null oder fehlend: der Plan hält. Gerechnet wird mit `echterHorizont()`,
 *   angezeigt wird `horizont` — das ist der ganze Trick. Siehe `auskunft.js`
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
 * @property {number} [wissbarAb]  nur auf `horizontWahrheit`: das Jahr, ab dem er es selbst
 *   weiß und im Gespräch damit herausrückt. Davor bestätigt er den Plan — und lügt dabei
 *   nicht, er hat sich schlicht noch nicht entschieden
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
 *
 * Der Azubi klingt nach 21 ab. Bis zum Herbst 2026 stand er von 20 bis 25 mit
 * flachen 25 % in einem einzigen Band — in jedem dieser Jahrgänge jeder
 * Vierte, obwohl eine Ausbildung mit 15 bis 19 beginnt und drei Jahre dauert.
 * Der Lebenslauf selbst baut sie richtig ab (nach acht Saisons sind es unter
 * den 22- bis 25-Jährigen 2–4 %), nur der Startkader und jeder Rookie kamen
 * aus dieser Tabelle. Was dem Azubi genommen ist, geht an den Arbeiter: wer
 * mit 24 keine Ausbildung mehr macht, hat meist eine hinter sich.
 * @type {[number, (readonly [Status, number])[]][]}
 */
const STATUS_JE_ALTER = [
  [19, [['schueler', 60], ['azubi', 40]]],
  [21, [['student', 50], ['azubi', 30], ['arbeiter', 20]]],
  [23, [['student', 50], ['azubi', 12], ['arbeiter', 38]]],
  [25, [['student', 45], ['azubi', 5], ['arbeiter', 50]]],
  [30, [['student', 15], ['arbeiter', 85]]],
  [63, [['arbeiter', 100]]],
  [Infinity, [['rentner', 100]]],
];

/**
 * Wie weit einer fährt, je Status: Bänder, die meisten wohnen in der Nähe.
 * Bis 5 km heißt der Satz „wohnt um die Ecke" — das ist die Stadt selbst.
 *
 * Bis zum Herbst 2026 galt ein Band für alle, und darin war „nah" 1–15 km am
 * Stück. Damit fuhr der Schüler so weit wie der Arbeiter, und ein Student lag
 * so oft 30 km draußen wie ein Familienvater im Nachbarlandkreis. Jetzt hängt
 * es daran, woran einer gebunden ist: der Schüler an Eltern und Schule — er
 * fährt fast nie weit, und ohne Auto hielte er es auch nicht aus —, der Azubi
 * an den Betrieb vor Ort, der Arbeiter und der Rentner an nichts Bestimmtes.
 * Der Zehntel von weit her, um den es in Block 7 geht, bleibt beim Arbeiter.
 *
 * Der Student steht hier nur mit dem Teil, der **nicht** in der Uni-Stadt
 * wohnt; siehe `ziehEntfernung()`.
 * @type {Record<Status, (readonly [[number, number], number])[]>}
 */
const ENTFERNUNG_JE_STATUS = {
  schueler: [[[1, 5], 45], [[6, 15], 40], [[16, 35], 15]],
  student: [[[1, 5], 60], [[6, 15], 25], [[16, 40], 15]],
  azubi: [[[1, 5], 40], [[6, 15], 35], [[16, 50], 20], [[51, 90], 5]],
  arbeiter: [[[1, 5], 30], [[6, 15], 30], [[16, 50], 30], [[51, 120], 10]],
  rentner: [[[1, 5], 40], [[6, 15], 35], [[16, 50], 20], [[51, 120], 5]],
};

/**
 * Wie viele Studenten eines Vereins ohne eigene Hochschule in der nächsten
 * Uni-Stadt wohnen. Der Rest wohnt im Ort — oder noch bei den Eltern — und
 * pendelt zur Vorlesung statt zum Training.
 *
 * Verworfen: den Studenten einfach wie alle anderen zu ziehen. Dann wohnte
 * einer, der 250 km weit zum Studieren gekommen ist, in einem Dorf 19 km
 * draußen, in dem es keine Hochschule gibt — er ist aber wegen der Hochschule
 * da, und dort wohnt er auch.
 */
const STUDENT_IN_UNISTADT = 0.5;
/** Wie weit die Wohnung um die Uni-Stadt streut, als Anteil der Strecke dorthin. */
const UNISTADT_STREUUNG = 0.2;

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

/**
 * Die Kilometer bis zum Training, beim Eintritt.
 *
 * Nur beim Studenten spielt der Ort des Vereins hinein: hat die Stadt keine
 * Hochschule, wohnt die Hälfte dort, wo sie ist. Hat sie eine, ist die
 * Uni-Stadt der Ort selbst, und die Zeile in `ENTFERNUNG_JE_STATUS` gilt für
 * alle.
 * @param {() => number} rng
 * @param {Status} status
 * @param {number} uniKm  siehe `TeamDef.uniKm` in `content.js`
 */
export function ziehEntfernung(rng, status, uniKm) {
  if (status === 'student' && uniKm > 0 && rng() < STUDENT_IN_UNISTADT) {
    const streuung = 1 + (rng() * 2 - 1) * UNISTADT_STREUUNG;
    return Math.max(1, Math.round(uniKm * streuung));
  }
  const band = pickWeighted(rng, ENTFERNUNG_JE_STATUS[status]);
  return randInt(rng, band[0], band[1]);
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
 * Spätestens mit diesem Alter ist jeder aus der Schule, auch der Gymnasiast
 * mit Ehrenrunde. Ein Schüler steht also höchstens mit 19 im Kader.
 *
 * Die Grenze gilt vor allem für die zweite Wahrheit: bis zum Herbst 2026
 * schob `ziehWahrheit()` den Abschluss um bis zu zwei Jahre, ohne auf das
 * Alter zu sehen, und so erzählte jeder neunte Schüler nach dem Gespräch von
 * einem Abitur mit 21 — ein 18-Jähriger mit „noch 3 Jahre Schule".
 */
export const SCHULE_SPAETESTENS = 20;

/**
 * Das Alter, mit dem ein Studium, das bei der Ziehung **schon läuft**, nach
 * seinem Plan zu Ende ist — auch mit Master und einem Umweg. Wer älter ist,
 * steht deshalb näher am Ende als am Anfang.
 *
 * Bis zum Herbst 2026 bekam ein 27-Jähriger dieselben ein bis fünf Restjahre
 * wie ein Erstsemester, und jeder achte Student war zugleich fünf Jahre im
 * Verein und noch vier Jahre an der Uni. Die zweite Wahrheit darf über diese
 * Grenze hinaus schieben — dass sich ein Studium zieht, ist genau die Art
 * Überraschung, für die sie da ist. Ein frisch begonnenes Studium (nach der
 * Schule, der Master) ist nicht gedeckelt; seine Dauer kommt aus
 * `DAUER_JE_ABSCHNITT.frisch` und dem Alter beim Übergang.
 */
const STUDIUM_SPAETESTENS = 29;

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
 * Womit das Wegzug-Gewicht eines Arbeiters multipliziert wird, der schon eine
 * Familie hat — im Zyklus wie in der zweiten Wahrheit. Was abgeht, geht an
 * „bleibt".
 *
 * Bis zum Herbst 2026 zog der Familienvater so oft weg wie der Ledige, und
 * jeder vierte von ihnen „plante den Wegzug in vier Jahren". Mit Haus, Kita und
 * dem Job der Partnerin zieht man seltener, und wenn, dann nicht nach Plan.
 * Die Waage merkt davon nichts: die Familie legt sich dort weiter auf die
 * Strecke (`DRUCK_FAKTOR_FAMILIE`) — wer schon weit fährt, geht trotzdem.
 */
const WEGZUG_MIT_FAMILIE = 0.4;

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
    const bis = status === 'student'
      ? Math.max(dauer.drin[0], Math.min(dauer.drin[1], STUDIUM_SPAETESTENS - alter))
      : dauer.drin[1];
    const jahre = frisch ? pickWeighted(rng, dauer.frisch) : randInt(rng, dauer.drin[0], bis);
    const dann = pickWeighted(rng, PLAN_JE_ABSCHNITT[status]);
    return { jahr: jahr + jahre, dann, km: km(dann) };
  }
  if (status === 'arbeiter') {
    const dauer = DAUER_JE_ABSCHNITT.arbeiter;
    const jahre = frisch ? pickWeighted(rng, dauer.frisch) : randInt(rng, dauer.drin[0], dauer.drin[1]);
    const band = nachAlter(ZYKLUS_JE_ALTER, alter);
    const wegzug = band.wegzug * (familie ? WEGZUG_MIT_FAMILIE : 1);
    /** @type {(readonly ['bleibt'|'familie'|'wegzug'|'schluss', number])[]} */
    const gewichte = [
      ['bleibt', band.bleibt + (familie ? band.familie + band.wegzug - wegzug : 0)],
      ['familie', familie ? 0 : band.familie],
      ['wegzug', wegzug],
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

// --- Die zweite Wahrheit ---------------------------------------------------

/**
 * Was statt des Plans in Frage kommt, wenn es anders kommt als angekündigt.
 *
 * Für Schüler, Student und Azubi genau das jeweils andere: am Ende eines
 * Abschnitts steht Wegzug oder Bleiben, ein Drittes gibt es dort nicht.
 * `amHorizont()` würde einen „Schluss" nach der Schule auch gar nicht
 * ausführen — es wechselt dort immer den Status —, und eine Wahrheit, die
 * niemand einlösen kann, wäre eine Lüge der Engine an sich selbst.
 * @param {Status} status
 * @param {'wegzug'|'bleibt'|'schluss'|'familie'} plan
 * @param {boolean} familie
 * @returns {(readonly ['wegzug'|'bleibt'|'schluss'|'familie', number])[]}
 */
function ausgangsAlternativen(status, plan, familie) {
  if (status === 'schueler' || status === 'student' || status === 'azubi') {
    return plan === 'wegzug' ? [['bleibt', 1]] : [['wegzug', 1]];
  }
  /** @type {(readonly ['wegzug'|'bleibt'|'schluss'|'familie', number])[]} */
  const alle = [['bleibt', 35], ['wegzug', 30 * (familie ? WEGZUG_MIT_FAMILIE : 1)],
    ['schluss', 25], ['familie', 10]];
  return alle.filter(([d]) => d !== plan
    && !(d === 'familie' && (familie || status === 'rentner')));
}

/**
 * Die zweite Wahrheit neben dem Plan — oder null, wenn der Plan hält.
 *
 * Gezogen wird sie aus dem Plan heraus, nicht frei daneben: eine unabhängige
 * zweite Ziehung stünde irgendwo, und der Spieler hätte nicht einen Plan, der
 * sich als falsch herausstellt, sondern zwei beliebige Zukünfte. Abgewichen
 * wird deshalb in **einer** Größe — im Zeitpunkt oder im Ausgang.
 *
 * `wissbarAb` rechnet über die Strecke bis zum **ursprünglich geplanten**
 * Ereignis, nicht bis zum wahren: der Spieler hängt an seinem eigenen Plan und
 * merkt am Weg dorthin, dass er nicht aufgeht. Der Deckel auf `w.jahr` hält
 * den Fall ab, in dem die Wahrheit früher eintritt, als sie zu erfahren wäre —
 * dann fällt die Enthüllung eben mit dem Ereignis zusammen, und der Manager
 * erfährt es zu spät. Das kommt vor und bleibt so: ein Gespräch, das immer
 * rechtzeitig kommt, wäre ein Orakel.
 * @param {() => number} rng
 * @param {Horizont | null} plan
 * @param {Status} status
 * @param {number} alter
 * @param {number} jahr
 * @param {boolean} familie
 * @returns {Horizont | null}
 */
export function ziehWahrheit(rng, plan, status, alter, jahr, familie) {
  if (!plan || rng() >= WAHRHEIT_CHANCE) return null;

  /** @type {Horizont} */
  const w = { jahr: plan.jahr, dann: plan.dann, km: plan.km };
  if (plan.grund) w.grund = plan.grund;

  if (pickWeighted(rng, WAHRHEIT_ARTEN) === 'dauer') {
    // Nur Verschiebungen, die in der Zukunft landen — eine Wahrheit, deren
    // Jahr schon vorbei ist, wird nie geprüft und wäre still verloren. Und
    // beim Schüler keine, die ihn über `SCHULE_SPAETESTENS` hinaus in der
    // Schule hält: das Jahr seines Horizonts **ist** sein Abschlussalter.
    const moeglich = WAHRHEIT_VERSCHIEBUNG.filter(([v]) => plan.jahr + v > jahr
      && (status !== 'schueler' || alter + plan.jahr + v - jahr <= SCHULE_SPAETESTENS));
    if (moeglich.length === 0) return null;
    w.jahr = plan.jahr + pickWeighted(rng, moeglich);
  } else {
    const alternativen = ausgangsAlternativen(status, plan.dann, familie);
    if (alternativen.length === 0) return null;
    const dann = pickWeighted(rng, alternativen);
    w.dann = dann;
    w.km = dann === 'wegzug' ? wegzugKm(rng, status) : 0;
    if (dann === 'schluss') w.grund = ziehGrund(rng, alter);
    else delete w.grund;
  }

  const strecke = Math.max(0, plan.jahr - jahr);
  const anteil = WISSBAR_ANTEIL[0] + rng() * (WISSBAR_ANTEIL[1] - WISSBAR_ANTEIL[0]);
  w.wissbarAb = Math.min(w.jahr, jahr + Math.round(anteil * strecke));
  return w;
}

/**
 * Womit die Engine rechnet: die Wahrheit, wenn eine gezogen ist, sonst der
 * Plan. Was der Manager **liest**, ist immer `l.horizont` — das ist die
 * Trennung, auf der die ganze Kategorie steht, und sie hält nur, solange
 * niemand in `lebenslauf.js` versehentlich den Plan nimmt.
 * @param {Lebenslage} l
 * @returns {Horizont | null}
 */
export function echterHorizont(l) {
  return l.horizontWahrheit || l.horizont;
}

/**
 * Eine Lebenslage für einen Menschen dieses Alters, im Jahr `jahr`.
 *
 * Das Alter bestimmt den Status, der Status fast alles Weitere. Die
 * Reihenfolge der Ziehungen ist fest — wer sie ändert, ändert jede
 * Lebenslage jedes gespeicherten Standes, denn die werden aus dem Saatgut
 * nachgezogen.
 *
 * Genau deshalb fehlt hier die zweite Wahrheit: sie hängt `ziehBindung()`
 * **hinter** dem Commitment an, als letzter Wurf überhaupt. Mitten hinein
 * gesetzt hätte sie jeden Wurf danach verschoben und damit jeden Menschen in
 * jedem Stand, der seine Bindung erst noch nachzieht, zu einem anderen
 * gemacht. Wer `ziehLebenslage()` direkt ruft, bekommt deshalb eine Lage ohne
 * Wahrheit — im Spiel führt kein Weg daran vorbei.
 * @param {() => number} rng
 * @param {number} alter
 * @param {number} jahr
 * @param {number} [uniKm]  wie weit der Verein von der nächsten Hochschule liegt; ohne
 *   Angabe hat er eine im Ort
 * @returns {Lebenslage}
 */
export function ziehLebenslage(rng, alter, jahr, uniKm = 0) {
  const status = pickWeighted(rng, nachAlter(STATUS_JE_ALTER, alter));
  const entfernung = ziehEntfernung(rng, status, uniKm);
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
 * @param {number} [uniKm]  siehe `ziehLebenslage()`
 * @returns {{ commitment: number, lebenslage: Lebenslage }}
 */
export function ziehBindung(rng, alter, jahr, uniKm = 0) {
  const lebenslage = ziehLebenslage(rng, alter, jahr, uniKm);
  const commitment = ziehCommitment(rng, lebenslage, jahr);
  lebenslage.horizontWahrheit = ziehWahrheit(
    rng, lebenslage.horizont, lebenslage.status, alter, jahr, lebenslage.familie);
  return { commitment, lebenslage };
}
