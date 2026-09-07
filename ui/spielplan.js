// @ts-check
/** Spielplan, nach Spieltagen gruppiert. Ein Tipp auf eine gespielte Partie
 *  öffnet den Spielbericht. */

import { el, farbtupfer } from './dom.js';
import { T } from '../i18n.js';
import { teamById } from '../engine/content.js';
import { anzahlSpieltage } from '../engine/spielplan.js';

/**
 * @param {import('../engine/spielplan.js').Partie[]} plan
 * @param {string} meinTeam
 * @param {number} aktuellerTag
 * @param {(partie: import('../engine/spielplan.js').Partie) => void} beiPartie
 */
export function zeigeSpielplan(plan, meinTeam, aktuellerTag, beiPartie) {
  const gesamt = anzahlSpieltage(plan);
  const karten = [];

  for (let st = 1; st <= gesamt; st++) {
    const partien = plan.filter((p) => p.spieltag === st);
    if (partien.length === 0) continue;
    // Ein Playoff-Spieltag heißt nach seiner Runde, nicht nach seiner Nummer.
    const runde = partien[0].runde;
    const titel = runde === 'gruppe' ? `${T.spielplan.spieltag} ${st}` : T.runde[runde];
    karten.push(el('div', { class: 'karte' },
      el('h2', { text: titel + (partien[0].tag === aktuellerTag ? ' ·' : '') }),
      partien.map((p) => zeilePartie(p, meinTeam, beiPartie))));
  }

  return el('div', {}, karten);
}

/**
 * @param {import('../engine/spielplan.js').Partie} p
 * @param {string} meinTeam
 * @param {(partie: import('../engine/spielplan.js').Partie) => void} beiPartie
 */
function zeilePartie(p, meinTeam, beiPartie) {
  const heim = teamById(p.heim);
  const gast = teamById(p.gast);
  const meins = p.heim === meinTeam || p.gast === meinTeam;

  const stand = p.ergebnis
    ? `${p.ergebnis.heimPunkte} : ${p.ergebnis.gastPunkte}`
    : '–';

  // Heim und Gast stehen nebeneinander, nicht untereinander: eine Paarung ist
  // eine Zeile, und zwei Zeilen übereinander lasen sich wie zwei Partien.
  // Fett wird nur der eigene Verein, nicht die ganze Zeile — sonst sagt die
  // Auszeichnung „hier steht etwas Wichtiges" statt „das bist du".
  const name = (team) => el('span', {
    class: 'name',
    style: { fontWeight: team.id === meinTeam ? '700' : '400' },
    text: team.name,
  });

  return el('div', {
    class: meins ? 'paarung meins' : 'paarung',
    role: p.ergebnis ? 'button' : null,
    tabindex: p.ergebnis ? '0' : null,
    onclick: p.ergebnis ? () => beiPartie(p) : null,
  },
    el('span', { class: 'namen' },
      farbtupfer(heim),
      name(heim),
      el('span', { class: 'leise gegen', text: T.spielplan.gegen }),
      farbtupfer(gast),
      name(gast)),
    el('span', { class: p.ergebnis ? 'stand' : 'stand leise', text: stand }),
    p.ergebnis && p.ergebnis.verlaengerung
      ? el('span', { class: 'leise klein', text: T.spielplan.verlaengerung })
      : null);
}
