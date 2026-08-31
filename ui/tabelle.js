// @ts-check
/** Die beiden Gruppentabellen und, sobald es sie gibt, das Playoff-Bracket. */

import { el, tabelle as machTabelle, farbtupfer } from './dom.js';
import { zeigeBracket } from './bracket.js';
import { T } from '../i18n.js';
import { teamById } from '../engine/content.js';
import { bilanz } from '../engine/tabelle.js';
import { PLAYOFF_PLAETZE } from '../engine/constants.js';

/**
 * @param {{ gruppe: 'nord'|'sued', zeilen: import('../engine/tabelle.js').TabellenZeile[] }[]} gruppen
 * @param {string} meinTeam
 * @param {import('../engine/spielplan.js').Partie[]} playoffs
 */
export function zeigeTabelle(gruppen, meinTeam, playoffs) {
  return el('div', {},
    gruppen.map((g) => gruppenKarte(g.gruppe, g.zeilen, meinTeam)),
    playoffKarte(playoffs, gruppen, meinTeam));
}

/**
 * @param {'nord'|'sued'} gruppe
 * @param {import('../engine/tabelle.js').TabellenZeile[]} zeilen
 * @param {string} meinTeam
 */
function gruppenKarte(gruppe, zeilen, meinTeam) {
  const koerper = zeilen.map((z) => {
    const t = teamById(z.teamId);
    const klassen = [
      z.teamId === meinTeam ? 'mein-team' : '',
      z.platz <= PLAYOFF_PLAETZE ? 'playoff' : '',
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
    el('h2', { text: T.gruppen[gruppe] }),
    machTabelle(
      [T.tabelle.platz, T.tabelle.verein, T.tabelle.spiele, T.tabelle.bilanz,
       T.tabelle.punkte, T.tabelle.erzielt, T.tabelle.kassiert, T.tabelle.differenz],
      koerper),
    el('p', { class: 'leise klein', style: { marginBottom: '0' } },
      `▍ ${T.tabelle.legendePlayoff}`));
}

/**
 * Das Bracket. Vor dem letzten Gruppenspieltag gibt es noch keine Partie —
 * die Form steht trotzdem schon da, mit den Setzungen auf den vier Plätzen.
 * @param {import('../engine/spielplan.js').Partie[]} playoffs
 * @param {{ gruppe: 'nord'|'sued', zeilen: import('../engine/tabelle.js').TabellenZeile[] }[]} gruppen
 * @param {string} meinTeam
 */
function playoffKarte(playoffs, gruppen, meinTeam) {
  return el('div', { class: 'karte' },
    el('h2', { text: T.playoffs.ueberschrift }),
    zeigeBracket(playoffs, gruppen, meinTeam),
    playoffs.length === 0
      ? el('p', { class: 'leise klein', style: { margin: '12px 0 0' }, text: T.playoffs.offen })
      : null);
}
