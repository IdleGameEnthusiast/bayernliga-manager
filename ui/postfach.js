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
 * Zwei Entscheidungen prägen den Rest der Datei:
 *
 * - **Der Kalender zeigt Termine, nicht Post.** Er trug einmal Briefmarken an
 *   den Tagen, an denen Nachrichten lagen. Das verdoppelte den Posteingang an
 *   einer Stelle, an der niemand nach Post sucht — hier steht, was ansteht.
 * - **Der Posteingang ist im Schnitt eines Mailprogramms gebaut:** links die
 *   Ordner, daneben die Liste, rechts die Nachricht. Vorher klappten die
 *   Nachrichten in der Liste auf; bei zwanzig gelesenen Zeilen sucht man die
 *   aufgeklappte dann zwischen den anderen.
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
import { brauchtAntwort, antwortenZu } from '../engine/postfach.js';
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

/**
 * Der angetippte Tag im Raster — noch ist nichts passiert.
 *
 * Ein Tipp simulierte einmal sofort bis zu diesem Tag. Das ist der teuerste
 * Fehlgriff, den diese App kennt: Wochen an Spielzeit, nicht zurückzunehmen,
 * ausgelöst von einem Daumen am Rand des Rasters. Jetzt wählt der Tipp nur aus,
 * und ein Knopf unter dem Raster tut es.
 * @type {number | null}
 */
let gewaehlterTag = null;

/** Welcher Ordner offen ist. @type {'posteingang' | 'geloescht'} */
let ordner = 'posteingang';

/** Welche Nachricht rechts aufgeschlagen ist. @type {string | null} */
let gewaehlteId = null;

/**
 * @typedef {object} Aktionen
 * @property {(zielTag?: number | null) => void} weiter
 * @property {(id: string, antwort: string) => void} beantworte
 * @property {(id: string) => void} oeffne     Auswählen und als gelesen führen
 * @property {(id: string) => void} loesche
 * @property {(id: string) => void} stelleWiederHer
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
    // Die Uhr ist weitergelaufen: ein Ziel von vorhin liegt jetzt womöglich in
    // der Vergangenheit und wäre ein Knopf, der nichts mehr täte.
    gewaehlterTag = null;
  }

  return el('div', {},
    kalenderKarte(stand, aktionen),
    tagesKarte(stand, aktionen),
    postKarte(stand, aktionen),
    historieKarte(stand),
    datenKarte(aktionen));
}

/** Eine Nachricht, die noch auf eine Antwort wartet. @param {import('../engine/postfach.js').Nachricht} n */
function istOffen(n) {
  return brauchtAntwort(n.art) && n.antwort === null;
}

/**
 * Die Textvorlage zu einer Art — `von`, `betreff(daten)`, `text(daten)` und bei
 * der einen mit Antwortpflicht die Beschriftungen ihrer Antworten.
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
    auswahlLeiste(stand, aktionen),
    el('div', { class: 'kallegende klein leise' },
      legende(T.postfach.zeichenSpiel, T.postfach.legendeSpiel)));
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
 * Eine Zelle des Rasters. Ein Tipp wählt aus, ein zweiter auf denselben Tag
 * nimmt die Wahl zurück — losgespielt wird unter dem Raster.
 *
 * Im Raster steht nur, was an einem Tag **ansteht**: das eigene Spiel. Die
 * Briefmarke für Post an diesem Tag ist weg — sie zeigte ein zweites Mal, was
 * eine Handbreit tiefer ohnehin steht, und lud dazu ein, den Kalender nach
 * Nachrichten abzusuchen statt den Posteingang.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 * @param {number} tag Tagesnummer der Saison, gern auch außerhalb
 * @param {number} imMonat Tag im Monat, für die Beschriftung
 * @param {number} ende Letzter Tag der Saison
 */
