// @ts-check
/**
 * Coaches: wer die Taktik verantwortet und wer die Spieler trainiert.
 *
 * Reine Daten plus Ableitungen. Kein DOM, der Zufall kommt injiziert. Was ein
 * Coach am Spieltag **bewirkt**, steht unten (`schemeBonus()`,
 * `vertrautheitMalus()`), ebenso, wie seine Vertrautheit mit den Systemen
 * wächst (`lerneSystem()`). Was er mit der **Entwicklung** seiner Spieler
 * macht, ist noch ein eigener Umbau. Heute hat jeder Verein zwei
 * Koordinatoren und sonst niemanden.
 *
 * Drei Blöcke trägt jeder Coach, und alle drei werden für jeden gezogen — auch
 * die, die seine Rolle kaum liest. Ein DC hat einen `offensePass`-Wert, ein
 * OC einen für die Safeties; beide sind niedrig, aber sie sind da, weil ein
 * Coach später den Job wechseln kann und die Zahl dann nicht aus dem Nichts
 * kommen soll.
 *
 * Docs: docs/umbau-coaches.md
 */

import {
  ATTRIBUTE, EINHEIT_JE_GRUPPE, GRUPPE_JE_POSITION,
  LIGA_MAX_STAERKE, MAX_RATING, RATING_UNTERGRENZE,
  COACH_BASIS_ANTEIL, COACH_STREUUNG, COACH_ATTRIBUT_STREUUNG,
  COACH_ALTER_MIN, COACH_ALTER_MAX, COACH_SEITENFAKTOR, PERSONNEL_ABSTAND_FAKTOR,
  VERTRAUTHEIT_LERNRATE, VERTRAUTHEIT_NACHBAR_ANTEIL, VERTRAUTHEIT_VERGESSEN_ANTEIL,
  VERTRAUTHEIT_SPIELANTEIL, VERTRAUTHEIT_TAGE_JE_JAHR, VERTRAUTHEIT_SPIELE_JE_SAISON,
  COACH_SCHEME_MITTE, COACH_SCHEME_FAKTOR, VERTRAUTHEIT_MALUS_JE_PUNKT,
  clamp, randInt, randNormal, pick,
} from './constants.js';
import { generierungsProfil, PROFIL_BEITRAG } from './positionen.js';
import { PERSONNEL_REIHE } from './aufstellung.js';
import { ziehName } from './spieler.js';

/**
 * @typedef {object} Coach
 * @property {string} id
 * @property {string} vorname
 * @property {string} nachname
 * @property {number} alter
 * @property {Rolle} rolle
 * @property {string} gruppe            Hauptgruppe aus `COACHING_GRUPPEN`: woher seine
 *   Technik kommt. Beim Positionscoach auch die Gruppe, die er coacht
 * @property {Record<string, number>} soft       die fünf aus `SOFT_SKILLS`
 * @property {Record<string, number>} scheme     die sechs aus `SCHEME_SKILLS`
 * @property {Record<string, number>} personnel  Vertrautheit je Gruppierung, 0..MAX_RATING —
 *   gezogen wird sie ganzzahlig unter dem Ligadeckel, aber sie wächst danach
 *   in Zehnteln und über den Deckel hinaus, siehe `lerneSystem()`
 * @property {Record<string, number>} technik    je Coaching-Gruppe
 */

/** @typedef {'OC'|'DC'|'POS'} Rolle */

// --- Die Gruppen -----------------------------------------------------------
// Docs: docs/umbau-coaches.md, Abschnitt 1

/**
 * Die zehn Gruppen, auf die ein Coach ausgebildet ist. Feiner als die sieben
 * `POSITION_GRUPPEN` des Spielermodells, weil die Coaches dort geschnitten
 * sind, wo im Sport ein eigener Trainer steht: ILB und OLB getrennt, CB und S
 * getrennt, der TE für sich. Und gröber, wo ein Coach beide betreut: der FB
 * gehört zum RB-Coach, der SL zum WR-Coach.
 * @type {Record<string, string[]>}
 */
