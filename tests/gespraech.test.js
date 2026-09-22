// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  gefuehrteDieseWoche, offeneGespraeche, zuletztGeredet, persoenlichAnteil,
  persoenlichesGespraech,
} from '../engine/gespraech.js';
import {
  GESPRAECHE_JE_WOCHE, PERSOENLICH_GEWINN, PERSOENLICH_SAETTIGUNG_TAGE,
} from '../engine/constants.js';
import { woche } from '../engine/kalender.js';
import {
  neuesSpiel, weiter, gespraecheFrei, fuehrePersoenlichesGespraech,
  naechsteSaison, meister, beantworteNachricht,
} from '../engine/saison.js';
import { offeneAntworten, antwortenZu } from '../engine/postfach.js';

/** @param {string} id @param {object} [rest] */
function mann(id, rest = {}) {
  return /** @type {any} */ ({
    id, vorname: 'V', nachname: id, position: 'WR', seite: null,
    einsaetze: {}, nummer: 80, alter: 24, staerke: 60, talent: 60,
    commitment: 50, ...rest,
  });
}

// --- Das Kontingent --------------------------------------------------------

test('das Kontingent zählt die Woche, nicht den Tag', () => {
  const log = [{ tag: 8, spielerId: 'a' }, { tag: 12, spielerId: 'b' }];
  assert.equal(woche(8), woche(12));
  assert.equal(gefuehrteDieseWoche(log, 14), 2);
  assert.equal(offeneGespraeche(log, 14), GESPRAECHE_JE_WOCHE - 2);
  // Ein Tag weiter ist eine Woche weiter: das Fenster verschiebt sich von
  // selbst, ohne dass irgendwer etwas zurücksetzt.
  assert.equal(gefuehrteDieseWoche(log, 15), 0);
  assert.equal(offeneGespraeche(log, 15), GESPRAECHE_JE_WOCHE);
});

// --- Der Abstand zum letzten Gespräch --------------------------------------

test('gezählt wird das letzte Gespräch, egal worüber es ging', () => {
  const log = [
    { tag: 5, spielerId: 'a' }, { tag: 20, spielerId: 'a' }, { tag: 12, spielerId: 'b' },
  ];
  assert.equal(zuletztGeredet(log, 'a'), 20, 'das späteste zählt, nicht das letzte im Array');
  assert.equal(zuletztGeredet(log, 'b'), 12);
  assert.equal(zuletztGeredet(log, 'c'), null);
});

test('wer noch nie geredet hat, bekommt den vollen Satz', () => {
  assert.equal(persoenlichAnteil([], 'a', 1), 1);
});

test('der Anteil wächst linear bis zur Sättigung und dann nicht weiter', () => {
  const log = [{ tag: 10, spielerId: 'a' }];
  assert.equal(persoenlichAnteil(log, 'a', 10), 0, 'am selben Tag bringt es nichts');
  assert.equal(persoenlichAnteil(log, 'a', 10 + PERSOENLICH_SAETTIGUNG_TAGE / 2), 0.5);
  assert.equal(persoenlichAnteil(log, 'a', 10 + PERSOENLICH_SAETTIGUNG_TAGE), 1);
  assert.equal(persoenlichAnteil(log, 'a', 10 + PERSOENLICH_SAETTIGUNG_TAGE * 3), 1,
    'länger warten bringt keinen Zuschlag');
});

// --- Die Wirkung -----------------------------------------------------------

test('ein erstes Gespräch hebt das Commitment um den vollen Satz', () => {
  const sp = mann('a');
  const z = persoenlichesGespraech(sp, [], 30);
  assert.equal(z.delta, PERSOENLICH_GEWINN);
  assert.equal(z.ton, 2);
  assert.equal(sp.commitment, 50 + PERSOENLICH_GEWINN);
});

test('zweimal am selben Tag reden bringt beim zweiten Mal nichts', () => {
  const sp = mann('a');
  const log = [{ tag: 30, spielerId: 'a' }];
  const z = persoenlichesGespraech(sp, log, 30);
  assert.equal(z.delta, 0);
  assert.equal(z.ton, 0);
  assert.equal(sp.commitment, 50, 'das Commitment darf sich nicht bewegt haben');
});

test('das Commitment läuft nicht über 99', () => {
  const sp = mann('a', { commitment: 99 });
  persoenlichesGespraech(sp, [], 30);
  assert.equal(sp.commitment, 99);
});

test('wer keine Bindung hat, bekommt durch ein Gespräch keine angedichtet', () => {
  // Kann in einem Stand vorkommen, dessen Felder noch nicht nachgezogen sind.
  // Der Satz fällt trotzdem, nur eben ohne Wirkung — kein Absturz und kein
  // Commitment aus dem Nichts.
  const sp = mann('a', { commitment: undefined });
  const z = persoenlichesGespraech(sp, [], 30);
  assert.equal(z.delta, PERSOENLICH_GEWINN);
  assert.equal(sp.commitment, undefined);
});

// --- Am Spielstand ---------------------------------------------------------

test('ein persönliches Gespräch verbucht den Termin und wirkt vor dem Eintrag', () => {
  const s = neuesSpiel('heg', 'persoenlich');
  const sp = s.kader[s.meinTeam][0];

  assert.equal(gespraecheFrei(s), GESPRAECHE_JE_WOCHE);
  const z = fuehrePersoenlichesGespraech(s, sp.id);
  assert.ok(z, 'das Gespräch ist nicht zustande gekommen');
  // Der Eintrag landet erst nach der Rechnung im Log — stünde er vorher drin,
  // wäre der Abstand immer 0 und jedes erste Gespräch wertlos.
  assert.equal(z.delta, PERSOENLICH_GEWINN);
  assert.equal(gespraecheFrei(s), GESPRAECHE_JE_WOCHE - 1);
  assert.equal(s.gespraeche.length, 1);
});

test('das Wochenkontingent gilt für alle Kategorien gemeinsam', () => {
  const s = neuesSpiel('heg', 'gemeinsam');
  const kader = s.kader[s.meinTeam];
  for (let i = 0; i < GESPRAECHE_JE_WOCHE; i++) {
    assert.ok(fuehrePersoenlichesGespraech(s, kader[i].id), `Gespräch ${i + 1}`);
  }
  assert.equal(gespraecheFrei(s), 0);
  assert.equal(fuehrePersoenlichesGespraech(s, kader[GESPRAECHE_JE_WOCHE].id), null);
});

test('reden mit einem, den es nicht gibt, kostet keinen Termin', () => {
  const s = neuesSpiel('heg', 'niemand');
  assert.equal(fuehrePersoenlichesGespraech(s, 'gibtsnicht'), null);
  assert.equal(s.gespraeche.length, 0);
});

test('der Saisonwechsel leert das Log, und der Abstand fängt von vorn an', () => {
  const s = neuesSpiel('heg', 'wechsel');
  const sp = s.kader[s.meinTeam][0];
  fuehrePersoenlichesGespraech(s, sp.id);
  assert.equal(s.gespraeche.length, 1);

  for (let i = 0; i < 400 && !meister(s); i++) {
    for (const n of offeneAntworten(s)) beantworteNachricht(s, n.id, antwortenZu(n.art)[0]);
    weiter(s);
  }
  naechsteSaison(s);

  assert.deepEqual(s.gespraeche, [], 'das Log trägt sonst Tage aus dem Vorjahr');
  assert.equal(persoenlichAnteil(s.gespraeche, sp.id, s.tag), 1);
});
