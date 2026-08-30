// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng, ZUSATZ_SPIELER, ERSATZ_STAERKE } from '../engine/constants.js';
import {
  macheKader, macheSpieler, resetSpielerIds, setzeStaerke, spieleEinsatz, verfalleEinsaetze,
} from '../engine/spieler.js';
import { PLAETZE, hauptPlatz, einsaetzeAuf, EINGESPIELT_VOLL } from '../engine/positionen.js';
import {
  PERSONNEL, PERSONNEL_REIHE, STANDARD_PERSONNEL, OL_PLAETZE, QB_PLATZ, DEFENSE_PLAETZE,
  BLOCK_GEWICHT, PLATZ_ANTEIL, SKILL_LEITER, SKILL_ROLLE, SKILL_NORM,
  stelleAuf, skillAnteile, doppelAbzug, doppelRisiko, doppelEinsaetze, umstellungen,
  platzStaerke, alsVorgabe, setzePlatz, bestenFuer,
} from '../engine/aufstellung.js';
import { teamStaerken } from '../engine/team.js';

/** Ein voller Kader, wie ihn ein fremder Verein hat. */
function kader(seed = 'auf', basis = 58, zusatz = ZUSATZ_SPIELER) {
  resetSpielerIds();
  return macheKader(makeRng(seed), basis, zusatz);
}

test('acht Gruppierungen, jede mit fünf gültigen Skill-Plätzen', () => {
  assert.equal(Object.keys(PERSONNEL).length, 8);
  assert.ok(PERSONNEL[STANDARD_PERSONNEL], 'die Standardgruppierung gibt es');

  for (const [id, g] of Object.entries(PERSONNEL)) {
    assert.equal(g.skill.length, 5, `${id} hat ${g.skill.length} Skill-Plätze`);
    for (const platz of g.skill) assert.ok(PLAETZE[platz], `${id} kennt ${platz} nicht`);
    assert.ok(g.passAnteil > 0 && g.passAnteil < 1, `${id}: Passanteil ${g.passAnteil}`);
  }
  // Von der luftigsten zur schwersten Gruppierung fällt der Passanteil.
  assert.ok(PERSONNEL['00'].passAnteil > PERSONNEL['11'].passAnteil);
  assert.ok(PERSONNEL['11'].passAnteil > PERSONNEL['32'].passAnteil);

  // Die Lesereihenfolge deckt den Katalog vollständig ab. Object.keys() tut
  // das nicht in dieser Reihenfolge: '10' ist für JavaScript ein
  // Zahlenschlüssel, '00' nicht.
  assert.deepEqual([...PERSONNEL_REIHE].sort(), Object.keys(PERSONNEL).sort());
  assert.equal(PERSONNEL_REIHE[0], '00');
  assert.equal(PERSONNEL_REIHE[PERSONNEL_REIHE.length - 1], '32');
});

test('jede Gewichtszeile summiert auf eins', () => {
  for (const einheit of /** @type {const} */ (['angriff', 'verteidigung'])) {
    for (const art of /** @type {const} */ (['pass', 'lauf'])) {
      const summe = Object.values(BLOCK_GEWICHT[einheit][art]).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(summe - 1) < 1e-9, `${einheit} ${art}: ${summe}`);
    }
  }
  for (const block of /** @type {const} */ (['ol', 'dl', 'lb', 'db'])) {
    for (const art of /** @type {const} */ (['pass', 'lauf'])) {
      const summe = Object.values(PLATZ_ANTEIL[block][art]).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(summe - 1) < 1e-9, `${block} ${art}: ${summe}`);
    }
  }
  for (const art of /** @type {const} */ (['pass', 'lauf'])) {
    const summe = SKILL_LEITER[art].reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(summe - 1) < 1e-9, `Leiter ${art}: ${summe}`);
  }
});

/** Die Summe der Anteile: der Blockfaktor einer Gruppierung. */
const faktor = (skill, art) => skillAnteile(skill)[art].reduce((a, b) => a + b, 0);

