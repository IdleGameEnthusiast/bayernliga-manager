// @ts-check
/**
 * Die Aufstellung: wer auf welchem Platz steht — und der Weg, das zu ändern.
 *
 * Sie steht im Roster und nicht in der Taktik: dort wird entschieden, was die
 * Mannschaft vorhat, hier steht, wer es tut.
 *
 * Der Weg ist für den Finger gebaut, nicht für die Maus. Es wird nichts
 * gezogen, und er geht in beide Richtungen — beide Male zwei Tipps:
 *
 * - **Platz zuerst.** Ein Tipp auf einen Platz rechts, links sortiert sich die
 *   Liste der Verfügbaren nach dem, was sie **dort** brächten. Ein Tipp auf
 *   einen Namen setzt ihn ein.
 * - **Mann zuerst.** Ein Tipp auf einen Namen links, und **jeder** Platz
 *   rechts trägt die Zahl, die dieser Mann dort brächte, neben der des Manns,
 *   der dort steht. Ein Tipp auf den Platz setzt ihn ein.
 *
 * Die zweite Richtung ist die wichtigere: sie beantwortet „wohin mit ihm", und
 * dafür muss kein Platz frei oder vorgemerkt sein.
 *
 * Der zweite Tipp setzt sofort ein. Früher stand dazwischen ein Knopf
 * „Einsetzen"; er ist entfallen, seit die Liste der Verfügbaren dauerhaft
 * danebensteht — er bestätigte nur noch, was ohnehin auf dem Schirm stand.
 *
 * Beides landet auf derselben Regel, `setzeAufstellung()`.
 *
 * Entscheidet keine Regel. Was ein Wechsel kostet, wer dabei wohin rutscht und
 * wer einspringt, sagt die Engine.
 */

import { el } from './dom.js';
import { T } from '../i18n.js';
import { platzKuerzel, positionsKuerzel } from '../engine/positionen.js';
import {
  specialSpieler, specialTechnik, SPECIAL_PLAETZE, SPECIAL_WERT,
} from '../engine/aufstellung.js';

/**
 * @typedef {{ spieler: import('../engine/spieler.js').Spieler, wert: number }} Kandidat
 */

/**
 * @typedef {object} Steuerung
 * @property {string | null} platz    Der gewählte Platz-Schlüssel
 * @property {string | null} spieler  Die gewählte Spieler-Id
 * @property {boolean} vonHand        Ob eine Vorgabe gespeichert ist
 * @property {(schluessel: string | null) => void} waehlePlatz
 * @property {(spielerId: string | null) => void} waehleSpieler
 * @property {(schluessel: string, spielerId: string) => void} setze
 * @property {(schluessel: string) => void} loese  Platz zurück an die Automatik
 * @property {() => void} automatisch
 * @property {(platz: string) => number} wertFuer  Was der gewählte Mann dort brächte
 * @property {string} gewaehlterName
 * @property {boolean} alleZeigen     Ob die Liste links über die Einheit hinausgeht
 * @property {(an: boolean) => void} zeigeAlle
 * @property {boolean} starterZeigen  Ob die Liste links auch die Aufgestellten zeigt
 * @property {(an: boolean) => void} zeigeStarter
 * @property {boolean} veraendert     Es gibt ungespeicherte Änderungen
 * @property {boolean} vollstaendig   Jeder der zweiundzwanzig Plätze ist besetzt
 * @property {() => void} speichern
 * @property {() => void} verwerfen
 * @property {() => void} leeren
 * @property {(spielerId: string) => void} entferne
 */

/** @param {import('../engine/aufstellung.js').Platz} p */
function name(p) {
  if (!p.spieler) return T.taktik.keiner;
  return `${p.spieler.nummer} ${p.spieler.vorname.charAt(0)}. ${p.spieler.nachname}`;
}

