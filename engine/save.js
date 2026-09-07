// @ts-check
/**
 * Persistence: localStorage for the working save, JSON files for backup and
 * for moving a career between PC and iPad.
 *
 * A full save is roughly 150 KB, comfortably inside the localStorage budget,
 * so this stays synchronous and simple. Browser storage is durable for an
 * installed web app but never sacred — the export is the real backup.
 *
 * **Es gibt keinen Migrationspfad.** Bis zum Livegang wird auf alte Stände
 * keine Rücksicht genommen: `SAVE_VERSION` ist ein Stempel, kein Weg. Passt er
 * nicht, wird der Stand weggeworfen statt umgerechnet — siehe CLAUDE.md.
 */

import { SAVE_VERSION } from './saison.js';

/** Der eine Schlüssel. Alles, was anders heißt, ist Müll von vorgestern. */
export const STORAGE_KEY = 'bayernliga.save';

/**
 * Einen gelesenen Stand annehmen oder ablehnen.
 *
 * Geprüft wird nur der Stempel, nicht die Form: ein Stand mit der richtigen
 * Nummer stammt aus diesem Build und ist damit per Definition gültig. Was
 * dahinter schiefgeht, ist ein Fehler im Code und soll auch laut sein.
 * @param {any} roh
 * @returns {import('./saison.js').SpielStand}
 */
function nimmAn(roh) {
  if (!roh || typeof roh !== 'object') throw new Error('Speicherstand ist leer');
  if (roh.version !== SAVE_VERSION) {
    throw new Error(`Speicherstand ist Version ${roh.version}, gebraucht wird ${SAVE_VERSION}`);
  }
  return roh;
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

/**
 * Den Speicherstand lesen. Ein Stand aus einem älteren Build wird **gelöscht**
 * und nicht gerettet: er beschriebe eine App, die es nicht mehr gibt, und ein
 * halb passender Stand kostet mehr Zeit als eine neue Karriere.
 * @returns {import('./saison.js').SpielStand | null}
 */
export function lade() {
  const roh = localStorage.getItem(STORAGE_KEY);
  if (!roh) return null;
  try {
    return nimmAn(JSON.parse(roh));
  } catch (e) {
    console.warn('Speicherstand verworfen', e);
    loesche();
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

/**
 * Alles wegräumen, was diese App je abgelegt hat — auch die Schlüssel früherer
 * Builds (`bayernliga.save.v5` und so weiter). Die liest niemand mehr, also
 * haben sie auch keinen Grund, im Speicher des Browsers liegen zu bleiben.
 */
export function loesche() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key === STORAGE_KEY || key.startsWith(`${STORAGE_KEY}.`)) {
        localStorage.removeItem(key);
      }
    }
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
  return nimmAn(JSON.parse(text));
}

/** @param {import('./saison.js').SpielStand} stand */
export function dateiName(stand) {
  return `bayernliga-${stand.meinTeam}-${stand.jahr}-tag${stand.tag}.json`;
}
