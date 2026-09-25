// @ts-check
/**
 * Balance numbers and the injectable RNG.
 * This module touches no DOM and imports nothing from ui/.
 */

/**
 * Roster positions, in depth-chart order: offence first, then defence.
 *
 * Eighteen, not the five and three the game started with. The split has to
 * happen before the position values do, because prising it back out of every
 * formula and every table later costs more than doing it now.
 *
 * Left and right do NOT double the catalogue. A `T` is a tackle; `LT` and `RT`
 * are places in a formation, and what a man loses by moving between them is a
 * matter for the position model, not for two more entries here.
 *
 * K and P are absent, as they have been since the kick values landed: the club
 * kicks with whoever has the foot for it.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 1
 */
export const POSITIONS = /** @type {const} */ ([
  'QB', 'RB', 'FB', 'WR', 'SL', 'TE', 'T', 'G', 'C',
  'DE', 'DT', 'NT', 'MIKE', 'SAM', 'WILL', 'CB', 'FS', 'SS',
]);

/** @typedef {typeof POSITIONS[number]} Position */

/**
 * The seven groups a position belongs to. A move inside a group is cheap, a
 * move across one is not — that is what the group is for. Numbers bands,
 * veterans and the provisional unit ratings read it too, so it lives here with
 * the catalogue rather than in the position model.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 4
 */
export const POSITION_GRUPPEN = /** @type {Record<string, Position[]>} */ ({
  quarterback: ['QB'],
  backfield: ['RB', 'FB'],
  empfaenger: ['WR', 'SL', 'TE'],
  lineOffense: ['T', 'G', 'C'],
  lineDefense: ['DE', 'DT', 'NT'],
  linebacker: ['MIKE', 'SAM', 'WILL'],
  secondary: ['CB', 'FS', 'SS'],
});

/** Which unit a group plays in. */
export const EINHEIT_JE_GRUPPE = /** @type {Record<string, 'offense'|'defense'>} */ ({
  quarterback: 'offense', backfield: 'offense', empfaenger: 'offense', lineOffense: 'offense',
  lineDefense: 'defense', linebacker: 'defense', secondary: 'defense',
});

/** Position -> group name, derived so the two never drift apart. */
export const GRUPPE_JE_POSITION = /** @type {Record<string, string>} */ (
  Object.fromEntries(
    Object.entries(POSITION_GRUPPEN).flatMap(([gruppe, pos]) => pos.map((p) => [p, gruppe])),
  )
);

/** The men in the trenches, both sides. They neither kick nor wear a single digit. */
export const LINEMEN = /** @type {Position[]} */ ([
  ...POSITION_GRUPPEN.lineOffense, ...POSITION_GRUPPEN.lineDefense,
]);

/**
 * The Kader every club starts from: thirty men, sixteen for the offence and
 * fourteen for a 4-3 defence. Nothing more — a Bayernliga club does not carry
 * a bench.
 *
 * `TE: 0` is deliberate. The club the player takes over has no trained tight
 * end and has to convert somebody the moment its system wants one. That is
 * part of starting at the bottom.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 8
 */
export const KADER_FORM = /** @type {Record<Position, number>} */ ({
  QB: 2, RB: 2, FB: 1, WR: 4, SL: 2, TE: 0, T: 2, G: 2, C: 1,
  DE: 2, DT: 2, NT: 1, MIKE: 2, SAM: 1, WILL: 1, CB: 3, FS: 1, SS: 1,
});

/** The club the player manages starts thin. */
export const KADER_GROESSE_EIGEN = Object.values(KADER_FORM).reduce((a, b) => a + b, 0);

/** Every other club draws this many extra players on top of KADER_FORM. */
export const ZUSATZ_SPIELER = 5;
export const KADER_GROESSE_FREMD = KADER_GROESSE_EIGEN + ZUSATZ_SPIELER;

/**
 * How the extra players are drawn. Weighted towards where the snaps and the
 * injuries pile up — line, receivers, secondary. An even draw would hand
 * somebody a third quarterback.
 *
 * `TE: 4` against the club's own zero is the point: the other clubs regularly
 * have a tight end and the player's club does not.
 */
export const ZUSATZ_GEWICHTE = /** @type {Record<Position, number>} */ ({
  QB: 1, RB: 3, FB: 2, WR: 5, SL: 3, TE: 4, T: 5, G: 4, C: 2,
  DE: 5, DT: 4, NT: 2, MIKE: 3, SAM: 3, WILL: 3, CB: 5, FS: 2, SS: 2,
});

/** No club may stack more than this many extras on one position. */
export const ZUSATZ_MAX_JE_POSITION = 2;

/**
 * The club the player picks starts at the bottom: its Kader baseline drops to
 * this value, however strong the club stands in the catalogue. The league's
 * ladder of strengths is untouched — every weaker club moves up one rung. The
 * promotion is meant to be played for, not chosen.
 */
export const EIGENE_VEREINSBASIS = 45;

/**
 * The fifteen attributes every player carries, on the same scale as `staerke`.
 * `kickStaerke` and `kickGenauigkeit` sit beside them and are drawn separately.
 *
 * `staerke` stays the leading figure for now: the attributes are pulled around
 * it, the depth chart still sorts by it, the screens still show it. Deriving
 * strength from the attributes instead is a later step of its own.
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 2
 */
export const ATTRIBUTE = /** @type {const} */ ([
  'schnelligkeit',      // Tempo geradeaus
  'beweglichkeit',      // Richtungswechsel, Explosivität
  'kraft',              // Wucht, hängt an Größe und Gewicht
  'ausdauer',           // wie lange er durchhält — trägt den Doppeleinsatz-Abzug
  'robustheit',         // Verletzungsanfälligkeit — trägt das Doppeleinsatz-Risiko
  'fangen',
  'ballsicherheit',
  'routeRunning',
  'werfen',
  'blocken',
  'passrush',
  'tacklen',
  'coverage',
  'spielverstaendnis',  // Lesen, Stellungsspiel
  'technik',            // positionsgebundenes Handwerk
]);

/** @typedef {typeof ATTRIBUTE[number]} Attribut */

/**
 * How far a drawn player leans on his position's profile: an attribute the
 * profile does not ask for sits at (1 - this) of his level, one at the very
 * top of it at the full level. Everything in between is proportional.
 *
 * Turn it down and every player is a generalist, every conversion is free and
 * the position model stops meaning anything.
 */
export const PROFIL_SPEZIALISIERUNG = 0.40;

/** Spread on a single attribute before it is scaled onto `staerke`. */
export const ATTRIBUT_STREUUNG = 6;

/**
 * Wie weit ein Einsatz die Attribute auf das Sollprofil seines Platzes zuzieht.
 *
 * Elf Spiele sind eine Saison, und elf davon machen zusammen rund 15 % — die
 * Rate, bei der eine Umschulung sich lohnt, ohne den geborenen Spieler
 * einzuholen. Wer die Saison aufteilt, zieht anteilig in beide Richtungen; das
 * fällt von selbst an, weil je Spiel gerechnet wird und nicht je Saison.
 */
export const ATTRIBUT_DRIFT_JE_SPIEL = 0.0147;

/**
 * Wie schnell ein einzelnes Attribut dem Sollprofil folgt, als Faktor auf
 * `ATTRIBUT_DRIFT_JE_SPIEL`.
 *
 * Handwerk lernt man, Tempo nicht. Ohne diese Leiter zöge jeder Wert gleich
 * schnell, und ein 109-Kilo-Linebacker würde auf dem Weg zum Cornerback mehr
 * Schnelligkeit gewinnen, als er Fangen lernt — der Körper stünde im Sollprofil
 * zwar richtig, wäre aber genauso schnell erreicht wie eine Fangtechnik.
 *
 * Der Schnitt liegt bei 1,0: die Saisonrate von rund 15 % bleibt, sie verteilt
 * sich nur anders. Was hier fehlt, zieht mit 1.
 * @type {Record<string, number>}
 */
