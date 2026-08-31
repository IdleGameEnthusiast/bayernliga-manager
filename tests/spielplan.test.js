// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng } from '../engine/constants.js';
import { TEAMS, GRUPPEN, teamsDerGruppe, teamById } from '../engine/content.js';
import {
  macheSpielplan, macheGruppenplan, macheHalbfinale, macheFinale, sieger,
  HALBFINAL_SETZUNG,
  anzahlSpieltage, partienAmSpieltag, partienDerRunde,
} from '../engine/spielplan.js';

const gruppenIds = GRUPPEN.map((g) => teamsDerGruppe(g).map((t) => t.id));
const [nordIds, suedIds] = gruppenIds;

/** @param {string} teamId @param {number} siege @param {number} spiele @param {number} differenz */
function zeile(teamId, siege, spiele, differenz) {
  return /** @type {any} */ ({
    teamId, platz: 0, spiele, siege, niederlagen: spiele - siege,
    punkte: siege * 2, erzielt: 0, kassiert: 0, differenz,
  });
}

test('jede Gruppe spielt in sich eine doppelte Runde', () => {
  const plan = macheGruppenplan(makeRng('test'), gruppenIds);
  assert.equal(plan.length, gruppenIds.length * nordIds.length * (nordIds.length - 1));
  assert.ok(plan.every((p) => p.runde === 'gruppe'));

  const paare = new Map();
  for (const p of plan) {
    const key = p.heim + '>' + p.gast;
    paare.set(key, (paare.get(key) || 0) + 1);
  }
  for (const ids of gruppenIds) {
    for (const a of ids) {
      for (const b of ids) {
        if (a === b) continue;
        assert.equal(paare.get(a + '>' + b), 1, `${a} gegen ${b} genau einmal zuhause`);
      }
    }
  }
});

test('die Gruppen begegnen sich in der Gruppenrunde nie', () => {
  const plan = macheGruppenplan(makeRng('test'), gruppenIds);
  for (const p of plan) {
    assert.equal(teamById(p.heim).gruppe, teamById(p.gast).gruppe, `${p.heim} gegen ${p.gast}`);
  }
});

test('zehn Spieltage, an jedem spielt jeder Verein genau einmal', () => {
  const plan = macheGruppenplan(makeRng('test'), gruppenIds);
  const gesamt = anzahlSpieltage(plan);
  assert.equal(gesamt, (nordIds.length - 1) * 2);
  assert.equal(gesamt, 10);

  for (let st = 1; st <= gesamt; st++) {
    const partien = partienAmSpieltag(plan, st);
    assert.equal(partien.length, TEAMS.length / 2, `Spieltag ${st} hat volle Paarungen`);

    const beteiligt = new Set();
    for (const p of partien) {
      assert.ok(!beteiligt.has(p.heim), `${p.heim} nur einmal an Spieltag ${st}`);
      assert.ok(!beteiligt.has(p.gast), `${p.gast} nur einmal an Spieltag ${st}`);
      beteiligt.add(p.heim);
      beteiligt.add(p.gast);
    }
    assert.equal(beteiligt.size, TEAMS.length);
  }
});

test('jeder Verein hat gleich viele Heim- wie Auswärtsspiele', () => {
  const plan = macheGruppenplan(makeRng('test'), gruppenIds);
  for (const id of TEAMS.map((t) => t.id)) {
    assert.equal(plan.filter((p) => p.heim === id).length, nordIds.length - 1);
    assert.equal(plan.filter((p) => p.gast === id).length, nordIds.length - 1);
  }
});

test('ungerade Teamzahl wird abgelehnt', () => {
  assert.throws(() => macheSpielplan(makeRng('x'), ['a', 'b', 'c']));
});

test('ungleich große Gruppen werden abgelehnt', () => {
  assert.throws(() => macheGruppenplan(makeRng('x'), [['a', 'b'], ['c', 'd', 'e', 'f']]),
    /gleich viele/);
});

