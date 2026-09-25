// @ts-check
/**
 * Die Rolle: was ein Spieler an Einsatzzeit erwarten darf, und was es kostet,
 * ihn das Falsche erwarten zu lassen.
 *
 * Fünf Stufen, vom unangefochtenen Stammspieler bis zum Ergänzungsspieler. Sie
 * werden **gesetzt**, nie erraten — aus dem tatsächlichen Einsatzmuster eine
 * Rolle abzuleiten hieße, dem Manager eine Erwartung unterzuschieben, die er
 * nie ausgesprochen hat, und ihn anschließend dafür zu bestrafen.
 *
 * **Keine Rolle ist trotzdem kein Nullzustand.** Hier stand einmal „ohne
 * gesetzte Rolle gibt es keinen Drift — kein Hebel ohne Definition", und das
 * war richtig, solange es keinen Weg gab, eine Rolle zu setzen. Den gibt es
 * jetzt, und die Kampagne fragt bis zur Frist jeden mehrfach. Wer danach ohne
 * Rolle dasteht, ist übergangen worden — und das kostet, skaliert mit dem,
 * was er nicht spielt: wer jedes Spiel macht, weiß auch ohne Gespräch, woran
 * er ist. Siehe `vernachlaessigung()`.
 *
 * Drei Dinge stehen hier, und nur diese drei:
 *
 * 1. **Die Kampagne** — wer noch keine Rolle hat, fragt danach, und zwar in
 *    einem Tempo, das garantiert rechtzeitig fertig wird. Kein Würfel, der
 *    vielleicht reicht.
 * 2. **Die Reaktion beim Setzen** — Perzentil, Vorgeschichte, Alter.
 * 3. **Der Mismatch** — das rollierende Fenster der letzten Spiele gegen die
 *    Erwartung gehalten, mit einer Toleranz, die nach Coaching-Gruppe skaliert.
 *
 * Diese Datei kennt kein DOM, keine Texte und keinen `SpielStand` — sie
 * rechnet auf Spielern und Kadern. Was davon wann passiert, verdrahtet
 * `saison.js`.
 *
 * Docs: docs/naechste-schritte.md, Block 7, Abschnitte „Gespräche" und „Rolle"
 */

import {
  ROLLE_ERWARTUNG, ROLLE_FENSTER, ROLLE_FENSTER_MIN,
  ROLLE_TOLERANZ, ROLLE_TOLERANZ_JE_GRUPPE,
  ROLLE_MISMATCH_JE_ANTEIL, ROLLE_ERFUELLT_BONUS, ROLLE_OHNE_JE_SPIEL,
  ROLLE_BESCHWERDE_SCHWELLE, ROLLE_BESCHWERDE_COOLDOWN,
  ROLLE_JE_STUFE_ABSTAND, ROLLE_DOWNGRADE_ZUSATZ, ROLLE_AENDERUNG_ABZUG,
  ROLLE_ALTER_PERSPEKTIVE_MAX, ROLLE_ALTER_ERGAENZUNG_MIN, ROLLE_ALTER_JE_JAHR,
  ROLLE_ALTER_MAX_ABZUG, ROLLE_ALTER_BONUS, ROLLE_COOLDOWN_TAGE,
  ROLLE_PERZENTIL_GRENZEN, ROLLE_PERZENTIL_POSITION_ANTEIL,
  ROLLEN_FRIST_WOCHEN, ROLLE_ANFRAGEN_MAX,
  clamp,
} from './constants.js';
import { SPIELTAG_TAGE } from './kalender.js';
import { COACHING_GRUPPE_JE_POSITION } from './coach.js';
import { hauptPosition } from './positionen.js';

/** @typedef {import('./spieler.js').Spieler} Spieler */

/**
 * Die fünf Rollen, von der größten Zusage zur kleinsten.
 *
 * Die Reihenfolge ist die Rechengrundlage: ein Index weiter hinten ist ein
 * Downgrade. Dass Perspektiv- und Ergänzungsspieler nebeneinander stehen,
 * obwohl beide dasselbe an Einsatzzeit versprechen, ist Absicht — sie sind
 * nicht über- und untergeordnet, sie sind zwei Lesarten derselben Bank, und
 * welche passt, entscheidet das Alter.
 */
