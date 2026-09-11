// @ts-check
/**
 * Persistence: localStorage for the working save, JSON files for backup and
 * for moving a career between PC and iPad.
 *
 * A full save is roughly 150 KB, comfortably inside the localStorage budget,
 * so this stays synchronous and simple. Browser storage is durable for an
 * installed web app but never sacred — the export is the real backup.
 *
 * **Hier liegt der Migrationspfad.** Ein Stand mit einer älteren
 * `SAVE_VERSION` wird umgerechnet statt weggeworfen; erst wenn kein Schritt
 * mehr greift, ist Schluss. Wer die Form von `SpielStand` ändert, zählt
 * `SAVE_VERSION` hoch und legt hier einen Schritt dazu.
 */

import { SAVE_VERSION } from './saison.js';

/** Der eine Schlüssel. Alles, was anders heißt, ist Müll von vorgestern. */
export const STORAGE_KEY = 'bayernliga.save';

/**
 * Der Migrationspfad: je ein Schritt, der einen Stand **um genau eine Version**
 * hebt. Der Schlüssel ist die Nummer, von der aus gehoben wird.
 *
 * Ein Schritt darf den Stand an Ort und Stelle ändern — er arbeitet auf frisch
 * geparstem JSON, das sonst niemand in der Hand hat — und muss die neue Nummer
 * selbst eintragen. Er kennt **nur** die beiden Formen an seinen Enden, nie den
 * heutigen `SpielStand`: sonst müsste jeder alte Schritt mitwachsen, sobald die
 * Form sich wieder ändert, und genau daran gehen Migrationspfade ein.
 *
 * Kettenschritte statt Sprüngen: ein Stand aus Version 4 läuft durch 4→5, 5→6,
 * 6→7. Das kostet ein paar Zeilen mehr als eine Tabelle voller Direktwege und
 * spart, dass sie quadratisch wächst.
 *
 * Fehlt eine Nummer in dieser Tabelle, ist der Stand älter als der Pfad und
 * wird abgelehnt — laut und mit der Nummer im Text.
 * @type {Record<number, (roh: any) => any>}
 */
const MIGRATIONEN = {
  // 9 → 10: die Nachricht „Unbesetzte Plätze" mit ihrer Antwortpflicht gibt es
  // nicht mehr — die Frage stellt jetzt der Kickoff-Knopf. Ein Stand, der so
  // eine Nachricht noch trägt, verlöre sie beim Zeichnen des Postfachs, denn
  // ihren Text gibt es nicht mehr; eine offene hielte obendrein den Kalender
  // an, ohne dass irgendein Knopf sie noch beantworten könnte. Sie fliegt
  // deshalb aus der Post, gelesen oder nicht.
  9: (roh) => {
    roh.post = (roh.post || []).filter(
      (/** @type {{ art: string }} */ n) => n.art !== 'aufstellungUnvollstaendig');
    roh.version = 10;
    return roh;
  },

  // 8 → 9: der Stab kam dazu, `coaches` je Verein. Der Schritt legt nur die
  // leere Karte an — die Coaches selbst zieht `coachesVon()` beim ersten
  // Blick darauf nach, deterministisch aus dem Saatgut. Zöge der Schritt sie
  // hier, kennte er den heutigen Generator, und genau das darf ein Schritt
  // nicht: sobald der sich ändert, müsste dieser Schritt mitwachsen.
  8: (roh) => {
    roh.coaches = {};
    roh.version = 9;
    return roh;
  },

  // 7 → 8: jedes Ergebnis trägt jetzt `nichtAngetreten` — wer keine vollständige
  // Elf stellte, wird 0:36 gewertet statt gespielt. Alte Partien wurden alle
  // gespielt, und das Fehlen des Feldes heißt genau das. Der Schritt hebt
  // deshalb nur die Nummer; er ist trotzdem einer, denn ohne ihn flöge jede
  // Karriere von gestern beim Laden weg.
  7: (roh) => {
    roh.version = 8;
    return roh;
  },

  // 6 → 7: der Posteingang bekam den Ordner „Gelöscht". Bis dahin galt
  // gelesen = archiviert; jetzt entscheidet der Manager, und dafür braucht
  // jede Nachricht ein eigenes Feld. Alles Bestehende liegt im Eingang —
  // gelesen oder nicht, weggeworfen hat es niemand.
  6: (roh) => {
    for (const n of roh.post || []) n.geloescht = false;
    roh.version = 7;
    return roh;
  },
};

/**
 * Einen gelesenen Stand auf die heutige Version heben — oder ihn ablehnen.
 *
 * Danach wird nur der Stempel geprüft, nicht die Form: ein Stand, der oben aus
 * der Kette fällt, entspricht diesem Build und ist damit per Definition gültig.
 * Was dahinter schiefgeht, ist ein Fehler im Code oder in einem
 * Migrationsschritt und soll auch laut sein.
 *
 * Ein Stand aus der **Zukunft** wird nicht angefasst: rückwärts rechnet hier
 * nichts, und ein iPad, das dem PC eine Version voraus ist, ist ein Fall für
 * ein Neuladen und nicht für einen Notbehelf.
 * @param {any} roh
 * @returns {any} derselbe Stand, mit `version === SAVE_VERSION`
 * @throws wenn kein Weg von seiner Version zur heutigen führt
 */
export function migriere(roh) {
  if (!roh || typeof roh !== 'object') throw new Error('Speicherstand ist leer');
  if (typeof roh.version !== 'number') throw new Error('Speicherstand hat keine Version');
  if (roh.version > SAVE_VERSION) {
    throw new Error(`Speicherstand ist Version ${roh.version}, `
      + `dieser Build kennt nur bis ${SAVE_VERSION}`);
  }

  let stand = roh;
  while (stand.version < SAVE_VERSION) {
    const schritt = MIGRATIONEN[stand.version];
    if (!schritt) throw new Error(`Für Version ${stand.version} gibt es keinen Weg nach vorn`);
    const vorher = stand.version;
    stand = schritt(stand);
    // Ein Schritt, der die Nummer nicht hebt, ließe die Schleife ewig laufen.
    if (!stand || stand.version <= vorher) {
      throw new Error(`Der Schritt von Version ${vorher} hat nichts gehoben`);
    }
  }
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

/**
 * Den Speicherstand lesen — und unterwegs so weit nach vorn holen, wie der
 * Migrationspfad reicht. Was er nicht mehr erreicht, wird **gelöscht** statt
 * halb gerettet: ein Stand ohne Weg beschriebe eine App, die es nicht mehr
 * gibt.
 *
 * Ein migrierter Stand wird hier **nicht** zurückgeschrieben. Das erledigt der
 * nächste `speichere()` von selbst, und bis dahin liegt die alte Fassung noch
 * auf der Platte — was ein Export retten kann, wenn ein Schritt danebengreift.
 * @returns {import('./saison.js').SpielStand | null}
 */
export function lade() {
  const roh = localStorage.getItem(STORAGE_KEY);
  if (!roh) return null;
  try {
    return migriere(JSON.parse(roh));
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
  return migriere(JSON.parse(text));
}

/** @param {import('./saison.js').SpielStand} stand */
export function dateiName(stand) {
  return `bayernliga-${stand.meinTeam}-${stand.jahr}-tag${stand.tag}.json`;
}
