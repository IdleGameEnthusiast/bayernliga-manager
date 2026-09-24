// @ts-check
/**
 * Commitment und Lebenslage, Schritt 1: die Stufen, die Ziehung, und dass ein
 * Stand von vor Block 7 seine Felder aus dem Saatgut nachbekommt.
 *
 * Verteilungen werden nur mit festem Seed geprüft, und nur grob: dass die
 * Werte in ihren Bändern liegen und die Stufen alle vorkommen. Die genauen
 * Zahlen sind Balancing (docs/balancing.md, Abschnitt 10), kein Test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  stufe, ziehLebenslage, ziehCommitment, ziehBindung, ziehHorizont, ziehEntfernung,
  STATUS_REIHE, SCHULE_SPAETESTENS,
} from '../engine/commitment.js';
import { COMMITMENT_STUFEN, makeRng } from '../engine/constants.js';
import {
  neuesSpiel, bindungVon, ergaenzeBindung, coachesVon, naechsteSaison, weiter, meister,
  beantworteNachricht,
} from '../engine/saison.js';
import { offeneAntworten, antwortenZu } from '../engine/postfach.js';
import { TEAMS } from '../engine/content.js';
import { T } from '../i18n.js';

test('die Stufen sind harte Bänder, unten 0 und oben 4', () => {
  assert.equal(stufe(0), 0);
  assert.equal(stufe(COMMITMENT_STUFEN[0] - 1), 0);
  assert.equal(stufe(COMMITMENT_STUFEN[0]), 1);
  assert.equal(stufe(COMMITMENT_STUFEN[1]), 2);
  assert.equal(stufe(COMMITMENT_STUFEN[2]), 3);
  assert.equal(stufe(COMMITMENT_STUFEN[3]), 4);
  assert.equal(stufe(99), 4);
  // Fünf Texte für fünf Stufen — sonst zeigt eine Stufe „undefined".
  assert.equal(T.commitment.stufen.length, 5);
});

test('die Lebenslage passt zum Alter', () => {
  const rng = makeRng('lebenslage');
  for (let i = 0; i < 400; i++) {
    const alter = 16 + (i % 50);
    const l = ziehLebenslage(rng, alter, 2026);
    assert.ok(STATUS_REIHE.includes(l.status), `${l.status} ist kein Status`);
    if (alter <= 19) assert.ok(['schueler', 'azubi'].includes(l.status), `${alter}: ${l.status}`);
    if (alter >= 31 && alter <= 63) assert.equal(l.status, 'arbeiter', `${alter}: ${l.status}`);
    if (alter >= 64) assert.equal(l.status, 'rentner', `${alter}: ${l.status}`);
    assert.ok(l.entfernung >= 1 && l.entfernung <= 120, `${l.entfernung} km`);
    assert.ok(l.seit <= 2026 && l.seit >= 2026 - (alter - 16), `seit ${l.seit} mit ${alter}`);
    if (l.horizont) {
      assert.ok(l.horizont.jahr > 2026, 'der Horizont liegt in der Zukunft');
      assert.equal(l.horizont.km > 0, l.horizont.dann === 'wegzug', 'nur ein Wegzug hat Kilometer');
    }
  }
});

test('das Commitment bleibt im Band und trifft jede Stufe', () => {
  const rng = makeRng('commitment');
  const gesehen = new Set();
  let summe = 0;
  const n = 2000;
  for (let i = 0; i < n; i++) {
    const { commitment } = ziehBindung(rng, 18 + (i % 30), 2026);
    assert.ok(commitment >= 0 && commitment <= 99, `${commitment} liegt außerhalb`);
    gesehen.add(stufe(commitment));
    summe += commitment;
  }
  assert.equal(gesehen.size, 5, 'nicht jede Stufe kommt vor');
  const mittel = summe / n;
  assert.ok(mittel > 35 && mittel < 65, `Mittel ${mittel.toFixed(1)} — die Liga kippt`);
});

test('die Strecke zählt nicht mehr in der Ziehung — sie ist Druck', () => {
  // Gleiche Lebenslage, gleiches Rauschen — nur die Entfernung und das Auto
  // sind anders. Stünde die Strecke noch im Wert, zählte sie mit der Waage
  // doppelt: einmal als niedrigerer Halt, einmal als Druck.
  const basis = ziehLebenslage(makeRng('x'), 25, 2026);
  const nah = { ...basis, entfernung: 3, auto: true };
  const weit = { ...basis, entfernung: 120, auto: false };
  assert.equal(ziehCommitment(makeRng('gleich'), nah, 2026), ziehCommitment(makeRng('gleich'), weit, 2026));
});

test('ein Schluss trägt seinen Grund, ein Arbeiter immer einen Zyklus', () => {
  const rng = makeRng('grund');
  for (let i = 0; i < 300; i++) {
    const l = ziehLebenslage(rng, 22 + (i % 45), 2026);
    if (l.status === 'arbeiter') assert.ok(l.horizont, 'ein Arbeiter ohne Zyklus');
    if (l.horizont && l.horizont.dann === 'schluss') {
      assert.ok(['koerper', 'lust', 'beruf', 'familie'].includes(/** @type {string} */ (l.horizont.grund)),
        `Schluss ohne Grund: ${l.horizont.grund}`);
    }
    if (l.horizont && l.horizont.dann === 'familie') {
      assert.equal(l.status, 'arbeiter', 'nur ein Arbeiter plant Familie');
      assert.equal(l.familie, false, 'er hat schon eine');
    }
  }
});

