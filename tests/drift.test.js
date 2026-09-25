// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  gruppeVon, betreuung, verlustFaktor, verliere, warVerletzt, verletzungsLast,
  verletzungsDrift, niederlagenInFolge, serienDrift, vereinsjahr, kiAusgleich,
  stufeBekannt, trendVersuch,
} from '../engine/drift.js';
import { verduennterWert, gruppenWert } from '../engine/coach.js';
import { drift as bankDrift, verbucheSpiel } from '../engine/rolle.js';
import {
  MAX_RATING, BETREUUNG_FAKTOR_OHNE, BETREUUNG_FAKTOR_BESTE,
  VERLETZUNG_JE_WOCHE, VERLETZUNG_FAKTOR_FAMILIE, VERLETZUNG_FAKTOR_ARBEITER,
  ERFOLG_SERIE_SCHWELLE, ERFOLG_SERIE_ABZUG,
  VEREINSJAHR_BONUS, COMMITMENT_VEREINSJAHRE_MAX, TREND_VERSUCHE, KI_AUSGLEICH_JE_SAISON,
  ROLLE_FENSTER, ROLLE_OHNE_JE_SPIEL,
} from '../engine/constants.js';
import {
  neuesSpiel, weiter, fuehrePersoenlichesGespraech, beantworteNachricht, meister,
} from '../engine/saison.js';
import { offeneAntworten } from '../engine/postfach.js';
import { stufe } from '../engine/commitment.js';

/**
 * Ein Spieler, so weit er für die Drift zählt: Position, Commitment,
 * Lebenslage. Kein Generator — die Annahmen sollen im Test stehen.
 * @param {object} [rest]
 */
function mann(rest = {}) {
  return /** @type {any} */ ({
    id: 'x', vorname: 'V', nachname: 'N', position: 'QB', einsaetze: {},
    alter: 28, staerke: 50, verletztBis: 0, commitment: 50,
    lebenslage: { status: 'student', entfernung: 5, auto: true, familie: false, horizont: null, seit: 2020 },
    ...rest,
  });
}

/**
 * Ein Koordinator mit gleichen Soft Skills — mehr liest die Drift nicht.
 * @param {'OC'|'DC'} rolle @param {number} wert
 */
function koordinator(rolle, wert) {
  return /** @type {any} */ ({
    id: rolle, vorname: 'C', nachname: rolle, rolle, gruppe: rolle === 'OC' ? 'QB' : 'DL',
    soft: { kommunikation: wert, empathie: wert, fuehrung: wert, motivation: wert, konfliktloesung: wert },
  });
}

/** Ein Würfel, der immer dasselbe zeigt. @param {number} x */
const immer = (x) => () => x;

// --- Die Verdünnung --------------------------------------------------------

test('der Koordinator teilt sich auf: die beiden Rechenbeispiele aus dem Entwurf', () => {
  // OC 60 ohne Positionscoach: 99 × 60/100/5 ≈ 12.
  assert.equal(Math.round(verduennterWert(60, 5)), 12);
  // Mit einem Positionscoach von 23: 23 + 76 × 0,12 ≈ 32.
  assert.equal(Math.round(verduennterWert(60, 5, 23)), 32);
  // Wer allein für eine Gruppe da ist, gibt ihr seinen ganzen Anteil.
  assert.ok(verduennterWert(60, 1) > verduennterWert(60, 5));
  // Das Dach hält auch beim besten Koordinator mit dem besten Positionscoach.
  assert.ok(verduennterWert(MAX_RATING, 1, MAX_RATING) <= MAX_RATING);
});

test('jede Seite hat fünf Gruppen, und ohne Koordinator coacht dort niemand', () => {
  const stab = [koordinator('OC', 50)];
  // 99 × 0,5 / 5 = 9,9 — die Offense teilt sich den OC durch fünf.
  assert.equal(gruppenWert(stab, 'QB', (c) => c.soft.empathie), 9.9);
  assert.equal(gruppenWert(stab, 'OL', (c) => c.soft.empathie), 9.9);
  assert.equal(gruppenWert(stab, 'CB', (c) => c.soft.empathie), 0, 'kein DC, keine Betreuung');
});

