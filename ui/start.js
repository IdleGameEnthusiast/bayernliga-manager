// @ts-check
/** Startbildschirm: Verein wählen. */

import { el } from './dom.js';
import { TEAMS } from '../engine/content.js';
import { T } from '../i18n.js';

/**
 * @param {(teamId: string) => void} beiStart
 * @param {boolean} hatSpeicherstand
 * @param {() => void} beiFortsetzen
 */
export function zeigeStart(beiStart, hatSpeicherstand, beiFortsetzen) {
  let gewaehlt = TEAMS[0].id;

  const startKnopf = el('button', {
    class: 'haupt',
    onclick: () => beiStart(gewaehlt),
  }, T.start.starten);

  const liste = el('div', { class: 'start-liste' },
    TEAMS.map((t) => {
      const knopf = el('button', {
        class: 'start-team',
        type: 'button',
        'aria-pressed': String(t.id === gewaehlt),
        onclick: () => {
          gewaehlt = t.id;
          for (const k of liste.querySelectorAll('.start-team')) {
            k.setAttribute('aria-pressed', String(k === knopf));
          }
        },
      },
        el('span', { class: 'farbtupfer', style: { background: t.farbe, width: '14px', height: '32px' } }),
        el('span', {},
          el('div', { text: t.name, style: { fontWeight: '600' } }),
          el('div', { class: 'leise klein', text: t.stadt })),
        el('span', { class: 'balken' },
          el('i', { style: { width: t.staerke + '%' } })));
      return knopf;
    }));

  return el('div', {},
    el('div', { class: 'karte' },
      el('h2', { text: T.start.ueberschrift }),
      el('p', { class: 'leise klein', text: T.start.teamWahl }),
      liste),
    el('div', { class: 'fuss' },
      hatSpeicherstand
        ? el('button', { class: 'neben', onclick: beiFortsetzen }, T.start.fortsetzen)
        : null,
      startKnopf));
}
