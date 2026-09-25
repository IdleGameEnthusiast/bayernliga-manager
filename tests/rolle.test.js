// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ROLLEN, ROLLEN_FRIST, rollenStufe, rolleVon, rollenlose, verbleibendeWochen,
  tempo, faellige,
  perzentil, erwarteteRolle, altersPassung, reaktion, darfAendern, wiederAb,
  setzeRolle, verbucheSpiel, einsatzAnteil, toleranzVon, mismatch, vernachlaessigung,
  drift, neueSaison,
} from '../engine/rolle.js';
import {
  GESPRAECHE_JE_WOCHE, ROLLE_FENSTER, ROLLE_FENSTER_MIN, ROLLE_COOLDOWN_TAGE,
  ROLLE_ERFUELLT_BONUS, ROLLE_BESCHWERDE_COOLDOWN, ROLLE_PERZENTIL_POSITION_ANTEIL,
  ROLLE_OHNE_JE_SPIEL,
} from '../engine/constants.js';
import { SPIELTAG_TAGE, wochenBeginn, woche } from '../engine/kalender.js';
import {
  neuesSpiel, weiter, gespraecheFrei, fuehreRollenGespraech, rollenGespraechMoeglich,
} from '../engine/saison.js';
import { offeneAntworten, antwortenZu } from '../engine/postfach.js';
import { beantworteNachricht } from '../engine/saison.js';

/**
 * Ein Spieler, so weit er für die Rolle zählt. Kein `macheSpieler()`: was hier
 * geprüft wird, hängt an Stärke, Alter und Position und an nichts sonst — und
 * ein Generator im Test macht aus einer klaren Annahme eine Ziehung.
 * @param {string} id @param {number} staerke @param {object} [rest]
 */
function mann(id, staerke, rest = {}) {
  return /** @type {any} */ ({
    id, vorname: 'V', nachname: id, position: 'WR', seite: null,
    einsaetze: {}, nummer: 80, alter: 24, staerke, talent: 5,
    commitment: 50, ...rest,
  });
}

// --- Die Stufen ------------------------------------------------------------

test('Perspektiv- und Ergänzungsspieler stehen auf derselben Stufe', () => {
  // Beide versprechen dieselbe knappe Einsatzzeit. Wer zwischen ihnen wechselt,
  // steigt nicht ab — der Unterschied fällt in der Altersrechnung an.
  assert.equal(rollenStufe('perspektive'), rollenStufe('ergaenzung'));
  assert.ok(rollenStufe('unangefochten') < rollenStufe('starter'));
  assert.ok(rollenStufe('starter') < rollenStufe('rotation'));
  assert.ok(rollenStufe('rotation') < rollenStufe('perspektive'));
});

test('ein Spieler ohne Feld hat keine Rolle', () => {
  assert.equal(rolleVon(mann('a', 60)), null);
  assert.equal(rolleVon(mann('a', 60, { rolle: 'starter' })), 'starter');
});

// --- Das Tempo der Kampagne ------------------------------------------------

test('die Frist liegt zwei Wochen vor dem ersten Spieltag und ist ein Wochenanfang', () => {
  assert.equal(ROLLEN_FRIST, SPIELTAG_TAGE[0] - 14);
  assert.ok(wochenBeginn(ROLLEN_FRIST),
    'an der Frist gehen keine Anfragen mehr raus, wenn sie kein Wochenanfang ist');
});

test('das Tempo reicht immer genau — kein Rest bleibt hinter der Frist liegen', () => {
  // Der Kern der Rechnung: aufgerundet durch die verbleibenden Wochen geteilt.
  // Simuliert wird eine Offseason, in der der Manager nie von selbst redet.
  for (const anzahl of [1, 7, 30, 45, 60]) {
    const kader = Array.from({ length: anzahl }, (_, i) => mann('p' + i, 50 + i));
    for (let tag = 1; tag <= ROLLEN_FRIST; tag += 7) {
      for (const sp of faellige(kader, tag)) sp.rolle = 'rotation';
    }
    assert.equal(rollenlose(kader).length, 0,
      `bei ${anzahl} Spielern bleibt jemand ohne Rolle`);
  }
});

