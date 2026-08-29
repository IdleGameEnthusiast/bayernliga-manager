// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { TEAMS } from '../engine/content.js';
import { KADER_GROESSE_EIGEN, KADER_GROESSE_FREMD, EIGENE_VEREINSBASIS } from '../engine/constants.js';
import {
  neuesSpiel, spieleSpieltag, saisonVorbei, naechsteSaison, tabelle, anzahlSpieltage,
  vereinsBasen,
} from '../engine/saison.js';
import { SAVE_VERSION } from '../engine/saison.js';
import { migriere, exportiere, importiere } from '../engine/save.js';

test('der eigene Verein fällt ans Tabellenende, die anderen rücken auf', () => {
  const basen = vereinsBasen('sta');
  assert.equal(basen.sta, EIGENE_VEREINSBASIS);
  assert.deepEqual(
    TEAMS.map((t) => `${t.kurz} ${basen[t.id]}`),
    ['HEG 65', 'ASS 62', 'GC 60', 'ERS 58', 'KBA 58', 'FEL 57',
     'STA 45', 'HR 56', 'MR 50', 'FKK 49', 'BTC 47', 'PP 46'],
  );
});

test('die Werteleiter der Liga bleibt dieselbe, egal wer gewählt wird', () => {
  const leiter = TEAMS.map((t) => t.staerke).sort((a, b) => b - a);
  for (const gewaehlt of TEAMS) {
    const basen = vereinsBasen(gewaehlt.id);
    assert.equal(Object.keys(basen).length, TEAMS.length, gewaehlt.id);
    assert.equal(basen[gewaehlt.id], EIGENE_VEREINSBASIS, gewaehlt.id);
    assert.deepEqual(
      Object.values(basen).sort((a, b) => b - a),
      leiter,
      `${gewaehlt.kurz} verschiebt die Leiter`,
    );
    // Niemand über dem Gewählten ändert sich.
    for (const t of TEAMS) {
      if (t.staerke > gewaehlt.staerke) assert.equal(basen[t.id], t.staerke, t.id);
    }
  }
});

test('ein neues Spiel ist vollständig aufgesetzt', () => {
  const s = neuesSpiel('heg', 'seed-1');
  assert.equal(s.jahr, 2026);
  assert.equal(s.spieltag, 1);
  assert.equal(s.meinTeam, 'heg');
  assert.equal(Object.keys(s.kader).length, TEAMS.length);
  for (const t of TEAMS) {
    const soll = t.id === s.meinTeam ? KADER_GROESSE_EIGEN : KADER_GROESSE_FREMD;
    assert.equal(s.kader[t.id].length, soll, t.id);
  }
  assert.ok(!saisonVorbei(s));
});

test('eine volle Saison lässt sich durchspielen', () => {
  const s = neuesSpiel('ers', 'seed-2');
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
  const s = neuesSpiel('gc', 'seed-3');
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
  const a = neuesSpiel('fel', 'gleich');
  const b = neuesSpiel('fel', 'gleich');
  while (!saisonVorbei(a)) spieleSpieltag(a);
  while (!saisonVorbei(b)) spieleSpieltag(b);
  assert.deepEqual(tabelle(a), tabelle(b));
});

test('der Saisonwechsel setzt zurück und schreibt Historie', () => {
  const s = neuesSpiel('mr', 'seed-4');
  while (!saisonVorbei(s)) spieleSpieltag(s);

  const { meister } = naechsteSaison(s);
  assert.ok(TEAMS.some((t) => t.id === meister));
  assert.equal(s.jahr, 2027);
  assert.equal(s.spieltag, 1);
  assert.equal(s.historie.length, 1);
  assert.equal(s.historie[0].jahr, 2026);
  assert.equal(s.spielplan.filter((p) => p.ergebnis !== null).length, 0, 'frischer Spielplan');
  for (const t of TEAMS) {
    const soll = t.id === s.meinTeam ? KADER_GROESSE_EIGEN : KADER_GROESSE_FREMD;
    assert.equal(s.kader[t.id].length, soll, `${t.id} bleibt vollzählig`);
    assert.ok(s.kader[t.id].every((sp) => sp.verletztBis === 0), 'alle sind wieder fit');
  }
});

test('mehrere Saisons hintereinander bleiben stabil', () => {
  const s = neuesSpiel('btc', 'seed-5');
  for (let i = 0; i < 5; i++) {
    while (!saisonVorbei(s)) spieleSpieltag(s);
    naechsteSaison(s);
  }
  assert.equal(s.jahr, 2031);
  assert.equal(s.historie.length, 5);
  for (const t of TEAMS) {
    const soll = t.id === s.meinTeam ? KADER_GROESSE_EIGEN : KADER_GROESSE_FREMD;
    assert.equal(s.kader[t.id].length, soll);
  }
});

test('Export und Import ergeben denselben Stand', () => {
  const s = neuesSpiel('pp', 'seed-6');
  spieleSpieltag(s);
  spieleSpieltag(s);

  const zurueck = importiere(exportiere(s));
  assert.deepEqual(zurueck, s);
});

test('Migration füllt fehlende Felder auf', () => {
  const roh = { seed: 'x', jahr: 2026, spieltag: 1, meinTeam: 'heg', kader: {}, spielplan: [] };
  const m = migriere(roh);
  assert.equal(m.version, SAVE_VERSION);
  assert.deepEqual(m.verlauf, []);
  assert.deepEqual(m.historie, []);
});

test('ein leerer Speicherstand wird abgelehnt', () => {
  assert.throws(() => migriere(null));
});

test('ein Stand aus der alten Achter-Liga wird abgelehnt', () => {
  assert.throws(() => migriere({ version: 1, seed: 'x', meinTeam: 'ros', kader: {} }),
    /älteren Liga/);
});
