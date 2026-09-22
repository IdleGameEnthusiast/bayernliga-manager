// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ablehnungsAnlass, offeneAblehnungen, lehntAb, ueberzeugungsDrift,
  ueberzeugungsSchritt, ueberzeuge, UEBERZEUGT,
} from '../engine/ueberzeugen.js';
import {
  UEBERZEUGEN_HEIMAT_MIN, UEBERZEUGEN_HALT_GRENZE, UEBERZEUGEN_ABGELEHNT_JE_SPIEL,
  UEBERZEUGEN_KOSTEN, GESPRAECHE_JE_WOCHE, makeRng,
} from '../engine/constants.js';
import { wunschDrift } from '../engine/wunsch.js';
import { macheSpieler, resetSpielerIds } from '../engine/spieler.js';
import {
  neuesSpiel, gespraecheFrei, fuehreUeberzeugenGespraech, bekannteAblehnungen,
} from '../engine/saison.js';

/**
 * Ein Mann, der sich sperren **würde**: lange genug jemand auf seinem Platz
 * und unzufrieden genug, um es zu sagen. Die dritte Bedingung — der weite
 * Weg — hängt am Platz, auf dem er im Test aufläuft.
 * @param {string} position @param {object} [rest]
 */
function veteran(position, rest = {}) {
  resetSpielerIds();
  const sp = macheSpieler(makeRng(`ueberzeugen-${position}`), position, 27);
  return Object.assign(sp, {
    commitment: UEBERZEUGEN_HALT_GRENZE - 10,
    nummer: 42,
    einsaetze: { [position]: UEBERZEUGEN_HEIMAT_MIN + 5 },
    ...rest,
  });
}

// --- Der Anlass ------------------------------------------------------------

test('der unzufriedene Veteran quer über die Einheiten sperrt sich', () => {
  const sp = veteran('MIKE');
  assert.equal(ablehnungsAnlass(sp, 'LG'), 'G');
});

test('auf seinem eigenen Platz sperrt sich niemand', () => {
  const sp = veteran('MIKE');
  assert.equal(ablehnungsAnlass(sp, 'MIKE'), null);
});

test('die Nachbarposition derselben Gruppe ist eine Umstellung, keine Zumutung', () => {
  // MIKE nach WILL: dieselbe Coaching-Gruppe. Genau dieser Fall muss
  // durchgehen, sonst zieht die Mechanik bei jeder Umstellung — und
  // Umschulen ist ein Kern des Spiels.
  const sp = veteran('MIKE');
  assert.equal(ablehnungsAnlass(sp, 'WILL'), null);
});

test('wer zufrieden ist, probiert es', () => {
  const sp = veteran('MIKE', { commitment: UEBERZEUGEN_HALT_GRENZE });
  assert.equal(ablehnungsAnlass(sp, 'LG'), null, 'genau an der Schwelle noch nicht');
});

test('ein Neuzugang tut, was man ihm sagt', () => {
  const sp = veteran('MIKE', { einsaetze: { MIKE: UEBERZEUGEN_HEIMAT_MIN - 1 } });
  assert.equal(ablehnungsAnlass(sp, 'LG'), null);
});

test('ohne Bindung am Mann gibt es keine Ablehnung', () => {
  // Ein Stand von vor Block 7. `bindungVon()` zieht den Wert nach, bevor hier
  // jemand fragt — passiert es doch nicht, wird nichts erfunden.
  const sp = veteran('MIKE');
  sp.commitment = undefined;
  assert.equal(ablehnungsAnlass(sp, 'LG'), null);
});

/**
 * Ein Mann, bei dem die Umschulung **durchgezogen** wurde: als Linebacker
 * ausgebildet, seit Jahren Cornerback, und die Attribute sind mitgewandert.
 * Genau dann kippt `hauptPlatz()` — die Einsätze allein reichen dafür nicht,
 * er muss dort auch mindestens so stark sein.
 */
function angekommen() {
  resetSpielerIds();
  const sp = macheSpieler(makeRng('angekommen'), 'MIKE', 29);
  resetSpielerIds();
  const vorbild = macheSpieler(makeRng('vorbild'), 'CB', 29);
  return Object.assign(sp, {
    attribute: { ...vorbild.attribute },
    gewicht: vorbild.gewicht,
    einsaetze: { MIKE: 30, CB: 200 },
    commitment: UEBERZEUGEN_HALT_GRENZE - 10,
    nummer: 42,
  });
}

test('gemessen wird gegen den Hauptplatz, nicht gegen die Ausbildung', () => {
  // Der Roster führt ihn als Cornerback, und das ist für ihn die Wahrheit.
  // Der Weg **zurück** auf seine gelernte Position ist von dort aus genauso
  // weit wie jeder andere — eine Ausbildung, die er selbst nicht mehr so
  // sieht, wäre eine Heimat auf dem Papier.
  const sp = angekommen();
  assert.equal(ablehnungsAnlass(sp, 'CB'), null, 'dort ist er zu Hause');
  assert.equal(ablehnungsAnlass(sp, 'MIKE'), 'MIKE', 'auch der Rückweg ist ein Weg');
});