function tagesZelle(stand, aktionen, tag, imMonat, ende) {
  const drin = tag >= 1 && tag <= ende;
  const heute = tag === stand.tag;
  const spiel = drin && stand.spielplan.some(
    (p) => p.tag === tag && (p.heim === stand.meinTeam || p.gast === stand.meinTeam));
  const waehlbar = drin && tag > stand.tag;

  const klassen = ['kaltag'];
  if (!drin) klassen.push('aussen');
  if (heute) klassen.push('heute');
  if (waehlbar) klassen.push('waehlbar');
  if (tag === gewaehlterTag) klassen.push('gewaehlt');

  const waehle = () => {
    gewaehlterTag = tag === gewaehlterTag ? null : tag;
    aktionen.neuZeichnen();
  };

  return el('div', {
    class: klassen.join(' '),
    role: waehlbar ? 'button' : null,
    tabindex: waehlbar ? '0' : null,
    'aria-pressed': waehlbar ? String(tag === gewaehlterTag) : null,
    title: waehlbar ? T.postfach.tagWaehlen(T.datum.ohneJahr(datum(stand.jahr, tag))) : null,
    onclick: waehlbar ? waehle : null,
    onkeydown: waehlbar
      ? (/** @type {KeyboardEvent} */ e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        waehle();
      }
      : null,
  },
    el('div', { class: 'kalzahl', text: String(imMonat) }),
    el('div', { class: 'kalzeichen' },
      spiel ? el('span', { text: T.postfach.zeichenSpiel }) : null));
}

/**
 * Was unter dem Raster steht, sobald ein Tag gewählt ist: das Datum und der
 * Knopf, der die Uhr wirklich bewegt.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function auswahlLeiste(stand, aktionen) {
  if (gewaehlterTag === null) return null;
  const ziel = gewaehlterTag;
  return el('div', { class: 'kalauswahl' },
    el('div', {
      class: 'kalauswahl-datum klein',
      text: T.postfach.tagGewaehlt(T.datum.ohneJahr(datum(stand.jahr, ziel))),
    }),
    el('button', { class: 'haupt klein', onclick: () => aktionen.weiter(ziel) },
      T.postfach.bisDatumSimulieren),
    el('button', {
      class: 'neben klein',
      onclick: () => { gewaehlterTag = null; aktionen.neuZeichnen(); },
    }, T.postfach.auswahlAufheben));
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

// --- Der Posteingang -------------------------------------------------------

/**
 * Ordner, Liste, Nachricht — drei Spalten auf dem Schreibtisch, gestapelt auf
 * dem Telefon.
 *
 * Nichts wandert von selbst zwischen den Ordnern: Gelesenes bleibt im Eingang
 * stehen, und was daraus verschwindet, hat der Manager gelöscht. Das Archiv,
 * das sich beim Lesen von selbst füllte, gab es einmal — es nahm dem Eingang
 * jede Nachricht, die man ein zweites Mal ansehen wollte.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function postKarte(stand, aktionen) {
  const alle = stand.post.slice().reverse();
  const eingang = alle.filter((n) => !n.geloescht);
  const papierkorb = alle.filter((n) => n.geloescht);
  const liste = ordner === 'geloescht' ? papierkorb : eingang;

  // Nur, was im offenen Ordner liegt: eine gerade gelöschte Nachricht stünde
  // sonst rechts weiter da, während die Liste sie links schon nicht mehr führt.
  const gewaehlt = liste.find((n) => n.id === gewaehlteId) || null;

  return el('div', { class: 'karte postfach' },
    el('div', { class: 'postordner', role: 'tablist', 'aria-label': T.postfach.ordner },
      ordnerKnopf('posteingang', T.postfach.posteingang,
        eingang.filter((n) => !n.gelesen).length, aktionen),
      ordnerKnopf('geloescht', T.postfach.geloescht, 0, aktionen)),
    el('div', { class: 'postspalte' },
      liste.length === 0
        ? el('p', {
          class: 'leise klein postleer',
          text: ordner === 'geloescht' ? T.postfach.keinGeloeschtes : T.postfach.keinePost,
        })
        : el('div', { class: 'postliste' },
          liste.map((n) => nachrichtZeile(n, aktionen)))),
    el('div', { class: 'postlese' },
      gewaehlt
        ? nachrichtBlatt(gewaehlt, stand, aktionen)
        : el('p', { class: 'leise klein', text: T.postfach.keineAuswahl })));
}

/**
 * @param {'posteingang'|'geloescht'} id
 * @param {string} label
 * @param {number} ungelesen 0 lässt die Marke weg
 * @param {Aktionen} aktionen
 */
function ordnerKnopf(id, label, ungelesen, aktionen) {
  return el('button', {
    class: 'postordner-knopf' + (ordner === id ? ' aktiv' : ''),
    type: 'button',
    role: 'tab',
    'aria-selected': String(ordner === id),
    onclick: () => { ordner = id; aktionen.neuZeichnen(); },
  },
    el('span', { class: 'postordner-name', text: label }),
    ungelesen > 0
      ? el('span', {
        class: 'marke postmarke',
        text: String(ungelesen),
        title: T.postfach.ungelesen(ungelesen),
      })
      : null);
}

