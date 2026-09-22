// @ts-check
/**
 * Das Gespräch: ein Blatt über der Ansicht, auf dem der Manager einem Spieler
 * etwas sagt, das er nachher zu halten hat.
 *
 * Es sieht aus wie die Rückfrage in [`frage.js`](frage.js) und ist doch etwas
 * anderes: die Rückfrage hat zwei Knöpfe und ist danach vorbei, das Gespräch
 * hat **Schritte** — erst die Kategorie, dann die Rolle, dann seine Reaktion.
 * Deshalb eine eigene Datei statt eines Schalters in der Rückfrage; die beiden
 * wachsen in verschiedene Richtungen.
 *
 * Der Zustand liegt nicht hier, sondern in `app.js`: das Blatt zeichnet, was
 * ihm gereicht wird, und meldet zurück, was angetippt wurde. Ein Modul, das
 * sich merkt, welcher Schritt gerade offen ist, überlebt sonst das Schließen
 * und geht beim nächsten Spieler an der falschen Stelle wieder auf.
 *
 * Solange Kategorien fehlten, standen sie trotzdem schon in der Liste, mit
 * einem gesperrten Knopf und dem Hinweis, dass sie kommen — eine Liste, in der
 * später ohne Ankündigung Zeilen erscheinen, liest sich wie ein anderes Spiel.
 * Mit der fünften ist das Gerüst weg. Wer eine sechste anhängt, baut es
 * wieder ein: erst ankündigen, dann liefern.
 *
 * Jede Kategorie bekommt ihren eigenen zweiten Schritt: die Rolle die Auswahl
 * der fünf Stufen, das persönliche Gespräch eine Nachfrage. Was einen Termin
 * kostet, wird nicht mit einem Tipp in einer Liste ausgelöst.
 *
 * Docs: docs/naechste-schritte.md, Block 7, Abschnitt „Gespräche"
 */

import { el } from './dom.js';
import { T } from '../i18n.js';
import { ROLLEN, rolleVon, erwarteteRolle, wiederAb } from '../engine/rolle.js';
import { zuletztGeredet, naeheAnteil } from '../engine/gespraech.js';
import { ausgesprochenerWunsch } from '../engine/wunsch.js';
import { offeneAblehnungen } from '../engine/ueberzeugen.js';
import { positionsKuerzel } from '../engine/positionen.js';

/**
 * Was gerade offen ist. `kategorie` null heißt: die Auswahl steht an.
 * `reaktion` gesetzt heißt: gesprochen ist, es steht nur noch da, wie es ankam.
 *
 * Die Reaktion trägt nur den `ton` — welche Sätze dazu gehören, entscheidet
 * die `kategorie` daneben. Ein gemeinsamer Typ über alle Kategorien müsste
 * sonst jedes Feld jeder einzelnen kennen.
 * @typedef {object} Zustand
 * @property {string} spielerId
 * @property {string | null} kategorie
 * @property {{ ton: number } | null} reaktion
 */

/**
 * @typedef {object} Aktionen
 * @property {(kategorie: string) => void} waehleKategorie
 * @property {(rolle: import('../engine/rolle.js').Rolle) => void} setzeRolle
 * @property {() => void} frageNachLage
 * @property {() => void} redePersoenlich
 * @property {() => void} frageNachWunsch
 * @property {() => void} gibNummer
 * @property {(position: string) => void} ueberzeuge
 * @property {() => void} schliesse
 */

/** Die Kategorien in der Reihenfolge des Fahrplans. */
const KATEGORIEN = ['rolle', 'lebenslage', 'persoenlich', 'wunsch', 'ueberzeugen'];

/**
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {Zustand} zustand
 * @param {number} frei Wie viele Gespräche diese Woche noch gehen
 * @param {Aktionen} aktionen
 */
