// @ts-check
/**
 * Das Tryout: die Werbung im Postfach, alles andere auf einem eigenen
 * Bildschirm.
 *
 * Ein eigener Bildschirm statt der halben Lesespalte im Postfach — fünfzehn
 * Kandidaten mit Athletik, Lebenslage und Prognose brauchen mehr Platz, als
 * eine Nachricht neben ihrer Liste und ihrem Ordner hergibt. Die Nachricht
 * bleibt trotzdem der Ort, an dem der Manager erfährt, dass ein Tryout
 * ansteht — sie trägt nur noch den Text und einen Knopf, der hierher führt,
 * damit „ist etwas Neues da" weiter im Posteingang beantwortet wird und nicht
 * an einer zweiten Stelle.
 *
 * Die Werbung ist die Ausnahme: acht Häkchen und eine Zahl passen bequem in
 * die Lesespalte, und ein eigener Bildschirm dafür wäre ein Umweg für eine
 * Entscheidung, die in zehn Sekunden getroffen ist.
 *
 * Gezeigt wird in Stufen, nie in nackten Zahlen: die Athletik gegen den
 * Ligaschnitt je Attribut, das Interesse als Stufe. Das Talent bleibt eine
 * Spanne, die sich mit der Scouting-Qualität des Stabs verengt — dort ist die
 * Spanne die einzige Aussage, es gibt keine zweite Zahl daneben. Die Prognose
 * je Position dagegen zeigt nur noch eine Stufe, keine Spanne aus zweien: eine
 * Stufe ist selbst schon eine Bandbreite, und „WR (noch weit weg –
 * ausbaufähig)" war eine Bandbreite über einer Bandbreite. Was das alles
 * bedeutet, entscheidet `engine/recruiting.js`; hier wird nur benannt.
 */

import { el } from './dom.js';
import { spielerTabelle } from './personal.js';
import { T } from '../i18n.js';
import { coachesVon } from '../engine/saison.js';
import {
  recruitingVon, MASSNAHMEN, ATHLETIK, zulauf, werbungOffen, ligaSchnitt,
  athletikStufe, prognoseStufe, interesseStufe, tryoutGespraecheFrei, kandidatEinschaetzung,
} from '../engine/recruiting.js';

/**
 * @typedef {object} Aktionen
 * @property {(massnahme: string, an: boolean) => void} setzeWerbung
 * @property {(kandidatId: string) => void} sprichKandidat
 * @property {(spielerId: string, position: string) => void} setzeRookiePosition
 * @property {(id: string, antwort: string) => void} beantworte
 * @property {() => void} tryoutOeffnen  Zum Bildschirm wechseln
 * @property {() => void} zurueck        Zurück ins Postfach
 */

/**
 * Der Teil unter dem Text einer Tryout-Nachricht im Postfach: bei der Werbung
 * die Häkchen, bei den beiden anderen ein Knopf zum Bildschirm.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 * @returns {HTMLElement | null}
 */
export function tryoutTeil(n, stand, aktionen) {
  if (n.art === 'tryoutWerbung') return werbungTeil(n, stand, aktionen);
  if (n.art === 'tryout') return tryoutVerweis(n, stand, aktionen, T.tryout.jetztTeilnehmen);
  if (n.art === 'tryoutZusagen') return tryoutVerweis(n, stand, aktionen, T.tryout.zuDenZusagen);
  return null;
}

/** Eine leise Zeile an der Stelle, an der sonst mehr stünde. @param {string} text */
function hinweis(text) {
  return el('div', { class: 'tryoutteil' }, el('p', { class: 'leise klein', text }));
}

// --- Die Werbung -------------------------------------------------------------

/**
 * Die Maßnahmen zum Ankreuzen, und darunter, wie viele das bringt.
 *
 * Nach der Antwort stehen sie noch da, aber gesperrt: der Manager soll sehen
 * können, was er beschlossen hat, ohne dass ein Häkchen noch etwas täte.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 */