export const LERNRATE = {
  technik: 1.5,
  fangen: 1.4,
  routeRunning: 1.4,
  ballsicherheit: 1.4,
  blocken: 1.3,
  coverage: 1.3,
  passrush: 1.2,
  tacklen: 1.2,
  werfen: 0.6,
  beweglichkeit: 0.5,
  kraft: 0.4,
  schnelligkeit: 0.3,
};

/**
 * The body. Height and weight are real data, not attributes — but `kraft` and
 * `schnelligkeit` hang off them, which is what makes the 95-kilo tackle a real
 * player rather than a mislabelled one: agile, and weak.
 *
 * KOERPER_MITTE is roughly the league's mean weight, KOERPER_SPANNE the
 * distance at which the coupling reaches its full effect.
 */
export const KOERPER_ANTEIL_DANEBEN = 0.20;   // share of players outside their corridor
export const KOERPER_DANEBEN_MIN = 0.20;      // how far outside, as a share of the corridor
export const KOERPER_DANEBEN_MAX = 0.55;
export const KOERPER_MITTE = 100;             // kg
export const KOERPER_SPANNE = 45;             // kg
export const KOERPER_KOPPLUNG = 0.35;         // how hard weight pulls Kraft up and Tempo down
/**
 * Die harten Ränder des Körpers. Sie sind **Notbremsen, keine Verteilung**:
 * wer sie berührt, wird auf sie geklemmt, und ein Korridorrand, der auf einem
 * dieser Werte liegt, erzeugt deshalb keinen Ausläufer mehr, sondern einen
 * Stapel genau darauf. Ein Fünftel der Spieler wird absichtlich außerhalb
 * seines Korridors gezogen (`KOERPER_DANEBEN_MIN/MAX`), und dieses Fünftel
 * muss Platz haben.
 *
 * Deshalb sind die Gewichtsgrenzen nicht rund gewählt, sondern gemessen: der
 * breiteste Korridor ist NT mit 115–160, ein Ausreißer nach oben landet bei
 * 160 + 0,55 · 45 = 184,8 kg, und der leichteste ist SL mit 68–86, ein
 * Ausreißer nach unten bei 68 − 0,55 · 18 = 58,1 kg. Wer die Korridore ändert,
 * rechnet diese beiden Zahlen neu — sonst stapelt sich stumm ein Zehntel einer
 * Position auf dem Rand.
 */
export const GROESSE_MIN = 165;               // cm — nobody outside these plays here
export const GROESSE_MAX = 205;
export const GEWICHT_MIN = 58;                // kg
export const GEWICHT_MAX = 185;

/** Rating bounds. */
export const MAX_RATING = 99;          // the scale's ceiling, kept for higher leagues
export const LIGA_MAX_STAERKE = 79;    // no Bayernliga strength is ever computed above this
export const RATING_UNTERGRENZE = 1;   // not a skill floor — only keeps a rating positive
export const STAERKE_STREUUNG = 6;     // standard deviation of a man's peak around the club baseline

/**
 * Talent steht in **halben Sternen, 1 bis 10** — ein halber Stern bis fünf.
 * Es ist keine Zahl auf der Werteleiter mehr und war es zu lange: als Deckel
 * über der Stärke war es dasselbe wie die Stärke, nur durch die Alterskurve
 * geteilt, und ein Fünfunddreißigjähriger mit fünf Sternen hieß bloß „war mal
 * gut". Jetzt sagt es, was es soll — **wie weit er noch kommen kann** —, wird
 * unabhängig von der heutigen Stärke gezogen, und die Entwicklung liest es.
 *
 * Der Schnitt eines Vereins hängt an seiner Basis: `basis * TALENT_JE_STAERKE
 * + TALENT_ACHSE` legt die 45 des eigenen Vereins auf 5 halbe Sterne und die
 * 65 des stärksten auf 7 — dieselbe Leiter, auf der die Zehnerstufe früher
 * einen halben Stern wert war, damit der Reiter nach dem Umbau nicht plötzlich
 * anders aussieht. Neu ist die Streuung: 1,6 halbe Sterne statt der 0,6, die
 * aus `STAERKE_STREUUNG / 10` fielen. Vorher zeigte ein Kader dreißigmal
 * dieselben zweieinhalb Sterne, und eine Spalte, in der alle gleich sind, ist
 * keine Spalte. Jetzt reicht ein Verein vom halben Stern bis in die vier.
 */
export const TALENT_MIN = 1;
export const TALENT_MAX = 10;
export const TALENT_JE_STAERKE = 0.1;
export const TALENT_ACHSE = 0.5;
export const TALENT_STREUUNG = 1.6;

/**
 * Ein unbesetzter Platz trägt nichts. Früher standen hier zwanzig Punkte
 * „Ersatzstärke" — ein Notnagel für eine Elf, die es nicht gab, und in der
 * Anzeige eine Lüge: eine leere Aufstellung sah nach Stärke 20 aus statt nach
 * gar nichts. Seit ein Verein mit unvollständiger Elf nicht mehr antritt,
 * sondern gewertet wird (`WERTUNG_PUNKTE`), kommt eine Lücke ohnehin in kein
 * Spiel mehr, und die Null ist die ehrlichere Zahl.
 */
export const LEERER_PLATZ_WERT = 0;

/**
 * Kicking. Every player carries two values instead of a K or P slot, because
 * below the GFL almost nobody keeps a specialist — the club kicks with whoever
 * has the foot for it, and that man plays a position the rest of the game.
 *
 * `kickStaerke` is how far the ball goes, `kickGenauigkeit` how reliably it
 * goes where it should. Most men have neither. A few have a real foot, and the
 * two values are drawn apart from each other on purpose: a cannon leg with no
 * aim is a punter, not a kicker.
 */
export const KICK_BASIS = 22;            // mean for a man who does not kick
export const KICK_STREUUNG = 6;
export const KICK_FUSS_ANTEIL = 0.07;    // share of the squad who actually can
export const KICK_FUSS_BASIS = 55;       // mean for those who can
export const KICK_FUSS_STREUUNG = 9;
/** Where a kicker never comes from: the men in the trenches. */
export const KICK_FUSS_AUSSCHLUSS = LINEMEN;

// --- Coaches ---------------------------------------------------------------
// Docs: docs/umbau-coaches.md, Abschnitte 4 und 5

/**
 * Wo ein Coach bei der Ziehung steht: halbe Vereinsbasis. Coaches fangen
 * niedrig an, damit der Stab etwas ist, das man aufbaut — ein 45er-Verein
 * bekommt Koordinatoren um 22, der stärkste Verein der Liga um 35.
 */
export const COACH_BASIS_ANTEIL = 0.5;
/** Streuung der Coachstärke um die halbe Basis. Halb so weit wie beim Spieler. */
export const COACH_STREUUNG = 3;
/** Streuung eines einzelnen Coachwerts um seine Stärke. Halb so weit wie beim Spieler. */
export const COACH_ATTRIBUT_STREUUNG = 3;
/** Wer generiert wird, ist alt. Die Jüngeren kommen später über die Rekrutierung. */
export const COACH_ALTER_MIN = 50;
export const COACH_ALTER_MAX = 65;
/**
 * Was ein Coach von der anderen Seite des Balls versteht — als Faktor auf
 * Scheme und Technik. Dieselbe Zahl steht in der Ähnlichkeit der Coaching-
 * Gruppen (`aehnlichkeit()`): Offense gegen Defense kostet ein Drittel.
 * Special Teams gehören keiner Seite und laufen deshalb ebenfalls hierüber.
 */
export const COACH_SEITENFAKTOR = 2 / 3;
/**
 * Wie die Vertrautheit eines OC mit einer Gruppierung je Schritt auf
 * `PERSONNEL_REIHE` abfällt, vom Heimatsystem aus. Multiplikativ, damit das
 * ferne Ende nicht bei null landet: sieben Schritte sind noch 21 %.
 */
