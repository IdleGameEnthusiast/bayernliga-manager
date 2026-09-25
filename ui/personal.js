// @ts-check
/**
 * Personal: alle, die für den Verein arbeiten — die Spieler und der Stab.
 *
 * Die Tabelle stand bis hierher unten im Roster. Sie ist dort weggezogen, weil
 * der Roster seit dem Umbau eine Handlung ist („wer steht wo") und diese
 * Tabelle eine Nachschlagesache („wen haben wir überhaupt"). Zwei Bedeutungen
 * auf einer Fläche gingen schon bei der Zeile nicht mehr auf, an der Ansicht
 * gehen sie es erst recht nicht.
 *
 * Die Coaches sind reine Auskunft: zwei Koordinatoren, ihre Werte, ihre
 * Stärke. Einstellen und Entlassen gibt es noch nicht, und was ein Coach am
 * Spieltag oder in der Entwicklung bewirkt, entscheidet die Engine später —
 * hier wird nur gezeigt, was da ist. Orga steht als Reiter da, aber gesperrt:
 * der Platz ist entschieden, der Inhalt noch nicht.
 */

import { el, leere, tabelle as machTabelle, balken, sterne } from './dom.js';
import { T } from '../i18n.js';
import { istFit } from '../engine/spieler.js';
import {
  LIGA_MAX_STAERKE, MAX_RATING, POSITIONS, ATTRIBUTE, GRUPPE_JE_POSITION, EINHEIT_JE_GRUPPE,
} from '../engine/constants.js';
import { positionsKuerzel, hauptPosition, platzKuerzel } from '../engine/positionen.js';
import { bestePlaetze, specialTechnik, PERSONNEL_REIHE } from '../engine/aufstellung.js';
import {
  eigeneAufstellung, aufstellungVon, coachesVon, bindungVon, ergaenzeBindung,
} from '../engine/saison.js';
import {
  staerke as coachStaerke, SOFT_SKILLS, SCHEME_SKILLS, COACHING_GRUPPE_REIHE,
} from '../engine/coach.js';
import { stufe } from '../engine/commitment.js';
import { ROLLEN, rolleVon, mismatch, vernachlaessigung } from '../engine/rolle.js';
import { druck, halt } from '../engine/lebenslauf.js';
import { ausgesprochenerWunsch } from '../engine/wunsch.js';
import { offeneAblehnungen } from '../engine/ueberzeugen.js';
import { imRookieTraining } from '../engine/recruiting.js';
import { datum } from '../engine/kalender.js';

/**
 * Was die Ansicht zeigt, das der Manager sonst nicht sieht. Kommt aus
 * `app.js` — ob der Modus an ist, entscheidet nicht diese Datei.
 * @typedef {{ playtester: boolean }} Einblick
 */

/**
 * Was die Ansicht auslösen kann. Heute genau eins: ein Gespräch aufschlagen.
 * Der Dialog selbst gehört `app.js`, weil er über allen Ansichten liegt und
 * nicht nur über dieser.
 * @typedef {{ gespraech: (spielerId: string) => void }} Aktionen
 */

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
  // Zehn Stufen auf dreißig Mann heißt viele Gleichstände. Die bleiben in
  // Depth-Chart-Reihenfolge stehen, weil `sortiere()` stabil sortiert — unter
  // gleichem Talent steht also der Stärkere oben, und das ist die Reihenfolge,
  // in der man eine Talentspalte ohnehin liest. Eine feinere Zahl, nach der
  // sich heimlich sortieren ließe, gibt es seit dem Talentumbau nicht mehr.
  { id: 'talent', kopf: T.kader.talent, wert: (sp) => sp.talent },
  // Sortiert nach der versteckten Zahl, nicht nach der Stufe: innerhalb einer
  // Stufe ist die Reihenfolge dann nicht willkürlich. Die Zahl steht am Mann,
  // sobald `ergaenzeBindung()` einmal über den Kader gelaufen ist.
  { id: 'commitment', kopf: T.kader.commitment, wert: (sp) => sp.commitment ?? 0 },
  // Sortiert nach der Stufe der Rolle, nicht alphabetisch: „Starter" gehört
  // neben „Stammspieler" und nicht zwischen „Rotation" und „Ergänzung". Wer
  // noch keine hat, steht ganz unten — das ist die Liste, die der Manager in
  // der Offseason abarbeitet.
  { id: 'rolle', kopf: T.kader.rolle,
    wert: (sp) => (rolleVon(sp) === null ? -1 : ROLLEN.length - ROLLEN.indexOf(/** @type {any} */ (rolleVon(sp)))) },
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
  ['coaches', T.personal.coaches, true],
  ['orga', T.personal.orga, false],
]);