function werbungTeil(n, stand, aktionen) {
  const w = recruitingVon(stand).werbung;
  // Die Werbung eines vergangenen Tryouts ist überschrieben — dann bleibt der
  // Text allein stehen.
  if (!w || w.jahr !== n.daten.jahr || w.tag !== n.daten.tag) return null;
  const offen = n.antwort === null && werbungOffen(stand);

  return el('div', { class: 'tryoutteil' },
    el('div', { class: 'werbungliste' },
      MASSNAHMEN.map((m) => {
        const an = w.massnahmen.includes(m);
        return el('label', { class: 'werbungzeile' + (offen ? '' : ' gesperrt') },
          el('input', {
            type: 'checkbox',
            checked: an,
            disabled: !offen,
            onchange: (/** @type {Event} */ e) => aktionen.setzeWerbung(
              m, /** @type {HTMLInputElement} */ (e.target).checked),
          }),
          el('span', { class: 'werbungname', text: T.tryout.massnahmen[m] }),
          el('span', { class: 'leise klein', text: T.tryout.wen[m] }));
      })),
    el('p', { class: 'klein', text: T.tryout.andrang(zulauf(stand.meinTeam, w.massnahmen)) }),
    el('p', {
      class: 'leise klein',
      text: w.massnahmen.length === 0 ? T.tryout.keineWerbung
        : offen ? T.tryout.kostenlos : T.tryout.beschlossen,
    }));
}

// --- Der Verweis aus dem Postfach --------------------------------------------

/**
 * Solange offen: ein Knopf zum Bildschirm. Beantwortet oder überholt: der
 * Rückblick, den es vorher an dieser Stelle schon gab.
 * @param {import('../engine/postfach.js').Nachricht} n
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen @param {string} label
 */
function tryoutVerweis(n, stand, aktionen, label) {
  const r = recruitingVon(stand);
  const nochAktuell = n.art === 'tryout'
    ? r.tryout && r.tryout.jahr === n.daten.jahr && r.tryout.tag === n.daten.tag
    : r.neue.length > 0;
  if (n.antwort !== null) return hinweis(n.art === 'tryout' ? T.tryout.abgeschlossen : T.tryout.uebernommen);
  if (!nochAktuell) return hinweis(T.tryout.vorbei);
  return el('div', { class: 'tryoutteil' },
    el('button', { class: 'haupt', onclick: aktionen.tryoutOeffnen }, label));
}

// --- Der Bildschirm -----------------------------------------------------------

/**
 * Die eine offene Nachricht dieser Art — es gibt nie zwei Tryouts gleichzeitig,
 * also ist die erste offene auch die richtige.
 * @param {import('../engine/saison.js').SpielStand} stand @param {string} art
 */
function offeneTryoutNachricht(stand, art) {
  return stand.post.find((n) => n.art === art && n.antwort === null) || null;
}

/**
 * Der Tryout-Bildschirm: der eigene Kader zum Vergleich, und je nachdem, wo
 * das laufende Tryout gerade steht, die Kandidaten oder die Zusagen.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {import('./personal.js').Einblick} einblick
 * @param {Aktionen} aktionen
 */
export function zeigeTryoutScreen(stand, einblick, aktionen) {
  const r = recruitingVon(stand);
  const stab = coachesVon(stand, stand.meinTeam);

  const inhalt = r.tryout ? kandidatenTeil(stand, aktionen, stab)
    : r.neue.length > 0 ? neueTeil(stand, aktionen, stab)
      : el('p', { class: 'leise klein', text: T.tryout.nichtsMehr });

  return el('div', { class: 'tryoutscreen' },
    eigenerKaderTeil(stand, einblick),
    inhalt,
    el('div', { class: 'fuss' },
      el('button', { class: 'neben', onclick: aktionen.zurueck }, T.tryout.zurueckKnopf)));
}

