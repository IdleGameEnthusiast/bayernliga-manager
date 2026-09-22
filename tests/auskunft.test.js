// @ts-check
/**
 * Die zweite Wahrheit: die Ziehung, der Zeitpunkt ihrer Wissbarkeit, und das
 * Gespräch, das sie hebt.
 *
 * Verteilungen nur mit festem Seed und nur grob — die Zahlen selbst sind
 * Balancing (docs/balancing.md, Abschnitt 16), kein Test. Geprüft wird, was
 * gelten **muss**: dass eine Wahrheit in genau einer Größe abweicht, dass sie
 * nie später wissbar wird, als sie eintritt, und dass der Plan sich nicht
 * selbst überlebt.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ziehWahrheit, echterHorizont, ziehHorizont, ziehLebenslage, ziehBindung,
} from '../engine/commitment.js';
import { weissEsSelbst, frageNachLebenslage, uebernimmWahrheit } from '../engine/auskunft.js';
import { lebensjahr } from '../engine/lebenslauf.js';
import {
  makeRng, WAHRHEIT_CHANCE, WISSBAR_ANTEIL, GESPRAECHE_JE_WOCHE,
} from '../engine/constants.js';
import { neuesSpiel, gespraecheFrei, fuehreLebenslageGespraech } from '../engine/saison.js';
import { migriere } from '../engine/save.js';

/** @typedef {import('../engine/commitment.js').Lebenslage} Lebenslage */
/** @typedef {import('../engine/commitment.js').Horizont} Horizont */

/**
 * Eine Lebenslage nach Wunsch — der Rest wie ein Student im Jahr 2026, der in
 * vier Jahren fertig ist und dann bleiben will.
 * @param {Partial<Lebenslage>} felder
 * @returns {Lebenslage}
 */
function lage(felder) {
  return {
    status: 'student', entfernung: 10, auto: true, familie: false, seit: 2024,
    horizont: { jahr: 2030, dann: 'bleibt', km: 0 },
    ...felder,
  };
}

/**
 * Viele Wahrheiten zu demselben Plan, für die Verteilungen.
 * @param {Horizont} plan
 * @param {import('../engine/commitment.js').Status} [status]
 * @param {number} [n]
 */
function vieleWahrheiten(plan, status = 'student', n = 600) {
  const raus = [];
  for (let i = 0; i < n; i++) {
    raus.push(ziehWahrheit(makeRng(`w${i}`), plan, status, 22, 2026, false));
  }
  return raus;
}

// --- Die Ziehung -----------------------------------------------------------

test('ohne Plan gibt es nichts zu verschweigen', () => {
  assert.equal(ziehWahrheit(makeRng('x'), null, 'rentner', 66, 2026, false), null);
});

test('etwa jeder dritte Plan hält nicht', () => {
  const alle = vieleWahrheiten({ jahr: 2030, dann: 'bleibt', km: 0 });
  const anteil = alle.filter(Boolean).length / alle.length;
  assert.ok(Math.abs(anteil - WAHRHEIT_CHANCE) < 0.06, `${anteil.toFixed(2)} weichen ab`);
});

test('eine Wahrheit weicht in genau einer Größe ab — im Zeitpunkt oder im Ausgang', () => {
  /** @type {Horizont} */
  const plan = { jahr: 2030, dann: 'bleibt', km: 0 };
  let dauer = 0;
  let ausgang = 0;
  for (const w of vieleWahrheiten(plan)) {
    if (!w) continue;
    const jahrAnders = w.jahr !== plan.jahr;
    const ausgangAnders = w.dann !== plan.dann;
    assert.ok(jahrAnders !== ausgangAnders, `beides oder nichts: ${JSON.stringify(w)}`);
    if (jahrAnders) dauer++; else ausgang++;
  }
  assert.ok(dauer > 40 && ausgang > 40, `${dauer} Zeitpunkt, ${ausgang} Ausgang`);
});

test('der wahre Zeitpunkt liegt immer noch in der Zukunft', () => {
  // Ein Plan, der schon nächstes Jahr fällig ist: die Verschiebung um −1 Jahr
  // fiele auf das laufende und würde nie geprüft. Sie darf hier nicht gezogen
  // werden, sonst verschwände die Wahrheit still.
  for (const w of vieleWahrheiten({ jahr: 2027, dann: 'bleibt', km: 0 })) {
    if (w) assert.ok(w.jahr > 2026, `${w.jahr} liegt nicht in der Zukunft`);
  }
});

