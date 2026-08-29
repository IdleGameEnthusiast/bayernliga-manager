// @ts-check
/**
 * Players: generation, ratings, ageing, injuries.
 * Pure — data in, data out. No DOM.
 */

import {
  MAX_RATING, LIGA_MAX_STAERKE, RATING_UNTERGRENZE, TALENT_STREUUNG,
  MIN_AGE, MAX_AGE, PEAK_AGE, RUECKTRITT_ALTER,
  VETERAN_MIN, VETERAN_MAX, VETERAN_ANTEIL_JUNG, VETERAN_JUNG, VETERAN_ALT,
  VETERAN_RUECKTRITT_MAX, VETERAN_POSITIONEN,
  KADER_FORM, ZUSATZ_GEWICHTE, ZUSATZ_MAX_JE_POSITION,
  KICK_BASIS, KICK_STREUUNG, KICK_FUSS_ANTEIL, KICK_FUSS_BASIS,
  KICK_FUSS_STREUUNG, KICK_FUSS_AUSSCHLUSS,
  ATTRIBUTE, PROFIL_SPEZIALISIERUNG, ATTRIBUT_STREUUNG,
  KOERPER_ANTEIL_DANEBEN, KOERPER_DANEBEN_MIN, KOERPER_DANEBEN_MAX,
  KOERPER_MITTE, KOERPER_SPANNE, KOERPER_KOPPLUNG,
  GROESSE_MIN, GROESSE_MAX, GEWICHT_MIN, GEWICHT_MAX,
  POSITIONS, POSITION_GRUPPEN, clamp, randInt, pick, pickWeighted, randNormal, shuffle,
} from './constants.js';
import {
  KOERPER_KORRIDOR, SEITEN_POSITIONEN, generierungsProfil, bewerte,
} from './positionen.js';
import { VORNAMEN, NACHNAMEN } from './content.js';

/**
 * @typedef {object} Spieler
 * @property {string} id
 * @property {string} vorname
 * @property {string} nachname
 * @property {import('./constants.js').Position} position
 * @property {'L'|'R'|null} seite     The side he was trained on, where a position has two
 * @property {number} nummer          Trikotnummer; OHNE_NUMMER until one is handed out
 * @property {number} alter
 * @property {number} staerke         Current overall, never above LIGA_MAX_STAERKE
 * @property {number} talent          Ceiling this player could reach; may sit above the league cap
 * @property {number} ruecktrittAlter The season after this age he stops
 * @property {number} verletztBis     Matchday index the player is fit again; 0 = fit
 * @property {number} groesse         cm
 * @property {number} gewicht         kg
 * @property {Record<string, number>} attribute  The fifteen, on the strength scale
 * @property {number} kickStaerke     How far he kicks it
 * @property {number} kickGenauigkeit How reliably it goes where he aimed
 */

/** A player who has not been handed a number yet. 0 is a real jersey. */
export const OHNE_NUMMER = -1;

let idCounter = 0;

/** Reset between generated games so ids stay stable for a given seed. */
export function resetSpielerIds() {
  idCounter = 0;
}

/**
 * Jersey number bands, each a list of inclusive ranges. Roughly by group, the
 * way a club actually numbers a squad — not one band per position.
 *
 * 0-9 belongs to no band: those numbers are handed out separately, to the best
 * players in the club. The offensive line is the exception that has no
 * exception — a tackle, guard or centre never wears anything outside 50-79.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 8
 * @type {Record<string, [number, number][]>}
 */
const NUMMERN_BAND = {
  QB: [[1, 19]],
  RB: [[20, 49]], FB: [[20, 49]],
  WR: [[10, 19], [80, 89]], SL: [[10, 19], [80, 89]],
  TE: [[40, 49], [80, 89]],
  T: [[50, 79]], G: [[50, 79]], C: [[50, 79]],
  DE: [[50, 79], [90, 99]], DT: [[50, 79], [90, 99]], NT: [[50, 79], [90, 99]],
  MLB: [[40, 59], [90, 99]], SAM: [[40, 59], [90, 99]], WILL: [[40, 59], [90, 99]],
  CB: [[20, 49]], FS: [[20, 49]], SS: [[20, 49]],
};

