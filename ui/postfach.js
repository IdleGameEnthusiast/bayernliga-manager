// @ts-check
/**
 * Der erste Bildschirm: ein Monatsraster, die Tageskarte darunter, und das
 * Postfach darunter.
 *
 * Die Fußleiste ist mit dieser Ansicht weggefallen — der Sprung gehört in den
 * Kalender und nicht unter jeden Bildschirm. Damit trägt die **Tageskarte** die
 * Handlung: sie ist die sichtbare Oberfläche jedes Zwangsstopps, und ohne sie
 * säße der Manager an einem Spieltag fest.
 *
 * Docs: docs/umbau-kalender.md, Abschnitt 10
 */

import { el } from './dom.js';
import { T } from '../i18n.js';
import { teamById } from '../engine/content.js';
import {
  datum, tagVonDatum, tageImMonat, rasterVersatz, spieltagAmTag, phaseAmTag,
  saisonLaenge,
} from '../engine/kalender.js';
import { brauchtAntwort, antwortenZu, nachrichtenAmTag } from '../engine/postfach.js';
import { naechsterStopp, eigenePartieAmTag } from '../engine/saison.js';

/**
 * Welcher Monat gerade im Raster steht. Lebt im Modul, damit das Blättern einen
 * Neuaufbau der Ansicht überlebt — die Ansicht wird nach jedem Handgriff neu
 * gebaut, und ein zurückspringender Kalender wäre unbedienbar.
 * @type {{ jahr: number, j: number, m: number } | null}
 */
let monat = null;

/**
 * Der Tag, für den das Raster zuletzt ausgerichtet wurde.
 *
 * Er ist der Unterschied zwischen „der Manager blättert" und „die Uhr ist
 * weitergelaufen": das eine lässt den Monat stehen, das andere holt ihn zum
 * heutigen zurück.
 * @type {number | null}
 */
let gesehenerTag = null;

/** Welche Nachrichten aufgeklappt sind. @type {Set<string>} */
const offene = new Set();

/**
 * @typedef {object} Aktionen
 * @property {(zielTag?: number | null) => void} weiter
 * @property {(id: string, antwort: string) => void} beantworte
 * @property {(id: string) => void} oeffne     Aufklappen und als gelesen führen
 * @property {(partie: import('../engine/spielplan.js').Partie) => void} zumBericht
 * @property {() => void} exportieren
 * @property {() => void} importieren
 * @property {() => void} neuesSpiel
 * @property {() => void} neuZeichnen
 */

/**
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
export function zeigePostfach(stand, aktionen) {
  if (!monat || monat.jahr !== stand.jahr || gesehenerTag !== stand.tag) {
    monat = heutigerMonat(stand);
    gesehenerTag = stand.tag;
  }

  const post = stand.post.slice().reverse();
  const eingang = post.filter((n) => !n.gelesen || istOffen(n));
  const archiv = post.filter((n) => n.gelesen && !istOffen(n));

  return el('div', {},
    kalenderKarte(stand, aktionen),
    tagesKarte(stand, aktionen),
    listenKarte(T.postfach.posteingang, eingang, T.postfach.keinePost, stand, aktionen),
    listenKarte(T.postfach.archiv, archiv, T.postfach.keinArchiv, stand, aktionen),
    historieKarte(stand),
    datenKarte(aktionen));
}

/** Eine Nachricht, die noch auf eine Antwort wartet. @param {import('../engine/postfach.js').Nachricht} n */
function istOffen(n) {
  return brauchtAntwort(n.art) && n.antwort === null;
}

/**
 * Die Textvorlage zu einer Art — `von`, `betreff(daten)`, `text(daten)` und bei
 * den zweien mit Antwortpflicht die Beschriftungen ihrer Antworten.
 *
 * Fehlt sie, ist die Nachricht aus einer neueren Fassung des Spiels: dann wird
 * die Zeile roh angezeigt statt zu werfen.
 * @param {string} art
 * @returns {{ von: string, betreff: (d: any) => string, text: (d: any) => string[],
 *             antworten?: Record<string, string> } | null}
 */