// --- Der Coach als Faktor --------------------------------------------------

test('ohne Stab ist jeder Verlust am teuersten, mit Stab billiger', () => {
  const sp = mann();
  assert.equal(verlustFaktor([], sp), BETREUUNG_FAKTOR_OHNE);
  const mitCoach = verlustFaktor([koordinator('OC', 60)], sp);
  assert.ok(mitCoach < BETREUUNG_FAKTOR_OHNE && mitCoach > BETREUUNG_FAKTOR_BESTE, String(mitCoach));
  // Der DC hilft dem Quarterback nicht.
  assert.equal(verlustFaktor([koordinator('DC', 99)], sp), BETREUUNG_FAKTOR_OHNE);
});

test('die Betreuung mittelt Empathie und Kommunikation', () => {
  const c = koordinator('OC', 0);
  c.soft.empathie = 80;
  c.soft.kommunikation = 20;
  assert.equal(betreuung([c], gruppeVon(mann())), verduennterWert(50, 5));
});

test('ein Verlust wird gedämpft, und nie über den Rand gebucht', () => {
  const sp = mann({ commitment: 50 });
  const delta = verliere(sp, [], 10);
  assert.equal(delta, -10 * BETREUUNG_FAKTOR_OHNE);
  assert.equal(sp.commitment, 50 - 10 * BETREUUNG_FAKTOR_OHNE);
  const unten = mann({ commitment: 3 });
  verliere(unten, [], 10);
  assert.equal(unten.commitment, 0);
});

test('der Bank-Drift nimmt den Faktor nur auf Verluste', () => {
  // Ohne Rolle und nie gespielt: der volle Abzug für Übergangene.
  const bank = mann({ commitment: 50 });
  for (let i = 0; i < ROLLE_FENSTER; i++) verbucheSpiel(bank, false);
  bankDrift(bank, 100, 1.4);
  assert.equal(bank.commitment, 50 - ROLLE_OHNE_JE_SPIEL * 1.4);
  // Mit erfüllter Rolle: der Bonus bleibt, was er ist.
  const stamm = mann({ commitment: 50, rolle: 'starter' });
  for (let i = 0; i < ROLLE_FENSTER; i++) verbucheSpiel(stamm, true);
  const mitFaktor = bankDrift(stamm, 100, 1.4);
  const stamm2 = mann({ commitment: 50, rolle: 'starter' });
  for (let i = 0; i < ROLLE_FENSTER; i++) verbucheSpiel(stamm2, true);
  assert.deepEqual(mitFaktor, bankDrift(stamm2, 100));
});

// --- Verletzung ------------------------------------------------------------

test('eine Verletzung von w Wochen kostet w Wochenanfänge', () => {
  // Verletzt am Spieltag 64 (ein Wochenanfang), sechs Wochen: fit ab 106.
  const sp = mann({ verletztBis: 64 + 6 * 7 });
  const wochen = [64, 71, 78, 85, 92, 99, 106, 113].filter((t) => t > 64 && warVerletzt(sp, t));
  assert.deepEqual(wochen, [71, 78, 85, 92, 99, 106]);
  assert.equal(warVerletzt(mann({ verletztBis: 64 + 7 }), 71), true, 'auch die eine Woche zählt');
  assert.equal(warVerletzt(mann({ verletztBis: 0 }), 3), false, 'fit ist fit, auch am Saisonanfang');
});

