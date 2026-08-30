// @ts-check
/**
 * Balance numbers and the injectable RNG.
 * This module touches no DOM and imports nothing from ui/.
 */

/**
 * Roster positions, in depth-chart order: offence first, then defence.
 *
 * Eighteen, not the five and three the game started with. The split has to
 * happen before the position values do, because prising it back out of every
 * formula and every table later costs more than doing it now.
 *
 * Left and right do NOT double the catalogue. A `T` is a tackle; `LT` and `RT`
 * are places in a formation, and what a man loses by moving between them is a
 * matter for the position model, not for two more entries here.
 *
 * K and P are absent, as they have been since the kick values landed: the club
 * kicks with whoever has the foot for it.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 1
 */
export const POSITIONS = /** @type {const} */ ([
  'QB', 'RB', 'FB', 'WR', 'SL', 'TE', 'T', 'G', 'C',
  'DE', 'DT', 'NT', 'MIKE', 'SAM', 'WILL', 'CB', 'FS', 'SS',
]);

/** @typedef {typeof POSITIONS[number]} Position */

/**
 * The seven groups a position belongs to. A move inside a group is cheap, a
 * move across one is not — that is what the group is for. Numbers bands,
 * veterans and the provisional unit ratings read it too, so it lives here with
 * the catalogue rather than in the position model.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 4
 */
export const POSITION_GRUPPEN = /** @type {Record<string, Position[]>} */ ({
  quarterback: ['QB'],
  backfield: ['RB', 'FB'],
  empfaenger: ['WR', 'SL', 'TE'],
  lineOffense: ['T', 'G', 'C'],
  lineDefense: ['DE', 'DT', 'NT'],
  linebacker: ['MIKE', 'SAM', 'WILL'],
  secondary: ['CB', 'FS', 'SS'],
});

/** Which unit a group plays in. */
export const EINHEIT_JE_GRUPPE = /** @type {Record<string, 'offense'|'defense'>} */ ({
  quarterback: 'offense', backfield: 'offense', empfaenger: 'offense', lineOffense: 'offense',
  lineDefense: 'defense', linebacker: 'defense', secondary: 'defense',
});

/** Position -> group name, derived so the two never drift apart. */
export const GRUPPE_JE_POSITION = /** @type {Record<string, string>} */ (
  Object.fromEntries(
    Object.entries(POSITION_GRUPPEN).flatMap(([gruppe, pos]) => pos.map((p) => [p, gruppe])),
  )
);

/** The men in the trenches, both sides. They neither kick nor wear a single digit. */
export const LINEMEN = /** @type {Position[]} */ ([
  ...POSITION_GRUPPEN.lineOffense, ...POSITION_GRUPPEN.lineDefense,
]);

/**
 * The Kader every club starts from: thirty men, sixteen for the offence and
 * fourteen for a 4-3 defence. Nothing more — a Bayernliga club does not carry
 * a bench.
 *
 * `TE: 0` is deliberate. The club the player takes over has no trained tight
 * end and has to convert somebody the moment its system wants one. That is
 * part of starting at the bottom.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 8
 */
export const KADER_FORM = /** @type {Record<Position, number>} */ ({
  QB: 2, RB: 2, FB: 1, WR: 4, SL: 2, TE: 0, T: 2, G: 2, C: 1,
  DE: 2, DT: 2, NT: 1, MIKE: 2, SAM: 1, WILL: 1, CB: 3, FS: 1, SS: 1,
});

/** The club the player manages starts thin. */
export const KADER_GROESSE_EIGEN = Object.values(KADER_FORM).reduce((a, b) => a + b, 0);

/** Every other club draws this many extra players on top of KADER_FORM. */
export const ZUSATZ_SPIELER = 5;
export const KADER_GROESSE_FREMD = KADER_GROESSE_EIGEN + ZUSATZ_SPIELER;

/**
 * How the extra players are drawn. Weighted towards where the snaps and the
 * injuries pile up — line, receivers, secondary. An even draw would hand
 * somebody a third quarterback.
 *
 * `TE: 4` against the club's own zero is the point: the other clubs regularly
 * have a tight end and the player's club does not.
 */
export const ZUSATZ_GEWICHTE = /** @type {Record<Position, number>} */ ({
  QB: 1, RB: 3, FB: 2, WR: 5, SL: 3, TE: 4, T: 5, G: 4, C: 2,
  DE: 5, DT: 4, NT: 2, MIKE: 3, SAM: 3, WILL: 3, CB: 5, FS: 2, SS: 2,
});

