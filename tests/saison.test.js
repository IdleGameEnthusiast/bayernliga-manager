// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { TEAMS, GRUPPEN, teamsDerGruppe, teamById } from '../engine/content.js';
import { KADER_GROESSE_EIGEN, KADER_GROESSE_FREMD, EIGENE_VEREINSBASIS } from '../engine/constants.js';
import {
  neuesSpiel, spieleSpieltag, saisonVorbei, naechsteSaison, anzahlSpieltage,
  vereinsBasen, gruppenTabelle, gruppenTabellen, meineTabelle, meister,
  gruppenSpieltage, losePersonnel, personnelVon, passAnteilVon, setzeTaktik,
  erlaubterPassAnteil, alsGegner,
} from '../engine/saison.js';
import { PERSONNEL } from '../engine/aufstellung.js';
import { partienDerRunde, sieger } from '../engine/spielplan.js';
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
  assert.equal(anzahlSpieltage(s.spielplan), 10, 'die Gruppenrunde steht, das Bracket nicht');
  assert.equal(partienDerRunde(s.spielplan, 'halbfinale').length, 0);
});

test('eine volle Saison lässt sich durchspielen', () => {
  const s = neuesSpiel('ers', 'seed-2');

  let gespielt = 0;
  while (!saisonVorbei(s)) {
    const bericht = spieleSpieltag(s);
    assert.ok(bericht, 'jeder Spieltag liefert einen Bericht');
    gespielt++;
    assert.ok(gespielt <= 12, 'die Saison terminiert');
  }
  assert.equal(gespielt, 12, 'zehn Gruppenspieltage, Halbfinale, Finale');
  assert.equal(anzahlSpieltage(s.spielplan), 12);
  assert.equal(s.spielplan.filter((p) => p.ergebnis === null).length, 0);
  assert.equal(spieleSpieltag(s), null, 'nach dem Ende passiert nichts mehr');
});

test('das Bracket entsteht erst, wenn es feststeht', () => {
  const s = neuesSpiel('kba', 'seed-bracket');
  const gruppenEnde = gruppenSpieltage(s.spielplan);
  assert.equal(gruppenEnde, 10);

  for (let i = 0; i < gruppenEnde - 1; i++) {
    spieleSpieltag(s);
    assert.equal(partienDerRunde(s.spielplan, 'halbfinale').length, 0,
      `nach Spieltag ${i + 1} steht noch kein Halbfinale`);
  }

  spieleSpieltag(s); // letzter Gruppenspieltag
  const hf = partienDerRunde(s.spielplan, 'halbfinale');
  assert.equal(hf.length, 2);
  assert.ok(hf.every((p) => p.spieltag === 11));
  assert.equal(partienDerRunde(s.spielplan, 'finale').length, 0, 'das Finale noch nicht');

  // Gesetzt ist über Kreuz, mit Heimrecht beim Gruppensieger.
  const nord = gruppenTabelle(s, 'nord');
  const sued = gruppenTabelle(s, 'sued');
  assert.deepEqual(hf.map((p) => [p.heim, p.gast]), [
    [sued[0].teamId, nord[1].teamId],
    [nord[0].teamId, sued[1].teamId],
  ]);

  spieleSpieltag(s); // Halbfinale
  const finale = partienDerRunde(s.spielplan, 'finale');
  assert.equal(finale.length, 1);
  assert.equal(finale[0].spieltag, 12);
  const sieger1 = sieger(hf[0]);
  const sieger2 = sieger(hf[1]);
  assert.deepEqual([finale[0].heim, finale[0].gast].sort(), [sieger1, sieger2].sort());

  assert.equal(meister(s), null, 'vor dem Finale gibt es keinen Meister');
  spieleSpieltag(s);
  assert.equal(meister(s), sieger(finale[0]));
  assert.ok(saisonVorbei(s));
});

test('die Gruppentabellen zählen nur Gruppenspiele', () => {
  const s = neuesSpiel('hr', 'seed-gruppen');
  while (!saisonVorbei(s)) spieleSpieltag(s);

  for (const { gruppe, zeilen } of gruppenTabellen(s)) {
    assert.equal(zeilen.length, teamsDerGruppe(gruppe).length);
    for (const z of zeilen) {
      assert.equal(z.spiele, 10, `${z.teamId} hat zehn Gruppenspiele`);
      assert.equal(teamById(z.teamId).gruppe, gruppe);
    }
  }
  assert.deepEqual(GRUPPEN.slice(), gruppenTabellen(s).map((g) => g.gruppe));
});

