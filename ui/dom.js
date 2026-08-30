// @ts-check
/** Tiny DOM helpers. Every DOM call in the app goes through ui/. */

/**
 * @param {string} tag
 * @param {Record<string, any>} [props]
 * @param {...(Node|string|null|undefined|(Node|string)[])} kinder
 * @returns {HTMLElement}
 */
export function el(tag, props, ...kinder) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = String(v);
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') {
      n.addEventListener(k.slice(2).toLowerCase(), v);
    } else n.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kind of kinder.flat()) {
    if (kind == null) continue;
    n.append(typeof kind === 'string' ? document.createTextNode(kind) : kind);
  }
  return n;
}

/** @param {HTMLElement} n */
export function leere(n) {
  while (n.firstChild) n.removeChild(n.firstChild);
  return n;
}

/**
 * A table from a header row and body rows. A header entry may be a ready-made
 * `th` — that is how the Kader hangs its sort handlers on the column names.
 * @param {(string|HTMLElement)[]} kopf
 * @param {HTMLElement[]} zeilen
 */
export function tabelle(kopf, zeilen) {
  return el('div', { class: 'tabelle-scroll' },
    el('table', {},
      el('thead', {}, el('tr', {},
        kopf.map((h) => (typeof h === 'string' ? el('th', { text: h }) : h)))),
      el('tbody', {}, zeilen)));
}

/** @param {number} wert @param {number} max */
export function balken(wert, max) {
  const anteil = Math.max(0, Math.min(1, wert / max));
  return el('div', { class: 'spur' }, el('i', { style: { width: (anteil * 100).toFixed(1) + '%' } }));
}

/**
 * Fünf Sterne, von denen `halbe` halbe gefüllt sind.
 *
 * Zwei Reihen übereinander statt eines Halbstern-Zeichens: `\u2bea` und seines-
 * gleichen fehlen in zu vielen Schriften, und ein Kasten statt eines Sterns wäre
 * schlimmer als gar keine. Die gefüllte Reihe wird auf die halbe Breite
 * beschnitten — das trifft die Hälfte in jeder Schrift.
 * @param {number} halbe 0..10
 * @param {string} [titel] Was darunter steht, für Maus und Vorleser
 */
export function sterne(halbe, titel) {
  const anteil = Math.max(0, Math.min(10, halbe)) / 10;
  return el('span', { class: 'sterne', title: titel, role: 'img', 'aria-label': titel },
    el('span', { class: 'sterne-leer', 'aria-hidden': 'true', text: '\u2605\u2605\u2605\u2605\u2605' }),
    el('span', {
      class: 'sterne-voll',
      'aria-hidden': 'true',
      style: { width: (anteil * 100).toFixed(0) + '%' },
      text: '\u2605\u2605\u2605\u2605\u2605',
    }));
}

/**
 * Der Vereinstupfer: Primärfarbe oben, Sekundärfarbe unten. Zweifarbig, weil
 * zwei Vereine dieser Liga in Schwarz spielen und sonst nicht zu unterscheiden
 * wären — und weil Schwarz auf dunklem Grund einen Umriss braucht.
 * @param {import('../engine/content.js').TeamDef} team
 * @param {Record<string, string>} [stil]
 */
export function farbtupfer(team, stil) {
  const { primaer, sekundaer } = team.farben;
  return el('span', {
    class: 'farbtupfer',
    style: {
      background: `linear-gradient(to bottom, ${primaer} 0 58%, ${sekundaer} 58% 100%)`,
      ...(stil || {}),
    },
  });
}

/**
 * Schwarz oder Weiß — was auf der gegebenen Fläche lesbar ist.
 * @param {string} hex
 */
export function kontrastFarbe(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150 ? '#111' : '#fff';
}
