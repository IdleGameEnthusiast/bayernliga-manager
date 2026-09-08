// @ts-check
/**
 * Ziehen: einen Mann mit dem Zeiger auf einen Platz legen.
 *
 * Das ist eine **Zugabe**, kein Ersatz. Die zwei Tipps bleiben der Hauptweg —
 * warum, steht in [`aufstellung.js`](aufstellung.js) —, und wer nur tippt,
 * merkt von diesem Modul nichts. Es kommt hinzu, weil „nimm den und stell ihn
 * dorthin" mit einer Maus genau eine Bewegung ist und mit zwei Tipps zwei.
 *
 * **Pointer Events, nicht HTML5-Drag-and-drop.** `draggable` samt `dragstart`
 * wäre kürzer, kennt aber auf iOS und Android keinen Finger: dort zieht nur,
 * wer vorher lange drückt, und auch dann nicht in jeder Ansicht. Pointer
 * Events liefern für Maus, Finger und Stift dieselben Ereignisse, also steht
 * hier **eine** Zustandsmaschine statt zweier, die auseinanderlaufen.
 *
 * **Der Anfang ist der einzige Unterschied zwischen Maus und Finger**, und er
 * muss es sein: die Liste links scrollt. Die Maus zieht, sobald sie die
 * Schwelle überschritten hat; der Finger muss erst kurz liegen bleiben. Ohne
 * das Halten wäre jedes Wischen über der Liste ein angefangener Zug, und die
 * Liste ließe sich auf dem iPad nicht mehr bewegen — das Gerät, für das die
 * Ansicht gebaut ist, verlöre ihre Bedienung an eine Zugabe. Wandert der
 * Finger, bevor er lag, war es ein Wischen und der Zug ist vergessen.
 *
 * **Kein `setPointerCapture`.** Die Zeiger laufen ohnehin alle durch `window`;
 * eine Aufnahme auf eine Zeile, die der nächste Neuaufbau wegwirft, wäre nur
 * ein zweiter Weg zum selben Ziel — und ein synthetischer Zeiger lässt sich
 * gar nicht aufnehmen, womit der Rauchtest nichts mehr ziehen könnte.
 *
 * **Wohin gelegt werden darf, sagt das DOM.** Ein Element mit `data-ziel` ist
 * ein Ziel, sein Wert ist der Platzschlüssel. Dieses Modul weiß deshalb nichts
 * über Aufstellungen; es kennt eine Spieler-Id, einen Schlüssel und die
 * Funktion, die beides zusammenbringt.
 *
 * Entscheidet keine Regel. Was ein Zug kostet und wer dabei wohin rutscht,
 * sagt die Engine — dieselbe Regel, auf der auch der zweite Tipp landet.
 */

import { el } from './dom.js';

/** Ab wie vielen Pixeln die Maus zieht, statt getippt zu haben. */
const SCHWELLE = 6;

/** Wie lange der Finger liegen muss, bevor er zieht. */
const HALTEN_MS = 350;

/**
 * Der laufende Zug — einer, nie zwei. Ein zweiter Finger auf dem Schirm fängt
 * keinen zweiten an: er wird ignoriert, bis der erste los ist. Alles andere
 * hieße, zwei Männer gleichzeitig zu stellen.
 * @typedef {object} Zug
 * @property {number} zeiger        `pointerId` — andere Zeiger gehen uns nichts an
 * @property {number} x0
 * @property {number} y0
 * @property {string} spieler       Wen wir in der Hand haben
 * @property {string} beschriftung  Was an der Schleppe steht
 * @property {string | null} von    Sein Platz, falls er auf einem steht
 * @property {(ziel: string, spielerId: string) => void} lege
 * @property {boolean} zieht        Ob die Geste als Zug entschieden ist
 * @property {HTMLElement | null} schleppe
 * @property {HTMLElement | null} drueber  Das Ziel unter dem Zeiger
 * @property {number} halten        Der Haltetimer des Fingers, 0 bei der Maus
 */

/** @type {Zug | null} */
let zug = null;

/**
 * Der Griff an einer Zeile: was beim Anfassen passiert.
 *
 * Gibt einen `pointerdown`-Handler zurück, der an `onpointerdown` gehört. Der
 * Tipp derselben Zeile bleibt daneben bestehen — dieser Handler hält nichts
 * auf, solange die Geste nicht als Zug entschieden ist.
 * @param {string} spielerId
 * @param {string} beschriftung Was an der Schleppe steht — der kurze Name
 * @param {string | null} von Sein Platzschlüssel, falls er auf einem steht
 * @param {(ziel: string, spielerId: string) => void} lege
 */
export function anfassen(spielerId, beschriftung, von, lege) {
  return (/** @type {PointerEvent} */ e) => {
    // Die rechte Maustaste gehört dem Browser, nicht uns.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Ein Knopf in der Zeile ist kein Griff: der Papierkorb und „Automatik"
    // sitzen mitten in einer ziehbaren Zeile und tun etwas anderes.
    if (e.target instanceof Element && e.target.closest('button')) return;
    if (zug) return;

    zug = {
      zeiger: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      spieler: spielerId,
      beschriftung,
      von,
      lege,
      zieht: false,
      schleppe: null,
      drueber: null,
      halten: 0,
    };

    addEventListener('pointermove', bewegt);
    addEventListener('pointerup', los);
    addEventListener('pointercancel', abbruch);
    addEventListener('keydown', taste);

    // Der Finger entscheidet sich durch Liegenbleiben, die Maus durch Bewegen.
    if (e.pointerType !== 'mouse') {
      const { clientX: x, clientY: y } = e;
      zug.halten = setTimeout(() => losgehen(x, y), HALTEN_MS);
    }
  };
}

