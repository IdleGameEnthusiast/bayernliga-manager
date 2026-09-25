// @ts-check
/**
 * Der Migrationspfad: was `save.js` mit einem Stand macht, der aus einem
 * älteren Build stammt.
 *
 * Geprüft wird über `importiere()` statt über `lade()` — der `localStorage`
 * gehört dem Browser, und der Rauchtest unter `tests/smoke/speicherstand.html`
 * ist der Ort, an dem er vorkommt.
 *
 * Ein alter Stand wird hier **nicht von Hand geschrieben**: er entsteht aus
 * einem echten, dem die Felder wieder weggenommen werden, die es damals noch
 * nicht gab. Von Hand wäre er nur so falsch, wie ich ihn mir vorstelle.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  neuesSpiel, SAVE_VERSION, coachesVon, bindungVon, weiter, beantworteNachricht,
} from '../engine/saison.js';
import { offeneAntworten, antwortenZu } from '../engine/postfach.js';
import { recruitingVon, zulauf, MASSNAHMEN } from '../engine/recruiting.js';
import { ausgesprochenerWunsch } from '../engine/wunsch.js';
import { offeneAblehnungen } from '../engine/ueberzeugen.js';
import { rolleVon, rollenlose, mismatch } from '../engine/rolle.js';
import { migriere, exportiere, importiere } from '../engine/save.js';

/** Ein loser Abzug eines frischen Standes. @param {string} seed */
function abzug(seed) {
  return JSON.parse(exportiere(neuesSpiel('heg', seed)));
}

test('ein Stand mit der heutigen Nummer geht unverändert durch', () => {
  const stand = abzug('heute');
  const vorher = JSON.stringify(stand);
  assert.equal(migriere(stand).version, SAVE_VERSION);
  assert.equal(JSON.stringify(stand), vorher, 'ein Schritt hat sich eingemischt');
});

test('ein Stand aus Version 6 bekommt seinen Papierkorb', () => {
  // Version 6 kannte kein `geloescht`: gelesen war archiviert. Der Schritt
  // legt alles, was da ist, in den Posteingang — weggeworfen hat es niemand.
  const alt = abzug('sechs');
  alt.version = 6;
  for (const n of alt.post) delete n.geloescht;
  assert.ok(alt.post.length > 0, 'der Abzug trägt überhaupt Post');

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  for (const n of neu.post) {
    assert.equal(n.geloescht, false, `${n.id} liegt nicht im Eingang`);
  }
});

test('ein Stand aus Version 7 überlebt die Wertung', () => {
  // Version 7 kannte kein `nichtAngetreten`: jedes Spiel wurde gespielt. Der
  // Schritt hebt nur die Nummer — das Fehlen des Feldes heißt genau das, was es
  // heißen soll. Ohne ihn flöge jede Karriere von gestern beim Laden weg.
  const alt = abzug('sieben');
  alt.version = 7;

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  assert.deepEqual(neu.spielplan.length, alt.spielplan.length);
});

test('ein Stand aus Version 8 bekommt seinen Stab nachgezogen', () => {
  // Version 8 kannte keine Coaches. Der Schritt legt nur die leere Karte an;
  // die Koordinatoren zieht `coachesVon()` beim ersten Blick nach — aus dem
  // Saatgut, also dieselben, die ein frischer Stand mit diesem Saatgut trägt.
  const frisch = neuesSpiel('heg', 'acht');
  const alt = abzug('acht');
  alt.version = 8;
  delete alt.coaches;

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  assert.deepEqual(neu.coaches, {}, 'der Schritt hat selbst gezogen');
  const stab = coachesVon(neu, 'heg');
  assert.equal(stab.length, 2);
  assert.deepEqual(stab, coachesVon(frisch, 'heg'));
});

