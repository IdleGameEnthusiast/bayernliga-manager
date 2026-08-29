// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { TEAMS } from '../engine/content.js';
import { ROSTER_SIZE } from '../engine/constants.js';
import {
  neuesSpiel, spieleSpieltag, saisonVorbei, naechsteSaison, tabelle, anzahlSpieltage,
} from '../engine/saison.js';
import { migriere, exportiere, importiere } from '../engine/save.js';

test('ein neues Spiel ist vollständig aufgesetzt', () => {
  const s = neuesSpiel('ros', 'seed-1');
  assert.equal(s.jahr, 2026);
  assert.equal(s.spieltag, 1);
  assert.equal(s.meinTeam, 'ros');
  assert.equal(Object.keys(s.kader).length, TEAMS.length);
  for (const t of TEAMS) {
    assert.equal(s.kader[t.id].length, ROSTER_SIZE, t.id);
  }
  assert.ok(!saisonVorbei(s));
});

test('eine volle Saison lässt sich durchspielen', () => {
  const s = neuesSpiel('ffb', 'seed-2');
  const gesamt = anzahlSpieltage(s.spielplan);

  let gespielt = 0;
  while (!saisonVorbei(s)) {
    const bericht = spieleSpieltag(s);
    assert.ok(bericht, 'jeder Spieltag liefert einen Bericht');
    gespielt++;
    assert.ok(gespielt <= gesamt + 1, 'die Saison terminiert');
  }
  assert.equal(gespielt, gesamt);
  assert.equal(s.spielplan.filter((p) => p.ergebnis === null).length, 0);
  assert.equal(spieleSpieltag(s), null, 'nach dem Ende passiert nichts mehr');
});

test('die Tabelle stimmt mit den gespielten Partien überein', () => {
  const s = neuesSpiel('stb', 'seed-3');
  while (!saisonVorbei(s)) spieleSpieltag(s);

  const t = tabelle(s);
  const gesamt = anzahlSpieltage(s.spielplan);
  for (const z of t) {
    assert.equal(z.spiele, gesamt, `${z.teamId} hat alle Spiele`);
  }
  // Jeder Sieg auf der einen Seite ist eine Niederlage auf der anderen.
  const siege = t.reduce((a, z) => a + z.siege, 0);
  const niederlagen = t.reduce((a, z) => a + z.niederlagen, 0);
  assert.equal(siege, niederlagen);
  // Erzielte und kassierte Punkte sind dieselbe Menge, von beiden Seiten gezählt.
  assert.equal(
    t.reduce((a, z) => a + z.erzielt, 0),
    t.reduce((a, z) => a + z.kassiert, 0),
  );
});

test('gleicher Seed, gleiche Saison', () => {
  const a = neuesSpiel('erd', 'gleich');
  const b = neuesSpiel('erd', 'gleich');
  while (!saisonVorbei(a)) spieleSpieltag(a);
  while (!saisonVorbei(b)) spieleSpieltag(b);
  assert.deepEqual(tabelle(a), tabelle(b));
});

test('der Saisonwechsel setzt zurück und schreibt Historie', () => {
  const s = neuesSpiel('reg', 'seed-4');
  while (!saisonVorbei(s)) spieleSpieltag(s);

  const { meister } = naechsteSaison(s);
  assert.ok(TEAMS.some((t) => t.id === meister));
  assert.equal(s.jahr, 2027);
  assert.equal(s.spieltag, 1);
  assert.equal(s.historie.length, 1);
  assert.equal(s.historie[0].jahr, 2026);
  assert.equal(s.spielplan.filter((p) => p.ergebnis !== null).length, 0, 'frischer Spielplan');
  for (const t of TEAMS) {
    assert.equal(s.kader[t.id].length, ROSTER_SIZE, `${t.id} bleibt vollzählig`);
    assert.ok(s.kader[t.id].every((sp) => sp.verletztBis === 0), 'alle sind wieder fit');
  }
});

test('mehrere Saisons hintereinander bleiben stabil', () => {
  const s = neuesSpiel('amb', 'seed-5');
  for (let i = 0; i < 5; i++) {
    while (!saisonVorbei(s)) spieleSpieltag(s);
    naechsteSaison(s);
  }
  assert.equal(s.jahr, 2031);
  assert.equal(s.historie.length, 5);
  for (const t of TEAMS) {
    assert.equal(s.kader[t.id].length, ROSTER_SIZE);
  }
});

test('Export und Import ergeben denselben Stand', () => {
  const s = neuesSpiel('wei', 'seed-6');
  spieleSpieltag(s);
  spieleSpieltag(s);

  const zurueck = importiere(exportiere(s));
  assert.deepEqual(zurueck, s);
});

test('Migration füllt fehlende Felder auf', () => {
  const roh = { seed: 'x', jahr: 2026, spieltag: 1, meinTeam: 'ros', kader: {}, spielplan: [] };
  const m = migriere(roh);
  assert.equal(m.version, 1);
  assert.deepEqual(m.verlauf, []);
  assert.deepEqual(m.historie, []);
});

test('ein leerer Speicherstand wird abgelehnt', () => {
  assert.throws(() => migriere(null));
});
