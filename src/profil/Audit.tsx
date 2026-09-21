import type { ReactNode } from 'react';

export type WahlfrageProps<W extends string | number> = {
  /** Eindeutig je Frage — wird zum `name` der Radiogruppe. */
  name: string;
  frage: string;
  optionen: readonly { readonly wert: W; readonly text: string; readonly kurz?: string }[];
  gewaehlt: W | undefined;
  beiWahl: (wert: W) => void;
  /** Zusatzklasse fuer die Anordnung: `skala` nebeneinander, `liste` untereinander. */
  klasse: 'skala' | 'liste';
  /** Steht unter den Feldern, etwa die Enden einer Skala. */
  fuss?: ReactNode;
};

/**
 * Eine Frage mit Einfachwahl — fuer die Aussagen wie fuer die Vorlieben.
 *
 * Echte Radiofelder und kein `role="group"` aus Knoepfen wie bei der
 * Zuversicht: Dort loest jeder Druck sofort etwas aus, hier wird eine Wahl
 * getroffen, die stehen bleibt und sich aendern laesst. Genau das ist ein
 * Radiofeld, und es bringt die Tastatur mit: ein Tabstopp je Frage, Pfeiltasten
 * wechseln die Wahl. Bei bis zu sechs Aussagen zu je fuenf Stufen waeren
 * Knoepfe dreissig Tabstopps je Gruppe.
 *
 * `fieldset` und `legend` ergeben von selbst eine Gruppe mit der Frage als
 * Namen. Der Name jedes Feldes steht in `aria-label`, weil auf der Skala nur
 * die Zahl sichtbar ist — vorgelesen wird „4 — trifft eher zu".
 */
export function Wahlfrage<W extends string | number>({
  name,
  frage,
  optionen,
  gewaehlt,
  beiWahl,
  klasse,
  fuss,
}: WahlfrageProps<W>) {
  return (
    <fieldset className={`wahlfrage ${klasse}`}>
      <legend>{frage}</legend>
      <div className="wahlfelder">
        {optionen.map((option) => (
          <label key={String(option.wert)} className="wahlfeld" data-gewaehlt={option.wert === gewaehlt}>
            <input
              type="radio"
              name={name}
              value={String(option.wert)}
              aria-label={option.text}
              checked={option.wert === gewaehlt}
              onChange={() => beiWahl(option.wert)}
            />
            <span aria-hidden="true">{option.kurz ?? option.text}</span>
          </label>
        ))}
      </div>
      {fuss}
    </fieldset>
  );
}