/** No club may stack more than this many extras on one position. */
export const ZUSATZ_MAX_JE_POSITION = 2;

/**
 * The club the player picks starts at the bottom: its Kader baseline drops to
 * this value, however strong the club stands in the catalogue. The league's
 * ladder of strengths is untouched — every weaker club moves up one rung. The
 * promotion is meant to be played for, not chosen.
 */
export const EIGENE_VEREINSBASIS = 45;

/**
 * The fifteen attributes every player carries, on the same scale as `staerke`.
 * `kickStaerke` and `kickGenauigkeit` sit beside them and are drawn separately.
 *
 * `staerke` stays the leading figure for now: the attributes are pulled around
 * it, the depth chart still sorts by it, the screens still show it. Deriving
 * strength from the attributes instead is a later step of its own.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 2
 */
export const ATTRIBUTE = /** @type {const} */ ([
  'schnelligkeit',      // Tempo geradeaus
  'beweglichkeit',      // Richtungswechsel, Explosivität
  'kraft',              // Wucht, hängt an Größe und Gewicht
  'ausdauer',           // wie lange er durchhält — trägt den Doppeleinsatz-Abzug
  'robustheit',         // Verletzungsanfälligkeit — trägt das Doppeleinsatz-Risiko
  'fangen',
  'ballsicherheit',
  'routeRunning',
  'werfen',
  'blocken',
  'passrush',
  'tacklen',
  'coverage',
  'spielverstaendnis',  // Lesen, Stellungsspiel
  'technik',            // positionsgebundenes Handwerk
]);

/** @typedef {typeof ATTRIBUTE[number]} Attribut */

/**
 * How far a drawn player leans on his position's profile: an attribute the
 * profile does not ask for sits at (1 - this) of his level, one at the very
 * top of it at the full level. Everything in between is proportional.
 *
 * Turn it down and every player is a generalist, every conversion is free and
 * the position model stops meaning anything.
 */
export const PROFIL_SPEZIALISIERUNG = 0.40;

/** Spread on a single attribute before it is scaled onto `staerke`. */
export const ATTRIBUT_STREUUNG = 6;

/**
 * Wie weit ein Einsatz die Attribute auf das Sollprofil seines Platzes zuzieht.
 *
 * Elf Spiele sind eine Saison, und elf davon machen zusammen rund 15 % — die
 * Rate, bei der eine Umschulung sich lohnt, ohne den geborenen Spieler
 * einzuholen. Wer die Saison aufteilt, zieht anteilig in beide Richtungen; das
 * fällt von selbst an, weil je Spiel gerechnet wird und nicht je Saison.
 */
export const ATTRIBUT_DRIFT_JE_SPIEL = 0.0147;

/**
 * Wie schnell ein einzelnes Attribut dem Sollprofil folgt, als Faktor auf
 * `ATTRIBUT_DRIFT_JE_SPIEL`.
 *
 * Handwerk lernt man, Tempo nicht. Ohne diese Leiter zöge jeder Wert gleich
 * schnell, und ein 109-Kilo-Linebacker würde auf dem Weg zum Cornerback mehr
 * Schnelligkeit gewinnen, als er Fangen lernt — der Körper stünde im Sollprofil
 * zwar richtig, wäre aber genauso schnell erreicht wie eine Fangtechnik.
 *
 * Der Schnitt liegt bei 1,0: die Saisonrate von rund 15 % bleibt, sie verteilt
 * sich nur anders. Was hier fehlt, zieht mit 1.
 * @type {Record<string, number>}
 */
export const LERNRATE = {
  technik: 1.5,
  fangen: 1.4,
  routeRunning: 1.4,
  ballsicherheit: 1.4,
  blocken: 1.3,
  coverage: 1.3,
  passrush: 1.2,
  tacklen: 1.2,
  werfen: 0.6,
  beweglichkeit: 0.5,
  kraft: 0.4,
  schnelligkeit: 0.3,
};

/**
 * The body. Height and weight are real data, not attributes — but `kraft` and
 * `schnelligkeit` hang off them, which is what makes the 95-kilo tackle a real
 * player rather than a mislabelled one: agile, and weak.
 *
 * KOERPER_MITTE is roughly the league's mean weight, KOERPER_SPANNE the
 * distance at which the coupling reaches its full effect.
 */
