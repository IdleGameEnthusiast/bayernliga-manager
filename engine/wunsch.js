// @ts-check
/**
 * Der Wunsch: was ein Spieler von sich aus möchte, und was es kostet, ihn zu
 * überhören.
 *
 * **Jeder Wunsch hat einen Anlass, keinen Würfelwurf.** Das ist die eine
 * Entscheidung, aus der alles andere hier folgt. Ein Spieler, der aus dem
 * Nichts heraus die Position wechseln will, liest sich als Zufallsgenerator;
 * einer, der seit sechs Spielen auf einem Platz steht, auf dem er messbar
 * schlechter ist, liest sich als Mensch. Deshalb wird ein Wunsch **gerechnet**
 * und nicht gezogen — aus den Einsätzen, der Eignung und dem Nummernband, die
 * alle ohnehin schon am Spieler stehen.
 *
 * **Gerechnet, aber gespeichert, sobald er ausgesprochen ist.** Der Anlass
 * besteht auch ungefragt; was der Manager durch das Gespräch bekommt, ist das
 * *Wissen* davon. Erst ab da zieht der Wunsch — vorher wäre es eine Strafe für
 * etwas, das niemand wissen konnte. Der ausgesprochene Wunsch steht deshalb am
 * Spieler (`wunschPlatz`, `wunschNummer`), der Anlass nur in diesen Funktionen.
 *
 * **`wunschPlatz`, nicht `wunschPosition`.** Der Fahrplan nennt das Feld nach
 * der Position; gespeichert wird trotzdem das Platz-Kürzel. Überall sonst im
 * Spiel — `einsaetze`, `hauptPlatz()`, die Marke im Roster — ist das Kürzel die
 * Einheit, in der „wo er steht" gemessen wird, und nur es trägt die Seite. Mit
 * einer Position allein wäre der Wunsch eines Left Tackle erfüllt, sobald er
 * rechts aufläuft.
 *
 * **`abgelehntePositionen` fehlt hier mit Absicht.** Das Feld gehört zum
 * Überzeugen und bekommt dort seinen Schreiber; ein Feld, das nichts füllt,
 * hätte hier nur die Speicherform verbreitert.
 *
 * Kein DOM, keine Texte, kein `SpielStand` — das verdrahtet `saison.js`.
 *
 * Docs: docs/naechste-schritte.md, Block 7, Abschnitt „Wunsch anhören"
 */

import {
  WUNSCH_EINSAETZE_MIN, WUNSCH_EIGNUNG_ABSTAND, WUNSCH_ERFUELLT_JE_SPIEL,
  WUNSCH_UEBERGANGEN_JE_SPIEL, WUNSCH_NUMMER_BONUS, WUNSCH_LEER_GEWINN, clamp,
} from './constants.js';
import {
  ausbildungsKuerzel, PLATZ_JE_KUERZEL, eignungGemischt, HAUPTPLATZ_PASSANTEIL,
} from './positionen.js';
import { einstelligKandidaten, freieEinstellige } from './spieler.js';
import { naeheAnteil } from './gespraech.js';

/** @typedef {import('./spieler.js').Spieler} Spieler */

/**
 * Ein Wunsch, wie ihn das Gespräch zurückgibt.
 *
 * Eine Art statt zweier Felder, weil der Dialog genau einen Wunsch anzeigt:
 * wer gerade zurück auf seine Position will, redet nicht über Trikotnummern.
 * @typedef {{ art: 'platz', platz: string } | { art: 'nummer', nummer: number }} Wunsch
 */

// --- Der Anlass ------------------------------------------------------------

