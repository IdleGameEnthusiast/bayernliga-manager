// @ts-check
/**
 * Persistence: localStorage for the working save, JSON files for backup and
 * for moving a career between PC and iPad.
 *
 * A full save is roughly 150 KB, comfortably inside the localStorage budget,
 * so this stays synchronous and simple. Browser storage is durable for an
 * installed web app but never sacred — the export is the real backup.
 */

import { SAVE_VERSION } from './saison.js';

export const STORAGE_KEY = 'bayernliga.save.v1';

/**
 * Bring an older save up to the current shape. Every migration is additive so
 * an old file never loses data.
 * @param {any} roh
 * @returns {import('./saison.js').SpielStand}
 */
export function migriere(roh) {
  if (!roh || typeof roh !== 'object') throw new Error('Speicherstand ist leer');
  const stand = { ...roh };

  if (typeof stand.version !== 'number') stand.version = 1;
  if (!Array.isArray(stand.verlauf)) stand.verlauf = [];
  if (!Array.isArray(stand.historie)) stand.historie = [];
  if (typeof stand.seed !== 'string') stand.seed = String(stand.seed || Date.now());

  // Fields that arrived after v1 would be defaulted here.

  stand.version = SAVE_VERSION;
  return stand;
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
