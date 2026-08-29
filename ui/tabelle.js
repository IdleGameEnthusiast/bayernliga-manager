// @ts-check
/** Die Tabelle. */

import { el, tabelle as machTabelle, farbtupfer } from './dom.js';
import { T } from '../i18n.js';
import { teamById } from '../engine/content.js';
import { bilanz } from '../engine/tabelle.js';

/**
 * @param {import('../engine/tabelle.js').TabellenZeile[]} zeilen
 * @param {string} meinTeam
 */
export function zeigeTabelle(zeilen, meinTeam) {
  const letzter = zeilen.length;

  const koerper = zeilen.map((z) => {
    const t = teamById(z.teamId);
    const klassen = [
      z.teamId === meinTeam ? 'mein-team' : '',
      z.platz === 1 ? 'meister' : '',
      z.platz === letzter ? 'abstieg' : '',
    ].filter(Boolean).join(' ');

    return el('tr', { class: klassen },
      el('td', { text: String(z.platz) }),
      el('td', {}, el('span', { class: 'verein-zelle' },
        farbtupfer(t),
        el('span', { text: t.name }))),
      el('td', { text: String(z.spiele) }),
      el('td', { text: bilanz(z) }),
      el('td', { text: String(z.punkte), style: { fontWeight: '700' } }),
      el('td', { class: 'leise', text: String(z.erzielt) }),
      el('td', { class: 'leise', text: String(z.kassiert) }),
      el('td', { text: (z.differenz > 0 ? '+' : '') + z.differenz }));
  });

  return el('div', { class: 'karte' },
    el('h2', { text: T.nav.tabelle }),
    machTabelle(
      [T.tabelle.platz, T.tabelle.verein, T.tabelle.spiele, T.tabelle.bilanz,
       T.tabelle.punkte, T.tabelle.erzielt, T.tabelle.kassiert, T.tabelle.differenz],
      koerper),
    el('p', { class: 'leise klein', style: { marginBottom: '0' } },
      `▍ ${T.tabelle.legendeMeister}   ▍ ${T.tabelle.legendeAbstieg}`));
}
