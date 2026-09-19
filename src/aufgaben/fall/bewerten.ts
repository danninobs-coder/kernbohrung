import type { Ergebnis } from '../vertrag.ts';
import type { Fall } from './schema.ts';

/**
 * Bewertet einen Fall aus den abgehakten Pruefpunkten. Rein.
 *
 * `richtig` haengt NUR an den wesentlichen Punkten. Der Anteil zaehlt alle.
 * Das Merkmal nennt die fehlenden wesentlichen Punkte als 1-basierte Nummern
 * in fester Reihenfolge — das ist die Auskunft, welcher Punkt jemanden immer
 * wieder faengt. Bekannte Schwaeche: Selbstbewertung ist nachsichtig. Das ist
 * der Preis fuer offline und kostenlos; eine spaetere KI-Rueckmeldung prueft
 * gegen dieselben Pruefpunkte.
 */
export function bewerteFall(aufgabe: Fall, text: string, haken: readonly boolean[]): Ergebnis {
  const gehabt = aufgabe.pruefpunkte.map((_, i) => haken[i] === true);
  const fehlend = aufgabe.pruefpunkte.flatMap((punkt, i) =>
    punkt.pflicht && !gehabt[i] ? [i + 1] : [],
  );
  const richtig = fehlend.length === 0;
  return {
    richtig,
    anteil: gehabt.filter(Boolean).length / aufgabe.pruefpunkte.length,
    antwort: text,
    merkmal: richtig ? '' : `fehlt:${fehlend.join(',')}`,
  };
}
