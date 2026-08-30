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
import {
  neuesSpiel, spieleSpieltag, naechsteSaison, saisonVorbei, anzahlSpieltage,
  gruppenTabellen, meineTabelle, setzeTaktik, setzeAufstellung, entwurfSetze,
  entwurfVollstaendig, eigeneAufstellung, entwurfLeeren, entwurfEntferne,
} from './engine/saison.js';
import { partienDerRunde } from './engine/spielplan.js';
import {
  speichere, lade, gibtEsSpeicherstand, exportiere, importiere, dateiName,
} from './engine/save.js';
import { zeigeStart } from './ui/start.js';
import { zeigeIntro } from './ui/intro.js';
import { zeigeTabelle } from './ui/tabelle.js';
import { zeigeKader } from './ui/kader.js';
import { zeigeTaktik } from './ui/taktik.js';
import { zeigeSpielplan } from './ui/spielplan.js';
import { zeigeSpielbericht } from './ui/spielbericht.js';
import { zeigeFrage } from './ui/frage.js';

/** @type {import('./engine/saison.js').SpielStand | null} */
let stand = null;

/** @type {'start'|'intro'|'tabelle'|'kader'|'taktik'|'spielplan'|'verlauf'|'bericht'} */
let ansicht = 'start';

/** @type {import('./engine/spielplan.js').Partie | null} */
let offenePartie = null;

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

  if (ansicht === 'intro') {
    wurzel.append(zeigeIntro(teamById(stand.meinTeam), uebernimm, beiNeu));
    return;
  }

  wurzel.append(kopfzeile());

  if (hinweis) {
    wurzel.append(el('div', { class: 'hinweis' }, hinweis));
  }

  if (ansicht === 'bericht' && offenePartie) {
    wurzel.append(zeigeSpielbericht(offenePartie, () => {
      offenePartie = null;
      wechsle('spielplan');
    }));
    return;
  }

  wurzel.append(reiter());

  if (ansicht === 'tabelle') {
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
    wurzel.append(zeigeSpielplan(stand.spielplan, stand.meinTeam, stand.spieltag, (p) => {
      offenePartie = p;
      wechsle('bericht');
    }));
  } else if (ansicht === 'verlauf') {
    wurzel.append(verlaufAnsicht());
  }

  wurzel.append(fussleiste());
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

function kopfzeile() {
  if (!stand) return el('div');
  const t = teamById(stand.meinTeam);
  const gesamt = anzahlSpieltage(stand.spielplan);
  const fertig = saisonVorbei(stand);
  const platz = meineTabelle(stand).findIndex((z) => z.teamId === stand.meinTeam) + 1;

  return el('div', { class: 'kopf' },
    el('div', {
      class: 'kopf-wappen',
      style: { background: t.farben.primaer, color: kontrastFarbe(t.farben.primaer) },
    }, t.kurz),
    el('div', {},
      el('div', { class: 'kopf-titel', text: t.name }),
      el('div', { class: 'kopf-unter', text: `Saison ${stand.jahr}` })),
    el('div', { class: 'kopf-rechts' },
      el('div', { class: 'kopf-titel', text: `${platz}.` }),
      el('div', {
        class: 'kopf-unter',
        text: fertig ? T.meldung.saisonVorbei : naechsterTermin(stand, gesamt),
      })));
}

/**
 * Was oben rechts steht: die Spieltagszahl in der Gruppenrunde, sonst der Name
 * der Runde, die als Nächstes ansteht.
 * @param {import('./engine/saison.js').SpielStand} s @param {number} gesamt
 */
function naechsterTermin(s, gesamt) {
  const naechste = s.spielplan.find((p) => p.spieltag === s.spieltag);
  return naechste && naechste.runde !== 'gruppe'
    ? T.runde[naechste.runde]
    : `${T.spielplan.spieltag} ${s.spieltag}/${gesamt}`;
}

function reiter() {
  /** @type {[string, string][]} */
  const tabs = [
    ['tabelle', T.nav.tabelle],
    ['kader', T.nav.kader],
    ['taktik', T.nav.taktik],
    ['spielplan', T.nav.spielplan],
    ['verlauf', T.nav.verlauf],
  ];
  return el('div', { class: 'reiter', role: 'tablist' },
    tabs.map(([id, label]) => el('button', {
      role: 'tab',
      'aria-selected': String(ansicht === id),
      onclick: () => mitEntwurf(() => wechsle(/** @type {any} */ (id))),
    }, label)));
}