test('der Rollenwert ergibt genau die alte Reihenfolge', () => {
  // Die Zahlen sind kein neues Modell, sie machen die bestehende Reihenfolge
  // nur messbar. Absteigend sortiert muss sie wieder herauskommen.
  const reihe = (art) => Object.entries(SKILL_ROLLE[art])
    .sort((a, b) => b[1] - a[1]).map(([pos]) => pos);
  assert.deepEqual(reihe('pass'), ['WR', 'SL', 'TE', 'RB', 'FB']);
  assert.deepEqual(reihe('lauf'), ['RB', 'FB', 'TE', 'SL', 'WR']);
});

test('die Skill-Leiter sortiert im Pass nach vorn, im Lauf nach hinten', () => {
  const anteile = skillAnteile(['RB', 'TE', 'WR', 'WR', 'SL']);
  const groesster = (a) => a.indexOf(Math.max(...a));
  assert.equal(groesster(anteile.pass), 2, 'der erste WR führt das Passspiel an');
  assert.equal(groesster(anteile.lauf), 0, 'der RB führt das Laufspiel an');
  // Zwei Receiver stehen vor ihm, dazu Slot und Tight End: im Passspiel ist
  // der Runningback der fünfte von fünf.
  assert.equal(anteile.pass.indexOf(Math.min(...anteile.pass)), 0);
});

test('das Standard-Personnel ist die Normale', () => {
  // 11 personnel steht in beiden Spielarten bei genau eins — daran misst sich
  // alles andere.
  for (const art of /** @type {const} */ (['pass', 'lauf'])) {
    assert.ok(Math.abs(faktor(PERSONNEL[STANDARD_PERSONNEL].skill, art) - 1) < 1e-9);
    assert.ok(SKILL_NORM[art] > 0 && SKILL_NORM[art] < 1);
  }
});

test('schweres Personal kann nicht werfen, luftiges nicht laufen', () => {
  // Das ist der ganze Punkt des Rollenwerts: die Anteile summieren bewusst
  // nicht auf eins, ihre Summe ist der Preis der Gruppierung.
  const dw = PERSONNEL['32'].skill;
  const empty = PERSONNEL['00'].skill;
  assert.ok(faktor(dw, 'pass') < 0.80, 'Double Wing wirft schlecht');
  assert.ok(faktor(dw, 'lauf') > 1.15, 'Double Wing läuft gut');
  assert.ok(faktor(empty, 'pass') > 1.03, 'Empty wirft gut');
  assert.ok(faktor(empty, 'lauf') < 0.90, 'Empty läuft schlecht');

  // Und keine Gruppierung ist in beiden Spielarten die beste.
  for (const g of Object.values(PERSONNEL)) {
    const p = faktor(g.skill, 'pass');
    const l = faktor(g.skill, 'lauf');
    assert.ok(p > 0.7 && p < 1.3, `Passfaktor ${p}`);
    assert.ok(l > 0.7 && l < 1.3, `Lauffaktor ${l}`);
    assert.ok(p <= 1 || l <= 1, 'niemand steht in beiden Spielarten über der Normale');
    assert.ok(p >= 1 || l >= 1, 'und niemand in beiden darunter');
  }

  // Der Passanteil ist danach eine echte Entscheidung: mit demselben Kader
  // liegen richtige und falsche Ausrichtung weit auseinander.
  const k = kader('ausrichtung');
  const gemischt = (personnel, anteil) => {
    const s = teamStaerken(k, 1, personnel, anteil);
    return s.passAngriff * anteil + s.laufAngriff * (1 - anteil);
  };
  assert.ok(gemischt('32', 0.1) - gemischt('32', 0.9) > 3, 'Double Wing will laufen');
  assert.ok(gemischt('00', 0.9) - gemischt('00', 0.1) > 2, 'Empty will werfen');
});

test('kein Platz bleibt leer, und niemand steht doppelt', () => {
  for (const personnel of Object.keys(PERSONNEL)) {
    const a = stelleAuf(kader('leer' + personnel), 1, personnel);
    assert.equal(a.offense.length, 11);
    assert.equal(a.defense.length, 11);
    for (const p of [...a.offense, ...a.defense]) {
      assert.ok(p.spieler, `${personnel}: ${p.platz} ist leer`);
    }
    assert.equal(doppelEinsaetze(a).length, 0, `${personnel}: niemand muss doppelt ran`);
    assert.ok(a.k && a.p, 'gekickt wird auch');

    const ids = [...a.offense, ...a.defense].map((p) => p.spieler && p.spieler.id);
    assert.equal(new Set(ids).size, 22, `${personnel}: zweiundzwanzig verschiedene Leute`);
  }
});