test('der Satz zur Lebenslage lässt sich für jede Ziehung bauen', () => {
  const rng = makeRng('satz');
  for (let i = 0; i < 300; i++) {
    const l = ziehLebenslage(rng, 16 + (i % 50), 2026);
    for (const jahr of [2026, 2028, 2032]) {
      const satz = T.lebenslage.satz(l, jahr);
      assert.ok(satz.length > 20, satz);
      assert.ok(!satz.includes('undefined') && !satz.includes('NaN'), satz);
    }
  }
});

test('kein Schüler geht über 20 zur Schule — auch nicht in der zweiten Wahrheit', () => {
  // Die Wahrheit war der Weg, auf dem es geschah: sie schob den Abschluss um
  // zwei Jahre, und nach dem Gespräch stand da ein 18-Jähriger mit „noch 3
  // Jahre Schule".
  let geprueft = 0;
  for (let i = 0; i < 3000; i++) {
    const alter = 15 + (i % 5);
    const { lebenslage: l } = ziehBindung(makeRng(`schule${i}`), alter, 2026);
    if (l.status !== 'schueler') continue;
    for (const h of [l.horizont, l.horizontWahrheit]) {
      if (!h) continue;
      geprueft++;
      assert.ok(alter + h.jahr - 2026 <= SCHULE_SPAETESTENS, `mit ${alter} noch ${h.jahr - 2026} Jahre Schule`);
    }
  }
  assert.ok(geprueft > 1000, `nur ${geprueft} Horizonte gesehen`);
});

test('ein laufendes Studium endet nach Plan spätestens mit 29', () => {
  const rng = makeRng('reststudium');
  for (let i = 0; i < 1000; i++) {
    const alter = 24 + (i % 8);
    const h = /** @type {import('../engine/commitment.js').Horizont} */ (
      ziehHorizont(rng, 'student', alter, 2026, false));
    const rest = h.jahr - 2026;
    assert.ok(rest >= 1, 'ein Jahr bleibt immer');
    assert.ok(rest === 1 || alter + rest <= 29, `mit ${alter} noch ${rest} Jahre Studium`);
  }
});

test('der Student eines Vereins ohne Hochschule wohnt oft in der Uni-Stadt', () => {
  const rng = makeRng('unistadt');
  let dort = 0;
  const n = 2000;
  for (let i = 0; i < n; i++) {
    const km = ziehEntfernung(rng, 'student', 50);
    if (km >= 40 && km <= 60) dort++;
    // Mit einer Hochschule im Ort fährt kein Student weiter als von den Eltern.
    assert.ok(ziehEntfernung(rng, 'student', 0) <= 40);
  }
  assert.ok(dort > n * 0.35 && dort < n * 0.65, `${dort} von ${n} in der Uni-Stadt`);
});

test('ferne Pläne klingen unsicher, nahe nennen die Kilometer', () => {
  const lage = (/** @type {any} */ status, /** @type {any} */ horizont) =>
    /** @type {any} */ ({ status, horizont });
  const h = T.lebenslage.horizont;
  assert.equal(h(lage('student', { jahr: 2031, dann: 'wegzug', km: 80 }), 2026),
    'noch 5 Jahre Studium, danach Wegzug geplant');
  assert.equal(h(lage('student', { jahr: 2028, dann: 'wegzug', km: 80 }), 2026),
    'noch 2 Jahre Studium, danach Wegzug, 80 km entfernt');
  assert.equal(h(lage('azubi', { jahr: 2027, dann: 'bleibt', km: 0 }), 2026),
    'noch ein Jahr Ausbildung, will danach bleiben');
  assert.equal(h(lage('arbeiter', { jahr: 2030, dann: 'wegzug', km: 60 }), 2026), 'denkt über einen Wegzug nach');
  assert.equal(h(lage('arbeiter', { jahr: 2027, dann: 'wegzug', km: 60 }), 2026),
    'plant nächstes Jahr den Wegzug, 60 km entfernt');
  assert.equal(h(lage('arbeiter', { jahr: 2029, dann: 'familie', km: 0 }), 2026), 'wünscht sich Familie');
});

