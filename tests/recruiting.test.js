// @ts-check
/**
 * Die Rekrutierung: Termine, Zulauf, Kandidaten, Gespräche, Zusagen, das
 * Sicherheitsnetz, das Rookie-Training — und die Abgänge am Saisonende, die
 * der Grund dafür sind, dass es das alles braucht.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  KADER_MINIMUM, TRYOUT_GESPRAECHE, TRYOUT_BEDENKZEIT, TRYOUT_VORLAUF, TRYOUT_SOCKEL,
  ROOKIE_TRAINING_WOCHEN, ABGANG_GESPRAECH_BONUS, makeRng,
} from '../engine/constants.js';
import { TEAMS } from '../engine/content.js';
import { tryoutTage, saisonLaenge, datum, SPIELTAG_TAGE, wochenBeginn } from '../engine/kalender.js';
import {
  neuesSpiel, weiter, beantworteNachricht, naechsteSaison, meister, abgangsVorschau,
} from '../engine/saison.js';
import { offeneAntworten, antwortenZu } from '../engine/postfach.js';
import {
  recruitingVon, tryoutAmTag, erinnerungFuer, erinnerungAmTag, vereinsFaktor, zulauf,
  MASSNAHMEN, ATHLETIK, setzeWerbung, werbungOffen, ligaSchnitt, ziehKandidat, ziehInteresse,
  richteTryoutAus, sprichKandidat, schliesseTryout, tryoutGespraecheFrei, prognosen,
  entscheide, setzeRookiePosition, uebernimmNeue, rookieTraining, wertAufPosition,
  koerperPassung, interesseStufe,
} from '../engine/recruiting.js';

/**
 * Alles beantworten, was hält. Beim Tryout redet der Manager mit den fünf,
 * die am meisten wollen — das ist der Weg, auf den die Zahlen kalibriert sind.
 * @param {any} s @param {(a: string[]) => string} [wahl]
 */
function raeume(s, wahl = (a) => a[0]) {
  for (const n of offeneAntworten(s)) {
    if (n.art === 'tryout') {
      const t = recruitingVon(s).tryout;
      if (t) {
        const gierig = [...t.kandidaten].sort((a, b) => b.interesse - a.interesse);
        for (const k of gierig.slice(0, TRYOUT_GESPRAECHE)) sprichKandidat(s, k.id);
      }
    }
    beantworteNachricht(s, n.id, wahl(antwortenZu(n.art)));
  }
}

/** Bis `tag` spielen, alles unterwegs beantworten. @param {any} s @param {number} tag */
function bisTag(s, tag, wahl = (/** @type {string[]} */ a) => a[0]) {
  for (let i = 0; i < 400 && s.tag < tag; i++) {
    raeume(s, wahl);
    weiter(s, tag);
  }
  assert.equal(s.tag, tag, `Tag ${tag} ist nicht erreicht worden`);
}

// --- Termine -----------------------------------------------------------------

test('die Tryouts liegen auf dem ersten Samstag im November und im April', () => {
  for (let jahr = 2026; jahr <= 2126; jahr++) {
    const t = tryoutTage(jahr);
    const nov = datum(jahr, t.herbst);
    const apr = datum(jahr, t.fruehling);
    assert.deepEqual([nov.m, nov.wochentag], [11, 0], `${jahr}: Herbst`);
    assert.ok(nov.t <= 7, `${jahr}: nicht der erste Samstag im November`);
    assert.deepEqual([apr.m, apr.wochentag], [4, 0], `${jahr}: Frühling`);
    assert.ok(apr.t <= 7, `${jahr}: nicht der erste Samstag im April`);
    assert.ok([15, 22].includes(t.herbst), `${jahr}: Herbst an Tag ${t.herbst}`);
    // Fast immer 24 Wochen nach dem Start, viermal im Jahrhundert eine mehr —
    // und in beiden Fällen vor dem ersten Spieltag.
    assert.ok([169, 176].includes(t.fruehling), `${jahr}: Frühling an Tag ${t.fruehling}`);
    assert.ok(t.fruehling < SPIELTAG_TAGE[0], `${jahr}: der April liegt hinter Spieltag 1`);
    for (const tag of [t.herbst, t.fruehling]) {
      assert.ok(!SPIELTAG_TAGE.includes(tag), `${jahr}: Tryout auf einem Spieltag`);
    }
    assert.equal(tryoutAmTag(jahr, t.herbst), 'herbst');
    assert.equal(tryoutAmTag(jahr, t.fruehling), 'fruehling');
  }
});