export function zeigeGespraech(stand, zustand, frei, aktionen) {
  const kader = stand.kader[stand.meinTeam] || [];
  const sp = kader.find((x) => x.id === zustand.spielerId);
  // Der Mann ist weg — zurückgetreten zwischen Aufschlagen und Zeichnen. Statt
  // zu werfen, steht ein Blatt da, das man zumachen kann.
  if (!sp) return blatt(T.gespraech.fort, [], aktionen);

  const name = `${sp.vorname} ${sp.nachname}`;
  const kopf = [
    el('h2', { text: T.gespraech.titel(name) }),
    el('div', { class: 'klein leise', text: T.gespraech.unter(positionsKuerzel(sp), sp.alter) }),
  ];

  if (zustand.reaktion) {
    if (zustand.kategorie === 'wunsch') {
      return wunschReaktion(sp, name, kopf, zustand.reaktion.ton, aktionen);
    }
    if (zustand.kategorie === 'lebenslage') {
      return lebenslageReaktion(stand, sp, name, kopf, zustand.reaktion.ton, aktionen);
    }
    if (zustand.kategorie === 'ueberzeugen') {
      return blattMit(kopf, [
        el('p', { class: 'gespraech-reaktion',
          text: T.gespraech.ueberzeugenReaktionen[zustand.reaktion.ton](name) }),
      ], [
        { label: T.gespraech.schliessen, klasse: 'haupt', wirkung: aktionen.schliesse },
      ]);
    }
    const persoenlich = zustand.kategorie === 'persoenlich';
    return blattMit(kopf, [
      el('p', { class: 'gespraech-reaktion', text: persoenlich
        ? T.gespraech.persoenlichReaktionen[zustand.reaktion.ton](name)
        : T.gespraech.reaktionen[zustand.reaktion.ton](name) }),
      persoenlich ? null : el('p', { class: 'klein leise',
        text: T.gespraech.bisher(T.rolle.namen[/** @type {string} */ (sp.rolle)]) }),
    ], [
      { label: T.gespraech.schliessen, klasse: 'haupt', wirkung: aktionen.schliesse },
    ]);
  }

  if (zustand.kategorie === 'rolle') {
    return rollenSchritt(kader, sp, kopf, frei, stand.tag, aktionen);
  }

  if (zustand.kategorie === 'lebenslage') {
    return lebenslageSchritt(stand, sp, kopf, frei, aktionen);
  }

  if (zustand.kategorie === 'persoenlich') {
    return persoenlichSchritt(stand, sp, kopf, frei, aktionen);
  }

  if (zustand.kategorie === 'wunsch') {
    return wunschSchritt(sp, kopf, frei, aktionen);
  }

  if (zustand.kategorie === 'ueberzeugen') {
    return ueberzeugenSchritt(sp, kopf, frei, aktionen);
  }

  // „Überzeugen" steht nur da, wenn es etwas zu überzeugen gibt. Eine
  // Kategorie, die bei fünfundvierzig Spielern vierundvierzigmal ins Leere
  // führte, wäre eine Einladung, einen Termin auf ein Nein zu verbrauchen —
  // und die Antwort auf „hat er etwas?" gibt es schon: das Wunschgespräch.
  const sichtbar = KATEGORIEN.filter(
    (id) => id !== 'ueberzeugen' || offeneAblehnungen(sp).length > 0,
  );

  return blattMit(kopf, [
    el('p', {
      class: 'klein' + (frei > 0 ? ' leise' : ' warnung'),
      text: frei > 0 ? T.gespraech.kontingent(frei) : T.gespraech.keinKontingent,
    }),
    el('div', { class: 'gespraech-liste' },
      sichtbar.map((id) => el('button', {
        class: 'neben gespraech-kategorie',
        disabled: frei === 0 || undefined,
        onclick: () => aktionen.waehleKategorie(id),
      },
        el('span', { text: T.gespraech.kategorien[id] })))),
  ], [
    { label: T.gespraech.abbrechen, klasse: 'neben', wirkung: aktionen.schliesse },
  ]);
}

