// @ts-check
/**
 * Die Ablehnung und das Überzeugen: der eine Fall, in dem ein Spieler eine
 * Position **nicht** spielen will — und was es kostet, ihn doch dorthin zu
 * bringen.
 *
 * Dies ist die Gegenseite von [`wunsch.js`](wunsch.js). Dort will der Spieler
 * etwas vom Manager, hier der Manager etwas vom Spieler. Beide Male hängt
 * alles an derselben Grundentscheidung: **es wird gerechnet, nicht gewürfelt.**
 *
 * **Warum eine Ablehnung überhaupt selten sein muss.** Kaderplanung und das
 * Umschulen von Spielern sind ein Kern dieses Spiels. Ein Modell, in dem
 * Spieler sich regelmäßig weigern, nimmt genau diesen Kern weg — der Fahrplan
 * nennt Positionsverweigerung deshalb ausdrücklich einen seltenen
 * Ausnahmefall und keine Mechanik, die bei jeder Umstellung zieht. Drei
 * Bedingungen müssen hier zusammenkommen, und jede einzelne davon ist
 * gewöhnlich nicht erfüllt:
 *
 * 1. **Er ist wer.** Zweieinhalb Saisons Einsätze auf seinem Hauptplatz
 *    (`UEBERZEUGEN_HEIMAT_MIN`). Ein Neuzugang tut, was man ihm sagt.
 * 2. **Der Weg ist weit.** Mindestens eine Coaching-Gruppe dazwischen. Vom
 *    linken auf den rechten Tackle beschwert sich niemand.
 * 3. **Er ist ohnehin unzufrieden** (`UEBERZEUGEN_HALT_GRENZE`). Wer gern da
 *    ist, probiert es.
 *
 * Die dritte Bedingung ist die wichtigste, weil sie die Ablehnung zu einer
 * **Folge der Führung** macht statt zu einer Eigenschaft, die ein Spieler
 * gezogen bekommt. Ein Würfelwurf hätte dasselbe Feld gefüllt und dem Manager
 * nichts erzählt.
 *
 * **Ein Feld, drei Bedeutungen.** `abgelehntePositionen` ist eine Abbildung
 * Position → Fortschritt. Kein Eintrag heißt: war nie ein Thema. Ein Wert
 * unter 1 heißt: er sperrt sich, und so weit hat der Manager ihn schon. Eine 1
 * heißt: überzeugt, die Sache ist ein für alle Mal erledigt. Der erledigte
 * Eintrag bleibt stehen, und das ist Absicht — ohne ihn entstünde die
 * Ablehnung im nächsten Spiel aus denselben drei Bedingungen sofort neu, und
 * die fünf Gespräche wären weg. Zwei Felder (eine Menge und ein Zähler
 * daneben) wären dieselbe Information zweimal, und zwei Wahrheiten über
 * dieselbe Sache laufen auseinander.
 *
 * **Positionen, nicht Plätze** — anders als beim Wunsch. Der Wunsch trägt die
 * Seite, weil ein Left Tackle zurück nach links will; eine Ablehnung, die `LG`
 * verweigert und `RG` zulässt, wäre albern. Es ist dieselbe Arbeit.
 *
 * Kein DOM, keine Texte, kein `SpielStand` — das verdrahtet `saison.js`.
 *
 * Docs: docs/naechste-schritte.md, Block 7, Abschnitt „Überzeugen"
 */

import {
  UEBERZEUGEN_HEIMAT_MIN, UEBERZEUGEN_HALT_GRENZE, UEBERZEUGEN_ABGELEHNT_JE_SPIEL,
  UEBERZEUGEN_SCHRITT, UEBERZEUGEN_KOSTEN, UEBERZEUGEN_HALT_MIN, UEBERZEUGEN_HALT_MAX,
  clamp,
} from './constants.js';
import {
  POSITION_JE_KUERZEL, positionsNaehe, hauptPlatz, hauptPosition, einsaetzeAuf,
  TRANSFER_EINHEIT,
} from './positionen.js';

/** @typedef {import('./spieler.js').Spieler} Spieler */

/** Erledigt. Ein Eintrag mit diesem Wert sperrt nichts mehr und kommt nie wieder. */
export const UEBERZEUGT = 1;

// --- Der Anlass ------------------------------------------------------------

