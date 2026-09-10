// @ts-check
/**
 * Der Stab: die Ähnlichkeit der Coaching-Gruppen, der Stärkewert je Rolle und
 * die Ziehung um die halbe Vereinsbasis.
 *
 * Die Ähnlichkeitszahlen sind **abgenommen**, nicht hergeleitet — sie sind die
 * Tabelle, die im Gespräch freigegeben wurde (docs/umbau-coaches.md,
 * Abschnitt 3). Wer eine Formel in `positionen.js` anfasst, sieht hier, dass
 * die Coaches mitgewandert sind, und entscheidet dann, ob das so sein soll.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  aehnlichkeit, gruppenProfil, gruppenPassAnteil, staerke, softWert, schemeWert, technikWert,
  macheCoach, ziehStab, COACHING_GRUPPE_REIHE, COACHING_GRUPPEN, SOFT_SKILLS, SCHEME_SKILLS,
} from '../engine/coach.js';
import {
  makeRng, POSITIONS, COACH_ALTER_MIN, COACH_ALTER_MAX, COACH_BASIS_ANTEIL, COACH_SEITENFAKTOR,
} from '../engine/constants.js';
import { PERSONNEL_REIHE } from '../engine/aufstellung.js';
import { neuesSpiel, coachesVon } from '../engine/saison.js';
import { TEAMS } from '../engine/content.js';

test('jede Position gehört zu genau einer Coaching-Gruppe', () => {
  const zugeordnet = Object.values(COACHING_GRUPPEN).flat();
  assert.deepEqual([...zugeordnet].sort(), [...POSITIONS].sort());
});

test('das Gruppenprofil kennt keine Technik und summiert auf 1', () => {
  for (const g of COACHING_GRUPPE_REIHE) {
    const profil = gruppenProfil(g);
    assert.equal(profil.technik, undefined, `${g} trägt noch Technik`);
    const summe = Object.values(profil).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(summe - 1) < 1e-9, `${g} summiert auf ${summe}`);
  }
});

test('die Ähnlichkeit ist symmetrisch, auf der Diagonale 1 und nie darüber', () => {
  for (const a of COACHING_GRUPPE_REIHE) {
    assert.equal(aehnlichkeit(a, a), 1);
    for (const b of COACHING_GRUPPE_REIHE) {
      assert.equal(aehnlichkeit(a, b), aehnlichkeit(b, a));
      assert.ok(aehnlichkeit(a, b) <= 1 && aehnlichkeit(a, b) >= 0);
    }
  }
});

test('die Ähnlichkeit trifft die abgenommene Tabelle', () => {
  // Die Eckwerte der freigegebenen Tabelle. Prozent, gerundet.
  const erwartet = [
    ['RB', 'TE', 89], ['TE', 'OL', 80], ['QB', 'WR', 79], ['OLB', 'CB', 88],
    ['ILB', 'OLB', 85], ['CB', 'S', 89], ['OL', 'DL', 56], ['OL', 'S', 6],
    ['QB', 'OL', 16], ['WR', 'DL', 10], ['ILB', 'S', 77], ['DL', 'ILB', 76],
  ];
  for (const [a, b, prozent] of erwartet) {
    assert.equal(Math.round(aehnlichkeit(String(a), String(b)) * 100), prozent, `${a}–${b}`);
  }
});

test('über die Seite kostet es ein Drittel — auch bei gleicher Unit', () => {
  // OL und DL stehen in derselben Unit; ohne den Seitenfaktor lägen sie bei
  // 84 %. Dass der Faktor zuletzt kommt, ist der Punkt.
  const olDl = aehnlichkeit('OL', 'DL');
  assert.ok(olDl < 0.84 * 0.7, `OL–DL liegt bei ${olDl}`);
  assert.ok(Math.abs(olDl / COACH_SEITENFAKTOR - 0.84) < 0.01);
});

test('der Passanteil einer Gruppe kommt aus PROFIL_BEITRAG', () => {
  assert.equal(Math.round(gruppenPassAnteil('CB') * 100), 78);
  assert.equal(Math.round(gruppenPassAnteil('RB') * 100), 29);
  assert.equal(Math.round(gruppenPassAnteil('QB') * 100), 67);
});

/** Ein Coach mit lauter gleichen Werten — daran lässt sich die Gewichtung ablesen. */
function flacherCoach(wert, rolle = /** @type {const} */ ('OC'), gruppe = 'QB') {
  const voll = (/** @type {readonly string[]} */ schluessel) =>
    Object.fromEntries(schluessel.map((k) => [k, wert]));
  return {
    id: 'c', vorname: 'A', nachname: 'B', alter: 55, rolle, gruppe,
    soft: voll(SOFT_SKILLS),
    scheme: voll(SCHEME_SKILLS),
    personnel: voll(PERSONNEL_REIHE),
    technik: voll(COACHING_GRUPPE_REIHE),
  };
}