/** @param {import('../engine/spieler.js').Spieler} s */
export function kurzName(s) {
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
 * Ein Bereich des Rosters: links, wer zur Verfügung steht, rechts die Plätze,
 * darunter die Zahl, die beides zusammen ergibt.
 *
 * Die Aufteilung ist der ganze Umbau. Vorher stand die Liste der Kandidaten
 * unter dem angetippten Platz und war so lang wie die Frage danach kurz —
 * fünf Namen, und für alles andere musste man in den Roster hinunterscrollen.
 * Nebeneinander beantwortet dieselbe Fläche beide Richtungen gleichzeitig.
 * @param {string} titel
 * @param {import('../engine/aufstellung.js').Platz[]} plaetze
 * @param {Kandidat[]} verfuegbare
 * @param {Steuerung} steuerung
 * @param {number} staerke
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 */
export function einheitBereich(titel, plaetze, verfuegbare, steuerung, staerke, a) {
  return el('div', { class: 'karte' },
    el('div', { class: 'kartenkopf' },
      el('h2', { text: titel }),
      el('div', { class: 'staerkezahl', title: T.roster.staerke },
        el('span', { class: 'klein leise', text: T.roster.staerke }),
        el('strong', { text: String(Math.round(staerke)) }))),
    el('div', { class: 'aufstellungsraster' },
      verfuegbarSpalte(verfuegbare, steuerung, a, steuerung),
      el('div', { class: 'plaetzespalte' },
        el('h3', { class: 'klein leise', text: T.roster.starter }),
        el('ul', { class: 'aufstellung' },
          plaetze.map((p) => platzZeile(p, steuerung))))));
}

/**
 * Die Special Teams. Drei Plätze, und keiner von ihnen gehört zur Elf.
 *
 * Sie stehen hier und nicht als Fußnote unter der Aufstellung, seit der
 * Manager sie besetzen darf. Was vorher eine Zeile war („Kicker: Huber ·
 * Punter: Huber"), ist jetzt eine Entscheidung — und eine, die ohne die
 * beiden gezogenen Kickwerte nicht zu treffen ist. Deshalb stehen sie
 * ausgeschrieben daneben: es sind die einzigen Werte im Spiel, die sonst
 * nirgends sichtbar wären.
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 * @param {Kandidat[]} verfuegbare
 * @param {Steuerung} steuerung
 * @param {number} staerke
 */
export function specialBereich(a, verfuegbare, steuerung, staerke) {
  return el('div', { class: 'karte' },
    el('div', { class: 'kartenkopf' },
      el('h2', { text: T.kader.special }),
      el('div', { class: 'staerkezahl', title: T.roster.staerke },
        el('span', { class: 'klein leise', text: T.roster.staerke }),
        el('strong', { text: String(Math.round(staerke)) }))),
    el('p', { class: 'leise klein', style: { margin: '0 0 8px' }, text: T.special.hinweis }),
    el('div', { class: 'aufstellungsraster' },
      verfuegbarSpalte(verfuegbare, steuerung, a, null),
      el('div', { class: 'plaetzespalte' },
        el('h3', { class: 'klein leise', text: T.roster.plaetze }),
        el('ul', { class: 'aufstellung' },
          SPECIAL_PLAETZE.map((schluessel) => specialZeile(a, schluessel, steuerung))))));
}

/**
 * Die Liste links: wer zu haben ist.
 *
 * Ihre Reihenfolge hängt an der Frage, die gerade offen ist. Ist ein Platz
 * gewählt, steht sie nach dem, was jeder **dort** brächte; sonst nach Stärke.
 * Die Zahl daneben meint immer dasselbe wie die Überschrift — sonst verglichen
 * die beiden Spalten Zahlen, die nichts miteinander zu tun haben.
 * Die beiden Schalter stehen nur dort, wo sie etwas tun. Bei den Special Teams
 * gibt es nichts zu filtern: gekickt wird aus dem ganzen Kader, die Elf
 * eingeschlossen, und zwei Schalter ohne Wirkung wären ein Versprechen, das
 * die Liste nicht hält.
 * @param {Kandidat[]} verfuegbare
 * @param {Steuerung} steuerung
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 * @param {Steuerung | null} schalter Die Steuerung, wo Filter etwas bewirken
 */
function verfuegbarSpalte(verfuegbare, steuerung, a, schalter) {
  const kopf = steuerung.platz
    ? T.roster.kopfFuer(platzKuerzel(platzVon(a, steuerung.platz)))
    : T.roster.kopfAlle;

  return el('div', { class: 'verfuegbarspalte' },
    el('div', { class: 'verfuegbarkopf' },
      el('h3', { class: 'klein leise', text: kopf }),
      schalter
        ? el('button', {
          class: schalter.alleZeigen ? 'schalter an' : 'schalter',
          'aria-pressed': String(schalter.alleZeigen),
          title: T.roster.filterAlleTitel,
          onclick: () => schalter.zeigeAlle(!schalter.alleZeigen),
        }, T.roster.filterAlle)
        : null,
      schalter
        ? el('button', {
          class: schalter.starterZeigen ? 'schalter an' : 'schalter',
          'aria-pressed': String(schalter.starterZeigen),
          title: T.aufstellung.starterZeigenTitel,
          onclick: () => schalter.zeigeStarter(!schalter.starterZeigen),
        }, T.aufstellung.starterZeigen)
        : null),
    verfuegbare.length === 0
      ? el('p', { class: 'leise klein', text: T.roster.niemandFrei })
      : null,
    el('ul', { class: 'verfuegbare' },
      verfuegbare.map(({ spieler, wert }) => {
        const gewaehlt = steuerung.spieler === spieler.id;
        const wo = stehtAuf(a, spieler.id);
        const tippen = () => {
          if (steuerung.platz) steuerung.setze(steuerung.platz, spieler.id);
          else steuerung.waehleSpieler(gewaehlt ? null : spieler.id);
        };

        return el('li', {
          class: 'verfuegbar' + (gewaehlt ? ' gewaehlt' : '') + (wo ? ' steht' : ''),
          role: 'button',
          tabindex: '0',
          'aria-pressed': String(gewaehlt),
          title: T.aufstellung.spielerWaehlen(spieler.nachname),
          onclick: tippen,
          onkeydown: (/** @type {KeyboardEvent} */ e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            tippen();
          },
        },
          el('span', { class: 'verfuegbar-name', text: kurzName(spieler) }),
          // Das Alter gehört hierher: die Zahl daneben sagt, was er heute kann,
          // und erst zusammen sagen beide, ob er es nächstes Jahr noch kann.
          el('span', { class: 'leise klein', title: T.kader.alter,
            text: T.aufstellung.jahre(spieler.alter) }),
          el('span', { class: 'leise klein', text: positionsKuerzel(spieler) }),
          wo ? el('span', { class: 'marke tausch', text: platzKuerzel(wo) }) : null,
          el('span', { class: 'platz-stk', text: String(Math.round(wert)) }));
      })));
}

/** Der Platz zu einem Schlüssel — für die Überschrift der linken Spalte.
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 * @param {string} schluessel */
function platzVon(a, schluessel) {
  const treffer = [...a.offense, ...a.defense].find((p) => p.schluessel === schluessel);
  return treffer ? treffer.platz : schluessel;
}

/**
 * Speichern, verwerfen, automatisch — und nur, was gerade etwas tut.
 *
 * Speichern steht da, sobald etwas zu speichern ist, und ist gesperrt, solange
 * die Elf nicht vollständig ist. Der Knopf sagt damit dasselbe wie die Regel
 * dahinter, statt sie erst beim Tippen zu verraten.
 * @param {Steuerung} steuerung
 */
export function aktionsknoepfe(steuerung) {
  return el('div', { class: 'aufstellungsknoepfe' },
    steuerung.veraendert
      ? el('button', {
        class: 'haupt klein',
        disabled: !steuerung.vollstaendig || undefined,
        title: steuerung.vollstaendig ? undefined : T.aufstellung.speichernGesperrt,
        onclick: steuerung.speichern,
      }, T.aufstellung.speichern)
      : null,
    steuerung.veraendert
      ? el('button', { class: 'neben klein', onclick: steuerung.verwerfen }, T.aufstellung.verwerfen)
      : null,
    steuerung.vonHand || steuerung.veraendert
      ? el('button', { class: 'neben klein', onclick: steuerung.automatisch },
        T.aufstellung.automatisch)
      : null,
    el('button', { class: 'neben klein', onclick: steuerung.leeren }, T.aufstellung.loeschen));
}

/** @param {Steuerung} steuerung */
export function hinweisKlasse(steuerung) {
  return steuerung.veraendert || steuerung.spieler || steuerung.platz ? 'klein' : 'leise klein';
}

/**
 * Was über dem Roster steht — der Reihe nach die dringlichste Nachricht: erst
 * das Ungespeicherte, dann die angefangene Handlung, dann die Bedienung.
 * @param {Steuerung} steuerung
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 */
export function hinweisText(steuerung, a) {
  if (steuerung.veraendert) {
    return steuerung.vollstaendig ? T.aufstellung.ungespeichert : T.aufstellung.ungespeichertOffen;
  }
  if (steuerung.spieler) return T.roster.hinweisSpieler(steuerung.gewaehlterName);
  if (steuerung.platz) {
    return T.roster.hinweisPlatz(platzKuerzel(platzVon(a, steuerung.platz)));
  }
  return steuerung.vonHand ? T.aufstellung.vonHand : T.roster.hinweis;
}

/**
 * Eine Zeile der Aufstellung — und, sobald ein Mann gewählt ist, der Knopf, der
 * ihn hierher stellt.
 *
 * Im Zielmodus steht rechts nicht mehr eine Zahl, sondern zwei: was der Mann
 * bringt, der dort steht, und was der Gewählte dort brächte. Das ist die ganze
 * Frage, die der Manager an dieser Stelle hat, und sie steht damit
 * elfmal nebeneinander, statt einzeln erfragt werden zu müssen.
 * @param {import('../engine/aufstellung.js').Platz} p
 * @param {Steuerung} steuerung
 */
function platzZeile(p, steuerung) {
  const gewaehlt = steuerung.platz === p.schluessel;
  const ziel = !!steuerung.spieler;
  const hier = ziel && !!p.spieler && p.spieler.id === steuerung.spieler;
  const kuerzel = platzKuerzel(p.platz);

  const tippen = () => {
    if (!ziel) { steuerung.waehlePlatz(gewaehlt ? null : p.schluessel); return; }
    if (!hier) steuerung.setze(p.schluessel, /** @type {string} */ (steuerung.spieler));
  };

  const neu = ziel && !hier ? Math.round(steuerung.wertFuer(p.platz)) : null;

  return el('li', {
    class: 'waehlbar' + (gewaehlt ? ' gewaehlt' : '')
      + (ziel ? ' ziel' : '') + (hier ? ' steht' : '') + (p.frei ? ' frei' : ''),
    role: 'button',
    tabindex: '0',
    'aria-pressed': String(gewaehlt),
    'aria-disabled': hier ? 'true' : undefined,
    title: ziel
      ? (hier ? T.aufstellung.stehtHier : T.aufstellung.hierEinsetzen(kuerzel, steuerung.gewaehlterName))
      : T.aufstellung.platzTitel(kuerzel),
    onclick: tippen,
    onkeydown: (/** @type {KeyboardEvent} */ e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      tippen();
    },
  },
    el('span', { class: 'platz', text: kuerzel }),
    el('span', { class: 'platz-name', text: name(p) }),
    p.umgestellt ? el('span', { class: 'marke um', text: T.taktik.umgestellt }) : null,
    p.doppel
      ? el('span', { class: 'marke doppel', title: T.taktik.doppelHinweis, text: T.taktik.doppel })
      : null,
    hier ? el('span', { class: 'marke steht', text: T.aufstellung.stehtSchon }) : null,
    el('span', {
      class: 'platz-pos leise',
      text: p.spieler ? positionsKuerzel(p.spieler) : '',
    }),
    p.spieler ? el('span', {
      class: ziel ? 'platz-stk alt' : 'platz-stk',
      title: T.taktik.platzStaerke(Math.round(p.staerke)),
      text: String(Math.round(p.staerke)),
    }) : null,
    neu == null ? null : el('span', {
      // Grün, wo er den Platz verbessert. Die beiden Zahlen sagen es auch so,
      // aber elf Paare liest niemand einzeln durch.
      class: 'platz-stk neu' + (neu > Math.round(p.staerke) ? ' besser' : ''),
      title: T.aufstellung.neuerWert(steuerung.gewaehlterName, neu),
      text: String(neu),
    }));
}

/**
 * Eine Zeile der Special Teams.
 *
 * Sie trägt eine Marke, die keine der zweiundzwanzig hat: **automatisch**. Ein
 * leerer Special-Teams-Platz heißt nicht „niemand", sondern „nimm den besten
 * Fuß" — und deshalb steht neben einem selbst besetzten Platz der Weg zurück.
 * Ohne ihn wäre die erste Wahl endgültig, und der nächste rekrutierte Kicker
 * käme nicht mehr auf den Platz, ohne dass jemand wüsste, warum.
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 * @param {string} schluessel
 * @param {Steuerung} steuerung
 */
function specialZeile(a, schluessel, steuerung) {
  const spieler = specialSpieler(a, schluessel);
  const gewaehlt = steuerung.platz === schluessel;
  const ziel = !!steuerung.spieler;
  const hier = ziel && !!spieler && spieler.id === steuerung.spieler;
  const vonHand = !!a.specialVonHand && a.specialVonHand[schluessel];

  const tippen = () => {
    if (!ziel) { steuerung.waehlePlatz(gewaehlt ? null : schluessel); return; }
    if (!hier) steuerung.setze(schluessel, /** @type {string} */ (steuerung.spieler));
  };

  const neu = ziel && !hier ? Math.round(steuerung.wertFuer(schluessel)) : null;

  return el('li', {
    class: 'waehlbar special' + (gewaehlt ? ' gewaehlt' : '')
      + (ziel ? ' ziel' : '') + (hier ? ' steht' : '') + (spieler ? '' : ' frei'),
    role: 'button',
    tabindex: '0',
    'aria-pressed': String(gewaehlt),
    'aria-disabled': hier ? 'true' : undefined,
    title: ziel
      ? (hier ? T.aufstellung.stehtHier : T.aufstellung.hierEinsetzen(schluessel, steuerung.gewaehlterName))
      : T.aufstellung.platzTitel(T.special[schluessel]),
    onclick: tippen,
    onkeydown: (/** @type {KeyboardEvent} */ e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      tippen();
    },
  },
    el('span', { class: 'platz', title: T.special[schluessel], text: schluessel }),
    el('span', { class: 'platz-name', text: spieler ? kurzName(spieler) : T.taktik.keiner }),
    vonHand
      ? el('button', {
        class: 'schalter loesen',
        title: T.special.zurueckAutomatikTitel,
        onclick: (/** @type {MouseEvent} */ e) => { e.stopPropagation(); steuerung.loese(schluessel); },
        onkeydown: (/** @type {KeyboardEvent} */ e) => e.stopPropagation(),
      }, T.special.zurueckAutomatik)
      : el('span', { class: 'marke auto', title: T.special.automatischTitel,
        text: T.special.automatisch }),
    hier ? el('span', { class: 'marke steht', text: T.aufstellung.stehtSchon }) : null,
    spieler ? kickWerte(spieler) : null,
    spieler ? el('span', {
      class: ziel ? 'platz-stk alt' : 'platz-stk',
      text: String(Math.round(SPECIAL_WERT[schluessel](spieler))),
    }) : null,
    neu == null ? null : el('span', {
      class: 'platz-stk neu'
        + (neu > Math.round(spieler ? SPECIAL_WERT[schluessel](spieler) : 0) ? ' besser' : ''),
      title: T.aufstellung.neuerWert(steuerung.gewaehlterName, neu),
      text: String(neu),
    }));
}

/**
 * Die beiden gezogenen Kickwerte und, wo es einen gibt, die Technik des
 * Spezialisten. Bis hierher waren sie unsichtbar: sie stehen in keinem der
 * fünfzehn Attribute und tauchten nirgends auf, obwohl acht Prozent der
 * Gesamtstärke an ihnen hängen.
 * @param {import('../engine/spieler.js').Spieler} s
 */
function kickWerte(s) {
  const technik = specialTechnik(s);
  return el('span', { class: 'kickwerte' },
    el('span', { class: 'klein leise', title: T.special.beinTitel,
      text: `${T.special.bein} ${s.kickStaerke}` }),
    el('span', { class: 'klein leise', title: T.special.zielTitel,
      text: `${T.special.ziel} ${s.kickGenauigkeit}` }),
    technik > 0
      ? el('span', { class: 'klein', title: T.special.technikTitel,
        text: `${T.special.technik} ${Math.round(technik)}` })
      : null);
}

/**
 * Die Leiste, die den angefangenen Wechsel festhält.
 *
 * Sie klebt oben am Rand, weil der zweite Tipp weiter unten passiert: ohne sie
 * müsste der Manager nach jeder Auswahl wieder hochscrollen, um zu sehen, was
 * er eigentlich gerade tut. Einen Knopf zum Bestätigen trägt sie nicht mehr —
 * der zweite Tipp setzt selbst ein.
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 * @param {Steuerung} steuerung
 * @param {import('../engine/spieler.js').Spieler | null} spieler Der gewählte Mann
 */
export function wechselLeiste(a, steuerung, spieler) {
  if (spieler) {
    const steht = stehtAuf(a, spieler.id);
    return el('div', { class: 'wechselleiste' },
      el('div', { class: 'wechseltext' },
        el('strong', { text: kurzName(spieler) }),
        el('span', { class: 'klein leise',
          text: steht ? T.aufstellung.stehtAuf(platzKuerzel(steht)) : T.aufstellung.waehlePlatz })),
      el('div', { class: 'wechselknoepfe' },
        // Herausnehmen statt umstellen: sein Platz bleibt frei stehen, und
        // damit ist die Elf so lange nicht speicherbar, bis er besetzt wird.
        steht
          ? el('button', {
            class: 'neben klein',
            title: T.aufstellung.entfernenTitel,
            onclick: () => steuerung.entferne(spieler.id),
          }, T.aufstellung.entfernen)
          : null,
        el('button', { class: 'neben klein', onclick: () => steuerung.waehleSpieler(null) },
          T.aktion.zurueck)));
  }

  if (!steuerung.platz) return null;

  const platz = [...a.offense, ...a.defense].find((p) => p.schluessel === steuerung.platz);
  const ziel = platz ? platzKuerzel(platz.platz) : T.special[steuerung.platz] || steuerung.platz;
  const steht = platz ? (platz.spieler ? name(platz) : T.taktik.keiner)
    : (specialSpieler(a, steuerung.platz)
      ? kurzName(/** @type {any} */ (specialSpieler(a, steuerung.platz)))
      : T.taktik.keiner);

  return el('div', { class: 'wechselleiste' },
    el('div', { class: 'wechseltext' },
      el('strong', { text: ziel }),
      el('span', { class: 'klein leise', text: steht }),
      el('span', { class: 'klein leise', text: T.aufstellung.waehleSpieler })),
    el('div', { class: 'wechselknoepfe' },
      el('button', { class: 'neben klein', onclick: () => steuerung.waehlePlatz(null) },
        T.aktion.zurueck)));
}
