// @ts-check
/**
 * Was eine Position ausmacht: der Körper, in dem sie steckt, und die beiden
 * Formeln, nach denen sie bewertet wird.
 *
 * Reine Daten plus die Ableitungen daraus. Kein DOM, keine Zufallsquelle — wer
 * hier etwas liest, bekommt für dieselbe Position immer dasselbe zurück.
 *
 * Docs: docs/umbau-positionsmodell.md, Abschnitte 2 und 3
 */

import { ATTRIBUTE, GRUPPE_JE_POSITION, EINHEIT_JE_GRUPPE, interpoliere, clamp } from './constants.js';

/**
 * Größe (cm) und Gewicht (kg), in denen eine Position normalerweise steckt.
 * Das ist das Ideal, nicht die Regel: etwa ein Fünftel der Spieler steht
 * daneben, und wer daneben steht, hat die Werte dazu.
 * @type {Record<string, { groesse: [number, number], gewicht: [number, number] }>}
 */
export const KOERPER_KORRIDOR = {
  QB:   { groesse: [178, 195], gewicht: [85, 100] },
  RB:   { groesse: [172, 185], gewicht: [82, 98] },
  FB:   { groesse: [175, 188], gewicht: [95, 112] },
  WR:   { groesse: [175, 190], gewicht: [78, 92] },
  SL:   { groesse: [170, 183], gewicht: [75, 88] },
  TE:   { groesse: [185, 198], gewicht: [95, 115] },
  T:    { groesse: [185, 200], gewicht: [110, 140] },
  G:    { groesse: [180, 195], gewicht: [105, 135] },
  C:    { groesse: [180, 192], gewicht: [100, 125] },
  DE:   { groesse: [185, 198], gewicht: [100, 120] },
  DT:   { groesse: [183, 195], gewicht: [115, 140] },
  NT:   { groesse: [180, 193], gewicht: [125, 150] },
  MIKE:  { groesse: [180, 192], gewicht: [100, 118] },
  SAM:  { groesse: [183, 193], gewicht: [100, 118] },
  WILL: { groesse: [178, 188], gewicht: [90, 105] },
  CB:   { groesse: [172, 185], gewicht: [75, 90] },
  FS:   { groesse: [178, 188], gewicht: [82, 95] },
  SS:   { groesse: [180, 190], gewicht: [88, 102] },
};

/**
 * Die Mitte des Gewichtskorridors. Der Abstand zweier Mitten ist später der
 * Körpermalus einer Umstellung — ein 137-Kilo-Mann spielt keinen Cornerback,
 * auch wenn sein Tackling stimmt.
 * @param {string} position
 */
export function korridorMitte(position) {
  const [von, bis] = KOERPER_KORRIDOR[position].gewicht;
  return (von + bis) / 2;
}

/**
 * Jede Position hat zwei Formeln: einen Passwert und einen Laufwert. Alle
 * Anteile in Prozent, jede Spalte summiert auf 100.
 *
 * `technik` steht in jeder einzelnen davon. Der Anteil ist der Träger des
 * Umstellungsabschlags — ohne ihn kostet ein Positionswechsel nichts.
 *
 * MIKE und SAM sind bewusst physisch geschnitten, WILL bewusst athletisch: die
 * drei Linebacker sollen auseinanderliegen, MIKE und SAM als Brücke zur Line,
 * WILL als Brücke zur Secondary. Ständen alle drei in der Mitte, landete jeder
 * von ihnen bei den Safeties.
 * @type {Record<string, { pass: Record<string, number>, lauf: Record<string, number> }>}
 */
