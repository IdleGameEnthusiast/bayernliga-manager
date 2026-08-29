// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeRng, KADER_FORM, KADER_GROESSE_EIGEN, KADER_GROESSE_FREMD, ZUSATZ_SPIELER,
  ZUSATZ_MAX_JE_POSITION, MAX_RATING, LIGA_MAX_STAERKE, MAX_AGE, PEAK_AGE, POSITIONS,
} from '../engine/constants.js';
import {
  macheKader, saisonWechsel, alterFaktor, berechneStaerke, verfuegbar, resetSpielerIds,
} from '../engine/spieler.js';

test('der eigene Kader hat genau die vorgesehene Positionsverteilung', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('k'), 58);
  assert.equal(kader.length, KADER_GROESSE_EIGEN);
  assert.equal(kader.length, 30);

  for (const [pos, anzahl] of Object.entries(KADER_FORM)) {
    assert.equal(kader.filter((s) => s.position === pos).length, anzahl, pos);
  }
});

test('fremde Kader bekommen fünf Zusatzspieler, gestreut und gedeckelt', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    resetSpielerIds();
    const kader = macheKader(makeRng(seed), 58, ZUSATZ_SPIELER);
    assert.equal(kader.length, KADER_GROESSE_FREMD, seed);

    for (const pos of POSITIONS) {
      const zusatz = kader.filter((s) => s.position === pos).length - KADER_FORM[pos];
      assert.ok(zusatz >= 0 && zusatz <= ZUSATZ_MAX_JE_POSITION,
        `${seed}: ${pos} bekommt ${zusatz} Zusatzspieler`);
    }
  }
});

test('Stärke bleibt unter dem Ligadeckel, Talent darf darüber', () => {
  resetSpielerIds();
  for (const basis of [45, 58, 65, 90]) {
    const kader = macheKader(makeRng('s' + basis), basis, ZUSATZ_SPIELER);
    for (const s of kader) {
      assert.ok(s.staerke >= 1 && s.staerke <= LIGA_MAX_STAERKE,
        `Stärke ${s.staerke} bei Basis ${basis}`);
      assert.ok(s.talent >= 1 && s.talent <= MAX_RATING, `Talent ${s.talent}`);
    }
  }
  // Der Deckel greift wirklich: eine hohe Basis erzeugt Talent über 79.
  const stark = macheKader(makeRng('hoch'), 90, ZUSATZ_SPIELER);
  assert.ok(stark.some((s) => s.talent > LIGA_MAX_STAERKE), 'Talent kann über den Deckel');
  assert.ok(stark.every((s) => s.staerke <= LIGA_MAX_STAERKE), 'Stärke nie über den Deckel');
});

test('jeder Kader hat ein bis zwei Spieler über 45', () => {
  for (const seed of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6']) {
    resetSpielerIds();
    const kader = macheKader(makeRng(seed), 55);
    const alte = kader.filter((s) => s.alter >= 45);
    assert.ok(alte.length >= 1 && alte.length <= 2, `${seed}: ${alte.length} Veteranen`);
    for (const s of alte) {
      assert.ok(s.alter <= 65, `Alter ${s.alter}`);
      assert.ok(s.ruecktrittAlter > s.alter, 'ein Veteran tritt nicht sofort zurück');
    }
  }
});

test('Namen doppeln sich innerhalb eines Kaders nicht', () => {
  for (const seed of ['n1', 'n2', 'n3', 'n4']) {
    resetSpielerIds();
    const kader = macheKader(makeRng(seed), 58, ZUSATZ_SPIELER);
    const namen = new Set(kader.map((s) => s.vorname + ' ' + s.nachname));
    assert.equal(namen.size, kader.length, seed);
  }
});

test('Spieler-Ids sind eindeutig', () => {
  resetSpielerIds();
  const a = macheKader(makeRng('a'), 60);
  const b = macheKader(makeRng('b'), 60);
  const ids = new Set([...a, ...b].map((s) => s.id));
  assert.equal(ids.size, a.length + b.length);
});

test('die Alterskurve gipfelt am Zenit und fällt danach durch', () => {
  assert.equal(alterFaktor(PEAK_AGE), 1);
  assert.ok(alterFaktor(PEAK_AGE) > alterFaktor(19));
  for (let a = PEAK_AGE; a < 65; a++) {
    assert.ok(alterFaktor(a) > alterFaktor(a + 1), `Alter ${a} fällt nicht`);
  }
  // Ein Sechzigjähriger ist deutlich schwächer als ein Vierzigjähriger — das
  // war mit dem alten Boden bei 0,7 nicht so.
  assert.ok(berechneStaerke(70, 60) < berechneStaerke(70, 40) * 0.5);
});

