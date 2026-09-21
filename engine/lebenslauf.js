// @ts-check
/**
 * Der Lebenslauf: was mit einem Menschen im Verein von Jahr zu Jahr geschieht.
 *
 * `commitment.js` zieht, wie einer ins Spiel kommt. Hier steht, was dann aus
 * ihm wird — und zwar an zwei **Uhren, die sich nicht blockieren**:
 *
 * - **Der Horizont** ist die Uhr der Lebensstadien. Ist er erreicht, endet
 *   die Schule, das Studium, die Ausbildung, oder beim Arbeiter ein Zyklus
 *   von zwei bis vier Jahren; ein neuer Status kommt, ein neuer Plan, und ein
 *   Wegzug setzt die Entfernung neu. Das Commitment kann den Plan dabei
 *   **kippen**: ein hohes dreht einen geplanten Wegzug in ein Bleiben, ein
 *   niedriges ein geplantes Bleiben in einen Wegzug.
 * - **Die Waage** — Druck gegen Halt — läuft jede Saison, für jeden, egal wo
 *   sein Horizont steht. Liegt der Druck zwei Saisons in Folge über dem Halt,
 *   geht er. Ein Zyklus von vier Jahren, in dem das nach zwei passiert, wird
 *   nie zu Ende gespielt; umgekehrt läuft der Zähler über ein Zyklusende
 *   hinweg einfach weiter. Weil die Waage für jeden rechnet, braucht sie
 *   keinen Sonderfall: bei kleiner Entfernung kommt der Druck nie über den
 *   Halt, und der Zähler bleibt null.
 *
 * Drei Entscheidungen stecken in der Waage, alle gegen eine **Doppelzählung**
 * — ein Umstand steht auf einer Seite, nie auf beiden:
 *
 * - Die Strecke ist aus der Commitment-Ziehung heraus. Sonst senkte sie den
 *   Halt und wäre zugleich der Druck.
 * - Der Familienfaktor gilt nur für die **eigene** Familie (Arbeiter,
 *   Rentner). Beim Studenten sind „Familie" die Eltern, und die wohnen da, wo
 *   der Verein steht — seine Entfernung ist schon die zu ihnen. Dass Familie
 *   für die Jungen mehr wiegt, steht deshalb als fester Bonus auf der
 *   Halt-Seite, nicht als Faktor unter 1 auf ihre Entfernung (das wäre
 *   dieselbe Doppelzählung, nur zu ihren Gunsten).
 * - Kein Jugend-Mobilitäts-Rabatt: junge Leute sind mobil, weil sie
 *   ausprobieren wollen — das macht sie nicht fester.
 *
 * Was hier **nicht** passiert, mit Absicht: das Commitment bewegt sich nicht
 * (Bank, Coach, Verletzung kommen in Schritt 2b), der Plan ist die Wahrheit
 * (die Abweichung kommt mit den Gesprächen, sonst gäbe es keinen Weg, sie zu
 * erfahren), und wer geht, wird durch einen Rookie ersetzt wie der Rücktritt
 * heute — für jeden Verein derselbe Weg, damit die Symmetrie zur KI hält.
 *
 * Docs: docs/naechste-schritte.md, Block 7, „Statusübergänge — die Verteilungen"
 */

import { stufe, ziehHorizont, wegzugKm, AUTO_JE_STATUS } from './commitment.js';
import {
  DRUCK_FAKTOR_AUTO, DRUCK_FAKTOR_FAMILIE, DRUCK_MAX,
  HALT_JE_VEREINSJAHR, HALT_FAMILIENBONUS_JUNG, DRUCK_JAHRE_BIS_ABGANG, KIPPEN_JE_STUFE,
  pickWeighted, randInt,
} from './constants.js';

/** @typedef {import('./commitment.js').Lebenslage} Lebenslage */
/** @typedef {import('./commitment.js').Status} Status */
/** @typedef {import('./commitment.js').Grund} Grund */
/** @typedef {import('./commitment.js').Horizont} Horizont */

/**
 * Was ein Jahr mit einem Menschen gemacht hat. `abgang` heißt: er ist weg, und
 * der Saisonwechsel ersetzt ihn. Alles andere ist eine Auskunft — der Stand
 * ist schon geändert.
 * @typedef {{ art: 'abgang', grund: Grund }
 *   | { art: 'wechsel', von: Status, nach: Status, km: number }
 *   | { art: 'wegzug', km: number }
 *   | { art: 'familie' }} Ereignis
 */

/** Wer noch bei den Eltern zählt — und den Bonus dafür bekommt. */
const JUNG = new Set(/** @type {Status[]} */ (['schueler', 'student', 'azubi']));

