import type { ReactNode } from 'react';

/**
 * Der Vertrag zwischen einem Aufgabentyp und der Huelle.
 *
 * Die Huelle (`src/components/Aufgabe.tsx`) kennt keinen Typ. Sie kennt nur
 * diese Datei: eine Abgabe, ein Ergebnis, vier Phasen. Alles, was einen Typ
 * ausmacht — wie er aussieht, wie man ihn bedient, wie er bewertet —, bleibt
 * in seinem Ordner.
 *
 * Bewusst ohne Laufzeitabhaengigkeit: Der einzige Import ist ein Typ und wird
 * beim Uebersetzen geloescht. Die `bewerten.ts` jedes Typs importiert von hier
 * und muss unter reinem Node ladbar bleiben.
 */

export type Ergebnis = {
  /** Fuer Planer und Kalibrierung. Bleibt binaer, auch bei Teilergebnissen. */
  readonly richtig: boolean;
  /** 0 bis 1. Wird gespeichert, aber noch nicht in die Terminplanung eingerechnet. */
  readonly anteil: number;
  /** Was die lernende Person getan hat, als Text. */
  readonly antwort: string;
  /** Schluessel, unter dem sich Fehlgriffe gruppieren lassen. Leer bei einem Treffer. */
  readonly merkmal: string;
};

export type Abgabe = {
  readonly antwort: string;
  /**
   * Die fertige Bewertung — oder `null`, wenn sie erst NACH der Zuversicht
   * feststehen kann. Das ist nur bei `fall` so: Dort werden die Pruefpunkte
   * erst abgehakt, nachdem die eigene Sicherheit angegeben ist. Wer die
   * Pruefpunkte vorher sieht, schaetzt nicht sein Wissen ein, sondern liest ab.
   */
  readonly ergebnis: Ergebnis | null;
};

/**
 * `offen` -> arbeiten, `abgegeben` -> Zuversicht waehlen, `zuversicht` ->
 * Bewertung nachreichen (nur `fall`), `aufgeloest` -> fertig.
 */
export type AufgabenPhase = 'offen' | 'abgegeben' | 'zuversicht' | 'aufgeloest';

export type TypProps<A> = {
  readonly aufgabe: A;
  readonly phase: AufgabenPhase;
  /** Die Festlegung. Darf mehrfach kommen, solange die Zuversicht aussteht. */
  readonly onAbgegeben: (abgabe: Abgabe) => void;
  /** Die nachgereichte Bewertung. Nur Typen, deren Abgabe `ergebnis: null` trug. */
  readonly onErgebnis: (ergebnis: Ergebnis) => void;
  /**
   * Der Ergebnissatz der Huelle. Der Typ stellt ihn zwischen Aufgabentext und
   * Bedienflaeche: Er ist die Ueberschrift der Aufloesung, die Einzelheiten
   * darunter sind ihre Erlaeuterung. Wer ihn unten anhaengt, laesst erst alle
   * Einzelheiten vorlesen und sagt danach, ob es ueberhaupt gestimmt hat.
   */
  readonly ergebnissatz?: ReactNode;
};
