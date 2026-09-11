// @ts-check
/**
 * The season: state shape, the daily tick, and the roll into the next year.
 *
 * A season is ten group matchdays plus a bracket — two semi-finals on matchday
 * eleven, the final on twelve. The bracket is appended to the Spielplan the
 * moment the round before it is complete, so `spieltag` stays one continuous
 * counter and the save never has to describe a phase separately.
 *
 * Die Uhr läuft seit dem Kalenderumbau in **Tagen**, nicht in Spieltagen: der
 * Spieltag ist nur noch das Etikett an der Partie. Nach außen steht dafür eine
 * einzige Funktion — `weiter()` —, die von selbst dort anhält, wo eine
 * Entscheidung fällig ist.
 *
 * Docs: docs/umbau-kalender.md
 */

import {
  SEASON_START_YEAR, ZUSATZ_SPIELER, EIGENE_VEREINSBASIS, WERTUNG_PUNKTE,
  makeRng, pick, clamp,
} from './constants.js';
import { TEAMS, GRUPPEN, teamById, teamsDerGruppe } from './content.js';
import {
  saisonLaenge, spieltagAmTag, phaseAmTag, phasenBeginn,
} from './kalender.js';
import {
  sende, baueNachrichten, offeneAntworten, beantworte, stutzePost,
} from './postfach.js';
import { macheKader, saisonWechsel, resetSpielerIds, spieleEinsatz, istFit } from './spieler.js';
import {
  macheGruppenplan, macheHalbfinale, macheFinale, sieger,
  anzahlSpieltage, partienAmTag, partienDerRunde,
} from './spielplan.js';
import { simuliereSpiel } from './spiel.js';
import {
  PERSONNEL, STANDARD_PERSONNEL, stelleAuf, alsVorgabe, setzePlatz, vollstaendig,
  leereVorgabe, raeumePlatz, loesePlatz,
} from './aufstellung.js';
import { berechneTabelle } from './tabelle.js';
import { teamStaerken } from './team.js';
import { ziehStab, ocVon, lerneTag, lerneSpiel } from './coach.js';

/**
 * Der Stempel auf einem Speicherstand.
 *
 * Wer die Form von `SpielStand` ändert, zählt hier hoch **und schreibt dazu
 * einen Schritt in `MIGRATIONEN` in [`save.js`](./save.js)**, der einen Stand
 * der vorigen Nummer auf diese hebt. Ohne diesen Schritt wird ein solcher Stand
 * beim Laden weggeworfen — der Sprung ist billig, der Verlust nicht.
 */
export const SAVE_VERSION = 9;

/**
 * @typedef {object} SpielStand
 * @property {number} version
 * @property {string} seed
 * @property {number} jahr            Saisonlabel; die Saison 2027 beginnt am 17.10.2026
 * @property {number} tag             Tag seit Saisonbeginn, 1-basiert — die Uhr
 * @property {string} meinTeam
 * @property {Record<string, import('./spieler.js').Spieler[]>} kader  by team id
 * @property {Record<string, import('./coach.js').Coach[]>} coaches  Der Stab je Verein — siehe `coachesVon()`
 * @property {import('./spielplan.js').Partie[]} spielplan
 * @property {Record<string, string>} personnel   Personnel-Gruppierung je Verein
 * @property {Record<string, number>} passAnteil  Ausrichtung je Verein, 0..1
 * @property {import('./aufstellung.js').Vorgabe | null} aufstellung  Von Hand, nur der eigene Verein
 * @property {import('./postfach.js').Nachricht[]} post  Der Posteingang, ältestes zuerst
 * @property {{ jahr: number, meister: string, meinPlatz: number }[]} historie
 */

/**
 * The baseline every club's Kader is drawn around, once a club has been picked.
 * The player's own club falls to EIGENE_VEREINSBASIS; the ladder of strengths
 * stays exactly as the catalogue has it, so every club that stood below the
 * pick moves up one rung. Only the generator reads this — a match is decided by
 * the players on the field, never by the club's number.
 * @param {string} meinTeam
 * @returns {Record<string, number>} club id -> baseline
 */
export function vereinsBasen(meinTeam) {
  const leiter = TEAMS.map((t) => t.staerke).sort((a, b) => b - a);
  const andere = TEAMS.filter((t) => t.id !== meinTeam).sort((a, b) => b.staerke - a.staerke);

  /** @type {Record<string, number>} */
  const basen = {};
  andere.forEach((t, i) => { basen[t.id] = leiter[i]; });
  basen[meinTeam] = EIGENE_VEREINSBASIS;
  return basen;
}

/**
 * Welches System ein Verein spielt.
 *
 * Ausgelost, aus einem eigenen Strom neben dem Saatgut des Spielstands: damit
 * lässt sich ein fehlendes Feld jederzeit deterministisch nachziehen, ohne den
 * Speicherstand hochzuzählen. Das System bleibt über die Saisons hinweg — ein
 * Verein hat eine Spielphilosophie, keine Tagesform.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 5
 * @param {string} seed
 * @returns {Record<string, string>}
 */
export function losePersonnel(seed) {
  const rng = makeRng(seed + '|personnel');
  const gruppierungen = Object.keys(PERSONNEL);
  /** @type {Record<string, string>} */
  const gelost = {};
  for (const t of TEAMS) gelost[t.id] = pick(rng, gruppierungen);
  return gelost;
}

/**
 * Das System eines Vereins, notfalls nachgezogen.
 * @param {SpielStand} stand
 * @param {string} teamId
 */