/** Welche Coaches ihre Werte gerade offen zeigen — das Gegenstück zu `offeneWerte`. */
const offeneCoaches = new Set();

/**
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {() => void} neuZeichnen
 * @param {Einblick} einblick
 * @param {Aktionen} aktionen
 */
export function zeigePersonal(stand, neuZeichnen, einblick, aktionen) {
  // Ein alter Stand trägt die Bindung noch nicht; hier wird sie nachgezogen,
  // bevor eine Spalte danach sortiert.
  ergaenzeBindung(stand);
  return el('div', {},
    unterreiter(neuZeichnen),
    bereich === 'coaches'
      ? coachesKarte(stand, einblick)
      : spielerKarte(stand, einblick, aktionen));
}

/**
 * Die Spielertabelle allein, ohne Karte und Überschrift — dieselbe Zeile,
 * dieselbe Sortierung, dasselbe Aufklappen der Werte wie im Personal-Reiter.
 * Der Tryout-Bildschirm hängt seinen eigenen Kader daran, damit ein Kandidat
 * dort gegen dieselben Zahlen steht, die der Manager vom Roster her kennt,
 * statt gegen eine zweite, schmalere Ansicht.
 *
 * `aktionen` ist optional: ohne sie bleibt die Zeile anklickbar für die Werte,
 * nur der Gespräch-Knopf fehlt — genau das, was der Tryout-Bildschirm will.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Einblick} einblick
 * @param {Aktionen} [aktionen]
 */
export function spielerTabelle(stand, einblick, aktionen) {
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
      [
        ...SPALTEN.map((sp) => kopfzelle(sp, male)),
        el('th', { 'aria-label': T.kader.gespraech }),
        el('th', { 'aria-label': T.kader.werte }),
      ],
      liste.flatMap((spieler, i) => [
        zeile(spieler, stand, male, trennerVor(liste, i), starter.get(spieler.id), einblick, aktionen),
        offeneWerte.has(spieler.id) ? werteZeile(spieler, stand, einblick) : null,
      ].filter(Boolean))));
  };
  male();

  return halter;
}

/**
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Einblick} einblick
 * @param {Aktionen} aktionen
 */
function spielerKarte(stand, einblick, aktionen) {
  const kader = stand.kader[stand.meinTeam];
  return el('div', { class: 'karte' },
    el('div', { class: 'kartenkopf' },
      el('h2', { text: T.personal.spieler }),
      el('span', { class: 'klein leise', text: T.personal.anzahl(kader.length) })),
    spielerTabelle(stand, einblick, aktionen));
}

/**
 * Der Stab: eine Zeile je Coach, aufklappbar auf seine vier Blöcke.
 *
 * Keine Sortierung — bei zwei Zeilen wäre der Spaltenkopf ein Versprechen ohne
 * Inhalt. Kommt sie, wenn der Stab wächst.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Einblick} einblick
 */
function coachesKarte(stand, einblick) {
  const stab = coachesVon(stand, stand.meinTeam);
  const halter = el('div', {});
  const male = () => {
    leere(halter);
    halter.append(machTabelle(
      [
        el('th', { text: T.coach.name }),
        el('th', { text: T.coach.rolle }),
        el('th', { text: T.coach.gruppe }),
        el('th', { text: T.coach.alter }),
        el('th', { text: T.coach.staerke }),
        el('th', { text: T.kader.commitment }),
        el('th', { 'aria-label': T.kader.werte }),
      ],
      stab.flatMap((coach) => [
        coachZeile(coach, stand, male, einblick),
        offeneCoaches.has(coach.id) ? coachWerteZeile(coach, stand) : null,
      ].filter(Boolean))));
  };
  male();

  return el('div', { class: 'karte' },
    el('div', { class: 'kartenkopf' },
      el('h2', { text: T.personal.coaches }),
      el('span', { class: 'klein leise', text: T.personal.stabAnzahl(stab.length) })),
    halter);
}

/**
 * Die Stufe als Text — und im Playtester-Modus die Zahl dahinter. Für Spieler
 * und Coaches dieselbe Zelle, weil es dieselbe Skala ist.
 * @param {number} commitment
 * @param {Einblick} einblick
 */
