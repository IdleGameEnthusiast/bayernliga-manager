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
 * A table from a header row and body rows.
 * @param {string[]} kopf
 * @param {HTMLElement[]} zeilen
 */
export function tabelle(kopf, zeilen) {
  return el('div', { class: 'tabelle-scroll' },
    el('table', {},
      el('thead', {}, el('tr', {}, kopf.map((h) => el('th', { text: h })))),
      el('tbody', {}, zeilen)));
}

/** @param {number} wert @param {number} max */
export function balken(wert, max) {
  const anteil = Math.max(0, Math.min(1, wert / max));
  return el('div', { class: 'spur' }, el('i', { style: { width: (anteil * 100).toFixed(1) + '%' } }));
}