test('das Halbfinale kreuzt die Gruppen, Heimrecht beim Gruppensieger', () => {
  const nord = nordIds.map((id, i) => zeile(id, 10 - i, 10, 0));
  const sued = suedIds.map((id, i) => zeile(id, 10 - i, 10, 0));
  const hf = macheHalbfinale(nord, sued, 11);

  assert.equal(hf.length, 2);
  assert.ok(hf.every((p) => p.spieltag === 11 && p.runde === 'halbfinale'));
  assert.deepEqual(
    hf.map((p) => [p.heim, p.gast]),
    [[sued[0].teamId, nord[1].teamId], [nord[0].teamId, sued[1].teamId]],
  );
});

test('die Setzung beschreibt genau die Paarungen, die gebaut werden', () => {
  // Die Tabellenansicht beschriftet die leeren Halbfinalplätze aus dieser
  // Liste. Läuft sie der Partienbildung davon, steht im Bracket eine Setzung,
  // die nie gespielt wird — und niemand sähe es, weil beide Seiten für sich
  // stimmen.
  const nord = nordIds.map((id, i) => zeile(id, 10 - i, 10, 0));
  const sued = suedIds.map((id, i) => zeile(id, 10 - i, 10, 0));
  const tabellen = { nord, sued };
  const hf = macheHalbfinale(nord, sued, 11);

  assert.equal(HALBFINAL_SETZUNG.length, hf.length);
  HALBFINAL_SETZUNG.forEach((s, i) => {
    assert.equal(hf[i].heim, tabellen[s.heim.gruppe][s.heim.platz - 1].teamId);
    assert.equal(hf[i].gast, tabellen[s.gast.gruppe][s.gast.platz - 1].teamId);
  });
});

test('ohne zwei Vereine je Gruppe gibt es kein Halbfinale', () => {
  assert.throws(() => macheHalbfinale([zeile('a', 1, 1, 0)], [zeile('b', 1, 1, 0)], 11));
});

test('das Heimrecht im Finale hängt an der Bilanz, nicht am Gruppenplatz', () => {
  // Der Gruppenzweite mit der besseren Bilanz bekommt das Heimrecht.
  const gruppensieger = zeile('a', 7, 10, 40);
  const zweiter = zeile('b', 9, 10, 10);
  const f = macheFinale(gruppensieger, zweiter, 12);
  assert.equal(f.heim, 'b');
  assert.equal(f.gast, 'a');
  assert.equal(f.runde, 'finale');
  assert.equal(f.spieltag, 12);
});

test('bei gleicher Bilanz entscheidet die Punktdifferenz', () => {
  const f = macheFinale(zeile('a', 8, 10, 12), zeile('b', 8, 10, 55), 12);
  assert.equal(f.heim, 'b');
});

test('sieger liest die Partie, nicht die Tabelle', () => {
  /** @type {any} */
  const p = { spieltag: 12, runde: 'finale', heim: 'a', gast: 'b', ergebnis: null };
  assert.equal(sieger(p), null);
  p.ergebnis = { heimPunkte: 17, gastPunkte: 24 };
  assert.equal(sieger(p), 'b');
  p.ergebnis = { heimPunkte: 31, gastPunkte: 24 };
  assert.equal(sieger(p), 'a');
});

test('partienDerRunde trennt Gruppenrunde und Bracket', () => {
  const plan = macheGruppenplan(makeRng('test'), gruppenIds);
  plan.push(...macheHalbfinale(
    nordIds.map((id, i) => zeile(id, 10 - i, 10, 0)),
    suedIds.map((id, i) => zeile(id, 10 - i, 10, 0)),
    11,
  ));
  assert.equal(partienDerRunde(plan, 'gruppe').length, 60);
  assert.equal(partienDerRunde(plan, 'halbfinale').length, 2);
  assert.equal(partienDerRunde(plan, 'finale').length, 0);
});
