// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { berechneTabelle, bilanz, winProzent, heimrecht } from '../engine/tabelle.js';
import { POINTS_WIN } from '../engine/constants.js';

/** @param {string} heim @param {string} gast @param {number} hp @param {number} gp */
function partie(heim, gast, hp, gp) {
  return /** @type {any} */ ({
    spieltag: 1, runde: 'gruppe', heim, gast,
    ergebnis: { heimPunkte: hp, gastPunkte: gp },
  });
}

test('Siege, Punkte und Differenz werden korrekt gezählt', () => {
  const plan = [
    partie('a', 'b', 28, 17),
    partie('c', 'a', 10, 24),
  ];
  const t = berechneTabelle(['a', 'b', 'c'], plan);

  const a = t.find((z) => z.teamId === 'a');
  assert.ok(a);
  assert.equal(a.spiele, 2);
  assert.equal(a.siege, 2);
  assert.equal(a.punkte, 2 * POINTS_WIN);
  assert.equal(a.erzielt, 28 + 24);
  assert.equal(a.kassiert, 17 + 10);
  assert.equal(a.differenz, 25);
  assert.equal(a.platz, 1);
});

test('ungespielte Partien zählen nicht', () => {
  const plan = /** @type {any} */ ([{ spieltag: 1, runde: 'gruppe', heim: 'a', gast: 'b', ergebnis: null }]);
  const t = berechneTabelle(['a', 'b'], plan);
  assert.equal(t[0].spiele, 0);
  assert.equal(t[0].punkte, 0);
});

test('bei Punktgleichheit entscheidet die Differenz', () => {
  const plan = [
    partie('a', 'c', 30, 0),   // a: 1 Sieg, +30
    partie('b', 'c', 10, 7),   // b: 1 Sieg, +3
  ];
  const t = berechneTabelle(['a', 'b', 'c'], plan);
  assert.equal(t[0].teamId, 'a');
  assert.equal(t[1].teamId, 'b');
});

test('Bilanz wird als Sieg-Niederlage geschrieben', () => {
  const plan = [partie('a', 'b', 21, 14)];
  const t = berechneTabelle(['a', 'b'], plan);
  assert.equal(bilanz(t[0]), '1-0');
  assert.equal(bilanz(t[1]), '0-1');
});

test('Plätze sind lückenlos vergeben', () => {
  const t = berechneTabelle(['a', 'b', 'c', 'd'], []);
  assert.deepEqual(t.map((z) => z.platz), [1, 2, 3, 4]);
});

test('Win Percentage zählt Siege gegen Spiele', () => {
  const plan = [
    partie('a', 'b', 21, 14),
    partie('a', 'c', 10, 30),
    partie('a', 'd', 24, 21),
    partie('a', 'e', 7, 35),
  ];
  const t = berechneTabelle(['a', 'b', 'c', 'd', 'e'], plan);
  const a = t.find((z) => z.teamId === 'a');
  assert.ok(a);
  assert.equal(winProzent(a), 0.5);

  const ungespielt = berechneTabelle(['x'], [])[0];
  assert.equal(winProzent(ungespielt), 0, 'ohne Spiel keine Division durch null');
});

test('Heimrecht: erst die Win Percentage, dann die Differenz', () => {
  const plan = [
    partie('a', 'b', 30, 0),
    partie('c', 'd', 10, 7),
    partie('c', 'a', 3, 0),
  ];
  const t = berechneTabelle(['a', 'b', 'c', 'd'], plan);
  const a = /** @type {any} */ (t.find((z) => z.teamId === 'a'));
  const c = /** @type {any} */ (t.find((z) => z.teamId === 'c'));
  // c hat zwei Siege aus zwei Spielen, a einen aus zwei.
  assert.equal(heimrecht(a, c).teamId, 'c');
  assert.equal(heimrecht(c, a).teamId, 'c', 'die Reihenfolge der Argumente ändert nichts');

  // Gleiche Bilanz, bessere Differenz entscheidet.
  const gleich = berechneTabelle(['e', 'f', 'g', 'h'], [
    partie('e', 'g', 40, 0),
    partie('f', 'h', 10, 7),
  ]);
  const e = /** @type {any} */ (gleich.find((z) => z.teamId === 'e'));
  const f = /** @type {any} */ (gleich.find((z) => z.teamId === 'f'));
  assert.equal(heimrecht(e, f).teamId, 'e');
});
