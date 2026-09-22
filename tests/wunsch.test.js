// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  platzAnlass, nummernAnlass, wunschVon, ausgesprochenerWunsch,
  frageNachWunsch, gibNummer, wunschDrift,
} from '../engine/wunsch.js';
import {
  WUNSCH_EINSAETZE_MIN, WUNSCH_LEER_GEWINN, WUNSCH_NUMMER_BONUS,
  WUNSCH_ERFUELLT_JE_SPIEL, WUNSCH_UEBERGANGEN_JE_SPIEL, NAEHE_SAETTIGUNG_TAGE,
  GESPRAECHE_JE_WOCHE,
} from '../engine/constants.js';
import { macheSpieler, resetSpielerIds } from '../engine/spieler.js';
import { makeRng } from '../engine/constants.js';
import {
  neuesSpiel, gespraecheFrei, fuehreWunschGespraech, erfuelleNummernwunsch,
  bekannterWunsch,
} from '../engine/saison.js';

/**
 * Ein Spieler mit echten Attributen — die Eignung lässt sich ohne sie nicht
 * rechnen, und genau daran hängt der halbe Positionswunsch.
 * @param {string} position @param {object} [rest]
 */
function mann(position, rest = {}) {
  resetSpielerIds();
  const sp = macheSpieler(makeRng(`wunsch-${position}`), position, 24);
  return Object.assign(sp, { commitment: 50, nummer: 42, ...rest });
}

// --- Der Positionsanlass ---------------------------------------------------

test('wer zu Hause steht, hat keinen Grund', () => {
  const sp = mann('MIKE', { einsaetze: { MIKE: 20 } });
  assert.equal(platzAnlass(sp), null);
});

test('eine Aushilfe ist kein Anlass', () => {
  // Dieselbe fremde Position, nur zu selten, um „über längere Zeit" zu sein.
  const sp = mann('MIKE', { einsaetze: { MIKE: 4, CB: WUNSCH_EINSAETZE_MIN } });
  assert.equal(platzAnlass(sp), null, 'genau an der Schwelle zählt noch nicht');
});

test('wer lange fremd und dort deutlich schwächer steht, will zurück', () => {
  // Ein Linebacker auf Cornerback: andere Gruppe, anderer Körper — der
  // Transfer frisst genug, dass der Abstand steht.
  const sp = mann('MIKE', { einsaetze: { MIKE: 4, CB: 12 } });
  assert.equal(platzAnlass(sp), 'MIKE');
});

test('wer daheim die meisten Einsätze hat, klagt nicht über die Aushilfe', () => {
  // Dieselbe schwache fremde Position, nur steht er überwiegend zu Hause. Die
  // Bedingung ist dieselbe, die den Wunsch später wieder beendet.
  const sp = mann('MIKE', { einsaetze: { MIKE: 13, CB: 12 } });
  assert.equal(platzAnlass(sp), null);
});

test('ohne Attribute wird kein Wunsch erfunden', () => {
  // Kann in einem Stand vorkommen, dessen Felder noch nicht nachgezogen sind.
  // Lieber kein Wunsch als einer, der nur an den Einsatzzahlen hängt — der
  // träfe jeden Umgestellten, und Umschulen ist ein Kern des Spiels.
  const sp = mann('MIKE', { einsaetze: { MIKE: 4, CB: 12 } });
  sp.attribute = /** @type {any} */ (undefined);
  assert.equal(platzAnlass(sp), null);
});

// --- Der Nummernanlass -----------------------------------------------------

/** Ein Kader, in dem genau einer stark genug für eine einstellige ist. */
function kaderMitStar() {
  resetSpielerIds();
  const rng = makeRng('nummern');
  const kader = [];
  for (let i = 0; i < 20; i++) {
    const sp = macheSpieler(rng, 'WR', 24);
    Object.assign(sp, { staerke: 40 + i, commitment: 50, nummer: 20 + i });
    kader.push(sp);
  }
  return kader;
}

test('der Beste ohne einstellige Nummer hätte gern die kleinste freie', () => {
  const kader = kaderMitStar();
  const star = kader[kader.length - 1];
  assert.equal(nummernAnlass(kader, star), 0, 'die 0 ist ein echtes Trikot');
});

test('wer eine einstellige trägt, will keine zweite', () => {
  const kader = kaderMitStar();
  const star = kader[kader.length - 1];
  star.nummer = 7;
  assert.equal(nummernAnlass(kader, star), null);
});

test('sind alle einstelligen vergeben, gibt es nichts zu wünschen', () => {
  const kader = kaderMitStar();
  for (let n = 0; n <= 9; n++) kader[n].nummer = n;
  const star = kader[kader.length - 1];
  assert.equal(nummernAnlass(kader, star), null);
});