export const FORMELN = {
  QB: {
    pass: { werfen: 40, spielverstaendnis: 25, technik: 15, beweglichkeit: 10, ballsicherheit: 10 },
    lauf: { schnelligkeit: 30, beweglichkeit: 25, spielverstaendnis: 15, ballsicherheit: 10, technik: 10, kraft: 10 },
  },
  RB: {
    pass: { blocken: 30, fangen: 25, technik: 15, routeRunning: 10, beweglichkeit: 10, ballsicherheit: 10 },
    lauf: { schnelligkeit: 25, beweglichkeit: 25, kraft: 20, ballsicherheit: 15, technik: 15 },
  },
  FB: {
    pass: { blocken: 45, kraft: 20, fangen: 20, technik: 15 },
    lauf: { blocken: 35, kraft: 30, technik: 15, ballsicherheit: 10, beweglichkeit: 10 },
  },
  WR: {
    pass: { fangen: 28, routeRunning: 22, schnelligkeit: 18, beweglichkeit: 12, technik: 10, ballsicherheit: 10 },
    lauf: { blocken: 50, schnelligkeit: 20, kraft: 15, technik: 15 },
  },
  SL: {
    pass: { routeRunning: 28, fangen: 22, beweglichkeit: 22, technik: 10, schnelligkeit: 9, ballsicherheit: 9 },
    lauf: { blocken: 40, beweglichkeit: 20, technik: 20, schnelligkeit: 20 },
  },
  TE: {
    pass: { fangen: 30, routeRunning: 20, beweglichkeit: 15, technik: 15, kraft: 10, ballsicherheit: 10 },
    lauf: { blocken: 45, kraft: 25, technik: 20, beweglichkeit: 10 },
  },
  T: {
    pass: { blocken: 45, beweglichkeit: 20, technik: 20, kraft: 15 },
    lauf: { blocken: 45, kraft: 30, technik: 15, beweglichkeit: 10 },
  },
  G: {
    pass: { blocken: 40, kraft: 35, technik: 20, beweglichkeit: 5 },
    lauf: { kraft: 40, blocken: 35, technik: 20, beweglichkeit: 5 },
  },
  C: {
    pass: { blocken: 40, kraft: 30, spielverstaendnis: 15, technik: 15 },
    lauf: { kraft: 35, blocken: 35, technik: 20, spielverstaendnis: 10 },
  },
  DE: {
    pass: { passrush: 45, beweglichkeit: 25, technik: 20, kraft: 10 },
    lauf: { tacklen: 30, kraft: 25, technik: 20, spielverstaendnis: 15, beweglichkeit: 10 },
  },
  DT: {
    pass: { passrush: 35, kraft: 30, technik: 20, beweglichkeit: 15 },
    lauf: { kraft: 35, tacklen: 25, technik: 20, spielverstaendnis: 20 },
  },
  NT: {
    pass: { kraft: 45, passrush: 25, technik: 20, beweglichkeit: 10 },
    lauf: { kraft: 50, tacklen: 20, technik: 15, spielverstaendnis: 15 },
  },
  MIKE: {
    pass: { spielverstaendnis: 28, coverage: 20, passrush: 14, technik: 15, kraft: 13, schnelligkeit: 10 },
    lauf: { tacklen: 32, kraft: 28, spielverstaendnis: 25, technik: 15 },
  },
  SAM: {
    pass: { passrush: 28, coverage: 22, spielverstaendnis: 20, technik: 15, schnelligkeit: 15 },
    lauf: { tacklen: 33, kraft: 27, technik: 20, spielverstaendnis: 20 },
  },
  WILL: {
    pass: { coverage: 36, schnelligkeit: 22, spielverstaendnis: 18, beweglichkeit: 14, technik: 10 },
    lauf: { tacklen: 26, schnelligkeit: 26, spielverstaendnis: 17, beweglichkeit: 16, technik: 15 },
  },
  CB: {
    pass: { coverage: 32, schnelligkeit: 22, beweglichkeit: 18, technik: 10, spielverstaendnis: 9, fangen: 9 },
    lauf: { tacklen: 34, schnelligkeit: 21, spielverstaendnis: 17, technik: 15, kraft: 13 },
  },
  FS: {
    pass: { coverage: 27, spielverstaendnis: 27, schnelligkeit: 18, fangen: 18, technik: 10 },
    lauf: { spielverstaendnis: 34, tacklen: 30, schnelligkeit: 21, technik: 15 },
  },
  SS: {
    pass: { spielverstaendnis: 27, coverage: 27, tacklen: 18, schnelligkeit: 18, technik: 10 },
    lauf: { tacklen: 34, spielverstaendnis: 21, kraft: 17, technik: 15, schnelligkeit: 13 },
  },
};

/**
 * Wo eine Position ihren Wert verdient: Blockgewicht mal Platzanteil, einmal
 * fürs Passspiel und einmal fürs Laufspiel. Daraus kommt allein, wie schwer
 * die beiden Formeln beim Ziehen eines Spielers wiegen.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 2 und 6
 * @type {Record<string, { pass: number, lauf: number }>}
 */