const EINSTELLIGE = /** @type {[number, number][]} */ ([[0, 9]]);
const EINSTELLIG_KANDIDATEN = 12;
const EINSTELLIG_MIN = 5;
const EINSTELLIG_MAX = 9;

// --- Alterskurve -----------------------------------------------------------
// Four pieces: the climb to the peak, a flat stretch either side of thirty, a
// real decline through the thirties, and then decay with no floor under it —
// a man of sixty on a Bayernliga roster is there for what he can still kick,
// not for what he can still run.

const F_18 = 0.68;
const F_27 = 1.00;
const F_33 = 0.90;
const F_40 = 0.711;
const ZERFALL = 0.94;

/**
 * Multiplier on `talent` for a given age.
 * @param {number} alter
 */
export function alterFaktor(alter) {
  if (alter <= MIN_AGE) return F_18;
  if (alter <= PEAK_AGE) return F_18 + (alter - MIN_AGE) * ((F_27 - F_18) / (PEAK_AGE - MIN_AGE));
  if (alter <= 33) return F_27 + (alter - PEAK_AGE) * ((F_33 - F_27) / (33 - PEAK_AGE));
  if (alter <= 40) return F_33 + (alter - 33) * ((F_40 - F_33) / (40 - 33));
  return F_40 * Math.pow(ZERFALL, alter - 40);
}

/**
 * Talent is the ceiling and may sit above what the league allows; strength is
 * what he is worth on a Saturday, and that never leaves the Bayernliga.
 * @param {number} talent @param {number} alter
 */
export function berechneStaerke(talent, alter) {
  return clamp(Math.round(talent * alterFaktor(alter)), RATING_UNTERGRENZE, LIGA_MAX_STAERKE);
}

/**
 * The two kicking values for one player.
 *
 * A tier is drawn first — most men cannot kick at all, a few really can — and
 * the two values are then drawn *inside* that tier independently of each
 * other. That independence is the point: it lets a man have the leg but not
 * the aim, which is exactly the player a club uses as its punter and not as
 * its kicker. Linemen are excluded from the good tier; nobody hands the ball
 * to a 120-kilo guard on fourth down.
 * @param {() => number} rng
 * @param {import('./constants.js').Position} position
 */
export function ziehKickWerte(rng, position) {
  const fuss = !KICK_FUSS_AUSSCHLUSS.includes(position) && rng() < KICK_FUSS_ANTEIL;
  const basis = fuss ? KICK_FUSS_BASIS : KICK_BASIS;
  const streuung = fuss ? KICK_FUSS_STREUUNG : KICK_STREUUNG;
  /** @returns {number} */
  const wert = () => clamp(
    Math.round(basis + randNormal(rng) * streuung),
    RATING_UNTERGRENZE, LIGA_MAX_STAERKE,
  );
  return { kickStaerke: wert(), kickGenauigkeit: wert() };
}

// --- Körper und Attribute -------------------------------------------------
// Docs: docs/umbau-positionsmodell.md, Abschnitt 2. Die Reihenfolge ist fest:
// erst der Körper, dann die Attribute um ihn herum, dann wird das Ganze auf
// die Stärke skaliert.

/**
 * A point inside a range, or clearly outside it.
 * @param {() => number} rng
 * @param {[number, number]} korridor
 * @param {number} lage 0..1 along the corridor
 * @param {0|1|-1} daneben 0 = inside, ±1 = below or above
 */
function ausKorridor(rng, korridor, lage, daneben) {
  const [von, bis] = korridor;
  const spanne = bis - von;
  if (daneben === 0) return von + lage * spanne;
  const abstand = spanne * (KOERPER_DANEBEN_MIN
    + rng() * (KOERPER_DANEBEN_MAX - KOERPER_DANEBEN_MIN));
  return daneben < 0 ? von - abstand : bis + abstand;
}