test('Familie und Arbeit machen die verletzte Woche teurer — nur die eigene Familie', () => {
  const l = (/** @type {any} */ x) => ({ status: 'student', familie: false, ...x });
  assert.equal(verletzungsLast(mann({ lebenslage: l({}) })), VERLETZUNG_JE_WOCHE);
  assert.equal(verletzungsLast(mann({ lebenslage: l({ familie: true }) })), VERLETZUNG_JE_WOCHE,
    'beim Studenten sind es die Eltern');
  assert.equal(verletzungsLast(mann({ lebenslage: l({ status: 'arbeiter' }) })),
    VERLETZUNG_JE_WOCHE * VERLETZUNG_FAKTOR_ARBEITER);
  assert.equal(verletzungsLast(mann({ lebenslage: l({ status: 'arbeiter', familie: true }) })),
    VERLETZUNG_JE_WOCHE * VERLETZUNG_FAKTOR_ARBEITER * VERLETZUNG_FAKTOR_FAMILIE);
});

test('wer fit ist, verliert durch die Verletzungsdrift nichts', () => {
  const sp = mann({ commitment: 50 });
  assert.equal(verletzungsDrift(sp, [], 71), 0);
  assert.equal(sp.commitment, 50);
});

// --- Erfolg ----------------------------------------------------------------

/** Eine gespielte Partie. @param {number} tag @param {string} heim @param {string} gast @param {boolean} heimGewinnt */
function partie(tag, heim, gast, heimGewinnt) {
  return /** @type {any} */ ({
    tag, heim, gast, ergebnis: { heimPunkte: heimGewinnt ? 21 : 7, gastPunkte: heimGewinnt ? 7 : 21 },
  });
}

test('die Serie zählt von hinten und reißt beim Sieg', () => {
  const plan = [
    partie(1, 'a', 'b', true), partie(8, 'c', 'a', true),
    partie(15, 'a', 'd', false), partie(22, 'e', 'a', true),
  ];
  assert.equal(niederlagenInFolge(plan, 'a'), 3);
  assert.equal(niederlagenInFolge(plan, 'b'), 1);
  assert.equal(niederlagenInFolge(plan, 'c'), 0);
  // Ungespielt zählt nicht.
  plan.push(/** @type {any} */ ({ tag: 29, heim: 'a', gast: 'f', ergebnis: null }));
  assert.equal(niederlagenInFolge(plan, 'a'), 3);
});

test('die Serie kostet einmal beim Erreichen der Schwelle — den ganzen Kader', () => {
  const verletzt = mann({ id: 'v', verletztBis: 999 });
  const kader = [mann({ id: 'f' }), verletzt];
  /** @type {any[]} */
  const plan = [];
  let gegriffen = 0;
  for (let i = 0; i < ERFOLG_SERIE_SCHWELLE + 2; i++) {
    plan.push(partie(1 + 7 * i, 'a', 'b', false));
    if (serienDrift(kader, [], plan, 'a')) gegriffen++;
  }
  assert.equal(gegriffen, 1, 'nicht bei jedem weiteren Spiel der Serie');
  assert.equal(verletzt.commitment, 50 - ERFOLG_SERIE_ABZUG * BETREUUNG_FAKTOR_OHNE,
    'auch wer verletzt ist, liest die Tabelle');
});

// --- Vereinsjahre ----------------------------------------------------------

test('jedes Jahr im Verein hebt ein wenig, bis zum Deckel', () => {
  const l = { status: 'arbeiter', familie: false, seit: 2020 };
  const ersteJahr = mann({ lebenslage: { ...l } });
  assert.equal(vereinsjahr(ersteJahr, 2021), VEREINSJAHR_BONUS);
  assert.equal(ersteJahr.commitment, 50 + VEREINSJAHR_BONUS);
  assert.equal(vereinsjahr(mann({ lebenslage: { ...l } }), 2020 + COMMITMENT_VEREINSJAHRE_MAX),
    VEREINSJAHR_BONUS);
  assert.equal(vereinsjahr(mann({ lebenslage: { ...l } }), 2021 + COMMITMENT_VEREINSJAHRE_MAX), 0,
    'danach kommt nichts mehr dazu');
});

