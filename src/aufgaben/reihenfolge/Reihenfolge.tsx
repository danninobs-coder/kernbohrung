import { useEffect, useRef, useState } from 'react';
import type { TypProps } from '../vertrag';
import { bewerteReihenfolge } from './bewerten';
import type { Reihenfolge as ReihenfolgeAufgabe } from './schema';
import { startfolge } from './startfolge';

type Richtung = -1 | 1;
type Zug = { readonly schritt: number; readonly richtung: Richtung };

/**
 * Reihenfolge: Schritte mit zwei Knoepfen je Zeile nach oben und unten
 * schieben. Kein Ziehen — siehe `Zuordnen.tsx`.
 *
 * `folge[i]` ist der Index des Schritts an Stelle i. `key={schritt}` haelt
 * den DOM-Knoten eines Schritts stabil, statt ihn bei jedem Zug
 * umzubeschriften. Dass der Fokus beim Schritt bleibt, stellt der Effekt
 * unten sicher.
 */
export default function Reihenfolge({ aufgabe, phase, onAbgegeben, ergebnissatz }: TypProps<ReihenfolgeAufgabe>) {
  const [folge, setFolge] = useState<number[]>(() => startfolge(aufgabe.schritte.length, aufgabe.id));
  const [zug, setZug] = useState<Zug | null>(null);
  const knoepfe = useRef(new Map<string, HTMLButtonElement>());

  const offen = phase === 'offen';
  const aufgeloest = phase === 'aufgeloest';
  const allesRichtig = folge.every((schritt, stelle) => schritt === stelle);

  // Fuer die Live-Region unten: dieselbe Stelle, die der Fokus-Effekt auch
  // ermittelt, nur als Text statt als Fokusziel. Leer vor dem ersten Zug,
  // keine eigene Zustandsvariable noetig.
  const ansage =
    zug === null
      ? ''
      : `${aufgabe.schritte[zug.schritt]} steht jetzt an Stelle ${folge.indexOf(zug.schritt) + 1} von ${folge.length}.`;

  // Der Fokus bleibt beim bewegten Schritt. Steht er danach am Rand, ist der
  // eben gedrueckte Knopf gesperrt — und ein gesperrter Knopf haelt keinen
  // Fokus. Dann uebernimmt der Gegenknopf derselben Zeile.
  useEffect(() => {
    if (zug === null) return;
    const stelle = folge.indexOf(zug.schritt);
    const amRand = zug.richtung === -1 ? stelle === 0 : stelle === folge.length - 1;
    const richtung: Richtung = amRand ? (zug.richtung === -1 ? 1 : -1) : zug.richtung;
    knoepfe.current.get(`${zug.schritt}:${richtung}`)?.focus();
  }, [zug, folge]);

  function verschiebe(stelle: number, richtung: Richtung): void {
    const ziel = stelle + richtung;
    if (!offen || ziel < 0 || ziel >= folge.length) return;
    const neu = [...folge];
    [neu[stelle], neu[ziel]] = [neu[ziel], neu[stelle]];
    setFolge(neu);
    setZug({ schritt: folge[stelle], richtung });
  }

  function gibAb(): void {
    if (!offen) return;
    const ergebnis = bewerteReihenfolge(aufgabe, folge);
    onAbgegeben({ antwort: ergebnis.antwort, ergebnis });
  }

  function merke(schritt: number, richtung: Richtung) {
    return (element: HTMLButtonElement | null): void => {
      const schluessel = `${schritt}:${richtung}`;
      if (element) knoepfe.current.set(schluessel, element);
      else knoepfe.current.delete(schluessel);
    };
  }

  return (
    <>
      <p className="frage-text">{aufgabe.aufgabe}</p>
      {ergebnissatz}
      <ol className="reihenfolge-liste">
        {folge.map((schritt, stelle) => {
          const text = aufgabe.schritte[schritt];
          return (
            <li
              key={schritt}
              className="reihenfolge-zeile"
              data-zustand={aufgeloest ? (schritt === stelle ? 'richtig' : 'falsch') : undefined}
            >
              <span className="reihenfolge-text">{text}</span>
              <span className="reihenfolge-knoepfe">
                <button
                  type="button"
                  className="reihenfolge-knopf"
                  aria-label={`${text} nach oben`}
                  disabled={!offen || stelle === 0}
                  ref={merke(schritt, -1)}
                  onClick={() => verschiebe(stelle, -1)}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="reihenfolge-knopf"
                  aria-label={`${text} nach unten`}
                  disabled={!offen || stelle === folge.length - 1}
                  ref={merke(schritt, 1)}
                  onClick={() => verschiebe(stelle, 1)}
                >
                  ↓
                </button>
              </span>
              {aufgeloest && (
                <p className="antwort-marke">
                  {schritt === stelle ? 'richtig' : `gehört an Stelle ${schritt + 1}`}
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <div aria-live="polite" className="nur-vorlesen">
        {ansage}
      </div>

      {offen && (
        <button type="button" className="abgeben" onClick={gibAb}>
          Abgeben
        </button>
      )}

      {aufgeloest && !allesRichtig && (
        <div className="reihenfolge-loesung">
          <p className="antwort-marke">Richtige Reihenfolge</p>
          <ol>
            {aufgabe.schritte.map((schritt) => (
              <li key={schritt}>{schritt}</li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
