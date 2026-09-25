// @ts-check
/**
 * Der Lebenslauf, Block 7 Schritt 2a: das Abschlussalter, die Statuswechsel,
 * die Waage Druck gegen Halt mit ihrem Zähler, und dass der Saisonwechsel die
 * Abgänge daraus ersetzt wie den Rücktritt.
 *
 * Verteilungen nur mit festem Seed und nur grob — die Zahlen selbst sind
 * Modell (`commitment.js`, `lebenslauf.js`) und Balancing (docs/balancing.md,
 * Abschnitt 11), kein Test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { druck, halt, lebensjahr } from '../engine/lebenslauf.js';
import {
  ziehAbschlussalter, ziehHorizont, ziehLebenslage, wegzugKm, echterHorizont,
} from '../engine/commitment.js';
import {
  makeRng, DRUCK_JAHRE_BIS_ABGANG, DRUCK_FAKTOR_AUTO, DRUCK_FAKTOR_FAMILIE,
  HALT_JE_VEREINSJAHR, HALT_FAMILIENBONUS_JUNG,
} from '../engine/constants.js';
import { neuesSpiel, naechsteSaison, weiter, meister, beantworteNachricht } from '../engine/saison.js';
import { offeneAntworten, antwortenZu } from '../engine/postfach.js';
import { TEAMS } from '../engine/content.js';
import { T } from '../i18n.js';

/** @typedef {import('../engine/commitment.js').Lebenslage} Lebenslage */

/**
 * Eine Lebenslage nach Wunsch — der Rest wie ein 25-Jähriger im Jahr 2026.
 * @param {Partial<Lebenslage>} felder
 * @returns {Lebenslage}
 */
function lage(felder) {
  return {
    status: 'arbeiter', entfernung: 10, auto: true, familie: false, horizont: null, seit: 2024,
    ...felder,
  };
}

/** Bis zum Finale, Antwortpflichten mit der ersten Antwort abräumen. @param {any} stand */
function bisSaisonende(stand) {
  for (let i = 0; i < 400 && !meister(stand); i++) {
    for (const n of offeneAntworten(stand)) beantworteNachricht(stand, n.id, antwortenZu(n.art)[0]);
    weiter(stand);
  }
  assert.ok(meister(stand), 'die Saison terminiert');
}

// --- Das Abschlussalter ----------------------------------------------------

test('das Abschlussalter liegt zwischen 15 und 19 und bildet die Schularten nach', () => {
  const rng = makeRng('abschluss');
  const n = 3000;
  let spaet = 0;
  for (let i = 0; i < n; i++) {
    const a = ziehAbschlussalter(rng, 10);
    assert.ok(a >= 15 && a <= 19, `Abschluss mit ${a}`);
    if (a >= 17) spaet++;
  }
  // 40 % Gymnasium plus die 15 % der Realschüler, die 17 werden: rund 45 %.
  const anteil = spaet / n;
  assert.ok(anteil > 0.38 && anteil < 0.52, `${(anteil * 100).toFixed(0)} % mit 17+`);
});

test('wer älter ist als sein Abschlussalter, ist nächstes Jahr fertig', () => {
  const rng = makeRng('spaet');
  for (let i = 0; i < 200; i++) {
    assert.equal(ziehAbschlussalter(rng, 19), 20);
    const h = ziehHorizont(rng, 'schueler', 18, 2026, false);
    assert.ok(h && h.jahr >= 2027 && h.jahr <= 2028, `Horizont ${h && h.jahr}`);
  }
});

// --- Die Übergänge ---------------------------------------------------------

/**
 * Einen Schüler mit diesem Abschlussalter durch den Horizont schicken.
 * @param {string} seed @param {number} abschlussalter @param {number} commitment
 */
function nachDerSchule(seed, abschlussalter, commitment) {
  const l = lage({
    status: 'schueler', auto: false, seit: 2022,
    horizont: { jahr: 2026, dann: 'bleibt', km: 0 },
  });
  const person = { commitment, lebenslage: l };
  const e = lebensjahr(makeRng(seed), person, abschlussalter, 2026);
  return { l, e };
}

