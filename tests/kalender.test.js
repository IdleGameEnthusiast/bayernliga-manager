// @ts-check
/**
 * Der Kalender, gegen die Spezifikation geprüft und nicht gegen den Code.
 *
 * Die Zahlen hier stammen aus `docs/umbau-kalender.md`, Abschnitte 3 und 4 —
 * aus derselben Tabelle, gegen die der Code von Hand gerechnet wurde. Er
 * beweist sich also nicht selbst: steht hier etwas anderes als dort, ist einer
 * von beiden falsch, und man sieht welcher.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  saisonStart, saisonLaenge, wochentag, datum, tagVonDatum, tageImMonat,
  rasterVersatz, SPIELTAG_TAGE, GRUPPEN_SPIELTAGE, tagVonSpieltag, spieltagAmTag,
  PHASEN, phaseAmTag, phasenBeginn,
} from '../engine/kalender.js';

/** Die Tabelle aus §3: Saisonlabel → dritter Samstag im Oktober des Vorjahres. */
const ANFAENGE = [
  [2026, 2025, 10, 18],
  [2027, 2026, 10, 17],
  [2028, 2027, 10, 16],
  [2029, 2028, 10, 21],
  [2030, 2029, 10, 20],
  [2031, 2030, 10, 19],
  [2032, 2031, 10, 18],
];

test('die Saison beginnt am dritten Oktobersamstag des Vorjahres', () => {
  for (const [jahr, j, m, t] of ANFAENGE) {
    assert.deepEqual(saisonStart(jahr), { j, m, t }, `Saison ${jahr}`);
  }
});

test('zwischen zwei Saisonanfängen liegen immer volle Wochen', () => {
  for (let jahr = 2026; jahr <= 2040; jahr++) {
    const laenge = saisonLaenge(jahr);
    assert.equal(laenge % 7, 0, `Saison ${jahr} ist ${laenge} Tage lang`);
    assert.ok(laenge === 364 || laenge === 371, `Saison ${jahr} ist ${laenge} Tage lang`);
  }
  // Die 53-Wochen-Saison aus der Tabelle: 16.10.2027 bis 21.10.2028.
  assert.equal(saisonLaenge(2028), 371);
  assert.equal(saisonLaenge(2027), 364);
});

test('Tag 1 ist ein Samstag, und der Wochentag ist eine Modulorechnung', () => {
  assert.equal(wochentag(1), 0);
  assert.equal(wochentag(7), 6, 'Tag 7 ist der Freitag darauf');
  assert.equal(wochentag(8), 0, 'und Tag 8 wieder ein Samstag');
  // Sie hängt an nichts als der Zahl — kein Saisonjahr, kein Date.
  for (let tag = 1; tag <= 400; tag++) {
    assert.equal(wochentag(tag), (tag - 1) % 7, `Tag ${tag}`);
  }
});

test('das Datum eines Tages steht so im Saisonjahr wie in der Tabelle', () => {
  /** @param {number} tag @param {number[]} soll */
  const gleich = (tag, soll) => assert.deepEqual(
    [datum(2027, tag).t, datum(2027, tag).m, datum(2027, tag).j], soll, `Tag ${tag}`);

  gleich(1, [17, 10, 2026]);      // Saisonwechsel
  gleich(183, [17, 4, 2027]);     // Spieltag 1
  gleich(218, [22, 5, 2027]);     // die spielfreie Woche
  gleich(267, [10, 7, 2027]);     // Halbfinale
  gleich(281, [24, 7, 2027]);     // Finale

  // Und alle fünf sind Samstage, weil jeder Termin auf tag ≡ 1 (mod 7) liegt.
  for (const tag of [1, 183, 218, 267, 281]) {
    assert.equal(datum(2027, tag).wochentag, 0, `Tag ${tag}`);
  }
});

test('tagVonDatum ist die Umkehrung von datum, für jeden Tag der Saison', () => {
  for (let tag = 1; tag <= saisonLaenge(2027); tag++) {
    const d = datum(2027, tag);
    assert.equal(tagVonDatum(2027, d.j, d.m, d.t), tag, `Tag ${tag}`);
  }
});

