// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../engine/constants.js';
import { TEAMS } from '../engine/content.js';
import { macheSpielplan, anzahlSpieltage, partienAmSpieltag } from '../engine/spielplan.js';

const ids = TEAMS.map((t) => t.id);

test('doppelte Runde: jeder gegen jeden, hin und zurück', () => {
  const plan = macheSpielplan(makeRng('test'), ids);
  assert.equal(plan.length, ids.length * (ids.length - 1));

  const paare = new Map();
  for (const p of plan) {
    const key = p.heim + '>' + p.gast;
    paare.set(key, (paare.get(key) || 0) + 1);
  }
  for (const a of ids) {
    for (const b of ids) {
      if (a === b) continue;
      assert.equal(paare.get(a + '>' + b), 1, `${a} gegen ${b} genau einmal zuhause`);
    }
  }
});

test('Spieltage sind vollständig belegt', () => {
  const plan = macheSpielplan(makeRng('test'), ids);
  const gesamt = anzahlSpieltage(plan);
  assert.equal(gesamt, (ids.length - 1) * 2);

  for (let st = 1; st <= gesamt; st++) {
    const partien = partienAmSpieltag(plan, st);
    assert.equal(partien.length, ids.length / 2, `Spieltag ${st} hat volle Paarungen`);

    // Kein Verein tritt am selben Spieltag zweimal an.
    const beteiligt = new Set();
    for (const p of partien) {
      assert.ok(!beteiligt.has(p.heim), `${p.heim} nur einmal an Spieltag ${st}`);
      assert.ok(!beteiligt.has(p.gast), `${p.gast} nur einmal an Spieltag ${st}`);
      beteiligt.add(p.heim);
      beteiligt.add(p.gast);
    }
    assert.equal(beteiligt.size, ids.length);
  }
});

test('jeder Verein hat gleich viele Heim- wie Auswärtsspiele', () => {
  const plan = macheSpielplan(makeRng('test'), ids);
  for (const id of ids) {
    const heim = plan.filter((p) => p.heim === id).length;
    const gast = plan.filter((p) => p.gast === id).length;
    assert.equal(heim, ids.length - 1);
    assert.equal(gast, ids.length - 1);
  }
});

test('ungerade Teamzahl wird abgelehnt', () => {
  assert.throws(() => macheSpielplan(makeRng('x'), ['a', 'b', 'c']));
});