test('die Aufstellung stellt die Plätze der Formation', () => {
  const a = stelleAuf(kader(), 1, '11');
  assert.deepEqual(a.offense.map((p) => p.platz),
    [QB_PLATZ, ...PERSONNEL['11'].skill, ...OL_PLAETZE]);
  assert.deepEqual(a.defense.map((p) => p.platz), [...DEFENSE_PLAETZE]);
});

test('der Quarterback steht vorn, die Linie hinten', () => {
  for (const personnel of PERSONNEL_REIHE) {
    const plaetze = stelleAuf(kader(), 1, personnel).offense.map((p) => p.platz);
    assert.equal(plaetze[0], QB_PLATZ, `${personnel}: der QB steht nicht vorn`);
    assert.deepEqual(plaetze.slice(-OL_PLAETZE.length), [...OL_PLAETZE],
      `${personnel}: die Linie steht nicht am Ende`);
    assert.deepEqual(plaetze.slice(1, 1 + PERSONNEL[personnel].skill.length),
      PERSONNEL[personnel].skill, `${personnel}: die Skill-Plätze stehen falsch`);
  }
});

test('jeder Platz weiß, was sein Mann dort wert ist', () => {
  const a = stelleAuf(kader(), 1, '11', 0.6);
  for (const p of [...a.offense, ...a.defense]) {
    assert.ok(p.staerke > 0, `${p.platz} hat keine Stärke`);
    assert.ok(p.staerke <= 100, `${p.platz}: ${p.staerke} liegt über der Skala`);
    assert.equal(p.staerke, platzStaerke(p, 0.6), `${p.platz} rechnet anders als platzStaerke`);
  }
});

test('ein Umsteller ist auf seinem Platz weniger wert als daheim', () => {
  const a = stelleAuf(kader(), 1, '11', 0.6);
  const um = [...a.offense, ...a.defense].find((p) => p.umgestellt && !p.doppel);
  if (!um || !um.spieler) return;   // nicht jeder Kader stellt um
  const daheim = { ...um, platz: eigenerPlatz(um.spieler.position), umgestellt: false };
  assert.ok(platzStaerke(um, 0.6) < platzStaerke(daheim, 0.6),
    `${um.platz}: der Umsteller steht dort nicht schlechter da`);
});

/** Irgendein Platz, auf dem diese Position zu Hause ist. @param {string} position */
function eigenerPlatz(position) {
  const treffer = Object.keys(PLAETZE).find((k) => PLAETZE[k].position === position);
  if (!treffer) throw new Error(`Kein Platz für ${position}`);
  return treffer;
}

test('der Doppeleinsatz kostet auch in der angezeigten Stärke', () => {
  const a = stelleAuf(kader('doppel', 58, 0), 1, '11', 0.6);
  for (const p of [...a.offense, ...a.defense]) {
    if (!p.doppel || !p.spieler) continue;
    assert.ok(p.staerke < platzStaerke({ ...p, doppel: false }, 0.6),
      `${p.platz}: der zweite Einsatz kostet nichts`);
  }
});

test('die Stärke entscheidet, wer spielt — die Seite, wo', () => {
  const k = kader('staerke');
  const a = stelleAuf(k, 1, '11');
  const lt = a.offense.find((p) => p.platz === 'LT');
  const rt = a.offense.find((p) => p.platz === 'RT');

  // Wer spielt: die beiden stärksten Tackles, keine Frage der Seite.
  const staerkste = k.filter((s) => s.position === 'T')
    .sort((x, y) => y.staerke - x.staerke).slice(0, 2).map((s) => s.id);
  assert.deepEqual([lt.spieler.id, rt.spieler.id].sort(), staerkste.sort());

  // Wo: jeder auf der Seite, auf der er ausgebildet ist.
  assert.equal(lt.spieler.seite, 'L');
  assert.equal(rt.spieler.seite, 'R');
  assert.equal(lt.umgestellt, false);
  assert.equal(rt.umgestellt, false);
});

