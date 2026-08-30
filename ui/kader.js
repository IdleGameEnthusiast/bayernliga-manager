// @ts-check
/**
 * Kaderansicht: Mannschaftsteile oben, Aufstellung darunter, Roster zuletzt.
 *
 * Sie ist zugleich der Ort, an dem aufgestellt wird. Der Weg dorthin geht über
 * zwei Tipps und keinen Zug — und in beide Richtungen: entweder erst der Platz
 * und dann der Mann, oder erst der Mann und dann der Platz. Das ist auf einem
 * Tablet mit dem Daumen bedienbar; Ziehen wäre es nicht.
 *
 * Weil eine Rosterzeile damit auswählt, hat das Aufklappen der fünfzehn Werte
 * einen eigenen Knopf am Zeilenende bekommen. Zwei Bedeutungen auf derselben
 * Fläche gingen nicht mehr auf: Aufstellen ist die Handlung dieser Ansicht,
 * Werte nachsehen die Nebensache.
 */

import { el, leere, tabelle as machTabelle, balken, sterne } from './dom.js';
import { T } from '../i18n.js';
import {
  teamStaerken, gesamtStaerke, angriffStaerke, verteidigungStaerke, verletzte,
} from '../engine/team.js';
import { istFit, talentSterne } from '../engine/spieler.js';
import {
  LIGA_MAX_STAERKE, POSITIONS, ATTRIBUTE, GRUPPE_JE_POSITION, EINHEIT_JE_GRUPPE,
} from '../engine/constants.js';
import { positionsKuerzel, hauptPosition, platzKuerzel } from '../engine/positionen.js';
import { bestenFuer, bestePlaetze, wertAuf, vollstaendig } from '../engine/aufstellung.js';
import { personnelVon, passAnteilVon, aufstellungVon } from '../engine/saison.js';
import { aufstellungKarte, wechselLeiste } from './aufstellung.js';

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
  { id: 'position', kopf: T.kader.position, wert: (sp) => POSITIONS.length - POSITIONS.indexOf(hauptPosition(sp)) },
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
 * Der angefangene Wechsel: der Platz, der neu besetzt werden soll, und der
 * Mann, der dafür vorgemerkt ist. Beides lebt im Modul, damit es eine
 * Neuzeichnung überlebt — die Auswahl ist eine Absicht des Managers, kein
 * Zustand des Spielstands, und hat deshalb im Speicherstand nichts zu suchen.
 * @type {{ platz: string | null, spieler: string | null }}
 */
let auswahl = { platz: null, spieler: null };

const nichtsGewaehlt = () => { auswahl = { platz: null, spieler: null }; };

/**
 * Ob die Kandidatenliste unter einem Platz auch die zeigt, die schon in der Elf
 * stehen. Standard ist ja — abgeschaltet beantwortet die Liste „wer von der
 * Bank", und das ist die Frage, sobald jemand ausfällt. Lebt wie die Auswahl im
 * Modul und überlebt damit eine Neuzeichnung.
 */
let starterZeigen = true;

/** Wie viele Namen die Kandidatenliste nach der Zahl zeigt. Die gesetzten
 * Zeilen — wer dort steht, und der Beste, der dort zu Hause ist — kommen dazu. */
const KANDIDATEN = 5;

/**
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {{ vorgabe: import('../engine/aufstellung.js').Vorgabe | null } | null} entwurf
 * @param {{ setze: (schluessel: string, spielerId: string) => void,
 *           automatisch: () => void, entferne: (spielerId: string) => void,
 *           leeren: () => void, speichern: () => boolean, verwerfen: () => void,
 *           neuZeichnen: () => void }} aktionen
 */