export const COACHING_GRUPPEN = {
  QB: ['QB'],
  RB: ['RB', 'FB'],
  WR: ['WR', 'SL'],
  TE: ['TE'],
  OL: ['T', 'G', 'C'],
  DL: ['DE', 'DT', 'NT'],
  ILB: ['SAM', 'MIKE'],
  OLB: ['WILL'],
  CB: ['CB'],
  S: ['FS', 'SS'],
};

/** Die Gruppen in Leserichtung: Offense, dann Defense. */
export const COACHING_GRUPPE_REIHE = Object.keys(COACHING_GRUPPEN);

/** @type {Record<string, string>} */
export const COACHING_GRUPPE_JE_POSITION = Object.fromEntries(
  Object.entries(COACHING_GRUPPEN).flatMap(([g, ps]) => ps.map((p) => [p, g])),
);

/**
 * Auf welcher Seite des Balls eine Gruppe steht. Aus der ersten Position
 * abgeleitet — eine Coaching-Gruppe mischt nie Offense und Defense.
 * @param {string} gruppe
 */
export function seiteVon(gruppe) {
  return EINHEIT_JE_GRUPPE[GRUPPE_JE_POSITION[COACHING_GRUPPEN[gruppe][0]]];
}

/**
 * Die Units, in denen die Gruppen für die Ähnlichkeit stehen: 1 ist die Line,
 * 3 die Skill-Positionen, 2 das Dazwischen. Halbe Werte sind Absicht — der TE
 * ist ein halber Lineman, und ein halber Schritt ist genau das.
 *
 * Wer mehr als zwei Units auseinanderliegt, teilt nichts über die Formel hinaus.
 * @type {Record<string, number>}
 */
export const COACHING_UNIT = {
  OL: 1, DL: 1, TE: 1.5, RB: 2, ILB: 2, OLB: 2, QB: 3, WR: 3, CB: 3, S: 3,
};

/** Über wie viele Units die Nähe reicht, und was ein Schritt davon schließt. */
const UNIT_SPANNE = 2;
const UNIT_ANTEIL = 1 / 3;

// --- Ähnlichkeit -----------------------------------------------------------
// Docs: docs/umbau-coaches.md, Abschnitt 3

/**
 * Was die Spieler einer Coaching-Gruppe brauchen: die Ziehungsprofile ihrer
 * Positionen, gewichtet mit `PROFIL_BEITRAG`, **ohne** `technik` und wieder
 * auf 1 normiert.
 *
 * Die Technik fliegt raus, weil sie beim Spieler positionseigen ist — sie
 * steckt in jeder Formel und sagte über die Nähe zweier Gruppen nichts, nur
 * dass beide ein Handwerk haben. Mit ihr drin lag der Boden jeder Ähnlichkeit
 * bei zehn bis fünfzehn Prozent; ohne sie liegt OL neben S bei sechs.
 * @param {string} gruppe
 * @returns {Record<string, number>}
 */
export function gruppenProfil(gruppe) {
  // Die Gewichtsumme kürzt sich beim Normieren weg — Positionsgewicht und
  // Technikabzug laufen durch dieselbe Division.
  /** @type {Record<string, number>} */
  const summe = {};
  for (const position of COACHING_GRUPPEN[gruppe]) {
    const gewicht = PROFIL_BEITRAG[position].pass + PROFIL_BEITRAG[position].lauf;
    const profil = generierungsProfil(position);
    for (const attribut in profil) {
      if (attribut === 'technik') continue;
      summe[attribut] = (summe[attribut] || 0) + profil[attribut] * gewicht;
    }
  }
  let gesamt = 0;
  for (const attribut in summe) gesamt += summe[attribut];
  for (const attribut in summe) summe[attribut] /= gesamt;
  return summe;
}

/**
 * Wie viel zwei Profile gemeinsam haben: die Summe der Minima. 1 ist dasselbe
 * Profil, 0 kein gemeinsames Attribut.
 * @param {Record<string, number>} a
 * @param {Record<string, number>} b
 */
function ueberlappung(a, b) {
  let summe = 0;
  for (const attribut of ATTRIBUTE) summe += Math.min(a[attribut] || 0, b[attribut] || 0);
  return summe;
}

/** @type {Map<string, number>} */
const aehnlichkeitCache = new Map();

