// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng, AUSGEWOGENHEIT, RATING_TO_POINTS } from '../engine/constants.js';
import { macheKader, resetSpielerIds } from '../engine/spieler.js';
import {
  simuliereSpiel, baueScore, vorteil, vorteilTeile, bestesPassAnteil,
  angriffGemischt, passAnteilVon,
} from '../engine/spiel.js';
import { teamStaerken, gesamtStaerke } from '../engine/team.js';
import { PERSONNEL } from '../engine/aufstellung.js';
import { neuesSpiel } from '../engine/saison.js';
import { TEAMS } from '../engine/content.js';

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
    special: 40,
  });
}

/**
 * Der Passanteil, bei dem `vorteil()` sein Maximum hat.
 *
 * Die Engine rechnet ihn selbst, seit die Taktikansicht ihn auf der
 * Reglerskala markiert. Der Test benutzt genau den Weg, den das Spiel geht,
 * statt einen zweiten daneben zu stellen, der still auseinanderlaufen könnte.
 */
const optimum = bestesPassAnteil;

test('bei 50/50 mischt der Vorteil die beiden Duelle blank', () => {
  // Die Strafe für Einseitigkeit ist genau in der Mitte null. Dort und nur dort
  // steht das nackte Mittel der beiden Duelle — daran hängt die Eichung von
  // BASE_POINTS.
  const angriff = werte(60, 40, 0, 0);
  const gegner = werte(0, 0, 50, 30);
  assert.equal(vorteil(angriff, gegner, 0.5), 10);

  const einseitig = werte(70, 40, 0, 0);
  assert.equal(vorteil(einseitig, gegner, 0.5), 15);
});

test('kein Ende ist je das Beste — auch bei absurd schiefem Kader nicht', () => {
  // Die Garantie der Entropie: ihre Ableitung geht am Rand gegen unendlich,
  // also schlägt *irgendein* innerer Punkt jedes Ende. Das gilt ohne Klammerung
  // und ohne Sonderfall, auch für Kader, die es in der Liga nicht gibt.
  const gegner = werte(0, 0, 50, 50);
  for (let pa = 5; pa <= 95; pa += 5) {
    const a = werte(pa, 100 - pa, 0, 0);
    const beste = vorteil(a, gegner, optimum(a, gegner));
    assert.ok(beste > vorteil(a, gegner, 0), `Pass ${pa}: 0 % schlägt das Optimum`);
    assert.ok(beste > vorteil(a, gegner, 1), `Pass ${pa}: 100 % schlägt das Optimum`);
  }
});

test('bei echten Kadern bleibt das Optimum aus dem Randband heraus', () => {
  // Das Randband ist 3 % breit. Solange die beiden Angriffswerte höchstens rund
  // zwanzig Punkte auseinanderliegen — und weiter treibt sie keine Gruppierung —
  // liegt das Optimum mit Abstand davor, die Klippe also im Weg und nicht im Spiel.
  const gegner = werte(0, 0, 52, 48);
  for (let d = -20; d <= 20; d += 2) {
    const a = optimum(werte(50 + d / 2, 50 - d / 2, 0, 0), gegner);
    assert.ok(a > 0.05 && a < 0.95, `d ${d}: Optimum bei ${a.toFixed(3)}`);
  }
});

test('das Optimum folgt der Sigmoide über AUSGEWOGENHEIT', () => {
  // Die geschlossene Form, auf der die ganze Eichung ruht:
  //   a* = sigmoid(((passAngriff - laufAngriff) - (passVert - laufVert)) / AUSGEWOGENHEIT)
  const gegner = werte(0, 0, 52, 48);
  for (const [pa, la] of [[60, 40], [50, 50], [44, 56], [58, 44]]) {
    const d = (pa - la) - (52 - 48);
    const erwartet = 1 / (1 + Math.exp(-d / AUSGEWOGENHEIT));
    const gemessen = optimum(werte(pa, la, 0, 0), gegner);
    assert.ok(Math.abs(gemessen - erwartet) < 0.005,
      `${pa}/${la}: erwartet ${erwartet.toFixed(3)}, gemessen ${gemessen.toFixed(3)}`);
  }
});

test('die letzten Prozent sind nie eine Option', () => {
  // Der Grund für die Klippe: ohne sie kostete reines Passspiel aus einem
  // passstarken Kader heraus Bruchteile eines Punktes und war gegen
  // MATCH_NOISE von 6,5 nicht zu bemerken. Jetzt kostet jedes Ende mehr als
  // drei Punkte, und zwar aus jeder Ausrichtung heraus.
  const gegner = werte(0, 0, 50, 50);
  for (const [pa, la] of [[58, 42], [50, 50], [42, 58]]) {
    const a = werte(pa, la, 0, 0);
    const beste = vorteil(a, gegner, optimum(a, gegner));
    for (const rand of [0, 0.01, 0.99, 1]) {
      const verlust = (beste - vorteil(a, gegner, rand)) * RATING_TO_POINTS;
      assert.ok(verlust > 3, `${pa}/${la} bei ${rand}: nur ${verlust.toFixed(2)} Punkte`);
    }
  }
});

test('vor dem Randband ist die Klippe nicht zu spüren', () => {
  // Sie ist auf [RAND, 1 - RAND] identisch null und schließt dort knickfrei an.
  // Wer den Regler bis 97 % schiebt, merkt von ihr nichts — erst danach.
  const a = werte(58, 42, 0, 0);
  const gegner = werte(0, 0, 50, 50);
  const stufe = (x, y) => Math.abs(vorteil(a, gegner, x) - vorteil(a, gegner, y));
  // 0,32 Stärkepunkte vor dem Band gegen 14,9 darin: derselbe Reglerweg, ein
  // Faktor 45 dazwischen.
  assert.ok(stufe(0.95, 0.97) < 1, 'im ruhigen Bereich läuft es flach');
  assert.ok(stufe(0.98, 1) > 10, 'im Band bricht es weg');
});