// --- Was ein Spiel daran bewegt --------------------------------------------

test('das erste Spiel ist frei — er sagt es hinterher', () => {
  const sp = veteran('MIKE');
  const vorher = sp.commitment;
  const widerstand = ueberzeugungsDrift(sp, ['LG']);
  assert.deepEqual(widerstand, { position: 'G', delta: 0, neu: true });
  assert.equal(sp.commitment, vorher, 'der Nachmittag selbst kostet nichts');
  assert.deepEqual(offeneAblehnungen(sp), ['G']);
});

test('ab dem zweiten Spiel kostet es jedes Mal', () => {
  const sp = veteran('MIKE');
  ueberzeugungsDrift(sp, ['LG']);
  const vorher = /** @type {number} */ (sp.commitment);

  const widerstand = ueberzeugungsDrift(sp, ['LG']);
  assert.equal(widerstand?.neu, false);
  assert.equal(widerstand?.delta, -UEBERZEUGEN_ABGELEHNT_JE_SPIEL);
  assert.equal(sp.commitment, vorher - UEBERZEUGEN_ABGELEHNT_JE_SPIEL);
});

test('wer woanders aufläuft, zahlt für seine Ablehnung nicht', () => {
  const sp = veteran('MIKE');
  ueberzeugungsDrift(sp, ['LG']);
  const vorher = sp.commitment;
  assert.equal(ueberzeugungsDrift(sp, ['MIKE']), null);
  assert.equal(sp.commitment, vorher);
});

test('höchstens eine Position je Nachmittag', () => {
  // Offense und Defense in einem Spiel: zwei weite Wege, ein Abzug.
  const sp = veteran('MIKE');
  ueberzeugungsDrift(sp, ['LG']);
  ueberzeugungsDrift(sp, ['CB']);
  const vorher = /** @type {number} */ (sp.commitment);

  const widerstand = ueberzeugungsDrift(sp, ['LG', 'CB']);
  assert.equal(widerstand?.delta, -UEBERZEUGEN_ABGELEHNT_JE_SPIEL);
  assert.equal(sp.commitment, vorher - UEBERZEUGEN_ABGELEHNT_JE_SPIEL);
});

test('eine überzeugte Position entsteht nicht noch einmal', () => {
  const sp = veteran('MIKE');
  ueberzeugungsDrift(sp, ['LG']);
  /** @type {Record<string, number>} */ (sp.abgelehntePositionen).G = UEBERZEUGT;

  assert.equal(ueberzeugungsDrift(sp, ['LG']), null, 'kein Abzug und keine neue Ablehnung');
  assert.deepEqual(offeneAblehnungen(sp), []);
});

test('wer dort zu Hause angekommen ist, sperrt sich nicht mehr', () => {
  // Der teure zweite Weg: durchziehen. Kippt der Hauptplatz, ist die
  // Umschulung eine Tatsache und der Eintrag erledigt sich still.
  const sp = angekommen();
  sp.einsaetze = { MIKE: 30, CB: 5 };            // damals, kurz nach der Umstellung
  ueberzeugungsDrift(sp, ['CB']);
  assert.deepEqual(offeneAblehnungen(sp), ['CB']);

  sp.einsaetze = { MIKE: 30, CB: 200 };          // Jahre später, und er ist einer
  const vorher = sp.commitment;
  assert.equal(ueberzeugungsDrift(sp, ['CB']), null);
  assert.equal(sp.commitment, vorher, 'kein Abzug mehr');
  assert.deepEqual(offeneAblehnungen(sp), []);
});

test('ein Nachmittag, ein Abzug — der Wunsch rechnet nicht noch einmal', () => {
  // Er will zurück auf MIKE und steht auf einer Position, gegen die er sich
  // obendrein sperrt. Das ist **ein** schlechter Samstag.
  const sp = veteran('MIKE', { wunschPlatz: 'MIKE' });
  ueberzeugungsDrift(sp, ['LG']);
  const vorher = /** @type {number} */ (sp.commitment);

  const widerstand = ueberzeugungsDrift(sp, ['LG']);
  wunschDrift(sp, ['LG'], widerstand !== null && widerstand.delta < 0);
  assert.equal(sp.commitment, vorher - UEBERZEUGEN_ABGELEHNT_JE_SPIEL);
});

// --- Das Überzeugen --------------------------------------------------------

