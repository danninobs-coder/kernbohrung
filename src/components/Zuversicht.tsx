import { useEffect, useRef } from 'react';
import {
  ZUVERSICHT_STUFEN,
  ZUVERSICHT_TEXT,
  ZUVERSICHT_WERT,
  type Zuversicht as Stufe,
} from '../tutor/typen';

/**
 * Der zweite Schritt einer Frage: die eigene Sicherheit angeben.
 *
 * Die Stufen, ihre Beschriftungen und ihre behaupteten Wahrscheinlichkeiten
 * kommen aus `typen.ts` und werden hier nicht noch einmal aufgeschrieben. Eine
 * vierte Stufe waere dort eine Zeile — und hier keine.
 *
 * Die Komponente kennt weder die Frage noch die Antwort. Sie meldet nur, was
 * gedrueckt wurde; was daraus folgt, entscheidet `Aufgabe.tsx`. Deshalb laesst
 * sie sich allein pruefen, und deshalb kann sie nichts kaputtmachen, was mit
 * dem Speicher zu tun hat.
 */
export type ZuversichtProps = {
  /**
   * Kennung der Frage, zu der dieser Schritt gehoert.
   *
   * Auf einer Lektionsseite stehen vier Fragen. Ohne Praefix traegt jede
   * dieselbe id fuer ihre Beschriftung, und `aria-labelledby` zeigt bei drei
   * von vier auf die Beschriftung einer fremden Frage — im Markup unsichtbar,
   * im Screenreader hoerbar.
   */
  id: string;
  /** Wird mit der gewaehlten Stufe aufgerufen. */
  beiWahl: (stufe: Stufe) => void;
  /**
   * Ob der Fokus beim Erscheinen auf die erste Stufe wandert.
   *
   * Voreingestellt ja, und das ist die bewusste Entscheidung dieser Datei.
   * Der Block erscheint als unmittelbare Folge eines Klicks und ist der
   * ZWANGSLAEUFIGE naechste Schritt: Ohne Stufe gibt es keine Aufloesung.
   * Wer den Fokus stehen liesse, wo er war — auf der eben gedrueckten Antwort
   * —, schickte die Tastaturbedienung erst durch die restlichen
   * Antwortknoepfe, bevor sie hier ankommt. Bei der letzten Antwort waere der
   * Weg kurz, bei der ersten drei Stationen lang. Das ist kein Randfall,
   * sondern der Normalfall fuer jeden, der nicht mit der Maus arbeitet.
   *
   * Der Fokuswechsel ist zugleich die Ansage: Screenreader lesen beim
   * Betreten einer `role="group"` deren Beschriftung vor, also „Wie sicher
   * bist du?" und dann „Sicher, behauptet 90 %". Ein zusaetzliches
   * `aria-live` waere hier kein Gewinn, sondern doppelte Rede — derselbe Text
   * einmal durch die Region und einmal durch den Fokus.
   *
   * Abschaltbar, damit ein Test den Block auch ohne Fokusdiebstahl ansehen
   * kann.
   */
  fokussieren?: boolean;
};

/** 0.9 wird zu „90 %". Eine Stelle, damit die Knoepfe nicht auseinanderlaufen. */
export function alsProzent(wert: number): string {
  return `${Math.round(wert * 100)} %`;
}

export default function Zuversicht({ id, beiWahl, fokussieren = true }: ZuversichtProps) {
  const erste = useRef<HTMLButtonElement>(null);
  const beschriftung = `${id}-zuversicht-frage`;

  useEffect(() => {
    if (fokussieren) erste.current?.focus();
  }, [fokussieren]);

  return (
    // `role="group"` und nicht `radiogroup`: Eine Radiogruppe waere eine
    // Vorauswahl, die man erst bestaetigt — hier loest jeder Druck sofort
    // aus. Und sie haette einen einzigen Tabstopp mit Pfeiltastenbedienung;
    // die drei Knoepfe stehen aber neben Antwortknoepfen, die ebenfalls
    // einzeln angetabbt werden. Zwei Tastaturmodelle in einer Karte sind
    // schlechter als ein einfaches.
    <div className="zuversicht" role="group" aria-labelledby={beschriftung}>
      <p className="zuversicht-frage" id={beschriftung}>
        Wie sicher bist du?
      </p>
      <div className="stufen">
        {ZUVERSICHT_STUFEN.map((stufe, i) => (
          <button
            key={stufe}
            type="button"
            className="stufe"
            data-stufe={stufe}
            ref={i === 0 ? erste : undefined}
            onClick={() => beiWahl(stufe)}
          >
            {/* Der behauptete Wert steht sichtbar auf dem Knopf und wandert
                damit auch in den zugaenglichen Namen: „Sicher, behauptet
                90 %". Wer spaeter in der Kalibrierung liest, er habe sich
                ueberschaetzt, hat vorher gelesen, was er behauptet hat. */}
            <b>{ZUVERSICHT_TEXT[stufe]}</b>
            <small>behauptet {alsProzent(ZUVERSICHT_WERT[stufe])}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
