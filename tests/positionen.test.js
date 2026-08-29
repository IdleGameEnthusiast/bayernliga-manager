// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { POSITIONS, ATTRIBUTE } from '../engine/constants.js';
import {
  FORMELN, PROFIL_BEITRAG, KOERPER_KORRIDOR, korridorMitte,
  profilPassAnteil, gemischteFormel, generierungsProfil, bewerte,
} from '../engine/positionen.js';

test('jede Position hat beide Formeln, einen Korridor und einen Beitrag', () => {
  for (const pos of POSITIONS) {
    assert.ok(FORMELN[pos], `${pos} hat keine Formeln`);
    assert.ok(KOERPER_KORRIDOR[pos], `${pos} hat keinen Körperkorridor`);
    assert.ok(PROFIL_BEITRAG[pos], `${pos} hat keinen Profilbeitrag`);
  }
  assert.equal(Object.keys(FORMELN).length, POSITIONS.length);
});

test('jede Formelspalte summiert auf hundert und kennt nur echte Attribute', () => {
  for (const pos of POSITIONS) {
    for (const art of /** @type {const} */ (['pass', 'lauf'])) {
      const formel = FORMELN[pos][art];
      const summe = Object.values(formel).reduce((a, b) => a + b, 0);
      assert.equal(summe, 100, `${pos} ${art} summiert auf ${summe}`);
      for (const attribut of Object.keys(formel)) {
        assert.ok(ATTRIBUTE.includes(/** @type {any} */ (attribut)),
          `${pos} ${art} kennt ${attribut} nicht`);
      }
    }
  }
});

test('technik steht in jeder einzelnen Formel', () => {
  // Sie ist der Träger des Umstellungsabschlags: fehlt sie irgendwo, kostet
  // eine Umstellung auf diese Position nichts.
  for (const pos of POSITIONS) {
    assert.ok(FORMELN[pos].pass.technik > 0, `${pos} Pass ohne Technik`);
    assert.ok(FORMELN[pos].lauf.technik > 0, `${pos} Lauf ohne Technik`);
  }
});

test('die Korridormitten ergeben die Körperbänder der Liga', () => {
  // Die Leichten bis 97, die Mitte 103 bis 113, die Schweren ab 120 — das soll
  // aus den Korridoren fallen und nicht eigens gepflegt werden.
  assert.equal(korridorMitte('SL'), 81.5);
  assert.equal(korridorMitte('CB'), 82.5);
  assert.equal(korridorMitte('QB'), 92.5);
  assert.equal(korridorMitte('MLB'), 109);
  assert.equal(korridorMitte('T'), 125);
  assert.equal(korridorMitte('NT'), 137.5);

  const leicht = ['SL', 'CB', 'WR', 'FS', 'RB', 'QB', 'SS', 'WILL'];
  const schwer = ['G', 'T', 'DT', 'NT'];
  for (const l of leicht) assert.ok(korridorMitte(l) < 98, `${l} ist zu schwer`);
  for (const s of schwer) assert.ok(korridorMitte(s) >= 120, `${s} ist zu leicht`);

  for (const pos of POSITIONS) {
    const k = KOERPER_KORRIDOR[pos];
    assert.ok(k.groesse[0] < k.groesse[1], `${pos}: Größenkorridor verdreht`);
    assert.ok(k.gewicht[0] < k.gewicht[1], `${pos}: Gewichtskorridor verdreht`);
  }
});

test('das Profil wiegt nach dem Beitrag, nicht halbe-halbe', () => {
  assert.ok(Math.abs(profilPassAnteil('QB') - 0.67) < 0.01);
  assert.ok(Math.abs(profilPassAnteil('CB') - 0.78) < 0.01);
  assert.ok(Math.abs(profilPassAnteil('SAM') - 0.29) < 0.01);

  // Der Receiver darf nicht als Blocker aus der Ziehung kommen: seine
  // Laufformel ist blocken 50, gemittelt wäre Blocken sein größtes Attribut.
  const wr = generierungsProfil('WR');
  assert.ok(wr.fangen > wr.blocken, 'ein WR fängt lieber als er blockt');
  const halbeHalbe = gemischteFormel('WR', 0.5);
  assert.ok(halbeHalbe.blocken > halbeHalbe.fangen,
    'ohne die Gewichtung wäre genau das passiert');
});

test('eine gemischte Formel summiert auf eins', () => {
  for (const pos of POSITIONS) {
    for (const anteil of [0, 0.35, 0.7, 1]) {
      const summe = Object.values(gemischteFormel(pos, anteil)).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(summe - 1) < 1e-9, `${pos} bei ${anteil}: ${summe}`);
    }
  }
});

test('bewerte liest die Formel als gewichtetes Mittel', () => {
  /** @type {Record<string, number>} */
  const gleich = {};
  for (const attribut of ATTRIBUTE) gleich[attribut] = 50;
  for (const pos of POSITIONS) {
    assert.ok(Math.abs(bewerte(gleich, generierungsProfil(pos)) - 50) < 1e-9, pos);
  }
});