test('er weiß es zwischen 30 und 90 Prozent der Strecke — und nie zu spät', () => {
  /** @type {Horizont} */
  const plan = { jahr: 2030, dann: 'bleibt', km: 0 };
  const jahre = new Set();
  for (const w of vieleWahrheiten(plan)) {
    if (!w) continue;
    const ab = /** @type {number} */ (w.wissbarAb);
    assert.ok(ab >= 2026 + Math.round(WISSBAR_ANTEIL[0] * 4), `${ab} ist zu früh`);
    assert.ok(ab <= 2026 + Math.round(WISSBAR_ANTEIL[1] * 4), `${ab} ist zu spät`);
    // Die Invariante, auf der die ungefragte Übernahme steht: wenn das
    // geplante Jahr kommt, weiß er es längst selbst.
    assert.ok(ab <= plan.jahr, `${ab} liegt hinter dem Plan`);
    assert.ok(ab <= w.jahr, `${ab} liegt hinter dem Ereignis`);
    jahre.add(ab);
  }
  assert.ok(jahre.size >= 3, `nur ${jahre.size} verschiedene Jahre`);
});

test('wer noch einen Abschnitt vor sich hat, zieht weg oder bleibt — ein Drittes gibt es nicht', () => {
  for (const status of /** @type {const} */ (['schueler', 'student', 'azubi'])) {
    for (const w of vieleWahrheiten({ jahr: 2030, dann: 'bleibt', km: 0 }, status, 200)) {
      if (w) assert.ok(w.dann === 'bleibt' || w.dann === 'wegzug', `${status}: ${w.dann}`);
    }
  }
});

test('ein wahrer Wegzug trägt Kilometer, ein wahrer Schluss einen Grund', () => {
  let wegzuege = 0;
  let schluesse = 0;
  for (const w of vieleWahrheiten({ jahr: 2030, dann: 'bleibt', km: 0 }, 'arbeiter')) {
    if (!w) continue;
    if (w.dann === 'wegzug') { wegzuege++; assert.ok(w.km >= 10, `Wegzug über ${w.km} km`); }
    if (w.dann === 'schluss') { schluesse++; assert.ok(w.grund, 'Schluss ohne Grund'); }
    if (w.dann === 'bleibt') assert.equal(w.km, 0, 'Bleiben mit Kilometern');
  }
  assert.ok(wegzuege > 10 && schluesse > 10, `${wegzuege} Wegzüge, ${schluesse} Schlüsse`);
});

test('ein Plan, der zum Schluss wird, verliert den alten Grund nicht an die Stille', () => {
  // Der Plan trägt schon einen Grund; weicht die Wahrheit nur im Zeitpunkt ab,
  // muss er mitkommen, sonst liest sich der Satz später als „körperlich".
  for (const w of vieleWahrheiten({ jahr: 2030, dann: 'schluss', km: 0, grund: 'lust' }, 'arbeiter')) {
    if (w && w.dann === 'schluss') assert.ok(w.grund, JSON.stringify(w));
  }
});

test('die Wahrheit hängt an der Bindung, nicht an der Lebenslage allein', () => {
  // `ziehLebenslage()` bleibt ohne — sonst verschöbe sich jeder Wurf danach
  // und damit jeder Mensch in jedem Stand, der seine Bindung nachzieht.
  assert.equal(ziehLebenslage(makeRng('b'), 22, 2026).horizontWahrheit, undefined);
  let mit = 0;
  for (let i = 0; i < 200; i++) {
    if (ziehBindung(makeRng(`b${i}`), 22, 2026).lebenslage.horizontWahrheit) mit++;
  }
  assert.ok(mit > 20, `nur ${mit} von 200 mit zweiter Wahrheit`);
});

// --- Wann er es selbst weiß ------------------------------------------------

/** Eine Lage mit einer Wahrheit, die ab 2028 wissbar ist. */
function mitWahrheit() {
  return lage({ horizontWahrheit: { jahr: 2030, dann: 'wegzug', km: 200, wissbarAb: 2028 } });
}

test('vor dem Jahr weiß er es selbst noch nicht', () => {
  const l = mitWahrheit();
  assert.equal(weissEsSelbst(l, 2027), false);
  assert.equal(weissEsSelbst(l, 2028), true);
  assert.equal(weissEsSelbst(l, 2029), true);
});

test('ohne Wahrheit weiß er nichts, was er nicht schon gesagt hätte', () => {
  assert.equal(weissEsSelbst(lage({}), 2099), false);
});

test('eine Wahrheit ohne Jahr gilt erst, wenn sie eintritt', () => {
  // Kommt aus keiner Ziehung, wohl aber aus einem von Hand gebauten Stand —
  // und dann ist das Ereignis selbst die späteste ehrliche Antwort.
  const l = lage({ horizontWahrheit: { jahr: 2030, dann: 'wegzug', km: 200 } });
  assert.equal(weissEsSelbst(l, 2029), false);
  assert.equal(weissEsSelbst(l, 2030), true);
});

