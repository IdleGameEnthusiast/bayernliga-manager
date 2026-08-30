// @ts-check
/**
 * Der Service Worker hält die App offline lauffähig — aber nur, solange seine
 * `SHELL` wirklich alles nennt.
 *
 * Diese Liste kann nicht auffallen, wenn sie unvollständig ist: `index.html`
 * lädt nur `app.js`, den Rest zieht der Modulgraph nach, und online holt der
 * Netz-zuerst-Handler jede fehlende Datei kommentarlos. Erst offline startet
 * die App dann nicht. Also vergleicht der Test die Liste mit der Platte, statt
 * darauf zu bauen, dass beim Anlegen einer Datei jemand daran denkt.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Die Einträge aus dem `SHELL`-Array, so wie sie dort stehen. */
function shell() {
  const quelle = readFileSync(join(WURZEL, 'sw.js'), 'utf8');
  const block = quelle.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(block, 'in sw.js steht kein SHELL-Array mehr');
  return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** @param {string} ordner */
function module(ordner) {
  return readdirSync(join(WURZEL, ordner))
    .filter((n) => n.endsWith('.js'))
    .map((n) => `./${ordner}/${n}`);
}

test('der Service Worker kennt jedes Modul der App', () => {
  const gelistet = new Set(shell());
  const fehlend = [...module('engine'), ...module('ui')].filter((f) => !gelistet.has(f));
  assert.deepEqual(fehlend, [],
    'diese Dateien fehlen in SHELL — offline startet die App damit nicht');
});

test('der Service Worker listet nichts, was es nicht gibt', () => {
  // Das Gegenstück: eine umbenannte Datei bliebe sonst als toter Eintrag
  // stehen, und `addAll()` bricht beim ersten 404 die ganze Installation ab.
  const tot = shell()
    .filter((f) => f !== './')
    .filter((f) => !existsSync(join(WURZEL, f)));
  assert.deepEqual(tot, [], 'diese Einträge in SHELL zeigen ins Leere');
});