export function personnelVon(stand, teamId) {
  const gesetzt = stand.personnel && stand.personnel[teamId];
  if (gesetzt && PERSONNEL[gesetzt]) return gesetzt;
  return losePersonnel(stand.seed)[teamId] || STANDARD_PERSONNEL;
}

/**
 * Der Stab eines Vereins, notfalls nachgezogen.
 *
 * Nachgezogen heißt: aus einem eigenen Strom neben dem Saatgut, wie das
 * System in `losePersonnel()`. Das ist der Weg, über den ein Stand von vor
 * den Coaches seinen Stab bekommt — der Migrationsschritt legt nur die leere
 * Karte an, denn zöge er selbst, müsste er den heutigen Generator kennen.
 * Deterministisch ist es trotzdem, also ändert es nichts, ob der gezogene
 * Stab schon gespeichert war oder nicht.
 *
 * Die Namen weichen denen des Kaders aus, wie unter den Spielern auch: zwei
 * Hubers in einer Kabine sind nur verwirrend.
 * @param {SpielStand} stand
 * @param {string} teamId
 */
export function coachesVon(stand, teamId) {
  if (!stand.coaches) stand.coaches = {};
  const bekannt = stand.coaches[teamId];
  if (bekannt) return bekannt;

  const rng = makeRng(stand.seed + '|coaches|' + teamId);
  const belegt = new Set((stand.kader[teamId] || []).map((s) => s.vorname + ' ' + s.nachname));
  const stab = ziehStab(rng, teamId, vereinsBasen(stand.meinTeam)[teamId],
    personnelVon(stand, teamId), belegt);
  stand.coaches[teamId] = stab;
  return stab;
}

/**
 * Die Ausrichtung eines Vereins: der Vorschlag seiner Gruppierung, sofern der
 * Manager ihn nicht verschoben hat.
 * @param {SpielStand} stand
 * @param {string} teamId
 */
export function passAnteilVon(stand, teamId) {
  const gesetzt = stand.passAnteil && stand.passAnteil[teamId];
  if (typeof gesetzt === 'number') return gesetzt;
  return PERSONNEL[personnelVon(stand, teamId)].passAnteil;
}

/**
 * Was der Manager einstellen darf: alles zwischen 0 und 1.
 *
 * Früher stand hier eine Schranke um den Vorschlag der Gruppierung herum. Sie
 * ist entfallen, seit der Rollenwert im Skill-Block den Preis nennt — wer aus
 * Double Wing werfen will, darf das, und bezahlt es an der richtigen Stelle.
 * Die Funktion bleibt, weil `setzeTaktik` und die Migration durch sie gehen.
 * @param {string} personnel
 * @param {number} wunsch
 */
export function erlaubterPassAnteil(personnel, wunsch) {
  return clamp(wunsch, 0, 1);
}

/**
 * Die Taktik des eigenen Vereins ändern.
 *
 * Sie gilt ab dem nächsten Spieltag — gespielte Partien stehen im Spielplan
 * und werden nicht neu gerechnet. Es braucht dafür keine Sperre: die
 * Simulation liest den Zustand erst, wenn ein Spieltag angepfiffen wird.
 * @param {SpielStand} stand
 * @param {{ personnel?: string, passAnteil?: number }} taktik
 */
export function setzeTaktik(stand, taktik) {
  const id = stand.meinTeam;
  if (!stand.personnel) stand.personnel = {};
  if (!stand.passAnteil) stand.passAnteil = {};

  const personnel = taktik.personnel && PERSONNEL[taktik.personnel]
    ? taktik.personnel
    : personnelVon(stand, id);
  stand.personnel[id] = personnel;

  const wunsch = typeof taktik.passAnteil === 'number'
    ? taktik.passAnteil
    : PERSONNEL[personnel].passAnteil;
  stand.passAnteil[id] = erlaubterPassAnteil(personnel, wunsch);
  return stand;
}

/**
 * Die Aufstellung von Hand — und nur die des eigenen Vereins.
 *
 * Ein KI-Verein *kann* keine haben: niemand stellt ihn auf, also stellt er sich
 * automatisch auf. Das ist keine Auslassung, sondern die Regel, und sie steht
 * hier, damit sie nicht an elf Stellen einzeln nachgebaut wird.
 * @param {SpielStand} stand
 * @param {string} teamId
 * @returns {import('./aufstellung.js').Vorgabe | null}
 */
export function aufstellungVon(stand, teamId) {
  return teamId === stand.meinTeam && stand.aufstellung ? stand.aufstellung : null;
}

/**
 * Die Aufstellung, die der eigene Verein am nächsten Spieltag stellen würde:
 * die Vorgabe, repariert um alles, was ihr fehlt — bis auf die Plätze, die der
 * Manager ausdrücklich leer gelassen hat. Die bleiben leer.
 *
 * Mit `vorgabe` rechnet sie stattdessen eine andere durch, ohne sie in den
 * Stand zu schreiben. Davon lebt `aufstellungLeeren()`, das die heutige Elf
 * kennen muss, um sie Platz für Platz auf `null` zu setzen.
 * @param {SpielStand} stand
 * @param {import('./aufstellung.js').Vorgabe | null} [vorgabe]
 */
export function eigeneAufstellung(stand, vorgabe) {
  const id = stand.meinTeam;
  return stelleAuf(
    stand.kader[id], stand.tag, personnelVon(stand, id), passAnteilVon(stand, id),
    vorgabe === undefined ? aufstellungVon(stand, id) : vorgabe,
  );
}