/**
 * Height and weight for one player.
 *
 * Four out of five stand inside their position's corridor; the fifth stands
 * clearly outside it — the 95-kilo tackle, the heavy receiver. Inside the
 * corridor the two values move together, because the taller man is usually the
 * heavier one, but not rigidly: the short, thick guard exists too.
 * @param {() => number} rng
 * @param {string} position
 */
export function ziehKoerper(rng, position) {
  const korridor = KOERPER_KORRIDOR[position];
  const daneben = rng() < KOERPER_ANTEIL_DANEBEN
    ? /** @type {1|-1} */ (rng() < 0.5 ? -1 : 1)
    : /** @type {0} */ (0);

  const lage = rng();
  const groesse = ausKorridor(rng, korridor.groesse, lage, daneben);
  const gewicht = ausKorridor(rng, korridor.gewicht,
    clamp(lage + randNormal(rng) * 0.22, 0, 1), daneben);

  return {
    groesse: Math.round(clamp(groesse, GROESSE_MIN, GROESSE_MAX)),
    gewicht: Math.round(clamp(gewicht, GEWICHT_MIN, GEWICHT_MAX)),
  };
}

/**
 * Scale a set of attributes until the position formula reads `ziel` again.
 *
 * Multiplying is enough in principle — the formula is linear — but the cap at
 * LIGA_MAX_STAERKE bends it, so the step repeats and lets the values that are
 * not yet at the ceiling carry the rest. Near the top of the league the target
 * stops being reachable; that is the ceiling doing its job, not a bug.
 *
 * Only what the profile actually asks for is scaled. Were the rest dragged
 * along, a strong lineman whose Blocken sits at the ceiling would have the
 * spare factor poured into his Schnelligkeit, and the league would fill up
 * with 130-kilo sprinters.
 * @param {Record<string, number>} werte
 * @param {Record<string, number>} profil
 * @param {number} ziel
 */
function skaliereAufStaerke(werte, profil, ziel) {
  for (let runde = 0; runde < 6; runde++) {
    const wert = bewerte(werte, profil);
    if (wert <= 0 || Math.abs(wert - ziel) < 0.25) break;
    const faktor = ziel / wert;
    for (const attribut in profil) {
      werte[attribut] = clamp(werte[attribut] * faktor, RATING_UNTERGRENZE, LIGA_MAX_STAERKE);
    }
  }
  return werte;
}

/**
 * The fifteen attributes for one player.
 *
 * The position's generation profile sets the emphases: what the profile asks
 * for lands at his full level, what it never asks for at PROFIL_SPEZIALISIERUNG
 * below it. The body then pulls Kraft up and Tempo down, or the other way
 * round — a heavy man is strong and slow whatever his position says. Last, the
 * whole set is scaled until the position formula reads his `staerke` again.
 * @param {() => number} rng
 * @param {string} position
 * @param {number} staerke
 * @param {number} gewicht kg
 * @returns {Record<string, number>}
 */
export function ziehAttribute(rng, position, staerke, gewicht) {
  const profil = generierungsProfil(position);
  const hoechster = Math.max(...Object.values(profil));
  const schwer = clamp((gewicht - KOERPER_MITTE) / KOERPER_SPANNE, -1.5, 1.5);

  /** @type {Record<string, number>} */
  const werte = {};
  for (const attribut of ATTRIBUTE) {
    const gewichtung = (profil[attribut] || 0) / hoechster;
    let wert = staerke * (1 - PROFIL_SPEZIALISIERUNG * (1 - gewichtung))
      + randNormal(rng) * ATTRIBUT_STREUUNG;

    if (attribut === 'kraft') wert *= 1 + KOERPER_KOPPLUNG * schwer;
    if (attribut === 'schnelligkeit') wert *= 1 - KOERPER_KOPPLUNG * schwer;
    if (attribut === 'beweglichkeit') wert *= 1 - KOERPER_KOPPLUNG * 0.5 * schwer;

    werte[attribut] = clamp(wert, RATING_UNTERGRENZE, LIGA_MAX_STAERKE);
  }

  skaliereAufStaerke(werte, profil, staerke);
  for (const attribut of ATTRIBUTE) werte[attribut] = Math.round(werte[attribut]);
  return werte;
}