test('mit 16 fertig wird kaum einer Student, mit 18 die meisten', () => {
  const frueh = { student: 0, azubi: 0, arbeiter: 0 };
  const spaet = { student: 0, azubi: 0, arbeiter: 0 };
  for (let i = 0; i < 400; i++) {
    frueh[/** @type {'student'|'azubi'|'arbeiter'} */ (nachDerSchule(`f${i}`, 16, 50).l.status)]++;
    spaet[/** @type {'student'|'azubi'|'arbeiter'} */ (nachDerSchule(`s${i}`, 18, 50).l.status)]++;
  }
  assert.ok(frueh.student < 70, `mit 16: ${frueh.student} Studenten von 400`);
  assert.ok(frueh.azubi > 200, `mit 16: ${frueh.azubi} Azubis von 400`);
  assert.ok(spaet.student > 170, `mit 18: ${spaet.student} Studenten von 400`);
  assert.ok(spaet.arbeiter < 70, `mit 18: ${spaet.arbeiter} Arbeiter von 400`);
});

test('der Übergang meldet sich als Wechsel und zieht einen frischen Horizont', () => {
  const { l, e } = nachDerSchule('wechsel', 18, 50);
  assert.ok(e && e.art === 'wechsel' && e.von === 'schueler', JSON.stringify(e));
  assert.notEqual(l.status, 'schueler');
  assert.ok(l.horizont && l.horizont.jahr > 2026, 'kein frischer Horizont');
});

test('das Commitment kippt den Plan: oben bleibt, wer wegziehen wollte — unten geht, wer bleiben wollte', () => {
  let geblieben = 0;
  let gegangen = 0;
  for (let i = 0; i < 300; i++) {
    // Herz und Seele, Plan Wegzug 200 km: kippt in 60 % der Fälle zum Bleiben.
    const oben = { commitment: 95, lebenslage: lage({
      status: 'student', entfernung: 8, horizont: { jahr: 2026, dann: 'wegzug', km: 200 },
    }) };
    lebensjahr(makeRng(`o${i}`), oben, 24, 2026);
    if (oben.lebenslage.entfernung === 8) geblieben++;
    // Mit einem Bein draußen, Plan Bleiben: kippt in 60 % zum Wegzug.
    const unten = { commitment: 5, lebenslage: lage({
      status: 'student', entfernung: 8, horizont: { jahr: 2026, dann: 'bleibt', km: 0 },
    }) };
    lebensjahr(makeRng(`u${i}`), unten, 24, 2026);
    if (unten.lebenslage.entfernung !== 8) gegangen++;
  }
  assert.ok(geblieben > 130 && geblieben < 230, `${geblieben} von 300 blieben trotz Plan`);
  assert.ok(gegangen > 130 && gegangen < 230, `${gegangen} von 300 zogen weg trotz Plan`);
  // In der Mitte kippt nichts.
  const mitte = { commitment: 50, lebenslage: lage({
    status: 'student', entfernung: 8, horizont: { jahr: 2026, dann: 'wegzug', km: 200 },
  }) };
  lebensjahr(makeRng('m'), mitte, 24, 2026);
  assert.equal(mitte.lebenslage.entfernung, 200);
});

test('weiterstudieren geht nur einmal', () => {
  let master = 0;
  for (let i = 0; i < 300; i++) {
    const p = { commitment: 50, lebenslage: lage({
      status: 'student', horizont: { jahr: 2026, dann: 'bleibt', km: 0 },
    }) };
    // Zwei Studienenden hintereinander: höchstens eines darf „student" bleiben.
    let bleibtStudent = 0;
    for (let jahr = 2026; jahr < 2040; jahr++) {
      if (p.lebenslage.status !== 'student') break;
      // Die Uhr auf das Jahr stellen, in dem das Studium **wirklich** endet —
      // seit der zweiten Wahrheit ist das nicht immer das erzählte.
      const h = /** @type {NonNullable<Lebenslage['horizont']>} */ (
        echterHorizont(p.lebenslage));
      lebensjahr(makeRng(`w${i}${jahr}`), p, 24 + (jahr - 2026), h.jahr);
      if (p.lebenslage.status === 'student') bleibtStudent++;
    }
    assert.ok(bleibtStudent <= 1, `${bleibtStudent} Mal weiterstudiert`);
    if (bleibtStudent === 1) master++;
  }
  assert.ok(master > 50, `nur ${master} von 300 haben einen Master gemacht`);
});

