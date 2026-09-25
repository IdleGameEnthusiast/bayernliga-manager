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
    zeichenTryout: '📋',
    legendeTryout: 'Tryout',
    tryout: 'Tryout',
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

    // Die einzige Nachricht des Blocks, die von einer neuen Tatsache
    // berichtet statt von einer Folge: der Manager konnte nicht wissen, dass
    // dieser Mann bei dieser Umstellung dichtmacht. Ohne die Zeile fiele ihm
    // erst Wochen später auf, dass da etwas zieht.
    ablehnung: {
      von: 'Trainerstab',
      betreff: (d) => `${d.name} will nicht auf ${d.position}`,
      text: (d) => [
        `${d.name} ist nach dem Spiel noch dageblieben. Er hat ${d.daheim} gespielt, `
          + `seit er hier ist, und er sieht nicht ein, warum er jetzt ${d.position} sein soll.`,
        'Gesagt hat er es ruhig, aber er hat es gesagt. Solange er dort aufläuft, kostet '
          + 'ihn das jedes Spiel. Entweder du stellst ihn wieder hin, wo er hingehört, '
          + 'oder ihr redet — mehr als einmal.',
      ],
    },

    // Die Trend-Nachricht kommt vom Coach selbst und nicht vom Trainerstab:
    // dass er es bemerkt hat, ist sein Verdienst, und dass er es so oft nicht
    // bemerkt, der Preis dafür, dass er fünf Gruppen gleichzeitig coacht. Die
    // Stufen heißen wie im Personalreiter, damit der Manager nachsehen kann.
    commitmentTrend: {
      von: (d) => (d.coach ? `${d.coach} (${d.coachRolle})` : 'Trainerstab'),
      betreff: (d) => (d.nach > d.von
        ? `${d.name} ist mit mehr dabei`
        : `${d.name} zieht sich zurück`),
      text: (d) => (d.nach > d.von
        ? [
          `Mir ist bei ${d.name} (${d.position}) etwas aufgefallen: er ist mit mehr dabei als `
            + `noch vor ein paar Wochen. Sein Commitment würde ich inzwischen „${T.commitment.stufen[d.nach]}“ `
            + `nennen, vorher war es „${T.commitment.stufen[d.von]}“.`,
          'Ich wollte es nur gesagt haben — so etwas sieht man sonst erst, wenn es wieder weg ist.',
        ]
        : [
          `Mir ist bei ${d.name} (${d.position}) etwas aufgefallen: er ist mit dem Kopf nicht mehr `
            + `ganz hier. Sein Commitment würde ich inzwischen „${T.commitment.stufen[d.nach]}“ nennen, `
            + `vorher war es „${T.commitment.stufen[d.von]}“.`,
          'Woran es liegt, hat er nicht gesagt. Vielleicht redest du mal mit ihm.',
        ]),
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

    // Die Stationen eines Tryouts. `d.datum` ergänzt die Ansicht aus Jahr und
    // Tag, weil `i18n.js` keinen Kalender kennt. Die Liste der Maßnahmen, der
    // Kandidaten und der Neuen steht nicht im Text — die baut `ui/tryout.js`
    // unter den Absätzen, weil sie Häkchen und Knöpfe trägt.
    tryoutWerbung: {
      von: 'Der Vorstand',
      betreff: (d) => `${d.art === 'herbst' ? 'Herbst' : 'Frühjahrs'}-Tryout am ${d.datum}: `
        + 'Wo werben wir?',
      text: (d) => [
        `Am ${d.datum} ist unser ${d.art === 'herbst' ? 'Herbst' : 'Frühjahrs'}-Tryout. `
          + 'Wer kommen soll, muss vorher davon erfahren.',
        d.art === 'herbst'
          ? 'Der Herbst ist die Zeit dafür: das Semester fängt an, die Leute suchen etwas '
            + 'für den Winter, und bis zum ersten Spieltag ist reichlich Zeit.'
          : 'Im Frühjahr ist wenig los. Die meisten haben ihren Verein gefunden, und wer '
            + 'jetzt kommt, ist zum ersten Spieltag nicht fertig. Ein paar Studenten suchen '
            + 'fürs Sommersemester aber immer.',
        'Kreuz an, wo wir werben. Jede Maßnahme bringt ihre eigenen Leute.',
      ],
      antworten: { festlegen: 'So machen wir es' },
    },

    tryout: {
      von: 'Trainerstab',
      betreff: (d) => `Tryout: ${d.anzahl} ${d.anzahl === 1 ? 'Kandidat' : 'Kandidaten'} auf dem Platz`,
      text: (d) => [
        `Heute ist Tryout, und ${d.anzahl === 1 ? 'einer ist' : `${d.anzahl} sind`} gekommen.`,
        `Mit ${d.gespraeche} von ihnen kannst du heute reden. Ein Gespräch macht aus einem `
          + 'Vielleicht öfter ein Ja.',
        'In drei Tagen wissen wir, wer kommt.',
      ],
      antworten: { abschliessen: 'Tryout beenden' },
    },

    tryoutZusagen: {
      von: 'Trainerstab',
      betreff: (d) => (d.namen.length === 1 ? 'Ein Neuer vom Tryout' : `${d.namen.length} Neue vom Tryout`),
      text: (d) => [
        d.zusagen === 0
          ? `Von den ${d.kandidaten} Leuten beim Tryout hat keiner zugesagt.`
          : `Von den ${d.kandidaten} Leuten beim Tryout ${d.zusagen === 1 ? 'hat einer' : `haben ${d.zusagen}`} `
            + 'zugesagt.',
        d.nachgerueckt > 0
          ? `Damit der Kader nicht unter die Mindestgröße fällt, ${d.nachgerueckt === 1 ? 'ist einer' : `sind ${d.nachgerueckt}`} `
            + 'dazugekommen, die der Stab noch überreden konnte — keine großen Namen, aber sie '
            + 'füllen die Lücken.'
          : '',
        'Gib jedem eine Position. Danach haben sie sechs Wochen Rookie-Training — was der Stab '
          + 'vorschlägt, steht daneben, und es ist nur ein Vorschlag.',
      ].filter((absatz) => absatz),
      antworten: { uebernehmen: 'Positionen übernehmen' },
    },

    tryoutAbsagen: {
      von: 'Trainerstab',
      betreff: () => 'Vom Tryout kommt niemand',
      text: (d) => [
        `Von den ${d.kandidaten} Leuten beim Tryout hat keiner zugesagt. Das kommt vor — `
          + 'das nächste Tryout ist eine neue Chance.',
      ],
    },

    // Einer, der gehen will, und der Grund, den er nennt. Das Ergebnis des
    // Gesprächs steht hinterher in derselben Nachricht, als letzter Absatz —
    // dort, wo der Manager gefragt hat.
    abgang: {
      von: 'Trainerstab',
      betreff: (d) => `${d.name} will aufhören`,
      text: (d) => [
        `${d.name} (${d.position}, ${d.alter}) hat nach dem letzten Spiel gesagt, dass er `
          + 'nächste Saison nicht mehr dabei ist.',
        T.abgang.gruende[d.grund] || '',
        d.ergebnis === 'bleibt'
          ? `Ihr habt lange geredet, und ${d.name} hat es sich anders überlegt. Stand heute `
            + 'bleibt er.'
          : d.ergebnis === 'geht'
            ? `Ihr habt geredet, aber ${d.name} bleibt dabei. Er hört auf.`
            : 'Noch ist er nicht weg. Du kannst mit ihm reden — oder ihn gehen lassen.',
      ].filter((absatz) => absatz),
      antworten: { gespraech: 'Mit ihm reden', ziehenLassen: 'Gehen lassen' },
    },

    abgangKoerper: {
      von: 'Trainerstab',
      betreff: (d) => `${d.name} hört auf`,
      text: (d) => [
        `${d.name} (${d.position}, ${d.alter}) hängt die Schuhe an den Nagel. Der Körper `
          + 'macht nicht mehr mit.',
        'Da gibt es nichts zu bereden — aber einen Handschlag ist er wert.',
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
    wunsch: 'Wunsch',
    ablehnung: 'Sperrt sich',
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
      + (d.mismatch ? ` · Rollen-Mismatch ${d.mismatch}` : '')
      + (d.wahrheit ? ` · in Wahrheit ${d.wahrheit}` : ''),
    // Ab welchem Jahr er die zweite Wahrheit im Gespräch herausrücken würde.
    // Ohne diese Zahl ist beim Spieltesten nicht zu unterscheiden, ob ein
    // Gespräch nichts zu holen hatte oder nur zu früh kam.
    wissbarAb: (jahr) => ` (weiß es ab ${jahr})`,
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

  // Das Gespräch: ein Kalendertermin, und deshalb knapp. Bis alle fünf
  // Kategorien gebaut waren, standen die ungebauten mit einem gesperrten Knopf
  // und dem Hinweis „kommt noch" daneben — eine Liste, in der ohne Ankündigung
  // Zeilen erscheinen, liest sich wie ein anderes Spiel. Der Hinweis ist mit
  // der letzten Kategorie weggefallen; wer eine sechste anhängt, baut ihn
  // wieder ein, statt sie stillschweigend erscheinen zu lassen.
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
    // Nach der Lebenslage fragen. Der Hinweis sagt ausdrücklich, dass die
    // Antwort der Stand von heute ist — wer hier eine Garantie erwartet, hält
    // das spätere „ich zieh doch weg" für einen Wortbruch, dabei ist es das
    // Gegenteil: er hat es gesagt, sobald er es wusste.
    lebenslageTitel: 'Wie sieht es bei dir aus?',
    lebenslageHinweis: 'Einmal nach dem Leben neben dem Verein fragen. Was er sagt, ist, was '
      + 'er heute weiß — entschieden hat er womöglich noch gar nichts. Kostet einen Termin.',
    lebenslageKnopf: 'Fragen',
    lebenslageAkte: 'Das steht bisher in seiner Akte:',
    lebenslageJetzt: 'Neu in der Akte:',
    // Index ist der Ton aus `frageNachLebenslage()`: es bleibt beim Plan, oder
    // er rückt mit etwas anderem heraus. Ton 0 sagt bewusst nicht, ob es
    // nichts zu erfahren gab oder ob er es nur selbst noch nicht weiß.
    lebenslageReaktionen: [
      (name) => `${name} erzählt eine Weile. Es läuft, wie es zuletzt gelaufen ist.`,
      (name) => `${name} druckst herum. „Wollte ich dir sowieso sagen." Dann sagt er es.`,
    ],
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
    // Wunsch anhören. Der Hinweis sagt ausdrücklich, dass die Kategorie nur
    // informiert: wer hier einen Knopf mit sofortiger Wirkung erwartet, ist
    // hinterher enttäuscht, obwohl alles richtig lief.
    wunschTitel: 'Hast du etwas auf dem Herzen?',
    wunschHinweis: 'Einmal nachfragen, was ihn beschäftigt. Kostet einen Termin — und was '
      + 'daraus wird, entscheidet sich danach auf dem Feld, nicht hier.',
    wunschFragen: 'Nachfragen',
    wunschBekannt: 'Das hat er dir schon gesagt.',
    wunschPlatzSatz: (kuerzel) => `Er möchte zurück auf ${kuerzel}.`,
    wunschPlatzHinweis: 'Solange er woanders aufläuft, kostet ihn das jedes Spiel etwas. '
      + 'Stell ihn dort auf, wo er hingehört, dann ist die Sache erledigt.',
    wunschNummerSatz: (nummer) => `Er hätte gern die ${nummer}.`,
    wunschNummerHinweis: 'Einstellige Nummern gibt es zehnmal. Eine vergebene ist weg.',
    wunschNummerKnopf: (nummer) => `Die ${nummer} geben`,
    // Index ist der Ton aus dem Wunschgespräch: nichts, etwas, erledigt.
    wunschReaktionen: [
      (name) => `${name} überlegt einen Moment. „Passt alles." Er meint es auch so.`,
      (name) => `${name} druckst kurz herum und rückt dann damit heraus.`,
      (name) => `${name} dreht das Trikot in den Händen und sagt nichts. Muss er auch nicht.`,
    ],
    // Überzeugen. Kein Wort über den Fortschritt: der ist versteckt, und eine
    // Zeile wie „noch zwei Gespräche" machte aus dem Zureden eine Rechnung.
    // Was der Manager bekommt, ist der Ton — und der reicht, um zu merken, ob
    // sich etwas bewegt.
    ueberzeugenTitel: 'Das musst du für mich machen',
    ueberzeugenHinweis: 'Er hat gesagt, dass er da nicht spielen will. Einmal reicht selten, '
      + 'und jedes Drängen kostet ihn etwas — auch das, das nichts bringt.',
    ueberzeugenSatz: (position, daheim) => `Er sperrt sich gegen ${position}. `
      + `Für ihn ist er ${daheim}.`,
    ueberzeugenKnopf: (position) => `Auf ${position} drängen`,
    // Index ist der Ton aus `ueberzeuge()`: abgeblockt, in Bewegung, überzeugt.
    ueberzeugenReaktionen: [
      (name) => `${name} hört sich das an und schüttelt den Kopf. „Ich bin kein anderer, `
        + 'nur weil im Kader einer fehlt."',
      (name) => `${name} widerspricht nicht mehr sofort. Er fragt nach, wie das gehen soll.`,
      (name) => `${name} zuckt mit den Schultern. „Von mir aus. Aber zeig mir, wie es geht." `
        + 'Damit ist die Sache erledigt.',
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
    // Wie sicher einer über seine Zukunft spricht, hängt am Abstand. Wer noch
    // drei oder mehr Jahre Studium vor sich hat, weiß nicht, in welche Stadt der
    // erste Job ihn führt — er hat einen Wegzug vor, aber keine Adresse; die
    // Kilometer kommen in den Satz, wenn der Abschluss näher rückt. Beim
    // Arbeiter endet nichts, das ihn zu einer Entscheidung zwänge: niemand
    // „plant den Wegzug in vier Jahren". Er plant ihn fürs nächste Jahr, oder
    // er denkt darüber nach. Dasselbe gilt für die Familie.
    horizont: (l, jahr) => {
      const h = l.horizont;
      if (!h) return 'fester Wohnsitz in der Gegend';
      const jahre = Math.max(0, h.jahr - jahr);
      const noch = jahre === 0 ? 'dieses Jahr' : jahre === 1 ? 'noch ein Jahr' : `noch ${jahre} Jahre`;
      const abschnitt = T.lebenslage.abschnitt[l.status];
      if (abschnitt) {
        const fern = jahre >= 3;
        const danach = h.dann === 'wegzug'
          ? (fern ? 'danach Wegzug geplant' : `danach Wegzug, ${h.km} km entfernt`)
          : h.dann === 'bleibt' ? 'will danach bleiben' : 'danach Schluss';
        return `${noch} ${abschnitt}, ${danach}`;
      }
      if (h.dann === 'schluss') return T.lebenslage.schluss[h.grund || 'koerper'](jahre);
      const wann = jahre === 0 ? 'dieses Jahr' : 'nächstes Jahr';
      if (h.dann === 'wegzug') {
        return jahre <= 1 ? `plant ${wann} den Wegzug, ${h.km} km entfernt` : 'denkt über einen Wegzug nach';
      }
      if (h.dann === 'familie') return jahre <= 1 ? `plant ${wann} Familie` : 'wünscht sich Familie';
      return 'will bleiben';
    },
    vereinsjahre: (n) => (n <= 0 ? 'neu im Verein'
      : n === 1 ? 'seit einem Jahr im Verein' : `seit ${n} Jahren im Verein`),
    // Dieselben Stichworte ohne die Vereinsjahre — für einen, der noch gar
    // nicht im Verein ist. „Neu im Verein" stünde sonst beim Tryout hinter
    // jedem Namen, und das stimmt erst, wenn er zusagt.
    satzGast: (l, jahr) => {
      const teile = [T.lebenslage.status[l.status]];
      if (l.entfernung <= 5) teile.push('wohnt um die Ecke');
      else teile.push(`${l.entfernung} km Anfahrt`);
      teile.push(l.auto ? 'mit dem Auto' : 'ohne Auto');
      if (l.familie) teile.push('Familie');
      teile.push(T.lebenslage.horizont(l, jahr));
      return teile.join(' · ');
    },
  },

  // Warum einer geht, wie er es selbst sagt — in der Nachricht am Tag nach dem
  // Finale. Der Körper steht nicht hier: wer aus diesem Grund geht, bekommt
  // eine eigene Nachricht ohne Frage.
  abgang: {
    gruende: {
      lust: 'Die Lust ist raus, sagt er. Es ist nichts passiert — es ist einfach weg.',
      beruf: 'Der Job lässt es nicht mehr zu, sagt er. Training, Anfahrt, Spieltage — '
        + 'irgendwas muss weg.',
      familie: 'Die Familie geht vor, sagt er. Jedes zweite Wochenende auf dem Platz geht '
        + 'nicht mehr.',
    },
  },

  // Was unter den Tryout-Nachrichten steht: die Werbung zum Ankreuzen, die
  // Kandidaten auf dem Platz, die Neuen mit ihrer Position. Alles in Stufen —
  // wie beim Commitment sieht der Manager nie eine Zahl, nur wie einer wirkt.
  tryout: {
    massnahmen: {
      mundpropaganda: 'Mundpropaganda',
      hochschulinfotag: 'Hochschulinfotag',
      socialMedia: 'Social Media',
      plakate: 'Plakate in der Stadt',
      fitnessstudio: 'Aushänge in Fitnessstudios',
      schule: 'Aushänge an Schulen',
      zeitung: 'Anzeige in der Lokalzeitung',
      supermarkt: 'Aushänge in Supermärkten',
      radio: 'Spot im Lokalradio',
    },
    // Wen eine Maßnahme bringt. Das ist die eigentliche Entscheidung, sobald
    // Werbung Geld kostet — und schon heute der Grund, warum der Kader nach
    // einem Hochschulinfotag anders aussieht als nach einer Zeitungsanzeige.
    wen: {
      hochschulinfotag: 'Studenten',
      socialMedia: 'jung und gemischt',
      plakate: 'von allem etwas',
      fitnessstudio: 'vor allem Berufstätige',
      schule: 'Schüler der Abschlussklassen',
      zeitung: 'Berufstätige',
      supermarkt: 'vor allem Berufstätige',
      radio: 'breit gestreut, wenige',
    },
    kostenlos: 'Kostet im Moment nichts.',
    andrang: (n) => `Erwarteter Andrang: etwa ${n} Leute`,
    beschlossen: 'Beschlossen.',
    keineWerbung: 'Ohne Werbung kommt nur, wer davon gehört hat.',
    // Der Knopf aus der Nachricht auf den eigenen Bildschirm.
    jetztTeilnehmen: 'Jetzt am Tryout teilnehmen',
    zuDenZusagen: 'Zu den Zusagen',
    zurueckKnopf: 'Zurück zum Posteingang',
    beendenKnopf: 'Tryout beenden',
    uebernehmenKnopf: 'Positionen übernehmen',
    nichtsMehr: 'Hier gibt es gerade nichts zu tun.',
    kandidatenTitel: (n) => `${n} ${n === 1 ? 'Kandidat' : 'Kandidaten'} auf dem Platz`,
    neueTitel: (n) => (n === 1 ? 'Ein Neuer vom Tryout' : `${n} Neue vom Tryout`),
    // Der eigene Kader daneben, zum Vergleich.
    eigenerKader: 'Eigener Kader',
    eigenerKaderHinweis: 'Zum Vergleich: was der Verein schon hat.',
    spalte: { position: 'Pos', anzahl: 'Anzahl', schnitt: 'Ø Stärke', bester: 'Bester' },
    interesse: 'Interesse',
    positionen: 'Der Stab sieht ihn als',
    // Talent, als Korridor statt als Zahl — wie breit er ist, hängt am Stab.
    talent: 'Talent (Einschätzung)',
    talentZahl: (halbe) => String(halbe / 2).replace('.', ','),
    talentKorridor: (von, bis) => (von === bis
      ? `${T.tryout.talentZahl(von)} Sterne`
      : `${T.tryout.talentZahl(von)}–${T.tryout.talentZahl(bis)} Sterne`),
    ansprechen: 'Ansprechen',
    angesprochen: 'Gesprochen',
    herkunft: (wo) => `kam über: ${wo}`,
    // Steht als Marke rechts über der Kandidatenliste — deshalb kurz genug für
    // ein Abzeichen, nicht für einen Absatz.
    gespraecheFrei: (frei) => (frei === 0
      ? 'Keine Gespräche mehr übrig'
      : `Noch ${frei} ${frei === 1 ? 'Gespräch' : 'Gespräche'} übrig`),
    abgeschlossen: 'Das Tryout ist vorbei. In drei Tagen kommen die Antworten.',
    vorbei: 'Dieses Tryout ist abgeschlossen.',
    // Die fünf Werte, die man an einem Vormittag sieht — kurz, weil fünf Spalten
    // in eine Zelle müssen. Der ganze Name steht im Titel.
    athletikKurz: {
      schnelligkeit: 'Tempo',
      ausdauer: 'Ausdauer',
      beweglichkeit: 'Beweglich',
      robustheit: 'Robust',
      kraft: 'Kraft',
    },
    punktVoll: '●',
    punktLeer: '○',
    athletikStufen: ['sehr schwach', 'schwach', 'mittel', 'gut', 'sehr gut'],
    athletikTitel: (name, stufe) => `${name}: ${stufe}`,
    // Gegen den Ligaschnitt, nach dem Rookie-Training. Die unterste Stufe sagt
    // bewusst nicht „schlecht": es ist ein Anfänger, und er ist es heute.
    //
    // Nur beim Tryout — auf dem Platz, bevor der Mann überhaupt zusagt. Sobald
    // eine Position feststeht, will der Manager keine Stufe mehr lesen, die
    // schon selbst eine Bandbreite ist, sondern wissen, welche der Stab
    // empfiehlt; dafür steht `empfehlungsstufen`.
    prognoseStufen: ['noch weit weg', 'ausbaufähig', 'Ligaschnitt', 'über dem Schnitt'],
    prognose: (position, stufe) => `${position} (${stufe})`,
    interesseStufen: ['kaum', 'zurückhaltend', 'offen', 'interessiert', 'Feuer und Flamme'],
    // Die Neuen nach den Zusagen: keine Stufe mehr je Position, sondern eine
    // Rangfolge — die Top 3, die nächsten drei, der Rest. Dieselbe Prognose,
    // nur nicht mehr als Wort verkleidete Zahl, sondern als das, was der Stab
    // dem Manager wirklich raten würde.
    position: 'Position',
    empfehlungsstufen: ['Empfehlung des Stabs', 'Potenzial vorhanden', 'Umschulung wird dauern', 'Nicht empfohlen'],
    nachgerueckt: 'nachgerückt',
    nachgeruecktTitel: 'Kam dazu, damit der Kader nicht unter die Mindestgröße fällt',
    uebernommen: 'Übernommen — sie sind im Kader und im Rookie-Training.',
    rookie: 'Rookie',
    rookieTitel: (datum) => `Im Rookie-Training bis ${datum}`,
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
