import { mischen } from '../lib/mischen';

/**
 * Die Aussagen des Audits und die drei Vorlieben.
 *
 * Eigene Formulierungen, abgeleitet aus veroeffentlichten Modellen der
 * Lernstrategien (LIST, MSLQ) und den Lernmustern nach Vermunt. Konstrukte
 * sind frei, Wortlaute nicht: Kein Satz hier lehnt sich an den Wortlaut eines
 * bestehenden Fragebogens an. Die Messguete ist damit UNGEPRUEFT, und das
 * steht auf der Ergebnisseite (siehe `BEIPACKZETTEL` in `Ergebnis.tsx`).
 *
 * Diese Datei ist reine Daten plus eine deterministische Reihenfolge. Sie
 * kennt weder Zod noch React noch den Speicher.
 */

/**
 * Steigt, wenn sich eine Aussage aendert — auch nur im Wortlaut.
 *
 * Antworten gehoeren zu genau dem Satz, auf den sie gegeben wurden. Wer eine
 * Aussage umformuliert und die Zahl stehen laesst, verrechnet alte Antworten
 * mit neuen Fragen. `tests/profil-items.test.ts` haelt dafuer eine Pruefsumme
 * ueber alle Wortlaute fest.
 */
export const ITEMSATZ = 1;

/** Die sechs Strategie-Skalen, in der Reihenfolge der Ergebnisseite. */
export const SKALEN = [
  'ordnen',
  'verknuepfen',
  'abrufen',
  'steuern',
  'dranbleiben',
  'zeiteinteilen',
] as const;
export type Skala = (typeof SKALEN)[number];

/**
 * Die vier Lernmuster nach Vermunt.
 *
 * Der Bezeichner IST das Wort, das auf der Ergebnisseite steht — alle vier
 * kommen ohne Umlaut aus. Die Reihenfolge entscheidet bei gleichem Mittel,
 * welches Muster zuerst genannt wird (siehe `lernmusterAus`).
 */
export const MUSTER = [
  'bedeutungsorientiert',
  'reproduktionsorientiert',
  'anwendungsorientiert',
  'ungerichtet',
] as const;
export type Muster = (typeof MUSTER)[number];

export type Dimension = Skala | Muster;

export const SKALA_TEXT: Readonly<Record<Skala, string>> = {
  ordnen: 'Ordnen',
  verknuepfen: 'Verknüpfen',
  abrufen: 'Abrufen',
  steuern: 'Steuern',
  dranbleiben: 'Dranbleiben',
  zeiteinteilen: 'Zeit einteilen',
};

/** Fuenf Stufen. Die Enden stehen im Spec, die drei mittleren sind die uebliche Reihe. */
export const STUFEN = [1, 2, 3, 4, 5] as const;
export type Wert = (typeof STUFEN)[number];

export const STUFEN_TEXT: Readonly<Record<Wert, string>> = {
  1: 'trifft gar nicht zu',
  2: 'trifft eher nicht zu',
  3: 'teils, teils',
  4: 'trifft eher zu',
  5: 'trifft völlig zu',
};

export type Item = {
  readonly id: string;
  /** Die Skala oder das Muster, zu dem die Aussage zaehlt. */
  readonly dimension: Dimension;
  readonly text: string;
};

/**
 * Die 26 Aussagen: sechs Skalen zu je drei, vier Muster zu je zwei.
 *
 * „Abrufen" steht, wo LIST „Wiederholen" fuehrt — mit Absicht: Wiederlesen ist
 * die schwaechere Technik, sich abzufragen und zu verteilen die staerkere.
 */
