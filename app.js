// @ts-check
/**
 * Der Einstiegspunkt: hält den Zustand, verdrahtet die Ansichten, und ist der
 * einzige Ort, an dem Engine und UI sich begegnen.
 *
 * Die Regeln liegen ausnahmslos in engine/. Diese Datei entscheidet keine.
 */

import { el, leere, kontrastFarbe } from './ui/dom.js';
import { T } from './i18n.js';
import { teamById } from './engine/content.js';
import { datum } from './engine/kalender.js';
import { markiereGelesen, loescheNachricht, stelleWiederHer } from './engine/postfach.js';
import {
  neuesSpiel, weiter, beantworteNachricht, gruppenTabellen, meineTabelle,
  setzeTaktik, automatischAufstellen,
  aufstellungSetze, aufstellungRaeume, aufstellungLoese, aufstellungLeeren,
} from './engine/saison.js';
import { partienDerRunde } from './engine/spielplan.js';
import {
  speichere, lade, gibtEsSpeicherstand, exportiere, importiere, dateiName,
} from './engine/save.js';
import { zeigeStart } from './ui/start.js';
import { zeigePostfach, waehleNachricht, vergissAnsicht } from './ui/postfach.js';
import { zeigeTabelle } from './ui/tabelle.js';
import { zeigeKader } from './ui/kader.js';
import { zeigePersonal } from './ui/personal.js';
import { zeigeTaktik } from './ui/taktik.js';
import { zeigeSpielplan } from './ui/spielplan.js';
import { zeigeSpielbericht } from './ui/spielbericht.js';
import { zeigeFrage } from './ui/frage.js';

/** @typedef {'start'|'postfach'|'kader'|'personal'|'taktik'|'tabelle'|'spielplan'|'bericht'} Ansicht */

/** @type {import('./engine/saison.js').SpielStand | null} */
let stand = null;

/** @type {Ansicht} */
let ansicht = 'start';

/** @type {import('./engine/spielplan.js').Partie | null} */
let offenePartie = null;

/**
 * Wohin der Spielbericht zurückführt. Er wird aus zwei Richtungen geöffnet —
 * aus dem Postfach und aus dem Spielplan —, und „Zurück" heißt in beiden
 * Fällen dorthin, wo man herkam.
 * @type {Ansicht}
 */
let berichtZurueck = 'postfach';

/** @type {string | null} */
let hinweis = null;

/** @type {import('./ui/frage.js').Frage | null} */
let frage = null;

const wurzel = /** @type {HTMLElement} */ (document.getElementById('app'));

// --- Rendering -------------------------------------------------------------

function zeichne() {
  leere(wurzel);

  if (!stand || ansicht === 'start') {
    wurzel.append(zeigeStart(starteKarriere, gibtEsSpeicherstand(), setzeFort));
    return;
  }

  wurzel.append(kopfzeile());

  if (hinweis) {
    wurzel.append(el('div', { class: 'hinweis' }, hinweis));
  }

  if (ansicht === 'bericht' && offenePartie) {
    wurzel.append(zeigeSpielbericht(offenePartie, () => {
      offenePartie = null;
      wechsle(berichtZurueck);
    }));
    return;
  }

  wurzel.append(reiter());

  if (ansicht === 'postfach') {
    wurzel.append(zeigePostfach(stand, postfachAktionen));
  } else if (ansicht === 'tabelle') {
    wurzel.append(zeigeTabelle(gruppenTabellen(stand), stand.meinTeam, playoffPartien(stand)));
  } else if (ansicht === 'kader') {
    wurzel.append(zeigeKader(stand, {
      setze: beiAufstellung,
      automatisch: beiAutomatisch,
      raeume: beiRaeumen,
      loese: beiLoesen,
      leeren: beiLeeren,
      neuZeichnen: zeichne,
    }));
  } else if (ansicht === 'personal') {
    wurzel.append(zeigePersonal(stand, zeichne));
  } else if (ansicht === 'taktik') {
    wurzel.append(zeigeTaktik(stand, beiTaktik));
  } else if (ansicht === 'spielplan') {
    wurzel.append(zeigeSpielplan(stand.spielplan, stand.meinTeam, stand.tag, (p) => {
      offenePartie = p;
      berichtZurueck = 'spielplan';
      wechsle('bericht');
    }));
  }

  if (frage) wurzel.append(zeigeFrage(frage));
}

/** Halbfinale und Finale, in Reihenfolge — leer, solange die Gruppe läuft.
 * @param {import('./engine/saison.js').SpielStand} s */
function playoffPartien(s) {
  return [
    ...partienDerRunde(s.spielplan, 'halbfinale'),
    ...partienDerRunde(s.spielplan, 'finale'),
  ];
}

