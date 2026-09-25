// @ts-check
/**
 * Die Drift: was das Commitment bewegt, ohne dass der Manager mit jemandem
 * redet — der Coach, die Verletzung, der Erfolg, die Jahre im Verein. Und die
 * Nachricht, mit der ein Coach meldet, dass sich bei einem etwas verschoben
 * hat.
 *
 * Die Bank steht nicht hier, sondern in `rolle.js`: sie hängt an einer Zusage
 * des Managers und läuft nur beim eigenen Verein. Was hier steht, trifft
 * **jeden Verein** — verletzt wird überall, verloren auch, und ein KI-Verein,
 * der drei Spiele in Folge verliert, soll seine Leute genauso verlieren können
 * wie der eigene. Sonst hält die Symmetrie der Waage nicht.
 *
 * **Der Coach ist kein eigener Posten, sondern ein Faktor** auf jeden Verlust.
 * Die Betreuung einer Gruppe — Empathie und Kommunikation ihres Coaches, über
 * `gruppenWert()` auf die Gruppen verteilt, die er coachen muss — mildert oder
 * verstärkt, was die anderen Treiber kosten. Gewinne bleiben unberührt: ein
 * guter Coach hält die Leute, er verdoppelt nicht den Lohn einer erfüllten
 * Rolle.
 *
 * Die **Trend-Nachricht** läuft über dieselbe Betreuung: sie ist die
 * Wahrscheinlichkeit, dass der Coach einen Stufenwechsel bemerkt und sagt.
 * Vier Versuche — einer gleich nach dem Anlass, die anderen an den folgenden
 * Wochenanfängen —, und trifft keiner, wird der Wechsel nie gemeldet. Ohne
 * Positionscoaches passiert das mit vier von fünf Wechseln. Gewollt: das ist
 * der Malus dafür, dass niemand die Gruppe betreut, und er gilt, bis es
 * Positionscoaches gibt.
 *
 * Diese Datei kennt kein DOM, keine Texte und keinen `SpielStand` — sie rechnet
 * auf Spielern, Kadern und Stäben. Was wann passiert, verdrahtet `saison.js`.
 *
 * Docs: docs/naechste-schritte.md, Block 7, „Was den Wert bewegt"
 */

import {
  BETREUUNG_FAKTOR_OHNE, BETREUUNG_FAKTOR_BESTE,
  VERLETZUNG_JE_WOCHE, VERLETZUNG_FAKTOR_FAMILIE, VERLETZUNG_FAKTOR_ARBEITER,
  ERFOLG_SERIE_SCHWELLE, ERFOLG_SERIE_ABZUG,
  VEREINSJAHR_BONUS, COMMITMENT_VEREINSJAHRE_MAX, TREND_VERSUCHE,
  MAX_RATING, clamp,
} from './constants.js';
import { stufe } from './commitment.js';
import { eigeneFamilie } from './lebenslauf.js';
import { COACHING_GRUPPE_JE_POSITION, gruppenWert } from './coach.js';
import { hauptPosition } from './positionen.js';
import { partienVonTeam, sieger } from './spielplan.js';

/** @typedef {import('./spieler.js').Spieler} Spieler */
/** @typedef {import('./coach.js').Coach} Coach */

// --- Die Betreuung ---------------------------------------------------------

/** Die Coaching-Gruppe, in der er trainiert — nach seinem Hauptplatz. @param {Spieler} sp */
export function gruppeVon(sp) {
  return COACHING_GRUPPE_JE_POSITION[hauptPosition(sp)];
}

/**
 * Wie gut eine Gruppe betreut wird, 0 bis `MAX_RATING`: der Schnitt aus
 * Empathie und Kommunikation ihres Coaches, beide verdünnt. Beide, weil es
 * beides braucht — die Empathie, um zu merken, dass einer wegdriftet, und die
 * Kommunikation, um mit ihm und darüber zu reden.
 * @param {Coach[] | undefined} stab @param {string} gruppe
 */
export function betreuung(stab, gruppe) {
  return (gruppenWert(stab, gruppe, (c) => c.soft.empathie)
    + gruppenWert(stab, gruppe, (c) => c.soft.kommunikation)) / 2;
}

/**
 * Womit ein Verlust für diesen Spieler malgenommen wird: 1,4 ohne jede
 * Betreuung, 0,6 bei der bestmöglichen, linear dazwischen.
 * @param {Coach[] | undefined} stab @param {Spieler} sp
 */