test('ein flacher Coach ist in jeder Rolle genau sein Wert', () => {
  const c = flacherCoach(40);
  for (const rolle of /** @type {const} */ (['OC', 'DC', 'POS'])) {
    assert.ok(Math.abs(staerke(c, rolle) - 40) < 1e-9, rolle);
  }
});

test('die Blöcke wiegen 30/45/25 beim Koordinator und 30/15/55 beim Positionscoach', () => {
  const c = flacherCoach(40);
  for (const s of SOFT_SKILLS) c.soft[s] = 80;
  assert.ok(Math.abs(staerke(c, 'OC') - (40 + 0.30 * 40)) < 1e-9, 'soft, OC');
  assert.ok(Math.abs(staerke(c, 'POS') - (40 + 0.30 * 40)) < 1e-9, 'soft, POS');

  const d = flacherCoach(40);
  for (const g of COACHING_GRUPPE_REIHE) d.technik[g] = 80;
  assert.ok(Math.abs(staerke(d, 'OC') - (40 + 0.25 * 40)) < 1e-9, 'technik, OC');
  assert.ok(Math.abs(staerke(d, 'POS') - (40 + 0.55 * 40)) < 1e-9, 'technik, POS');
});

test('der Positionscoach wird an den Schemewerten seiner Seite gemessen, nach Passanteil', () => {
  const cb = flacherCoach(40, 'POS', 'CB');
  cb.scheme.defensePass = 80;
  // 78 % Pass beim CB-Coach: 0.78 · 80 + 0.22 · 40.
  assert.ok(Math.abs(schemeWert(cb, 'POS') - (0.78 * 80 + 0.22 * 40)) < 0.5);
  // Offense-Werte sind ihm gleichgültig.
  cb.scheme.offensePass = 99;
  assert.ok(Math.abs(schemeWert(cb, 'POS') - (0.78 * 80 + 0.22 * 40)) < 0.5);
});

test('die Vertrautheit zählt halb das Heimatsystem, halb den Rest', () => {
  const oc = flacherCoach(40, 'OC', 'QB');
  oc.personnel['11'] = 70;
  // Scheme des OC: 0.35·40 + 0.35·40 + 0.30·(0.5·70 + 0.5·40).
  assert.ok(Math.abs(schemeWert(oc, 'OC') - (28 + 0.3 * 55)) < 1e-9);
});

test('die Koordinatoren-Technik sind drei Drittel, innen gemittelt', () => {
  const oc = flacherCoach(40, 'OC', 'QB');
  oc.technik.OL = 70;   // ein ganzes Drittel
  oc.technik.QB = 70;   // die Hälfte eines Drittels
  assert.ok(Math.abs(technikWert(oc, 'OC') - (70 + 55 + 40) / 3) < 1e-9);

  const dc = flacherCoach(40, 'DC', 'DL');
  dc.technik.CB = 70;
  dc.technik.S = 70;
  assert.ok(Math.abs(technikWert(dc, 'DC') - (40 + 40 + 70) / 3) < 1e-9);
  assert.equal(softWert(dc), 40);
});

test('ein gezogener Coach liest in seiner Rolle genau die Zielstärke', () => {
  const rng = makeRng('ziel');
  for (let i = 0; i < 50; i++) {
    const c = macheCoach(rng, 'c' + i, i % 2 ? 'OC' : 'DC', i % 2 ? 'OL' : 'S', 60, { personnel: '11' });
    // Gerundet auf ganze Werte — die Stärke darf danach um ein Rundungsmaß wandern.
    const wert = staerke(c);
    assert.ok(Number.isInteger(c.soft.empathie) && Number.isInteger(c.technik.QB));
    assert.ok(wert > 20 && wert < 45, `Stärke ${wert} liegt nicht um 30`);
    assert.ok(c.alter >= COACH_ALTER_MIN && c.alter <= COACH_ALTER_MAX);
  }
});