test('der Arbeiter-Zyklus: Familie kommt nur einmal, der Schluss trägt einen Grund, das Commitment skaliert ihn', () => {
  let schlussOben = 0;
  let schlussUnten = 0;
  for (let i = 0; i < 400; i++) {
    const h = ziehHorizont(makeRng(`z${i}`), 'arbeiter', 40, 2026, true, { frisch: true, stufe: 4 });
    assert.ok(h, 'ein Arbeiter ohne Zyklus');
    assert.notEqual(h.dann, 'familie', 'er hat schon eine');
    assert.ok(h.jahr >= 2028 && h.jahr <= 2030, `Zyklus bis ${h.jahr}`);
    if (h.dann === 'schluss') { schlussOben++; assert.ok(h.grund, 'Schluss ohne Grund'); }
    const u = ziehHorizont(makeRng(`z${i}`), 'arbeiter', 40, 2026, true, { frisch: true, stufe: 0 });
    if (u && u.dann === 'schluss') schlussUnten++;
  }
  // Basis 45 % bei 38+: × 0,5 gegen × 2,0 muss sich deutlich unterscheiden.
  assert.ok(schlussUnten > schlussOben * 1.8, `Schluss oben ${schlussOben}, unten ${schlussUnten}`);
});

test('den Körper redet niemand weg — Lust schon', () => {
  let koerperGeblieben = 0;
  let lustGeblieben = 0;
  for (let i = 0; i < 200; i++) {
    const k = { commitment: 95, lebenslage: lage({
      horizont: { jahr: 2026, dann: 'schluss', km: 0, grund: 'koerper' },
    }) };
    if (!(lebensjahr(makeRng(`k${i}`), k, 36, 2026) || { art: '' }).art.startsWith('abgang')) koerperGeblieben++;
    const l = { commitment: 95, lebenslage: lage({
      horizont: { jahr: 2026, dann: 'schluss', km: 0, grund: 'lust' },
    }) };
    if (!(lebensjahr(makeRng(`k${i}`), l, 36, 2026) || { art: '' }).art.startsWith('abgang')) lustGeblieben++;
  }
  assert.equal(koerperGeblieben, 0);
  assert.ok(lustGeblieben > 80 && lustGeblieben < 160, `${lustGeblieben} von 200 blieben trotz Lust-Schluss`);
});

test('ein Arbeiter ohne Horizont aus einem alten Stand bekommt seinen Zyklus', () => {
  const p = { commitment: 50, lebenslage: lage({ horizont: null }) };
  assert.equal(lebensjahr(makeRng('alt'), p, 30, 2026), null);
  assert.ok(p.lebenslage.horizont && p.lebenslage.horizont.jahr > 2026);
});

// --- Die Waage -------------------------------------------------------------

test('der Druck: Auto nimmt, die eigene Familie legt drauf, die Eltern nicht', () => {
  assert.equal(druck(lage({ entfernung: 80, auto: false })), 80);
  assert.equal(druck(lage({ entfernung: 80, auto: true })), 80 * DRUCK_FAKTOR_AUTO);
  assert.equal(druck(lage({ entfernung: 80, auto: true, familie: true })), 80 * DRUCK_FAKTOR_AUTO * DRUCK_FAKTOR_FAMILIE);
  assert.equal(druck(lage({ entfernung: 80, auto: false, familie: true })), 99, 'gekappt auf 99');
  // Beim Studenten ist „Familie" die Eltern — kein Faktor auf seine Entfernung.
  assert.equal(druck(lage({ status: 'student', entfernung: 80, auto: false, familie: true })), 80);
});

