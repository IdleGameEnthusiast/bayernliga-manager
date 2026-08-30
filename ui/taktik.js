// @ts-check
/**
 * Taktikansicht: welches System der Verein spielt, wie weit er es Richtung
 * Lauf oder Pass verschiebt, und was daneben auf dem Feld steht.
 *
 * Entscheidet keine Regel. Der Regler geht über die ganze Spanne — was eine
 * Gruppierung nicht kann, verrechnet der Skill-Block, nicht die Ansicht.
 * Wer wo steht, sagt `stelleAuf()`, und gezeigt wird es in `ui/aufstellung.js`.
 */

import { el, balken } from './dom.js';
import { T } from '../i18n.js';
import { LIGA_MAX_STAERKE } from '../engine/constants.js';
import { teamStaerken } from '../engine/team.js';
import { PERSONNEL, PERSONNEL_REIHE } from '../engine/aufstellung.js';
import { personnelVon, passAnteilVon } from '../engine/saison.js';

/**
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {(taktik: { personnel?: string, passAnteil?: number }) => void} setze
 */
export function zeigeTaktik(stand, setze) {
  const kader = stand.kader[stand.meinTeam];
  const personnel = personnelVon(stand, stand.meinTeam);
  const anteil = passAnteilVon(stand, stand.meinTeam);
  const staerken = teamStaerken(kader, stand.spieltag, personnel, anteil);

  // Die Aufstellung steht im Kader, nicht hier: dort entscheidet sie, hier
  // steht nur, was sie bewegt.
  return el('div', {},
    systemKarte(personnel, setze),
    ausrichtungKarte(personnel, anteil, staerken, setze));
}

/**
 * Die acht Gruppierungen als Schaltflächen. Jede zeigt, woraus sie besteht —
 * die Wahl soll nicht raten müssen, was hinter „21" steckt.
 * @param {string} aktiv
 * @param {(taktik: { personnel?: string, passAnteil?: number }) => void} setze
 */
function systemKarte(aktiv, setze) {
  return el('div', { class: 'karte' },
    el('h2', { text: T.taktik.systemWaehlen }),
    el('div', { class: 'systeme' },
      PERSONNEL_REIHE.map((id) => el('button', {
        class: id === aktiv ? 'system aktiv' : 'system',
        'aria-pressed': String(id === aktiv),
        onclick: () => setze({ personnel: id }),
      },
        el('span', { class: 'system-id', text: id }),
        el('span', { class: 'system-name', text: T.personnel[id] || PERSONNEL[id].name }),
        el('span', { class: 'system-skill leise', text: PERSONNEL[id].skill.join(' · ') })))));
}

/**
 * Der Regler. Er zeigt nicht nur die Zahl, sondern was sie ausmacht: die vier
 * Werte darunter rechnen bei jeder Bewegung neu.
 * @param {string} personnel
 * @param {number} anteil
 * @param {import('../engine/team.js').Staerken} staerken
 * @param {(taktik: { personnel?: string, passAnteil?: number }) => void} setze
 */
function ausrichtungKarte(personnel, anteil, staerken, setze) {
  const vorschlag = PERSONNEL[personnel].passAnteil;
  const prozent = (w) => Math.round(w * 100);

  const anzeige = el('span', { class: 'reglerwert', text: `${prozent(anteil)} %` });

  const regler = el('input', {
    type: 'range',
    min: '0',
    max: '100',
    step: '1',
    value: String(prozent(anteil)),
    'aria-label': T.taktik.passAnteil,
    oninput: (/** @type {Event} */ e) => {
      const wert = Number(/** @type {HTMLInputElement} */ (e.target).value);
      anzeige.textContent = `${wert} %`;
    },
    onchange: (/** @type {Event} */ e) => {
      const wert = Number(/** @type {HTMLInputElement} */ (e.target).value);
      setze({ personnel, passAnteil: wert / 100 });
    },
  });

  return el('div', { class: 'karte' },
    el('h2', { text: T.taktik.ausrichtung }),
    el('div', { class: 'reglerzeile' },
      el('span', { class: 'klein', text: T.taktik.passAnteil }),
      regler,
      anzeige),
    el('p', { class: 'leise klein', style: { margin: '2px 0 12px' } },
      `${T.taktik.vorschlag(prozent(vorschlag))}  ·  ${T.taktik.frei}`),
    el('h3', { class: 'klein', text: T.taktik.wirkung }),
    reihe(T.kader.angriffPass, staerken.passAngriff),
    reihe(T.kader.angriffLauf, staerken.laufAngriff),
    reihe(T.kader.verteidigungPass, staerken.passVerteidigung),
    reihe(T.kader.verteidigungLauf, staerken.laufVerteidigung),
    el('p', { class: 'leise klein', style: { margin: '10px 0 0' }, text: T.taktik.gilt }));
}

/** @param {string} beschriftung @param {number} wert */
function reihe(beschriftung, wert) {
  return el('div', { class: 'balkenreihe' },
    el('span', { class: 'klein', text: beschriftung }),
    balken(wert, LIGA_MAX_STAERKE),
    el('span', { class: 'klein', style: { textAlign: 'right' }, text: String(Math.round(wert)) }));
}
