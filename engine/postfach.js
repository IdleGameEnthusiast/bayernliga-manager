// @ts-check
/**
 * Das Postfach: was der Verein dem Manager mitteilt — und die zwei Fälle, in
 * denen er antworten muss, bevor ein Tag weitergeht.
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
 * @property {string | null} antwort  null = offen; wirkt nur bei Arten mit Antwortpflicht
 */

/**
 * Die Arten, die eine Antwort verlangen, und welche Antworten sie kennen.
 *
 * Der Schlüssel steht hier, der Satz dazu in `i18n.js`. Solange eine dieser
 * Nachrichten offen ist, geht kein Tag weiter — das ist der ganze Mechanismus,
 * und er wächst später nur um Einträge in dieser Tabelle.
 * @type {Record<string, string[]>}
 */
export const ANTWORTEN = {
  vorstandsziel: ['ja'],
  aufstellungUngueltig: ['automatisch', 'selbst'],
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
 * Eine Nachricht als gelesen führen. Gelesene Nachrichten *sind* das Archiv —
 * einen eigenen Verlauf braucht es daneben nicht.
 * @param {import('./saison.js').SpielStand} stand @param {string} id
 */
export function markiereGelesen(stand, id) {
  const n = nachrichtMit(stand, id);
  if (n) n.gelesen = true;
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
 * Das Postfach beim Saisonwechsel stutzen: alles Gelesene ohne Antwortpflicht
 * fällt weg, und über POST_MAX hinaus fällt das Älteste nach.
 * @param {import('./saison.js').SpielStand} stand
 */
export function stutzePost(stand) {
  stand.post = stand.post.filter((n) => !(n.gelesen && !brauchtAntwort(n.art)));
  if (stand.post.length > POST_MAX) stand.post = stand.post.slice(-POST_MAX);
  return stand.post;
}

/**
 * Die Nachrichten eines Tages der laufenden Saison — was das Monatsraster als
 * Briefmarke an einem Datum zeigt.
 * @param {import('./saison.js').SpielStand} stand @param {number} tag
 */
export function nachrichtenAmTag(stand, tag) {
  return stand.post.filter((n) => n.jahr === stand.jahr && n.tag === tag);
}
