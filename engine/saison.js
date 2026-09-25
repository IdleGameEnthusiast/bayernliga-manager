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
  SEASON_START_YEAR, ZUSATZ_SPIELER, EIGENE_VEREINSBASIS, ABGANG_GESPRAECH_BONUS,
  RUECKTRITT_ALTER, TRYOUT_GESPRAECHE,
  makeRng, pick, clamp,
} from './constants.js';
import { TEAMS, GRUPPEN, teamById, teamsDerGruppe } from './content.js';
import {
  saisonLaenge, spieltagAmTag, phaseAmTag, phasenBeginn, wochenBeginn, woche, tryoutTage,
  SPIELTAG_TAGE,
} from './kalender.js';
import {
  sende, baueNachrichten, offeneAntworten, beantworte, stutzePost,
} from './postfach.js';
import { macheKader, saisonWechsel, resetSpielerIds, spieleEinsatz, istFit } from './spieler.js';
import { platzKuerzel, positionsKuerzel } from './positionen.js';
import {
  macheGruppenplan, macheHalbfinale, macheFinale, sieger,
  anzahlSpieltage, partienAmTag, partienDerRunde,
} from './spielplan.js';
import { simuliereSpiel } from './spiel.js';
import {
  PERSONNEL, STANDARD_PERSONNEL, stelleAuf, alsVorgabe, setzePlatz, vollstaendig,
  leereVorgabe, raeumePlatz,
} from './aufstellung.js';
import { berechneTabelle } from './tabelle.js';
import { teamStaerken } from './team.js';
import { ziehStab, ocVon, dcVon, seiteVon, lerneTag, lerneSpiel } from './coach.js';
import {
  gruppeVon, verlustFaktor, verletzungsDrift, serienDrift, vereinsjahr, kiAusgleich,
  trendVersuch, stufeBekannt,
} from './drift.js';
import { ziehBindung } from './commitment.js';
import { lebensjahr } from './lebenslauf.js';
import {
  faellige, rolleVon, setzeRolle, verbucheSpiel, drift,
  neueSaison as rolleNeueSaison, rollenlose, darfAendern, ROLLEN,
} from './rolle.js';
import { offeneGespraeche, persoenlichesGespraech } from './gespraech.js';
import {
  frageNachWunsch, gibNummer, wunschDrift, ausgesprochenerWunsch,
} from './wunsch.js';
import { ueberzeugungsDrift, ueberzeuge, offeneAblehnungen } from './ueberzeugen.js';
import { frageNachLebenslage } from './auskunft.js';
import {
  recruitingVon, planeWerbung, erinnerungAmTag, tryoutAmTag, richteTryoutAus, schliesseTryout,
  entscheidungFaellig, entscheide, uebernimmNeue, rookieTraining,
} from './recruiting.js';

/**
 * Der Stempel auf einem Speicherstand.
 *
 * Wer die Form von `SpielStand` ändert, zählt hier hoch **und schreibt dazu
 * einen Schritt in `MIGRATIONEN` in [`save.js`](./save.js)**, der einen Stand
 * der vorigen Nummer auf diese hebt. Ohne diesen Schritt wird ein solcher Stand
 * beim Laden weggeworfen — der Sprung ist billig, der Verlust nicht.
 */
export const SAVE_VERSION = 19;

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
 * @property {import('./gespraech.js').Gespraech[]} gespraeche  Das Log der geführten
 *   Gespräche dieser Saison — `{ tag, spielerId }`, wie `post` Nachrichten sammelt.
 *   Es **ist** das Wochenkontingent: was diese Woche noch geht, wird gezählt und nicht
 *   heruntergezählt, und das Fenster verschiebt sich mit dem Tag von selbst. Der
 *   Saisonwechsel leert es, wie der Papierkorb der Post geleert wird
 * @property {import('./recruiting.js').Recruiting} [recruiting]  Werbung, laufendes
 *   Tryout, die Neuen vor ihrer Position und die Ehemaligen — siehe `recruitingVon()`
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
  // Ein nachgezogener Stab soll vollständig sein wie ein frischer — mit der
  // Bindung, die aus ihrem eigenen Strom kommt und den hiesigen nicht stört.
  for (const c of stab) bindungVon(stand, c);
  return stab;
}

/**
 * Commitment und Lebenslage eines Menschen im Verein, notfalls nachgezogen.
 *
 * Derselbe Weg wie beim Stab: ein Stand von vor Block 7 trägt die beiden
 * Felder nicht, und der Migrationsschritt legt sie auch nicht an — er
 * müsste sonst den heutigen Generator kennen. Gezogen wird beim ersten
 * Zugriff, aus einem eigenen Strom neben dem Saatgut, der an der Id des
 * Menschen hängt: deterministisch, und unabhängig davon, wer zuerst
 * angesehen wird.
 *
 * Das Jahr der Ziehung ist das laufende — ein Mann, der in einem alten Stand
 * erst in der dritten Saison zum ersten Mal angesehen wird, ist dann eben
 * „seit zwei Jahren im Verein" gerechnet ab jetzt. Das ist kein Fehler,
 * sondern das Beste, was ein Stand ohne diese Felder hergibt.
 * @param {SpielStand} stand
 * @param {import('./spieler.js').Spieler | import('./coach.js').Coach} person
 * @returns {{ commitment: number, lebenslage: import('./commitment.js').Lebenslage }}
 */
export function bindungVon(stand, person) {
  if (typeof person.commitment !== 'number' || !person.lebenslage) {
    const rng = makeRng(`${stand.seed}|bindung|${person.id}`);
    const verein = vereinVon(stand, person);
    const gezogen = ziehBindung(rng, person.alter, stand.jahr, verein ? verein.uniKm : 0);
    person.commitment = gezogen.commitment;
    person.lebenslage = gezogen.lebenslage;
  }
  return { commitment: person.commitment, lebenslage: person.lebenslage };
}

