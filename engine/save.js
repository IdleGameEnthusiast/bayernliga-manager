// @ts-check
/**
 * Persistence: localStorage for the working save, JSON files for backup and
 * for moving a career between PC and iPad.
 *
 * A full save is roughly 150 KB, comfortably inside the localStorage budget,
 * so this stays synchronous and simple. Browser storage is durable for an
 * installed web app but never sacred — the export is the real backup.
 *
 * Docs: docs/umbau-kalender.md, Abschnitt 6
 */

import { SAVE_VERSION, losePersonnel } from './saison.js';
import { PERSONNEL } from './aufstellung.js';
import { SPIELTAG_TAGE, tagVonSpieltag } from './kalender.js';
import { SEITEN_POSITIONEN } from './positionen.js';

export const STORAGE_KEY = 'bayernliga.save.v5';

/** Wo ein Stand von vor dem Kalender liegt. Wird gelesen, nie geschrieben. */
const STORAGE_KEY_V4 = 'bayernliga.save.v4';

/**
 * Die Tagesnummer zu einer Spieltagszahl — auch zu einer, die es als Spieltag
 * nicht gibt.
 *
 * Ein `verletztBis` aus einem v4-Stand steht regelmäßig hinter dem letzten
 * Spieltag: Spieltag 10 plus sechs Wochen ergibt 16. Dahinter zählt die
 * Umrechnung wöchentlich weiter, statt eine Ausnahme zu werfen — die Verletzung
 * läuft dann eben in die Sommerpause hinein, so wie sie es vorher auch tat.
 * @param {number} spieltag
 */
function tagFuerSpieltag(spieltag) {
  const letzter = SPIELTAG_TAGE.length;
  // Nicht `<= 1`, sondern `nicht > 1`: so fängt dieselbe Zeile auch die Zahl ab,
  // die in einer von Hand bearbeiteten Datei gar keine ist.
  if (!(spieltag > 1)) return tagVonSpieltag(1);
  if (spieltag <= letzter) return tagVonSpieltag(spieltag);
  return tagVonSpieltag(letzter) + (spieltag - letzter) * 7;
}

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
  if (!Array.isArray(stand.historie)) stand.historie = [];
  if (typeof stand.seed !== 'string') stand.seed = String(stand.seed || Date.now());

  // v4 -> v5: die Uhr läuft in Tagen statt in Spieltagen.
  //
  // Additiv, nichts wird erfunden: für jedes Feld gibt es eine ehrliche
  // Umrechnung, weil jeder Spieltag einen Termin hat. Der einzige Verlust liegt
  // beim Verlauf, siehe unten.
  //
  // `stand.tag` ist die eine Frage, die einen v4-Stand von einem v5-Stand
  // unterscheidet — und sie muss vor allem anderen gestellt werden, sonst
  // rechnet ein zweiter Durchlauf dieselben Tage ein zweites Mal um.
  const warV4 = typeof stand.tag !== 'number';
  if (warV4) {
    const spieltag = typeof stand.spieltag === 'number' ? stand.spieltag : 1;
    // Ein Stand hinter dem letzten Spieltag war eine gespielte Saison. Sein
    // Platz im Kalender ist der erste Tag der Sommerpause.
    stand.tag = spieltag > SPIELTAG_TAGE.length
      ? SPIELTAG_TAGE[SPIELTAG_TAGE.length - 1] + 1
      : tagFuerSpieltag(spieltag);

    if (Array.isArray(stand.spielplan)) {
      for (const p of stand.spielplan) {
        if (p && typeof p === 'object') p.tag = tagFuerSpieltag(p.spieltag);
      }
    }

    if (stand.kader && typeof stand.kader === 'object') {
      for (const kader of Object.values(stand.kader)) {
        if (!Array.isArray(kader)) continue;
        for (const s of kader) {
          if (!s || typeof s !== 'object') continue;
          s.verletztBis = typeof s.verletztBis === 'number' && s.verletztBis > 0
            ? tagFuerSpieltag(s.verletztBis)
            : 0;
        }
      }
    }
  }
  delete stand.spieltag;

  // Der Posteingang. Ein alter `verlauf` wird **nicht** in Nachrichten
  // übersetzt: aus einem fertigen Satz ließen sich `art` und `daten` nur durch
  // Raten zurückgewinnen. Er wandert als Liste alter Zeilen unter das Archiv
  // und stirbt mit der Zeit aus.
  if (!Array.isArray(stand.post)) stand.post = [];
  if (Array.isArray(stand.verlauf)) {
    if (stand.verlauf.length > 0) stand.altverlauf = stand.verlauf;
    delete stand.verlauf;
  }

  // Fields that arrive after v5 get their default here.

  // Die Aufstellung von Hand. Fehlt sie, hat der Manager nie eine gestellt —
  // und „keine Vorgabe" ist ein gültiger Zustand, kein Mangel. Deshalb bleibt
  // es bei v4: es gibt nichts zu retten, nur etwas nachzutragen.
  if (!stand.aufstellung || typeof stand.aufstellung !== 'object'
      || Array.isArray(stand.aufstellung)) {
    stand.aufstellung = null;
  } else {
    // Ein `null` heißt „hier soll niemand stehen". Das ist ein Zustand beim
    // Bauen, keiner zum Antreten — gespeichert wird nur eine vollständige Elf.
    // Steht trotzdem eins in der Datei, ist sie von Hand bearbeitet worden, und
    // der Platz fällt an die Automatik statt leer zu bleiben.
    stand.aufstellung = Object.fromEntries(
      Object.entries(stand.aufstellung).filter(([, id]) => typeof id === 'string'));
  }

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

  // Umbenannte Positionen und fehlende Einsätze. Ein Stand, in dem noch ein
  // `MLB` steht, beschreibt dieselbe Liga — nur mit einem Namen, den der
  // Katalog nicht mehr kennt, und ohne den fiele der Mann aus jeder Formel.
  // Das ist eine Umschrift, keine neue Version.
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

  // Einsätze gab es früher nicht. Leer ist die richtige Vergangenheit: der
  // ausgebildete Platz zählt ohnehin als eingespielt, also steht ein alter
  // Kader danach genau da, wo er vorher stand.
  if (!spieler.einsaetze || typeof spieler.einsaetze !== 'object') spieler.einsaetze = {};
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
/**
 * Den Speicherstand lesen — zuerst unter dem v5-Schlüssel, sonst unter dem
 * alten. Ein migrierter Stand wird sofort unter dem neuen Schlüssel geschrieben;
 * der alte bleibt liegen, bis der Browser ihn vergisst. Das ist Absicht: eine
 * misslungene Migration soll nicht die einzige Kopie der Karriere sein.
 * @returns {import('./saison.js').SpielStand | null}
 */
export function lade() {
  try {
    const roh = localStorage.getItem(STORAGE_KEY);
    if (roh) return migriere(JSON.parse(roh));

    const alt = localStorage.getItem(STORAGE_KEY_V4);
    if (!alt) return null;
    const stand = migriere(JSON.parse(alt));
    speichere(stand);
    return stand;
  } catch (e) {
    console.warn('Laden fehlgeschlagen', e);
    return null;
  }
}

export function gibtEsSpeicherstand() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
      || localStorage.getItem(STORAGE_KEY_V4) !== null;
  } catch {
    return false;
  }
}

export function loesche() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY_V4);
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
