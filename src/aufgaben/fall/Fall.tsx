import { useEffect, useRef, useState } from 'react';
import type { TypProps } from '../vertrag';
import { bewerteFall } from './bewerten';
import type { Fall as FallAufgabe } from './schema';

/**
 * Hoechstlaenge der geschriebenen Loesung. Der Groessenwaechter im
 * Speichertest rechnet damit — gezaehlt werden UTF-16-Einheiten (wie
 * `maxLength` es tut), der Waechter selbst mit drei Byte je Einheit im
 * teuersten Fall.
 */
export const HOECHSTLAENGE = 2000;

/** Absaetze, durch Leerzeile getrennt. Kein Markdown — siehe `schema.ts`. */
export function absaetze(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((absatz) => absatz.trim())
    .filter((absatz) => absatz.length > 0);
}

/**
 * Der Fall: lesen, frei schreiben, abgeben — und erst NACH der Zuversicht
 * gegen die Pruefpunkte abhaken.
 *
 * Die Reihenfolge ist der Kern dieses Typs und der einzige Grund, warum der
 * Vertrag zwei Rueckrufe kennt. Die Abgabe traegt deshalb `ergebnis: null`;
 * die Bewertung kommt ueber `onErgebnis`, wenn die Huelle die Phase
 * `zuversicht` gesetzt hat und die Pruefpunkte abgehakt sind.
 */
export default function Fall({ aufgabe, phase, onAbgegeben, onErgebnis, ergebnissatz }: TypProps<FallAufgabe>) {
  const [text, setText] = useState('');
  const [haken, setHaken] = useState<boolean[]>(() => aufgabe.pruefpunkte.map(() => false));
  const legende = useRef<HTMLLegendElement>(null);
  // Ref statt State: Zwischen den beiden Klicks eines Doppelklicks liegt kein
  // Render-Zyklus, in dem ein aktualisierter State-Wert schon gelesen werden
  // koennte — ein `useState`-Flag waere beim zweiten Klick noch auf dem alten
  // Stand. Der Ref gilt sofort und synchron mit der ersten Zuweisung.
  const gemeldet = useRef(false);

  const eingabeId = `${aufgabe.id}-loesung`;
  const pruefen = phase === 'zuversicht';
  const aufgeloest = phase === 'aufgeloest';

  // Der Zuversichtsblock ist in diesem Moment verschwunden, mitsamt dem Knopf,
  // auf dem der Fokus stand. Ein entfernter Fokus faellt auf <body>: Der
  // Screenreader verstummt, und die Tastatur faengt oben auf der Seite neu an.
  useEffect(() => {
    if (pruefen) legende.current?.focus();
  }, [pruefen]);

  function gibAb(): void {
    if (phase !== 'offen' || text.trim() === '') return;
    onAbgegeben({ antwort: text, ergebnis: null });
  }

  function setze(stelle: number, wert: boolean): void {
    if (!pruefen) return;
    setHaken((alt) => alt.map((h, i) => (i === stelle ? wert : h)));
  }

  function fertig(): void {
    // `gemeldet` sperrt einen zweiten Aufruf, z. B. durch einen Doppelklick:
    // Die Phase aendert sich zwischen den beiden Klicks nicht, die Huelle
    // wuerde das Ergebnis sonst zweimal aufzeichnen.
    if (!pruefen || gemeldet.current) return;
    gemeldet.current = true;
    onErgebnis(bewerteFall(aufgabe, text, haken));
  }

  return (
    <>
      <div className="fall-sachverhalt">
        {/* Index als key statt des Absatztexts: Die Liste ist statisch (kommt
            unveraendert aus der Aufgabe und wird nie umsortiert), deshalb ist
            der Index hier unbedenklich — anders als bei einer Liste, die sich
            aendern oder umsortieren koennte. Der Text selbst taugt nicht als
            key, weil zwei Absaetze denselben Wortlaut haben koennen. */}
        {absaetze(aufgabe.sachverhalt).map((absatz, i) => (
          <p key={i}>{absatz}</p>
        ))}
      </div>
      <p className="frage-text">{aufgabe.aufgabe}</p>
      {ergebnissatz}

      <label className="fall-beschriftung" htmlFor={eingabeId}>
        Deine Lösung
      </label>
      <textarea
        id={eingabeId}
        className="fall-eingabe"
        maxLength={HOECHSTLAENGE}
        readOnly={phase !== 'offen'}
        value={text}
        onChange={(ereignis) => setText(ereignis.target.value)}
      />
      <p className="fall-zaehler">
        {text.length} / {HOECHSTLAENGE}
      </p>

      {phase === 'offen' && (
        <button type="button" className="abgeben" disabled={text.trim() === ''} onClick={gibAb}>
          Abgeben
        </button>
      )}

      {(pruefen || aufgeloest) && (
        <fieldset className="pruefpunkte">
          <legend ref={legende} tabIndex={-1}>
            Was davon steht in deiner Lösung?
          </legend>
          {aufgabe.pruefpunkte.map((punkt, i) => (
            <label
              key={punkt.text}
              className="pruefpunkt"
              data-zustand={aufgeloest ? (haken[i] ? 'gehabt' : punkt.pflicht ? 'fehlt' : 'offen') : undefined}
            >
              <input
                type="checkbox"
                checked={haken[i] ?? false}
                disabled={aufgeloest}
                onChange={(ereignis) => setze(i, ereignis.target.checked)}
              />
              <span className="pruefpunkt-text">{punkt.text}</span>
              {/* Die Marke erst NACH dem Abschluss: Vorher verriete sie, welche
                  Haken ueber richtig und falsch entscheiden. */}
              {aufgeloest && punkt.pflicht && (
                <span className="pruefpunkt-marke">{haken[i] ? 'wesentlich' : 'wesentlich · fehlte'}</span>
              )}
            </label>
          ))}
          {pruefen && (
            <button type="button" className="abgeben" onClick={fertig}>
              Fertig
            </button>
          )}
        </fieldset>
      )}

      {aufgeloest && aufgabe.musterloesung !== undefined && (
        <div className="musterloesung">
          <h3>Musterlösung</h3>
          {/* Index als key: gleiche Begruendung wie beim Sachverhalt oben —
              die Musterloesung ist eine statische, nie umsortierte Liste. */}
          {absaetze(aufgabe.musterloesung).map((absatz, i) => (
            <p key={i}>{absatz}</p>
          ))}
        </div>
      )}
    </>
  );
}
