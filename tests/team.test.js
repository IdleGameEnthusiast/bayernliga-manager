// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { makeRng, ERSATZ_STAERKE, KICK_FUSS_AUSSCHLUSS } from '../engine/constants.js';
import { macheKader, macheSpieler, ziehKickWerte, resetSpielerIds } from '../engine/spieler.js';
import {
  teamStaerken, gesamtStaerke, angriffStaerke, verteidigungStaerke,
  kickerWert, punterWert, longSnapperWert, specialTechnik, besterFuss,
} from '../engine/team.js';
import { SNAP_NAHE, SNAP_FREMD } from '../engine/aufstellung.js';

/**
 * Ein Mann, so weit die drei Special-Team-Formeln ihn brauchen: die beiden
 * Kickwerte, die Attribute, die darin vorkommen, und die Position, an der
 * `specialTechnik()` entscheidet.
 * @param {Record<string, any>} werte
 */
function fuss(werte) {
  const { kickStaerke = 40, kickGenauigkeit = 40, position = 'WR' } = werte;
  return /** @type {any} */ ({
    kickStaerke,
    kickGenauigkeit,
    position,
    seite: null,
    einsaetze: {},
    attribute: {
      technik: werte.technik || 0,
      fangen: werte.fangen || 0,
      ballsicherheit: werte.ballsicherheit || 0,
      kraft: werte.kraft || 0,
    },
  });
}

test('jeder Spieler bekommt beide Kickwerte', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('kick'), 55, 5);
  for (const s of kader) {
    assert.equal(typeof s.kickStaerke, 'number', s.position);
    assert.equal(typeof s.kickGenauigkeit, 'number', s.position);
    assert.ok(s.kickStaerke >= 1 && s.kickStaerke <= 79);
    assert.ok(s.kickGenauigkeit >= 1 && s.kickGenauigkeit <= 79);
  }
});

test('Kicker- und Punterwert gewichten die beiden Werte verschieden', () => {
  const s = fuss({ kickStaerke: 70, kickGenauigkeit: 30, fangen: 40 });
  assert.equal(kickerWert(s), 40);        // 0,4 · 70 + 0,4 · 30
  assert.equal(punterWert(s), 45);        // 0,5 · 70 + 0,2 · 30 + 0,1 · 40

  // Wo alle Eingaben gleich sind, fallen beide Formeln wieder zusammen —
  // sie summieren beide auf eins, das eine Fünftel Technik eingerechnet.
  const gleich = fuss({ kickStaerke: 44, kickGenauigkeit: 44, fangen: 44 });
  assert.equal(Math.round(kickerWert(gleich) * 100) / 100, 35.2);
  assert.equal(Math.round(punterWert(gleich) * 100) / 100, 35.2);
});

test('ein starkes Bein ohne Zielwasser ist der bessere Punter', () => {
  const kanone = fuss({ kickStaerke: 72, kickGenauigkeit: 34, fangen: 40 });
  const praezise = fuss({ kickStaerke: 48, kickGenauigkeit: 62, fangen: 40 });
  assert.ok(kickerWert(praezise) > kickerWert(kanone));
  assert.ok(punterWert(kanone) > punterWert(praezise));
});

test('nur ein ausgebildeter Spezialist bringt Technik aufs Feld', () => {
  // Derselbe Mann, einmal als Linebacker und einmal als rekrutierter Kicker.
  const werte = { kickStaerke: 50, kickGenauigkeit: 50, technik: 70, fangen: 50 };
  const linebacker = fuss({ ...werte, position: 'MIKE' });
  const kicker = fuss({ ...werte, position: 'K' });

  assert.equal(specialTechnik(linebacker), 0, 'wer keiner ist, hat den Anteil nicht');
  assert.equal(specialTechnik(kicker), 70);
  assert.equal(kickerWert(linebacker), 40);
  assert.equal(kickerWert(kicker), 54);    // 40 + 0,2 · 70
  assert.ok(punterWert(kicker) > punterWert(linebacker));
});

test('wer puntet, wird davon kein Punter', () => {
  // Der Hauptplatz wandert mit den Einsätzen, die Ausbildung nicht — und nur
  // an ihr hängt der Technikanteil. Sonst würde ein Aushilfskicker mit der
  // Zeit zum Spezialisten, ohne dass ihn je jemand rekrutiert hätte.
  const aushilfe = fuss({ position: 'MIKE', technik: 70 });
  aushilfe.einsaetze = { P: 200, K: 200, LS: 200 };
  assert.equal(specialTechnik(aushilfe), 0);
});

test('der Long Snapper kommt aus der Line, nicht aus der Ballsicherheit allein', () => {
  const werte = { ballsicherheit: 60, kraft: 60 };
  const center = fuss({ ...werte, position: 'C' });
  const receiver = fuss({ ...werte, position: 'WR' });

  const roh = 60 * 0.4 + 60 * 0.25;
  assert.equal(longSnapperWert(center), roh);
  assert.equal(longSnapperWert(receiver), roh * SNAP_FREMD);
  assert.ok(SNAP_NAHE.includes('C') && !SNAP_NAHE.includes('WR'));

  // Auch hier trägt die Technik nur der Ausgebildete.
  const snapper = fuss({ ...werte, position: 'LS', technik: 80 });
  assert.equal(longSnapperWert(snapper), roh + 80 * 0.35);
});