/**
 * Die Kopfzeile trägt seit dem Kalender ein **Datum** statt einer
 * Spieltagszahl: sie sagt, wann man ist, und rechts, wo man steht.
 */
function kopfzeile() {
  if (!stand) return el('div');
  const t = teamById(stand.meinTeam);
  const platz = meineTabelle(stand).findIndex((z) => z.teamId === stand.meinTeam) + 1;

  return el('div', { class: 'kopf' },
    el('div', {
      class: 'kopf-wappen',
      style: { background: t.farben.primaer, color: kontrastFarbe(t.farben.primaer) },
    }, t.kurz),
    el('div', {},
      el('div', { class: 'kopf-titel', text: t.name }),
      el('div', { class: 'kopf-unter', text: `Saison ${stand.jahr}` })),
    el('div', { class: 'kopf-datum klein' }, T.datum.kurz(datum(stand.jahr, stand.tag))),
    el('div', { class: 'kopf-rechts' },
      el('div', { class: 'kopf-titel', text: `${platz}.` }),
      el('div', { class: 'kopf-unter', text: T.gruppenKurz[t.gruppe] })));
}

function reiter() {
  // Die Reihenfolge folgt dem Tag eines Managers: erst lesen, was los ist,
  // dann aufstellen, dann nachsehen, wen man hat, dann einstellen, wie
  // gespielt wird — und zuletzt, wo das hinführt.
  /** @type {[Ansicht, string][]} */
  const tabs = [
    ['postfach', T.nav.postfach],
    ['kader', T.nav.kader],
    ['personal', T.nav.personal],
    ['taktik', T.nav.taktik],
    ['tabelle', T.nav.tabelle],
    ['spielplan', T.nav.spielplan],
  ];
  return el('div', { class: 'reiter', role: 'tablist' },
    tabs.map(([id, label]) => el('button', {
      role: 'tab',
      'aria-selected': String(ansicht === id),
      onclick: () => wechsle(id),
    }, label)));
}

// --- Aktionen --------------------------------------------------------------

/** @type {import('./ui/postfach.js').Aktionen} */
const postfachAktionen = {
  weiter: beiWeiter,
  beantworte: beiAntwort,
  oeffne: beiNachricht,
  loesche: beiLoeschen,
  stelleWiederHer: beiWiederherstellen,
  zumBericht: (p) => {
    offenePartie = p;
    berichtZurueck = 'postfach';
    wechsle('bericht');
  },
  exportieren: beiExport,
  importieren: beiImport,
  neuesSpiel: beiNeu,
  neuZeichnen: zeichne,
};

/** @param {Ansicht} neu */
function wechsle(neu) {
  ansicht = neu;
  hinweis = null;
  zeichne();
  window.scrollTo(0, 0);
}

/** @param {string} teamId */
function starteKarriere(teamId) {
  if (gibtEsSpeicherstand() && !confirm(T.start.neuWarnung)) return;
  stand = neuesSpiel(teamId);
  vergissAnsicht();
  // Ab hier liegt die Karriere im Speicher. Die Ansprache des Vorstands ist
  // kein eigener Bildschirm mehr, sondern die erste Nachricht im Postfach.
  speichere(stand);
  wechsle('postfach');
}

function setzeFort() {
  const geladen = lade();
  if (!geladen) {
    alert(T.meldung.keinSpeicherstand);
    return;
  }
  stand = geladen;
  vergissAnsicht();
  wechsle('postfach');
}

/**
 * Weiterspielen. Wo der Kalender anhält und warum, entscheidet die Engine —
 * hier wird nur gespeichert und die richtige Ansicht aufgeschlagen.
 * @param {number | null} zielTag
 */
function beiWeiter(zielTag) {
  if (!stand) return;
  const meinTeam = stand.meinTeam;
  const fortschritt = weiter(stand, zielTag);
  speichere(stand);

  const meins = fortschritt.partien
    .filter((p) => p.heim === meinTeam || p.gast === meinTeam)
    .pop();
  if (meins) {
    offenePartie = meins;
    berichtZurueck = 'postfach';
    wechsle('bericht');
    return;
  }
  wechsle('postfach');
}

/**
 * Eine Nachricht aufschlagen. Aufgeschlagen heißt gelesen — aber gelesen heißt
 * nur gelesen: liegen bleibt sie, bis der Manager sie löscht.
 * @param {string} id
 */
function beiNachricht(id) {
  if (!stand) return;
  waehleNachricht(markiereGelesen(stand, id));
  speichere(stand);
  if (ansicht !== 'postfach') wechsle('postfach');
  else zeichne();
}