export const KOERPER_ANTEIL_DANEBEN = 0.20;   // share of players outside their corridor
export const KOERPER_DANEBEN_MIN = 0.20;      // how far outside, as a share of the corridor
export const KOERPER_DANEBEN_MAX = 0.55;
export const KOERPER_MITTE = 100;             // kg
export const KOERPER_SPANNE = 45;             // kg
export const KOERPER_KOPPLUNG = 0.35;         // how hard weight pulls Kraft up and Tempo down
export const GROESSE_MIN = 165;               // cm — nobody outside these plays here
export const GROESSE_MAX = 205;
export const GEWICHT_MIN = 68;                // kg
export const GEWICHT_MAX = 165;

/** Rating bounds. */
export const MAX_RATING = 99;          // the scale's ceiling, kept for higher leagues
export const LIGA_MAX_STAERKE = 79;    // no Bayernliga strength is ever computed above this
export const RATING_UNTERGRENZE = 1;   // not a skill floor — only keeps a rating positive
export const TALENT_STREUUNG = 6;      // standard deviation of talent around the club baseline

/** What an empty slot in a unit is worth. A body, not a player. */
export const ERSATZ_STAERKE = 20;

/**
 * Kicking. Every player carries two values instead of a K or P slot, because
 * below the GFL almost nobody keeps a specialist — the club kicks with whoever
 * has the foot for it, and that man plays a position the rest of the game.
 *
 * `kickStaerke` is how far the ball goes, `kickGenauigkeit` how reliably it
 * goes where it should. Most men have neither. A few have a real foot, and the
 * two values are drawn apart from each other on purpose: a cannon leg with no
 * aim is a punter, not a kicker.
 */
export const KICK_BASIS = 22;            // mean for a man who does not kick
export const KICK_STREUUNG = 6;
export const KICK_FUSS_ANTEIL = 0.07;    // share of the squad who actually can
export const KICK_FUSS_BASIS = 55;       // mean for those who can
export const KICK_FUSS_STREUUNG = 9;
/** Where a kicker never comes from: the men in the trenches. */
export const KICK_FUSS_AUSSCHLUSS = LINEMEN;

/** Age bounds for the normal draw, and where the curve peaks. */
export const MIN_AGE = 18;
export const MAX_AGE = 36;
export const PEAK_AGE = 27;

/** Placeholder until the development model lands: when an ordinary player stops. */
export const RUECKTRITT_ALTER = 37;

/**
 * The Bayernliga special: every club carries one or two men who should have
 * stopped a decade ago and did not.
 */
export const VETERAN_MIN = 1;
export const VETERAN_MAX = 2;
export const VETERAN_ANTEIL_JUNG = 0.75;
export const VETERAN_JUNG = /** @type {[number, number]} */ ([45, 55]);
export const VETERAN_ALT = /** @type {[number, number]} */ ([56, 65]);
export const VETERAN_RUECKTRITT_MAX = 66;
/** Where a fifty-year-old still plausibly lines up. */
export const VETERAN_POSITIONEN = LINEMEN;

/** Match simulation. */
export const BASE_POINTS = 20;        // what an evenly matched offence scores
export const RATING_TO_POINTS = 0.42; // points gained per point of unit advantage
export const HOME_ADVANTAGE = 2.5;    // points, applied to the home side
export const MATCH_NOISE = 6.5;       // std-dev-ish spread on the expected score
export const MIN_EXPECTED = 3;
export const MAX_EXPECTED = 56;

/**
 * Ausrichtung: warum eine Mischung schlägt, was an den Enden steht.
 *
 * `vorteil()` mischte Lauf und Pass früher linear. Eine Gerade hat ihr Optimum
 * immer an einem Ende, und ihre Steigung war fast waagerecht: über den ganzen
 * Reglerweg lagen 0,45 erwartete Punkte, gegen ein MATCH_NOISE von 6,5. Der
 * Regler war damit unsichtbar und die Entscheidung keine.
 *
 * Vier Zahlen richten das:
 *
 * - AUSGEWOGENHEIT macht die Mischung konkav. Die Strafe ist null bei 50/50 und
 *   wächst zu den Rändern, weshalb das Optimum bei `sigmoid(d / AUSGEWOGENHEIT)`
 *   liegt und damit für *jedes* d echt innen. Sie sagt zugleich, was ein Ende
 *   höchstens kostet: `AUSGEWOGENHEIT * ln2` Stärkepunkte.
 * - SPREIZUNG sagt, wie weit Kader und Gegner dieses Optimum verschieben. Sie
 *   spreizt Pass und Lauf um ihren gemeinsamen Mittelwert, lässt den also in
 *   Ruhe — siehe `spreize()` in team.js.
 * - KLIPPE und RAND brechen die letzten Prozent weg. Ohne sie kostete reines
 *   Passspiel aus Empty heraus 0,4 Punkte und wäre unsichtbar geblieben; mit
 *   ihnen kostet es 7. Ohne Laufandrohung kein Passspiel.
 *
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 6
 */