/**
 * Der Verein, in dessen Kader oder Stab ein Mensch steht. Ein Spieler trägt
 * seinen Verein nicht bei sich — er steht in `stand.kader[teamId]`, und das
 * reicht überall sonst. Gesucht wird nur beim Ziehen der Bindung, also einmal
 * je Mensch; dafür ein Feld in jeden Spieler zu schreiben, das beim Wechsel
 * mitwandern müsste, lohnt nicht.
 * @param {SpielStand} stand
 * @param {{ id: string }} person
 */
function vereinVon(stand, person) {
  return TEAMS.find((t) => (stand.kader[t.id] || []).some((s) => s.id === person.id)
    || ((stand.coaches || {})[t.id] || []).some((c) => c.id === person.id));
}

/**
 * Jeden im Verein, der noch keine Bindung trägt, mit einer versehen — alle
 * Vereine, Spieler wie Stab. Das ist die eifrige Fassung von `bindungVon()`:
 * ein frischer Stand soll vollständig sein, und ein Rookie nach dem
 * Saisonwechsel soll nicht auf den ersten Blick ins Personal warten müssen.
 * Für die KI-Vereine läuft es mit, sonst gibt es später nichts, was man
 * abwerben könnte.
 * @param {SpielStand} stand
 */
export function ergaenzeBindung(stand) {
  for (const t of TEAMS) {
    for (const s of stand.kader[t.id] || []) bindungVon(stand, s);
    for (const c of coachesVon(stand, t.id)) bindungVon(stand, c);
  }
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
 * Wie viele Plätze der eigenen Elf leer stehen — für die Rückfrage, die der
 * Kickoff-Knopf stellt, bevor die Engine das Spiel wertet statt spielt.
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
    gespraeche: [],
    recruiting: { werbung: null, tryout: null, neue: [], ehemalige: [] },
  };

  // Der Stab wird gleich gezogen, nicht erst beim ersten Blick darauf — ein
  // frischer Stand soll vollständig sein, und der Export eines Standes soll
  // dieselben Coaches tragen wie der Bildschirm.
  for (const t of TEAMS) coachesVon(stand, t.id);
  ergaenzeBindung(stand);

  // Der Amtsantritt ist die erste E-Mail, kein eigener Bildschirm: alles, was
  // der Verein vom Manager will, kommt über denselben Kanal.
  saisonEroeffnung(stand, [], [], true);
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
 * @param {import('./commitment.js').Grund[]} gruende je einer, in derselben Reihenfolge
 * @param {boolean} antritt Ob es der Amtsantritt ist und nicht bloß ein Jahreswechsel
 */
function saisonEroeffnung(stand, ruecktritte, gruende, antritt) {
  /** @type {{ art: string, daten?: Record<string, any> }[]} */
  const eintraege = [];
  if (ruecktritte.length > 0) {
    eintraege.push({
      art: 'ruecktritte',
      daten: { namen: ruecktritte.map((s) => `${s.vorname} ${s.nachname}`), gruende },
    });
  }
  eintraege.push({
    art: 'vorstandsziel',
    daten: { verein: stand.meinTeam, jahr: stand.jahr, antritt },
  });
  // Die Erinnerung des Trainerstabs eröffnet die Rollen-Kampagne. Sie steht
  // hier und nicht in `eintraegeAmTag()`, weil Tag 1 dort nie ankommt:
  // `weiter()` spielt den heutigen Tag ab, bevor es den ersten weiterzählt.
  //
  // Die **Anfragen** der einzelnen Spieler fangen bewusst erst eine Woche
  // später an. Tag 1 ist der Tag, an dem der Vorstand spricht und an dem eine
  // neue Karriere anfängt; zwei blockierende Nachfragen im selben Moment
  // hielten den Kalender an, bevor der Manager seinen Kader überhaupt gesehen
  // hat. Die Frist kostet das nichts — das Tempo rechnet sich ab Tag 8 neu und
  // kommt genauso rechtzeitig durch.
  eintraege.push({
    art: 'rollenerinnerung',
    daten: { offen: rollenlose(stand.kader[stand.meinTeam]).length },
  });
  // Die Frage nach der Werbung fürs November-Tryout kommt sonst einen Monat
  // vorher, also noch in der alten Saison. Beim Amtsantritt gibt es keine alte
  // Saison — also kommt sie heute, mit zwei bis drei Wochen Vorlauf statt vier.
  // Das ist die einzige blockierende Nachricht an Tag 1, und sie passt: der
  // Vorstand hat eben gesagt, dass das Team neu aufgebaut werden muss.
  if (antritt) {
    const tag = tryoutTage(stand.jahr).herbst;
    planeWerbung(stand, stand.jahr, tag);
    eintraege.push({ art: 'tryoutWerbung', daten: { jahr: stand.jahr, tag, art: 'herbst' } });
  }
  return sende(stand, 1, eintraege);
}

/**
 * Die Rollen-Anfragen, die an einem Wochenanfang fällig sind.
 *
 * Eine **eigene** Nachricht je Spieler, nicht eine Sammelmeldung mit fünf
 * Namen: jede ist eine eigene Entscheidung, jede wird einzeln beantwortet, und
 * eine Liste mit einem einzigen Antwortknopf wäre die falsche Form dafür.
 * @param {SpielStand} stand @param {number} tag
 * @returns {{ art: string, daten?: Record<string, any> }[]}
 */