/**
 * Ob er sich gegen die Position sperren würde, auf der er gerade gestanden
 * hat — die drei Bedingungen aus dem Kopf dieser Datei.
 *
 * Gemessen wird gegen seinen **Hauptplatz**, nicht gegen die Ausbildung. Wer
 * nach drei Saisons als Defensive End im Roster als Defensive End geführt
 * wird, ist einer, und der Weg zurück auf seine gelernte Position ist von dort
 * aus genauso weit wie jeder andere. Die Ausbildung wäre eine Heimat, die er
 * selbst längst nicht mehr so sieht.
 * @param {Spieler} sp @param {string} kuerzel Platz-Kürzel, auf dem er stand
 * @returns {string | null} Die Position, gegen die er sich sperrt, oder null
 */
export function ablehnungsAnlass(sp, kuerzel) {
  const position = POSITION_JE_KUERZEL[kuerzel];
  const daheim = hauptPlatz(sp);
  if (!position || position === POSITION_JE_KUERZEL[daheim]) return null;

  // Die Nachbarposition derselben Gruppe fällt hier heraus: Guard nach Tackle
  // ist eine Umstellung, keine Zumutung. Erst ab der nächsten Stufe wird aus
  // „ungewohnt" ein „das bin ich nicht".
  if (positionsNaehe(hauptPosition(sp), position) > TRANSFER_EINHEIT) return null;

  if (einsaetzeAuf(sp, daheim) < UEBERZEUGEN_HEIMAT_MIN) return null;
  if (typeof sp.commitment !== 'number' || sp.commitment >= UEBERZEUGEN_HALT_GRENZE) return null;
  return position;
}

/**
 * Die Positionen, gegen die er sich **noch** sperrt. Überzeugtes zählt nicht
 * mehr mit, auch wenn der Eintrag stehen bleibt.
 * @param {Spieler} sp
 * @returns {string[]}
 */
export function offeneAblehnungen(sp) {
  const alle = sp.abgelehntePositionen || {};
  return Object.keys(alle).filter((p) => alle[p] < UEBERZEUGT);
}

/** @param {Spieler} sp @param {string} position */
export function lehntAb(sp, position) {
  return (sp.abgelehntePositionen?.[position] ?? UEBERZEUGT) < UEBERZEUGT;
}

// --- Was ein Spiel daran bewegt --------------------------------------------

/**
 * @typedef {object} Widerstand
 * @property {string} position  Um welche es geht
 * @property {number} delta     Was sich am Commitment bewegt hat (≤ 0)
 * @property {boolean} neu      Erst in diesem Spiel entstanden
 */

/**
 * Was ein gespieltes Spiel am Widerstand bewegt: die Ablehnung entsteht, oder
 * sie kostet.
 *
 * **Sie entsteht nach dem Spiel, nicht davor.** Der Manager kann nicht wissen,
 * dass dieser Mann bei dieser Umstellung dichtmacht — er kann nur wissen, dass
 * er unzufrieden ist und lange auf seinem Platz stand, und beides steht im
 * Personalreiter. Das erste Spiel ist deshalb frei: er hat es gespielt und
 * hinterher gesagt, was er davon hält. Ab dem zweiten kostet es.
 *
 * **Höchstens eine Position je Nachmittag.** Wer in Offense und Defense steht,
 * zahlt trotzdem einmal — derselbe Grundsatz wie beim Bank-Drift und beim
 * Wunsch: ein Nachmittag, ein Abzug.
 *
 * **Wer dort zu Hause angekommen ist, sperrt sich nicht mehr.** Kippt sein
 * Hauptplatz auf die abgelehnte Position, ist die Umschulung eine Tatsache und
 * der Eintrag wird stillschweigend erledigt. Das ist der zweite Weg neben dem
 * Überzeugen, und er ist der teure: er kostet jedes Spiel bis dahin. Ohne ihn
 * liefe der Abzug weiter, während der Roster ihn längst als das führt, wogegen
 * er sich angeblich wehrt.
 * @param {Spieler} sp @param {string[]} plaetze Platz-Kürzel, auf denen er stand
 * @returns {Widerstand | null}
 */
export function ueberzeugungsDrift(sp, plaetze) {
  const daheim = hauptPosition(sp);
  for (const kuerzel of plaetze) {
    const position = POSITION_JE_KUERZEL[kuerzel];
    if (!position) continue;

    if (lehntAb(sp, position)) {
      if (position === daheim) {
        /** @type {Record<string, number>} */ (sp.abgelehntePositionen)[position] = UEBERZEUGT;
        continue;
      }
      if (typeof sp.commitment === 'number') {
        sp.commitment = clamp(sp.commitment - UEBERZEUGEN_ABGELEHNT_JE_SPIEL, 0, 99);
      }
      return { position, delta: -UEBERZEUGEN_ABGELEHNT_JE_SPIEL, neu: false };
    }

    if (sp.abgelehntePositionen?.[position] === undefined
      && ablehnungsAnlass(sp, kuerzel) !== null) {
      if (!sp.abgelehntePositionen) sp.abgelehntePositionen = {};
      sp.abgelehntePositionen[position] = 0;
      return { position, delta: 0, neu: true };
    }
  }
  return null;
}

