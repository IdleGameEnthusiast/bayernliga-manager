// @ts-check
/**
 * Persistence: localStorage for the working save, JSON files for backup and
 * for moving a career between PC and iPad.
 *
 * A full save is roughly 150 KB, comfortably inside the localStorage budget,
 * so this stays synchronous and simple. Browser storage is durable for an
 * installed web app but never sacred — the export is the real backup.
 *
 * **Hier liegt der Migrationspfad.** Ein Stand mit einer älteren
 * `SAVE_VERSION` wird umgerechnet statt weggeworfen; erst wenn kein Schritt
 * mehr greift, ist Schluss. Wer die Form von `SpielStand` ändert, zählt
 * `SAVE_VERSION` hoch und legt hier einen Schritt dazu.
 */

import { SAVE_VERSION } from './saison.js';

/** Der eine Schlüssel. Alles, was anders heißt, ist Müll von vorgestern. */
export const STORAGE_KEY = 'bayernliga.save';

/**
 * Der Migrationspfad: je ein Schritt, der einen Stand **um genau eine Version**
 * hebt. Der Schlüssel ist die Nummer, von der aus gehoben wird.
 *
 * Ein Schritt darf den Stand an Ort und Stelle ändern — er arbeitet auf frisch
 * geparstem JSON, das sonst niemand in der Hand hat — und muss die neue Nummer
 * selbst eintragen. Er kennt **nur** die beiden Formen an seinen Enden, nie den
 * heutigen `SpielStand`: sonst müsste jeder alte Schritt mitwachsen, sobald die
 * Form sich wieder ändert, und genau daran gehen Migrationspfade ein.
 *
 * Kettenschritte statt Sprüngen: ein Stand aus Version 4 läuft durch 4→5, 5→6,
 * 6→7. Das kostet ein paar Zeilen mehr als eine Tabelle voller Direktwege und
 * spart, dass sie quadratisch wächst.
 *
 * Fehlt eine Nummer in dieser Tabelle, ist der Stand älter als der Pfad und
 * wird abgelehnt — laut und mit der Nummer im Text.
 * @type {Record<number, (roh: any) => any>}
 */
