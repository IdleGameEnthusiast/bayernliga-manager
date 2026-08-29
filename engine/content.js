// @ts-check
/**
 * The catalogues: clubs and the name pools players are drawn from.
 * Data only — no rules live here.
 */

const SCHWARZ = '#000000';
const WEISS = '#ffffff';

/**
 * @typedef {object} Farben
 * @property {string} primaer
 * @property {string} sekundaer
 * @property {string} tertiaer
 */

/**
 * @typedef {object} TeamDef
 * @property {string} id
 * @property {string} name       Full club name as shown in the UI
 * @property {string} kurz       Two or three letters, as the club writes it
 * @property {string} stadt
 * @property {'nord'|'sued'} gruppe
 * @property {number} staerke    0..100, the baseline the club's Kader is drawn around
 * @property {Farben} farben
 */

export const GRUPPEN = /** @type {const} */ (['nord', 'sued']);

/**
 * Twelve clubs in two groups of six. The group stage is a double round robin
 * inside the group; the playoffs cross the groups.
 */
export const TEAMS = /** @type {TeamDef[]} */ ([
  { id: 'heg', name: 'Hemhofen Gechers',      kurz: 'HEG', stadt: 'Hemhofen',              gruppe: 'nord', staerke: 65, farben: { primaer: '#ee1c27', sekundaer: SCHWARZ,   tertiaer: WEISS } },
  { id: 'ass', name: 'Aschaffenburg Stallions', kurz: 'ASS', stadt: 'Aschaffenburg',       gruppe: 'nord', staerke: 62, farben: { primaer: '#ea0000', sekundaer: WEISS,     tertiaer: SCHWARZ } },
  { id: 'gc',  name: 'Gendorf Crusaders',     kurz: 'GC',  stadt: 'Burgkirchen a. d. Alz', gruppe: 'sued', staerke: 60, farben: { primaer: '#030405', sekundaer: WEISS,     tertiaer: '#e2192c' } },
  { id: 'ers', name: 'Erlangen Sharks',       kurz: 'ERS', stadt: 'Erlangen',              gruppe: 'nord', staerke: 58, farben: { primaer: '#0d2e5e', sekundaer: '#f64536', tertiaer: WEISS } },
  { id: 'kba', name: 'Königsbrunn Ants',      kurz: 'KBA', stadt: 'Königsbrunn',           gruppe: 'sued', staerke: 58, farben: { primaer: SCHWARZ,   sekundaer: '#f20c06', tertiaer: WEISS } },
  { id: 'fel', name: 'Feldkirchen Lions',     kurz: 'FEL', stadt: 'Feldkirchen',           gruppe: 'sued', staerke: 57, farben: { primaer: '#d2b982', sekundaer: SCHWARZ,   tertiaer: WEISS } },
  { id: 'sta', name: 'Starnberg Argonauts',   kurz: 'STA', stadt: 'Starnberg',             gruppe: 'sued', staerke: 56, farben: { primaer: '#0d173b', sekundaer: '#a4cff0', tertiaer: WEISS } },
  { id: 'hr',  name: 'Herzo Rhinos',          kurz: 'HR',  stadt: 'Herzogenaurach',        gruppe: 'nord', staerke: 50, farben: { primaer: '#858585', sekundaer: '#c10e1a', tertiaer: WEISS } },
  { id: 'mr',  name: 'München Rangers',       kurz: 'MR',  stadt: 'München',               gruppe: 'sued', staerke: 49, farben: { primaer: '#fc6900', sekundaer: '#96a19b', tertiaer: WEISS } },
  { id: 'fkk', name: 'Franken Knights',       kurz: 'FKK', stadt: 'Fürth',                 gruppe: 'nord', staerke: 47, farben: { primaer: '#e41a1a', sekundaer: '#bfbab7', tertiaer: WEISS } },
  { id: 'btc', name: 'Bad Tölz Capricorns',   kurz: 'BTC', stadt: 'Bad Tölz',              gruppe: 'sued', staerke: 46, farben: { primaer: '#23433d', sekundaer: '#f5b32b', tertiaer: WEISS } },
  { id: 'pp',  name: 'Passau Pirates',        kurz: 'PP',  stadt: 'Passau',                gruppe: 'nord', staerke: 45, farben: { primaer: '#52287e', sekundaer: SCHWARZ,   tertiaer: '#fbcd20' } },
]);

