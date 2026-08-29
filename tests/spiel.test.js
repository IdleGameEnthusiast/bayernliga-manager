// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../engine/constants.js';
import { macheKader, resetSpielerIds } from '../engine/spieler.js';
import { simuliereSpiel, baueScore } from '../engine/spiel.js';
import { teamStaerken, gesamtStaerke } from '../engine/team.js';

/** @param {string} id @param {number} staerke */
function team(id, staerke) {
  return { id, kader: macheKader(makeRng(id + staerke), staerke) };
}

test('gleicher Seed, gleiches Spiel', () => {
  resetSpielerIds();
  const a = team('a', 68);
  const b = team('b', 62);

  const e1 = simuliereSpiel(makeRng('spiel-1'), a, b, 1);
  const e2 = simuliereSpiel(makeRng('spiel-1'), a, b, 1);
  assert.deepEqual(e1, e2);
});

test('kein Spiel endet unentschieden', () => {
  resetSpielerIds();
  const a = team('a', 66);
  const b = team('b', 66);
  for (let i = 0; i < 300; i++) {
    const e = simuliereSpiel(makeRng('u' + i), a, b, 1);
    assert.notEqual(e.heimPunkte, e.gastPunkte, `Spiel ${i} hat einen Sieger`);
  }
});

test('Viertel summieren sich auf den Endstand, außer nach Verlängerung', () => {
  resetSpielerIds();
  const a = team('a', 70);
  const b = team('b', 58);
  for (let i = 0; i < 200; i++) {
    const e = simuliereSpiel(makeRng('q' + i), a, b, 1);
    if (e.verlaengerung) continue;
    assert.equal(e.heimViertel.reduce((x, y) => x + y, 0), e.heimPunkte);
    assert.equal(e.gastViertel.reduce((x, y) => x + y, 0), e.gastPunkte);
  }
});

test('Ergebnisse bleiben im Football-Rahmen', () => {
  resetSpielerIds();
  const a = team('a', 74);
  const b = team('b', 54);
  for (let i = 0; i < 200; i++) {
    const e = simuliereSpiel(makeRng('r' + i), a, b, 1);
    assert.ok(e.heimPunkte >= 0 && e.heimPunkte <= 90, `Heim ${e.heimPunkte}`);
    assert.ok(e.gastPunkte >= 0 && e.gastPunkte <= 90, `Gast ${e.gastPunkte}`);
  }
});

test('die stärkere Mannschaft gewinnt über viele Spiele deutlich öfter', () => {
  resetSpielerIds();
  const stark = team('stark', 82);
  const schwach = team('schwach', 48);
  assert.ok(gesamtStaerke(teamStaerken(stark.kader, 1))
    > gesamtStaerke(teamStaerken(schwach.kader, 1)));

  let siege = 0;
  const spiele = 400;
  for (let i = 0; i < spiele; i++) {
    // Abwechselnd Heimrecht, damit der Heimvorteil sich heraushebt.
    const e = i % 2 === 0
      ? simuliereSpiel(makeRng('d' + i), stark, schwach, 1)
      : simuliereSpiel(makeRng('d' + i), schwach, stark, 1);
    const starkGewinnt = i % 2 === 0
      ? e.heimPunkte > e.gastPunkte
      : e.gastPunkte > e.heimPunkte;
    if (starkGewinnt) siege++;
  }
  // Bewusst grob: die Richtung wird geprüft, nicht die Verteilung.
  assert.ok(siege > spiele * 0.7, `starkes Team gewann nur ${siege} von ${spiele}`);
});

test('baueScore trifft die Vorgabe ungefähr und terminiert', () => {
  for (const ziel of [3, 14, 21, 35, 56]) {
    const s = baueScore(makeRng('b' + ziel), ziel);
    assert.ok(s.punkte >= 0);
    assert.ok(s.punkte <= ziel + 8, `${s.punkte} liegt nicht weit über ${ziel}`);
    assert.equal(s.viertel.length, 4);
    assert.equal(s.viertel.reduce((a, b) => a + b, 0), s.punkte);
  }
});

test('Verletzungen treffen nur fitte Spieler des eigenen Teams', () => {
  resetSpielerIds();
  const a = team('a', 65);
  const b = team('b', 65);
  for (let i = 0; i < 200; i++) {
    const e = simuliereSpiel(makeRng('v' + i), a, b, 1);
    for (const v of e.verletzungen) {
      assert.ok(v.teamId === 'a' || v.teamId === 'b');
      const kader = v.teamId === 'a' ? a.kader : b.kader;
      assert.ok(kader.some((s) => s.id === v.spielerId), 'Spieler gehört zum Team');
      assert.ok(v.wochen >= 1);
    }
  }
});

test('das Scoring verteilt sich plausibel über die vier Viertel', () => {
  // Deterministisch: feste Seeds, also kein Flackern. Geprüft wird die Form
  // der Verteilung, nicht ein exakter Wert.
  const summe = [0, 0, 0, 0];
  const durchgaenge = 2000;
  for (let i = 0; i < durchgaenge; i++) {
    const s = baueScore(makeRng('viertel' + i), 24);
    s.viertel.forEach((v, q) => { summe[q] += v; });
  }
  const gesamt = summe.reduce((a, b) => a + b, 0);

  for (let q = 0; q < 4; q++) {
    const anteil = summe[q] / gesamt;
    assert.ok(anteil > 0.19 && anteil < 0.31,
      `Viertel ${q + 1} bekommt ${(anteil * 100).toFixed(1)}% des Scorings`);
  }
  // Zweites und viertes Viertel liegen vorn, aber nicht dramatisch.
  assert.ok(summe[1] > summe[0], 'Q2 liegt über Q1');
  assert.ok(summe[3] > summe[2], 'Q4 liegt über Q3');
});
