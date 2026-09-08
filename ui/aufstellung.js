// @ts-check
/**
 * Die Aufstellung: wer auf welchem Platz steht — und der Weg, das zu ändern.
 *
 * Sie steht im Roster und nicht in der Taktik: dort wird entschieden, was die
 * Mannschaft vorhat, hier steht, wer es tut.
 *
 * Der Weg ist für den Finger gebaut, nicht für die Maus: er kommt ohne Ziehen
 * aus und geht in beide Richtungen — beide Male zwei Tipps:
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
 * Der zweite Tipp setzt sofort ein — und zwar in den Speicherstand. Früher
 * stand dazwischen erst ein Knopf „Einsetzen" und danach noch einer namens
 * „Speichern"; beide sind entfallen. Der erste bestätigte nur, was ohnehin auf
 * dem Schirm stand, der zweite hielt einen zweiten Zustand am Leben, den die
 * Ansicht mitführen und der Reiterwechsel abfragen musste. Wer sich vertippt,
 * tippt zurück.
 *
 * Was die Auswahl gerade ist, sagt allein die Farbe. Eine Leiste am oberen Rand
 * sagte es zusätzlich in Worten und schob dabei die halbe Ansicht nach unten —
 * ein Hinweis, der die Sache verdeckt, um die es geht.
 *
 * **Gezogen wird trotzdem** — als Zugabe, nicht als Ersatz: wer eine Maus hat,
 * legt einen Mann in einer Bewegung auf seinen Platz, statt zweimal zu tippen,
 * und der Finger kommt nach kurzem Halten auf denselben Weg. Das Wie steht in
 * [`ziehen.js`](ziehen.js); hier stehen nur die Griffe und die Ziele. Ein Ziel
 * ist ein Platz, erkennbar am `data-ziel`; ein Griff hängt an jeder Zeile, an
 * der ein Mann steht.
 *
 * Alles landet auf derselben Regel, `aufstellungSetze()`.
 *
 * Entscheidet keine Regel. Was ein Wechsel kostet, wer dabei wohin rutscht und
 * wer einspringt, sagt die Engine.
 */

import { el } from './dom.js';
import { anfassen } from './ziehen.js';
import { T } from '../i18n.js';
import { platzKuerzel, positionsKuerzel } from '../engine/positionen.js';
import {
  specialSpieler, SPECIAL_PLAETZE, SPECIAL_WERT, SPECIAL_TOP,
} from '../engine/aufstellung.js';
import { OHNE_NUMMER } from '../engine/spieler.js';

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
 * @property {(schluessel: string) => void} raeume  Platz leeren, und leer lassen
 * @property {(schluessel: string) => void} loese  Platz zurück an die Automatik
 * @property {() => void} automatisch
 * @property {(platz: string) => number} wertFuer  Was der gewählte Mann dort brächte
 * @property {string} gewaehlterName
 * @property {boolean} alleZeigen     Ob die Liste links über die Einheit hinausgeht
 * @property {(an: boolean) => void} zeigeAlle
 * @property {boolean} starterZeigen  Ob die Liste links auch die Aufgestellten zeigt
 * @property {(an: boolean) => void} zeigeStarter
 * @property {number} offen           Wie viele der zweiundzwanzig Plätze leer stehen
 * @property {() => void} leeren
 */

/**
 * Name und Nummer eines Platzes — die Nummer als eigenes Stück, denn sie ist
 * nicht immer seine.
 *
 * Wer sich für diesen Platz eine Nummer borgt, trägt sie hier in Gold, wie die
 * Marke „umgestellt": beides sagt dasselbe, dass dieser Mann heute woanders
 * steht als sonst, und beides ist ohne Erklärung zu sehen. Die Erklärung steht
 * im Titel, mitsamt seiner eigenen Nummer.
 * @param {import('../engine/aufstellung.js').Platz} p
 */
function name(p) {
  if (!p.spieler) return T.taktik.keiner;
  const geliehen = p.leihNummer !== OHNE_NUMMER;
  return [
    el('span', {
      class: geliehen ? 'platz-nr geliehen' : 'platz-nr',
      title: geliehen ? T.taktik.leihNummer(p.spieler.nummer) : undefined,
      text: String(geliehen ? p.leihNummer : p.spieler.nummer),
    }),
    ` ${p.spieler.vorname.charAt(0)}. ${p.spieler.nachname}`,
  ];
}

/** @param {import('../engine/spieler.js').Spieler} s */
export function kurzName(s) {
  return `${s.nummer} ${s.vorname.charAt(0)}. ${s.nachname}`;
}