export const PROFIL_BEITRAG = {
  QB:   { pass: 0.400, lauf: 0.200 },
  RB:   { pass: 0.053, lauf: 0.120 },
  FB:   { pass: 0.035, lauf: 0.100 },
  WR:   { pass: 0.105, lauf: 0.040 },
  SL:   { pass: 0.088, lauf: 0.060 },
  TE:   { pass: 0.070, lauf: 0.080 },
  T:    { pass: 0.063, lauf: 0.076 },
  G:    { pass: 0.045, lauf: 0.096 },
  C:    { pass: 0.035, lauf: 0.056 },
  DE:   { pass: 0.112, lauf: 0.092 },
  DT:   { pass: 0.070, lauf: 0.104 },
  NT:   { pass: 0.056, lauf: 0.112 },
  MIKE:  { pass: 0.080, lauf: 0.160 },
  SAM:  { pass: 0.058, lauf: 0.140 },
  WILL: { pass: 0.113, lauf: 0.100 },
  CB:   { pass: 0.120, lauf: 0.034 },
  FS:   { pass: 0.100, lauf: 0.052 },
  SS:   { pass: 0.060, lauf: 0.080 },
};

/**
 * Wie stark das Passspiel beim Ziehen der Attribute wiegt.
 *
 * Nicht der einfache Mittelwert der beiden Formeln: die Laufformel eines
 * Receivers ist `blocken 50`, weil er im Laufspiel blockt. Gemittelt wäre
 * Blocken sein größtes Attribut und jeder Receiver käme als Top-Blocker aus
 * der Ziehung. Gewichtet wird deshalb danach, wo die Position ihren Wert
 * verdient.
 * @param {string} position
 */
export function profilPassAnteil(position) {
  const b = PROFIL_BEITRAG[position];
  return b.pass / (b.pass + b.lauf);
}

/**
 * Zwei Formeln zu einer mischen. `passAnteil` 1 ist reines Passspiel, 0 reines
 * Laufspiel. Das Ergebnis sind Anteile, die auf 1 summieren — nicht auf 100,
 * damit ein Wert daraus direkt auf der Stärkeskala liegt.
 * @param {string} position
 * @param {number} passAnteil 0..1
 * @returns {Record<string, number>}
 */
export function gemischteFormel(position, passAnteil) {
  const { pass, lauf } = FORMELN[position];
  /** @type {Record<string, number>} */
  const anteile = {};
  for (const attribut of ATTRIBUTE) {
    const anteil = (pass[attribut] || 0) * passAnteil + (lauf[attribut] || 0) * (1 - passAnteil);
    if (anteil > 0) anteile[attribut] = anteil / 100;
  }
  return anteile;
}

/**
 * Das Profil, nach dem die Spieler einer Position gezogen werden. Eine Position
 * hat zwei Formeln, aber nur ein Profil.
 * @param {string} position
 */
export function generierungsProfil(position) {
  return gemischteFormel(position, profilPassAnteil(position));
}

/**
 * Was ein Satz Attribute nach einer Formel wert ist.
 * @param {Record<string, number>} werte
 * @param {Record<string, number>} anteile Anteile, die auf 1 summieren
 */
export function bewerte(werte, anteile) {
  let summe = 0;
  for (const attribut in anteile) summe += (werte[attribut] || 0) * anteile[attribut];
  return summe;
}

// --- Plätze ----------------------------------------------------------------
// Docs: docs/umbau-positionsmodell.md, Abschnitte 1 und 5

/**
 * Was dieses Modul von einem Spieler braucht. Nicht der volle `Spieler` aus
 * `spieler.js` — so lassen sich die Formeln mit einem Muster aus drei Feldern
 * prüfen, ohne einen ganzen Mann zu ziehen.
 * @typedef {object} Spielbar
 * @property {string} position          Worauf er ausgebildet wurde
 * @property {'L'|'R'|null} [seite]
 * @property {number} [gewicht]        Kilo — damit rechnet der Körpermalus
 * @property {Record<string, number>} [einsaetze] Spiele je Platz-Kürzel
 * @property {Record<string, number>} [attribute]
 */

/**
 * Die Plätze, die eine Aufstellung kennt. Links und rechts sind Plätze, keine
 * Positionen: der Katalog kennt `T`, die Formation kennt `LT` und `RT`.
 *
 * Wo eine Position keine Seite kennt, tragen ihre Plätze auch keine: `CB1` und
 * `CB2` sind zwei gleichwertige Plätze, kein linker und kein rechter. Angezeigt
 * heißen beide `CB` — siehe `platzKuerzel()`.
 * @type {Record<string, { position: string, seite?: 'L'|'R' }>}
 */