/**
 * Der zweite Schritt: die fünf Rollen, mit dem, was der Stab dazu sagt.
 *
 * Die Einschätzung steht **über** den Knöpfen und sperrt keinen davon. Sie ist
 * eine Auskunft, keine Vorgabe: wer seinem viertbesten Receiver „Starter"
 * sagt, darf das — er bekommt einen glücklichen Mann und, vier Spiele später,
 * die Rechnung.
 * @param {import('../engine/spieler.js').Spieler[]} kader
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {(HTMLElement)[]} kopf
 * @param {number} frei
 * @param {number} tag
 * @param {Aktionen} aktionen
 */
function rollenSchritt(kader, sp, kopf, frei, tag, aktionen) {
  const bisher = rolleVon(sp);
  const sperre = wiederAb(sp);
  const gesperrt = sperre !== null && sperre > tag;

  const hinweise = [
    el('p', { class: 'klein leise', text: T.gespraech.einschaetzung(
      T.rolle.namen[erwarteteRolle(kader, sp)]) }),
    el('p', { class: 'klein leise', text: bisher
      ? T.gespraech.bisher(T.rolle.namen[bisher])
      : T.gespraech.bisherKeine }),
  ];

  if (gesperrt) {
    hinweise.push(el('p', { class: 'klein warnung',
      text: T.gespraech.gesperrt(/** @type {number} */ (sperre) - tag) }));
    return blattMit(kopf, hinweise, [
      { label: T.gespraech.schliessen, klasse: 'haupt', wirkung: aktionen.schliesse },
    ]);
  }

  // Ohne Kontingent stehen die Knöpfe da und tun nichts — dann muss daneben
  // stehen, warum. Ein gesperrter Knopf ohne Grund ist eine Sackgasse.
  if (frei === 0) {
    hinweise.push(el('p', { class: 'klein warnung', text: T.gespraech.keinKontingent }));
  }
  hinweise.push(el('h3', { class: 'klein', text: T.gespraech.rolleTitel }));
  hinweise.push(el('div', { class: 'gespraech-liste' },
    ROLLEN.map((rolle) => el('button', {
      class: 'neben gespraech-kategorie' + (rolle === bisher ? ' aktuell' : ''),
      disabled: frei === 0 || undefined,
      title: T.rolle.titel(T.rolle.namen[rolle], T.rolle.erwartung[rolle]),
      onclick: () => aktionen.setzeRolle(rolle),
    },
      el('span', { text: T.rolle.namen[rolle] }),
      el('span', { class: 'klein leise', text: T.rolle.erwartung[rolle] })))));

  return blattMit(kopf, hinweise, [
    { label: T.gespraech.abbrechen, klasse: 'neben', wirkung: aktionen.schliesse },
  ]);
}

/**
 * Der zweite Schritt beim persönlichen Gespräch: eine Nachfrage, kein
 * Sofortvollzug.
 *
 * Der Knopf in der Kategorienliste verbraucht sonst einen Termin, bevor der
 * Manager erfährt, dass sie gestern schon geredet haben — und der Abstand ist
 * genau das, woran der Ertrag hängt. Er steht deshalb hier, vor dem Reden.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {(HTMLElement)[]} kopf
 * @param {number} frei
 * @param {Aktionen} aktionen
 */
