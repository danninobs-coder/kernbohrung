import type { Ergebnis } from '../vertrag.ts';
import type { Zuordnen } from './schema.ts';

/**
 * Bewertet eine Zuordnung. Rein.
 *
 * `zuordnung` liegt in der Reihenfolge von `aufgabe.paare`: an Stelle i steht
 * der rechte Eintrag, den die lernende Person dem i-ten linken gegeben hat,
 * oder `null`. Die Antwort nennt alle Paare, das Merkmal nur die falschen —
 * welche Verwechslung jemanden faengt, ist die Auskunft.
 *
 * Die Trennzeichen `→` und `;` kommen in den Eintraegen nicht vor — das
 * Schema weist sie zurueck —, die Zeichenketten lassen sich deshalb eindeutig
 * zerlegen.
 */
export function bewerteZuordnen(
  aufgabe: Zuordnen,
  zuordnung: readonly (string | null)[],
): Ergebnis {
  const paare = aufgabe.paare.map((paar, i) => ({
    links: paar.links,
    soll: paar.rechts,
    ist: zuordnung[i] ?? null,
  }));
  const falsche = paare.filter((p) => p.ist !== p.soll);
  const alsText = (liste: typeof paare): string =>
    liste.map((p) => `${p.links}→${p.ist ?? ''}`).join(';');
  const richtig = falsche.length === 0;
  return {
    richtig,
    anteil: (paare.length - falsche.length) / paare.length,
    antwort: alsText(paare),
    merkmal: richtig ? '' : alsText(falsche),
  };
}
