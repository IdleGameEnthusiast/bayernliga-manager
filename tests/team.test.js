// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng, ERSATZ_STAERKE, KICK_FUSS_AUSSCHLUSS } from '../engine/constants.js';
import { macheKader, macheSpieler, ziehKickWerte, resetSpielerIds } from '../engine/spieler.js';
import { teamStaerken, gesamtStaerke, kickerWert, punterWert, besterFuss } from '../engine/team.js';

test('jeder Spieler bekommt beide Kickwerte', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('kick'), 55, 5);
  for (const s of kader) {
    assert.equal(typeof s.kickStaerke, 'number', s.position);
    assert.equal(typeof s.kickGenauigkeit, 'number', s.position);
    assert.ok(s.kickStaerke >= 1 && s.kickStaerke <= 79);
    assert.ok(s.kickGenauigkeit >= 1 && s.kickGenauigkeit <= 79);
  }
});

test('Kicker- und Punterwert gewichten die beiden Werte verschieden', () => {
  const s = /** @type {any} */ ({ kickStaerke: 70, kickGenauigkeit: 30 });
  assert.equal(kickerWert(s), 50);
  assert.equal(punterWert(s), 58);

  // Bei gleichen Werten fallen beide Formeln zusammen.
  const gleich = /** @type {any} */ ({ kickStaerke: 44, kickGenauigkeit: 44 });
  assert.equal(kickerWert(gleich), 44);
  assert.equal(punterWert(gleich), 44);
});

test('ein starkes Bein ohne Zielwasser ist der bessere Punter', () => {
  const kanone = /** @type {any} */ ({ kickStaerke: 72, kickGenauigkeit: 34 });
  const praezise = /** @type {any} */ ({ kickStaerke: 48, kickGenauigkeit: 62 });
  assert.ok(kickerWert(praezise) > kickerWert(kanone));
  assert.ok(punterWert(kanone) > punterWert(praezise));
});

test('gekickt wird aus dem ganzen Kader, nicht aus einem K-Slot', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('fuss'), 55, 5);
  assert.equal(kader.filter((s) => s.position === 'K' || s.position === 'P').length, 0,
    'die Liga kennt keine Spezialisten');

  const s = teamStaerken(kader, 1);
  const besterKicker = Math.max(...kader.map(kickerWert));
  assert.equal(besterFuss(kader, 1, kickerWert), besterKicker);
  assert.equal(s.special, besterKicker * 0.7 + Math.max(...kader.map(punterWert)) * 0.3);
  assert.ok(s.special > ERSATZ_STAERKE, 'Special Teams sind kein toter Wert mehr');
});

test('ein verletzter Kicker steht nicht auf dem Feld', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('verletzt'), 55, 5);
  const bester = kader.slice().sort((a, b) => kickerWert(b) - kickerWert(a))[0];
  const vorher = teamStaerken(kader, 1).special;

  bester.verletztBis = 4;
  const nachher = teamStaerken(kader, 1).special;
  assert.ok(nachher < vorher, 'ohne den besten Fuß sinken die Special Teams');
});

test('ein leerer Kader fällt auf die Ersatzstärke zurück', () => {
  assert.equal(besterFuss([], 1, kickerWert), ERSATZ_STAERKE);
  assert.equal(teamStaerken([], 1).special, ERSATZ_STAERKE);
});

test('aus der Line kommt kein Kicker', () => {
  // Über viele Ziehungen bleibt ein Lineman im unteren Band.
  for (const position of /** @type {const} */ (['T', 'G', 'C', 'DE', 'DT', 'NT'])) {
    let hoechster = 0;
    for (let i = 0; i < 200; i++) {
      const w = ziehKickWerte(makeRng(position + i), position);
      hoechster = Math.max(hoechster, w.kickStaerke, w.kickGenauigkeit);
    }
    assert.ok(hoechster < 60, `bester ${position}-Kickwert war ${hoechster}`);
    assert.ok(KICK_FUSS_AUSSCHLUSS.includes(position), `${position} steht im Ausschluss`);
  }
});

test('ein paar Vereine haben einen echten Fuß, nicht alle', () => {
  // Gepinnter Seed, geprüft wird die Form: es gibt gute Füße, aber nicht überall.
  const anteile = [];
  for (let i = 0; i < 12; i++) {
    resetSpielerIds();
    const kader = macheKader(makeRng('verein' + i), 55, 5);
    anteile.push(Math.max(...kader.map(kickerWert)));
  }
  assert.ok(anteile.some((w) => w > 50), 'irgendwo steht ein echter Kicker');
  assert.ok(Math.min(...anteile) < Math.max(...anteile), 'nicht jeder Verein ist gleich gut bedient');
});

test('die Gesamtstärke bleibt eine Zahl im Ligarahmen', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('gesamt'), 60, 5);
  const g = gesamtStaerke(teamStaerken(kader, 1));
  assert.ok(g > 20 && g < 79, `Gesamtstärke ${g}`);
});

test('macheSpieler zieht die Kickwerte reproduzierbar', () => {
  resetSpielerIds();
  const a = macheSpieler(makeRng('s'), 'WR', 55);
  resetSpielerIds();
  const b = macheSpieler(makeRng('s'), 'WR', 55);
  assert.equal(a.kickStaerke, b.kickStaerke);
  assert.equal(a.kickGenauigkeit, b.kickGenauigkeit);
});