export const ROLLEN = /** @type {const} */ ([
  'unangefochten', 'starter', 'rotation', 'perspektive', 'ergaenzung',
]);

/** @typedef {'unangefochten'|'starter'|'rotation'|'perspektive'|'ergaenzung'} Rolle */

/**
 * Die Stufe einer Rolle, für Vergleiche: 0 ist die größte Zusage.
 *
 * Perspektive und Ergänzung teilen sich die 3. Wer von Perspektiv- auf
 * Ergänzungsspieler wechselt, steigt nicht ab — er bekommt ein anderes
 * Etikett auf dieselbe Bank, und der Unterschied fällt in der Altersrechnung
 * an, nicht hier.
 * @param {Rolle} rolle
 */
export function rollenStufe(rolle) {
  return Math.min(ROLLEN.indexOf(rolle), 3);
}

/** Die Rolle eines Spielers — fehlt sie, hat er noch keine. @param {Spieler} sp */
export function rolleVon(sp) {
  return /** @type {Rolle | null} */ (sp.rolle ?? null);
}

// --- Die Kampagne ----------------------------------------------------------

/**
 * Der letzte Tag, an dem die Kampagne fertig sein muss: zwei Wochen vor dem
 * ersten Spieltag. Er ist selbst ein Wochenanfang, also die letzte Gelegenheit,
 * an der noch Anfragen rausgehen.
 */
export const ROLLEN_FRIST = SPIELTAG_TAGE[0] - ROLLEN_FRIST_WOCHEN * 7;

/** Wer im Kader noch keine Rolle hat. @param {Spieler[]} kader */
export function rollenlose(kader) {
  return kader.filter((sp) => rolleVon(sp) === null);
}

/**
 * Wie viele Wochenanfänge von diesem Tag an noch in die Frist fallen, ihn
 * selbst mitgezählt. Null heißt: die Kampagne ist vorbei.
 * @param {number} tag
 */
export function verbleibendeWochen(tag) {
  if (tag > ROLLEN_FRIST) return 0;
  return Math.floor((ROLLEN_FRIST - Math.max(tag, 1)) / 7) + 1;
}

/**
 * Wie viele Spieler diese Woche gefragt werden.
 *
 * Eine Rechnung, kein Zufallstempo: was durch die verbleibenden Wochen geteilt
 * und aufgerundet wird, ist garantiert rechtzeitig durch. Führt der Manager
 * selbst Rollengespräche, schrumpft die Warteschlange, und das Tempo fällt in
 * der nächsten Woche von allein mit. Wer „später" antwortet, steht weiter drin
 * — die Frist verlängert das nicht, sie verteilt den Rest nur enger.
 *
 * Bis auf den Deckel: `ROLLE_ANFRAGEN_MAX` begrenzt, wie eng es werden kann.
 * Ohne ihn stand vor der Frist der ganze Rest an einem Tag — bei einem
 * Manager, der nie antwortet, gemessene dreißig blockierende Nachrichten auf
 * einmal. Über zwanzig Wochen wird trotzdem jeder mehrfach gefragt: was am
 * Ende ohne Rolle dasteht, ist übergangen worden und nicht übersehen — und
 * das kostet, siehe `vernachlaessigung()`.
 * @param {Spieler[]} kader @param {number} tag
 */
export function tempo(kader, tag) {
  const wochen = verbleibendeWochen(tag);
  if (wochen === 0) return 0;
  return Math.min(Math.ceil(rollenlose(kader).length / wochen), ROLLE_ANFRAGEN_MAX);
}

/**
 * Wen es diese Woche trifft — die Stärksten zuerst.
 *
 * Nach Stärke und nicht zufällig, weil die Reihenfolge eine Aussage ist: wer
 * den Kader trägt, will als Erster wissen, woran er ist, und der Manager soll
 * die teuren Entscheidungen treffen, solange er noch Gesprächskontingent hat.
 * Deterministisch obendrein — dieselbe Saison aus demselben Stand fragt
 * dieselben Leute.
 * @param {Spieler[]} kader @param {number} tag
 * @returns {Spieler[]}
 */
