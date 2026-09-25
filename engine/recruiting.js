// @ts-check
/**
 * Die Rekrutierung des eigenen Vereins: zwei Tryouts im Jahr, die Werbung
 * davor, die Gespräche am Tag selbst, die Zusagen danach und das
 * Rookie-Training zum Schluss.
 *
 * Der Ablauf, wie ihn der Manager erlebt:
 *
 * 1. **Einen Monat vorher** fragt der Verein nach der Werbung — eine Nachricht
 *    mit Antwortpflicht, darin die Maßnahmen zum Ankreuzen. Sie bestimmen, wie
 *    viele kommen und **wer**: der Hochschulinfotag bringt Studenten, das
 *    Fitnessstudio Arbeiter. Rekrutierungskanäle sind Verteilungen über
 *    Lebenslagen — das ist die ganze Idee, und sie steht in `STATUS_JE_KANAL`.
 * 2. **Am Tryout** stehen die Kandidaten auf dem Platz. Der Manager sieht, was
 *    man an einem Samstagvormittag sieht: Größe, Gewicht, Alter, grob die
 *    Athletik, die Lebenslage, das Interesse, und wo der Stab ihn sich
 *    vorstellen könnte. Mit fünf redet er; jedes Gespräch halbiert den Abstand
 *    zum sicheren Ja.
 * 3. **Drei Tage später** sagen sie zu oder ab. Wer zusagt, bekommt vom
 *    Manager eine Position und danach sechs Wochen Rookie-Training.
 *
 * Ein Kandidat hat **keine Position**, bis der Manager ihm eine gibt. Das ist
 * der Unterschied zu jeder anderen Ziehung im Projekt, die immer mit der
 * Position anfängt (`macheSpieler()`): hier kommen erst Körper und Athletik,
 * und die Eignung wird daraus gerechnet, nicht umgekehrt. Das Handwerk bringt
 * er nur halb mit, die Technik gar nicht — die kommt mit dem Training auf
 * einer Position.
 *
 * Die KI-Vereine rekrutieren nicht so. Sie ersetzen jeden Abgang weiter durch
 * einen Rookie gleicher Position (`saisonWechsel()`) und spielen das Metaspiel
 * nicht; was ihnen an Pflege fehlt, gleicht `kiAusgleich()` aus.
 *
 * Docs: docs/naechste-schritte.md, Block 7, Schritt 3
 */

import {
  ATTRIBUTE, ATTRIBUT_STREUUNG, KOERPER_MITTE, KOERPER_SPANNE, KOERPER_KOPPLUNG,
  RATING_UNTERGRENZE, LIGA_MAX_STAERKE, TALENT_MIN, TALENT_MAX, RUECKTRITT_ALTER, KADER_FORM,
  POSITIONS, LERNRATE,
  TRYOUT_SOCKEL, TRYOUT_SPANNE, TRYOUT_VEREINSFAKTOR_MIN, TRYOUT_LIGA_FAKTOR, WERBUNG_ANTEIL,
  TRYOUT_LIGA_ANTEIL, TRYOUT_ROOKIE_ABSCHLAG, TRYOUT_STAERKE_STREUUNG,
  TRYOUT_HANDWERK_ANTEIL, TRYOUT_TECHNIK, TRYOUT_GESPRAECHE, TRYOUT_BEDENKZEIT, TRYOUT_VORLAUF,
  INTERESSE_HERBST, INTERESSE_FRUEHLING, KADER_MINIMUM,
  ROOKIE_TRAINING_WOCHEN, ROOKIE_TRAINING_JE_WOCHE,
  TALENT_KORRIDOR_OHNE, TALENT_KORRIDOR_BESTE, PROGNOSE_KORRIDOR_OHNE, PROGNOSE_KORRIDOR_BESTE,
  SCOUTING_SKALA,
  makeRng, clamp, randInt, randNormal, pickWeighted,
} from './constants.js';
import { TEAMS, teamById } from './content.js';
import { tryoutTage, saisonLaenge } from './kalender.js';
import {
  ziehName, ziehKoerper, ziehKickWerte, ziehTalent, sollAttribute, vergebeNummern,
  sortiereKader, OHNE_NUMMER,
} from './spieler.js';
import {
  generierungsProfil, bewerte, SEITEN_POSITIONEN, KOERPER_KORRIDOR, KOERPERMALUS_JE_KILO,
} from './positionen.js';
import { ziehLebenslage, ziehCommitment, ziehWahrheit } from './commitment.js';
import { gruppenWert, COACHING_GRUPPE_JE_POSITION } from './coach.js';

/** @typedef {'herbst'|'fruehling'} TryoutArt */
/** @typedef {import('./commitment.js').Status} Status */

/**
 * Ein Mensch auf dem Tryout-Platz. Noch kein Spieler: er hat keine Position,
 * keine Nummer und kein Commitment — das bekommt er, wenn er zusagt.
 * @typedef {object} Kandidat
 * @property {string} id         Wird seine Spieler-Id, wenn er kommt
 * @property {string} vorname
 * @property {string} nachname
 * @property {number} alter
 * @property {number} groesse
 * @property {number} gewicht
 * @property {Record<string, number>} attribute  Roh: Athletik ganz, Handwerk halb, Technik fast null
 * @property {number} ziel       Die Stärke, auf die ihn das Training zieht — **nie** angezeigt
 * @property {number} talent
 * @property {number} kickStaerke
 * @property {number} kickGenauigkeit
 * @property {import('./commitment.js').Lebenslage} lebenslage
 * @property {string} herkunft   Die Maßnahme, über die er kam, oder `mundpropaganda`
 * @property {number} interesse  0..100 — die Chance, dass er zusagt. Angezeigt als Stufe
 * @property {boolean} angesprochen
 */

/**
 * @typedef {object} Tryout
 * @property {number} jahr
 * @property {number} tag
 * @property {TryoutArt} art
 * @property {Kandidat[]} kandidaten
 * @property {boolean} abgeschlossen  Der Manager hat den Platz verlassen; ab hier wird nicht mehr geredet
 */