export function verlustFaktor(stab, sp) {
  const anteil = betreuung(stab, gruppeVon(sp)) / MAX_RATING;
  return BETREUUNG_FAKTOR_OHNE + (BETREUUNG_FAKTOR_BESTE - BETREUUNG_FAKTOR_OHNE) * anteil;
}

/**
 * Einen Verlust abbuchen, mit der Betreuung seiner Gruppe gewichtet.
 * @param {Spieler} sp @param {Coach[] | undefined} stab @param {number} betrag  positiv
 * @returns {number} was sich bewegt hat, negativ
 */
export function verliere(sp, stab, betrag) {
  if (typeof sp.commitment !== 'number' || betrag <= 0) return 0;
  const delta = -betrag * verlustFaktor(stab, sp);
  sp.commitment = clamp(sp.commitment + delta, 0, 99);
  return delta;
}

// --- Verletzung ------------------------------------------------------------

/**
 * Ob in der Woche vor diesem Wochenanfang ein verletzter Tag lag.
 *
 * Gefragt wird nach der **vergangenen** Woche und nicht nach heute: eine
 * Verletzung von einer Woche beginnt am Spieltag, und am nächsten
 * Wochenanfang ist sie schon vorbei. Fragte man nach heute, kostete sie nichts,
 * und jede längere eine Woche zu wenig. So zählt jede angebrochene Woche.
 * @param {Spieler} sp @param {number} tag
 */
export function warVerletzt(sp, tag) {
  return sp.verletztBis > 0 && sp.verletztBis > tag - 7;
}

/**
 * Was eine verletzte Woche ihn kostet, vor der Betreuung: wer eine eigene
 * Familie hat oder arbeiten muss, rechnet schneller nach, ob sich das noch
 * lohnt. Beides trifft sich multiplikativ, wie die Faktoren der Waage.
 * @param {Spieler} sp
 */
export function verletzungsLast(sp) {
  const l = sp.lebenslage;
  if (!l) return VERLETZUNG_JE_WOCHE;
  return VERLETZUNG_JE_WOCHE
    * (eigeneFamilie(l) ? VERLETZUNG_FAKTOR_FAMILIE : 1)
    * (l.status === 'arbeiter' ? VERLETZUNG_FAKTOR_ARBEITER : 1);
}

/**
 * Die Woche eines Verletzten abrechnen.
 *
 * Die Betreuung, die das Konzept einmal vorsah — Physio, Kontakt zum Arzt —,
 * gibt es noch nicht; sie kommt mit den Finanzen und wird dann ein weiterer
 * Faktor hier. Bis dahin mildert nur der Coach.
 * @param {Spieler} sp @param {Coach[] | undefined} stab @param {number} tag
 */
export function verletzungsDrift(sp, stab, tag) {
  return warVerletzt(sp, tag) ? verliere(sp, stab, verletzungsLast(sp)) : 0;
}

// --- Erfolg ----------------------------------------------------------------

/**
 * Wie viele Spiele ein Verein zuletzt in Folge verloren hat. Gezählt wird über
 * den Spielplan der laufenden Saison, Playoffs eingeschlossen; eine gewertete
 * Niederlage ist eine Niederlage.
 * @param {import('./spielplan.js').Partie[]} plan @param {string} teamId
 */
export function niederlagenInFolge(plan, teamId) {
  const gespielt = partienVonTeam(plan, teamId)
    .filter((p) => p.ergebnis)
    .sort((a, b) => a.tag - b.tag);
  let serie = 0;
  for (let i = gespielt.length - 1; i >= 0; i--) {
    if (sieger(gespielt[i]) === teamId) break;
    serie++;
  }
  return serie;
}

/**
 * Nach einem Spiel: ob die Serie gerade die Schwelle erreicht hat — und wenn,
 * den ganzen Kader dafür zahlen lassen.
 *
 * **Der ganze Kader**, auch wer verletzt ist, anders als bei der Bank: dort
 * geht es um die eigene Einsatzzeit, hier um den Verein. Wer mit einem Gips zu
 * Hause sitzt, liest die Tabelle genauso — und kehrt lieber zu einem Verein
 * zurück, der gewinnt.
 *
 * Nur beim **Erreichen**, nicht bei jedem weiteren Spiel: sonst liefe der
 * Abzug bei einem Verein, der ohnehin untergeht, ohne Boden weiter. Reißt die
 * Serie und beginnt neu, zählt sie neu.
 *
 * Die Serie ist der einzige Erfolgs-Treiber. Verpasste Playoffs standen hier
 * auch und sind nach der Messung heraus: acht von zwölf Vereinen verpassen sie
 * jedes Jahr, und was den Normalfall bestraft, misst keinen Misserfolg.
 * @param {Spieler[]} kader @param {Coach[] | undefined} stab
 * @param {import('./spielplan.js').Partie[]} plan @param {string} teamId
 * @returns {boolean} ob sie gegriffen hat
 */