export const PERSONNEL_ABSTAND_FAKTOR = 0.8;

// Die Vertrautheit wächst — Docs: docs/umbau-coaches.md, Abschnitt 7
//
// Der Fächer aus `PERSONNEL_ABSTAND_FAKTOR` gilt nur für die Ziehung. Danach
// hängen die acht Werte an nichts mehr als an sich selbst: das gespielte
// System wird dem OC vertrauter, die Nachbarn ein wenig, die fernen Systeme
// verlieren — und die Summe der acht steigt trotzdem mit jedem Tick, weil das
// Vergessen ein Anteil des Gelernten ist und nicht ein Anteil des Bestands.
// Wer nichts Neues lernt, vergisst auch nichts.

/**
 * Was ein volles Jahr im selben System bei Vertrautheit 0 bringt. Der Gewinn
 * schrumpft mit dem Abstand zum Dach (`MAX_RATING`): bei 20 sind es noch 9,6,
 * bei 60 noch 4,7. Ein Spezialist steht damit nach etwa 13 Jahren bei 80 und
 * nach 25 bei 95. Das ist die eine Schraube — alles andere skaliert mit.
 */
export const VERTRAUTHEIT_LERNRATE = 12;
/**
 * Was die beiden Nachbarn auf `PERSONNEL_REIHE` mitbekommen: ein Zehntel
 * dessen, was am gespielten System **gerade** gelernt wird — nicht ein Zehntel
 * der Rate. Der Unterschied ist der Punkt: wer im eigenen System ausgelernt
 * hat, lernt auch am Rand nichts mehr. Als Anteil der Rate sammelte ein
 * Spezialist in 25 Jahren mehr Zuschauerwissen über das Nachbarsystem, als ein
 * Wanderer mit drei echten Saisons darin erspielte.
 */
export const VERTRAUTHEIT_NACHBAR_ANTEIL = 0.10;
/**
 * Welcher Anteil des Gelernten den fernen Systemen (Abstand ≥ 2) verloren
 * geht, verteilt im Verhältnis ihrer Werte. Daraus folgt ohne Nebenbedingung,
 * dass die Summe der acht in jedem Tick um `(1 − Anteil) · Gelernt` steigt.
 */
export const VERTRAUTHEIT_VERGESSEN_ANTEIL = 0.30;
/**
 * Wie sich das Jahr aufteilt: die Hälfte des Gewinns kommt über die Spiele,
 * die andere über die Zeit, die der Coach im System verbringt — auch in der
 * Offseason wird trainiert. Ein Wechsel nach einem halben Jahr ohne Spiel
 * schreibt dem alten System damit ein Viertel des Jahres gut, dem neuen drei.
 */
export const VERTRAUTHEIT_SPIELANTEIL = 0.5;
/** Die Nenner der beiden Hälften: ein Jahr in Tagen, eine Saison in Spielen. */
export const VERTRAUTHEIT_TAGE_JE_JAHR = 365;
/**
 * Zehn Gruppenspieltage plus Halbfinale und Finale. Wer die Playoffs
 * verpasst, lernt etwas weniger — er hat auch weniger gespielt.
 */
export const VERTRAUTHEIT_SPIELE_JE_SAISON = 12;

// Die Wirkung am Spieltag — Docs: docs/umbau-coaches.md, Abschnitt 8

/**
 * Ab wo ein Scheme-Wert hilft statt schadet. Ein Koordinator über der Mitte
 * hebt seine Einheit, einer darunter drückt sie; der Ligaschnitt bei der
 * Ziehung liegt deutlich darunter, also zahlen anfangs fast alle.
 */
export const COACH_SCHEME_MITTE = 50;
/**
 * Stärkepunkte je Scheme-Punkt Abstand zur Mitte. Ein Koordinator mit 80
 * bringt +3, einer mit 20 kostet 3 — im Endstand rund ±1,3 Punkte.
 */
export const COACH_SCHEME_FAKTOR = 0.1;
/**
 * Was fehlende Vertrautheit mit dem gespielten System kostet, je Punkt unter
 * `MAX_RATING`. Absolut gerechnet, nicht relativ zum besten System des
 * Coaches: ein Anfänger zahlt auch zu Hause, weil er sein Heimatsystem eben
 * erst lernt — und nach zehn Jahren zahlt er dort nichts mehr. Relativ
 * gerechnet stünde ein Coach, der nirgends etwas kennt, malusfrei da, und der
 * Meister zahlte für den Wechsel mehr, als ein Anfänger je zahlen kann. Bei
 * 0,06 kostet Vertrautheit 0 sechs Stärkepunkte, also gut zwei im Endstand.
 */
export const VERTRAUTHEIT_MALUS_JE_PUNKT = 0.06;

/**
 * Die drei Special-Teams-Positionen — der ausgebildete Spezialist.
 *
 * Sie stehen mit Absicht **nicht** in `POSITIONS`: gezogen wird keiner von
 * ihnen, weder im Grundkader noch als Zusatzspieler. Ein Verein bekommt einen
 * Kicker nur, indem er ihn rekrutiert oder in der Jugend ausbildet — beides
 * kommt später. Bis dahin ist diese Liste leer bevölkert, und genau das ist
 * die Aussage: unterhalb der GFL kickt, wer den Fuß dafür hat.
 *
 * Woran man sie merkt, sobald es sie gibt: nur ihre `technik` zählt im
 * Special-Team-Wert (siehe `specialTechnik()`). Für alle anderen ist dieser
 * Anteil null und bleibt es — wer hundertmal puntet, wird davon kein Punter,
 * und seine Technik auf der Hauptposition bleibt davon ebenso unberührt. Die
 * Special Teams haben in diesem Modell einen Sonderstatus: sie verbuchen keine
 * Einsätze und ziehen an keinem Attribut.
 */
export const SPECIAL_POSITIONEN = /** @type {const} */ (['K', 'P', 'LS']);

/** Age bounds for the normal draw, and where the curve peaks. */
export const MIN_AGE = 18;
export const MAX_AGE = 36;
export const PEAK_AGE = 27;

/** Placeholder until the development model lands: when an ordinary player stops. */
export const RUECKTRITT_ALTER = 37;

/**
 * The Bayernliga special: every club carries one or two men who should have
 * stopped a decade ago and did not.
 */
export const VETERAN_MIN = 1;
export const VETERAN_MAX = 2;
export const VETERAN_ANTEIL_JUNG = 0.75;
export const VETERAN_JUNG = /** @type {[number, number]} */ ([45, 55]);
export const VETERAN_ALT = /** @type {[number, number]} */ ([56, 65]);
export const VETERAN_RUECKTRITT_MAX = 66;
/** Where a fifty-year-old still plausibly lines up. */
export const VETERAN_POSITIONEN = LINEMEN;

// --- Commitment und Lebenslage ---------------------------------------------
// Docs: docs/naechste-schritte.md, Block 7. Die Tabellen der Lebenslage
// (welcher Status in welchem Alter, wie weit einer fährt) stehen als Modell in
// `commitment.js`; hier stehen nur die Schrauben am Wert selbst.

/**
 * Die unteren Grenzen der Stufen 1 bis 4. Was darunter liegt, ist Stufe 0.
 * Harte Bänder ohne Unschärfe — der Manager sieht nie die Zahl, nur die Stufe,
 * und eine Stufe, die bei 59 und 61 verschieden lesen kann, wäre eine Zahl mit
 * Umweg.
 */
export const COMMITMENT_STUFEN = /** @type {const} */ ([20, 40, 60, 80]);

/** Wo die Ziehung anfängt, bevor Status und Vereinsjahre daran ziehen. */
export const COMMITMENT_BASIS = 52;
/** Streuung um das Ergebnis — was die Formel nicht erklärt. */
export const COMMITMENT_STREUUNG = 14;
/** Was ein Jahr im Verein bringt, und ab wie vielen Jahren nichts mehr dazukommt. */
export const COMMITMENT_JE_VEREINSJAHR = 1.2;
export const COMMITMENT_VEREINSJAHRE_MAX = 10;
/**
 * Was der Status mitbringt. Der Student ist der einzige mit Abzug: er ist
 * gekommen, um zu gehen, und weiß es. Der Rentner ganz oben, weil einer, der
 * mit 65 noch auf dem Platz steht, nirgendwo anders hinwill.
 */
