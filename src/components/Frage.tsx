import { useMemo, useState } from 'react';
import { mischen } from '../lib/mischen';

export type Antwort = {
  text: string;
  richtig: boolean;
  begruendung: string;
};

export type FrageProps = {
  id: string;
  frage: string;
  antworten: Antwort[];
};

type Zustand = 'offen' | 'richtig' | 'falsch' | 'neutral';

export default function Frage({ id, frage, antworten }: FrageProps) {
  const gemischt = useMemo(() => mischen(antworten, id), [antworten, id]);
  // Gemerkt wird die Antwort selbst, nicht ihre Position. Eine Position gilt
  // nur fuer genau die Reihenfolge, in der sie entstanden ist: liefert das
  // Elternteil dieselben Antworten spaeter umsortiert, zeigt der Index auf
  // eine andere Antwort, und die Ansicht behauptet eine Wahl, die der Nutzer
  // nie getroffen hat - lautlos, ohne Fehler oder Warnung. Die Objektidentitaet
  // ueberlebt jede Umsortierung.
  const [gewaehlt, setGewaehlt] = useState<Antwort | null>(null);
  const beantwortet = gewaehlt !== null;

  function zustandVon(antwort: Antwort): Zustand {
    if (!beantwortet) return 'offen';
    if (antwort.richtig) return 'richtig';
    if (antwort === gewaehlt) return 'falsch';
    return 'neutral';
  }

  return (
    <div className="frage" data-beantwortet={beantwortet}>
      <p className="frage-text">{frage}</p>
      <ul className="antworten">
        {gemischt.map((antwort) => (
          // Der Text taugt als key, weil das Lektions-Schema doppelte
          // Antworttexte innerhalb einer Frage zurueckweist (normalisiert
          // verglichen). Faellt diese Regel, faellt auch dieser key.
          <li key={antwort.text}>
            <button
              type="button"
              className="antwort"
              data-zustand={zustandVon(antwort)}
              disabled={beantwortet}
              onClick={() => setGewaehlt(antwort)}
            >
              {antwort.text}
            </button>
            {beantwortet && <p className="begruendung">{antwort.begruendung}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