test('Saisonwechsel altert alle und ersetzt Rücktritte', () => {
  resetSpielerIds();
  const rng = makeRng('w');
  const vorher = macheKader(rng, 58, ZUSATZ_SPIELER);
  const faellig = vorher.filter((s) => s.alter + 1 > s.ruecktrittAlter).length;

  const { kader, ruecktritte } = saisonWechsel(rng, vorher, 58);
  assert.equal(kader.length, vorher.length, 'Kadergröße bleibt gleich');
  assert.equal(ruecktritte.length, faellig, 'genau die Fälligen treten zurück');
  for (const s of kader) {
    assert.ok(s.alter <= s.ruecktrittAlter, `Alter ${s.alter} über dem Rücktrittsalter`);
  }
});

test('ein Veteran überlebt den Saisonwechsel', () => {
  resetSpielerIds();
  const rng = makeRng('vet');
  let kader = macheKader(rng, 58);
  const veteran = kader.find((s) => s.alter >= 45);
  assert.ok(veteran, 'es gibt einen Veteranen');
  // Er bleibt, bis sein eigenes Rücktrittsalter erreicht ist — nicht mit 37.
  assert.ok(veteran.ruecktrittAlter > MAX_AGE);
  kader = saisonWechsel(rng, kader, 58).kader;
  assert.ok(kader.some((s) => s.id === veteran.id), 'der Veteran ist noch da');
});

test('Verletzte fallen aus der Verfügbarkeit', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('v'), 58, ZUSATZ_SPIELER);
  const dbs = kader.filter((s) => s.position === 'DB');
  dbs[0].verletztBis = 5;

  const frei = verfuegbar(kader, 'DB', 3);
  assert.equal(frei.length, dbs.length - 1);
  assert.ok(!frei.some((s) => s.id === dbs[0].id));
  assert.equal(verfuegbar(kader, 'DB', 5).length, dbs.length);
});

test('Trikotnummern sind eindeutig und halten sich an ihr Band', () => {
  /** @type {Record<string, [number, number][]>} */
  const band = {
    QB: [[1, 19]], RB: [[20, 49]], WR: [[10, 19], [80, 89]], TE: [[40, 49], [80, 89]],
    OL: [[50, 79]], DL: [[50, 79], [90, 99]], LB: [[40, 59], [90, 99]], DB: [[20, 49]],
  };

  for (const basis of [45, 58, 65]) {
    resetSpielerIds();
    const kader = macheKader(makeRng('nr' + basis), basis, ZUSATZ_SPIELER);
    const nummern = kader.map((s) => s.nummer);
    assert.equal(new Set(nummern).size, kader.length, `Basis ${basis}: keine Doppelung`);

    for (const s of kader) {
      assert.ok(s.nummer >= 0 && s.nummer <= 99, `Nummer ${s.nummer}`);
      if (s.nummer <= 9) {
        assert.notEqual(s.position, 'OL', 'ein OL trägt nie eine einstellige Nummer');
        continue;
      }
      const passt = band[s.position].some(([v, b]) => s.nummer >= v && s.nummer <= b);
      assert.ok(passt, `${s.position} trägt ${s.nummer}`);
    }
  }
});

test('fünf bis neun einstellige Nummern gehen an die Besten', () => {
  for (const seed of ['e1', 'e2', 'e3', 'e4', 'e5']) {
    resetSpielerIds();
    const kader = macheKader(makeRng(seed), 58, ZUSATZ_SPIELER);
    const einstellig = kader.filter((s) => s.nummer <= 9);
    assert.ok(einstellig.length >= 5 && einstellig.length <= 9,
      `${seed}: ${einstellig.length} einstellige Nummern`);

    // Alle stammen aus den zwölf stärksten Nicht-Linemen.
    const zwoelf = new Set(kader
      .filter((s) => s.position !== 'OL')
      .sort((a, b) => b.staerke - a.staerke)
      .slice(0, 12)
      .map((s) => s.id));
    for (const s of einstellig) assert.ok(zwoelf.has(s.id), `${seed}: ${s.nachname}`);
  }
});

test('Nummern bleiben über den Jahreswechsel am Spieler', () => {
  resetSpielerIds();
  const rng = makeRng('nw');
  let kader = macheKader(rng, 58, ZUSATZ_SPIELER);
  let vorher = new Map(kader.map((s) => [s.id, s.nummer]));

  for (let jahr = 0; jahr < 6; jahr++) {
    kader = saisonWechsel(rng, kader, 58).kader;
    assert.equal(new Set(kader.map((s) => s.nummer)).size, kader.length, `Jahr ${jahr}`);
    for (const s of kader) {
      if (vorher.has(s.id)) {
        assert.equal(s.nummer, vorher.get(s.id), `${s.nachname} behält seine Nummer`);
      }
    }
    vorher = new Map(kader.map((s) => [s.id, s.nummer]));
  }
});