/**
 * Der eigene Kader, vollständig, mit denselben Werten wie im Personal-Reiter
 * — dieselbe Zeile, dasselbe Aufklappen. Vorher stand hier nur eine
 * Übersicht je Position (Anzahl, Schnitt, Bester); das beantwortete nicht,
 * *wer* auf einer Position steht, nur dass jemand da ist. Zum Vergleich neben
 * den Kandidaten reicht das nicht — der Manager will die Namen und Zahlen
 * sehen, gegen die ein Kandidat antritt.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {import('./personal.js').Einblick} einblick
 */
function eigenerKaderTeil(stand, einblick) {
  return el('div', { class: 'karte tryout-kader' },
    el('h2', { text: T.tryout.eigenerKader }),
    el('p', { class: 'leise klein', text: T.tryout.eigenerKaderHinweis }),
    spielerTabelle(stand, einblick));
}

// --- Die Kandidaten ----------------------------------------------------------

/**
 * Die Kandidaten auf dem Platz, jeder auf einer eigenen Karte, mit dem Knopf
 * fürs Gespräch — und am Ende der Knopf, der den Vormittag beendet.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 * @param {import('../engine/coach.js').Coach[]} stab
 */
function kandidatenTeil(stand, aktionen, stab) {
  const tryout = /** @type {NonNullable<ReturnType<typeof recruitingVon>['tryout']>} */ (
    recruitingVon(stand).tryout);
  const liga = ligaSchnitt(stand);
  const frei = tryoutGespraecheFrei(tryout);

  return el('div', { class: 'karte tryoutteil' },
    el('div', { class: 'kartenkopf' },
      el('h2', { text: T.tryout.kandidatenTitel(tryout.kandidaten.length) }),
      tryout.abgeschlossen ? null : el('span', {
        class: 'marke gespraeche' + (frei === 0 ? ' leer' : ''),
        text: T.tryout.gespraecheFrei(frei),
      })),
    tryout.abgeschlossen ? el('p', { class: 'klein', text: T.tryout.abgeschlossen }) : null,
    el('div', { class: 'kandidaten' },
      tryout.kandidaten.map((k) => kandidatKarte(k, stand, aktionen, stab, liga, frei))),
    tryout.abgeschlossen ? null : el('button', {
      class: 'haupt',
      onclick: () => {
        const n = offeneTryoutNachricht(stand, 'tryout');
        if (n) aktionen.beantworte(n.id, 'abschliessen');
        aktionen.zurueck();
      },
    }, T.tryout.beendenKnopf));
}

/**
 * Eine Karte für einen Kandidaten.
 * @param {import('../engine/recruiting.js').Kandidat} k
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 * @param {import('../engine/coach.js').Coach[]} stab
 * @param {ReturnType<typeof ligaSchnitt>} liga
 * @param {number} frei
 */
function kandidatKarte(k, stand, aktionen, stab, liga, frei) {
  const e = kandidatEinschaetzung(stab, k);
  return el('div', { class: 'kandidat' },
    el('div', { class: 'kandidatkopf' },
      el('div', { class: 'kandidatname' },
        el('strong', { text: `${k.vorname} ${k.nachname}` }),
        el('span', {
          class: 'leise klein',
          text: `${T.kader.alterWert(k.alter)} · ${T.kader.koerperWert(k.groesse, k.gewicht)}`,
        })),
      el('span', {
        class: 'marke interesse', title: T.tryout.interesse,
        text: T.tryout.interesseStufen[interesseStufe(k.interesse)],
      }),
      k.angesprochen
        ? el('span', { class: 'marke', text: T.tryout.angesprochen })
        : el('button', {
          class: 'neben klein',
          disabled: frei === 0,
          onclick: () => aktionen.sprichKandidat(k.id),
        }, T.tryout.ansprechen)),
    el('div', { class: 'klein', text: T.lebenslage.satzGast(k.lebenslage, stand.jahr) }),
    athletik(k.attribute, liga.athletik),
    el('div', { class: 'klein' },
      el('span', { class: 'leise', text: `${T.tryout.talent}: ` }),
      T.tryout.talentKorridor(...e.talentKorridor)),
    el('div', { class: 'klein' },
      el('span', { class: 'leise', text: `${T.tryout.positionen}: ` }),
      prognoseListe(e.positionen, liga.staerke)),
    el('div', {
      class: 'leise klein', text: T.tryout.herkunft(T.tryout.massnahmen[k.herkunft]),
    }));
}

