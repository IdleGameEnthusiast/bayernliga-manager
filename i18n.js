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
    personal: 'Personal',
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
    // Im Raster stehen Termine, keine Post. Das Zeichen ist ein Football und
    // kein Fußball — dieselbe Sportart wie im Rest des Spiels.
    zeichenSpiel: '🏈',
    legendeSpiel: 'Spiel',
    // Ein Tipp auf einen Tag wählt ihn nur aus; die Uhr bewegt erst der Knopf
    // darunter. Ein Tipp, der sofort simuliert, ist für einen Fehlgriff zu
    // teuer — er ist nicht zurückzunehmen.
    tagWaehlen: (datum) => `${datum} auswählen`,
    tagGewaehlt: (datum) => `Gewählt: ${datum}`,
    bisDatumSimulieren: 'Bis zu diesem Datum simulieren',
    auswahlAufheben: 'Auswahl aufheben',
    zeichenPost: '✉',
    zeichenAntwort: '●',
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
    antwortOffen: 'Eine Nachricht wartet auf deine Antwort.',
    phasenWechsel: (phase) => `Weiter in die ${phase}`,
    saisonwechsel: 'Saisonwechsel',
    // Die Ordner links, die Nachricht rechts. Gelesenes wandert nirgends von
    // selbst hin — was aus dem Eingang verschwindet, hat der Manager gelöscht.
    ordner: 'Ordner',
    posteingang: 'Posteingang',
    geloescht: 'Gelöscht',
    keinePost: 'Der Posteingang ist leer.',
    keinGeloeschtes: 'Hier liegt nichts.',
    keineAuswahl: 'Wähle eine Nachricht aus.',
    ungelesen: (anzahl) => `${anzahl} ungelesen`,
    absender: (von, datum) => `${von} · ${datum}`,
    loeschen: 'Löschen',
    wiederherstellen: 'Wiederherstellen',
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
          'Wir zählen auf dich. Fang an, wann du willst — die Vorbereitung läuft ab heute.',
        ]
        : [
          `Die Saison ${d.jahr} steht an, und der Vorstand erwartet, dass ${d.verein} `
            + 'oben mitspielt.',
          'Die Vorbereitung läuft ab heute. Wir hören von dir.',
        ]),
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

    aufstellungUnvollstaendig: {
      von: 'Trainerstab',
      betreff: (d) => `Unbesetzte Plätze für ${d.spieltagNr ? 'Spieltag ' + d.spieltagNr : 'das Spiel'}`,
      text: (d) => [
        d.offen === 1
          ? 'Ein Platz in deiner Aufstellung ist unbesetzt.'
          : `${d.offen} Plätze in deiner Aufstellung sind unbesetzt.`,
        `So können wir nicht antreten. Das Spiel würde mit 0:${d.wertung} gegen uns gewertet.`,
        'Sollen wir die Lücken füllen, oder bleibt es dabei?',
      ],
      antworten: { automatisch: 'Aufstellen lassen', antreten: 'Dabei bleibt es' },
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
      betreff: (d) => (d.nichtAngetreten
        ? `Nicht angetreten gegen ${d.gegner} — ${d.eigene}:${d.fremde} gewertet`
        : `${d.eigene > d.fremde ? 'Sieg' : 'Niederlage'} gegen ${d.gegner} `
          + `${d.eigene}:${d.fremde}`),
      text: (d) => (d.nichtAngetreten
        ? [
          `Wir sind ${d.heim ? 'zuhause gegen' : 'auswärts bei'} ${d.gegner} nicht `
            + 'angetreten: die Elf war nicht vollzählig.',
          `Die Liga wertet das Spiel mit ${d.eigene}:${d.fremde} gegen uns.`,
        ]
        : [
          `${d.heim ? 'Zuhause gegen' : 'Auswärts bei'} ${d.gegner} steht es am Ende `
            + `${d.eigene}:${d.fremde}.`,
        ]),
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

  // Die Namen der drei Bereiche stehen schon unter `kader` — Offense, Defense
  // und Special Teams heißen dort seit den Mannschaftsteilen so, und ein
  // zweiter Satz derselben Wörter liefe irgendwann auseinander.
  roster: {
    starter: 'Aufstellung',
    plaetze: 'Plätze',
    staerke: 'Stärke',
    // Ein Strich, wo eine Zahl stünde, wenn die Elf vollzählig wäre. Eine Elf
    // mit Loch hat keine Stärke, die sich hinschreiben ließe.
    ohneZahl: '–',
    staerkeOffen: 'Erst, wenn jeder Platz besetzt ist',
    niemandFrei: 'Es steht bereits jeder, der spielen kann.',
    filterAlle: 'Alle',
    filterAlleTitel: 'Aus: nur Spieler zeigen, die in diese Einheit gehören',
    kopfAlle: 'Verfügbar',
    kopfFuer: (platz) => `Die Besten für ${platz}`,
    // Der zweite Satz ist die einzige Stelle, an der das Ziehen überhaupt
    // steht: eine Geste, die niemand sieht, findet niemand.
    hinweis: 'Platz antippen, dann den Mann — oder umgekehrt. Ziehen geht auch: '
      + 'mit der Maus sofort, mit dem Finger nach kurzem Halten.',
    hinweisPlatz: (platz) => `${platz} neu besetzen — jetzt links den Mann wählen.`,
    hinweisSpieler: (name) => `Wohin mit ${name}? Rechts den Platz antippen.`,
  },

  special: {
    K: 'Kicker',
    P: 'Punter',
    LS: 'Long Snapper',
    bein: 'Bein',
    beinTitel: 'Wie weit er den Ball schlägt',
    ziel: 'Ziel',
    zielTitel: 'Wie zuverlässig der Ball dorthin geht, wo er hin soll',
    technik: 'Technik',
    technikTitel: 'Das Handwerk des ausgebildeten Spezialisten — alle anderen haben es nicht',
    automatisch: 'automatisch',
    automatischTitel: 'Nicht besetzt — der beste Fuß im Kader nimmt den Platz',
    zurueckAutomatik: 'Automatik',
    zurueckAutomatikTitel: 'Den Platz wieder dem besten Fuß im Kader überlassen',
    hinweis: 'Diese drei stehen außerhalb der Elf: wer hier steht, spielt trotzdem seine '
      + 'Position. Die Technik hat nur ein ausgebildeter Spezialist — der Verein hat keinen, '
      + 'bis er einen verpflichtet.',
  },

  personal: {
    spieler: 'Spieler',
    coaches: 'Coaches',
    orga: 'Orga',
    baustelle: 'Noch nicht besetzt.',
    anzahl: (n) => `${n} im Kader`,
  },

  spielplan: {
    spieltag: 'Spieltag',
    heim: 'Heim',
    gast: 'Gast',
    ergebnis: 'Ergebnis',
    ausstehend: 'ausstehend',
    gegen: '–',
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
    nichtAngetreten: (verein, heim, gast) =>
      `${verein} ist nicht angetreten — die Elf war nicht vollzählig. `
      + `Die Liga wertet ${heim}:${gast}.`,
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
    umgestellt: 'umgestellt',
    leihNummer: (eigene) => 'Geliehene Nummer für diesen Platz — im Angriff gehören 50 bis 79 '
      + `der Line, und sonst niemandem. Seine eigene: ${eigene}.`,
    doppel: 'doppelt',
    doppelHinweis: 'Steht in beiden Einheiten und verliert dafür Leistung.',
    platzStaerke: (wert) => `Stärke auf diesem Platz: ${wert}`,
    keiner: '—',
  },

  aufstellung: {
    vonHand: 'Von Hand gestellt. Verletzte füllt die Automatik nach, geräumte Plätze nicht.',
    automatisch: 'Automatisch aufstellen',
    loeschen: 'Aufstellung löschen',
    offeneWertung: (offen, punkte) =>
      `${offen} ${offen === 1 ? 'Platz' : 'Plätze'} unbesetzt — 0:${punkte} gewertet`,
    raeumenTitel: (platz) => `${platz} räumen — der Platz bleibt leer`,
    platzTitel: (platz) => `${platz} neu besetzen`,
    starterZeigen: 'Starter',
    starterZeigenTitel: 'An: auch zeigen, wer schon in der Elf steht',
    spielerWaehlen: (name) => `${name} auswählen`,
    jahre: (alter) => `${alter} J.`,
    wohinMit: (name) => `Wohin mit ${name}? Platz antippen — die zweite Zahl ist seine.`,
    hierEinsetzen: (platz, name) => `${name} auf ${platz} einsetzen`,
    stehtHier: 'Er steht schon hier.',
    stehtSchon: 'steht hier',
    neuerWert: (name, wert) => `${name} wäre hier ${wert} wert`,
    starterTitel: (plaetze) => `Startet auf ${plaetze}`,
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