test('der Halt: Commitment, Vereinsjahre, und für die Jungen die Eltern', () => {
  assert.equal(halt(50, lage({ seit: 2023 }), 2026), 50 + 3 * HALT_JE_VEREINSJAHR);
  assert.equal(halt(50, lage({ status: 'student', seit: 2023 }), 2026),
    50 + 3 * HALT_JE_VEREINSJAHR + HALT_FAMILIENBONUS_JUNG);
  assert.equal(halt(50, lage({ seit: 2030 }), 2026), 50, 'kein negativer Vereinsjahr-Beitrag');
});

test('der Zähler: zwei Saisons drüber heißt Abgang, eine dazwischen drunter setzt zurück', () => {
  const p = { commitment: 30, lebenslage: lage({ entfernung: 90, auto: false }) };
  assert.equal(lebensjahr(makeRng('1'), p, 26, 2027), null);
  assert.equal(p.lebenslage.druckJahre, 1);
  // Ein Gespräch, das den Halt hebt (Schritt 2b), sähe so aus:
  p.commitment = 95;
  assert.equal(lebensjahr(makeRng('2'), p, 27, 2028), null);
  assert.equal(p.lebenslage.druckJahre, 0, 'der Zähler ist nicht zurückgefallen');
  p.commitment = 30;
  assert.equal(lebensjahr(makeRng('3'), p, 28, 2029), null);
  const e = lebensjahr(makeRng('4'), p, 29, 2030);
  assert.equal(DRUCK_JAHRE_BIS_ABGANG, 2);
  assert.deepEqual(e, { art: 'abgang', grund: 'beruf' });
});

test('wer mit eigener Familie am Druck geht, geht ihretwegen', () => {
  const p = { commitment: 30, lebenslage: lage({ entfernung: 90, auto: true, familie: true }) };
  lebensjahr(makeRng('1'), p, 30, 2027);
  assert.deepEqual(lebensjahr(makeRng('2'), p, 31, 2028), { art: 'abgang', grund: 'familie' });
});

test('wer um die Ecke wohnt, geht nicht über die Waage — selbst mit einem Bein draußen', () => {
  // Der Horizont liegt weit weg, damit kein Zyklus dazwischen einen Wegzug
  // bringt: hier zählt nur die Waage. Stufe 0, aber nicht null — bei einem
  // Commitment von 0 wiegen drei Kilometer tatsächlich mehr als nichts.
  const p = { commitment: 10, lebenslage: lage({
    entfernung: 3, auto: false, seit: 2026, horizont: { jahr: 2099, dann: 'bleibt', km: 0 },
  }) };
  for (let jahr = 2027; jahr < 2040; jahr++) {
    assert.equal(lebensjahr(makeRng(`n${jahr}`), p, jahr - 2000, jahr), null);
    assert.equal(p.lebenslage.druckJahre, 0);
  }
});

test('der Wegzug ist log-normal: die meisten nah, die Ferne kommt vor', () => {
  const rng = makeRng('km');
  const werte = [];
  for (let i = 0; i < 2000; i++) werte.push(wegzugKm(rng, 'student'));
  werte.sort((a, b) => a - b);
  const median = werte[1000];
  assert.ok(median > 50 && median < 72, `Median ${median} km`);
  assert.ok(werte[0] >= 10 && werte[1999] <= 400, `${werte[0]}–${werte[1999]} km`);
  assert.ok(werte.filter((k) => k > 200).length > 20, 'die Ferne kommt nicht vor');
});

// --- Im Saisonwechsel ------------------------------------------------------