/**
 * Auf welchem Platz ein Spieler gerade steht — `null`, wenn er auf der Bank
 * sitzt. Für den Hinweis, dass ein Wechsel ein Tausch wird.
 *
 * Es kommt der ganze Platz zurück, nicht sein Name: die Marke zeigt das Kürzel
 * (`WR`), das Ziehen braucht den Schlüssel (`WR#2`), und wer hier nur den Namen
 * weitergäbe, ließe einen Mann auf seinen eigenen Platz ziehen, weil die beiden
 * auf den doppelt vergebenen Plätzen nicht dasselbe sind.
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 * @param {string} spielerId
 */
function stehtAuf(a, spielerId) {
  return [...a.offense, ...a.defense]
    .find((p) => p.spieler && p.spieler.id === spielerId) || null;
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
  // Eine Einheit mit Lücke hat keine Stärke, die man hinschreiben könnte. Der
  // leere Platz zählt null, und aus elf Plätzen, von denen drei null sind, eine
  // Zahl zu bilden hieße, eine halbe Elf zu bewerten, als wäre sie eine ganze.
  // Vorher standen dort zwanzig Punkte „Ersatzstärke" pro Loch — eine Elf ohne
  // einen einzigen Spieler sah damit nach Stärke 20 aus.
  const steht = plaetze.every((p) => !!p.spieler);
  return el('div', { class: 'karte' },
    el('div', { class: 'kartenkopf' },
      el('h2', { text: titel }),
      el('div', { class: 'staerkezahl', title: steht ? T.roster.staerke : T.roster.staerkeOffen },
        el('span', { class: 'klein leise', text: T.roster.staerke }),
        el('strong', { text: steht ? String(Math.round(staerke)) : T.roster.ohneZahl }))),
    el('div', { class: 'aufstellungsraster' },
      verfuegbarSpalte(verfuegbare, steuerung, a, steuerung, null),
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
 * Punter: Huber"), ist jetzt eine Entscheidung.
 *
 * Die Werte, aus denen sie sich ergibt, stehen dabei **links** und nicht in
 * den drei Zeilen. Vorher trug jede Zeile Bein und Zielwasser ausgeschrieben
 * neben sich — drei Zahlenpaare über die Männer, die ohnehin schon dort
 * stehen, und keins über die, die sie ablösen könnten. Gebraucht werden sie
 * beim Vergleichen; also stehen sie an den Kandidaten, sobald ein Platz
 * gewählt ist, und zwar die beiden, an denen **dieser** Platz hängt.
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 * @param {Kandidat[]} verfuegbare
 * @param {Steuerung} steuerung
 * @param {number} staerke
 */
export function specialBereich(a, verfuegbare, steuerung, staerke) {
  // Nur ein gewählter Special-Teams-Platz sagt, welche zwei Werte gemeint
  // sind. Ist stattdessen ein Platz der Elf gewählt, steht hier keiner: eine
  // Spalte, die nach dem Bein fragte, während der Manager den linken Guard
  // besetzt, beantwortete eine Frage, die niemand gestellt hat.
  const gewaehlt = steuerung.platz && SPECIAL_PLAETZE.includes(steuerung.platz)
    ? steuerung.platz : null;

  return el('div', { class: 'karte' },
    el('div', { class: 'kartenkopf' },
      el('h2', { text: T.kader.special }),
      el('div', { class: 'staerkezahl', title: T.roster.staerke },
        el('span', { class: 'klein leise', text: T.roster.staerke }),
        el('strong', { text: String(Math.round(staerke)) }))),
    el('p', { class: 'leise klein', style: { margin: '0 0 8px' }, text: T.special.hinweis }),
    el('div', { class: 'aufstellungsraster' },
      verfuegbarSpalte(verfuegbare, steuerung, a, null, gewaehlt),
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
 * @param {string | null} specialPlatz Der gewählte Special-Teams-Platz, wenn
 *   diese Spalte zu ihm gehört — dann trägt jede Zeile seine beiden Werte
 */
function verfuegbarSpalte(verfuegbare, steuerung, a, schalter, specialPlatz) {
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
          // Derselbe Mann, derselbe Weg: der Zug endet auf `setze()`, wie der
          // zweite Tipp. Ein angefangener Zug, der keinen Platz trifft, lässt
          // auch den Tipp fallen — das ist in `ziehen.js` begründet.
          onpointerdown: anfassen(spieler.id, kurzName(spieler),
            wo ? wo.schluessel : null, steuerung.setze),
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
          specialPlatz ? topWerte(spieler, specialPlatz) : null,
          wo ? el('span', { class: 'marke tausch', text: platzKuerzel(wo.platz) }) : null,
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
 * Automatisch aufstellen und Aufstellung löschen — mehr gibt es nicht mehr.
 *
 * „Speichern" und „Verwerfen" sind entfallen: jeder Tipp steht sofort im
 * Speicherstand. „Automatisch aufstellen" steht nur da, wo es etwas tut — ohne
 * eigene Vorgabe stellt die Automatik ohnehin alles. Es ist zugleich der Weg
 * zurück aus einer Elf mit Löchern: es lässt die Vorgabe fallen, und die drei
 * Runden besetzen wieder jeden Platz.
 * @param {Steuerung} steuerung
 */
export function aktionsknoepfe(steuerung) {
  return el('div', { class: 'aufstellungsknoepfe' },
    steuerung.vonHand
      ? el('button', { class: 'neben klein', onclick: steuerung.automatisch },
        T.aufstellung.automatisch)
      : null,
    el('button', { class: 'neben klein', onclick: steuerung.leeren }, T.aufstellung.loeschen));
}

/** @param {Steuerung} steuerung */
export function hinweisKlasse(steuerung) {
  return steuerung.spieler || steuerung.platz ? 'klein' : 'leise klein';
}

/**
 * Was über dem Roster steht: die angefangene Handlung, sonst die Bedienung.
 *
 * Von den leeren Plätzen steht hier nichts. Die stehen eine Zeile tiefer neben
 * der Gesamtstärke und bleiben dort auch dann stehen, wenn der Manager gerade
 * einen Mann in der Hand hat — ein Hinweis, der abwechselnd zwei Dinge sagt,
 * sagt am Ende keins von beiden.
 * @param {Steuerung} steuerung
 * @param {import('../engine/aufstellung.js').Aufstellung} a
 */
export function hinweisText(steuerung, a) {
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
    // Jeder Platz nimmt einen Gezogenen an — auch ein besetzter, denn dann ist
    // es ein Tausch, und auch einer aus der anderen Einheit.
    'data-ziel': p.schluessel,
    title: ziel
      ? (hier ? T.aufstellung.stehtHier : T.aufstellung.hierEinsetzen(kuerzel, steuerung.gewaehlterName))
      : T.aufstellung.platzTitel(kuerzel),
    onclick: tippen,
    // Wer hier steht, lässt sich von hier wegziehen: Platz auf Platz ist der
    // Tausch, und er ist der Zug, für den das Ziehen überhaupt kürzer ist als
    // zwei Tipps. Ein leerer Platz hat nichts zu greifen.
    onpointerdown: p.spieler
      ? anfassen(p.spieler.id, kurzName(p.spieler), p.schluessel, steuerung.setze)
      : undefined,
    onkeydown: (/** @type {KeyboardEvent} */ e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      tippen();
    },
  },
    el('span', { class: 'platz', text: kuerzel }),
    el('span', { class: 'platz-name' }, name(p)),
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
    }),
    p.spieler ? papierkorb(() => steuerung.raeume(p.schluessel), kuerzel) : null);
}

/**
 * Der Papierkorb an einer Platzzeile: diesen einen Platz räumen.
 *
 * Er hält den Klick auf, sonst zählte derselbe Tipp zugleich als Platzwahl und
 * die Ansicht spränge in den Auswahlmodus, während sie den Platz leert.
 *
 * Geräumt heißt leer und bleibt leer — nicht „zurück an die Automatik". Die
 * stellte auf einen freigegebenen Platz sofort wieder den stärksten Mann seiner
 * Position, und das ist in aller Regel genau der, den der Manager gerade
 * weggeklickt hat; der Knopf sähe aus, als täte er nichts. Wer die Automatik
 * zurückwill, drückt „Automatisch aufstellen" — bei den Special Teams den
 * Knopf „Automatik" in der Zeile selbst.
 * @param {() => void} wirkung
 * @param {string} kuerzel Für den Titel — welcher Platz hier geräumt wird
 */
function papierkorb(wirkung, kuerzel) {
  return el('button', {
    class: 'papierkorb',
    title: T.aufstellung.raeumenTitel(kuerzel),
    'aria-label': T.aufstellung.raeumenTitel(kuerzel),
    html: PAPIERKORB_SVG,
    onclick: (/** @type {MouseEvent} */ e) => { e.stopPropagation(); wirkung(); },
    onkeydown: (/** @type {KeyboardEvent} */ e) => e.stopPropagation(),
  });
}

/**
 * Der Mülleimer als Pfad statt als Zeichen. Ein Emoji wäre kürzer, käme aber in
 * jeder Schrift anders heraus und in manchen als Kasten — dasselbe Problem, an
 * dem schon der halbe Stern in `dom.js` gescheitert ist.
 */
const PAPIERKORB_SVG = '<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" '
  + 'focusable="false"><path fill="currentColor" d="M6.5 1.5h3a1 1 0 0 1 1 1V3H13v1.5H3V3h2.5v-.5a1 '
  + '1 0 0 1 1-1zM4.2 6h7.6l-.62 8.08A1 1 0 0 1 10.2 15H5.8a1 1 0 0 1-1-.92L4.2 6zm2.05 1.6.2 '
  + '5.4h1.1l-.2-5.4h-1.1zm3.5 0h-1.1l-.2 5.4h1.1l.2-5.4z"/></svg>';


/**
 * Eine Zeile der Special Teams.
 *
 * Sie kennt drei Zustände, wo die zweiundzwanzig zwei kennen: besetzt,
 * **automatisch** — die Marke, die keine der elf trägt — und ausdrücklich
 * leer. Der mittlere ist der Grund für beide Knöpfe in dieser Zeile: ein
 * leerer Platz heißt hier von Haus aus nicht „niemand", sondern „nimm den
 * besten Fuß", und beide Richtungen daraus müssen zu erreichen sein.
 *
 * Der Papierkorb sagt „niemand" und meint es: kein Kicker, kein Punter, kein
 * Long Snapper, und die fehlende Stärke ist der Preis. Er steht hier, weil ein
 * Verein, der keinen Fuß hat, das auch aufstellen können soll — die Automatik
 * stellt sonst irgendeinen Guard aufs Tee, und das sieht aus wie ein Kicker,
 * ohne einer zu sein. Der Weg zurück ist die andere Richtung: „Automatik" gibt
 * den Platz wieder her. Ohne ihn wäre die erste Wahl endgültig, und der
 * nächste rekrutierte Kicker käme nicht mehr auf den Platz, ohne dass jemand
 * wüsste, warum.
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
    // Ziel ja, Griff nein. Wer hier steht, steht vielleicht nur automatisch
    // hier — ihn wegzuziehen sähe aus wie „nicht mehr kicken", und genau das
    // kann das Ziehen nicht: es setzt ein, es räumt nicht. Der Weg zurück in
    // die Automatik ist der Knopf in dieser Zeile.
    'data-ziel': schluessel,
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
    spieler ? el('span', {
      class: ziel ? 'platz-stk alt' : 'platz-stk',
      text: String(Math.round(SPECIAL_WERT[schluessel](spieler))),
    }) : null,
    neu == null ? null : el('span', {
      class: 'platz-stk neu'
        + (neu > Math.round(spieler ? SPECIAL_WERT[schluessel](spieler) : 0) ? ' besser' : ''),
      title: T.aufstellung.neuerWert(steuerung.gewaehlterName, neu),
      text: String(neu),
    }),
    // Nur, wo einer steht. Ein Platz, der schon leer ist, hat nichts zu
    // räumen — und trägt statt des Korbs den Knopf zurück in die Automatik.
    spieler ? papierkorb(() => steuerung.raeume(schluessel), T.special[schluessel]) : null);
}

/**
 * Die beiden Werte, an denen der gewählte Special-Teams-Platz hängt.
 *
 * Welche zwei das sind, sagt die Engine (`SPECIAL_TOP`) — hier steht nur, wie
 * sie aussehen. Für den Kicker und den Punter sind es die beiden gezogenen
 * Kickwerte, die sonst nirgends im Spiel sichtbar wären; für den Long Snapper
 * zwei andere, denn Bein und Zielwasser entscheiden über einen Snap gar
 * nichts, und danebengestellt sähen sie aus, als täten sie es.
 * @param {import('../engine/spieler.js').Spieler} s
 * @param {string} schluessel
 */
function topWerte(s, schluessel) {
  return el('span', { class: 'specialwerte' },
    (SPECIAL_TOP[schluessel] || []).map(({ schluessel: k, wert }) =>
      el('span', { class: 'klein leise', title: T.special[`${k}Titel`],
        text: `${T.special[k]} ${Math.round(wert(s))}` })));
}