/**
 * A new strength for a player who already exists — the veteran whose age was
 * redrawn, everybody at the turn of the year. The attributes move with it in
 * one piece, because ageing curves per attribute belong to the development
 * model and not here.
 * @param {Spieler} s
 * @param {number} staerke
 */
export function setzeStaerke(s, staerke) {
  const faktor = staerke / Math.max(s.staerke, 1);
  for (const attribut of ATTRIBUTE) {
    s.attribute[attribut] = Math.round(
      clamp(s.attribute[attribut] * faktor, RATING_UNTERGRENZE, LIGA_MAX_STAERKE),
    );
  }
  s.staerke = staerke;
  return s;
}

/**
 * Draw a full name, avoiding one already worn inside the same club. Two Hubers
 * in one league are right; two in one changing room are only confusing.
 * @param {() => number} rng
 * @param {Set<string>} [belegt]
 */
function ziehName(rng, belegt) {
  for (let versuch = 0; versuch < 40; versuch++) {
    const vorname = pickWeighted(rng, VORNAMEN);
    const nachname = pickWeighted(rng, NACHNAMEN);
    if (!belegt) return { vorname, nachname };
    const voll = vorname + ' ' + nachname;
    if (!belegt.has(voll)) {
      belegt.add(voll);
      return { vorname, nachname };
    }
  }
  // Pool exhausted for this club — take the doubling rather than loop forever.
  return { vorname: pickWeighted(rng, VORNAMEN), nachname: pickWeighted(rng, NACHNAMEN) };
}

/**
 * @param {() => number} rng
 * @param {import('./constants.js').Position} position
 * @param {number} teamStaerke 0..100 baseline of the club
 * @param {{ alter?: number, belegteNamen?: Set<string>, seite?: 'L'|'R' }} [optionen]
 * @returns {Spieler}
 */
export function macheSpieler(rng, position, teamStaerke, optionen) {
  const { vorname, nachname } = ziehName(rng, optionen && optionen.belegteNamen);
  const alter = optionen && optionen.alter != null
    ? optionen.alter
    : randInt(rng, MIN_AGE, MAX_AGE);

  // Talent orbits the club's baseline.
  const talent = clamp(
    Math.round(teamStaerke + randNormal(rng) * TALENT_STREUUNG),
    RATING_UNTERGRENZE, MAX_RATING,
  );

  const staerke = berechneStaerke(talent, alter);
  const koerper = ziehKoerper(rng, position);

  // Wo eine Position zwei Seiten hat, ist der Spieler auf einer davon
  // ausgebildet. Die andere kostet ihn Technik — wie viel, entscheidet die
  // Position: außen in der Line ist die Seite Gewöhnungssache, im Rest nicht.
  const seite = SEITEN_POSITIONEN.includes(/** @type {any} */ (position))
    ? ((optionen && optionen.seite) || (rng() < 0.5 ? 'L' : 'R'))
    : null;

  return {
    id: 'p' + (++idCounter),
    vorname,
    nachname,
    position,
    seite: /** @type {'L'|'R'|null} */ (seite),
    nummer: OHNE_NUMMER,
    alter,
    staerke,
    talent,
    ruecktrittAlter: RUECKTRITT_ALTER,
    verletztBis: 0,
    ...koerper,
    attribute: ziehAttribute(rng, position, staerke, koerper.gewicht),
    ...ziehKickWerte(rng, position),
  };
}

/**
 * Which positions the extra players of an AI club land on. Weighted by where
 * depth is actually wanted, and capped so nobody ends up with four QBs.
 * @param {() => number} rng
 * @param {number} anzahl
 * @returns {import('./constants.js').Position[]}
 */
