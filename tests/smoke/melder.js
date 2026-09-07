/**
 * Der Berichterstatter des Rauchtests.
 *
 * **Klassisches Skript, kein Modul** — und das ist der ganze Trick: es läuft
 * auch dann, wenn der Modulgraph der Seite gar nicht erst lädt. Genau dann ist
 * eine Meldung am wichtigsten, denn ein Rauchtest, der schweigend nichts tut,
 * sieht aus wie einer, der nichts gefunden hat.
 *
 * Es meldet doppelt: sichtbar auf die Seite, damit ein Mensch die Seite von
 * Hand aufmachen kann, und an `tests/smoke.js` zurück, damit ein Skript ein
 * Urteil bekommt statt eines Bildes.
 */
(function () {
  const zeilen = [];
  const fehler = [];
  let gemeldet = false;

  addEventListener('error', (e) =>
    fehler.push(`onerror: ${e.message} @ ${e.filename}:${e.lineno}`));
  addEventListener('unhandledrejection', (e) => fehler.push('offene Zusage: ' + e.reason));

  // --- Was eine Prüfung sagen kann ----------------------------------------

  window.q = (s) => document.querySelector(s);
  window.alle = (s) => [...document.querySelectorAll(s)];
  window.txt = (s) => {
    const e = window.q(s);
    return e ? e.textContent.trim() : '<fehlt: ' + s + '>';
  };
  window.pruefe = (name, gut, detail = '') =>
    zeilen.push([gut ? 'PASS' : 'FAIL', name, gut ? '' : String(detail)]);
  window.gleich = (name, ist, soll) =>
    window.pruefe(name, ist === soll, `ist ${JSON.stringify(ist)}, soll ${JSON.stringify(soll)}`);
  window.enthaelt = (name, ist, teil) =>
    window.pruefe(name, typeof ist === 'string' && ist.includes(teil),
      `${JSON.stringify(ist)} enthält kein ${JSON.stringify(teil)}`);
  window.merkeFehler = (e) => fehler.push(String((e && e.stack) || e));

  // --- Und wie es hinausgeht ----------------------------------------------

  window.melde = function melde() {
    if (gemeldet) return;
    gemeldet = true;

    const schlecht = zeilen.filter((z) => z[0] === 'FAIL').length + fehler.length;
    const ziel = document.getElementById('bericht');
    if (ziel) {
      ziel.innerHTML = '<b>' + (schlecht === 0 ? 'alles grün' : schlecht + ' Fehler')
        + ' — ' + zeilen.length + ' Prüfungen</b>'
        + zeilen.map(([s, n, d]) => `<div class="${s}">${s} ${n}${d ? ' — ' + d : ''}</div>`).join('')
        + fehler.map((f) => `<div class="FAIL">FEHLER ${f}</div>`).join('');
    }

    const bericht = JSON.stringify({ suite: document.title, zeilen, fehler });
    // sendBeacon, weil der Runner den Browser gleich danach abräumt: ein
    // laufendes fetch() stürbe mit ihm, ein Beacon ist schon abgegeben.
    if (!navigator.sendBeacon('/ergebnis', bericht)) {
      fetch('/ergebnis', { method: 'POST', body: bericht, keepalive: true }).catch(() => {});
    }
  };

  // Die Notbremse: hat bis hierhin niemand gemeldet, ist die Seite unterwegs
  // steckengeblieben. Dann geht raus, was da ist — mitsamt der Fehler, die es
  // erklären.
  addEventListener('load', () => setTimeout(() => {
    if (!gemeldet) {
      fehler.push('die Seite ist nicht bis zum Ende gekommen');
      window.melde();
    }
  }, 2000));
}());