function fussleiste() {
  if (!stand) return el('div');
  const fertig = saisonVorbei(stand);

  return el('div', { class: 'fuss' },
    fertig
      ? el('button', { class: 'haupt', onclick: () => mitEntwurf(beiNaechsterSaison) },
        T.aktion.naechsteSaison)
      : el('button', { class: 'haupt', onclick: () => mitEntwurf(beiSpieltag) },
        T.aktion.spieltagSimulieren));
}

function verlaufAnsicht() {
  if (!stand) return el('div');

  const historie = stand.historie.length > 0
    ? el('div', { class: 'karte' },
      el('h2', { text: 'Vergangene Saisons' }),
      stand.historie.slice().reverse().map((h) => el('p', { class: 'klein', style: { margin: '4px 0' } },
        `${h.jahr}: Platz ${h.meinPlatz} · Meister ${teamById(h.meister).name}`)))
    : null;

  const log = el('div', { class: 'karte' },
    el('h2', { text: T.nav.verlauf }),
    stand.verlauf.length === 0
      ? el('p', { class: 'leise klein', text: 'Noch nichts passiert.' })
      : stand.verlauf.slice().reverse().map((z) =>
        el('p', { class: 'klein', style: { margin: '4px 0' }, text: z })));

  const daten = el('div', { class: 'karte' },
    el('h2', { text: 'Speicherstand' }),
    el('p', { class: 'leise klein' },
      'Der Speicherstand liegt im Browser. Exportiere ihn, um ihn zu sichern '
      + 'oder zwischen PC und iPad zu übertragen.'),
    el('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap' } },
      el('button', { class: 'neben', onclick: beiExport }, T.aktion.exportieren),
      el('button', { class: 'neben', onclick: beiImport }, T.aktion.importieren),
      el('button', { class: 'neben', onclick: beiNeu }, T.aktion.neuesSpiel)));

  return el('div', {}, historie, log, daten);
}

// --- Aktionen --------------------------------------------------------------

/** @param {'start'|'intro'|'tabelle'|'kader'|'taktik'|'spielplan'|'verlauf'|'bericht'} neu */
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
  wechsle('intro');
}

/** Die Zusage aus der Ansprache: ab hier liegt die Karriere im Speicher. */
function uebernimm() {
  if (!stand) return;
  speichere(stand);
  wechsle('tabelle');
}

function setzeFort() {
  const geladen = lade();
  if (!geladen) {
    alert(T.meldung.keinSpeicherstand);
    return;
  }
  stand = geladen;
  wechsle('tabelle');
}

function beiSpieltag() {
  if (!stand) return;
  const bericht = spieleSpieltag(stand);
  speichere(stand);

  if (bericht) {
    const meins = bericht.partien.find(
      (p) => p.heim === stand?.meinTeam || p.gast === stand?.meinTeam);
    if (meins) {
      offenePartie = meins;
      wechsle('bericht');
      return;
    }
  }
  wechsle('tabelle');
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
 * @param {() => void} weiter
 */
function mitEntwurf(weiter) {
  if (!entwurf || !stand) { weiter(); return; }

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
          wirkung: () => { frage = null; if (beiSpeichern()) weiter(); },
        }
        : {
          label: T.aufstellung.weiterBearbeiten,
          klasse: 'haupt',
          wirkung: () => { frage = null; zeichne(); },
        },
      {
        label: T.aufstellung.verwerfen,
        wirkung: () => { frage = null; entwurf = null; weiter(); },
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

function beiNaechsterSaison() {
  if (!stand) return;
  const { meister, ruecktritte } = naechsteSaison(stand);
  speichere(stand);

  const teile = [T.meldung.meister(teamById(meister).name)];
  if (ruecktritte.length > 0) {
    teile.push(`${T.meldung.ruecktritte}: ${ruecktritte.map((s) => s.vorname + ' ' + s.nachname).join(', ')}`);
  }
  wechsle('tabelle');
  hinweis = teile.join('  ·  ');
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
        wechsle('tabelle');
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
  wechsle('start');
}

// --- Start -----------------------------------------------------------------

const gespeichert = lade();
if (gespeichert) {
  stand = gespeichert;
  ansicht = 'tabelle';
}
zeichne();

// Service Worker nur über http(s) — über file:// gibt es keinen.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline ist optional */ });
}