test('die Frage nach der Werbung kommt einen Monat vorher — beim November im Vorjahr', () => {
  for (let jahr = 2027; jahr <= 2040; jahr++) {
    const t = tryoutTage(jahr);
    assert.deepEqual(erinnerungFuer(jahr, t.fruehling), { jahr, tag: t.fruehling - TRYOUT_VORLAUF });
    const herbst = erinnerungFuer(jahr, t.herbst);
    assert.equal(herbst.jahr, jahr - 1, 'der November erinnert in der alten Saison');
    // Genau dreißig Tage bis zum Tryout, über die Jahresgrenze gezählt.
    assert.equal(saisonLaenge(jahr - 1) - herbst.tag + t.herbst, TRYOUT_VORLAUF);
    assert.ok(herbst.tag > SPIELTAG_TAGE[SPIELTAG_TAGE.length - 1], 'erst nach dem Finale');
    assert.deepEqual(erinnerungAmTag(herbst.jahr, herbst.tag), { jahr, tag: t.herbst, art: 'herbst' });
    assert.deepEqual(erinnerungAmTag(jahr, t.fruehling - TRYOUT_VORLAUF),
      { jahr, tag: t.fruehling, art: 'fruehling' });
  }
});

test('der Amtsantritt bringt die Frage fürs erste Tryout, mit weniger Vorlauf', () => {
  const s = neuesSpiel('heg', 'antritt');
  const offen = offeneAntworten(s);
  assert.deepEqual(offen.map((n) => n.art), ['tryoutWerbung']);
  assert.equal(offen[0].tag, 1);
  assert.deepEqual(offen[0].daten, { jahr: s.jahr, tag: tryoutTage(s.jahr).herbst, art: 'herbst' });
  assert.deepEqual(recruitingVon(s).werbung?.massnahmen, MASSNAHMEN, 'alle Maßnahmen vorgeschlagen');
});

// --- Zulauf und Werbung -------------------------------------------------------

test('der Zulauf: Sockel, Verein, Werbung', () => {
  const faktoren = TEAMS.map((t) => vereinsFaktor(t.id));
  assert.equal(Math.min(...faktoren), 0.4);
  assert.equal(Math.max(...faktoren), 1);
  assert.equal(zulauf('heg', []), TRYOUT_SOCKEL, 'ohne Werbung nur der Sockel');
  assert.equal(zulauf('pp', []), TRYOUT_SOCKEL, 'der Sockel hängt an nichts');
  assert.equal(zulauf('heg', MASSNAHMEN), 15, 'der stärkste Verein mit allem');
  assert.equal(zulauf('pp', MASSNAHMEN), 9, 'der schwächste mit allem');
  assert.equal(zulauf('heg', ['hochschulinfotag']), 8);
});

test('die Werbung lässt sich ändern, bis sie beschlossen ist', () => {
  const s = neuesSpiel('heg', 'werbung');
  assert.ok(werbungOffen(s));
  assert.ok(setzeWerbung(s, 'radio', false));
  assert.ok(setzeWerbung(s, 'hochschulinfotag', false));
  assert.ok(setzeWerbung(s, 'hochschulinfotag', true));
  assert.deepEqual(recruitingVon(s).werbung?.massnahmen, MASSNAHMEN.filter((m) => m !== 'radio'),
    'in der Reihenfolge des Angebots, nicht der Klicks');
  assert.equal(setzeWerbung(s, 'gibtsnicht', true), false);

  const werbung = offeneAntworten(s)[0];
  beantworteNachricht(s, werbung.id, 'festlegen');
  assert.equal(werbungOffen(s), false);
  assert.equal(setzeWerbung(s, 'radio', true), false, 'nach dem Beschluss ändert sich nichts');

  // Am Tryout-Tag kommen so viele, wie die beschlossene Werbung bringt.
  bisTag(s, tryoutTage(s.jahr).herbst);
  const tryout = recruitingVon(s).tryout;
  assert.ok(tryout);
  assert.equal(tryout.kandidaten.length, zulauf('heg', MASSNAHMEN.filter((m) => m !== 'radio')));
});

// --- Die Kandidaten -----------------------------------------------------------