/**
 * Woran das Bearbeiten anfängt: die Elf, die gerade steht, als Vorgabe.
 *
 * Der Manager sieht die reparierte Aufstellung vor sich und meint auch sie.
 * Der erste Handgriff friert deshalb ein, was die Automatik gestellt hatte —
 * und ändert daran genau einen Platz.
 * @param {SpielStand} stand
 * @param {import('./aufstellung.js').Vorgabe | null} [vorgabe]
 */
export function vorgabeVon(stand, vorgabe) {
  return alsVorgabe(eigeneAufstellung(stand, vorgabe));
}

/**
 * Einen Spieler auf einen Platz stellen — sofort und endgültig.
 *
 * Es gibt keinen Entwurf mehr und keinen Knopf „Speichern". Früher lag zwischen
 * dem Tipp und dem Stand ein zweiter Zustand, den die Ansicht mitführen, der
 * Reiterwechsel abfragen und der Manager bestätigen musste — drei Stellen, an
 * denen eine Aufstellung verlorengehen konnte, für einen Gewinn, den niemand
 * wollte. Wer sich vertut, tippt zurück; das kostet denselben einen Griff.
 *
 * Ein Spieler, den es im Kader nicht gibt, ändert nichts. Das ist keine
 * Höflichkeit, sondern der Schutz davor, dass eine Vorgabe eine Id festhält,
 * zu der kein Mann mehr gehört.
 * @param {SpielStand} stand
 * @param {string} schluessel Platz-Schlüssel aus der Aufstellung
 * @param {string} spielerId
 */
export function aufstellungSetze(stand, schluessel, spielerId) {
  if (!stand.kader[stand.meinTeam].some((sp) => sp.id === spielerId)) return stand;
  stand.aufstellung = setzePlatz(vorgabeVon(stand), schluessel, spielerId);
  return stand;
}

/**
 * Einen Platz räumen. Er bleibt leer, bis der Manager ihn besetzt oder
 * „Automatisch aufstellen" drückt — die Reparaturrunden fassen ihn nicht an.
 * @param {SpielStand} stand
 * @param {string} schluessel
 */
export function aufstellungRaeume(stand, schluessel) {
  stand.aufstellung = raeumePlatz(vorgabeVon(stand), schluessel);
  return stand;
}

/**
 * Einen Platz an die Automatik zurückgeben.
 *
 * Gemeint sind die drei Special-Teams-Plätze: dort ist „leer" nicht „niemand",
 * sondern „entscheide du", und dieser Weg zurück gehört dazu. Bei den
 * zweiundzwanzig ist Räumen die Handlung, die der Manager meint — dort hieße
 * Zurückgeben, dass die Automatik denselben Mann sofort wieder hinstellt.
 * @param {SpielStand} stand
 * @param {string} schluessel
 */
export function aufstellungLoese(stand, schluessel) {
  stand.aufstellung = loesePlatz(vorgabeVon(stand), schluessel);
  return stand;
}

/**
 * Die Aufstellung leeren: jeder der zweiundzwanzig Plätze ausdrücklich frei.
 *
 * Der Anfang für den Manager, der seine Elf von Grund auf bauen will. Er darf
 * so auch antreten — es wird dann 0:36 gegen ihn gewertet, und das ist seine
 * Entscheidung und nicht die einer gesperrten Schaltfläche.
 * @param {SpielStand} stand
 */
export function aufstellungLeeren(stand) {
  stand.aufstellung = leereVorgabe(eigeneAufstellung(stand, null));
  return stand;
}

/**
 * Ob die Elf, die heute aufliefe, vollständig ist.
 *
 * Keine Bedingung fürs Speichern mehr — gespeichert wird jeder Zwischenstand —,
 * sondern die Frage vor dem Anpfiff: wer sie mit Nein beantwortet, tritt nicht
 * an. Die Special Teams zählen dabei nicht mit: sie laufen außerhalb der Elf,
 * und ein Verein ohne Kicker tritt trotzdem an — er kickt nur nicht. Das ist
 * eine Entscheidung, die der Manager treffen darf, und keine Lücke in der
 * Aufstellung.
 * @param {SpielStand} stand
 */
export function aufstellungVollstaendig(stand) {
  return vollstaendig(eigeneAufstellung(stand));
}

/**
 * Wie viele Plätze der eigenen Elf leer stehen — für den Hinweis in der
 * Ansicht und für die Nachricht vor dem Spiel.
 * @param {SpielStand} stand
 */
export function offenePlaetze(stand) {
  const a = eigeneAufstellung(stand);
  return [...a.offense, ...a.defense].filter((p) => !p.spieler).length;
}

/**
 * Eine Vorgabe von außen in den Stand schreiben. `null` heißt: keine Vorgabe
 * mehr, danach stellt die Automatik wieder alles.
 *
 * Geprüft wird dabei nichts. Eine unvollständige Elf war früher nicht
 * speicherbar; seit ein Platz leer bleiben darf, ist sie ein gültiger Stand mit
 * einer Folge — der Wertung am Spieltag.
 * @param {SpielStand} stand
 * @param {import('./aufstellung.js').Vorgabe | null} vorgabe
 */
export function setzeAufstellung(stand, vorgabe) {
  stand.aufstellung = vorgabe;
  return stand;
}

/**
 * Die Vorgabe fallen lassen. Danach stellt die Automatik wieder alles — der
 * Knopf „Automatisch aufstellen" ist nichts anderes als das Vergessen.
 * @param {SpielStand} stand
 */
export function automatischAufstellen(stand) {
  stand.aufstellung = null;
  return stand;
}

/**
 * Ein Verein, wie ihn die Simulation sehen will: Kader, Ausrichtung und, beim
 * eigenen, die Aufstellung von Hand.
 * @param {SpielStand} stand
 * @param {string} teamId
 * @returns {import('./spiel.js').Antritt}
 */