function rollenEintraege(stand, tag) {
  if (!wochenBeginn(tag)) return [];
  return faellige(stand.kader[stand.meinTeam] || [], tag).map((sp) => ({
    art: 'rollenanfrage',
    daten: {
      spielerId: sp.id,
      name: `${sp.vorname} ${sp.nachname}`,
      position: sp.position,
      alter: sp.alter,
    },
  }));
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
 * Was das eigene Spiel an der Bindung bewegt: der Bank-Drift, daneben der
 * ausgesprochene Positionswunsch, und daneben die Ablehnung.
 *
 * Drei Fragen an denselben Nachmittag, und **höchstens eine kostet**. Der
 * Bank-Drift rechnet nur, wenn er zugesehen hat; die anderen beiden nur, wenn
 * er aufgelaufen ist, und von ihnen hat die Ablehnung Vorrang — sie ist die
 * schärfere Aussage über denselben Einsatz, und `wunschDrift()` bekommt
 * deshalb gesagt, dass schon abgerechnet wurde.
 *
 * Verletzte bleiben außen vor — eine Verletzung ist keine Entscheidung des
 * Managers und soll die Bilanz nicht verwässern. Wer von sich aus nachfragt,
 * bekommt eine Nachricht **ohne** Empathie-Gate: ein Spieler bemerkt seine
 * eigene Bank selbst, ganz gleich, wie aufmerksam sein Positionscoach ist.
 * Der Wunsch bekommt **keine** Nachricht: er hat ihn einmal ausgesprochen, er
 * steht im Personalreiter, und ein Spieler, der ihn nach jedem Spiel
 * wiederholt, nörgelt. Eine **neue** Ablehnung bekommt dagegen eine — sie ist
 * das einzige der drei Dinge, das der Manager nicht hat kommen sehen können,
 * und ohne die Zeile fiele ihm erst Wochen später auf, dass da etwas zieht.
 * @param {SpielStand} stand
 * @param {import('./aufstellung.js').Aufstellung} meine
 * @param {number} tag
 * @returns {{ art: string, daten?: Record<string, any> }[]}
 */
function spielDrift(stand, meine, tag) {
  /** @type {Map<string, string[]>} Wer auf welchen Plätzen stand */
  const gelaufen = new Map();
  for (const pl of [...meine.offense, ...meine.defense]) {
    if (!pl.spieler) continue;
    const bisher = gelaufen.get(pl.spieler.id);
    if (bisher) bisher.push(platzKuerzel(pl.platz));
    else gelaufen.set(pl.spieler.id, [platzKuerzel(pl.platz)]);
  }
  /** @type {{ art: string, daten?: Record<string, any> }[]} */
  const eintraege = [];
  const stab = coachesVon(stand, stand.meinTeam);

  for (const sp of stand.kader[stand.meinTeam] || []) {
    if (!istFit(sp, tag)) continue;
    verbucheSpiel(sp, gelaufen.has(sp.id));
    // Die Bindung muss stehen, bevor daran gezogen wird — in einem Stand von
    // vor Block 7 hängt sie sonst noch im Saatgut.
    bindungVon(stand, sp);

    const plaetze = gelaufen.get(sp.id) || [];
    const widerstand = ueberzeugungsDrift(sp, plaetze);
    wunschDrift(sp, plaetze, widerstand !== null && widerstand.delta < 0);
    if (widerstand && widerstand.neu) {
      eintraege.push({
        art: 'ablehnung',
        daten: {
          spielerId: sp.id,
          name: `${sp.vorname} ${sp.nachname}`,
          position: widerstand.position,
          daheim: positionsKuerzel(sp),
        },
      });
    }

    const bewegt = drift(sp, tag, verlustFaktor(stab, sp));
    if (!bewegt || !bewegt.beschwerde) continue;
    eintraege.push({
      art: 'rollenmismatch',
      daten: {
        spielerId: sp.id,
        name: `${sp.vorname} ${sp.nachname}`,
        position: sp.position,
        rolle: rolleVon(sp),
      },
    });
  }
  return eintraege;
}

/**
 * Der Kader eines Vereins, jeder mit Bindung. Die Drift trifft alle zwölf
 * Vereine, und in einem Stand von vor Block 7 hängt die Bindung eines
 * KI-Spielers noch im Saatgut.
 * @param {SpielStand} stand @param {string} teamId
 */
function kaderMitBindung(stand, teamId) {
  const kader = stand.kader[teamId] || [];
  for (const sp of kader) bindungVon(stand, sp);
  return kader;
}

/**
 * Ein Versuch des Coaches, für jeden im eigenen Kader, dessen Stufe sich
 * verschoben hat. `anlass` trennt die Würfe am selben Tag — der Wochenanfang
 * und das Spiel danach sind zwei Gelegenheiten, es zu bemerken.
 *
 * Nur der eigene Verein: die Nachricht geht an den Manager, und ein Feld, das
 * bei den KI-Vereinen niemand liest, wäre Ballast im Speicherstand.
 * @param {SpielStand} stand @param {number} tag @param {'woche'|'spiel'} anlass
 * @returns {{ art: string, daten?: Record<string, any> }[]}
 */
function trendEintraege(stand, tag, anlass) {
  const stab = coachesVon(stand, stand.meinTeam);
  /** @type {{ art: string, daten?: Record<string, any> }[]} */
  const eintraege = [];
  for (const sp of kaderMitBindung(stand, stand.meinTeam)) {
    const rng = makeRng(`${stand.seed}|trend|${stand.jahr}|${tag}|${anlass}|${sp.id}`);
    const trend = trendVersuch(sp, stab, rng);
    if (!trend) continue;
    // Wer es sagt, ist der, der die Gruppe coacht. Ohne Koordinator auf der
    // Seite ist die Betreuung null, und der Wurf trifft nie — hier steht also
    // immer einer.
    const seite = seiteVon(gruppeVon(sp));
    const coach = seite === 'offense' ? ocVon(stab) : dcVon(stab);
    eintraege.push({
      art: 'commitmentTrend',
      daten: {
        spielerId: sp.id,
        name: `${sp.vorname} ${sp.nachname}`,
        position: sp.position,
        von: trend.von,
        nach: trend.nach,
        coach: coach ? `${coach.vorname} ${coach.nachname}` : '',
        coachRolle: coach ? coach.rolle : '',
      },
    });
  }
  return eintraege;
}

/**
 * Was ein Wochenanfang am Commitment bewegt: die verletzte Woche, für jeden
 * Verein — und danach die Chance des Coaches, beim eigenen etwas zu bemerken.
 *
 * Der Wochenanfang und nicht jeder Tag, weil die Verletzung in Wochen
 * gezogen wird und die Spieltage im Wochentakt liegen. Er fällt auf den
 * Spieltag selbst, **vor** das Spiel: der Wurf am Morgen ist der zweite,
 * dritte oder vierte Versuch für den Wechsel aus dem Spiel davor.
 * @param {SpielStand} stand @param {number} tag
 * @returns {{ art: string, daten?: Record<string, any> }[]}
 */
function wochenDrift(stand, tag) {
  if (!wochenBeginn(tag)) return [];
  for (const t of TEAMS) {
    const stab = coachesVon(stand, t.id);
    for (const sp of kaderMitBindung(stand, t.id)) verletzungsDrift(sp, stab, tag);
  }
  return trendEintraege(stand, tag, 'woche');
}

/**
 * Was die Rekrutierung an einem Tag tut: das Rookie-Training am Wochenanfang,
 * die Frage nach der Werbung einen Monat vor einem Tryout, das Tryout selbst
 * und drei Tage später die Antworten der Kandidaten.
 *
 * Steht neben `wochenDrift()` und nicht in `eintraegeAmTag()`, weil es den
 * Stand ändert — es zieht Kandidaten und würfelt Zusagen, und eine Vorschau
 * darf das nicht. Die Nachrichten mit Antwortpflicht, die dabei entstehen,
 * halten den Kalender von selbst an.
 * @param {SpielStand} stand @param {number} tag
 * @returns {{ art: string, daten?: Record<string, any> }[]}
 */
function rekrutierungsTag(stand, tag) {
  /** @type {{ art: string, daten?: Record<string, any> }[]} */
  const eintraege = [];

  if (wochenBeginn(tag)) {
    for (const sp of stand.kader[stand.meinTeam] || []) rookieTraining(sp, tag);
  }

  const erinnerung = erinnerungAmTag(stand.jahr, tag);
  if (erinnerung) {
    planeWerbung(stand, erinnerung.jahr, erinnerung.tag);
    eintraege.push({ art: 'tryoutWerbung', daten: erinnerung });
  }

  const art = tryoutAmTag(stand.jahr, tag);
  if (art) {
    const tryout = richteTryoutAus(stand, tag, art);
    eintraege.push({
      art: 'tryout',
      daten: {
        jahr: stand.jahr, tag, art, anzahl: tryout.kandidaten.length, gespraeche: TRYOUT_GESPRAECHE,
      },
    });
  }

  if (entscheidungFaellig(stand, tag)) {
    const tryout = /** @type {import('./recruiting.js').Tryout} */ (recruitingVon(stand).tryout);
    const ergebnis = /** @type {NonNullable<ReturnType<typeof entscheide>>} */ (entscheide(stand, tag));
    const neue = recruitingVon(stand).neue;
    eintraege.push({
      art: neue.length > 0 ? 'tryoutZusagen' : 'tryoutAbsagen',
      daten: {
        jahr: tryout.jahr,
        tag: tryout.tag,
        art: tryout.art,
        kandidaten: ergebnis.kandidaten,
        zusagen: ergebnis.zusagen,
        nachgerueckt: ergebnis.nachgerueckt.length,
        nachgeruecktIds: ergebnis.nachgerueckt,
        namen: neue.map((s) => `${s.vorname} ${s.nachname}`),
      },
    });
  }
  return eintraege;
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

    // Die Serie zählt auch eine gewertete Niederlage — verloren ist verloren,
    // und am Tisch entschieden fühlt es sich nicht besser an. Deshalb vor dem
    // `continue`, und für beide Vereine: der Verlierer ist der, dessen Serie
    // wachsen kann, aber welcher das ist, weiß `serienDrift()` selbst.
    for (const teamId of [p.heim, p.gast]) {
      serienDrift(kaderMitBindung(stand, teamId), coachesVon(stand, teamId),
        stand.spielplan, teamId);
    }

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

    // Und der eigene Kader führt Buch darüber, wer zusehen musste: das
    // rollierende Fenster, aus dem der Rollen-Mismatch gerechnet wird. Nur der
    // eigene Verein — anderswo setzt niemand Rollen, und ein Fenster ohne
    // Erwartung wäre Ballast in jedem Speicherstand.
    if (p.heim === stand.meinTeam || p.gast === stand.meinTeam) {
      eintraege.push(...spielDrift(stand, aufstellungen[p.heim === stand.meinTeam ? 'heim' : 'gast'], tag));
    }

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

  // Der erste Versuch des Coaches kommt gleich nach dem Spiel — nach der Bank
  // und nach der Serie, damit er sieht, was der ganze Nachmittag angerichtet
  // hat.
  if (meins && meins.ergebnis) eintraege.push(...trendEintraege(stand, tag, 'spiel'));

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
    // Reparaturrunden fassen sie nicht an. Gefragt wird trotzdem, bevor sie
    // das Spiel kosten — aber nicht hier. Eine Nachricht mit Antwortpflicht
    // stand einmal an dieser Stelle und hielt den Kalender an; sie nahm dem
    // Manager den Kickoff-Knopf weg, bis er geantwortet hatte, und die Frage
    // stand im Postfach statt dort, wo er auf den Knopf drückt. Jetzt fragt
    // der Knopf selbst (siehe `app.js`), und die Engine wertet nur.
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

  // Der Wochenanfang steht hier neben dem Phasenbeginn, hält den Kalender aber
  // nicht selbst an — das tun erst die Anfragen, die er verschickt, und nur,
  // solange welche fällig sind. Nach der Frist ist die Liste leer und der
  // Wochenanfang kostet nichts.
  eintraege.push(...rollenEintraege(stand, tag));

  // Am Tag nach dem Finale sagen die, die gehen werden, es dem Manager — jeder
  // in einer eigenen Nachricht, mit Grund. Gegangen wird erst beim
  // Saisonwechsel; bis dahin ist Zeit, einen umzustimmen.
  if (tag === SPIELTAG_TAGE[SPIELTAG_TAGE.length - 1] + 1 && meister(stand)) {
    eintraege.push(...abgangsEintraege(stand));
  }

  return eintraege;
}

/**
 * Wer beim nächsten Saisonwechsel aus dem eigenen Kader geht, und warum —
 * ohne dass jemand geht.
 *
 * Gerechnet wird der Wechsel selbst, auf Kopien und mit **denselben** Strömen
 * wie in `lebensjahrKader()`. Solange sich bis dahin nichts am Mann ändert,
 * sagt die Vorschau also genau, was passiert. Ändert sich etwas — ein Gespräch,
 * eine Rolle, eine Verletzung in der Offseason —, entscheidet am Ende der
 * Saisonwechsel, und die Rücktrittsnachricht an Tag 1 nennt, wer wirklich
 * gegangen ist.
 * @param {SpielStand} stand
 * @returns {Map<string, import('./commitment.js').Grund>}
 */
export function abgangsVorschau(stand) {
  /** @type {Map<string, import('./commitment.js').Grund>} */
  const gehen = new Map();
  for (const s of kaderMitBindung(stand, stand.meinTeam)) {
    const grund = vorschauFuer(stand, s);
    if (grund) gehen.set(s.id, grund);
  }
  return gehen;
}

/**
 * Die Vorschau für einen einzelnen Mann.
 * @param {SpielStand} stand @param {import('./spieler.js').Spieler} s
 * @returns {import('./commitment.js').Grund | null}
 */
function vorschauFuer(stand, s) {
  const grund = lebensjahrSpieler(stand, structuredClone(s), stand.meinTeam);
  // Über dem Rücktrittsalter hört er auf, egal was der Lebenslauf sagt — so
  // steht es in `saisonWechsel()`, und der Grund ist dann der Körper.
  if (s.alter + 1 > (s.ruecktrittAlter || RUECKTRITT_ALTER)) return 'koerper';
  return grund;
}

/**
 * Eine Nachricht je Abgang. Wer aus Körpergründen geht, bekommt keine Frage —
 * den Körper redet niemand weg. Alle anderen stellen den Manager vor die
 * Wahl: reden oder gehen lassen.
 * @param {SpielStand} stand
 * @returns {{ art: string, daten?: Record<string, any> }[]}
 */
function abgangsEintraege(stand) {
  const gehen = abgangsVorschau(stand);
  return (stand.kader[stand.meinTeam] || []).filter((s) => gehen.has(s.id)).map((s) => {
    const grund = /** @type {import('./commitment.js').Grund} */ (gehen.get(s.id));
    return {
      art: grund === 'koerper' ? 'abgangKoerper' : 'abgang',
      daten: {
        spielerId: s.id,
        name: `${s.vorname} ${s.nachname}`,
        position: s.position,
        alter: s.alter,
        grund,
      },
    };
  });
}

/**
 * Das Gespräch mit einem, der gehen will. Es hebt das Commitment um
 * `ABGANG_GESPRAECH_BONUS`, und danach wird die Waage neu gelesen: reicht es,
 * bleibt er.
 *
 * Es kostet keinen Termin aus dem Wochenkontingent. Es ist der eine Moment, in
 * dem es um alles geht, und eine Nachricht mit Antwortpflicht, die sich nur mit
 * einem freien Termin beantworten ließe, könnte den Kalender für eine Woche
 * festhalten. Später kommt hier das Spritgeld dazu, als zweiter Hebel neben dem
 * Gespräch.
 * @param {SpielStand} stand @param {string} spielerId
 * @returns {'bleibt' | 'geht' | null} null, wenn es ihn nicht mehr gibt
 */
export function fuehreAbgangsGespraech(stand, spielerId) {
  const sp = (stand.kader[stand.meinTeam] || []).find((x) => x.id === spielerId);
  if (!sp) return null;
  bindungVon(stand, sp);
  sp.commitment = Math.min(99, /** @type {number} */ (sp.commitment) + ABGANG_GESPRAECH_BONUS);
  stufeBekannt(sp);
  return vorschauFuer(stand, sp) ? 'geht' : 'bleibt';
}

/**
 * @typedef {object} Stopp
 * @property {number} tag
 * @property {'spiel'|'antwort'|'phase'|'ziel'|'tryout'} grund
 */

/**
 * Wo der Kalender das nächste Mal von selbst anhält — ohne den Stand zu ändern.
 *
 * Für die Anzeige „Nächster Termin". Eine Nachricht mit Antwortpflicht, die
 * unterwegs erst entsteht, kann den Termin vorverlegen; was wirklich passiert
 * ist, sagt `weiter()` mit seinem `grund`. Das Tryout steht hier als eigener
 * Grund, obwohl es über seine Nachricht anhält: es ist ein Termin, und der
 * Manager soll ihn kommen sehen.
 * @param {SpielStand} stand
 * @returns {Stopp}
 */
export function naechsterStopp(stand) {
  if (offeneAntworten(stand).length > 0) return { tag: stand.tag, grund: 'antwort' };
  if (eigenePartieAmTag(stand, stand.tag)) return { tag: stand.tag, grund: 'spiel' };

  const ende = letzterTag(stand);
  for (let tag = stand.tag + 1; tag <= ende; tag++) {
    if (eigenePartieAmTag(stand, tag)) return { tag, grund: 'spiel' };
    if (tryoutAmTag(stand.jahr, tag)) return { tag, grund: 'tryout' };
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
    // Die Drift des Wochenanfangs ändert den Stand und steht deshalb hier und
    // nicht in `eintraegeAmTag()`, das nur liest — `ereignisseAmTag()` fragt
    // es für die Vorschau, und eine Vorschau darf niemanden verletzt machen.
    const wochenPost = wochenDrift(stand, stand.tag);
    // Die Rekrutierung steht vorn: fällt ein Tryout auf einen Wochenanfang,
    // ist es das Ereignis des Tages, und die Tageskarte führt zur ersten
    // offenen Nachricht — die Rollen-Anfragen warten dahinter.
    const rekrutierung = rekrutierungsTag(stand, stand.tag);
    nachrichten.push(...sende(stand, stand.tag,
      [...rekrutierung, ...eintraegeAmTag(stand, stand.tag), ...wochenPost]));

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
  if (n.art === 'aufstellungUngueltig' && antwort === 'automatisch') {
    automatischAufstellen(stand);
  }
  if (n.art === 'tryout') schliesseTryout(stand);
  if (n.art === 'tryoutZusagen') uebernimmNeue(stand, stand.tag);
  // Das Ergebnis steht in der Nachricht selbst, nicht in einer zweiten: der
  // Manager hat an genau dieser Stelle gefragt und liest dort die Antwort.
  if (n.art === 'abgang' && antwort === 'gespraech') {
    n.daten.ergebnis = fuehreAbgangsGespraech(stand, n.daten.spielerId);
  }
  return n;
}

// --- Gespräche -------------------------------------------------------------

/**
 * Wie viele Gespräche diese Woche noch gehen.
 *
 * Ein Gespräch ist ein Kalendertermin und damit knapp — ohne die Knappheit
 * wäre es ein Knopf für ein paar Punkte Bindung, den man fünfundvierzig Mal
 * drückt. Dasselbe Kontingent regelt beide Zugänge gleich: den Knopf im
 * Personalreiter und die Antwort „Gespräch" im Postfach.
 * @param {SpielStand} stand
 */
export function gespraecheFrei(stand) {
  if (!stand.gespraeche) stand.gespraeche = [];
  return offeneGespraeche(stand.gespraeche, stand.tag);
}

/**
 * Einen geführten Termin ins Log schreiben — und festhalten, dass der Manager
 * jetzt weiß, wo der Mann steht. Er saß ihm gegenüber; ein Coach, der ihm eine
 * Woche später meldet, was er selbst gesehen hat, wäre Rauschen.
 * @param {SpielStand} stand @param {import('./spieler.js').Spieler} sp
 */
function verbucheGespraech(stand, sp) {
  stand.gespraeche.push({ tag: stand.tag, spielerId: sp.id });
  stufeBekannt(sp);
}

/**
 * Ob mit diesem Spieler heute über seine Rolle gesprochen werden kann — und
 * wenn nicht, woran es liegt.
 *
 * Zwei getrennte Gründe, weil sie sich verschieden anfühlen: „diese Woche ist
 * nichts mehr frei" geht nächste Woche wieder, „das haben wir gerade erst
 * besprochen" erst nach dem Cooldown. Eine einzige Absage für beides ließe den
 * Manager raten, auf was er warten soll.
 * @param {SpielStand} stand @param {string} spielerId
 */
export function rollenGespraechMoeglich(stand, spielerId) {
  const sp = (stand.kader[stand.meinTeam] || []).find((x) => x.id === spielerId);
  if (!sp) return { moeglich: false, frei: 0, gesperrtBis: null };
  const frei = gespraecheFrei(stand);
  const darf = darfAendern(sp, stand.tag);
  return {
    moeglich: frei > 0 && darf,
    frei,
    gesperrtBis: darf ? null : (sp.letzteRollenAenderung ?? null),
  };
}

/**
 * Ein Rollengespräch führen: die Rolle setzen, das Commitment bewegen, den
 * Termin verbuchen.
 *
 * Die offene Anfrage im Postfach wird dabei mitbeantwortet. Sonst könnte der
 * Manager die Rolle im Personalreiter setzen und stünde danach vor einer
 * Nachricht, die ihn nach etwas fragt, das längst entschieden ist — und die
 * bis zur Antwort den Kalender anhielte.
 * @param {SpielStand} stand @param {string} spielerId
 * @param {import('./rolle.js').Rolle} rolle
 * @returns {import('./rolle.js').Reaktion | null} null, wenn es heute nicht geht
 */
export function fuehreRollenGespraech(stand, spielerId, rolle) {
  if (!ROLLEN.includes(rolle)) return null;
  const kader = stand.kader[stand.meinTeam] || [];
  const sp = kader.find((x) => x.id === spielerId);
  if (!sp || !rollenGespraechMoeglich(stand, spielerId).moeglich) return null;

  bindungVon(stand, sp);
  const reaktion = setzeRolle(kader, sp, rolle, stand.tag);
  verbucheGespraech(stand, sp);

  for (const n of stand.post) {
    if (n.art === 'rollenanfrage' && n.antwort === null && n.daten.spielerId === spielerId) {
      beantworte(stand, n.id, 'gespraech');
    }
  }
  return reaktion;
}

/**
 * Über persönliche Themen sprechen: ein Termin, ein bisschen Nähe, sonst
 * nichts.
 *
 * Anders als beim Rollengespräch gibt es keinen Grund, das zu verbieten —
 * reden kann man immer. Was zu kurz nacheinander geredet wird, bringt nur
 * wenig; das rechnet `persoenlichAnteil()` aus demselben Log, in dem der
 * Termin gleich landet. Der Termin wird trotzdem verbucht, auch wenn nichts
 * dabei herauskommt: die Viertelstunde ist vergangen.
 * @param {SpielStand} stand @param {string} spielerId
 * @returns {import('./gespraech.js').Zuwendung | null} null, wenn es heute nicht geht
 */
export function fuehrePersoenlichesGespraech(stand, spielerId) {
  const sp = (stand.kader[stand.meinTeam] || []).find((x) => x.id === spielerId);
  if (!sp || gespraecheFrei(stand) === 0) return null;

  bindungVon(stand, sp);
  const zuwendung = persoenlichesGespraech(sp, stand.gespraeche, stand.tag);
  verbucheGespraech(stand, sp);
  return zuwendung;
}

/**
 * Was er von sich aus möchte — ohne zu fragen.
 *
 * Kostet keinen Termin, weil sie nichts miteinander reden: das ist der Blick
 * in die Notiz, die das Gespräch hinterlassen hat. Deshalb kommt hier auch nur
 * ein **ausgesprochener** Wunsch zurück und nie ein bloßer Anlass — den kennt
 * der Manager nicht, solange er nicht gefragt hat.
 * @param {SpielStand} stand @param {string} spielerId
 * @returns {import('./wunsch.js').Wunsch | null}
 */
export function bekannterWunsch(stand, spielerId) {
  const sp = (stand.kader[stand.meinTeam] || []).find((x) => x.id === spielerId);
  return sp ? ausgesprochenerWunsch(sp) : null;
}

/**
 * Nachfragen, ob er einen Wunsch hat: ein Termin, und danach weiß der Manager,
 * woran er ist.
 *
 * Wie beim persönlichen Gespräch gibt es keinen Grund, das zu verbieten — und
 * wie dort wird der Termin auch dann verbucht, wenn nichts dabei herauskommt.
 * Die Frage wurde gestellt.
 * @param {SpielStand} stand @param {string} spielerId
 * @returns {import('./wunsch.js').Auskunft | null} null, wenn es heute nicht geht
 */
export function fuehreWunschGespraech(stand, spielerId) {
  const kader = stand.kader[stand.meinTeam] || [];
  const sp = kader.find((x) => x.id === spielerId);
  if (!sp || gespraecheFrei(stand) === 0) return null;

  bindungVon(stand, sp);
  const auskunft = frageNachWunsch(kader, sp, stand.gespraeche, stand.tag);
  verbucheGespraech(stand, sp);
  return auskunft;
}

/**
 * Die gewünschte Nummer hergeben.
 *
 * Kein Termin: der Manager hat den Wunsch schon gehört, und die Nummer zu
 * genehmigen ist ein Verwaltungsakt, kein Gespräch. Dass es überhaupt eine
 * Entscheidung ist, liegt an der Knappheit — es gibt zehn einstellige, und
 * eine vergebene ist weg.
 * @param {SpielStand} stand @param {string} spielerId
 * @returns {number} Was sich am Commitment bewegt hat; 0, wenn nichts ging
 */
export function erfuelleNummernwunsch(stand, spielerId) {
  const kader = stand.kader[stand.meinTeam] || [];
  const sp = kader.find((x) => x.id === spielerId);
  if (!sp) return 0;

  bindungVon(stand, sp);
  const delta = gibNummer(kader, sp);
  // Kein Termin, aber er hat ihm die Nummer selbst in die Hand gedrückt und
  // gesehen, was sie ihm bedeutet.
  stufeBekannt(sp);
  return delta;
}

/**
 * Gegen welche Positionen er sich noch sperrt.
 *
 * Kostet keinen Termin und ist auch kein Wissen, das erst erfragt werden
 * müsste — anders als beim Wunsch hat er es von sich aus gesagt, und die
 * Nachricht dazu liegt im Postfach. Verborgen bleibt allein, **wie weit** der
 * Manager ihn schon hat.
 * @param {SpielStand} stand @param {string} spielerId
 * @returns {string[]}
 */
export function bekannteAblehnungen(stand, spielerId) {
  const sp = (stand.kader[stand.meinTeam] || []).find((x) => x.id === spielerId);
  return sp ? offeneAblehnungen(sp) : [];
}

/**
 * Ihn fragen, wie es bei ihm aussieht.
 *
 * Kostet einen Termin wie das Wunschgespräch, und wie dort auch dann, wenn
 * nichts dabei herauskommt — die Frage wurde gestellt, und dass die Antwort
 * „alles wie gehabt" lautet, ist selbst eine Auskunft. Ob sie stimmt, weiß der
 * Manager nicht; ob sie ehrlich ist, schon (siehe `auskunft.js`).
 *
 * `bindungVon()` steht davor, weil ein Mann aus einem Stand vor Block 7 noch
 * gar keine Lebenslage hat — die Frage würde ihn sonst nicht finden.
 * @param {SpielStand} stand @param {string} spielerId
 * @returns {import('./auskunft.js').Auskunft | null} null, wenn es heute nicht geht
 */
export function fuehreLebenslageGespraech(stand, spielerId) {
  const sp = (stand.kader[stand.meinTeam] || []).find((x) => x.id === spielerId);
  if (!sp || gespraecheFrei(stand) === 0) return null;

  bindungVon(stand, sp);
  const auskunft = frageNachLebenslage(sp, stand.jahr);
  verbucheGespraech(stand, sp);
  return auskunft;
}

/**
 * Auf ihn einreden, damit er die Position doch spielt.
 *
 * Der Termin wird nur verbucht, wenn es überhaupt etwas zu überzeugen gab —
 * hier anders als beim persönlichen Gespräch und beim Wunsch. Dort ist der
 * leere Ausgang ein Ergebnis („er hat nichts"), hier wäre er ein Aufruf, den
 * es nicht geben dürfte: die Kategorie ist im Dialog unsichtbar, solange keine
 * Ablehnung offen ist.
 * @param {SpielStand} stand @param {string} spielerId @param {string} position
 * @returns {import('./ueberzeugen.js').Zureden | null} null, wenn es heute nicht geht
 */
export function fuehreUeberzeugenGespraech(stand, spielerId, position) {
  const sp = (stand.kader[stand.meinTeam] || []).find((x) => x.id === spielerId);
  if (!sp || gespraecheFrei(stand) === 0) return null;

  bindungVon(stand, sp);
  const zureden = ueberzeuge(sp, position);
  if (zureden) verbucheGespraech(stand, sp);
  return zureden;
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
  /** @type {import('./commitment.js').Grund[]} */
  const gruende = [];

  const basen = vereinsBasen(stand.meinTeam);
  const recruiting = recruitingVon(stand);
  for (const t of TEAMS) {
    const eigen = t.id === stand.meinTeam;
    const abgaenge = lebensjahrKader(stand, t.id);
    // Der eigene Verein bekommt keinen Ersatz mehr geschenkt: er rekrutiert
    // über die Tryouts, und die Lücke bleibt bis zum November offen.
    const { kader, ruecktritte } = saisonWechsel(rng, stand.kader[t.id], basen[t.id],
      new Set(abgaenge.keys()), !eigen);
    stand.kader[t.id] = kader;
    if (eigen) {
      alleRuecktritte.push(...ruecktritte);
      // Wer über das Alter geht, geht aus Körpergründen — das ist, was
      // `ruecktrittAlter` bis Schritt 3 bedeutet.
      gruende.push(...ruecktritte.map((s) => abgaenge.get(s.id) || 'koerper'));
      recruiting.ehemalige.push(...ruecktritte.map((s, i) => ({
        id: s.id,
        name: `${s.vorname} ${s.nachname}`,
        position: s.position,
        alter: s.alter + 1,
        jahr: stand.jahr,
        grund: gruende[gruende.length - ruecktritte.length + i],
        commitment: /** @type {number} */ (s.commitment),
      })));
    }
  }
  // Das Rookie-Training rechnet in Tagen der Saison und endet lange vor ihrem
  // Ende. Stehen bliebe es trotzdem — und der Tag 20 des Vorjahres läge im
  // neuen Jahr wieder vor Tag 42.
  for (const sp of stand.kader[stand.meinTeam]) {
    sp.rookieTrainingBis = null;
    sp.rookieZiel = null;
  }
  recruiting.tryout = null;

  stand.aufstellung = ohneAbgaenge(stand.aufstellung, stand.kader[stand.meinTeam]);
  stand.jahr++;
  stand.tag = 1;
  // Das Gesprächslog gehört der Saison, nicht der Karriere: es zählt Wochen ab
  // Tag 1, und ein Eintrag aus dem Vorjahr läge in derselben Woche wie einer
  // von heute. Es wird geleert wie der Papierkorb der Post.
  stand.gespraeche = [];
  // Die Rollen **bleiben** — nur wer nie eine bekam, taucht in der Kampagne
  // wieder auf. Zurückgesetzt werden die Tagesmerker, die sonst rückwärts
  // liefen: Tag 300 des Vorjahres gegen Tag 5 des neuen gehalten ergäbe eine
  // Sperre, die nie abläuft.
  for (const sp of stand.kader[stand.meinTeam] || []) rolleNeueSaison(sp);
  stand.spielplan = frischerGruppenplan(rng);
  // Die Rookies bekommen ihre Lebenslage im neuen Jahr — nach dem Hochzählen,
  // damit „seit diesem Jahr im Verein" auch dieses Jahr meint.
  ergaenzeBindung(stand);

  // Erst stutzen, dann eröffnen: die Post des neuen Jahres soll die Schere
  // nicht zu sehen bekommen.
  stutzePost(stand);
  const nachrichten = saisonEroeffnung(stand, alleRuecktritte, gruende, false);

  return { meister: champion, ruecktritte: alleRuecktritte, nachrichten };
}

/**
 * Ein Jahr Lebenslauf für jeden im Kader eines Vereins — vor dem
 * Kaderwechsel, mit dem neuen Alter und dem neuen Jahr. Zurück kommen die,
 * die gehen, mit ihrem Grund; die Lebenslagen der anderen sind schon geändert.
 *
 * Jeder Mensch hat seinen eigenen Strom `seed|lebenslauf|jahr|id`: so stört
 * der Lebenslauf den `offseason`-Strom nicht, an dem die Rookies hängen, und
 * die Reihenfolge im Kader spielt keine Rolle.
 * @param {SpielStand} stand
 * @param {string} teamId
 * @returns {Map<string, import('./commitment.js').Grund>}
 */
function lebensjahrKader(stand, teamId) {
  /** @type {Map<string, import('./commitment.js').Grund>} */
  const abgaenge = new Map();
  for (const s of stand.kader[teamId] || []) {
    const grund = lebensjahrSpieler(stand, s, teamId);
    if (grund) abgaenge.set(s.id, grund);
  }
  return abgaenge;
}

/**
 * Ein Jahr Lebenslauf für einen einzelnen Mann. Ändert ihn — die Vorschau am
 * Tag nach dem Finale gibt deshalb eine Kopie hinein, und weil der Strom an
 * seiner Id hängt, rechnet die Kopie genau das, was der Wechsel später rechnet.
 * @param {SpielStand} stand
 * @param {import('./spieler.js').Spieler} s
 * @param {string} teamId
 * @returns {import('./commitment.js').Grund | null} der Grund, wenn er geht
 */
function lebensjahrSpieler(stand, s, teamId) {
  const neuesJahr = stand.jahr + 1;
  const rng = makeRng(`${stand.seed}|lebenslauf|${neuesJahr}|${s.id}`);
  // Das Jahr im Verein zählt vor der Waage: wer lange da ist, hält mehr aus,
  // und das soll er schon in diesem Wechsel tun. `bindungVon()` davor, weil
  // der Bonus einen Wert braucht, an dem er ziehen kann — und danach noch
  // einmal, weil es eine Kopie der Zahl zurückgibt, keinen Verweis.
  bindungVon(stand, s);
  vereinsjahr(s, neuesJahr);
  // Nur die KI: der eigene Verein hat Gespräche und Rolle als Gegengewicht
  // zu Verletzung und Serie, ein KI-Verein hat keins von beidem. Ohne
  // diesen Ersatz sänke der Ligaschnitt jede Saison weiter, ohne Boden.
  if (teamId !== stand.meinTeam) kiAusgleich(s, coachesVon(stand, teamId));
  const ereignis = lebensjahr(rng, bindungVon(stand, s), s.alter + 1, neuesJahr);
  return ereignis && ereignis.art === 'abgang' ? ereignis.grund : null;
}

export { anzahlSpieltage };