test('wer nicht zum Kreis der Besten gehört, wünscht sich keine', () => {
  const kader = kaderMitStar();
  assert.equal(nummernAnlass(kader, kader[0]), null, 'der Schwächste im Kader');
});

// --- Die Rangfolge ---------------------------------------------------------

test('wo er spielt, geht vor, was auf seinem Rücken steht', () => {
  const kader = kaderMitStar();
  const star = kader[kader.length - 1];
  star.einsaetze = { WR: 4, DT: 12 };
  const wunsch = wunschVon(kader, star);
  assert.equal(wunsch?.art, 'platz');
});

// --- Das Gespräch ----------------------------------------------------------

test('ohne Wunsch bringt allein das Fragen etwas — gedämpft wie das Reden', () => {
  // Einstellige Nummer, damit auch der zweite Anlass ausscheidet: allein im
  // Kader wäre er sonst automatisch der Beste ohne eine.
  const sp = mann('MIKE', { einsaetze: { MIKE: 20 }, nummer: 7 });
  const auskunft = frageNachWunsch([sp], sp, [], 30);
  assert.equal(auskunft.wunsch, null);
  assert.equal(auskunft.delta, WUNSCH_LEER_GEWINN);
  assert.equal(sp.commitment, 50 + WUNSCH_LEER_GEWINN);

  // Direkt nach einem Gespräch bringt es fast nichts, egal welcher Kategorie.
  const sp2 = mann('MIKE', { einsaetze: { MIKE: 20 }, nummer: 7 });
  const halb = frageNachWunsch([sp2], sp2, [{ tag: 30, spielerId: sp2.id }],
    30 + NAEHE_SAETTIGUNG_TAGE / 2);
  assert.equal(halb.delta, WUNSCH_LEER_GEWINN / 2);
});

test('ein Wunsch bewegt beim Aussprechen nichts — er wird nur bekannt', () => {
  const sp = mann('MIKE', { einsaetze: { MIKE: 4, CB: 12 } });
  assert.equal(ausgesprochenerWunsch(sp), null, 'ungefragt weiß der Manager nichts');

  const auskunft = frageNachWunsch([sp], sp, [], 30);
  assert.deepEqual(auskunft.wunsch, { art: 'platz', platz: 'MIKE' });
  assert.equal(auskunft.delta, 0, 'die Wirkung kommt erst auf dem Feld');
  assert.equal(sp.commitment, 50);
  assert.deepEqual(ausgesprochenerWunsch(sp), { art: 'platz', platz: 'MIKE' });
});

// --- Die Nummer hergeben ---------------------------------------------------

test('die gewünschte Nummer zu geben hebt die Bindung und erledigt den Wunsch', () => {
  const kader = kaderMitStar();
  const star = kader[kader.length - 1];
  frageNachWunsch(kader, star, [], 30);
  assert.equal(star.wunschNummer, 0);

  assert.equal(gibNummer(kader, star), WUNSCH_NUMMER_BONUS);
  assert.equal(star.nummer, 0);
  assert.equal(star.wunschNummer, null);
  assert.equal(star.commitment, 50 + WUNSCH_NUMMER_BONUS);
});

test('eine Nummer, die inzwischen jemand trägt, wird nicht doppelt vergeben', () => {
  const kader = kaderMitStar();
  const star = kader[kader.length - 1];
  frageNachWunsch(kader, star, [], 30);
  kader[0].nummer = /** @type {number} */ (star.wunschNummer);

  assert.equal(gibNummer(kader, star), 0);
  assert.equal(star.nummer, 39, 'er behält seine eigene');
  assert.equal(star.wunschNummer, 0, 'der Wunsch bleibt stehen');
});

// --- Erfüllt oder übergangen -----------------------------------------------

test('ohne ausgesprochenen Wunsch bewegt ein Spiel nichts', () => {
  const sp = mann('MIKE', { einsaetze: { MIKE: 4, CB: 12 } });
  assert.equal(wunschDrift(sp, ['CB']), null, 'der Anlass allein zieht nicht');
  assert.equal(sp.commitment, 50);
});

test('auf der Bank zieht der Wunsch nicht — dafür rechnet der Rollen-Mismatch', () => {
  const sp = mann('MIKE', { einsaetze: { MIKE: 4, CB: 12 }, wunschPlatz: 'MIKE' });
  assert.equal(wunschDrift(sp, []), null);
  assert.equal(sp.commitment, 50);
});

