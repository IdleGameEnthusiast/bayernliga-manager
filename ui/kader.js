// @ts-check
/**
 * Der Roster: drei Bereiche, in jedem links die Verfügbaren und rechts die
 * Plätze — Offense, Defense, Special Teams.
 *
 * Vorher stand hier alles übereinander: die Mannschaftsteile, beide Elfen
 * nebeneinander, und darunter der ganze Kader als sortierbare Tabelle. Das war
 * eine Ansicht mit zwei Aufgaben, und die zweite (wen haben wir überhaupt) ist
 * in den Reiter **Personal** umgezogen. Was hier bleibt, ist eine Handlung:
 * wer steht wo.
 *
 * Die Bereiche sind nach Einheiten geschnitten, die Auswahl ist es nicht. Ein
 * Offensivspieler darf in der Defense stehen und umgekehrt — die Liste links
 * zeigt per Voreinstellung die Einheit, der Schalter „Alle" hebt die Grenze
 * auf. Ohne ihn wäre der Schnitt eine Regel, und er ist nur eine Sortierung.
 *
 * Der zweite Schalter, „Starter", nimmt die Aufgestellten wieder in die Liste.
 * Er ist der einzige Weg zum Doppeleinsatz von Hand: ohne ihn stünden dort nur
 * Leute, die noch nirgends stehen, und der Notnagel wäre nicht mehr greifbar.
 *
 * Entscheidet keine Regel. Was ein Wechsel kostet und wer dabei wohin rutscht,
 * sagt die Engine.
 */

import { el } from './dom.js';
import { T } from '../i18n.js';
import {
  teamStaerken, gesamtStaerke, angriffStaerke, verteidigungStaerke, verletzte,
} from '../engine/team.js';
import { istFit } from '../engine/spieler.js';
import { GRUPPE_JE_POSITION, EINHEIT_JE_GRUPPE } from '../engine/constants.js';
import { hauptPosition } from '../engine/positionen.js';
import { wertAuf, vollstaendig, SPECIAL_PLAETZE, SPECIAL_WERT } from '../engine/aufstellung.js';
import { personnelVon, passAnteilVon, aufstellungVon } from '../engine/saison.js';
import {
  einheitBereich, specialBereich, wechselLeiste, aktionsknoepfe, hinweisText, hinweisKlasse,
} from './aufstellung.js';

/**
 * Der angefangene Wechsel: der Platz, der neu besetzt werden soll, **oder** der
 * Mann, der vorgemerkt ist. Nie beides — der zweite Tipp setzt ein und räumt
 * die Auswahl gleich wieder ab.
 *
 * Beides lebt im Modul, damit es eine Neuzeichnung überlebt: die Auswahl ist
 * eine Absicht des Managers, kein Zustand des Spielstands, und hat deshalb im
 * Speicherstand nichts zu suchen.
 * @type {{ platz: string | null, spieler: string | null }}
 */
let auswahl = { platz: null, spieler: null };

const nichtsGewaehlt = () => { auswahl = { platz: null, spieler: null }; };

/**
 * Ob die Liste links auch die zeigt, die schon in der Elf stehen. Standard ist
 * nein: die Frage an dieser Stelle ist fast immer „wer von denen, die **nicht**
 * stehen", und die Aufgestellten stünden sonst als erste dort, weil sie die
 * Stärksten sind.
 */
let starterZeigen = false;

/** Ob die Liste links über die Einheit des Bereichs hinausgeht. */
let alleZeigen = false;

/** Wie viele Namen die Liste links höchstens zeigt. */
const HOECHSTENS = 40;

/**
 * @param {import('../engine/saison.js').SpielStand} stand
 * @param {{ vorgabe: import('../engine/aufstellung.js').Vorgabe | null } | null} entwurf
 * @param {{ setze: (schluessel: string, spielerId: string) => void,
 *           automatisch: () => void, entferne: (spielerId: string) => void,
 *           loese: (schluessel: string) => void,
 *           leeren: () => void, speichern: () => boolean, verwerfen: () => void,
 *           neuZeichnen: () => void }} aktionen
 */