function persoenlichSchritt(stand, sp, kopf, frei, aktionen) {
  const zuletzt = zuletztGeredet(stand.gespraeche, sp.id);
  const anteil = naeheAnteil(stand.gespraeche, sp.id, stand.tag);

  const inhalt = [
    el('h3', { class: 'klein', text: T.gespraech.persoenlichTitel }),
    el('p', { class: 'klein leise', text: T.gespraech.persoenlichHinweis }),
    el('p', { class: 'klein leise', text: zuletzt === null
      ? T.gespraech.persoenlichNie
      : T.gespraech.persoenlichZuletzt(stand.tag - zuletzt) }),
  ];
  if (anteil < 1) {
    inhalt.push(el('p', { class: 'klein warnung', text: T.gespraech.persoenlichFrisch }));
  }
  if (frei === 0) {
    inhalt.push(el('p', { class: 'klein warnung', text: T.gespraech.keinKontingent }));
  }

  return blattMit(kopf, inhalt, [
    { label: T.gespraech.abbrechen, klasse: 'neben', wirkung: aktionen.schliesse },
    ...(frei > 0
      ? [{ label: T.gespraech.persoenlichKnopf, klasse: 'haupt', wirkung: aktionen.redePersoenlich }]
      : []),
  ]);
}

/**
 * Der zweite Schritt beim Fragen nach der Lebenslage.
 *
 * Vorab steht da, was in der Akte steht — derselbe Satz wie im Personalreiter.
 * Das ist kein Füllwerk, sondern die halbe Kategorie: ohne den alten Stand vor
 * Augen ist die Antwort hinterher nicht als Änderung zu erkennen, und genau
 * darum geht es hier. Ein zweiter Satz daneben, der die Änderung benennt, wäre
 * die bequemere Lösung und die falsche — der Manager soll den Unterschied
 * selbst sehen, wie er ihn auch in der Akte sehen wird.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {(HTMLElement)[]} kopf
 * @param {number} frei
 * @param {Aktionen} aktionen
 */
function lebenslageSchritt(stand, sp, kopf, frei, aktionen) {
  const inhalt = [
    el('h3', { class: 'klein', text: T.gespraech.lebenslageTitel }),
    el('p', { class: 'klein leise', text: T.gespraech.lebenslageHinweis }),
    ...akteZeilen(stand, sp, T.gespraech.lebenslageAkte),
  ];
  if (frei === 0) {
    inhalt.push(el('p', { class: 'klein warnung', text: T.gespraech.keinKontingent }));
  }

  return blattMit(kopf, inhalt, [
    { label: T.gespraech.abbrechen, klasse: 'neben', wirkung: aktionen.schliesse },
    ...(frei > 0
      ? [{ label: T.gespraech.lebenslageKnopf, klasse: 'haupt', wirkung: aktionen.frageNachLage }]
      : []),
  ]);
}

/**
 * Was er erzählt hat — und darunter, was jetzt in der Akte steht.
 *
 * Der Satz wird frisch aus der Lebenslage gebaut, nicht aus der Auskunft
 * gereicht: die Engine hat sie im Gespräch eventuell geändert, und der Dialog
 * soll dasselbe zeigen wie der Personalreiter eine Sekunde später. Zwei Wege
 * zu derselben Zeile liefen irgendwann auseinander.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {string} name
 * @param {(HTMLElement)[]} kopf
 * @param {number} ton
 * @param {Aktionen} aktionen
 */
function lebenslageReaktion(stand, sp, name, kopf, ton, aktionen) {
  return blattMit(kopf, [
    el('p', { class: 'gespraech-reaktion', text: T.gespraech.lebenslageReaktionen[ton](name) }),
    ...akteZeilen(stand, sp, T.gespraech.lebenslageJetzt),
  ], [
    { label: T.gespraech.schliessen, klasse: 'haupt', wirkung: aktionen.schliesse },
  ]);
}

/**
 * Die Lebenslage in Worten, mit einer Überschrift davor. Steht zweimal im
 * Blatt — vor der Frage als Akte, danach als das, was jetzt darin steht.
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {string} titel
 */
function akteZeilen(stand, sp, titel) {
  const lage = sp.lebenslage;
  if (!lage) return [];
  return [
    el('p', { class: 'klein leise', text: titel }),
    el('p', { class: 'gespraech-wunsch', text: T.lebenslage.satz(lage, stand.jahr) }),
  ];
}