export function serienDrift(kader, stab, plan, teamId) {
  if (niederlagenInFolge(plan, teamId) !== ERFOLG_SERIE_SCHWELLE) return false;
  for (const sp of kader) verliere(sp, stab, ERFOLG_SERIE_ABZUG);
  return true;
}

// --- Vereinsjahre ----------------------------------------------------------

/**
 * Was ein weiteres Jahr im Verein am Wert hebt: jedes Jahr gleich viel, bis
 * zum zehnten. Gewonnen wird ungedämpft — die Betreuung wirkt nur auf
 * Verluste.
 * @param {Spieler} sp @param {number} jahr  das **neue** Jahr
 * @returns {number} was sich bewegt hat
 */
export function vereinsjahr(sp, jahr) {
  const l = sp.lebenslage;
  if (typeof sp.commitment !== 'number' || !l) return 0;
  const jahre = jahr - l.seit;
  if (jahre < 1 || jahre > COMMITMENT_VEREINSJAHRE_MAX) return 0;
  sp.commitment = clamp(sp.commitment + VEREINSJAHR_BONUS, 0, 99);
  return VEREINSJAHR_BONUS;
}

// --- Die Trend-Nachricht ---------------------------------------------------

/**
 * @typedef {object} Trend
 * @property {0|1|2|3|4} von   die Stufe, die der Manager zuletzt kannte
 * @property {0|1|2|3|4} nach  die, auf der er jetzt steht
 */

/**
 * Was der Manager über seine Stufe schon weiß: alles. Nach einem Gespräch hat
 * er es selbst gesehen, und nach einer gemeldeten oder aufgegebenen Meldung
 * gibt es nichts mehr zu sagen.
 * @param {Spieler} sp
 */
export function stufeBekannt(sp) {
  if (typeof sp.commitment !== 'number') return;
  sp.commitmentStufeGemeldet = stufe(sp.commitment);
  sp.commitmentTrendVersuche = 0;
}

/**
 * Ein Versuch des Coaches, einen Stufenwechsel zu bemerken.
 *
 * Die Chance ist die Betreuung selbst, als Anteil am Dach. Trifft der Wurf,
 * kommt die Nachricht, und die neue Stufe gilt als bekannt. Trifft er nicht,
 * zählt der Versuch; nach `TREND_VERSUCHE` gilt sie ebenfalls als bekannt,
 * ohne dass es jemand gesagt hätte — sonst würfelte der Coach bis ans Ende
 * aller Tage, und irgendwann träfe er.
 *
 * Wer zwischen zwei Versuchen zurück auf die bekannte Stufe fällt, hat keinen
 * Wechsel mehr, und die Zählung beginnt beim nächsten von vorn. Wer weiter
 * springt, bekommt dafür keine neuen Versuche: für den Coach ist es derselbe
 * Mann, der sich seit Wochen verändert.
 *
 * Ein Spieler ohne gemeldete Stufe — frisch, oder aus einem Stand vor dem Feld
 * — bekommt die heutige als bekannt. Der Manager sieht sie im Personalreiter
 * ohnehin; eine Meldung über einen Wechsel, den niemand erlebt hat, wäre
 * erfunden.
 * @param {Spieler} sp @param {Coach[] | undefined} stab @param {() => number} rng
 * @returns {Trend | null}
 */
export function trendVersuch(sp, stab, rng) {
  if (typeof sp.commitment !== 'number') return null;
  const jetzt = stufe(sp.commitment);
  if (typeof sp.commitmentStufeGemeldet !== 'number') {
    stufeBekannt(sp);
    return null;
  }
  const bekannt = /** @type {0|1|2|3|4} */ (sp.commitmentStufeGemeldet);
  if (jetzt === bekannt) {
    sp.commitmentTrendVersuche = 0;
    return null;
  }
  if (rng() < betreuung(stab, gruppeVon(sp)) / MAX_RATING) {
    stufeBekannt(sp);
    return { von: bekannt, nach: jetzt };
  }
  sp.commitmentTrendVersuche = (sp.commitmentTrendVersuche || 0) + 1;
  if (sp.commitmentTrendVersuche >= TREND_VERSUCHE) stufeBekannt(sp);
  return null;
}
