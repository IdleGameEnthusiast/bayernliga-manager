// @ts-check
/**
 * Das Gespräch: ein Blatt über der Ansicht, auf dem der Manager einem Spieler
 * etwas sagt, das er nachher zu halten hat.
 *
 * Es sieht aus wie die Rückfrage in [`frage.js`](frage.js) und ist doch etwas
 * anderes: die Rückfrage hat zwei Knöpfe und ist danach vorbei, das Gespräch
 * hat **Schritte** — erst die Kategorie, dann die Rolle, dann seine Reaktion.
 * Deshalb eine eigene Datei statt eines Schalters in der Rückfrage; die beiden
 * wachsen in verschiedene Richtungen.
 *
 * Der Zustand liegt nicht hier, sondern in `app.js`: das Blatt zeichnet, was
 * ihm gereicht wird, und meldet zurück, was angetippt wurde. Ein Modul, das
 * sich merkt, welcher Schritt gerade offen ist, überlebt sonst das Schließen
 * und geht beim nächsten Spieler an der falschen Stelle wieder auf.
 *
 * **Vier der fünf Kategorien sind gesperrt.** Sie stehen trotzdem da, mit dem
 * Hinweis, dass sie kommen — eine Liste, in der später ohne Ankündigung vier
 * Zeilen erscheinen, liest sich wie ein anderes Spiel. Wer den Rahmen hier
 * einmal hat, hängt sie nur noch ein.
 *
 * Docs: docs/naechste-schritte.md, Block 7, Abschnitt „Gespräche"
 */

import { el } from './dom.js';
import { T } from '../i18n.js';
import { ROLLEN, rolleVon, erwarteteRolle, wiederAb } from '../engine/rolle.js';
import { positionsKuerzel } from '../engine/positionen.js';

/**
 * Was gerade offen ist. `kategorie` null heißt: die Auswahl steht an.
 * `reaktion` gesetzt heißt: gesprochen ist, es steht nur noch da, wie es ankam.
 * @typedef {object} Zustand
 * @property {string} spielerId
 * @property {string | null} kategorie
 * @property {import('../engine/rolle.js').Reaktion | null} reaktion
 */

/**
 * @typedef {object} Aktionen
 * @property {(kategorie: string) => void} waehleKategorie
 * @property {(rolle: import('../engine/rolle.js').Rolle) => void} setzeRolle
 * @property {() => void} schliesse
 */

/** Die Kategorien in der Reihenfolge des Fahrplans, und ob sie schon ziehen. */
const KATEGORIEN = /** @type {[string, boolean][]} */ ([
  ['rolle', true],
  ['lebenslage', false],
  ['persoenlich', false],
  ['wunsch', false],
  ['ueberzeugen', false],
]);

/**
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Zustand} zustand
 * @param {number} frei Wie viele Gespräche diese Woche noch gehen
 * @param {Aktionen} aktionen
 */
export function zeigeGespraech(stand, zustand, frei, aktionen) {
  const kader = stand.kader[stand.meinTeam] || [];
  const sp = kader.find((x) => x.id === zustand.spielerId);
  // Der Mann ist weg — zurückgetreten zwischen Aufschlagen und Zeichnen. Statt
  // zu werfen, steht ein Blatt da, das man zumachen kann.
  if (!sp) return blatt(T.gespraech.fort, [], aktionen);

  const name = `${sp.vorname} ${sp.nachname}`;
  const kopf = [
    el('h2', { text: T.gespraech.titel(name) }),
    el('div', { class: 'klein leise', text: T.gespraech.unter(positionsKuerzel(sp), sp.alter) }),
  ];

  if (zustand.reaktion) {
    return blattMit(kopf, [
      el('p', { class: 'gespraech-reaktion', text: T.gespraech.reaktionen[zustand.reaktion.ton](name) }),
      el('p', { class: 'klein leise', text: T.gespraech.bisher(T.rolle.namen[/** @type {string} */ (sp.rolle)]) }),
    ], [
      { label: T.gespraech.schliessen, klasse: 'haupt', wirkung: aktionen.schliesse },
    ]);
  }

  if (zustand.kategorie === 'rolle') {
    return rollenSchritt(kader, sp, kopf, frei, stand.tag, aktionen);
  }

  return blattMit(kopf, [
    el('p', {
      class: 'klein' + (frei > 0 ? ' leise' : ' warnung'),
      text: frei > 0 ? T.gespraech.kontingent(frei) : T.gespraech.keinKontingent,
    }),
    el('div', { class: 'gespraech-liste' },
      KATEGORIEN.map(([id, offen]) => el('button', {
        class: 'neben gespraech-kategorie',
        disabled: (!offen || frei === 0) || undefined,
        title: offen ? undefined : T.gespraech.baustelle,
        onclick: offen ? () => aktionen.waehleKategorie(id) : null,
      },
        el('span', { text: T.gespraech.kategorien[id] }),
        offen ? null : el('span', { class: 'klein leise', text: T.gespraech.baustelle })))),
  ], [
    { label: T.gespraech.abbrechen, klasse: 'neben', wirkung: aktionen.schliesse },
  ]);
}