/** @param {string} id */
export function teamById(id) {
  const t = TEAMS.find((x) => x.id === id);
  if (!t) throw new Error('Unbekanntes Team: ' + id);
  return t;
}

/** @param {'nord'|'sued'} gruppe */
export function teamsDerGruppe(gruppe) {
  return TEAMS.filter((t) => t.gruppe === gruppe);
}

// --- Namen -----------------------------------------------------------------
// [Name, Gewicht]. Relative frequencies, hand-set: a Bavarian roster is full
// of Hubers and Maiers and holds one Königsberger. Drawing evenly made every
// name equally rare, which read wrong.
//
// The spread is deliberately gentler than real name statistics — with only
// fifty surnames in the pool, true frequencies would put a quarter of the
// league into five families. Widen the top tier to sharpen it again.

/** @type {[string, number][]} */
export const VORNAMEN = [
  ['Maximilian', 26], ['Lukas', 26], ['Felix', 26], ['Jonas', 26], ['Tobias', 26],
  ['Simon', 19], ['Andreas', 19], ['Michael', 19], ['Sebastian', 19], ['Florian', 19],
  ['Daniel', 19], ['Fabian', 19], ['Julian', 19], ['Philipp', 19], ['Stefan', 19],
  ['Thomas', 19], ['Markus', 19], ['Alexander', 19], ['Dominik', 19],
  ['Christoph', 13], ['Matthias', 13], ['Benedikt', 13], ['Anton', 13], ['Leon', 13],
  ['Niklas', 13], ['Moritz', 13], ['Johannes', 13], ['Elias', 13], ['David', 13],
  ['Jakob', 13], ['Martin', 13], ['Patrick', 13], ['Marco', 13],
  ['Samuel', 8], ['Vincent', 8], ['Emil', 8], ['Ludwig', 8], ['Georg', 8],
  ['Kilian', 8], ['Valentin', 8], ['Raphael', 8], ['Bastian', 8],
  ['Korbinian', 4], ['Quirin', 4], ['Xaver', 4], ['Konstantin', 4],
];

/** @type {[string, number][]} */
export const NACHNAMEN = [
  ['Huber', 28], ['Müller', 28], ['Bauer', 28], ['Maier', 28], ['Schmid', 28],
  ['Fischer', 20], ['Weber', 20], ['Wagner', 20], ['Lang', 20], ['Wolf', 20],
  ['Berger', 20], ['Fuchs', 20], ['Moser', 20], ['Gruber', 20], ['Eder', 20],
  ['Steiner', 14], ['Neumann', 14], ['Hofmann', 14], ['Winkler', 14], ['Brunner', 14],
  ['Haas', 14], ['Kraus', 14], ['Vogel', 14], ['Sommer', 14], ['Zimmermann', 14],
  ['Wimmer', 10], ['Reiter', 10], ['Lehner', 10], ['Stadler', 10], ['Schuster', 10],
  ['Riedl', 10], ['Baumgartner', 10], ['Aigner', 10], ['Egger', 10], ['Seidl', 10],
  ['Sailer', 6], ['Pichler', 6], ['Obermeier', 6], ['Hartl', 6], ['Kellner', 6],
  ['Kirchner', 6], ['Sturm', 6], ['Wieland', 6],
  ['Danzer', 4], ['Feldmann', 4], ['Scheiber', 4], ['Ostermeier', 4],
  ['Rothbauer', 4], ['Königsberger', 4], ['Bergmeister', 4],
];