/**
 * Ob er zurück auf seinen Ausbildungsplatz möchte — und wenn ja, auf welchen.
 *
 * Zwei Bedingungen, beide nötig: er hat **lange genug** woanders gestanden
 * (`WUNSCH_EINSAETZE_MIN`), und er ist dort **deutlich schwächer**
 * (`WUNSCH_EIGNUNG_ABSTAND`). Die zweite ist die wichtigere. Wer woanders
 * gleich gut oder besser ist, hat keinen Grund zu klagen — und wer dort besser
 * ist, den führt `hauptPlatz()` ohnehin längst als dort zu Hause, sodass gar
 * kein fremder Platz mehr existiert, auf den sich der Wunsch beziehen könnte.
 *
 * Ohne Attribute lässt sich die Eignung nicht rechnen. Dann gibt es keinen
 * Wunsch — lieber keiner als einer, der nur an den Einsatzzahlen hängt und
 * jeden Umgestellten träfe.
 * @param {Spieler} sp
 * @returns {string | null} Platz-Kürzel seiner Ausbildung, oder null
 */
export function platzAnlass(sp) {
  const heimat = ausbildungsKuerzel(sp);
  const daheim = PLATZ_JE_KUERZEL[heimat];
  if (!daheim || !sp.attribute) return null;

  // Der fremde Platz muss der sein, auf dem er **überwiegend** steht — mehr
  // Einsätze als daheim. Das ist die Bedingung, die den Wunsch auch wieder
  // beendet: wer zurückgestellt wird, holt Spiel für Spiel auf, und wenn er
  // vorbeigezogen ist, ist die Sache erledigt. Ohne sie entstünde der Anlass
  // aus denselben alten Einsätzen sofort neu, und ein erfüllter Wunsch wäre
  // ein Knopf, den man beliebig oft drücken kann.
  let fremd = null;
  let meiste = Math.max(WUNSCH_EINSAETZE_MIN, sp.einsaetze?.[heimat] ?? 0);
  for (const kuerzel in sp.einsaetze || {}) {
    if (kuerzel === heimat) continue;
    if (sp.einsaetze[kuerzel] > meiste) {
      meiste = sp.einsaetze[kuerzel];
      fremd = kuerzel;
    }
  }
  const dort = fremd === null ? null : PLATZ_JE_KUERZEL[fremd];
  if (!dort) return null;

  const abstand = eignungGemischt(sp, daheim, HAUPTPLATZ_PASSANTEIL)
    - eignungGemischt(sp, dort, HAUPTPLATZ_PASSANTEIL);
  return abstand >= WUNSCH_EIGNUNG_ABSTAND ? heimat : null;
}

/**
 * Ob er auf eine einstellige Nummer möchte — und auf welche.
 *
 * Die Bedingung ist die aus der Nummernvergabe, nur zu einem anderen
 * Zeitpunkt gestellt: er gehört zum Kreis, der einstellige Nummern überhaupt
 * bekommt (`einstelligKandidaten()`), trägt aber keine. Der Fahrplan sieht
 * dafür ein automatisches Ereignis zum Jahreswechsel vor; „Wunsch anhören"
 * prüft dieselbe Bedingung **vorzeitig**, statt darauf zu warten.
 *
 * Gewünscht wird die **kleinste** freie. Kein Zufall aus der Id wie bei
 * `borgeNummer()`: dort geht es um eine geliehene Nummer, die zwischen zwei
 * Bildern nicht springen darf, hier um eine, die er behält. Die kleinste ist
 * die, um die es im Verein tatsächlich geht, und sie macht die Knappheit
 * sichtbar — wer die 3 hergibt, hat sie nicht mehr.
 * @param {Spieler[]} kader @param {Spieler} sp
 * @returns {number | null}
 */
export function nummernAnlass(kader, sp) {
  if (sp.nummer <= 9) return null;
  if (!einstelligKandidaten(kader).some((x) => x.id === sp.id)) return null;
  const frei = freieEinstellige(kader);
  return frei.length > 0 ? Math.min(...frei) : null;
}

/**
 * Der **ausgesprochene** Wunsch, ohne den Anlass dahinter.
 *
 * Das ist die Fassung, die jeder lesen darf — die Notiz aus dem Gespräch. Der
 * Anlass ist absichtlich nicht dabei: was der Manager nicht erfragt hat, weiß
 * er nicht, und eine Ansicht, die es trotzdem zeigte, machte das Gespräch
 * überflüssig.
 * @param {Spieler} sp
 * @returns {Wunsch | null}
 */
