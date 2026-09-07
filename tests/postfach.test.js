// @ts-check
/**
 * Das Postfach: Kennungen, Antwortpflicht und die Schere beim Saisonwechsel.
 *
 * Geprüft wird hier das Modul für sich, mit einem Stand, der nur aus `jahr` und
 * `post` besteht — mehr sieht es nicht. Was der Kalender daraus macht, steht in
 * `tests/saison.test.js`.
 *
 * Docs: docs/umbau-kalender.md, Abschnitte 5 und 9
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ANTWORTEN, POST_MAX, brauchtAntwort, antwortenZu, laufendeNummer,
  baueNachrichten, sende, offeneAntworten, nachrichtMit, markiereGelesen,
  beantworte, stutzePost, nachrichtenAmTag,
} from '../engine/postfach.js';
import { T } from '../i18n.js';

/** Der kleinste Stand, den das Postfach braucht. @param {number} [jahr] */
function stand(jahr = 2027) {
  return /** @type {any} */ ({ jahr, post: [] });
}

test('die laufende Nummer zählt pro Tag hoch und fängt am nächsten neu an', () => {
  const s = stand();
  assert.equal(laufendeNummer(s.post, 2027, 5), 1, 'auf einem leeren Tag');

  sende(s, 5, [{ art: 'spielbericht' }, { art: 'rundenergebnisse' }]);
  assert.deepEqual(s.post.map((n) => n.id), ['2027-5-1', '2027-5-2']);

  // Ein zweiter Aufruf am selben Tag zählt weiter, statt bei eins anzufangen.
  sende(s, 5, [{ art: 'verletzung' }]);
  assert.equal(s.post[2].id, '2027-5-3');

  sende(s, 6, [{ art: 'spielvorschau' }]);
  assert.equal(s.post[3].id, '2027-6-1');

  // Und das Jahr gehört dazu: derselbe Tag der nächsten Saison kollidiert nicht.
  s.jahr = 2028;
  sende(s, 5, [{ art: 'meister' }]);
  assert.equal(s.post[4].id, '2028-5-1');
});

test('die Nummer wird gezählt und nicht mitgeschleppt', () => {
  // Sie steht nirgends im Stand: derselbe Weg ergibt dieselben Kennungen, auch
  // wenn zwischendurch geladen und gespeichert wurde.
  const s = stand();
  sende(s, 5, [{ art: 'a' }, { art: 'b' }]);
  const geladen = /** @type {any} */ (JSON.parse(JSON.stringify(s)));
  sende(geladen, 5, [{ art: 'c' }]);
  assert.equal(geladen.post[2].id, '2027-5-3');
});

test('baueNachrichten legt nichts ab', () => {
  const s = stand();
  const neue = baueNachrichten(s, 5, [{ art: 'spielvorschau', daten: { gegner: 'HEG' } }]);
  assert.equal(neue.length, 1);
  assert.deepEqual(s.post, [], 'die reine Hälfte hat trotzdem geschrieben');
  assert.deepEqual(baueNachrichten(s, 5, []), [], 'und aus nichts wird nichts');

  // Eine Nachricht speichert Schlüssel und Daten, nie einen fertigen Satz.
  assert.deepEqual(neue[0], {
    id: '2027-5-1', jahr: 2027, tag: 5,
    art: 'spielvorschau', daten: { gegner: 'HEG' },
    gelesen: false, antwort: null,
  });
});

test('nur die Arten mit Antwortpflicht halten den Kalender auf', () => {
  for (const art of Object.keys(ANTWORTEN)) {
    assert.equal(brauchtAntwort(art), true, art);
    assert.ok(antwortenZu(art).length > 0, `${art} hat keine Antwort`);
  }
  for (const art of ['spielbericht', 'verletzung', 'meister', 'gibtesnicht']) {
    assert.equal(brauchtAntwort(art), false, art);
    assert.deepEqual(antwortenZu(art), []);
  }
  // Kein Erbe des Objektprototyps rutscht durch.
  assert.equal(brauchtAntwort('toString'), false);
  assert.equal(brauchtAntwort('constructor'), false);
});