/**
 * Wer den Verein verlassen hat. Aufgeschrieben wird es jetzt, obwohl es noch
 * niemand liest: der Ehemaligen-Pool ist später der Ort, aus dem Coaches und
 * Orga kommen, und wer damals mit welchem Commitment ging, lässt sich
 * hinterher aus nichts mehr rekonstruieren.
 * @typedef {object} Ehemaliger
 * @property {string} id
 * @property {string} name
 * @property {string} position
 * @property {number} alter       Beim Abschied
 * @property {number} jahr        Die Saison, nach der er ging
 * @property {import('./commitment.js').Grund} grund
 * @property {number} commitment
 */

/**
 * Was der Verein zur Rekrutierung im Stand führt.
 * @typedef {object} Recruiting
 * @property {{ jahr: number, tag: number, massnahmen: string[] } | null} werbung
 *   Die Werbung für das **nächste** Tryout. Sie kann ein Jahr vorausliegen: die
 *   Frage zum November kommt noch in der alten Saison
 * @property {Tryout | null} tryout  Das laufende, vom Tryout-Tag bis zu den Zusagen
 * @property {import('./spieler.js').Spieler[]} neue  Wer zugesagt hat und noch auf seine Position wartet
 * @property {Ehemaliger[]} ehemalige
 */

/** Die fünf Werte, die man an einem Samstagvormittag sieht, in der Reihenfolge der Anzeige. */
export const ATHLETIK = ['schnelligkeit', 'ausdauer', 'beweglichkeit', 'robustheit', 'kraft'];

/** Die Maßnahmen, in der Reihenfolge, in der sie angeboten werden. */
export const MASSNAHMEN = Object.keys(WERBUNG_ANTEIL);

/**
 * Wen ein Kanal bringt, nach Status. Das ist das Modell hinter der Werbung —
 * die Anteile an der Spanne sind die Stellschraube und stehen in
 * `constants.js`, das hier ist die Aussage.
 *
 * `mundpropaganda` ist der Sockel: Freunde, Kollegen, der Nachbar. Er bringt
 * von allem etwas, mit dem Schwerpunkt dort, wo die meisten Leute sind.
 * @type {Record<string, (readonly [Status, number])[]>}
 */
const STATUS_JE_KANAL = {
  mundpropaganda: [['schueler', 10], ['student', 30], ['azubi', 20], ['arbeiter', 40]],
  hochschulinfotag: [['student', 100]],
  socialMedia: [['schueler', 20], ['student', 40], ['azubi', 20], ['arbeiter', 20]],
  plakate: [['schueler', 10], ['student', 25], ['azubi', 20], ['arbeiter', 45]],
  fitnessstudio: [['student', 15], ['azubi', 15], ['arbeiter', 70]],
  schule: [['schueler', 100]],
  zeitung: [['student', 10], ['azubi', 10], ['arbeiter', 80]],
  supermarkt: [['schueler', 5], ['student', 15], ['azubi', 20], ['arbeiter', 60]],
  radio: [['schueler', 10], ['student', 20], ['azubi', 20], ['arbeiter', 50]],
};

/**
 * Wie alt einer ist, der mit diesem Status zum Tryout kommt. Eng am Status,
 * damit `ziehLebenslage()` keinen 30-jährigen Schüler bekommt; der Arbeiter
 * hört bei 34 auf, weil mit 40 niemand mehr zum ersten Mal Football spielt.
 * @type {Record<string, [number, number]>}
 */
const ALTER_JE_STATUS = {
  schueler: [18, 19],
  student: [19, 25],
  azubi: [18, 22],
  arbeiter: [20, 34],
};

/**
 * Wie oft welche Statur zum Tryout kommt. Nach der Kaderform gewichtet: das
 * ist ungefähr die Mischung aus Körpern, die ein Footballplatz anzieht, und
 * sie sorgt dafür, dass unter fünfzehn Leuten auch drei für die Line stehen.
 * @type {[string, number][]}
 */
const STATUR = /** @type {[string, number][]} */ (
  Object.entries(KADER_FORM).filter(([, n]) => n > 0));

/**
 * Die grobe Statur-Gruppe einer Position — für die Verschiebung nach Status,
 * nicht für die Ziehung selbst (die bleibt `KOERPER_KORRIDOR` je Position).
 * @type {Record<string, 'schwer'|'mittel'|'leicht'>}
 */
const STATUR_GRUPPE = {
  T: 'schwer', G: 'schwer', C: 'schwer', DE: 'schwer', DT: 'schwer', NT: 'schwer',
  QB: 'mittel', FB: 'mittel', TE: 'mittel', SS: 'mittel', MIKE: 'mittel', SAM: 'mittel', WILL: 'mittel',
  RB: 'leicht', WR: 'leicht', SL: 'leicht', CB: 'leicht', FS: 'leicht',
};

/**
 * Wie sich die drei Staturgruppen mit dem Status verschieben — multiplikativ
 * auf die Gewichte aus `STATUR`, nicht ersetzend, damit die Rangfolge einer
 * Gruppe (mehr WR als CB, weil die Kaderform das schon sagt) erhalten bleibt.
 *
 * Ein Student bringt selten den Körper eines Linemans mit: er ist überwiegend
 * schlank oder durchtrainiert, nicht schwer. Der Arbeiter bringt ihn öfter mit
 * — Jahre am Bau oder am Schreibtisch hinterlassen anderes als ein Studium.
 * @type {Record<Status, Record<'schwer'|'mittel'|'leicht', number>>}
 */
const STATUR_FAKTOR_JE_STATUS = {
  schueler: { leicht: 1.5, mittel: 0.9, schwer: 0.2 },
  student: { leicht: 1.5, mittel: 0.9, schwer: 0.2 },
  azubi: { leicht: 1.15, mittel: 1.0, schwer: 0.65 },
  arbeiter: { leicht: 0.6, mittel: 0.9, schwer: 1.9 },
  rentner: { leicht: 1.0, mittel: 1.0, schwer: 1.0 },
};

/** Der Statur-Pool für diesen Status. @param {Status} status */
function staturPoolFuer(status) {
  const faktor = STATUR_FAKTOR_JE_STATUS[status] || STATUR_FAKTOR_JE_STATUS.arbeiter;
  return /** @type {[string, number][]} */ (
    STATUR.map(([position, gewicht]) => [position, gewicht * faktor[STATUR_GRUPPE[position]]]));
}