test('ein frischer Stand trägt die Bindung an jedem Menschen', () => {
  const stand = neuesSpiel('heg', 'bindung');
  for (const t of TEAMS) {
    for (const s of stand.kader[t.id]) {
      assert.equal(typeof s.commitment, 'number', `${s.id} ohne Commitment`);
      assert.ok(s.lebenslage, `${s.id} ohne Lebenslage`);
    }
    for (const c of coachesVon(stand, t.id)) {
      assert.equal(typeof c.commitment, 'number', `${c.id} ohne Commitment`);
      assert.ok(c.lebenslage, `${c.id} ohne Lebenslage`);
    }
  }
});

test('ein Stand ohne die Felder bekommt sie aus dem Saatgut nachgezogen', () => {
  // Wie beim Stab: die Felder wegnehmen, und `bindungVon()` liefert dieselben
  // wieder — egal, in welcher Reihenfolge gefragt wird.
  const frisch = neuesSpiel('heg', 'nachziehen');
  const alt = neuesSpiel('heg', 'nachziehen');
  for (const t of TEAMS) {
    for (const s of alt.kader[t.id]) { delete s.commitment; delete s.lebenslage; }
    for (const c of coachesVon(alt, t.id)) { delete c.commitment; delete c.lebenslage; }
  }
  const letzter = alt.kader.heg[alt.kader.heg.length - 1];
  const einzeln = bindungVon(alt, letzter);
  ergaenzeBindung(alt);
  assert.deepEqual(einzeln, bindungVon(alt, letzter));
  assert.deepEqual(alt.kader, frisch.kader);
  assert.deepEqual(alt.coaches, frisch.coaches);
});

test('die Rookies nach dem Saisonwechsel tragen die Bindung, die Alten ihre bewegte', () => {
  // Dieser Test prüfte einmal, dass sich **kein** Commitment über eine Saison
  // bewegt. Das galt, bis die Rolle kam: wer ohne Zusage auf der Bank sitzt,
  // verliert seitdem. Hier wird niemandem eine Rolle gesagt — die Antwort auf
  // jede Anfrage ist die erste, und die beantwortet nur die Nachricht —, also
  // ist das der Fall „der Manager kümmert sich nicht".
  const stand = neuesSpiel('heg', 'rookies');
  const vorher = new Map(stand.kader.heg.map((s) => [s.id, s.commitment]));
  for (let i = 0; i < 400 && !meister(stand); i++) {
    for (const n of offeneAntworten(stand)) beantworteNachricht(stand, n.id, antwortenZu(n.art)[0]);
    weiter(stand);
  }
  assert.ok(meister(stand), 'die Saison terminiert');

  // Wer nie auf dem Feld stand, vor dem Wechsel festgehalten: `einsaetze`
  // verfällt beim Saisonwechsel und wäre danach nicht mehr zu lesen.
  const nieGespielt = new Set(stand.kader.heg
    .filter((s) => Object.keys(s.einsaetze || {}).length === 0).map((s) => s.id));
  assert.ok(nieGespielt.size > 0, 'in einem 30er-Kader sitzt immer jemand');

  naechsteSaison(stand);
  let gefallen = 0;
  for (const s of stand.kader.heg) {
    assert.equal(typeof s.commitment, 'number', `${s.id} ohne Commitment`);
    if (!vorher.has(s.id)) {
      assert.ok(s.lebenslage && s.lebenslage.seit <= stand.jahr, `${s.id} ist von der Zukunft`);
      continue;
    }
    // Ohne eine einzige gesetzte Rolle kann nichts steigen: es gibt keine
    // Zusage, die jemand erfüllen könnte.
    assert.ok(s.commitment <= vorher.get(s.id), `${s.id} hat ohne Zusage gewonnen`);
    if (s.commitment < vorher.get(s.id)) gefallen++;
    if (nieGespielt.has(s.id)) {
      assert.ok(s.commitment < vorher.get(s.id), `${s.id} saß die Saison ab, ohne dass es kostete`);
    }
  }
  assert.ok(gefallen > 0, 'niemand hat die Vernachlässigung gespürt');
});