test('die Stärke der Coaches liegt um die halbe Vereinsbasis, eng gestreut', () => {
  const rng = makeRng('verteilung');
  const werte = [];
  for (let i = 0; i < 200; i++) for (const c of ziehStab(rng, 't', 60, '11')) werte.push(staerke(c));
  const mittel = werte.reduce((a, b) => a + b, 0) / werte.length;
  const sd = Math.sqrt(werte.reduce((a, b) => a + (b - mittel) ** 2, 0) / werte.length);
  assert.ok(Math.abs(mittel - 60 * COACH_BASIS_ANTEIL) < 1, `Mittel ${mittel}`);
  assert.ok(sd > 2 && sd < 4.5, `Streuung ${sd}`);
});

test('die Technik fächert von der Hauptgruppe aus, die fremde Seite liegt tiefer', () => {
  const rng = makeRng('faecher');
  const oc = macheCoach(rng, 'c', 'OC', 'OL', 60, { personnel: '11' });
  assert.ok(oc.technik.OL >= oc.technik.TE, 'TE über OL');
  assert.ok(oc.technik.TE > oc.technik.WR, 'WR über TE');
  assert.ok(oc.technik.OL > 3 * oc.technik.S, 'ein OL-Coach weiß zu viel über Safeties');
  // Die fremde Seite ist da, aber niedrig.
  assert.ok(oc.scheme.defensePass > 0);
  assert.ok(oc.scheme.defensePass < oc.scheme.offensePass);
  assert.ok(oc.scheme.kicks < oc.scheme.offenseLauf);
});

test('die Vertrautheit fällt vom Heimatsystem aus nach beiden Seiten ab', () => {
  const rng = makeRng('heimat');
  const oc = macheCoach(rng, 'c', 'OC', 'QB', 70, { personnel: '11' });
  const reihe = PERSONNEL_REIHE.map((p) => oc.personnel[p]);
  const heim = PERSONNEL_REIHE.indexOf('11');
  for (let i = 0; i < reihe.length; i++) {
    assert.ok(reihe[i] <= reihe[heim] + 1, `${PERSONNEL_REIHE[i]} liegt über dem Heimatsystem`);
  }
  assert.ok(reihe[0] < reihe[heim] * 0.7, 'Empty ist einem 11-Coach zu vertraut');
  assert.ok(reihe[reihe.length - 1] < reihe[heim] * 0.7, 'Double Wing ist einem 11-Coach zu vertraut');
});

test('jeder Verein fängt mit einem OC und einem DC an, reproduzierbar', () => {
  const a = neuesSpiel('heg', 'stab');
  const b = neuesSpiel('heg', 'stab');
  for (const t of TEAMS) {
    const stab = coachesVon(a, t.id);
    assert.equal(stab.length, 2, t.id);
    assert.deepEqual(stab.map((c) => c.rolle), ['OC', 'DC']);
    assert.equal(stab[0].personnel[a.personnel[t.id]], Math.max(...Object.values(stab[0].personnel)),
      `${t.id}: das Heimatsystem des OC ist nicht das des Vereins`);
    assert.deepEqual(stab, coachesVon(b, t.id), `${t.id} ist nicht reproduzierbar`);
  }
});

test('ein Stand ohne Stab zieht ihn beim ersten Blick nach — und dann denselben', () => {
  const stand = neuesSpiel('heg', 'nachziehen');
  const vorher = coachesVon(stand, 'heg');
  delete stand.coaches['heg'];
  assert.deepEqual(coachesVon(stand, 'heg'), vorher);
});

test('die Coaches tragen keinen Namen aus dem eigenen Kader', () => {
  const stand = neuesSpiel('heg', 'namen');
  for (const t of TEAMS) {
    const namen = new Set(stand.kader[t.id].map((s) => s.vorname + ' ' + s.nachname));
    for (const c of coachesVon(stand, t.id)) {
      assert.ok(!namen.has(c.vorname + ' ' + c.nachname), `${t.id}: ${c.vorname} ${c.nachname} spielt auch`);
    }
  }
});