export const COMMITMENT_JE_STATUS = /** @type {Record<string, number>} */ ({
  schueler: 4, student: -6, azubi: 4, arbeiter: 2, rentner: 10,
});

// --- Druck gegen Halt — die Waage in `lebenslauf.js` -----------------------
// Die Strecke stand bis Schritt 1 in der Commitment-Ziehung (bis zu 22 Punkte
// Abzug). Sie ist dort heraus, weil sie mit der Waage zweimal gezählt hätte:
// einmal als niedrigerer Halt, einmal als Druck. Ein Umstand steht auf einer
// Seite.

/** Was ein Auto von der Strecke nimmt: 80 km mit Auto drücken wie 32 ohne. */
export const DRUCK_FAKTOR_AUTO = 0.4;
/**
 * Was die eigene Familie auf die Strecke legt — nur beim Arbeiter und
 * Rentner. Beim Studenten sind „Familie" die Eltern, und die wohnen da, wo der
 * Verein steht: seine Entfernung ist schon die zu ihnen, ein Faktor darauf
 * zählte sie doppelt.
 */
export const DRUCK_FAKTOR_FAMILIE = 1.3;
/** Die Skala des Drucks ist die des Commitments: 0 bis 99. */
export const DRUCK_MAX = 99;
/** Was ein Jahr im Verein an Halt bringt — ungedeckelt, anders als in der Ziehung. */
export const HALT_JE_VEREINSJAHR = 2;
/**
 * Was die Eltern einem Schüler, Studenten oder Azubi an Halt geben. Auf der
 * Halt-Seite und nicht als Faktor unter 1 auf den Druck — das wäre dieselbe
 * Doppelzählung, nur zu seinen Gunsten.
 */
export const HALT_FAMILIENBONUS_JUNG = 15;
/**
 * So viele Saisons in Folge muss der Druck über dem Halt liegen, bis einer
 * geht. Nie sofort — sonst kippt jeder an einem schlechten Wochenende.
 */
export const DRUCK_JAHRE_BIS_ABGANG = 2;
/**
 * Multiplikator auf das Schluss-Gewicht im Arbeiter-Zyklus, je Stufe 0..4.
 * Ohne ihn hinge, ob ein 28-Jähriger weiterspielt, allein am Alter.
 */
export const SCHLUSS_JE_STUFE = /** @type {const} */ ([2.0, 1.4, 1.0, 0.75, 0.5]);
/**
 * Mit welcher Wahrscheinlichkeit das Commitment am Horizont den Plan kippt,
 * je Stufe 0..4: unten wird aus Bleiben ein Wegzug, oben aus Wegzug oder
 * Schluss ein Bleiben. Die Mitte kippt nichts.
 */
export const KIPPEN_JE_STUFE = /** @type {const} */ ([0.6, 0.3, 0, 0.3, 0.6]);

// --- Die zweite Wahrheit — der versteckte Horizont -------------------------
// Docs: docs/naechste-schritte.md, Block 7, „Nach Lebenslage fragen — der
// Zeitpunkt einer Enthüllung". Was in der Akte steht, ist der **Plan**, den
// der Spieler erzählt. Manchmal kommt es anders, und dann liegt die Wahrheit
// daneben — sichtbar nur im Gespräch, und auch dort erst, wenn er sich selbst
// entschieden hat. Gezogen wird sie in `commitment.js`, verbraucht in
// `lebenslauf.js`, erfragt über `auskunft.js`.

/**
 * Wie oft ein gezogener Plan in Wahrheit nicht hält.
 *
 * Knapp ein Drittel, und das ist bewusst keine Seltenheit wie die
 * Positionsverweigerung: der Plan ist eine Prognose über Jahre, und dass jede
 * dritte davon danebenliegt, ist eher optimistisch. Wäre es ein Zwanzigstel,
 * wäre das Fragen eine Formalie — der Manager bekäme neunzehnmal dieselbe
 * Bestätigung und hörte auf zu fragen, bevor der eine Fall kommt.
 */
export const WAHRHEIT_CHANCE = 0.30;

/**
 * Woran der Plan scheitert: am Zeitpunkt oder am Ausgang. Zwei Arten und nicht
 * eine, weil „das Studium dauert ein Jahr länger" und „ich ziehe doch weg"
 * ganz verschiedene Nachrichten sind — die erste verschiebt eine Planung, die
 * zweite wirft sie um.
 * @type {(readonly ['dauer'|'ausgang', number])[]}
 */
export const WAHRHEIT_ARTEN = [['dauer', 50], ['ausgang', 50]];

/**
 * Um wie viele Jahre sich der Zeitpunkt verschiebt. Öfter später als früher:
 * Abschnitte im Leben ziehen sich, sie verkürzen sich selten.
 * @type {(readonly [number, number])[]}
 */
export const WAHRHEIT_VERSCHIEBUNG = [[1, 45], [2, 25], [-1, 30]];

/**
 * Ab welchem Anteil der Strecke bis zum geplanten Ereignis er es selbst weiß —
 * gleichverteilt zwischen den beiden Werten.
 *
 * Die Untergrenze ist nicht 0: ein Student mit Vier-Jahres-Plan weiß am Tag
 * der Einschreibung nicht, dass er in Jahr zwei abbricht. Die Obergrenze ist
 * nicht 1, sonst käme die Wahrheit immer zu spät, um noch etwas zu ändern —
 * und genau das ist der Wert des Gesprächs: Vorlauf.
 */
export const WISSBAR_ANTEIL = /** @type {const} */ ([0.30, 0.90]);

// --- Rolle und Gespräche — die Kampagne in `rolle.js` ----------------------
// Die Rolle ist die Erwartung an die Einsatzzeit, die der Manager **setzt**.
// Sie wird nie aus dem Einsatzmuster erraten — das hieße, dem Manager eine
// Erwartung unterzuschieben und ihn dafür zu bestrafen. Keine Rolle zu sagen
// ist trotzdem kein Nullzustand: siehe `ROLLE_OHNE_JE_SPIEL`.
// Docs: docs/naechste-schritte.md, Block 7, Abschnitt „Rolle".

/**
 * Wie viele Gespräche der Manager pro Woche führen kann.
 *
 * Die Knappheit ist der ganze Punkt: ohne sie wäre ein Gespräch ein Knopf für
 * +5, den man fünfundvierzig Mal drückt. Drei sind so bemessen, dass die
 * Rollen-Kampagne (im Schnitt zwei Anfragen die Woche) durchpasst und daneben
 * noch Luft für einen eigenen Anlass bleibt — aber nicht für beliebig viele.
 */
export const GESPRAECHE_JE_WOCHE = 3;

/**
 * Was ein persönliches Gespräch bringt, wenn es lange genug her ist — der
 * volle Satz, bevor `PERSOENLICH_SAETTIGUNG_TAGE` ihn kürzt.
 *
 * Klein gehalten, weil die Kategorie nichts kostet außer dem Termin und kein
 * Risiko trägt: sie ist die Grundpflege, nicht der Hebel. Wer eine ganze
 * Offseason nur redet, soll spürbar vorankommen, aber nicht so weit, dass die
 * Rolle daneben egal wird.
 */
export const PERSOENLICH_GEWINN = 1.6;

