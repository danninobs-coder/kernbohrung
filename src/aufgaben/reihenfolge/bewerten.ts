import type { Ergebnis } from '../vertrag.ts';
import type { Reihenfolge } from './schema.ts';

/**
 * Bewertet eine abgegebene Folge. Rein.
 *
 * `folge[i]` ist der Index des Schritts, der an Stelle i steht. Richtig ist
 * die Folge 0, 1, 2, … Die Antwort nennt die Folge 1-basiert, damit sie sich
 * in der Historie lesen laesst; das Merkmal ist bei einem Fehlgriff dieselbe
 * Folge — welche Verdrehung jemanden faengt.
 */
export function bewerteReihenfolge(aufgabe: Reihenfolge, folge: readonly number[]): Ergebnis {
  const anzahl = aufgabe.schritte.length;
  const treffer = aufgabe.schritte.filter((_, i) => folge[i] === i).length;
  const richtig = folge.length === anzahl && treffer === anzahl;
  const antwort = folge.map((i) => i + 1).join(',');
  return { richtig, anteil: treffer / anzahl, antwort, merkmal: richtig ? '' : antwort };
}