/**
 * Der Stand der Rekrutierung, notfalls angelegt. Ein Stand von vor Version 19
 * hat das Feld nach der Migration schon; das hier fängt nur ab, was ein Test
 * von Hand baut.
 * @param {import('./saison.js').SpielStand} stand
 * @returns {Recruiting}
 */
export function recruitingVon(stand) {
  if (!stand.recruiting) stand.recruiting = { werbung: null, tryout: null, neue: [], ehemalige: [] };
  return stand.recruiting;
}

// --- Termine -----------------------------------------------------------------

/**
 * Ob an diesem Tag ein Tryout steigt, und welches.
 * @param {number} jahr @param {number} tag
 * @returns {TryoutArt | null}
 */
export function tryoutAmTag(jahr, tag) {
  const t = tryoutTage(jahr);
  if (tag === t.herbst) return 'herbst';
  if (tag === t.fruehling) return 'fruehling';
  return null;
}

/**
 * An welchem Tag welcher Saison die Frage nach der Werbung kommt.
 *
 * `TRYOUT_VORLAUF` Tage vorher, und das liegt beim November-Tryout (Tag 15
 * oder 22) **im Vorjahr** — in der Offseason nach dem Finale. Es ist der erste
 * Termin im Projekt, der über die `jahr`-Grenze rechnet:
 * `saisonLaenge(vorjahr) + tag − VORLAUF`.
 *
 * Für die erste Saison einer Karriere gibt es kein Vorjahr. Dort kommt die
 * Frage an Tag 1, mit dem Amtsantritt — siehe `saisonEroeffnung()` —, und der
 * Manager hat zwei bis drei Wochen statt eines Monats. Das passt zu „gerade
 * übernommen" und braucht keinen eigenen Pfad außer diesem.
 * @param {number} jahr Die Saison des Tryouts @param {number} tag Sein Tag
 * @returns {{ jahr: number, tag: number }}
 */
export function erinnerungFuer(jahr, tag) {
  const vorher = tag - TRYOUT_VORLAUF;
  if (vorher >= 1) return { jahr, tag: vorher };
  return { jahr: jahr - 1, tag: saisonLaenge(jahr - 1) + vorher };
}

/**
 * Das Tryout, an das dieser Tag erinnern soll, oder null. Beide Tryouts der
 * nächsten Monate kommen in Frage: das Frühjahr dieser Saison und der Herbst
 * der nächsten.
 * @param {number} jahr @param {number} tag
 * @returns {{ jahr: number, tag: number, art: TryoutArt } | null}
 */
export function erinnerungAmTag(jahr, tag) {
  for (const j of [jahr, jahr + 1]) {
    const t = tryoutTage(j);
    for (const art of /** @type {TryoutArt[]} */ (['herbst', 'fruehling'])) {
      const e = erinnerungFuer(j, t[art]);
      if (e.jahr === jahr && e.tag === tag) return { jahr: j, tag: t[art], art };
    }
  }
  return null;
}

// --- Der Zulauf --------------------------------------------------------------

/**
 * Wie sehr ein Verein anzieht, 0,4 bis 1. Aus dem Katalog, nicht aus dem
 * Kader: es ist der Ruf des Namens, und der hängt nicht daran, dass der
 * Manager ihn gerade mit dreißig Mann neu aufbaut.
 * @param {string} teamId
 */
export function vereinsFaktor(teamId) {
  const staerken = TEAMS.map((t) => t.staerke);
  const min = Math.min(...staerken);
  const max = Math.max(...staerken);
  const anteil = max > min ? (teamById(teamId).staerke - min) / (max - min) : 1;
  return clamp(TRYOUT_VEREINSFAKTOR_MIN + (1 - TRYOUT_VEREINSFAKTOR_MIN) * anteil,
    TRYOUT_VEREINSFAKTOR_MIN, 1);
}

/**
 * Wie viele kommen, wenn diese Maßnahmen laufen.
 * @param {string} teamId @param {string[]} massnahmen
 */
export function zulauf(teamId, massnahmen) {
  const anteil = massnahmen.reduce((s, m) => s + (WERBUNG_ANTEIL[m] || 0), 0);
  return TRYOUT_SOCKEL + Math.round(
    TRYOUT_SPANNE * vereinsFaktor(teamId) * TRYOUT_LIGA_FAKTOR * Math.min(1, anteil));
}

/**
 * Die Werbung für das nächste Tryout anlegen, alle Maßnahmen an.
 *
 * Alle an, weil sie heute nichts kosten — wer sie abwählt, verzichtet auf
 * Leute und spart nichts. Mit den Finanzen wird der Vorschlag ein anderer.
 * @param {import('./saison.js').SpielStand} stand @param {number} jahr @param {number} tag
 */
export function planeWerbung(stand, jahr, tag) {
  recruitingVon(stand).werbung = { jahr, tag, massnahmen: [...MASSNAHMEN] };
}

/**
 * Ob die Werbung noch geändert werden kann: solange ihre Nachricht offen ist.
 * Mit der Antwort ist sie beschlossen.
 * @param {import('./saison.js').SpielStand} stand
 */
export function werbungOffen(stand) {
  const w = recruitingVon(stand).werbung;
  return !!w && stand.post.some((n) => n.art === 'tryoutWerbung' && n.antwort === null
    && n.daten.jahr === w.jahr && n.daten.tag === w.tag);
}

/**
 * Eine Maßnahme an- oder abwählen.
 * @param {import('./saison.js').SpielStand} stand @param {string} massnahme @param {boolean} an
 * @returns {boolean} ob sich etwas geändert hat
 */
export function setzeWerbung(stand, massnahme, an) {
  const w = recruitingVon(stand).werbung;
  if (!w || !MASSNAHMEN.includes(massnahme) || !werbungOffen(stand)) return false;
  const ohne = w.massnahmen.filter((m) => m !== massnahme);
  // In der Reihenfolge des Angebots, damit die Liste nicht nach Klickfolge
  // sortiert im Speicherstand liegt.
  w.massnahmen = MASSNAHMEN.filter((m) => (m === massnahme ? an : ohne.includes(m)));
  return true;
}