const MIGRATIONEN = {
  // 16 → 17: neben dem Plan in der Lebenslage steht jetzt `horizontWahrheit` —
  // was wirklich kommt, wenn es anders kommt als angekündigt. Fehlt das Feld,
  // hält der Plan, und das ist für einen alten Stand nicht nur die bequeme,
  // sondern die richtige Auskunft: bis gestern **war** der Plan die Wahrheit,
  // die Engine hat mit nichts anderem gerechnet.
  //
  // Nachträglich würfeln wäre hier schlimmer als in den drei Schritten davor.
  // Es hieße, jedem Spieler eines laufenden Standes rückwirkend ein Geheimnis
  // anzudichten — und zwar eines, das der Manager in der Saison zuvor hätte
  // erfragen können und nicht erfragt hat, weil es die Frage nicht gab. Die
  // Wahrheiten kommen deshalb mit dem nächsten Plan, also beim nächsten
  // Horizont, für jeden Menschen einzeln.
  16: (roh) => {
    roh.version = 17;
    return roh;
  },

  // 15 → 16: „Überzeugen" kam und mit ihm `abgelehntePositionen` am Spieler —
  // das Feld, das „Wunsch anhören" bewusst ausgelassen hatte, weil es dort
  // niemand gefüllt hätte. Fehlt es, hat sich nie jemand gegen etwas gesperrt,
  // und für einen alten Stand ist das die Wahrheit: die Ablehnung entsteht nur
  // nach einem Spiel auf einer fremden Position, und diese Prüfung gab es
  // damals nicht.
  //
  // Sie nachzutragen wäre auch hier falsch und nicht nur überflüssig. Die drei
  // Bedingungen ließen sich aus einem alten Stand zwar rechnen — aber sie
  // beschreiben einen Moment, in dem ein Spieler nach dem Spiel etwas gesagt
  // hat. Diesen Moment hat es nicht gegeben, und ein Migrationsschritt darf
  // keine Vergangenheit erfinden.
  15: (roh) => {
    roh.version = 16;
    return roh;
  },

  // 14 → 15: „Wunsch anhören" kam, und mit ihm zwei Felder am Spieler —
  // `wunschPlatz` und `wunschNummer`. Beide bedeuten „fehlt = kein Wunsch
  // ausgesprochen", und genau das ist für einen alten Stand auch die Wahrheit:
  // in ihm hat nie jemand nachgefragt. Der Schritt fasst deshalb keinen
  // Menschen an, wie schon 10 → 11 bei der Bindung.
  //
  // Anlegen wäre hier sogar falsch, nicht nur überflüssig. Der **Anlass** zu
  // einem Wunsch rechnet sich aus den Einsätzen und der Eignung und gilt auch
  // ungefragt; was in diesen Feldern steht, ist das Wissen des Managers davon.
  // Ein Schritt, der sie füllte, legte einem alten Stand Gespräche in den
  // Mund, die nie stattgefunden haben.
  14: (roh) => {
    roh.version = 15;
    return roh;
  },

  // 13 → 14: Talent ist keine Zahl auf der Werteleiter mehr, sondern stehen
  // halbe Sterne, 1 bis 10. Umgerechnet wird nach genau der Regel, mit der die
  // Sterne bis gestern **gezeichnet** wurden — eine Zehnerstufe je halber
  // Stern —, damit kein Kader nach dem Laden anders aussieht als vor dem
  // Update. Was der alte Wert außerdem war, nämlich der Deckel, aus dem die
  // Stärke fiel, geht dabei verloren: sie steht ohnehin schon am Mann und
  // führt ab hier selbst.
  //
  // Die Grenzen stehen hier als Zahlen und nicht als `TALENT_MIN`/`TALENT_MAX`
  // aus `constants.js`. Ein Schritt kennt nur die beiden Formen an seinen
  // Enden; zöge er die Konstanten von heute, verschöbe sich diese Umrechnung
  // stumm mit, sobald jemand die Skala noch einmal anfasst.
  13: (roh) => {
    for (const team in roh.kader || {}) {
      for (const s of roh.kader[team]) {
        s.talent = Math.max(1, Math.min(10, Math.floor((s.talent || 0) / 10) + 1));
      }
    }
    roh.version = 14;
    return roh;
  },

  // 12 → 13: die Rolle kam — und mit ihr das Gesprächslog. Am Spieler sind es
  // vier Felder, die alle „fehlt = der natürliche Nullwert" bedeuten: `rolle`
  // (noch keine bekommen, also taucht er in der Kampagne auf), das Einsatz-
  // fenster (leer, füllt sich ab dem nächsten Spiel), und die beiden Tages-
  // merker für Cooldown und Beschwerde. Keines davon will gezogen werden, also
  // fasst der Schritt keinen Menschen an — wie schon bei der Bindung.
  //
  // Angelegt wird nur das Log: es ist ein Behälter am Stand, kein Feld an einer
  // Person, und `gespraecheFrei()` zählt darin. Ein fehlendes Array fänge der
  // Lesepfad zwar ab, aber ein Stand soll nach der Migration vollständig sein
  // und nicht erst nach dem ersten Zugriff — wie `coaches` in 8 → 9.
  12: (roh) => {
    roh.gespraeche = [];
    roh.version = 13;
    return roh;
  },

  // 11 → 12: der Lebenslauf kam — die Lebenslage bewegt sich jetzt von Jahr
  // zu Jahr. Dabei wuchs sie um Felder, die ein alter Stand alle nicht trägt
  // und alle nicht braucht: `druckJahre` (fehlt = 0), `verlaengert` (fehlt =
  // nein), `horizont.grund` an einem Schluss (fehlt = Körper, wie der Satz es
  // vorher jedem Schluss zuschrieb), der Plan `familie`, und die Gründe an der
  // Rücktritts-Nachricht (fehlen = nur die Namen). Ein Arbeiter ohne Horizont
  // bekommt seinen Zyklus beim ersten Saisonwechsel aus dem Saatgut. Der
  // Schritt hebt deshalb nur die Nummer — und ist trotzdem einer, denn ohne
  // ihn flöge jede Karriere von gestern beim Laden weg.
  11: (roh) => {
    roh.version = 12;
    return roh;
  },

  // 10 → 11: Commitment und Lebenslage kamen an Spieler und Coach. Der
  // Schritt fasst keinen Menschen an — die Felder zieht `bindungVon()` beim
  // ersten Zugriff aus dem Saatgut nach, wie den Stab. Zöge der Schritt sie
  // hier, kennte er den heutigen Generator und müsste mitwachsen, sobald sich
  // die Ziehung ändert. Was er hebt, ist nur die Nummer: sie sagt, dass die
  // Felder ab hier fehlen dürfen, ohne dass etwas kaputt ist.
  10: (roh) => {
    roh.version = 11;
    return roh;
  },

  // 9 → 10: die Nachricht „Unbesetzte Plätze" mit ihrer Antwortpflicht gibt es
  // nicht mehr — die Frage stellt jetzt der Kickoff-Knopf. Ein Stand, der so
  // eine Nachricht noch trägt, verlöre sie beim Zeichnen des Postfachs, denn
  // ihren Text gibt es nicht mehr; eine offene hielte obendrein den Kalender
  // an, ohne dass irgendein Knopf sie noch beantworten könnte. Sie fliegt
  // deshalb aus der Post, gelesen oder nicht.
  9: (roh) => {
    roh.post = (roh.post || []).filter(
      (/** @type {{ art: string }} */ n) => n.art !== 'aufstellungUnvollstaendig');
    roh.version = 10;
    return roh;
  },

  // 8 → 9: der Stab kam dazu, `coaches` je Verein. Der Schritt legt nur die
  // leere Karte an — die Coaches selbst zieht `coachesVon()` beim ersten
  // Blick darauf nach, deterministisch aus dem Saatgut. Zöge der Schritt sie
  // hier, kennte er den heutigen Generator, und genau das darf ein Schritt
  // nicht: sobald der sich ändert, müsste dieser Schritt mitwachsen.
  8: (roh) => {
    roh.coaches = {};
    roh.version = 9;
    return roh;
  },

  // 7 → 8: jedes Ergebnis trägt jetzt `nichtAngetreten` — wer keine vollständige
  // Elf stellte, wird 0:36 gewertet statt gespielt. Alte Partien wurden alle
  // gespielt, und das Fehlen des Feldes heißt genau das. Der Schritt hebt
  // deshalb nur die Nummer; er ist trotzdem einer, denn ohne ihn flöge jede
  // Karriere von gestern beim Laden weg.
  7: (roh) => {
    roh.version = 8;
    return roh;
  },

  // 6 → 7: der Posteingang bekam den Ordner „Gelöscht". Bis dahin galt
  // gelesen = archiviert; jetzt entscheidet der Manager, und dafür braucht
  // jede Nachricht ein eigenes Feld. Alles Bestehende liegt im Eingang —
  // gelesen oder nicht, weggeworfen hat es niemand.
  6: (roh) => {
    for (const n of roh.post || []) n.geloescht = false;
    roh.version = 7;
    return roh;
  },
};

