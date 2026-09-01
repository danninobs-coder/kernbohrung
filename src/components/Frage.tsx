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
  const [gewaehlt, setGewaehlt] = useState<number | null>(null);
  const beantwortet = gewaehlt !== null;

  function zustandVon(antwort: Antwort, index: number): Zustand {
    if (!beantwortet) return 'offen';
    if (antwort.richtig) return 'richtig';
    if (index === gewaehlt) return 'falsch';
    return 'neutral';
  }

  return (
    <div className="frage" data-beantwortet={beantwortet}>
      <p className="frage-text">{frage}</p>
      <ul className="antworten">
        {gemischt.map((antwort, index) => (
          <li key={antwort.text}>
            <button
              type="button"
              className="antwort"
              data-zustand={zustandVon(antwort, index)}
              disabled={beantwortet}
              onClick={() => setGewaehlt(index)}
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