/**
 * Nach wie vielen Tagen ein Gespräch wieder den vollen Satz Nähe bringt.
 * Darunter zählt der Anteil der verstrichenen Zeit.
 *
 * Der Grund für die Dämpfung überhaupt: das Wochenkontingent begrenzt nur die
 * **Rate**, nicht das **Ziel**. Ohne sie wäre es rechnerisch immer richtig,
 * jede Woche dreimal mit demselben Schlüsselspieler zu reden, bis er auf 99
 * steht — ein Knopf mit Wartezeit statt eines Gesprächs. Mit ihr ist die
 * Kategorie das, was sie sein soll: Pflege, über den Kader verteilt.
 *
 * Gezählt wird ab dem **letzten Gespräch überhaupt**, nicht ab dem letzten
 * einer Kategorie. Wer vorgestern über seine Rolle geredet hat, hat vorgestern
 * geredet; der Spieler führt darüber keine zwei Listen. Aus demselben Grund
 * heißt die Konstante nach der Nähe und nicht nach der Kategorie: seit „Wunsch
 * anhören" dazugekommen ist, teilen sich zwei den Abfall.
 */
export const NAEHE_SAETTIGUNG_TAGE = 28;

/**
 * Was allein das Nachfragen bringt, wenn der Spieler gar keinen Wunsch hat —
 * gedämpft durch dieselbe Nähe wie das persönliche Gespräch.
 *
 * Kleiner als `PERSOENLICH_GEWINN`, und das ist der Unterschied zwischen
 * Anteilnahme und Formsache: eine Viertelstunde über sein kaputtes Auto ist
 * mehr wert als die Frage, ob er noch einen Wunsch offen hat. Ohne die
 * gemeinsame Dämpfung wäre die Kategorie schlicht ein zweiter Knopf für
 * dasselbe, nur mit anderer Beschriftung.
 */
export const WUNSCH_LEER_GEWINN = 0.8;

/**
 * Wie viele Einsätze auf einem fremden Platz nötig sind, damit daraus ein
 * Positionswunsch wird — „über längere Zeit" in Zahlen.
 *
 * Eine Aushilfe ist kein Anlass. Sechs Spiele sind mehr als die halbe
 * Hauptrunde: dann ist es keine Aushilfe mehr, sondern seine Saison. Die
 * Einsätze verfallen mit `EINSATZ_VERFALL`, also verschwindet der Anlass auch
 * wieder, wenn er ein Jahr lang zu Hause gestanden hat.
 */
export const WUNSCH_EINSAETZE_MIN = 6;

/**
 * Um wie viele Punkte Eignung er auf dem fremden Platz schlechter sein muss,
 * bevor er sich beschwert — „deutlich schwächer" in Zahlen.
 *
 * Ohne diesen Abstand wünschte sich jeder Umgestellte zurück, und Umschulen,
 * einer der Kerne des Spiels, wäre überall teuer. Die Grundregel aus dem
 * Fahrplan lautet andersherum: Positionsverweigerung ist der seltene
 * Ausnahmefall. Wer woanders gleich gut ist, hat keinen Grund — und wer dort
 * besser ist, ist laut `hauptPlatz()` ohnehin längst dort zu Hause.
 */
export const WUNSCH_EIGNUNG_ABSTAND = 4;

/**
 * Was ein Spiel kostet, das er wieder auf dem fremden Platz bestreitet,
 * nachdem er seinen Wunsch ausgesprochen hat.
 *
 * Erst **nach** dem Aussprechen: vorher weiß der Manager nichts davon, und
 * etwas zu bestrafen, das niemand wissen konnte, ist keine Entscheidung,
 * sondern eine Falle. Genau das ist der Preis der Kategorie — wer nie fragt,
 * zahlt nie, erfährt aber auch nie, warum sein bester Mann leiser wird.
 *
 * Nur wenn er **spielt**: auf der Bank wird er nicht auf der falschen Position
 * verheizt, er sitzt. Dafür rechnet der Rollen-Mismatch, und zweimal für
 * denselben Nachmittag abzuziehen wäre doppelt.
 */
export const WUNSCH_UEBERGANGEN_JE_SPIEL = 1.2;

/**
 * Was ein Spiel bringt, das er nach ausgesprochenem Wunsch auf seinem Platz
 * bestreitet. Dieselbe Größenordnung wie `ROLLE_ERFUELLT_BONUS`, aus dem
 * gleichen Grund: die Waage soll nach oben zeigen können, ohne dass ein
 * Stammspieler über eine Saison auf 99 läuft.
 *
 * **Ein einmaliger großer Bonus stand hier zuerst und ist gemessen
 * gescheitert.** Der Anlass zum Wunsch steckt in den Einsätzen und ist nach
 * einem einzigen richtig besetzten Spiel noch da — der Wunsch entstand also
 * beim nächsten Nachfragen sofort neu. Fragen, richtig aufstellen, kassieren,
 * von vorn: mit sechs Punkten je Runde der mit Abstand beste Zug im Spiel.
 * Kleiner und laufend statt groß und einmalig macht die Schleife wertlos, ohne
 * dass ein Zähler am Spieler sie verbieten müsste.
 */
export const WUNSCH_ERFUELLT_JE_SPIEL = 0.8;

/**
 * Was die einstellige Nummer bringt, wenn der Manager sie hergibt.
 *
 * Kostet ihn nichts als die Nummer selbst — es gibt zehn davon, und die
 * nächste Ansage des Trainerstabs kann sie brauchen. Bewusst ohne Gegenstück:
 * eine Nummer **nicht** zu geben ist kein gebrochenes Wort, sondern eine
 * Entscheidung, und der Spieler trug gestern schon die 42.
 */
export const WUNSCH_NUMMER_BONUS = 4;

/**
 * Ab wie vielen Einsätzen auf seinem Hauptplatz ein Spieler sich überhaupt
 * gegen eine Umschulung sperrt.
 *
 * Fünfundzwanzig sind knapp unter `EINGESPIELT_VOLL` und damit rund zweieinhalb
 * Saisons als Stammspieler — ein Mann, der auf seinem Platz jemand ist. Das ist
 * die tragende Bedingung dafür, dass die Ablehnung der seltene Ausnahmefall
 * bleibt, den der Fahrplan verlangt, und nicht eine Mechanik, die bei jeder
 * Umstellung zieht: ein Rookie tut, was man ihm sagt, und das Umschulen von
 * Spielern bleibt ein Kern des Spiels.
 */
export const UEBERZEUGEN_HEIMAT_MIN = 25;

/**
 * Unter welchem Halt er sich sperrt. Vierzig ist die Grenze zwischen der
 * zweiten und der dritten Commitment-Stufe: die untere Hälfte, sichtbar im
 * Personalreiter, bevor es passiert.
 *
 * Damit ist die Ablehnung **keine Eigenschaft des Spielers, sondern eine Folge
 * der Führung**. Ein Zufallswurf hätte dasselbe Feld gefüllt und dem Manager
 * nichts erzählt; so ist die Verweigerung die Quittung für einen Mann, den man
 * erst hat schlecht werden lassen und dann quer über den Platz geschickt hat.
 * Der Ausweg steht deshalb auch schon im Spiel: erst reden, dann drängen.
 */
export const UEBERZEUGEN_HALT_GRENZE = 40;

/**
 * Was ein Spiel auf einer abgelehnten Position kostet.
 *
 * Etwas mehr als das Übergehen eines Wunsches (`WUNSCH_UEBERGANGEN_JE_SPIEL`,
 * 1,2): einen Wunsch zu überhören ist Nachlässigkeit, jemanden gegen sein
 * ausgesprochenes Nein dorthin zu stellen ist eine Ansage.
 */
export const UEBERZEUGEN_ABGELEHNT_JE_SPIEL = 1.5;

/**
 * Wie weit ein einzelnes Gespräch ihn im besten Fall bringt — auf einer
 * Strecke von 0 bis 1. Multipliziert mit der Nähe der Positionen und dem Halt.
 *
 * Ein halber Schritt heißt: zwei Gespräche reichen nie, weil beide Faktoren
 * unter eins liegen, sobald es überhaupt eine Ablehnung gibt. Gerechnet für
 * eine Ablehnung frisch nach ihrer Entstehung (Halt knapp unter 40) sind es
 * rund fünf Gespräche innerhalb einer Einheit und rund neun über die Einheiten
 * hinweg — „Investment von Gesprächen" wörtlich genommen, und die absurde
 * Umschulung teurer als die naheliegende.
 */
