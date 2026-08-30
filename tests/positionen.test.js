// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  POSITIONS, ATTRIBUTE, GRUPPE_JE_POSITION, EINHEIT_JE_GRUPPE,
} from '../engine/constants.js';
import { ziehAttribute } from '../engine/spieler.js';
import {
  FORMELN, PROFIL_BEITRAG, KOERPER_KORRIDOR, korridorMitte,
  profilPassAnteil, gemischteFormel, generierungsProfil, bewerte,
  technikTransfer, koerperMalus, eignung, eignungGemischt,
  SEITEN_POSITIONEN, PLAETZE, positionsKuerzel, platzKuerzel,
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
  assert.equal(korridorMitte('MIKE'), 109);
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

// --- Eignung ---------------------------------------------------------------

/**
 * Ein Musterspieler seiner Position: kein Rauschen, Körper in der Korridor-
 * mitte, Stärke 50. Damit ist jeder Vergleich hier reproduzierbar und misst
 * das Modell statt die Ziehung.
 * @param {string} position
 * @param {'L'|'R'} [seite]
 */
function muster(position, seite = 'L') {
  const [von, bis] = KOERPER_KORRIDOR[position].gewicht;
  const gewicht = (von + bis) / 2;
  // Vier gleiche Ziehungen ergeben in randNormal exakt null Abweichung.
  return {
    position,
    seite: SEITEN_POSITIONEN.includes(/** @type {any} */ (position)) ? seite : null,
    gewicht,
    attribute: ziehAttribute(() => 0.5, position, 50, gewicht),
  };
}

/** Der Platz, auf dem ein Musterspieler seiner Position zu Hause ist. */
const HEIMAT = {
  QB: 'QB', RB: 'RB', FB: 'FB', WR: 'WR', SL: 'SL', TE: 'TE',
  T: 'LT', G: 'LG', C: 'C', DE: 'LE', DT: 'DT', NT: 'NT',
  MIKE: 'MIKE', SAM: 'SAM', WILL: 'WILL', CB: 'CB1', FS: 'FS', SS: 'SS',
};

/** Was eine Umstellung kostet, gemittelt über Lauf und Pass. */
function umstellungskosten(von, nach) {
  const s = muster(von);
  let summe = 0;
  for (const art of /** @type {const} */ (['pass', 'lauf'])) {
    summe += 1 - eignung(s, HEIMAT[nach], art) / eignung(s, HEIMAT[von], art);
  }
  return summe / 2;
}

test('auf dem eigenen Platz kostet die Technik nichts', () => {
  for (const pos of POSITIONS) {
    assert.equal(technikTransfer(muster(pos), HEIMAT[pos]), 1, pos);
    assert.equal(koerperMalus(pos, pos), 0, pos);
  }
});

test('die Seite kostet, was die Position sagt', () => {
  assert.equal(technikTransfer(muster('DE'), 'RE'), 0.98);
  assert.equal(technikTransfer(muster('G'), 'RG'), 0.92);
  assert.equal(technikTransfer(muster('T'), 'RT'), 0.90);
  assert.equal(technikTransfer(muster('T', 'R'), 'RT'), 1, 'auf seiner eigenen Seite nichts');
});

test('nur wo die Seite etwas kostet, hat eine Position überhaupt eine', () => {
  // Beim Cornerback und beim Receiver kostete sie nichts, also gibt es sie
  // nicht mehr — weder am Spieler noch am Platz.
  assert.deepEqual([...SEITEN_POSITIONEN], ['T', 'G', 'DE']);
  assert.equal(muster('CB').seite, null);
  assert.equal(muster('WR').seite, null);
  for (const platz of ['WR', 'CB1', 'CB2']) {
    assert.equal(PLAETZE[platz].seite, undefined, platz);
  }
  assert.equal(technikTransfer(muster('CB'), 'CB2'), 1, 'und sie kostet weiter nichts');
});

test('die Kürzel schreiben die Seite vor die Position, sonst nichts', () => {
  assert.equal(positionsKuerzel(muster('T', 'R')), 'RT');
  assert.equal(positionsKuerzel(muster('G', 'L')), 'LG');
  assert.equal(positionsKuerzel(muster('DE', 'R')), 'RE');
  assert.equal(positionsKuerzel(muster('CB')), 'CB');
  assert.equal(positionsKuerzel(muster('WR')), 'WR');
  assert.equal(positionsKuerzel(muster('MIKE')), 'MIKE');
  // Zwei gleichwertige Plätze tragen denselben Namen.
  assert.equal(platzKuerzel('CB1'), 'CB');
  assert.equal(platzKuerzel('CB2'), 'CB');
  assert.equal(platzKuerzel('LT'), 'LT');
  // Jedes Kürzel eines Spielers auf seinem Heimatplatz ist der Platzname.
  for (const pos of POSITIONS) {
    assert.equal(positionsKuerzel(muster(pos)), platzKuerzel(HEIMAT[pos]), pos);
  }
});

test('die Stufenleiter fällt von der Gruppe über die Einheit nach draußen', () => {
  const t = muster('T');
  assert.equal(technikTransfer(t, 'LG'), 0.70, 'Nachbarposition derselben Gruppe');
  assert.equal(technikTransfer(t, 'TE'), 0.45, 'andere Gruppe, dieselbe Einheit');
  assert.equal(technikTransfer(t, 'LE'), 0.25, 'andere Einheit');
});

test('der Körpermalus wächst mit dem Gewichtsabstand und ist gedeckelt', () => {
  // 0,4 % je Kilo Abstand der Korridormitten.
  assert.ok(Math.abs(koerperMalus('T', 'G') - 5 * 0.004) < 1e-9);
  assert.ok(Math.abs(koerperMalus('CB', 'FS') - 6 * 0.004) < 1e-9);
  // NT 137,5 gegen SL 81,5 sind 56 Kilo — der Deckel greift.
  assert.equal(koerperMalus('NT', 'SL'), 0.20);
  assert.equal(koerperMalus('SL', 'NT'), 0.20, 'und zwar in beide Richtungen');
});

test('ein Tight End spielt Tackle, ein Receiver nicht', () => {
  // Das Kernversprechen des Modells: wer den Körper und das halbe Handwerk
  // mitbringt, springt ein — wer beides nicht hat, fällt durch.
  const te = eignung(muster('TE'), 'LT', 'lauf');
  const wr = eignung(muster('WR'), 'LT', 'lauf');
  const echt = eignung(muster('T'), 'LT', 'lauf');
  assert.ok(te > wr, `TE ${te.toFixed(1)} gegen WR ${wr.toFixed(1)} auf LT`);
  assert.ok(echt > te, 'der ausgebildete Tackle steht trotzdem vorn');
});

test('die Umstellung ist unsymmetrisch', () => {
  // Ein Tight End kann Tackle spielen, ein Tackle keinen Tight End.
  assert.ok(umstellungskosten('TE', 'T') < umstellungskosten('T', 'TE'));
  // Dasselbe eine Nummer schwerer: der Nose Tackle ist der Sonderfall.
  assert.ok(umstellungskosten('DT', 'NT') < umstellungskosten('NT', 'DT'));
});

test('der Quarterback ist eine Insel', () => {
  const raus = POSITIONS.filter((p) => p !== 'QB').map((p) => umstellungskosten('QB', p));
  const rein = POSITIONS.filter((p) => p !== 'QB').map((p) => umstellungskosten(p, 'QB'));
  assert.ok(Math.min(...raus) > 0.15, 'niemand kommt billig von ihm weg');
  assert.ok(Math.min(...rein) > 0.15, 'und niemand billig zu ihm hin');
});

test('die Umstellungskosten treffen die Sollwerte aus dem Bauplan', () => {
  // Abschnitt 4: Gruppe 13,5 %, Einheit 26,5 %, quer 35,6 %, alle 29,9 %.
  // Die Implementierung läuft rund drei Punkte darüber — die Bänder hier sind
  // die Regressionsgrenze, nicht der Sollwert selbst.
  const stufe = { gruppe: [], einheit: [], quer: [] };
  for (const a of POSITIONS) {
    for (const b of POSITIONS) {
      if (a === b) continue;
      const kosten = umstellungskosten(a, b);
      assert.ok(kosten > 0 && kosten < 0.65, `${a} -> ${b}: ${kosten}`);
      const ga = GRUPPE_JE_POSITION[a];
      const gb = GRUPPE_JE_POSITION[b];
      if (ga === gb) stufe.gruppe.push(kosten);
      else if (EINHEIT_JE_GRUPPE[ga] === EINHEIT_JE_GRUPPE[gb]) stufe.einheit.push(kosten);
      else stufe.quer.push(kosten);
    }
  }
  assert.equal(stufe.gruppe.length + stufe.einheit.length + stufe.quer.length, 306);

  const schnitt = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  const inBand = (wert, von, bis, was) =>
    assert.ok(wert > von && wert < bis, `${was}: ${(wert * 100).toFixed(1)} %`);

  inBand(schnitt(stufe.gruppe), 0.10, 0.18, 'innerhalb der Gruppe');
  inBand(schnitt(stufe.einheit), 0.24, 0.34, 'andere Gruppe, gleiche Einheit');
  inBand(schnitt(stufe.quer), 0.33, 0.44, 'über die Einheiten hinweg');

  // Die Leiter muss in dieser Reihenfolge stehen, sonst stimmt das Modell nicht.
  assert.ok(schnitt(stufe.gruppe) < schnitt(stufe.einheit));
  assert.ok(schnitt(stufe.einheit) < schnitt(stufe.quer));
});

test('die gemischte Eignung liegt zwischen ihren beiden Hälften', () => {
  const s = muster('WR');
  const pass = eignung(s, 'WR', 'pass');
  const lauf = eignung(s, 'WR', 'lauf');
  assert.ok(Math.abs(eignungGemischt(s, 'WR', 1) - pass) < 1e-9);
  assert.ok(Math.abs(eignungGemischt(s, 'WR', 0) - lauf) < 1e-9);
  const halb = eignungGemischt(s, 'WR', 0.5);
  assert.ok(halb > Math.min(pass, lauf) && halb < Math.max(pass, lauf));
});

test('ein unbekannter Platz wirft', () => {
  assert.throws(() => technikTransfer(muster('QB'), 'LSL'), /Unbekannter Platz/);
});
