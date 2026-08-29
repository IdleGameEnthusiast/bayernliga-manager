// @ts-check
/** Der Spielbericht: Endstand, Viertel, Box Score. */

import { el, tabelle as machTabelle } from './dom.js';
import { T } from '../i18n.js';
import { teamById } from '../engine/content.js';

/**
 * @param {import('../engine/spielplan.js').Partie} p
 * @param {() => void} beiZurueck
 */
export function zeigeSpielbericht(p, beiZurueck) {
  const e = p.ergebnis;
  if (!e) return el('div', {});

  const heim = teamById(p.heim);
  const gast = teamById(p.gast);
  const heimGewinnt = e.heimPunkte > e.gastPunkte;

  const kopf = el('div', { class: 'karte' },
    el('div', { class: 'bericht-kopf' },
      el('span', { class: 'farbtupfer', style: { background: heim.farbe, width: '14px', height: '34px' } }),
      el('div', { style: { flex: '1' } },
        el('div', { style: { fontWeight: heimGewinnt ? '700' : '400' }, text: heim.name }),
        el('div', { class: 'leise klein', text: `${T.spielplan.heim} · ${heim.stadt}` })),
      el('div', { class: 'bericht-punkte ' + (heimGewinnt ? 'bericht-sieger' : ''), text: String(e.heimPunkte) })),
    el('div', { class: 'bericht-kopf' },
      el('span', { class: 'farbtupfer', style: { background: gast.farbe, width: '14px', height: '34px' } }),
      el('div', { style: { flex: '1' } },
        el('div', { style: { fontWeight: !heimGewinnt ? '700' : '400' }, text: gast.name }),
        el('div', { class: 'leise klein', text: `${T.spielplan.gast} · ${gast.stadt}` })),
      el('div', { class: 'bericht-punkte ' + (!heimGewinnt ? 'bericht-sieger' : ''), text: String(e.gastPunkte) })),
    e.verlaengerung
      ? el('p', { class: 'leise klein', style: { margin: '0' }, text: 'Entschieden in der Verlängerung' })
      : null);

  const viertel = el('div', { class: 'karte' },
    el('h2', { text: T.spiel.viertel }),
    machTabelle(
      ['', 'Q1', 'Q2', 'Q3', 'Q4', T.spiel.endstand],
      [
        el('tr', {}, el('td', { text: heim.kurz }),
          e.heimViertel.map((v) => el('td', { text: String(v) })),
          el('td', { style: { fontWeight: '700' }, text: String(e.heimPunkte) })),
        el('tr', {}, el('td', { text: gast.kurz }),
          e.gastViertel.map((v) => el('td', { text: String(v) })),
          el('td', { style: { fontWeight: '700' }, text: String(e.gastPunkte) })),
      ]));

  const box = el('div', { class: 'karte' },
    el('h2', { text: 'Box Score' }),
    statBlock(heim.name, e.heimStats),
    statBlock(gast.name, e.gastStats));

  const verletzungen = e.verletzungen.length > 0
    ? el('div', { class: 'karte' },
      el('h2', { text: T.spiel.verletzung }),
      e.verletzungen.map((v) => el('p', { class: 'verletzt klein', style: { margin: '4px 0' } },
        `${v.name} (${v.position}) — ${v.wochen} ${v.wochen === 1 ? 'Spieltag' : 'Spieltage'}`)))
    : null;

  return el('div', {},
    kopf, viertel, box, verletzungen,
    el('div', { class: 'fuss' },
      el('button', { class: 'haupt', onclick: beiZurueck }, T.aktion.zurueck)));
}

/**
 * @param {string} teamName
 * @param {import('../engine/spiel.js').TeamStats} s
 */
function statBlock(teamName, s) {
  const zeilen = [];
  if (s.passing) {
    zeilen.push(el('tr', {},
      el('td', { class: 'leise', text: T.spiel.passing }),
      el('td', { text: s.passing.name }),
      el('td', { text: `${s.passing.comp}/${s.passing.att}` }),
      el('td', { text: `${s.passing.yards} ${T.spiel.yards}` }),
      el('td', { text: `${s.passing.td} ${T.spiel.touchdowns}` })));
  }
  if (s.rushing) {
    zeilen.push(el('tr', {},
      el('td', { class: 'leise', text: T.spiel.rushing }),
      el('td', { text: s.rushing.name }),
      el('td', { text: `${s.rushing.att} ${T.spiel.versuche}` }),
      el('td', { text: `${s.rushing.yards} ${T.spiel.yards}` }),
      el('td', { text: `${s.rushing.td} ${T.spiel.touchdowns}` })));
  }
  if (s.receiving) {
    zeilen.push(el('tr', {},
      el('td', { class: 'leise', text: T.spiel.receiving }),
      el('td', { text: s.receiving.name }),
      el('td', { text: `${s.receiving.rec} ${T.spiel.faenge}` }),
      el('td', { text: `${s.receiving.yards} ${T.spiel.yards}` }),
      el('td', { text: `${s.receiving.td} ${T.spiel.touchdowns}` })));
  }

  return el('div', { style: { marginBottom: '14px' } },
    el('p', { class: 'klein', style: { margin: '0 0 4px', fontWeight: '700' } }, teamName),
    machTabelle([], zeilen),
    el('p', { class: 'leise klein', style: { margin: '4px 0 0' },
      text: `${s.yardsGesamt} ${T.spiel.yards} gesamt` }));
}
