import type { Ergebnis } from '../vertrag.ts';
import type { Reihenfolge } from './schema.ts';

/**
 * Bewertet eine abgegebene Folge. Rein.
 *
 * `folge[i]` ist der Index des Schritts, der an Stelle i steht. Richtig ist
 * die Folge 0, 1, 2, … Die Antwort nennt die Folge 1-basiert, damit sie sich
 * in der Historie lesen laesst; das Merkmal ist bei einem Fehlgriff dieselbe
 * Folge — welche Verdrehung jemanden faengt.
 *
 * Der Anteil misst Positionstreue, nicht relative Ordnung: Eine fast richtige,
 * um eine Stelle verschobene Folge faellt auf 0. Das ist bekannt und bleibt,
 * solange der Anteil nicht in die Terminplanung eingeht — `antwort` haelt die
 * ganze Folge fest, ein besseres Mass laesst sich spaeter aus der Historie
 * rechnen. Der Nenner ist die groessere der beiden Laengen: Sonst rettete
 * angehaengter Muell den Anteil einer falschen Abgabe auf 1.
 */
export function bewerteReihenfolge(aufgabe: Reihenfolge, folge: readonly number[]): Ergebnis {
  const anzahl = aufgabe.schritte.length;
  const treffer = aufgabe.schritte.filter((_, i) => folge[i] === i).length;
  const richtig = folge.length === anzahl && treffer === anzahl;
  const antwort = folge.map((i) => i + 1).join(',');
  return { richtig, anteil: treffer / Math.max(folge.length, anzahl), antwort, merkmal: richtig ? '' : antwort };
}