/**
 * Was ein Coach der Gruppe `von` über die Gruppe `nach` weiß, als Anteil
 * seines Hauptskills. Symmetrisch, auf der Diagonale 1.
 *
 * Drei Schritte, in dieser Reihenfolge:
 *
 * 1. Die **Überlappung** der Profile — was das Modell über die beiden sagt.
 * 2. Die **Unit-Nähe** schließt einen Teil der Lücke: gleiche Unit zwei
 *    Drittel, eine Unit Abstand ein Drittel, ab zwei nichts mehr. Ohne den
 *    Schritt wären QB und WR bei 38 % — zwei Coaches derselben Skill-Gruppe,
 *    die einander kaum vertreten könnten.
 * 3. Die **Seite** drückt das Ergebnis über den Ball hinweg auf zwei Drittel.
 *
 * Die Reihenfolge ist der Punkt: die Seite steht zuletzt, damit sie auch da
 * gilt, wo die Units einander nah sind (OL–DL liegt bei 56, nicht bei 84).
 * @param {string} von
 * @param {string} nach
 */
export function aehnlichkeit(von, nach) {
  if (von === nach) return 1;
  const schluessel = von < nach ? von + '|' + nach : nach + '|' + von;
  const bekannt = aehnlichkeitCache.get(schluessel);
  if (bekannt !== undefined) return bekannt;

  const x = ueberlappung(gruppenProfil(von), gruppenProfil(nach));
  const naehe = Math.max(0, UNIT_SPANNE - Math.abs(COACHING_UNIT[von] - COACHING_UNIT[nach]));
  const seite = seiteVon(von) === seiteVon(nach) ? 1 : COACH_SEITENFAKTOR;
  const wert = (x + (1 - x) * naehe * UNIT_ANTEIL) * seite;
  aehnlichkeitCache.set(schluessel, wert);
  return wert;
}

/**
 * Wo eine Coaching-Gruppe ihren Wert verdient: der Passanteil ihrer
 * Positionen nach `PROFIL_BEITRAG`. Ein CB-Coach ist zu 78 % ein Passcoach,
 * ein RB-Coach zu 29 %.
 * @param {string} gruppe
 */
export function gruppenPassAnteil(gruppe) {
  let pass = 0;
  let lauf = 0;
  for (const position of COACHING_GRUPPEN[gruppe]) {
    pass += PROFIL_BEITRAG[position].pass;
    lauf += PROFIL_BEITRAG[position].lauf;
  }
  return pass / (pass + lauf);
}

// --- Die Blöcke ------------------------------------------------------------
// Docs: docs/umbau-coaches.md, Abschnitt 2

/**
 * Die fünf Soft Skills, alle gleich schwer. Keiner hat heute einen eigenen
 * Zweck — sie zahlen in die Stärke ein, und wo später etwas an einem Coach
 * hängt (Entwicklung, Spieltag), rechnen alle fünf mit.
 */
export const SOFT_SKILLS = /** @type {const} */ ([
  'kommunikation', 'empathie', 'fuehrung', 'motivation', 'konfliktloesung',
]);

/**
 * Die sechs Scheme-Werte und die Seite, zu der sie gehören. Die Special Teams
 * haben keine — sie zählen für jeden Coach als fremde Seite, bis es einen
 * Special Teams Coordinator gibt.
 * @type {Record<string, 'offense'|'defense'|null>}
 */
export const SCHEME_SEITE = {
  offenseLauf: 'offense',
  offensePass: 'offense',
  defenseLauf: 'defense',
  defensePass: 'defense',
  kicks: null,
  returns: null,
};

export const SCHEME_SKILLS = Object.keys(SCHEME_SEITE);

/**
 * Die drei Blöcke im Stärkewert, je Rolle. Soft ist für alle gleich wichtig;
 * Scheme trägt den Koordinator, Technik den Positionscoach — aber keiner der
 * beiden Blöcke ist für die andere Rolle null.
 */
export const STAERKE_GEWICHT = {
  koordinator: { soft: 0.30, scheme: 0.45, technik: 0.25 },
  position: { soft: 0.30, scheme: 0.15, technik: 0.55 },
};

