// @ts-check
/**
 * Personal: alle, die für den Verein arbeiten — heute nur die Spieler.
 *
 * Die Tabelle stand bis hierher unten im Roster. Sie ist dort weggezogen, weil
 * der Roster seit dem Umbau eine Handlung ist („wer steht wo") und diese
 * Tabelle eine Nachschlagesache („wen haben wir überhaupt"). Zwei Bedeutungen
 * auf einer Fläche gingen schon bei der Zeile nicht mehr auf, an der Ansicht
 * gehen sie es erst recht nicht.
 *
 * Coaches und Orga stehen als Reiter da, aber gesperrt. Das ist Absicht: der
 * Platz für sie ist entschieden, ihr Inhalt noch nicht, und ein gesperrter
 * Reiter sagt beides ehrlicher als gar keiner.
 */

import { el, leere, tabelle as machTabelle, balken, sterne } from './dom.js';
import { T } from '../i18n.js';
import { istFit, talentSterne } from '../engine/spieler.js';
import { LIGA_MAX_STAERKE, POSITIONS, ATTRIBUTE, GRUPPE_JE_POSITION, EINHEIT_JE_GRUPPE }
  from '../engine/constants.js';
import { positionsKuerzel, hauptPosition, platzKuerzel } from '../engine/positionen.js';
import { bestePlaetze, specialTechnik } from '../engine/aufstellung.js';
import { eigeneAufstellung, aufstellungVon } from '../engine/saison.js';

/**
 * Eine Spalte des Depth Charts: Beschriftung, Zellinhalt und der Wert, nach
 * dem sortiert wird. Zahlen sortieren numerisch, Text nach deutscher Sortier-
 * reihenfolge. Die Position wird zur Zahl, und zwar so, dass QB oben liegt:
 * absteigend ist damit die Depth-Chart-Reihenfolge, also der Standard.
 * @typedef {{
 *   id: string,
 *   kopf: string,
 *   wert: (sp: import('../engine/spieler.js').Spieler, tag: number) => number|string,
 * }} Spalte
 */

/** @type {Spalte[]} */
const SPALTEN = [
  { id: 'nummer', kopf: T.kader.nummer, wert: (sp) => sp.nummer },
  { id: 'name', kopf: T.kader.name, wert: (sp) => sp.nachname + ' ' + sp.vorname },
  { id: 'position', kopf: T.kader.position, wert: (sp) => POSITIONS.length - POSITIONS.indexOf(hauptPosition(sp)) },
  { id: 'koerper', kopf: T.kader.koerper, wert: (sp) => sp.gewicht },
  { id: 'alter', kopf: T.kader.alter, wert: (sp) => sp.alter },
  { id: 'staerke', kopf: T.kader.staerke, wert: (sp) => sp.staerke },
  { id: 'talent', kopf: T.kader.talent, wert: (sp) => sp.talent },
  { id: 'status', kopf: T.kader.status, wert: (sp, tag) => (istFit(sp, tag) ? 0 : sp.verletztBis - tag) },
];

/**
 * Wonach die Tabelle gerade sortiert ist — `null` heißt: der Standard, also
 * die Reihenfolge, in der die Engine den Kader liefert (Position, dann Stärke).
 * Der Merker lebt im Modul, damit die Sortierung einen Spieltag überlebt.
 * @type {{ spalte: string, richtung: 'ab'|'auf' } | null}
 */
let sortierung = null;

/**
 * Welche Spieler ihre Werte gerade offen zeigen. Beim eigenen Kader sind sie
 * einsehbar — bei einem fremden Verein gäbe es nur die Gesamtstärke, und diese
 * Ansicht zeigt nie einen fremden.
 * @type {Set<string>}
 */
const offeneWerte = new Set();

/** Welcher Unterreiter offen ist. Lebt im Modul und überlebt eine Neuzeichnung. */
let bereich = 'spieler';

/** Die Unterreiter, in ihrer Reihenfolge — und ob sie schon etwas zeigen. */
const BEREICHE = /** @type {[string, string, boolean][]} */ ([
  ['spieler', T.personal.spieler, true],
  ['coaches', T.personal.coaches, false],
  ['orga', T.personal.orga, false],
]);