export const AUSGEWOGENHEIT = 10;   // Stärkepunkte, die Einseitigkeit höchstens kostet
export const SPREIZUNG = 1.0;       // wie weit Kader und Gegner das Systemoptimum verschieben
export const KLIPPE = 16;           // Einbruch am äußersten Rand, in Stärkepunkten
export const RAND = 0.03;           // Breite des Bandes, in dem die Klippe greift

/**
 * Standings: German American football scores 2:0 for a win. There is no third
 * outcome — overtime runs until somebody is ahead, in the group stage as well
 * as in the playoffs, so no draw ever reaches the table.
 */
export const POINTS_WIN = 2;
export const POINTS_LOSS = 0;

/** Injuries. */
export const INJURY_CHANCE_PER_GAME = 0.055; // per team, per match
export const INJURY_MIN_WEEKS = 1;
export const INJURY_MAX_WEEKS = 6;

/**
 * Overtime never ends level, so the loop has no round limit. It terminates on
 * its own — each possession scores a touchdown with at least 9 % probability
 * per side, so the two sides separate almost surely. The brake exists only so
 * that a broken RNG can never hang the game, and it decides rather than ties.
 */
export const OT_NOTBREMSE_RUNDEN = 50;

/** Season structure: two groups of six, then a bracket across them. */
export const SEASON_START_YEAR = 2026;
/** Playoff berths per group. Two of six, which is the bracket the league uses. */
export const PLAYOFF_PLAETZE = 2;

/** @param {number} v @param {number} lo @param {number} hi */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Linear zwischen Stützstellen, außerhalb flach.
 *
 * Das Modell beschreibt seine Kurven lieber als Tabelle denn als Formel: eine
 * Zeile je Stützstelle liest sich beim Balancieren, eine Exponentialfunktion
 * nicht. Die Stützstellen stehen aufsteigend, jede als `[Eingang, Ergebnis]`.
 * @param {[number, number][]} kurve
 * @param {number} wert
 */
export function interpoliere(kurve, wert) {
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

// --- RNG -------------------------------------------------------------------
// Seeded so a season replays identically and tests never assert on a
// distribution. Mirrors the injectable-RNG habit from Spirit Idland.

/** @param {string} str */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

/**
 * mulberry32 — small, fast, good enough for a manager game.
 * @param {number|string} seed
 * @returns {() => number} uniform in [0, 1)
 */
export function makeRng(seed) {
  let a = typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {() => number} rng @param {number} lo @param {number} hi inclusive */
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** @template T @param {() => number} rng @param {readonly T[]} arr */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Draw from a pool of [value, weight] pairs. Weights are plain integers so a
 * single name can be nudged by hand without recomputing a distribution.
 * @template T @param {() => number} rng @param {readonly (readonly [T, number])[]} pool
 * @returns {T}
 */
export function pickWeighted(rng, pool) {
  let summe = 0;
  for (const eintrag of pool) summe += eintrag[1];
  let wurf = rng() * summe;
  for (const eintrag of pool) {
    wurf -= eintrag[1];
    if (wurf < 0) return eintrag[0];
  }
  return pool[pool.length - 1][0];
}

/**
 * Four uniforms averaged have a standard deviation of 1/sqrt(48), so this is
 * the factor that makes the result a unit normal. Getting it wrong halves
 * every spread that goes through here, silently.
 */
const NORMAL_SKALIERUNG = Math.sqrt(48);

/** Roughly normal, mean 0, standard deviation 1. @param {() => number} rng */
export function randNormal(rng) {
  return ((rng() + rng() + rng() + rng()) / 4 - 0.5) * NORMAL_SKALIERUNG;
}

/** Fisher-Yates, in place. @template T @param {() => number} rng @param {T[]} arr */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