export const PLAETZE = {
  QB: { position: 'QB' },
  RB: { position: 'RB' },
  FB: { position: 'FB' },
  WR: { position: 'WR' },
  SL: { position: 'SL' },
  TE: { position: 'TE' },
  LT: { position: 'T', seite: 'L' },
  RT: { position: 'T', seite: 'R' },
  LG: { position: 'G', seite: 'L' },
  RG: { position: 'G', seite: 'R' },
  C: { position: 'C' },
  LE: { position: 'DE', seite: 'L' },
  RE: { position: 'DE', seite: 'R' },
  DT: { position: 'DT' },
  NT: { position: 'NT' },
  MIKE: { position: 'MIKE' },
  SAM: { position: 'SAM' },
  WILL: { position: 'WILL' },
  CB1: { position: 'CB' },
  CB2: { position: 'CB' },
  FS: { position: 'FS' },
  SS: { position: 'SS' },
};

/**
 * Die Positionen, auf denen ein Spieler auf einer Seite ausgebildet wird.
 * Für alle anderen ist die Seite keine Größe.
 *
 * `CB` und `WR` stehen bewusst nicht mehr darin. Ihr Seitenwechsel kostete
 * nichts, also trug die Seite dort keine Regel — sie stand nur in der Anzeige
 * herum und legte einen Unterschied nahe, den das Modell nicht kennt.
 */
export const SEITEN_POSITIONEN = /** @type {const} */ (['T', 'G', 'DE']);

/**
 * Was ein Seitenwechsel von der Technik übrig lässt. Bewusst positionsabhängig:
 * außen in der Line ist die Seite Gewöhnungssache, weiter innen nicht.
 * @type {Record<string, number>}
 */
export const SEITENWECHSEL = {
  DE: 0.98,
  G: 0.92,
  T: 0.90,
};

/**
 * Wie eine Position mit Seite geschrieben wird. Der Katalog kennt `T`, `G` und
 * `DE`; auf dem Feld heißen sie `LT`/`RT`, `LG`/`RG` und `LE`/`RE` — dieselben
 * Namen, unter denen `PLAETZE` die Plätze führt. Wer keine Seite hat, steht
 * unter seinem Katalognamen.
 * @type {Record<string, Record<'L'|'R', string>>}
 */
export const SEITEN_KUERZEL = {
  T: { L: 'LT', R: 'RT' },
  G: { L: 'LG', R: 'RG' },
  DE: { L: 'LE', R: 'RE' },
};

/**
 * Der Platz, auf dem er **ausgebildet** wurde: `LT`, `RE`, `MIKE`, `CB`. Das
 * ist die Zuschreibung aus der Ziehung, und sie ändert sich nie — Körper und
 * Attribute stammen daraus.
 * @param {{ position: string, seite?: 'L'|'R'|null }} spieler
 */
export function ausbildungsKuerzel(spieler) {
  const mitSeite = spieler.seite && SEITEN_KUERZEL[spieler.position];
  return (mitSeite && mitSeite[spieler.seite]) || spieler.position;
}

/**
 * Wie ein Spieler auf dem Bogen steht — sein **Hauptplatz**, nicht seine
 * Ausbildung. Wer lange genug woanders spielt, steht irgendwann dort.
 * @param {Spielbar} spieler
 */
export function positionsKuerzel(spieler) {
  return hauptPlatz(spieler);
}

/**
 * Wie ein Platz beschriftet wird. Fast immer sein eigener Schlüssel — nur wo
 * zwei gleichwertige Plätze dieselbe Position tragen, fällt die Nummer weg.
 * @param {string} platz
 */
export function platzKuerzel(platz) {
  return PLATZ_KUERZEL[platz] || platz;
}

/** @type {Record<string, string>} */
const PLATZ_KUERZEL = { CB1: 'CB', CB2: 'CB' };

/**
 * Die Position hinter einem Kürzel. `LG` ist ein `G`, `CB` ein `CB`.
 * @type {Record<string, string>}
 */
export const POSITION_JE_KUERZEL = Object.fromEntries(
  Object.entries(PLAETZE).map(([platz, def]) => [platzKuerzel(platz), def.position]),
);