export function alsGegner(stand, teamId) {
  return {
    id: teamId,
    kader: stand.kader[teamId],
    personnel: personnelVon(stand, teamId),
    passAnteil: passAnteilVon(stand, teamId),
    aufstellung: aufstellungVon(stand, teamId),
    coaches: coachesVon(stand, teamId),
  };
}

/**
 * Ein Kalendertag für jeden OC der Liga: ein Tick Vertrautheit mit dem
 * System, das sein Verein gerade eingestellt hat. Für alle zwölf, nicht nur
 * den eigenen — sonst wären die KI-Stäbe nach zehn Jahren noch Anfänger.
 * Docs: docs/umbau-coaches.md, Abschnitt 7
 * @param {SpielStand} stand
 */
function coachesLernenTag(stand) {
  for (const t of TEAMS) {
    const oc = ocVon(coachesVon(stand, t.id));
    if (oc) lerneTag(oc, personnelVon(stand, t.id));
  }
}

/**
 * Die nächste noch nicht gespielte Partie eines Vereins, oder null.
 *
 * Der Spielplan liegt **nicht** nach Spieltagen sortiert im Array — die Gruppen
 * stehen hintereinander und die Rückrunde hinter der Hinrunde —, deshalb wird
 * das Minimum gesucht statt der erste Treffer genommen. Ein Verein, der in den
 * Playoffs nicht mehr vorkommt, hat keine nächste Partie; das ist kein Fehler,
 * sondern der Grund für den Rückfall auf den Ligaschnitt.
 * @param {SpielStand} stand
 * @param {string} teamId
 * @returns {import('./spielplan.js').Partie | null}
 */
export function naechstePartie(stand, teamId) {
  const kommende = stand.spielplan.filter(
    (p) => !p.ergebnis && (p.heim === teamId || p.gast === teamId));
  if (kommende.length === 0) return null;
  return kommende.reduce((a, b) => (b.tag < a.tag ? b : a));
}

/**
 * Die Verteidigung der Liga im Mittel — der Maßstab, wenn kein Gegner feststeht.
 *
 * Nur die beiden Verteidigungswerte, denn mehr liest `vorteil()` von der
 * anderen Seite nicht. Ein gemittelter Angriff wäre eine Zahl ohne Gegenstück:
 * gegen den Ligaschnitt spielt niemand, man vergleicht sich nur mit ihm.
 * @param {SpielStand} stand
 * @returns {import('./spiel.js').Verteidiger}
 */
export function ligaSchnittVerteidigung(stand) {
  const andere = TEAMS.filter((t) => t.id !== stand.meinTeam);
  let pass = 0;
  let lauf = 0;
  for (const t of andere) {
    const s = teamStaerken(
      stand.kader[t.id], stand.tag, personnelVon(stand, t.id), passAnteilVon(stand, t.id));
    pass += s.passVerteidigung;
    lauf += s.laufVerteidigung;
  }
  return { passVerteidigung: pass / andere.length, laufVerteidigung: lauf / andere.length };
}

/** The group stage, as the Spielplan is drawn at the start of a season. */
function frischerGruppenplan(rng) {
  return macheGruppenplan(rng, GRUPPEN.map((g) => teamsDerGruppe(g).map((t) => t.id)));
}

/**
 * A fresh career.
 * @param {string} meinTeam
 * @param {string} [seed]
 * @returns {SpielStand}
 */
export function neuesSpiel(meinTeam, seed) {
  const wirklicherSeed = seed || String(Date.now());
  const rng = makeRng(wirklicherSeed);
  resetSpielerIds();

  /** @type {Record<string, import('./spieler.js').Spieler[]>} */
  const kader = {};
  const basen = vereinsBasen(meinTeam);
  // Der eigene Verein startet mit dem nackten Kader, alle anderen mit Reserve.
  for (const t of TEAMS) {
    kader[t.id] = macheKader(rng, basen[t.id], t.id === meinTeam ? 0 : ZUSATZ_SPIELER);
  }

  const personnel = losePersonnel(wirklicherSeed);
  /** @type {Record<string, number>} */
  const passAnteil = {};
  for (const t of TEAMS) passAnteil[t.id] = PERSONNEL[personnel[t.id]].passAnteil;

  /** @type {SpielStand} */
  const stand = {
    version: SAVE_VERSION,
    seed: wirklicherSeed,
    jahr: SEASON_START_YEAR,
    tag: 1,
    meinTeam,
    kader,
    coaches: {},
    personnel,
    passAnteil,
    aufstellung: null,
    spielplan: frischerGruppenplan(rng),
    post: [],
    historie: [],
  };

  // Der Stab wird gleich gezogen, nicht erst beim ersten Blick darauf — ein
  // frischer Stand soll vollständig sein, und der Export eines Standes soll
  // dieselben Coaches tragen wie der Bildschirm.
  for (const t of TEAMS) coachesVon(stand, t.id);

  // Der Amtsantritt ist die erste E-Mail, kein eigener Bildschirm: alles, was
  // der Verein vom Manager will, kommt über denselben Kanal.
  saisonEroeffnung(stand, [], true);
  return stand;
}

/**
 * Was an Tag 1 einer Saison im Postfach liegt: die Rückgetretenen, und das
 * Wort des Vorstands. Es verlangt keine Antwort — es sagt an, was erwartet
 * wird, und ein Knopf darunter wäre eine Quittung, kein Entschluss.
 *
 * Der Saisonwechsel schreibt das selbst und nicht `ereignisseAmTag()`, weil er
 * der Einzige ist, der die Namen der Abgänge kennt — die stehen eine Zeile
 * später in keinem Kader mehr.
 * @param {SpielStand} stand
 * @param {import('./spieler.js').Spieler[]} ruecktritte
 * @param {boolean} antritt Ob es der Amtsantritt ist und nicht bloß ein Jahreswechsel
 */
