import { useEffect, useMemo, useRef, useState } from 'react';
import { mischen } from '../../lib/mischen';
import type { TypProps } from '../vertrag';
import { bewerteZuordnen } from './bewerten';
import type { Zuordnen as ZuordnenAufgabe } from './schema';

/**
 * Zuordnen: linken Eintrag antippen, darunter klappen die rechten auf, einen
 * antippen — das Paar steht.
 *
 * Einspaltig, und das ist Absicht: Zwei Spalten haetten auf einem Handy mit
 * 375 Pixeln je rund 135 Pixel, zu schmal fuer ein Wort wie
 * „Selbstkostenerstattungsvertrag". Und kein Ziehen: Drag-and-drop ist auf
 * Android in einer Seite unzuverlaessig und schliesst Tastatur und
 * Screenreader aus.
 */
export default function Zuordnen({ aufgabe, phase, onAbgegeben, ergebnissatz }: TypProps<ZuordnenAufgabe>) {
  const rechteSeite = useMemo(
    () => mischen([...aufgabe.paare.map((paar) => paar.rechts), ...aufgabe.ablenker], aufgabe.id),
    [aufgabe.paare, aufgabe.ablenker, aufgabe.id],
  );
  // An Stelle i steht, was dem i-ten linken Eintrag zugeordnet ist.
  const [zuordnung, setZuordnung] = useState<(string | null)[]>(() => aufgabe.paare.map(() => null));
  const [aktiv, setAktiv] = useState<number | null>(null);
  const linke = useRef<(HTMLButtonElement | null)[]>([]);
  const ersteOption = useRef<HTMLButtonElement | null>(null);

  const offen = phase === 'offen';
  const aufgeloest = phase === 'aufgeloest';
  const vollstaendig = zuordnung.every((eintrag) => eintrag !== null);
  // Die erste noch freie rechte Seite bekommt beim Aufklappen den Fokus.
  const ersteFreie = rechteSeite.find((rechts) => !zuordnung.includes(rechts));

  // Der Fokus folgt dem Aufklappen. Sonst laege die Auswahl fuer die Tastatur
  // hinter allen uebrigen linken Eintraegen.
  useEffect(() => {
    if (aktiv !== null) ersteOption.current?.focus();
  }, [aktiv]);

  // Verlaesst die Aufgabe die Phase 'offen' (Abgabe oder Aufloesung), klappt
  // eine noch offene Auswahl zu - sonst bliebe ein bedienbar wirkender, aber
  // wirkungsloser Knopf stehen.
  useEffect(() => {
    if (!offen) setAktiv(null);
  }, [offen]);

  // Invariante: Ist ein Eintrag aktiv, hat er kein Paar - aktiv wird nur, was
  // gerade frei ist oder frei wird.
  function oeffne(stelle: number): void {
    if (!offen) return;
    // Ein bestehendes Paar antippen loest es und klappt die Auswahl wieder auf.
    if (zuordnung[stelle] !== null) {
      setZuordnung((alt) => alt.map((eintrag, i) => (i === stelle ? null : eintrag)));
      setAktiv(stelle);
      return;
    }
    setAktiv((alt) => (alt === stelle ? null : stelle));
  }

  function ordneZu(stelle: number, rechts: string): void {
    if (!offen) return;
    setZuordnung((alt) => alt.map((eintrag, i) => (i === stelle ? rechts : eintrag)));
    setAktiv(null);
    // Die Auswahl verschwindet mitsamt dem Knopf, auf dem der Fokus stand.
    linke.current[stelle]?.focus();
  }

  function gibAb(): void {
    if (!offen || !vollstaendig) return;
    const ergebnis = bewerteZuordnen(aufgabe, zuordnung);
    onAbgegeben({ antwort: ergebnis.antwort, ergebnis });
  }

  return (
    <>
      <p className="frage-text">{aufgabe.aufgabe}</p>
      {ergebnissatz}
      <ul className="zuordnen-liste">
        {aufgabe.paare.map((paar, stelle) => {
          const gewaehlt = zuordnung[stelle];
          const stimmt = gewaehlt === paar.rechts;
          return (
            <li
              key={paar.links}
              className="zuordnen-zeile"
              data-zustand={aufgeloest ? (stimmt ? 'richtig' : 'falsch') : undefined}
            >
              <button
                type="button"
                className="zuordnen-links"
                aria-expanded={aktiv === stelle}
                disabled={!offen}
                ref={(element) => {
                  linke.current[stelle] = element;
                }}
                onClick={() => oeffne(stelle)}
              >
                <span className="zuordnen-begriff">{paar.links}</span>
                <span className="zuordnen-wahl">{gewaehlt ?? 'noch nichts zugeordnet'}</span>
              </button>

              {aktiv === stelle && (
                <ul className="zuordnen-optionen" role="group" aria-label={`Zuordnung für ${paar.links}`}>
                  {rechteSeite.map((rechts) => {
                    const vergeben = zuordnung.includes(rechts);
                    return (
                      <li key={rechts}>
                        <button
                          type="button"
                          className="zuordnen-option"
                          disabled={vergeben || !offen}
                          ref={rechts === ersteFreie ? ersteOption : undefined}
                          onClick={() => ordneZu(stelle, rechts)}
                        >
                          {rechts}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              {aufgeloest && (
                <p className="antwort-marke">{stimmt ? 'richtig' : `richtig wäre: ${paar.rechts}`}</p>
              )}
            </li>
          );
        })}
      </ul>

      {offen && (
        <button type="button" className="abgeben" disabled={!vollstaendig} onClick={gibAb}>
          Abgeben
        </button>
      )}
    </>
  );
}