/**
 * Welche Maßnahmen für dieses Tryout laufen. Fehlt die Werbung — ein Stand,
 * der von vor den Tryouts stammt und die Frage nie bekommen hat —, laufen
 * alle: sie kosten nichts, und wer nie gefragt wurde, soll nicht mit dem
 * Sockel dastehen.
 * @param {import('./saison.js').SpielStand} stand @param {number} tag
 */
function massnahmenFuer(stand, tag) {
  const w = recruitingVon(stand).werbung;
  if (w && w.jahr === stand.jahr && w.tag === tag) return w.massnahmen;
  return [...MASSNAHMEN];
}

// --- Die Kandidaten ----------------------------------------------------------

/**
 * Was die Liga im Schnitt hat: Stärke und Talent über alle zwölf Kader, dazu
 * jeder der fünf Athletikwerte für sich. Der Maßstab für die Kandidaten, für
 * das Sicherheitsnetz und für die Stufen, in denen der Manager sie sieht.
 *
 * Die Athletikwerte stehen **einzeln** und nicht als Anteil an `staerke`, weil
 * die beiden nichts miteinander zu tun haben: `ausdauer` und `robustheit`
 * kommen in keiner einzigen Positionsformel vor (`positionen.js`, `FORMELN`)
 * und liegen deshalb bei jedem regulär gezogenen Spieler weit unter seiner
 * Stärke — `baueAttribute()` zieht sie mit `1 − PROFIL_SPEZIALISIERUNG` herunter,
 * weil kein Profil nach ihnen fragt. Ein Tryout-Kandidat bekommt sie dagegen
 * ungekürzt (`roheAttribute()`): er hat ja noch keine Position, die etwas von
 * ihm verlangen könnte. Verglichen mit `staerke` sah er deshalb immer schlecht
 * aus, ganz gleich, wie athletisch er wirklich war — verglichen mit dem, was
 * die Liga bei genau diesem Attribut tatsächlich hat, stimmt es.
 * @param {import('./saison.js').SpielStand} stand
 */
export function ligaSchnitt(stand) {
  let staerke = 0;
  let talent = 0;
  let n = 0;
  /** @type {Record<string, number>} */
  const athletikSumme = Object.fromEntries(ATHLETIK.map((a) => [a, 0]));
  for (const t of TEAMS) {
    for (const s of stand.kader[t.id] || []) {
      staerke += s.staerke;
      talent += s.talent;
      n++;
      for (const a of ATHLETIK) athletikSumme[a] += s.attribute[a];
    }
  }
  if (n === 0) {
    return { staerke: 50, talent: 5, athletik: Object.fromEntries(ATHLETIK.map((a) => [a, 30])) };
  }
  return {
    staerke: staerke / n,
    talent: talent / n,
    athletik: Object.fromEntries(ATHLETIK.map((a) => [a, athletikSumme[a] / n])),
  };
}

/** @param {import('./spieler.js').Spieler[]} kader */
function kaderSchnitt(kader) {
  return kader.length > 0 ? kader.reduce((s, x) => s + x.staerke, 0) / kader.length : 0;
}

/**
 * Die Attribute eines Kandidaten, roh. Die Athletik steht auf seinem vollen
 * Niveau, mit dem Körper gekoppelt wie in `baueAttribute()` — der Schwere ist
 * stark und langsam, auch ohne Position. Das Handwerk steht zur Hälfte, die
 * Technik fast bei null.
 * @param {() => number} rng @param {number} ziel @param {number} gewicht
 */
function roheAttribute(rng, ziel, gewicht) {
  const schwer = clamp((gewicht - KOERPER_MITTE) / KOERPER_SPANNE, -1.5, 1.5);
  /** @type {Record<string, number>} */
  const werte = {};
  for (const attribut of ATTRIBUTE) {
    let wert;
    if (attribut === 'technik') wert = randInt(rng, TRYOUT_TECHNIK[0], TRYOUT_TECHNIK[1]);
    else if (ATHLETIK.includes(attribut)) wert = ziel + randNormal(rng) * ATTRIBUT_STREUUNG;
    else wert = ziel * TRYOUT_HANDWERK_ANTEIL + randNormal(rng) * ATTRIBUT_STREUUNG;

    if (attribut === 'kraft') wert *= 1 + KOERPER_KOPPLUNG * schwer;
    if (attribut === 'schnelligkeit') wert *= 1 - KOERPER_KOPPLUNG * schwer;
    if (attribut === 'beweglichkeit') wert *= 1 - KOERPER_KOPPLUNG * 0.5 * schwer;

    werte[attribut] = Math.round(clamp(wert, RATING_UNTERGRENZE, LIGA_MAX_STAERKE));
  }
  return werte;
}

/**
 * Einen Kandidaten ziehen.
 * @param {() => number} rng
 * @param {{ id: string, basis: number, deckel?: { staerke: number, talent: number },
 *   herkunft: string, jahr: number, uniKm: number, belegteNamen: Set<string> }} o
 *   `basis` ist die Stärke, um die gezogen wird, vor dem Rookie-Abschlag. `deckel`
 *   hält Stärke und Talent **unter** diesen Werten — das Sicherheitsnetz
 * @returns {Kandidat}
 */
export function ziehKandidat(rng, o) {
  const status = pickWeighted(rng, STATUS_JE_KANAL[o.herkunft] || STATUS_JE_KANAL.mundpropaganda);
  const [von, bis] = ALTER_JE_STATUS[status];
  const alter = randInt(rng, von, bis);
  const { vorname, nachname } = ziehName(rng, o.belegteNamen);

  let ziel = Math.round(o.basis
    - randInt(rng, TRYOUT_ROOKIE_ABSCHLAG[0], TRYOUT_ROOKIE_ABSCHLAG[1])
    + randNormal(rng) * TRYOUT_STAERKE_STREUUNG);
  let talent = ziehTalent(rng, o.basis);
  if (o.deckel) {
    ziel = Math.min(ziel, Math.ceil(o.deckel.staerke) - 1);
    talent = Math.min(talent, Math.ceil(o.deckel.talent) - 1);
  }
  ziel = clamp(ziel, RATING_UNTERGRENZE, LIGA_MAX_STAERKE);
  talent = Math.max(TALENT_MIN, talent);

  const statur = pickWeighted(rng, staturPoolFuer(status));
  const koerper = ziehKoerper(rng, statur);
  const lebenslage = ziehLebenslage(rng, alter, o.jahr, o.uniKm, status);
  // Neu im Verein, egal was die Ziehung an Vereinsjahren gewürfelt hat.
  lebenslage.seit = o.jahr;

  return {
    id: o.id,
    vorname,
    nachname,
    alter,
    ...koerper,
    attribute: roheAttribute(rng, ziel, koerper.gewicht),
    ziel,
    talent,
    ...ziehKickWerte(rng, /** @type {any} */ (statur)),
    lebenslage,
    herkunft: o.herkunft,
    interesse: 0,
    angesprochen: false,
  };
}