export function faellige(kader, tag) {
  const anzahl = tempo(kader, tag);
  if (anzahl === 0) return [];
  return rollenlose(kader)
    .slice()
    .sort((a, b) => b.staerke - a.staerke || a.id.localeCompare(b.id))
    .slice(0, anzahl);
}

// --- Die Reaktion beim Setzen ---------------------------------------------

/**
 * Das Perzentil eines Spielers im Kader: überwiegend an seiner Position, zum
 * kleineren Teil kaderweit.
 *
 * Beide Anteile, weil keiner allein trägt. Nur an der Position gemessen wäre
 * der beste von drei schwachen Kickern ein unangefochtener Stammspieler; nur
 * kaderweit gemessen wäre der zweitbeste Quarterback ein Perspektivspieler,
 * obwohl er in jedem anderen Verein spielte. Die Gewichtung steht in
 * `ROLLE_PERZENTIL_POSITION_ANTEIL`.
 *
 * 1 heißt: keiner ist besser. Ein Spieler allein auf seiner Position hat
 * deshalb positionsseitig immer die 1 — das ist richtig so, er ist ja
 * konkurrenzlos.
 * @param {Spieler[]} kader @param {Spieler} sp
 */
export function perzentil(kader, sp) {
  const anteil = (/** @type {Spieler[]} */ gruppe) => {
    if (gruppe.length <= 1) return 1;
    const schlechter = gruppe.filter((x) => x.id !== sp.id && x.staerke < sp.staerke).length;
    return schlechter / (gruppe.length - 1);
  };
  const meine = hauptPosition(sp);
  const anPosition = anteil(kader.filter((x) => hauptPosition(x) === meine));
  return ROLLE_PERZENTIL_POSITION_ANTEIL * anPosition
    + (1 - ROLLE_PERZENTIL_POSITION_ANTEIL) * anteil(kader);
}

/**
 * Welche Rolle seine Stärke im Kader erwarten ließe. Die unterste Stufe kommt
 * als `perspektive` zurück und meint die Bank — ob darauf „Perspektive" oder
 * „Ergänzung" steht, entscheidet das Alter und nicht das Perzentil.
 * @param {Spieler[]} kader @param {Spieler} sp
 * @returns {Rolle}
 */
export function erwarteteRolle(kader, sp) {
  const p = perzentil(kader, sp);
  for (const [rolle, grenze] of ROLLE_PERZENTIL_GRENZEN) {
    if (p >= grenze) return /** @type {Rolle} */ (rolle);
  }
  return 'perspektive';
}

/**
 * Was das Alter zum Etikett sagt — und nur zum Etikett.
 *
 * Gilt ausschließlich für die beiden Bank-Rollen und ist von Perzentil und
 * Vorgeschichte unabhängig: ein 34-Jähriger, der Perspektivspieler wird, hört
 * einen Plan, den es für ihn nicht mehr gibt; ein 19-Jähriger als
 * Ergänzungsspieler hört, dass man ihn aufgegeben hat. Passt es, nickt er.
 * @param {Rolle} rolle @param {number} alter
 */
export function altersPassung(rolle, alter) {
  if (rolle === 'perspektive') {
    const drueber = alter - ROLLE_ALTER_PERSPEKTIVE_MAX;
    if (drueber <= 0) return ROLLE_ALTER_BONUS;
    return -Math.min(drueber * ROLLE_ALTER_JE_JAHR, ROLLE_ALTER_MAX_ABZUG);
  }
  if (rolle === 'ergaenzung') {
    const drunter = ROLLE_ALTER_ERGAENZUNG_MIN - alter;
    if (drunter <= 0) return ROLLE_ALTER_BONUS;
    return -Math.min(drunter * ROLLE_ALTER_JE_JAHR, ROLLE_ALTER_MAX_ABZUG);
  }
  return 0;
}

/**
 * @typedef {object} Reaktion
 * @property {number} delta      Was das Gespräch am Commitment bewegt
 * @property {0|1|2|3|4} ton     Wie er es aufnimmt, für den Satz in `i18n.js`
 * @property {Rolle} erwartet    Was seine Stärke im Kader erwarten ließe
 * @property {Rolle | null} vorher
 */