test('der stärkere Mann bekommt nicht den vorderen, sondern seinen Platz', () => {
  // Der Fall, an dem das Füllen Platz für Platz scheitert: der stärkere Guard
  // ist rechts ausgebildet. Nach Stärke allein nähme er LG, weil LG in der
  // Liste vorn steht; nach Eignung Platz für Platz ebenfalls, weil er auch mit
  // acht Prozent Abzug noch vor dem schwächeren liegt. Dann stünden beide
  // falsch statt keiner.
  const rng = makeRng('seiten');
  const stark = macheSpieler(rng, 'G', 70, { seite: 'R' });
  const schwach = macheSpieler(rng, 'G', 45, { seite: 'L' });
  setzeStaerke(stark, 75);
  setzeStaerke(schwach, 50);

  const a = stelleAuf([stark, schwach], 1, '11');
  assert.equal(a.offense.find((p) => p.platz === 'RG').spieler.id, stark.id);
  assert.equal(a.offense.find((p) => p.platz === 'LG').spieler.id, schwach.id);
});

test('eine leere Position holt sich den besten Umsteller', () => {
  // Der eigene Verein hat keinen ausgebildeten Tight End. Wer dort steht, ist
  // umgestellt — und der Abschlag kommt aus der fehlenden Technik, nicht aus
  // einer Strafe von außen.
  const eigen = kader('eigen', 45, 0);
  assert.equal(eigen.filter((s) => s.position === 'TE').length, 0);

  const a = stelleAuf(eigen, 1, '11');
  const te = a.offense.find((p) => p.platz === 'TE');
  assert.ok(te.spieler, 'der Platz ist trotzdem besetzt');
  assert.equal(te.umgestellt, true);
  assert.notEqual(te.spieler.position, 'TE');
  assert.equal(umstellungen(a), 1, 'und sonst steht jeder richtig');

  // Je mehr Tight Ends ein System verlangt, desto mehr wird umgestellt.
  assert.equal(umstellungen(stelleAuf(eigen, 1, '32')), 3);
  assert.equal(umstellungen(stelleAuf(eigen, 1, '20')), 0);
});

test('erst ein dünner Kader zwingt zum Doppeleinsatz', () => {
  const k = kader('duenn', 45, 0);
  assert.equal(doppelEinsaetze(stelleAuf(k, 1, '11')).length, 0);

  // Der Reihe nach ausfallen lassen, bis der erste zweimal ran muss.
  let ausfaelle = 0;
  while (doppelEinsaetze(stelleAuf(k, 1, '11')).length === 0 && ausfaelle < k.length) {
    k[ausfaelle].verletztBis = 5;
    ausfaelle++;
  }
  assert.ok(ausfaelle > 5 && ausfaelle < 15,
    `nach ${ausfaelle} Ausfällen muss der erste doppelt ran`);

  const a = stelleAuf(k, 1, '11');
  const doppelt = [...a.offense, ...a.defense].filter((p) => p.doppel);
  assert.ok(doppelt.length > 0);
  for (const p of doppelt) assert.ok(p.spieler, 'ein Doppeleinsatz hat einen Spieler');
  // Auch dann bleibt kein Platz leer.
  for (const p of [...a.offense, ...a.defense]) assert.ok(p.spieler, `${p.platz} ist leer`);
});

test('der Doppeleinsatz ist teuer und wird linear interpoliert', () => {
  assert.equal(doppelAbzug(80), 0.15);
  assert.equal(doppelAbzug(50), 0.28);
  assert.equal(doppelAbzug(20), 0.40);
  assert.equal(doppelAbzug(99), 0.15, 'darüber bleibt es flach');
  assert.equal(doppelAbzug(1), 0.40, 'darunter auch');
  assert.ok(Math.abs(doppelAbzug(65) - 0.215) < 1e-9, 'dazwischen linear');

  assert.equal(doppelRisiko(80), 2.0);
  assert.equal(doppelRisiko(50), 3.0);
  assert.equal(doppelRisiko(20), 4.0);
  assert.ok(Math.abs(doppelRisiko(35) - 3.5) < 1e-9);

  // Beide Kurven laufen in dieselbe Richtung: wer wenig hat, zahlt mehr.
  for (let w = 20; w < 80; w += 5) {
    assert.ok(doppelAbzug(w) > doppelAbzug(w + 5));
    assert.ok(doppelRisiko(w) > doppelRisiko(w + 5));
  }
});

