// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng, ROSTER_SHAPE, ROSTER_SIZE, MIN_RATING, MAX_RATING, MAX_AGE } from '../engine/constants.js';
import { macheKader, saisonWechsel, alterFaktor, verfuegbar, resetSpielerIds } from '../engine/spieler.js';

test('ein Kader hat die vorgesehene Positionsverteilung', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('k'), 65);
  assert.equal(kader.length, ROSTER_SIZE);

  for (const [pos, anzahl] of Object.entries(ROSTER_SHAPE)) {
    assert.equal(kader.filter((s) => s.position === pos).length, anzahl, pos);
  }
});

test('Stärken bleiben in den Grenzen', () => {
  resetSpielerIds();
  for (const basis of [40, 55, 70, 90]) {
    const kader = macheKader(makeRng('s' + basis), basis);
    for (const s of kader) {
      assert.ok(s.staerke >= MIN_RATING && s.staerke <= MAX_RATING, `Stärke ${s.staerke}`);
      assert.ok(s.talent >= s.staerke - 1, 'Talent liegt nicht unter der Stärke');
    }
  }
});

test('Spieler-Ids sind eindeutig', () => {
  resetSpielerIds();
  const a = macheKader(makeRng('a'), 60);
  const b = macheKader(makeRng('b'), 60);
  const ids = new Set([...a, ...b].map((s) => s.id));
  assert.equal(ids.size, a.length + b.length);
});

test('die Alterskurve gipfelt am Zenit', () => {
  assert.ok(alterFaktor(27) > alterFaktor(19));
  assert.ok(alterFaktor(27) >= alterFaktor(34));
  assert.equal(alterFaktor(27), 1);
});

test('Saisonwechsel altert alle und ersetzt Rücktritte', () => {
  resetSpielerIds();
  const rng = makeRng('w');
  const vorher = macheKader(rng, 65);
  const alt = vorher.filter((s) => s.alter === MAX_AGE).length;

  const { kader, ruecktritte } = saisonWechsel(rng, vorher, 65);
  assert.equal(kader.length, vorher.length, 'Kadergröße bleibt gleich');
  assert.equal(ruecktritte.length, alt, 'genau die Ältesten treten zurück');
  for (const s of kader) {
    assert.ok(s.alter <= MAX_AGE, `Alter ${s.alter} bleibt im Rahmen`);
  }
});

test('Verletzte fallen aus der Verfügbarkeit', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('v'), 65);
  const qbs = kader.filter((s) => s.position === 'QB');
  qbs[0].verletztBis = 5;

  const frei = verfuegbar(kader, 'QB', 3);
  assert.equal(frei.length, qbs.length - 1);
  assert.ok(!frei.some((s) => s.id === qbs[0].id));

  // Nach Spieltag 5 ist er wieder dabei.
  assert.equal(verfuegbar(kader, 'QB', 5).length, qbs.length);
});

test('Trikotnummern sind innerhalb eines Kaders eindeutig', () => {
  resetSpielerIds();
  for (const basis of [45, 60, 75, 90]) {
    const kader = macheKader(makeRng('nr' + basis), basis);
    const nummern = kader.map((s) => s.nummer);
    assert.equal(new Set(nummern).size, kader.length, `Basis ${basis}: keine Doppelung`);
    for (const n of nummern) {
      assert.ok(n >= 1 && n <= 99, `Nummer ${n} liegt im gültigen Bereich`);
    }
  }
});

test('auch nach dem Saisonwechsel bleiben die Nummern eindeutig', () => {
  resetSpielerIds();
  const rng = makeRng('nw');
  let kader = macheKader(rng, 68);
  for (let jahr = 0; jahr < 6; jahr++) {
    kader = saisonWechsel(rng, kader, 68).kader;
    assert.equal(new Set(kader.map((s) => s.nummer)).size, kader.length, `Jahr ${jahr}`);
  }
});
