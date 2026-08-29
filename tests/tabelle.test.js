// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { berechneTabelle, bilanz } from '../engine/tabelle.js';
import { POINTS_WIN } from '../engine/constants.js';

/** @param {string} heim @param {string} gast @param {number} hp @param {number} gp */
function partie(heim, gast, hp, gp) {
  return {
    spieltag: 1, heim, gast,
    ergebnis: /** @type {any} */ ({ heimPunkte: hp, gastPunkte: gp }),
  };
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
  const plan = [{ spieltag: 1, heim: 'a', gast: 'b', ergebnis: null }];
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