test('ein Stand aus Version 9 verliert die Frage nach den unbesetzten Plätzen', () => {
  // Version 9 stellte sie als Nachricht mit Antwortpflicht; heute stellt sie
  // der Kickoff-Knopf. Eine offene aus der alten Zeit hielte den Kalender an,
  // ohne dass sie noch jemand beantworten könnte — sie fliegt, die anderen
  // Nachrichten bleiben.
  const alt = abzug('neun');
  alt.version = 9;
  const vorher = alt.post.length;
  alt.post.push({
    id: 'alt-1', tag: 5, art: 'aufstellungUnvollstaendig', gelesen: false,
    geloescht: false, antwort: null, daten: { offen: 3, wertung: 36 },
  });

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  assert.equal(neu.post.length, vorher);
  assert.ok(neu.post.every((n) => n.art !== 'aufstellungUnvollstaendig'));
});

test('ein Stand aus Version 10 bekommt Commitment und Lebenslage nachgezogen', () => {
  // Version 10 kannte weder das eine noch das andere. Der Schritt hebt nur die
  // Nummer; die Felder zieht `bindungVon()` beim ersten Zugriff aus dem
  // Saatgut nach — dieselben, die ein frischer Stand mit diesem Saatgut trägt.
  const frisch = neuesSpiel('heg', 'zehn');
  const alt = abzug('zehn');
  alt.version = 10;
  for (const teamId in alt.kader) {
    for (const s of alt.kader[teamId]) { delete s.commitment; delete s.lebenslage; }
  }
  for (const teamId in alt.coaches) {
    for (const c of alt.coaches[teamId]) { delete c.commitment; delete c.lebenslage; }
  }

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  assert.equal(neu.kader.heg[0].commitment, undefined, 'der Schritt hat selbst gezogen');
  const spieler = neu.kader.heg[3];
  assert.deepEqual(bindungVon(neu, spieler), bindungVon(frisch, frisch.kader.heg[3]));
  const coach = coachesVon(neu, 'heg')[1];
  assert.deepEqual(bindungVon(neu, coach), bindungVon(frisch, coachesVon(frisch, 'heg')[1]));
});

test('ein Stand aus Version 12 bekommt die Rolle als „noch keine"', () => {
  // Version 12 kannte weder Rolle noch Gesprächslog. Am Spieler bedeutet jedes
  // fehlende Feld genau den Nullwert — keine Rolle, kein Fenster, keine Sperre
  // —, deshalb fasst der Schritt keinen Menschen an. Angelegt wird nur der
  // Behälter am Stand.
  const alt = abzug('zwoelf');
  alt.version = 12;
  delete alt.gespraeche;
  for (const teamId in alt.kader) {
    for (const s of alt.kader[teamId]) {
      delete s.rolle; delete s.letzteRollenAenderung;
      delete s.einsatzFenster; delete s.rolleBeschwerde;
    }
  }

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  assert.deepEqual(neu.gespraeche, [], 'das Log fehlt statt leer zu sein');
  assert.equal(neu.kader.heg[0].rolle, undefined, 'der Schritt hat eine Rolle erfunden');
  assert.equal(rolleVon(neu.kader.heg[0]), null);
  assert.equal(rollenlose(neu.kader.heg).length, neu.kader.heg.length,
    'die Kampagne soll den ganzen Kader wieder aufnehmen');
  // Und der Drift greift nicht ins Leere: ohne Rolle gibt es keinen.
  assert.equal(mismatch(neu.kader.heg[0]), null);
});

test('ein Stand aus Version 13 bekommt sein Talent in halben Sternen', () => {
  // Version 13 trug das Talent als Zahl von 0 bis 99 — Deckel und Anzeige in
  // einem. Umgerechnet wird nach der Regel, mit der die Sterne gezeichnet
  // wurden, damit kein Kader nach dem Laden anders aussieht als vorher.
  const alt = abzug('dreizehn');
  alt.version = 13;
  /** @type {Record<string, number>} */
  const proben = { 0: 1, 9: 1, 10: 2, 45: 5, 58: 6, 79: 8, 90: 10, 99: 10 };
  const werte = Object.keys(proben).map(Number);
  alt.kader.heg.forEach((/** @type {any} */ s, /** @type {number} */ i) => {
    s.talent = werte[i % werte.length];
  });

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  neu.kader.heg.forEach((s, i) => {
    assert.equal(s.talent, proben[werte[i % werte.length]], `aus ${werte[i % werte.length]}`);
  });
  // Und jeder Verein, nicht nur der eigene: die Sterne stehen auch am Gegner.
  for (const teamId in neu.kader) {
    for (const s of neu.kader[teamId]) {
      assert.ok(s.talent >= 1 && s.talent <= 10, `${teamId}: Talent ${s.talent}`);
    }
  }
});