// --- Die Waage -------------------------------------------------------------

/**
 * Der Druck aus der Lebenslage, auf der Skala des Commitments. Nur die
 * Strecke, mit dem, was sie leichter (Auto) oder schwerer (eigene Familie)
 * macht. Später zieht das Spritgeld hier einen Betrag ab, bevor die Faktoren
 * greifen — ein Minus-Term, kein neuer Mechanismus.
 * @param {Lebenslage} l
 */
export function druck(l) {
  const effektiv = l.entfernung
    * (l.auto ? DRUCK_FAKTOR_AUTO : 1)
    * (eigeneFamilie(l) ? DRUCK_FAKTOR_FAMILIE : 1);
  return Math.min(DRUCK_MAX, effektiv);
}

/**
 * Der Halt: das Commitment, die Jahre im Verein, und bei den Jungen die
 * Eltern. Darf über 99 liegen — er ist eine Rechengröße, keine Anzeige.
 * @param {number} commitment
 * @param {Lebenslage} l
 * @param {number} jahr
 */
export function halt(commitment, l, jahr) {
  return commitment
    + HALT_JE_VEREINSJAHR * Math.max(0, jahr - l.seit)
    + (JUNG.has(l.status) ? HALT_FAMILIENBONUS_JUNG : 0);
}

/** @param {Lebenslage} l */
function eigeneFamilie(l) {
  return l.familie && !JUNG.has(l.status);
}

// --- Die Übergänge ---------------------------------------------------------

/**
 * Was nach der Schule kommt, je nachdem, wie alt einer beim Abschluss ist.
 * Das Alter ist der Proxy für die Schulart, die nirgends gespeichert wird:
 * mit 16 fertig heißt Real- oder Mittelschule und praktisch nie Student.
 * @type {Record<'frueh'|'spaet', (readonly [Status, number])[]>}
 */
const NACH_SCHULE = {
  frueh: [['student', 10], ['azubi', 65], ['arbeiter', 25]],
  spaet: [['student', 55], ['azubi', 35], ['arbeiter', 10]],
};
/** Ab diesem Abschlussalter gilt die Gymnasiums-Zeile. */
const SPAETER_ABSCHLUSS_AB = 17;

/**
 * Was nach dem Studium kommt. „student" heißt weiterstudieren (Master) — nur
 * einmal, sonst studiert einer ewig; `verlaengert` merkt es sich.
 * @type {(readonly [Status, number])[]}
 */
const NACH_STUDIUM = [['arbeiter', 65], ['student', 30], ['azubi', 5]];
/** Der Master ist kürzer als der erste Abschnitt. @type {[number, number]} */
const MASTER_JAHRE = [1, 2];

/** Was nach der Ausbildung kommt: Übernahme, selten das Fachabitur. @type {(readonly [Status, number])[]} */
const NACH_AUSBILDUNG = [['arbeiter', 88], ['student', 12]];

/** Ab wann und wie oft ein Arbeiter am Zyklusende Rentner wird — Frührente, Berufsunfähigkeit. */
const RENTNER_AB = 45;
const RENTNER_CHANCE = 0.03;

/**
 * Den Plan am Horizont kippen lassen — oder nicht. Oben wird aus Wegzug oder
 * Schluss ein Bleiben, unten aus Bleiben ein Wegzug. Den Körper redet niemand
 * weg; ein Schluss ohne Grund stammt aus einem Stand vor Version 12 und heißt
 * Körper.
 * @param {() => number} rng
 * @param {Horizont} h
 * @param {number} s Commitment-Stufe 0..4
 */
function gekippt(rng, h, s) {
  const p = KIPPEN_JE_STUFE[s];
  if (p === 0) return h.dann;
  if (s >= 3 && (h.dann === 'wegzug' || (h.dann === 'schluss' && (h.grund || 'koerper') !== 'koerper'))) {
    return rng() < p ? 'bleibt' : h.dann;
  }
  if (s <= 1 && h.dann === 'bleibt') return rng() < p ? 'wegzug' : h.dann;
  return h.dann;
}

/**
 * Der Statuswechsel selbst. Wer aufsteigt, kauft sich womöglich ein Auto —
 * ein Schüler ohne soll nicht als Arbeiter ohne enden.
 * @param {() => number} rng
 * @param {Lebenslage} l
 * @param {Status} nach
 */
function wechsle(rng, l, nach) {
  l.status = nach;
  if (!l.auto && rng() < AUTO_JE_STATUS[nach]) l.auto = true;
}