test('wer „später" sagt, steht nächste Woche wieder drin — die Frist wächst nicht mit', () => {
  const kader = Array.from({ length: 10 }, (_, i) => mann('p' + i, 50 + i));
  const wochen = verbleibendeWochen(1);

  // Eine Woche lang niemanden bedienen: das Tempo der nächsten Woche steigt,
  // die Frist bleibt, wo sie war.
  assert.equal(faellige(kader, 1).length, tempo(kader, 1));
  assert.equal(verbleibendeWochen(8), wochen - 1);
  assert.ok(tempo(kader, 8) >= tempo(kader, 1));
});

test('nach der Frist fragt niemand mehr', () => {
  const kader = [mann('a', 60)];
  assert.equal(verbleibendeWochen(ROLLEN_FRIST + 7), 0);
  assert.equal(tempo(kader, ROLLEN_FRIST + 7), 0);
  assert.deepEqual(faellige(kader, ROLLEN_FRIST + 7), []);
});

test('gefragt wird von oben nach unten — und deterministisch', () => {
  const kader = [mann('schwach', 40), mann('stark', 80), mann('mittel', 60)];
  const zuerst = faellige(kader, ROLLEN_FRIST);  // letzte Woche: alle drei
  assert.deepEqual(zuerst.map((s) => s.id), ['stark', 'mittel', 'schwach']);
  assert.deepEqual(faellige(kader, ROLLEN_FRIST).map((s) => s.id), zuerst.map((s) => s.id));
});

test('wer schon eine Rolle hat, steht nicht in der Warteschlange', () => {
  const kader = [mann('a', 60, { rolle: 'starter' }), mann('b', 50)];
  assert.deepEqual(rollenlose(kader).map((s) => s.id), ['b']);
});

// --- Perzentil, Alter, Reaktion --------------------------------------------

test('das Perzentil misst vor allem an der eigenen Position', () => {
  const kader = [
    mann('qb1', 70, { position: 'QB' }),
    mann('qb2', 40, { position: 'QB' }),
    mann('wr1', 90), mann('wr2', 85), mann('wr3', 80),
  ];
  // Der bessere von zwei Quarterbacks steht höher als der dritte Receiver,
  // obwohl der stärker ist als er: ob einer spielt, entscheidet sich gegen die
  // Konkurrenz auf seinem Platz und nicht gegen die ganze Mannschaft.
  assert.ok(perzentil(kader, kader[0]) > perzentil(kader, kader[4]));
  assert.equal(erwarteteRolle(kader, kader[0]), 'starter');
  // Der beste Receiver ist beides — konkurrenzlos auf dem Platz und der
  // Stärkste im Kader —, und steht damit über dem Quarterback.
  assert.equal(erwarteteRolle(kader, kader[2]), 'unangefochten');
});

test('konkurrenzlos allein reicht nicht für die oberste Rolle', () => {
  // Der kaderweite Anteil ist genau dafür da: sonst wäre der beste von drei
  // schlechten Kickern ein unangefochtener Stammspieler.
  const schwach = [mann('allein', 30, { position: 'QB' }), mann('wr', 90)];
  assert.equal(perzentil(schwach, schwach[0]), ROLLE_PERZENTIL_POSITION_ANTEIL,
    'an seiner Position ist er die 1, kaderweit die 0');
  assert.notEqual(erwarteteRolle(schwach, schwach[0]), 'unangefochten');

  // Wer beides ist — konkurrenzlos und der Beste im Kader —, bekommt sie.
  const stark = [mann('allein', 90, { position: 'QB' }), mann('wr', 30)];
  assert.equal(erwarteteRolle(stark, stark[0]), 'unangefochten');
});

test('das Alter entscheidet zwischen Perspektive und Ergänzung', () => {
  assert.ok(altersPassung('perspektive', 19) > 0, 'ein Rookie hat Perspektive');
  assert.ok(altersPassung('perspektive', 40) < 0, 'ein 40-Jähriger nicht mehr');
  assert.ok(altersPassung('ergaenzung', 36) > 0, 'der Alte nickt');
  assert.ok(altersPassung('ergaenzung', 19) < 0, 'der Junge hört: aufgegeben');
  // Und für alles andere sagt das Alter nichts.
  for (const rolle of ['unangefochten', 'starter', 'rotation']) {
    assert.equal(altersPassung(/** @type {any} */ (rolle), 19), 0);
    assert.equal(altersPassung(/** @type {any} */ (rolle), 45), 0);
  }
});

