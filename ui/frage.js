// @ts-check
/**
 * Die Rückfrage: ein Blatt über der Ansicht, das eine Entscheidung verlangt.
 *
 * Kein `confirm()`. Das kennt genau zwei Antworten, und die heißen OK und
 * Abbrechen — für „speichern oder verwerfen" ist das die falsche Form, weil
 * beides ein Ja ist. Hier steht auf jedem Knopf, was er tut.
 *
 * Es gibt bewusst kein Schließen durch Danebentippen: die Frage steht, weil
 * etwas zu entscheiden ist.
 */

import { el } from './dom.js';

/**
 * @typedef {object} Frage
 * @property {string} titel
 * @property {string} text
 * @property {{ label: string, klasse?: string, wirkung: () => void }[]} knoepfe
 */

/** @param {Frage} frage */
export function zeigeFrage(frage) {
  return el('div', {
    class: 'frageschirm',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': frage.titel,
  },
    el('div', { class: 'frage' },
      el('h2', { text: frage.titel }),
      el('p', { class: 'klein', text: frage.text }),
      el('div', { class: 'fragenknoepfe' },
        frage.knoepfe.map((k) => el('button', {
          class: k.klasse || 'neben',
          onclick: k.wirkung,
        }, k.label)))));
}