/** Was im Scheme-Block des OC steckt. Personnel ist die Vertrautheit, siehe `personnelWert()`. */
export const OC_SCHEME = { offenseLauf: 0.35, offensePass: 0.35, personnel: 0.30 };
/** Und im Scheme-Block des DC — bis es Defense-Schemes gibt. */
export const DC_SCHEME = { defenseLauf: 0.5, defensePass: 0.5 };

/**
 * Welche Technik ein Koordinator braucht: drei Drittel, innen gemittelt. Beim
 * OC ist das die Line, das Passspiel und das Laufspiel; beim DC die drei
 * Reihen der Defense.
 * @type {Record<'OC'|'DC', string[][]>}
 */
export const KOORDINATOR_TECHNIK = {
  OC: [['OL'], ['QB', 'WR'], ['RB', 'TE']],
  DC: [['DL'], ['ILB', 'OLB'], ['CB', 'S']],
};

// --- Der Stärkewert --------------------------------------------------------
// Docs: docs/umbau-coaches.md, Abschnitt 4

/**
 * Was ein Coach in einer Rolle wert ist. Abgeleitet, nie gespeichert — wie
 * `hauptPlatz()` beim Spieler: derselbe Mann ist als OC eine andere Zahl als
 * als Positionscoach, und die Lücke sagt „falscher Job", ohne dass eine Regel
 * es sagen müsste.
 * @param {Coach} coach
 * @param {Rolle} [rolle] standardmäßig seine eigene
 */
export function staerke(coach, rolle = coach.rolle) {
  const g = rolle === 'POS' ? STAERKE_GEWICHT.position : STAERKE_GEWICHT.koordinator;
  return g.soft * softWert(coach)
    + g.scheme * schemeWert(coach, rolle)
    + g.technik * technikWert(coach, rolle);
}

/** @param {Coach} coach */
export function softWert(coach) {
  return mittel(SOFT_SKILLS.map((s) => coach.soft[s]));
}

/**
 * @param {Coach} coach
 * @param {Rolle} rolle
 */
export function schemeWert(coach, rolle) {
  const s = coach.scheme;
  if (rolle === 'OC') {
    return OC_SCHEME.offenseLauf * s.offenseLauf
      + OC_SCHEME.offensePass * s.offensePass
      + OC_SCHEME.personnel * personnelWert(coach);
  }
  if (rolle === 'DC') {
    return DC_SCHEME.defenseLauf * s.defenseLauf + DC_SCHEME.defensePass * s.defensePass;
  }
  // Der Positionscoach wird an den beiden Schemewerten seiner Seite gemessen,
  // gewichtet danach, wo seine Gruppe ihren Wert verdient — nicht hälftig.
  const seite = seiteVon(coach.gruppe);
  const passAnteil = gruppenPassAnteil(coach.gruppe);
  return passAnteil * s[seite + 'Pass'] + (1 - passAnteil) * s[seite + 'Lauf'];
}

/**
 * Die Vertrautheit als eine Zahl: halb das Heimatsystem, halb der Schnitt der
 * übrigen sieben. Der reine Schnitt bestrafte den Spezialisten, das reine
 * Maximum übersähe, dass er außerhalb seines Systems nichts kann.
 * @param {Coach} coach
 */
export function personnelWert(coach) {
  const werte = PERSONNEL_REIHE.map((id) => coach.personnel[id] || 0);
  const bestes = Math.max(...werte);
  const rest = werte.slice();
  rest.splice(werte.indexOf(bestes), 1);
  return 0.5 * bestes + 0.5 * mittel(rest);
}

/**
 * @param {Coach} coach
 * @param {Rolle} rolle
 */
export function technikWert(coach, rolle) {
  if (rolle === 'POS') return coach.technik[coach.gruppe];
  return mittel(KOORDINATOR_TECHNIK[rolle].map(
    (drittel) => mittel(drittel.map((g) => coach.technik[g])),
  ));
}

/** @param {number[]} werte */
function mittel(werte) {
  let summe = 0;
  for (const w of werte) summe += w;
  return summe / werte.length;
}