test('ein Kanal bringt seine Leute: die Hochschule Studenten, die Schule Schüler', () => {
  const rng = makeRng('kanaele');
  const belegteNamen = new Set();
  for (const [herkunft, status] of [['hochschulinfotag', 'student'], ['schule', 'schueler']]) {
    for (let i = 0; i < 40; i++) {
      const k = ziehKandidat(rng, {
        id: `k${i}`, basis: 50, herkunft, jahr: 2026, uniKm: 12, belegteNamen,
      });
      assert.equal(k.lebenslage.status, status, herkunft);
      assert.equal(k.lebenslage.seit, 2026, 'neu im Verein');
      assert.ok(!('position' in k), 'ein Kandidat hat noch keine Position');
      assert.ok(k.attribute.technik <= 6, `Technik ${k.attribute.technik}`);
      assert.ok(k.alter >= 18 && k.alter <= 25, `${status} mit ${k.alter}`);
    }
  }
});

test('ein Kandidat ist roh: Athletik ganz, Handwerk halb', () => {
  const rng = makeRng('roh');
  const belegteNamen = new Set();
  let athletik = 0;
  let handwerk = 0;
  let n = 0;
  for (let i = 0; i < 200; i++) {
    const k = ziehKandidat(rng, {
      id: `r${i}`, basis: 50, herkunft: 'plakate', jahr: 2026, uniKm: 0, belegteNamen,
    });
    athletik += (k.attribute.ausdauer + k.attribute.robustheit) / 2 / k.ziel;
    handwerk += (k.attribute.fangen + k.attribute.blocken + k.attribute.tacklen) / 3 / k.ziel;
    n++;
  }
  assert.ok(athletik / n > 0.9 && athletik / n < 1.1, `Athletik ${(athletik / n).toFixed(2)}`);
  assert.ok(handwerk / n > 0.4 && handwerk / n < 0.65, `Handwerk ${(handwerk / n).toFixed(2)}`);
});

test('die Prognose folgt dem Körper: der Schwere in die Line, der Leichte nach außen', () => {
  const rng = makeRng('koerper');
  const belegteNamen = new Set();
  const LINE = ['T', 'G', 'C', 'DE', 'DT', 'NT'];
  let schwerInLine = 0, schwer = 0, leichtInLine = 0, leicht = 0;
  for (let i = 0; i < 400; i++) {
    const k = ziehKandidat(rng, {
      id: `p${i}`, basis: 50, herkunft: 'plakate', jahr: 2026, uniKm: 0, belegteNamen,
    });
    const beste = prognosen(k)[0].position;
    if (k.gewicht >= 120) { schwer++; if (LINE.includes(beste)) schwerInLine++; }
    if (k.gewicht <= 85) { leicht++; if (LINE.includes(beste)) leichtInLine++; }
  }
  assert.ok(schwer > 20 && leicht > 20, `${schwer} schwere, ${leicht} leichte`);
  assert.ok(schwerInLine / schwer > 0.9, `nur ${schwerInLine} von ${schwer} Schweren in der Line`);
  assert.equal(leichtInLine, 0, `${leichtInLine} Leichte in der Line`);
  assert.equal(koerperPassung('T', 188, 130), 1, 'im Korridor kein Abschlag');
  assert.ok(koerperPassung('T', 178, 82) < 0.9, 'ein Leichtgewicht als Tackle kostet');
});

test('das Interesse: im Herbst breit, im Frühling fast nur bei ein paar Studenten', () => {
  const rng = makeRng('interesse');
  const herbst = Array.from({ length: 4000 }, () => ziehInteresse(rng, 'herbst', 'arbeiter'));
  const mittel = herbst.reduce((a, b) => a + b, 0) / herbst.length;
  assert.ok(mittel > 28 && mittel < 34, `Herbst Ø ${mittel.toFixed(1)}`);

  const arbeiter = Array.from({ length: 2000 }, () => ziehInteresse(rng, 'fruehling', 'arbeiter'));
  assert.ok(arbeiter.every((x) => x < 40), 'ein Arbeiter will im Frühling nie wirklich');
  const studenten = Array.from({ length: 4000 }, () => ziehInteresse(rng, 'fruehling', 'student'));
  const heiss = studenten.filter((x) => x >= 30).length / studenten.length;
  assert.ok(heiss > 0.07 && heiss < 0.13, `${(heiss * 100).toFixed(1)} % heiße Studenten`);
});