// --- Das Gespräch ----------------------------------------------------------

test('zu früh gefragt bestätigt er den Plan — und behält die Wahrheit', () => {
  const person = { lebenslage: mitWahrheit() };
  const auskunft = frageNachLebenslage(person, 2027);
  assert.equal(auskunft.ton, 0);
  assert.equal(auskunft.horizont?.dann, 'bleibt', 'er erzählt weiter seinen Plan');
  assert.ok(person.lebenslage.horizontWahrheit, 'und die Wahrheit steht noch daneben');
});

test('ab dem Jahr rückt er damit heraus, und danach steht sie in der Akte', () => {
  const person = { lebenslage: mitWahrheit() };
  const auskunft = frageNachLebenslage(person, 2028);
  assert.equal(auskunft.ton, 1);
  assert.equal(person.lebenslage.horizont?.dann, 'wegzug');
  assert.equal(person.lebenslage.horizont?.km, 200);
  assert.equal(person.lebenslage.horizontWahrheit, null);
  assert.equal(person.lebenslage.horizont?.wissbarAb, undefined, 'die Verborgenheit ist vorbei');
});

test('zweimal fragen bringt kein zweites Mal etwas', () => {
  const person = { lebenslage: mitWahrheit() };
  assert.equal(frageNachLebenslage(person, 2028).ton, 1);
  assert.equal(frageNachLebenslage(person, 2028).ton, 0);
});

test('wer nichts zu verschweigen hat, erzählt seinen Plan — ununterscheidbar von zu früh', () => {
  const person = { lebenslage: lage({}) };
  const auskunft = frageNachLebenslage(person, 2099);
  assert.equal(auskunft.ton, 0);
  assert.equal(auskunft.horizont?.dann, 'bleibt');
});

test('wer gar keine Lebenslage trägt, wirft nicht', () => {
  assert.deepEqual(frageNachLebenslage({}, 2026), { ton: 0, horizont: null });
});

// --- Im Lebenslauf ---------------------------------------------------------

test('fällig ist, was wirklich kommt — nicht, was erzählt wurde', () => {
  // Der Plan sagt 2030, in Wahrheit ist 2028 Schluss. Im Jahr 2028 ist er weg,
  // obwohl in der Akte noch zwei Jahre standen.
  const person = { commitment: 50, lebenslage: lage({
    horizont: { jahr: 2030, dann: 'bleibt', km: 0 },
    horizontWahrheit: { jahr: 2028, dann: 'wegzug', km: 250, wissbarAb: 2027 },
  }) };
  assert.equal(lebensjahr(makeRng('f1'), person, 24, 2027), null, 'vorher passiert nichts');
  lebensjahr(makeRng('f2'), person, 25, 2028);
  assert.equal(person.lebenslage.entfernung, 250, 'der Wegzug ist eingetreten');
  assert.notEqual(person.lebenslage.status, 'student', 'und das Studium ist vorbei');
});

test('ein abgelaufener Plan übernimmt die Wahrheit, auch wenn nie jemand gefragt hat', () => {
  // Das Studium sollte 2028 enden und dauert in Wahrheit bis 2030. Im Jahr
  // 2028 geschieht nichts — und danach darf in der Akte nicht weiter „dieses
  // Jahr fertig" stehen, drei Jahre lang.
  const person = { commitment: 50, lebenslage: lage({
    horizont: { jahr: 2028, dann: 'bleibt', km: 0 },
    horizontWahrheit: { jahr: 2030, dann: 'bleibt', km: 0, wissbarAb: 2027 },
  }) };
  lebensjahr(makeRng('s1'), person, 24, 2028);
  assert.equal(person.lebenslage.status, 'student', 'es ist nichts passiert');
  assert.equal(person.lebenslage.horizont?.jahr, 2030, 'aber die Akte stimmt wieder');
  assert.equal(person.lebenslage.horizontWahrheit, null);
});

test('ein neuer Plan am Horizont bringt eine neue Wahrheit und begräbt die alte', () => {
  let mitNeuer = 0;
  for (let i = 0; i < 200; i++) {
    const alt = /** @type {Horizont} */ ({ jahr: 2028, dann: 'wegzug', km: 90, wissbarAb: 2027 });
    const person = { commitment: 50, lebenslage: lage({
      horizont: { jahr: 2028, dann: 'bleibt', km: 0 },
      horizontWahrheit: alt,
    }) };
    lebensjahr(makeRng(`n${i}`), person, 24, 2028);
    const w = person.lebenslage.horizontWahrheit;
    // Auf Gleichheit der Werte zu prüfen ginge daneben: eine frische Wahrheit
    // darf zufällig dieselben tragen. Es geht darum, dass sie frisch ist.
    assert.notEqual(w, alt, 'die eingetretene Wahrheit steht noch herum');
    if (w) mitNeuer++;
  }
  assert.ok(mitNeuer > 20, `nur ${mitNeuer} von 200 mit neuer Wahrheit`);
});