/**
 * Ein ausgesprochener Wunsch in Worten — und, bei einer Nummer, der Knopf, der
 * ihn erfüllt.
 *
 * Steht an zwei Stellen: vor dem Fragen, wenn er den Wunsch schon einmal
 * geäußert hat, und danach, wenn er ihn gerade geäußert hat. Ein Wunsch soll
 * an beiden Orten gleich aussehen — es ist derselbe Satz, nur einmal erinnert
 * und einmal frisch.
 * @param {import('../engine/wunsch.js').Wunsch} wunsch
 * @param {Aktionen} aktionen
 */
function wunschZeilen(wunsch, aktionen) {
  if (wunsch.art === 'nummer') {
    return {
      inhalt: [
        el('p', { class: 'gespraech-wunsch', text: T.gespraech.wunschNummerSatz(wunsch.nummer) }),
        el('p', { class: 'klein leise', text: T.gespraech.wunschNummerHinweis }),
      ],
      knoepfe: [{
        label: T.gespraech.wunschNummerKnopf(wunsch.nummer),
        klasse: 'haupt',
        wirkung: aktionen.gibNummer,
      }],
    };
  }
  return {
    inhalt: [
      el('p', { class: 'gespraech-wunsch', text: T.gespraech.wunschPlatzSatz(wunsch.platz) }),
      el('p', { class: 'klein leise', text: T.gespraech.wunschPlatzHinweis }),
    ],
    // Kein Knopf: einen Positionswunsch erfüllt man in der Aufstellung, nicht
    // im Gespräch. Ein „Zusagen"-Knopf hier wäre ein Versprechen, und
    // Versprechen sind verworfen — siehe Fahrplan, Block 7.
    knoepfe: [],
  };
}

/**
 * Der zweite Schritt beim Wunschgespräch.
 *
 * Zwei Fassungen, und der Unterschied ist der Termin: was er schon gesagt hat,
 * steht einfach da — nachschlagen kostet nichts. Erst das **Fragen** kostet.
 * Sonst zahlte der Manager jedes Mal aufs Neue dafür, sich an etwas zu
 * erinnern, das er längst weiß.
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {(HTMLElement)[]} kopf
 * @param {number} frei
 * @param {Aktionen} aktionen
 */
function wunschSchritt(sp, kopf, frei, aktionen) {
  const bekannt = ausgesprochenerWunsch(sp);

  if (bekannt) {
    const { inhalt, knoepfe } = wunschZeilen(bekannt, aktionen);
    return blattMit(kopf, [
      el('h3', { class: 'klein', text: T.gespraech.wunschTitel }),
      el('p', { class: 'klein leise', text: T.gespraech.wunschBekannt }),
      ...inhalt,
    ], [
      { label: T.gespraech.schliessen, klasse: knoepfe.length ? 'neben' : 'haupt',
        wirkung: aktionen.schliesse },
      ...knoepfe,
    ]);
  }

  const inhalt = [
    el('h3', { class: 'klein', text: T.gespraech.wunschTitel }),
    el('p', { class: 'klein leise', text: T.gespraech.wunschHinweis }),
  ];
  if (frei === 0) {
    inhalt.push(el('p', { class: 'klein warnung', text: T.gespraech.keinKontingent }));
  }

  return blattMit(kopf, inhalt, [
    { label: T.gespraech.abbrechen, klasse: 'neben', wirkung: aktionen.schliesse },
    ...(frei > 0
      ? [{ label: T.gespraech.wunschFragen, klasse: 'haupt', wirkung: aktionen.frageNachWunsch }]
      : []),
  ]);
}

