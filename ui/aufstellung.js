// @ts-check
/**
 * Die Aufstellung: wer auf welchem Platz steht — und der Weg, das zu ändern.
 *
 * Sie steht im Kader und nicht in der Taktik: dort wird entschieden, was die
 * Mannschaft vorhat, hier steht, wer es tut.
 *
 * Der Weg ist für den Finger gebaut, nicht für die Maus. Es wird nichts
 * gezogen: ein Tipp wählt den Platz, ein zweiter den Mann — entweder aus den
 * fünf Besten, die unter dem Platz aufklappen, oder aus dem ganzen Roster
 * darunter, und dann bestätigt der Knopf in der Leiste oben. Beides landet auf
 * derselben Regel, `setzeAufstellung()`.
 *
 * Entscheidet keine Regel. Was ein Wechsel kostet, wer dabei wohin rutscht und
 * wer einspringt, sagt die Engine.
 */

import { el } from './dom.js';
import { T } from '../i18n.js';
import { platzKuerzel, positionsKuerzel } from '../engine/positionen.js';

/**
 * @typedef {object} Steuerung
 * @property {string | null} platz    Der gewählte Platz-Schlüssel
 * @property {string | null} spieler  Die gewählte Spieler-Id
 * @property {boolean} vonHand        Ob eine Vorgabe gespeichert ist
 * @property {(schluessel: string | null) => void} waehlePlatz
 * @property {(schluessel: string, spielerId: string) => void} setze
 * @property {() => void} automatisch
 * @property {(platz: string) => { spieler: import('../engine/spieler.js').Spieler, wert: number }[]} kandidaten
 */

/** @param {import('../engine/aufstellung.js').Platz} p */
function name(p) {
  if (!p.spieler) return T.taktik.keiner;
  return `${p.spieler.nummer} ${p.spieler.vorname.charAt(0)}. ${p.spieler.nachname}`;
}

/** @param {import('../engine/spieler.js').Spieler} s */
function kurzName(s) {
  return `${s.nummer} ${s.vorname.charAt(0)}. ${s.nachname}`;
}

/**
 * Auf welchem Platz ein Spieler gerade steht — `null`, wenn er auf der Bank
 * sitzt. Für den Hinweis, dass ein Wechsel ein Tausch wird.
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 * @param {string} spielerId
 */
function stehtAuf(a, spielerId) {
  const treffer = [...a.offense, ...a.defense]
    .find((p) => p.spieler && p.spieler.id === spielerId);
  return treffer ? treffer.platz : null;
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
 * @param {Steuerung} [steuerung]
 */
export function aufstellungKarte(a, steuerung) {
  const liste = (/** @type {import('../engine/aufstellung.js').Platz[]} */ plaetze) =>
    el('ul', { class: 'aufstellung' },
      plaetze.flatMap((p) => [platzZeile(p, steuerung), kandidatenZeile(a, p, steuerung)]));

  return el('div', { class: 'karte' },
    el('div', { class: 'kartenkopf' },
      el('h2', { text: T.taktik.aufstellung }),
      steuerung && steuerung.vonHand
        ? el('button', { class: 'neben klein', onclick: steuerung.automatisch },
          T.aufstellung.automatisch)
        : null),
    steuerung
      ? el('p', { class: 'leise klein', style: { margin: '0 0 6px' } },
        steuerung.vonHand ? T.aufstellung.vonHand : T.aufstellung.hinweis)
      : null,
    el('div', { class: 'elfen' },
      el('div', {}, el('h3', { class: 'klein', text: T.taktik.angriffElf }), liste(a.offense)),
      el('div', {}, el('h3', { class: 'klein', text: T.taktik.verteidigungElf }), liste(a.defense))),
    el('p', { class: 'leise klein', style: { margin: '10px 0 0' },
      text: T.taktik.kickPlaetze(
        a.k ? a.k.nachname : T.taktik.keiner,
        a.p ? a.p.nachname : T.taktik.keiner) }));
}

/**
 * @param {import('../engine/aufstellung.js').Platz} p
 * @param {Steuerung} [steuerung]
 */
function platzZeile(p, steuerung) {
  const gewaehlt = !!steuerung && steuerung.platz === p.schluessel;
  const waehle = () => steuerung
    && steuerung.waehlePlatz(gewaehlt ? null : p.schluessel);

  return el('li', {
    class: (steuerung ? 'waehlbar' : '') + (gewaehlt ? ' gewaehlt' : ''),
    ...(steuerung ? {
      role: 'button',
      tabindex: '0',
      'aria-pressed': String(gewaehlt),
      title: T.aufstellung.platzTitel(platzKuerzel(p.platz)),
      onclick: waehle,
      onkeydown: (/** @type {KeyboardEvent} */ e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        waehle();
      },
    } : {}),
  },
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
    }) : null);
}