test('kein Spiel einer ganzen Saison endet unentschieden', () => {
  const s = neuesSpiel('fkk', 'seed-remis');
  while (!saisonVorbei(s)) spieleSpieltag(s);
  for (const p of s.spielplan) {
    assert.ok(p.ergebnis, 'jede Partie ist gespielt');
    assert.notEqual(p.ergebnis.heimPunkte, p.ergebnis.gastPunkte,
      `${p.heim} gegen ${p.gast} hat einen Sieger`);
  }
});

test('die Tabelle stimmt mit den gespielten Partien überein', () => {
  const s = neuesSpiel('gc', 'seed-3');
  while (!saisonVorbei(s)) spieleSpieltag(s);

  for (const { zeilen } of gruppenTabellen(s)) {
    // Jeder Sieg auf der einen Seite ist eine Niederlage auf der anderen.
    const siege = zeilen.reduce((a, z) => a + z.siege, 0);
    const niederlagen = zeilen.reduce((a, z) => a + z.niederlagen, 0);
    assert.equal(siege, niederlagen);
    // Erzielte und kassierte Punkte sind dieselbe Menge, von beiden Seiten gezählt.
    assert.equal(
      zeilen.reduce((a, z) => a + z.erzielt, 0),
      zeilen.reduce((a, z) => a + z.kassiert, 0),
    );
  }
  assert.deepEqual(meineTabelle(s), gruppenTabelle(s, teamById('gc').gruppe),
    'meineTabelle liefert die Tabelle der eigenen Gruppe');
});

test('gleicher Seed, gleiche Saison', () => {
  const a = neuesSpiel('fel', 'gleich');
  const b = neuesSpiel('fel', 'gleich');
  while (!saisonVorbei(a)) spieleSpieltag(a);
  while (!saisonVorbei(b)) spieleSpieltag(b);
  assert.deepEqual(gruppenTabellen(a), gruppenTabellen(b));
  assert.equal(meister(a), meister(b));
});