/**
 * Der zweite Schritt: die fünf Rollen, mit dem, was der Stab dazu sagt.
 *
 * Die Einschätzung steht **über** den Knöpfen und sperrt keinen davon. Sie ist
 * eine Auskunft, keine Vorgabe: wer seinem viertbesten Receiver „Starter"
 * sagt, darf das — er bekommt einen glücklichen Mann und, vier Spiele später,
 * die Rechnung.
 * @param {import('../engine/spieler.js').Spieler[]} kader
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {(HTMLElement)[]} kopf
 * @param {number} frei
 * @param {number} tag
 * @param {Aktionen} aktionen
 */
function rollenSchritt(kader, sp, kopf, frei, tag, aktionen) {
  const bisher = rolleVon(sp);
  const sperre = wiederAb(sp);
  const gesperrt = sperre !== null && sperre > tag;

  const hinweise = [
    el('p', { class: 'klein leise', text: T.gespraech.einschaetzung(
      T.rolle.namen[erwarteteRolle(kader, sp)]) }),
    el('p', { class: 'klein leise', text: bisher
      ? T.gespraech.bisher(T.rolle.namen[bisher])
      : T.gespraech.bisherKeine }),
  ];

  if (gesperrt) {
    hinweise.push(el('p', { class: 'klein warnung',
      text: T.gespraech.gesperrt(/** @type {number} */ (sperre) - tag) }));
    return blattMit(kopf, hinweise, [
      { label: T.gespraech.schliessen, klasse: 'haupt', wirkung: aktionen.schliesse },
    ]);
  }

  // Ohne Kontingent stehen die Knöpfe da und tun nichts — dann muss daneben
  // stehen, warum. Ein gesperrter Knopf ohne Grund ist eine Sackgasse.
  if (frei === 0) {
    hinweise.push(el('p', { class: 'klein warnung', text: T.gespraech.keinKontingent }));
  }
  hinweise.push(el('h3', { class: 'klein', text: T.gespraech.rolleTitel }));
  hinweise.push(el('div', { class: 'gespraech-liste' },
    ROLLEN.map((rolle) => el('button', {
      class: 'neben gespraech-kategorie' + (rolle === bisher ? ' aktuell' : ''),
      disabled: frei === 0 || undefined,
      title: T.rolle.titel(T.rolle.namen[rolle], T.rolle.erwartung[rolle]),
      onclick: () => aktionen.setzeRolle(rolle),
    },
      el('span', { text: T.rolle.namen[rolle] }),
      el('span', { class: 'klein leise', text: T.rolle.erwartung[rolle] })))));

  return blattMit(kopf, hinweise, [
    { label: T.gespraech.abbrechen, klasse: 'neben', wirkung: aktionen.schliesse },
  ]);
}

/**
 * Das Blatt selbst. Kein Schließen durch Danebentippen — wie bei der
 * Rückfrage: es steht da, weil etwas zu sagen ist.
 * @param {(HTMLElement)[]} kopf
 * @param {(HTMLElement|null)[]} inhalt
 * @param {{ label: string, klasse?: string, wirkung: () => void }[]} knoepfe
 */
function blattMit(kopf, inhalt, knoepfe) {
  return el('div', {
    class: 'frageschirm',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': T.nav.personal,
  },
    el('div', { class: 'frage gespraech' },
      el('div', { class: 'gespraech-kopf' }, kopf),
      inhalt,
      el('div', { class: 'fragenknoepfe' },
        knoepfe.map((k) => el('button', {
          class: k.klasse || 'neben',
          onclick: k.wirkung,
        }, k.label)))));
}

/** @param {string} text @param {(HTMLElement|null)[]} inhalt @param {Aktionen} aktionen */
function blatt(text, inhalt, aktionen) {
  return blattMit([el('h2', { text })], inhalt, [
    { label: T.gespraech.schliessen, klasse: 'haupt', wirkung: aktionen.schliesse },
  ]);
}