function bindungZelle(commitment, einblick) {
  const text = T.commitment.stufen[stufe(commitment)];
  return el('td', { class: 'leise', title: T.commitment.stufeTitel(text) },
    text,
    einblick.playtester
      ? el('span', { class: 'versteckt', text: ` ${Math.round(commitment)}` })
      : null);
}

/**
 * @param {import('../engine/coach.js').Coach} coach
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {() => void} male
 * @param {Einblick} einblick
 */
function coachZeile(coach, stand, male, einblick) {
  const offen = offeneCoaches.has(coach.id);
  const bindung = bindungVon(stand, coach);
  const werte = () => {
    if (offen) offeneCoaches.delete(coach.id); else offeneCoaches.add(coach.id);
    male();
  };
  const rolle = T.coach.rollen[coach.rolle];

  return el('tr', {
    class: 'spielerzeile coachzeile waehlbar' + (offen ? ' offen' : ''),
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
    el('td', { text: coach.vorname + ' ' + coach.nachname }),
    el('td', { text: rolle }),
    el('td', { class: 'leise', text: T.coach.gruppen[coach.gruppe] }),
    el('td', { class: 'leise', text: T.kader.alterWert(coach.alter) }),
    el('td', { style: { fontWeight: '600' }, title: T.coach.staerkeTitel(rolle),
      text: String(Math.round(coachStaerke(coach))) }),
    bindungZelle(bindung.commitment, einblick),
    el('td', { class: 'werteknopf leise', text: offen ? T.kader.sortAuf : T.kader.sortAb }));
}

/**
 * Die Lebenslage als eine Zeile unter den Werten: was der Mann erzählt, in
 * Stichworten. Der Satz kommt aus der Vorlage in `i18n.js`; die Felder
 * dahinter kennt nur die Engine.
 * @param {import('../engine/commitment.js').Lebenslage} lebenslage
 * @param {number} jahr
 */
function lebenslageZeile(lebenslage, jahr) {
  return el('div', { class: 'plaetze' },
    el('span', { class: 'klein leise', text: T.kader.lebenslage }),
    el('span', { class: 'klein', text: T.lebenslage.satz(lebenslage, jahr) }));
}

/**
 * Was wirklich kommt, und ab wann er es selbst weiß — nur für den Playtester.
 *
 * Der Satz wird mit derselben Vorlage gebaut wie der sichtbare Plan, nur mit
 * der Wahrheit an der Stelle des Horizonts. Ein eigener Satz dafür sagte
 * dasselbe in anderen Worten, und beim Vergleichen zweier Zeilen ist genau das
 * die Störung.
 * @param {import('../engine/commitment.js').Lebenslage} l
 * @param {number} jahr
 */
function versteckteWahrheit(l, jahr) {
  const w = l.horizontWahrheit;
  if (!w) return '';
  return T.lebenslage.horizont({ ...l, horizont: w }, jahr)
    + T.kader.wissbarAb(w.wissbarAb ?? w.jahr);
}

/**
 * Ein ausgesprochener Wunsch, eine Zeile unter der Lebenslage — oder nichts.
 *
 * Er muss außerhalb des Dialogs stehen, sonst wäre er nach dem Gespräch weg:
 * ein Positionswunsch zieht über Wochen, und den Dialog für jeden Spieler neu
 * aufzuschlagen, um nachzusehen, wäre kein Gedächtnis, sondern eine Suche.
 * Gezeigt wird nur, was er **gesagt** hat — der Anlass dahinter bleibt
 * verborgen, sonst wäre das Nachfragen umsonst.
 * @param {import('../engine/spieler.js').Spieler} sp
 */
function wunschZeile(sp) {
  const wunsch = ausgesprochenerWunsch(sp);
  if (!wunsch) return null;
  return el('div', { class: 'plaetze' },
    el('span', { class: 'klein leise', text: T.kader.wunsch }),
    el('span', { class: 'klein', text: wunsch.art === 'platz'
      ? T.gespraech.wunschPlatzSatz(wunsch.platz)
      : T.gespraech.wunschNummerSatz(wunsch.nummer) }));
}

/**
 * Wogegen er sich sperrt — oder nichts.
 *
 * Aus demselben Grund draußen wie der Wunsch: eine Ablehnung zieht über
 * Wochen, und wer sie nur im Dialog sähe, müsste raten, welchen der
 * fünfundvierzig er aufschlagen soll. Wie weit der Manager ihn schon hat,
 * steht hier bewusst **nicht** — der Fortschritt ist versteckt.
 * @param {import('../engine/spieler.js').Spieler} sp
 */
function ablehnungZeile(sp) {
  const offen = offeneAblehnungen(sp);
  if (offen.length === 0) return null;
  return el('div', { class: 'plaetze' },
    el('span', { class: 'klein leise', text: T.kader.ablehnung }),
    el('span', { class: 'klein', text: offen.join(', ') }));
}

/**
 * Die vier Blöcke eines Coaches, aufgeklappt unter seiner Zeile. Dieselbe
 * Balkenform wie beim Spieler, dieselbe Skala — ein Koordinator mit 22 steht
 * damit sichtbar unter jedem seiner Spieler, und das ist die Aussage.
 *
 * Die Ausnahme ist die Vertrautheit: sie wächst über den Ligadeckel hinaus bis
 * an die 99, und ein Balken, der bei 79 voll ist, sähe einen Spezialisten mit
 * 95 nicht mehr wachsen. Ihre Skala ist deshalb das Dach der Kurve.
 * @param {import('../engine/coach.js').Coach} coach
 * @param {import('../engine/saison.js').SpielStand} stand
 */
function coachWerteZeile(coach, stand) {
  const bindung = bindungVon(stand, coach);
  /**
   * @param {string} titel
   * @param {[string, number][]} eintraege Beschriftung und Wert
   * @param {number} [skala] Vollausschlag des Balkens
   */
  const block = (titel, eintraege, skala = LIGA_MAX_STAERKE) => el('div', { class: 'werteblock' },
    el('h3', { class: 'klein', text: titel }),
    el('div', { class: 'werte' },
      eintraege.map(([name, wert]) => el('div', { class: 'wert' },
        el('span', { class: 'klein leise', text: name }),
        balken(wert, skala),
        el('span', { class: 'klein', text: String(Math.round(wert)) })))));

  return el('tr', { class: 'wertezeile' },
    el('td', { colspan: '7' },
      block(T.coach.bloecke.soft, SOFT_SKILLS.map((s) => [T.coach.soft[s], coach.soft[s]])),
      block(T.coach.bloecke.scheme, SCHEME_SKILLS.map((s) => [T.coach.scheme[s], coach.scheme[s]])),
      block(T.coach.bloecke.personnel,
        PERSONNEL_REIHE.map((p) => [`${p} · ${T.personnel[p]}`, coach.personnel[p]]), MAX_RATING),
      block(T.coach.bloecke.technik,
        COACHING_GRUPPE_REIHE.map((g) => [T.coach.gruppen[g], coach.technik[g]])),
      lebenslageZeile(bindung.lebenslage, stand.jahr)));
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
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {() => void} male
 * @param {string} [trenner] Zusatzklasse für die Linie über der Zeile
 * @param {string[]} [plaetze] Die Plätze, die er in der Elf hält
 * @param {Einblick} [einblick]
 * @param {Aktionen} [aktionen]
 */
function zeile(sp, stand, male, trenner, plaetze, einblick = { playtester: false }, aktionen) {
  const tag = stand.tag;
  const fit = istFit(sp, tag);
  const offen = offeneWerte.has(sp.id);
  const bindung = bindungVon(stand, sp);
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
        : null,
      // Wer noch im Rookie-Training steht, ist heute weniger wert, als er in
      // ein paar Wochen sein wird — die Marke sagt, dass die Zahl daneben noch
      // wächst.
      imRookieTraining(sp, tag)
        ? el('span', {
          class: 'marke',
          title: T.tryout.rookieTitel(
            T.datum.ohneJahr(datum(stand.jahr, /** @type {number} */ (sp.rookieTrainingBis)))),
          text: T.tryout.rookie,
        })
        : null),
    el('td', { text: positionsKuerzel(sp) }),
    el('td', { class: 'leise', text: T.kader.koerperWert(sp.groesse, sp.gewicht) }),
    el('td', { class: 'leise', text: T.kader.alterWert(sp.alter) }),
    el('td', { style: { fontWeight: '600' }, text: String(sp.staerke) }),
    el('td', {}, sterne(sp.talent, T.kader.talentTitel(sp.talent))),
    bindungZelle(bindung.commitment, einblick),
    rollenZelle(sp),
    el('td', { class: fit ? 'leise' : 'verletzt' },
      fit ? T.kader.fit : T.kader.verletztBis(sp.verletztBis - tag)),
    // Der Knopf hängt an einer eigenen Zelle und nicht an der Zeile: die Zeile
    // klappt die Werte auf, und ein Tipp, der je nach Stelle zwei verschiedene
    // Dinge tut, ist genau der Griff, den man danebensetzt.
    el('td', {},
      aktionen
        ? el('button', {
          class: 'neben klein',
          onclick: (/** @type {MouseEvent} */ e) => {
            e.stopPropagation();
            aktionen.gespraech(sp.id);
          },
        }, T.kader.gespraech)
        : null),
    el('td', { class: 'werteknopf leise', text: offen ? T.kader.sortAuf : T.kader.sortAb }));
}