test('die Zusagen treffen die Kalibrierung: Herbst Ø 6, Frühling Ø 3', () => {
  const s = neuesSpiel('heg', 'kalibrierung');
  /** @param {'herbst'|'fruehling'} art */
  const schnitt = (art) => {
    let summe = 0;
    const n = 600;
    for (let i = 0; i < n; i++) {
      s.seed = `kalibrierung-${art}-${i}`;
      const t = richteTryoutAus(s, art === 'herbst' ? 15 : 169, art);
      const gierig = [...t.kandidaten].sort((a, b) => b.interesse - a.interesse);
      for (const k of gierig.slice(0, TRYOUT_GESPRAECHE)) sprichKandidat(s, k.id);
      summe += t.kandidaten.reduce((a, k) => a + k.interesse / 100, 0);
    }
    return summe / n;
  };
  const herbst = schnitt('herbst');
  const fruehling = schnitt('fruehling');
  assert.ok(herbst > 5.4 && herbst < 6.3, `Herbst Ø ${herbst.toFixed(2)}`);
  assert.ok(fruehling > 2.7 && fruehling < 3.5, `Frühling Ø ${fruehling.toFixed(2)}`);
});

// --- Gespräche am Tryout -------------------------------------------------------

test('ein Gespräch halbiert den Abstand zum Ja — fünfmal, und nur solange der Platz offen ist', () => {
  const s = neuesSpiel('heg', 'gespraeche');
  const t = richteTryoutAus(s, 15, 'herbst');
  const k = t.kandidaten[0];
  const vorher = k.interesse;
  assert.deepEqual(sprichKandidat(s, k.id), { vorher, nachher: Math.round(vorher + (100 - vorher) / 2) });
  assert.equal(sprichKandidat(s, k.id), null, 'zweimal mit demselben');
  for (const x of t.kandidaten.slice(1, TRYOUT_GESPRAECHE)) assert.ok(sprichKandidat(s, x.id));
  assert.equal(tryoutGespraecheFrei(t), 0);
  assert.equal(sprichKandidat(s, t.kandidaten[TRYOUT_GESPRAECHE].id), null, 'das sechste');

  const u = richteTryoutAus(s, 15, 'herbst');
  schliesseTryout(s);
  assert.equal(sprichKandidat(s, u.kandidaten[0].id), null, 'nach dem Tryout');
  assert.equal(interesseStufe(100), 4);
  assert.equal(interesseStufe(0), 0);
});

// --- Zusagen, Sicherheitsnetz, Rookie-Training ---------------------------------

test('wer zusagt, wartet auf seine Position und kommt dann mit Nummer in den Kader', () => {
  const s = neuesSpiel('heg', 'zusagen');
  const t = richteTryoutAus(s, 15, 'herbst');
  for (const k of t.kandidaten) k.interesse = 100;
  schliesseTryout(s);
  const ergebnis = entscheide(s, 15 + TRYOUT_BEDENKZEIT);
  assert.equal(ergebnis?.zusagen, t.kandidaten.length);
  assert.deepEqual(ergebnis?.nachgerueckt, []);
  const neue = recruitingVon(s).neue;
  assert.equal(neue.length, t.kandidaten.length);
  assert.equal(recruitingVon(s).tryout, null);

  const sp = neue[0];
  assert.equal(sp.position, prognosen({ ...sp, ziel: /** @type {number} */ (sp.rookieZiel) })[0].position,
    'vorgeschlagen ist die beste Prognose');
  assert.ok(setzeRookiePosition(s, sp.id, 'T'));
  assert.equal(sp.position, 'T');
  assert.ok(sp.seite === 'L' || sp.seite === 'R', 'ein Tackle hat eine Seite');
  assert.equal(sp.staerke, wertAufPosition(sp.attribute, 'T'));
  assert.equal(setzeRookiePosition(s, sp.id, 'K'), false, 'keine Position aus dem Nichts');

  const vorher = s.kader.heg.length;
  uebernimmNeue(s, 18);
  assert.equal(s.kader.heg.length, vorher + neue.length);
  assert.equal(recruitingVon(s).neue.length, 0);
  const nummern = s.kader.heg.map((x) => x.nummer);
  assert.ok(nummern.every((x) => x >= 0), 'jeder hat eine Nummer');
  assert.equal(new Set(nummern).size, nummern.length, 'keine doppelt');
  assert.ok(neue.every((x) => x.rookieTrainingBis === 18 + ROOKIE_TRAINING_WOCHEN * 7));
  assert.ok(neue.every((x) => typeof x.commitment === 'number' && x.lebenslage));
});