/**
 * Ein Platz je Kürzel — der Rückweg. Wo zwei Plätze dasselbe Kürzel tragen,
 * steht einer von beiden; sie sind per Definition gleichwertig.
 * @type {Record<string, string>}
 */
export const PLATZ_JE_KUERZEL = Object.fromEntries(
  Object.keys(PLAETZE).map((platz) => [platzKuerzel(platz), platz]),
);

// --- Eingespieltheit -------------------------------------------------------
// Docs: docs/umbau-positionsmodell.md, Abschnitt 4

/**
 * Wie viel von der fehlenden Technik ein Spieler sich auf einem fremden Platz
 * erarbeitet hat. Die Stufenleiter unten sagt, was er **mitbringt**; diese
 * Kurve sagt, was er sich dazuholt.
 *
 * Zehn Einsätze sind eine Saison. Nach dreien ist die Lücke geschlossen — und
 * genau dann trägt der neue Platz auch mehr Punkte als der ausgebildete, siehe
 * `EINGESPIELT_VOLL`.
 * @type {[number, number][]}
 */
export const EINGESPIELT_KURVE = [[0, 0], [5, 0.35], [10, 0.60], [20, 0.85], [30, 1]];

/**
 * Ab wie vielen Einsätzen ein Platz als eingespielt gilt. Dieselbe Zahl, bei
 * der die Kurve oben ankommt: der ausgebildete Platz zählt von Anfang an so
 * viel, also braucht es drei volle Saisons woanders, um den Pass zu drehen.
 * Ein einzelner Aushilfseinsatz dreht nichts.
 */
export const EINGESPIELT_VOLL = 30;

/**
 * Was ein Platz je Saison verliert. Er wird auf jedem Platz gerechnet, auch
 * dem gespielten — der holt sich seine elf Einsätze ja gleich wieder. Ohne den
 * Verfall hätte ein Vierunddreißigjähriger irgendwann alles einmal gespielt.
 */
export const EINSATZ_VERFALL = 0.93;

/**
 * Wie oft er auf einem Platz stand. Nach Kürzel, nicht nach Platzschlüssel:
 * `CB1` und `CB2` sind derselbe Platz, `LG` und `RG` nicht.
 * @param {Spielbar} spieler
 * @param {string} platz Schlüssel aus PLAETZE
 */
export function einsaetzeAuf(spieler, platz) {
  const einsaetze = spieler.einsaetze;
  return (einsaetze && einsaetze[platzKuerzel(platz)]) || 0;
}

/**
 * Wie eingespielt er dort ist: 0 beim ersten Mal, 1 nach drei Saisons.
 * @param {Spielbar} spieler
 * @param {string} platz
 */
export function eingespieltheit(spieler, platz) {
  return interpoliere(EINGESPIELT_KURVE, einsaetzeAuf(spieler, platz));
}

/**
 * Nach welchem Passanteil der Hauptplatz entschieden wird: hälftig, für jeden
 * gleich. Wo ein Verein steht, ist Taktik — wer ein Spieler ist, nicht. Sonst
 * änderte der Regler im Taktikreiter die Überschriften im Roster.
 */
export const HAUPTPLATZ_PASSANTEIL = 0.5;

/**
 * Der Platz, auf dem er zu Hause ist.
 *
 * Nicht gespeichert, sondern abgeleitet — es gibt keinen zweiten Zustand, der
 * mit den Einsätzen auseinanderlaufen könnte. Zwei Dinge müssen zusammenkommen,
 * damit ein fremder Platz die Heimat ablöst:
 *
 * 1. **Mehr Einsätze**, als der ausgebildete Platz mit `EINGESPIELT_VOLL`
 *    mitbringt. Sonst schöbe der erste Aushilfseinsatz eines Neulings ihn
 *    schon woandershin.
 * 2. **Mindestens so stark** dort wie daheim. Die Einsätze allein sagen nur,
 *    wo er gestanden hat; ob er dort auch hingehört, sagt die Eignung. Ein
 *    Linebacker, den der Kadermangel drei Saisons lang auf Cornerback stellt,
 *    ohne dass er je einer wird, bleibt im Roster ein Linebacker.
 *
 * Der zweite Punkt ist nicht kosmetisch: `stelleAuf()` baut daraus in Runde
 * eins den Bewerberkreis je Position.
 * @param {Spielbar} spieler
 */