test('teamStaerken liefert Lauf und Pass getrennt', () => {
  const s = teamStaerken(kader('werte'), 1);
  for (const feld of ['passAngriff', 'laufAngriff', 'passVerteidigung', 'laufVerteidigung']) {
    assert.equal(typeof s[feld], 'number', feld);
    assert.ok(s[feld] > ERSATZ_STAERKE && s[feld] < 79, `${feld} ist ${s[feld]}`);
  }
  assert.ok(s.aufstellung, 'die Aufstellung hängt mit dran');
});

test('dieselben elf Leute sind in verschiedenen Systemen verschieden viel wert', () => {
  const k = kader('system');
  const werte = Object.keys(PERSONNEL).map((p) => teamStaerken(k, 1, p));
  const pass = werte.map((w) => w.passAngriff);
  assert.ok(Math.max(...pass) - Math.min(...pass) > 0.3, 'die Systeme unterscheiden sich');

  // Und zwar in der richtigen Richtung: das schwere System verschiebt das
  // Verhältnis zum Laufspiel, das leere zum Passspiel.
  const leer = teamStaerken(k, 1, '00');
  const schwer = teamStaerken(k, 1, '32');
  assert.ok(schwer.laufAngriff / schwer.passAngriff > leer.laufAngriff / leer.passAngriff);
});

test('ein voller Kader kommt der Ersatzstärke nie nahe', () => {
  // ERSATZ_STAERKE ist kein Notnagel mehr. Sie steht nur noch für den
  // buchstäblich leeren Kader.
  const s = teamStaerken(kader('voll'), 1);
  assert.ok(Math.min(s.passAngriff, s.laufAngriff,
    s.passVerteidigung, s.laufVerteidigung) > ERSATZ_STAERKE + 10);

  const leer = teamStaerken([], 1);
  // Die Gruppierung kippt auch ein leeres Feld nach ihrer Neigung. Was bleibt,
  // ist das hälftige Mittel — genau das, was `spreize()` verspricht.
  assert.equal((leer.passAngriff + leer.laufAngriff) / 2, ERSATZ_STAERKE);
  assert.equal(leer.laufVerteidigung, ERSATZ_STAERKE, 'die Defense kennt kein Personnel');
  assert.equal(leer.passVerteidigung, ERSATZ_STAERKE);
  assert.equal(leer.special, ERSATZ_STAERKE);
});

test('der Passanteil des Vereins verschiebt nur, wer nachrückt', () => {
  const eigen = kader('anteil', 45, 0);
  const laufig = stelleAuf(eigen, 1, '11', 0.2);
  const passig = stelleAuf(eigen, 1, '11', 0.9);
  // Die Plätze bleiben dieselben, nur die Umstellung kann anders ausfallen.
  assert.deepEqual(laufig.offense.map((p) => p.platz), passig.offense.map((p) => p.platz));
  for (const a of [laufig, passig]) {
    for (const p of [...a.offense, ...a.defense]) assert.ok(p.spieler, p.platz);
  }
});