/**
 * Die Rolle als Kurzform — und ein Zeichen daneben, wenn die Einsatzzeit sie
 * gerade nicht deckt.
 *
 * Die Kurzform, weil „Unangefochtener Stammspieler" eine Tabellenspalte
 * sprengt; der ganze Name steht im `title` und im Gespräch. Wer noch keine
 * Rolle hat, bekommt einen Strich und keinen leeren Platz — leer sähe aus wie
 * ein Fehler, der Strich sagt „noch nicht besprochen".
 * @param {import('../engine/spieler.js').Spieler} sp
 */
function rollenZelle(sp) {
  const rolle = rolleVon(sp);
  // Die Marke steht in beiden Fällen, und das ist der Punkt: sie zeigt, wo
  // Bindung gerade verloren geht. Ohne Rolle ist der Grund ein anderer als mit
  // — deshalb ein eigener Satz und nicht derselbe zweimal.
  if (!rolle) {
    const uebergangen = vernachlaessigung(sp);
    return el('td', { class: 'leise', title: T.kader.ohneRolleTitel },
      T.kader.ohneRolle,
      uebergangen && uebergangen > 0 ? marke(T.kader.uebergangen) : null);
  }
  const fehlt = mismatch(sp);
  return el('td', {
    class: 'leise',
    title: T.rolle.titel(T.rolle.namen[rolle], T.rolle.erwartung[rolle]),
  },
    T.rolle.kurz[rolle],
    fehlt && fehlt > 0 ? marke(T.kader.rolleVerfehlt) : null);
}

