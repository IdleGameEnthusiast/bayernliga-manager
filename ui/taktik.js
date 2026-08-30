// @ts-check
/**
 * Taktikansicht: welches System der Verein spielt, wie weit er es Richtung
 * Lauf oder Pass verschiebt, und was daneben auf dem Feld steht.
 *
 * Entscheidet keine Regel. Der Regler geht über die ganze Spanne — was eine
 * Gruppierung nicht kann, verrechnet der Skill-Block, nicht die Ansicht.
 * Wer wo steht, sagt `stelleAuf()`.
 */

import { el, balken } from './dom.js';
import { T } from '../i18n.js';
import { LIGA_MAX_STAERKE } from '../engine/constants.js';
import { teamStaerken } from '../engine/team.js';
import { PERSONNEL, PERSONNEL_REIHE } from '../engine/aufstellung.js';
import { personnelVon, passAnteilVon } from '../engine/saison.js';
import { platzKuerzel, positionsKuerzel } from '../engine/positionen.js';

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

/**
 * Wer wo steht. Ein Umsteller ist markiert, ein Doppeleinsatz auch — beides
 * ist eine Nachricht an den Manager und nicht Dekoration.
 *
 * Die Zeile endet rechtsbündig auf Position und Wert; die Marken stehen davor.
 * So stehen die Zahlen aller zweiundzwanzig Zeilen untereinander, statt von
 * einer Marke aus der Flucht geschoben zu werden.
 *
 * Hinter jedem Namen steht, was er **auf diesem Platz** wert ist, nicht seine
 * gezogene Stärke. Erst damit lässt sich die Marke „umgestellt" beziffern —
 * und auch ein Mann auf seiner eigenen Position steht mal besser, mal
 * schlechter da, je nachdem, wie viel der Verein wirft.
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 */
export function aufstellungKarte(a) {
  const name = (/** @type {import('../engine/aufstellung.js').Platz} */ p) => {
    if (!p.spieler) return T.taktik.keiner;
    return `${p.spieler.nummer} ${p.spieler.vorname.charAt(0)}. ${p.spieler.nachname}`;
  };

  const liste = (/** @type {import('../engine/aufstellung.js').Platz[]} */ plaetze) =>
    el('ul', { class: 'aufstellung' }, plaetze.map((p) => el('li', {},
      el('span', { class: 'platz', text: platzKuerzel(p.platz) }),
      el('span', { class: 'platz-name', text: name(p) }),
      p.umgestellt ? el('span', { class: 'marke um', text: T.taktik.umgestellt }) : null,
      p.doppel
        ? el('span', { class: 'marke doppel', title: T.taktik.doppelHinweis, text: T.taktik.doppel })
        : null,
      el('span', {
        class: 'platz-pos leise',
        text: p.spieler ? positionsKuerzel(p.spieler) : '',
      }),
      p.spieler ? el('span', {
        class: 'platz-stk',
        title: T.taktik.platzStaerke(Math.round(p.staerke)),
        text: String(Math.round(p.staerke)),
      }) : null)));

  return el('div', { class: 'karte' },
    el('h2', { text: T.taktik.aufstellung }),
    el('div', { class: 'elfen' },
      el('div', {}, el('h3', { class: 'klein', text: T.taktik.angriffElf }), liste(a.offense)),
      el('div', {}, el('h3', { class: 'klein', text: T.taktik.verteidigungElf }), liste(a.defense))),
    el('p', { class: 'leise klein', style: { margin: '10px 0 0' },
      text: T.taktik.kickPlaetze(
        a.k ? a.k.nachname : T.taktik.keiner,
        a.p ? a.p.nachname : T.taktik.keiner) }));
}

/** @param {string} beschriftung @param {number} wert */
function reihe(beschriftung, wert) {
  return el('div', { class: 'balkenreihe' },
    el('span', { class: 'klein', text: beschriftung }),
    balken(wert, LIGA_MAX_STAERKE),
    el('span', { class: 'klein', style: { textAlign: 'right' }, text: String(Math.round(wert)) }));
}
