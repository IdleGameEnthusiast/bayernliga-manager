// @ts-check
/**
 * Das Bracket als Bild statt als Liste.
 *
 * Vorher standen hier drei Zeilen — zwei Halbfinale und ein Finale, untereinander
 * wie jeder andere Spieltag. Damit war das Einzige nicht zu sehen, was ein
 * Bracket überhaupt zeigen soll: dass der Zweite einer Gruppe den Sieger der
 * anderen bekommt, dass beide Sieger in dieselbe Partie laufen, und dass an
 * deren Ende der Meister steht.
 *
 * Es steht auch dann da, wenn noch nichts ausgelost ist. Die vier
 * Halbfinalplätze tragen dann ihre Setzung — „1. Nord", „2. Süd" — und, sobald
 * die Gruppenrunde läuft, das Kürzel des Vereins, der den Platz gerade hält.
 * Die Ansicht beantwortet damit schon am fünften Spieltag die Frage, für die
 * man vorher zwei Tabellen im Kopf kreuzen musste: auf wen liefe das gerade
 * hinaus.
 *
 * Die Setzung selbst kommt aus `HALBFINAL_SETZUNG` — derselben Liste, aus der
 * `macheHalbfinale()` die Partien baut. Hier wird beschriftet, nicht entschieden.
 */

import { el, farbtupfer } from './dom.js';
import { T } from '../i18n.js';
import { teamById } from '../engine/content.js';
import { HALBFINAL_SETZUNG, sieger } from '../engine/spielplan.js';

/** @typedef {import('../engine/spielplan.js').Partie} Partie */
/** @typedef {import('../engine/spielplan.js').Setzung} Setzung */
/** @typedef {{ gruppe: 'nord'|'sued', zeilen: import('../engine/tabelle.js').TabellenZeile[] }} Gruppe */

/**
 * @param {Partie[]} playoffs  Halbfinale und Finale, in dieser Reihenfolge; darf leer sein
 * @param {Gruppe[]} gruppen   die aktuellen Gruppentabellen, für die offenen Plätze
 * @param {string} meinTeam
 */
export function zeigeBracket(playoffs, gruppen, meinTeam) {
  const halbfinale = playoffs.filter((p) => p.runde === 'halbfinale');
  const finale = playoffs.find((p) => p.runde === 'finale') || null;

  return el('div', { class: 'bracket' },
    spalte('halbfinale', T.runde.halbfinale,
      HALBFINAL_SETZUNG.map((s, i) => halbfinalPaar(halbfinale[i] || null, s, gruppen, meinTeam))),
    spalte('finale', T.runde.finale, [finalPaar(finale, halbfinale, meinTeam)]),
    spalte('meister', T.playoffs.meister, [meisterPaar(finale, meinTeam)]));
}

/**
 * Eine Spalte des Brackets: Überschrift oben, die Kästen mittig dazwischen.
 * Die Mitte ist es, die die Verbinder treffen können — deshalb zentriert die
 * Runde ihren Inhalt, statt ihn oben anzuheften.
 * @param {string} klasse
 * @param {string} titel
 * @param {HTMLElement[]} kaesten
 */
function spalte(klasse, titel, kaesten) {
  return el('div', { class: 'bracket-spalte' },
    el('h3', { class: 'bracket-titel', text: titel }),
    el('div', { class: `bracket-runde ${klasse}` }, kaesten));
}

/**
 * @param {Partie|null} partie
 * @param {{ heim: Setzung, gast: Setzung }} setzung
 * @param {Gruppe[]} gruppen
 * @param {string} meinTeam
 */
function halbfinalPaar(partie, setzung, gruppen, meinTeam) {
  const seiten = partie
    ? [seite(partie.heim, partie, meinTeam, true), seite(partie.gast, partie, meinTeam, false)]
    : [platzhalter(setzung.heim, gruppen), platzhalter(setzung.gast, gruppen)];
  return el('div', { class: 'bracket-paar' }, seiten);
}

/**
 * Das Finale, in der Reihenfolge der Halbfinale — oberer Sieger oben. Nicht
 * nach Heimrecht: das hängt an der Bilanz, und sobald es beim Sieger des
 * unteren Halbfinales liegt, kreuzten sich die Linien.
 * @param {Partie|null} finale
 * @param {Partie[]} halbfinale
 * @param {string} meinTeam
 */