/** @param {PointerEvent} e */
function bewegt(e) {
  if (!zug || e.pointerId !== zug.zeiger) return;

  if (!zug.zieht) {
    if (Math.abs(e.clientX - zug.x0) + Math.abs(e.clientY - zug.y0) <= SCHWELLE) return;
    // Gewandert, bevor er lag: das war ein Wischen. Die Liste scrollt, und hier
    // ist nichts mehr zu tun — gerade weil wir nichts abgefangen haben.
    if (zug.halten) { abraeumen(); return; }
    losgehen(e.clientX, e.clientY);
  }
  fuehre(e.clientX, e.clientY);
}

/**
 * Ab hier ist die Geste ein Zug: die Schleppe hängt am Zeiger, die Plätze
 * zeigen sich als Ziele, und der Finger scrollt die Seite nicht mehr.
 * @param {number} x @param {number} y
 */
function losgehen(x, y) {
  if (!zug) return;
  if (zug.halten) { clearTimeout(zug.halten); zug.halten = 0; }
  zug.zieht = true;
  document.body.classList.add('zieht');
  zug.schleppe = el('div', { class: 'schleppe', 'aria-hidden': 'true', text: zug.beschriftung });
  document.body.append(zug.schleppe);
  // Das Scrollen hält erst der laufende Zug an, nicht die CSS: `touch-action`
  // müsste vor der Geste dastehen und nähme der Liste links das Scrollen für
  // immer. Hier greift es nur, solange wirklich gezogen wird — und nur, weil
  // nach dem Halten noch keine Scrollbewegung begonnen hat.
  addEventListener('touchmove', haltAn, { passive: false });
  fuehre(x, y);
}

/** @param {Event} e */
function haltAn(e) { e.preventDefault(); }

/**
 * Die Schleppe nachführen und das Ziel darunter markieren.
 * @param {number} x @param {number} y
 */
function fuehre(x, y) {
  if (!zug || !zug.schleppe) return;
  // Versetzt, damit der Name nicht unter dem Zeiger klebt und den Platz
  // verdeckt, auf den er gerade gelegt werden soll.
  zug.schleppe.style.transform = `translate(${x + 14}px, ${y + 10}px)`;

  const treffer = zielUnter(x, y);
  if (treffer === zug.drueber) return;
  if (zug.drueber) zug.drueber.classList.remove('drueber');
  zug.drueber = treffer;
  if (treffer) treffer.classList.add('drueber');
}

/**
 * Das Ziel unter dem Zeiger — oder keins. Die Schleppe steht dabei nicht im
 * Weg, sie nimmt keine Zeiger an.
 * @param {number} x @param {number} y
 */
function zielUnter(x, y) {
  const unten = document.elementFromPoint(x, y);
  const ziel = unten && unten.closest('[data-ziel]');
  if (!(ziel instanceof HTMLElement)) return null;
  // Sein eigener Platz ist kein Ziel: dorthin gelegt täte der Zug nichts, und
  // er soll auch nicht so aussehen, als täte er etwas.
  if (zug && zug.von && ziel.dataset.ziel === zug.von) return null;
  return ziel;
}

/** @param {PointerEvent} e */
function los(e) {
  if (!zug || e.pointerId !== zug.zeiger) return;
  const { zieht, drueber, lege, spieler } = zug;
  abraeumen();

  // Kein Zug, sondern ein Tipp: der Klick, der jetzt kommt, gehört der Zeile.
  if (!zieht) return;

  // Nach einem Zug kommt derselbe Klick trotzdem — und würde als Tipp zählen,
  // also den Auswahlmodus öffnen, den der Zug gerade beantwortet hat. Das gilt
  // auch für den Zug, der über keinem Ziel endet: wer daneben loslässt, hat
  // abgebrochen und nicht getippt.
  schluckeKlick();

  const schluessel = drueber && drueber.dataset.ziel;
  if (schluessel) lege(schluessel, spieler);
}

/** @param {PointerEvent} e */
function abbruch(e) {
  if (zug && e.pointerId === zug.zeiger) abraeumen();
}

/** Escape bricht ab — der Zug ist dann nie passiert. @param {KeyboardEvent} e */
function taste(e) {
  if (e.key === 'Escape') abraeumen();
}

/**
 * Den einen Klick abfangen, der auf das Loslassen folgt.
 *
 * `once` allein genügt nicht: beim Finger kommt oft gar kein Klick, und der
 * Fänger läge dann bis zum nächsten echten Tipp auf der Lauer und fräße ihn.
 * Deshalb nimmt ihn ein Timer am Ende derselben Runde wieder weg — ein Klick
 * aus diesem Zeiger entsteht noch in ihr, ein späterer Tipp erst danach.
 */
function schluckeKlick() {
  const fang = (/** @type {Event} */ ev) => { ev.stopPropagation(); ev.preventDefault(); };
  addEventListener('click', fang, { capture: true, once: true });
  setTimeout(() => removeEventListener('click', fang, true), 0);
}

/** Jede Spur des Zugs wieder weg — gleich, wie er geendet hat. */
function abraeumen() {
  if (!zug) return;
  if (zug.halten) clearTimeout(zug.halten);
  if (zug.schleppe) zug.schleppe.remove();
  if (zug.drueber) zug.drueber.classList.remove('drueber');
  document.body.classList.remove('zieht');
  removeEventListener('pointermove', bewegt);
  removeEventListener('pointerup', los);
  removeEventListener('pointercancel', abbruch);
  removeEventListener('keydown', taste);
  removeEventListener('touchmove', haltAn);
  zug = null;
}