export function hauptPlatz(spieler) {
  const heimat = ausbildungsKuerzel(spieler);
  let bester = heimat;
  let meiste = EINGESPIELT_VOLL;
  for (const kuerzel in spieler.einsaetze || {}) {
    const punkte = kuerzel === heimat
      ? Math.max(spieler.einsaetze[kuerzel], EINGESPIELT_VOLL)
      : spieler.einsaetze[kuerzel];
    if (punkte > meiste && mindestensSoStark(spieler, kuerzel, heimat)) {
      meiste = punkte;
      bester = kuerzel;
    }
  }
  return bester;
}

/**
 * Ob er auf `kuerzel` mindestens so viel wert ist wie auf seinem
 * Ausbildungsplatz. Ohne Attribute — ein Muster aus zwei Feldern — lässt sich
 * das nicht beantworten; dann zählen die Einsätze allein.
 * @param {Spielbar} spieler
 * @param {string} kuerzel
 * @param {string} heimat
 */
function mindestensSoStark(spieler, kuerzel, heimat) {
  const dort = PLATZ_JE_KUERZEL[kuerzel];
  const daheim = PLATZ_JE_KUERZEL[heimat];
  if (!spieler.attribute || !dort || !daheim) return true;
  return eignungGemischt(spieler, dort, HAUPTPLATZ_PASSANTEIL)
    >= eignungGemischt(spieler, daheim, HAUPTPLATZ_PASSANTEIL);
}

/**
 * Die Position seines Hauptplatzes. Danach wird er einsortiert und
 * aufgestellt — nicht nach der Ausbildung.
 * @param {Spielbar} spieler
 */
export function hauptPosition(spieler) {
  return POSITION_JE_KUERZEL[hauptPlatz(spieler)] || spieler.position;
}

/**
 * Die Stufenleiter des Technik-Transfers: was ein Spieler von seinem Handwerk
 * mitnimmt, wenn er woanders steht.
 */
export const TRANSFER_GRUPPE = 0.70;    // Nachbarposition derselben Gruppe
export const TRANSFER_EINHEIT = 0.45;   // andere Gruppe derselben Einheit
export const TRANSFER_FREMD = 0.25;     // andere Einheit, Offense gegen Defense

/** Körpermalus: je Kilo Abstand der Korridormitten, gedeckelt. */
export const KOERPERMALUS_JE_KILO = 0.004;
/**
 * Der zweite Satz, auf Kilo mal Kilo: was sein eigener Körper zum Abstand der
 * Mitten dazutut. Er ist so gewählt, dass ein Mann, der 25 kg neben seiner
 * Korridormitte steht, den Malus einer mittelweiten Umstellung verdoppelt.
 */
export const KOERPERMALUS_JE_KILOQUADRAT = 0.00024;
export const KOERPERMALUS_DECKEL = 0.20;

/**
 * Was ein Spieler von seiner Technik behält, wenn er auf `platz` spielt.
 *
 * `technik` hängt am Platz, auf dem er ausgebildet wurde. Der Umstellungs-
 * abschlag entsteht damit aus dem Modell selbst — es braucht keine Strafe von
 * außen. Wo die Formation keine Seiten unterscheidet, kostet die Seite nichts.
 *
 * Die Stufenleiter ist dabei der **Startpunkt**, nicht das Ergebnis: was er
 * dort gespielt hat, schließt die Lücke. Wer drei Saisons als MIKE aufläuft,
 * hat die Technik eines MIKE — was er nicht bekommt, ist dessen Körper und
 * dessen Profil, und die beiden tragen den Löwenanteil des Abstands.
 * @param {Spielbar} spieler
 * @param {string} platz Schlüssel aus PLAETZE
 */
export function technikTransfer(spieler, platz) {
  const leiter = leiterTransfer(spieler, platz);
  if (leiter >= 1) return 1;
  return leiter + (1 - leiter) * eingespieltheit(spieler, platz);
}

/**
 * Was er ohne einen einzigen Einsatz dort mitbrächte — die reine Stufenleiter.
 * @param {{ position: string, seite?: 'L'|'R'|null }} spieler
 * @param {string} platz
 */