export function zeigeKader(stand, entwurf, aktionen) {
  const kader = stand.kader[stand.meinTeam];
  const spieltag = stand.spieltag;
  const personnel = personnelVon(stand, stand.meinTeam);
  const anteil = passAnteilVon(stand, stand.meinTeam);

  // Der Entwurf schlägt den Stand: die Ansicht zeigt, was gälte, wenn der
  // Manager jetzt speichert — Mannschaftsteile eingerechnet.
  const vorgabe = entwurf ? entwurf.vorgabe : aufstellungVon(stand, stand.meinTeam);

  const s = teamStaerken(kader, spieltag, personnel, anteil, vorgabe);
  const verletzt = verletzte(kader, spieltag);

  // Ein Platz, den es nicht mehr gibt — der Manager hat zwischendurch das
  // System gewechselt. Ohne diese Zeile bliebe der Roster im Auswahlmodus
  // stehen, ohne Leiste, die ihn wieder herausließe.
  const plaetze = [...s.aufstellung.offense, ...s.aufstellung.defense];
  if (auswahl.platz && !plaetze.some((p) => p.schluessel === auswahl.platz)) nichtsGewaehlt();

  // Wer steht, steht wo: der Roster markiert seine Starter mit dem Platz, den
  // sie halten. Was hier fehlt, ist die Antwort auf „wer ist noch keiner".
  /** @type {Map<string, string[]>} */
  const starter = new Map();
  for (const p of plaetze) {
    if (!p.spieler) continue;
    const bisher = starter.get(p.spieler.id);
    if (bisher) bisher.push(platzKuerzel(p.platz));
    else starter.set(p.spieler.id, [platzKuerzel(p.platz)]);
  }

  const gewaehlterSpieler = kader.find((sp) => sp.id === auswahl.spieler) || null;

  /** @type {import('./aufstellung.js').Steuerung} */
  const steuerung = {
    platz: auswahl.platz,
    spieler: auswahl.spieler,
    vonHand: !!vorgabe,
    veraendert: !!entwurf,
    vollstaendig: vollstaendig(s.aufstellung),
    speichern: () => { aktionen.speichern(); },
    verwerfen: aktionen.verwerfen,
    entferne: (spielerId) => {
      nichtsGewaehlt();
      aktionen.entferne(spielerId);
    },
    leeren: () => {
      nichtsGewaehlt();
      aktionen.leeren();
    },
    wertFuer: (platz) => (gewaehlterSpieler ? wertAuf(gewaehlterSpieler, platz, anteil) : 0),
    gewaehlterName: gewaehlterSpieler ? gewaehlterSpieler.nachname : '',
    waehlePlatz: (schluessel) => {
      auswahl = { platz: schluessel, spieler: null };
      aktionen.neuZeichnen();
    },
    setze: (schluessel, spielerId) => {
      nichtsGewaehlt();
      aktionen.setze(schluessel, spielerId);
    },
    automatisch: () => {
      nichtsGewaehlt();
      aktionen.automatisch();
    },
    starterZeigen,
    zeigeStarter: (an) => {
      starterZeigen = an;
      aktionen.neuZeichnen();
    },
    // Ohne die Starter bleibt die Frage übrig, die der Manager an dieser Stelle
    // meistens hat: wer von denen, die **nicht** stehen, wäre hier der Beste.
    // Die fünf Besten sind sonst fast immer dieselben, die ohnehin schon spielen.
    kandidaten: (platz, stehtDort) => bestenFuer(
      starterZeigen ? kader : kader.filter((sp) => !starter.has(sp.id)),
      spieltag, platz, anteil, KANDIDATEN, stehtDort),
  };

  // Eine Rosterzeile wählt immer aus — mit offenem Platz für die Bestätigung
  // oben, ohne ihn als Frage „wohin mit ihm", die die Aufstellung beantwortet.
  const waehleSpieler = (/** @type {string} */ id) => {
    auswahl = { platz: auswahl.platz, spieler: auswahl.spieler === id ? null : id };
    aktionen.neuZeichnen();
  };

  // Drei Zahlen, nicht fünf. Der Roster sagt, was die Mannschaft ist — Lauf und
  // Pass hälftig, ungeachtet der Ausrichtung. Wie sich die Taktik darauf
  // auswirkt, steht aufgeschlüsselt im Taktikreiter und nur dort.
  const einheiten = el('div', { class: 'karte' },
    el('h2', { text: T.kader.einheiten }),
    reihe(T.kader.angriff, angriffStaerke(s)),
    reihe(T.kader.verteidigung, verteidigungStaerke(s)),
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
      [...SPALTEN.map((sp) => kopfzelle(sp, male)), el('th', { 'aria-label': T.kader.werte })],
      liste.flatMap((spieler, i) => [
        zeile(spieler, spieltag, male, trennerVor(liste, i),
          waehleSpieler, auswahl.spieler, starter.get(spieler.id)),
        offeneWerte.has(spieler.id) ? werteZeile(spieler, anteil) : null,
      ].filter(Boolean))));
  };
  male();

  return el('div', {},
    wechselLeiste(s.aufstellung, steuerung, gewaehlterSpieler),
    einheiten,
    aufstellungKarte(s.aufstellung, steuerung),
    el('div', { class: 'karte' },
      el('h2', { text: T.nav.kader }),
      el('p', { class: auswahl.platz ? 'klein' : 'leise klein', style: { margin: '0 0 6px' },
        text: auswahl.platz ? T.aufstellung.rosterWaehlen : T.aufstellung.rosterHinweis }),
      halter));
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
  const hier = hauptPosition(liste[i]);
  const davor = hauptPosition(liste[i - 1]);
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
 * Eine Kaderzeile.
 *
 * Der Tipp auf die Zeile wählt den Mann aus — Aufstellen ist die Handlung
 * dieser Ansicht. Die fünfzehn Werte hängen deshalb am eigenen Knopf am
 * Zeilenende: zwei Bedeutungen auf derselben Fläche gehen nicht auf, und die
 * seltenere zieht um.
 *
 * Wer in der Elf steht, trägt seinen Platz hinter dem Namen. Die Marke
 * beantwortet die Frage rückwärts, wie sie gestellt wird: nicht „wer steht",
 * sondern „wer steht **nicht**".
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {number} spieltag
 * @param {() => void} male
 * @param {string} [trenner] Zusatzklasse für die Linie über der Zeile
 * @param {(id: string) => void} [waehle]
 * @param {string | null} [gewaehlt] Die Id des vorgemerkten Manns
 * @param {string[]} [plaetze] Die Plätze, die er in der Elf hält
 */
