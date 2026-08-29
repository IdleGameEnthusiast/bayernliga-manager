// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng, ZUSATZ_SPIELER, ERSATZ_STAERKE } from '../engine/constants.js';
import { macheKader, resetSpielerIds } from '../engine/spieler.js';
import { PLAETZE } from '../engine/positionen.js';
import {
  PERSONNEL, STANDARD_PERSONNEL, OL_PLAETZE, QB_PLATZ, DEFENSE_PLAETZE,
  BLOCK_GEWICHT, PLATZ_ANTEIL, SKILL_LEITER,
  stelleAuf, skillAnteile, doppelAbzug, doppelRisiko, doppelEinsaetze, umstellungen,
} from '../engine/aufstellung.js';
import { teamStaerken } from '../engine/team.js';

/** Ein voller Kader, wie ihn ein fremder Verein hat. */
function kader(seed = 'auf', basis = 58, zusatz = ZUSATZ_SPIELER) {
  resetSpielerIds();
  return macheKader(makeRng(seed), basis, zusatz);
}

test('acht Gruppierungen, jede mit fünf gültigen Skill-Plätzen', () => {
  assert.equal(Object.keys(PERSONNEL).length, 8);
  assert.ok(PERSONNEL[STANDARD_PERSONNEL], 'die Standardgruppierung gibt es');

  for (const [id, g] of Object.entries(PERSONNEL)) {
    assert.equal(g.skill.length, 5, `${id} hat ${g.skill.length} Skill-Plätze`);
    for (const platz of g.skill) assert.ok(PLAETZE[platz], `${id} kennt ${platz} nicht`);
    assert.ok(g.passAnteil > 0 && g.passAnteil < 1, `${id}: Passanteil ${g.passAnteil}`);
  }
  // Von der luftigsten zur schwersten Gruppierung fällt der Passanteil.
  assert.ok(PERSONNEL['00'].passAnteil > PERSONNEL['11'].passAnteil);
  assert.ok(PERSONNEL['11'].passAnteil > PERSONNEL['32'].passAnteil);
});

