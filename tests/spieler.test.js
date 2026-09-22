// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  makeRng, KADER_FORM, KADER_GROESSE_EIGEN, KADER_GROESSE_FREMD, ZUSATZ_SPIELER,
  ZUSATZ_MAX_JE_POSITION, LIGA_MAX_STAERKE, MAX_AGE, PEAK_AGE, POSITIONS,
  TALENT_MIN, TALENT_MAX, EIGENE_VEREINSBASIS,
  POSITION_GRUPPEN, GRUPPE_JE_POSITION, EINHEIT_JE_GRUPPE, ZUSATZ_GEWICHTE, ATTRIBUTE,
  ATTRIBUT_DRIFT_JE_SPIEL, LERNRATE, GROESSE_MIN, GROESSE_MAX, GEWICHT_MIN, GEWICHT_MAX,
} from '../engine/constants.js';
import {
  macheKader, macheSpieler, saisonWechsel, alterFaktor, berechneStaerke, verfuegbar,
  ziehAttribute, sollAttribute, spieleEinsatz, verfalleEinsaetze, setzeStaerke,
  resetSpielerIds, staerkeImAlter,
} from '../engine/spieler.js';
import {
  KOERPER_KORRIDOR, generierungsProfil, bewerte, hauptPlatz, einsaetzeAuf,
  EINSATZ_VERFALL, eignungGemischt,
} from '../engine/positionen.js';

test('der Katalog kennt achtzehn Positionen, keinen Kicker und keinen Punter', () => {
  assert.equal(POSITIONS.length, 18);
  assert.equal(new Set(POSITIONS).size, 18, 'keine Position doppelt');
  for (const weg of ['K', 'P', 'OL', 'DL', 'LB', 'DB']) {
    assert.ok(!POSITIONS.includes(/** @type {any} */ (weg)), `${weg} ist aus dem Katalog`);
  }
  // Jede Position hängt in genau einer Gruppe, und jede Gruppe in einer Einheit.
  for (const pos of POSITIONS) {
    const gruppe = GRUPPE_JE_POSITION[pos];
    assert.ok(gruppe, `${pos} hat keine Gruppe`);
    assert.ok(POSITION_GRUPPEN[gruppe].includes(pos));
    assert.ok(EINHEIT_JE_GRUPPE[gruppe], `${gruppe} hat keine Einheit`);
  }
  assert.equal(Object.values(POSITION_GRUPPEN).flat().length, 18);
});

test('die Kaderform sind dreißig Mann, sechzehn Angriff und vierzehn Verteidigung', () => {
  assert.equal(KADER_GROESSE_EIGEN, 30);

  let offense = 0;
  let defense = 0;
  for (const pos of POSITIONS) {
    assert.equal(typeof KADER_FORM[pos], 'number', `${pos} fehlt in der Kaderform`);
    assert.equal(typeof ZUSATZ_GEWICHTE[pos], 'number', `${pos} fehlt in den Zusatzgewichten`);
    if (EINHEIT_JE_GRUPPE[GRUPPE_JE_POSITION[pos]] === 'offense') offense += KADER_FORM[pos];
    else defense += KADER_FORM[pos];
  }
  assert.equal(offense, 16);
  assert.equal(defense, 14);

  // Der eigene Verein hat keinen ausgebildeten Tight End — das ist die
  // Ausgangslage, nicht ein Versehen.
  assert.equal(KADER_FORM.TE, 0);
});

test('die fremden Vereine haben regelmäßig einen Tight End', () => {
  let mitTe = 0;
  for (let i = 0; i < 40; i++) {
    resetSpielerIds();
    const kader = macheKader(makeRng('te' + i), 58, ZUSATZ_SPIELER);
    if (kader.some((s) => s.position === 'TE')) mitTe++;
  }
  assert.ok(mitTe > 8, `nur ${mitTe} von 40 Vereinen haben einen TE`);
  assert.ok(mitTe < 40, 'aber nicht jeder');
});

test('die Nummernvergabe hält auch über viele Kader durch', () => {
  // Achtzehn Positionen teilen sich dieselben Bänder wie vorher acht. Der
  // Fehlerfall wirft, also fängt ihn ein Durchlauf über viele Ziehungen.
  for (let i = 0; i < 120; i++) {
    resetSpielerIds();
    const kader = macheKader(makeRng('nb' + i), 45 + (i % 30), ZUSATZ_SPIELER);
    assert.equal(new Set(kader.map((s) => s.nummer)).size, kader.length, `Kader ${i}`);
  }
});

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