/**
 * Das Interesse eines Kandidaten, 0 bis 100.
 *
 * Im Herbst breit um die Mitte. Im Frühling zweigipflig: fast alle sind nur
 * mal vorbeigekommen, aber ein paar Studenten suchen fürs Sommersemester
 * wirklich einen Verein — sie sind es, die das Frühjahr tragen.
 * @param {() => number} rng @param {TryoutArt} art @param {Status} status
 */
export function ziehInteresse(rng, art, status) {
  /** @param {{ mittel: number, streuung: number }} v */
  const wurf = (v) => clamp(Math.round(v.mittel + randNormal(rng) * v.streuung), 0, 100);
  if (art === 'herbst') return wurf(INTERESSE_HERBST);
  const hoch = status === 'student' && rng() < INTERESSE_FRUEHLING.hochChance;
  return wurf(hoch ? INTERESSE_FRUEHLING.hoch : INTERESSE_FRUEHLING.niedrig);
}

/**
 * Das Tryout ausrichten: die Kandidaten ziehen und ablegen.
 *
 * Der Zufall hängt an Jahr und Tag, nicht am Tagesstrom — so zieht dasselbe
 * Tryout aus demselben Stand dieselben Leute, egal was an diesem Tag sonst
 * noch gewürfelt wird.
 * @param {import('./saison.js').SpielStand} stand @param {number} tag @param {TryoutArt} art
 * @returns {Tryout}
 */
export function richteTryoutAus(stand, tag, art) {
  const rng = makeRng(`${stand.seed}|tryout|${stand.jahr}|${tag}`);
  const eigen = stand.kader[stand.meinTeam] || [];
  const liga = ligaSchnitt(stand);
  const basis = TRYOUT_LIGA_ANTEIL * liga.staerke + (1 - TRYOUT_LIGA_ANTEIL) * kaderSchnitt(eigen);
  const massnahmen = massnahmenFuer(stand, tag);
  const anzahl = zulauf(stand.meinTeam, massnahmen);
  const belegteNamen = new Set(eigen.map((s) => s.vorname + ' ' + s.nachname));
  const uniKm = teamById(stand.meinTeam).uniKm;
  /** @type {[string, number][]} */
  const kanaele = massnahmen.map((m) => [m, WERBUNG_ANTEIL[m]]);

  /** @type {Kandidat[]} */
  const kandidaten = [];
  for (let i = 0; i < anzahl; i++) {
    const herkunft = i < TRYOUT_SOCKEL || kanaele.length === 0
      ? 'mundpropaganda'
      : pickWeighted(rng, kanaele);
    const k = ziehKandidat(rng, {
      id: `t${stand.jahr}-${tag}-${i + 1}`, basis, herkunft, jahr: stand.jahr, uniKm, belegteNamen,
    });
    k.interesse = ziehInteresse(rng, art, k.lebenslage.status);
    kandidaten.push(k);
  }

  const tryout = { jahr: stand.jahr, tag, art, kandidaten, abgeschlossen: false };
  recruitingVon(stand).tryout = tryout;
  return tryout;
}

/**
 * Wie viele Gespräche am Tryout noch gehen.
 * @param {Tryout | null} tryout
 */
export function tryoutGespraecheFrei(tryout) {
  if (!tryout || tryout.abgeschlossen) return 0;
  return TRYOUT_GESPRAECHE - tryout.kandidaten.filter((k) => k.angesprochen).length;
}

/**
 * Mit einem Kandidaten reden: der Abstand zum sicheren Ja halbiert sich.
 * Einmal je Kandidat — ein zweites Gespräch am selben Vormittag wäre Drängen.
 * @param {import('./saison.js').SpielStand} stand @param {string} kandidatId
 * @returns {{ vorher: number, nachher: number } | null} null, wenn es nicht geht
 */
export function sprichKandidat(stand, kandidatId) {
  const tryout = recruitingVon(stand).tryout;
  const k = tryout && tryout.kandidaten.find((x) => x.id === kandidatId);
  if (!tryout || !k || k.angesprochen || tryoutGespraecheFrei(tryout) === 0) return null;
  const vorher = k.interesse;
  k.interesse = Math.round(vorher + (100 - vorher) / 2);
  k.angesprochen = true;
  return { vorher, nachher: k.interesse };
}

/**
 * Der Manager verlässt den Platz. Danach wird nicht mehr geredet, und in
 * `TRYOUT_BEDENKZEIT` Tagen kommen die Antworten.
 * @param {import('./saison.js').SpielStand} stand
 */
export function schliesseTryout(stand) {
  const tryout = recruitingVon(stand).tryout;
  if (tryout) tryout.abgeschlossen = true;
}

// --- Eignung und Training -----------------------------------------------------

/**
 * Ein Wochenschritt Training: jedes Attribut ein Stück aufs Soll, mal
 * `LERNRATE`. Nur nach oben — Training macht niemanden langsamer, und die
 * Athletik, die er mitbringt, ist genau das, wofür man ihn geholt hat.
 * @param {Record<string, number>} werte  wird verändert
 * @param {Record<string, number>} soll
 */
function trainiere(werte, soll) {
  for (const attribut of ATTRIBUTE) {
    const luecke = soll[attribut] - werte[attribut];
    if (luecke <= 0) continue;
    werte[attribut] = clamp(
      werte[attribut] + luecke * ROOKIE_TRAINING_JE_WOCHE * (LERNRATE[attribut] ?? 1),
      RATING_UNTERGRENZE, LIGA_MAX_STAERKE);
  }
  return werte;
}