export const UEBERZEUGEN_SCHRITT = 0.5;

/**
 * Was jedes Drängen kostet, ob es zieht oder nicht.
 *
 * Klein gegen den laufenden Abzug — fünf Gespräche zu 0,8 sind billiger als
 * drei Spiele auf der abgelehnten Position —, aber nicht nichts: sonst wäre der
 * Knopf gratis und die Entscheidung keine. Kein Gegenstück nach oben; der Lohn
 * fürs Überzeugen ist, wie beim Wunsch, dass der Abzug aufhört.
 */
export const UEBERZEUGEN_KOSTEN = 0.8;

/**
 * Wie weit der Halt das Tempo streckt: der Faktor bei Commitment 0 und bei 99.
 *
 * Wer ohnehin dabei ist, lässt eher mit sich reden — das ist die Verzahnung,
 * die den beiden anderen Kategorien einen Zweck über ihren eigenen Ertrag
 * hinaus gibt. Der Fortschritt selbst bleibt **versteckt**: der Manager sieht
 * nur, wie es ankommt, nie eine Zahl. Eine Leiste daneben machte aus dem
 * Zureden das Abarbeiten eines Balkens.
 */
export const UEBERZEUGEN_HALT_MIN = 0.5;
export const UEBERZEUGEN_HALT_MAX = 1.5;

/**
 * Wie viele Wochen vor dem ersten Spieltag die Rollen-Kampagne fertig sein
 * muss. Zwei: die letzten beiden Preseason-Wochen gehören der Aufstellung,
 * nicht mehr den Personalgesprächen.
 */
export const ROLLEN_FRIST_WOCHEN = 2;

/**
 * Wie viele Rollen-Anfragen in einer Woche höchstens rausgehen.
 *
 * Die Tempo-Rechnung allein garantiert, dass die Liste rechtzeitig leer wird —
 * aber nur, wenn der Manager auch antwortet. Wer jede Woche „Später" tippt,
 * bekam ohne diesen Deckel in der letzten Woche vor der Frist den ganzen Rest
 * auf einmal: gemessen dreißig blockierende Nachrichten an einem Tag.
 *
 * Vier reichen trotzdem: über rund zwanzig Wochen wird jeder mehrfach gefragt.
 * Wer danach ohne Rolle dasteht, ist übergangen worden, nicht übersehen — und
 * genau das kostet seit `ROLLE_OHNE_JE_SPIEL` etwas. Der Deckel schützt also
 * vor der Lawine, nicht vor der Rechnung.
 */
export const ROLLE_ANFRAGEN_MAX = 4;

/**
 * Wie viele Spiele das rollierende Fenster fasst, aus dem der Mismatch
 * gerechnet wird — und ab wie vielen Einträgen überhaupt gerechnet wird.
 *
 * Vier statt drei, weil ein Rotationsspieler bei drei Spielen nur 0, ⅓, ⅔ oder
 * 1 erreichen kann und seine Erwartung von 0,5 damit nie trifft. Gerechnet wird
 * ab dreien: wer zwei Spiele lang nicht spielt, hat noch keine Geschichte.
 */
export const ROLLE_FENSTER = 4;
export const ROLLE_FENSTER_MIN = 3;

/**
 * Welchen Anteil der Spiele eine Rolle verspricht.
 *
 * Perspektiv- und Ergänzungsspieler stehen mit **derselben** Zahl da, und das
 * ist kein Versehen: beide erwarten wenig Einsatzzeit. Der Unterschied
 * zwischen ihnen ist nicht die Erwartung, sondern ob das Etikett zum Alter
 * passt — siehe `ROLLE_ALTER_*` weiter unten.
 */
export const ROLLE_ERWARTUNG = /** @type {Record<string, number>} */ ({
  unangefochten: 1.0, starter: 0.85, rotation: 0.5, perspektive: 0.15, ergaenzung: 0.15,
});

/**
 * Wie viel Abweichung nach unten geschluckt wird, bevor das Commitment
 * reagiert — als Grundmaß und als Zuschlag je Coaching-Gruppe.
 *
 * Der Zuschlag ist der Grund, warum die Tabelle nach `COACHING_GRUPPEN` und
 * nicht nach Positionen geschnitten ist: ein Starter-QB erwartet praktisch
 * jeden Snap und merkt jede Pause, eine DL-Rotation ist im Sport normal und
 * braucht Luft. Was hier fehlt, bekommt das Grundmaß.
 */
export const ROLLE_TOLERANZ = 0.15;
export const ROLLE_TOLERANZ_JE_GRUPPE = /** @type {Record<string, number>} */ ({
  QB: 0, RB: 0.15, WR: 0.10, TE: 0.10, OL: 0,
  DL: 0.20, ILB: 0.05, OLB: 0.05, CB: 0.05, S: 0.10,
});

/**
 * Was ein Spiel am Commitment bewegt, wenn die Einsatzzeit die Rolle verfehlt:
 * Punkte je Anteilspunkt jenseits der Toleranz.
 *
 * Bei 8 kostet ein Starter (0,85 erwartet, 0,15 Toleranz), der gar nicht
 * spielt, 0,7 × 8 ≈ 5,6 Punkte je Spiel — nach drei Spielen ist das eine Stufe.
 * Das soll wehtun: es ist der laufende Abzug, gegen den ein einmaliges
 * Downgrade-Gespräch (rund 10 Punkte) billig ist.
 *
 * Bei 12 war es zu scharf: gemessen über acht Saisons landete ein Viertel des
 * Kaders auf Stufe 0, wenn der Manager jedem alles versprach — nicht als
 * Lehre, sondern als Totalschaden ohne Weg zurück. Mit 8 sind es rund fünf
 * Mann, und die Lehre bleibt dieselbe.
 */
export const ROLLE_MISMATCH_JE_ANTEIL = 8;

/**
 * Was ein Spiel kostet, in dem er **gar keine** Rolle hat — mal dem Anteil der
 * Spiele, die er nicht bestritten hat.
 *
 * Die Skalierung ist der Kern: wer jedes Spiel macht, weiß auch ohne Gespräch,
 * woran er ist — das Feld ist die Ansage, und der Abzug geht gegen null. Wer
 * sitzt und nie gehört hat, was er erwarten soll, trägt ihn voll.
 *
 * Bei 1,2 verliert ein Reservist ohne Rolle rund zwölf Punkte über eine
 * Saison: deutlich weniger als eine falsche Zusage (gemessen −31) und
 * deutlich schlechter als eine passende (+4,6). Genau diese Reihenfolge ist
 * gewollt — eine Rolle zu vergeben soll sich lohnen, solange sie nicht völlig
 * neben der Sache liegt.
 *
 * Damit ist die frühere Regel „ohne gesetzte Rolle gibt es keinen Drift"
 * bewusst aufgehoben. Sie war richtig, solange es keinen Weg gab, eine Rolle
 * zu setzen — ein Hebel ohne Definition. Den Weg gibt es jetzt, und die
 * Kampagne fragt bis zur Frist jeden mehrfach: wer ohne Rolle dasteht, ist
 * übergangen worden, nicht vergessen.
 */
export const ROLLE_OHNE_JE_SPIEL = 1.2;

/**
 * Was ein Spiel bringt, in dem er die Rolle erfüllt oder übertrifft. Klein und
 * fest: die Waage soll nach oben zeigen können, ohne dass ein Stammspieler
 * über eine Saison auf 99 läuft.
 */
export const ROLLE_ERFUELLT_BONUS = 0.8;

/**
 * Ab welcher Abweichung jenseits der Toleranz der Spieler von sich aus
 * nachfragt — und wie viele Tage danach frühestens wieder.
 *
 * Die Nachricht läuft ohne das Empathie-Gate der Trend-Nachrichten: ein
 * Spieler bemerkt seine eigene Bank selbst, egal wie aufmerksam sein Coach
 * ist. Der Cooldown verhindert, dass aus demselben Missstand jede Woche
 * dieselbe Nachricht wird.
 */