test('zu jeder Antwortpflicht steht ein Satz in i18n', () => {
  // Der Schlüssel steht in engine/, der Satz in i18n.js. Das ist die Naht,
  // durch die das Postfach ohne Import auskommt — und die niemand bemerkt,
  // wenn sie reißt.
  for (const [art, antworten] of Object.entries(ANTWORTEN)) {
    const eintrag = T.post[art];
    assert.ok(eintrag, `T.post.${art} fehlt`);
    for (const a of antworten) {
      assert.equal(typeof eintrag.antworten?.[a], 'string', `T.post.${art}.antworten.${a}`);
    }
  }
});

test('offen ist eine Antwortpflicht ohne Antwort', () => {
  const s = stand();
  const [ziel] = sende(s, 1, [{ art: 'vorstandsziel' }, { art: 'spielbericht' }]);
  assert.deepEqual(offeneAntworten(s).map((n) => n.id), [ziel.id],
    'ein Spielbericht hält niemanden auf');

  beantworte(s, ziel.id, antwortenZu('vorstandsziel')[0]);
  assert.deepEqual(offeneAntworten(s), []);
});

test('eine Antwort, die die Art nicht kennt, wird abgelehnt statt gespeichert', () => {
  const s = stand();
  const [n] = sende(s, 1, [{ art: 'vorstandsziel' }]);

  assert.equal(beantworte(s, n.id, 'vielleicht'), null);
  assert.equal(n.antwort, null, 'ein unbekannter Schlüssel steht im Speicherstand');
  assert.equal(n.gelesen, false);

  assert.equal(beantworte(s, 'gibtesnicht', 'ja'), null, 'eine unbekannte Id');
  assert.equal(beantworte(s, n.id, 'ja'), n);
  assert.equal(n.antwort, 'ja');
  assert.equal(n.gelesen, true, 'wer antwortet, hat gelesen');
});

test('gelesene Nachrichten sind das Archiv', () => {
  const s = stand();
  const [n] = sende(s, 1, [{ art: 'spielbericht' }]);
  assert.equal(nachrichtMit(s, n.id), n);
  assert.equal(nachrichtMit(s, 'gibtesnicht'), null);

  assert.equal(markiereGelesen(s, n.id), n);
  assert.equal(n.gelesen, true);
  assert.equal(markiereGelesen(s, 'gibtesnicht'), null);
});

test('nachrichtenAmTag nimmt nur die laufende Saison', () => {
  const s = stand(2027);
  sende(s, 5, [{ art: 'a' }, { art: 'b' }]);
  sende(s, 6, [{ art: 'c' }]);
  s.jahr = 2028;
  sende(s, 5, [{ art: 'd' }]);

  assert.deepEqual(nachrichtenAmTag(s, 5).map((n) => n.art), ['d'],
    'die Briefmarke am Datum zeigt kein Vorjahr');
  assert.deepEqual(nachrichtenAmTag(s, 6), []);
  s.jahr = 2027;
  assert.deepEqual(nachrichtenAmTag(s, 5).map((n) => n.art), ['a', 'b']);
});

test('der Saisonwechsel wirft Gelesenes ohne Antwortpflicht weg', () => {
  const s = stand();
  const [gelesen, ungelesen, pflicht, beantwortet] = sende(s, 1, [
    { art: 'spielbericht' },
    { art: 'verletzung' },
    { art: 'aufstellungUngueltig' },
    { art: 'vorstandsziel' },
  ]);
  markiereGelesen(s, gelesen.id);
  beantworte(s, beantwortet.id, 'ja');

  stutzePost(s);
  assert.deepEqual(s.post.map((n) => n.id),
    [ungelesen.id, pflicht.id, beantwortet.id]);
  // Eine Antwortpflicht ist Aktenlage: sie bleibt liegen, gelesen oder nicht,
  // beantwortet oder nicht.
});

test('POST_MAX greift, und es fällt das Älteste nach', () => {
  const s = stand();
  const zuviel = POST_MAX + 50;
  for (let i = 1; i <= zuviel; i++) sende(s, i, [{ art: 'spielbericht' }]);
  assert.equal(s.post.length, zuviel, 'gesendet wird ohne Rücksicht');

  stutzePost(s);
  assert.equal(s.post.length, POST_MAX);
  assert.equal(s.post[0].tag, 51, 'die ältesten fünfzig sind nachgefallen');
  assert.equal(s.post[POST_MAX - 1].tag, zuviel, 'die jüngste steht noch da');
});