/**
 * Einen gelesenen Stand auf die heutige Version heben — oder ihn ablehnen.
 *
 * Danach wird nur der Stempel geprüft, nicht die Form: ein Stand, der oben aus
 * der Kette fällt, entspricht diesem Build und ist damit per Definition gültig.
 * Was dahinter schiefgeht, ist ein Fehler im Code oder in einem
 * Migrationsschritt und soll auch laut sein.
 *
 * Ein Stand aus der **Zukunft** wird nicht angefasst: rückwärts rechnet hier
 * nichts, und ein iPad, das dem PC eine Version voraus ist, ist ein Fall für
 * ein Neuladen und nicht für einen Notbehelf.
 * @param {any} roh
 * @returns {any} derselbe Stand, mit `version === SAVE_VERSION`
 * @throws wenn kein Weg von seiner Version zur heutigen führt
 */
export function migriere(roh) {
  if (!roh || typeof roh !== 'object') throw new Error('Speicherstand ist leer');
  if (typeof roh.version !== 'number') throw new Error('Speicherstand hat keine Version');
  if (roh.version > SAVE_VERSION) {
    throw new Error(`Speicherstand ist Version ${roh.version}, `
      + `dieser Build kennt nur bis ${SAVE_VERSION}`);
  }

  let stand = roh;
  while (stand.version < SAVE_VERSION) {
    const schritt = MIGRATIONEN[stand.version];
    if (!schritt) throw new Error(`Für Version ${stand.version} gibt es keinen Weg nach vorn`);
    const vorher = stand.version;
    stand = schritt(stand);
    // Ein Schritt, der die Nummer nicht hebt, ließe die Schleife ewig laufen.
    if (!stand || stand.version <= vorher) {
      throw new Error(`Der Schritt von Version ${vorher} hat nichts gehoben`);
    }
  }
  return stand;
}

/** @param {import('./saison.js').SpielStand} stand */
export function speichere(stand) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stand));
    return true;
  } catch (e) {
    console.warn('Speichern fehlgeschlagen', e);
    return false;
  }
}

/**
 * Den Speicherstand lesen — und unterwegs so weit nach vorn holen, wie der
 * Migrationspfad reicht. Was er nicht mehr erreicht, wird **gelöscht** statt
 * halb gerettet: ein Stand ohne Weg beschriebe eine App, die es nicht mehr
 * gibt.
 *
 * Ein migrierter Stand wird hier **nicht** zurückgeschrieben. Das erledigt der
 * nächste `speichere()` von selbst, und bis dahin liegt die alte Fassung noch
 * auf der Platte — was ein Export retten kann, wenn ein Schritt danebengreift.
 * @returns {import('./saison.js').SpielStand | null}
 */
export function lade() {
  const roh = localStorage.getItem(STORAGE_KEY);
  if (!roh) return null;
  try {
    return migriere(JSON.parse(roh));
  } catch (e) {
    console.warn('Speicherstand verworfen', e);
    loesche();
    return null;
  }
}

export function gibtEsSpeicherstand() {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Alles wegräumen, was diese App je abgelegt hat — auch die Schlüssel früherer
 * Builds (`bayernliga.save.v5` und so weiter). Die liest niemand mehr, also
 * haben sie auch keinen Grund, im Speicher des Browsers liegen zu bleiben.
 */
export function loesche() {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key === STORAGE_KEY || key.startsWith(`${STORAGE_KEY}.`)) {
        localStorage.removeItem(key);
      }
    }
  } catch { /* nichts zu tun */ }
}

/**
 * The save as a downloadable file.
 * @param {import('./saison.js').SpielStand} stand
 */
export function exportiere(stand) {
  return JSON.stringify(stand, null, 2);
}

/**
 * @param {string} text
 * @returns {import('./saison.js').SpielStand}
 */
export function importiere(text) {
  return migriere(JSON.parse(text));
}

/** @param {import('./saison.js').SpielStand} stand */
export function dateiName(stand) {
  return `bayernliga-${stand.meinTeam}-${stand.jahr}-tag${stand.tag}.json`;
}
