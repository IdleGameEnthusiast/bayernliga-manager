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
  stufe, ziehLebenslage, ziehCommitment, ziehBindung, STATUS_REIHE,
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

test('die Strecke ohne Auto kostet mehr als mit', () => {
  // Gleiche Lebenslage, gleiches Rauschen — nur das Auto fehlt.
  const basis = ziehLebenslage(makeRng('x'), 25, 2026);
  const weit = { ...basis, entfernung: 60, auto: true };
  const ohne = { ...weit, auto: false };
  assert.ok(ziehCommitment(makeRng('gleich'), ohne, 2026) < ziehCommitment(makeRng('gleich'), weit, 2026));
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

test('die Rookies nach dem Saisonwechsel tragen die Bindung, die Alten behalten ihre', () => {
  const stand = neuesSpiel('heg', 'rookies');
  const vorher = new Map(stand.kader.heg.map((s) => [s.id, s.commitment]));
  // Bis zum Finale, Antwortpflichten mit der ersten Antwort abräumen — wie
  // `bisSaisonende()` in saison.test.js.
  for (let i = 0; i < 400 && !meister(stand); i++) {
    for (const n of offeneAntworten(stand)) beantworteNachricht(stand, n.id, antwortenZu(n.art)[0]);
    weiter(stand);
  }
  assert.ok(meister(stand), 'die Saison terminiert');
  naechsteSaison(stand);
  for (const s of stand.kader.heg) {
    assert.equal(typeof s.commitment, 'number', `${s.id} ohne Commitment`);
    if (vorher.has(s.id)) assert.equal(s.commitment, vorher.get(s.id), `${s.id} hat sich bewegt`);
    else assert.ok(s.lebenslage && s.lebenslage.seit <= stand.jahr, `${s.id} ist von der Zukunft`);
  }
});