test('wieder auf dem falschen Platz kostet jedes Spiel etwas', () => {
  const sp = mann('MIKE', { einsaetze: { MIKE: 4, CB: 12 }, wunschPlatz: 'MIKE' });
  const bewegt = wunschDrift(sp, ['CB']);
  assert.equal(bewegt?.erfuellt, false);
  assert.equal(bewegt?.delta, -WUNSCH_UEBERGANGEN_JE_SPIEL);
  assert.equal(sp.commitment, 50 - WUNSCH_UEBERGANGEN_JE_SPIEL);
  assert.equal(sp.wunschPlatz, 'MIKE', 'der Wunsch bleibt, bis er erfüllt ist');
});

test('auf seinem Platz bringt es etwas, aber der Wunsch bleibt noch stehen', () => {
  // Ein einziges richtig besetztes Spiel dreht die Einsätze nicht um — der
  // Anlass steht weiter, also ist die Sache noch nicht erledigt.
  const sp = mann('MIKE', { einsaetze: { MIKE: 4, CB: 12 }, wunschPlatz: 'MIKE' });
  const bewegt = wunschDrift(sp, ['MIKE']);
  assert.equal(bewegt?.delta, WUNSCH_ERFUELLT_JE_SPIEL);
  assert.equal(bewegt?.erfuellt, false);
  assert.equal(sp.wunschPlatz, 'MIKE');
});

test('der Wunsch endet, wo sein Anlass endet', () => {
  // Er hat daheim aufgeholt: mehr Einsätze auf MIKE als auf CB. Genau das ist
  // die Bedingung, die das Nachfragen-Aufstellen-Kassieren unmöglich macht —
  // erledigt wird der Wunsch durch die Korrektur, nicht durch ein Spiel.
  const sp = mann('MIKE', { einsaetze: { MIKE: 12, CB: 11 }, wunschPlatz: 'MIKE' });
  const bewegt = wunschDrift(sp, ['MIKE']);
  assert.equal(bewegt?.erfuellt, true);
  assert.equal(sp.wunschPlatz, null);

  assert.equal(wunschDrift(sp, ['MIKE']), null, 'kein Dauerbonus fürs Richtige');
  assert.equal(sp.commitment, 50 + WUNSCH_ERFUELLT_JE_SPIEL);
});

test('das Commitment läuft nicht über die Ränder', () => {
  const hoch = mann('MIKE', { commitment: 99, wunschPlatz: 'MIKE', einsaetze: { MIKE: 1 } });
  wunschDrift(hoch, ['MIKE']);
  assert.equal(hoch.commitment, 99);

  const tief = mann('MIKE', { commitment: 0.5, wunschPlatz: 'MIKE', einsaetze: { MIKE: 1 } });
  wunschDrift(tief, ['CB']);
  assert.equal(tief.commitment, 0);
});

// --- Am Spielstand ---------------------------------------------------------

test('das Wunschgespräch kostet einen Termin, das Nachschlagen nicht', () => {
  const s = neuesSpiel('heg', 'wunsch');
  const sp = s.kader[s.meinTeam][0];

  assert.equal(bekannterWunsch(s, sp.id), null, 'ungefragt steht nichts in der Notiz');
  const vorher = gespraecheFrei(s);
  assert.ok(fuehreWunschGespraech(s, sp.id), 'das Gespräch ist nicht zustande gekommen');
  assert.equal(gespraecheFrei(s), vorher - 1);

  // Nachschlagen ist kein Gespräch: es liest nur, was das Gespräch hinterlegt hat.
  bekannterWunsch(s, sp.id);
  assert.equal(gespraecheFrei(s), vorher - 1);
});

test('ohne Kontingent wird nicht gefragt', () => {
  const s = neuesSpiel('heg', 'wunschvoll');
  const kader = s.kader[s.meinTeam];
  // Die feste Zahl, nicht `gespraecheFrei(s)`: die Schranke schrumpft sonst
  // mit jedem Durchlauf und die Schleife endet nach der Hälfte.
  for (let i = 0; i < GESPRAECHE_JE_WOCHE; i++) fuehreWunschGespraech(s, kader[i].id);
  assert.equal(gespraecheFrei(s), 0);
  assert.equal(fuehreWunschGespraech(s, kader[10].id), null);
});

test('fragen mit einem, den es nicht gibt, kostet keinen Termin', () => {
  const s = neuesSpiel('heg', 'wunschniemand');
  assert.equal(fuehreWunschGespraech(s, 'gibtsnicht'), null);
  assert.equal(s.gespraeche.length, 0);
  assert.equal(erfuelleNummernwunsch(s, 'gibtsnicht'), 0);
});
