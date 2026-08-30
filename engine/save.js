// @ts-check
/**
 * Persistence: localStorage for the working save, JSON files for backup and
 * for moving a career between PC and iPad.
 *
 * A full save is roughly 150 KB, comfortably inside the localStorage budget,
 * so this stays synchronous and simple. Browser storage is durable for an
 * installed web app but never sacred — the export is the real backup.
 */

import { SAVE_VERSION, losePersonnel } from './saison.js';
import { PERSONNEL } from './aufstellung.js';
import { SEITEN_POSITIONEN } from './positionen.js';

export const STORAGE_KEY = 'bayernliga.save.v4';

/**
 * Bring an older save up to the current shape. Every migration is additive so
 * an old file never loses data.
 * @param {any} roh
 * @returns {import('./saison.js').SpielStand}
 */
export function migriere(roh) {
  if (!roh || typeof roh !== 'object') throw new Error('Speicherstand ist leer');
  const stand = { ...roh };

  // v1 kannte acht andere Vereine, v2 eine einzige Tabelle über 22 Spieltage,
  // v3 fünf Offense-Positionen und keine Attribute. Alle drei beschreiben eine
  // Liga, die es nicht mehr gibt: aus einem v3-Kader ließe sich ein gültiger
  // v4-Kader nur durch Erfinden gewinnen. Ein solcher Stand wird abgelehnt
  // statt halb migriert.
  if (typeof stand.version === 'number' && stand.version < 4) {
    throw new Error('Dieser Speicherstand stammt aus einer älteren Liga');
  }
  if (typeof stand.version !== 'number') stand.version = SAVE_VERSION;
  if (!Array.isArray(stand.verlauf)) stand.verlauf = [];
  if (!Array.isArray(stand.historie)) stand.historie = [];
  if (typeof stand.seed !== 'string') stand.seed = String(stand.seed || Date.now());

  // Fields that arrive after v4 get their default here.

  // Taktik: fehlt sie, wird sie aus dem Saatgut nachgezogen statt geraten.
  // Derselbe Stand ergibt dieselben Systeme, also braucht das keine neue
  // Version — nur eine Regel, die zweimal dasselbe tut.
  if (!stand.personnel || typeof stand.personnel !== 'object') {
    stand.personnel = losePersonnel(stand.seed);
  }
  if (!stand.passAnteil || typeof stand.passAnteil !== 'object') stand.passAnteil = {};
  for (const [id, personnel] of Object.entries(stand.personnel)) {
    if (typeof stand.passAnteil[id] !== 'number') {
      stand.passAnteil[id] = (PERSONNEL[/** @type {string} */ (personnel)]
        || PERSONNEL['11']).passAnteil;
    }
  }

  // Umbenannte Positionen. Ein Stand, in dem noch ein `MLB` steht, beschreibt
  // dieselbe Liga — nur mit einem Namen, den der Katalog nicht mehr kennt, und
  // ohne den fiele der Mann aus jeder Formel. Das ist eine Umschrift, keine
  // neue Version.
  if (stand.kader && typeof stand.kader === 'object') {
    for (const kader of Object.values(stand.kader)) {
      if (Array.isArray(kader)) kader.forEach(benennePositionUm);
    }
  }

  stand.version = SAVE_VERSION;
  return stand;
}

/** Wie eine Position früher hieß und wie sie heute heißt. */
const ALTE_POSITIONEN = { MLB: 'MIKE' };

/**
 * Einen gespeicherten Spieler auf den heutigen Katalog bringen: der umbenannte
 * Linebacker, und die Seite, die es bei Cornerback und Receiver nicht mehr
 * gibt — sie kostete nichts und stand nur in der Anzeige herum.
 * @param {any} spieler
 */
function benennePositionUm(spieler) {
  if (!spieler || typeof spieler !== 'object') return;
  const neu = ALTE_POSITIONEN[spieler.position];
  if (neu) spieler.position = neu;
  if (spieler.seite && !SEITEN_POSITIONEN.includes(spieler.position)) spieler.seite = null;
}

/** @param {import('./saison.js').SpielStand} stand */
export function speichere(stand) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stand));
    return true;
  } catch (e) {
    console.warn('Speichern fehlgeschlagen', e);
    return false;
  }
}

/** @returns {import('./saison.js').SpielStand | null} */
export function lade() {
  try {
    const roh = localStorage.getItem(STORAGE_KEY);
    if (!roh) return null;
    return migriere(JSON.parse(roh));
  } catch (e) {
    console.warn('Laden fehlgeschlagen', e);
    return null;
  }
}

export function gibtEsSpeicherstand() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function loesche() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* nichts zu tun */ }
}

/**
 * The save as a downloadable file.
 * @param {import('./saison.js').SpielStand} stand
 */
export function exportiere(stand) {
  return JSON.stringify(stand, null, 2);
}

/**
 * @param {string} text
 * @returns {import('./saison.js').SpielStand}
 */
export function importiere(text) {
  return migriere(JSON.parse(text));
}

/** @param {import('./saison.js').SpielStand} stand */
export function dateiName(stand) {
  return `bayernliga-${stand.meinTeam}-${stand.jahr}-st${stand.spieltag}.json`;
}