/**
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {() => void} neuZeichnen
 */
export function zeigePersonal(stand, neuZeichnen) {
  const kader = stand.kader[stand.meinTeam];
  const tag = stand.tag;

  // Wer wo steht: dieselbe Marke wie im Roster, nur hier als Auskunft statt
  // als Handlung.
  const a = eigeneAufstellung(stand, aufstellungVon(stand, stand.meinTeam));
  /** @type {Map<string, string[]>} */
  const starter = new Map();
  for (const p of [...a.offense, ...a.defense]) {
    if (!p.spieler) continue;
    const bisher = starter.get(p.spieler.id);
    if (bisher) bisher.push(platzKuerzel(p.platz));
    else starter.set(p.spieler.id, [platzKuerzel(p.platz)]);
  }

  const halter = el('div', {});
  const male = () => {
    leere(halter);
    const liste = sortiere(kader, tag);
    halter.append(machTabelle(
      [...SPALTEN.map((sp) => kopfzelle(sp, male)), el('th', { 'aria-label': T.kader.werte })],
      liste.flatMap((spieler, i) => [
        zeile(spieler, tag, male, trennerVor(liste, i), starter.get(spieler.id)),
        offeneWerte.has(spieler.id) ? werteZeile(spieler) : null,
      ].filter(Boolean))));
  };
  male();

  return el('div', {},
    unterreiter(neuZeichnen),
    el('div', { class: 'karte' },
      el('div', { class: 'kartenkopf' },
        el('h2', { text: T.personal.spieler }),
        el('span', { class: 'klein leise', text: T.personal.anzahl(kader.length) })),
      halter));
}

