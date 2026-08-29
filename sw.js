// Service Worker: hält die App offline lauffähig.
// Netz zuerst, Cache als Rückfall — siehe die Begründung beim fetch-Handler.
const CACHE = 'bayernliga-v1';

const SHELL = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './i18n.js',
  './manifest.json',
  './engine/constants.js',
  './engine/content.js',
  './engine/spieler.js',
  './engine/team.js',
  './engine/spielplan.js',
  './engine/spiel.js',
  './engine/tabelle.js',
  './engine/saison.js',
  './engine/save.js',
  './ui/dom.js',
  './ui/start.js',
  './ui/tabelle.js',
  './ui/kader.js',
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