function saisonEroeffnung(stand, ruecktritte, antritt) {
  /** @type {{ art: string, daten?: Record<string, any> }[]} */
  const eintraege = [];
  if (ruecktritte.length > 0) {
    eintraege.push({
      art: 'ruecktritte',
      daten: { namen: ruecktritte.map((s) => `${s.vorname} ${s.nachname}`) },
    });
  }
  eintraege.push({
    art: 'vorstandsziel',
    daten: { verein: stand.meinTeam, jahr: stand.jahr, antritt },
  });
  return sende(stand, 1, eintraege);
}

/**
 * Der Zufallsstrom eines Tages. Aus dem Saatgut des Standes abgeleitet, damit
 * dieselbe Saison aus demselben Speicherstand dieselbe Saison bleibt.
 *
 * Der Schlüssel hängt am **Tag**, nicht mehr am Spieltag: spätere
 * Tagesereignisse — Training, Transfers — hängen dann am selben Strom. Weil der
 * Tag innerhalb einer Saison eindeutig ist, kann er nicht kollidieren, obwohl
 * eine Saison über den Jahreswechsel läuft.
 * @param {SpielStand} stand @param {number} tag
 */
function tagRng(stand, tag) {
  return makeRng(`${stand.seed}|${stand.jahr}|${tag}`);
}

/**
 * Die Vorgabe um die Zurückgetretenen erleichtern.
 *
 * Nötig ist das nicht — `stelleAuf()` überliest eine Id, die keinen Spieler
 * mehr hat. Aber ein Speicherstand, der über zehn Saisons hinweg jede
 * ausgeschiedene Id mitschleppt, beschreibt am Ende mehr Vergangenheit als
 * Aufstellung.
 * @param {import('./aufstellung.js').Vorgabe | null} vorgabe
 * @param {import('./spieler.js').Spieler[]} kader
 */
function ohneAbgaenge(vorgabe, kader) {
  if (!vorgabe) return null;
  const da = new Set(kader.map((s) => s.id));
  // `null` bleibt: ein freigelassener Platz ist eine Entscheidung und kein Mann,
  // der zurückgetreten sein könnte.
  return Object.fromEntries(
    Object.entries(vorgabe).filter(([, id]) => id === null || da.has(id)));
}

/**
 * Der letzte Tag der laufenden Saison.
 *
 * Er ist die Grenze, an der `weiter()` in die nächste Saison rollt — und mit
 * `phaseAmTag()` zusammen das, was `saisonVorbei()` einmal war: die Saison ist
 * nicht mehr „vorbei", sie geht in die nächste Phase über, und die nächste
 * beginnt nicht auf Knopfdruck, sondern an Tag 1.
 * @param {SpielStand} stand
 */
export function letzterTag(stand) {
  return saisonLaenge(stand.jahr);
}

/** Die noch nicht gespielten Partien eines Tages. @param {SpielStand} stand @param {number} tag */
function offenePartienAmTag(stand, tag) {
  return partienAmTag(stand.spielplan, tag).filter((p) => !p.ergebnis);
}

/**
 * Die eigene Partie eines Tages, sofern sie noch aussteht.
 * @param {SpielStand} stand @param {number} tag
 */
export function eigenePartieAmTag(stand, tag) {
  return offenePartienAmTag(stand, tag).find(
    (p) => p.heim === stand.meinTeam || p.gast === stand.meinTeam) || null;
}

/** The last matchday of the group stage. @param {import('./spielplan.js').Partie[]} plan */
export function gruppenSpieltage(plan) {
  return partienDerRunde(plan, 'gruppe').reduce((max, p) => Math.max(max, p.spieltag), 0);
}

/**
 * One group's table, from that group's fixtures only. Playoff results never
 * enter it — the bracket decides the title, not the standings.
 * @param {SpielStand} stand
 * @param {'nord'|'sued'} gruppe
 */
export function gruppenTabelle(stand, gruppe) {
  const ids = teamsDerGruppe(gruppe).map((t) => t.id);
  const partien = partienDerRunde(stand.spielplan, 'gruppe')
    .filter((p) => ids.includes(p.heim) && ids.includes(p.gast));
  return berechneTabelle(ids, partien);
}

/** Both tables, in group order. @param {SpielStand} stand */
export function gruppenTabellen(stand) {
  return GRUPPEN.map((gruppe) => ({ gruppe, zeilen: gruppenTabelle(stand, gruppe) }));
}

/** The table the managed club stands in. @param {SpielStand} stand */
export function meineTabelle(stand) {
  return gruppenTabelle(stand, teamById(stand.meinTeam).gruppe);
}

/** A club's group-stage row. @param {SpielStand} stand @param {string} teamId */
function zeileVon(stand, teamId) {
  const zeile = gruppenTabelle(stand, teamById(teamId).gruppe)
    .find((z) => z.teamId === teamId);
  if (!zeile) throw new Error('Kein Tabellenplatz für ' + teamId);
  return zeile;
}

/**
 * Draw whatever round has just become knowable. Called after every matchday:
 * the semi-finals the moment the group stage is complete, the final the moment
 * both semi-finals are. Doing nothing is the normal case.
 * @param {SpielStand} stand
 */