test('Stärke bleibt unter dem Ligadeckel, egal wie hoch die Basis liegt', () => {
  resetSpielerIds();
  for (const basis of [45, 58, 65, 90]) {
    const kader = macheKader(makeRng('s' + basis), basis, ZUSATZ_SPIELER);
    for (const s of kader) {
      assert.ok(s.staerke >= 1 && s.staerke <= LIGA_MAX_STAERKE,
        `Stärke ${s.staerke} bei Basis ${basis}`);
    }
  }
  // Der Höhepunkt darf über den Deckel, die Stärke nie: eine Basis von 90
  // erzeugt Männer, die ohne die Klammer darüber lägen.
  const stark = macheKader(makeRng('hoch'), 90, ZUSATZ_SPIELER);
  assert.ok(stark.every((s) => s.staerke <= LIGA_MAX_STAERKE), 'Stärke nie über den Deckel');
  assert.ok(stark.some((s) => s.staerke === LIGA_MAX_STAERKE), 'der Deckel greift nie');
});

test('Talent steht in halben Sternen, 1 bis 10', () => {
  resetSpielerIds();
  for (const basis of [45, 58, 65, 90]) {
    const kader = macheKader(makeRng('t' + basis), basis, ZUSATZ_SPIELER);
    for (const s of kader) {
      assert.ok(Number.isInteger(s.talent), `Talent ${s.talent} ist keine ganze Zahl`);
      assert.ok(s.talent >= TALENT_MIN && s.talent <= TALENT_MAX,
        `Talent ${s.talent} bei Basis ${basis}`);
    }
  }
});

test('das Talent eines Kaders streut wirklich', () => {
  // Der Grund für den ganzen Umbau: solange Talent der Deckel über der Stärke
  // war, zeigte ein Kader dreißigmal dieselbe Stufe. Vier verschiedene sind
  // die Untergrenze dessen, was eine Spalte lesbar macht.
  resetSpielerIds();
  const kader = macheKader(makeRng('streuung'), EIGENE_VEREINSBASIS, ZUSATZ_SPIELER);
  const stufen = new Set(kader.map((s) => s.talent));
  assert.ok(stufen.size >= 4, `nur ${stufen.size} Talentstufen im Kader`);
});

test('Talent hängt nicht an der Stärke — es gibt schwache Talente und starke Ausgereizte', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('unabhaengig'), EIGENE_VEREINSBASIS, ZUSATZ_SPIELER);
  const median = [...kader].sort((a, b) => a.staerke - b.staerke)[Math.floor(kader.length / 2)].staerke;
  assert.ok(kader.some((s) => s.staerke < median && s.talent >= 6),
    'kein schwacher Mann mit Talent');
  assert.ok(kader.some((s) => s.staerke > median && s.talent <= 4),
    'kein starker Mann ohne Talent');
});

test('ein stärkerer Verein zieht im Schnitt mehr Talent', () => {
  const schnitt = (/** @type {number} */ basis) => {
    resetSpielerIds();
    const kader = macheKader(makeRng('b' + basis), basis, ZUSATZ_SPIELER);
    return kader.reduce((summe, s) => summe + s.talent, 0) / kader.length;
  };
  assert.ok(schnitt(65) > schnitt(45) + 1, 'die Vereinsbasis hebt das Talent nicht');
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
  const cbs = kader.filter((s) => s.position === 'CB');
  cbs[0].verletztBis = 5;

  const frei = verfuegbar(kader, 'CB', 3);
  assert.equal(frei.length, cbs.length - 1);
  assert.ok(!frei.some((s) => s.id === cbs[0].id));
  assert.equal(verfuegbar(kader, 'CB', 5).length, cbs.length);
});

