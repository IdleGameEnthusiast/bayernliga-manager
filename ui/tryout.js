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
 * Gezeigt wird in Stufen und Korridoren, nie in nackten Zahlen: die Athletik
 * gegen den Ligaschnitt je Attribut, Talent und Prognose als Spanne, die sich
 * mit der Scouting-Qualität des Stabs verengt, das Interesse als Stufe. Was
 * das bedeutet, entscheidet `engine/recruiting.js`; hier wird nur benannt.
 */

import { el, tabelle } from './dom.js';
import { T } from '../i18n.js';
import { POSITIONS } from '../engine/constants.js';
import { hauptPosition } from '../engine/positionen.js';
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
 * @param {Aktionen} aktionen
 */
export function zeigeTryoutScreen(stand, aktionen) {
  const r = recruitingVon(stand);
  const stab = coachesVon(stand, stand.meinTeam);

  const inhalt = r.tryout ? kandidatenTeil(stand, aktionen, stab)
    : r.neue.length > 0 ? neueTeil(stand, aktionen, stab)
      : el('p', { class: 'leise klein', text: T.tryout.nichtsMehr });

  return el('div', { class: 'tryoutscreen' },
    eigenerKaderTeil(stand),
    inhalt,
    el('div', { class: 'fuss' },
      el('button', { class: 'neben', onclick: aktionen.zurueck }, T.tryout.zurueckKnopf)));
}

/**
 * Der eigene Kader, je Position: wie viele stehen da, wie stark sind sie im
 * Schnitt, und wer ist der Beste. Zum Vergleich neben den Kandidaten — eine
 * Lücke in der Line fällt hier auf, bevor der erste Name gelesen ist.
 * @param {import('../engine/saison.js').SpielStand} stand
 */
function eigenerKaderTeil(stand) {
  const kader = stand.kader[stand.meinTeam] || [];
  const zeilen = POSITIONS.map((position) => {
    const hier = kader.filter((sp) => hauptPosition(sp) === position);
    const leer = hier.length === 0;
    const schnitt = leer ? null : hier.reduce((a, sp) => a + sp.staerke, 0) / hier.length;
    const bester = leer ? null : Math.max(...hier.map((sp) => sp.staerke));
    return el('tr', { class: leer ? 'tryout-luecke' : '' },
      el('td', { text: position }),
      el('td', { class: 'leise', text: String(hier.length) }),
      el('td', { class: 'leise', text: schnitt === null ? T.roster.ohneZahl : String(Math.round(schnitt)) }),
      el('td', { class: 'leise', text: bester === null ? T.roster.ohneZahl : String(bester) }));
  });
  return el('div', { class: 'karte tryout-kader' },
    el('h2', { text: T.tryout.eigenerKader }),
    el('p', { class: 'leise klein', text: T.tryout.eigenerKaderHinweis }),
    tabelle([T.tryout.spalte.position, T.tryout.spalte.anzahl, T.tryout.spalte.schnitt, T.tryout.spalte.bester],
      zeilen));
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
    el('h2', { text: T.tryout.kandidatenTitel(tryout.kandidaten.length) }),
    el('p', {
      class: 'klein',
      text: tryout.abgeschlossen ? T.tryout.abgeschlossen : T.tryout.gespraecheFrei(frei),
    }),
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
      prognoseKorridorText(e.positionen, liga.staerke)),
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
 * Die drei besten Positionen, jede mit der Spanne, in der die Prognose liegen
 * könnte — schmal bei gutem Scouting, breit ohne.
 * @param {{ position: string, korridor: [number, number] }[]} liste @param {number} liga
 */
function prognoseKorridorText(liste, liga) {
  return liste.slice(0, 3).map((p) => {
    const von = T.tryout.prognoseStufen[prognoseStufe(p.korridor[0], liga)];
    const bis = T.tryout.prognoseStufen[prognoseStufe(p.korridor[1], liga)];
    return T.tryout.prognoseSpanne(p.position, von, bis);
  }).join(' · ');
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
 * Eine Karte für einen Neuen: Positionsauswahl statt Gesprächsknopf.
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Aktionen} aktionen
 * @param {import('../engine/coach.js').Coach[]} stab
 * @param {ReturnType<typeof ligaSchnitt>} liga
 * @param {string[]} nachgerueckt
 */
function neuerKarte(sp, stand, aktionen, stab, liga, nachgerueckt) {
  const k = { ...sp, ziel: sp.rookieZiel || sp.staerke };
  const e = kandidatEinschaetzung(stab, k);
  const wertJePosition = Object.fromEntries(e.positionen.map((p) => [p.position, p.wert]));

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
      }, POSITIONS.map((p) => el('option', {
        value: p,
        selected: p === sp.position,
        text: T.tryout.prognose(p, T.tryout.prognoseStufen[prognoseStufe(wertJePosition[p], liga.staerke)]),
      })))),
    el('div', { class: 'klein', text: T.lebenslage.satzGast(sp.lebenslage, stand.jahr) }),
    athletik(sp.attribute, liga.athletik),
    el('div', { class: 'klein' },
      el('span', { class: 'leise', text: `${T.tryout.vorschlag}: ` }),
      prognoseKorridorText(e.positionen, liga.staerke)));
}