test('tagVonDatum reicht über die Saisongrenze hinaus', () => {
  // Das Monatsraster zeigt ganze Monate und ragt an beiden Enden hinaus. Eine
  // Ausnahme wäre dort ein Rand, den die Ansicht selbst abfangen müsste.
  assert.equal(tagVonDatum(2027, 2026, 10, 16), 0, 'der Tag vor der Saison');
  assert.equal(tagVonDatum(2027, 2027, 10, 17), 366, 'und der Tag nach ihrem Ende');
});

test('die Saisonform steht als eine Liste da und nicht in drei Rechnungen', () => {
  assert.equal(SPIELTAG_TAGE.length, 12, 'zehn Gruppenspieltage, Halbfinale, Finale');
  assert.equal(GRUPPEN_SPIELTAGE, 10);

  for (const tag of SPIELTAG_TAGE) {
    assert.equal(tag % 7, 1, `Tag ${tag} ist kein Samstag`);
  }
  const abstaende = SPIELTAG_TAGE.slice(1).map((t, i) => t - SPIELTAG_TAGE[i]);
  assert.ok(abstaende.every((d) => d > 0), 'die Termine steigen streng');
  // Wöchentlich, mit der spielfreien Woche nach Spieltag 5 und zwei Wochen
  // Abstand vor Halbfinale und Finale.
  assert.deepEqual(abstaende, [7, 7, 7, 7, 14, 7, 7, 7, 7, 14, 14]);
  assert.equal(SPIELTAG_TAGE[0], 183);
});

test('Etikett und Termin sind dieselbe Sache von zwei Seiten', () => {
  for (let nr = 1; nr <= SPIELTAG_TAGE.length; nr++) {
    assert.equal(spieltagAmTag(tagVonSpieltag(nr)), nr, `Spieltag ${nr}`);
  }
  assert.equal(spieltagAmTag(218), null, 'die spielfreie Woche trägt kein Etikett');
  assert.equal(spieltagAmTag(1), null);

  // Ein Spieltag ohne Termin ist ein Programmierfehler und keine leere Antwort.
  assert.throws(() => tagVonSpieltag(13), /Kein Termin/);
  assert.throws(() => tagVonSpieltag(0), /Kein Termin/);
});

test('die vier Phasen liegen dort, wo das Saisonjahr sie beschreibt', () => {
  assert.equal(phaseAmTag(1), 'vorbereitung');
  assert.equal(phaseAmTag(182), 'vorbereitung', 'bis zum Vorabend von Spieltag 1');
  assert.equal(phaseAmTag(183), 'gruppe');
  assert.equal(phaseAmTag(253), 'gruppe', 'der zehnte Spieltag zählt noch dazu');
  assert.equal(phaseAmTag(254), 'playoffs');
  assert.equal(phaseAmTag(281), 'playoffs', 'das Finale auch');
  assert.equal(phaseAmTag(282), 'sommerpause');
  assert.equal(phaseAmTag(364), 'sommerpause');

  assert.deepEqual(PHASEN.map((p) => p.ab), [1, 183, 254, 282]);
  for (const p of PHASEN) assert.equal(phasenBeginn(p.ab), true, p.name);
  assert.equal(phasenBeginn(184), false);
});

test('das Monatsraster bekommt seine Maße aus dem Kalender', () => {
  assert.equal(tageImMonat(2027, 2), 28);
  assert.equal(tageImMonat(2028, 2), 29, 'ein Schaltjahr');
  assert.equal(tageImMonat(2027, 4), 30);
  assert.equal(tageImMonat(2027, 12), 31);

  // Montags beginnendes Raster: der 17.04.2027 ist ein Samstag, also fällt der
  // 1. April 2027 auf einen Donnerstag — drei leere Zellen davor.
  assert.equal(rasterVersatz(2027, 4), 3);
  for (let m = 1; m <= 12; m++) {
    const v = rasterVersatz(2027, m);
    assert.ok(v >= 0 && v <= 6, `Monat ${m} hat einen Versatz von ${v}`);
  }
});
