// @ts-check
/**
 * Der Kalender: die Uhr des Spiels, in Tagen.
 *
 * Eine Saison läuft von einem dritten Oktobersamstag zum nächsten. Zwischen
 * zweien liegen **immer volle Wochen** — 364 Tage, alle paar Jahre 371 —, und
 * daraus folgt alles, was diese Datei billig macht: Tag 1 ist immer ein
 * Samstag, der Wochentag ist eine Modulorechnung, und jeder Spieltag liegt auf
 * `tag ≡ 1 (mod 7)`.
 *
 * Das ist der einzige Ort im Projekt, an dem `Date` vorkommt, ausschließlich
 * als `Date.UTC` und ausschließlich, um aus einer Tagesnummer ein Datum zum
 * Anzeigen zu machen. Im Speicherstand steht nie ein `Date`.
 *
 * Der Spielplan wird **vom Saisonanfang aus** gerechnet und nie rückwärts vom
 * Ende: in einem 371-Tage-Jahr ist die zusätzliche Woche eine Woche mehr
 * Sommerpause und sonst nichts. Wer rückwärts rechnet, verschiebt in diesen
 * Jahren die ganze Saison um eine Woche und merkt es erst 2029.
 *
 * Docs: docs/umbau-kalender.md, Abschnitt 3
 */

const OKTOBER = 10;
/** `getUTCDay()` zählt ab Sonntag; der Samstag ist die Sechs. */
const SAMSTAG = 6;
const MS_PRO_TAG = 86400000;

/** @typedef {{ j: number, m: number, t: number }} Datum  Jahr, Monat 1..12, Tag im Monat */

/** @param {Datum} d */
function zeit(d) {
  return Date.UTC(d.j, d.m - 1, d.t);
}

/**
 * Der erste Tag einer Saison: der dritte Samstag im Oktober des Vorjahres.
 * Saison 2027 beginnt am Sa 17.10.2026.
 * @param {number} jahr Saisonlabel
 * @returns {Datum}
 */
export function saisonStart(jahr) {
  const kalenderJahr = jahr - 1;
  const ersterOktober = new Date(Date.UTC(kalenderJahr, OKTOBER - 1, 1));
  const bisSamstag = (SAMSTAG - ersterOktober.getUTCDay() + 7) % 7;
  return { j: kalenderJahr, m: OKTOBER, t: 1 + bisSamstag + 14 };
}

/**
 * Wie viele Tage die Saison hat — 364 oder, alle paar Jahre, 371.
 * @param {number} jahr
 */
export function saisonLaenge(jahr) {
  return Math.round((zeit(saisonStart(jahr + 1)) - zeit(saisonStart(jahr))) / MS_PRO_TAG);
}

/**
 * Der Wochentag einer Tagesnummer: 0 = Samstag, 6 = Freitag.
 *
 * Reine Modulorechnung, weil Tag 1 jeder Saison ein Samstag ist. Kein `Date`,
 * kein Saisonjahr — der Wochentag hängt an nichts als der Zahl.
 * @param {number} tag
 */
export function wochentag(tag) {
  return (((tag - 1) % 7) + 7) % 7;
}

/**
 * Das Datum eines Tages, zum Anzeigen.
 * @param {number} jahr @param {number} tag
 * @returns {Datum & { wochentag: number }}
 */
export function datum(jahr, tag) {
  const d = new Date(zeit(saisonStart(jahr)) + (tag - 1) * MS_PRO_TAG);
  return {
    j: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    t: d.getUTCDate(),
    wochentag: wochentag(tag),
  };
}

/**
 * Die Tagesnummer eines Datums. Liegt das Datum vor dem Saisonstart oder hinter
 * dem Saisonende, kommt eine Zahl außerhalb von 1..saisonLaenge zurück — das
 * braucht das Monatsraster, das über die Saisongrenze hinausragt.
 * @param {number} jahr @param {number} j @param {number} m @param {number} t
 */
export function tagVonDatum(jahr, j, m, t) {
  return Math.round((Date.UTC(j, m - 1, t) - zeit(saisonStart(jahr))) / MS_PRO_TAG) + 1;
}

