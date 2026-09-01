import { useState } from 'react';
import { findeErgebnis, type PipelineDaten } from './schema';
import { pruefeWidget } from './pruefung';

/**
 * Nimmt bewusst einen ungeprueften Schluessel-Wert-Beutel entgegen statt
 * PipelineDaten: die Parameter kommen aus generiertem MDX, nicht aus
 * handgeschriebenem TSX. Die Schranke ist die Laufzeitpruefung unten, nicht
 * der Typ. `unknown` waere hier falsch - TypeScript leitet daraus fuer JSX
 * `IntrinsicAttributes` ab, womit `<Pipeline schritte={...} />` nicht mehr
 * typpruefbar ist (ts2322).
 *
 * Das Verwerfen von `children` steht nicht mehr hier, sondern in
 * `pruefeWidget` - so kann Widget zwei bis sieben es nicht vergessen.
 */
export default function Pipeline(props: Record<string, unknown>) {
  const geprueft = pruefeWidget('Pipeline', props);

  if (!geprueft.ok) {
    // Zur Bauzeit werfen, zur Laufzeit den Fehlerkasten zeigen.
    //
    // Astro rendert jede Seite zur Bauzeit; wirft eine Komponente dabei, bricht
    // `astro build` ab. Das ist der einzige Hebel, mit dem ein halluzinierter
    // Widget-Parameter den Bau anhaelt, ohne dass irgendwer MDX zerlegen muss -
    // fuer das Frontmatter erledigt das Zod ueber `astro sync`, fuer
    // Widget-Parameter gab es bis hierher nichts.
    //
    // `import.meta.env.SSR` ist beim Server-Rendern true, im Browser false, und
    // unter Vitest gemessen false (siehe tests/schema.test.tsx). Im Client-Bundle
    // faellt der Zweig samt Meldungstext bei der Toten-Code-Entfernung weg.
    if (import.meta.env.SSR) throw new Error(bauzeitMeldung(geprueft.maengel, props));

    // Zweites Netz: falls jemand die Bauzeitpruefung umgeht, faellt das Widget
    // im Browser sichtbar aus, statt still kaputt zu sein.
    return (
      <div className="widget-fehler">
        <strong>Pipeline: ungültige Parameter</strong>
        <ul>
          {geprueft.maengel.map((mangel) => (
            <li key={mangel}>{mangel}</li>
          ))}
        </ul>
      </div>
    );
  }

  return <Ansicht daten={geprueft.daten} />;
}

/**
 * Die Meldung, mit der der Bau abbricht.
 *
 * Sie muss allein tragen: Wer sie liest, sieht nur die Konsolenausgabe von
 * `npm run build`, nicht diesen Quelltext. Deshalb stehen der Widget-Name, jeder
 * einzelne Mangel und ein Zeiger auf die betroffene Lektion darin. Den Dateinamen
 * kennt die Komponente nicht - Astro reicht ihn nicht an die Insel weiter -, wohl
 * aber die Schritt-Ids des Aufrufs. Die sind eindeutig genug, um die Lektion mit
 * einer Suche zu finden.
 */
function bauzeitMeldung(maengel: readonly string[], props: Record<string, unknown>): string {
  const zeilen = maengel.map((mangel) => `  - ${mangel}`).join('\n');
  return [
    'Pipeline: ungültige Widget-Parameter — der Bau wird angehalten.',
    zeilen,
    `  Betroffene Lektion: der MDX-Rumpf unter inhalt/lektionen/ mit ${fingerabdruck(props)}`,
  ].join('\n');
}

/** Etwas Suchbares aus dem Aufruf — Schritt-Ids, sonst die Parameternamen. */
function fingerabdruck(props: Record<string, unknown>): string {
  const schritte = props.schritte;
  if (Array.isArray(schritte) && schritte.length > 0) {
    const ids = schritte.map((schritt) =>
      schritt !== null && typeof schritt === 'object' && 'id' in schritt
        ? String((schritt as { id: unknown }).id)
        : '(ohne id)',
    );
    return `diesem <Pipeline …/>-Aufruf, Schritt-Ids: ${ids.join(', ')}`;
  }

  const schluessel = Object.keys(props);
  return schluessel.length > 0
    ? `diesem <Pipeline …/>-Aufruf, Parameter: ${schluessel.join(', ')}`
    : 'einem <Pipeline />-Aufruf ganz ohne Parameter';
}

function Ansicht({ daten }: { daten: PipelineDaten }) {
  const [aktiv, setAktiv] = useState<string[]>(
    daten.schritte.filter((s) => s.optional && s.standardAn).map((s) => s.id),
  );

  const ergebnis = findeErgebnis(daten.ergebnisse, aktiv);

  function umschalten(id: string) {
    setAktiv((vorher) =>
      vorher.includes(id) ? vorher.filter((x) => x !== id) : [...vorher, id],
    );
  }

  return (
    <div className="widget widget-pipeline">
      <ol className="pipeline-schritte">
        {daten.schritte.map((schritt) => {
          const an = !schritt.optional || aktiv.includes(schritt.id);
          return (
            <li key={schritt.id} className="pipeline-schritt" data-an={an} data-optional={schritt.optional}>
              {schritt.optional ? (
                <button
                  type="button"
                  className="schritt-knopf"
                  aria-pressed={an}
                  onClick={() => umschalten(schritt.id)}
                >
                  {schritt.titel}
                </button>
              ) : (
                <span className="schritt-name">{schritt.titel}</span>
              )}
              <p className="schritt-wirkung">{schritt.wirkung}</p>
            </li>
          );
        })}
      </ol>

      <div className="pipeline-ergebnis">
        {ergebnis ? (
          <>
            <ol className="ausgabe">
              {ergebnis.ausgabe.map((zeile) => (
                <li key={zeile.text} data-treffer={zeile.treffer}>
                  {zeile.text}
                </li>
              ))}
            </ol>
            <p className="hinweis">{ergebnis.hinweis}</p>
            <p className="zaehler">
              {ergebnis.ausgabe.filter((z) => z.treffer).length} von {ergebnis.ausgabe.length}{' '}
              {daten.einheitPlural ?? `${daten.einheit}en`} relevant
            </p>
          </>
        ) : (
          <p className="hinweis">Für diese Kombination ist kein Ergebnis hinterlegt.</p>
        )}
      </div>
    </div>
  );
}