function vorlageVon(art) {
  return /** @type {Record<string, any>} */ (T.post)[art] || null;
}

/** @param {import('../engine/saison.js').SpielStand} stand */
function heutigerMonat(stand) {
  const d = datum(stand.jahr, stand.tag);
  return { jahr: stand.jahr, j: d.j, m: d.m };
}

// --- Das Monatsraster ------------------------------------------------------

/**
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function kalenderKarte(stand, aktionen) {
  const { j, m } = /** @type {{ jahr: number, j: number, m: number }} */ (monat);
  const ende = saisonLaenge(stand.jahr);

  // Das Raster fängt montags an, wie ein deutscher Kalender. Dass Tag 1 der
  // Saison ein Samstag ist, ist eine Eigenschaft der Rechnung, keine der
  // Anzeige — hier wird deshalb ganz normal gezählt.
  const zellen = [];
  for (let i = 0; i < rasterVersatz(j, m); i++) {
    zellen.push(el('div', { class: 'kaltag leer' }));
  }
  for (let t = 1; t <= tageImMonat(j, m); t++) {
    zellen.push(tagesZelle(stand, aktionen, tagVonDatum(stand.jahr, j, m, t), t, ende));
  }

  return el('div', { class: 'karte kalender' },
    el('div', { class: 'kalkopf' },
      el('button', {
        class: 'kalpfeil', type: 'button',
        title: T.postfach.monatZurueck, 'aria-label': T.postfach.monatZurueck,
        onclick: () => { blaettere(stand, -1); aktionen.neuZeichnen(); },
      }, '◀'),
      el('h2', { text: T.datum.monatJahr(j, m) }),
      el('button', {
        class: 'kalpfeil', type: 'button',
        title: T.postfach.monatVor, 'aria-label': T.postfach.monatVor,
        onclick: () => { blaettere(stand, 1); aktionen.neuZeichnen(); },
      }, '▶')),
    el('div', { class: 'kalraster kalkopfzeile' },
      T.datum.rasterTage.map((n) => el('div', { class: 'kalwochentag', text: n }))),
    el('div', { class: 'kalraster' }, zellen),
    el('div', { class: 'kallegende klein leise' },
      legende(T.postfach.zeichenSpiel, T.postfach.legendeSpiel),
      legende(T.postfach.zeichenPost, T.postfach.legendePost),
      legende(T.postfach.zeichenAntwort, T.postfach.legendeAntwort)));
}

/** @param {string} zeichen @param {string} text */
function legende(zeichen, text) {
  return el('span', { class: 'kallegende-teil' },
    el('span', { class: 'kalzeichen', text: zeichen }), text);
}

/**
 * Einen Monat weiter oder zurück — aber nicht aus der Saison heraus.
 * @param {import('../engine/saison.js').SpielStand} stand @param {number} richtung
 */
function blaettere(stand, richtung) {
  const aktuell = /** @type {{ jahr: number, j: number, m: number }} */ (monat);
  const roh = aktuell.m - 1 + richtung;
  const j = aktuell.j + Math.floor(roh / 12);
  const m = ((roh % 12) + 12) % 12 + 1;
  // Ein Monat zählt, sobald irgendein Tag von ihm in der Saison liegt.
  const ende = saisonLaenge(stand.jahr);
  const erster = tagVonDatum(stand.jahr, j, m, 1);
  const letzter = tagVonDatum(stand.jahr, j, m, tageImMonat(j, m));
  if (letzter < 1 || erster > ende) return;
  monat = { jahr: stand.jahr, j, m };
}

