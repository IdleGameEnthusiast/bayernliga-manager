// @ts-check
/** Kaderansicht: Mannschaftsteile oben, Depth Chart darunter. */

import { el, tabelle as machTabelle, balken } from './dom.js';
import { T } from '../i18n.js';
import { teamStaerken, gesamtStaerke, verletzte } from '../engine/team.js';
import { istFit } from '../engine/spieler.js';
import { LIGA_MAX_STAERKE } from '../engine/constants.js';

/**
 * @param {import('../engine/spieler.js').Spieler[]} kader
 * @param {number} spieltag
 */
export function zeigeKader(kader, spieltag) {
  const s = teamStaerken(kader, spieltag);
  const verletzt = verletzte(kader, spieltag);

  const einheiten = el('div', { class: 'karte' },
    el('h2', { text: T.kader.einheiten }),
    reihe(T.kader.angriff, s.angriff),
    reihe(T.kader.verteidigung, s.verteidigung),
    reihe(T.kader.special, s.special),
    el('p', { class: 'klein', style: { margin: '10px 0 0' } },
      el('strong', { text: `${T.kader.gesamt}: ${gesamtStaerke(s)}` }),
      verletzt.length > 0
        ? el('span', { class: 'verletzt', text: `  ·  ${verletzt.length} ${T.kader.verletzt}` })
        : el('span', { class: 'leise', text: `  ·  ${T.kader.keineVerletzungen}` })));

  const zeilen = kader.map((sp) => {
    const fit = istFit(sp, spieltag);
    return el('tr', {},
      el('td', { class: 'leise', text: String(sp.nummer) }),
      el('td', { text: sp.vorname + ' ' + sp.nachname }),
      el('td', { text: sp.position }),
      el('td', { text: String(sp.alter) }),
      el('td', { style: { fontWeight: '600' }, text: String(sp.staerke) }),
      el('td', { class: 'leise', text: String(sp.talent) }),
      el('td', { class: fit ? 'leise' : 'verletzt' },
        fit ? T.kader.fit : T.kader.verletztBis(sp.verletztBis - spieltag)));
  });

  return el('div', {},
    einheiten,
    el('div', { class: 'karte' },
      el('h2', { text: T.nav.kader }),
      machTabelle(
        [T.kader.nummer, T.kader.name, T.kader.position, T.kader.alter,
         T.kader.staerke, T.kader.talent, T.kader.status],
        zeilen)));
}

/** @param {string} beschriftung @param {number} wert */
function reihe(beschriftung, wert) {
  return el('div', { class: 'balkenreihe' },
    el('span', { class: 'klein', text: beschriftung }),
    balken(wert, LIGA_MAX_STAERKE),
    el('span', { class: 'klein', style: { textAlign: 'right' }, text: String(Math.round(wert)) }));
}