/**
 * Die fünf Besten für den angetippten Platz, direkt darunter.
 *
 * Sie beantworten „wer ist hier der Beste" — nicht, was fürs Ganze am besten
 * wäre. Der Unterschied ist der Grund, warum diese Liste nicht dieselbe
 * Reihenfolge hat wie die Automatik: die stellt Paare, diese einen Platz.
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 * @param {import('../engine/aufstellung.js').Platz} p
 * @param {Steuerung} [steuerung]
 */
function kandidatenZeile(a, p, steuerung) {
  if (!steuerung || steuerung.platz !== p.schluessel) return null;

  return el('li', { class: 'kandidaten' },
    el('div', { class: 'klein leise', text: T.aufstellung.beste }),
    steuerung.kandidaten(p.platz).map(({ spieler, wert }) => {
      const wo = stehtAuf(a, spieler.id);
      const hier = p.spieler && p.spieler.id === spieler.id;
      return el('button', {
        class: 'kandidat' + (hier ? ' steht' : ''),
        disabled: hier || undefined,
        onclick: () => steuerung.setze(p.schluessel, spieler.id),
      },
        el('span', { class: 'kandidat-name', text: kurzName(spieler) }),
        el('span', { class: 'leise klein', text: positionsKuerzel(spieler) }),
        wo && !hier
          ? el('span', { class: 'marke tausch', text: T.aufstellung.tauscht(platzKuerzel(wo)) })
          : null,
        el('span', { class: 'platz-stk', text: String(Math.round(wert)) }));
    }),
    el('p', { class: 'leise klein', style: { margin: '6px 0 0' }, text: T.aufstellung.oderRoster }));
}

/**
 * Die Leiste, die den angefangenen Wechsel festhält.
 *
 * Sie klebt oben am Rand, weil der zweite Tipp unten im Roster passiert: ohne
 * sie müsste der Manager nach jeder Auswahl wieder hochscrollen, um zu sehen,
 * was er eigentlich gerade tut.
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 * @param {Steuerung} steuerung
 * @param {import('../engine/spieler.js').Spieler | null} spieler Der gewählte Mann
 */
export function wechselLeiste(a, steuerung, spieler) {
  if (!steuerung.platz) return null;
  const platz = [...a.offense, ...a.defense].find((p) => p.schluessel === steuerung.platz);
  if (!platz) return null;

  const ziel = platzKuerzel(platz.platz);
  return el('div', { class: 'wechselleiste' },
    el('div', { class: 'wechseltext' },
      el('strong', { text: ziel }),
      el('span', { class: 'klein leise', text: platz.spieler ? name(platz) : T.taktik.keiner }),
      spieler
        ? el('span', { class: 'klein', text: `${T.aufstellung.pfeil} ${kurzName(spieler)}` })
        : el('span', { class: 'klein leise', text: T.aufstellung.waehleSpieler })),
    el('div', { class: 'wechselknoepfe' },
      el('button', {
        class: 'haupt klein',
        disabled: !spieler || undefined,
        onclick: () => spieler && steuerung.setze(/** @type {string} */ (steuerung.platz), spieler.id),
      }, T.aufstellung.einsetzen),
      el('button', { class: 'neben klein', onclick: () => steuerung.waehlePlatz(null) },
        T.aktion.zurueck)));
}
