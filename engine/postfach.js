// @ts-check
/**
 * Das Postfach: was der Verein dem Manager mitteilt — und der eine Fall, in
 * dem er antworten muss, bevor ein Tag weitergeht.
 *
 * Eine Nachricht speichert **einen Schlüssel und ihre Daten, nie einen Satz.**
 * Damit lassen sich Texte ändern, ohne alte Speicherstände zu verfälschen, eine
 * Nachricht wiegt rund 120 statt 400 Bytes — und `engine/` muss `i18n.js` nicht
 * mehr importieren. Genau diese eine dokumentierte Ausnahme von „engine kennt
 * kein außen" löst das Postfach auf, statt sie zu vergrößern.
 *
 * Docs: docs/umbau-kalender.md, Abschnitte 5 und 9
 */

/**
 * @typedef {object} Nachricht
 * @property {string} id       `${jahr}-${tag}-${lfd}` — deterministisch, nie Date.now()
 * @property {number} jahr
 * @property {number} tag
 * @property {string} art      Schlüssel in T.post
 * @property {Record<string, any>} daten
 * @property {boolean} gelesen
 * @property {boolean} geloescht  Liegt im Ordner „Gelöscht"
 * @property {string | null} antwort  null = offen; wirkt nur bei Arten mit Antwortpflicht
 */

/**
 * Die Arten, die eine Antwort verlangen, und welche Antworten sie kennen.
 *
 * Der Schlüssel steht hier, der Satz dazu in `i18n.js`. Solange eine dieser
 * Nachrichten offen ist, geht kein Tag weiter — das ist der ganze Mechanismus,
 * und er wächst später nur um Einträge in dieser Tabelle.
 *
 * Das Wort des Vorstands stand hier einmal mit drin und verlangte ein „Ja, ich
 * bin bereit". Es war die erste Nachricht jeder Saison und damit die einzige
 * Antwortpflicht, die nie eine Wahl war — eine Bremse ohne Entscheidung
 * dahinter. Sie ist raus; wer sie zurückholen will, holt sich einen Klick
 * zurück, der nichts bewirkt.
 * @type {Record<string, string[]>}
 */
export const ANTWORTEN = {
  aufstellungUngueltig: ['automatisch', 'selbst'],
  aufstellungUnvollstaendig: ['automatisch', 'antreten'],
};

/**
 * Die Obergrenze. Ohne sie frisst eine Karriere über zwanzig Saisons den
 * `localStorage` auf — und zwar erst nach Monaten Spielzeit, wenn niemand mehr
 * mit dem Postfach rechnet.
 */
export const POST_MAX = 300;

/** @param {string} art */
export function brauchtAntwort(art) {
  return Object.prototype.hasOwnProperty.call(ANTWORTEN, art);
}

/** @param {string} art @returns {string[]} */
export function antwortenZu(art) {
  return ANTWORTEN[art] || [];
}

/**
 * Die laufende Nummer für den nächsten Eintrag eines Tages.
 *
 * Sie zählt, was schon da ist, statt hochzuzählen: derselbe Speicherstand muss
 * beim erneuten Spielen dieselben Nachrichten mit denselben Kennungen ergeben,
 * und ein Zähler im Zustand wäre eine zweite Wahrheit über dieselbe Zahl.
 * @param {Nachricht[]} post @param {number} jahr @param {number} tag
 */
export function laufendeNummer(post, jahr, tag) {
  return post.filter((n) => n.jahr === jahr && n.tag === tag).length + 1;
}

/**
 * Nachrichten bauen, ohne sie abzulegen — die reine Hälfte von `sende()`.
 * @param {import('./saison.js').SpielStand} stand
 * @param {number} tag
 * @param {{ art: string, daten?: Record<string, any> }[]} eintraege
 * @returns {Nachricht[]}
 */
export function baueNachrichten(stand, tag, eintraege) {
  if (eintraege.length === 0) return [];
  let nr = laufendeNummer(stand.post, stand.jahr, tag);
  return eintraege.map((e) => ({
    id: `${stand.jahr}-${tag}-${nr++}`,
    jahr: stand.jahr,
    tag,
    art: e.art,
    daten: e.daten || {},
    gelesen: false,
    geloescht: false,
    antwort: null,
  }));
}