function zusatzPositionen(rng, anzahl) {
  /** @type {import('./constants.js').Position[]} */
  const gezogen = [];
  /** @type {Record<string, number>} */
  const zaehler = {};
  const pool = /** @type {[import('./constants.js').Position, number][]} */ (
    Object.entries(ZUSATZ_GEWICHTE).filter(([, g]) => g > 0)
  );

  while (gezogen.length < anzahl) {
    const frei = pool.filter(([p]) => (zaehler[p] || 0) < ZUSATZ_MAX_JE_POSITION);
    if (frei.length === 0) break;
    const position = pickWeighted(rng, frei);
    zaehler[position] = (zaehler[position] || 0) + 1;
    gezogen.push(position);
  }
  return gezogen;
}

/**
 * Turn one or two of the squad into the men who never stopped.
 * @param {() => number} rng
 * @param {Spieler[]} kader
 */
function macheVeteranen(rng, kader) {
  const kandidaten = shuffle(rng, kader.filter((s) => VETERAN_POSITIONEN.includes(s.position)));
  const anzahl = Math.min(randInt(rng, VETERAN_MIN, VETERAN_MAX), kandidaten.length);

  for (const s of kandidaten.slice(0, anzahl)) {
    const band = rng() < VETERAN_ANTEIL_JUNG ? VETERAN_JUNG : VETERAN_ALT;
    s.alter = randInt(rng, band[0], band[1]);
    setzeStaerke(s, berechneStaerke(s.talent, s.alter));
    s.ruecktrittAlter = randInt(rng, s.alter + 1, VETERAN_RUECKTRITT_MAX);
  }
  return kader;
}

/**
 * A full Kader, sorted so the depth chart reads top-down per position.
 * @param {() => number} rng
 * @param {number} teamStaerke
 * @param {number} [zusatz] extra players beyond KADER_FORM
 * @returns {Spieler[]}
 */
export function macheKader(rng, teamStaerke, zusatz = 0) {
  /** @type {Set<string>} */
  const belegteNamen = new Set();
  /** @type {Spieler[]} */
  const kader = [];

  for (const position of POSITIONS) {
    for (let i = 0; i < KADER_FORM[position]; i++) {
      // Der Grundkader bildet abwechselnd links und rechts aus. Ein Verein,
      // der zwei Tackles hat, hat einen für jede Seite — dass ihm einer fehlt,
      // soll aus Verletzungen kommen und nicht aus der Ziehung.
      kader.push(macheSpieler(rng, position, teamStaerke, {
        belegteNamen, seite: i % 2 === 0 ? 'L' : 'R',
      }));
    }
  }
  for (const position of zusatzPositionen(rng, zusatz)) {
    kader.push(macheSpieler(rng, position, teamStaerke, { belegteNamen }));
  }

  macheVeteranen(rng, kader);
  return vergebeNummern(rng, sortiereKader(kader), true);
}

/**
 * Position order first, strength second — that is the depth chart.
 * @param {Spieler[]} kader
 */
export function sortiereKader(kader) {
  const rang = /** @type {Record<string, number>} */ (
    Object.fromEntries(POSITIONS.map((p, i) => [p, i]))
  );
  return kader.slice().sort((a, b) =>
    rang[a.position] - rang[b.position] || b.staerke - a.staerke);
}

/**
 * The free numbers inside a set of ranges.
 * @param {[number, number][]} band
 * @param {Set<number>} belegt
 */
function zahlenIn(band, belegt) {
  /** @type {number[]} */
  const frei = [];
  for (const [von, bis] of band) {
    for (let n = von; n <= bis; n++) if (!belegt.has(n)) frei.push(n);
  }
  return frei;
}

/**
 * Hand out jersey numbers, uniquely inside the Kader.
 *
 * With `neuVerteilen` the whole squad is redrawn and the single digits go out
 * first: five to nine of the twelve best non-linemen get one. Without it only
 * the players who have no number yet are served, so a man keeps his number for
 * as long as he keeps his place.
 * @param {() => number} rng
 * @param {Spieler[]} kader
 * @param {boolean} [neuVerteilen]
 */
