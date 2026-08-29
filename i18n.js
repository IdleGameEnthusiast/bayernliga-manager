// @ts-check
/**
 * Every player-visible string. Data only — no rules, no DOM.
 *
 * Identifiers stay English throughout the codebase; the German lives here, so
 * a second language would only ever mean a second object in this file.
 * UTF-8 without a BOM, with real umlauts. Keep it that way.
 */

export const DE = {
  titel: 'Bayernliga Football Manager',

  nav: {
    tabelle: 'Tabelle',
    kader: 'Kader',
    spielplan: 'Spielplan',
    verlauf: 'Verlauf',
  },

  start: {
    ueberschrift: 'Neue Karriere',
    teamWahl: 'Welchen Verein übernimmst du?',
    starten: 'Karriere starten',
    fortsetzen: 'Karriere fortsetzen',
    neuWarnung: 'Ein laufender Speicherstand wird überschrieben. Fortfahren?',
    staerke: 'Stärke',
  },

  intro: {
    anrede: 'Hallo Manager!',
    absaetze: (verein) => [
      `Du übernimmst die ${verein} und schützt sie damit vor der Auflösung.`,
      'In der letzten Zeit gab es einige Verstimmungen, und am Ende ist der alte '
        + 'Vorstand nach einem großen Streit aus dem Verein ausgetreten — sein Ego war '
        + 'größer als der Verein. Alle beteiligten Spieler sind mit ihm gegangen.',
      'Es ist also alles bereit für einen Neustart. Nur: Das Team muss komplett neu '
        + 'aufgebaut werden.',
    ],
    frage: 'Bist du dafür bereit?',
    weiter: 'Ja, ich bin bereit',
  },

  tabelle: {
    platz: '#',
    verein: 'Verein',
    spiele: 'Sp',
    bilanz: 'Bilanz',
    punkte: 'Pkt',
    erzielt: 'Erz',
    kassiert: 'Kas',
    differenz: 'Diff',
    legendeMeister: 'Meister',
    legendeAbstieg: 'Abstieg',
  },

  kader: {
    nummer: 'Nr',
    name: 'Name',
    position: 'Pos',
    alter: 'Alter',
    staerke: 'Stk',
    talent: 'Tal',
    status: 'Status',
    fit: 'fit',
    verletzt: 'verletzt',
    keineVerletzungen: 'Keine Verletzungen',
    verletztBis: (wochen) => `noch ${wochen} ${wochen === 1 ? 'Spieltag' : 'Spieltage'}`,
    einheiten: 'Mannschaftsteile',
    angriff: 'Angriff',
    verteidigung: 'Verteidigung',
    special: 'Special Teams',
    gesamt: 'Gesamt',
  },

  spielplan: {
    spieltag: 'Spieltag',
    heim: 'Heim',
    gast: 'Gast',
    ergebnis: 'Ergebnis',
    ausstehend: 'ausstehend',
    verlaengerung: 'n.V.',
  },

  spiel: {
    endstand: 'Endstand',
    viertel: 'Viertel',
    passing: 'Passspiel',
    rushing: 'Laufspiel',
    receiving: 'Passempfang',
    yards: 'Yds',
    touchdowns: 'TD',
    interceptions: 'INT',
    versuche: 'Vers',
    faenge: 'Fänge',
    verletzung: 'Verletzung',
  },

  aktion: {
    spieltagSimulieren: 'Spieltag simulieren',
    saisonBeenden: 'Saison abschließen',
    naechsteSaison: 'Nächste Saison starten',
    exportieren: 'Speicherstand exportieren',
    importieren: 'Speicherstand importieren',
    neuesSpiel: 'Neue Karriere',
    zurueck: 'Zurück',
  },

  meldung: {
    saisonVorbei: 'Die Saison ist gespielt.',
    meister: (verein) => `${verein} ist Bayernligameister!`,
    deinPlatz: (platz) => `Du hast die Saison auf Platz ${platz} beendet.`,
    ruecktritte: 'Karriereende',
    keinSpeicherstand: 'Kein Speicherstand gefunden.',
    importFehler: 'Diese Datei konnte nicht gelesen werden.',
    importErfolg: 'Speicherstand geladen.',
    gespeichert: 'Gespeichert.',
  },

  positionen: {
    QB: 'Quarterback',
    RB: 'Running Back',
    WR: 'Wide Receiver',
    TE: 'Tight End',
    OL: 'Offensive Line',
    DL: 'Defensive Line',
    LB: 'Linebacker',
    DB: 'Defensive Back',
    K: 'Kicker',
    P: 'Punter',
  },
};

/** The active language. A second one would slot in beside DE. */
export const T = DE;
