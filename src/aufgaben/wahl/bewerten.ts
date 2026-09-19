import type { Ergebnis } from '../vertrag.ts';
import type { Wahl } from './schema.ts';

/**
 * Bewertet eine Wahl. Rein, ohne React, ohne Speicher.
 *
 * Das Merkmal ist bei einem Fehlgriff der gewaehlte Text: Welche Gegenposition
 * jemanden faengt, ist die eigentliche Auskunft — nicht nur, dass er danebenlag.
 * Ein unbekannter Text gilt als falsch. Die Komponente reicht nur Texte aus der
 * Aufgabe herein; eine reine Funktion soll trotzdem nie werfen.
 */
export function bewerteWahl(aufgabe: Wahl, gewaehlterText: string): Ergebnis {
  const richtig = aufgabe.antworten.some((a) => a.text === gewaehlterText && a.richtig);
  return {
    richtig,
    anteil: richtig ? 1 : 0,
    antwort: gewaehlterText,
    merkmal: richtig ? '' : gewaehlterText,
  };
}
