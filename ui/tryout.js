// @ts-check
/**
 * Was unter den drei Tryout-Nachrichten steht: die Werbung zum Ankreuzen, die
 * Kandidaten auf dem Platz, und die Neuen mit ihrer Position.
 *
 * Es steht **in** der Nachricht und nicht auf einem eigenen Reiter. Jede der
 * drei Stationen ist eine Entscheidung, die den Kalender anhält, und die
 * Nachricht ist der Ort, an dem der Manager sie trifft — ein Reiter daneben
 * wäre ein zweiter Weg zu derselben Sache, und der Knopf „fertig" stünde an
 * einer anderen Stelle als das, was fertig sein soll.
 *
 * Gezeigt wird in Stufen, nie in Zahlen: die Athletik gegen den Ligaschnitt,
 * die Prognose nach dem Rookie-Training, das Interesse. Was die Stufen
 * bedeuten, entscheidet `engine/recruiting.js`; hier werden sie nur benannt.
 */

import { el } from './dom.js';
import { T } from '../i18n.js';
import { POSITIONS } from '../engine/constants.js';
import {
  recruitingVon, MASSNAHMEN, ATHLETIK, zulauf, werbungOffen, prognosen, ligaSchnitt,
  athletikStufe, prognoseStufe, interesseStufe, tryoutGespraecheFrei,
} from '../engine/recruiting.js';

/**
 * @typedef {object} Aktionen
 * @property {(massnahme: string, an: boolean) => void} setzeWerbung
 * @property {(kandidatId: string) => void} sprichKandidat
 * @property {(spielerId: string, position: string) => void} setzeRookiePosition
 */

/**
 * Der Teil unter dem Text, sofern die Nachricht einen hat.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 * @returns {HTMLElement | null}
 */
export function tryoutTeil(n, stand, aktionen) {
  if (n.art === 'tryoutWerbung') return werbungTeil(n, stand, aktionen);
  if (n.art === 'tryout') return kandidatenTeil(n, stand, aktionen);
  if (n.art === 'tryoutZusagen') return neueTeil(n, stand, aktionen);
  return null;
}

/** Eine leise Zeile an der Stelle, an der vorher die Liste stand. @param {string} text */
function hinweis(text) {
  return el('div', { class: 'tryoutteil' }, el('p', { class: 'leise klein', text }));
}

// --- Die Werbung -------------------------------------------------------------

/**
 * Die Maßnahmen zum Ankreuzen, und darunter, wie viele das bringt.
 *
 * Nach der Antwort stehen sie noch da, aber gesperrt: der Manager soll sehen
 * können, was er beschlossen hat, ohne dass ein Häkchen noch etwas täte.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function werbungTeil(n, stand, aktionen) {
  const w = recruitingVon(stand).werbung;
  // Die Werbung eines vergangenen Tryouts ist überschrieben — dann bleibt der
  // Text allein stehen.
  if (!w || w.jahr !== n.daten.jahr || w.tag !== n.daten.tag) return null;
  const offen = n.antwort === null && werbungOffen(stand);

  return el('div', { class: 'tryoutteil' },
    el('div', { class: 'werbungliste' },
      MASSNAHMEN.map((m) => {
        const an = w.massnahmen.includes(m);
        return el('label', { class: 'werbungzeile' + (offen ? '' : ' gesperrt') },
          el('input', {
            type: 'checkbox',
            checked: an,
            disabled: !offen,
            onchange: (/** @type {Event} */ e) => aktionen.setzeWerbung(
              m, /** @type {HTMLInputElement} */ (e.target).checked),
          }),
          el('span', { class: 'werbungname', text: T.tryout.massnahmen[m] }),
          el('span', { class: 'leise klein', text: T.tryout.wen[m] }));
      })),
    el('p', { class: 'klein', text: T.tryout.andrang(zulauf(stand.meinTeam, w.massnahmen)) }),
    el('p', {
      class: 'leise klein',
      text: w.massnahmen.length === 0 ? T.tryout.keineWerbung
        : offen ? T.tryout.kostenlos : T.tryout.beschlossen,
    }));
}

// --- Die Kandidaten ----------------------------------------------------------