/**
 * Eine Zelle des Rasters. Ein Tipp heißt „bis hierhin" — damit ist der
 * häufigste Fall ein Griff und der seltene zwei.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 * @param {number} tag Tagesnummer der Saison, gern auch außerhalb
 * @param {number} imMonat Tag im Monat, für die Beschriftung
 * @param {number} ende Letzter Tag der Saison
 */
function tagesZelle(stand, aktionen, tag, imMonat, ende) {
  const drin = tag >= 1 && tag <= ende;
  const heute = tag === stand.tag;
  const post = drin ? nachrichtenAmTag(stand, tag) : [];
  const spiel = drin && stand.spielplan.some(
    (p) => p.tag === tag && (p.heim === stand.meinTeam || p.gast === stand.meinTeam));
  const antwort = post.some(istOffen);
  const springbar = drin && tag > stand.tag;

  const zeichen = el('div', { class: 'kalzeichen' },
    spiel ? el('span', { text: T.postfach.zeichenSpiel }) : null,
    antwort
      ? el('span', { class: 'antwort', text: T.postfach.zeichenAntwort })
      : (post.length > 0 ? el('span', { text: T.postfach.zeichenPost }) : null));

  const klassen = ['kaltag'];
  if (!drin) klassen.push('aussen');
  if (heute) klassen.push('heute');
  if (springbar) klassen.push('springbar');

  return el('div', {
    class: klassen.join(' '),
    role: springbar ? 'button' : null,
    tabindex: springbar ? '0' : null,
    title: springbar ? T.postfach.zumTag(T.datum.ohneJahr(datum(stand.jahr, tag))) : null,
    onclick: springbar ? () => aktionen.weiter(tag) : null,
    onkeydown: springbar
      ? (/** @type {KeyboardEvent} */ e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        aktionen.weiter(tag);
      }
      : null,
  },
    el('div', { class: 'kalzahl', text: String(imMonat) }),
    zeichen);
}

// --- Die Tageskarte --------------------------------------------------------

/**
 * Was heute ansteht — und der eine Knopf, der die Uhr bewegt.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function tagesKarte(stand, aktionen) {
  const stopp = naechsterStopp(stand);

  if (stopp.grund === 'antwort') {
    const offen = stand.post.filter(istOffen)[0];
    return karte(T.postfach.heuteMit(T.phase[phaseAmTag(stand.tag)]),
      T.postfach.antwortOffen,
      el('button', {
        class: 'haupt',
        onclick: () => offen && aktionen.oeffne(offen.id),
      }, T.postfach.zurNachricht));
  }

  const heute = eigenePartieAmTag(stand, stand.tag);
  if (heute) {
    const zuhause = heute.heim === stand.meinTeam;
    const gegner = teamById(zuhause ? heute.gast : heute.heim);
    return karte(T.postfach.heuteMit(terminName(heute.tag, heute.runde)),
      T.postfach.kommendesSpiel(gegner.name,
        zuhause ? T.postfach.heimZeichen : T.postfach.auswaertsZeichen),
      el('button', { class: 'haupt', onclick: () => aktionen.weiter(null) },
        T.postfach.anpfiff));
  }

  const ende = saisonLaenge(stand.jahr);
  const wohin = stopp.tag > ende
    ? T.postfach.saisonwechsel
    : (stopp.grund === 'spiel'
      ? terminName(stopp.tag, rundeAmTag(stand, stopp.tag))
      : T.phase[phaseAmTag(stopp.tag)]);

  return karte(
    phaseAmTag(stand.tag) === 'sommerpause' ? T.postfach.saisonEnde : T.postfach.spielfrei,
    T.postfach.naechsterTermin(T.datum.ohneJahr(datum(stand.jahr, stopp.tag)), wohin),
    el('button', { class: 'haupt', onclick: () => aktionen.weiter(null) },
      T.postfach.bisDahin));
}

/** @param {string} titel @param {string} zeile @param {HTMLElement} knopf */
function karte(titel, zeile, knopf) {
  return el('div', { class: 'karte tageskarte' },
    el('div', {},
      el('div', { class: 'tageskarte-titel', text: titel }),
      el('div', { class: 'leise klein', text: zeile })),
    knopf);
}