test('mehr zugesagt als erwartet freut, weniger kränkt', () => {
  const kader = [mann('a', 90), mann('b', 60), mann('c', 30)];
  const hoch = reaktion(kader, kader[1], 'unangefochten');
  const tief = reaktion(kader, kader[1], 'ergaenzung');
  assert.ok(hoch.delta > 0);
  assert.ok(tief.delta < 0);
  assert.ok(hoch.ton > tief.ton);
});

test('ein Downgrade wiegt schwerer als dieselbe Rolle ohne Vorgeschichte', () => {
  const kader = [mann('a', 90), mann('b', 60), mann('c', 30)];
  const ohne = reaktion(kader, kader[1], 'rotation');
  const abstieg = reaktion(kader, mann('b', 60, { rolle: 'unangefochten' }), 'rotation');
  assert.ok(abstieg.delta < ohne.delta, 'Verlustaversion fehlt');
});

test('Setzen ist billiger als Verfehlen-lassen', () => {
  // Der Kernpunkt des Bausteins, als Zahl: ein junger Reservist, dem der
  // Manager „Perspektivspieler" sagt, kostet **einmal** weniger, als wenn
  // seine Starter-Rolle stehen bleibt und er zusieht — schon innerhalb des
  // Fensters, aus dem der Mismatch überhaupt gerechnet wird.
  const kader = [mann('a', 90), mann('b', 60), mann('c', 30)];
  const ehrlich = Math.abs(reaktion(kader, mann('c', 30, { rolle: 'starter' }), 'perspektive').delta);

  const stur = mann('c', 30, { rolle: 'starter', commitment: 50 });
  for (let i = 0; i < ROLLE_FENSTER; i++) verbucheSpiel(stur, false);
  const jeSpiel = Math.abs(/** @type {any} */ (drift(stur, 100)).delta);

  assert.ok(jeSpiel * ROLLE_FENSTER_MIN > ehrlich,
    `der laufende Abzug (${jeSpiel} je Spiel) muss teurer sein als das `
    + `einmalige Gespräch (${ehrlich})`);

  // Das falsche Etikett ist die Ausnahme, und zwar eine gewollte: demselben
  // 24-Jährigen „Ergänzungsspieler" zu sagen, kostet mehr als die ehrliche
  // Ansage — nicht, weil das Downgrade teurer wäre, sondern weil das Wort
  // nicht zu ihm passt. Genau dafür ist die Altersrechnung da.
  const falsch = Math.abs(reaktion(kader, mann('c', 30, { rolle: 'starter' }), 'ergaenzung').delta);
  assert.ok(falsch > ehrlich, 'das unpassende Etikett muss teurer sein');
});

// --- Cooldown --------------------------------------------------------------

test('die erste Rolle geht immer, die zweite erst nach dem Cooldown', () => {
  const kader = [mann('a', 60)];
  assert.ok(darfAendern(kader[0], 10), 'ohne Rolle darf immer gesetzt werden');

  setzeRolle(kader, kader[0], 'starter', 10);
  assert.equal(kader[0].letzteRollenAenderung, 10);
  assert.equal(darfAendern(kader[0], 10 + ROLLE_COOLDOWN_TAGE - 1), false);
  assert.equal(darfAendern(kader[0], 10 + ROLLE_COOLDOWN_TAGE), true);
  assert.equal(wiederAb(kader[0]), 10 + ROLLE_COOLDOWN_TAGE);
});

test('der Saisonwechsel nimmt die Tagesmerker weg, nicht die Rolle', () => {
  const sp = mann('a', 60, { rolle: 'starter', letzteRollenAenderung: 300, rolleBeschwerde: 290 });
  verbucheSpiel(sp, true);
  neueSaison(sp);
  assert.equal(sp.rolle, 'starter', 'die Rolle überlebt den Jahreswechsel');
  assert.equal(sp.letzteRollenAenderung, null);
  assert.equal(sp.rolleBeschwerde, null);
  assert.deepEqual(sp.einsatzFenster, [1], 'die letzten Spiele bleiben die letzten Spiele');
  // Ohne das Zurücksetzen liefe der Cooldown rückwärts: Tag 300 gegen Tag 5.
  assert.equal(darfAendern(sp, 5), true);
});

