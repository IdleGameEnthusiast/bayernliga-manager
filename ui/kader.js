// @ts-check
/** Kaderansicht: Mannschaftsteile oben, Depth Chart darunter. */

import { el, leere, tabelle as machTabelle, balken } from './dom.js';
import { T } from '../i18n.js';
import { teamStaerken, gesamtStaerke, verletzte } from '../engine/team.js';
import { istFit } from '../engine/spieler.js';
import {
  LIGA_MAX_STAERKE, POSITIONS, ATTRIBUTE, GRUPPE_JE_POSITION, EINHEIT_JE_GRUPPE,
} from '../engine/constants.js';
import { positionsKuerzel } from '../engine/positionen.js';
import { aufstellungKarte } from './taktik.js';

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
  { id: 'koerper', kopf: T.kader.koerper, wert: (sp) => sp.gewicht },
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
 * @param {string} [personnel]
 * @param {number} [passAnteil]
 */
export function zeigeKader(kader, spieltag, personnel, passAnteil) {
  const s = teamStaerken(kader, spieltag, personnel, passAnteil);
  const verletzt = verletzte(kader, spieltag);

  const einheiten = el('div', { class: 'karte' },
    el('h2', { text: T.kader.einheiten }),
    reihe(T.kader.angriffPass, s.passAngriff),
    reihe(T.kader.angriffLauf, s.laufAngriff),
    reihe(T.kader.verteidigungPass, s.passVerteidigung),
    reihe(T.kader.verteidigungLauf, s.laufVerteidigung),
    reihe(T.kader.special, s.special),
    el('p', { class: 'klein', style: { margin: '10px 0 0' } },
      el('strong', { text: `${T.kader.gesamt}: ${gesamtStaerke(s)}` }),
      verletzt.length > 0
        ? el('span', { class: 'verletzt', text: `  ·  ${verletzt.length} ${T.kader.verletzt}` })
        : el('span', { class: 'leise', text: `  ·  ${T.kader.keineVerletzungen}` })));

  const halter = el('div', {});
  const male = () => {
    leere(halter);
    const liste = sortiere(kader, spieltag);
    halter.append(machTabelle(
      SPALTEN.map((sp) => kopfzelle(sp, male)),
      liste.flatMap((spieler, i) => [
        zeile(spieler, spieltag, male, trennerVor(liste, i)),
        offeneWerte.has(spieler.id) ? werteZeile(spieler) : null,
      ].filter(Boolean))));
  };
  male();

  return el('div', {},
    einheiten,
    aufstellungKarte(s.aufstellung),
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

/**
 * Die Linie über einer Zeile. Der Kader steht standardmäßig in Depth-Chart-
 * Reihenfolge, und dann sagt ein Strich zwischen zwei Positionen mehr als jede
 * Zwischenüberschrift: die dünne Linie trennt zwei Positionen, die kräftige
 * Offense von Defense.
 *
 * Sortiert der Manager nach etwas anderem, stehen die Positionen durcheinander
 * und die Striche zerschnitten die Tabelle willkürlich — dann gibt es keine.
 * @param {import('../engine/spieler.js').Spieler[]} liste
 * @param {number} i
 */
function trennerVor(liste, i) {
  if (i === 0) return '';
  if (sortierung && sortierung.spalte !== 'position') return '';
  const hier = liste[i].position;
  const davor = liste[i - 1].position;
  if (hier === davor) return '';
  const einheit = (/** @type {string} */ pos) => EINHEIT_JE_GRUPPE[GRUPPE_JE_POSITION[pos]];
  return einheit(hier) === einheit(davor) ? 'positionsstart' : 'einheitsstart';
}

/**
 * Welche Spieler ihre Werte gerade offen zeigen. Beim eigenen Kader sind sie
 * einsehbar — bei einem fremden Verein gäbe es nur die Gesamtstärke, und diese
 * Ansicht zeigt nie einen fremden.
 * @type {Set<string>}
 */
const offeneWerte = new Set();

/**
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {number} spieltag
 * @param {() => void} male
 * @param {string} [trenner] Zusatzklasse für die Linie über der Zeile
 */
function zeile(sp, spieltag, male, trenner) {
  const fit = istFit(sp, spieltag);
  const offen = offeneWerte.has(sp.id);
  const umschalten = () => {
    if (offen) offeneWerte.delete(sp.id); else offeneWerte.add(sp.id);
    male();
  };

  return el('tr', {
    class: 'spielerzeile' + (offen ? ' offen' : '') + (trenner ? ' ' + trenner : ''),
    role: 'button',
    tabindex: '0',
    'aria-expanded': String(offen),
    title: offen ? T.kader.werteVerbergen : T.kader.werteZeigen,
    onclick: umschalten,
    onkeydown: (/** @type {KeyboardEvent} */ e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      umschalten();
    },
  },
    el('td', { class: 'leise', text: String(sp.nummer) }),
    el('td', { text: sp.vorname + ' ' + sp.nachname }),
    el('td', { text: positionsKuerzel(sp) }),
    el('td', { class: 'leise', text: T.kader.koerperWert(sp.groesse, sp.gewicht) }),
    el('td', { text: String(sp.alter) }),
    el('td', { style: { fontWeight: '600' }, text: String(sp.staerke) }),
    el('td', { class: 'leise', text: String(sp.talent) }),
    el('td', { class: fit ? 'leise' : 'verletzt' },
      fit ? T.kader.fit : T.kader.verletztBis(sp.verletztBis - spieltag)));
}

/**
 * Die fünfzehn Werte eines Spielers, aufgeklappt unter seiner Zeile.
 * @param {import('../engine/spieler.js').Spieler} sp
 */
function werteZeile(sp) {
  return el('tr', { class: 'wertezeile' },
    el('td', { colspan: String(SPALTEN.length) },
      el('div', { class: 'werte' },
        ATTRIBUTE.map((attribut) => el('div', { class: 'wert' },
          el('span', { class: 'klein leise', text: T.attribute[attribut] }),
          balken(sp.attribute[attribut], LIGA_MAX_STAERKE),
          el('span', { class: 'klein', text: String(sp.attribute[attribut]) }))))));
}

/** @param {string} beschriftung @param {number} wert */
function reihe(beschriftung, wert) {
  return el('div', { class: 'balkenreihe' },
    el('span', { class: 'klein', text: beschriftung }),
    balken(wert, LIGA_MAX_STAERKE),
    el('span', { class: 'klein', style: { textAlign: 'right' }, text: String(Math.round(wert)) }));
}