export function vergebeNummern(rng, kader, neuVerteilen = false) {
  if (neuVerteilen) for (const s of kader) s.nummer = OHNE_NUMMER;

  /** @type {Set<number>} */
  const belegt = new Set(kader.filter((s) => s.nummer >= 0).map((s) => s.nummer));

  if (neuVerteilen) {
    const kandidaten = kader
      .filter((s) => !POSITION_GRUPPEN.lineOffense.includes(s.position))
      .sort((a, b) => b.staerke - a.staerke)
      .slice(0, EINSTELLIG_KANDIDATEN);
    const anzahl = Math.min(randInt(rng, EINSTELLIG_MIN, EINSTELLIG_MAX), kandidaten.length);

    for (const s of shuffle(rng, kandidaten).slice(0, anzahl)) {
      const frei = zahlenIn(EINSTELLIGE, belegt);
      if (frei.length === 0) break;
      s.nummer = pick(rng, frei);
      belegt.add(s.nummer);
    }
  }

  for (const s of kader) {
    if (s.nummer >= 0) continue;
    // 0-9 sind vergeben oder bleiben frei: sie gehören den Besten und werden
    // oben verteilt. Das QB-Band reicht bis 1 hinunter, der zweite Mann darf
    // sich daraus trotzdem nicht bedienen.
    const frei = zahlenIn(NUMMERN_BAND[s.position] || [[1, 99]], belegt)
      .filter((n) => n > 9);
    if (frei.length === 0) {
      throw new Error(`Keine freie Trikotnummer für ${s.position} — die Kaderform passt nicht ins Nummernband`);
    }
    s.nummer = pick(rng, frei);
    belegt.add(s.nummer);
  }
  return kader;
}

/** @param {Spieler} s @param {number} spieltag */
export function istFit(s, spieltag) {
  return s.verletztBis <= spieltag;
}

/**
 * The fit players at a position, best first.
 * @param {Spieler[]} kader
 * @param {import('./constants.js').Position} position
 * @param {number} spieltag
 */
export function verfuegbar(kader, position, spieltag) {
  return kader
    .filter((s) => s.position === position && istFit(s, spieltag))
    .sort((a, b) => b.staerke - a.staerke);
}

/** @param {Spieler} s */
export function name(s) {
  return s.vorname + ' ' + s.nachname;
}

/** Short form for box scores: "M. Weber". @param {Spieler} s */
export function kurzName(s) {
  return s.vorname.charAt(0) + '. ' + s.nachname;
}

/**
 * One year on: everyone ages, and strength re-derives from talent. Whoever is
 * past his own `ruecktrittAlter` stops and is replaced by a rookie at the same
 * position. Numbers survive — only the newcomers draw.
 * @param {() => number} rng
 * @param {Spieler[]} kader
 * @param {number} teamStaerke
 * @returns {{ kader: Spieler[], ruecktritte: Spieler[] }}
 */
export function saisonWechsel(rng, kader, teamStaerke) {
  /** @type {Spieler[]} */
  const neu = [];
  /** @type {Spieler[]} */
  const ruecktritte = [];
  /** @type {Set<string>} */
  const belegteNamen = new Set(kader.map((s) => s.vorname + ' ' + s.nachname));

  for (const s of kader) {
    const alter = s.alter + 1;
    if (alter > (s.ruecktrittAlter || RUECKTRITT_ALTER)) {
      ruecktritte.push(s);
      belegteNamen.delete(s.vorname + ' ' + s.nachname);
      neu.push(macheSpieler(rng, s.position, teamStaerke, {
        alter: randInt(rng, MIN_AGE, 21),
        belegteNamen,
      }));
      continue;
    }
    // Young players nudge their ceiling upwards; veterans do not.
    const talent = alter <= PEAK_AGE
      ? clamp(s.talent + (rng() < 0.35 ? randInt(rng, 1, 3) : 0), RATING_UNTERGRENZE, MAX_RATING)
      : s.talent;
    neu.push(setzeStaerke({
      ...s,
      alter,
      talent,
      attribute: { ...s.attribute },
      verletztBis: 0,
    }, berechneStaerke(talent, alter)));
  }

  return { kader: vergebeNummern(rng, sortiereKader(neu)), ruecktritte };
}
