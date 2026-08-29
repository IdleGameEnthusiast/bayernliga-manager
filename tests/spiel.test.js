// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../engine/constants.js';
import { macheKader, resetSpielerIds } from '../engine/spieler.js';
import {
  simuliereSpiel, baueScore, vorteil, angriffGemischt, passAnteilVon,
} from '../engine/spiel.js';
import { teamStaerken, gesamtStaerke } from '../engine/team.js';
import { PERSONNEL } from '../engine/aufstellung.js';

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

// --- Lauf und Pass ---------------------------------------------------------

/** @param {number} pa @param {number} la @param {number} pv @param {number} lv */
function werte(pa, la, pv, lv) {
  return /** @type {any} */ ({
    passAngriff: pa, laufAngriff: la, passVerteidigung: pv, laufVerteidigung: lv,
    special: 40, angriff: (pa + la) / 2, verteidigung: (pv + lv) / 2,
  });
}

test('der Vorteil mischt die beiden Duelle nach dem Passanteil', () => {
  const angriff = werte(60, 40, 0, 0);
  const gegner = werte(0, 0, 50, 30);

  assert.equal(vorteil(angriff, gegner, 1), 10, 'reines Passspiel');
  assert.equal(vorteil(angriff, gegner, 0), 10, 'reines Laufspiel');
  assert.equal(vorteil(angriff, gegner, 0.5), 10);

  // Und wenn die beiden Duelle auseinanderlaufen, entscheidet die Ausrichtung.
  const einseitig = werte(70, 40, 0, 0);
  assert.equal(vorteil(einseitig, gegner, 1), 20);
  assert.equal(vorteil(einseitig, gegner, 0), 10);
  assert.equal(vorteil(einseitig, gegner, 0.25), 12.5);
});

test('ein Laufteam nutzt eine schwache Laufverteidigung', () => {
  // Das Kernversprechen von Inkrement 5: die beiden Duelle werden getrennt
  // ausgespielt. Dieselbe Mannschaft, zwei Gegner, die sich nur in der
  // Laufverteidigung unterscheiden.
  const angriff = werte(50, 50, 0, 0);
  const loechrig = werte(0, 0, 55, 35);
  const dicht = werte(0, 0, 55, 55);

  const laufend = 0.15;
  assert.ok(vorteil(angriff, loechrig, laufend) > vorteil(angriff, dicht, laufend));
  // Wer wirft, merkt den Unterschied kaum.
  const werfend = 0.95;
  const differenz = vorteil(angriff, loechrig, werfend) - vorteil(angriff, dicht, werfend);
  assert.ok(differenz < 2, `werfend macht es ${differenz} Punkte aus`);
});

test('die Ausrichtung entscheidet im echten Spiel mit', () => {
  resetSpielerIds();
  const heim = { id: 'h', kader: macheKader(makeRng('lp-h'), 58, 5) };
  const gast = { id: 'g', kader: macheKader(makeRng('lp-g'), 58, 5) };

  const h = teamStaerken(heim.kader, 1);
  const g = teamStaerken(gast.kader, 1);

  /** @param {number} anteil */
  const punkte = (anteil) => {
    let summe = 0;
    for (let i = 0; i < 400; i++) {
      summe += simuliereSpiel(makeRng('lp' + i),
        { ...heim, passAnteil: anteil }, gast, 1).heimPunkte;
    }
    return summe / 400;
  };

  const laufend = punkte(0.15);
  const werfend = punkte(0.85);
  assert.notEqual(laufend, werfend, 'die Ausrichtung wirkt überhaupt');

  // Und sie wirkt in der Richtung, die der Vorteil vorgibt.
  const erwartet = vorteil(h, g, 0.15) - vorteil(h, g, 0.85);
  assert.equal(Math.sign(laufend - werfend), Math.sign(erwartet),
    `Punkte ${laufend.toFixed(2)} gegen ${werfend.toFixed(2)}, Vorteil ${erwartet.toFixed(2)}`);
});

test('der Passanteil kommt aus der Gruppierung, wenn niemand ihn verschiebt', () => {
  assert.equal(passAnteilVon({ personnel: '32' }), PERSONNEL['32'].passAnteil);
  assert.equal(passAnteilVon({ personnel: '00' }), PERSONNEL['00'].passAnteil);
  assert.equal(passAnteilVon({}), PERSONNEL['11'].passAnteil, 'ohne Angabe das Standardsystem');
  assert.equal(passAnteilVon({ personnel: '32', passAnteil: 0.4 }), 0.4, 'der Manager sticht');
  assert.equal(passAnteilVon({ passAnteil: 5 }), 1, 'und bleibt im Rahmen');
});

test('der gemischte Angriffswert liegt zwischen seinen Hälften', () => {
  const s = werte(60, 40, 0, 0);
  assert.equal(angriffGemischt(s, 1), 60);
  assert.equal(angriffGemischt(s, 0), 40);
  assert.equal(angriffGemischt(s, 0.5), 50);
});

test('der Box Score folgt der Ausrichtung des Vereins', () => {
  resetSpielerIds();
  const heim = { id: 'h', kader: macheKader(makeRng('bx-h'), 60, 5) };
  const gast = { id: 'g', kader: macheKader(makeRng('bx-g'), 60, 5) };

  /** @param {number} anteil */
  const laufAnteil = (anteil) => {
    let lauf = 0;
    let gesamt = 0;
    for (let i = 0; i < 200; i++) {
      const e = simuliereSpiel(makeRng('bx' + i),
        { ...heim, passAnteil: anteil }, gast, 1);
      if (!e.heimStats.rushing || !e.heimStats.passing) continue;
      lauf += e.heimStats.rushing.yards;
      gesamt += e.heimStats.yardsGesamt;
    }
    return lauf / gesamt;
  };

  const doubleWing = laufAnteil(0.20);
  const empty = laufAnteil(0.85);
  assert.ok(doubleWing > empty,
    `laufend ${(doubleWing * 100).toFixed(0)} %, werfend ${(empty * 100).toFixed(0)} %`);
});