/**
 * Die Kandidaten auf dem Platz, jeder auf einer eigenen Karte, mit dem Knopf
 * fürs Gespräch.
 *
 * Karten und keine Tabelle: eine Zeile mit acht Spalten passte in die
 * Lesespalte des Postfachs nur mit Querscrollen, und auf dem Telefon gar
 * nicht. Eine Karte bricht um, und was zusammengehört — Name, Körper, wie
 * ernst es ihm ist und der Knopf —, steht in derselben Zeile.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function kandidatenTeil(n, stand, aktionen) {
  const tryout = recruitingVon(stand).tryout;
  if (!tryout || tryout.jahr !== n.daten.jahr || tryout.tag !== n.daten.tag) {
    return hinweis(T.tryout.vorbei);
  }
  const liga = ligaSchnitt(stand).staerke;
  const frei = tryoutGespraecheFrei(tryout);

  return el('div', { class: 'tryoutteil' },
    el('p', {
      class: 'klein',
      text: tryout.abgeschlossen ? T.tryout.abgeschlossen : T.tryout.gespraecheFrei(frei),
    }),
    el('div', { class: 'kandidaten' },
      tryout.kandidaten.map((k) => el('div', { class: 'kandidat' },
        el('div', { class: 'kandidatkopf' },
          el('div', { class: 'kandidatname' },
            el('strong', { text: `${k.vorname} ${k.nachname}` }),
            el('span', {
              class: 'leise klein',
              text: `${T.kader.alterWert(k.alter)} · ${T.kader.koerperWert(k.groesse, k.gewicht)}`,
            })),
          el('span', {
            class: 'marke interesse', title: T.tryout.interesse,
            text: T.tryout.interesseStufen[interesseStufe(k.interesse)],
          }),
          k.angesprochen
            ? el('span', { class: 'marke', text: T.tryout.angesprochen })
            : el('button', {
              class: 'neben klein',
              disabled: frei === 0,
              onclick: () => aktionen.sprichKandidat(k.id),
            }, T.tryout.ansprechen)),
        el('div', { class: 'klein', text: T.lebenslage.satzGast(k.lebenslage, stand.jahr) }),
        athletik(k.attribute, liga),
        el('div', { class: 'klein' },
          el('span', { class: 'leise', text: `${T.tryout.positionen}: ` }),
          prognoseText(prognosen(k), liga)),
        el('div', {
          class: 'leise klein', text: T.tryout.herkunft(T.tryout.massnahmen[k.herkunft]),
        })))));
}

/**
 * Die fünf Werte eines Vormittags, nebeneinander, je mit Punkten.
 * @param {Record<string, number>} attribute @param {number} liga
 */
function athletik(attribute, liga) {
  return el('div', { class: 'athletik' },
    ATHLETIK.map((a) => {
      const stufe = athletikStufe(attribute[a], liga);
      return el('span', {
        class: 'athletikwert',
        title: T.tryout.athletikTitel(T.attribute[a], T.tryout.athletikStufen[stufe]),
      },
        el('span', { class: 'leise klein', text: T.tryout.athletikKurz[a] }),
        el('span', {
          class: 'punkte',
          text: T.tryout.punktVoll.repeat(stufe + 1) + T.tryout.punktLeer.repeat(4 - stufe),
        }));
    }));
}

/**
 * Die drei Positionen, auf denen der Stab ihn am ehesten sieht, in einer Zeile.
 * @param {{ position: string, wert: number }[]} liste @param {number} liga
 */
function prognoseText(liste, liga) {
  return liste.slice(0, 3)
    .map((p) => T.tryout.prognose(p.position, T.tryout.prognoseStufen[prognoseStufe(p.wert, liga)]))
    .join(' · ');
}

// --- Die Neuen ---------------------------------------------------------------

/**
 * Wer zugesagt hat, mit der Auswahl seiner Position. Vorgewählt ist der
 * Vorschlag des Stabs; jede Position steht in der Liste, mit ihrer Stufe
 * daneben — wer einen Receiver zum Safety machen will, soll sehen, was es
 * kostet, und es trotzdem dürfen.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function neueTeil(n, stand, aktionen) {
  const neue = recruitingVon(stand).neue;
  if (n.antwort !== null) return hinweis(T.tryout.uebernommen);
  if (neue.length === 0) return null;
  const liga = ligaSchnitt(stand).staerke;
  /** @type {string[]} */
  const nachgerueckt = n.daten.nachgeruecktIds || [];

  return el('div', { class: 'tryoutteil' },
    el('div', { class: 'kandidaten' },
      neue.map((sp) => {
        const liste = prognosen({ ...sp, ziel: sp.rookieZiel || sp.staerke });
        const wert = Object.fromEntries(liste.map((p) => [p.position, p.wert]));
        return el('div', { class: 'kandidat' },
          el('div', { class: 'kandidatkopf' },
            el('div', { class: 'kandidatname' },
              el('strong', { text: `${sp.vorname} ${sp.nachname}` }),
              el('span', {
                class: 'leise klein',
                text: `${T.kader.alterWert(sp.alter)} · ${T.kader.koerperWert(sp.groesse, sp.gewicht)}`,
              })),
            nachgerueckt.includes(sp.id)
              ? el('span', {
                class: 'marke', title: T.tryout.nachgeruecktTitel, text: T.tryout.nachgerueckt,
              })
              : null,
            el('select', {
              'aria-label': T.tryout.position,
              onchange: (/** @type {Event} */ e) => aktionen.setzeRookiePosition(
                sp.id, /** @type {HTMLSelectElement} */ (e.target).value),
            }, POSITIONS.map((p) => el('option', {
              value: p,
              selected: p === sp.position,
              text: T.tryout.prognose(p, T.tryout.prognoseStufen[prognoseStufe(wert[p], liga)]),
            })))),
          el('div', { class: 'klein', text: T.lebenslage.satzGast(sp.lebenslage, stand.jahr) }),
          athletik(sp.attribute, liga),
          el('div', { class: 'klein' },
            el('span', { class: 'leise', text: `${T.tryout.vorschlag}: ` }),
            prognoseText(liste, liga)));
      })));
}