export const ITEMS: readonly Item[] = [
  // Ordnen (kognitiv)
  { id: 'ord-1', dimension: 'ordnen', text: 'Ich mache mir eine eigene Gliederung oder Skizze, bevor ich Einzelheiten lerne.' },
  { id: 'ord-2', dimension: 'ordnen', text: 'Ich fasse einen Abschnitt in wenigen eigenen Sätzen zusammen.' },
  { id: 'ord-3', dimension: 'ordnen', text: 'Ich unterscheide beim Lesen, was Kernaussage ist und was Beispiel.' },
  // Verknuepfen (kognitiv)
  { id: 'ver-1', dimension: 'verknuepfen', text: 'Ich überlege, wo mir das Gelernte im Beruf schon begegnet ist.' },
  { id: 'ver-2', dimension: 'verknuepfen', text: 'Ich suche nach eigenen Beispielen für eine Regel.' },
  { id: 'ver-3', dimension: 'verknuepfen', text: 'Ich frage mich, wie ein neuer Begriff mit dem zusammenhängt, was ich schon weiß.' },
  // Abrufen (kognitiv)
  { id: 'abr-1', dimension: 'abrufen', text: 'Ich prüfe mich selbst, ohne in die Unterlagen zu sehen.' },
  { id: 'abr-2', dimension: 'abrufen', text: 'Ich wiederhole Stoff über mehrere Tage verteilt statt am Stück.' },
  { id: 'abr-3', dimension: 'abrufen', text: 'Wenn ich etwas nicht abrufen kann, schlage ich nach und versuche es später noch einmal.' },
  // Steuern (metakognitiv)
  { id: 'ste-1', dimension: 'steuern', text: 'Bevor ich anfange, lege ich fest, was ich in dieser Sitzung schaffen will.' },
  { id: 'ste-2', dimension: 'steuern', text: 'Ich merke beim Lernen, wenn ich etwas nur überflogen und nicht verstanden habe.' },
  { id: 'ste-3', dimension: 'steuern', text: 'Wenn eine Lernweise nicht trägt, ändere ich sie.' },
  // Dranbleiben (ressourcenbezogen)
  { id: 'dra-1', dimension: 'dranbleiben', text: 'Ich lerne auch dann weiter, wenn der Stoff zäh wird.' },
  { id: 'dra-2', dimension: 'dranbleiben', text: 'Beim Lernen schalte ich Ablenkungen bewusst ab.' },
  { id: 'dra-3', dimension: 'dranbleiben', text: 'Ich halte mich an Lernzeiten, die ich mir vorgenommen habe.' },
  // Zeit einteilen (ressourcenbezogen)
  { id: 'zei-1', dimension: 'zeiteinteilen', text: 'Ich weiß zu Wochenbeginn, wann ich lernen werde.' },
  { id: 'zei-2', dimension: 'zeiteinteilen', text: 'Vor einer Prüfung fange ich so früh an, dass am letzten Abend nichts Neues mehr ansteht.' },
  { id: 'zei-3', dimension: 'zeiteinteilen', text: 'Ich teile großen Stoff in Portionen, die in eine Sitzung passen.' },
  // bedeutungsorientiert
  { id: 'bed-1', dimension: 'bedeutungsorientiert', text: 'Ich will verstehen, warum etwas gilt, nicht nur, dass es gilt.' },
  { id: 'bed-2', dimension: 'bedeutungsorientiert', text: 'Ich bilde mir zu dem, was ich lese, ein eigenes Urteil.' },
  // reproduktionsorientiert
  { id: 'rep-1', dimension: 'reproduktionsorientiert', text: 'Ich lerne vor allem das, was voraussichtlich abgefragt wird.' },
  { id: 'rep-2', dimension: 'reproduktionsorientiert', text: 'Ich präge mir Definitionen und Aufzählungen möglichst wortgetreu ein.' },
  // anwendungsorientiert
  { id: 'anw-1', dimension: 'anwendungsorientiert', text: 'Mich interessiert an neuem Stoff zuerst, was ich damit praktisch anfangen kann.' },
  { id: 'anw-2', dimension: 'anwendungsorientiert', text: 'Ich merke mir Dinge am besten, wenn ich sie an einem echten Fall durchspiele.' },
  // ungerichtet
  { id: 'ung-1', dimension: 'ungerichtet', text: 'Ich weiß oft nicht, womit ich beim Lernen anfangen soll.' },
  { id: 'ung-2', dimension: 'ungerichtet', text: 'Ich bin unsicher, ob meine Art zu lernen die richtige ist.' },
];

/**
 * Die Reihenfolge, in der das Audit fragt: gemischt, aber bei jedem Aufruf und
 * in jedem Bau dieselbe.
 *
 * Gemischt, damit die Skalen nicht erkennbar blockweise kommen — wer drei
 * Aussagen zum Zeiteinteilen hintereinander liest, beantwortet ab der zweiten
 * die Skala und nicht mehr die Aussage. Deterministisch, damit ein
 * Zwischenstand nach dem Neuladen dieselben Gruppen wiederfindet.
 *
 * Die Saat haengt am Itemsatz: Ein neuer Satz mischt neu. Fuer Satz 1 ist
 * nachgerechnet, dass keine zwei Nachbarn zur selben Skala oder zum selben
 * Muster gehoeren; der Test haelt das fest.
 */
export const REIHENFOLGE: readonly Item[] = mischen(ITEMS, `profil-itemsatz-${ITEMSATZ}`);

/** „Gruppen zu je fuenf bis sechs": 6 + 5 + 5 + 5 + 5 = 26. */
export const GRUPPENGROESSEN = [6, 5, 5, 5, 5] as const;

/** Die gemischten Aussagen, in Gruppen geschnitten — eine Gruppe je Schritt des Audits. */
export const GRUPPEN: readonly (readonly Item[])[] = GRUPPENGROESSEN.map((groesse, i) => {
  const anfang = GRUPPENGROESSEN.slice(0, i).reduce((summe, g) => summe + g, 0);
  return REIHENFOLGE.slice(anfang, anfang + groesse);
});

export type Vorliebe = {
  readonly id: 'einstieg' | 'minuten' | 'text';
  readonly frage: string;
  readonly optionen: readonly { readonly wert: string | number; readonly text: string }[];
};

/**
 * Die drei Vorlieben. Sie heissen in der App „Vorliebe", nie „Lerntyp", und
 * steuern spaeter (Teil 3b) Voreinstellungen — kein Inhalt wird ihretwegen
 * vorenthalten. Welche Werte gespeichert werden duerfen, sagt `VorliebenSchema`
 * in `schema.ts`; ein Test haelt beide Listen deckungsgleich.
 */
export const VORLIEBEN: readonly Vorliebe[] = [
  {
    id: 'einstieg',
    frage: 'Womit steigst du lieber ein?',
    optionen: [
      { wert: 'ueberblick', text: 'Überblick zuerst' },
      { wert: 'beispiel', text: 'Beispiel zuerst' },
      { wert: 'egal', text: 'egal' },
    ],
  },
  {
    id: 'minuten',
    frage: 'Wie lang darf eine Sitzung sein?',
    optionen: [
      { wert: 5, text: '5 Minuten' },
      { wert: 10, text: '10 Minuten' },
      { wert: 20, text: '20 Minuten' },
    ],
  },
  {
    id: 'text',
    frage: 'Was liest du lieber?',
    optionen: [
      { wert: 'stichpunkte', text: 'knappe Stichpunkte' },
      { wert: 'absaetze', text: 'ausformulierte Absätze' },
      { wert: 'egal', text: 'egal' },
    ],
  },
];