/** Die Schwellen, ab denen ein Delta anders klingt. Von unten gelesen. */
const TON_GRENZEN = [-8, -2, 3, 9];

/**
 * Was ein Rollengespräch bewegt — gerechnet, ohne etwas zu ändern.
 *
 * Drei Signale, in dieser Reihenfolge und ohne einander zu kennen:
 * 1. **Perzentil.** Wie weit die gesetzte Rolle über oder unter dem liegt, was
 *    seine Stärke im Kader erwarten ließe.
 * 2. **Die Vorgeschichte.** Ein Downgrade wiegt schwerer als dieselbe
 *    Zielrolle bei einem ohne Vorgeschichte — Verlustaversion. Dazu der kleine
 *    feste Abzug dafür, dass eine Zusage zurückgenommen wird.
 * 3. **Das Alter**, nur für die beiden Bank-Rollen.
 * @param {Spieler[]} kader @param {Spieler} sp @param {Rolle} ziel
 * @returns {Reaktion}
 */
export function reaktion(kader, sp, ziel) {
  const vorher = rolleVon(sp);
  const erwartet = erwarteteRolle(kader, sp);

  // Positiv heißt: er bekommt mehr zugesagt, als seine Stärke erwarten ließe.
  let delta = (rollenStufe(erwartet) - rollenStufe(ziel)) * ROLLE_JE_STUFE_ABSTAND;

  if (vorher) {
    const abstieg = rollenStufe(ziel) - rollenStufe(vorher);
    if (abstieg > 0) delta -= abstieg * ROLLE_DOWNGRADE_ZUSATZ;
    if (vorher !== ziel) delta -= ROLLE_AENDERUNG_ABZUG;
  }

  delta += altersPassung(ziel, sp.alter);

  let ton = 0;
  for (const grenze of TON_GRENZEN) if (delta >= grenze) ton++;
  return { delta, ton: /** @type {0|1|2|3|4} */ (ton), erwartet, vorher };
}

/**
 * Ob die Rolle heute gesetzt werden darf.
 *
 * Die erste Rolle immer — sonst stünde die Kampagne vor ihrer eigenen Sperre.
 * Eine bestehende erst nach dem Cooldown: eine Rolle, die sich vor jedem
 * Spieltag nachjustieren ließe, wäre ein Regler an der Aufstellung und keine
 * Zusage, an der jemand gemessen wird.
 * @param {Spieler} sp @param {number} tag
 */
export function darfAendern(sp, tag) {
  if (rolleVon(sp) === null) return true;
  const zuletzt = sp.letzteRollenAenderung;
  if (typeof zuletzt !== 'number') return true;
  return tag - zuletzt >= ROLLE_COOLDOWN_TAGE;
}

/** Ab wann wieder — für den Satz in der Ansicht. @param {Spieler} sp */
export function wiederAb(sp) {
  const zuletzt = sp.letzteRollenAenderung;
  return typeof zuletzt === 'number' ? zuletzt + ROLLE_COOLDOWN_TAGE : null;
}

/**
 * Die Rolle setzen und das Commitment bewegen.
 *
 * Das Fenster wird dabei **nicht** geleert: die letzten Spiele sind gespielt,
 * daran ändert eine neue Zusage nichts. Wer einem Reservisten heute
 * „Stammspieler" sagt, hat damit nicht rückwirkend dafür gesorgt, dass er
 * gespielt hat — aber die neue Erwartung greift ab dem nächsten Spiel, und das
 * ist genau der Grund, warum Setzen billiger ist als Verfehlen-lassen.
 * @param {Spieler[]} kader @param {Spieler} sp @param {Rolle} ziel @param {number} tag
 * @returns {Reaktion}
 */
export function setzeRolle(kader, sp, ziel, tag) {
  const r = reaktion(kader, sp, ziel);
  sp.rolle = ziel;
  sp.letzteRollenAenderung = tag;
  if (typeof sp.commitment === 'number') {
    sp.commitment = clamp(Math.round(sp.commitment + r.delta), 0, 99);
  }
  // Eine frische Zusage hebt die alte Beschwerde auf: worüber er sich beklagt
  // hat, ist besprochen. Ohne das schwiege er nach einem Downgrade noch vier
  // Wochen, obwohl der Missstand ein neuer wäre.
  sp.rolleBeschwerde = null;
  return r;
}

