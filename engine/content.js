// @ts-check
/**
 * The catalogues: teams and the name pools players are drawn from.
 * Data only — no rules live here.
 * Docs: docs/spec/07-content-registry.md
 */

/**
 * @typedef {object} TeamDef
 * @property {string} id
 * @property {string} name      Full club name as shown in the UI
 * @property {string} kurz      Three-letter abbreviation for tables
 * @property {string} stadt
 * @property {number} staerke   0..100, the club's baseline quality
 * @property {string} farbe     Primary colour, used for the table stripe
 */

/** The Bayernliga field. Eight clubs, so a double round robin is 14 Spieltage. */
export const TEAMS = /** @type {TeamDef[]} */ ([
  { id: 'ros', name: 'Rosenheim Rebels',            kurz: 'ROS', stadt: 'Rosenheim',           staerke: 74, farbe: '#c0392b' },
  { id: 'lds', name: 'Landsberg X-Press',           kurz: 'LDS', stadt: 'Landsberg am Lech',   staerke: 71, farbe: '#2c3e50' },
  { id: 'stb', name: 'Straubing Spiders',           kurz: 'STB', stadt: 'Straubing',           staerke: 68, farbe: '#8e44ad' },
  { id: 'ffb', name: 'Fürstenfeldbruck Razorbacks', kurz: 'FFB', stadt: 'Fürstenfeldbruck',    staerke: 66, farbe: '#16a085' },
  { id: 'erd', name: 'Erding Bulls',                kurz: 'ERD', stadt: 'Erding',              staerke: 63, farbe: '#d35400' },
  { id: 'reg', name: 'Regensburg Phoenix',          kurz: 'REG', stadt: 'Regensburg',          staerke: 61, farbe: '#e67e22' },
  { id: 'amb', name: 'Amberg Mad Bulls',            kurz: 'AMB', stadt: 'Amberg',              staerke: 57, farbe: '#27ae60' },
  { id: 'wei', name: 'Weilheim Tigers',             kurz: 'WEI', stadt: 'Weilheim',            staerke: 54, farbe: '#f39c12' },
]);

/** @param {string} id */
export function teamById(id) {
  const t = TEAMS.find((x) => x.id === id);
  if (!t) throw new Error('Unbekanntes Team: ' + id);
  return t;
}

/** Given names, weighted towards what a Bavarian club roster actually looks like. */
export const VORNAMEN = [
  'Maximilian', 'Lukas', 'Felix', 'Jonas', 'Tobias', 'Simon', 'Andreas', 'Michael',
  'Sebastian', 'Florian', 'Christoph', 'Matthias', 'Daniel', 'Fabian', 'Julian',
  'Benedikt', 'Korbinian', 'Quirin', 'Xaver', 'Anton', 'Leon', 'Niklas', 'Moritz',
  'Philipp', 'Stefan', 'Thomas', 'Markus', 'Johannes', 'Elias', 'David', 'Samuel',
  'Vincent', 'Emil', 'Jakob', 'Ludwig', 'Georg', 'Martin', 'Alexander', 'Dominik',
  'Marco', 'Patrick', 'Kilian', 'Valentin', 'Raphael', 'Konstantin', 'Bastian',
];

/** Surnames, same idea. */
export const NACHNAMEN = [
  'Huber', 'Müller', 'Bauer', 'Wagner', 'Maier', 'Schmid', 'Fischer', 'Weber',
  'Berger', 'Hofmann', 'Lehner', 'Brunner', 'Wolf', 'Zimmermann', 'Gruber',
  'Neumann', 'Schuster', 'Egger', 'Reiter', 'Moser', 'Winkler', 'Lang', 'Haas',
  'Kellner', 'Sailer', 'Obermeier', 'Stadler', 'Riedl', 'Scheiber', 'Aigner',
  'Baumgartner', 'Wimmer', 'Eder', 'Steiner', 'Kraus', 'Ostermeier', 'Danzer',
  'Feldmann', 'Königsberger', 'Sturm', 'Vogel', 'Sommer', 'Hartl', 'Pichler',
  'Seidl', 'Fuchs', 'Wieland', 'Rothbauer', 'Kirchner', 'Bergmeister',
];

/**
 * Import players are a real feature of German American football, so a slice of
 * each roster is drawn from a different pool.
 */
export const IMPORT_VORNAMEN = [
  'Tyler', 'Marcus', 'DeAndre', 'Jamal', 'Cody', 'Brandon', 'Trey', 'Malik',
  'Devin', 'Xavier', 'Jordan', 'Chase', 'Isaiah', 'Rashad', 'Damon', 'Terrell',
];

export const IMPORT_NACHNAMEN = [
  'Johnson', 'Williams', 'Brooks', 'Carter', 'Mitchell', 'Coleman', 'Hayes',
  'Freeman', 'Dawson', 'Ellis', 'Grant', 'Reeves', 'Parker', 'Bennett', 'Voss',
];

/** Share of a roster generated from the import pool. */
export const IMPORT_ANTEIL = 0.09;