test('das Sicherheitsnetz füllt auf 30 auf — nur mit Leuten unter dem Ligaschnitt', () => {
  const s = neuesSpiel('heg', 'netz');
  s.kader.heg = s.kader.heg.slice(0, 12);
  const t = richteTryoutAus(s, 15, 'herbst');
  for (const k of t.kandidaten) k.interesse = 0;
  schliesseTryout(s);
  const liga = ligaSchnitt(s);
  const ergebnis = entscheide(s, 18);
  const neue = recruitingVon(s).neue;
  assert.equal(ergebnis?.zusagen, 0);
  assert.equal(12 + neue.length, KADER_MINIMUM);
  for (const sp of neue) {
    assert.ok(/** @type {number} */ (sp.rookieZiel) < liga.staerke, `${sp.id}: Stärke ${sp.rookieZiel}`);
    assert.ok(sp.talent < liga.talent, `${sp.id}: Talent ${sp.talent}`);
  }
  // Aus dem Pool können nicht achtzehn kommen — also gibt es auch frisch
  // gezogene, und die tragen ihre eigene Kennung.
  assert.ok(neue.some((sp) => sp.id.includes('-n')));
  assert.deepEqual(ergebnis?.nachgerueckt, neue.map((sp) => sp.id));
});

test('das Rookie-Training hält, was die Prognose verspricht', () => {
  const s = neuesSpiel('heg', 'training');
  const t = richteTryoutAus(s, 15, 'herbst');
  for (const k of t.kandidaten) k.interesse = 100;
  schliesseTryout(s);
  entscheide(s, 18);
  const neue = [...recruitingVon(s).neue];
  const versprochen = new Map(neue.map((sp) => [sp.id,
    prognosen({ ...sp, ziel: /** @type {number} */ (sp.rookieZiel) })
      .find((p) => p.position === sp.position)?.wert]));
  uebernimmNeue(s, 18);

  let schritte = 0;
  for (let tag = 19; tag <= 18 + ROOKIE_TRAINING_WOCHEN * 7 + 14; tag++) {
    if (!wochenBeginn(tag)) continue;
    const vorher = neue[0].staerke;
    const lief = neue.map((sp) => rookieTraining(sp, tag))[0];
    if (lief) {
      schritte++;
      assert.ok(neue[0].staerke >= vorher, 'das Training macht niemanden schlechter');
    }
  }
  assert.equal(schritte, ROOKIE_TRAINING_WOCHEN, 'sechs Wochenanfänge, dann ist Schluss');
  for (const sp of neue) {
    assert.ok(Math.abs(sp.staerke - /** @type {number} */ (versprochen.get(sp.id))) <= 1,
      `${sp.id}: ${sp.staerke} statt ${versprochen.get(sp.id)}`);
  }
});

// --- Über eine ganze Saison -----------------------------------------------------

test('eine Saison mit zwei Tryouts: Frage, Tryout, Zusagen, Training', () => {
  const s = neuesSpiel('fkk', 'saison');
  const start = s.kader.fkk.length;
  const { herbst, fruehling } = tryoutTage(s.jahr);

  bisTag(s, herbst);
  const tryout = offeneAntworten(s).find((n) => n.art === 'tryout');
  assert.ok(tryout, 'am Tryout-Tag hält eine Nachricht');
  assert.equal(tryout.daten.anzahl, recruitingVon(s).tryout?.kandidaten.length);

  bisTag(s, herbst + TRYOUT_BEDENKZEIT);
  const zusagen = offeneAntworten(s).find((n) => n.art === 'tryoutZusagen');
  assert.ok(zusagen, 'drei Tage später kommen die Antworten');
  const neu = recruitingVon(s).neue.length;
  assert.ok(neu > 0);
  raeume(s);
  assert.equal(s.kader.fkk.length, start + neu);
  assert.ok(s.kader.fkk.length >= KADER_MINIMUM);

  bisTag(s, fruehling - TRYOUT_VORLAUF);
  assert.ok(offeneAntworten(s).some((n) => n.art === 'tryoutWerbung'), 'die Frage zum April');
  bisTag(s, fruehling + TRYOUT_BEDENKZEIT);
  assert.ok(s.post.some((n) => n.jahr === s.jahr && n.tag === fruehling + TRYOUT_BEDENKZEIT
    && (n.art === 'tryoutZusagen' || n.art === 'tryoutAbsagen')));
});