test('ein Umgeschulter steht auf seinem Hauptplatz und gilt nicht als Umsteller', () => {
  // Ein Cornerback, den fünf Saisons als Receiver dorthin gezogen haben, ist
  // einer: die Einsätze sind da und er ist dort der Stärkere. Er muss in Runde
  // eins gegriffen werden, nicht erst als Notlösung in Runde zwei — und die
  // Marke „umgestellt" gehört ihm nicht mehr.
  const rng = makeRng('umgeschult');
  const umgeschult = macheSpieler(rng, 'CB', 60, { alter: 24 });
  setzeStaerke(umgeschult, 70);
  for (let saison = 0; saison < 5; saison++) {
    for (let i = 0; i < 12; i++) spieleEinsatz(umgeschult, 'WR');
    umgeschult.einsaetze = verfalleEinsaetze(umgeschult.einsaetze);
  }
  assert.ok(einsaetzeAuf(umgeschult, 'WR') > EINGESPIELT_VOLL);
  assert.equal(hauptPlatz(umgeschult), 'WR');

  const echterCB = macheSpieler(rng, 'CB', 60, { alter: 24 });
  setzeStaerke(echterCB, 50);

  const a = stelleAuf([umgeschult, echterCB], 1, '11');
  const seiner = a.offense.filter((p) => p.platz === 'WR')
    .find((p) => p.spieler && p.spieler.id === umgeschult.id);
  assert.ok(seiner, 'er besetzt einen Receiverplatz');
  assert.equal(seiner.umgestellt, false, 'und ist dort kein Umsteller mehr');

  // Der Cornerbackplatz bleibt dem, der noch einer ist.
  const cbs = a.defense.filter((p) => p.platz === 'CB1' || p.platz === 'CB2');
  assert.ok(cbs.some((p) => p.spieler && p.spieler.id === echterCB.id));
});

// --- Die Vorgabe des Managers ----------------------------------------------

test('jeder Platz trägt einen Schlüssel, und keiner zweimal denselben', () => {
  for (const personnel of PERSONNEL_REIHE) {
    const a = stelleAuf(kader(), 1, personnel);
    const alle = [...a.offense, ...a.defense].map((p) => p.schluessel);
    assert.equal(new Set(alle).size, alle.length, `${personnel} vergibt einen Schlüssel doppelt`);
  }

  // 12 personnel stellt zwei Tight Ends auf. Ohne laufende Nummer könnte eine
  // Vorgabe nicht sagen, welchen von beiden sie meint.
  const zwei = stelleAuf(kader(), 1, '12').offense.map((p) => p.schluessel);
  assert.ok(zwei.includes('TE'), 'der erste Tight End heißt wie sein Platz');
  assert.ok(zwei.includes('TE#2'), 'der zweite bekommt eine Nummer');
});

test('die Vorgabe steht vor der Automatik', () => {
  const k = kader('vorgabe');
  const ohne = stelleAuf(k, 1, '11');
  const vorher = ohne.offense.find((p) => p.schluessel === 'LT');

  // Ein Cornerback auf dem linken Tackle: das stellt die Automatik nie.
  const cb = k.find((s) => s.position === 'CB');
  const a = stelleAuf(k, 1, '11', undefined, { LT: cb.id });
  const lt = a.offense.find((p) => p.schluessel === 'LT');

  assert.equal(lt.spieler.id, cb.id);
  assert.equal(lt.umgestellt, true, 'der Umsteller ist nicht als solcher markiert');
  assert.ok(lt.staerke < vorher.staerke, 'die Umstellung kostet nichts');

  // Und niemand steht deswegen doppelt herum: der verdrängte Tackle rückt auf
  // einen freien Platz, nicht auf zwei.
  const besetzt = [...a.offense, ...a.defense].filter((p) => p.spieler);
  assert.equal(besetzt.length, 22, 'ein Platz ist leer geblieben');
  const einfach = besetzt.filter((p) => !p.doppel).map((p) => p.spieler.id);
  assert.equal(new Set(einfach).size, einfach.length, 'jemand steht ungefragt doppelt');
});

test('eingefroren ändert die Automatik nichts an sich selbst', () => {
  const k = kader('frost');
  const a = stelleAuf(k, 1, '21', 0.4);
  const b = stelleAuf(k, 1, '21', 0.4, alsVorgabe(a));

  const besetzung = (/** @type {any} */ x) => [...x.offense, ...x.defense]
    .map((p) => `${p.schluessel}:${p.spieler ? p.spieler.id : '-'}:${p.umgestellt}`);
  assert.deepEqual(besetzung(b), besetzung(a));
  assert.equal(umstellungen(b), umstellungen(a));
  assert.deepEqual(doppelEinsaetze(b).sort(), doppelEinsaetze(a).sort());
});