// --- Die Ziehung -----------------------------------------------------------
// Docs: docs/umbau-coaches.md, Abschnitt 5

/**
 * Ein Coach mit einer Stärke um die halbe Vereinsbasis.
 *
 * Kein Rollenprofil wie beim Spieler, sondern ein **Niveau**, von dem alles
 * abgeleitet wird: jeder Wert liegt auf dem Niveau plus Rauschen, und was er
 * nicht ist, kommt als Faktor darauf — die fremde Seite mit
 * `COACH_SEITENFAKTOR`, die Nebengruppen mit `aehnlichkeit()`, die fernen
 * Gruppierungen mit `PERSONNEL_ABSTAND_FAKTOR`. Zum Schluss wird der ganze
 * Satz skaliert, bis `staerke()` in seiner Rolle die Zielzahl liest.
 *
 * Die Nebengruppen und die fremden Gruppierungen bekommen **kein eigenes
 * Rauschen**: einmal der Kopfwert mit Streuung, und der Fächer daraus folgt
 * der Regel. Mit eigenem Rauschen überholte das Nachbarsystem das Heimat-
 * system in jedem zehnten Fall — und ein OC, dessen bestes System nicht das
 * seines Vereins ist, sagt etwas, das nicht gemeint war.
 * @param {() => number} rng
 * @param {string} id
 * @param {Rolle} rolle
 * @param {string} gruppe Hauptgruppe aus `COACHING_GRUPPEN`
 * @param {number} basis Vereinsbasis, 0..100
 * @param {{ personnel?: string, belegteNamen?: Set<string> }} [optionen]
 * @returns {Coach}
 */
export function macheCoach(rng, id, rolle, gruppe, basis, optionen) {
  const { vorname, nachname } = ziehName(rng, optionen && optionen.belegteNamen);
  const alter = randInt(rng, COACH_ALTER_MIN, COACH_ALTER_MAX);
  const ziel = clamp(
    Math.round(basis * COACH_BASIS_ANTEIL + randNormal(rng) * COACH_STREUUNG),
    RATING_UNTERGRENZE, LIGA_MAX_STAERKE,
  );
  const niveau = () => ziel + randNormal(rng) * COACH_ATTRIBUT_STREUUNG;
  const seite = seiteVon(gruppe);
  const heimat = (optionen && optionen.personnel) || pick(rng, PERSONNEL_REIHE);

  /** @type {Coach} */
  const coach = {
    id, vorname, nachname, alter, rolle, gruppe,
    soft: {}, scheme: {}, personnel: {}, technik: {},
  };
  for (const s of SOFT_SKILLS) coach.soft[s] = niveau();
  for (const s of SCHEME_SKILLS) {
    coach.scheme[s] = niveau() * (SCHEME_SEITE[s] === seite ? 1 : COACH_SEITENFAKTOR);
  }
  const heimatIndex = PERSONNEL_REIHE.indexOf(/** @type {any} */ (heimat));
  const vertraut = niveau();
  PERSONNEL_REIHE.forEach((p, i) => {
    coach.personnel[p] = vertraut * Math.pow(PERSONNEL_ABSTAND_FAKTOR, Math.abs(i - heimatIndex));
  });
  const handwerk = niveau();
  for (const g of COACHING_GRUPPE_REIHE) coach.technik[g] = handwerk * aehnlichkeit(gruppe, g);

  skaliereAufStaerke(coach, ziel);
  for (const block of [coach.soft, coach.scheme, coach.personnel, coach.technik]) {
    for (const k in block) block[k] = Math.round(block[k]);
  }
  return coach;
}

/**
 * Alle Werte so strecken, dass `staerke()` das Ziel liest. Die Stärke ist in
 * jedem Wert linear, also reicht ein Faktor — die zweite Runde fängt nur, was
 * am Deckel abgeschnitten wurde.
 * @param {Coach} coach
 * @param {number} ziel
 */
function skaliereAufStaerke(coach, ziel) {
  for (let runde = 0; runde < 3; runde++) {
    const ist = staerke(coach);
    if (ist <= 0 || Math.abs(ist - ziel) < 0.05) break;
    const faktor = ziel / ist;
    for (const block of [coach.soft, coach.scheme, coach.personnel, coach.technik]) {
      for (const k in block) block[k] = clamp(block[k] * faktor, RATING_UNTERGRENZE, LIGA_MAX_STAERKE);
    }
  }
}