/**
 * Wie ein Termin heißt: in der Gruppenrunde nach seiner Nummer, im Bracket
 * nach seiner Runde.
 * @param {number} tag @param {import('../engine/spielplan.js').Runde | null} runde
 */
function terminName(tag, runde) {
  const nr = spieltagAmTag(tag);
  if (runde && runde !== 'gruppe') return T.runde[runde];
  return nr ? `${T.spielplan.spieltag} ${nr}` : T.spielplan.spieltag;
}

/** @param {import('../engine/saison.js').SpielStand} stand @param {number} tag */
function rundeAmTag(stand, tag) {
  const p = stand.spielplan.find((x) => x.tag === tag);
  return p ? p.runde : null;
}

// --- Die Nachrichten -------------------------------------------------------

/**
 * @param {string} titel
 * @param {import('../engine/postfach.js').Nachricht[]} nachrichten neueste zuerst
 * @param {string} leerText
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function listenKarte(titel, nachrichten, leerText, stand, aktionen) {
  const ungelesen = nachrichten.filter((n) => !n.gelesen).length;
  return el('div', { class: 'karte' },
    el('div', { class: 'kartenkopf' },
      el('h2', { text: titel }),
      ungelesen > 0
        ? el('span', { class: 'marke postmarke', text: T.postfach.ungelesen(ungelesen) })
        : null),
    nachrichten.length === 0
      ? el('p', { class: 'leise klein', text: leerText })
      : el('div', { class: 'postliste' },
        nachrichten.map((n) => nachrichtZeile(n, stand, aktionen))));
}

/**
 * Eine Zeile, aufklappbar. Der Text entsteht erst hier: gespeichert ist nur
 * ein Schlüssel und ein Häufchen Daten.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function nachrichtZeile(n, stand, aktionen) {
  const vorlage = vorlageVon(n.art);
  const daten = angereichert(n.daten);
  const auf = offene.has(n.id);
  const offenerPunkt = istOffen(n);

  const kopf = el('div', {
    class: 'postkopf',
    role: 'button',
    tabindex: '0',
    'aria-expanded': String(auf),
    onclick: () => aktionen.oeffne(n.id),
    onkeydown: (/** @type {KeyboardEvent} */ e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      aktionen.oeffne(n.id);
    },
  },
    el('span', {
      class: 'postzeichen' + (offenerPunkt ? ' antwort' : ''),
      text: offenerPunkt ? T.postfach.zeichenAntwort : T.postfach.zeichenPost,
    }),
    el('span', { class: 'postnamen' },
      el('div', { class: 'postbetreff', text: vorlage ? vorlage.betreff(daten) : n.art }),
      el('div', { class: 'leise klein', text: vorlage ? vorlage.von : '' })),
    el('span', {
      class: 'leise klein postdatum',
      text: T.datum.ohneJahr(datum(n.jahr, n.tag)),
    }));

  if (!auf || !vorlage) {
    return el('div', { class: 'postzeile' + (n.gelesen ? '' : ' neu') }, kopf);
  }

  return el('div', { class: 'postzeile offen' + (n.gelesen ? '' : ' neu') },
    kopf,
    el('div', { class: 'posttext' },
      vorlage.text(daten).map((absatz) => el('p', { text: absatz })),
      knoepfe(n, stand, aktionen)));
}

