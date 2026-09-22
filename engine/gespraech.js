// @ts-check
/**
 * Das Gespräch: der Termin, den der Manager mit einem Menschen im Verein
 * verbringt, und was dabei herauskommt.
 *
 * Hier steht, was **allen** Kategorien gemeinsam ist — das Kontingent und das
 * Log, aus dem es sich rechnet — und die eine Kategorie, die nichts weiter
 * braucht als beides: das persönliche Gespräch. Was eine Kategorie ein eigenes
 * Modell verlangt, bekommt ein eigenes (`rolle.js`); was nur den Termin
 * verbraucht, wohnt hier.
 *
 * Das Kontingent lag bis zu dieser Kategorie in `rolle.js`. Es ist dort nie
 * hingehörig gewesen: es zählt Termine, nicht Rollen, und die Rolle war nur
 * die erste Kategorie, die welche verbraucht hat.
 *
 * Diese Datei kennt kein DOM, keine Texte und keinen `SpielStand` — sie
 * rechnet auf Spielern und dem Log. Was davon wann passiert, verdrahtet
 * `saison.js`.
 *
 * Docs: docs/naechste-schritte.md, Block 7, Abschnitt „Gespräche"
 */

import {
  GESPRAECHE_JE_WOCHE, PERSOENLICH_GEWINN, PERSOENLICH_SAETTIGUNG_TAGE, clamp,
} from './constants.js';
import { woche } from './kalender.js';

/** @typedef {import('./spieler.js').Spieler} Spieler */

/** @typedef {{ tag: number, spielerId: string }} Gespraech */

// --- Das Kontingent --------------------------------------------------------

/**
 * Wie viele Gespräche in der Woche dieses Tages schon geführt wurden.
 *
 * Gezählt statt heruntergezählt: das Log ist die Wahrheit, und das Fenster
 * verschiebt sich von selbst, sobald der Tag in die nächste Woche rutscht.
 * Ein Feld, das jemand jede Woche zurücksetzen müsste, wäre eine zweite
 * Wahrheit über dieselbe Zahl — und der Tick müsste einen Sonderfall kennen.
 * @param {Gespraech[]} log @param {number} tag
 */
export function gefuehrteDieseWoche(log, tag) {
  return log.filter((g) => woche(g.tag) === woche(tag)).length;
}

/** Wie viele diese Woche noch gehen. @param {Gespraech[]} log @param {number} tag */
export function offeneGespraeche(log, tag) {
  return Math.max(0, GESPRAECHE_JE_WOCHE - gefuehrteDieseWoche(log, tag));
}

// --- Über persönliche Themen sprechen --------------------------------------

/**
 * Wann zuletzt mit ihm geredet wurde — über was auch immer. `null` heißt: in
 * dieser Saison noch nie.
 *
 * Das Log wird beim Saisonwechsel geleert, wie der Papierkorb der Post. Das
 * ist kein Verlust, sondern der richtige Schnitt: die Tage zählen innerhalb
 * einer Saison, und Tag 300 des Vorjahres gegen Tag 5 des neuen gehalten ergäbe
 * einen Abstand, der rückwärts läuft.
 * @param {Gespraech[]} log @param {string} spielerId
 * @returns {number | null}
 */
export function zuletztGeredet(log, spielerId) {
  let letzter = null;
  for (const g of log) {
    if (g.spielerId === spielerId && (letzter === null || g.tag > letzter)) letzter = g.tag;
  }
  return letzter;
}

/**
 * Welchen Anteil seines vollen Satzes ein persönliches Gespräch heute noch
 * bringt: 1, wenn lange genug nichts war, sonst der Anteil der verstrichenen
 * Zeit.
 *
 * Kein harter Cooldown wie bei der Rolle, sondern ein weicher Abfall. Die
 * Rolle ist eine Zusage, die eine Weile stehen muss, damit sie eine ist —
 * reden kann man dagegen immer, es bringt nur wenig, wenn man es gerade erst
 * getan hat. Ein gesperrter Knopf hätte dem Manager das Gegenteil erzählt.
 * @param {Gespraech[]} log @param {string} spielerId @param {number} tag
 */
export function persoenlichAnteil(log, spielerId, tag) {
  const zuletzt = zuletztGeredet(log, spielerId);
  if (zuletzt === null) return 1;
  const her = Math.max(0, tag - zuletzt);
  return clamp(her / PERSOENLICH_SAETTIGUNG_TAGE, 0, 1);
}

/** Die Schwellen, ab denen ein Anteil anders klingt. Von unten gelesen. */
const PERSOENLICH_TON_GRENZEN = [0.35, 1];

/**
 * @typedef {object} Zuwendung
 * @property {number} delta   Was sich am Commitment bewegt hat
 * @property {0|1|2} ton      Wie es ankam, für den Satz in `i18n.js`
 */

/**
 * Eine Viertelstunde reden, ohne Anlass und ohne Ansage.
 *
 * Kein Informationsertrag und kein Risiko — die einzige Kategorie ohne beides.
 * Dafür ist sie die kleinste: „der Coach interessiert sich für mich" ist ein
 * echter Satz im Amateursport, aber er trägt niemanden über eine Saison.
 * @param {Spieler} sp @param {Gespraech[]} log @param {number} tag
 * @returns {Zuwendung}
 */
export function persoenlichesGespraech(sp, log, tag) {
  const anteil = persoenlichAnteil(log, sp.id, tag);
  const delta = PERSOENLICH_GEWINN * anteil;
  if (delta > 0 && typeof sp.commitment === 'number') {
    sp.commitment = clamp(sp.commitment + delta, 0, 99);
  }
  let ton = 0;
  for (const grenze of PERSOENLICH_TON_GRENZEN) if (anteil >= grenze) ton++;
  return { delta, ton: /** @type {0|1|2} */ (ton) };
}
