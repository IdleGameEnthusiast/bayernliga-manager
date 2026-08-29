// @ts-check
/** Kaderansicht: Mannschaftsteile oben, Depth Chart darunter. */

import { el, leere, tabelle as machTabelle, balken } from './dom.js';
import { T } from '../i18n.js';
import { teamStaerken, gesamtStaerke, verletzte } from '../engine/team.js';
import { istFit } from '../engine/spieler.js';
import { LIGA_MAX_STAERKE, POSITIONS } from '../engine/constants.js';

/**
 * Eine Spalte des Depth Charts: Beschriftung, Zellinhalt und der Wert, nach
 * dem sortiert wird. Zahlen sortieren numerisch, Text nach deutscher Sortier-
 * reihenfolge. Die Position wird zur Zahl, und zwar so, dass QB oben liegt:
 * absteigend ist damit die Depth-Chart-Reihenfolge, also der Standard.
 * @typedef {{
 *   id: string,
 *   kopf: string,
 *   wert: (sp: import('../engine/spieler.js').Spieler, spieltag: number) => number|string,
 * }} Spalte
 */

/** @type {Spalte[]} */
const SPALTEN = [
  { id: 'nummer', kopf: T.kader.nummer, wert: (sp) => sp.nummer },
  { id: 'name', kopf: T.kader.name, wert: (sp) => sp.nachname + ' ' + sp.vorname },
  { id: 'position', kopf: T.kader.position, wert: (sp) => POSITIONS.length - POSITIONS.indexOf(sp.position) },
  { id: 'alter', kopf: T.kader.alter, wert: (sp) => sp.alter },
  { id: 'staerke', kopf: T.kader.staerke, wert: (sp) => sp.staerke },
  { id: 'talent', kopf: T.kader.talent, wert: (sp) => sp.talent },
  { id: 'status', kopf: T.kader.status, wert: (sp, spieltag) => (istFit(sp, spieltag) ? 0 : sp.verletztBis - spieltag) },
];

/**
 * Wonach die Tabelle gerade sortiert ist — `null` heißt: der Standard, also
 * die Reihenfolge, in der die Engine den Kader liefert (Position, dann Stärke).
 * Der Merker lebt im Modul, damit die Sortierung einen Spieltag überlebt.
 * @type {{ spalte: string, richtung: 'ab'|'auf' } | null}
 */
let sortierung = null;

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

  const halter = el('div', {});
  const male = () => {
    leere(halter);
    halter.append(machTabelle(
      SPALTEN.map((sp) => kopfzelle(sp, male)),
      sortiere(kader, spieltag).map((spieler) => zeile(spieler, spieltag))));
  };
  male();

  return el('div', {},
    einheiten,
    el('div', { class: 'karte' }, el('h2', { text: T.nav.kader }), halter));
}

/**
 * Der Spaltenkopf klickt sich im Dreitakt durch: absteigend, aufsteigend,
 * wieder Standard.
 * @param {Spalte} spalte @param {() => void} male
 */
function kopfzelle(spalte, male) {
  const aktiv = sortierung && sortierung.spalte === spalte.id ? sortierung.richtung : null;
  const weiter = () => {
    sortierung = aktiv === null
      ? { spalte: spalte.id, richtung: 'ab' }
      : aktiv === 'ab' ? { spalte: spalte.id, richtung: 'auf' } : null;
    male();
  };

  return el('th', {
    class: aktiv ? 'sortierbar sortiert' : 'sortierbar',
    role: 'button',
    tabindex: '0',
    title: T.kader.sortieren(spalte.kopf),
    'aria-sort': aktiv === 'ab' ? 'descending' : aktiv === 'auf' ? 'ascending' : 'none',
    onclick: weiter,
    onkeydown: (/** @type {KeyboardEvent} */ e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      weiter();
    },
  },
    spalte.kopf,
    aktiv ? el('span', { class: 'sortpfeil', text: aktiv === 'ab' ? T.kader.sortAb : T.kader.sortAuf }) : null);
}

/**
 * Der Kader in der gewünschten Reihenfolge. Ohne Sortierung bleibt es bei dem,
 * was die Engine liefert; sonst wird stabil sortiert, sodass Gleichstände in
 * der Depth-Chart-Reihenfolge stehen bleiben.
 * @param {import('../engine/spieler.js').Spieler[]} kader @param {number} spieltag
 */
function sortiere(kader, spieltag) {
  if (!sortierung) return kader;
  const spalte = SPALTEN.find((sp) => sp.id === sortierung?.spalte);
  if (!spalte) return kader;
  const vorzeichen = sortierung.richtung === 'ab' ? -1 : 1;

  return kader.slice().sort((a, b) => {
    const x = spalte.wert(a, spieltag);
    const y = spalte.wert(b, spieltag);
    if (typeof x === 'string' || typeof y === 'string') {
      return vorzeichen * String(x).localeCompare(String(y), 'de');
    }
    return vorzeichen * (x - y);
  });
}

/** @param {import('../engine/spieler.js').Spieler} sp @param {number} spieltag */
function zeile(sp, spieltag) {
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
}

/** @param {string} beschriftung @param {number} wert */
function reihe(beschriftung, wert) {
  return el('div', { class: 'balkenreihe' },
    el('span', { class: 'klein', text: beschriftung }),
    balken(wert, LIGA_MAX_STAERKE),
    el('span', { class: 'klein', style: { textAlign: 'right' }, text: String(Math.round(wert)) }));
}
