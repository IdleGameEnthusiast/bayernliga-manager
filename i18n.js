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

  // Die Sprache des Sports bleibt, wie sie auf dem Feld gesprochen wird: die
  // vier Phasen heißen auch im deutschen Text so, wie sie überall heißen.
  phase: {
    offseason: 'Offseason',
    preseason: 'Preseason',
    regularSeason: 'Regular Season',
    postseason: 'Postseason',
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
    kickoff: 'Kickoff',
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
    // Das Codefeld ganz unten. Der Playtester-Code zeigt, was das Spiel sonst
    // versteckt — Commitment als Zahl, den Rücktritt, den Druck.
    code: 'Redeem Code',
    codeEinloesen: 'Einlösen',
    codeUnbekannt: 'Diesen Code kennt das Spiel nicht.',
    playtesterAktiv: 'Playtester-Modus aktiv — versteckte Werte werden angezeigt.',
    playtesterAus: 'Playtester-Modus beenden',
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

    // Die drei Nachrichten der Rolle. Die Erinnerung eröffnet die Kampagne,
    // die Anfrage ist der einzelne Mann, der wissen will, woran er ist — und
    // die dritte kommt von ihm selbst, wenn die Zusage und die Bank nicht mehr
    // zusammenpassen.
    rollenerinnerung: {
      von: 'Trainerstab',
      betreff: () => 'Die Mannschaft will wissen, woran sie ist',
      text: (d) => [
        'Die Offseason ist da, und in der Kabine wird gerechnet: wer spielt nächste '
          + 'Saison, wer sitzt. Sag es ihnen lieber selbst, bevor sie es sich gegenseitig '
          + 'erzählen.',
        d.offen > 0
          ? `${d.offen} ${d.offen === 1 ? 'Mann wartet' : 'Männer warten'} noch auf eine `
            + 'Ansage. Wir schicken dir die Einzelnen über die nächsten Wochen — oder du '
            + 'gehst im Personalreiter selbst auf sie zu.'
          : 'Im Moment weiß jeder, woran er ist. Wenn sich das ändert, melden wir uns.',
        'Bis zwei Wochen vor dem ersten Spieltag sollte das durch sein.',
      ],
    },

    rollenanfrage: {
      von: 'Trainerstab',
      betreff: (d) => `${d.name} fragt nach seiner Rolle`,
      text: (d) => [
        `${d.name} (${d.position}, ${d.alter}) hat mich nach dem Training angesprochen. `
          + 'Er will wissen, was er nächste Saison erwarten soll.',
        'Er nimmt jede Antwort — aber er will eine.',
      ],
      antworten: { gespraech: 'Mit ihm reden', spaeter: 'Später' },
    },

    rollenmismatch: {
      von: 'Trainerstab',
      betreff: (d) => `${d.name} sitzt und fragt sich, warum`,
      text: (d) => [
        `${d.name} (${d.position}) steht als ${d.rolle} im Plan, und in den letzten Spielen `
          + 'hat er zugesehen. Er hat es nicht laut gesagt, aber er hat es gesagt.',
        'Entweder er spielt, oder ihr redet noch einmal über seine Rolle. Beides geht; '
          + 'nichts tun geht auch, aber das kostet.',
      ],
    },

    spielvorschau: {
      von: 'Trainerstab',
      betreff: (d) => `Morgen: ${d.gegner}`,
      text: (d) => [
        `Morgen ${d.spieltagNr ? 'steht Spieltag ' + d.spieltagNr + ' an' : 'geht es weiter'}: `
          + `${d.heim ? 'zuhause gegen' : 'auswärts bei'} ${d.gegner}.`,
        'Wer aufläuft, entscheidest du bis zum Kickoff.',
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
      // Der Grund steht in Klammern hinter dem Namen, wenn die Nachricht einen
      // trägt — eine aus einem Stand vor Version 12 tut das nicht.
      text: (d) => [
        'Diese Männer sind nicht mehr dabei:',
        d.namen.map((name, i) => (d.gruende && d.gruende[i]
          ? `${name} (${T.lebenslage.grund[d.gruende[i]]})`
          : name)).join(', '),
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
    // Der Wert sind halbe Sterne, 1 bis 10 — der Titel nennt sie als ganze,
    // weil im Bild fünf Sterne stehen und nicht zehn. Der Punkt weicht dem
    // Komma; „2,5 von 5" ist die Zahl, die auch danebensteht.
    talentTitel: (halbe) => `Talent ${String(halbe / 2).replace('.', ',')} von 5 Sternen`,
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
    commitment: 'Commitment',
    lebenslage: 'Lebenslage',
    rolle: 'Rolle',
    ohneRolle: '—',
    ohneRolleTitel: 'Noch keine Rolle besprochen',
    uebergangen: 'Sitzt, ohne dass ihm jemand gesagt hätte, was er erwarten soll',
    rolleVerfehlt: 'Spielt deutlich weniger, als seine Rolle verspricht',
    gespraech: 'Gespräch',
    // Nur im Playtester-Modus: die Zahlen, die der Manager sonst nie sieht.
    // Druck und Halt sind die Waage aus `lebenslauf.js`, der Zähler die
    // Saisons in Folge, in denen der Druck oben lag — bei zwei geht er.
    verstecktes: 'Versteckt',
    // Das Talent stand hier, solange es eine Zahl von 0 bis 99 war und die
    // Sterne nur eine grobe Ansicht davon. Seit es selbst in halben Sternen
    // steht, zeigt die Spalte den Wert vollständig — es gibt nichts mehr zu
    // enthüllen, und eine Zeile, die dasselbe noch einmal sagt, verstellt nur
    // die Zahlen, die wirklich versteckt sind.
    versteckteWerte: (d) => `Commitment ${d.commitment} · `
      + `Rücktritt nach ${d.ruecktrittAlter} · Druck ${d.druck} gegen Halt ${d.halt}`
      + (d.druckJahre > 0 ? ` (${d.druckJahre}. Saison drüber)` : '')
      + (d.einsatzFenster ? ` · Einsatzfenster ${d.einsatzFenster}` : '')
      + (d.mismatch ? ` · Rollen-Mismatch ${d.mismatch}` : ''),
  },

  // Die fünf Stufen, in denen der Manager das Commitment sieht — von unten
  // nach oben, Index ist die Stufe aus `stufe()`.
  //
  // Vorher standen hier Trainersätze („mit einem Bein draußen", „Herz und
  // Seele"). Die lasen sich gut und sagten das Falsche: „mit einem Bein
  // draußen" klingt nach einer Entscheidung, die schon gefallen ist, dabei
  // ist Stufe 0 nur ein niedriger Wert — einer, der bleiben kann, wenn der
  // Druck niedrig bleibt. Die Waage in `lebenslauf.js` entscheidet, nicht die
  // Stufe. Deshalb jetzt eine Skala, die benennt, was sie misst, und dem
  // Manager das Urteil überlässt.
  commitment: {
    stufen: ['niedrig', 'schwankend', 'moderat', 'hoch', 'sehr hoch'],
    stufeTitel: (text) => `Commitment: ${text}`,
  },

  // Die fünf Rollen: was ein Spieler an Einsatzzeit erwarten darf. Der Name
  // ist, was im Gespräch gesagt wird, die Erwartung das, was er darunter
  // versteht — Perspektiv- und Ergänzungsspieler versprechen dieselbe knappe
  // Einsatzzeit, und der Unterschied steht in der Aussicht, nicht in der Zahl.
  rolle: {
    namen: {
      unangefochten: 'Unangefochtener Stammspieler',
      starter: 'Starter',
      rotation: 'Rotationsspieler',
      perspektive: 'Perspektivspieler',
      ergaenzung: 'Ergänzungsspieler',
    },
    kurz: {
      unangefochten: 'Stamm',
      starter: 'Starter',
      rotation: 'Rotation',
      perspektive: 'Perspektive',
      ergaenzung: 'Ergänzung',
    },
    erwartung: {
      unangefochten: 'Praktisch jedes Spiel, und keine Konkurrenz in Aussicht.',
      starter: 'Aktuell die Nummer eins — aber angreifbar.',
      rotation: 'Ein Anteil der Spiele, im Wechsel mit einem anderen.',
      perspektive: 'Vorerst selten, mit Aussicht auf mehr.',
      ergaenzung: 'Selten, und daran wird sich nichts ändern.',
    },
    titel: (name, erwartung) => `${name}: ${erwartung}`,
  },

  // Das Gespräch: ein Kalendertermin, und deshalb knapp. Die Kategorien, die
  // noch nicht gebaut sind, stehen trotzdem da — sie sagen, was kommt, und ein
  // gesperrter Knopf ist ehrlicher als eine Lücke.
  gespraech: {
    titel: (name) => `Gespräch mit ${name}`,
    unter: (position, alter) => `${position} · ${alter} Jahre`,
    kontingent: (frei) => (frei === 1
      ? 'Diese Woche ist noch ein Gespräch drin.'
      : `Diese Woche sind noch ${frei} Gespräche drin.`),
    keinKontingent: 'Diese Woche ist kein Gespräch mehr drin. Nächste Woche wieder.',
    kategorien: {
      rolle: 'Rolle besprechen',
      lebenslage: 'Nach der Lebenslage fragen',
      persoenlich: 'Über persönliche Themen sprechen',
      wunsch: 'Wunsch anhören',
      ueberzeugen: 'Überzeugen',
    },
    baustelle: 'Kommt mit dem nächsten Schritt.',
    // Über persönliche Themen sprechen. Der Hinweis vorab nennt den Abstand
    // zum letzten Gespräch, weil der Ertrag daran hängt — ein Termin, der
    // nichts bringt, soll vorher erkennbar sein und nicht hinterher.
    persoenlichTitel: 'Einfach mal reden',
    persoenlichHinweis: 'Kein Anlass, keine Ansage — eine Viertelstunde über alles außer '
      + 'Football. Kostet einen Termin.',
    persoenlichNie: 'Diese Saison habt ihr noch kein Wort gewechselt.',
    persoenlichZuletzt: (tage) => (tage === 0
      ? 'Ihr habt heute schon miteinander geredet.'
      : `Zuletzt geredet: vor ${tage} ${tage === 1 ? 'Tag' : 'Tagen'}.`),
    persoenlichFrisch: 'So kurz danach kommt nicht viel dabei heraus.',
    persoenlichKnopf: 'Reden',
    // Index ist der Ton aus `persoenlichesGespraech()`.
    persoenlichReaktionen: [
      (name) => `${name} war schon beim Reden. Viel Neues kommt nicht mehr.`,
      (name) => `Ihr redet ein paar Minuten. ${name} geht etwas aufgeräumter aus der Kabine.`,
      (name) => `${name} redet sich warm — Arbeit, Freundin, das kaputte Auto. `
        + 'Am Ende bleibt er länger stehen als nötig.',
    ],
    // Die Rollen-Auswahl. Die Einschätzung sagt, was der Kader hergibt — sie
    // ist eine Auskunft des Trainerstabs, keine Vorgabe: wer sie übergeht,
    // bekommt die Reaktion, nicht eine Fehlermeldung.
    rolleTitel: 'Was soll er erwarten?',
    einschaetzung: (rolle) => `Der Stab würde ihn als ${rolle} sehen.`,
    bisher: (rolle) => `Bisher: ${rolle}`,
    bisherKeine: 'Bisher hat ihm niemand gesagt, woran er ist.',
    gesperrt: (tage) => `Darüber wurde gerade erst gesprochen — frühestens in `
      + `${tage} ${tage === 1 ? 'Tag' : 'Tagen'} wieder.`,
    fort: 'Der ist nicht mehr da.',
    abbrechen: 'Nicht jetzt',
    schliessen: 'Schließen',
    // Wie er es aufnimmt, Index ist der Ton aus `reaktion()`. Kein Wort über
    // Zahlen: der Manager sieht nie, wie viel sich bewegt hat, nur wie es
    // ankam — dieselbe Entscheidung wie bei den Commitment-Stufen.
    reaktionen: [
      (name) => `${name} sagt lange nichts. Dann: „Also gut." Es klang nicht nach also gut.`,
      (name) => `${name} nickt knapp. Das hat er sich anders vorgestellt.`,
      (name) => `${name} nimmt es zur Kenntnis. Passt schon.`,
      (name) => `${name} wirkt erleichtert — er wollte es genau so hören.`,
      (name) => `${name} strahlt. „Darauf hab ich gewartet."`,
    ],
  },

  // Der Satz zur Lebenslage, aus den Feldern gebaut. Es ist das, was der
  // Spieler erzählt — Stichworte, wie ein Coach sie auf einen Zettel schreibt,
  // durch Punkte getrennt.
  lebenslage: {
    status: {
      schueler: 'Schüler',
      student: 'Student',
      azubi: 'Azubi',
      arbeiter: 'Arbeiter',
      rentner: 'Rentner',
    },
    // Was das Ereignis am Horizont beendet: beim Schüler die Schule, beim
    // Studenten das Studium, beim Azubi die Ausbildung. Der Arbeiter und der
    // Rentner haben nichts, was endet — bei ihnen steht das Ereignis allein.
    abschnitt: {
      schueler: 'Schule',
      student: 'Studium',
      azubi: 'Ausbildung',
    },
    // Warum einer aufhört — in der Rücktritts-Nachricht hinter dem Namen.
    grund: {
      koerper: 'Körper',
      lust: 'keine Lust mehr',
      beruf: 'Beruf',
      familie: 'Familie',
    },
    // Ein Schluss mit Grund, wie ein Coach ihn notiert: „körperlich noch zwei
    // Saisons", „hat noch für eine Saison Lust". Vorher hieß jeder Schluss
    // „körperlich", auch beim 24-Jährigen — das war der Fehler, den der Grund
    // am Horizont behebt. Ein Schluss ohne Grund stammt aus einem alten Stand
    // und heißt Körper.
    schluss: {
      koerper: (n) => (n <= 1 ? 'körperlich die letzte Saison' : `körperlich noch ${n} Saisons`),
      lust: (n) => (n <= 1 ? 'hat noch für eine Saison Lust' : `hat noch für ${n} Saisons Lust`),
      beruf: (n) => (n <= 1 ? 'der Job lässt noch eine Saison zu' : `der Job lässt noch ${n} Saisons zu`),
      familie: (n) => (n <= 1 ? 'die Familie gibt noch eine Saison her' : `die Familie gibt noch ${n} Saisons her`),
    },
    satz: (l, jahr) => {
      const teile = [T.lebenslage.status[l.status]];
      if (l.entfernung <= 5) teile.push('wohnt um die Ecke');
      else teile.push(`fährt ${l.entfernung} km ins Training`);
      teile.push(l.auto ? 'mit dem Auto' : 'ohne Auto');
      if (l.familie) teile.push('Familie');
      teile.push(T.lebenslage.horizont(l, jahr));
      teile.push(T.lebenslage.vereinsjahre(jahr - l.seit));
      return teile.join(' · ');
    },
    horizont: (l, jahr) => {
      const h = l.horizont;
      if (!h) return 'fester Wohnsitz in der Gegend';
      const jahre = Math.max(0, h.jahr - jahr);
      const noch = jahre === 0 ? 'dieses Jahr' : jahre === 1 ? 'noch ein Jahr' : `noch ${jahre} Jahre`;
      const abschnitt = T.lebenslage.abschnitt[l.status];
      const danach = h.dann === 'wegzug'
        ? `Wegzug, ${h.km} km entfernt`
        : h.dann === 'bleibt' ? 'will bleiben' : 'Schluss';
      if (abschnitt) return `${noch} ${abschnitt}, danach ${danach}`;
      if (h.dann === 'schluss') return T.lebenslage.schluss[h.grund || 'koerper'](jahre);
      const wann = jahre === 0 ? 'dieses Jahr' : `in ${jahre} ${jahre === 1 ? 'Jahr' : 'Jahren'}`;
      if (h.dann === 'wegzug') return `plant ${wann} den Wegzug, ${h.km} km entfernt`;
      if (h.dann === 'familie') return `plant ${wann} Familie`;
      return 'will bleiben';
    },
    vereinsjahre: (n) => (n <= 0 ? 'neu im Verein'
      : n === 1 ? 'seit einem Jahr im Verein' : `seit ${n} Jahren im Verein`),
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
    // Die Namen der beiden gezogenen Kickwerte, so wie sie im Modell heißen.
    // „Bein" und „Ziel" waren kürzer und passten besser in die Zeile, aber
    // niemand fand darunter die Kickstärke wieder, die er suchte.
    bein: 'Kickstärke',
    beinTitel: 'Wie weit er den Ball schlägt',
    ziel: 'Kickgenauigkeit',
    zielTitel: 'Wie zuverlässig der Ball dorthin geht, wo er hin soll',
    technik: 'Technik',
    technikTitel: 'Das Handwerk des ausgebildeten Spezialisten — alle anderen haben es nicht',
    ball: 'Ball',
    ballTitel: 'Ballsicherheit — ob der Snap ankommt, ohne dass jemand hinsieht',
    hinweis: 'Diese drei stehen außerhalb der Elf: wer hier steht, spielt trotzdem seine '
      + 'Position. Ein Platz darf auch leer bleiben — dann tritt der Verein ohne ihn an, '
      + 'und die Stärke sagt es. Was für einen Platz zählt, steht bei der Auswahl links.',
  },

  // Die Rückfrage vor dem Kickoff, wenn die Elf Löcher hat. Sie steht hier und
  // nicht mehr als Nachricht im Postfach: die Entscheidung fällt an dem Knopf,
  // der das Spiel anstößt, und nicht einen Reiter weiter.
  kickoff: {
    unvollstaendigTitel: 'Die Elf ist nicht vollzählig',
    unvollstaendig: (offen, punkte) => (offen === 1
      ? 'Ein Platz in der Aufstellung ist unbesetzt. '
      : `${offen} Plätze in der Aufstellung sind unbesetzt. `)
      + `So kann der Verein nicht antreten — das Spiel würde 0:${punkte} gegen uns gewertet.`,
    absagen: (punkte) => `Spiel absagen, Wertung 0:${punkte}`,
    zurAufstellung: 'Zur Aufstellung',
  },

  personal: {
    spieler: 'Spieler',
    coaches: 'Coaches',
    orga: 'Orga',
    baustelle: 'Noch nicht besetzt.',
    anzahl: (n) => `${n} im Kader`,
    stabAnzahl: (n) => `${n} im Stab`,
  },

  coach: {
    name: 'Name',
    rolle: 'Rolle',
    gruppe: 'Hauptgruppe',
    alter: 'Alter',
    staerke: 'Stärke',
    staerkeTitel: (rolle) => `Stärke in der Rolle ${rolle}`,
    rollen: {
      OC: 'Offense Coordinator',
      DC: 'Defense Coordinator',
      POS: 'Position Coach',
    },
    gruppen: {
      QB: 'Quarterbacks',
      RB: 'Running Backs',
      WR: 'Receiver',
      TE: 'Tight Ends',
      OL: 'Offensive Line',
      DL: 'Defensive Line',
      ILB: 'Inside Linebacker',
      OLB: 'Outside Linebacker',
      CB: 'Cornerbacks',
      S: 'Safeties',
    },
    bloecke: {
      soft: 'Soft Skills',
      scheme: 'Scheme',
      personnel: 'Vertrautheit mit Personnel',
      technik: 'Positionsgruppen',
    },
    soft: {
      kommunikation: 'Kommunikation',
      empathie: 'Empathie',
      fuehrung: 'Führung',
      motivation: 'Motivation',
      konfliktloesung: 'Konfliktlösung',
    },
    scheme: {
      offenseLauf: 'Offense Run Game',
      offensePass: 'Offense Passing Game',
      defenseLauf: 'Defense Run Game',
      defensePass: 'Defense Passing Game',
      kicks: 'Kicks',
      returns: 'Returns & Blocks',
    },
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
    duellOC: 'Eigener OC',
    duellDC: 'DC des Gegners',
    duellSumme: 'Vorteil',
    // Der Stab im Taktikreiter: wer die beiden Einheiten führt und was er
    // vom gewählten System versteht. Die Vertrautheit steht auch an jeder
    // Systemschaltfläche, weil sie der Preis des Wechsels ist.
    stab: 'Koordinatoren',
    stabScheme: (lauf, pass) => `Scheme — Lauf ${lauf} · Pass ${pass}`,
    stabVertraut: (system, wert, malus) =>
      `Vertrautheit mit ${system}: ${wert} → ${malus} Stärkepunkte`,
    stabHinweis: 'Ein Scheme-Wert über 50 hebt seine Einheit, einer darunter drückt sie. '
      + 'Die Vertrautheit wächst mit jedem Tag und jedem Spiel in einem System — '
      + 'und schwindet in denen, die lange nicht gespielt wurden.',
    keinCoach: 'Nicht besetzt.',
    vertraut: (wert) => `Vertrautheit ${wert}`,
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
