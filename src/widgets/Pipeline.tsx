import { useState } from 'react';
import { PipelineProps, findeErgebnis, type PipelineDaten } from './schema';

/**
 * Nimmt bewusst einen ungeprueften Schluessel-Wert-Beutel entgegen statt
 * PipelineDaten: die Parameter kommen aus generiertem MDX, nicht aus
 * handgeschriebenem TSX. Die Schranke ist die Laufzeitpruefung unten, nicht
 * der Typ. `unknown` waere hier falsch - TypeScript leitet daraus fuer JSX
 * `IntrinsicAttributes` ab, womit `<Pipeline schritte={...} />` nicht mehr
 * typpruefbar ist (ts2322).
 */
export default function Pipeline({
  children: _children,
  ...props
}: Record<string, unknown>) {
  // `children` wird verworfen, bevor geprueft wird. Astro reicht es
  // serverseitig nicht mit, React bei der Hydration schon - ohne diese Zeile
  // faellt das Widget im Browser in den Fehlerkasten, waehrend Tests, Build
  // und das server-gerenderte HTML unauffaellig bleiben. Framework-Rauschen,
  // kein Inhalt; die strictObject-Schranke gilt weiter fuer alles andere.
  const geprueft = PipelineProps.safeParse(props);

  if (!geprueft.success) {
    return (
      <div className="widget-fehler">
        <strong>Pipeline: ungültige Parameter</strong>
        <pre>{JSON.stringify(geprueft.error.issues, null, 2)}</pre>
      </div>
    );
  }

  return <Ansicht daten={geprueft.data} />;
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