/**
 * Was unter einer aufgeklappten Nachricht steht: die Antworten, solange sie
 * offen ist, und der Weg zum Box Score, wenn sie ein Spielbericht ist.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function knoepfe(n, stand, aktionen) {
  const reihe = [];

  const vorlage = vorlageVon(n.art);
  if (istOffen(n)) {
    const labels = (vorlage && vorlage.antworten) || {};
    for (const schluessel of antwortenZu(n.art)) {
      reihe.push(el('button', {
        class: reihe.length === 0 ? 'haupt klein' : 'neben klein',
        onclick: () => aktionen.beantworte(n.id, schluessel),
      }, labels[schluessel] || schluessel));
    }
  } else if (n.antwort) {
    const labels = (vorlage && vorlage.antworten) || {};
    reihe.push(el('span', { class: 'marke postmarke', text: labels[n.antwort] || n.antwort }));
  }

  const partie = berichtsPartie(n, stand);
  if (partie) {
    reihe.push(el('button', {
      class: 'neben klein',
      onclick: () => aktionen.zumBericht(partie),
    }, T.postfach.zumBericht));
  }

  return reihe.length > 0 ? el('div', { class: 'postknoepfe' }, reihe) : null;
}

/**
 * Die Partie, auf die ein Spielbericht zeigt.
 *
 * Nur innerhalb der laufenden Saison: der Spielplan wird beim Saisonwechsel
 * ersetzt, und eine Nachricht aus dem Vorjahr zeigte sonst auf eine fremde
 * Begegnung am selben Tag.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 */
function berichtsPartie(n, stand) {
  if (n.art !== 'spielbericht' || n.jahr !== stand.jahr) return null;
  return stand.spielplan.find(
    (p) => p.tag === n.tag && p.ergebnis
      && (p.heim === stand.meinTeam || p.gast === stand.meinTeam)) || null;
}

/**
 * Vereinskennungen zu Namen machen.
 *
 * Die Engine speichert Ids, weil ein Name kein Schlüssel ist; `i18n.js` kennt
 * keine Vereine, weil das Inhalt wäre und keine Sprache. Also übersetzt die
 * Ansicht dazwischen — an genau dieser Stelle.
 * @param {Record<string, any>} daten
 */
function angereichert(daten) {
  const d = { ...daten };
  for (const feld of ['verein', 'gegner', 'meister']) {
    if (typeof d[feld] === 'string') d[feld] = teamById(d[feld]).name;
  }
  if (Array.isArray(d.paarungen)) {
    d.paarungen = d.paarungen.map((/** @type {string[]} */ paar) =>
      paar.map((id) => teamById(id).name));
  }
  return d;
}

/** @param {import('../engine/saison.js').SpielStand} stand */
function historieKarte(stand) {
  if (stand.historie.length === 0) return null;
  return el('div', { class: 'karte' },
    el('h2', { text: T.postfach.vergangeneSaisons }),
    stand.historie.slice().reverse().map((h) =>
      el('p', { class: 'klein', style: { margin: '4px 0' },
        text: T.postfach.saisonZeile(h.jahr, h.meinPlatz, teamById(h.meister).name) })));
}

/** @param {Aktionen} aktionen */
function datenKarte(aktionen) {
  return el('div', { class: 'karte' },
    el('h2', { text: T.postfach.speicherstand }),
    el('p', { class: 'leise klein', text: T.postfach.speicherstandHinweis }),
    el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      el('button', { class: 'neben', onclick: aktionen.exportieren }, T.aktion.exportieren),
      el('button', { class: 'neben', onclick: aktionen.importieren }, T.aktion.importieren),
      el('button', { class: 'neben', onclick: aktionen.neuesSpiel }, T.aktion.neuesSpiel)));
}

/**
 * Eine Nachricht auf- oder zuklappen. Der Merker lebt im Modul, das Lesen im
 * Spielstand — `app.js` schreibt es dort hinein und zeichnet neu.
 * @param {string} id
 * @returns {boolean} ob sie jetzt offen steht
 */
export function klappe(id) {
  if (offene.has(id)) {
    offene.delete(id);
    return false;
  }
  offene.add(id);
  return true;
}

/** Beim Verlassen der Karriere aufräumen, damit die nächste frisch anfängt. */
export function vergissAnsicht() {
  offene.clear();
  monat = null;
  gesehenerTag = null;
}