// --- Das Fenster und der Drift ---------------------------------------------

test('das Fenster hält nur die letzten Spiele', () => {
  const sp = mann('a', 60);
  for (let i = 0; i < ROLLE_FENSTER + 3; i++) verbucheSpiel(sp, i % 2 === 0);
  assert.equal(/** @type {any[]} */ (sp.einsatzFenster).length, ROLLE_FENSTER);
});

test('unter der Mindestzahl wird nicht gerechnet', () => {
  const sp = mann('a', 60, { rolle: 'starter' });
  for (let i = 0; i < ROLLE_FENSTER_MIN - 1; i++) verbucheSpiel(sp, false);
  assert.equal(einsatzAnteil(sp), null);
  assert.equal(mismatch(sp), null, 'zwei Spiele sind noch keine Geschichte');
  assert.equal(drift(sp, 100), null);
});

test('ohne Rolle kostet die Bank — wer spielt, verliert nichts', () => {
  // Hier stand einmal „ohne gesetzte Rolle gibt es keinen Drift". Das galt,
  // solange es keinen Weg gab, eine Rolle zu setzen. Jetzt fragt die Kampagne
  // bis zur Frist jeden mehrfach, und wer danach ohne Rolle dasteht, ist
  // übergangen worden.
  const sitzt = mann('a', 60, { commitment: 50 });
  for (let i = 0; i < ROLLE_FENSTER; i++) verbucheSpiel(sitzt, false);
  assert.equal(mismatch(sitzt), null, 'ohne Zusage gibt es nichts zu verfehlen');
  assert.equal(vernachlaessigung(sitzt), 1);
  assert.equal(/** @type {any} */ (drift(sitzt, 100)).delta, -ROLLE_OHNE_JE_SPIEL);
  assert.ok(sitzt.commitment < 50);

  // Wer jedes Spiel macht, weiß auch ohne Gespräch, woran er ist.
  const spielt = mann('b', 60, { commitment: 50 });
  for (let i = 0; i < ROLLE_FENSTER; i++) verbucheSpiel(spielt, true);
  assert.equal(vernachlaessigung(spielt), 0);
  assert.equal(/** @type {any} */ (drift(spielt, 100)).delta, 0);
  assert.equal(spielt.commitment, 50);

  // Und dazwischen skaliert es.
  const halb = mann('c', 60, { commitment: 50 });
  for (const gespielt of [true, false, true, false]) verbucheSpiel(halb, gespielt);
  assert.equal(vernachlaessigung(halb), 0.5);
  assert.equal(/** @type {any} */ (drift(halb, 100)).delta, -ROLLE_OHNE_JE_SPIEL / 2);
});

test('eine passende Rolle ist besser als gar keine — auch auf der Bank', () => {
  // Die Anforderung, um die es beim Nachmessen ging: eine Rolle zu vergeben
  // soll sich lohnen, solange sie nicht völlig neben der Sache liegt. Geprüft
  // über ein Fenster voller Spiele, die er nicht bestritten hat.
  const bank = (/** @type {any} */ rolle) => {
    const sp = mann('x', 30, { rolle, alter: 33, commitment: 50 });
    for (let i = 0; i < ROLLE_FENSTER; i++) verbucheSpiel(sp, false);
    return /** @type {any} */ (drift(sp, 100)).delta;
  };
  assert.ok(bank('ergaenzung') > bank(null), 'die passende Rolle muss sich lohnen');
  assert.ok(bank(null) > bank('unangefochten'), 'die absurde Zusage muss teurer sein als Schweigen');
});