export function ergaenzePlayoffs(stand) {
  const plan = stand.spielplan;
  const ende = gruppenSpieltage(plan);
  const gruppenspiele = partienDerRunde(plan, 'gruppe');
  if (gruppenspiele.length === 0 || !gruppenspiele.every((p) => p.ergebnis)) return;

  const halbfinale = partienDerRunde(plan, 'halbfinale');
  if (halbfinale.length === 0) {
    plan.push(...macheHalbfinale(
      gruppenTabelle(stand, 'nord'), gruppenTabelle(stand, 'sued'), ende + 1,
    ));
    return;
  }

  if (partienDerRunde(plan, 'finale').length > 0) return;
  if (!halbfinale.every((p) => p.ergebnis)) return;

  const [a, b] = halbfinale.map((p) => /** @type {string} */ (sieger(p)));
  plan.push(macheFinale(zeileVon(stand, a), zeileVon(stand, b), ende + 2));
}

/** The champion, once the final has been played. @param {SpielStand} stand */
export function meister(stand) {
  const finale = partienDerRunde(stand.spielplan, 'finale')[0];
  return finale ? sieger(finale) : null;
}

/**
 * Einsätze einer Elf verbuchen. Ein Doppeleinsatz zählt zweimal — er hat ja
 * beides gespielt. Kicker und Punter laufen außerhalb der Aufstellung und
 * bekommen nichts.
 * @param {import('./aufstellung.js').Aufstellung} a
 */
function verbucheEinsaetze(a) {
  for (const platz of [...a.offense, ...a.defense]) {
    if (platz.spieler) spieleEinsatz(platz.spieler, platz.platz);
  }
}

/**
 * Einen Kalendertag ausspielen: alle Partien, die an ihm stehen und noch kein
 * Ergebnis haben. Intern — nach außen führt der Weg über `weiter()`.
 * @param {SpielStand} stand @param {number} tag
 * @returns {{ partien: import('./spielplan.js').Partie[],
 *             nachrichten: import('./postfach.js').Nachricht[] }}
 */
function spieleTag(stand, tag) {
  const partien = offenePartienAmTag(stand, tag);
  if (partien.length === 0) return { partien: [], nachrichten: [] };

  const rng = tagRng(stand, tag);
  const spieltagNr = spieltagAmTag(tag);
  /** @type {{ art: string, daten?: Record<string, any> }[]} */
  const eintraege = [];

  for (const p of partien) {
    const { aufstellungen, ...ergebnis } = simuliereSpiel(
      rng, alsGegner(stand, p.heim), alsGegner(stand, p.gast), tag,
    );
    p.ergebnis = ergebnis;

    // Ein gewertetes Spiel hat nicht stattgefunden: niemand sammelt Einsätze,
    // niemand verletzt sich, auch der Gegner nicht. Er verliert seinen
    // Spieltag mit — das ist der Preis dafür, dass eine Wertung keine
    // Simulation mit anderen Zahlen ist.
    if (ergebnis.nichtAngetreten) continue;

    // Wer gespielt hat, hat dort gespielt: der Zähler wächst und die Attribute
    // rücken ein Stück auf das Sollprofil des Platzes zu. Für alle zwölf
    // Vereine, nicht nur den eigenen — sonst versteinert die Liga, während der
    // Manager seine Leute umschult.
    verbucheEinsaetze(aufstellungen.heim);
    verbucheEinsaetze(aufstellungen.gast);

    // Und die Koordinatoren haben es gecoacht: die Spielhälfte der
    // Vertrautheit, siehe `lerneSpiel()`. Nur bei gespieltem Spiel — was am
    // grünen Tisch entschieden wurde, hat niemandem etwas beigebracht.
    for (const teamId of [p.heim, p.gast]) {
      const oc = ocVon(coachesVon(stand, teamId));
      if (oc) lerneSpiel(oc, personnelVon(stand, teamId));
    }

    for (const v of ergebnis.verletzungen) {
      const spieler = stand.kader[v.teamId].find((s) => s.id === v.spielerId);
      // Wochen mal sieben: bei wöchentlichen Spieltagen ist das exakt dieselbe
      // Zahl verpasster Spiele wie vorher. Nur über die spielfreie Woche hinweg
      // kostet eine Verletzung ein Spiel weniger — das ist richtiger, nicht kaputt.
      if (spieler) spieler.verletztBis = tag + v.wochen * 7;
      if (v.teamId !== stand.meinTeam) continue;
      eintraege.push({
        art: 'verletzung',
        daten: { name: v.name, position: v.position, wochen: v.wochen },
      });
    }
  }

  // Gemeldet wird, was den Verein angeht, den der Manager führt.
  const meins = partien.find((p) => p.heim === stand.meinTeam || p.gast === stand.meinTeam);
  if (meins && meins.ergebnis) {
    const heim = meins.heim === stand.meinTeam;
    eintraege.unshift({
      art: 'spielbericht',
      daten: {
        spieltagNr,
        runde: meins.runde,
        heim,
        gegner: heim ? meins.gast : meins.heim,
        eigene: heim ? meins.ergebnis.heimPunkte : meins.ergebnis.gastPunkte,
        fremde: heim ? meins.ergebnis.gastPunkte : meins.ergebnis.heimPunkte,
        // Nicht angetreten heißt: nicht verloren, sondern gar nicht erst
        // gespielt. Die Betreffzeile soll den Unterschied nennen.
        nichtAngetreten: meins.ergebnis.nichtAngetreten === (heim ? 'heim' : 'gast'),
      },
    });
  }

  if (partienDerRunde(stand.spielplan, 'gruppe').some((p) => p.tag === tag)) {
    const zeile = meineTabelle(stand).find((z) => z.teamId === stand.meinTeam);
    if (zeile) {
      eintraege.push({
        art: 'rundenergebnisse',
        daten: {
          spieltagNr,
          platz: zeile.platz,
          siege: zeile.siege,
          niederlagen: zeile.niederlagen,
        },
      });
    }
  }

  const hatteHalbfinale = partienDerRunde(stand.spielplan, 'halbfinale').length > 0;
  ergaenzePlayoffs(stand);
  const halbfinale = partienDerRunde(stand.spielplan, 'halbfinale');
  if (!hatteHalbfinale && halbfinale.length > 0) {
    eintraege.push({
      art: 'auslosung',
      daten: { paarungen: halbfinale.map((p) => [p.heim, p.gast]) },
    });
  }

  const champion = meister(stand);
  if (champion && partienDerRunde(stand.spielplan, 'finale').some((p) => p.tag === tag)) {
    const platz = meineTabelle(stand).findIndex((z) => z.teamId === stand.meinTeam) + 1;
    eintraege.push({ art: 'meister', daten: { meister: champion, meinPlatz: platz } });
  }

  return { partien, nachrichten: sende(stand, tag, eintraege) };
}