test('ein Verletzter fällt aus der Elf, nicht aus der Vorgabe', () => {
  const k = kader('verletzt');
  const vorgabe = alsVorgabe(stelleAuf(k, 1, '11'));
  const qb = k.find((s) => s.id === vorgabe[QB_PLATZ]);

  qb.verletztBis = 4;
  const ohneIhn = stelleAuf(k, 1, '11', undefined, vorgabe);
  const platz = ohneIhn.offense.find((p) => p.schluessel === QB_PLATZ);
  assert.ok(platz.spieler, 'der Platz bleibt leer, statt repariert zu werden');
  assert.notEqual(platz.spieler.id, qb.id);
  assert.equal(vorgabe[QB_PLATZ], qb.id, 'die Vorgabe wurde angefasst');

  // Zurück aus der Verletzung steht er wieder da, wo er stand.
  qb.verletztBis = 0;
  const zurueck = stelleAuf(k, 1, '11', undefined, vorgabe);
  assert.equal(zurueck.offense.find((p) => p.schluessel === QB_PLATZ).spieler.id, qb.id);
});

test('eine Vorgabe für einen Platz, den es nicht gibt, wird überlesen', () => {
  const k = kader('system');
  const vorgabe = alsVorgabe(stelleAuf(k, 1, '11'));   // 11 hat genau einen TE
  const te = vorgabe.TE;
  assert.ok(te, 'die Vorgabe kennt den Tight End');

  // 00 personnel hat keinen. Die Elf steht trotzdem vollständig.
  const empty = stelleAuf(k, 1, '00', undefined, vorgabe);
  assert.equal([...empty.offense, ...empty.defense].filter((p) => p.spieler).length, 22);
  assert.ok(!empty.offense.some((p) => p.platz === 'TE'));

  // Und zurück im alten System steht er wieder auf seinem Platz.
  assert.equal(stelleAuf(k, 1, '11', undefined, vorgabe).offense
    .find((p) => p.schluessel === 'TE').spieler.id, te);
});

test('einsetzen tauscht, statt zu verdrängen', () => {
  const vorgabe = { LT: 'a', RT: 'b', CB1: 'c' };

  assert.deepEqual(setzePlatz(vorgabe, 'LT', 'b'), { LT: 'b', RT: 'a', CB1: 'c' });
  // Von der Bank kommt niemand her, also geht der Verdrängte auch nirgendwohin:
  // sein Platz fällt an die Automatik zurück.
  assert.deepEqual(setzePlatz(vorgabe, 'LT', 'z'), { LT: 'z', RT: 'b', CB1: 'c' });
  assert.deepEqual(vorgabe, { LT: 'a', RT: 'b', CB1: 'c' }, 'die Karte wurde verändert');
});

test('ein Doppeleinsatz vererbt sich beim Tausch nicht weiter', () => {
  const neu = setzePlatz({ LT: 'a', RT: 'b', CB1: 'b' }, 'LT', 'b');
  assert.equal(neu.LT, 'b');
  assert.equal(Object.values(neu).filter((id) => id === 'b').length, 1, 'b steht weiter doppelt');
  assert.equal(Object.values(neu).filter((id) => id === 'a').length, 1, 'a ist verschwunden');
});

test('die Besten für einen Platz stehen absteigend und sind fit', () => {
  const k = kader('beste');
  k[0].verletztBis = 5;

  const liste = bestenFuer(k, 1, 'LT', 0.5, 4);
  assert.equal(liste.length, 4);
  for (let i = 1; i < liste.length; i++) {
    assert.ok(liste[i - 1].wert >= liste[i].wert, 'die Liste steht nicht absteigend');
  }
  assert.ok(!liste.some((e) => e.spieler.id === k[0].id), 'ein Verletzter steht in der Liste');

  // Sie beantwortet „wer ist hier der Beste" — und für einen Tackle ist das
  // niemand aus der Secondary.
  assert.ok(!liste.some((e) => ['CB', 'FS', 'SS'].includes(e.spieler.position)),
    'ein Defensive Back steht unter den besten vier Tackles');
});