test('Trikotnummern sind eindeutig und halten sich an ihr Band', () => {
  /** @type {Record<string, [number, number][]>} */
  const band = {
    QB: [[1, 19]],
    RB: [[20, 49]], FB: [[20, 49]],
    WR: [[10, 19], [80, 89]], SL: [[10, 19], [80, 89]],
    TE: [[40, 49], [80, 89]],
    T: [[50, 79]], G: [[50, 79]], C: [[50, 79]],
    DE: [[50, 79], [90, 99]], DT: [[50, 79], [90, 99]], NT: [[50, 79], [90, 99]],
    MIKE: [[40, 59], [90, 99]], SAM: [[40, 59], [90, 99]], WILL: [[40, 59], [90, 99]],
    CB: [[20, 49]], FS: [[20, 49]], SS: [[20, 49]],
  };

  for (const basis of [45, 58, 65]) {
    resetSpielerIds();
    const kader = macheKader(makeRng('nr' + basis), basis, ZUSATZ_SPIELER);
    const nummern = kader.map((s) => s.nummer);
    assert.equal(new Set(nummern).size, kader.length, `Basis ${basis}: keine Doppelung`);

    for (const s of kader) {
      assert.ok(s.nummer >= 0 && s.nummer <= 99, `Nummer ${s.nummer}`);
      if (s.nummer <= 9) {
        assert.ok(!POSITION_GRUPPEN.lineOffense.includes(s.position),
          `ein ${s.position} trägt nie eine einstellige Nummer`);
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

    // Alle stammen aus den zwölf stärksten Nicht-Linemen. Geprüft wird über
    // die Stärke des Zwölften, nicht über die Namensliste: stehen mehrere auf
    // demselben Wert, ist die Auswahl unter ihnen frei.
    const nichtLine = kader
      .filter((s) => !POSITION_GRUPPEN.lineOffense.includes(s.position))
      .sort((a, b) => b.staerke - a.staerke);
    const schwelle = nichtLine[11].staerke;
    for (const s of einstellig) {
      assert.ok(!POSITION_GRUPPEN.lineOffense.includes(s.position),
        `${seed}: ${s.position} ${s.nachname}`);
      assert.ok(s.staerke >= schwelle,
        `${seed}: ${s.nachname} hat ${s.staerke}, der Zwölfte ${schwelle}`);
    }
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

// --- Attribute und Körper --------------------------------------------------

test('jeder Spieler trägt alle fünfzehn Attribute und einen Körper', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('attr'), 58, ZUSATZ_SPIELER);
  assert.equal(ATTRIBUTE.length, 15);

  for (const s of kader) {
    for (const attribut of ATTRIBUTE) {
      const wert = s.attribute[attribut];
      assert.equal(typeof wert, 'number', `${s.position} ohne ${attribut}`);
      assert.ok(Number.isInteger(wert), `${attribut} ist ${wert}`);
      assert.ok(wert >= 1 && wert <= LIGA_MAX_STAERKE, `${attribut} ist ${wert}`);
    }
    assert.equal(Object.keys(s.attribute).length, ATTRIBUTE.length);
    // Gegen die Konstanten, nicht gegen abgeschriebene Zahlen: die Grenzen
    // hängen an den Korridoren und wandern mit ihnen.
    assert.ok(s.groesse >= GROESSE_MIN && s.groesse <= GROESSE_MAX, `Größe ${s.groesse}`);
    assert.ok(s.gewicht >= GEWICHT_MIN && s.gewicht <= GEWICHT_MAX, `Gewicht ${s.gewicht}`);
  }
});

test('die Attribute treffen die Stärke des Spielers wieder', () => {
  // Schritt vier der Ziehung: skalieren, bis die Positionsformel ungefähr die
  // Stärke ergibt. Ohne ihn wäre die Führungsgröße von den Werten entkoppelt.
  for (const basis of [45, 58, 70]) {
    resetSpielerIds();
    const kader = macheKader(makeRng('sk' + basis), basis, ZUSATZ_SPIELER);
    for (const s of kader) {
      const wert = bewerte(s.attribute, generierungsProfil(s.position));
      assert.ok(Math.abs(wert - s.staerke) < 2,
        `${s.position}: Positionswert ${wert.toFixed(1)} gegen Stärke ${s.staerke}`);
    }
  }
});

test('etwa ein Fünftel steht neben seinem Korridor', () => {
  let drin = 0;
  let daneben = 0;
  for (const pos of POSITIONS) {
    for (let i = 0; i < 60; i++) {
      resetSpielerIds();
      const s = macheSpieler(makeRng('k' + pos + i), pos, 58);
      const [von, bis] = KOERPER_KORRIDOR[pos].gewicht;
      if (s.gewicht < von || s.gewicht > bis) daneben++; else drin++;
    }
  }
  const anteil = daneben / (drin + daneben);
  assert.ok(anteil > 0.12 && anteil < 0.30, `${(anteil * 100).toFixed(0)} % stehen daneben`);
});

test('der schwere Mann ist stark und langsam, der leichte beweglich und schwach', () => {
  // Gleiche Position, gleiche Stärke, gleicher Zufall — nur der Körper anders.
  const leicht = ziehAttribute(makeRng('koerper'), 'T', 55, 95);
  const schwer = ziehAttribute(makeRng('koerper'), 'T', 55, 140);

  assert.ok(schwer.kraft > leicht.kraft, 'der Schwere ist stärker');
  assert.ok(leicht.beweglichkeit > schwer.beweglichkeit, 'der Leichte ist beweglicher');
  assert.ok(leicht.schnelligkeit > schwer.schnelligkeit, 'der Leichte ist schneller');
});

test('kein Lineman ist schnell', () => {
  // Auch der leichte Tackle nicht: Tempo steht in keiner seiner beiden
  // Formeln, also zieht das Profil ihn nie dorthin.
  for (const pos of [...POSITION_GRUPPEN.lineOffense, ...POSITION_GRUPPEN.lineDefense]) {
    for (let i = 0; i < 60; i++) {
      resetSpielerIds();
      const s = macheSpieler(makeRng('t' + pos + i), pos, 75);
      assert.ok(s.attribute.schnelligkeit < s.staerke,
        `${pos} läuft ${s.attribute.schnelligkeit} bei Stärke ${s.staerke}`);
    }
  }
});

test('Körper und Attribute sind beim selben Seed dieselben', () => {
  resetSpielerIds();
  const a = macheSpieler(makeRng('gleich'), 'MIKE', 60);
  resetSpielerIds();
  const b = macheSpieler(makeRng('gleich'), 'MIKE', 60);
  assert.equal(a.groesse, b.groesse);
  assert.equal(a.gewicht, b.gewicht);
  assert.deepEqual(a.attribute, b.attribute);
});

test('die Attribute wandern mit der Stärke durch den Saisonwechsel', () => {
  resetSpielerIds();
  const rng = makeRng('alt');
  let kader = macheKader(rng, 58, ZUSATZ_SPIELER);
  const alt = kader.find((s) => s.alter >= 33 && s.alter < 45);
  assert.ok(alt, 'es gibt einen Spieler im Abstieg');
  const vorher = { ...alt.attribute };

  kader = saisonWechsel(rng, kader, 58).kader;
  const nachher = kader.find((s) => s.id === alt.id);
  assert.ok(nachher, 'er ist noch da');
  assert.ok(nachher.staerke < alt.staerke, 'er hat abgebaut');
  // Alterskurven je Attribut kommen mit dem Entwicklungskonzept; bis dahin
  // altern alle Werte gleichmäßig. Geprüft wird die Summe und dass keiner
  // steigt — je Attribut einzeln zu fordern, dass es fällt, hängt an der
  // Rundung: ein Punkt weniger Stärke lässt eine 22 auf 21,5 sinken, und die
  // steht danach wieder auf 22.
  const summe = (/** @type {Record<string, number>} */ a) =>
    ATTRIBUTE.reduce((s, attribut) => s + a[attribut], 0);
  assert.ok(summe(nachher.attribute) < summe(vorher), 'die Attribute stehen still');
  for (const attribut of ATTRIBUTE) {
    assert.ok(nachher.attribute[attribut] <= vorher[attribut],
      `${attribut} steigt beim Abbau: ${vorher[attribut]} -> ${nachher.attribute[attribut]}`);
  }
});

test('dieselbe Stärke in einem anderen Alter folgt der Kurve', () => {
  // Hin und zurück landet wieder in der Nähe — der Rundungsdrift je Schritt
  // ist der Preis dafür, dass kein Deckel mehr gespeichert wird.
  assert.ok(Math.abs(staerkeImAlter(staerkeImAlter(60, 27, 33), 33, 27) - 60) <= 1);
  // Vor dem Zenit hebt die Kurve, danach senkt sie.
  assert.ok(staerkeImAlter(40, 18, 27) > 40, 'ein Achtzehnjähriger wächst nicht');
  assert.ok(staerkeImAlter(70, 27, 40) < 70, 'ein Vierzigjähriger fällt nicht');
  // Und sie rechnet dasselbe wie die Ziehung, solange niemand den Mann anfasst.
  assert.equal(staerkeImAlter(berechneStaerke(70, 27), 27, 33), berechneStaerke(70, 33));
});

// --- Einsätze --------------------------------------------------------------

test('das Sollprofil ist die Ziehung ohne Rauschen', () => {
  // Vier gleiche Ziehungen ergeben in randNormal exakt null Abweichung, also
  // muss ziehAttribute mit einem konstanten Zufall dasselbe liefern.
  for (const position of ['G', 'WR', 'MIKE']) {
    const [von, bis] = KOERPER_KORRIDOR[position].gewicht;
    const gewicht = (von + bis) / 2;
    assert.deepEqual(
      sollAttribute(position, 60, gewicht),
      ziehAttribute(() => 0.5, position, 60, gewicht),
      position,
    );
  }
});

test('das Sollprofil trägt den Körper des Mannes, nicht den der Position', () => {
  // Derselbe Linebacker-Platz, zwei Körper: der schwere bleibt langsam.
  const leicht = sollAttribute('MIKE', 60, 100);
  const schwer = sollAttribute('MIKE', 60, 145);
  assert.ok(schwer.kraft > leicht.kraft, 'der Schwere ist stärker');
  assert.ok(schwer.schnelligkeit < leicht.schnelligkeit, 'und langsamer');
});

test('ein Einsatz zählt und zieht die Attribute auf den Platz zu', () => {
  resetSpielerIds();
  const s = macheSpieler(makeRng('einsatz'), 'G', 60, { alter: 24, seite: 'L' });
  const vorher = { ...s.attribute };
  const soll = sollAttribute('MIKE', s.staerke, s.gewicht);

  spieleEinsatz(s, 'MIKE');
  assert.equal(einsaetzeAuf(s, 'MIKE'), 1, 'der Zähler steht');

  // Jedes Attribut rückt ein Stück in Richtung Sollwert und schießt nicht
  // darüber hinaus. Wo es schon stimmt, bewegt sich nichts.
  for (const attribut of ATTRIBUTE) {
    const weg = soll[attribut] - vorher[attribut];
    const schritt = s.attribute[attribut] - vorher[attribut];
    assert.ok(Math.abs(schritt) <= Math.abs(weg) + 1e-9, `${attribut} schießt über das Ziel`);
    if (weg !== 0) assert.ok(schritt * weg > 0, `${attribut} geht in die falsche Richtung`);
  }
});

test('elf Einsätze sind eine Saison, und Handwerk lernt schneller als Tempo', () => {
  resetSpielerIds();
  const s = macheSpieler(makeRng('saison'), 'WR', 60, { alter: 24 });
  const vorher = { ...s.attribute };
  const soll = sollAttribute('QB', s.staerke, s.gewicht);
  for (let i = 0; i < 11; i++) spieleEinsatz(s, 'QB');

  // Welchen Anteil des Wegs eine Saison bringt, hängt allein an der Lernrate.
  const erwartet = (rate) => 1 - (1 - ATTRIBUT_DRIFT_JE_SPIEL * rate) ** 11;
  assert.ok(erwartet(1) > 0.13 && erwartet(1) < 0.17,
    `mit Rate 1 sind es ${(erwartet(1) * 100).toFixed(1)} %`);

  for (const attribut of ['technik', 'werfen', 'schnelligkeit', 'spielverstaendnis']) {
    const weg = soll[attribut] - vorher[attribut];
    if (weg === 0) continue;
    const anteil = (s.attribute[attribut] - vorher[attribut]) / weg;
    const soll1 = erwartet(LERNRATE[attribut] ?? 1);
    assert.ok(Math.abs(anteil - soll1) < 0.005,
      `${attribut}: ${(anteil * 100).toFixed(1)} % statt ${(soll1 * 100).toFixed(1)} %`);
  }

  assert.ok(erwartet(LERNRATE.technik) > 2 * erwartet(LERNRATE.schnelligkeit),
    'Handwerk holt er mehr als doppelt so schnell auf wie Tempo');
  assert.equal(einsaetzeAuf(s, 'QB'), 11);
});

test('geteilte Einsatzzeit zieht anteilig in beide Richtungen', () => {
  resetSpielerIds();
  const rng = makeRng('geteilt');
  const ganz = macheSpieler(rng, 'WR', 60, { alter: 24 });
  const halb = { ...ganz, attribute: { ...ganz.attribute }, einsaetze: {} };

  for (let i = 0; i < 10; i++) spieleEinsatz(ganz, 'QB');
  for (let i = 0; i < 5; i++) { spieleEinsatz(halb, 'QB'); spieleEinsatz(halb, 'WR'); }

  assert.ok(halb.attribute.werfen < ganz.attribute.werfen,
    'wer nur die Hälfte dort steht, lernt weniger');
  assert.equal(einsaetzeAuf(halb, 'QB'), 5);
  assert.equal(einsaetzeAuf(halb, 'WR'), 5);
});

test('fünf Saisons als Receiver drehen den Pass eines Cornerbacks', () => {
  // Wie lange es dauert, hängt am Mann: dieser braucht fünf Saisons, ein
  // anderer drei. Der Körper ist da (2,5 kg Korridorabstand), das Handwerk
  // nicht — die Drift muss es holen.
  resetSpielerIds();
  const s = macheSpieler(makeRng('umschulung'), 'CB', 60, { alter: 22 });
  assert.equal(hauptPlatz(s), 'CB');
  for (let saison = 0; saison < 5; saison++) {
    for (let i = 0; i < 12; i++) spieleEinsatz(s, 'WR');
    s.einsaetze = verfalleEinsaetze(s.einsaetze);
  }
  assert.ok(eignungGemischt(s, 'WR', 0.5) > eignungGemischt(s, 'CB1', 0.5),
    'er ist dort inzwischen der Bessere');
  assert.equal(hauptPlatz(s), 'WR');
  assert.equal(s.position, 'CB', 'seine Ausbildung steht weiter im Pass');
});

test('ein Guard bleibt Guard, so lange man ihn auch Linebacker spielen lässt', () => {
  // Der Gegenfall: die Einsätze sind da, die Stärke nie. Ein Kadermangel, der
  // einen Mann acht Saisons auf einen fremden Platz stellt, macht ihn nicht zu
  // einem — im Roster nicht und in Runde eins der Aufstellung erst recht nicht.
  resetSpielerIds();
  const s = macheSpieler(makeRng('umschulung2'), 'G', 60, { alter: 22, seite: 'L' });
  // Erst der Körper, dann die Behauptung: ein Guard am unteren Rand seines
  // Korridors wiegt so viel wie ein Linebacker, und den **soll** die Eignung
  // irgendwann umschulen. Ohne diese Zeile prüfte der Test bei einer anderen
  // Ziehung stumm den Grenzfall statt den Fall.
  assert.ok(s.gewicht >= 120, `dieser Guard wiegt nur ${s.gewicht} kg`);
  for (let saison = 0; saison < 8; saison++) {
    for (let i = 0; i < 12; i++) spieleEinsatz(s, 'MIKE');
    s.einsaetze = verfalleEinsaetze(s.einsaetze);
  }
  assert.ok(einsaetzeAuf(s, 'MIKE') > 30, 'die Einsätze allein wären längst genug');
  assert.ok(eignungGemischt(s, 'MIKE', 0.5) < eignungGemischt(s, 'LG', 0.5));
  assert.equal(hauptPlatz(s), 'LG');
});

test('der Verfall frisst jeden Platz und räumt die Reste weg', () => {
  const uebrig = verfalleEinsaetze({ LG: 40, MIKE: 10, SAM: 0.5 });
  assert.equal(uebrig.LG, 40 * EINSATZ_VERFALL);
  assert.equal(uebrig.MIKE, 10 * EINSATZ_VERFALL);
  assert.ok(!('SAM' in uebrig), 'was unter ein halbes Spiel fällt, verschwindet');
  assert.deepEqual(verfalleEinsaetze(undefined), {});
});

test('der Jahreswechsel lässt die Einsätze verfallen und rundet die Werte', () => {
  resetSpielerIds();
  const s = macheSpieler(makeRng('winter'), 'G', 60, { alter: 24, seite: 'L' });
  for (let i = 0; i < 11; i++) spieleEinsatz(s, 'MIKE');
  const vorWinter = einsaetzeAuf(s, 'MIKE');

  const { kader } = saisonWechsel(makeRng('winter2'), [s], 60);
  const danach = kader[0];
  assert.ok(einsaetzeAuf(danach, 'MIKE') < vorWinter, 'die Einsätze verfallen');
  for (const attribut of ATTRIBUTE) {
    assert.equal(danach.attribute[attribut], Math.round(danach.attribute[attribut]),
      `${attribut} steht nach dem Winter krumm`);
  }
});
