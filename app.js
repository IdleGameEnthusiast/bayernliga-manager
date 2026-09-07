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
import { markiereGelesen } from './engine/postfach.js';
import {
  neuesSpiel, weiter, beantworteNachricht, gruppenTabellen, meineTabelle,
  setzeTaktik, setzeAufstellung, entwurfSetze, entwurfVollstaendig,
  eigeneAufstellung, entwurfLeeren, entwurfEntferne,
} from './engine/saison.js';
import { partienDerRunde } from './engine/spielplan.js';
import {
  speichere, lade, gibtEsSpeicherstand, exportiere, importiere, dateiName,
} from './engine/save.js';
import { zeigeStart } from './ui/start.js';
import { zeigePostfach, klappe, vergissAnsicht } from './ui/postfach.js';
import { zeigeTabelle } from './ui/tabelle.js';
import { zeigeKader } from './ui/kader.js';
import { zeigeTaktik } from './ui/taktik.js';
import { zeigeSpielplan } from './ui/spielplan.js';
import { zeigeSpielbericht } from './ui/spielbericht.js';
import { zeigeFrage } from './ui/frage.js';

/** @typedef {'start'|'postfach'|'tabelle'|'kader'|'taktik'|'spielplan'|'bericht'} Ansicht */

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

/**
 * Die Aufstellung, während sie gebaut wird — noch nicht im Spielstand.
 *
 * `null` heißt: nichts Ungespeichertes. `{ vorgabe: null }` ist etwas anderes,
 * nämlich der Entwurf „gar keine Vorgabe, stell automatisch auf". Beides muss
 * sich unterscheiden lassen, sonst wäre das Zurücknehmen einer Aufstellung
 * nicht speicherbar.
 * @type {{ vorgabe: import('./engine/aufstellung.js').Vorgabe | null } | null}
 */
let entwurf = null;

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
    wurzel.append(zeigeKader(stand, entwurf, {
      setze: beiAufstellung,
      automatisch: beiAutomatisch,
      entferne: beiEntfernen,
      leeren: beiLeeren,
      speichern: beiSpeichern,
      verwerfen: beiVerwerfen,
      neuZeichnen: zeichne,
    }));
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
  /** @type {[Ansicht, string][]} */
  const tabs = [
    ['postfach', T.nav.postfach],
    ['tabelle', T.nav.tabelle],
    ['kader', T.nav.kader],
    ['taktik', T.nav.taktik],
    ['spielplan', T.nav.spielplan],
  ];
  return el('div', { class: 'reiter', role: 'tablist' },
    tabs.map(([id, label]) => el('button', {
      role: 'tab',
      'aria-selected': String(ansicht === id),
      onclick: () => mitEntwurf(() => wechsle(id)),
    }, label)));
}

// --- Aktionen --------------------------------------------------------------