test('gekickt wird aus dem ganzen Kader, nicht aus einem K-Slot', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('fuss'), 55, 5);
  assert.equal(kader.filter((s) => s.position === 'K' || s.position === 'P').length, 0,
    'die Liga kennt keine Spezialisten');

  assert.equal(kader.filter((s) => s.position === 'LS').length, 0,
    'auch keinen Long Snapper');

  const s = teamStaerken(kader, 1);
  const besterKicker = Math.max(...kader.map(kickerWert));
  assert.equal(besterFuss(kader, 1, kickerWert), besterKicker);
  assert.equal(s.special, besterKicker * 0.4
    + Math.max(...kader.map(punterWert)) * 0.4
    + Math.max(...kader.map(longSnapperWert)) * 0.2);
  assert.ok(s.special > ERSATZ_STAERKE, 'Special Teams sind kein toter Wert mehr');
});

test('ein verletzter Kicker steht nicht auf dem Feld', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('verletzt'), 55, 5);
  const bester = kader.slice().sort((a, b) => kickerWert(b) - kickerWert(a))[0];
  const vorher = teamStaerken(kader, 1).special;

  bester.verletztBis = 4;
  const nachher = teamStaerken(kader, 1).special;
  assert.ok(nachher < vorher, 'ohne den besten Fuß sinken die Special Teams');
});

test('ein leerer Kader fällt auf die Ersatzstärke zurück', () => {
  assert.equal(besterFuss([], 1, kickerWert), ERSATZ_STAERKE);
  assert.equal(teamStaerken([], 1).special, ERSATZ_STAERKE);
});

test('aus der Line kommt kein Kicker', () => {
  // Über viele Ziehungen bleibt ein Lineman im unteren Band.
  for (const position of /** @type {const} */ (['T', 'G', 'C', 'DE', 'DT', 'NT'])) {
    let hoechster = 0;
    for (let i = 0; i < 200; i++) {
      const w = ziehKickWerte(makeRng(position + i), position);
      hoechster = Math.max(hoechster, w.kickStaerke, w.kickGenauigkeit);
    }
    assert.ok(hoechster < 60, `bester ${position}-Kickwert war ${hoechster}`);
    assert.ok(KICK_FUSS_AUSSCHLUSS.includes(position), `${position} steht im Ausschluss`);
  }
});

test('ein paar Vereine haben einen echten Fuß, nicht alle', () => {
  // Gepinnter Seed, geprüft wird die Form: es gibt gute Füße, aber nicht überall.
  const anteile = [];
  for (let i = 0; i < 12; i++) {
    resetSpielerIds();
    const kader = macheKader(makeRng('verein' + i), 55, 5);
    anteile.push(Math.max(...kader.map(kickerWert)));
  }
  assert.ok(anteile.some((w) => w > 50), 'irgendwo steht ein echter Kicker');
  assert.ok(Math.min(...anteile) < Math.max(...anteile), 'nicht jeder Verein ist gleich gut bedient');
});

test('die Gesamtstärke bleibt eine Zahl im Ligarahmen', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('gesamt'), 60, 5);
  const g = gesamtStaerke(teamStaerken(kader, 1));
  assert.ok(g > 20 && g < 79, `Gesamtstärke ${g}`);
});

test('macheSpieler zieht die Kickwerte reproduzierbar', () => {
  resetSpielerIds();
  const a = macheSpieler(makeRng('s'), 'WR', 55);
  resetSpielerIds();
  const b = macheSpieler(makeRng('s'), 'WR', 55);
  assert.equal(a.kickStaerke, b.kickStaerke);
  assert.equal(a.kickGenauigkeit, b.kickGenauigkeit);
});

test('Offense und Defense sind das hälftige Mittel aus Lauf und Pass', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('mittel'), 58, 5);
  const s = teamStaerken(kader, 3, '11', 0.8);

  assert.equal(angriffStaerke(s), (s.passAngriff + s.laufAngriff) / 2);
  assert.equal(verteidigungStaerke(s), (s.passVerteidigung + s.laufVerteidigung) / 2);
  assert.equal(gesamtStaerke(s), Math.round(
    angriffStaerke(s) * 0.46 + verteidigungStaerke(s) * 0.46 + s.special * 0.08));
});

test('der Regler hübscht die Rosterzahl nicht auf', () => {
  resetSpielerIds();
  const kader = macheKader(makeRng('regler'), 58, 5);

  // Derselbe Kader, dieselbe Gruppierung, nur der Passanteil ganz außen. Das
  // hälftige Mittel darf davon höchstens durch die Aufstellung selbst wandern,
  // nicht durch die Gewichtung — ein Regler macht keinen Spieler besser.
  const werfend = teamStaerken(kader, 3, '11', 1);
  const laufend = teamStaerken(kader, 3, '11', 0);
  const abstand = Math.abs(angriffStaerke(werfend) - angriffStaerke(laufend));
  assert.ok(abstand < 4, `Der Passanteil verschiebt die Offense um ${abstand.toFixed(1)}`);
});