// --- Der Mismatch ----------------------------------------------------------

/**
 * Ein Spiel ins rollierende Fenster buchen — 1, wenn er auflief, 0, wenn er
 * fit war und zusah.
 *
 * Wer verletzt war, kommt gar nicht erst hierher: eine Verletzung ist keine
 * Entscheidung des Managers, und sie soll die Bilanz nicht verwässern.
 * Gespeichert wird nur das eigene Team — anderswo gibt es keine Rollen, und
 * ein Fenster ohne Erwartung wäre Ballast im Speicherstand.
 * @param {Spieler} sp @param {boolean} gespielt
 */
export function verbucheSpiel(sp, gespielt) {
  const fenster = Array.isArray(sp.einsatzFenster) ? sp.einsatzFenster : [];
  fenster.push(gespielt ? 1 : 0);
  sp.einsatzFenster = fenster.slice(-ROLLE_FENSTER);
  return sp.einsatzFenster;
}

/** Welcher Anteil der letzten Spiele — oder null, solange es zu wenige sind. @param {Spieler} sp */
export function einsatzAnteil(sp) {
  const fenster = sp.einsatzFenster;
  if (!Array.isArray(fenster) || fenster.length < ROLLE_FENSTER_MIN) return null;
  return fenster.reduce((a, b) => a + b, 0) / fenster.length;
}

/** Wie viel Abweichung seine Coaching-Gruppe schluckt. @param {Spieler} sp */
export function toleranzVon(sp) {
  const gruppe = COACHING_GRUPPE_JE_POSITION[hauptPosition(sp)];
  return ROLLE_TOLERANZ + (ROLLE_TOLERANZ_JE_GRUPPE[gruppe] ?? 0);
}

/**
 * Wie sehr er übergangen wird: der Anteil der Spiele, die er **nicht**
 * bestritten hat — aber nur, solange ihm niemand eine Rolle gesagt hat.
 *
 * 0 heißt: er spielt ohnehin jedes Spiel, dann ist das Feld die Ansage und es
 * fehlt nichts. `null` heißt: er hat eine Rolle (dann rechnet `mismatch()`)
 * oder das Fenster trägt noch zu wenig.
 *
 * Keine Toleranz und keine Coaching-Gruppe: hier geht es nicht darum, ob eine
 * Zusage gehalten wird, sondern darum, dass gar keine gemacht wurde. Das ist
 * für den QB dasselbe wie für den dritten Defensive Tackle.
 * @param {Spieler} sp
 * @returns {number | null}
 */
export function vernachlaessigung(sp) {
  if (rolleVon(sp) !== null) return null;
  const anteil = einsatzAnteil(sp);
  if (anteil === null) return null;
  return 1 - anteil;
}

/**
 * Wie weit die Einsatzzeit unter der Zusage liegt, Toleranz schon abgezogen.
 *
 * 0 heißt: passt, oder er übertrifft sie. Positiv heißt: so viel Anteil fehlt
 * ihm über die Toleranz hinaus. `null` heißt: darüber lässt sich noch nichts
 * sagen — keine Rolle gesetzt, oder zu wenige Spiele im Fenster.
 *
 * Die Platzierung ist heute binär, ganzes Spiel oder gar nicht: eine
 * Aufstellung gilt fürs ganze Spiel, es gibt keinen Verlauf, in dem gewechselt
 * wird. Kommt die Rotations-Engine, ersetzt ein Bruchteil das Ja/Nein an genau
 * dieser Stelle und sonst nichts. Eine Garbage-Time-Gewichtung fehlt aus
 * demselben Grund mit Absicht.
 * @param {Spieler} sp
 * @returns {number | null}
 */
export function mismatch(sp) {
  const rolle = rolleVon(sp);
  if (!rolle) return null;
  const anteil = einsatzAnteil(sp);
  if (anteil === null) return null;
  const fehlt = ROLLE_ERWARTUNG[rolle] - anteil - toleranzVon(sp);
  return Math.max(0, fehlt);
}