/**
 * Der erste Samstag eines Monats, als Tagesnummer der Saison `jahr`.
 * @param {number} jahr Saisonlabel @param {number} j Kalenderjahr @param {number} m 1..12
 */
function ersterSamstag(jahr, j, m) {
  const erster = new Date(Date.UTC(j, m - 1, 1));
  return tagVonDatum(jahr, j, m, 1 + (SAMSTAG - erster.getUTCDay() + 7) % 7);
}

/**
 * Die beiden Tryouts einer Saison: der erste Samstag im November und der erste
 * im April. Beide liegen fern jedes Spieltags — der November in der Offseason,
 * Tag 15 oder 22; der April in der Preseason, fast immer Tag 169, vierzehn Tage
 * vor dem ersten Spieltag. Viermal im Jahrhundert ist es Tag 176 (zuerst 2040):
 * beginnt die Saison am frühestmöglichen 15. Oktober und hat der Februar einen
 * Schalttag, fällt der Samstag nach 24 Wochen auf den 31. März, und der erste
 * im April ist eine Woche später. Dann bleibt eine Woche bis zum ersten
 * Spieltag — knapp, aber es kollidiert mit nichts.
 *
 * Hier steht nur der Termin, weil nur er ein Datum braucht. Die Erinnerung
 * einen Monat vorher ist Tagesrechnung und steht in `recruiting.js`.
 * @param {number} jahr
 * @returns {{ herbst: number, fruehling: number }}
 */
export function tryoutTage(jahr) {
  return {
    herbst: ersterSamstag(jahr, jahr - 1, 11),
    fruehling: ersterSamstag(jahr, jahr, 4),
  };
}

/** Wie viele Tage ein Monat hat. @param {number} j @param {number} m 1..12 */
export function tageImMonat(j, m) {
  return new Date(Date.UTC(j, m, 0)).getUTCDate();
}

/**
 * Wie viele leere Zellen vor dem Ersten eines Monats stehen, wenn das Raster
 * montags beginnt.
 *
 * Steht hier und nicht in der Ansicht, damit `Date` diese eine Datei nicht
 * verlässt — der Kalender rechnet, die Ansicht zeigt.
 * @param {number} j @param {number} m 1..12
 */
export function rasterVersatz(j, m) {
  return (new Date(Date.UTC(j, m - 1, 1)).getUTCDay() + 6) % 7;
}

/**
 * Die Saisonform, als Daten: an welchem Tag welcher Spieltag steigt.
 *
 * Zehn Gruppenspieltage mit einer spielfreien Woche nach dem fünften, dann das
 * Bracket mit zwei Wochen Abstand. Beim nächsten Formatwechsel ist diese Liste
 * die eine Stelle, an der die Antwort steht — nicht verteilt über drei
 * Rechnungen.
 */
export const SPIELTAG_TAGE = [
  183, 190, 197, 204, 211,        // Spieltage 1–5, ab Sa 17.04.
  225, 232, 239, 246, 253,        // Spieltage 6–10, nach einer spielfreien Woche
  267,                            // Halbfinale
  281,                            // Finale
];

/** Wie viele der Spieltage zur Gruppenrunde gehören. Der Rest ist Bracket. */
export const GRUPPEN_SPIELTAGE = 10;

/** Das Etikett wird zum Tag. @param {number} nr 1-basiert */
export function tagVonSpieltag(nr) {
  const tag = SPIELTAG_TAGE[nr - 1];
  if (tag === undefined) throw new Error('Kein Termin für Spieltag ' + nr);
  return tag;
}

/** Der Tag wird zum Etikett, oder zu null. @param {number} tag */
export function spieltagAmTag(tag) {
  const i = SPIELTAG_TAGE.indexOf(tag);
  return i === -1 ? null : i + 1;
}

/** @typedef {'offseason'|'preseason'|'regularSeason'|'postseason'} Phase */

/** Wie lange die Preseason vor dem ersten Spieltag läuft: vier Wochen. */
const PRESEASON_TAGE = 28;