/** @param {() => void} neuZeichnen */
function unterreiter(neuZeichnen) {
  return el('div', { class: 'reiter unter', role: 'tablist' },
    BEREICHE.map(([id, label, offen]) => el('button', {
      role: 'tab',
      'aria-selected': String(bereich === id),
      disabled: !offen || undefined,
      title: offen ? undefined : T.personal.baustelle,
      onclick: () => { bereich = id; neuZeichnen(); },
    }, label)));
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
 * @param {import('../engine/spieler.js').Spieler[]} kader @param {number} tag
 */
function sortiere(kader, tag) {
  if (!sortierung) return kader;
  const spalte = SPALTEN.find((sp) => sp.id === sortierung?.spalte);
  if (!spalte) return kader;
  const vorzeichen = sortierung.richtung === 'ab' ? -1 : 1;

  return kader.slice().sort((a, b) => {
    const x = spalte.wert(a, tag);
    const y = spalte.wert(b, tag);
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
  const hier = hauptPosition(liste[i]);
  const davor = hauptPosition(liste[i - 1]);
  if (hier === davor) return '';
  const einheit = (/** @type {string} */ pos) => EINHEIT_JE_GRUPPE[GRUPPE_JE_POSITION[pos]];
  return einheit(hier) === einheit(davor) ? 'positionsstart' : 'einheitsstart';
}

/**
 * Eine Zeile der Personalakte.
 *
 * Sie wählt nichts mehr aus — aufgestellt wird im Roster. Der Tipp auf die
 * Zeile klappt deshalb wieder die Werte auf, so wie vor der Aufstellung von
 * Hand: es ist die einzige Bedeutung, die diese Fläche hier noch hat.
 *
 * Wer in der Elf steht, trägt seinen Platz hinter dem Namen. Die Marke
 * beantwortet die Frage rückwärts, wie sie gestellt wird: nicht „wer steht",
 * sondern „wer steht **nicht**".
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {number} tag
 * @param {() => void} male
 * @param {string} [trenner] Zusatzklasse für die Linie über der Zeile
 * @param {string[]} [plaetze] Die Plätze, die er in der Elf hält
 */
function zeile(sp, tag, male, trenner, plaetze) {
  const fit = istFit(sp, tag);
  const offen = offeneWerte.has(sp.id);
  const werte = () => {
    if (offen) offeneWerte.delete(sp.id); else offeneWerte.add(sp.id);
    male();
  };

  return el('tr', {
    class: 'spielerzeile waehlbar' + (offen ? ' offen' : '')
      + (plaetze ? ' starter' : '') + (trenner ? ' ' + trenner : ''),
    role: 'button',
    tabindex: '0',
    'aria-expanded': String(offen),
    title: offen ? T.kader.werteVerbergen : T.kader.werteZeigen,
    onclick: werte,
    onkeydown: (/** @type {KeyboardEvent} */ e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      werte();
    },
  },
    el('td', { class: 'leise', text: String(sp.nummer) }),
    el('td', {},
      sp.vorname + ' ' + sp.nachname,
      plaetze
        ? el('span', {
          class: 'marke starter',
          title: T.aufstellung.starterTitel(plaetze.join(' · ')),
          text: plaetze.join(' · '),
        })
        : null),
    el('td', { text: positionsKuerzel(sp) }),
    el('td', { class: 'leise', text: T.kader.koerperWert(sp.groesse, sp.gewicht) }),
    el('td', { class: 'leise', text: T.kader.alterWert(sp.alter) }),
    el('td', { style: { fontWeight: '600' }, text: String(sp.staerke) }),
    el('td', {}, sterne(talentSterne(sp.talent), T.kader.talentTitel(sp.talent))),
    el('td', { class: fit ? 'leise' : 'verletzt' },
      fit ? T.kader.fit : T.kader.verletztBis(sp.verletztBis - tag)),
    el('td', { class: 'werteknopf leise', text: offen ? T.kader.sortAuf : T.kader.sortAb }));
}

/**
 * Die fünfzehn Werte eines Spielers, aufgeklappt unter seiner Zeile — dazu die
 * beiden Kickwerte und die fünf Plätze, auf denen er jetzt am meisten wert wäre.
 *
 * Die Attribute sagen, was er mitbringt; die fünf Plätze sagen, wozu das
 * gerade taugt. Es ist dieselbe Zahl, die die Aufstellung hinter einem Namen
 * zeigt — und die hängt nicht an der Ausrichtung des Vereins: wo ein Mann
 * hingehört, ändert der Regler im Taktikreiter nicht.
 *
 * Bein und Zielwasser stehen abgesetzt daneben: sie gehören zu keiner der
 * fünfzehn und zu keinem der Plätze, sondern zu den Special Teams.
 * @param {import('../engine/spieler.js').Spieler} sp
 */
function werteZeile(sp) {
  const heimat = positionsKuerzel(sp);
  const technik = specialTechnik(sp);

  return el('tr', { class: 'wertezeile' },
    el('td', { colspan: String(SPALTEN.length + 1) },
      el('div', { class: 'werte' },
        ATTRIBUTE.map((attribut) => el('div', { class: 'wert' },
          el('span', { class: 'klein leise', text: T.attribute[attribut] }),
          balken(sp.attribute[attribut], LIGA_MAX_STAERKE),
          el('span', { class: 'klein', text: String(Math.round(sp.attribute[attribut])) })))),
      el('div', { class: 'plaetze' },
        el('span', { class: 'klein leise', text: T.kader.special }),
        el('span', { class: 'platzwert', title: T.special.beinTitel },
          el('b', { text: T.special.bein }), el('span', { text: String(sp.kickStaerke) })),
        el('span', { class: 'platzwert', title: T.special.zielTitel },
          el('b', { text: T.special.ziel }), el('span', { text: String(sp.kickGenauigkeit) })),
        technik > 0
          ? el('span', { class: 'platzwert heim', title: T.special.technikTitel },
            el('b', { text: T.special.technik }), el('span', { text: String(Math.round(technik)) }))
          : null),
      el('div', { class: 'plaetze' },
        el('span', { class: 'klein leise', text: T.kader.bestePositionen }),
        bestePlaetze(sp).map((eintrag) => {
          const wert = Math.round(eintrag.wert);
          const heim = eintrag.kuerzel === heimat;
          return el('span', {
            class: heim ? 'platzwert heim' : 'platzwert',
            title: T.kader.positionsWert(eintrag.kuerzel, wert)
              + (heim ? ' — ' + T.kader.eigenePosition(eintrag.kuerzel) : ''),
          },
            el('b', { text: eintrag.kuerzel }),
            el('span', { text: String(wert) }));
        }))));
}