/**
 * Die fünf Werte eines Vormittags, nebeneinander, je mit Punkten — gegen den
 * Ligaschnitt **dieses** Attributs, nicht gegen die Gesamtstärke.
 * @param {Record<string, number>} attribute @param {Record<string, number>} schnittJeAttribut
 */
function athletik(attribute, schnittJeAttribut) {
  return el('div', { class: 'athletik' },
    ATHLETIK.map((a) => {
      const stufe = athletikStufe(attribute[a], schnittJeAttribut[a]);
      return el('span', {
        class: 'athletikwert',
        title: T.tryout.athletikTitel(T.attribute[a], T.tryout.athletikStufen[stufe]),
      },
        el('span', { class: 'leise klein', text: T.tryout.athletikKurz[a] }),
        el('span', {
          class: 'punkte',
          text: T.tryout.punktVoll.repeat(stufe + 1) + T.tryout.punktLeer.repeat(4 - stufe),
        }));
    }));
}

/**
 * Die drei besten Positionen, jede mit ihrer Stufe gegen den Ligaschnitt.
 *
 * Keine Spanne mehr — die stand hier einmal als „WR (noch weit weg –
 * ausbaufähig)": die untere und die obere Grenze des Scouting-Korridors,
 * jede für sich in eine Stufe übersetzt. Das war eine Bandbreite über einer
 * Bandbreite, denn jede Stufe ist selbst schon eine („Ligaschnitt" heißt
 * ±3, nicht eine Zahl). Hier zählt nur noch die Mitte.
 * @param {{ position: string, wert: number }[]} liste @param {number} liga
 */
function prognoseListe(liste, liga) {
  return liste.slice(0, 3)
    .map((p) => T.tryout.prognose(p.position, T.tryout.prognoseStufen[prognoseStufe(p.wert, liga)]))
    .join(' · ');
}

// --- Die Neuen ---------------------------------------------------------------

/**
 * Wer zugesagt hat, mit der Auswahl seiner Position — und am Ende der Knopf,
 * der sie in den Kader übernimmt.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 * @param {import('../engine/coach.js').Coach[]} stab
 */
function neueTeil(stand, aktionen, stab) {
  const neue = recruitingVon(stand).neue;
  const liga = ligaSchnitt(stand);
  const n = offeneTryoutNachricht(stand, 'tryoutZusagen');
  /** @type {string[]} */
  const nachgerueckt = (n && n.daten.nachgeruecktIds) || [];

  return el('div', { class: 'karte tryoutteil' },
    el('h2', { text: T.tryout.neueTitel(neue.length) }),
    el('div', { class: 'kandidaten' },
      neue.map((sp) => neuerKarte(sp, stand, aktionen, stab, liga, nachgerueckt))),
    el('button', {
      class: 'haupt',
      onclick: () => {
        if (n) aktionen.beantworte(n.id, 'uebernehmen');
        aktionen.zurueck();
      },
    }, T.tryout.uebernehmenKnopf));
}

/**
 * Wie viele Positionen in die ersten drei Empfehlungsstufen fallen — der Rest
 * gilt als nicht empfohlen. Eine Anzeigefrage, keine Regel: die Formeln in
 * `positionen.js` liefern eine Rangfolge, keine Schwellen, also entscheidet
 * hier, wie viele Plätze davon als welche Empfehlung zählen.
 */