export function zeigeKader(stand, entwurf, aktionen) {
  const kader = stand.kader[stand.meinTeam];
  const tag = stand.tag;
  const personnel = personnelVon(stand, stand.meinTeam);
  const anteil = passAnteilVon(stand, stand.meinTeam);

  // Der Entwurf schlägt den Stand: die Ansicht zeigt, was gälte, wenn der
  // Manager jetzt speichert — Mannschaftsteile eingerechnet.
  const vorgabe = entwurf ? entwurf.vorgabe : aufstellungVon(stand, stand.meinTeam);

  const s = teamStaerken(kader, tag, personnel, anteil, vorgabe);
  const a = s.aufstellung;
  const verletzt = verletzte(kader, tag);

  // Ein Platz, den es nicht mehr gibt — der Manager hat zwischendurch das
  // System gewechselt. Ohne diese Zeile bliebe die Ansicht im Auswahlmodus
  // stehen, ohne Leiste, die ihn wieder herausließe.
  const plaetze = [...a.offense, ...a.defense];
  if (auswahl.platz
    && !plaetze.some((p) => p.schluessel === auswahl.platz)
    && !SPECIAL_PLAETZE.includes(auswahl.platz)) nichtsGewaehlt();

  // Wer steht, steht wo. Die Special Teams zählen dabei **nicht** als Stehen:
  // sie laufen außerhalb der Elf, und wer nur kickt, ist für die Aufstellung
  // weiterhin zu haben.
  /** @type {Set<string>} */
  const stehen = new Set();
  for (const p of plaetze) if (p.spieler) stehen.add(p.spieler.id);

  const gewaehlterSpieler = kader.find((sp) => sp.id === auswahl.spieler) || null;

  /** @type {import('./aufstellung.js').Steuerung} */
  const steuerung = {
    platz: auswahl.platz,
    spieler: auswahl.spieler,
    vonHand: !!vorgabe,
    veraendert: !!entwurf,
    vollstaendig: vollstaendig(a),
    speichern: () => { aktionen.speichern(); },
    verwerfen: aktionen.verwerfen,
    entferne: (spielerId) => {
      nichtsGewaehlt();
      aktionen.entferne(spielerId);
    },
    loese: (schluessel) => {
      nichtsGewaehlt();
      aktionen.loese(schluessel);
    },
    leeren: () => {
      nichtsGewaehlt();
      aktionen.leeren();
    },
    wertFuer: (platz) => (gewaehlterSpieler ? wertVon(gewaehlterSpieler, platz, anteil) : 0),
    gewaehlterName: gewaehlterSpieler ? gewaehlterSpieler.nachname : '',
    waehlePlatz: (schluessel) => {
      auswahl = { platz: schluessel, spieler: null };
      aktionen.neuZeichnen();
    },
    waehleSpieler: (id) => {
      auswahl = { platz: null, spieler: id };
      aktionen.neuZeichnen();
    },
    setze: (schluessel, spielerId) => {
      nichtsGewaehlt();
      aktionen.setze(schluessel, spielerId);
    },
    automatisch: () => {
      nichtsGewaehlt();
      aktionen.automatisch();
    },
    starterZeigen,
    zeigeStarter: (an) => {
      starterZeigen = an;
      aktionen.neuZeichnen();
    },
    alleZeigen,
    zeigeAlle: (an) => {
      alleZeigen = an;
      aktionen.neuZeichnen();
    },
  };

  /** Die Liste links für einen der drei Bereiche.
   * @param {'offense'|'defense'|'special'} bereich */
  const verfuegbare = (bereich) => liste(kader, tag, stehen, bereich, anteil, auswahl.platz);

  return el('div', {},
    wechselLeiste(a, steuerung, gewaehlterSpieler),
    el('div', { class: 'karte rosterkopf' },
      el('div', { class: 'kartenkopf' },
        el('h2', { text: T.nav.kader }),
        aktionsknoepfe(steuerung)),
      el('p', { class: hinweisKlasse(steuerung), style: { margin: '0' } },
        hinweisText(steuerung, a)),
      el('p', { class: 'klein', style: { margin: '8px 0 0' } },
        el('strong', { text: `${T.kader.gesamt}: ${gesamtStaerke(s)}` }),
        verletzt.length > 0
          ? el('span', { class: 'verletzt', text: `  ·  ${verletzt.length} ${T.kader.verletzt}` })
          : el('span', { class: 'leise', text: `  ·  ${T.kader.keineVerletzungen}` }))),
    einheitBereich(T.kader.angriff, a.offense, verfuegbare('offense'),
      steuerung, angriffStaerke(s), a),
    einheitBereich(T.kader.verteidigung, a.defense, verfuegbare('defense'),
      steuerung, verteidigungStaerke(s), a),
    specialBereich(a, verfuegbare('special'), steuerung, s.special));
}