export function ausgesprochenerWunsch(sp) {
  if (sp.wunschPlatz) return { art: 'platz', platz: sp.wunschPlatz };
  if (typeof sp.wunschNummer === 'number') return { art: 'nummer', nummer: sp.wunschNummer };
  return null;
}

/**
 * Was er heute auf dem Herzen hat, oder null.
 *
 * Reihenfolge ist Rangfolge: wo er spielt, geht vor, was auf seinem Rücken
 * steht. Ein Wunsch, der schon ausgesprochen ist, kommt wieder — der Manager
 * soll ihn nachschlagen können, ohne dafür einen zweiten Termin zu zahlen.
 * @param {Spieler[]} kader @param {Spieler} sp
 * @returns {Wunsch | null}
 */
export function wunschVon(kader, sp) {
  const platz = sp.wunschPlatz ?? platzAnlass(sp);
  if (platz) return { art: 'platz', platz };
  const nummer = sp.wunschNummer ?? nummernAnlass(kader, sp);
  return typeof nummer === 'number' ? { art: 'nummer', nummer } : null;
}

// --- Das Gespräch ----------------------------------------------------------

/**
 * @typedef {object} Auskunft
 * @property {Wunsch | null} wunsch  Was er gesagt hat
 * @property {number} delta          Was sich dabei am Commitment bewegt hat
 */

/**
 * Nachfragen, ob er einen Wunsch hat.
 *
 * Der ausgesprochene Wunsch wird am Spieler festgehalten — ab hier weiß der
 * Manager davon, und ab hier zieht er. Das Commitment bewegt sich dabei
 * **nicht**: die Kategorie informiert, die Wirkung kommt beim Erfüllen oder
 * Übergehen. Nur wenn nichts anliegt, bleibt der kleine Gewinn fürs Fragen
 * übrig, gedämpft wie das persönliche Gespräch — sonst wäre „Wunsch anhören"
 * bei einem Kader ohne Wünsche schlicht der zweite Knopf für dasselbe.
 * @param {Spieler[]} kader @param {Spieler} sp
 * @param {import('./gespraech.js').Gespraech[]} log @param {number} tag
 * @returns {Auskunft}
 */
export function frageNachWunsch(kader, sp, log, tag) {
  const wunsch = wunschVon(kader, sp);
  if (!wunsch) {
    const delta = WUNSCH_LEER_GEWINN * naeheAnteil(log, sp.id, tag);
    if (delta > 0 && typeof sp.commitment === 'number') {
      sp.commitment = clamp(sp.commitment + delta, 0, 99);
    }
    return { wunsch: null, delta };
  }

  if (wunsch.art === 'platz') sp.wunschPlatz = wunsch.platz;
  else sp.wunschNummer = wunsch.nummer;
  return { wunsch, delta: 0 };
}

/**
 * Die gewünschte Nummer hergeben.
 *
 * Trägt sie jemand anders — der Kader hat sich seit dem Gespräch bewegt —,
 * passiert nichts: eine doppelte Nummer wäre schlimmer als ein unerfüllter
 * Wunsch. Der Wunsch bleibt dann stehen und zeigt beim nächsten Aufschlagen
 * die nächste freie.
 * @param {Spieler[]} kader @param {Spieler} sp
 * @returns {number} Was sich am Commitment bewegt hat
 */
export function gibNummer(kader, sp) {
  const nummer = sp.wunschNummer;
  if (typeof nummer !== 'number') return 0;
  if (kader.some((x) => x.id !== sp.id && x.nummer === nummer)) return 0;

  sp.nummer = nummer;
  sp.wunschNummer = null;
  if (typeof sp.commitment === 'number') {
    sp.commitment = clamp(sp.commitment + WUNSCH_NUMMER_BONUS, 0, 99);
  }
  return WUNSCH_NUMMER_BONUS;
}