// --- Der Ausgleich für KI-Vereine -------------------------------------------

test('der KI-Ausgleich skaliert mit der Betreuung, ungedämpft — er ist ein Gewinn', () => {
  const sp = mann({ commitment: 50 });
  assert.equal(kiAusgleich(sp, []), 0, 'ohne Coach kein Ausgleich');
  assert.equal(sp.commitment, 50);

  const stab = [koordinator('OC', 60)];
  const b = betreuung(stab, gruppeVon(sp));
  const erwartet = KI_AUSGLEICH_JE_SAISON * (b / MAX_RATING);
  const delta = kiAusgleich(mann({ commitment: 50 }), stab);
  assert.ok(Math.abs(delta - erwartet) < 1e-9);

  const staerker = [koordinator('OC', 90)];
  assert.ok(kiAusgleich(mann({ commitment: 50 }), staerker) > delta,
    'ein besserer Koordinator gibt mehr — dieselbe Kopplung, die auch Verluste dämpft');
});

test('der Ausgleich bucht nie über 99 hinaus', () => {
  const sp = mann({ commitment: 98 });
  kiAusgleich(sp, [koordinator('OC', 90)]);
  assert.equal(sp.commitment, 99);
});

// --- Die Trend-Nachricht ---------------------------------------------------

test('ohne gemeldete Stufe gilt die heutige als bekannt — ohne Nachricht', () => {
  const sp = mann({ commitment: 50 });
  assert.equal(trendVersuch(sp, [koordinator('OC', 99)], immer(0)), null);
  assert.equal(sp.commitmentStufeGemeldet, stufe(50));
});

test('ein Wechsel wird gemeldet, wenn der Wurf unter der Betreuung liegt', () => {
  const sp = mann({ commitment: 50 });
  stufeBekannt(sp);
  sp.commitment = 35;
  const stab = [koordinator('OC', 60)];
  assert.equal(trendVersuch(sp, stab, immer(0.99)), null, 'daneben');
  assert.deepEqual(trendVersuch(sp, stab, immer(0)), { von: 2, nach: 1 });
  assert.equal(sp.commitmentStufeGemeldet, 1);
  assert.equal(sp.commitmentTrendVersuche, 0);
});

test('nach vier Fehlwürfen bleibt der Wechsel für immer ungesagt', () => {
  const sp = mann({ commitment: 50 });
  stufeBekannt(sp);
  sp.commitment = 65;
  const stab = [koordinator('OC', 60)];
  for (let i = 0; i < TREND_VERSUCHE; i++) assert.equal(trendVersuch(sp, stab, immer(0.99)), null);
  assert.equal(sp.commitmentStufeGemeldet, 3, 'gilt als bekannt, ohne dass es jemand gesagt hätte');
  assert.equal(trendVersuch(sp, stab, immer(0)), null, 'und später auch nicht mehr');
});

test('ohne Coach auf der Seite wird nie etwas gemeldet', () => {
  const sp = mann({ commitment: 50 });
  stufeBekannt(sp);
  sp.commitment = 10;
  assert.equal(trendVersuch(sp, [koordinator('DC', 99)], immer(0)), null);
});

test('wer auf die bekannte Stufe zurückfällt, fängt mit den Versuchen von vorn an', () => {
  const sp = mann({ commitment: 50 });
  stufeBekannt(sp);
  const stab = [koordinator('OC', 60)];
  sp.commitment = 35;
  trendVersuch(sp, stab, immer(0.99));
  trendVersuch(sp, stab, immer(0.99));
  assert.equal(sp.commitmentTrendVersuche, 2);
  sp.commitment = 45;
  trendVersuch(sp, stab, immer(0.99));
  assert.equal(sp.commitmentTrendVersuche, 0);
});

// --- Im Spiel --------------------------------------------------------------