/**
 * Der Stab, mit dem ein Verein anfängt: ein OC und ein DC, sonst niemand.
 *
 * Beide waren einmal Positionscoach — ihre Hauptgruppe wird auf ihrer Seite
 * gelost, und daraus fächert die Technik. Ein OC aus der Line spielt sich
 * anders als einer vom Quarterback. Das Heimatsystem des OC ist das, was der
 * Verein spielt: er hat es ja eingeführt.
 * @param {() => number} rng
 * @param {string} teamId
 * @param {number} basis
 * @param {string} personnel Die Gruppierung des Vereins
 * @param {Set<string>} [belegteNamen]
 * @returns {Coach[]}
 */
export function ziehStab(rng, teamId, basis, personnel, belegteNamen) {
  const offense = COACHING_GRUPPE_REIHE.filter((g) => seiteVon(g) === 'offense');
  const defense = COACHING_GRUPPE_REIHE.filter((g) => seiteVon(g) === 'defense');
  return [
    macheCoach(rng, `c-${teamId}-oc`, 'OC', pick(rng, offense), basis, { personnel, belegteNamen }),
    macheCoach(rng, `c-${teamId}-dc`, 'DC', pick(rng, defense), basis, { belegteNamen }),
  ];
}

// --- Die Vertrautheit wächst ------------------------------------------------
// Docs: docs/umbau-coaches.md, Abschnitt 7

/** @param {string} personnel */
function reiheIndex(personnel) {
  const i = PERSONNEL_REIHE.indexOf(/** @type {any} */ (personnel));
  if (i < 0) throw new Error(`Unbekannte Gruppierung ${personnel}`);
  return i;
}

/**
 * Ein Tick Erfahrung im System `personnel`, mit dem Anteil `anteil` eines
 * ganzen Jahres darin.
 *
 * Drei Bewegungen, in dieser Reihenfolge:
 *
 * 1. Das gespielte System gewinnt `anteil · LERNRATE · (DACH − V) / DACH` —
 *    eine Lernkurve, die am Dach von selbst flach wird und es nie überschreitet.
 * 2. Die beiden Nachbarn auf `PERSONNEL_REIHE` bekommen einen Anteil dieses
 *    Gewinns, ebenfalls mit ihrem eigenen Abstand zum Dach gestaucht.
 * 3. Die fernen Systeme (Abstand ≥ 2) verlieren zusammen einen Anteil dessen,
 *    was in 1 und 2 gelernt wurde, verteilt im Verhältnis ihrer Werte — so
 *    fällt keiner unter null, und die Summe der acht steigt in jedem Tick.
 *
 * Verworfen: das Vergessen als Prozentsatz der fernen Werte. Bei einem Coach,
 * der viel wechselt und überall um die 60 steht, überholte der Verlust
 * irgendwann den schrumpfenden Gewinn, und die Summe fiel. Ans Gelernte
 * gekoppelt ist das ausgeschlossen. Ebenfalls verworfen: ein Deckel für die
 * Nachbarn („höchstens 40 % des gespielten Systems") — eine Konstante mehr und
 * ein Knick, wo die Kopplung an den Gewinn es von selbst richtig macht.
 *
 * Als Tick gerechnet und nicht je Saison, damit niemand Buch führen muss,
 * welches System ein Verein in welcher Woche gespielt hat: der Kalender ruft
 * `lerneTag()`, jede Partie `lerneSpiel()`, und ein Wechsel mitten in der
 * Saison rechnet sich von allein anteilig.
 * @param {Coach} coach
 * @param {string} personnel Die gespielte Gruppierung
 * @param {number} anteil Anteil eines Jahres, den dieser Tick wert ist
 */