test('jede Gruppierung hat ihren Passanteil als Optimum', () => {
  // Das ist die Eichung der `neigung`-Werte, rückwärts nachgerechnet. Der
  // `passAnteil` einer Gruppierung ist keine Meinung, sondern die Vorhersage,
  // wo `vorteil()` beim Durchschnittskader gegen die Durchschnittsverteidigung
  // sein Maximum hat. Wer Skill-Listen, Rollenwerte oder die Kadererzeugung
  // anfasst, verschiebt sie und muss die Neigungen neu messen.
  const staende = ['eich-a', 'eich-b'].map((s) => neuesSpiel(TEAMS[0].id, s));
  /** @type {import('../engine/team.js').Staerken[]} */
  const verteidigungen = [];
  for (const stand of staende) {
    for (const t of TEAMS) verteidigungen.push(teamStaerken(stand.kader[t.id], 1, '11', 0.5));
  }

  for (const id of Object.keys(PERSONNEL)) {
    const optima = [];
    for (const stand of staende) {
      for (const t of TEAMS) {
        const angriff = teamStaerken(stand.kader[t.id], 1, id, 0.5);
        for (const v of verteidigungen) optima.push(optimum(angriff, v, 0.01));
      }
    }
    const mittel = optima.reduce((a, b) => a + b, 0) / optima.length;
    const soll = PERSONNEL[id].passAnteil;
    assert.ok(Math.abs(mittel - soll) < 0.05,
      `${id} ${PERSONNEL[id].name}: Soll ${soll}, gemessen ${mittel.toFixed(3)} `
      + `— die Neigung ${PERSONNEL[id].neigung} passt nicht mehr`);
  }
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

test('die Aufschlüsselung ist derselbe Vorteil, nur einzeln', () => {
  // `vorteil()` ist die Summe von `vorteilTeile()` und sonst nichts. Sobald das
  // zwei Rechnungen wären, zeigte der Taktikreiter etwas anderes an, als die
  // Simulation spielt — und niemand merkte es.
  const angriff = werte(58, 44, 0, 0);
  const gegner = werte(0, 0, 51, 49);
  for (const a of [0, 0.02, 0.2, 0.5, 0.85, 1]) {
    const t = vorteilTeile(angriff, gegner, a);
    assert.equal(t.pass + t.lauf + t.einseitig + t.klippe, t.summe);
    assert.equal(t.summe, vorteil(angriff, gegner, a));
  }
});

test('die beiden Strafen sind nie positiv, und in der Mitte beide null', () => {
  const angriff = werte(58, 44, 0, 0);
  const gegner = werte(0, 0, 51, 49);
  for (let a = 0; a <= 1.0001; a += 0.05) {
    const t = vorteilTeile(angriff, gegner, Math.min(a, 1));
    assert.ok(t.einseitig <= 0, `Einseitigkeit bei ${a.toFixed(2)}: ${t.einseitig}`);
    assert.ok(t.klippe <= 0, `Klippe bei ${a.toFixed(2)}: ${t.klippe}`);
  }
  // Über den Betrag, weil die Entropie in der Mitte ein negatives Null liefert
  // und `assert.equal` das von der positiven unterscheidet.
  const mitte = vorteilTeile(angriff, gegner, 0.5);
  assert.equal(Math.abs(mitte.einseitig), 0);
  assert.equal(Math.abs(mitte.klippe), 0);
});

test('der Regler bewegt den Vorteil, auch wo er die Stärken nicht bewegt', () => {
  // Der Grund, warum die Taktikansicht die Aufschlüsselung zeigt und nicht nur
  // die vier Balken. Im Double Wing liegen die fünf Skill-Plätze fest, also
  // erreicht der Passanteil die Stärkewerte nur noch über die Platzvergabe —
  // gerundet steht dort dieselbe Zahl. Der Vorteil dagegen bricht weg.
  resetSpielerIds();
  const kader = macheKader(makeRng('ausrichtung-eigen'), 60);
  const gegner = teamStaerken(macheKader(makeRng('ausrichtung-gegner'), 60), 5, '11', 0.5);
  const bei = (/** @type {number} */ a) => teamStaerken(kader, 5, '32', a);

  const spanne = Math.abs(bei(1).passAngriff - bei(0.2).passAngriff);
  assert.ok(spanne < 3,
    `die Stärken hängen doch am Regler (${spanne.toFixed(2)}) — dann darf die `
    + 'Ansicht sie wieder als Wirkung zeigen');

  const verloren = vorteil(bei(0.2), gegner, 0.2) - vorteil(bei(1), gegner, 1);
  assert.ok(verloren > 20,
    `100 % Pass aus Double Wing kostet nur ${verloren.toFixed(1)} Stärkepunkte`);
});

test('das Optimum weicht dem Randband aus, wo die Formel hineinliefe', () => {
  // Der Grund fürs Abtasten. Bei absurd schiefem Kader liegt sigmoid(d/A) im
  // Randband, und dort ist die geschlossene Form blind für die Klippe: sie
  // nennte 0,25 %, wo 2,9 % dreizehn Stärkepunkte mehr bringen.
  const gegner = werte(0, 0, 50, 50);
  const angriff = werte(20, 80, 0, 0);
  const formel = 1 / (1 + Math.exp(60 / AUSGEWOGENHEIT));
  const gemessen = bestesPassAnteil(angriff, gegner);
  assert.ok(vorteil(angriff, gegner, gemessen) > vorteil(angriff, gegner, formel) + 10,
    'das Abtasten findet nichts Besseres als die Formel — dann kann es entfallen');
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