/**
 * Wie gut sein Körper in den Korridor einer Position passt, als Faktor auf das
 * Trainingsziel: 1 innerhalb, darunter je Kilo und Zentimeter daneben.
 *
 * Ohne diesen Faktor wäre jeder zweite Kandidat ein Tackle. Das Sollprofil
 * rechnet den Körper zwar ein (ein leichter Mann hat als Tackle wenig Kraft),
 * skaliert dann aber so lange, bis die Formel wieder das Ziel liest — und beim
 * Tackle trägt das Handwerk fast zwei Drittel, das lernt jeder. Für einen
 * gezogenen Spieler ist das egal, sein Körper passt fast immer zur Position;
 * ein Kandidat hat noch keine, und dann gewinnt die Position, auf der man den
 * Körper am wenigsten braucht. Der 82-Kilo-Mann soll als Receiver vorgeschlagen
 * werden, nicht als Tackle.
 *
 * Dieselbe Rate wie beim Körpermalus einer Umstellung (`KOERPERMALUS_JE_KILO`)
 * — dieselbe Aussage, der falsche Körper kostet auf dem Platz —, aber ohne
 * deren Deckel (`KOERPERMALUS_DECKEL`). Der Deckel ist dort richtig: er
 * verhindert, dass eine Umstellung für einen etablierten Spieler unmöglich
 * wird, der ohnehin auf seinem angestammten Platz bleiben könnte. Hier gibt es
 * diesen Spieler nicht — der Kandidat hat noch gar keine Position —, und ein
 * gedeckelter Abstand ließ einen 150-Kilo-Mann als Receiver kaum schlechter
 * aussehen als ein 40 Kilo leichteres Leichtgewicht. Nach unten bleibt der
 * Faktor trotzdem bei null stehen: negativ gäbe es nichts mehr zu passen, nur
 * noch ein Vorzeichen, das die Trainings-Rechnung darunter verdrehte.
 * @param {string} position @param {number} groesse @param {number} gewicht
 */
export function koerperPassung(position, groesse, gewicht) {
  const k = KOERPER_KORRIDOR[position];
  /** @param {[number, number]} band @param {number} wert */
  const daneben = (band, wert) => Math.max(0, band[0] - wert, wert - band[1]);
  const malus = (daneben(k.gewicht, gewicht) + daneben(k.groesse, groesse)) * KOERPERMALUS_JE_KILO;
  return Math.max(0, 1 - malus);
}

/**
 * Worauf das Training ihn auf einer Position zieht: sein Niveau, mal der
 * Passung seines Körpers.
 * @param {{ groesse: number, gewicht: number }} k @param {number} ziel @param {string} position
 */
function trainingsSoll(k, ziel, position) {
  return sollAttribute(position, ziel * koerperPassung(position, k.groesse, k.gewicht), k.gewicht);
}

/**
 * Was er auf einer Position heute wert ist — dieselbe Rechnung wie bei der
 * Ziehung, nur rückwärts: das Profil der Position über seine Attribute.
 * @param {Record<string, number>} attribute @param {string} position
 */
export function wertAufPosition(attribute, position) {
  return clamp(Math.round(bewerte(attribute, generierungsProfil(position))),
    RATING_UNTERGRENZE, LIGA_MAX_STAERKE);
}

/**
 * Wo der Stab ihn sich vorstellen kann: jede Position mit dem, was er dort
 * **nach dem Rookie-Training** wert wäre, beste zuerst.
 *
 * Gerechnet wird das Training selbst, sechs Wochen auf einer Kopie — keine
 * zweite Formel daneben, die eines Tages etwas anderes verspricht als das
 * Training hält. Unverbindlich ist es trotzdem: der Manager sieht davon nur
 * Stufen, und was danach auf dem Platz passiert, entscheiden die Einsätze.
 * @param {{ attribute: Record<string, number>, ziel: number, groesse: number, gewicht: number }} k
 * @returns {{ position: string, wert: number }[]}
 */
export function prognosen(k) {
  return POSITIONS.map((position) => {
    const soll = trainingsSoll(k, k.ziel, position);
    const werte = { ...k.attribute };
    for (let w = 0; w < ROOKIE_TRAINING_WOCHEN; w++) trainiere(werte, soll);
    return { position, wert: bewerte(werte, generierungsProfil(position)) };
  }).sort((a, b) => b.wert - a.wert);
}

// --- Scouting: was der Stab einschätzen kann --------------------------------
// Ein Kandidat hat noch keine Position, also auch keinen Coach, der ihn schon
// kennt. Was der Manager über ihn erfährt, ist deshalb keine Zahl, sondern ein
// Korridor — und wie breit der ist, hängt daran, wie gut der Stab die Gruppe
// versteht, in der er landen könnte.

/**
 * Wie gut der Stab eine Position einschätzen kann: dieselbe Betreuung wie bei
 * Verletzung und Trend-Nachricht (`betreuung()` in `drift.js`), nur mit der
 * **Technik** statt der Soft Skills — Empathie und Kommunikation sagen nichts
 * darüber, ob ein Coach einen guten Blocker von einem schlechten unterscheiden
 * kann, sein technisches Verständnis der Gruppe schon.
 *
 * Ohne Positionscoach trägt allein der Koordinator, verdünnt auf die fünf
 * Gruppen seiner Seite (`gruppenWert()`) — heute deshalb überall niedrig und
 * zwischen den Vereinen nur wenig verschieden. Das ist kein Fehler: Scouting
 * ohne Fachmann ist überall ungefähr gleich schlecht, und der Wert engt sich
 * erst ein, sobald ein Verein einen Positionscoach für die Gruppe holt.
 * @param {import('./coach.js').Coach[] | undefined} stab @param {string} position
 */
export function scoutingWert(stab, position) {
  const gruppe = COACHING_GRUPPE_JE_POSITION[position];
  return gruppenWert(stab, gruppe, (c) => c.technik[gruppe]);
}

/**
 * Die Halbbreite eines Korridors: `ohne` ohne jede Kenntnis der Gruppe, `beste`
 * bei der bestmöglichen — linear dazwischen, wie `verlustFaktor()` in
 * `drift.js` es mit der Betreuung vormacht. Normiert auf `SCOUTING_SKALA`,
 * nicht auf `MAX_RATING` — siehe die Konstante.
 * @param {number} scouting @param {number} ohne @param {number} beste
 */