export const ROLLE_BESCHWERDE_SCHWELLE = 0.3;
export const ROLLE_BESCHWERDE_COOLDOWN = 28;

/**
 * Was die Reaktion beim Setzen ausmacht: Punkte je Stufe, die die gesetzte
 * Rolle über oder unter dem liegt, was seine Stärke im Kader erwarten ließe.
 */
export const ROLLE_JE_STUFE_ABSTAND = 6;

/**
 * Der Zuschlag auf ein Downgrade — Verlustaversion. Wer von Starter auf
 * Rotation fällt, nimmt es schwerer als einer, der ohne Vorgeschichte
 * Rotationsspieler wird, obwohl am Ende dieselbe Rolle steht.
 */
export const ROLLE_DOWNGRADE_ZUSATZ = 5;

/**
 * Was ein Rollengespräch an sich kostet, sobald es eine bestehende Rolle
 * ändert. Klein — und **billiger** als der laufende Mismatch-Abzug, um den es
 * hier geht: wer eine überholte Rolle stehen lässt, zahlt mehr.
 */
export const ROLLE_AENDERUNG_ABZUG = 2;

/**
 * Die Passung von Perspektiv- und Ergänzungsspieler ans Alter, unabhängig von
 * Perzentil und Vorgeschichte.
 *
 * Ein 50-Jähriger als Perspektivspieler ist irritiert — er hat keine
 * Perspektive mehr zu entwickeln. Ein Rookie als Ergänzungsspieler hört
 * „aufgegeben". Zwischen den beiden Grenzen passt beides, und dort gibt es
 * weder Bonus noch Abzug.
 */
export const ROLLE_ALTER_PERSPEKTIVE_MAX = 25;
export const ROLLE_ALTER_ERGAENZUNG_MIN = 28;
/** Punkte je Jahr jenseits der Grenze, gedeckelt. */
export const ROLLE_ALTER_JE_JAHR = 1.5;
export const ROLLE_ALTER_MAX_ABZUG = 12;
/** Was das passende Etikett bringt: der Alte als Ergänzung, der Junge als Perspektive. */
export const ROLLE_ALTER_BONUS = 3;

/**
 * Wie lange eine gesetzte Rolle steht, bevor sie wieder geändert werden darf.
 *
 * Drei Wochen. Ohne den Halt wäre die Rolle ein Regler, den man vor jedem
 * Spieltag auf die Aufstellung dreht, statt eine Zusage, an der man gemessen
 * wird. Über den Saisonwechsel hinweg gilt er nicht — die Offseason ist genau
 * die Zeit, in der neu verteilt wird.
 */
export const ROLLE_COOLDOWN_TAGE = 21;

/**
 * Die Grenzen, ab denen die Stärke im Kader eine Rolle erwarten lässt — als
 * Perzentil, von oben gelesen. Der erste Eintrag, den das Perzentil erreicht,
 * gewinnt; was darunter liegt, ist die unterste Stufe.
 *
 * Gerechnet wird überwiegend **an seiner Position**: ob einer spielt,
 * entscheidet sich gegen die drei anderen auf seinem Platz und nicht gegen die
 * Offensive Line. Der kaderweite Anteil steht trotzdem mit drin, sonst wäre
 * der beste von drei schlechten Kickern ein unangefochtener Stammspieler.
 */
export const ROLLE_PERZENTIL_GRENZEN = /** @type {const} */ ([
  ['unangefochten', 0.90], ['starter', 0.70], ['rotation', 0.45], ['perspektive', 0],
]);
export const ROLLE_PERZENTIL_POSITION_ANTEIL = 0.75;

// --- Drift — Coach, Verletzung, Erfolg, Vereinsjahre in `drift.js` ----------
// Docs: docs/naechste-schritte.md, Block 7, „Was den Wert bewegt"

/**
 * Die Betreuung einer Coaching-Gruppe verstärkt oder mildert jeden Verlust an
 * Commitment: 1,4-fach ohne jede Betreuung, 0,6-fach bei der bestmöglichen.
 * Linear dazwischen, gemessen an `MAX_RATING` — **nicht** an dem, was ein
 * Koordinator dieser Liga erreicht.
 *
 * Das ist gewollt und durchgerechnet: ein Koordinator mit Empathie um 22 gibt
 * einer von fünf Gruppen verdünnt nur gut 4 Punkte Betreuung, und der Faktor
 * liegt dann bei 1,36 — für jeden Verein fast gleich schlecht. Das ist der
 * Malus dafür, keine Positionscoaches zu haben, und er soll erst verschwinden,
 * wenn es welche gibt. Kalibriert wird für das ganze Spiel mit rekrutierten
 * Positionscoaches, nicht für die erste Saison. Gegen einen realistischen
 * Deckel von 20 zu rechnen war vorgeschlagen und ist verworfen: dann hätte ein
 * Verein ohne einen einzigen Positionscoach schon fast die volle Betreuung.
 *
 * Nur Verluste, nie Gewinne: ein guter Coach hält die Leute, er verdoppelt
 * nicht den Lohn einer erfüllten Rolle.
 */
export const BETREUUNG_FAKTOR_OHNE = 1.4;
export const BETREUUNG_FAKTOR_BESTE = 0.6;

/**
 * Was eine Woche verletzt am Commitment kostet, vor Betreuung und Lebenslage.
 * Dieselbe Größenordnung wie ein Spiel auf der Bank ohne Rolle
 * (`ROLLE_OHNE_JE_SPIEL`) — verletzt zu sein ist nicht schlimmer, als
 * übergangen zu werden, aber es summiert sich: sechs Wochen mit Familie als
 * Arbeiter ohne Positionscoach sind rund fünfzehn Punkte, gut eine
 * Dreiviertelstufe.
 */
export const VERLETZUNG_JE_WOCHE = 1.0;
/**
 * Wer eine eigene Familie hat, rechnet schneller nach, ob sich das noch lohnt.
 * Multiplikativ mit dem Arbeiter, wie die Faktoren der Waage auch.
 */
export const VERLETZUNG_FAKTOR_FAMILIE = 1.4;
/** Wer arbeiten muss, trägt die Verletzung in den Job — „lohnt sich das noch". */
export const VERLETZUNG_FAKTOR_ARBEITER = 1.3;

/**
 * Ab wie vielen Niederlagen in Folge die Serie am Kader nagt, und was sie
 * einmalig kostet. Einmal beim **Erreichen** der Schwelle, nicht bei jedem
 * weiteren Spiel der Serie — sonst liefe der Abzug bei einem Verein, der
 * ohnehin untergeht, ohne Boden weiter.
 */
export const ERFOLG_SERIE_SCHWELLE = 3;
export const ERFOLG_SERIE_ABZUG = 2.0;
// Verworfen, nach Messung: ein Abzug für verpasste Playoffs (4 Punkte, einmal
// bei der Auslosung). Acht von zwölf Vereinen verpassen sie **jedes** Jahr,
// der eigene startet als schwächster — der Abzug war kein Signal für
// Misserfolg, sondern eine Steuer auf den Normalfall, ohne Boden. Über drei
// Saisons fiel der KI-Schnitt von 57 auf 45, und ein Manager, der jedem die
// passende Rolle gibt, stand bei −2 statt +20. Siehe balancing.md, Abschnitt 17.

/**
 * Was ein Jahr im Verein am Wert hebt, jedes Jahr bis `COMMITMENT_VEREINSJAHRE_MAX`.
 * Klein: zehn Jahre sind vier Punkte. Die Jahre stehen außerdem in der Waage
 * (`HALT_JE_VEREINSJAHR`) — das ist keine Doppelzählung, denn dort sind sie
 * eine Rechengröße beim Abgang, hier eine Bewegung des Werts, die jeder andere
 * Treiber wieder aufzehren kann.
 */