/**
 * Nachrichten bauen und ablegen.
 * @param {import('./saison.js').SpielStand} stand
 * @param {number} tag
 * @param {{ art: string, daten?: Record<string, any> }[]} eintraege
 * @returns {Nachricht[]}
 */
export function sende(stand, tag, eintraege) {
  const neue = baueNachrichten(stand, tag, eintraege);
  stand.post.push(...neue);
  return neue;
}

/**
 * Was den Kalender anhält: Nachrichten mit Antwortpflicht, die keine haben.
 *
 * Der Papierkorb zählt mit — eine offene Antwort ließe sich sonst wegwerfen
 * statt zu geben. `loescheNachricht()` verhindert genau das, und diese Zeile
 * bleibt trotzdem ohne Filter, damit die Bremse nicht an zwei Stellen hängt.
 * @param {import('./saison.js').SpielStand} stand
 */
export function offeneAntworten(stand) {
  return stand.post.filter((n) => brauchtAntwort(n.art) && n.antwort === null);
}

/** @param {import('./saison.js').SpielStand} stand @param {string} id */
export function nachrichtMit(stand, id) {
  return stand.post.find((n) => n.id === id) || null;
}

/**
 * Eine Nachricht als gelesen führen.
 *
 * Gelesen heißt nur gelesen: die Nachricht bleibt im Posteingang stehen, bis
 * der Manager sie löscht. Sie wanderte einmal beim Lesen von selbst in ein
 * Archiv — das räumte den Eingang auf, aber es nahm ihm auch jede Nachricht,
 * die man ein zweites Mal ansehen wollte, ohne einen Ordner zu wechseln.
 * @param {import('./saison.js').SpielStand} stand @param {string} id
 */
export function markiereGelesen(stand, id) {
  const n = nachrichtMit(stand, id);
  if (n) n.gelesen = true;
  return n;
}

/**
 * In den Ordner „Gelöscht" legen.
 *
 * Eine offene Antwortpflicht wird nicht gelöscht: sie hält die Uhr an, und ein
 * Löschknopf wäre ein zweiter Weg an der Entscheidung vorbei — die Uhr stünde
 * danach still, ohne dass irgendwo noch etwas zu sehen wäre.
 * @param {import('./saison.js').SpielStand} stand @param {string} id
 * @returns {Nachricht | null} die gelöschte Nachricht, oder null
 */
export function loescheNachricht(stand, id) {
  const n = nachrichtMit(stand, id);
  if (!n || (brauchtAntwort(n.art) && n.antwort === null)) return null;
  n.geloescht = true;
  return n;
}

/**
 * Aus dem Ordner „Gelöscht" zurück in den Posteingang.
 * @param {import('./saison.js').SpielStand} stand @param {string} id
 * @returns {Nachricht | null}
 */
export function stelleWiederHer(stand, id) {
  const n = nachrichtMit(stand, id);
  if (!n) return null;
  n.geloescht = false;
  return n;
}

/**
 * Antworten. Eine Antwort, die die Art nicht kennt, wird abgelehnt statt
 * gespeichert — sonst stünde im Speicherstand ein Schlüssel, den später
 * niemand mehr auflösen kann.
 * @param {import('./saison.js').SpielStand} stand
 * @param {string} id @param {string} antwort
 * @returns {Nachricht | null} die beantwortete Nachricht, oder null
 */
export function beantworte(stand, id, antwort) {
  const n = nachrichtMit(stand, id);
  if (!n || !antwortenZu(n.art).includes(antwort)) return null;
  n.antwort = antwort;
  n.gelesen = true;
  return n;
}

/**
 * Das Postfach beim Saisonwechsel stutzen: der Papierkorb wird geleert, und
 * über POST_MAX hinaus fällt das Älteste nach.
 *
 * Die Schere greift nur, wo der Manager schon selbst geschnitten hat. Sie warf
 * einmal alles Gelesene weg — das ist dieselbe automatische Archivierung wie
 * beim Lesen, nur ein Jahr später und ohne dass jemand zusieht.
 * @param {import('./saison.js').SpielStand} stand
 */
export function stutzePost(stand) {
  stand.post = stand.post.filter((n) => !n.geloescht);
  if (stand.post.length > POST_MAX) stand.post = stand.post.slice(-POST_MAX);
  return stand.post;
}
