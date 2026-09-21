import { useMemo, useState } from 'react';
import { mischen } from '../../lib/mischen';
import type { TypProps } from '../vertrag';
import { bewerteWahl } from './bewerten';
import type { Antwort, Wahl as WahlAufgabe } from './schema';

type Zustand = 'offen' | 'gewaehlt' | 'richtig' | 'falsch' | 'neutral';

/**
 * Die Wahlaufgabe: Antwort antippen, fertig.
 *
 * Die Bewertung reist mit der Abgabe. Sie steht mit dem Antippen fest; die
 * Huelle haelt sie zurueck, bis die Zuversicht gewaehlt ist. Bis dahin ist die
 * Wahl widerruflich — jedes weitere Antippen ist eine neue Abgabe.
 */
export default function Wahl({ aufgabe, phase, onAbgegeben, ergebnissatz }: TypProps<WahlAufgabe>) {
  const gemischt = useMemo(
    () => mischen(aufgabe.antworten, aufgabe.id),
    [aufgabe.antworten, aufgabe.id],
  );
  // Gemerkt wird die Antwort selbst, nicht ihre Position. Eine Position gilt
  // nur fuer genau die Reihenfolge, in der sie entstanden ist: liefert das
  // Elternteil dieselben Antworten spaeter umsortiert, zeigt der Index auf
  // eine andere Antwort, und die Ansicht behauptet eine Wahl, die niemand
  // getroffen hat - lautlos, ohne Fehler oder Warnung. Die Objektidentitaet
  // ueberlebt jede Umsortierung.
  const [gewaehlt, setGewaehlt] = useState<Antwort | null>(null);
  const aufgeloest = phase === 'aufgeloest';

  function waehle(antwort: Antwort): void {
    if (phase === 'zuversicht' || aufgeloest) return;
    setGewaehlt(antwort);
    onAbgegeben({ antwort: antwort.text, ergebnis: bewerteWahl(aufgabe, antwort.text) });
  }

  function zustandVon(antwort: Antwort): Zustand {
    if (!aufgeloest) return antwort === gewaehlt ? 'gewaehlt' : 'offen';
    if (antwort.richtig) return 'richtig';
    if (antwort === gewaehlt) return 'falsch';
    return 'neutral';
  }

  return (
    <>
      <p className="frage-text">{aufgabe.frage}</p>
      {ergebnissatz}
      <ul className="antworten">
        {gemischt.map((antwort) => (
          // Der Text taugt als key, weil das Schema doppelte Antworttexte
          // innerhalb einer Aufgabe zurueckweist (normalisiert verglichen).
          // Faellt diese Regel, faellt auch dieser key.
          <li key={antwort.text}>
            <button
              type="button"
              className="antwort"
              data-zustand={zustandVon(antwort)}
              // Die Wahl ist bis zur Zuversicht widerruflich, also ist sie ein
              // Schaltzustand und kein abgeschickter Wert. `aria-pressed` sagt
              // ihn genau dort an, wo der Fokus in diesem Moment steht.
              aria-pressed={antwort === gewaehlt}
              disabled={aufgeloest}
              onClick={() => waehle(antwort)}
            >
              {antwort.text}
            </button>
            {/* Farbe allein traegt die Aufloesung nicht (WCAG 1.4.1). Die
                Marke steht ausserhalb des Knopfes: In ihm wuerde sie seinen
                zugaenglichen Namen aendern, und dieselbe Antwort hiesse vor
                und nach der Aufloesung anders. */}
            {aufgeloest && markeZu(antwort, gewaehlt) !== null && (
              <p className="antwort-marke">{markeZu(antwort, gewaehlt)}</p>
            )}
            {aufgeloest && <p className="begruendung">{antwort.begruendung}</p>}
          </li>
        ))}
      </ul>
    </>
  );
}

/** Die Textmarke an einer Antwort, sobald aufgeloest ist. */
function markeZu(antwort: Antwort, gewaehlt: Antwort | null): string | null {
  const eigene = antwort === gewaehlt;
  if (antwort.richtig) return eigene ? 'richtig · deine Wahl' : 'richtig';
  return eigene ? 'deine Wahl' : null;
}
