import type { Aufgabe } from './schema';
import type { TypProps } from './vertrag';
import Wahl from './wahl/Wahl';
import Fall from './fall/Fall';
import Zuordnen from './zuordnen/Zuordnen';
import Reihenfolge from './reihenfolge/Reihenfolge';

/**
 * Der Verteiler: die einzige Stelle, die alle Typen kennt.
 *
 * Ein `switch` und keine Abbildung `typ -> Komponente`: TypeScript verengt
 * `aufgabe` in jedem Zweig auf genau den Typ, den die Komponente verlangt. Eine
 * Abbildung braeuchte dafuer einen Cast — und ein Cast ist die Stelle, an der
 * ein fuenfter Typ stillschweigend vergessen wird. Hier meldet der `never`-Zweig
 * ihn beim Uebersetzen.
 *
 * Der Schema-Import ist ein Typ-Import. Zod bleibt damit aus dem Browserbuendel.
 */
export default function Aufgabentyp({ aufgabe, ...vertrag }: TypProps<Aufgabe>) {
  switch (aufgabe.typ) {
    case 'wahl':
      return <Wahl aufgabe={aufgabe} {...vertrag} />;
    case 'fall':
      return <Fall aufgabe={aufgabe} {...vertrag} />;
    case 'zuordnen':
      return <Zuordnen aufgabe={aufgabe} {...vertrag} />;
    case 'reihenfolge':
      return <Reihenfolge aufgabe={aufgabe} {...vertrag} />;
    default: {
      const unbekannt: never = aufgabe;
      throw new Error(`Unbekannter Aufgabentyp: ${JSON.stringify(unbekannt)}`);
    }
  }
}