test('der Saisonwechsel lässt den Lebenslauf laufen und ersetzt bei der KI, wer geht — mit Grund in der Post', () => {
  const stand = neuesSpiel('heg', 'lebenslauf');
  const groessen = Object.fromEntries(TEAMS.map((t) => [t.id, stand.kader[t.id].length]));
  const vorher = new Set(Object.values(stand.kader).flat().map((s) => s.id));
  let weg = 0;

  for (let saison = 0; saison < 4; saison++) {
    bisSaisonende(stand);
    // Der eigene Verein bekommt seit den Tryouts keinen Ersatz mehr: er
    // schrumpft beim Wechsel um genau die, die gehen, und wächst im November.
    groessen[stand.meinTeam] = stand.kader[stand.meinTeam].length;
    const { ruecktritte, nachrichten } = naechsteSaison(stand);
    groessen[stand.meinTeam] -= ruecktritte.length;
    for (const t of TEAMS) {
      assert.equal(stand.kader[t.id].length, groessen[t.id], `${t.id} hat die Kadergröße verändert`);
      for (const s of stand.kader[t.id]) {
        const l = /** @type {Lebenslage} */ (s.lebenslage);
        assert.ok(!l.horizont || l.horizont.jahr > stand.jahr, `${s.id}: der Horizont liegt zurück`);
        const satz = T.lebenslage.satz(l, stand.jahr);
        assert.ok(!satz.includes('undefined') && !satz.includes('NaN'), satz);
      }
    }
    const post = nachrichten.find((n) => n.art === 'ruecktritte');
    if (ruecktritte.length > 0) {
      assert.ok(post, 'Abgänge ohne Nachricht');
      assert.equal(post.daten.gruende.length, ruecktritte.length, 'je Abgang ein Grund');
      const text = T.post.ruecktritte.text(post.daten).join(' ');
      for (const g of post.daten.gruende) assert.ok(text.includes(T.lebenslage.grund[g]), text);
    }
  }
  for (const s of Object.values(stand.kader).flat()) if (!vorher.has(s.id)) weg++;
  // Übers Alter gehen rund 1,2 je Verein und Saison, über den Lebenslauf rund
  // 1,4 — nach vier Saisons sollten spürbar mehr als nur die Alten weg sein.
  assert.ok(weg > 60 && weg < 200, `${weg} von 415 sind nach vier Saisons neu`);
});

test('der Lebenslauf ist reproduzierbar und hängt nicht an der Kaderreihenfolge', () => {
  const a = neuesSpiel('heg', 'gleich');
  const b = neuesSpiel('heg', 'gleich');
  b.kader.heg.reverse();
  bisSaisonende(a);
  bisSaisonende(b);
  // Die Commitments gleichziehen, bevor der Lebenslauf läuft. Sie sind
  // auseinandergelaufen, und das zu Recht: die automatische Aufstellung geht
  // den Kader der Reihe nach durch, ein umgedrehter Kader spielt also andere
  // Leute, und wer spielt, driftet anders. Das ist eine andere Eigenschaft als
  // die hier geprüfte — die Waage liest das Commitment, und ein Zähler, der an
  // der Einsatzzeit hängt, sagt über die Ziehungen des Lebenslaufs nichts.
  const werte = new Map(a.kader.heg.map((s) => [s.id, s.commitment]));
  for (const s of b.kader.heg) if (werte.has(s.id)) s.commitment = werte.get(s.id);
  naechsteSaison(a);
  naechsteSaison(b);
  const lagenA = new Map(a.kader.heg.map((s) => [s.id, JSON.stringify(s.lebenslage)]));
  for (const s of b.kader.heg) {
    if (lagenA.has(s.id)) assert.equal(JSON.stringify(s.lebenslage), lagenA.get(s.id), `${s.id} weicht ab`);
  }
});

test('ein Stand aus Version 11 läuft durch den Lebenslauf, auch ohne die neuen Felder', () => {
  const stand = neuesSpiel('heg', 'elf');
  for (const s of Object.values(stand.kader).flat()) {
    const l = /** @type {Lebenslage} */ (s.lebenslage);
    delete l.druckJahre;
    delete l.verlaengert;
    if (l.horizont) delete l.horizont.grund;
  }
  bisSaisonende(stand);
  assert.doesNotThrow(() => naechsteSaison(stand));
  for (const s of Object.values(stand.kader).flat()) {
    const satz = T.lebenslage.satz(/** @type {Lebenslage} */ (s.lebenslage), stand.jahr);
    assert.ok(!satz.includes('undefined'), satz);
  }
});