test('jede Gewichtszeile summiert auf eins', () => {
  for (const einheit of /** @type {const} */ (['angriff', 'verteidigung'])) {
    for (const art of /** @type {const} */ (['pass', 'lauf'])) {
      const summe = Object.values(BLOCK_GEWICHT[einheit][art]).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(summe - 1) < 1e-9, `${einheit} ${art}: ${summe}`);
    }
  }
  for (const block of /** @type {const} */ (['ol', 'dl', 'lb', 'db'])) {
    for (const art of /** @type {const} */ (['pass', 'lauf'])) {
      const summe = Object.values(PLATZ_ANTEIL[block][art]).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(summe - 1) < 1e-9, `${block} ${art}: ${summe}`);
    }
  }
  assert.ok(Math.abs(SKILL_LEITER.reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test('die Skill-Leiter sortiert im Pass nach vorn, im Lauf nach hinten', () => {
  const anteile = skillAnteile(['RB', 'TE', 'WR', 'WR', 'SL']);
  // Im Passspiel steht der erste Receiver vorn, im Laufspiel der Runningback.
  assert.equal(anteile.pass[2], 0.30, 'der erste WR führt das Passspiel an');
  assert.equal(anteile.lauf[0], 0.30, 'der RB führt das Laufspiel an');
  // Zwei Receiver stehen vor ihm, dazu Slot und Tight End: im Passspiel ist
  // der Runningback der fünfte von fünf.
  assert.equal(anteile.pass[0], 0.10);
  assert.equal(anteile.lauf[4], 0.20, 'der Slot ist im Laufspiel der dritte');

  for (const g of Object.values(PERSONNEL)) {
    const a = skillAnteile(g.skill);
    for (const art of /** @type {const} */ (['pass', 'lauf'])) {
      assert.deepEqual([...a[art]].sort((x, y) => y - x), SKILL_LEITER);
    }
  }
});

test('kein Platz bleibt leer, und niemand steht doppelt', () => {
  for (const personnel of Object.keys(PERSONNEL)) {
    const a = stelleAuf(kader('leer' + personnel), 1, personnel);
    assert.equal(a.offense.length, 11);
    assert.equal(a.defense.length, 11);
    for (const p of [...a.offense, ...a.defense]) {
      assert.ok(p.spieler, `${personnel}: ${p.platz} ist leer`);
    }
    assert.equal(doppelEinsaetze(a).length, 0, `${personnel}: niemand muss doppelt ran`);
    assert.ok(a.k && a.p, 'gekickt wird auch');

    const ids = [...a.offense, ...a.defense].map((p) => p.spieler && p.spieler.id);
    assert.equal(new Set(ids).size, 22, `${personnel}: zweiundzwanzig verschiedene Leute`);
  }
});

test('die Aufstellung stellt die Plätze der Formation', () => {
  const a = stelleAuf(kader(), 1, '11');
  assert.deepEqual(a.offense.map((p) => p.platz),
    [QB_PLATZ, ...OL_PLAETZE, ...PERSONNEL['11'].skill]);
  assert.deepEqual(a.defense.map((p) => p.platz), [...DEFENSE_PLAETZE]);
});

test('innerhalb einer Position entscheidet die Stärke', () => {
  const k = kader('staerke');
  const a = stelleAuf(k, 1, '11');
  const lt = a.offense.find((p) => p.platz === 'LT');
  const staerkster = k.filter((s) => s.position === 'T').sort((x, y) => y.staerke - x.staerke)[0];
  assert.equal(lt.spieler.id, staerkster.id, 'der stärkste Tackle steht auf LT');
  assert.equal(lt.umgestellt, false);
});

test('eine leere Position holt sich den besten Umsteller', () => {
  // Der eigene Verein hat keinen ausgebildeten Tight End. Wer dort steht, ist
  // umgestellt — und der Abschlag kommt aus der fehlenden Technik, nicht aus
  // einer Strafe von außen.
  const eigen = kader('eigen', 45, 0);
  assert.equal(eigen.filter((s) => s.position === 'TE').length, 0);

  const a = stelleAuf(eigen, 1, '11');
  const te = a.offense.find((p) => p.platz === 'TE');
  assert.ok(te.spieler, 'der Platz ist trotzdem besetzt');
  assert.equal(te.umgestellt, true);
  assert.notEqual(te.spieler.position, 'TE');
  assert.equal(umstellungen(a), 1, 'und sonst steht jeder richtig');

  // Je mehr Tight Ends ein System verlangt, desto mehr wird umgestellt.
  assert.equal(umstellungen(stelleAuf(eigen, 1, '32')), 3);
  assert.equal(umstellungen(stelleAuf(eigen, 1, '20')), 0);
});

test('erst ein dünner Kader zwingt zum Doppeleinsatz', () => {
  const k = kader('duenn', 45, 0);
  assert.equal(doppelEinsaetze(stelleAuf(k, 1, '11')).length, 0);

  // Der Reihe nach ausfallen lassen, bis der erste zweimal ran muss.
  let ausfaelle = 0;
  while (doppelEinsaetze(stelleAuf(k, 1, '11')).length === 0 && ausfaelle < k.length) {
    k[ausfaelle].verletztBis = 5;
    ausfaelle++;
  }
  assert.ok(ausfaelle > 5 && ausfaelle < 15,
    `nach ${ausfaelle} Ausfällen muss der erste doppelt ran`);

  const a = stelleAuf(k, 1, '11');
  const doppelt = [...a.offense, ...a.defense].filter((p) => p.doppel);
  assert.ok(doppelt.length > 0);
  for (const p of doppelt) assert.ok(p.spieler, 'ein Doppeleinsatz hat einen Spieler');
  // Auch dann bleibt kein Platz leer.
  for (const p of [...a.offense, ...a.defense]) assert.ok(p.spieler, `${p.platz} ist leer`);
});

test('der Doppeleinsatz ist teuer und wird linear interpoliert', () => {
  assert.equal(doppelAbzug(80), 0.15);
  assert.equal(doppelAbzug(50), 0.28);
  assert.equal(doppelAbzug(20), 0.40);
  assert.equal(doppelAbzug(99), 0.15, 'darüber bleibt es flach');
  assert.equal(doppelAbzug(1), 0.40, 'darunter auch');
  assert.ok(Math.abs(doppelAbzug(65) - 0.215) < 1e-9, 'dazwischen linear');

  assert.equal(doppelRisiko(80), 2.0);
  assert.equal(doppelRisiko(50), 3.0);
  assert.equal(doppelRisiko(20), 4.0);
  assert.ok(Math.abs(doppelRisiko(35) - 3.5) < 1e-9);

  // Beide Kurven laufen in dieselbe Richtung: wer wenig hat, zahlt mehr.
  for (let w = 20; w < 80; w += 5) {
    assert.ok(doppelAbzug(w) > doppelAbzug(w + 5));
    assert.ok(doppelRisiko(w) > doppelRisiko(w + 5));
  }
});

test('teamStaerken liefert Lauf und Pass getrennt', () => {
  const s = teamStaerken(kader('werte'), 1);
  for (const feld of ['passAngriff', 'laufAngriff', 'passVerteidigung', 'laufVerteidigung']) {
    assert.equal(typeof s[feld], 'number', feld);
    assert.ok(s[feld] > ERSATZ_STAERKE && s[feld] < 79, `${feld} ist ${s[feld]}`);
  }
  assert.ok(s.aufstellung, 'die Aufstellung hängt mit dran');
});

test('dieselben elf Leute sind in verschiedenen Systemen verschieden viel wert', () => {
  const k = kader('system');
  const werte = Object.keys(PERSONNEL).map((p) => teamStaerken(k, 1, p));
  const pass = werte.map((w) => w.passAngriff);
  assert.ok(Math.max(...pass) - Math.min(...pass) > 0.3, 'die Systeme unterscheiden sich');

  // Und zwar in der richtigen Richtung: das schwere System verschiebt das
  // Verhältnis zum Laufspiel, das leere zum Passspiel.
  const leer = teamStaerken(k, 1, '00');
  const schwer = teamStaerken(k, 1, '32');
  assert.ok(schwer.laufAngriff / schwer.passAngriff > leer.laufAngriff / leer.passAngriff);
});

test('ein voller Kader kommt der Ersatzstärke nie nahe', () => {
  // ERSATZ_STAERKE ist kein Notnagel mehr. Sie steht nur noch für den
  // buchstäblich leeren Kader.
  const s = teamStaerken(kader('voll'), 1);
  assert.ok(Math.min(s.passAngriff, s.laufAngriff,
    s.passVerteidigung, s.laufVerteidigung) > ERSATZ_STAERKE + 10);

  const leer = teamStaerken([], 1);
  assert.equal(leer.passAngriff, ERSATZ_STAERKE);
  assert.equal(leer.laufVerteidigung, ERSATZ_STAERKE);
  assert.equal(leer.special, ERSATZ_STAERKE);
});

test('der Passanteil des Vereins verschiebt nur, wer nachrückt', () => {
  const eigen = kader('anteil', 45, 0);
  const laufig = stelleAuf(eigen, 1, '11', 0.2);
  const passig = stelleAuf(eigen, 1, '11', 0.9);
  // Die Plätze bleiben dieselben, nur die Umstellung kann anders ausfallen.
  assert.deepEqual(laufig.offense.map((p) => p.platz), passig.offense.map((p) => p.platz));
  for (const a of [laufig, passig]) {
    for (const p of [...a.offense, ...a.defense]) assert.ok(p.spieler, p.platz);
  }
});
