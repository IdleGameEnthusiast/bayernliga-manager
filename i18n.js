// @ts-check
/**
 * Every player-visible string. Data only — no rules, no DOM.
 *
 * Identifiers stay English throughout the codebase; the German lives here, so
 * a second language would only ever mean a second object in this file.
 * UTF-8 without a BOM, with real umlauts. Keep it that way.
 *
 * The game's own vocabulary is not translated: Offense, Defense, Run, Pass,
 * Roster and the position names stay as they are spoken on the field. A German
 * word for them would only be a second name for something the manager already
 * knows by its first.
 */

export const DE = {
  titel: 'Bayernliga Football Manager',

  nav: {
    tabelle: 'Tabelle',
    kader: 'Roster',
    taktik: 'Taktik',
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
    legendePlayoff: 'Playoffs',
  },

  gruppen: {
    nord: 'Gruppe Nord',
    sued: 'Gruppe Süd',
  },

  runde: {
    gruppe: 'Gruppenrunde',
    halbfinale: 'Halbfinale',
    finale: 'Finale',
  },

  playoffs: {
    ueberschrift: 'Playoffs',
    offen: 'Wird nach der Gruppenrunde ausgelost.',
    heimrecht: 'Heimrecht',
  },

  kader: {
    nummer: 'Nr',
    name: 'Name',
    position: 'Pos',
    alter: 'Alter',
    staerke: 'Stk',
    talent: 'Talent',
    talentTitel: (wert) => `Talent ${wert} von 100`,
    status: 'Status',
    fit: 'fit',
    verletzt: 'verletzt',
    keineVerletzungen: 'Keine Verletzungen',
    verletztBis: (wochen) => `noch ${wochen} ${wochen === 1 ? 'Spieltag' : 'Spieltage'}`,
    einheiten: 'Mannschaftsteile',
    angriff: 'Offense',
    verteidigung: 'Defense',
    angriffPass: 'Offense Pass',
    angriffLauf: 'Offense Run',
    verteidigungPass: 'Defense Pass',
    verteidigungLauf: 'Defense Run',
    special: 'Special Teams',
    gesamt: 'Gesamt',
    koerper: 'Körper',
    koerperWert: (cm, kg) => `${(cm / 100).toFixed(2).replace('.', ',')} m · ${kg} kg`,
    alterWert: (alter) => `${alter} Jahre`,
    werte: 'Werte',
    bestePositionen: 'Beste Positionen',
    positionsWert: (platz, wert) => `Auf ${platz} wäre er ${wert} wert`,
    eigenePosition: (platz) => `${platz} ist seine eigene Position`,
    werteZeigen: 'Werte einblenden',
    werteVerbergen: 'Werte ausblenden',
    sortieren: (spalte) => `Nach ${spalte} sortieren`,
    sortAb: '▾',
    sortAuf: '▴',
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
    passing: 'Passing',
    rushing: 'Rushing',
    receiving: 'Receiving',
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

  log: {
    sieg: 'Sieg',
    niederlage: 'Niederlage',
    partie: (wo, ausgang, eigene, fremde) => `${wo}: ${ausgang} ${eigene}:${fremde}`,
    saisonEnde: (jahr, verein) => `Saison ${jahr} beendet — Meister: ${verein}`,
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

  taktik: {
    ueberschrift: 'Ausrichtung',
    system: 'System',
    systemWaehlen: 'Personnel-Gruppierung',
    ausrichtung: 'Run und Pass',
    passAnteil: 'Passanteil',
    vorschlag: (wert) => `Vorschlag des Systems: ${wert} %`,
    frei: 'Frei wählbar — aber ganz ohne Lauf- oder Passandrohung bricht der Angriff ein.',
    gilt: 'Die Änderung gilt ab dem nächsten Spieltag.',
    wirkung: 'Was das ausmacht',
    aufstellung: 'Aufstellung',
    angriffElf: 'Offense',
    verteidigungElf: 'Defense',
    platz: 'Platz',
    spieler: 'Spieler',
    umgestellt: 'umgestellt',
    doppel: 'doppelt',
    doppelHinweis: 'Steht in beiden Einheiten und verliert dafür Leistung.',
    platzStaerke: (wert) => `Stärke auf diesem Platz: ${wert}`,
    kickPlaetze: (kicker, punter) => `Kicker: ${kicker} · Punter: ${punter}`,
    keiner: '—',
  },

  aufstellung: {
    hinweis: 'Platz antippen, um ihn neu zu besetzen — oder unten einen Spieler.',
    vonHand: 'Von Hand gestellt. Verletzte und fehlende Plätze füllt die Automatik.',
    automatisch: 'Automatisch aufstellen',
    loeschen: 'Aufstellung löschen',
    speichern: 'Speichern',
    speichernGesperrt: 'Erst speicherbar, wenn jeder Platz besetzt ist',
    verwerfen: 'Verwerfen',
    weiterBearbeiten: 'Weiter bearbeiten',
    gespeichert: 'Aufstellung gespeichert.',
    ungespeichert: 'Ungespeicherte Änderungen — sie gelten erst nach dem Speichern.',
    ungespeichertOffen: 'Ungespeicherte Änderungen. Erst wenn jeder Platz besetzt ist, lässt sich speichern.',
    ungesichert: 'Ungespeicherte Aufstellung',
    ungesichertText: 'Die Aufstellung ist geändert, aber noch nicht gespeichert.',
    unvollstaendigText: (offen) => `${offen} ${offen === 1 ? 'Platz ist' : 'Plätze sind'} unbesetzt. `
      + 'So lässt sich die Aufstellung nicht speichern — verworfen wäre die Änderung weg.',
    platzTitel: (platz) => `${platz} neu besetzen`,
    beste: 'Die Besten für diesen Platz',
    besteBank: 'Die Besten, die noch nicht stehen',
    starterZeigen: 'Starter',
    starterZeigenTitel: 'Aus: nur Spieler zeigen, die noch nicht in der Elf stehen',
    keineBank: 'Es steht bereits jeder, der spielen kann.',
    oderRoster: 'Oder unten im Roster jemanden auswählen.',
    rosterHinweis: 'Spieler antippen, um ihn aufzustellen. Der Knopf am Zeilenende zeigt seine Werte.',
    rosterWaehlen: 'Wähle den Mann für den offenen Platz.',
    spielerWaehlen: (name) => `${name} auswählen`,
    waehleSpieler: 'Spieler auswählen',
    waehlePlatz: 'Platz oben antippen',
    stehtAuf: (platz) => `steht auf ${platz} — Platz oben antippen oder herausnehmen`,
    entfernen: 'Spieler entfernen',
    entfernenTitel: 'Aus der Elf nehmen. Sein Platz bleibt frei, bis jemand ihn besetzt.',
    jahre: (alter) => `${alter} J.`,
    wohinMit: (name) => `Wohin mit ${name}? Platz antippen — die zweite Zahl ist seine.`,
    hierEinsetzen: (platz, name) => `${name} auf ${platz} einsetzen`,
    stehtHier: 'Er steht schon hier.',
    stehtSchon: 'steht hier',
    neuerWert: (name, wert) => `${name} wäre hier ${wert} wert`,
    starterTitel: (plaetze) => `Startet auf ${plaetze}`,
    einsetzen: 'Einsetzen',
    tauscht: (platz) => `tauscht mit ${platz}`,
    pfeil: '→',
  },

  personnel: {
    '00': 'Empty',
    '01': 'Empty mit TE',
    '10': 'Spread',
    '11': 'Standard',
    '12': 'Double Tight',
    '20': 'Two Back',
    '21': 'Pro',
    '32': 'Double Wing',
  },

  attribute: {
    schnelligkeit: 'Schnelligkeit',
    beweglichkeit: 'Beweglichkeit',
    kraft: 'Kraft',
    ausdauer: 'Ausdauer',
    robustheit: 'Robustheit',
    fangen: 'Fangen',
    ballsicherheit: 'Ballsicherheit',
    routeRunning: 'Routen',
    werfen: 'Werfen',
    blocken: 'Blocken',
    passrush: 'Pass Rush',
    tacklen: 'Tackling',
    coverage: 'Deckung',
    spielverstaendnis: 'Spielverständnis',
    technik: 'Technik',
  },

  positionen: {
    QB: 'Quarterback',
    RB: 'Running Back',
    FB: 'Fullback',
    WR: 'Wide Receiver',
    SL: 'Slot Receiver',
    TE: 'Tight End',
    T: 'Tackle',
    G: 'Guard',
    C: 'Center',
    DE: 'Defensive End',
    DT: 'Defensive Tackle',
    NT: 'Nose Tackle',
    MIKE: 'Mike Linebacker',
    SAM: 'Outside Linebacker (starke Seite)',
    WILL: 'Outside Linebacker (schwache Seite)',
    CB: 'Cornerback',
    FS: 'Free Safety',
    SS: 'Strong Safety',
  },
};

/** The active language. A second one would slot in beside DE. */
export const T = DE;