test('nach dem Finale sagt jeder, der geht, es selbst — und die Vorschau stimmt', () => {
  const s = neuesSpiel('heg', 'abgaenge');
  for (let i = 0; i < 400 && !meister(s); i++) {
    raeume(s);
    weiter(s);
  }
  const tagDanach = SPIELTAG_TAGE[SPIELTAG_TAGE.length - 1] + 1;
  bisTag(s, tagDanach, (a) => a[a.length - 1]);
  const vorschau = abgangsVorschau(s);
  const post = s.post.filter((n) => n.tag === tagDanach
    && (n.art === 'abgang' || n.art === 'abgangKoerper'));
  assert.equal(post.length, vorschau.size, 'je Abgang eine Nachricht');
  for (const n of post) {
    assert.equal(n.daten.grund, vorschau.get(n.daten.spielerId));
    assert.equal(n.art === 'abgangKoerper', n.daten.grund === 'koerper');
  }

  // Alle gehen lassen: dann geht beim Wechsel genau, wer es angekündigt hat.
  bisTag(s, saisonLaenge(s.jahr), (a) => a[a.length - 1]);
  const kaderVorher = s.kader.heg.length;
  const { ruecktritte } = naechsteSaison(s);
  assert.deepEqual(new Set(ruecktritte.map((x) => x.id)), new Set(vorschau.keys()));
  assert.equal(s.kader.heg.length, kaderVorher - ruecktritte.length, 'kein Ersatz für den eigenen Verein');
  const ehemalige = recruitingVon(s).ehemalige;
  assert.equal(ehemalige.length, ruecktritte.length, 'jeder Abgang steht bei den Ehemaligen');
  assert.ok(ehemalige.every((e) => e.jahr === s.jahr - 1 && typeof e.commitment === 'number'));
  assert.ok(s.kader.heg.every((x) => !x.rookieTrainingBis), 'kein Training über den Winter');
});

test('ein Gespräch mit einem, der gehen will, hebt ihn — und wer bleibt, bleibt', () => {
  // In der ersten Saison gehen aus dem frischen Kader nur wenige, und die
  // Hälfte davon aus Körpergründen — also so viele Karrieren, bis genug
  // Gespräche zusammenkommen. Die Seeds sind fest, die Schleife endet immer
  // an derselben Stelle.
  let bleiben = 0;
  let geredet = 0;
  for (let i = 0; i < 30 && (geredet < 8 || bleiben === 0); i++) {
    const s = neuesSpiel('heg', `ueberreden-${i}`);
    for (let i = 0; i < 400 && !meister(s); i++) {
      raeume(s);
      weiter(s);
    }
    const tagDanach = SPIELTAG_TAGE[SPIELTAG_TAGE.length - 1] + 1;
    bisTag(s, tagDanach, (a) => a[a.length - 1]);
    // Die letzten Nachrichten sind noch offen: `bisTag()` hält auf dem Tag an,
    // an dem sie kommen, bevor es sie beantwortet.
    for (const n of offeneAntworten(s).filter((x) => x.art === 'abgang')) {
      const sp = s.kader.heg.find((x) => x.id === n.daten.spielerId);
      const vorher = /** @type {number} */ (sp?.commitment);
      beantworteNachricht(s, n.id, 'gespraech');
      geredet++;
      assert.equal(sp?.commitment, Math.min(99, vorher + ABGANG_GESPRAECH_BONUS));
      assert.ok(n.daten.ergebnis === 'bleibt' || n.daten.ergebnis === 'geht');
      assert.equal(n.daten.ergebnis === 'bleibt', !abgangsVorschau(s).has(n.daten.spielerId));
      if (n.daten.ergebnis === 'bleibt') bleiben++;
    }
  }
  assert.ok(geredet > 0, 'niemand wollte gehen');
  assert.ok(bleiben > 0, `von ${geredet} Gesprächen hat keines gewirkt`);
});
