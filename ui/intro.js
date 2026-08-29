// @ts-check
/** Die Begrüßung nach der Vereinswahl: warum der Verein einen Manager braucht. */

import { el, farbtupfer } from './dom.js';
import { T } from '../i18n.js';

/**
 * @param {import('../engine/content.js').TeamDef} team der frisch gewählte Verein
 * @param {() => void} beiWeiter
 * @param {() => void} beiZurueck
 */
export function zeigeIntro(team, beiWeiter, beiZurueck) {
  return el('div', {},
    el('div', { class: 'karte intro' },
      el('div', { class: 'intro-verein' },
        farbtupfer(team, { width: '14px', height: '32px' }),
        el('span', {},
          el('div', { text: team.name, style: { fontWeight: '600' } }),
          el('div', { class: 'leise klein', text: team.stadt }))),
      el('h2', { text: T.intro.anrede }),
      T.intro.absaetze(team.name).map((absatz) => el('p', { text: absatz })),
      el('p', { class: 'intro-frage', text: T.intro.frage })),
    el('div', { class: 'fuss' },
      el('button', { class: 'neben', onclick: beiZurueck }, T.aktion.zurueck),
      el('button', { class: 'haupt', onclick: beiWeiter }, T.intro.weiter)));
}