test('das Tempo hängt am Halt und an der Nähe der Positionen', () => {
  const nah = veteran('MIKE');       // MIKE → CB: andere Gruppe, gleiche Einheit
  const weit = veteran('MIKE');      // MIKE → G: über die Einheiten hinweg
  assert.ok(ueberzeugungsSchritt(nah, 'CB') > ueberzeugungsSchritt(weit, 'G'));

  const froh = veteran('MIKE', { commitment: 90 });
  assert.ok(ueberzeugungsSchritt(froh, 'G') > ueberzeugungsSchritt(weit, 'G'));
});

test('ein einzelnes Gespräch reicht nie', () => {
  const sp = veteran('MIKE');
  ueberzeugungsDrift(sp, ['LG']);

  const zureden = ueberzeuge(sp, 'G');
  assert.equal(zureden?.ueberzeugt, false);
  assert.equal(zureden?.ton, 0);
  assert.ok(lehntAb(sp, 'G'), 'er sperrt sich weiter');
});

test('jedes Drängen kostet, auch das, das nichts bringt', () => {
  const sp = veteran('MIKE');
  ueberzeugungsDrift(sp, ['LG']);
  const vorher = /** @type {number} */ (sp.commitment);

  const zureden = ueberzeuge(sp, 'G');
  assert.equal(zureden?.delta, -UEBERZEUGEN_KOSTEN);
  assert.equal(sp.commitment, vorher - UEBERZEUGEN_KOSTEN);
});

test('wer lange genug zuredet, kommt durch — und dann ist Ruhe', () => {
  const sp = veteran('MIKE');
  ueberzeugungsDrift(sp, ['LG']);

  let runden = 0;
  let letzte = null;
  while (lehntAb(sp, 'G') && runden < 50) {
    letzte = ueberzeuge(sp, 'G');
    runden++;
  }
  assert.ok(runden > 2 && runden < 20, `unerwartet viele oder wenige Gespräche: ${runden}`);
  assert.equal(letzte?.ueberzeugt, true);
  assert.equal(letzte?.ton, 2);
  assert.deepEqual(offeneAblehnungen(sp), []);

  const vorher = sp.commitment;
  assert.equal(ueberzeugungsDrift(sp, ['LG']), null, 'jetzt kostet die Position nichts mehr');
  assert.equal(sp.commitment, vorher);
});

test('unterwegs klingt es anders als am Anfang', () => {
  const sp = veteran('MIKE', { commitment: 39 });
  ueberzeugungsDrift(sp, ['CB']);   // die nähere Strecke, damit es schneller geht
  assert.equal(ueberzeuge(sp, 'CB')?.ton, 0);
  ueberzeuge(sp, 'CB');
  const drittes = ueberzeuge(sp, 'CB');
  assert.equal(drittes?.ton, 1, 'er widerspricht nicht mehr sofort');
  assert.equal(drittes?.ueberzeugt, false, 'aber durch ist es noch nicht');
});

test('wo nichts abgelehnt ist, gibt es nichts zu überzeugen', () => {
  const sp = veteran('MIKE');
  assert.equal(ueberzeuge(sp, 'G'), null);
  assert.equal(sp.abgelehntePositionen, undefined, 'und es entsteht auch nichts');
});

// --- Am Spielstand ---------------------------------------------------------

test('das Überzeugen kostet einen Termin', () => {
  const s = neuesSpiel('heg', 'ueberzeugen');
  const sp = s.kader[s.meinTeam][0];
  Object.assign(sp, {
    commitment: UEBERZEUGEN_HALT_GRENZE - 10,
    einsaetze: { ...sp.einsaetze, [sp.position]: UEBERZEUGEN_HEIMAT_MIN + 5 },
    abgelehntePositionen: { CB: 0 },
  });

  assert.deepEqual(bekannteAblehnungen(s, sp.id), ['CB']);
  const vorher = gespraecheFrei(s);
  assert.ok(fuehreUeberzeugenGespraech(s, sp.id, 'CB'));
  assert.equal(gespraecheFrei(s), vorher - 1);
});

test('ein Aufruf ohne Ablehnung verbraucht nichts', () => {
  const s = neuesSpiel('heg', 'ueberzeugenleer');
  const sp = s.kader[s.meinTeam][0];
  assert.equal(fuehreUeberzeugenGespraech(s, sp.id, 'CB'), null);
  assert.equal(s.gespraeche.length, 0);
  assert.deepEqual(bekannteAblehnungen(s, 'gibtsnicht'), []);
});

test('ohne Kontingent wird nicht gedrängt', () => {
  const s = neuesSpiel('heg', 'ueberzeugenvoll');
  const kader = s.kader[s.meinTeam];
  for (const sp of kader) sp.abgelehntePositionen = { CB: 0 };
  for (let i = 0; i < GESPRAECHE_JE_WOCHE; i++) fuehreUeberzeugenGespraech(s, kader[i].id, 'CB');
  assert.equal(gespraecheFrei(s), 0);
  assert.equal(fuehreUeberzeugenGespraech(s, kader[10].id, 'CB'), null);
});