/**
 * @typedef {object} Drift
 * @property {number} delta      Was sich am Commitment bewegt hat
 * @property {boolean} beschwerde  Ob er von sich aus nachfragt
 */

/**
 * Was ein gespieltes Spiel an der Bindung bewegt — der Bank-Drift.
 *
 * Zwei Richtungen, nicht eine: wer seine Rolle erfüllt oder übertrifft,
 * gewinnt einen kleinen festen Betrag. Sonst zieht der Abzug mit der
 * Abweichung, und zwar deutlich schneller, als das einmalige Downgrade-
 * Gespräch kostet — das ist die ganze Aussage dieses Bausteins.
 *
 * Die Beschwerde läuft **ohne** das Empathie-Gate der Trend-Nachrichten: ein
 * Spieler bemerkt seine eigene Bank selbst, ganz gleich, wie aufmerksam sein
 * Positionscoach ist.
 *
 * Ohne Rolle wird stattdessen die Vernachlässigung gerechnet — und **ohne**
 * Beschwerde: die Kampagne hat ihn schon gefragt, und ein zweiter Kanal, der
 * dasselbe sagt, wäre Nörgeln statt Information. Sichtbar ist es trotzdem, im
 * Personalreiter steht der Strich in der Rollenspalte neben der fallenden
 * Bindung.
 *
 * `verlustFaktor` ist die Betreuung seiner Gruppe (`drift.js`): sie gewichtet
 * jeden Abzug, nie den Bonus. Ohne Angabe 1 — die Rechnung, wie sie vor dem
 * Coach war.
 * @param {Spieler} sp @param {number} tag @param {number} [verlustFaktor]
 * @returns {Drift | null} null, solange nichts zu rechnen ist
 */
export function drift(sp, tag, verlustFaktor = 1) {
  const uebergangen = vernachlaessigung(sp);
  if (uebergangen !== null) {
    // Die Fallunterscheidung statt `-x * k` wegen der negativen Null: `-0`
    // landet sonst im Speicherstand und stolpert über jeden strikten Vergleich.
    const delta = uebergangen > 0 ? -uebergangen * ROLLE_OHNE_JE_SPIEL * verlustFaktor : 0;
    if (delta !== 0 && typeof sp.commitment === 'number') {
      sp.commitment = clamp(sp.commitment + delta, 0, 99);
    }
    return { delta, beschwerde: false };
  }

  const fehlt = mismatch(sp);
  if (fehlt === null) return null;

  if (fehlt <= 0) {
    if (typeof sp.commitment === 'number') {
      sp.commitment = clamp(sp.commitment + ROLLE_ERFUELLT_BONUS, 0, 99);
    }
    return { delta: ROLLE_ERFUELLT_BONUS, beschwerde: false };
  }

  const delta = -fehlt * ROLLE_MISMATCH_JE_ANTEIL * verlustFaktor;
  if (typeof sp.commitment === 'number') {
    sp.commitment = clamp(sp.commitment + delta, 0, 99);
  }

  const zuletzt = sp.rolleBeschwerde;
  const stumm = typeof zuletzt === 'number' && tag - zuletzt < ROLLE_BESCHWERDE_COOLDOWN;
  const beschwerde = fehlt >= ROLLE_BESCHWERDE_SCHWELLE && !stumm;
  if (beschwerde) sp.rolleBeschwerde = tag;

  return { delta, beschwerde };
}

/**
 * Was der Saisonwechsel an der Rolle zurücksetzt.
 *
 * Die Rolle selbst **bleibt** — wer eine hatte, behält sie, und nur wer nie
 * eine bekam, taucht in der Kampagne wieder auf. Zurückgesetzt werden die
 * beiden Tagesmerker: sie zählen Tage **innerhalb** einer Saison, und Tag 300
 * gegen Tag 5 des Folgejahres gehalten ergäbe eine Sperre, die rückwärts
 * läuft. Das Einsatzfenster bleibt ebenfalls stehen — die letzten Spiele einer
 * Saison sind die letzten Spiele, die er gespielt hat.
 * @param {Spieler} sp
 */
export function neueSaison(sp) {
  sp.letzteRollenAenderung = null;
  sp.rolleBeschwerde = null;
  return sp;
}
