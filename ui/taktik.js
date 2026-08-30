// @ts-check
/**
 * Taktikansicht: welches System der Verein spielt, wie weit er es Richtung
 * Lauf oder Pass verschiebt, und was das gegen den nächsten Gegner austrägt.
 *
 * Entscheidet keine Regel. Der Regler geht über die ganze Spanne — was eine
 * Gruppierung nicht kann, verrechnet der Skill-Block, nicht die Ansicht.
 * Wer wo steht, sagt `stelleAuf()`, und gezeigt wird es in `ui/aufstellung.js`.
 *
 * Warum hier zwei Blöcke stehen und nicht einer: die vier Stärkewerte sagen,
 * was die Mannschaft **ist**, und sie rühren sich am Regler fast nicht — er
 * erreicht sie nur über die Platzvergabe. Was er wirklich bewegt, ist das Duell
 * gegen den nächsten Gegner, und das steht seitdem darüber, aufgeschlüsselt.
 * Vorher zeigte die Ansicht ausschließlich die vier, was den Regler wirkungslos
 * aussehen ließ, obwohl zwischen seinen Enden gut dreißig Stärkepunkte liegen.
 */

import { el, balken } from './dom.js';
import { T } from '../i18n.js';
import { LIGA_MAX_STAERKE, RATING_TO_POINTS } from '../engine/constants.js';
import { teamStaerken } from '../engine/team.js';
import { PERSONNEL, PERSONNEL_REIHE } from '../engine/aufstellung.js';
import { vorteilTeile, bestesPassAnteil } from '../engine/spiel.js';
import { teamById } from '../engine/content.js';
import {
  personnelVon, passAnteilVon, naechstePartie, ligaSchnittVerteidigung,
} from '../engine/saison.js';

/** Breite des Reglerdaumens in Pixeln — so weit läuft die Spur schmaler als der Kasten. */
const DAUMEN = 16;

/**
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {(taktik: { personnel?: string, passAnteil?: number }) => void} setze
 */
export function zeigeTaktik(stand, setze) {
  const personnel = personnelVon(stand, stand.meinTeam);
  const anteil = passAnteilVon(stand, stand.meinTeam);

  // Die Aufstellung steht im Kader, nicht hier: dort entscheidet sie, hier
  // steht nur, was sie bewegt.
  return el('div', {},
    systemKarte(personnel, setze),
    ausrichtungKarte(stand, personnel, anteil, setze));
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
 * Der Regler und was an ihm hängt. Beides rechnet bei jeder Bewegung neu — auch
 * schon beim Ziehen, nicht erst beim Loslassen.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {string} personnel
 * @param {number} anteil
 * @param {(taktik: { personnel?: string, passAnteil?: number }) => void} setze
 */
function ausrichtungKarte(stand, personnel, anteil, setze) {
  const kader = stand.kader[stand.meinTeam];
  const vorschlag = PERSONNEL[personnel].passAnteil;
  const prozent = (w) => Math.round(w * 100);

  const staerkenBei = (/** @type {number} */ a) =>
    teamStaerken(kader, stand.spieltag, personnel, a);

  // Der Gegner steht fest, während der Regler läuft — nur die eigene Seite
  // hängt an ihm. Und das Optimum wird einmal aus der gespeicherten Ausrichtung
  // gerechnet, damit die Marke beim Ziehen stehen bleibt statt mitzuwandern.
  const gegner = gegnerSeite(stand);
  const optimum = bestesPassAnteil(staerkenBei(anteil), gegner.werte);

  const anzeige = el('span', { class: 'reglerwert', text: `${prozent(anteil)} %` });
  const wirkung = el('div', {});
  /** @param {number} a */
  const zeichne = (a) => {
    const staerken = staerkenBei(a);
    wirkung.replaceChildren(
      el('h3', { class: 'klein', text: gegner.titel }),
      duellBlock(staerken, gegner.werte, a),
      el('h3', { class: 'klein', text: T.taktik.wirkung }),
      reihe(T.kader.angriffPass, staerken.passAngriff),
      reihe(T.kader.angriffLauf, staerken.laufAngriff),
      reihe(T.kader.verteidigungPass, staerken.passVerteidigung),
      reihe(T.kader.verteidigungLauf, staerken.laufVerteidigung),
      el('p', { class: 'leise klein', style: { margin: '2px 0 0' }, text: T.taktik.wirkungHinweis }));
  };
  zeichne(anteil);

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
      zeichne(wert / 100);
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
    skalaZeile(optimum),
    el('p', { class: 'leise klein', style: { margin: '2px 0 12px' } },
      `${T.taktik.vorschlag(prozent(vorschlag))}  ·  ${T.taktik.optimum(prozent(optimum))}`,
      el('br'),
      T.taktik.frei),
    wirkung,
    el('p', { class: 'leise klein', style: { margin: '10px 0 0' }, text: T.taktik.gilt }));
}

