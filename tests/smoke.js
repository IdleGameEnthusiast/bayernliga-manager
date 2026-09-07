// @ts-check
/**
 * Der Rauchtest: die echte App, in einem echten Browser, ohne Bildbetrachtung.
 *
 * `node --test` deckt `engine/` ab und rührt `ui/` nicht an — dort gibt es kein
 * DOM. Was diese Suite prüft, ist deshalb genau das, was die Unit-Tests nicht
 * können: die **Verdrahtung**. Ob der erste Bildschirm der Posteingang ist, ob
 * ein Knopf die Uhr bewegt, ob ein alter Speicherstand beim Laden ankommt.
 *
 * Der Weg hinaus ist der Punkt. Ein headless Firefox kann kein DOM ausgeben,
 * nur fotografieren — und ein Foto ist kein Urteil. Also serviert dieses
 * Skript die Seiten selbst und nimmt ihren Bericht per POST wieder entgegen.
 * Damit endet der Lauf mit einer Zahl wie jeder andere Test auch.
 *
 * Aufruf: `node tests/smoke.js [filter]`
 * Exit 0 alles grün · 1 eine Prüfung rot · 2 kein Browser da
 */

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, readdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..');
const SEITEN = join(WURZEL, 'tests', 'smoke');

/** Wie lange eine Seite für ihren Bericht bekommt. Eine ganze Saison im
 *  Browser dauert unter einer Sekunde — 60 sind Nachsicht, keine Erwartung. */
const GEDULD_MS = 60000;

/**
 * Wo Firefox liegt. Andreas hat normalerweise einen offenen — deshalb später
 * `--no-remote` und ein eigenes Profil, sonst hängt sich der Aufruf an die
 * laufende Sitzung und dieses Skript wartet auf einen Bericht, den niemand
 * schreibt.
 */
function browser() {
  const kandidaten = [
    process.env.FIREFOX,
    '/Applications/Firefox.app/Contents/MacOS/firefox',
    '/usr/bin/firefox',
    '/usr/local/bin/firefox',
    '/snap/bin/firefox',
  ];
  return kandidaten.find((p) => p && existsSync(p)) || null;
}

const TYPEN = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Der Server: liefert das Projekt aus und nimmt unter `/ergebnis` den Bericht
 * einer Seite entgegen.
 * @param {(bericht: any) => void} beiBericht
 */
function starte(beiBericht) {
  const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/ergebnis') {
      const teile = [];
      req.on('data', (t) => teile.push(t));
      req.on('end', () => {
        res.writeHead(204).end();
        try {
          beiBericht(JSON.parse(Buffer.concat(teile).toString('utf8')));
        } catch (e) {
          beiBericht({ zeilen: [], fehler: ['unlesbarer Bericht: ' + e] });
        }
      });
      return;
    }

    const pfad = decodeURIComponent((req.url || '/').split('?')[0]);
    // Kein Ausbruch aus dem Projekt — ein Testserver ist auch ein Server.
    const datei = join(WURZEL, pfad === '/' ? 'index.html' : pfad);
    if (!datei.startsWith(WURZEL)) { res.writeHead(403).end(); return; }

    readFile(datei).then(
      (inhalt) => {
        res.writeHead(200, { 'content-type': TYPEN[extname(datei)] || 'application/octet-stream' });
        res.end(inhalt);
      },
      () => res.writeHead(404).end('nicht da: ' + pfad));
  });

  return new Promise((fertig) => {
    server.listen(0, '127.0.0.1', () => fertig({
      server,
      port: /** @type {any} */ (server.address()).port,
    }));
  });
}

/**
 * Eine Seite laufen lassen und ihren Bericht abholen.
 * @param {string} exe @param {number} port @param {string} name
 */
async function laufe(exe, port, name) {
  const profil = await mkdtemp(join(tmpdir(), 'rauch-'));
  // Ein frisches Profil will sonst nach Hause telefonieren und eine
  // Willkommensseite aufschlagen; beides kostet nur Zeit.
  await writeFile(join(profil, 'user.js'), [
    'user_pref("browser.aboutwelcome.enabled", false);',
    'user_pref("browser.shell.checkDefaultBrowser", false);',
    'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
    'user_pref("toolkit.telemetry.enabled", false);',
  ].join('\n'));

  let melde = (/** @type {any} */ _b) => {};
  const bericht = new Promise((fertig) => { melde = fertig; });
  aktuell = melde;

  const kind = spawn(exe, [
    '--headless', '--no-remote', '-profile', profil,
    `http://127.0.0.1:${port}/tests/smoke/${name}`,
  ], { env: { ...process.env, MOZ_HEADLESS: '1' }, stdio: 'ignore' });

  /** @type {any} */
  let uhr;
  const ergebnis = await Promise.race([
    bericht,
    new Promise((fertig) => {
      uhr = setTimeout(() => fertig({
        zeilen: [],
        fehler: [`kein Bericht nach ${GEDULD_MS / 1000} Sekunden`],
      }), GEDULD_MS);
    }),
  ]);
  clearTimeout(uhr);

  kind.kill();
  setTimeout(() => kind.kill('SIGKILL'), 2000).unref();
  await rm(profil, { recursive: true, force: true }).catch(() => {});
  return ergebnis;
}

/** Die Seite, die gerade auf ihren Bericht wartet. @type {(b: any) => void} */
let aktuell = () => {};

// --- Der Lauf ---------------------------------------------------------------

const filter = process.argv[2] || '';
const exe = browser();
if (!exe) {
  console.error('Kein Firefox gefunden. Setze FIREFOX=<pfad>, oder überspringe den');
  console.error('Rauchtest — `node --test tests/*.test.js` läuft unabhängig davon.');
  process.exit(2);
}

const namen = (await readdir(SEITEN))
  .filter((n) => n.endsWith('.html'))
  .filter((n) => !filter || n.includes(filter))
  .sort();

if (namen.length === 0) {
  console.error(`Keine Seite passt auf "${filter}".`);
  process.exit(2);
}

const { server, port } = /** @type {any} */ (await starte((b) => aktuell(b)));

let pruefungen = 0;
let rot = 0;
for (const name of namen) {
  const b = await laufe(exe, port, name);
  const zeilen = b.zeilen || [];
  const fehler = b.fehler || [];
  const schlecht = zeilen.filter((/** @type {any} */ z) => z[0] === 'FAIL');
  pruefungen += zeilen.length;
  rot += schlecht.length + fehler.length;

  const titel = b.suite || basename(name, '.html');
  console.log(`${schlecht.length + fehler.length === 0 ? '✔' : '✖'} ${titel} `
    + `(${zeilen.length} Prüfungen)`);
  // Grüne Zeilen bleiben ungenannt: wer den Lauf liest, sucht das Rote.
  for (const [, n, d] of schlecht) console.log(`  ✖ ${n}${d ? ' — ' + d : ''}`);
  for (const f of fehler) console.log(`  ✖ FEHLER ${f}`);
}

server.close();
console.log(`\nℹ seiten ${namen.length}`);
console.log(`ℹ pruefungen ${pruefungen}`);
console.log(`ℹ fail ${rot}`);
process.exit(rot === 0 ? 0 : 1);