export function lerneSystem(coach, personnel, anteil) {
  const p = reiheIndex(personnel);
  const v = coach.personnel;
  const luft = (/** @type {string} */ id) => (MAX_RATING - (v[id] || 0)) / MAX_RATING;

  const gewinn = anteil * VERTRAUTHEIT_LERNRATE * luft(personnel);
  /** @type {Record<string, number>} */
  const delta = { [personnel]: gewinn };
  for (const n of [p - 1, p + 1]) {
    if (n < 0 || n >= PERSONNEL_REIHE.length) continue;
    const id = PERSONNEL_REIHE[n];
    delta[id] = VERTRAUTHEIT_NACHBAR_ANTEIL * gewinn * luft(id);
  }
  let gelernt = 0;
  for (const id in delta) gelernt += delta[id];

  const fern = PERSONNEL_REIHE.filter((_, i) => Math.abs(i - p) >= 2);
  let fernSumme = 0;
  for (const id of fern) fernSumme += v[id] || 0;
  const vergessen = Math.min(VERTRAUTHEIT_VERGESSEN_ANTEIL * gelernt, fernSumme);
  if (fernSumme > 0) {
    for (const id of fern) delta[id] = -vergessen * (v[id] || 0) / fernSumme;
  }

  for (const id in delta) v[id] = clamp((v[id] || 0) + delta[id], 0, MAX_RATING);
}

/**
 * Ein Kalendertag im System des Vereins: die Zeithälfte, auf das Jahr verteilt.
 * @param {Coach} coach @param {string} personnel
 */
export function lerneTag(coach, personnel) {
  lerneSystem(coach, personnel, (1 - VERTRAUTHEIT_SPIELANTEIL) / VERTRAUTHEIT_TAGE_JE_JAHR);
}

/**
 * Eine gespielte Partie in diesem System: die Spielhälfte, auf die Saison verteilt.
 * @param {Coach} coach @param {string} personnel
 */
export function lerneSpiel(coach, personnel) {
  lerneSystem(coach, personnel, VERTRAUTHEIT_SPIELANTEIL / VERTRAUTHEIT_SPIELE_JE_SAISON);
}

/**
 * Wer im Stab die Offense verantwortet, oder null. Nur er lernt ein System —
 * die Defense kennt kein Personnel.
 * @param {Coach[] | undefined} stab
 */
export function ocVon(stab) {
  return (stab && stab.find((c) => c.rolle === 'OC')) || null;
}

/** Und die Defense. @param {Coach[] | undefined} stab */
export function dcVon(stab) {
  return (stab && stab.find((c) => c.rolle === 'DC')) || null;
}

// --- Die Wirkung am Spieltag ------------------------------------------------
// Docs: docs/umbau-coaches.md, Abschnitt 8

/**
 * Was ein Koordinator seiner Einheit bringt: die beiden Scheme-Werte seiner
 * Seite, nach dem Passanteil des **angreifenden** Vereins gemischt, um die
 * Mitte zentriert und in Stärkepunkte übersetzt. Über der Mitte hilft er,
 * darunter schadet er.
 *
 * Gemischt wird nach dem Passanteil des Angriffs auch für den DC: gegen einen
 * Verein, der wirft, zählt seine Passverteidigung — nicht, was er selbst
 * lieber verteidigt.
 * @param {Coach} coach
 * @param {'offense'|'defense'} seite
 * @param {number} passAnteil des angreifenden Vereins
 */
export function schemeBonus(coach, seite, passAnteil) {
  const pass = coach.scheme[seite + 'Pass'] - COACH_SCHEME_MITTE;
  const lauf = coach.scheme[seite + 'Lauf'] - COACH_SCHEME_MITTE;
  return (pass * passAnteil + lauf * (1 - passAnteil)) * COACH_SCHEME_FAKTOR;
}

/**
 * Was fehlende Vertrautheit mit dem gespielten System kostet, als positive
 * Zahl in Stärkepunkten. Null erst bei `MAX_RATING` — also nie ganz für einen
 * Coach, der noch lernt, und das ist gemeint.
 * @param {Coach} coach
 * @param {string} personnel Die gespielte Gruppierung
 */
export function vertrautheitMalus(coach, personnel) {
  const v = coach.personnel[personnel] || 0;
  return (MAX_RATING - v) * VERTRAUTHEIT_MALUS_JE_PUNKT;
}