test('der Saisonwechsel setzt zurück und schreibt Historie', () => {
  const s = neuesSpiel('mr', 'seed-4');
  while (!saisonVorbei(s)) spieleSpieltag(s);

  const finale = partienDerRunde(s.spielplan, 'finale')[0];
  const { meister: champion } = naechsteSaison(s);
  assert.equal(champion, sieger(finale), 'Meister ist der Finalsieger');
  assert.equal(s.jahr, 2027);
  assert.equal(s.spieltag, 1);
  assert.equal(s.historie.length, 1);
  assert.equal(s.historie[0].jahr, 2026);
  assert.equal(s.spielplan.filter((p) => p.ergebnis !== null).length, 0, 'frischer Spielplan');
  assert.equal(anzahlSpieltage(s.spielplan), 10, 'nur die Gruppenrunde ist gezogen');
  assert.ok(s.historie[0].meinPlatz >= 1 && s.historie[0].meinPlatz <= 6,
    'der eigene Platz zählt in der eigenen Gruppe');
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

test('Stände aus einer älteren Liga werden abgelehnt', () => {
  assert.throws(() => migriere({ version: 1, seed: 'x', meinTeam: 'ros', kader: {} }),
    /älteren Liga/);
  assert.throws(() => migriere({ version: 2, seed: 'x', meinTeam: 'heg', kader: {} }),
    /älteren Liga/);
  // v3 kannte fünf Offense-Positionen; ein gültiger Kader ließe sich daraus
  // nur durch Erfinden gewinnen.
  assert.throws(() => migriere({ version: 3, seed: 'x', meinTeam: 'heg', kader: {} }),
    /älteren Liga/);
});

// --- Taktik ----------------------------------------------------------------

test('jeder Verein bekommt ein System und eine Ausrichtung', () => {
  const stand = neuesSpiel('heg', 'taktik');
  for (const t of TEAMS) {
    const personnel = stand.personnel[t.id];
    assert.ok(PERSONNEL[personnel], `${t.kurz} spielt ${personnel}`);
    assert.equal(stand.passAnteil[t.id], PERSONNEL[personnel].passAnteil);
  }
  // Und nicht alle dasselbe.
  assert.ok(new Set(Object.values(stand.personnel)).size > 1, 'die Liga ist nicht uniform');
});

test('die Auslosung hängt nur am Saatgut', () => {
  assert.deepEqual(losePersonnel('gleich'), losePersonnel('gleich'));
  assert.notDeepEqual(losePersonnel('gleich'), losePersonnel('anders'));
  // Sie hängt nicht daran, wen man trainiert.
  assert.deepEqual(neuesSpiel('heg', 'x').personnel, neuesSpiel('pp', 'x').personnel);
});

test('das System überlebt den Saisonwechsel', () => {
  const stand = neuesSpiel('heg', 'philosophie');
  const vorher = { ...stand.personnel };
  while (!saisonVorbei(stand)) spieleSpieltag(stand);
  naechsteSaison(stand);
  assert.deepEqual(stand.personnel, vorher, 'ein Verein hat eine Spielphilosophie');
});

test('eine fehlende Taktik wird nachgezogen, nicht geraten', () => {
  const stand = neuesSpiel('heg', 'nachzieh');
  const erwartet = { ...stand.personnel };

  // Ein Stand aus der Zeit davor: die Felder fehlen ganz.
  const alt = { ...stand };
  delete alt.personnel;
  delete alt.passAnteil;

  const m = migriere(alt);
  assert.deepEqual(m.personnel, erwartet, 'derselbe Stand ergibt dieselben Systeme');
  assert.equal(m.version, SAVE_VERSION, 'und das kostet keine neue Version');
  for (const t of TEAMS) {
    assert.equal(m.passAnteil[t.id], PERSONNEL[m.personnel[t.id]].passAnteil);
  }

  // Auch einzeln: der Zugriff zieht nach, ohne den Zustand zu brauchen.
  const leer = /** @type {any} */ ({ seed: 'nachzieh', meinTeam: 'heg' });
  assert.equal(personnelVon(leer, 'heg'), erwartet.heg);
  assert.equal(passAnteilVon(leer, 'heg'), PERSONNEL[erwartet.heg].passAnteil);
});

test('der Manager verschiebt die Ausrichtung, wohin er will', () => {
  const stand = neuesSpiel('heg', 'schieben');
  setzeTaktik(stand, { personnel: '11' });
  assert.equal(stand.personnel.heg, '11');
  assert.equal(stand.passAnteil.heg, PERSONNEL['11'].passAnteil);

  // Kein Spielraum mehr um den Vorschlag herum: der Preis steht im
  // Skill-Block, nicht in einer Schranke.
  setzeTaktik(stand, { personnel: '11', passAnteil: 0.95 });
  assert.equal(stand.passAnteil.heg, 0.95);
  setzeTaktik(stand, { personnel: '32', passAnteil: 1 });
  assert.equal(stand.passAnteil.heg, 1, 'auch aus Double Wing darf geworfen werden');

  // Und nur beim eigenen Verein.
  const fremd = TEAMS.find((t) => t.id !== 'heg');
  const vorher = stand.personnel[fremd.id];
  setzeTaktik(stand, { personnel: '32' });
  assert.equal(stand.personnel[fremd.id], vorher);

  assert.equal(erlaubterPassAnteil('00', 1.5), 1, 'über eins geht nichts');
  assert.equal(erlaubterPassAnteil('32', -0.5), 0, 'unter null auch nicht');
});

test('die Taktik gilt ab dem nächsten Spieltag', () => {
  const gleich = () => neuesSpiel('heg', 'wirkung');
  const a = gleich();
  const b = gleich();

  spieleSpieltag(a);
  spieleSpieltag(b);
  const nachEins = JSON.stringify(a.spielplan.filter((p) => p.spieltag === 1));

  setzeTaktik(b, { personnel: '32', passAnteil: 0.2 });
  // Der gespielte Spieltag rührt sich nicht.
  assert.equal(JSON.stringify(b.spielplan.filter((p) => p.spieltag === 1)), nachEins);

  spieleSpieltag(a);
  spieleSpieltag(b);
  const zweiA = a.spielplan.filter((p) => p.spieltag === 2);
  const zweiB = b.spielplan.filter((p) => p.spieltag === 2);
  assert.notDeepEqual(zweiB, zweiA, 'der nächste Spieltag sieht die Änderung');
});

test('alsGegner reicht die Ausrichtung an die Simulation weiter', () => {
  const stand = neuesSpiel('heg', 'gegner');
  setzeTaktik(stand, { personnel: '00', passAnteil: 0.8 });
  const heg = alsGegner(stand, 'heg');
  assert.equal(heg.personnel, '00');
  assert.equal(heg.passAnteil, 0.8);
  assert.equal(heg.kader, stand.kader.heg);
});

test('Export und Import nehmen die Taktik mit', () => {
  const stand = neuesSpiel('heg', 'export');
  setzeTaktik(stand, { personnel: '21', passAnteil: 0.35 });
  spieleSpieltag(stand);

  const zurueck = importiere(exportiere(stand));
  assert.deepEqual(zurueck.personnel, stand.personnel);
  assert.deepEqual(zurueck.passAnteil, stand.passAnteil);
  assert.equal(zurueck.personnel.heg, '21');
  assert.equal(zurueck.passAnteil.heg, 0.35);
});