/**
 * Die Vorgabe, die der Manager gestellt hat, gegen die Wirklichkeit gehalten:
 * wer darin steht und am Spieltag nicht auflaufen kann.
 * @param {SpielStand} stand @param {number} tag
 * @returns {string[]} Namen, in Aufstellungsreihenfolge
 */
function ausfaelleInDerVorgabe(stand, tag) {
  if (!stand.aufstellung) return [];
  const kader = stand.kader[stand.meinTeam];
  /** @type {string[]} */
  const namen = [];
  for (const id of Object.values(stand.aufstellung)) {
    if (id === null) continue;
    const s = kader.find((x) => x.id === id);
    if (s && !istFit(s, tag)) namen.push(`${s.vorname} ${s.nachname}`);
  }
  return namen;
}

/**
 * Was der Tagesanbruch an Post bringt — ohne den Stand zu ändern.
 *
 * Was aus einem Spiel folgt, schreibt `spieleTag()`; was der Saisonwechsel
 * bringt, schreibt er selbst. Hier steht nur, was der Kalender allein weiß.
 * @param {SpielStand} stand @param {number} tag
 * @returns {import('./postfach.js').Nachricht[]}
 */
export function ereignisseAmTag(stand, tag) {
  return baueNachrichten(stand, tag, eintraegeAmTag(stand, tag));
}

/** @param {SpielStand} stand @param {number} tag */
function eintraegeAmTag(stand, tag) {
  /** @type {{ art: string, daten?: Record<string, any> }[]} */
  const eintraege = [];

  if (eigenePartieAmTag(stand, tag)) {
    // Eine verletzungsbedingt ungültige Aufstellung ist ein Stopp, kein stiller
    // Auto-Fix. Die Automatik *könnte* das kommentarlos auffüllen — genau das
    // ist die Regel, die man später bereut, wenn sie fehlt.
    const ausfaelle = ausfaelleInDerVorgabe(stand, tag);
    if (ausfaelle.length > 0) {
      eintraege.push({
        art: 'aufstellungUngueltig',
        daten: { spieltagNr: spieltagAmTag(tag), namen: ausfaelle },
      });
    }

    // Leere Plätze sind etwas anderes als Ausfälle: sie sind gewollt, und die
    // Reparaturrunden fassen sie nicht an. Trotzdem muss der Manager gefragt
    // werden, bevor sie ihn das Spiel kosten — die Wertung soll seine
    // Entscheidung sein und keine Überraschung.
    const offen = offenePlaetze(stand);
    if (offen > 0) {
      eintraege.push({
        art: 'aufstellungUnvollstaendig',
        daten: { spieltagNr: spieltagAmTag(tag), offen, wertung: WERTUNG_PUNKTE },
      });
    }
  }

  const morgen = eigenePartieAmTag(stand, tag + 1);
  if (morgen) {
    const zuhause = morgen.heim === stand.meinTeam;
    eintraege.push({
      art: 'spielvorschau',
      daten: {
        spieltagNr: spieltagAmTag(morgen.tag),
        runde: morgen.runde,
        heim: zuhause,
        gegner: zuhause ? morgen.gast : morgen.heim,
      },
    });
  }

  return eintraege;
}

/**
 * @typedef {object} Stopp
 * @property {number} tag
 * @property {'spiel'|'antwort'|'phase'|'ziel'} grund
 */

/**
 * Wo der Kalender das nächste Mal von selbst anhält — ohne den Stand zu ändern.
 *
 * Für die Anzeige „Nächster Termin". Eine Nachricht mit Antwortpflicht, die
 * unterwegs erst entsteht, kann den Termin vorverlegen; was wirklich passiert
 * ist, sagt `weiter()` mit seinem `grund`.
 * @param {SpielStand} stand
 * @returns {Stopp}
 */
export function naechsterStopp(stand) {
  if (offeneAntworten(stand).length > 0) return { tag: stand.tag, grund: 'antwort' };
  if (eigenePartieAmTag(stand, stand.tag)) return { tag: stand.tag, grund: 'spiel' };

  const ende = letzterTag(stand);
  for (let tag = stand.tag + 1; tag <= ende; tag++) {
    if (eigenePartieAmTag(stand, tag)) return { tag, grund: 'spiel' };
    if (phasenBeginn(tag)) return { tag, grund: 'phase' };
  }
  // Hinter dem letzten Tag steht der Saisonwechsel — Tag 1 des nächsten Jahres,
  // als Datum genau der Tag nach diesem.
  return { tag: ende + 1, grund: 'phase' };
}

