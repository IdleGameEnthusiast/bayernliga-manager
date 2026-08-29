// @ts-check
/**
 * Erzeugt die App-Icons als PNG — ohne jede Abhängigkeit, nur mit zlib aus
 * Node. Aufruf:  node scripts/mach-icons.js
 *
 * Muss nur laufen, wenn sich das Icon ändert; die PNGs liegen im Repo.
 */

import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HIER = dirname(fileURLToPath(import.meta.url));
const ICONS = join(HIER, '..', 'icons');

const HINTERGRUND = [15, 23, 32];   // #0f1720
const BALL = [214, 73, 51];         // #d64933
const NAHT = [240, 236, 228];       // helle Naht und Schnürung

/** CRC32, wie PNG es verlangt. */
const CRC_TABELLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** @param {Buffer} buf */
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABELLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/** @param {string} typ @param {Buffer} daten */
function chunk(typ, daten) {
  const laenge = Buffer.alloc(4);
  laenge.writeUInt32BE(daten.length);
  const koerper = Buffer.concat([Buffer.from(typ, 'latin1'), daten]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(koerper));
  return Buffer.concat([laenge, koerper, crc]);
}

/**
 * @param {number} breite @param {number} hoehe @param {Buffer} rgb
 */
function pngKodiere(breite, hoehe, rgb) {
  const roh = Buffer.alloc(hoehe * (breite * 3 + 1));
  for (let y = 0; y < hoehe; y++) {
    roh[y * (breite * 3 + 1)] = 0; // Filter: keiner
    rgb.copy(roh, y * (breite * 3 + 1) + 1, y * breite * 3, (y + 1) * breite * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(breite, 0);
  ihdr.writeUInt32BE(hoehe, 4);
  ihdr[8] = 8;  // Bittiefe
  ihdr[9] = 2;  // Truecolor RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(roh, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Deckung eines Punktes im Icon: liefert die Farbe an (x, y) in 0..1-Koordinaten.
 * @param {number} x @param {number} y
 * @returns {number[]}
 */
function farbeAn(x, y) {
  // Ball: Ellipse um die Mitte, leicht gedreht, damit es nach Football aussieht.
  const winkel = -0.32;
  const dx = x - 0.5;
  const dy = y - 0.5;
  const rx = dx * Math.cos(winkel) - dy * Math.sin(winkel);
  const ry = dx * Math.sin(winkel) + dy * Math.cos(winkel);

  const imBall = (rx / 0.33) ** 2 + (ry / 0.205) ** 2 <= 1;
  if (!imBall) return HINTERGRUND;

  // Schnürung: ein kurzer Strich auf der Längsachse, mit Sprossen.
  const aufAchse = Math.abs(ry) < 0.012 && Math.abs(rx) < 0.15;
  const sprosse = Math.abs(ry) < 0.045
    && Math.abs(rx) < 0.135
    && Math.abs(((rx + 1) % 0.05) - 0.025) < 0.009;
  if (aufAchse || sprosse) return NAHT;

  // Die beiden weißen Ringe nahe den Spitzen.
  if (Math.abs(Math.abs(rx) - 0.235) < 0.011 && Math.abs(ry) < 0.115) return NAHT;

  return BALL;
}

/** @param {number} groesse */
function macheIcon(groesse) {
  const rgb = Buffer.alloc(groesse * groesse * 3);
  const AA = 3; // Supersampling gegen Treppen
  for (let y = 0; y < groesse; y++) {
    for (let x = 0; x < groesse; x++) {
      let r = 0, g = 0, b = 0;
      for (let sy = 0; sy < AA; sy++) {
        for (let sx = 0; sx < AA; sx++) {
          const c = farbeAn(
            (x + (sx + 0.5) / AA) / groesse,
            (y + (sy + 0.5) / AA) / groesse,
          );
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const n = AA * AA;
      const i = (y * groesse + x) * 3;
      rgb[i] = Math.round(r / n);
      rgb[i + 1] = Math.round(g / n);
      rgb[i + 2] = Math.round(b / n);
    }
  }
  return pngKodiere(groesse, groesse, rgb);
}

mkdirSync(ICONS, { recursive: true });
for (const groesse of [180, 192, 512]) {
  const datei = join(ICONS, `icon-${groesse}.png`);
  writeFileSync(datei, macheIcon(groesse));
  console.log(`icons/icon-${groesse}.png`);
}
