// @ts-check
/**
 * Der Migrationspfad: was `save.js` mit einem Stand macht, der aus einem
 * älteren Build stammt.
 *
 * Geprüft wird über `importiere()` statt über `lade()` — der `localStorage`
 * gehört dem Browser, und der Rauchtest unter `tests/smoke/speicherstand.html`
 * ist der Ort, an dem er vorkommt.
 *
 * Ein alter Stand wird hier **nicht von Hand geschrieben**: er entsteht aus
 * einem echten, dem die Felder wieder weggenommen werden, die es damals noch
 * nicht gab. Von Hand wäre er nur so falsch, wie ich ihn mir vorstelle.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { neuesSpiel, SAVE_VERSION } from '../engine/saison.js';
import { migriere, exportiere, importiere } from '../engine/save.js';

/** Ein loser Abzug eines frischen Standes. @param {string} seed */
function abzug(seed) {
  return JSON.parse(exportiere(neuesSpiel('heg', seed)));
}

test('ein Stand mit der heutigen Nummer geht unverändert durch', () => {
  const stand = abzug('heute');
  const vorher = JSON.stringify(stand);
  assert.equal(migriere(stand).version, SAVE_VERSION);
  assert.equal(JSON.stringify(stand), vorher, 'ein Schritt hat sich eingemischt');
});

test('ein Stand aus Version 6 bekommt seinen Papierkorb', () => {
  // Version 6 kannte kein `geloescht`: gelesen war archiviert. Der Schritt
  // legt alles, was da ist, in den Posteingang — weggeworfen hat es niemand.
  const alt = abzug('sechs');
  alt.version = 6;
  for (const n of alt.post) delete n.geloescht;
  assert.ok(alt.post.length > 0, 'der Abzug trägt überhaupt Post');

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  for (const n of neu.post) {
    assert.equal(n.geloescht, false, `${n.id} liegt nicht im Eingang`);
  }
});

test('ein Stand aus Version 7 überlebt die Wertung', () => {
  // Version 7 kannte kein `nichtAngetreten`: jedes Spiel wurde gespielt. Der
  // Schritt hebt nur die Nummer — das Fehlen des Feldes heißt genau das, was es
  // heißen soll. Ohne ihn flöge jede Karriere von gestern beim Laden weg.
  const alt = abzug('sieben');
  alt.version = 7;

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  assert.deepEqual(neu.spielplan.length, alt.spielplan.length);
});

test('ein Stand aus der Zukunft wird abgelehnt', () => {
  // Rückwärts rechnet hier nichts. Ein iPad, das dem PC eine Version voraus
  // ist, braucht ein Neuladen und keinen Notbehelf.
  const stand = abzug('zukunft');
  stand.version = SAVE_VERSION + 1;
  assert.throws(() => migriere(stand), /Version/);
});

test('eine Nummer ohne Schritt wird abgelehnt statt halb gerettet', () => {
  const stand = abzug('kein-weg');
  stand.version = 1;
  assert.throws(() => migriere(stand), /Version 1/);
});

test('was gar kein Stand ist, fliegt vorher raus', () => {
  assert.throws(() => migriere(null), /leer/);
  assert.throws(() => migriere('bayernliga'), /leer/);
  assert.throws(() => migriere({}), /Version/);
  assert.throws(() => importiere('null'), /leer/);
});