const EMPFEHLUNG_TOP = 3;
const EMPFEHLUNG_POTENZIAL = 3;
const EMPFEHLUNG_UMSCHULUNG = 6;

/**
 * In welche der vier Empfehlungsstufen ein Rang fällt. `rang` ist 0-basiert,
 * 0 die beste Position.
 * @param {number} rang @returns {0|1|2|3}
 */
function empfehlungsstufe(rang) {
  if (rang < EMPFEHLUNG_TOP) return 0;
  if (rang < EMPFEHLUNG_TOP + EMPFEHLUNG_POTENZIAL) return 1;
  if (rang < EMPFEHLUNG_TOP + EMPFEHLUNG_POTENZIAL + EMPFEHLUNG_UMSCHULUNG) return 2;
  return 3;
}

/**
 * Eine Karte für einen Neuen: Positionsauswahl statt Gesprächsknopf.
 *
 * Hier wird tatsächlich entschieden, nicht nur begutachtet wie am Tryout —
 * deshalb keine Stufen mehr wie „noch weit weg", die für einen Kandidaten auf
 * dem Platz taugen, aber am Punkt der Entscheidung nur sagen, wie schlecht er
 * überall aussieht. Was hier zählt, ist die Rangfolge: die drei Positionen,
 * die der Stab tatsächlich empfehlen würde, die nächsten drei mit Potenzial,
 * der Rest als nicht empfohlen — in der Auswahl selbst als Gruppen, darunter
 * als kurze Merksätze.
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 * @param {import('../engine/coach.js').Coach[]} stab
 * @param {ReturnType<typeof ligaSchnitt>} liga
 * @param {string[]} nachgerueckt
 */
function neuerKarte(sp, stand, aktionen, stab, liga, nachgerueckt) {
  const k = { ...sp, ziel: sp.rookieZiel || sp.staerke };
  // `kandidatEinschaetzung()` liefert die Positionen schon absteigend nach
  // Prognose sortiert — Rang und Reihenfolge in der Liste sind also dasselbe.
  const e = kandidatEinschaetzung(stab, k);
  /** @type {string[][]} */
  const gruppen = [[], [], [], []];
  e.positionen.forEach((p, rang) => gruppen[empfehlungsstufe(rang)].push(p.position));

  return el('div', { class: 'kandidat' },
    el('div', { class: 'kandidatkopf' },
      el('div', { class: 'kandidatname' },
        el('strong', { text: `${sp.vorname} ${sp.nachname}` }),
        el('span', {
          class: 'leise klein',
          text: `${T.kader.alterWert(sp.alter)} · ${T.kader.koerperWert(sp.groesse, sp.gewicht)}`,
        })),
      nachgerueckt.includes(sp.id)
        ? el('span', {
          class: 'marke', title: T.tryout.nachgeruecktTitel, text: T.tryout.nachgerueckt,
        })
        : null,
      el('select', {
        'aria-label': T.tryout.position,
        onchange: (/** @type {Event} */ e2) => aktionen.setzeRookiePosition(
          sp.id, /** @type {HTMLSelectElement} */ (e2.target).value),
      }, gruppen.map((positionen, stufe) => (positionen.length === 0 ? null : el('optgroup', {
        label: T.tryout.empfehlungsstufen[stufe],
      }, positionen.map((p) => el('option', { value: p, selected: p === sp.position, text: p }))))))),
    el('div', { class: 'klein', text: T.lebenslage.satzGast(sp.lebenslage, stand.jahr) }),
    athletik(sp.attribute, liga.athletik),
    el('div', { class: 'klein' },
      el('span', { class: 'leise', text: `${T.tryout.empfehlungsstufen[0]}: ` }),
      gruppen[0].join(' · ')),
    gruppen[1].length === 0 ? null : el('div', { class: 'klein leise' },
      el('span', { text: `${T.tryout.empfehlungsstufen[1]}: ` }),
      gruppen[1].join(' · ')));
}