export const VEREINSJAHR_BONUS = 0.4;

/**
 * Was ein KI-Verein je Saison gewinnt, mal der Betreuung seiner Gruppe als
 * Anteil an `MAX_RATING` — der Ersatz dafür, dass dort niemand Gespräche führt
 * oder Rollen setzt. Kalibriert gegen die gemessene KI-Betreuung (im Schnitt
 * rund 6 von 99, siehe balancing.md Abschnitt 17), damit der Ligaschnitt über
 * drei Saisons ungefähr hält, statt ohne Boden zu fallen.
 */
export const KI_AUSGLEICH_JE_SAISON = 25;

/**
 * Wie oft der Coach die Chance bekommt, einen Stufenwechsel zu bemerken, bevor
 * er für immer ungesagt bleibt — je Wochenanfang eine. Die Chance je Versuch
 * ist die Betreuung selbst, als Anteil an `MAX_RATING`. Ohne Positionscoach
 * sind das beim eigenen Verein rund 5 %, über vier Versuche also etwa jeder
 * fünfte Wechsel (gemessen: 19 %).
 */
export const TREND_VERSUCHE = 4;

/** Match simulation. */
export const BASE_POINTS = 20;        // what an evenly matched offence scores
export const RATING_TO_POINTS = 0.42; // points gained per point of unit advantage
export const HOME_ADVANTAGE = 2.5;    // points, applied to the home side
export const MATCH_NOISE = 6.5;       // std-dev-ish spread on the expected score
export const MIN_EXPECTED = 3;
export const MAX_EXPECTED = 56;

/**
 * Ausrichtung: warum eine Mischung schlägt, was an den Enden steht.
 *
 * `vorteil()` mischte Lauf und Pass früher linear. Eine Gerade hat ihr Optimum
 * immer an einem Ende, und ihre Steigung war fast waagerecht: über den ganzen
 * Reglerweg lagen 0,45 erwartete Punkte, gegen ein MATCH_NOISE von 6,5. Der
 * Regler war damit unsichtbar und die Entscheidung keine.
 *
 * Vier Zahlen richten das:
 *
 * - AUSGEWOGENHEIT macht die Mischung konkav. Die Strafe ist null bei 50/50 und
 *   wächst zu den Rändern, weshalb das Optimum bei `sigmoid(d / AUSGEWOGENHEIT)`
 *   liegt und damit für *jedes* d echt innen. Sie sagt zugleich, was ein Ende
 *   höchstens kostet: `AUSGEWOGENHEIT * ln2` Stärkepunkte.
 * - SPREIZUNG sagt, wie weit Kader und Gegner dieses Optimum verschieben. Sie
 *   spreizt Pass und Lauf um ihren gemeinsamen Mittelwert, lässt den also in
 *   Ruhe — siehe `spreize()` in team.js.
 * - KLIPPE und RAND brechen die letzten Prozent weg. Ohne sie kostete reines
 *   Passspiel aus Empty heraus 0,4 Punkte und wäre unsichtbar geblieben; mit
 *   ihnen kostet es 7. Ohne Laufandrohung kein Passspiel.
 *
 * Docs: docs/umbau-positionsmodell.md, Abschnitt 6
 */
export const AUSGEWOGENHEIT = 10;   // Stärkepunkte, die Einseitigkeit höchstens kostet
export const SPREIZUNG = 1.0;       // wie weit Kader und Gegner das Systemoptimum verschieben
export const KLIPPE = 16;           // Einbruch am äußersten Rand, in Stärkepunkten
export const RAND = 0.03;           // Breite des Bandes, in dem die Klippe greift

/**
 * Standings: German American football scores 2:0 for a win. There is no third
 * outcome — overtime runs until somebody is ahead, in the group stage as well
 * as in the playoffs, so no draw ever reaches the table.
 */
export const POINTS_WIN = 2;
export const POINTS_LOSS = 0;

/**
 * Was ein Verein bekommt, der nicht antritt: null, der Gegner sechs Touchdowns.
 * Die Zahl ist gesetzt und nicht gerechnet — sie soll wehtun und als Ergebnis
 * sofort erkennbar sein, statt sich unter die knappen Spiele zu mischen.
 */
export const WERTUNG_PUNKTE = 36;

/** Injuries. */
export const INJURY_CHANCE_PER_GAME = 0.055; // per team, per match
export const INJURY_MIN_WEEKS = 1;
export const INJURY_MAX_WEEKS = 6;

/**
 * Overtime never ends level, so the loop has no round limit. It terminates on
 * its own — each possession scores a touchdown with at least 9 % probability
 * per side, so the two sides separate almost surely. The brake exists only so
 * that a broken RNG can never hang the game, and it decides rather than ties.
 */
export const OT_NOTBREMSE_RUNDEN = 50;

/** Season structure: two groups of six, then a bracket across them. */
export const SEASON_START_YEAR = 2026;
/** Playoff berths per group. Two of six, which is the bracket the league uses. */
export const PLAYOFF_PLAETZE = 2;

/** @param {number} v @param {number} lo @param {number} hi */
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/**
 * Linear zwischen Stützstellen, außerhalb flach.
 *
 * Das Modell beschreibt seine Kurven lieber als Tabelle denn als Formel: eine
 * Zeile je Stützstelle liest sich beim Balancieren, eine Exponentialfunktion
 * nicht. Die Stützstellen stehen aufsteigend, jede als `[Eingang, Ergebnis]`.
 * @param {[number, number][]} kurve
 * @param {number} wert
 */
export function interpoliere(kurve, wert) {
  if (wert <= kurve[0][0]) return kurve[0][1];
  const letzte = kurve[kurve.length - 1];
  if (wert >= letzte[0]) return letzte[1];
  for (let i = 1; i < kurve.length; i++) {
    const [x0, y0] = kurve[i - 1];
    const [x1, y1] = kurve[i];
    if (wert <= x1) return y0 + ((wert - x0) / (x1 - x0)) * (y1 - y0);
  }
  return letzte[1];
}

// --- RNG -------------------------------------------------------------------
// Seeded so a season replays identically and tests never assert on a
// distribution. Mirrors the injectable-RNG habit from Spirit Idland.

/** @param {string} str */
export function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h >>> 0) || 1;
}

/**
 * mulberry32 — small, fast, good enough for a manager game.
 * @param {number|string} seed
 * @returns {() => number} uniform in [0, 1)
 */
export function makeRng(seed) {
  let a = typeof seed === 'string' ? hashSeed(seed) : (seed >>> 0) || 1;
  return function rng() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** @param {() => number} rng @param {number} lo @param {number} hi inclusive */
export function randInt(rng, lo, hi) {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** @template T @param {() => number} rng @param {readonly T[]} arr */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

/**
 * Draw from a pool of [value, weight] pairs. Weights are plain integers so a
 * single name can be nudged by hand without recomputing a distribution.
 * @template T @param {() => number} rng @param {readonly (readonly [T, number])[]} pool
 * @returns {T}
 */
export function pickWeighted(rng, pool) {
  let summe = 0;
  for (const eintrag of pool) summe += eintrag[1];
  let wurf = rng() * summe;
  for (const eintrag of pool) {
    wurf -= eintrag[1];
    if (wurf < 0) return eintrag[0];
  }
  return pool[pool.length - 1][0];
}

/**
 * Four uniforms averaged have a standard deviation of 1/sqrt(48), so this is
 * the factor that makes the result a unit normal. Getting it wrong halves
 * every spread that goes through here, silently.
 */
const NORMAL_SKALIERUNG = Math.sqrt(48);

/** Roughly normal, mean 0, standard deviation 1. @param {() => number} rng */
export function randNormal(rng) {
  return ((rng() + rng() + rng() + rng()) / 4 - 0.5) * NORMAL_SKALIERUNG;
}

/** Fisher-Yates, in place. @template T @param {() => number} rng @param {T[]} arr */
export function shuffle(rng, arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