function korridorBreite(scouting, ohne, beste) {
  const anteil = clamp(scouting, 0, SCOUTING_SKALA) / SCOUTING_SKALA;
  return ohne + (beste - ohne) * anteil;
}

/**
 * Was der Stab über einen Kandidaten sagen kann: für jede Position ein
 * Korridor um die Prognose, dazu ein Korridor um sein Talent — beide um die
 * echten Werte herum, nie verschoben, nur unterschiedlich breit.
 *
 * Das Talent ist keiner Position eigen, aber die Einschätzung schon: gefragt
 * wird der Stab für die Gruppe, in der der Kandidat am ehesten landet — seine
 * beste Prognose. Ein Coach, der nur Quarterbacks versteht, schätzt einen
 * Linebacker nicht treffsicherer ein, nur weil beide Menschen sind.
 * @param {import('./coach.js').Coach[] | undefined} stab
 * @param {{ attribute: Record<string, number>, ziel: number, groesse: number, gewicht: number,
 *   talent: number }} k
 * @returns {{ positionen: { position: string, wert: number, korridor: [number, number] }[],
 *   talentKorridor: [number, number] }}
 */
export function kandidatEinschaetzung(stab, k) {
  const liste = prognosen(k);
  const positionen = liste.map((p) => {
    const breite = korridorBreite(
      scoutingWert(stab, p.position), PROGNOSE_KORRIDOR_OHNE, PROGNOSE_KORRIDOR_BESTE);
    return { ...p, korridor: /** @type {[number, number]} */ ([p.wert - breite, p.wert + breite]) };
  });

  const talentBreite = korridorBreite(
    scoutingWert(stab, liste[0].position), TALENT_KORRIDOR_OHNE, TALENT_KORRIDOR_BESTE);
  const talentKorridor = /** @type {[number, number]} */ ([
    clamp(Math.round(k.talent - talentBreite), TALENT_MIN, TALENT_MAX),
    clamp(Math.round(k.talent + talentBreite), TALENT_MIN, TALENT_MAX),
  ]);
  return { positionen, talentKorridor };
}

/**
 * Eine Woche Rookie-Training für einen, der gerade darin steht. Die Stärke
 * wächst mit — sie ist, was er heute auf seiner Position wert ist.
 * @param {import('./spieler.js').Spieler} sp @param {number} tag
 * @returns {boolean} ob trainiert wurde
 */
export function rookieTraining(sp, tag) {
  if (!sp.rookieTrainingBis || tag > sp.rookieTrainingBis || !sp.rookieZiel) return false;
  trainiere(sp.attribute, trainingsSoll(sp, sp.rookieZiel, sp.position));
  sp.staerke = wertAufPosition(sp.attribute, sp.position);
  return true;
}

// --- Die Zusagen -------------------------------------------------------------

/**
 * Ob heute die Antworten fällig sind: `TRYOUT_BEDENKZEIT` Tage nach dem
 * Tryout, sofern der Manager den Platz verlassen hat. Hat er das nicht, hält
 * die offene Nachricht den Kalender ohnehin an.
 * @param {import('./saison.js').SpielStand} stand @param {number} tag
 */
export function entscheidungFaellig(stand, tag) {
  const t = recruitingVon(stand).tryout;
  return !!t && t.jahr === stand.jahr && t.abgeschlossen && tag >= t.tag + TRYOUT_BEDENKZEIT;
}

/**
 * Aus einem Kandidaten einen Spieler machen, auf der Position, die ihm am
 * besten liegt. Commitment und die zweite Wahrheit kommen erst jetzt dazu —
 * sie gehören zu einem, der im Verein ist, nicht zu einem, der zuschaut.
 * @param {Kandidat} k @param {number} jahr @param {string} seed
 * @returns {import('./spieler.js').Spieler}
 */
function alsSpieler(k, jahr, seed) {
  const rng = makeRng(`${seed}|rookie|${k.id}`);
  const position = /** @type {import('./constants.js').Position} */ (prognosen(k)[0].position);
  const lebenslage = { ...k.lebenslage };
  const commitment = ziehCommitment(rng, lebenslage, jahr);
  lebenslage.horizontWahrheit = ziehWahrheit(
    rng, lebenslage.horizont, lebenslage.status, k.alter, jahr, lebenslage.familie);
  return {
    id: k.id,
    vorname: k.vorname,
    nachname: k.nachname,
    position,
    seite: seiteFuer(k.id, position),
    einsaetze: {},
    nummer: OHNE_NUMMER,
    alter: k.alter,
    staerke: wertAufPosition(k.attribute, position),
    talent: k.talent,
    ruecktrittAlter: RUECKTRITT_ALTER,
    verletztBis: 0,
    groesse: k.groesse,
    gewicht: k.gewicht,
    attribute: { ...k.attribute },
    kickStaerke: k.kickStaerke,
    kickGenauigkeit: k.kickGenauigkeit,
    commitment,
    lebenslage,
    rookieZiel: k.ziel,
    rookieTrainingBis: null,
  };
}

/**
 * Die Seite, auf der er ausgebildet wird, wo die Position eine kennt. Aus der
 * Id, damit ein Hin und Her in der Auswahl nicht jedes Mal neu würfelt.
 * @param {string} id @param {string} position
 * @returns {'L'|'R'|null}
 */
function seiteFuer(id, position) {
  if (!SEITEN_POSITIONEN.includes(/** @type {any} */ (position))) return null;
  return makeRng(`seite|${id}`)() < 0.5 ? 'L' : 'R';
}

/**
 * Die Antworten der Kandidaten — und das Sicherheitsnetz, falls der Kader
 * danach unter `KADER_MINIMUM` läge.
 *
 * Das Netz hat zwei Stufen. Zuerst rücken aus dem Tryout selbst die nach, die
 * knapp dran waren — aber nur, wer **unter dem Ligaschnitt** liegt, in Stärke
 * und Talent. Reicht das nicht, kommen weitere dazu, die der Verein noch
 * auftreibt, gezogen aus der Ligamitte ohne den Vereinsanteil und ebenfalls
 * darunter gedeckelt. Wer wenig Spieler hat, soll auffüllen können, aber
 * nicht besser: ein dünner Kader darf sich nicht lohnen.
 *
 * Wer kommt, landet in `neue` und wartet dort auf seine Position.
 * @param {import('./saison.js').SpielStand} stand @param {number} tag
 * @returns {{ zusagen: number, nachgerueckt: string[], kandidaten: number } | null}
 */
