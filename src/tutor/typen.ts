/**
 * Der Vertrag zwischen Messung, Rechnung und Oberflaeche.
 *
 * Bewusst eine eigene Datei ohne Abhaengigkeiten: Sie wird von reinen
 * Rechenmodulen, von der Speicherschicht und von React-Inseln importiert.
 * Haengt hier etwas an ts-fsrs oder an idb, zieht das die ganze Kette mit.
 */

// Ein Typ, kein Wert: Die Zeile wird beim Uebersetzen geloescht. Diese Datei
// bleibt damit frei von Laufzeitabhaengigkeiten, wie ihr Kopfkommentar verlangt.
import type { AufgabenTyp } from '../aufgaben/schema';

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
 * Ein Ereignis je beantworteter Aufgabe. Unveraenderlich, nur angehaengt.
 *
 * `frage` ist die Kennung der Aufgabe. Der Name stammt aus der Zeit, als es
 * nur Wahlfragen gab, und bleibt: Er ist der Schluessel in `reife.ts`, in
 * `auswahl.ts` und im keyPath des Kartenspeichers. Ihn umzubenennen waere ein
 * Umbau des Speichers ohne Gewinn.
 *
 * `antwort` haelt fest, WAS jemand getan hat — den gewaehlten Text, die
 * geschriebene Loesung, die gebildeten Paare, die abgegebene Folge. `merkmal`
 * ist der Schluessel, unter dem sich Fehlgriffe gruppieren lassen, und bei
 * einem Treffer leer. Beides zu trennen ist kein Luxus: Bei einem Fall ist die
 * Antwort ein freier Text, den niemand zweimal gleich schreibt — gruppieren
 * laesst sich nur nach dem Pruefpunkt, der fehlte. Ohne `merkmal` liesse sich
 * nicht sagen, WELCHE Gegenposition jemanden faengt, und genau das ist das
 * Fehlermuster, auf das der Tutor reagiert.
 *
 * `anteil` wird gespeichert, aber noch nicht in die Terminplanung
 * eingerechnet. Ob drei von vier Paaren ein „Hard" oder ein „Again" sind, ist
 * mit Daten zu beantworten, nicht mit einer Annahme. Der Wert liegt dann vor.
 */
export type Ereignis = {
  readonly lektion: string;
  readonly frage: string;
  readonly typ: AufgabenTyp;
  readonly zuversicht: Zuversicht;
  readonly richtig: boolean;
  readonly anteil: number;
  readonly antwort: string;
  readonly merkmal: string;
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