// --- Erfüllt oder übergangen -----------------------------------------------

/**
 * Was ein gespieltes Spiel am ausgesprochenen Positionswunsch bewegt.
 *
 * Drei Fälle:
 * - kein ausgesprochener Wunsch, oder er hat nicht gespielt → nichts. Die Bank
 *   rechnet der Rollen-Mismatch, und zweimal für denselben Nachmittag
 *   abzuziehen wäre doppelt.
 * - er stand auf dem gewünschten Platz → `WUNSCH_ERFUELLT_JE_SPIEL`, dieselbe
 *   Größenordnung wie beim Erfüllen einer Rolle.
 * - er stand wieder woanders → `WUNSCH_UEBERGANGEN_JE_SPIEL`, spürbar mehr.
 *   Der Wunsch bleibt und zählt einfach weiter; er wird nicht lauter.
 *
 * **Kein einmaliger großer Bonus fürs Erfüllen**, obwohl der Fahrplan ihn
 * nahelegt. Gemessen und verworfen: der Anlass zum Wunsch entsteht aus alten
 * Einsätzen und ist nach einem einzigen richtig besetzten Spiel noch da, also
 * wäre der Wunsch beim nächsten Nachfragen wieder da — fragen, richtig
 * aufstellen, kassieren, von vorn. Bei sechs Punkten je Runde wäre das der mit
 * Abstand beste Zug im ganzen Spiel gewesen.
 *
 * Stattdessen **endet der Wunsch, wo sein Anlass endet**: wenn er auf seinem
 * Platz genug Einsätze gesammelt hat, um den fremden zu überholen. Der Lohn
 * fürs Erfüllen ist nicht die Prämie, sondern dass der Abzug aufhört.
 *
 * `schonBelastet` kommt von der Ablehnung: hat derselbe Nachmittag schon über
 * `ueberzeugungsDrift()` gekostet, entfällt der Abzug hier. Ein Mann, der
 * zurück auf MIKE will und stattdessen auf einer Position steht, gegen die er
 * sich obendrein sperrt, hat **einen** schlechten Samstag, keine zwei. Der
 * Bonus bleibt: dass er daneben auch noch auf seinem Wunschplatz stand, kommt
 * in einer Aufstellung über beide Einheiten vor und ist dann verdient.
 * @param {Spieler} sp @param {string[]} plaetze Platz-Kürzel, auf denen er stand
 * @param {boolean} [schonBelastet] Ob die Ablehnung diesen Nachmittag schon abgerechnet hat
 * @returns {{ delta: number, erfuellt: boolean } | null}
 */
export function wunschDrift(sp, plaetze, schonBelastet = false) {
  const ziel = sp.wunschPlatz;
  if (!ziel || plaetze.length === 0) return null;

  const richtig = plaetze.includes(ziel);
  const delta = richtig
    ? WUNSCH_ERFUELLT_JE_SPIEL
    : (schonBelastet ? 0 : -WUNSCH_UEBERGANGEN_JE_SPIEL);
  if (typeof sp.commitment === 'number') {
    sp.commitment = clamp(sp.commitment + delta, 0, 99);
  }

  // Der Einsatz dieses Spiels ist schon gebucht, wenn wir hier ankommen —
  // `platzAnlass()` rechnet also mit dem Stand von heute Abend.
  const erfuellt = richtig && platzAnlass(sp) === null;
  if (erfuellt) sp.wunschPlatz = null;
  return { delta, erfuellt };
}

// Der Saisonwechsel fasst die Wünsche **nicht** an, anders als die Tagesmerker
// der Rolle. Ein Wunsch ist keine Frist: wer im Winter zurück auf seine
// Position wollte, will es im Frühjahr immer noch. Er endet, wenn er erfüllt
// wird — und der Anlass dahinter verschwindet von selbst, sobald die Einsätze
// auf dem fremden Platz unter `WUNSCH_EINSAETZE_MIN` verfallen sind.