test('echterHorizont nimmt die Wahrheit, wenn es eine gibt, sonst den Plan', () => {
  const ohne = lage({});
  assert.equal(echterHorizont(ohne), ohne.horizont);
  const l = mitWahrheit();
  assert.equal(echterHorizont(l), l.horizontWahrheit);
  assert.equal(echterHorizont(lage({ horizont: null })), null);
});

test('uebernimmWahrheit räumt auf, egal wer sie ruft', () => {
  const l = mitWahrheit();
  const w = uebernimmWahrheit(l);
  assert.equal(l.horizont, w);
  assert.equal(l.horizontWahrheit, null);
  assert.equal(w.wissbarAb, undefined);
});

test('eine gezogene Lebenslage überlebt vier Saisons ohne abgelaufenen Plan in der Akte', () => {
  for (let i = 0; i < 120; i++) {
    const person = ziehBindung(makeRng(`lang${i}`), 18 + (i % 40), 2026);
    for (let jahr = 2027; jahr < 2031; jahr++) {
      const ereignis = lebensjahr(makeRng(`lang${i}-${jahr}`), person, 18 + (i % 40) + (jahr - 2026), jahr);
      if (ereignis && ereignis.art === 'abgang') break;
      const h = person.lebenslage.horizont;
      assert.ok(!h || h.jahr > jahr, `${i}/${jahr}: der Plan liegt zurück`);
    }
  }
});

// --- Am Spielstand ---------------------------------------------------------

test('das Fragen kostet einen Termin, auch wenn nichts dabei herauskommt', () => {
  const s = neuesSpiel('heg', 'auskunft');
  const sp = s.kader[s.meinTeam][0];
  const vorher = gespraecheFrei(s);
  const auskunft = fuehreLebenslageGespraech(s, sp.id);
  assert.ok(auskunft, 'die Frage wurde gestellt');
  assert.equal(gespraecheFrei(s), vorher - 1);
});

test('im Stand hebt das Gespräch die Wahrheit in die Akte', () => {
  const s = neuesSpiel('heg', 'auskunft2');
  const sp = s.kader[s.meinTeam][0];
  const lebenslage = /** @type {Lebenslage} */ (sp.lebenslage);
  lebenslage.horizont = { jahr: s.jahr + 4, dann: 'bleibt', km: 0 };
  lebenslage.horizontWahrheit = { jahr: s.jahr + 4, dann: 'wegzug', km: 180, wissbarAb: s.jahr };

  const auskunft = fuehreLebenslageGespraech(s, sp.id);
  assert.equal(auskunft?.ton, 1);
  assert.equal(lebenslage.horizont.dann, 'wegzug');
  assert.equal(lebenslage.horizontWahrheit, null);
});

test('ohne Kontingent wird nicht gefragt', () => {
  const s = neuesSpiel('heg', 'auskunft3');
  const kader = s.kader[s.meinTeam];
  for (let i = 0; i < GESPRAECHE_JE_WOCHE; i++) fuehreLebenslageGespraech(s, kader[i].id);
  assert.equal(gespraecheFrei(s), 0);
  assert.equal(fuehreLebenslageGespraech(s, kader[10].id), null);
});

test('fragen mit einem, den es nicht gibt, kostet keinen Termin', () => {
  const s = neuesSpiel('heg', 'auskunft4');
  assert.equal(fuehreLebenslageGespraech(s, 'gibtsnicht'), null);
  assert.equal(s.gespraeche.length, 0);
});

test('ein Stand aus Version 16 hat neben seinen Plänen keine zweite Wahrheit', () => {
  const s = neuesSpiel('heg', 'auskunft5');
  const roh = JSON.parse(JSON.stringify(s));
  roh.version = 16;
  for (const team in roh.kader) {
    for (const sp of roh.kader[team]) if (sp.lebenslage) delete sp.lebenslage.horizontWahrheit;
  }
  const gehoben = migriere(roh);
  for (const sp of gehoben.kader[gehoben.meinTeam]) {
    assert.equal(sp.lebenslage?.horizontWahrheit, undefined, `${sp.id} hat ein Geheimnis bekommen`);
    assert.equal(frageNachLebenslage(sp, gehoben.jahr).ton, 0);
  }
});