/**
 * Der Horizont ist erreicht. Ändert die Lebenslage und gibt zurück, was
 * geschah — oder den Abgang, wenn der Plan „Schluss" hieß und stand.
 * @param {() => number} rng
 * @param {Lebenslage} l
 * @param {number} s Commitment-Stufe
 * @param {number} alter
 * @param {number} jahr
 * @returns {Ereignis | null}
 */
function amHorizont(rng, l, s, alter, jahr) {
  const h = /** @type {Horizont} */ (l.horizont);
  const von = l.status;
  const dann = gekippt(rng, h, s);
  // Ein Wegzug setzt die Entfernung neu, alles andere lässt sie — auch das
  // Bleiben eines Weggezogenen: er bleibt eben dort.
  const km = dann !== 'wegzug' ? 0 : h.dann === 'wegzug' ? h.km : wegzugKm(rng, von);

  /** @type {Ereignis | null} */
  let ereignis = null;
  if (von === 'schueler') {
    const nach = pickWeighted(rng, alter >= SPAETER_ABSCHLUSS_AB ? NACH_SCHULE.spaet : NACH_SCHULE.frueh);
    wechsle(rng, l, nach);
    ereignis = { art: 'wechsel', von, nach, km };
  } else if (von === 'student') {
    const nach = pickWeighted(rng, NACH_STUDIUM.filter(([n]) => n !== 'student' || !l.verlaengert));
    if (nach === 'student') l.verlaengert = true;
    wechsle(rng, l, nach);
    ereignis = { art: 'wechsel', von, nach, km };
  } else if (von === 'azubi') {
    const nach = pickWeighted(rng, NACH_AUSBILDUNG);
    wechsle(rng, l, nach);
    ereignis = { art: 'wechsel', von, nach, km };
  } else {
    // Arbeiter und Rentner: kein Abschnitt endet, das Ereignis steht allein.
    if (dann === 'schluss') return { art: 'abgang', grund: h.grund || 'koerper' };
    if (dann === 'familie') {
      l.familie = true;
      ereignis = { art: 'familie' };
    }
    if (von === 'arbeiter' && alter >= RENTNER_AB && rng() < RENTNER_CHANCE) {
      l.status = 'rentner';
      ereignis = { art: 'wechsel', von, nach: 'rentner', km };
    }
    if (km > 0 && !ereignis) ereignis = { art: 'wegzug', km };
  }
  if (km > 0) l.entfernung = km;

  l.horizont = ziehHorizont(rng, l.status, alter, jahr, l.familie, { frisch: true, stufe: s });
  if (von === 'student' && l.status === 'student' && l.horizont) {
    l.horizont.jahr = jahr + randInt(rng, MASTER_JAHRE[0], MASTER_JAHRE[1]);
  }
  return ereignis;
}

/**
 * Ein Jahr im Leben eines Menschen im Verein. `alter` und `jahr` sind die
 * **neuen** — der Saisonwechsel ruft es, bevor er den Kader anfasst, und
 * ersetzt, wer mit `abgang` zurückkommt.
 *
 * Reihenfolge: erst der Horizont, dann die Waage. Wer am Horizont geht, wird
 * nicht mehr gewogen; wer bleibt, steht mit seiner **neuen** Lage auf der
 * Waage — der Student, der gerade 300 km weggezogen ist, sammelt schon in
 * dieser Saison sein erstes Druckjahr.
 * @param {() => number} rng
 * @param {{ commitment: number, lebenslage: Lebenslage }} person
 * @param {number} alter
 * @param {number} jahr
 * @returns {Ereignis | null}
 */
export function lebensjahr(rng, person, alter, jahr) {
  const l = person.lebenslage;
  const s = stufe(person.commitment);

  /** @type {Ereignis | null} */
  let ereignis = null;
  if (l.horizont && l.horizont.jahr <= jahr) {
    ereignis = amHorizont(rng, l, s, alter, jahr);
    if (ereignis && ereignis.art === 'abgang') return ereignis;
  } else if (!l.horizont && l.status === 'arbeiter') {
    // Ein Arbeiter ohne Plan stammt aus einem Stand vor Version 12; er
    // bekommt seinen Zyklus, damit die Uhr für ihn auch läuft.
    l.horizont = ziehHorizont(rng, 'arbeiter', alter, jahr, l.familie, { frisch: true, stufe: s });
  }

  if (druck(l) > halt(person.commitment, l, jahr)) {
    l.druckJahre = (l.druckJahre || 0) + 1;
    if (l.druckJahre >= DRUCK_JAHRE_BIS_ABGANG) {
      return { art: 'abgang', grund: eigeneFamilie(l) ? 'familie' : 'beruf' };
    }
  } else {
    l.druckJahre = 0;
  }
  return ereignis;
}