/**
 * Eine Zeile der Liste. Der Text entsteht erst hier: gespeichert ist nur ein
 * Schlüssel und ein Häufchen Daten.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {Aktionen} aktionen
 */
function nachrichtZeile(n, aktionen) {
  const vorlage = vorlageVon(n.art);
  const daten = angereichert(n.daten);
  const offenerPunkt = istOffen(n);

  const klassen = ['postzeile'];
  if (!n.gelesen) klassen.push('neu');
  if (n.id === gewaehlteId) klassen.push('gewaehlt');

  return el('div', {
    class: klassen.join(' '),
    role: 'button',
    tabindex: '0',
    'aria-current': n.id === gewaehlteId ? 'true' : null,
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
      el('div', { class: 'leise klein postvon', text: vorlage ? vorlage.von : '' })),
    el('span', {
      class: 'leise klein postdatum',
      text: T.datum.ohneJahr(datum(n.jahr, n.tag)),
    }));
}

/**
 * Die aufgeschlagene Nachricht: Betreff, Absender, Text — und unten die Knöpfe.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function nachrichtBlatt(n, stand, aktionen) {
  const vorlage = vorlageVon(n.art);
  const daten = angereichert(n.daten);

  return el('div', { class: 'postblatt' },
    el('div', { class: 'postblatt-kopf' },
      el('h3', { text: vorlage ? vorlage.betreff(daten) : n.art }),
      el('div', {
        class: 'leise klein',
        text: T.postfach.absender(vorlage ? vorlage.von : n.art,
          T.datum.ohneJahr(datum(n.jahr, n.tag))),
      })),
    el('div', { class: 'posttext' },
      vorlage ? vorlage.text(daten).map((absatz) => el('p', { text: absatz })) : null),
    knoepfe(n, stand, aktionen));
}

/**
 * Was unter der Nachricht steht: die Antworten, solange sie offen ist, der Weg
 * zum Box Score, wenn sie ein Spielbericht ist — und zuletzt das Löschen.
 *
 * Bei einer offenen Antwortpflicht fehlt der Löschknopf: die Nachricht ist dann
 * die Bremse des Kalenders, und wer sie wegräumen könnte, käme an die
 * Entscheidung nicht mehr heran, ohne die die Uhr stehen bleibt.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function knoepfe(n, stand, aktionen) {
  const reihe = [];
  const vorlage = vorlageVon(n.art);
  const labels = (vorlage && vorlage.antworten) || {};

  if (istOffen(n)) {
    for (const schluessel of antwortenZu(n.art)) {
      reihe.push(el('button', {
        class: reihe.length === 0 ? 'haupt klein' : 'neben klein',
        onclick: () => aktionen.beantworte(n.id, schluessel),
      }, labels[schluessel] || schluessel));
    }
  } else if (n.antwort) {
    reihe.push(el('span', { class: 'marke postmarke', text: labels[n.antwort] || n.antwort }));
  }

  const partie = berichtsPartie(n, stand);
  if (partie) {
    reihe.push(el('button', {
      class: 'neben klein',
      onclick: () => aktionen.zumBericht(partie),
    }, T.postfach.zumBericht));
  }

  if (n.geloescht) {
    reihe.push(el('button', {
      class: 'neben klein postloeschen',
      onclick: () => aktionen.stelleWiederHer(n.id),
    }, T.postfach.wiederherstellen));
  } else if (!istOffen(n)) {
    reihe.push(el('button', {
      class: 'neben klein postloeschen',
      onclick: () => aktionen.loesche(n.id),
    }, T.postfach.loeschen));
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
 * Welche Nachricht aufgeschlagen ist — und damit auch, welcher Ordner offen
 * ist.
 *
 * Beides zusammen, weil es eine Handlung ist: „zeig mir diese Nachricht". Sie
 * kann in einem Ordner liegen, den der Manager gerade nicht ansieht — dann
 * wechselt die Ansicht mit, statt auf eine Liste zu zeigen, in der sie fehlt.
 * @param {import('../engine/postfach.js').Nachricht | null} n
 */
export function waehleNachricht(n) {
  gewaehlteId = n ? n.id : null;
  if (n) ordner = n.geloescht ? 'geloescht' : 'posteingang';
}

/** Beim Verlassen der Karriere aufräumen, damit die nächste frisch anfängt. */
export function vergissAnsicht() {
  monat = null;
  gesehenerTag = null;
  gewaehlterTag = null;
  ordner = 'posteingang';
  gewaehlteId = null;
}