test('ein Stand aus Version 14 hat einfach noch keinen Wunsch geäußert', () => {
  // Version 14 kannte `wunschPlatz` und `wunschNummer` nicht. Das Fehlen heißt
  // genau das, was es heißen soll: in diesem Stand hat nie jemand nachgefragt.
  // Der Schritt füllt die Felder deshalb **nicht** — er legte dem alten Stand
  // sonst Gespräche in den Mund, die nie stattgefunden haben.
  const alt = abzug('vierzehn');
  alt.version = 14;
  for (const teamId in alt.kader) {
    for (const s of alt.kader[teamId]) { delete s.wunschPlatz; delete s.wunschNummer; }
  }

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  for (const s of neu.kader.heg) {
    assert.equal(ausgesprochenerWunsch(s), null, `${s.nachname} wünscht sich aus dem Nichts`);
  }
});

test('ein Stand aus Version 15 hat sich noch gegen nichts gesperrt', () => {
  // Dieselbe Regel wie eine Nummer tiefer: das fehlende Feld ist die Wahrheit.
  // Die Ablehnung entsteht **nach** einem Spiel auf einer fremden Position,
  // und diese Prüfung gab es in Version 15 nicht — ein Schritt, der sie
  // nachtrüge, erfände eine Vergangenheit.
  const alt = abzug('fuenfzehn');
  alt.version = 15;
  for (const teamId in alt.kader) {
    for (const s of alt.kader[teamId]) delete s.abgelehntePositionen;
  }

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  for (const s of neu.kader.heg) {
    assert.deepEqual(offeneAblehnungen(s), [], `${s.nachname} sperrt sich aus dem Nichts`);
  }
});

test('ein Stand aus Version 18 bekommt die Rekrutierung und läuft ins nächste Tryout', () => {
  // Version 18 kannte keine Tryouts: kein `recruiting` am Stand, keine
  // Werbung, die je beschlossen worden wäre. Der Schritt legt den leeren
  // Behälter an; das nächste Tryout läuft dann mit allen Maßnahmen.
  const alt = abzug('achtzehn');
  alt.version = 18;
  delete alt.recruiting;
  alt.post = alt.post.filter((/** @type {{ art: string }} */ n) => n.art !== 'tryoutWerbung');

  const neu = importiere(JSON.stringify(alt));
  assert.equal(neu.version, SAVE_VERSION);
  assert.deepEqual(neu.recruiting, { werbung: null, tryout: null, neue: [], ehemalige: [] });

  // Und das Tryout kommt trotzdem: am Tag selbst, mit vollem Zulauf.
  for (let i = 0; i < 40 && !recruitingVon(neu).tryout; i++) {
    for (const n of offeneAntworten(neu)) beantworteNachricht(neu, n.id, antwortenZu(n.art).at(-1));
    weiter(neu);
  }
  const tryout = recruitingVon(neu).tryout;
  assert.ok(tryout, 'kein Tryout nach der Migration');
  assert.equal(tryout.kandidaten.length, zulauf('heg', MASSNAHMEN));
});

test('ein Stand aus der Zukunft wird abgelehnt', () => {
  // Rückwärts rechnet hier nichts. Ein iPad, das dem PC eine Version voraus
  // ist, braucht ein Neuladen und keinen Notbehelf.
  const stand = abzug('zukunft');
  stand.version = SAVE_VERSION + 1;
  assert.throws(() => migriere(stand), /Version/);
});

test('eine Nummer ohne Schritt wird abgelehnt statt halb gerettet', () => {
  const stand = abzug('kein-weg');
  stand.version = 1;
  assert.throws(() => migriere(stand), /Version 1/);
});

test('was gar kein Stand ist, fliegt vorher raus', () => {
  assert.throws(() => migriere(null), /leer/);
  assert.throws(() => migriere('bayernliga'), /leer/);
  assert.throws(() => migriere({}), /Version/);
  assert.throws(() => importiere('null'), /leer/);
});
