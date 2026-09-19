import { mischen } from '../../lib/mischen.ts';

/**
 * Die Folge, in der die Schritte anfangs dastehen — als Indizes in `schritte`.
 *
 * Gemischt mit der Aufgaben-Id als Saat: gleiche Aufgabe, gleiche Anfangsfolge,
 * ueber Builds und Geraete hinweg. Trifft das Mischen zufaellig die richtige
 * Folge, wird um eine Stelle rotiert — sonst stuende die Loesung schon da und
 * "Abgeben" waere die ganze Aufgabe. Das ist eine Eigenschaft der Darstellung
 * und steht deshalb hier, nicht im Schema.
 */
export function startfolge(anzahl: number, saat: string): number[] {
  const gemischt = mischen(
    Array.from({ length: anzahl }, (_, i) => i),
    saat,
  );
  const schonRichtig = gemischt.every((wert, i) => wert === i);
  return schonRichtig ? [...gemischt.slice(1), gemischt[0]] : gemischt;
}
