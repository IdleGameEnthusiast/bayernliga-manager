// @ts-check
/**
 * Nach der Lebenslage fragen: wann einer die Wahrheit sagt, und was dann in
 * der Akte steht.
 *
 * Die anderen vier Gesprächskategorien verdrahten etwas, das ohnehin im Stand
 * liegt — eine Rolle, ein Wunsch, eine Ablehnung, ein bisschen Nähe. Hier tritt
 * als Einzigem eine **zweite, versteckte Wahrheit** neben den Plan, und deshalb
 * steht sie am Ende des Blocks: es ist keine neue Verdrahtung, sondern ein
 * neuer Zustand.
 *
 * Drei Entscheidungen tragen das:
 *
 * - **Vor `wissbarAb` lügt niemand.** Ein Student mit Vier-Jahres-Plan weiß am
 *   Tag der Einschreibung nicht, dass er in Jahr zwei abbricht — er entscheidet
 *   sich unterwegs. Das Gespräch bestätigt dann ehrlich den Plan, und die
 *   verworfene Alternative (eine Wurfchance auf „er verschweigt es") bleibt
 *   verworfen: sie machte aus einer Frage nach dem Leben ein Verhör mit
 *   Trefferwahrscheinlichkeit.
 * - **Ab `wissbarAb` rückt er verlässlich damit heraus.** Kein zweiter Wurf,
 *   keine Abhängigkeit vom Commitment. Wer fragt, bekommt die Antwort; das
 *   Risiko liegt allein im Zeitpunkt, und das reicht als Spannung.
 * - **Die Enthüllung überschreibt den Plan.** Danach gibt es nur noch eine
 *   Zukunft, und sie steht in der Akte. Die Alternative — beides nebeneinander
 *   anzeigen — hätte einen dritten Zustand in jede Ansicht getragen, für einen
 *   Unterschied, der nach dem Gespräch niemanden mehr interessiert.
 *
 * Was der Manager davon hat, ist **Vorlauf**: er erfährt zwei Jahre vor dem
 * Wegzug, dass es einen gibt, und hat damit Zeit, am Commitment zu arbeiten —
 * denn am Horizont kippt `gekippt()` in `lebenslauf.js` einen Wegzug bei hoher
 * Stufe noch in ein Bleiben. Die Kette ist also: fragen, erfahren, handeln.
 *
 * Docs: docs/naechste-schritte.md, Block 7, „Nach Lebenslage fragen — der
 * Zeitpunkt einer Enthüllung"
 */

/** @typedef {import('./commitment.js').Lebenslage} Lebenslage */
/** @typedef {import('./commitment.js').Horizont} Horizont */

/**
 * Was bei der Frage herauskam. `ton` ist, was der Dialog daraus macht: 0 — es
 * bleibt beim Plan, 1 — er sagt etwas anderes als bisher.
 *
 * Dass Ton 0 zwei verschiedene Fälle zusammenfasst (es gibt nichts zu erfahren
 * / es gibt etwas, aber er weiß es noch nicht selbst), ist Absicht: könnte der
 * Manager die beiden unterscheiden, wäre die Frage „hat er ein Geheimnis?"
 * beantwortet, ohne dass das Geheimnis fällt.
 * @typedef {{ ton: 0|1, horizont: Horizont | null }} Auskunft
 */

/**
 * Ob er es in diesem Jahr selbst weiß — und damit sagen würde, wenn man fragt.
 * @param {Lebenslage} l
 * @param {number} jahr
 */
export function weissEsSelbst(l, jahr) {
  const w = l.horizontWahrheit;
  return !!w && jahr >= (w.wissbarAb ?? w.jahr);
}

/**
 * Die Wahrheit rückt an die Stelle des Plans, und `wissbarAb` fällt weg — es
 * ist ein Feld der Verborgenheit, und die ist vorbei.
 *
 * Zwei Wege führen hierher, und das ist Absicht: das Gespräch, und der
 * Kalender. Läuft das geplante Jahr ab, ohne dass das Ereignis eintritt, war
 * der Plan sichtbar falsch, und der Spieler kann ihn nicht weiter erzählen —
 * dann erfährt es auch der, der nie gefragt hat. Wer fragt, erfährt es
 * **früher**; er erfährt es nicht als Einziger. Das ist der Unterschied
 * zwischen einem Vorsprung und einem Geheimnis, und ein Manager, dem sein
 * Spieler drei Jahre lang „noch dieses Jahr Studium" erzählt, hielte das
 * Zweite für einen Fehler im Spiel.
 * @param {Lebenslage} l
 */
export function uebernimmWahrheit(l) {
  const wahrheit = /** @type {Horizont} */ (l.horizontWahrheit);
  delete wahrheit.wissbarAb;
  l.horizont = wahrheit;
  l.horizontWahrheit = null;
  return wahrheit;
}

/**
 * Ihn nach seiner Lebenslage fragen. Verändert den Stand nur im einen Fall, in
 * dem es etwas zu verändern gibt.
 * @param {{ lebenslage?: Lebenslage }} person
 * @param {number} jahr
 * @returns {Auskunft}
 */
export function frageNachLebenslage(person, jahr) {
  const l = person.lebenslage;
  if (!l) return { ton: 0, horizont: null };
  if (!weissEsSelbst(l, jahr)) return { ton: 0, horizont: l.horizont };
  return { ton: 1, horizont: uebernimmWahrheit(l) };
}