/**
 * Die Abschnitte eines Saisonjahres, mit ihrem ersten Tag.
 *
 * Sie stehen als Liste da und nicht als Kette von Vergleichen, weil der Tick
 * dieselbe Liste zweimal liest: einmal für „welche Phase ist gerade" und
 * einmal für „fängt heute eine an" — und ein Phasenbeginn ist ein Zwangsstopp.
 *
 * `offseason` steht **zweimal** drin, und das ist kein Versehen: die Zeit nach
 * dem Finale und die Zeit vor der Preseason sind derselbe Zustand — Saison
 * vorbei, nichts los —, nur an der `jahr`-Grenze künstlich zerschnitten. Sie
 * denselben Namen tragen zu lassen kostet nichts (`phaseAmTag()` nimmt den
 * letzten Treffer, `phasenBeginn()` fragt nur nach dem Tag) und erspart der
 * Anzeige einen zweiten Namen für dieselbe Sache. Eine eigene `sommerpause`
 * gab es früher; wer sie unterscheiden will, fragt nach dem Tag, nicht nach
 * dem Phasennamen.
 * @type {{ name: Phase, ab: number }[]}
 */
export const PHASEN = [
  { name: 'offseason', ab: 1 },
  { name: 'preseason', ab: SPIELTAG_TAGE[0] - PRESEASON_TAGE },
  { name: 'regularSeason', ab: SPIELTAG_TAGE[0] },
  { name: 'postseason', ab: SPIELTAG_TAGE[GRUPPEN_SPIELTAGE - 1] + 1 },
  { name: 'offseason', ab: SPIELTAG_TAGE[SPIELTAG_TAGE.length - 1] + 1 },
];

/** @param {number} tag @returns {Phase} */
export function phaseAmTag(tag) {
  let phase = PHASEN[0];
  for (const p of PHASEN) if (tag >= p.ab) phase = p;
  return phase.name;
}

/** Ob an diesem Tag eine Phase anfängt. @param {number} tag */
export function phasenBeginn(tag) {
  return PHASEN.some((p) => p.ab === tag);
}

/**
 * Ob das Finale schon gelaufen ist — die zweite Offseason des Jahres.
 *
 * Braucht die Anzeige, die zwischen „Saison vorbei" und „diese Woche
 * spielfrei" unterscheidet. Früher war das `phaseAmTag(tag) === 'sommerpause'`;
 * seit beide Hälften des Jahres `offseason` heißen, ist die Frage eine Frage
 * nach dem Tag und nicht mehr nach dem Phasennamen.
 * @param {number} tag
 */
export function nachDemFinale(tag) {
  return tag > SPIELTAG_TAGE[SPIELTAG_TAGE.length - 1];
}

/**
 * Die Woche, in der ein Tag liegt — 0-basiert, gezählt ab Saisonbeginn.
 *
 * Reine Modulorechnung wie `wochentag()`, und aus demselben Grund billig: Tag 1
 * ist immer ein Samstag, also fängt jede Woche der Saison an einem Samstag an,
 * und jeder Spieltag liegt auf dem ersten Tag einer Woche. Das ist der Rhythmus,
 * an dem das Gesprächskontingent hängt — ein Fenster, das sich von selbst
 * verschiebt, statt eines Zählers, den irgendwer jede Woche zurücksetzen müsste.
 * @param {number} tag
 */
export function woche(tag) {
  return Math.floor((tag - 1) / 7);
}

/**
 * Ob an diesem Tag eine Woche anfängt.
 *
 * Steht neben `phasenBeginn()` im Tagesschritt: der Wochenanfang ist der
 * Moment, in dem die Rollen-Kampagne ihre fälligen Anfragen verschickt und
 * sich das Gesprächskontingent aufs nächste Fenster schiebt. Anders als ein
 * Phasenbeginn hält er den Kalender **nicht** an — was er auslöst, hält ihn
 * selbst an, wenn es eine Antwort verlangt.
 * @param {number} tag
 */
export function wochenBeginn(tag) {
  return (tag - 1) % 7 === 0;
}