/**
 * Eine Nachricht in den Ordner „Gelöscht" legen. Die Auswahl fällt dabei weg:
 * die Nachricht liegt danach woanders, und die Lesespalte zeigt nur, was im
 * offenen Ordner steht.
 *
 * Eine offene Antwortpflicht lehnt die Engine ab — dann bleibt alles stehen,
 * und der Knopf dafür wird in der Ansicht gar nicht erst angeboten.
 * @param {string} id
 */
function beiLoeschen(id) {
  if (!stand) return;
  if (loescheNachricht(stand, id)) {
    waehleNachricht(null);
    speichere(stand);
  }
  zeichne();
}

/**
 * Zurück in den Posteingang — und dorthin mit, damit sichtbar wird, wo sie
 * gelandet ist.
 * @param {string} id
 */
function beiWiederherstellen(id) {
  if (!stand) return;
  const n = stelleWiederHer(stand, id);
  if (n) {
    waehleNachricht(n);
    speichere(stand);
  }
  zeichne();
}

/**
 * Antworten. Was eine Antwort bewirkt, weiß die Engine.
 * @param {string} id @param {string} antwort
 */
function beiAntwort(id, antwort) {
  if (!stand) return;
  beantworteNachricht(stand, id, antwort);
  speichere(stand);
  zeichne();
}

/**
 * Die Taktik umstellen. Sie gilt ab dem nächsten Spieltag — was die Regel
 * dazu sagt, sagt die Engine; hier wird nur gespeichert und neu gezeichnet.
 * @param {{ personnel?: string, passAnteil?: number }} taktik
 */
function beiTaktik(taktik) {
  if (!stand) return;
  setzeTaktik(stand, taktik);
  speichere(stand);
  zeichne();
}

/**
 * Einen Spieler auf einen Platz stellen — und sofort speichern.
 *
 * Es gibt keinen Entwurf mehr. Jeder Handgriff steht danach im Speicherstand,
 * jeder ist einzeln zurückzunehmen, und keiner geht beim nächsten Reitertipp
 * verloren. Wer dabei wohin rutscht, entscheidet die Engine.
 * @param {string} schluessel @param {string} spielerId
 */
function beiAufstellung(schluessel, spielerId) {
  schreibe((s) => aufstellungSetze(s, schluessel, spielerId));
}

/** „Automatisch aufstellen": die Vorgabe fällt weg, die Automatik füllt wieder alles. */
function beiAutomatisch() {
  schreibe(automatischAufstellen);
}

/**
 * Einen Platz räumen. Er bleibt leer — auch über den Anpfiff hinaus, und dann
 * wird das Spiel gewertet statt gespielt.
 * @param {string} schluessel
 */
function beiRaeumen(schluessel) {
  schreibe((s) => aufstellungRaeume(s, schluessel));
}

/**
 * Einen Special-Teams-Platz wieder der Automatik überlassen.
 *
 * Nicht dasselbe wie Räumen: dort bleibt der Platz leer, hier fällt die
 * Entscheidung ganz weg und der beste Fuß im Kader rückt nach.
 * @param {string} schluessel
 */
function beiLoesen(schluessel) {
  schreibe((s) => aufstellungLoese(s, schluessel));
}

/** „Aufstellung löschen": niemand steht mehr. Der Anfang einer Elf, nicht eine. */
function beiLeeren() {
  schreibe(aufstellungLeeren);
}

/**
 * Eine Änderung an der Aufstellung: tun, speichern, zeichnen.
 *
 * Die drei Schritte stehen an einer Stelle, weil das Vergessen des mittleren
 * genau der Fehler wäre, den niemand bemerkt — bis der Browser neu lädt.
 * @param {(stand: import('./engine/saison.js').SpielStand) => void} wirkung
 */
function schreibe(wirkung) {
  if (!stand) return;
  wirkung(stand);
  speichere(stand);
  zeichne();
}

function beiExport() {
  if (!stand) return;
  const blob = new Blob([exportiere(stand)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: dateiName(stand) });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function beiImport() {
  const eingabe = el('input', { type: 'file', accept: '.json,application/json' });
  eingabe.addEventListener('change', () => {
    const datei = /** @type {HTMLInputElement} */ (eingabe).files?.[0];
    if (!datei) return;
    datei.text().then((text) => {
      try {
        stand = importiere(text);
        speichere(stand);
        vergissAnsicht();
        wechsle('postfach');
        hinweis = T.meldung.importErfolg;
        zeichne();
      } catch {
        alert(T.meldung.importFehler);
      }
    });
  });
  eingabe.click();
}

function beiNeu() {
  stand = null;
  vergissAnsicht();
  wechsle('start');
}

// --- Start -----------------------------------------------------------------

const gespeichert = lade();
if (gespeichert) {
  stand = gespeichert;
  ansicht = 'postfach';
}
zeichne();

// Service Worker nur über http(s) — über file:// gibt es keinen.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline ist optional */ });
}