// --- Das Gespräch ----------------------------------------------------------

/**
 * @typedef {object} Zureden
 * @property {number} delta        Was das Drängen gekostet hat (≤ 0)
 * @property {boolean} ueberzeugt  Ob er ab jetzt mitgeht
 * @property {0|1|2} ton           Wie es ankam, für den Satz in `i18n.js`
 */

/** Ab welchem Fortschritt es anders klingt. Von unten gelesen. */
const TON_GRENZEN = [0.45, UEBERZEUGT];

/**
 * Wie schnell er sich bewegen lässt. Zwei Faktoren, beide aus dem Fahrplan:
 * der Halt und die Nähe der Positionen zueinander.
 *
 * Die Nähe ist dieselbe Stufenleiter, nach der die Engine auch den
 * Technikverlust rechnet (`positionsNaehe()`). Das ist kein Zufall und kein
 * Zweitnutzen: die Frage ist beide Male dieselbe — wie weit ist der Weg von
 * hier nach dort? Eine eigene Tabelle daneben hätte sich irgendwann
 * widersprochen, und dann wäre eine Umschulung leicht zu verkaufen und schwer
 * zu spielen gewesen, oder umgekehrt.
 * @param {Spieler} sp @param {string} position
 */
export function ueberzeugungsSchritt(sp, position) {
  const halt = typeof sp.commitment === 'number' ? sp.commitment : 0;
  const haltFaktor = UEBERZEUGEN_HALT_MIN
    + (UEBERZEUGEN_HALT_MAX - UEBERZEUGEN_HALT_MIN) * (halt / 99);
  return UEBERZEUGEN_SCHRITT * haltFaktor * positionsNaehe(hauptPosition(sp), position);
}

/**
 * Einmal auf ihn einreden.
 *
 * Kostet immer etwas, auch wenn es zieht — „zu forsches Drängen" ist das
 * Risiko dieser Kategorie, und ein Gespräch, in dem der Manager etwas **will**,
 * ist keines von der Sorte, nach der man aufgeräumter aus der Kabine geht. Wer
 * einen Mann quer über das Feld reden will, zahlt dafür in derselben Währung,
 * die er sich davon verspricht.
 *
 * Gibt `null` zurück, wenn es nichts zu überzeugen gibt — dann ist auch kein
 * Termin verbraucht. Anders als beim Wunsch ist das kein verlorener
 * Nachmittag, sondern ein Aufruf, den es nicht geben dürfte: die Kategorie ist
 * im Dialog gar nicht sichtbar, solange keine Ablehnung offen ist.
 * @param {Spieler} sp @param {string} position
 * @returns {Zureden | null}
 */
export function ueberzeuge(sp, position) {
  if (!lehntAb(sp, position)) return null;
  const alle = /** @type {Record<string, number>} */ (sp.abgelehntePositionen);

  const fortschritt = Math.min(UEBERZEUGT, alle[position] + ueberzeugungsSchritt(sp, position));
  alle[position] = fortschritt;

  const delta = -UEBERZEUGEN_KOSTEN;
  if (typeof sp.commitment === 'number') {
    sp.commitment = clamp(sp.commitment + delta, 0, 99);
  }

  let ton = 0;
  for (const grenze of TON_GRENZEN) if (fortschritt >= grenze) ton++;
  return { delta, ueberzeugt: fortschritt >= UEBERZEUGT, ton: /** @type {0|1|2} */ (ton) };
}

// Der Saisonwechsel fasst die Ablehnungen **nicht** an, so wenig wie die
// Wünsche. Wer im Herbst gesagt hat, dass er kein Guard ist, sagt es im
// Frühjahr wieder — und der Fortschritt, den fünf Gespräche gekostet haben,
// wäre mit einem jährlichen Reset zweimal zu bezahlen. Verfallen tut allein
// der Anlass, und zwar von selbst: `EINSATZ_VERFALL` zehrt die Einsätze auf
// seinem alten Hauptplatz ab, bis er dort keiner mehr ist.
