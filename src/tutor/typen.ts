/**
 * Der Vertrag zwischen Messung, Rechnung und Oberflaeche.
 *
 * Bewusst eine eigene Datei ohne Abhaengigkeiten: Sie wird von reinen
 * Rechenmodulen, von der Speicherschicht und von React-Inseln importiert.
 * Haengt hier etwas an ts-fsrs oder an idb, zieht das die ganze Kette mit.
 */

/**
 * Drei Stufen, nicht fuenf.
 *
 * Fuenf Stufen klingen praeziser und sind es bei kleinen Datenmengen nicht:
 * Die mittleren fuellen sich kaum, und ihre Trefferquote wird aus so wenigen
 * Beobachtungen geschaetzt, dass sie springt. Drei Stufen mit klar
 * verschiedenen Erwartungswerten tragen ab der ersten Woche.
 */
export type Zuversicht = 'sicher' | 'eher' | 'geraten';

/** Was die Stufe als Wahrscheinlichkeit behauptet. Grundlage der Kalibrierung. */
export const ZUVERSICHT_WERT: Record<Zuversicht, number> = {
  sicher: 0.9,
  eher: 0.65,
  geraten: 0.3,
};

export const ZUVERSICHT_TEXT: Record<Zuversicht, string> = {
  sicher: 'Sicher',
  eher: 'Eher schon',
  geraten: 'Geraten',
};

/** In dieser Reihenfolge erscheinen die Knoepfe. */
export const ZUVERSICHT_STUFEN: readonly Zuversicht[] = ['sicher', 'eher', 'geraten'];

/**
 * Ein Ereignis je beantworteter Frage. Unveraenderlich, nur angehaengt.
 *
 * `gewaehlt` haelt den Text der gewaehlten Antwort fest, nicht nur richtig oder
 * falsch. Ohne ihn laesst sich nicht sagen, WELCHE Gegenposition jemanden
 * faengt — und genau das ist das Fehlermuster, auf das der Tutor reagiert.
 */
export type Ereignis = {
  readonly lektion: string;
  readonly frage: string;
  readonly zuversicht: Zuversicht;
  readonly richtig: boolean;
  readonly gewaehlt: string;
  readonly dauerMs: number;
  readonly zeitpunkt: string;
};

/** Der Reifegrad eines Prinzips, wie ihn die Landkarte zeigt. */
export type Reife = 'unberuehrt' | 'frisch' | 'sitzt' | 'verblasst' | 'wackelt';

/**
 * Ab hier traegt eine eigene Parameterschaetzung.
 *
 * FSRS hat 21 Parameter. Es braucht einige hundert bis tausend Bewertungen,
 * bis eine eigene Schaetzung die Standardwerte schlaegt. 400 ist bewusst
 * konservativ: lieber laenger mit guten Standardwerten als frueh mit
 * ueberangepassten eigenen.
 *
 * Solange die Zahl nicht erreicht ist, zeigt die Landkarte, wie viele
 * Bewertungen noch fehlen — statt so zu tun, als sei bereits angepasst.
 */
export const BEWERTUNGEN_FUER_EIGENE_PARAMETER = 400;