/**
 * Was ein Mann auf einem Platz wert wäre — für die zweiundzwanzig die Eignung,
 * für die drei Special-Teams-Plätze ihre eigene Formel. Beide Zahlen kommen aus
 * der Engine; hier steht nur, welche gerade gemeint ist.
 * @param {import('../engine/spieler.js').Spieler} spieler
 * @param {string} platz Platzname oder Special-Teams-Schlüssel
 * @param {number} anteil
 */
function wertVon(spieler, platz, anteil) {
  return SPECIAL_WERT[platz] ? SPECIAL_WERT[platz](spieler) : wertAuf(spieler, platz, anteil);
}

/**
 * Wer links steht, und in welcher Reihenfolge.
 *
 * Ist ein Platz gewählt, sortiert die Liste nach dem, was jeder **dort**
 * brächte — das ist die Frage, die offen ist. Sonst nach Stärke, denn ohne
 * Platz gibt es keine bessere.
 *
 * Der Einheitenfilter greift bei den Special Teams nicht: gekickt wird aus dem
 * ganzen Kader, und eine Vorauswahl nach Offense oder Defense hätte dort keine
 * Bedeutung.
 * @param {import('../engine/spieler.js').Spieler[]} kader
 * @param {number} tag
 * @param {Set<string>} stehen Wer in der Elf steht
 * @param {'offense'|'defense'|'special'} bereich
 * @param {number} anteil
 * @param {string | null} platz Der gewählte Platz, falls einer gewählt ist
 * @returns {import('./aufstellung.js').Kandidat[]}
 */
function liste(kader, tag, stehen, bereich, anteil, platz) {
  const passt = (/** @type {import('../engine/spieler.js').Spieler} */ sp) => {
    if (!istFit(sp, tag)) return false;
    // Bei den Special Teams filtert nichts. Gekickt wird aus der Elf heraus —
    // wer die beiden Filter hier anlegte, nähme dem Manager ausgerechnet die
    // Männer weg, die den Platz in aller Regel bekommen.
    if (bereich === 'special') return true;
    if (!starterZeigen && stehen.has(sp.id)) return false;
    if (alleZeigen) return true;
    return EINHEIT_JE_GRUPPE[GRUPPE_JE_POSITION[hauptPosition(sp)]] === bereich;
  };

  // Ein gewählter Platz sortiert die Liste; ein Platz aus einem *anderen*
  // Bereich tut es nicht. Sonst stünde die Offense-Liste nach Punterwerten
  // sortiert da, während der Manager im Special-Bereich arbeitet.
  const eigener = platz && (bereich === 'special') === !!SPECIAL_WERT[platz] ? platz : null;

  return kader
    .filter(passt)
    .map((spieler) => ({
      spieler,
      wert: eigener ? wertVon(spieler, eigener, anteil) : spieler.staerke,
    }))
    .sort((x, y) => y.wert - x.wert)
    .slice(0, HOECHSTENS);
}