function zeile(sp, spieltag, male, trenner, waehle, gewaehlt, plaetze) {
  const fit = istFit(sp, spieltag);
  const offen = offeneWerte.has(sp.id);
  const markiert = gewaehlt === sp.id;
  const waehlen = () => waehle && waehle(sp.id);
  const werte = () => {
    if (offen) offeneWerte.delete(sp.id); else offeneWerte.add(sp.id);
    male();
  };

  return el('tr', {
    class: 'spielerzeile' + (offen ? ' offen' : '') + (waehle ? ' waehlbar' : '')
      + (markiert ? ' gewaehlt' : '') + (plaetze ? ' starter' : '')
      + (trenner ? ' ' + trenner : ''),
    role: 'button',
    tabindex: '0',
    'aria-pressed': String(!!markiert),
    title: T.aufstellung.spielerWaehlen(sp.nachname),
    onclick: waehlen,
    onkeydown: (/** @type {KeyboardEvent} */ e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      waehlen();
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
      fit ? T.kader.fit : T.kader.verletztBis(sp.verletztBis - spieltag)),
    el('td', { class: 'werteknopf' }, el('button', {
      class: 'chevron',
      'aria-expanded': String(offen),
      title: offen ? T.kader.werteVerbergen : T.kader.werteZeigen,
      onclick: (/** @type {MouseEvent} */ e) => { e.stopPropagation(); werte(); },
      onkeydown: (/** @type {KeyboardEvent} */ e) => e.stopPropagation(),
    }, offen ? T.kader.sortAuf : T.kader.sortAb)));
}

/**
 * Die fünfzehn Werte eines Spielers, aufgeklappt unter seiner Zeile — und
 * darunter die fünf Plätze, auf denen er jetzt am meisten wert wäre.
 *
 * Die Attribute sagen, was er mitbringt; die fünf Plätze sagen, wozu das
 * gerade taugt. Es ist dieselbe Zahl, die die Aufstellung hinter einem Namen
 * zeigt, also mit der Ausrichtung gerechnet, die der Verein gerade fährt — die
 * beiden Ansichten dürfen sich hier nicht widersprechen.
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {number} anteil Der Passanteil des eigenen Vereins
 */
function werteZeile(sp, anteil) {
  const heimat = positionsKuerzel(sp);

  return el('tr', { class: 'wertezeile' },
    el('td', { colspan: String(SPALTEN.length + 1) },
      el('div', { class: 'werte' },
        ATTRIBUTE.map((attribut) => el('div', { class: 'wert' },
          el('span', { class: 'klein leise', text: T.attribute[attribut] }),
          balken(sp.attribute[attribut], LIGA_MAX_STAERKE),
          el('span', { class: 'klein', text: String(Math.round(sp.attribute[attribut])) })))),
      el('div', { class: 'plaetze' },
        el('span', { class: 'klein leise', text: T.kader.bestePositionen }),
        bestePlaetze(sp, anteil).map((eintrag) => {
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

/** @param {string} beschriftung @param {number} wert */
function reihe(beschriftung, wert) {
  return el('div', { class: 'balkenreihe' },
    el('span', { class: 'klein', text: beschriftung }),
    balken(wert, LIGA_MAX_STAERKE),
    el('span', { class: 'klein', style: { textAlign: 'right' }, text: String(Math.round(wert)) }));
}
