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
    postfach: 'Posteingang',
    tabelle: 'Tabelle',
    kader: 'Roster',
    taktik: 'Taktik',
    spielplan: 'Spielplan',
  },

  start: {
    ueberschrift: 'Neue Karriere',
    teamWahl: 'Welchen Verein übernimmst du?',
    starten: 'Karriere starten',
    fortsetzen: 'Karriere fortsetzen',
    neuWarnung: 'Ein laufender Speicherstand wird überschrieben. Fortfahren?',
    staerke: 'Stärke',
  },

  // Der Kalender rechnet in Tagesnummern; hier stehen die Namen dazu. Die
  // Reihenfolge von `tage` folgt `wochentag()` — 0 ist der Samstag, weil Tag 1
  // jeder Saison einer ist. `rasterTage` ist die Kopfzeile des Monatsrasters
  // und fängt montags an, wie ein deutscher Kalender.
  datum: {
    tage: ['Sa', 'So', 'Mo', 'Di', 'Mi', 'Do', 'Fr'],
    rasterTage: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
    monate: ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'],
    monateKurz: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun',
      'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
    kurz: (d) => `${T.datum.tage[d.wochentag]} ${d.t}. ${T.datum.monateKurz[d.m - 1]} ${d.j}`,
    ohneJahr: (d) => `${T.datum.tage[d.wochentag]} ${d.t}. ${T.datum.monateKurz[d.m - 1]}`,
    monatJahr: (j, m) => `${T.datum.monate[m - 1]} ${j}`,
  },

  phase: {
    vorbereitung: 'Vorbereitung',
    gruppe: 'Gruppenrunde',
    playoffs: 'Playoffs',
    sommerpause: 'Sommerpause',
  },

  postfach: {
    heute: 'Heute',
    monatZurueck: 'Voriger Monat',
    monatVor: 'Nächster Monat',
    zumTag: (datum) => `Bis ${datum} weiterspielen`,
    zeichenSpiel: '⚽',
    zeichenPost: '✉',
    zeichenAntwort: '●',
    legendeSpiel: 'Spiel',
    legendePost: 'Post',
    legendeAntwort: 'Antwort nötig',
    saisonEnde: 'Die Saison ist gespielt.',
    heuteMit: (was) => `Heute · ${was}`,
    spielfrei: 'Kein Spiel angesetzt.',
    anpfiff: 'Anpfiff',
    zurNachricht: 'Zur Nachricht ›',
    bisDahin: 'Bis dahin',
    weiter: 'Weiter',
    naechsterTermin: (datum, was) => `Nächster Termin: ${datum} — ${was}`,
    kommendesSpiel: (gegner, wo) => `gegen ${gegner} (${wo})`,
    heimZeichen: 'H',
    auswaertsZeichen: 'A',
    antwortOffen: 'Der Vorstand wartet auf eine Antwort.',
    phasenWechsel: (phase) => `Weiter in die ${phase}`,
    saisonwechsel: 'Saisonwechsel',
    posteingang: 'Posteingang',
    archiv: 'Archiv',
    keinePost: 'Nichts Neues.',
    keinArchiv: 'Noch nichts gelesen.',
    ungelesen: (anzahl) => `${anzahl} ungelesen`,
    zumBericht: 'Spielbericht ansehen',
    vergangeneSaisons: 'Vergangene Saisons',
    saisonZeile: (jahr, platz, meister) => `${jahr}: Platz ${platz} · Meister ${meister}`,
    speicherstand: 'Speicherstand',
    speicherstandHinweis: 'Der Speicherstand liegt im Browser. Exportiere ihn, um ihn zu '
      + 'sichern oder zwischen PC und iPad zu übertragen.',
  },

  // Der Posteingang. Eine Nachricht speichert einen Schlüssel und ihre Daten —
  // der Satz dazu steht ausschließlich hier, damit sich Texte ändern lassen,
  // ohne alte Speicherstände zu verfälschen. `text` liefert immer Absätze.
  post: {
    vorstandsziel: {
      von: 'Der Vorstand',
      betreff: (d) => (d.antritt
        ? `Willkommen bei ${d.verein}`
        : `Ihre Ziele für ${d.jahr}`),
      text: (d) => (d.antritt
        ? [
          'Hallo Manager!',
          `Du übernimmst die ${d.verein} und schützt sie damit vor der Auflösung.`,
          'In der letzten Zeit gab es einige Verstimmungen, und am Ende ist der alte '
            + 'Vorstand nach einem großen Streit aus dem Verein ausgetreten — sein Ego war '
            + 'größer als der Verein. Alle beteiligten Spieler sind mit ihm gegangen.',
          'Es ist also alles bereit für einen Neustart. Nur: Das Team muss komplett neu '
            + 'aufgebaut werden.',
          'Bist du dafür bereit?',
        ]
        : [
          `Die Saison ${d.jahr} steht an, und der Vorstand erwartet, dass ${d.verein} `
            + 'oben mitspielt.',
          'Die Vorbereitung läuft ab heute. Wir hören von dir.',
        ]),
      antworten: { ja: 'Ja, ich bin bereit' },
    },

    aufstellungUngueltig: {
      von: 'Trainerstab',
      betreff: (d) => `Aufstellung für ${d.spieltagNr ? 'Spieltag ' + d.spieltagNr : 'das Spiel'}`,
      text: (d) => [
        d.namen.length === 1
          ? `${d.namen[0]} steht in deiner Aufstellung und kann heute nicht auflaufen.`
          : `${d.namen.join(', ')} stehen in deiner Aufstellung und können heute nicht auflaufen.`,
        'Sollen wir die Lücken füllen, oder stellst du selbst um?',
      ],
      antworten: { automatisch: 'Aufstellen lassen', selbst: 'Ich stelle selbst um' },
    },

    spielvorschau: {
      von: 'Trainerstab',
      betreff: (d) => `Morgen: ${d.gegner}`,
      text: (d) => [
        `Morgen ${d.spieltagNr ? 'steht Spieltag ' + d.spieltagNr + ' an' : 'geht es weiter'}: `
          + `${d.heim ? 'zuhause gegen' : 'auswärts bei'} ${d.gegner}.`,
        'Wer aufläuft, entscheidest du bis zum Anpfiff.',
      ],
    },

    spielbericht: {
      von: 'Trainerstab',
      betreff: (d) => `${d.eigene > d.fremde ? 'Sieg' : 'Niederlage'} gegen ${d.gegner} `
        + `${d.eigene}:${d.fremde}`,
      text: (d) => [
        `${d.heim ? 'Zuhause gegen' : 'Auswärts bei'} ${d.gegner} steht es am Ende `
          + `${d.eigene}:${d.fremde}.`,
      ],
    },

    rundenergebnisse: {
      von: 'Die Liga',
      betreff: (d) => `Spieltag ${d.spieltagNr} ist gespielt`,
      text: (d) => [
        `Nach Spieltag ${d.spieltagNr} stehst du auf Platz ${d.platz} — `
          + `${d.siege} ${d.siege === 1 ? 'Sieg' : 'Siege'}, `
          + `${d.niederlagen} ${d.niederlagen === 1 ? 'Niederlage' : 'Niederlagen'}.`,
      ],
    },

    verletzung: {
      von: 'Mannschaftsarzt',
      betreff: (d) => `${d.name} fällt aus`,
      text: (d) => [
        `${d.name} (${d.position}) hat sich verletzt und fehlt uns `
          + `${d.wochen} ${d.wochen === 1 ? 'Woche' : 'Wochen'}.`,
      ],
    },

    auslosung: {
      von: 'Die Liga',
      betreff: () => 'Die Halbfinals stehen',
      text: (d) => d.paarungen.map(([heim, gast]) => `${heim} — ${gast}`),
    },

    meister: {
      von: 'Die Liga',
      betreff: (d) => `${d.meister} ist Bayernligameister`,
      text: (d) => [
        `${d.meister} gewinnt das Finale und ist Meister.`,
        `Du hast die Gruppenrunde auf Platz ${d.meinPlatz} beendet.`,
      ],
    },

    ruecktritte: {
      von: 'Trainerstab',
      betreff: (d) => (d.namen.length === 1
        ? 'Ein Spieler hört auf'
        : `${d.namen.length} Spieler hören auf`),
      text: (d) => [
        'Diese Männer haben ihre Karriere beendet:',
        d.namen.join(', '),
      ],
    },
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

  // Im Bracket steht die Gruppe neben einer Platzziffer — „1. Gruppe Nord"
  // wäre dort ein Satz, wo eine Marke hingehört.
  gruppenKurz: {
    nord: 'Nord',
    sued: 'Süd',
  },

  runde: {
    gruppe: 'Gruppenrunde',
    halbfinale: 'Halbfinale',
    finale: 'Finale',
  },

  playoffs: {
    ueberschrift: 'Playoffs',
    offen: 'Wird nach der Gruppenrunde ausgelost. Wer die vier Plätze gerade hält, steht dabei.',
    heimrecht: 'Heimrecht',
    heimZeichen: 'H',
    setzplatz: (platz, gruppe) => `${platz}. ${gruppe}`,
    siegerHalbfinale: 'Sieger Halbfinale',
    meister: 'Meister',
    meisterOffen: 'Noch offen',
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
    verletztBis: (tage) => `noch ${tage} ${tage === 1 ? 'Tag' : 'Tage'}`,
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
    wochen: (n) => `${n} ${n === 1 ? 'Woche' : 'Wochen'}`,
  },

  aktion: {
    exportieren: 'Speicherstand exportieren',
    importieren: 'Speicherstand importieren',
    neuesSpiel: 'Neue Karriere',
    zurueck: 'Zurück',
  },

  meldung: {
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
    optimum: (wert) => `Rechnerisches Optimum: ${wert} %`,
    optimumMarke: 'Rechnerisches Optimum',
    duell: (gegner) => `Was der Regler ausmacht — gegen ${gegner}`,
    duellSchnitt: 'Was der Regler ausmacht — gegen den Ligaschnitt',
    duellHeim: 'zuhause',
    duellAuswaerts: 'auswärts',
    duellPass: 'Passduell',
    duellLauf: 'Laufduell',
    duellEinseitig: 'Einseitigkeit',
    duellKlippe: 'Randband',
    duellSumme: 'Vorteil',
    duellPunkte: (wert) => `${wert} Punkte`,
    duellFussnote: 'Stärkepunkte. Was daraus an Zählbarem wird, steht rechts.',
    wirkung: 'Angriff und Verteidigung',
    wirkungHinweis: 'Diese vier sagen, was die Mannschaft ist — sie hängen am System und '
      + 'an der Aufstellung. Der Regler bewegt sie kaum; er bewegt das Duell darüber.',
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