/**
 * @typedef {object} Fortschritt
 * @property {number} bisTag   Der Tag, an dem der Kalender jetzt steht
 * @property {'spiel'|'antwort'|'phase'|'ziel'} grund
 * @property {import('./postfach.js').Nachricht[]} nachrichten
 * @property {import('./spielplan.js').Partie[]} partien
 */

/**
 * Weiterspielen — bis zum nächsten Zwangsstopp, oder bis `zielTag`, je nachdem,
 * was zuerst kommt. Die einzige Funktion, die die Uhr bewegt.
 *
 * Der Aufruf räumt zuerst den heutigen Tag: liegt ein ungespieltes Spiel an, ist
 * dieser Aufruf sein Anpfiff. Eine offene Antwort räumt er **nicht** — solange
 * eine steht, geht kein Tag weiter, und der Aufruf sagt genau das.
 *
 * Fremde Spieltage halten nicht an: sie werden im Vorbeigehen simuliert und
 * landen als Ergebnismeldung im Postfach.
 * @param {SpielStand} stand
 * @param {number | null} [zielTag]
 * @returns {Fortschritt}
 */
export function weiter(stand, zielTag = null) {
  /** @type {import('./postfach.js').Nachricht[]} */
  const nachrichten = [];
  /** @type {import('./spielplan.js').Partie[]} */
  const partien = [];
  /** @param {'spiel'|'antwort'|'phase'|'ziel'} grund @returns {Fortschritt} */
  const halt = (grund) => ({ bisTag: stand.tag, grund, nachrichten, partien });

  if (offeneAntworten(stand).length > 0) return halt('antwort');
  if (zielTag !== null && zielTag <= stand.tag) return halt('ziel');

  const heute = spieleTag(stand, stand.tag);
  partien.push(...heute.partien);
  nachrichten.push(...heute.nachrichten);

  for (;;) {
    if (stand.tag >= letzterTag(stand)) {
      const wechsel = naechsteSaison(stand);
      nachrichten.push(...wechsel.nachrichten);
      return halt('phase');
    }

    stand.tag++;
    // Ein Tag im System ist ein Tag gelernt — auch in der Sommerpause, auch
    // ohne Spiel. Vor der Post, damit ein späteres Tagesereignis, das den
    // Stab liest, schon den heutigen Stand sieht.
    coachesLernenTag(stand);
    nachrichten.push(...sende(stand, stand.tag, eintraegeAmTag(stand, stand.tag)));

    if (offeneAntworten(stand).length > 0) return halt('antwort');
    // Das eigene Spiel geht dem Phasenbeginn vor: Tag 183 ist beides, und was
    // an ihm zählt, ist der Anpfiff.
    if (eigenePartieAmTag(stand, stand.tag)) return halt('spiel');
    if (phasenBeginn(stand.tag)) return halt('phase');

    const gespielt = spieleTag(stand, stand.tag);
    partien.push(...gespielt.partien);
    nachrichten.push(...gespielt.nachrichten);

    if (zielTag !== null && stand.tag >= zielTag) return halt('ziel');
  }
}

/**
 * Eine Nachricht beantworten — und tun, was die Antwort bedeutet.
 *
 * Die Wirkung steht hier und nicht im Postfach, weil sie den Spielstand ändert:
 * das Postfach verwaltet Nachrichten, keine Aufstellungen.
 * @param {SpielStand} stand @param {string} id @param {string} antwort
 * @returns {import('./postfach.js').Nachricht | null}
 */
export function beantworteNachricht(stand, id, antwort) {
  const n = beantworte(stand, id, antwort);
  if (!n) return null;
  if ((n.art === 'aufstellungUngueltig' || n.art === 'aufstellungUnvollstaendig')
    && antwort === 'automatisch') {
    automatischAufstellen(stand);
  }
  return n;
}

/**
 * Close the season out and start the next one: everyone ages, retirees are
 * replaced, and a new group stage is drawn. The champion is whoever won the
 * final — never the club that topped a group table.
 * @param {SpielStand} stand
 * @returns {{ meister: string, ruecktritte: import('./spieler.js').Spieler[],
 *             nachrichten: import('./postfach.js').Nachricht[] }}
 */
export function naechsteSaison(stand) {
  const champion = meister(stand);
  if (!champion) throw new Error('Die Saison ist noch nicht entschieden');
  const meinPlatz = meineTabelle(stand).findIndex((z) => z.teamId === stand.meinTeam) + 1;

  stand.historie.push({ jahr: stand.jahr, meister: champion, meinPlatz });

  const rng = makeRng(`${stand.seed}|offseason|${stand.jahr}`);
  /** @type {import('./spieler.js').Spieler[]} */
  const alleRuecktritte = [];

  const basen = vereinsBasen(stand.meinTeam);
  for (const t of TEAMS) {
    const { kader, ruecktritte } = saisonWechsel(rng, stand.kader[t.id], basen[t.id]);
    stand.kader[t.id] = kader;
    if (t.id === stand.meinTeam) alleRuecktritte.push(...ruecktritte);
  }

  stand.aufstellung = ohneAbgaenge(stand.aufstellung, stand.kader[stand.meinTeam]);
  stand.jahr++;
  stand.tag = 1;
  stand.spielplan = frischerGruppenplan(rng);

  // Erst stutzen, dann eröffnen: die Post des neuen Jahres soll die Schere
  // nicht zu sehen bekommen.
  stutzePost(stand);
  const nachrichten = saisonEroeffnung(stand, alleRuecktritte, false);

  return { meister: champion, ruecktritte: alleRuecktritte, nachrichten };
}

export { anzahlSpieltage };