test('ohne genug Spiele im Fenster wird auch die Vernachlässigung nicht gerechnet', () => {
  const sp = mann('a', 60, { commitment: 50 });
  for (let i = 0; i < ROLLE_FENSTER_MIN - 1; i++) verbucheSpiel(sp, false);
  assert.equal(vernachlaessigung(sp), null);
  assert.equal(drift(sp, 100), null);
  assert.equal(sp.commitment, 50);
});

test('die Toleranz skaliert nach Coaching-Gruppe', () => {
  const qb = mann('qb', 60, { position: 'QB' });
  const dl = mann('dl', 60, { position: 'DT' });
  assert.ok(toleranzVon(dl) > toleranzVon(qb),
    'eine DL-Rotation ist normal, ein Starter-QB erwartet jeden Snap');
});

test('wer die Rolle erfüllt, gewinnt — wer sie verfehlt, verliert', () => {
  const spielt = mann('a', 60, { rolle: 'starter', commitment: 50 });
  for (let i = 0; i < ROLLE_FENSTER; i++) verbucheSpiel(spielt, true);
  const gut = drift(spielt, 100);
  assert.equal(/** @type {any} */ (gut).delta, ROLLE_ERFUELLT_BONUS);
  assert.ok(spielt.commitment > 50);

  const sitzt = mann('b', 60, { rolle: 'starter', commitment: 50 });
  for (let i = 0; i < ROLLE_FENSTER; i++) verbucheSpiel(sitzt, false);
  const schlecht = drift(sitzt, 100);
  assert.ok(/** @type {any} */ (schlecht).delta < 0);
  assert.ok(sitzt.commitment < 50);
});

test('ein Ergänzungsspieler auf der Bank ist zufrieden, ein Stammspieler nicht', () => {
  const machen = (/** @type {string} */ rolle) => {
    const sp = mann('x', 60, { rolle, commitment: 50 });
    for (let i = 0; i < ROLLE_FENSTER; i++) verbucheSpiel(sp, false);
    return sp;
  };
  assert.equal(mismatch(machen('ergaenzung')), 0, 'er erwartet ja nichts anderes');
  assert.ok(/** @type {number} */ (mismatch(machen('unangefochten'))) > 0);
});

test('die Beschwerde kommt einmal und dann eine Weile nicht wieder', () => {
  const sp = mann('a', 60, { rolle: 'unangefochten', commitment: 90 });
  for (let i = 0; i < ROLLE_FENSTER; i++) verbucheSpiel(sp, false);

  assert.equal(/** @type {any} */ (drift(sp, 100)).beschwerde, true);
  verbucheSpiel(sp, false);
  assert.equal(/** @type {any} */ (drift(sp, 107)).beschwerde, false, 'eine Woche später schweigt er');
  verbucheSpiel(sp, false);
  assert.equal(/** @type {any} */ (drift(sp, 100 + ROLLE_BESCHWERDE_COOLDOWN)).beschwerde, true);
});

test('ein neues Rollengespräch nimmt die Beschwerde zurück', () => {
  const kader = [mann('a', 60, { rolle: 'starter', rolleBeschwerde: 100 })];
  setzeRolle(kader, kader[0], 'ergaenzung', 120);
  assert.equal(kader[0].rolleBeschwerde, null, 'worüber geredet wurde, ist besprochen');
});

// --- Im Spiel --------------------------------------------------------------

/**
 * Die Frage nach der Werbung beantworten, die mit dem Amtsantritt kommt. Sie
 * ist die einzige Antwortpflicht an Tag 1 und hat mit den Rollen nichts zu
 * tun — die Tests darunter sollen beim ersten Wochenanfang ankommen.
 * @param {any} s
 */
function werbungBeschliessen(s) {
  for (const n of offeneAntworten(s)) {
    if (n.art === 'tryoutWerbung') beantworteNachricht(s, n.id, 'festlegen');
  }
}

test('eine frische Karriere fängt ohne Rollen an und bekommt die Erinnerung', () => {
  const s = neuesSpiel('heg', 'rollen');
  assert.equal(rollenlose(s.kader[s.meinTeam]).length, s.kader[s.meinTeam].length);
  assert.ok(s.post.some((n) => n.art === 'rollenerinnerung'));
  // An Tag 1 fragt noch niemand einzeln: der Vorstand spricht, und der Kader
  // ist noch nicht einmal angesehen. Was hält, ist allein die Werbung fürs
  // erste Tryout.
  assert.deepEqual(offeneAntworten(s).map((n) => n.art), ['tryoutWerbung']);
  assert.deepEqual(s.gespraeche, []);
});