/** Das Ausrufezeichen neben der Rolle. @param {string} titel */
function marke(titel) {
  return el('span', { class: 'marke warnung', text: '!', title: titel });
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
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Einblick} einblick
 */
function werteZeile(sp, stand, einblick) {
  const heimat = positionsKuerzel(sp);
  const technik = specialTechnik(sp);
  const bindung = bindungVon(stand, sp);

  return el('tr', { class: 'wertezeile' },
    el('td', { colspan: String(SPALTEN.length + 2) },
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
        })),
      lebenslageZeile(bindung.lebenslage, stand.jahr),
      wunschZeile(sp),
      ablehnungZeile(sp),
      // Die Zahlen, die das Spiel versteckt, in einer Zeile — nur für den, der
      // den Code eingelöst hat.
      einblick.playtester
        ? el('div', { class: 'plaetze versteckt' },
          el('span', { class: 'klein leise', text: T.kader.verstecktes }),
          el('span', { class: 'klein', text: T.kader.versteckteWerte({
            // Gerundet erst hier: der Drift bewegt das Commitment in
            // Bruchteilen, und die soll der Speicherstand behalten — sonst
            // verschluckt jedes Spiel mit +0,8 die Bewegung, oder es macht +1
            // daraus und ein Stammspieler liefe über eine Saison auf 99.
            commitment: Math.round(bindung.commitment),
            ruecktrittAlter: sp.ruecktrittAlter,
            druck: Math.round(druck(bindung.lebenslage)),
            halt: Math.round(halt(bindung.commitment, bindung.lebenslage, stand.jahr)),
            druckJahre: bindung.lebenslage.druckJahre || 0,
            einsatzFenster: (sp.einsatzFenster || []).join(''),
            mismatch: mismatch(sp) ? Number(mismatch(sp)).toFixed(2) : 0,
            wahrheit: versteckteWahrheit(bindung.lebenslage, stand.jahr),
          }) }))
        : null));
}