/** @type {import('./ui/postfach.js').Aktionen} */
const postfachAktionen = {
  weiter: (zielTag = null) => mitEntwurf(() => beiWeiter(zielTag)),
  beantworte: beiAntwort,
  oeffne: beiNachricht,
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
 * Eine Nachricht auf- oder zuklappen. Aufgeklappt heißt gelesen — gelesene
 * Nachrichten sind das Archiv, und ein zweiter Knopf dafür wäre einer zu viel.
 * @param {string} id
 */
function beiNachricht(id) {
  if (!stand) return;
  if (klappe(id)) {
    markiereGelesen(stand, id);
    speichere(stand);
  }
  if (ansicht !== 'postfach') wechsle('postfach');
  else zeichne();
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
 * Einen Spieler auf einen Platz stellen. Wer dabei wohin rutscht, entscheidet
 * die Engine; hier wächst nur der Entwurf. Geschrieben wird beim Speichern.
 * @param {string} schluessel @param {string} spielerId
 */
function beiAufstellung(schluessel, spielerId) {
  if (!stand) return;
  entwurf = { vorgabe: entwurfSetze(stand, entwurf && entwurf.vorgabe, schluessel, spielerId) };
  zeichne();
}

/**
 * „Automatisch aufstellen": die Vorgabe fällt weg. Steht ohnehin keine im
 * Stand, ist das keine Änderung und wird auch nicht als eine geführt.
 */
function beiAutomatisch() {
  if (!stand) return;
  entwurf = stand.aufstellung === null ? null : { vorgabe: null };
  zeichne();
}

/**
 * Einen Mann aus der Elf nehmen. Sein Platz bleibt frei — bis der Manager ihn
 * besetzt, ist die Aufstellung nicht speicherbar.
 * @param {string} spielerId
 */
function beiEntfernen(spielerId) {
  if (!stand) return;
  entwurf = { vorgabe: entwurfEntferne(stand, entwurf && entwurf.vorgabe, spielerId) };
  zeichne();
}

/**
 * „Aufstellung löschen": ein Entwurf, auf dem niemand steht. Speicherbar ist er
 * nicht — das ist der Anfang einer Elf, nicht eine.
 */
function beiLeeren() {
  if (!stand) return;
  entwurf = { vorgabe: entwurfLeeren(stand) };
  zeichne();
}

/**
 * Den Entwurf in den Stand schreiben. Die Engine lehnt eine unvollständige Elf
 * ab; die Ansicht sperrt ihren Knopf deshalb schon vorher.
 * @returns {boolean} ob geschrieben wurde
 */
function beiSpeichern() {
  if (!stand || !entwurf) return true;
  if (!setzeAufstellung(stand, entwurf.vorgabe)) return false;

  speichere(stand);
  entwurf = null;
  hinweis = T.aufstellung.gespeichert;
  zeichne();
  return true;
}

/** Den Entwurf wegwerfen. Es stand nie etwas davon im Speicherstand. */
function beiVerwerfen() {
  entwurf = null;
  zeichne();
}

/**
 * Der Wächter vor jeder Handlung, die die Kaderansicht verlässt.
 *
 * Ohne ihn verschwände eine halb gebaute Aufstellung beim nächsten Reitertipp,
 * ohne dass es jemand bemerkt hätte. Ist der Entwurf vollständig, ist Speichern
 * die naheliegende Antwort; ist er es nicht, kann er gar nicht gespeichert
 * werden, und dann ist Weiterbauen die einzige, die nichts verliert.
 * @param {() => void} weiterMachen
 */
function mitEntwurf(weiterMachen) {
  if (!entwurf || !stand) { weiterMachen(); return; }

  const vollstaendig = entwurfVollstaendig(stand, entwurf.vorgabe);
  const offen = offenePlaetze(stand, entwurf.vorgabe);
  frage = {
    titel: T.aufstellung.ungesichert,
    text: vollstaendig ? T.aufstellung.ungesichertText : T.aufstellung.unvollstaendigText(offen),
    knoepfe: [
      vollstaendig
        ? {
          label: T.aufstellung.speichern,
          klasse: 'haupt',
          wirkung: () => { frage = null; if (beiSpeichern()) weiterMachen(); },
        }
        : {
          label: T.aufstellung.weiterBearbeiten,
          klasse: 'haupt',
          wirkung: () => { frage = null; zeichne(); },
        },
      {
        label: T.aufstellung.verwerfen,
        wirkung: () => { frage = null; entwurf = null; weiterMachen(); },
      },
    ],
  };
  zeichne();
}

/**
 * Wie viele Plätze der Entwurf frei lässt — nur für den Satz in der Rückfrage.
 * @param {import('./engine/saison.js').SpielStand} s
 * @param {import('./engine/aufstellung.js').Vorgabe | null} vorgabe
 */
function offenePlaetze(s, vorgabe) {
  const a = eigeneAufstellung(s, vorgabe);
  return [...a.offense, ...a.defense].filter((p) => !p.spieler).length;
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