export function entscheide(stand, tag) {
  const r = recruitingVon(stand);
  const tryout = r.tryout;
  if (!tryout) return null;
  const rng = makeRng(`${stand.seed}|zusagen|${tryout.jahr}|${tryout.tag}`);

  // Jeder würfelt, auch wer am Ende nachrückt: so hängt das Ergebnis eines
  // Kandidaten nicht daran, wie viele vor ihm zugesagt haben.
  const wuerfe = tryout.kandidaten.map((k) => rng() < k.interesse / 100);
  const kommen = tryout.kandidaten.filter((_, i) => wuerfe[i]);

  const eigen = stand.kader[stand.meinTeam] || [];
  let fehlen = KADER_MINIMUM - eigen.length - kommen.length;
  /** @type {Kandidat[]} */
  const netz = [];
  if (fehlen > 0) {
    const liga = ligaSchnitt(stand);
    const knapp = tryout.kandidaten
      .filter((k, i) => !wuerfe[i] && k.ziel < liga.staerke && k.talent < liga.talent)
      .sort((a, b) => b.interesse - a.interesse)
      .slice(0, fehlen);
    netz.push(...knapp);
    fehlen -= knapp.length;

    const belegteNamen = new Set([...eigen, ...tryout.kandidaten]
      .map((s) => s.vorname + ' ' + s.nachname));
    const uniKm = teamById(stand.meinTeam).uniKm;
    for (let i = 0; i < fehlen; i++) {
      netz.push(ziehKandidat(rng, {
        id: `t${tryout.jahr}-${tryout.tag}-n${i + 1}`,
        basis: liga.staerke,
        deckel: liga,
        herkunft: 'mundpropaganda',
        jahr: stand.jahr,
        uniKm,
        belegteNamen,
      }));
    }
  }

  r.neue = [...kommen, ...netz].map((k) => alsSpieler(k, stand.jahr, stand.seed));
  r.tryout = null;
  return { zusagen: kommen.length, nachgerueckt: netz.map((k) => k.id), kandidaten: tryout.kandidaten.length };
}

/**
 * Einem Neuen eine andere Position geben, bevor er übernommen wird. Die Stärke
 * zieht mit — sie ist, was er auf **dieser** Position heute wäre.
 * @param {import('./saison.js').SpielStand} stand @param {string} spielerId @param {string} position
 * @returns {boolean}
 */
export function setzeRookiePosition(stand, spielerId, position) {
  const sp = recruitingVon(stand).neue.find((s) => s.id === spielerId);
  if (!sp || !POSITIONS.includes(/** @type {any} */ (position))) return false;
  sp.position = /** @type {import('./constants.js').Position} */ (position);
  sp.seite = seiteFuer(sp.id, position);
  sp.staerke = wertAufPosition(sp.attribute, position);
  return true;
}

/**
 * Die Neuen übernehmen: in den Kader, eine Nummer, und ab heute sechs Wochen
 * Rookie-Training.
 * @param {import('./saison.js').SpielStand} stand @param {number} tag
 * @returns {import('./spieler.js').Spieler[]}
 */
export function uebernimmNeue(stand, tag) {
  const r = recruitingVon(stand);
  const neue = r.neue;
  if (neue.length === 0) return [];
  for (const sp of neue) sp.rookieTrainingBis = tag + ROOKIE_TRAINING_WOCHEN * 7;
  const rng = makeRng(`${stand.seed}|nummern|${stand.jahr}|${tag}`);
  stand.kader[stand.meinTeam] = vergebeNummern(rng,
    sortiereKader([...(stand.kader[stand.meinTeam] || []), ...neue]));
  r.neue = [];
  return neue;
}

// --- Was der Manager sieht ---------------------------------------------------

/**
 * Eine Zahl gegen den Ligaschnitt, als Stufe 0..4. Grob mit Absicht: ein
 * Samstagvormittag zeigt, wer schnell ist, nicht wie schnell.
 *
 * `schnitt` ist der Ligaschnitt **dieses einen** Attributs
 * (`ligaSchnitt(stand).athletik[a]`), nicht die Gesamtstärke — siehe die
 * Begründung dort. Wer die Gesamtstärke hineingibt, sieht bei `ausdauer` und
 * `robustheit` fast nur Stufe 0, ganz gleich, wie athletisch der Kandidat ist.
 * @param {number} wert @param {number} schnitt
 * @returns {0|1|2|3|4}
 */
export function athletikStufe(wert, schnitt) {
  const d = wert - schnitt;
  return d >= 8 ? 4 : d >= 2 ? 3 : d >= -4 ? 2 : d >= -10 ? 1 : 0;
}

/**
 * Eine Prognose gegen den Ligaschnitt, als Stufe 0..3. Die meisten Rookies
 * landen darunter — das ist die Wahrheit über ein Tryout, nicht ein Fehler.
 * @param {number} wert @param {number} schnitt
 * @returns {0|1|2|3}
 */
export function prognoseStufe(wert, schnitt) {
  const d = wert - schnitt;
  return d >= 3 ? 3 : d >= -3 ? 2 : d >= -9 ? 1 : 0;
}

/**
 * Das Interesse als Stufe 0..4 — wie beim Commitment sieht der Manager nie die
 * Zahl, nur, wie einer wirkt.
 * @param {number} interesse
 * @returns {0|1|2|3|4}
 */
export function interesseStufe(interesse) {
  return interesse >= 80 ? 4 : interesse >= 60 ? 3 : interesse >= 40 ? 2 : interesse >= 20 ? 1 : 0;
}

/**
 * Ob ein Spieler gerade im Rookie-Training steht.
 * @param {import('./spieler.js').Spieler} sp @param {number} tag
 */
export function imRookieTraining(sp, tag) {
  return !!sp.rookieTrainingBis && tag <= sp.rookieTrainingBis;
}