/** @param {any} s */
function raeume(s) {
  for (const n of offeneAntworten(s)) {
    beantworteNachricht(s, n.id, n.art === 'aufstellungUngueltig' ? 'automatisch' : 'spaeter');
  }
}

test('ein Gespräch macht die Stufe bekannt', () => {
  const s = neuesSpiel('heg', 'drift-gespraech');
  const sp = s.kader[s.meinTeam][0];
  sp.commitmentStufeGemeldet = 4;
  sp.commitmentTrendVersuche = 2;
  fuehrePersoenlichesGespraech(s, sp.id);
  assert.equal(sp.commitmentStufeGemeldet, stufe(sp.commitment));
  assert.equal(sp.commitmentTrendVersuche, 0);
});

test('über eine Saison: ohne Stab kein Wort, mit einem guten Stab Meldungen', () => {
  /** @param {boolean} mitStab */
  const saison = (mitStab) => {
    const s = neuesSpiel('heg', 'drift-saison');
    const stab = s.coaches[s.meinTeam];
    for (const c of stab) for (const k in c.soft) c.soft[k] = mitStab ? MAX_RATING : 0;
    let meldungen = 0;
    for (let i = 0; i < 400 && !meister(s); i++) {
      raeume(s);
      meldungen += weiter(s).nachrichten.filter((n) => n.art === 'commitmentTrend').length;
    }
    return meldungen;
  };
  assert.equal(saison(false), 0);
  assert.ok(saison(true) > 0, 'ein Stab mit vollen Werten bemerkt über eine Saison etwas');
});

test('die Drift trifft auch die KI-Vereine', () => {
  const s = neuesSpiel('heg', 'drift-ki');
  const fremd = Object.keys(s.kader).filter((id) => id !== s.meinTeam);
  const vorher = fremd.map((id) => s.kader[id].reduce((a, sp) => a + (sp.commitment ?? 0), 0));
  for (let i = 0; i < 400 && !meister(s); i++) {
    raeume(s);
    weiter(s);
  }
  const nachher = fremd.map((id) => s.kader[id].reduce((a, sp) => a + (sp.commitment ?? 0), 0));
  assert.ok(nachher.some((w, i) => w !== vorher[i]), 'ohne Rollen bewegt sich dort trotzdem etwas');
});

test('mehr Betreuung bedeutet über mehrere Saisons einen höheren Schnitt', () => {
  // Zwei Vereine, künstlich auf schlechte bzw. sehr gute Coaches gesetzt,
  // sonst identisch — der Unterschied am Ende ist allein der Ausgleich.
  const schlecht = neuesSpiel('heg', 'streuung');
  const gut = neuesSpiel('heg', 'streuung');
  const anderer = Object.keys(schlecht.kader).find((id) => id !== schlecht.meinTeam);
  for (const c of schlecht.coaches[anderer]) for (const k in c.soft) c.soft[k] = 0;
  for (const c of gut.coaches[anderer]) for (const k in c.soft) c.soft[k] = MAX_RATING;

  const schnitt = (s) => s.kader[anderer].reduce((a, sp) => a + (sp.commitment ?? 0), 0)
    / s.kader[anderer].length;

  for (let saison = 0; saison < 3; saison++) {
    const jahr = schlecht.jahr;
    for (let i = 0; i < 2000 && schlecht.jahr === jahr; i++) { raeume(schlecht); weiter(schlecht); }
  }
  for (let saison = 0; saison < 3; saison++) {
    const jahr = gut.jahr;
    for (let i = 0; i < 2000 && gut.jahr === jahr; i++) { raeume(gut); weiter(gut); }
  }
  assert.ok(schnitt(gut) > schnitt(schlecht),
    `gut betreut (${schnitt(gut).toFixed(1)}) sollte über schlecht betreut `
      + `(${schnitt(schlecht).toFixed(1)}) liegen`);
});