/**
 * Der zweite Schritt beim Überzeugen: je offener Ablehnung ein Knopf.
 *
 * Meist ist es genau einer — mehrere Ablehnungen gleichzeitig setzen voraus,
 * dass der Manager denselben unzufriedenen Mann über zwei verschiedene weite
 * Wege geschickt hat. Eine Liste statt eines Knopfes, weil dieser Fall dann
 * eben vorkommt und ein Dialog, der die zweite Position verschweigt, sie
 * unerreichbar machte.
 *
 * Kein Wort darüber, wie weit er schon ist: der Fortschritt ist versteckt, und
 * das ist die Entscheidung, aus der die Kategorie ihre Spannung bezieht.
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {(HTMLElement)[]} kopf
 * @param {number} frei
 * @param {Aktionen} aktionen
 */
function ueberzeugenSchritt(sp, kopf, frei, aktionen) {
  const offen = offeneAblehnungen(sp);
  const daheim = positionsKuerzel(sp);

  const inhalt = [
    el('h3', { class: 'klein', text: T.gespraech.ueberzeugenTitel }),
    el('p', { class: 'klein leise', text: T.gespraech.ueberzeugenHinweis }),
    ...offen.map((position) => el('p', { class: 'gespraech-wunsch',
      text: T.gespraech.ueberzeugenSatz(position, daheim) })),
  ];
  if (frei === 0) {
    inhalt.push(el('p', { class: 'klein warnung', text: T.gespraech.keinKontingent }));
  }

  return blattMit(kopf, inhalt, [
    { label: T.gespraech.abbrechen, klasse: 'neben', wirkung: aktionen.schliesse },
    ...(frei > 0 ? offen.map((position) => ({
      label: T.gespraech.ueberzeugenKnopf(position),
      klasse: 'haupt',
      wirkung: () => aktionen.ueberzeuge(position),
    })) : []),
  ]);
}

/**
 * Wie das Nachfragen ausging. Der Ton kommt aus `app.js`: nichts gesagt,
 * etwas gesagt, oder die Nummer ist gerade übergeben worden.
 * @param {import('../engine/spieler.js').Spieler} sp
 * @param {string} name
 * @param {(HTMLElement)[]} kopf
 * @param {number} ton
 * @param {Aktionen} aktionen
 */
function wunschReaktion(sp, name, kopf, ton, aktionen) {
  const bekannt = ton === 1 ? ausgesprochenerWunsch(sp) : null;
  const { inhalt, knoepfe } = bekannt
    ? wunschZeilen(bekannt, aktionen)
    : { inhalt: [], knoepfe: [] };

  return blattMit(kopf, [
    el('p', { class: 'gespraech-reaktion', text: T.gespraech.wunschReaktionen[ton](name) }),
    ...inhalt,
  ], [
    { label: T.gespraech.schliessen, klasse: knoepfe.length ? 'neben' : 'haupt',
      wirkung: aktionen.schliesse },
    ...knoepfe,
  ]);
}

/**
 * Das Blatt selbst. Kein Schließen durch Danebentippen — wie bei der
 * Rückfrage: es steht da, weil etwas zu sagen ist.
 * @param {(HTMLElement)[]} kopf
 * @param {(HTMLElement|null)[]} inhalt
 * @param {{ label: string, klasse?: string, wirkung: () => void }[]} knoepfe
 */
function blattMit(kopf, inhalt, knoepfe) {
  return el('div', {
    class: 'frageschirm',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-label': T.nav.personal,
  },
    el('div', { class: 'frage gespraech' },
      el('div', { class: 'gespraech-kopf' }, kopf),
      inhalt,
      el('div', { class: 'fragenknoepfe' },
        knoepfe.map((k) => el('button', {
          class: k.klasse || 'neben',
          onclick: k.wirkung,
        }, k.label)))));
}

/** @param {string} text @param {(HTMLElement|null)[]} inhalt @param {Aktionen} aktionen */
function blatt(text, inhalt, aktionen) {
  return blattMit([el('h2', { text })], inhalt, [
    { label: T.gespraech.schliessen, klasse: 'haupt', wirkung: aktionen.schliesse },
  ]);
}