export function leiterTransfer(spieler, platz) {
  const ziel = PLAETZE[platz];
  if (!ziel) throw new Error(`Unbekannter Platz: ${platz}`);

  if (spieler.position === ziel.position) {
    const gleicheSeite = !spieler.seite || !ziel.seite || spieler.seite === ziel.seite;
    return gleicheSeite ? 1 : (SEITENWECHSEL[ziel.position] ?? 1);
  }
  const gruppeA = GRUPPE_JE_POSITION[spieler.position];
  const gruppeB = GRUPPE_JE_POSITION[ziel.position];
  if (gruppeA === gruppeB) return TRANSFER_GRUPPE;
  if (EINHEIT_JE_GRUPPE[gruppeA] === EINHEIT_JE_GRUPPE[gruppeB]) return TRANSFER_EINHEIT;
  return TRANSFER_FREMD;
}

/**
 * Der zweite Abschlag: die Technik allein reicht nicht. Ein 137-Kilo-Mann kann
 * keinen Cornerback spielen, auch wenn sein Tackling stimmt.
 *
 * Zwei Summanden. Der erste ist der Abstand der beiden **Korridormitten** —
 * daraus fallen die groben Körperbänder der Liga von selbst an, ohne dass sie
 * gepflegt werden müssten. Der zweite ist sein **eigenes Gewicht**: wer von
 * seiner Mitte aus vom Ziel weg gebaut ist, zahlt drauf, wer in die
 * Zielrichtung gebaut ist, bekommt es gutgeschrieben. Ein 147-Kilo-Guard zahlt
 * für den Weg zum Linebacker 11,5 %, ein 105-Kilo-Guard 0,4 % — vorher waren
 * es für beide dieselben 4,4 %.
 *
 * Beide Summanden hängen am **Abstand**, nicht am Gewicht allein: bei
 * Ausbildung gleich Ziel ist der Abstand null und damit der ganze Malus, egal
 * wie schwer der Mann ist. Ohne das wäre ein Extremkörper auch auf seinem
 * eigenen Platz belastet, und die tragende Eigenschaft des Modells — auf
 * seinem Platz ist ein Spieler genau seine Stärke wert — wäre dahin.
 * @param {{ position: string, gewicht: number }} spieler
 * @param {string} nachPosition
 */
export function koerperMalus(spieler, nachPosition) {
  const eigen = korridorMitte(spieler.position);
  const abstand = eigen - korridorMitte(nachPosition);
  return clamp(
    Math.abs(abstand) * KOERPERMALUS_JE_KILO
      + abstand * (spieler.gewicht - eigen) * KOERPERMALUS_JE_KILOQUADRAT,
    0, KOERPERMALUS_DECKEL,
  );
}

/**
 * Was ein Spieler auf einem Platz wert ist, im Lauf- oder im Passspiel.
 *
 * Drei Teile stecken darin. Der **Profil-Mismatch** fällt aus der Rechnung
 * selbst: gewertet wird mit der Formel der Zielposition, und wer die falschen
 * Werte mitbringt, verliert dort. Dazu kommen der **Technikverlust** über den
 * Transfer und der **Körpermalus** über den Gewichtsabstand.
 *
 * Es zählt der Technikanteil der Zielposition, nicht der Ausgangsposition —
 * dem Spieler fehlt das Handwerk des Platzes, auf dem er steht.
 * @param {{ position: string, seite?: 'L'|'R'|null, gewicht: number,
 *   attribute: Record<string, number> }} spieler
 * @param {string} platz Schlüssel aus PLAETZE
 * @param {'pass'|'lauf'} art
 */
export function eignung(spieler, platz, art) {
  const ziel = PLAETZE[platz];
  const werte = { ...spieler.attribute };
  werte.technik = werte.technik * technikTransfer(spieler, platz);

  const roh = bewerte(werte, formelAnteile(ziel.position, art));
  return roh * (1 - koerperMalus(spieler, ziel.position));
}

/**
 * Eine der beiden Formeln als Anteile, die auf 1 summieren.
 * @param {string} position
 * @param {'pass'|'lauf'} art
 */
export function formelAnteile(position, art) {
  return gemischteFormel(position, art === 'pass' ? 1 : 0);
}

/**
 * Die Eignung, nach dem Passanteil eines Vereins gemischt. Das ist die Zahl,
 * nach der eine Aufstellung entscheidet.
 * @param {{ position: string, seite?: 'L'|'R'|null, attribute: Record<string, number> }} spieler
 * @param {string} platz
 * @param {number} passAnteil 0..1
 */
export function eignungGemischt(spieler, platz, passAnteil) {
  return eignung(spieler, platz, 'pass') * passAnteil
    + eignung(spieler, platz, 'lauf') * (1 - passAnteil);
}