function finalPaar(finale, halbfinale, meinTeam) {
  if (!finale) {
    return el('div', { class: 'bracket-paar' },
      offeneSeite(T.playoffs.siegerHalbfinale),
      offeneSeite(T.playoffs.siegerHalbfinale));
  }
  const ausDenHalbfinals = halbfinale.map((hf) => sieger(hf)).filter(Boolean);
  const ids = ausDenHalbfinals.length === 2 ? ausDenHalbfinals : [finale.heim, finale.gast];

  return el('div', { class: 'bracket-paar' },
    ids.map((id) => seite(/** @type {string} */ (id), finale, meinTeam, id === finale.heim)));
}

/** @param {Partie|null} finale @param {string} meinTeam */
function meisterPaar(finale, meinTeam) {
  const id = finale ? sieger(finale) : null;
  if (!id) return el('div', { class: 'bracket-paar' }, offeneSeite(T.playoffs.meisterOffen));

  const t = teamById(id);
  const klassen = ['bracket-seite', 'sieger', id === meinTeam ? 'meins' : ''].filter(Boolean);
  return el('div', { class: 'bracket-paar' },
    el('div', { class: klassen.join(' ') },
      farbtupfer(t),
      el('span', { class: 'bracket-name', text: t.name })));
}

/**
 * Ein Verein in einer Partie, mit seinen eigenen Punkten — nicht mit denen
 * seiner Spalte. Im Finale steht oben, wer aus dem oberen Halbfinale kommt,
 * und das ist nicht zwingend die Heimmannschaft.
 * @param {string} teamId
 * @param {Partie} partie
 * @param {string} meinTeam
 * @param {boolean} istHeim
 */
function seite(teamId, partie, meinTeam, istHeim) {
  const t = teamById(teamId);
  const gespielt = Boolean(partie.ergebnis);
  const klassen = [
    'bracket-seite',
    gespielt ? (sieger(partie) === teamId ? 'sieger' : 'raus') : '',
    teamId === meinTeam ? 'meins' : '',
  ].filter(Boolean);

  return el('div', { class: klassen.join(' ') },
    farbtupfer(t),
    el('span', { class: 'bracket-name', text: t.name }),
    istHeim
      ? el('span', { class: 'bracket-heim', title: T.playoffs.heimrecht, text: T.playoffs.heimZeichen })
      : null,
    el('span', { class: 'bracket-punkte', text: gespielt ? String(punkteVon(partie, teamId)) : '–' }));
}

/**
 * Ein Halbfinalplatz, der noch niemandem gehört: seine Setzung, und dahinter
 * der Verein, der ihn gerade hält.
 * @param {Setzung} setzung
 * @param {Gruppe[]} gruppen
 */
function platzhalter(setzung, gruppen) {
  const gruppe = gruppen.find((g) => g.gruppe === setzung.gruppe);
  const zeile = gruppe ? gruppe.zeilen[setzung.platz - 1] : null;
  // Vor dem ersten Spieltag steht die Tabelle nur in irgendeiner Reihenfolge da.
  // Wer dann „Erster" ist, hat dafür nichts getan, und die Auskunft wäre gelogen.
  const gespielt = Boolean(gruppe && gruppe.zeilen[0].spiele > 0);
  const halter = gespielt && zeile ? teamById(zeile.teamId) : null;

  return offeneSeite(
    T.playoffs.setzplatz(setzung.platz, T.gruppenKurz[setzung.gruppe]),
    halter ? halter.kurz : null);
}

/** @param {string} text @param {string|null} [halter] */
function offeneSeite(text, halter) {
  return el('div', { class: 'bracket-seite offen' },
    el('span', { class: 'farbtupfer leer' }),
    el('span', { class: 'bracket-name', text }),
    halter ? el('span', { class: 'bracket-halter leise klein', text: halter }) : null);
}

/** @param {Partie} p @param {string} teamId */
function punkteVon(p, teamId) {
  if (!p.ergebnis) return '–';
  return p.heim === teamId ? p.ergebnis.heimPunkte : p.ergebnis.gastPunkte;
}
