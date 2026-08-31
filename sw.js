// Service Worker: hält die App offline lauffähig.
// Netz zuerst, Cache als Rückfall — siehe die Begründung beim fetch-Handler.
const CACHE = 'bayernliga-v1';

/**
 * Alles, was die App zum Starten braucht — in Ladereihenfolge, damit sich
 * beim Lesen sehen lässt, worauf was aufbaut.
 *
 * Die Liste muss **vollständig** sein. `index.html` lädt nur `app.js`, den Rest
 * zieht der Modulgraph nach; wer hier einen Eintrag vergisst, merkt das online
 * nie — dort holt der Netz-zuerst-Handler die Datei einfach — und offline
 * startet die App dann gar nicht. Genau so fehlten hier zeitweise sechs
 * Dateien, darunter die halbe Taktikansicht. `tests/sw.test.js` vergleicht die
 * Liste seitdem mit dem, was auf der Platte liegt.
 */
const SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './i18n.js',
  './manifest.json',
  './engine/constants.js',
  './engine/content.js',
  './engine/positionen.js',
  './engine/spieler.js',
  './engine/aufstellung.js',
  './engine/team.js',
  './engine/spielplan.js',
  './engine/spiel.js',
  './engine/tabelle.js',
  './engine/saison.js',
  './engine/save.js',
  './ui/dom.js',
  './ui/frage.js',
  './ui/intro.js',
  './ui/start.js',
  './ui/bracket.js',
  './ui/tabelle.js',
  './ui/aufstellung.js',
  './ui/kader.js',
  './ui/taktik.js',
  './ui/spielplan.js',
  './ui/spielbericht.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (new URL(e.request.url).origin !== location.origin) return;

  // Netz zuerst, Cache als Rückfall.
  //
  // Andersherum — Cache zuerst — wäre einen Tick schneller, würde aber nach
  // jeder Änderung die alte Version ausliefern, bis jemand daran denkt, CACHE
  // hochzuzählen. Das kostet mehr Nerven, als die paar Millisekunden wert sind.
  // Offline funktioniert so genauso: dann greift schlicht der Rückfall.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const kopie = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, kopie));
        }
        return res;
      })
      .catch(() => caches.match(e.request)
        .then((treffer) => treffer || caches.match('./index.html'))
        .then((treffer) => treffer || Response.error())),
  );
});