/**
 * Die Marke unter der Reglerspur.
 *
 * Der Daumen läuft nicht bis an die Kanten, sondern um seine halbe Breite
 * eingerückt — ohne die Korrektur stünde die Marke an den Enden um acht Pixel
 * daneben, und genau dort schaut man hin.
 * @param {number} optimum
 */
function skalaZeile(optimum) {
  const p = optimum * 100;
  // Das Vorzeichen steht ausgeschrieben im Ausdruck: `calc(86% + -5.8px)` ist
  // nicht jedem Browser recht, `calc(86% - 5.8px)` jedem.
  const versatz = DAUMEN / 2 - p * DAUMEN / 100;
  const links = versatz < 0
    ? `calc(${p.toFixed(1)}% - ${Math.abs(versatz).toFixed(2)}px)`
    : `calc(${p.toFixed(1)}% + ${versatz.toFixed(2)}px)`;
  return el('div', { class: 'reglerzeile reglerskala' },
    el('span', {}),
    el('div', { class: 'skala' },
      el('i', { class: 'optimum', style: { left: links }, title: T.taktik.optimumMarke })),
    el('span', {}));
}

/**
 * Wogegen gerechnet wird: der nächste Gegner, sonst der Ligaschnitt.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @returns {{ titel: string, werte: import('../engine/spiel.js').Verteidiger }}
 */
function gegnerSeite(stand) {
  const partie = naechstePartie(stand, stand.meinTeam);
  if (!partie) {
    return { titel: T.taktik.duellSchnitt, werte: ligaSchnittVerteidigung(stand) };
  }
  const zuhause = partie.heim === stand.meinTeam;
  const gegnerId = zuhause ? partie.gast : partie.heim;
  const wo = zuhause ? T.taktik.duellHeim : T.taktik.duellAuswaerts;
  return {
    titel: T.taktik.duell(`${teamById(gegnerId).name} (${wo})`),
    werte: teamStaerken(
      stand.kader[gegnerId], stand.spieltag,
      personnelVon(stand, gegnerId), passAnteilVon(stand, gegnerId)),
  };
}

/**
 * Die vier Summanden von `vorteil()` und ihre Summe, umgerechnet in Punkte.
 * @param {import('../engine/spiel.js').Angreifer} staerken
 * @param {import('../engine/spiel.js').Verteidiger} gegner
 * @param {number} anteil
 */
function duellBlock(staerken, gegner, anteil) {
  const t = vorteilTeile(staerken, gegner, anteil);
  return el('div', {},
    duellReihe(T.taktik.duellPass, t.pass),
    duellReihe(T.taktik.duellLauf, t.lauf),
    duellReihe(T.taktik.duellEinseitig, t.einseitig),
    duellReihe(T.taktik.duellKlippe, t.klippe),
    duellReihe(T.taktik.duellSumme, t.summe,
      T.taktik.duellPunkte(vorzeichen(t.summe * RATING_TO_POINTS))),
    el('p', { class: 'leise klein', style: { margin: '4px 0 12px' }, text: T.taktik.duellFussnote }));
}

/**
 * @param {string} beschriftung
 * @param {number} wert
 * @param {string} [punkte] nur die Summenzeile trägt eine zweite Spalte
 */
function duellReihe(beschriftung, wert, punkte) {
  return el('div', { class: punkte ? 'duellreihe summe' : 'duellreihe' },
    el('span', { class: 'klein', text: beschriftung }),
    el('span', { class: 'duellwert', text: vorzeichen(wert) }),
    el('span', { class: 'klein leise duellpunkte', text: punkte || '' }));
}

/**
 * Eine Zahl mit ihrem Vorzeichen und einer Nachkommastelle, deutsch.
 *
 * Immer mit Zeichen, auch im Plus: die Spalte besteht aus Beiträgen, und ob
 * einer trägt oder kostet, ist die halbe Aussage. Die exakte Null bekommt ±,
 * denn sie steht bei 50/50 für „kostet nichts", nicht für „ist nichts".
 * @param {number} wert
 */
function vorzeichen(wert) {
  const gerundet = Math.round(wert * 10) / 10;
  const zahl = Math.abs(gerundet).toFixed(1).replace('.', ',');
  if (gerundet > 0) return `+${zahl}`;
  if (gerundet < 0) return `−${zahl}`;
  return `±${zahl}`;
}

/** @param {string} beschriftung @param {number} wert */
function reihe(beschriftung, wert) {
  return el('div', { class: 'balkenreihe' },
    el('span', { class: 'klein', text: beschriftung }),
    balken(wert, LIGA_MAX_STAERKE),
    el('span', { class: 'klein', style: { textAlign: 'right' }, text: String(Math.round(wert)) }));
}