test('ab der zweiten Woche hält jede Anfrage den Kalender an', () => {
  const s = neuesSpiel('heg', 'anfragen');
  werbungBeschliessen(s);
  const f = weiter(s, 200);
  assert.equal(f.grund, 'antwort');
  assert.equal(s.tag, 8);

  const offen = offeneAntworten(s);
  assert.ok(offen.length > 0);
  assert.ok(offen.every((n) => n.art === 'rollenanfrage'));
  assert.deepEqual(antwortenZu('rollenanfrage'), ['gespraech', 'spaeter']);

  // „Später" beantwortet die Nachricht und lässt die Uhr weiterlaufen — der
  // Mann steht aber weiter in der Warteschlange.
  const id = offen[0].daten.spielerId;
  for (const n of offen) beantworteNachricht(s, n.id, 'spaeter');
  assert.equal(offeneAntworten(s).length, 0);
  assert.equal(rolleVon(s.kader[s.meinTeam].find((x) => x.id === id)), null);
  assert.ok(faellige(s.kader[s.meinTeam], 15).some((x) => x.id === id));
});

test('ein Gespräch setzt die Rolle, verbucht den Termin und beantwortet die Anfrage', () => {
  const s = neuesSpiel('heg', 'gespraech');
  werbungBeschliessen(s);
  weiter(s, 200);
  const anfrage = offeneAntworten(s)[0];
  const id = anfrage.daten.spielerId;

  assert.equal(gespraecheFrei(s), GESPRAECHE_JE_WOCHE);
  const r = fuehreRollenGespraech(s, id, 'starter');
  assert.ok(r, 'das Gespräch ist nicht zustande gekommen');
  assert.equal(rolleVon(s.kader[s.meinTeam].find((x) => x.id === id)), 'starter');
  assert.equal(gespraecheFrei(s), GESPRAECHE_JE_WOCHE - 1);
  assert.equal(anfrage.antwort, 'gespraech', 'die offene Anfrage steht noch im Weg');
});

test('das Kontingent ist die Grenze, und der Cooldown die zweite', () => {
  const s = neuesSpiel('heg', 'grenze');
  werbungBeschliessen(s);
  weiter(s, 200);
  for (const n of offeneAntworten(s)) beantworteNachricht(s, n.id, 'spaeter');

  const kader = s.kader[s.meinTeam];
  for (let i = 0; i < GESPRAECHE_JE_WOCHE; i++) {
    assert.ok(fuehreRollenGespraech(s, kader[i].id, 'rotation'), `Gespräch ${i + 1}`);
  }
  assert.equal(gespraecheFrei(s), 0);
  assert.equal(fuehreRollenGespraech(s, kader[GESPRAECHE_JE_WOCHE].id, 'rotation'), null);
  assert.equal(rollenGespraechMoeglich(s, kader[GESPRAECHE_JE_WOCHE].id).moeglich, false);

  // Nächste Woche wieder — aber nicht noch einmal mit demselben Mann.
  s.tag += 7;
  assert.equal(gespraecheFrei(s), GESPRAECHE_JE_WOCHE);
  assert.equal(fuehreRollenGespraech(s, kader[0].id, 'starter'), null,
    'der Cooldown auf der Rolle steht noch');
});

test('eine unbekannte Rolle wird abgelehnt statt gespeichert', () => {
  const s = neuesSpiel('heg', 'unfug');
  const id = s.kader[s.meinTeam][0].id;
  assert.equal(fuehreRollenGespraech(s, id, /** @type {any} */ ('kapitaen')), null);
  assert.equal(rolleVon(s.kader[s.meinTeam][0]), null);
  assert.equal(s.gespraeche.length, 0);
});

test('die fünf Rollen sind vollständig und in einer Richtung geordnet', () => {
  assert.equal(ROLLEN.length, 5);
  assert.deepEqual([...ROLLEN].map(rollenStufe), [0, 1, 2, 3, 3]);
});
